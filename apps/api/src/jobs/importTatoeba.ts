import type { ImportFile } from '../modules/imports/service';
import { importTatoeba } from '../modules/imports/service';
import { defineJob } from './define';

/** FR-226: Tatoeba import (`file` is the unpacked exports folder), sent on demand. */
export const importTatoebaJob = defineJob<ImportFile>({
  name: 'import-tatoeba',
  // A failed import is already recorded in import_runs; retrying would only add failed rows.
  queue: { retryLimit: 0 },
  handler: async (data, { db, log }) => {
    const summary = await importTatoeba(db, data);
    log.info({ job: 'import-tatoeba', ...summary }, 'imported Tatoeba');
    return summary;
  },
});
