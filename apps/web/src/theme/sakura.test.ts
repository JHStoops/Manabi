import { sakuraDark, sakuraLight } from './sakura';

describe('sakura theme', () => {
  it('provides light and dark variants of the same theme', () => {
    expect(sakuraLight.name).toBe(sakuraDark.name);
    expect(sakuraLight.mode).toBe('light');
    expect(sakuraDark.mode).toBe('dark');
  });
});
