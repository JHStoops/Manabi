import { createHash } from 'node:crypto';
import type { Pool } from 'pg';
import {
  CHOICE_TYPE,
  DRAWING_EXERCISE_TYPES,
  GRAMMAR_EXERCISE_ORDER,
  LESSON_MAX_EXERCISES,
  LESSON_MIN_EXERCISES,
  STROKE_TRACE_TYPE,
  SecondAttemptError,
  TEST_OUT_EXERCISES,
  TEST_OUT_PASS_ACCURACY,
  exerciseTypeIds,
  gradeResponse,
  learnerSettingsSchema,
  TEACHING_CARD_MAX_WORDS,
  lessonCompletionSchema,
  lessonFlows,
  lessonRecipes,
  lessonSessionStateSchema,
  payloadItemIds,
  testOutCompletionSchema,
  testOutStateSchema,
  z,
} from '@manabi/core';
import type {
  ExerciseResponse,
  GeneratorContext,
  Item,
  LanguagePlugin,
  LessonCompletion,
  LessonCompletionRequest,
  LessonFlowStep,
  LessonSession,
  LessonPreview,
  LessonSessionState,
  SessionExercise,
  TestOutCompletion,
  TestOutCompletionRequest,
  TestOutSession,
  TestOutState,
} from '@manabi/core';
import type { Queryable } from '../../db/db';
import { withTransaction } from '../../db/db';
import { AppError } from '../../errors';
import { languagePlugins } from '../../plugins';
import type { ScopedUserId } from '../auth/service';
import type { ExerciseRow, ItemRow } from '../content/rows';
import { awardLessonXp, getPath, recordTestOut } from '../courses/service';
import { createReviewEntries } from '../reviews/service';
import * as q from './queries';

// Lesson and unit test-out sessions: build, save, resume and complete (FR-024, FR-041, FR-048,
// FR-050, FR-051 to FR-053, FR-056; SDD sections 6 and 7).

/** JSON with object keys sorted, so equal values compare equal (jsonb reorders keys). */
function stableJson(value: unknown): string {
  return JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );
}

export function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    courseId: row.course_id,
    key: row.key,
    type: row.type,
    levelCode: row.level_code,
    data: row.data,
    overrides: row.overrides,
    source: row.source,
    datasetVersion: row.dataset_version,
    archivedAt: row.archived_at?.toISOString() ?? null,
  };
}

/**
 * FR-041, FR-050: the learner's unexpired session for the lesson, kept 24 more hours, or a new one
 * built and saved for 24 hours. Only lessons the learner can see, has unlocked and whose course
 * they are enrolled in can be started.
 */
export async function startSession(
  db: Pool,
  userId: ScopedUserId,
  lessonId: number,
): Promise<LessonSession> {
  const lesson = await q.findLesson(db, lessonId);
  if (!lesson) throw new AppError('not_found', 'Lesson not found');
  const path = await getPath(db, userId, lesson.course_id, false);
  const state = path.sections
    .flatMap((s) => s.units)
    .flatMap((u) => u.lessons)
    .find((l) => l.id === lessonId)?.state;
  if (!state) throw new AppError('not_found', 'Lesson not found');
  if (state === 'locked') throw new AppError('forbidden', 'This lesson is still locked');
  // Same error as an XP award without enrollment (courses awardXp), checked before any work.
  if (!(await q.isEnrolled(db, userId, lesson.course_id))) {
    throw new AppError('conflict', 'Not enrolled in this course');
  }

  const row = await withTransaction(db, async (client) => {
    await q.lockLessonSessions(client, userId, lessonId);
    return (
      (await q.resumeOpenSession(client, userId, lessonId)) ??
      q.insertSession(
        client,
        userId,
        lessonId,
        await buildState(client, lesson, await drawingOn(client, userId)),
      )
    );
  });
  return {
    id: row.id,
    lessonId,
    expiresAt: row.expires_at.toISOString(),
    lessonTitle: lesson.title,
    lessonType: lesson.type,
    sectionLevel: lesson.level_code,
    plugin: lesson.plugin,
    ...lessonSessionStateSchema.parse(row.state),
  };
}

