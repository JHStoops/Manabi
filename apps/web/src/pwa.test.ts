import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
const { initialGzipBytes, LIMIT } = jest.requireActual('../scripts/checkBundleSize.cjs');

function dist(entryBytes: number) {
  const dir = mkdtempSync(join(tmpdir(), 'dist-'));
  mkdirSync(join(dir, 'assets'));
  // Random bytes do not compress, so the gzip size is about the byte count.
  writeFileSync(join(dir, 'assets/index.js'), randomBytes(entryBytes));
  writeFileSync(join(dir, 'assets/lazy.js'), randomBytes(500_000));
  writeFileSync(
    join(dir, 'index.html'),
    '<script type="module" crossorigin src="/assets/index.js"></script>',
  );
  return dir;
}

describe('initial JS budget (NFR-04)', () => {
  it('counts only the files index.html loads and passes under 250 kB gzip', () => {
    const { total, count } = initialGzipBytes(dist(100_000));
    expect(count).toBe(1);
    expect(total).toBeLessThan(LIMIT);
  });

  it('exceeds the limit for an oversized entry chunk', () => {
    expect(initialGzipBytes(dist(260_000)).total).toBeGreaterThan(LIMIT);
  });
});

describe('web app manifest (IF-02)', () => {
  const manifest = JSON.parse(
    readFileSync(join(__dirname, '../public/manifest.webmanifest'), 'utf8'),
  );
  it('is installable: name, start_url, standalone display and 192/512 icons', () => {
    expect(manifest).toMatchObject({ name: 'Manabi', start_url: '/', display: 'standalone' });
    expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(['192x192', '512x512']);
  });
});
