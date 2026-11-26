import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Leaderboard as Board } from '@manabi/core';
import { useApi, useSession } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';

// FR-180, FR-184: this week's board. Opted-out learners see it but are not listed.
export default function Leaderboard() {
  const { t } = useTranslation();
  const api = useApi();
  const { user } = useSession();
  const [board, setBoard] = useState<Board | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    api.GET('/api/v1/leaderboard').then(setBoard, (err) => setProblem(apiErrorMessage(t, err)));
  }, [api, t]);

  return (
    <section aria-labelledby="leaderboard-heading">
      <h2 id="leaderboard-heading">{t('leaderboard.title')}</h2>
      {problem && <p role="alert">{problem}</p>}
      {user && !user.settings.appearOnLeaderboard && <p>{t('leaderboard.optedOut')}</p>}
      {board && board.entries.length === 0 && <p>{t('leaderboard.empty')}</p>}
      <ol>
        {board?.entries.map((e) => (
          <li key={e.userId} value={e.rank}>
            {t('leaderboard.row', { rank: e.rank, name: e.displayName, xp: e.xp })}
            {e.userId === user?.id && ` (${t('leaderboard.you')})`}
          </li>
        ))}
      </ol>
    </section>
  );
}