/** FR-074: whether the learner wants drawing exercises (EX-11, EX-12) in new sessions. */
async function drawingOn(db: Queryable, userId: number): Promise<boolean> {
  return learnerSettingsSchema.parse((await q.findSettings(db, userId))?.settings ?? {})
    .drawingExercises;
}

/** What building a lesson's exercises needs: its plugin, new items and generator context. */
async function lessonInputs(db: Queryable, lesson: q.LessonContextRow) {
  const plugin = languagePlugins.get(lesson.plugin);
  const newItems = (await q.listLessonItems(db, lesson.id)).map(toItem);
  const taughtItems = (await q.listTaughtItems(db, lesson.id)).map(toItem);
  // FR-056, FR-048: sentences at or below the section level, not challenging, taught items only.
  const sentences = await q.listSentences(
    db,
    lesson.course_id,
    lesson.level_code,
    newItems.map((i) => i.id),
    taughtItems.map((i) => i.id),
  );
  const context: GeneratorContext = { sectionLevel: lesson.level_code, taughtItems, sentences };
  // FR-072: only characters with stroke data can be drawn or animated.
  const strokeKeys = await q.listStrokeItemKeys(
    db,
    taughtItems.map((i) => i.id),
  );
  // Product Spec section 5: the taught items that contain each new item (a kanji's words).
  const containing = new Map<number, Item[]>();
  if (lessonFlows[lesson.type]) {
    const byId = new Map(taughtItems.map((i) => [i.id, i]));
    for (const link of await q.listContainingLinks(
      db,
      newItems.map((i) => i.id),
    )) {
      const container = byId.get(link.container_id);
      if (container)
        containing.set(link.item_id, [...(containing.get(link.item_id) ?? []), container]);
    }
  }
  return { plugin, newItems, context, strokeKeys, containing };
}

/**
 * SDD section 6: teaching cards for the new items, then the stored exercises, filled up to 10 by
 * the plugin's generators per the lesson type's recipe. Exercises use taught items only (FR-048).
 */
async function buildState(
  db: Queryable,
  lesson: q.LessonContextRow,
  drawing: boolean,
): Promise<LessonSessionState> {
  const { plugin, newItems, context, strokeKeys, containing } = await lessonInputs(db, lesson);
  const stored = await q.listStoredExercises(db, lesson.id);
  const flow = lessonFlows[lesson.type];
  const exercises = flow
    ? fillFlow(plugin, context, newItems, stored, flow, containing, drawing, strokeKeys)
    : fillExercises(
        plugin,
        context,
        newItems,
        lesson.type === 'grammar' ? grammarExercises(stored, context) : stored,
        lessonRecipes[lesson.type],
        LESSON_MIN_EXERCISES,
        LESSON_MAX_EXERCISES,
        drawing,
        strokeKeys,
      );
  if (exercises.length < LESSON_MIN_EXERCISES) {
    throw new AppError('conflict', 'This lesson does not have enough exercises yet', {
      exercises: exercises.length,
      required: LESSON_MIN_EXERCISES,
    });
  }
  return lessonSessionStateSchema.parse({
    // FR-041: the first fitting sentence is a new item's example, the first two a grammar point's
    // (Product Spec section 6, sentences where it was detected); none when none fits.
    teachingCards: newItems.map((item) => ({
      item,
      examples: context.sentences
        .filter((s) => s.tokens.some((t) => t.itemId === item.id) || s.grammar.includes(item.key))
        .slice(0, lesson.type === 'grammar' ? 2 : 1)
        .map((s) => ({ text: s.text, translation: s.translation, tiles: s.tokens })),
      // Product Spec section 5: a kanji's card shows 1 to 3 words that use it and its strokes.
      words: (containing.get(item.id) ?? []).slice(0, TEACHING_CARD_MAX_WORDS),
      strokeAnimation:
        lesson.type === 'kanji' && plugin.features.strokeDrawing && strokeKeys.has(item.key),
    })),
    exercises,
  });
}

