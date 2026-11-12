import type { ZodTypeAny } from 'zod';

/** Table-driven schema checks shared by the core tests. Not exported from the package. */
export function describeSchema(
  name: string,
  schema: ZodTypeAny,
  valid: ReadonlyArray<readonly [string, unknown]>,
  invalid: ReadonlyArray<readonly [string, unknown]>,
): void {
  describe(name, () => {
    it.each(valid)('accepts %s', (_label, value) => {
      const result = schema.safeParse(value);
      expect(result.error?.issues).toBeUndefined();
      expect(result.success).toBe(true);
    });
    it.each(invalid)('rejects %s', (_label, value) => {
      expect(schema.safeParse(value).success).toBe(false);
    });
  });
}
