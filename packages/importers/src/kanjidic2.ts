import { SaxesParser } from 'saxes';
import type { KanjiData } from '@manabi/lang-ja';

/** One row for the items table, keyed by its stable key (DR-02). */
export interface ImportedItem<T = object> {
  key: string;
  type: string;
  data: T;
}

export interface ParsedDataset<T = object> {
  /** DR-09: the dataset version the values came from. */
  datasetVersion: string;
  items: ImportedItem<T>[];
}

/**
 * FR-226, SDD section 10 step 1: parses KANJIDIC2 XML, streamed chunk by chunk (pass
 * `createReadStream(file, 'utf8')`), into one kanji item per character with an English meaning.
 * Characters without one are out of scope: the course teaches in English and the kanji schema
 * needs a meaning.
 */
export async function parseKanjidic2(
  input: AsyncIterable<string>,
): Promise<ParsedDataset<KanjiData>> {
  const parser = new SaxesParser();
  const items: ImportedItem<KanjiData>[] = [];
  let datasetVersion = '';
  let text = '';
  let kanji: KanjiData = emptyKanji();

  parser.on('opentag', (tag) => {
    text = '';
    if (tag.name === 'character') kanji = emptyKanji();
  });
  parser.on('text', (chunk) => {
    text += chunk;
  });
  parser.on('closetag', ({ name, attributes }) => {
    const attr = (key: string) => attributes[key] as string | undefined;
    if (name === 'date_of_creation') datasetVersion = text;
    else if (name === 'literal') kanji.character = text;
    // Later stroke counts are common miscounts; the first is the accepted one.
    else if (name === 'stroke_count' && kanji.strokeCount === 0) kanji.strokeCount = Number(text);
    else if (name === 'rad_value' && attr('rad_type') === 'classical') {
      // The 214 Kangxi radicals sit in order from U+2F00; NFKC maps each to its kanji form.
      kanji.components = [String.fromCodePoint(0x2f00 + Number(text) - 1).normalize('NFKC')];
    } else if (name === 'reading' && attr('r_type') === 'ja_on') kanji.onReadings.push(text);
    else if (name === 'reading' && attr('r_type') === 'ja_kun') kanji.kunReadings.push(text);
    else if (name === 'meaning' && !attr('m_lang')) kanji.meanings.push(text);
    else if (name === 'character' && kanji.meanings.length > 0) {
      items.push({ key: `ja:kanji:${kanji.character}`, type: 'kanji', data: kanji });
    }
  });

  for await (const chunk of input) parser.write(chunk);
  parser.close();
  if (!datasetVersion) throw new Error('KANJIDIC2: no date_of_creation in the header');
  return { datasetVersion, items };
}

function emptyKanji(): KanjiData {
  return {
    character: '',
    meanings: [],
    onReadings: [],
    kunReadings: [],
    strokeCount: 0,
    components: [],
  };
}
