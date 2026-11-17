import { SaxesParser } from 'saxes';
import { courseKana } from '@manabi/lang-ja';
import type { KanaData } from '@manabi/lang-ja';
import type { HanziWriterCharData } from './hanziWriterData';
import { toHanziWriterData } from './hanziWriterData';
import type { ImportedItem } from './kanjidic2';
import { flattenPath } from './svgPath';

/** KanjiVG draws in a 109 x 109 space with y pointing down. */
const KANJIVG_SIZE = 109;

export interface KanjiVgStrokes {
  /** The date the KanjiVG file was generated. */
  datasetVersion: string;
  /** Each character's stroke centreline paths (SVG `d`), in stroke order. */
  strokes: Map<string, string[]>;
}

/**
 * FR-226, SDD section 10 step 4: parses the combined KanjiVG XML release, streamed chunk by chunk
 * (pass `createReadStream(file, 'utf8')`), into each character's stroke paths. Variant forms
 * (ids such as `kvg:kanji_06c34-Kaisho`) are skipped: the standard form is the one taught.
 */
export async function parseKanjiVg(input: AsyncIterable<string>): Promise<KanjiVgStrokes> {
  const parser = new SaxesParser();
  const strokes = new Map<string, string[]>();
  let datasetVersion = '';
  let paths: Array<{ n: number; d: string }> | null = null;
  let character = '';

  parser.on('comment', (text) => {
    datasetVersion ||= /generated on (\d{4}-\d{2}-\d{2})/.exec(text)?.[1] ?? '';
  });
  parser.on('opentag', ({ name, attributes }) => {
    const id = attributes.id as string | undefined;
    if (name === 'kanji') {
      const hex = id && /^kvg:kanji_([0-9a-f]+)$/.exec(id)?.[1];
      character = hex ? String.fromCodePoint(parseInt(hex, 16)) : '';
      paths = character ? [] : null;
    } else if (name === 'path' && paths) {
      const n = id && /-s(\d+)$/.exec(id)?.[1];
      const d = attributes.d as string | undefined;
      if (!n || !d) throw new Error(`KanjiVG: stroke without a number or path in ${character}`);
      paths.push({ n: Number(n), d });
    }
  });
  parser.on('closetag', ({ name }) => {
    if (name !== 'kanji' || !paths) return;
    if (paths.length > 0) {
      strokes.set(
        character,
        paths.sort((a, b) => a.n - b.n).map((p) => p.d),
      );
    }
    paths = null;
  });

  for await (const chunk of input) parser.write(chunk);
  parser.close();
  if (!datasetVersion) throw new Error('KanjiVG: no "generated on" date in the header');
  return { datasetVersion, strokes };
}

/** FR-077: KanjiVG stroke paths as Hanzi Writer data (a ribbon outline and a median per stroke). */
export function kanjiVgToHanziWriter(paths: readonly string[]): HanziWriterCharData {
  return toHanziWriterData(
    paths.map((d) => flattenPath(d)),
    KANJIVG_SIZE,
  );
}

/** The course's kana items (`ja:kana:<char>`), which the KanjiVG import creates if missing. */
export function kanaItems(): ImportedItem<KanaData>[] {
  return courseKana.map((data) => ({ key: `ja:kana:${data.character}`, type: 'kana', data }));
}
