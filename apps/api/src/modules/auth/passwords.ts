import { randomBytes } from 'node:crypto';
import * as argon2 from 'argon2';
import { COMMON_PASSWORDS } from './commonPasswords';

/**
 * NFR-10: Argon2id with OWASP's first recommended configuration (19 MiB memory, 2 iterations,
 * 1 lane, as in the Password Storage Cheat Sheet). About 30 to 60 ms per hash on the home server,
 * which is fine for a family-sized user base and keeps several sign-ins at once well inside the
 * LXC's memory. The salt is random per hash and stored in the PHC string, which starts with
 * `$argon2id$` as the users table's CHECK requires.
 */
export const ARGON2_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19_456,
  timeCost: 2,
  parallelism: 1,
} as const;

export function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, ARGON2_OPTIONS);
}

/** True when `password` matches `hash`. A malformed hash counts as no match. */
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

/** True when `hash` was made with other parameters than today's, so it should be redone. */
export function needsRehash(hash: string): boolean {
  return argon2.needsRehash(hash, ARGON2_OPTIONS);
}

let dummyHash: Promise<string> | undefined;

/**
 * Spends the same time as checking a real password, so a sign-in for an unknown username takes
 * as long as one with a wrong password and does not reveal which usernames exist.
 */
export async function verifyDummyPassword(password: string): Promise<false> {
  dummyHash ??= hashPassword(randomBytes(32).toString('base64url'));
  await verifyPassword(await dummyHash, password);
  return false;
}

const common = new Set(COMMON_PASSWORDS);

/**
 * SDD section 11: why a new password is unacceptable beyond its length (checked by Zod), or null
 * when it is fine. Rejects passwords on the common-password list, ignoring case, and the
 * account's own username.
 */
export function passwordProblem(password: string, username: string): string | null {
  const lower = password.toLowerCase();
  if (common.has(lower)) return 'This password is too common; choose another';
  if (lower === username.toLowerCase()) return 'The password must not be the username';
  return null;
}
