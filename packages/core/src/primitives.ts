import { z } from 'zod';

/**
 * Shared building blocks for the domain schemas. Each mirrors a column type or CHECK domain in
 * apps/api/migrations, so a value that passes here is accepted by the database.
 */

/** Database row id (bigint identity). pg returns int8 as a JavaScript number. */
export const idSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
export type Id = z.infer<typeof idSchema>;

/** A row id in a path parameter or query string (NFR-13): digits only, parsed to a number. */
export const idParamSchema = z
  .string()
  .regex(/^[1-9][0-9]{0,15}$/, 'Expected a positive integer id')
  .transform(Number)
  .pipe(idSchema);

/** The `level_code` domain: level codes such as 'kana', 'N5', 'N4'. */
export const levelCodeSchema = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9_-]{0,31}$/);
export type LevelCode = z.infer<typeof levelCodeSchema>;

/** The `stable_key` domain (DR-02): keys such as 'ja-en' or 'ja:kanji:水'. No whitespace. */
export const stableKeySchema = z
  .string()
  .max(200)
  .regex(/^\S+$/u, 'Must not be empty or contain whitespace');
export type StableKey = z.infer<typeof stableKeySchema>;

/** Language code columns (`target_lang`, `base_lang`, `blocked_words.lang`). */
export const langCodeSchema = z.string().regex(/^[a-z]{2,3}$/);

/** Language plugin id on `courses.plugin`. */
export const pluginIdSchema = z.string().regex(/^[a-z][a-z0-9-]*$/);

/**
 * Registry-style identifiers that the database only format-checks: item types (from the
 * plugin's itemSchemas), exercise type ids (from the exercise registry), review facets, and XP
 * and booster reason codes.
 */
export const typeIdSchema = z.string().regex(/^[a-z][a-z0-9_]*$/);

/** Text columns with a `CHECK (col <> '')` constraint. */
export const nonEmptyTextSchema = z.string().min(1);

/** Timestamps in API payloads: ISO 8601 in UTC (SDD section 8). */
export const timestampSchema = z.string().datetime();

/** Calendar dates (`date` columns such as `xp_events.local_date`): 'YYYY-MM-DD'. */
export const localDateSchema = z.string().date();

/** Any JSON object: JSONB `object` columns before a more specific schema applies. */
export const jsonObjectSchema = z.record(z.string(), z.unknown());
export type JsonObject = z.infer<typeof jsonObjectSchema>;

/** Draft and published states on courses, units and lessons (FR-225). */
export const publishStatusSchema = z.enum(['draft', 'published']);
export type PublishStatus = z.infer<typeof publishStatusSchema>;
