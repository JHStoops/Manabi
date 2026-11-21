import type { Pool } from 'pg';
import type {
  AdminUser,
  CreateInviteResponse,
  ImportRun,
  Invite,
  StartImportRequest,
  UpdateUserRequest,
} from '@manabi/core';
import type { createInviteRequestSchema } from '@manabi/core';
import type { z } from '@manabi/core';
import type { SmtpConfig } from '../../config';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import type { JobQueue } from '../../jobs/queue';
import type { Logger } from '../../logger';
import { sendMail } from '../../mailer';
import { deleteSessionsOfUser } from '../auth/queries';
import type { InviteRow } from '../auth/rows';
import type { ScopedUserId } from '../auth/service';
import {
  appLink,
  createInvite as insertInvite,
  setTemporaryPassword,
  toUser,
} from '../auth/service';
import { defaultDatasetFile } from '../imports/service';
import * as q from './queries';
import type { AdminUserRow } from './queries';
import type { ImportRunRow } from './rows';

// The admin console (Product Spec section 11): users, invites and dataset imports.

function toAdminUser(row: AdminUserRow): AdminUser {
  return {
    ...toUser(row),
    lastActiveDate: row.last_active_date,
    currentStreak: row.current_streak,
    createdAt: row.created_at.toISOString(),
  };
}

function toInvite(row: InviteRow & { expired: boolean }): Invite {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    status: row.used_at ? 'used' : row.revoked_at ? 'revoked' : row.expired ? 'expired' : 'pending',
    createdAt: row.created_at.toISOString(),
    expiresAt: row.expires_at.toISOString(),
  };
}

function toImportRun(row: ImportRunRow): ImportRun {
  return {
    id: row.id,
    importer: row.importer,
    status: row.status,
    startedAt: row.started_at.toISOString(),
    finishedAt: row.finished_at?.toISOString() ?? null,
    summary: row.summary,
  };
}

/** FR-200 */
export async function listUsers(db: Queryable): Promise<AdminUser[]> {
  return (await q.listUsers(db)).map(toAdminUser);
}

/**
 * FR-200: changes a user's role or disables or re-enables the account. Disabling signs the
 * account out everywhere in the same transaction. Admins cannot demote or disable themselves,
 * so the server always keeps at least one admin who can sign in.
 */
export async function updateUser(
  pool: Pool,
  actor: ScopedUserId,
  id: number,
  body: UpdateUserRequest,
): Promise<AdminUser> {
  if (id === actor) {
    throw new AppError('conflict', 'You cannot change your own role or disable your own account');
  }
  return withTransaction(pool, async (client) => {
    // Locking the enabled admins serializes concurrent changes, so two admins disabling each
    // other at once cannot leave the server with none.
    const admins = await q.lockEnabledAdmins(client);
    const removesAdmin = body.disabled === true || body.role === 'learner';
    if (removesAdmin && admins.length === 1 && admins[0] === id) {
      throw new AppError('conflict', 'This is the last enabled admin');
    }
    const found = await q.updateUser(client, id, {
      role: body.role ?? null,
      disabled: body.disabled ?? null,
    });
    if (!found) throw new AppError('not_found', 'User not found');
    if (body.disabled) await deleteSessionsOfUser(client, id);
    return toAdminUser((await q.findUser(client, id))!);
  });
}

/** FR-005, FR-200: a temporary password the user must change at the next sign-in. */
export async function setUserTemporaryPassword(
  pool: Pool,
  id: number,
  password: string,
): Promise<void> {
  if (!(await setTemporaryPassword(pool, id, password))) {
    throw new AppError('not_found', 'User not found');
  }
}

/** FR-002 */
export async function listInvites(db: Queryable): Promise<Invite[]> {
  return (await q.listInvites(db)).map(toInvite);
}

/**
 * FR-002, IF-10: creates an invite and returns its link to copy. With SMTP configured and an
 * address given, the link is also emailed; a failed send is logged and reported as not emailed,
 * since the admin can still copy the link.
 */
export async function createInvite(
  db: Queryable,
  options: { smtp: SmtpConfig | null; publicUrl: string; actor: ScopedUserId; log: Logger },
  body: z.output<typeof createInviteRequestSchema>,
): Promise<CreateInviteResponse> {
  const { token, invite } = await insertInvite(db, {
    email: body.email ?? null,
    role: body.role,
    createdBy: options.actor,
    ttlDays: body.expiresInDays,
  });
  const link = appLink(options.publicUrl, `/invite/${token}`);
  let emailed = false;
  if (options.smtp && invite.email) {
    try {
      await sendMail(options.smtp, {
        to: invite.email,
        subject: "You're invited to Manabi",
        text:
          `You have been invited to learn on Manabi. Open this link to create your account ` +
          `(it works once, until ${invite.expires_at.toUTCString()}):\n\n${link}\n`,
      });
      emailed = true;
    } catch (err) {
      options.log.error({ err }, 'invite email not sent');
    }
  }
  return { invite: toInvite({ ...invite, expired: false }), link, emailed };
}

/** FR-002: an invite that was already used cannot be revoked. */
export async function revokeInvite(db: Queryable, id: number): Promise<void> {
  if (await q.revokeInvite(db, id)) return;
  if (await q.findInvite(db, id)) throw new AppError('conflict', 'This invite was already used');
  throw new AppError('not_found', 'Invite not found');
}

/** FR-226 */
export async function listImportRuns(db: Queryable): Promise<ImportRun[]> {
  return (await q.listImportRuns(db)).map(toImportRun);
}

/**
 * FR-226: sends the importer's job to the worker, which records the run in import_runs. The
 * file is relative to DATASETS_DIR; the worker checks it stays inside.
 */
export async function startImport(jobs: JobQueue, body: StartImportRequest): Promise<string> {
  const { importer, courseKey } = body;
  const data =
    importer === 'level-lists'
      ? { courseKey }
      : { courseKey, file: body.file ?? defaultDatasetFile(importer) };
  const jobId = await jobs.enqueue(`import-${importer}`, data);
  if (!jobId) {
    throw new AppError('service_unavailable', 'The job queue is unavailable; try again later');
  }
  return jobId;
}
