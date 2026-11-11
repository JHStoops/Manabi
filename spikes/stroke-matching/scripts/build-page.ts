// Builds the self-contained phone test page docs/spikes/stroke-test.html from page/template.html.
// Inlines: the matcher (transpiled from src/*.ts so the page runs the same code as the tests),
// the KanjiVG stroke data, and Hanzi Writer's minified build (MIT).
// Usage: node scripts/build-page.ts
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import ts from 'typescript';
import { loadStrokeData, root } from './common.ts';

const require = createRequire(import.meta.url);

/** Transpiles a module and strips import/export syntax so modules can share one script scope. */
function inlineModule(file: string): string {
  const src = readFileSync(new URL(`src/${file}`, root), 'utf8');
  const js = ts.transpileModule(src, {
    compilerOptions: { target: ts.ScriptTarget.ES2019, module: ts.ModuleKind.ESNext },
  }).outputText;
  return `// ---- src/${file} ----\n${js
    .replace(/^import .*;$/gm, '')
    .replace(/^export \{\};$/gm, '')
    .replace(/^export /gm, '')}`;
}

const matcher = ['geometry.ts', 'svgPath.ts', 'matcher.ts', 'hanziWriterData.ts']
  .map(inlineModule)
  .join('\n');

const data = loadStrokeData();
const hanziWriterJs = readFileSync(require.resolve('hanzi-writer/dist/hanzi-writer.min.js'), 'utf8')
  // Keep the build from ending the inline <script> early.
  .replace(/<\/script/gi, '<\\/script');
const hanziWriterVersion = (
  JSON.parse(readFileSync(require.resolve('hanzi-writer/package.json'), 'utf8')) as {
    version: string;
  }
).version;

const template = readFileSync(new URL('page/template.html', root), 'utf8');
const html = template
  .replace('/*@@MATCHER@@*/', () => matcher)
  .replace('/*@@DATA@@*/', () => `const STROKE_DATA = ${JSON.stringify(data)};`)
  .replace(
    '/*@@HANZI_WRITER@@*/',
    () =>
      `/*! Hanzi Writer v${hanziWriterVersion} | MIT License | Copyright (c) 2014 David Chanin | https://chanind.github.io/hanzi-writer */\n${hanziWriterJs}`,
  );

const out = new URL('../../docs/spikes/stroke-test.html', root);
writeFileSync(out, html);
console.log(`wrote ${out.pathname} (${Math.round(html.length / 1024)} KiB)`);
