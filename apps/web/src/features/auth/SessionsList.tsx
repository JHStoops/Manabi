import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Session } from '@manabi/core';
import { useApi, useSessionDispatch } from '../../state/session';
import { apiErrorMessage, Button } from './ui';

// FR-004: the signed-in user's active sessions, each revocable.
export default function SessionsList() {
  const { t } = useTranslation();
  const api = useApi();
  const dispatch = useSessionDispatch();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setSessions((await api.GET('/api/v1/me/sessions')).sessions);
    } catch (err) {
      setProblem(apiErrorMessage(t, err));
    }
  }, [api, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revoke(session: Session) {
    setProblem(null);
    try {
      await api.DELETE('/api/v1/me/sessions/{id}', {
        params: { path: { id: String(session.id) } },
      });
      if (session.current) dispatch({ type: 'signedOut' });
      else await load();
    } catch (err) {
      setProblem(apiErrorMessage(t, err));
    }
  }

  return (
    <section aria-labelledby="sessions-heading">
      <h2 id="sessions-heading">{t('sessions.title')}</h2>
      {problem && <p role="alert">{problem}</p>}
      <ul>
        {sessions?.map((session) => {
          const name = `${t(`sessions.kind.${session.clientKind}`)}${
            session.current ? ` (${t('sessions.current')})` : ''
          }, ${t('sessions.lastSeen', { date: new Date(session.lastSeenAt).toLocaleString() })}`;
          return (
            <li key={session.id}>
              {name}{' '}
              <Button
                type="button"
                onClick={() => revoke(session)}
                aria-label={t('sessions.revokeNamed', { name })}
              >
                {t('sessions.revoke')}
              </Button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
