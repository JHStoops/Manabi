import { Pool, types } from 'pg';

const INT8_OID = 20;

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

/** Type parsers for this app's pools; set per pool rather than globally on the pg module. */
const typeParsers = {
  getTypeParser: ((oid: number, format?: 'text' | 'binary') =>
    oid === INT8_OID && format !== 'binary'
      ? parseInt8
      : types.getTypeParser(oid, format as 'text')) as typeof types.getTypeParser,
};

/** Creates the shared pg connection pool. All SQL is hand-written and parameterized. */
export function createPool(databaseUrl: string): Pool {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }
  return new Pool({ connectionString: databaseUrl, types: typeParsers });
}
