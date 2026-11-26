import { reviewFacets } from './reviewFacets';

describe('reviewFacets (FR-110)', () => {
  it('gives each item type its facets and their exercise types', () => {
    expect(reviewFacets('kana')).toEqual({ reading: ['choice', 'typed_answer'] });
    expect(reviewFacets('kanji')).toEqual({ reading: ['reading_in_context'] });
    expect(reviewFacets('word')).toEqual({ meaning: ['choice', 'typed_answer'] });
    expect(reviewFacets('grammar')).toEqual({ usage: ['fill_blank', 'reorder'] });
  });

  it('gives unknown types no facets', () => {
    expect(reviewFacets('toString')).toEqual({});
  });
});
