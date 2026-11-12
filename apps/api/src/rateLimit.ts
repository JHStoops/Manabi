/**
 * NFR-12: counts attempts per key in a sliding window, in memory. The API is a single process
 * (SDD section 2), so memory is enough; counters start again from zero when the API restarts.
 * Attempts that are refused are not counted, so a locked key opens again one
 * window after its oldest counted attempt instead of staying locked while an attacker keeps trying.
 */
export interface AttemptLimiterOptions {
  /** Attempts allowed per key within one window. */
  limit: number;
  windowMs: number;
  /** Most keys kept; beyond this, expired keys and then the least recently used are dropped. */
  maxKeys?: number;
  now?: () => number;
}

export type AttemptResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

export class AttemptLimiter {
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
   * Records one attempt against every key, or none when any key is already at its limit (then
   * the result says how long until the busiest key has room again).
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
    if (waitMs > 0) return { allowed: false, retryAfterSeconds: Math.ceil(waitMs / 1000) };
    for (const [key, times] of live) {
      times.push(now);
      this.attempts.delete(key);
      this.attempts.set(key, times);
    }
    this.prune(since);
    return { allowed: true };
  }

  /** Number of keys held; for tests. */
  get size(): number {
    return this.attempts.size;
  }

  private prune(since: number): void {
    if (this.attempts.size <= this.maxKeys) return;
    for (const [key, times] of this.attempts) {
      if (times[times.length - 1]! <= since) this.attempts.delete(key);
    }
    // Still too many live keys: drop the least recently used (Map keeps insertion order).
    for (const key of this.attempts.keys()) {
      if (this.attempts.size <= this.maxKeys) break;
      this.attempts.delete(key);
    }
  }
}
