import { importFileJobSchema } from '@manabi/core';
import type { z } from '@manabi/core';
import { loadConfig } from '../config';
import { datasetPath, importJmdict } from '../modules/imports/service';
import { defineJob } from './define';

/** FR-226: JMdict import, sent on demand (no schedule). Re-running is harmless. */
export const importJmdictJob = defineJob<z.input<typeof importFileJobSchema>>({
  name: 'import-jmdict',
  // A failed import is already recorded in import_runs; retrying would only add failed rows.
  queue: { retryLimit: 0 },
  handler: async (data, { db, log }) => {
    // Admins send these jobs (#23): the file must stay inside DATASETS_DIR.
    const { courseKey, file } = importFileJobSchema.parse(data);
    const path = await datasetPath(loadConfig().datasetsDir, file);
    const summary = await importJmdict(db, { courseKey, file: path });
    log.info({ job: 'import-jmdict', ...summary }, 'imported JMdict');
    return summary;
  },
});
