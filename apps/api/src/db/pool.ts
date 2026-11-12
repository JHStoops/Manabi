import { Pool, types } from 'pg';

const INT8_OID = 20;
const DATE_OID = 1082;

/**
 * bigint (int8) columns, such as identity ids and count(*), come back as JavaScript numbers.
 * Values beyond Number.MAX_SAFE_INTEGER throw instead of losing precision silently.
 */
function parseInt8(value: string): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new RangeError(`int8 value ${value} is outside the safe integer range`);
  }
  return n;
}

/**
 * date columns (calendar dates such as xp_events.local_date, DR-05) come back as the
 * 'YYYY-MM-DD' text unchanged. pg's default turns them into a Date at local midnight of the
 * Node process, which shifts the day when read in another time zone.
 */
function parseDate(value: string): string {
  return value;
}

/** Type parsers for this app's pools; set per pool rather than globally on the pg module. */
const typeParsers = {
  getTypeParser: ((oid: number, format?: 'text' | 'binary') => {
    if (format !== 'binary') {
      if (oid === INT8_OID) return parseInt8;
      if (oid === DATE_OID) return parseDate;
    }
    return types.getTypeParser(oid, format as 'text');
  }) as typeof types.getTypeParser,
};

/**
 * Creates the shared pg connection pool. All SQL is hand-written and parameterized.
 * An idle client that loses its connection (for example a database restart) emits 'error' on
 * the pool; without a listener Node would crash, so it is logged and the pool replaces the client.
 */
export function createPool(
  databaseUrl: string,
  logError: (message: string, err: Error) => void = console.error,
): Pool {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  const pool = new Pool({ connectionString: databaseUrl, types: typeParsers });
  pool.on('error', (err) => logError('Idle database client error', err));
  return pool;
}
