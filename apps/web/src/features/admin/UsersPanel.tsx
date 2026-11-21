import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { AdminUser, UpdateUserRequest } from '@manabi/core';
import { useApi, useSession } from '../../state/session';
import { Button, Form, Section, Table } from './ui';
import { apiErrorMessage } from '../auth/ui';

/** FR-200, FR-005: list users; change role, disable or enable, set a temporary password. */
export function UsersPanel() {
  const { t } = useTranslation();
  const api = useApi();
  const me = useSession().user;
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [message, setMessage] = useState('');
  const [tempFor, setTempFor] = useState<AdminUser | null>(null);
  const [tempPassword, setTempPassword] = useState('');

  const fail = (err: unknown) => setMessage(apiErrorMessage(t, err));

  useEffect(() => {
    api.GET('/api/v1/admin/users').then(
      (body) => setUsers(body.users),
      (err: unknown) => setMessage(apiErrorMessage(t, err)),
    );
  }, [api, t]);

  async function update(user: AdminUser, body: UpdateUserRequest) {
    setMessage('');
    try {
      const updated = await api.PATCH('/api/v1/admin/users/{id}', {
        params: { path: { id: String(user.id) } },
        body,
      });
      setUsers((list) => list.map((u) => (u.id === updated.id ? updated : u)));
    } catch (err) {
      fail(err);
    }
  }

  async function submitTemp(event: FormEvent) {
    event.preventDefault();
    if (!tempFor) return;
    try {
      await api.POST('/api/v1/admin/users/{id}/temporary-password', {
        params: { path: { id: String(tempFor.id) } },
        body: { password: tempPassword },
      });
      setMessage(t('admin.users.tempPasswordSet', { username: tempFor.username }));
      setTempFor(null);
      setTempPassword('');
    } catch (err) {
      fail(err);
    }
  }

  return (
    <Section aria-labelledby="admin-users">
      <h2 id="admin-users">{t('admin.users.title')}</h2>
      {message && <p role="status">{message}</p>}
      {tempFor && (
        <Form onSubmit={submitTemp}>
          <label>
            {t('admin.users.tempPasswordFor', { username: tempFor.username })}
            <input
              type="text"
              autoComplete="off"
              required
              minLength={10}
              value={tempPassword}
              onChange={(e) => setTempPassword(e.target.value)}
            />
          </label>
          <Button type="submit">{t('admin.users.setTempPassword')}</Button>
        </Form>
      )}
      <Table>
        <thead>
          <tr>
            <th>{t('admin.users.username')}</th>
            <th>{t('admin.users.role')}</th>
            <th>{t('admin.users.lastActive')}</th>
            <th>{t('admin.users.streak')}</th>
            <th>{t('admin.users.status')}</th>
            <th>{t('admin.users.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id}>
              <td>{user.username}</td>
              <td>{t(`admin.roles.${user.role}`)}</td>
              <td>{user.lastActiveDate ?? t('admin.users.never')}</td>
              <td>{user.currentStreak}</td>
              <td>{user.disabledAt ? t('admin.users.disabled') : t('admin.users.enabled')}</td>
              <td>
                {user.id === me?.id ? (
                  t('admin.users.self')
                ) : (
                  <>
                    <Button
                      onClick={() =>
                        update(user, { role: user.role === 'admin' ? 'learner' : 'admin' })
                      }
                    >
                      {user.role === 'admin'
                        ? t('admin.users.makeLearner')
                        : t('admin.users.makeAdmin')}
                    </Button>{' '}
                    <Button onClick={() => update(user, { disabled: !user.disabledAt })}>
                      {user.disabledAt ? t('admin.users.enable') : t('admin.users.disable')}
                    </Button>{' '}
                    <Button onClick={() => setTempFor(user)}>
                      {t('admin.users.tempPassword')}
                    </Button>
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Section>
  );
}
