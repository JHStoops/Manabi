import { basename, resolve } from 'node:path';
import type { Pool } from 'pg';
import { ContentPackError } from '@manabi/core';
import { loadConfig } from './config';
import { createPool } from './db/pool';
import { readPack, writePack } from './modules/content/packFiles';
import { exportPack, importPack } from './modules/content/service';
import {
  importJmdict,
  importKanjidic2,
  importKanjiVg,
  importLevelLists,
} from './modules/imports/service';

const USAGE = `Usage: manabi pack import <dir>
       manabi pack export <dir>   (the folder name is the course key, for example content/ja-en)
       manabi import kanjidic2 <course-key> <file>
       manabi import level-lists <course-key>   (up to LEVEL_CEILING, default N3)
       manabi import jmdict <course-key> <file>
       manabi import kanjivg <course-key> <file>`;

/** Picks the command to run, or null for bad arguments. */
function command([group, name, arg, file]: string[]): ((pool: Pool) => Promise<unknown>) | null {
  if (!arg) return null;
  // npm scripts run in the workspace folder; INIT_CWD is where the command was typed.
  const cwd = process.env.INIT_CWD ?? process.cwd();
  if (group === 'import' && name === 'kanjidic2' && file) {
    return (pool) => importKanjidic2(pool, { courseKey: arg, file: resolve(cwd, file) });
  }
  if (group === 'import' && name === 'kanjivg' && file) {
    return (pool) => importKanjiVg(pool, { courseKey: arg, file: resolve(cwd, file) });
  }
  if (group === 'import' && name === 'jmdict' && file) {
    return (pool) => importJmdict(pool, { courseKey: arg, file: resolve(cwd, file) });
  }
  if (group === 'import' && name === 'level-lists' && !file) {
    return (pool) => importLevelLists(pool, { courseKey: arg, ceiling: loadConfig().levelCeiling });
  }
  const dir = resolve(cwd, arg);
  if (group === 'pack' && name === 'import') {
    return async (pool) => {
      await importPack(pool, await readPack(dir));
      return `Imported ${dir}`;
    };
  }
  if (group === 'pack' && name === 'export') {
    return async (pool) => {
      await writePack(dir, await exportPack(pool, basename(dir)));
      return `Exported to ${dir}`;
    };
  }
  return null;
}

/** `manabi pack import|export` (FR-227) and `manabi import <dataset>` (FR-226) on DATABASE_URL. */
async function main(args: string[]): Promise<void> {
  const run = command(args);
  if (!run) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  const pool = createPool(loadConfig().databaseUrl);
  try {
    console.log(await run(pool));
  } finally {
    await pool.end();
  }
}

main(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof ContentPackError ? err.message : err);
  process.exit(1);
});