/**
 * FR-091, Product Spec section 6: a grammar lesson's authored exercises in the spec's order, of
 * the grammar types only, with at most one listening exercise (last). A type not registered yet
 * (EX-07 before #67) is left out, so the lesson still plays.
 */
function grammarExercises(stored: ExerciseRow[], context: GeneratorContext): ExerciseRow[] {
  const registered = new Set(exerciseTypeIds());
  const rank = (e: ExerciseRow) => GRAMMAR_EXERCISE_ORDER.indexOf(e.type);
  // Taught-only first (FR-048), so the cap below keeps only exercises the session can use.
  const fits = storedFits(context);
  const ordered = stored
    .filter((e) => e.origin === 'authored' && rank(e) >= 0 && registered.has(e.type) && fits(e))
    .sort((a, b) => rank(a) - rank(b));
  const listening = ordered.filter((e) => e.type === 'listen_choose').slice(0, 1);
  return [
    ...ordered
      .filter((e) => e.type !== 'listen_choose')
      .slice(0, LESSON_MAX_EXERCISES - listening.length),
    ...listening,
  ];
}

/** FR-048: whether a stored exercise uses taught items only. */
function storedFits(context: GeneratorContext) {
  const taught = new Set(context.taughtItems.map((i) => i.id));
  return (e: Pick<ExerciseRow, 'item_id' | 'payload'>) =>
    (e.item_id === null || taught.has(e.item_id)) &&
    payloadItemIds(e.payload).every((id) => taught.has(id));
}

/**
 * FR-224: the lesson's session as a learner would get it, drafts included, for an admin to
 * preview. Nothing is saved: no session row, so no completion can be recorded either.
 */
export async function previewLesson(db: Queryable, lessonId: number): Promise<LessonPreview> {
  const lesson = await q.findLesson(db, lessonId);
  if (!lesson) throw new AppError('not_found', 'Lesson not found');
  return {
    lessonId,
    lessonTitle: lesson.title,
    lessonType: lesson.type,
    sectionLevel: lesson.level_code,
    plugin: lesson.plugin,
    ...(await buildState(db, lesson, true)),
  };
}

/**
 * FR-049, FR-223: what the lesson type's generators make from the new items, without the stored
 * exercises, up to a session's maximum, for the author to pin.
 */
export async function generateExercises(
  db: Queryable,
  lessonId: number,
): Promise<SessionExercise[]> {
  const lesson = await q.findLesson(db, lessonId);
  if (!lesson) throw new AppError('not_found', 'Lesson not found');
  const { plugin, newItems, context, strokeKeys, containing } = await lessonInputs(db, lesson);
  const flow = lessonFlows[lesson.type];
  if (flow) return fillFlow(plugin, context, newItems, [], flow, containing, true, strokeKeys);
  return fillExercises(
    plugin,
    context,
    newItems,
    [],
    lessonRecipes[lesson.type],
    LESSON_MAX_EXERCISES,
    LESSON_MAX_EXERCISES,
    true,
    strokeKeys,
  );
}

/**
 * FR-024: 20 exercises drawn from the unit's items, built like a lesson's: the stored exercises
 * of its lessons taken in turn (each lesson's first, then each one's second, ...), then the
 * generators of every lesson type in the unit over all of its items.
 */
