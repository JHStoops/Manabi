import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { isCollection, LineCounter, parseDocument, stringify } from 'yaml';
import type { z } from 'zod';
import {
  ContentPackError,
  packBlockedWordsFileSchema,
  packCourseSchema,
  packGrammarFrontMatterSchema,
  packItemsFileSchema,
  packSentencesFileSchema,
  packSupplementaryWordsFileSchema,
  packUnitSchema,
} from '@manabi/core';
import type { ContentPack } from '@manabi/core';

// Reads and writes content pack directories (SDD section 4). Schema errors name the file and the
// path inside it. STUB: audio/ clips are carried by #66, which owns the media store.

/** `file:line` of each object readPack returned, and of each of its fields (FR-228 lint). */
const origins = new WeakMap<object, Map<string | number | undefined, string>>();

/** Where `value` (or its `field`) was read from, as `file:line`; undefined if not read by readPack. */
export function originOf(value: object, field?: string | number): string | undefined {
  return origins.get(value)?.get(field);
}

/** Records the origin of `value` and everything in it, walking its YAML node alongside. */
function record(value: unknown, node: unknown, at: (node: { range?: unknown }) => string): void {
  if (typeof value !== 'object' || value === null || !isCollection(node)) return;
  const fields = new Map<string | number | undefined, string>([[undefined, at(node)]]);
  for (const [name, child] of Object.entries(value)) {
    const field = Array.isArray(value) ? Number(name) : name;
    const childNode: unknown = node.get(field, true);
    // A field Zod filled in with its default has no node: point at its object.
    fields.set(field, at(hasRange(childNode) ? childNode : node));
    record(child, childNode, at);
  }
  origins.set(value, fields);
}

function hasRange(node: unknown): node is { range: [number, number, number] } {
  return typeof node === 'object' && node !== null && 'range' in node && Array.isArray(node.range);
}

const GRAMMAR_TYPE = 'grammar';
const FRONT_MATTER = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/;

/** Pack files in one folder, in path order (`units/2-…` before `units/10-…`). */
async function listFiles(dir: string, sub: string, ext: string): Promise<string[]> {
  const names = await readdir(join(dir, sub)).catch((err: NodeJS.ErrnoException) => {
    if (err.code === 'ENOENT') return [];
    throw err;
  });
  return names
    .filter((name) => name.endsWith(ext))
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }))
    .map((name) => `${sub}/${name}`);
}

