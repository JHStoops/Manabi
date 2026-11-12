import type { ImportFile } from '../modules/imports/service';
import { importKanjidic2 } from '../modules/imports/service';
import { defineJob } from './define';

/** FR-226: KANJIDIC2 import, sent on demand (no schedule). Re-running is harmless. */
export const importKanjidic2Job = defineJob<ImportFile>({
  name: 'import-kanjidic2',
  handler: async (data, { db, log }) => {
    const summary = await importKanjidic2(db, data);
    log.info({ job: 'import-kanjidic2', ...summary }, 'imported KANJIDIC2');
    return summary;
  },
});
