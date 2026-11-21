import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { CreateInviteResponse, Invite, Role } from '@manabi/core';
import { useApi } from '../../state/session';
import { Button, Form, Section, Table } from './ui';
import { apiErrorMessage } from '../auth/ui';

/** FR-002, IF-10: create an invite (its link shown to copy, emailed when possible), list, revoke. */
export function InvitesPanel() {
  const { t } = useTranslation();
  const api = useApi();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('learner');
  const [days, setDays] = useState(7);
  const [created, setCreated] = useState<CreateInviteResponse | null>(null);
  const [copied, setCopied] = useState(false);

  const fail = useCallback((err: unknown) => setMessage(apiErrorMessage(t, err)), [t]);
  const load = useCallback(
    () => api.GET('/api/v1/admin/invites').then((body) => setInvites(body.invites), fail),
    [api, fail],
  );
  useEffect(() => void load(), [load]);

  async function create(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    setCopied(false);
    try {
      setCreated(
        await api.POST('/api/v1/admin/invites', {
          body: { role, expiresInDays: days, ...(email ? { email } : {}) },
        }),
      );
      setEmail('');
      await load();
    } catch (err) {
      fail(err);
    }
  }

  async function revoke(invite: Invite) {
    setMessage('');
    try {
      await api.DELETE('/api/v1/admin/invites/{id}', {
        params: { path: { id: String(invite.id) } },
      });
      await load();
    } catch (err) {
      fail(err);
    }
  }

  async function copy(link: string) {
    await navigator.clipboard.writeText(link);
    setCopied(true);
  }

  return (
    <Section aria-labelledby="admin-invites">
      <h2 id="admin-invites">{t('admin.invites.title')}</h2>
      <Form onSubmit={create}>
        <label>
          {t('admin.invites.email')}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>
          {t('admin.invites.role')}
          <select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="learner">{t('admin.roles.learner')}</option>
            <option value="admin">{t('admin.roles.admin')}</option>
          </select>
        </label>
        <label>
          {t('admin.invites.expiresInDays')}
          <input
            type="number"
            min={1}
            max={30}
            required
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          />
        </label>
        <Button type="submit">{t('admin.invites.create')}</Button>
      </Form>
      {message && <p role="status">{message}</p>}
      {created && (
        <div role="status">
          <label>
            {t('admin.invites.link')}
            <input readOnly value={created.link} onFocus={(e) => e.target.select()} size={60} />
          </label>{' '}
          <Button onClick={() => void copy(created.link)}>
            {copied ? t('admin.invites.copied') : t('admin.invites.copy')}
          </Button>
          <p>{created.emailed ? t('admin.invites.emailed') : t('admin.invites.notEmailed')}</p>
        </div>
      )}
      {invites.length === 0 ? (
        <p>{t('admin.invites.none')}</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>{t('admin.invites.email')}</th>
              <th>{t('admin.invites.role')}</th>
              <th>{t('admin.invites.expires')}</th>
              <th>{t('admin.invites.status')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {invites.map((invite) => (
              <tr key={invite.id}>
                <td>{invite.email ?? '—'}</td>
                <td>{t(`admin.roles.${invite.role}`)}</td>
                <td>{new Date(invite.expiresAt).toLocaleString()}</td>
                <td>{t(`admin.invites.statuses.${invite.status}`)}</td>
                <td>
                  {invite.status === 'pending' && (
                    <Button onClick={() => void revoke(invite)}>{t('admin.invites.revoke')}</Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Section>
  );
}
