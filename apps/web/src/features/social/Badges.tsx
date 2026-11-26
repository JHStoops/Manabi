import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { WeeklyBadges } from '@manabi/core';
import { useApi } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';

// FR-181: the learner's top-three weekly finishes, shown on their profile.
export default function Badges() {
  const { t } = useTranslation();
  const api = useApi();
  const [data, setData] = useState<WeeklyBadges | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    api.GET('/api/v1/me/badges').then(setData, (err) => setProblem(apiErrorMessage(t, err)));
  }, [api, t]);

  return (
    <section aria-labelledby="badges-heading">
      <h2 id="badges-heading">{t('leaderboard.badgesTitle')}</h2>
      {problem && <p role="alert">{problem}</p>}
      {data && data.badges.length === 0 && <p>{t('leaderboard.noBadges')}</p>}
      <ul>
        {data?.badges.map((b) => (
          <li key={b.weekStart}>
            <span aria-hidden="true">{['🥇', '🥈', '🥉'][b.rank - 1]} </span>
            {t('leaderboard.badge', { date: b.weekStart, rank: b.rank, xp: b.xp })}
          </li>
        ))}
      </ul>
    </section>
  );
}
