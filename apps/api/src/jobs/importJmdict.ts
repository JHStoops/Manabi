import type { ImportFile } from '../modules/imports/service';
import { importJmdict } from '../modules/imports/service';
import { defineJob } from './define';

/** FR-226: JMdict import, sent on demand (no schedule). Re-running is harmless. */
export const importJmdictJob = defineJob<ImportFile>({
  name: 'import-jmdict',
  // A failed import is already recorded in import_runs; retrying would only add failed rows.
  queue: { retryLimit: 0 },
  handler: async (data, { db, log }) => {
    const summary = await importJmdict(db, data);
    log.info({ job: 'import-jmdict', ...summary }, 'imported JMdict');
    return summary;
  },
});
