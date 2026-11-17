import type { AnyJobDefinition } from './define';
import { importJmdictJob } from './importJmdict';
import { importKanjidic2Job } from './importKanjidic2';
import { importKanjiVgJob } from './importKanjiVg';
import { importLevelListsJob } from './importLevelLists';
import { importTatoebaJob } from './importTatoeba';
import { purgeExpiredJob } from './purgeExpired';

/**
 * Every background job the worker runs. Imports, streak and leaderboard jobs are added here as
 * their issues land. Audio is not a job: the API generates a clip on first play.
 */
export const allJobs: readonly AnyJobDefinition[] = [
  purgeExpiredJob,
  importKanjidic2Job,
  importLevelListsJob,
  importJmdictJob,
  importKanjiVgJob,
  importTatoebaJob,
];
