import { importFileJobSchema } from '@manabi/core';
import type { z } from '@manabi/core';
import { loadConfig } from '../config';
import { datasetPath, importTatoeba } from '../modules/imports/service';
import { defineJob } from './define';

/** FR-226: Tatoeba import (`file` is the unpacked exports folder), sent on demand. */
export const importTatoebaJob = defineJob<z.input<typeof importFileJobSchema>>({
  name: 'import-tatoeba',
  // A failed import is already recorded in import_runs; retrying would only add failed rows.
  queue: { retryLimit: 0 },
  handler: async (data, { db, log }) => {
    // Admins send these jobs (#23): the file must stay inside DATASETS_DIR.
    const { courseKey, file } = importFileJobSchema.parse(data);
    const path = await datasetPath(loadConfig().datasetsDir, file);
    const summary = await importTatoeba(db, { courseKey, file: path });
    log.info({ job: 'import-tatoeba', ...summary }, 'imported Tatoeba');
    return summary;
  },
});