async function buildTestOutState(
  db: Queryable,
  unit: q.UnitContextRow,
  drawing: boolean,
): Promise<TestOutState> {
  const plugin = languagePlugins.get(unit.plugin);
  const lessons = await q.listUnitLessons(db, unit.id);
  const newItems = new Map<number, Item>();
  const stored: { turn: number; exercise: ExerciseRow }[] = [];
  for (const lesson of lessons) {
    for (const row of await q.listLessonItems(db, lesson.id)) newItems.set(row.id, toItem(row));
    (await q.listStoredExercises(db, lesson.id)).forEach((exercise, turn) =>
      stored.push({ turn, exercise }),
    );
  }
  const last = lessons.at(-1);
  const taughtItems = last ? (await q.listTaughtItems(db, last.id)).map(toItem) : [];
  const sentences = await q.listSentences(
    db,
    unit.course_id,
    unit.level_code,
    [...newItems.keys()],
    taughtItems.map((i) => i.id),
  );
  const exercises = fillExercises(
    plugin,
    { sectionLevel: unit.level_code, taughtItems, sentences },
    [...newItems.values()],
    stored.sort((a, b) => a.turn - b.turn).map((s) => s.exercise),
    // A guided trace (EX-11) tests nothing a test-out should: it shows every stroke.
    [...new Set(lessons.flatMap((l) => lessonRecipes[l.type]))].filter(
      (type) => type !== STROKE_TRACE_TYPE,
    ),
    TEST_OUT_EXERCISES,
    TEST_OUT_EXERCISES,
    drawing,
    await q.listStrokeItemKeys(
      db,
      taughtItems.map((i) => i.id),
    ),
  );
  if (exercises.length < TEST_OUT_EXERCISES) {
    throw new AppError('conflict', 'This unit does not have enough exercises for a test-out yet', {
      exercises: exercises.length,
      required: TEST_OUT_EXERCISES,
    });
  }
  return testOutStateSchema.parse({ exercises });
}

/**
 * SDD section 6: the stored exercises (up to `max`), then the recipe's generators over the new
 * items until there are `target`. Every exercise uses taught items only (FR-048), and no two are
 * identical (same type and deeply equal payload). With `drawing` off, a stored drawing exercise
 * becomes the plugin's EX-01 for the same item, and the recipe's drawing types are skipped (FR-074).
 * A drawing exercise for a character without stroke data (not in `strokeKeys`) is treated the
 * same way, since it could not be drawn (FR-072).
 */
