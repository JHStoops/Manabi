import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseItemData } from '@manabi/core';
import type { DetectionPattern } from '@manabi/core';
import { loadAnalyzer, segmentSentence } from '@manabi/importers';
import { japanese } from '@manabi/lang-ja';
import { query } from '../../db/db';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { findCourseByKey } from '../content/queries';
import { readPack } from '../content/packFiles';
import { importPack } from '../content/service';
import { upsertLevelListWords } from './queries';
import { importTatoeba } from './service';

// FR-236, DR-12, DR-13: grammar detection with the ja-en pack's starter points over the
// sentence-quality spike's N5-labelled sample (fixture README: Tatoeba, CC BY 2.0 FR).

const PACK = join(__dirname, '../../../../../content/ja-en');
const FIXTURE = join(__dirname, '../../../../../packages/importers/fixtures/tatoeba-grammar');

// The six N5-labelled sample sentences with grammar above N5; every other fixture row is plain N5.
const ABOVE_N5: Record<string, string> = {
  '235206': 'ja:grammar:sasete-morau', // ４時に帰らせてもらいます。
  '9828423': 'ja:grammar:to-suru', // それが本当だとしましょう。
  '171673': 'ja:grammar:hazu', // 今日は学校のはずではないの。
  '10154219': 'ja:grammar:te-hoshii', // 何かして欲しかった？
  '11052190': 'ja:grammar:n-ja-nai-prohibitive', // そこに椅子を置くんじゃない。
  '222833': 'ja:grammar:te-oku', // この家はこのままにしておきたい。
};

const fixture = readFileSync(join(FIXTURE, 'jpn_sentences_detailed.tsv'), 'utf8')
  .trim()
  .split('\n')
  .map((line) => line.split('\t') as [string, string, string]);

describe('starter grammar points (FR-236)', () => {
  let points: { key: string; detection: DetectionPattern[] }[];
  beforeAll(async () => {
    await loadAnalyzer('kuromoji-ipadic');
    // Validated by the lang-ja grammar schema, as the pack import does.
    points = (await readPack(PACK)).items
      .filter((item) => item.type === 'grammar')
      .map(({ key, data }) => ({
        key,
        ...(parseItemData(japanese, 'grammar', data) as { detection: DetectionPattern[] }),
      }));
  });

  it.each(fixture.map(([id, , text]) => [id, text]))(
    'detects in %s %s only the spike-noted point',
    async (id, text) => {
      const { grammar } = await segmentSentence(japanese, text, points);
      expect(grammar).toEqual(ABOVE_N5[id] ? [ABOVE_N5[id]] : []);
    },
  );
});

describeWithDb('importTatoeba grammar levels (FR-236, DR-13)', () => {
  const pool = useTestDatabase();

  /** The ja-en pack (with its grammar stubs) and N5 words for six of the spike sentences. */
  async function seed() {
    // Only the grammar points: the pack's lessons, sentences and word overrides link dataset
    // items (kana, JMdict words) this test does not import.
    const pack = await readPack(PACK);
    const items = pack.items.filter((item) => item.type === 'grammar');
    await importPack(pool(), { ...pack, units: [], sentences: [], items });
    const course = await findCourseByKey(pool(), 'ja-en');
    const words = [
      ['帰る', 'かえる'],
      ['それ', 'それ'],
      ['本当', 'ほんとう'],
      ['する', 'する'],
      ['何', 'なに'],
      ['欲しい', 'ほしい'],
      ['そこ', 'そこ'],
      ['椅子', 'いす'],
      ['置く', 'おく'],
      ['この', 'この'],
      ['家', 'いえ'],
      ['まま', 'まま'],
      ['これ', 'これ'],
      ['私', 'わたし'],
      ['猫', 'ねこ'],
      ['ラジオ', 'ラジオ'],
      ['消す', 'けす'],
    ].map(([written, reading]) => ({ level: 'N5', written: written!, reading: reading! }));
    await upsertLevelListWords(pool(), { courseId: course!.id, words });
  }

  const levels = () =>
    query<{
      id: string;
      grammar: string[];
      vocab: string | null;
      level: string | null;
      override: boolean | null;
    }>(
      pool(),
      `SELECT source_id AS id, grammar, vocab_level_code AS vocab, grammar_level_code AS level,
         challenge_override AS override
       FROM sentences ORDER BY source_id`,
    );

  it('stores detected points and the highest level, keeps every sentence and counts the challenging ones', async () => {
    await seed();
    const summary = await importTatoeba(pool(), { courseKey: 'ja-en', file: FIXTURE });

    // 171673 (はず) has no owner, so FR-235 drops it before grammar is checked.
    expect(summary).toMatchObject({
      added: 8,
      dropped: { notNative: 1, unknownWords: 7 },
      challenging: { N4: 3, N3: 2 },
    });
    expect(await levels()).toEqual([
      {
        id: '10154219',
        grammar: ['ja:grammar:te-hoshii'],
        vocab: 'N5',
        level: 'N4',
        override: null,
      },
      {
        id: '11052190',
        grammar: ['ja:grammar:n-ja-nai-prohibitive'],
        vocab: 'N5',
        level: 'N3',
        override: null,
      },
      { id: '192588', grammar: [], vocab: 'N5', level: null, override: null },
      { id: '222833', grammar: ['ja:grammar:te-oku'], vocab: 'N5', level: 'N4', override: null },
      {
        id: '235206',
        grammar: ['ja:grammar:sasete-morau'],
        vocab: 'N5',
        level: 'N4',
        override: null,
      },
      { id: '757782', grammar: [], vocab: 'N5', level: null, override: null },
      { id: '9828423', grammar: ['ja:grammar:to-suru'], vocab: 'N5', level: 'N3', override: null },
      { id: '9943123', grammar: [], vocab: 'N5', level: null, override: null },
    ]);
  });

  it('re-checks unreviewed sentences on re-import, keeping reviewed ones and challenge overrides', async () => {
    await seed();
    await importTatoeba(pool(), { courseKey: 'ja-en', file: FIXTURE });
    await query(
      pool(),
      `UPDATE sentences SET review_status = 'reviewed', grammar = '[]', grammar_level_code = NULL
       WHERE source_id = '235206'`,
    );
    await query(
      pool(),
      `UPDATE sentences SET challenge_override = false WHERE source_id = '9828423'`,
    );
    // A later pack moves てほしい and とする to N2.
    await query(
      pool(),
      `UPDATE items SET level_code = 'N2'
       WHERE key IN ('ja:grammar:te-hoshii', 'ja:grammar:to-suru')`,
    );

    const summary = await importTatoeba(pool(), { courseKey: 'ja-en', file: FIXTURE });

    expect(summary).toMatchObject({ updated: 2, challenging: { N4: 2, N3: 1, N2: 2 } });
    expect(await levels()).toEqual(
      expect.arrayContaining([
        { id: '235206', grammar: [], vocab: 'N5', level: null, override: null },
        {
          id: '10154219',
          grammar: ['ja:grammar:te-hoshii'],
          vocab: 'N5',
          level: 'N2',
          override: null,
        },
        {
          id: '9828423',
          grammar: ['ja:grammar:to-suru'],
          vocab: 'N5',
          level: 'N2',
          override: false,
        },
      ]),
    );
  });
});
