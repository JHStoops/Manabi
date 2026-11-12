import { AttemptLimiter, ipKey } from './rateLimit';

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

  it('drops expired keys when full but never live ones: new keys are refused instead', () => {
    const { l, advance } = limiter(3);
    l.attempt(['old']);
    advance(60_000);
    l.attempt(['a']);
    l.attempt(['b']);
    expect(l.size).toBe(3);
    // Full of live keys: a new key is refused, known keys keep counting.
    expect(l.attempt(['c'])).toEqual({ allowed: false, retryAfterSeconds: WINDOW / 1000 - 60 });
    expect(l.attempt(['a', 'c']).allowed).toBe(false);
    expect(l.attempt(['a']).allowed).toBe(true);
    expect(l.size).toBe(3);
    // Once 'old' leaves the window it is dropped to make room.
    advance(WINDOW - 60_000 + 1);
    expect(l.attempt(['c']).allowed).toBe(true);
    expect(l.size).toBe(3);
    // 'a' kept its count throughout: 2 attempts, both still in the window.
    for (let i = 0; i < 8; i++) expect(l.attempt(['a']).allowed).toBe(true);
    expect(l.attempt(['a']).allowed).toBe(false);
  });
});

describe('ipKey', () => {
  it.each([
    ['IPv4 unchanged', '203.0.113.7', '203.0.113.7'],
    ['IPv4-mapped unchanged', '::ffff:203.0.113.7', '::ffff:203.0.113.7'],
    ['IPv6 by /64', '2001:db8:1:2:aaaa:bbbb:cccc:dddd', '2001:db8:1:2::/64'],
    ['compressed IPv6', '2001:DB8::1', '2001:db8:0:0::/64'],
    ['leading zeros', '2001:0db8:0001:0002::5', '2001:db8:1:2::/64'],
    ['a zone id', 'fe80::1%eth0', 'fe80:0:0:0::/64'],
    ['loopback', '::1', '0:0:0:0::/64'],
    ['an embedded IPv4 tail', '64:ff9b::203.0.113.7', '64:ff9b:0:0::/64'],
    ['a non-IP string unchanged', 'unknown', 'unknown'],
  ])('keys %s', (_label, ip, key) => {
    expect(ipKey(ip)).toBe(key);
  });

  it('gives one key to every address in a /64', () => {
    expect(ipKey('2001:db8:1:2::1')).toBe(ipKey('2001:db8:1:2:ffff:ffff:ffff:ffff'));
    expect(ipKey('2001:db8:1:2::1')).not.toBe(ipKey('2001:db8:1:3::1'));
  });
});