function fillExercises(
  plugin: LanguagePlugin,
  context: GeneratorContext,
  newItems: Item[],
  stored: ExerciseRow[],
  recipe: readonly string[],
  target: number,
  max: number,
  drawing: boolean,
  strokeKeys: ReadonlySet<string>,
): SessionExercise[] {
  const offDrawing = (type: string) => !drawing && DRAWING_EXERCISE_TYPES.includes(type);
  const drawable = (e: SessionExercise) =>
    !DRAWING_EXERCISE_TYPES.includes(e.type) || strokeKeys.has(String(e.payload.itemKey));
  const taught = new Set(context.taughtItems.map((i) => i.id));
  const usesTaughtOnly = (payload: unknown) =>
    payloadItemIds(payload).every((id) => taught.has(id));

  const exercises: SessionExercise[] = [];
  const seen = new Set<string>();
  const add = (e: SessionExercise) => {
    const key = stableJson(e);
    if (seen.has(key) || exercises.length >= max) return false;
    seen.add(key);
    exercises.push(e);
    return true;
  };
  const fits = storedFits(context);
  const swapped = new Set<number>();
  for (const e of stored) {
    if (!fits(e)) continue;
    if (!offDrawing(e.type) && drawable(e)) {
      add({ type: e.type, payload: e.payload });
      continue;
    }
    // Drawing payloads name their character by item key (EX-11, EX-12). One EX-01 per item, so
    // an item's EX-11 and EX-12 do not become two near-identical choices.
    // shortcut: when the plugin makes no EX-01 for the item (too few distractors), the drawing
    // exercise is dropped and the recipe fill below makes up the count; add another recognition
    // fallback if drawing-off learners hit "not enough exercises".
    const item = context.taughtItems.find((i) => i.key === e.payload.itemKey);
    if (!item || swapped.has(item.id)) continue;
    swapped.add(item.id);
    const choice = Object.hasOwn(plugin.generators, CHOICE_TYPE)
      ? (plugin.generators[CHOICE_TYPE]!(item, context) as SessionExercise[])[0]
      : undefined;
    if (choice && usesTaughtOnly(choice.payload)) add(choice);
  }

  const generators = recipe.flatMap((type) =>
    Object.hasOwn(plugin.generators, type) && !offDrawing(type) ? [plugin.generators[type]!] : [],
  );
  if (generators.length > 0 && newItems.length > 0 && exercises.length < target) {
    // Step k takes the recipe's types round-robin (each type gets a turn before any gets a second)
    // and the new items in turn; the item shifts by one every lcm(types, items) steps, so a pass
    // of types × items steps pairs every type with every item. Passes repeat until full, or a pass
    // adds nothing new.
    const types = generators.length;
    const items = newItems.length;
    const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
    const lcm = (types * items) / gcd(types, items);
    // Limit: in a large lesson where a type often generates nothing, the session can reach its
    // target before every new item is covered.
    for (let added = true; added && exercises.length < target;) {
      added = false;
      for (let k = 0; k < types * items; k++) {
        const generate = generators[k % types]!;
        const item = newItems[(k + Math.floor(k / lcm)) % items]!;
        for (const e of generate(item, context) as SessionExercise[]) {
          if (exercises.length >= target) break;
          if (usesTaughtOnly(e.payload) && drawable(e) && add(e)) added = true;
        }
      }
    }
  }
  return exercises;
}

/**
 * Product Spec section 5, SDD section 6: a session that follows a lesson flow (kanji lessons).
 * The stored exercises come first, as in other lessons (up to a session's maximum). Then the steps
 * fill what is left, by priority: for every new item, the `everyItem` steps that are not optional
 * (draw from memory), then one exercise of each facet step (meaning, then reading); then the
 * optional `everyItem` steps (trace); then the `containing` steps over the taught items that contain
 * the new items (words). Up to 15 exercises; then, only while the session is under 10, more rounds
 * of the facet and word steps. The exercises are ordered by step at the end; a stored exercise goes
 * to the step it fits (`storedStep`). Taught-only, no duplicates, drawing off (FR-074) and stroke
 * data (FR-072) as in `fillExercises`.
 */
