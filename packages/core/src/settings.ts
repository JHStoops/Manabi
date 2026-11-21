import { z } from 'zod';

/**
 * Learner settings (Product Spec section 11), stored in `users.settings` (JSONB). Display name,
 * time zone and password are columns on `users` (see account.ts); everything else in the
 * settings table lives here. Data export and account deletion are actions, not settings.
 *
 * Names stay language-neutral: `readingAnnotations` is furigana for Japanese and
 * `targetTextSize` is the Japanese text size; the web app shows them only when the course's
 * plugin enables `features.readingAnnotations`.
 */

/** FR-161: the daily XP goals a learner can pick. */
export const dailyGoalSchema = z.union([
  z.literal(10),
  z.literal(20),
  z.literal(30),
  z.literal(50),
]);
export type DailyGoal = z.infer<typeof dailyGoalSchema>;

/** FR-166: the five themes (Product Spec section 10). */
export const themeSchema = z.enum(['sakura', 'matcha', 'umi', 'yuyake', 'sumi']);
export type Theme = z.infer<typeof themeSchema>;

/** Light or dark variant of the theme; `system` follows the device. */
export const colorModeSchema = z.enum(['system', 'light', 'dark']);
export type ColorMode = z.infer<typeof colorModeSchema>;

/** FR-140: reading annotations (furigana) above every word, unlearned ones only, or never. */
export const readingAnnotationModeSchema = z.enum(['always', 'unlearned', 'never']);
export type ReadingAnnotationMode = z.infer<typeof readingAnnotationModeSchema>;

export const textSizeSchema = z.enum(['normal', 'large']);
export type TextSize = z.infer<typeof textSizeSchema>;

/** Avatar color as '#rrggbb'. */
export const avatarColorSchema = z.string().regex(/^#[0-9a-f]{6}$/i);

/** Avatar initial: one visible character (code point). */
export const avatarInitialSchema = z
  .string()
  .refine((value) => [...value].length === 1 && /^\S$/u.test(value), 'Expected one character');

export const MAX_NEW_ITEM_CAP = 200;
export const MAX_REVIEW_CAP = 1000;

/** Defaults for every learner setting (Product Spec sections 7, 8, 10, 11). */
export const defaultLearnerSettings = {
  // Profile. Null means "derive from the display name".
  avatarColor: null,
  avatarInitial: null,
  // Study.
  dailyGoal: 20,
  newItemCap: 20,
  reviewCap: 100,
  drawingExercises: true,
  preferWordBank: false,
  // Display.
  theme: 'sakura',
  colorMode: 'system',
  readingAnnotations: 'unlearned',
  targetTextSize: 'normal',
  // Sound and motion (FR-167). The device's reduced-motion setting is honored regardless.
  soundEffects: true,
  audioAutoplay: true,
  reducedMotion: false,
  // Social (FR-184): both opt-out.
  appearOnLeaderboard: true,
  allowNudges: true,
} as const satisfies Record<string, unknown>;

const d = defaultLearnerSettings;

/**
 * Parses stored settings, filling in a default for every missing field and dropping unknown keys,
 * so `learnerSettingsSchema.parse({})` gives the defaults.
 */
export const learnerSettingsSchema = z.object({
  avatarColor: avatarColorSchema.nullable().default(d.avatarColor),
  avatarInitial: avatarInitialSchema.nullable().default(d.avatarInitial),
  dailyGoal: dailyGoalSchema.default(d.dailyGoal),
  // FR-115: daily caps on new lesson items and on reviews.
  newItemCap: z.number().int().min(0).max(MAX_NEW_ITEM_CAP).default(d.newItemCap),
  reviewCap: z.number().int().min(1).max(MAX_REVIEW_CAP).default(d.reviewCap),
  // FR-074: drawing exercises can be turned off.
  drawingExercises: z.boolean().default(d.drawingExercises),
  preferWordBank: z.boolean().default(d.preferWordBank),
  theme: themeSchema.default(d.theme),
  colorMode: colorModeSchema.default(d.colorMode),
  readingAnnotations: readingAnnotationModeSchema.default(d.readingAnnotations),
  targetTextSize: textSizeSchema.default(d.targetTextSize),
  soundEffects: z.boolean().default(d.soundEffects),
  audioAutoplay: z.boolean().default(d.audioAutoplay),
  reducedMotion: z.boolean().default(d.reducedMotion),
  appearOnLeaderboard: z.boolean().default(d.appearOnLeaderboard),
  allowNudges: z.boolean().default(d.allowNudges),
});
export type LearnerSettings = z.infer<typeof learnerSettingsSchema>;

/** A partial settings update (`PATCH /me`): only the fields sent change; unknown keys fail. */
const settingsShape = learnerSettingsSchema.shape;
type SettingsShape = typeof settingsShape;
// Not `.partial()`: zod 4 applies a default even inside `.optional()`, so a partial of the
// defaulted schema would reset every field the patch leaves out.
export const learnerSettingsPatchSchema = z
  .object(
    Object.fromEntries(
      Object.entries(settingsShape).map(([key, field]) => [key, field.unwrap().optional()]),
    ) as { [K in keyof SettingsShape]: z.ZodOptional<ReturnType<SettingsShape[K]['unwrap']>> },
  )
  .strict();
export type LearnerSettingsPatch = z.infer<typeof learnerSettingsPatchSchema>;
