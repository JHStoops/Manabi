import { payloadItemIds } from './lessonSession';

describe('payloadItemIds (FR-048)', () => {
  it('collects every itemId in tiles and option refs, at any depth', () => {
    const payload = {
      prompt: 'pick',
      options: [{ itemId: 1 }, { itemId: 2, label: 'x' }],
      accept: [{ text: 'a', tiles: [{ surface: 'a', base: 'a', reading: 'a', itemId: 3 }] }],
      itemId: 'not a number',
    };
    expect(payloadItemIds(payload)).toEqual([1, 2, 3]);
    expect(payloadItemIds({ prompt: 'none' })).toEqual([]);
  });
});
