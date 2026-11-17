import type { ImportFile } from '../modules/imports/service';
import { importKanjiVg } from '../modules/imports/service';
import { defineJob } from './define';

/** FR-226, FR-077: KanjiVG stroke import, sent on demand (no schedule). Re-running is harmless. */
export const importKanjiVgJob = defineJob<ImportFile>({
  name: 'import-kanjivg',
  // A failed import is already recorded in import_runs; retrying would only add failed rows.
  queue: { retryLimit: 0 },
  handler: async (data, { db, log }) => {
    const summary = await importKanjiVg(db, data);
    log.info({ job: 'import-kanjivg', ...summary }, 'imported KanjiVG');
    return summary;
  },
});
