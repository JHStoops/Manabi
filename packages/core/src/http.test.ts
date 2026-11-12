import { emptyQuerySchema, healthDetailsSchema, healthResponseSchema } from './index';
import { describeSchema } from './testCases';

describeSchema(
  'healthResponseSchema',
  healthResponseSchema,
  [['a healthy report', { status: 'ok', api: 'ok', database: 'ok' }]],
  [
    ['a down database', { status: 'ok', api: 'ok', database: 'unavailable' }],
    ['a missing field', { status: 'ok', api: 'ok' }],
  ],
);

describeSchema(
  'healthDetailsSchema',
  healthDetailsSchema,
  [['a down database', { api: 'ok', database: 'unavailable' }]],
  [['an unknown status', { api: 'ok', database: 'degraded' }]],
);

describe('emptyQuerySchema', () => {
  it('drops unknown query parameters', () => {
    expect(emptyQuerySchema.parse({ _: '123' })).toEqual({});
  });
});