function fillFlow(
  plugin: LanguagePlugin,
  context: GeneratorContext,
  newItems: Item[],
  stored: ExerciseRow[],
  flow: readonly LessonFlowStep[],
  containing: ReadonlyMap<number, readonly Item[]>,
  drawing: boolean,
  strokeKeys: ReadonlySet<string>,
): SessionExercise[] {
  const max = LESSON_MAX_EXERCISES;
  const taught = new Set(context.taughtItems.map((i) => i.id));
  const usable = (e: SessionExercise) =>
    payloadItemIds(e.payload).every((id) => taught.has(id)) &&
    (!DRAWING_EXERCISE_TYPES.includes(e.type) ||
      (drawing && strokeKeys.has(String(e.payload.itemKey))));
  const placed: { step: number; exercise: SessionExercise }[] = [];
  const seen = new Set<string>();
  const add = (exercise: SessionExercise, step: number) => {
    const key = stableJson(exercise);
    if (placed.length >= max || seen.has(key) || !usable(exercise)) return false;
    seen.add(key);
    placed.push({ step, exercise });
    return true;
  };
  const generate = (step: LessonFlowStep, item: Item) =>
    Object.hasOwn(plugin.generators, step.type)
      ? (plugin.generators[step.type]!(item, {
          ...context,
          ...(step.facet ? { facet: step.facet } : {}),
        }) as SessionExercise[])
      : [];
  /** Adds the first new exercise of the first of these steps that makes one for the item. */
  const addOne = (steps: { step: LessonFlowStep; index: number }[], item: Item) =>
    steps.some(({ step, index }) => generate(step, item).some((e) => add(e, index)));

  // Stored exercises keep the lesson's own rules (drawing off becomes EX-01).
  const newIds = new Set(newItems.map((i) => i.id));
  for (const exercise of fillExercises(
    plugin,
    context,
    newItems,
    stored,
    [],
    0,
    max,
    drawing,
    strokeKeys,
  )) {
    add(exercise, storedStep(flow, exercise, newIds));
  }

  const steps = flow.map((step, index) => ({ step, index }));
  const required = steps.filter((s) => s.step.everyItem && !s.step.optional);
  const optional = steps.filter((s) => s.step.everyItem && s.step.optional);
  const forNew = steps.filter((s) => !s.step.everyItem && s.step.targets !== 'containing');
  const forContaining = steps.filter((s) => s.step.targets === 'containing');
  // One exercise per facet (meaning, reading), each from the first of its steps that makes one.
  const facets = [...new Set(forNew.map((s) => s.step.facet))].map((facet) =>
    forNew.filter((s) => s.step.facet === facet),
  );
  const containers = [
    ...new Map(newItems.flatMap((i) => containing.get(i.id) ?? []).map((c) => [c.id, c])).values(),
  ];

  for (const step of required) for (const item of newItems) addOne([step], item);
  for (const facetSteps of facets) for (const item of newItems) addOne(facetSteps, item);
  for (const step of optional) for (const item of newItems) addOne([step], item);
  for (const step of forContaining) for (const item of containers) addOne([step], item);

  // A short session (few new items, or few words) gets more of the facet and word steps, in turn.
  const rounds = [
    ...forNew.flatMap((s) => newItems.map((item) => () => addOne([s], item))),
    ...forContaining.flatMap((s) => containers.map((item) => () => addOne([s], item))),
  ];
  for (let added = true; added && placed.length < LESSON_MIN_EXERCISES;) {
    added = false;
    for (const next of rounds) {
      if (placed.length >= LESSON_MIN_EXERCISES) break;
      if (next()) added = true;
    }
  }
  return placed.sort((a, b) => a.step - b.step).map((p) => p.exercise);
}

/**
 * The flow step a stored exercise belongs to: a step of its type, for the new items when the
 * exercise names one (else for the containing items), and of the facet a typed answer tests (in
 * the base language: meaning; in the target language: reading), the facet winning when no target
 * fits. A type the flow does not use goes before the last step.
 */
function storedStep(
  flow: readonly LessonFlowStep[],
  exercise: SessionExercise,
  newIds: ReadonlySet<number>,
): number {
  const candidates = flow
    .map((step, index) => ({ step, index }))
    .filter(({ step }) => step.type === exercise.type);
  if (candidates.length === 0) return flow.length - 1.5;
  const targets = payloadItemIds(exercise.payload).some((id) => newIds.has(id))
    ? 'new'
    : 'containing';
  const facet =
    exercise.payload.answerLanguage === 'base'
      ? 'meaning'
      : exercise.payload.answerLanguage === 'target'
        ? 'reading'
        : undefined;
  const fits = (s: LessonFlowStep) => (s.targets ?? 'new') === targets;
  return (
    candidates.find(({ step }) => fits(step) && (!facet || step.facet === facet)) ??
    // An authored exercise may name no item in its payload; its facet still places it.
    (facet ? candidates.find(({ step }) => step.facet === facet) : undefined) ??
    candidates.find(({ step }) => fits(step)) ??
    candidates[0]!
  ).index;
}

