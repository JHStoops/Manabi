import { basename, resolve } from 'node:path';
import { ContentPackError } from '@manabi/core';
import { loadConfig } from './config';
import { createPool } from './db/pool';
import { readPack, writePack } from './modules/content/packFiles';
import { exportPack, importPack } from './modules/content/service';

const USAGE = `Usage: manabi pack import <dir>
       manabi pack export <dir>   (the folder name is the course key, for example content/ja-en)`;

/** `manabi pack import|export <dir>` (FR-227) against DATABASE_URL. */
async function main([group, command, dirArg]: string[]): Promise<void> {
  if (group !== 'pack' || (command !== 'import' && command !== 'export') || !dirArg) {
    console.error(USAGE);
    process.exitCode = 2;
    return;
  }
  // npm scripts run in the workspace folder; INIT_CWD is where the command was typed.
  const dir = resolve(process.env.INIT_CWD ?? process.cwd(), dirArg);
  const pool = createPool(loadConfig().databaseUrl);
  try {
    if (command === 'import') {
      await importPack(pool, await readPack(dir));
      console.log(`Imported ${dir}`);
    } else {
      await writePack(dir, await exportPack(pool, basename(dir)));
      console.log(`Exported to ${dir}`);
    }
  } finally {
    await pool.end();
  }
}

main(process.argv.slice(2)).catch((err: unknown) => {
  console.error(err instanceof ContentPackError ? err.message : err);
  process.exit(1);
});
