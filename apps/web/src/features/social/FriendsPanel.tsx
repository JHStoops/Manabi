import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { NudgeKind, PublicProfile } from '@manabi/core';
import { useApi } from '../../state/session';
import { Button, Section, Table } from '../admin/ui';
import { apiErrorMessage } from '../auth/ui';

/** FR-182, FR-183: followed learners with their stats, unfollow and the two nudge buttons. */
export function FriendsPanel() {
  const { t } = useTranslation();
  const api = useApi();
  const [friends, setFriends] = useState<PublicProfile[]>([]);
  const [nudged, setNudged] = useState<number[]>([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    api.GET('/api/v1/friends').then(
      (body) => setFriends(body.friends),
      (err: unknown) => setMessage(apiErrorMessage(t, err)),
    );
  }, [api, t]);

  async function unfollow(friend: PublicProfile) {
    setMessage('');
    try {
      await api.DELETE('/api/v1/follows/{userId}', {
        params: { path: { userId: String(friend.id) } },
      });
      setFriends((list) => list.filter((f) => f.id !== friend.id));
    } catch (err) {
      setMessage(apiErrorMessage(t, err));
    }
  }

  async function nudge(friend: PublicProfile, kind: NudgeKind) {
    setMessage('');
    try {
      await api.POST('/api/v1/nudges', { body: { toUserId: friend.id, kind } });
      setNudged((ids) => [...ids, friend.id]);
    } catch (err) {
      setMessage(apiErrorMessage(t, err));
    }
  }

  return (
    <Section aria-labelledby="social-friends">
      <h2 id="social-friends">{t('social.friends.title')}</h2>
      {message && <p role="alert">{message}</p>}
      {friends.length === 0 && !message ? (
        <p>{t('social.friends.empty')}</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>{t('social.friends.name')}</th>
              <th>{t('social.friends.streak')}</th>
              <th>{t('social.friends.level')}</th>
              <th>{t('social.friends.weeklyXp')}</th>
              <th>{t('social.friends.section')}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {friends.map((f) => (
              <tr key={f.id}>
                <td>{f.displayName}</td>
                <td>{f.currentStreak}</td>
                <td>{f.level ?? '–'}</td>
                <td>{f.weeklyXp}</td>
                <td>{f.section ?? '–'}</td>
                <td>
                  {nudged.includes(f.id)
                    ? t('social.friends.nudgeSent')
                    : (['nice_work', 'keep_going'] as const).map((kind) => (
                        <Button
                          key={kind}
                          onClick={() => nudge(f, kind)}
                          aria-label={t('social.friends.forFriend', {
                            action: t(`social.friends.nudge.${kind}`),
                            name: f.displayName,
                          })}
                        >
                          {t(`social.friends.nudge.${kind}`)}
                        </Button>
                      ))}
                  <Button
                    onClick={() => unfollow(f)}
                    aria-label={t('social.friends.forFriend', {
                      action: t('social.friends.unfollow'),
                      name: f.displayName,
                    })}
                  >
                    {t('social.friends.unfollow')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Section>
  );
}