/** FR-053: how many responses the shared grader counts right; near-misses count as right. */
function countRight(
  exercises: SessionExercise[],
  responses: ExerciseResponse[],
  plugin: LanguagePlugin,
): number {
  if (responses.length !== exercises.length) {
    throw new AppError('validation_failed', 'Send one response per exercise', [
      { location: 'body', path: ['responses'], message: `Expected ${exercises.length} responses` },
    ]);
  }
  return exercises.filter((exercise, i) => {
    try {
      return gradeResponse(exercise, responses[i]!, plugin).result !== 'wrong';
    } catch (err) {
      // A malformed payload or answer, or a second attempt that was not allowed; anything else
      // the grader or plugin throws is a server fault (500).
      if (!(err instanceof z.ZodError || err instanceof SecondAttemptError)) throw err;
      throw new AppError('validation_failed', 'A response is not a valid answer', [
        { location: 'body', path: ['responses', i], message: 'Not a valid answer' },
      ]);
    }
  }).length;
}

/**
 * FR-052, NFR-20: runs a completion in one transaction. With an Idempotency-Key, a repeat of the
 * same request gets the first response and changes nothing; the key is saved with the result.
 */
function completeOnce<T extends object>(
  db: Pool,
  userId: ScopedUserId,
  idempotencyKey: string | undefined,
  request: unknown,
  parse: (saved: unknown) => T,
  complete: (client: Queryable) => Promise<T>,
): Promise<T> {
  const requestHash = createHash('sha256').update(stableJson(request)).digest('hex');
  return withTransaction(db, async (client) => {
    if (idempotencyKey !== undefined) {
      await q.lockIdempotencyKey(client, userId, idempotencyKey);
      const saved = await q.findIdempotencyKey(client, userId, idempotencyKey);
      if (saved) {
        if (saved.request_hash !== requestHash) {
          throw new AppError(
            'idempotency_conflict',
            'This Idempotency-Key was already used for a different request',
          );
        }
        return parse(saved.response);
      }
    }
    const result = await complete(client);
    if (idempotencyKey !== undefined) {
      await q.insertIdempotencyKey(client, userId, idempotencyKey, requestHash, result);
    }
    return result;
  });
}

/**
 * FR-051 to FR-053, NFR-20: completes the learner's session in one transaction. The server
 * re-grades every response with the shared grader; then it records lesson progress, awards XP,
 * records a finished unit and uses the session up. With an Idempotency-Key, a repeat of the same
 * request gets the first response and changes nothing (FR-052).
 */
export async function completeSession(
  db: Pool,
  userId: ScopedUserId,
  sessionId: number,
  body: LessonCompletionRequest,
  idempotencyKey: string | undefined,
  srsIntervalHours: readonly number[],
): Promise<LessonCompletion> {
  return completeOnce(
    db,
    userId,
    idempotencyKey,
    { sessionId, body },
    (saved) => lessonCompletionSchema.parse(saved),
    async (client) => {
      const session = await q.lockOwnSession(client, userId, sessionId);
      if (!session?.lesson_id) throw new AppError('not_found', 'Lesson session not found');
      const lesson = await q.findLesson(client, session.lesson_id);
      if (!lesson) throw new AppError('not_found', 'Lesson not found');
      const { exercises } = lessonSessionStateSchema.parse(session.state);
      const right = countRight(exercises, body.responses, languagePlugins.get(lesson.plugin));
      const accuracy = Math.round((100 * right) / exercises.length);

      await q.upsertLessonProgress(client, userId, lesson.id, accuracy);
      const xp = await awardLessonXp(client, userId, lesson.id, accuracy);
      await q.insertUnitCompletionIfDone(client, userId, lesson.id);
      await createReviewEntries(
        client,
        userId,
        lesson.type,
        await q.listLessonItems(client, lesson.id),
        languagePlugins.get(lesson.plugin),
        srsIntervalHours,
      );
      // Achievements are not built yet; they join this transaction here when their issue lands.
      await q.deleteSession(client, session.id);

      return {
        lessonId: lesson.id,
        accuracy,
        ...xp,
        path: await getPath(client, userId, lesson.course_id, false),
      };
    },
  );
}

