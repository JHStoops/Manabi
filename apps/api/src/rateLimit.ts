import { isIPv6 } from 'node:net';

/**
 * NFR-12: counts attempts per key in a sliding window, in memory. The API is a single process
 * (SDD section 2), so memory is enough; counters start again from zero when the API restarts.
 * Attempts that are refused are not counted, so a locked key opens again one window after its
 * oldest counted attempt instead of staying locked while an attacker keeps trying.
 *
 * The number of keys is capped. Keys whose attempts have all left the window are dropped when
 * the cap is reached; live keys never are, since dropping one would hand an attacker a fresh
 * count. When the cap is full of live keys, attempts on new keys are refused until room opens.
 */
export interface AttemptLimiterOptions {
  /** Attempts allowed per key within one window. */
  limit: number;
  windowMs: number;
  /** Most keys held at once (default 100,000, a few MB). */
  maxKeys?: number;
  now?: () => number;
}

export type AttemptResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export class AttemptLimiter {
  /** Attempt times per key; the Map is kept in order of each key's latest attempt. */
  private readonly attempts = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly maxKeys: number;
  private readonly now: () => number;

  constructor(options: AttemptLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.maxKeys = options.maxKeys ?? 100_000;
    this.now = options.now ?? Date.now;
  }

  /**
   * Records one attempt against every key, or none when any key is already at its limit or there
   * is no room for a new key (then the result says how long until there is room).
   */
  attempt(keys: readonly string[]): AttemptResult {
    const now = this.now();
    const since = now - this.windowMs;
    let waitMs = 0;
    const live = keys.map((key) => {
      const times = (this.attempts.get(key) ?? []).filter((t) => t > since);
      if (times.length >= this.limit) {
        waitMs = Math.max(waitMs, times[times.length - this.limit]! - since);
      }
      return [key, times] as const;
    });
    if (waitMs > 0) return refused(waitMs);

    const newKeys = keys.filter((key) => !this.attempts.has(key)).length;
    if (this.attempts.size + newKeys > this.maxKeys) {
      this.dropExpired(since);
      if (this.attempts.size + newKeys > this.maxKeys) {
        // The first key has the oldest latest attempt, so it leaves the window first.
        const [oldest] = this.attempts.values();
        return refused(oldest![oldest!.length - 1]! - since);
      }
    }

    for (const [key, times] of live) {
      times.push(now);
      this.attempts.delete(key);
      this.attempts.set(key, times);
    }
    return { allowed: true };
  }

  /** Number of keys held; for tests. */
  get size(): number {
    return this.attempts.size;
  }

  private dropExpired(since: number): void {
    // Map order is by latest attempt, so expired keys come first.
    for (const [key, times] of this.attempts) {
      if (times[times.length - 1]! > since) break;
      this.attempts.delete(key);
    }
  }
}

function refused(waitMs: number): AttemptResult {
  return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil(waitMs / 1000)) };
}

/**
 * The client part of a rate-limit key. An IPv6 client usually holds a whole /64, so IPv6
 * addresses count by their /64 prefix; IPv4 (and IPv4-mapped IPv6) addresses count as they are.
 */
export function ipKey(ip: string): string {
  if (!isIPv6(ip)) return ip;
  const address = ip.split('%')[0]!.toLowerCase();
  if (/^::ffff:\d+\.\d+\.\d+\.\d+$/.test(address)) return address;
  const [head = '', tail] = address.split('::');
  const hextets = (part: string) => {
    const groups = part ? part.split(':') : [];
    const last = groups[groups.length - 1];
    // An embedded IPv4 tail (::1.2.3.4) is two hextets.
    if (last?.includes('.')) {
      const [a, b, c, d] = last.split('.').map(Number) as [number, number, number, number];
      groups.splice(-1, 1, ((a << 8) | b).toString(16), ((c << 8) | d).toString(16));
    }
    return groups;
  };
  const left = hextets(head);
  const right = tail === undefined ? [] : hextets(tail);
  const full = [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  return `${full
    .slice(0, 4)
    .map((h) => parseInt(h, 16).toString(16))
    .join(':')}::/64`;
}
