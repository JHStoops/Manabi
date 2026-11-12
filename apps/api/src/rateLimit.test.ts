import { AttemptLimiter } from './rateLimit';

// NFR-12
describe('AttemptLimiter', () => {
  const WINDOW = 15 * 60 * 1000;

  function limiter(maxKeys?: number) {
    let now = 1_000_000;
    const l = new AttemptLimiter({ limit: 10, windowMs: WINDOW, maxKeys, now: () => now });
    return { l, advance: (ms: number) => (now += ms) };
  }

  it('allows 10 attempts per key in the window and refuses the 11th', () => {
    const { l, advance } = limiter();
    for (let i = 0; i < 10; i++) {
      expect(l.attempt(['ip:a'])).toEqual({ allowed: true });
      advance(1000);
    }
    expect(l.attempt(['ip:a'])).toEqual({ allowed: false, retryAfterSeconds: WINDOW / 1000 - 10 });
    expect(l.attempt(['ip:b'])).toEqual({ allowed: true });
  });

  it('slides: room opens as the oldest attempt leaves the window', () => {
    const { l, advance } = limiter();
    for (let i = 0; i < 10; i++) {
      l.attempt(['k']);
      advance(60_000);
    }
    expect(l.attempt(['k']).allowed).toBe(false);
    advance(WINDOW - 10 * 60_000 + 1);
    expect(l.attempt(['k']).allowed).toBe(true);
    expect(l.attempt(['k']).allowed).toBe(false);
  });

  it('counts an attempt against every key, or none when any key is full', () => {
    const { l } = limiter();
    for (let i = 0; i < 10; i++) l.attempt(['ip:a', `user:${i}`]);
    expect(l.attempt(['ip:b', 'user:0']).allowed).toBe(true);
    expect(l.attempt(['ip:a', 'user:new']).allowed).toBe(false);
    // The refused attempt did not count against user:new.
    for (let i = 0; i < 10; i++) expect(l.attempt([`ip:${i}x`, 'user:new']).allowed).toBe(true);
    expect(l.attempt(['ip:z', 'user:new']).allowed).toBe(false);
  });

  it('keeps at most maxKeys keys, dropping expired then least recently used ones', () => {
    const { l, advance } = limiter(3);
    l.attempt(['old']);
    advance(WINDOW + 1);
    l.attempt(['a']);
    l.attempt(['b']);
    l.attempt(['c']);
    expect(l.size).toBe(3);
    l.attempt(['a']);
    l.attempt(['d']);
    expect(l.size).toBe(3);
    // b was the least recently used live key; a, c and d remain.
    for (let i = 0; i < 9; i++) l.attempt(['a']);
    expect(l.attempt(['a']).allowed).toBe(false);
  });
});
