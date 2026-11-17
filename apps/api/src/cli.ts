import { basename, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import type { Pool } from 'pg';
import { ContentPackError } from '@manabi/core';
import { loadConfig } from './config';
import { createPool } from './db/pool';
import { AppError } from './errors';
import { createAdmin } from './modules/auth/service';
import { readPack, writePack } from './modules/content/packFiles';
import { exportPack, importPack } from './modules/content/service';
import {
  importJmdict,
  importKanjidic2,
  importKanjiVg,
  importLevelLists,
  importTatoeba,
} from './modules/imports/service';

const USAGE = `Usage: manabi pack import <dir>
       manabi pack export <dir>   (the folder name is the course key, for example content/ja-en)
       manabi import kanjidic2 <course-key> <file>
       manabi import level-lists <course-key>   (up to LEVEL_CEILING, default N3)
       manabi import jmdict <course-key> <file>
       manabi import kanjivg <course-key> <file>
       manabi import tatoeba <course-key> <dir>
       manabi create-admin <username>   (asks for the password, or reads it from stdin)`;

/** Picks the command to run, or null for bad arguments. */
function command([group, name, arg, file]: string[]): ((pool: Pool) => Promise<unknown>) | null {
  if (group === 'create-admin' && name && !arg) {
    return async (pool) => {
      const user = await createAdmin(pool, name, await readPassword());
      return `Created admin ${user.username}`;
    };
  }
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
  if (group === 'import' && name === 'tatoeba' && file) {
    return (pool) => importTatoeba(pool, { courseKey: arg, file: resolve(cwd, file) });
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

/**
 * FR-009: the password never goes on the command line, where process listings would show it. On
 * a terminal it is typed twice without echo; otherwise the first line of stdin is used.
 */
async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) return readLine('');
  const password = await readLine('Password: ');
  if ((await readLine('Repeat password: ')) !== password) {
    throw new AppError('validation_failed', 'Passwords differ');
  }
  return password;
}

function readLine(prompt: string): Promise<string> {
  const tty = process.stdin.isTTY === true;
  // Readline echoes typed keys to its output on a terminal; this output drops them.
  const muted = new Writable({ write: (_chunk, _encoding, done) => done() });
  const rl = createInterface({ input: process.stdin, output: muted, terminal: tty });
  process.stderr.write(prompt);
  return new Promise((resolve, reject) => {
    rl.once('line', (line) => {
      if (tty) process.stderr.write('\n');
      resolve(line); // before close(), whose 'close' event would reject first
      rl.close();
    });
    rl.once('SIGINT', () => rl.close());
    rl.once('close', () => reject(new AppError('validation_failed', 'No password given')));
  });
}

/**
 * `manabi pack import|export` (FR-227), `manabi import <dataset>` (FR-226) and
 * `manabi create-admin` (FR-009) on DATABASE_URL.
 */
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
  console.error(err instanceof ContentPackError || err instanceof AppError ? err.message : err);
  process.exit(1);
});
