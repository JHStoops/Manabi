import { apiErrorSchema } from './index';

describe('apiErrorSchema', () => {
  it('accepts the standard error shape', () => {
    const parsed = apiErrorSchema.safeParse({ error: { code: 'not_found', message: 'Nope' } });
    expect(parsed.success).toBe(true);
  });

  it('rejects other shapes', () => {
    expect(apiErrorSchema.safeParse({ message: 'Nope' }).success).toBe(false);
  });
});