export async function readPack(dir: string): Promise<ContentPack> {
  const problems: string[] = [];
  /** `firstLine`: the line `yamlText` starts on in its file (front matter starts on line 2). */
  function check<T>(file: string, yamlText: string, schema: z.ZodType<T, unknown>, firstLine = 1) {
    const lines = new LineCounter();
    const doc = parseDocument(yamlText, { lineCounter: lines });
    const at = (node: { range?: unknown }) =>
      hasRange(node) ? `${file}:${lines.linePos(node.range[0]).line + firstLine - 1}` : file;
    const [error] = doc.errors;
    if (error) {
      problems.push(`${file}:${(error.linePos?.[0].line ?? 1) + firstLine - 1}: ${error.message}`);
      return undefined;
    }
    const result = schema.safeParse(doc.toJS());
    if (result.success) {
      record(result.data, doc.contents, at);
      return result.data;
    }
    for (const issue of result.error.issues) {
      // The line of the deepest node on the issue's path that exists.
      let node: unknown = doc.contents;
      for (const field of issue.path) {
        const child: unknown = isCollection(node) ? node.get(field, true) : undefined;
        if (child === undefined) break;
        node = child;
      }
      const where = hasRange(node) ? at(node) : file;
      problems.push(`${where}: ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
    return undefined;
  }
  const read = (file: string) => readFile(join(dir, file), 'utf8');
  /** `missing` when the file does not exist (null: report it as a problem). */
  const readOr = (file: string, missing: string | null) =>
    read(file).catch((err: NodeJS.ErrnoException) => {
      if (err.code !== 'ENOENT') throw err;
      if (missing === null) problems.push(`${file}: (root): file not found`);
      return missing;
    });

  const courseText = await readOr('course.yaml', null);
  const course =
    courseText === null ? undefined : check('course.yaml', courseText, packCourseSchema);
  const pack: Omit<ContentPack, 'course'> = {
    units: [],
    items: [],
    sentences: [],
    blockedWords: [],
    supplementaryWords: [],
  };
  for (const file of await listFiles(dir, 'units', '.yaml')) {
    const unit = check(file, await read(file), packUnitSchema);
    if (unit) pack.units.push(unit);
  }
  for (const file of await listFiles(dir, 'items', '.yaml')) {
    pack.items.push(...(check(file, await read(file), packItemsFileSchema) ?? []));
  }
  for (const file of await listFiles(dir, 'grammar', '.md')) {
    const match = FRONT_MATTER.exec(await read(file));
    if (!match) {
      problems.push(`${file}: (root): expected YAML front matter between --- lines`);
      continue;
    }
    const front = check(file, match[1]!, packGrammarFrontMatterSchema, 2);
    if (!front) continue;
    const { key, level, related, overrides, ...data } = front;
    const body = match[2]!.trim();
    // The Markdown body is the point's explanation; a stub has none.
    const withBody = body ? { ...data, explanation: body } : data;
    const item = { key, type: GRAMMAR_TYPE, level, related, overrides, data: withBody };
    origins.set(item, origins.get(front)!);
    pack.items.push(item);
  }
  const sentences = (await readOr('sentences.yaml', '[]'))!;
  pack.sentences = check('sentences.yaml', sentences, packSentencesFileSchema) ?? [];
  const blocked = (await readOr('lists/blocked-words.yaml', '[]'))!;
  pack.blockedWords = check('lists/blocked-words.yaml', blocked, packBlockedWordsFileSchema) ?? [];
  const supplementary = 'lists/supplementary-words.yaml';
  pack.supplementaryWords =
    check(supplementary, (await readOr(supplementary, '[]'))!, packSupplementaryWordsFileSchema) ??
    [];
  if (problems.length > 0 || !course) throw new ContentPackError(problems);
  return { course, ...pack };
}

/** A file-name-safe slug from the last segment of a stable key. */
function slug(key: string): string {
  return key
    .split(':')
    .pop()!
    .replace(/[^\p{L}\p{N}_-]+/gu, '-');
}

const toYaml = (value: unknown) => stringify(value, { lineWidth: 0 });

/** Writes a pack, replacing the pack files a previous export wrote; other files are kept. */
export async function writePack(dir: string, pack: ContentPack): Promise<void> {
  for (const [sub, ext] of [
    ['units', '.yaml'],
    ['items', '.yaml'],
    ['grammar', '.md'],
  ] as const) {
    await mkdir(join(dir, sub), { recursive: true });
    for (const file of await listFiles(dir, sub, ext)) await rm(join(dir, file));
  }
  await writeFile(join(dir, 'course.yaml'), toYaml(pack.course));

  for (const [i, unit] of pack.units.entries()) {
    const name = `${String(i + 1).padStart(2, '0')}-${slug(unit.key)}.yaml`;
    await writeFile(join(dir, 'units', name), toYaml(unit));
  }

  const byType = new Map<string, unknown[]>();
  const grammarFiles = new Set<string>();
  for (const { key, type, level, data, overrides, related } of pack.items) {
    const extra = Object.keys(overrides).length > 0 ? { overrides } : {};
    if (data && type === GRAMMAR_TYPE) {
      const { explanation, ...rest } = data;
      const file = `grammar/${slug(key)}.md`;
      if (grammarFiles.has(file))
        throw new ContentPackError([`${file}: two grammar points share this file name`]);
      grammarFiles.add(file);
      const front = toYaml({ key, level, related, ...extra, ...rest });
      const body = typeof explanation === 'string' ? `\n${explanation}\n` : '';
      await writeFile(join(dir, file), `---\n${front}---\n${body}`);
    } else {
      const entry = data ? { key, type, level, data, ...extra } : { key, type, ...extra };
      byType.set(type, [...(byType.get(type) ?? []), entry]);
    }
  }
  for (const [type, entries] of byType) {
    await writeFile(join(dir, 'items', `${type}.yaml`), toYaml(entries));
  }
  await writeFile(join(dir, 'sentences.yaml'), toYaml(pack.sentences));
  await mkdir(join(dir, 'lists'), { recursive: true });
  await writeFile(join(dir, 'lists', 'blocked-words.yaml'), toYaml(pack.blockedWords));
  await writeFile(join(dir, 'lists/supplementary-words.yaml'), toYaml(pack.supplementaryWords));
}
