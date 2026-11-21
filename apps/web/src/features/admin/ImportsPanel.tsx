import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { importerSchema } from '@manabi/core';
import type { ImportRun, Importer } from '@manabi/core';
import { ApiRequestError } from '@manabi/api-client';
import { useApi } from '../../state/session';
import { Button, Form, Section, Table } from './ui';
import { apiErrorMessage } from '../auth/ui';

/** The counts or the error of a finished run, in one short line. */
function result(run: ImportRun): string {
  const { added, updated, skipped, error } = run.summary;
  if (typeof error === 'string') return error;
  if (added === undefined) return '';
  return `+${String(added)} ~${String(updated)} =${String(skipped)}`;
}

/** FR-226: start or re-run a dataset import and see each run's result. */
export function ImportsPanel() {
  const { t } = useTranslation();
  const api = useApi();
  const [runs, setRuns] = useState<ImportRun[]>([]);
  const [message, setMessage] = useState('');
  const [importer, setImporter] = useState<Importer>('kanjidic2');
  const [courseKey, setCourseKey] = useState('');
  const [file, setFile] = useState('');

  const fail = useCallback(
    (err: unknown) =>
      setMessage(
        err instanceof ApiRequestError && err.code === 'service_unavailable'
          ? t('admin.imports.queueDown')
          : apiErrorMessage(t, err),
      ),
    [t],
  );
  const load = useCallback(
    () => api.GET('/api/v1/admin/imports').then((body) => setRuns(body.runs), fail),
    [api, fail],
  );
  useEffect(() => void load(), [load]);

  async function start(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await api.POST('/api/v1/admin/imports', {
        body: { importer, courseKey, ...(file ? { file } : {}) },
      });
      setMessage(t('admin.imports.started'));
    } catch (err) {
      fail(err);
    }
  }

  return (
    <Section aria-labelledby="admin-imports">
      <h2 id="admin-imports">{t('admin.imports.title')}</h2>
      <Form onSubmit={start}>
        <label>
          {t('admin.imports.importer')}
          <select value={importer} onChange={(e) => setImporter(e.target.value as Importer)}>
            {importerSchema.options.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t('admin.imports.courseKey')}
          <input required value={courseKey} onChange={(e) => setCourseKey(e.target.value)} />
        </label>
        {importer !== 'level-lists' && (
          <label>
            {t('admin.imports.file')}
            <input value={file} onChange={(e) => setFile(e.target.value)} />
          </label>
        )}
        <Button type="submit">{t('admin.imports.run')}</Button>
        <Button type="button" onClick={() => void load()}>
          {t('admin.imports.refresh')}
        </Button>
      </Form>
      {message && <p role="status">{message}</p>}
      {runs.length === 0 ? (
        <p>{t('admin.imports.none')}</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>{t('admin.imports.importer')}</th>
              <th>{t('admin.imports.startedAt')}</th>
              <th>{t('admin.imports.status')}</th>
              <th>{t('admin.imports.result')}</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <tr key={run.id}>
                <td>{run.importer}</td>
                <td>{new Date(run.startedAt).toLocaleString()}</td>
                <td>{t(`admin.imports.statuses.${run.status}`)}</td>
                <td>{result(run)}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </Section>
  );
}
