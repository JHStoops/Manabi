import {
  apiErrorSchema,
  cursorSchema,
  DEFAULT_PAGE_LIMIT,
  errorCodeForStatus,
  errorCodeSchema,
  errorStatus,
  pageSchema,
  paginationQuerySchema,
  z,
} from './index';
import { describeSchema } from './testCases';

describeSchema(
  'apiErrorSchema',
  apiErrorSchema,
  [
    ['an error without details', { error: { code: 'not_found', message: 'Nope' } }],
    [
      'an error with details',
      { error: { code: 'validation_failed', message: 'Bad', details: [{ path: ['a'] }] } },
    ],
    ['null details', { error: { code: 'internal_error', message: 'Oops', details: null } }],
  ],
  [
    ['a bare message', { message: 'Nope' }],
    ['an unknown code', { error: { code: 'teapot', message: 'Nope' } }],
    ['an empty message', { error: { code: 'not_found', message: '' } }],
  ],
);

describe('error codes', () => {
  it('maps every code to an HTTP error status', () => {
    for (const code of errorCodeSchema.options) {
      expect(errorStatus[code]).toBeGreaterThanOrEqual(400);
      expect(errorStatus[code]).toBeLessThan(600);
    }
  });

  it.each([
    [400, 'bad_request'],
    [401, 'unauthenticated'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [405, 'bad_request'],
    [409, 'conflict'],
    [413, 'payload_too_large'],
    [429, 'rate_limited'],
    [500, 'internal_error'],
    [502, 'internal_error'],
    [503, 'service_unavailable'],
  ] as const)('gives status %i the code %s', (status, code) => {
    expect(errorCodeForStatus(status)).toBe(code);
  });

  it('gives each generic code back its own status', () => {
    for (const code of errorCodeSchema.options) {
      expect(errorStatus[errorCodeForStatus(errorStatus[code])]).toBe(errorStatus[code]);
    }
  });
});

describeSchema(
  'cursorSchema',
  cursorSchema,
  [['base64url', 'eyJpZCI6MTJ9_-']],
  [
    ['empty', ''],
    ['padding', 'abc='],
    ['too long', 'a'.repeat(513)],
  ],
);

describeSchema(
  'paginationQuerySchema',
  paginationQuerySchema,
  [
    ['no parameters', {}],
    ['a cursor and limit', { cursor: 'abc', limit: '50' }],
  ],
  [
    ['a zero limit', { limit: '0' }],
    ['a limit over 100', { limit: '101' }],
    ['a fractional limit', { limit: '1.5' }],
    ['a bad cursor', { cursor: 'a b' }],
  ],
);

describe('paginationQuerySchema', () => {
  it('defaults the limit and coerces it from a query string', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ limit: DEFAULT_PAGE_LIMIT });
    expect(paginationQuerySchema.parse({ limit: '5' }).limit).toBe(5);
  });
});

describeSchema(
  'pageSchema',
  pageSchema(z.number()),
  [
    ['a last page', { items: [1, 2], nextCursor: null }],
    ['a page with more', { items: [], nextCursor: 'abc' }],
  ],
  [
    ['wrong item types', { items: ['a'], nextCursor: null }],
    ['a missing cursor', { items: [] }],
  ],
);
