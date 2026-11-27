import { basename, resolve } from 'node:path';
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import type { Pool } from 'pg';
import { ContentPackError } from '@manabi/core';
import { loadConfig } from './config';
import { createPool } from './db/pool';
import { AppError } from './errors';
import { createAdmin } from './modules/auth/service';
import { lintPack } from './modules/content/lint';
import { readPack, writePack } from './modules/content/packFiles';
import { rebuildXpTotals } from './modules/courses/service';
import { exportPack, importPack } from './modules/content/service';
import {
  importJmdict,
  importKanjidic2,
  importKanjiVg,
  importLevelLists,
  importTatoeba,
} from './modules/imports/service';

const USAGE = `Usage: manabi pack lint <dir>   (database checks too when DATABASE_URL is set)
       manabi pack import <dir> [--structure-only]   (course, sections and lists only)
       manabi pack export <dir>   (the folder name is the course key, for example content/ja-en)
       manabi import kanjidic2 <course-key> <file>
       manabi import level-lists <course-key>   (up to LEVEL_CEILING, default N3)
       manabi import jmdict <course-key> <file>
       manabi import kanjivg <course-key> <file>
       manabi import tatoeba <course-key> <dir>
       manabi create-admin <username>   (asks for the password, or reads it from stdin)
       manabi rebuild-xp   (recomputes course XP totals and levels from the XP ledger)`;

/** Picks the command to run, or null for bad arguments. */
function command(args: string[]): ((pool: Pool) => Promise<unknown>) | null {
  const structureOnly = args.includes('--structure-only');
  const [group, name, arg, file] = args.filter((a) => a !== '--structure-only');
  if (structureOnly && !(group === 'pack' && name === 'import')) return null;
  if (group === 'create-admin' && name && !arg) {
    return async (pool) => {
      const user = await createAdmin(pool, name, await readPassword());
      return `Created admin ${user.username}`;
    };
  }
  if (group === 'rebuild-xp' && !name) {
    return async (pool) => `Rebuilt XP for ${await rebuildXpTotals(pool)} enrollments`;
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
  if (group === 'pack' && name === 'import' && !file) {
    return async (pool) => {
      const { acceptedAnswersKept: kept } = await importPack(
        pool,
        await readPack(dir),
        structureOnly,
      );
      // FR-229, #251: name each answer accepted from a report that the pack lacks.
      return [
        `Imported ${dir}; kept ${kept.length} accepted answer(s) not in the pack`,
        ...kept.map((k) => `  lesson ${k.lesson} exercise ${k.exercise}: ${k.text}`),
      ].join('\n');
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
 * FR-228: lints a pack, printing one `file:line: problem` per line; exit code 1 on problems. The
 * stroke and imported-item checks need the database, so they run only when DATABASE_URL is set
 * (read directly: lint needs none of loadConfig's other settings).
 */
async function lint(dir: string): Promise<void> {
  const url = process.env.DATABASE_URL;
  const pool = url ? createPool(url) : null;
  try {
    if (!pool) console.error('DATABASE_URL is not set: skipping the database checks');
    const problems = await lintPack(dir, pool);
    for (const problem of problems) console.log(problem);
    console.error(`${dir}: ${problems.length} problem(s)`);
    if (problems.length > 0) process.exitCode = 1;
  } finally {
    await pool?.end();
  }
}

/**
 * `manabi pack lint` (FR-228), `manabi pack import|export` (FR-227), `manabi import <dataset>` (FR-226) and
 * `manabi create-admin` (FR-009) and `manabi rebuild-xp` (DR-04) on DATABASE_URL.
 */
async function main(args: string[]): Promise<void> {
  const [group, name, dir, extra] = args;
  if (group === 'pack' && name === 'lint' && dir && !extra) {
    return lint(resolve(process.env.INIT_CWD ?? process.cwd(), dir));
  }
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
