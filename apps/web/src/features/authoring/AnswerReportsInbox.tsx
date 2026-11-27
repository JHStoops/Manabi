import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { AnswerReport } from '@manabi/core';
import { useApi } from '../../state/session';
import { apiErrorMessage } from '../auth/ui';
import { Button, Section } from '../admin/ui';

// FR-229, Product Spec section 11: the answer reports inbox. Open reports, oldest first; accept
// adds the reported answer to the exercise's accept list (pinning a generated exercise first),
// dismiss closes the report and leaves the exercise as it is.

/** The accept list an author would extend: the stored exercise's, else the reported copy's. */
function acceptList(report: AnswerReport): string[] {
  if (report.currentAccept) return report.currentAccept;
  const accept = report.exercisePayload.accept;
  return Array.isArray(accept)
    ? accept.flatMap((a) => (typeof a?.text === 'string' ? [a.text as string] : []))
    : [];
}

export function AnswerReportsInbox() {
  const { t } = useTranslation();
  const api = useApi();
  const [reports, setReports] = useState<AnswerReport[] | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load(cursor?: string) {
    try {
      const page = await api.GET('/api/v1/authoring/reports', {
        params: { query: cursor ? { status: 'open', cursor } : { status: 'open' } },
      });
      setReports((shown) => [...(cursor ? (shown ?? []) : []), ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (err) {
      setError(apiErrorMessage(t, err));
    }
  }

  useEffect(() => {
    void load();
  }, [api]);

  async function resolve(report: AnswerReport, action: 'accept' | 'dismiss') {
    if (busy !== null) return;
    setBusy(report.id);
    setMessage('');
    setError('');
    try {
      const init = { params: { path: { id: String(report.id) } }, body: {} };
      await (action === 'accept'
        ? api.POST('/api/v1/authoring/reports/{id}/accept', init)
        : api.POST('/api/v1/authoring/reports/{id}/dismiss', init));
      setReports((shown) => shown?.filter((r) => r.id !== report.id) ?? null);
      setMessage(
        t(action === 'accept' ? 'authoring.reports.accepted' : 'authoring.reports.dismissed', {
          answer: report.givenAnswer,
        }),
      );
    } catch (err) {
      setError(apiErrorMessage(t, err));
    } finally {
      setBusy(null);
    }
  }

  return (
    <Section aria-labelledby="answer-reports">
      <h2 id="answer-reports">{t('authoring.reports.heading')}</h2>
      {message && <p role="status">{message}</p>}
      {error && <p role="alert">{error}</p>}
      {reports?.length === 0 && <p>{t('authoring.reports.none')}</p>}
      {reports && reports.length > 0 && (
        <ul>
          {reports.map((report) => {
            const prompt = report.exercisePayload.prompt;
            return (
              <li key={report.id}>
                <p>
                  {t('authoring.reports.summary', {
                    course: report.courseTitle,
                    type: report.exerciseType,
                    reporter: report.reporter ?? t('authoring.reports.deletedReporter'),
                  })}
                </p>
                {typeof prompt === 'string' && <p>{prompt}</p>}
                <p>
                  {t('authoring.reports.answer')} <strong>{report.givenAnswer}</strong>
                </p>
                <p>
                  {t('authoring.reports.acceptList')} <span>{acceptList(report).join(', ')}</span>
                </p>
                {report.exerciseId === null && <p>{t('authoring.reports.generated')}</p>}
                <Button
                  type="button"
                  aria-label={t('authoring.reports.accept', { answer: report.givenAnswer })}
                  aria-disabled={busy !== null}
                  onClick={() => void resolve(report, 'accept')}
                >
                  {t('authoring.reports.acceptShort')}
                </Button>{' '}
                <Button
                  type="button"
                  aria-label={t('authoring.reports.dismiss', { answer: report.givenAnswer })}
                  aria-disabled={busy !== null}
                  onClick={() => void resolve(report, 'dismiss')}
                >
                  {t('authoring.reports.dismissShort')}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      {nextCursor && (
        <Button type="button" onClick={() => void load(nextCursor)}>
          {t('authoring.reports.more')}
        </Button>
      )}
    </Section>
  );
}
