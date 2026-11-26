import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ReviewSummary } from '@manabi/core';
import { useApi } from '../../state/session';
import { tapTarget } from '../../theme';

const Bars = styled.ul`
  display: flex;
  align-items: flex-end;
  gap: ${({ theme }) => theme.spacing(2)};
  height: 140px;
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Day = styled.li`
  display: flex;
  flex: 1;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  height: 100%;
  font-size: ${({ theme }) => theme.fontSizes.small};
  div {
    width: 100%;
    min-height: 2px;
    background: ${({ theme }) => theme.colors.primary};
  }
`;

const Start = styled(Link)`
  ${({ theme }) => tapTarget(theme)};
  display: inline-flex;
  align-items: center;
  padding: 0 ${({ theme }) => theme.spacing(4)};
  border-radius: ${({ theme }) => theme.radii.medium};
  background: ${({ theme }) => theme.colors.primary};
  color: ${({ theme }) => theme.colors.primaryText};
  font-weight: bold;
  text-decoration: none;
`;

/** FR-113: items due now, a way into the session, and a 7-day forecast. */
export default function ReviewPage() {
  const { t } = useTranslation();
  const api = useApi();
  const [summary, setSummary] = useState<ReviewSummary | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    api.GET('/api/v1/reviews/summary').then(
      (loaded) => current && setSummary(loaded),
      () => current && setFailed(true),
    );
    return () => {
      current = false;
    };
  }, [api]);

  if (failed) return <p role="alert">{t('review.loadFailed')}</p>;
  if (!summary) return <p>{t('app.loading')}</p>;
  const max = Math.max(1, ...summary.forecast.map((day) => day.count));
  return (
    <>
      <h1>{t('area.review')}</h1>
      <p>{t('review.dueNow', { count: summary.dueNow })}</p>
      {summary.dueNow > 0 ? (
        <Start to="/review/session">{t('review.start')}</Start>
      ) : (
        <p>{t('review.nothingDue')}</p>
      )}
      <h2>{t('review.forecast')}</h2>
      {/* NFR-31: each bar carries its count as text. */}
      <Bars>
        {summary.forecast.map(({ date, count }) => (
          <Day
            key={date}
            aria-label={t('review.forecastDay', {
              date: new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
                weekday: 'short',
              }),
              count,
            })}
          >
            <span>{count}</span>
            <div style={{ height: `${(100 * count) / max}%` }} />
            <span aria-hidden="true">
              {new Date(`${date}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short' })}
            </span>
          </Day>
        ))}
      </Bars>
    </>
  );
}
