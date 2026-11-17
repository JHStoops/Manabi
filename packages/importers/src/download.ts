import { execFileSync } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream } from 'node:stream/web';
import { createGunzip } from 'node:zlib';
import { datasets } from './datasets';

/**
 * `npm run download --workspace @manabi/importers [-- <dir>]`: fetches every dataset into
 * `<dir>/<name>/` (default: the git-ignored `packages/importers/datasets/`) and writes a
 * manifest.json there with the version and licence (SDD section 10). The server runs it as
 * `node dist/download.js /datasets` in the app image. Never run by tests or CI.
 */
const ROOT = process.argv[2]
  ? // npm scripts run in the workspace folder; INIT_CWD is where the command was typed.
    resolve(process.env.INIT_CWD ?? process.cwd(), process.argv[2])
  : resolve(__dirname, '../datasets');

async function main(): Promise<void> {
  for (const [name, dataset] of Object.entries(datasets)) {
    const dir = join(ROOT, name);
    await mkdir(dir, { recursive: true });
    let version: string | null = null;
    for (const url of dataset.urls) {
      console.log(`Downloading ${url}`);
      const res = await fetch(url);
      if (!res.ok || !res.body) throw new Error(`${url}: HTTP ${res.status}`);
      // The server's Last-Modified date stands in for the version of files that carry none.
      const modified = res.headers.get('last-modified');
      version ??= (modified ? new Date(modified) : new Date()).toISOString().slice(0, 10);
      const gz = url.endsWith('.gz');
      const file = join(dir, basename(url, gz ? '.gz' : ''));
      const body = Readable.fromWeb(res.body as ReadableStream);
      await (gz
        ? pipeline(body, createGunzip(), createWriteStream(file))
        : pipeline(body, createWriteStream(file)));
      // Node has no bzip2, so Tatoeba's exports are unpacked with the system tools.
      if (file.endsWith('.tar.bz2')) execFileSync('tar', ['-xjf', file, '-C', dir]);
      else if (file.endsWith('.bz2')) execFileSync('bunzip2', ['-kf', file]);
    }
    const manifest = { version, downloadedAt: new Date().toISOString(), ...dataset };
    await writeFile(join(dir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
