import { importLevelListsJobSchema } from '@manabi/core';
import { loadConfig } from '../config';
import { importLevelLists } from '../modules/imports/service';
import { defineJob } from './define';

/** FR-226, FR-233: level-list import up to `LEVEL_CEILING`, sent on demand. Re-running is harmless. */
export const importLevelListsJob = defineJob<{ courseKey: string }>({
  name: 'import-level-lists',
  // A failed import is already recorded in import_runs; retrying would only add failed rows.
  queue: { retryLimit: 0 },
  handler: async (data, { db, log }) => {
    const { courseKey } = importLevelListsJobSchema.parse(data);
    const ceiling = loadConfig().levelCeiling;
    const summary = await importLevelLists(db, { courseKey, ceiling });
    log.info({ job: 'import-level-lists', ...summary }, 'imported level lists');
    return summary;
  },
});
