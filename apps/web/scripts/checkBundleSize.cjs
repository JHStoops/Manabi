// NFR-04: the initial JavaScript (the entry script plus its modulepreloads, as index.html lists
// them) stays under 250 kB gzip. Run after `vite build`: node scripts/checkBundleSize.cjs
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { gzipSync } = require('node:zlib');

const LIMIT = 250 * 1000;

function initialGzipBytes(dist) {
  const html = readFileSync(join(dist, 'index.html'), 'utf8');
  const files = new Set(
    [...html.matchAll(/<(?:script|link)[^>]*(?:src|href)="(\/[^"]+\.js)"/g)].map((m) => m[1]),
  );
  let total = 0;
  for (const file of files) total += gzipSync(readFileSync(join(dist, file))).length;
  return { total, count: files.size };
}

module.exports = { initialGzipBytes, LIMIT };

if (require.main === module) {
  const { total, count } = initialGzipBytes(join(__dirname, '..', 'dist'));
  console.log(`Initial JS: ${count} file(s), ${(total / 1000).toFixed(1)} kB gzip (limit 250 kB)`);
  if (count === 0 || total > LIMIT) {
    console.error('::error::Initial JavaScript is over the NFR-04 budget (or no script was found)');
    process.exit(1);
  }
}
