import type { AnalyzerToken } from '@manabi/core';
import { detectGrammar } from './grammar';

const token = (surface: string, baseForm: string, pos: string[]): AnalyzerToken => ({
  surface,
  pos,
  conjugationType: null,
  conjugationForm: null,
  baseForm,
  reading: null,
});

// 開けておいた。
const tokens = [
  token('開け', '開ける', ['動詞', '自立']),
  token('て', 'て', ['助詞', '接続助詞']),
  token('おい', 'おく', ['動詞', '非自立']),
  token('た', 'た', ['助動詞']),
  token('。', '。', ['記号', '句点']),
];

describe('detectGrammar (FR-236)', () => {
  it('matches surface, base form and leading part-of-speech tags over consecutive tokens', () => {
    const points = [
      { key: 'te-oku', detection: [[{ base: 'て' }, { base: 'おく', pos: ['動詞', '非自立'] }]] },
      { key: 'by-surface', detection: [[{ surface: 'おい' }, { surface: 'た' }]] },
      { key: 'at-end', detection: [[{ pos: ['助動詞'] }, { surface: '。' }]] },
    ];
    expect(detectGrammar(tokens, points)).toEqual(['te-oku', 'by-surface', 'at-end']);
  });

  it('detects a point when any one of its patterns matches', () => {
    const point = { key: 'p', detection: [[{ base: 'ない' }], [{ base: 'た' }]] };
    expect(detectGrammar(tokens, [point])).toEqual(['p']);
  });

  it.each([
    ['a base form mismatch', [{ base: 'て' }, { base: 'いる' }]],
    ['a surface mismatch', [{ surface: 'おく' }]],
    ['a more specific part of speech', [{ base: 'おく', pos: ['動詞', '自立'] }]],
    ['tokens that are not consecutive', [{ base: 'て' }, { base: 'た' }]],
    ['a pattern running past the last token', [{ surface: '。' }, { surface: '。' }]],
  ])('does not match %s', (_label, pattern) => {
    expect(detectGrammar(tokens, [{ key: 'p', detection: [pattern] }])).toEqual([]);
  });

  it('detects nothing without points or patterns', () => {
    expect(detectGrammar(tokens, [])).toEqual([]);
    expect(detectGrammar(tokens, [{ key: 'p', detection: [] }])).toEqual([]);
  });
});