/**
 * FR-024, FR-050: the learner's unexpired test-out session for the unit, or a new one. Only a
 * unit the path offers a test-out for (open, not finished) can be started.
 */
export async function startTestOut(
  db: Pool,
  userId: ScopedUserId,
  unitId: number,
): Promise<TestOutSession> {
  const unit = await q.findUnit(db, unitId);
  if (!unit) throw new AppError('not_found', 'Unit not found');
  const pathUnit = (await getPath(db, userId, unit.course_id, false)).sections
    .flatMap((s) => s.units)
    .find((u) => u.id === unitId);
  if (!pathUnit) throw new AppError('not_found', 'Unit not found');
  if (pathUnit.lessons[0]!.state === 'locked') {
    throw new AppError('forbidden', 'This unit is still locked');
  }
  if (!pathUnit.testOutAvailable) throw new AppError('conflict', 'This unit is already finished');
  if (!(await q.isEnrolled(db, userId, unit.course_id))) {
    throw new AppError('conflict', 'Not enrolled in this course');
  }

  const row = await withTransaction(db, async (client) => {
    await q.lockUnitSessions(client, userId, unitId);
    return (
      (await q.resumeOpenUnitSession(client, userId, unitId)) ??
      q.insertUnitSession(
        client,
        userId,
        unitId,
        await buildTestOutState(client, unit, await drawingOn(client, userId)),
      )
    );
  });
  return {
    id: row.id,
    unitId,
    unitTitle: unit.title,
    expiresAt: row.expires_at.toISOString(),
    sectionLevel: unit.level_code,
    plugin: unit.plugin,
    ...testOutStateSchema.parse(row.state),
  };
}

/**
 * FR-024, FR-021, FR-052, NFR-20: completes a test-out in one transaction, re-graded on the
 * server. At 85% or better the unit is finished by test-out (its lessons open, the next unit
 * unlocks) and earns test-out XP; below, nothing changes. Either way the session is used up.
 */
export async function completeTestOut(
  db: Pool,
  userId: ScopedUserId,
  sessionId: number,
  body: TestOutCompletionRequest,
  idempotencyKey: string | undefined,
  srsIntervalHours: readonly number[],
): Promise<TestOutCompletion> {
  return completeOnce(
    db,
    userId,
    idempotencyKey,
    { testOutSessionId: sessionId, body },
    (saved) => testOutCompletionSchema.parse(saved),
    async (client) => {
      const session = await q.lockOwnSession(client, userId, sessionId);
      if (!session?.unit_id) throw new AppError('not_found', 'Test-out session not found');
      const unit = await q.findUnit(client, session.unit_id);
      if (!unit) throw new AppError('not_found', 'Unit not found');
      const { exercises } = testOutStateSchema.parse(session.state);
      const right = countRight(exercises, body.responses, languagePlugins.get(unit.plugin));
      const accuracy = Math.round((100 * right) / exercises.length);
      const passed = accuracy >= TEST_OUT_PASS_ACCURACY;

      const xp = await recordTestOut(client, {
        userId,
        courseId: unit.course_id,
        unitId: unit.id,
        passed,
      });
      // FR-110: a pass puts the unit's items into reviews, as completing its lessons would.
      if (passed) {
        for (const lesson of await q.listUnitLessons(client, unit.id)) {
          await createReviewEntries(
            client,
            userId,
            lesson.type,
            await q.listLessonItems(client, lesson.id),
            languagePlugins.get(unit.plugin),
            srsIntervalHours,
          );
        }
      }
      await q.deleteSession(client, session.id);

      return {
        unitId: unit.id,
        accuracy,
        passed,
        ...xp,
        path: await getPath(client, userId, unit.course_id, false),
      };
    },
  );
}
