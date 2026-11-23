import { useTranslation } from 'react-i18next';
import { levelProgress } from '@manabi/core';

/**
 * FR-160, FR-162: the XP part of the lesson results screen: XP earned and progress within the
 * course level, from the completion response. The lesson player (#31) shows it on its results step.
 */
export function LessonResults({ xpEarned, totalXp }: { xpEarned: number; totalXp: number }) {
  const { t } = useTranslation();
  const { level, xpIntoLevel, xpForNextLevel } = levelProgress(totalXp);
  const next = level + 1;
  return (
    <section>
      <p>{t('results.xpEarned', { count: xpEarned })}</p>
      <p>{t('results.level', { level })}</p>
      <progress
        aria-label={t('results.levelProgress', { next })}
        value={xpIntoLevel}
        max={xpForNextLevel}
      />
      <p>{t('results.toNextLevel', { into: xpIntoLevel, span: xpForNextLevel, next })}</p>
    </section>
  );
}
