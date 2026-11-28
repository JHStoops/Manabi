import type { FastifyInstance } from 'fastify';
import { KANJI_LESSON_FLOW, getExerciseType, isFlowCard, payloadItemIds } from '@manabi/core';
import type { LessonFlowStep, LessonSession, ReviewSession, SessionExercise } from '@manabi/core';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';
import { backfillReviewFacets } from '../reviews/service';

// API tests for kanji lessons (issue #53): FR-040, FR-049, FR-110, Product Spec section 5.

const PASSWORD = 'correct horse battery';

const kanji = (
  character: string,
  meaning: string,
  on: string[],
  kun: string[],
  strokes: number,
) => ({
  character,
  meanings: [meaning],
  onReadings: on,
  kunReadings: kun,
  strokeCount: strokes,
  components: [],
});
const word = (written: string, reading: string, meaning: string) => ({
  written,
  reading,
  senses: [{ partsOfSpeech: ['n'], meanings: [meaning] }],
});

/** A kanji flow entry's place in the flow, by label: `card:reading`, `choice:meaning`. */
function flowIndex(label: string): number {
  const index = KANJI_LESSON_FLOW.findIndex(
    (s) => (isFlowCard(s) ? `card:${s.card}` : `${s.type}:${s.facet ?? s.targets ?? ''}`) === label,
  );
  if (index < 0) throw new Error(`No flow entry ${label}`);
  return index;
}

/** The flow step an exercise of the kanji lesson belongs to (Product Spec section 5). */
function stepOf(e: SessionExercise, kanjiIds: Set<number>): number {
  const ids = payloadItemIds(e.payload);
  const step = (type: string, test: (s: LessonFlowStep) => boolean) =>
    KANJI_LESSON_FLOW.findIndex((s) => !isFlowCard(s) && s.type === type && test(s));
  if (e.type === 'choice') {
    return ids.some((id) => kanjiIds.has(id))
      ? step('choice', (s) => s.facet === 'meaning')
      : step('choice', (s) => s.targets === 'containing');
  }
  if (e.type === 'typed_answer') {
    const facet = e.payload.answerLanguage === 'base' ? 'meaning' : 'reading';
    return step('typed_answer', (s) => s.facet === facet);
  }
  return step(e.type, () => true);
}

/** The answer each exercise type grades as correct. */
function rightAnswer(e: SessionExercise): unknown {
  const p = e.payload as Record<string, unknown>;
  if (e.type === 'choice' || e.type === 'reading_in_context') return p.correct;
  if (e.type === 'match_pairs') return [0, 1, 2, 3, 4];
  if (e.type === 'stroke_trace' || e.type === 'draw_memory') return { mistakes: 0 };
  return (p.accept as { text: string }[])[0]!.text;
}

describeWithDb('kanji lessons API', () => {
  const pool = useTestDatabase();
  let current: TestApp | undefined;
  let app: FastifyInstance;

  beforeEach(async () => {
    current = await testApp({ pool: pool() });
    app = current.app;
  });

  afterEach(async () => {
    await current?.close();
    current = undefined;
  });

  function sql<R extends object = { id: number }>(text: string, params: unknown[] = []) {
    return query<R>(pool(), text, params);
  }

  /**
   * A Japanese N5 unit: a vocabulary lesson (休み, 本, 日本, 山, 川, 火 and three more), a kanji
   * lesson teaching 体, 木, 雨 and 電 (distractors), then the kanji lesson under test teaching 休
   * and 本, and `extra` more of 山, 川 and 火; the words contain them. Every kanji has stroke data.
   */
  async function seed(extra = 0) {
    const [course] = await sql(
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ('ja-en', 'ja', 'en', 'ja', 'Japanese', 'published') RETURNING id`,
    );
    const courseId = course!.id;
    const lessons = await sql<{ id: number; key: string }>(
      `WITH s AS (
         INSERT INTO sections (course_id, key, position, title, level_code)
         VALUES ($1, 's', 0, 'N5', 'N5') RETURNING id
       ), u AS (
         INSERT INTO units (section_id, key, position, title, status)
         SELECT id, 'u', 0, 'u', 'published' FROM s RETURNING id
       )
       INSERT INTO lessons (unit_id, key, position, type, title, status)
       SELECT u.id, l.key, l.position, l.type, l.key, 'published'
         FROM u, (VALUES ('v', 0, 'vocabulary'), ('k0', 1, 'kanji'), ('k', 2, 'kanji'))
              AS l (key, position, type)
       RETURNING id, key`,
      [courseId],
    );
    const lesson = Object.fromEntries(lessons.map((l) => [l.key, l.id]));
    const items: Record<string, number> = {};
    const add = async (key: string, type: string, data: object, lessonKey: string, at: number) => {
      const [row] = await sql(
        `INSERT INTO items (course_id, key, type, level_code, data)
         VALUES ($1, $2, $3, 'N5', $4) RETURNING id`,
        [courseId, key, type, data],
      );
      items[key] = row!.id;
      await sql(`INSERT INTO lesson_items (lesson_id, item_id, position) VALUES ($1, $2, $3)`, [
        lesson[lessonKey],
        row!.id,
        at,
      ]);
    };
    await add('w:休み', 'word', word('休み', 'やすみ', 'holiday'), 'v', 0);
    await add('w:本', 'word', word('本', 'ほん', 'book'), 'v', 1);
    await add('w:日本', 'word', word('日本', 'にほん', 'Japan'), 'v', 2);
    // Other words, so word exercises have distractors.
    await add('w:犬', 'word', word('犬', 'いぬ', 'dog'), 'v', 3);
    await add('w:猫', 'word', word('猫', 'ねこ', 'cat'), 'v', 4);
    await add('w:水', 'word', word('水', 'みず', 'water'), 'v', 5);
    await add('k:体', 'kanji', kanji('体', 'body', ['タイ'], ['からだ'], 7), 'k0', 0);
    await add('k:木', 'kanji', kanji('木', 'tree', ['モク'], ['き'], 4), 'k0', 1);
    await add('k:雨', 'kanji', kanji('雨', 'rain', ['ウ'], ['あめ'], 8), 'k0', 2);
    await add('k:電', 'kanji', kanji('電', 'electricity', ['デン'], [], 13), 'k0', 3);
    await add('k:休', 'kanji', kanji('休', 'rest', ['キュウ'], ['やす.む'], 6), 'k', 0);
    await add('k:本', 'kanji', kanji('本', 'origin', ['ホン'], ['もと'], 5), 'k', 1);
    await sql(
      `INSERT INTO item_links (from_item_id, to_item_id, kind)
       VALUES ($1, $4, 'contains'), ($2, $5, 'contains'), ($3, $5, 'contains')`,
      [items['w:休み'], items['w:本'], items['w:日本'], items['k:休'], items['k:本']],
    );
    const more: [string, string, string, string, string, number][] = [
      ['山', 'mountain', 'サン', 'やま', 'peak', 3],
      ['川', 'river', 'セン', 'かわ', 'stream', 3],
      ['火', 'fire', 'カ', 'ひ', 'flame', 4],
    ];
    for (const [i, [char, meaning, on, kun, gloss, strokes]] of more.slice(0, extra).entries()) {
      await add(`w:${char}`, 'word', word(char, kun, gloss), 'v', 6 + i);
      await add(`k:${char}`, 'kanji', kanji(char, meaning, [on], [kun], strokes), 'k', 2 + i);
      await sql(
        `INSERT INTO item_links (from_item_id, to_item_id, kind) VALUES ($1, $2, 'contains')`,
        [items[`w:${char}`], items[`k:${char}`]],
      );
    }
    await sql(
      `INSERT INTO stroke_data (item_id, strokes)
       SELECT id, '{}' FROM items WHERE type = 'kanji' AND course_id = $1`,
      [courseId],
    );
    return { courseId, lesson, items };
  }

  async function learner(courseId: number, settings: object = {}) {
    const user = await seedUser(pool(), {
      username: 'aiko',
      passwordHash: await hashPassword(PASSWORD),
    });
    await sql(`UPDATE users SET settings = settings || $2::jsonb WHERE id = $1`, [
      user.id,
      settings,
    ]);
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'aiko', password: PASSWORD },
    });
    const session = {
      cookies: { [SESSION_COOKIE]: login.cookies.find((c) => c.name === SESSION_COOKIE)!.value },
      headers: { origin: 'http://localhost:3000' },
    };
    await app.inject({ method: 'POST', url: `/api/v1/courses/${courseId}/enroll`, ...session });
    return { userId: user.id, session };
  }

  /** Marks the lessons before the kanji lesson under test completed, so it is unlocked. */
  async function completeEarlier(userId: number, lesson: Record<string, number>) {
    await sql(
      `INSERT INTO lesson_progress (user_id, lesson_id, completed_at, best_accuracy)
       VALUES ($1, $2, now(), 100), ($1, $3, now(), 100)`,
      [userId, lesson.v, lesson.k0],
    );
  }

  const start = (lessonId: number, session: object) =>
    app.inject({ method: 'POST', url: `/api/v1/lessons/${lessonId}/sessions`, ...session });

  it('builds a kanji lesson in Product Spec order, tracing and drawing every kanji (FR-049)', async () => {
    const { courseId, lesson, items } = await seed();
    const { userId, session } = await learner(courseId);
    await completeEarlier(userId, lesson);

    const response = await start(lesson.k!, session);
    expect(response.statusCode).toBe(200);
    const body = response.json<LessonSession>();
    const kanjiIds = new Set([items['k:休']!, items['k:本']!]);
    const taught = new Set(Object.values(items));

    expect(body.exercises.length).toBeGreaterThanOrEqual(10);
    expect(body.exercises.length).toBeLessThanOrEqual(15);
    for (const e of body.exercises) {
      getExerciseType(e.type).payloadSchema.parse(e.payload);
      expect(payloadItemIds(e.payload).every((id) => taught.has(id))).toBe(true);
    }
    const steps = body.exercises.map((e) => stepOf(e, kanjiIds));
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    // Trace first and draw from memory last, for each kanji.
    const drawn = (type: string) =>
      body.exercises.filter((e) => e.type === type).map((e) => e.payload.character);
    expect(body.exercises.slice(0, 2).map((e) => e.type)).toEqual(['stroke_trace', 'stroke_trace']);
    expect(body.exercises.slice(-2).map((e) => e.type)).toEqual(['draw_memory', 'draw_memory']);
    expect(drawn('stroke_trace').sort()).toEqual(['休', '本']);
    expect(drawn('draw_memory').sort()).toEqual(['休', '本']);
    // Meaning, reading and word steps are all there.
    for (const label of ['choice:meaning', 'reading_in_context:reading', 'choice:containing'])
      expect(steps).toContain(flowIndex(label));
  });

  it("shows each kanji's meaning card with strokes first, and its reading card with words after the meaning exercises (Product Spec 5, #237)", async () => {
    const { courseId, lesson, items } = await seed();
    const { userId, session } = await learner(courseId);
    await completeEarlier(userId, lesson);

    const body = (await start(lesson.k!, session)).json<LessonSession>();
    const kanjiIds = new Set([items['k:休']!, items['k:本']!]);
    const steps = body.exercises.map((e) => stepOf(e, kanjiIds));
    // The reading cards come before the first exercise after the meaning steps.
    const readingAt = steps.findIndex((step) => step > flowIndex('card:reading'));
    expect(readingAt).toBeGreaterThan(0);
    expect(steps.slice(0, readingAt).every((step) => step < flowIndex('card:reading'))).toBe(true);
    expect(steps.slice(0, readingAt)).toContain(flowIndex('choice:meaning'));
    expect(steps.slice(readingAt)).toContain(flowIndex('reading_in_context:reading'));
    expect(
      body.teachingCards.map((c) => ({
        item: c.item.id,
        facet: c.facet,
        before: c.before,
        words: c.words.map((w) => w.id),
        strokeAnimation: c.strokeAnimation,
      })),
    ).toEqual([
      { item: items['k:休'], facet: 'meaning', before: 0, words: [], strokeAnimation: true },
      { item: items['k:本'], facet: 'meaning', before: 0, words: [], strokeAnimation: true },
      {
        item: items['k:休'],
        facet: 'reading',
        before: readingAt,
        words: [items['w:休み']],
        strokeAnimation: false,
      },
      {
        item: items['k:本'],
        facet: 'reading',
        before: readingAt,
        words: [items['w:本'], items['w:日本']],
        strokeAnimation: false,
      },
    ]);
  });

  it('resumes and completes a kanji session saved before #237, with its cards upfront', async () => {
    const { courseId, lesson, items } = await seed();
    const { userId, session } = await learner(courseId);
    await completeEarlier(userId, lesson);

    const started = (await start(lesson.k!, session)).json<LessonSession>();
    // A session saved before #237: one card per kanji, no facet and no position.
    const oldCards = started.teachingCards
      .filter((c) => c.facet === 'meaning')
      .map(({ item, examples }) => ({ item, examples, words: [], strokeAnimation: true }));
    await sql(`UPDATE lesson_sessions SET state = jsonb_set(state, '{teachingCards}', $1::jsonb)`, [
      JSON.stringify(oldCards),
    ]);

    const resumed = await start(lesson.k!, session);
    expect(resumed.statusCode).toBe(200);
    const body = resumed.json<LessonSession>();
    expect(body.id).toBe(started.id);
    expect(body.teachingCards.map((c) => [c.item.id, c.facet, c.before])).toEqual([
      [items['k:休'], null, 0],
      [items['k:本'], null, 0],
    ]);
    const completed = await app.inject({
      method: 'POST',
      url: `/api/v1/lesson-sessions/${body.id}/complete`,
      payload: { responses: body.exercises.map((e) => ({ attempts: [rightAnswer(e)] })) },
      ...session,
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json<{ accuracy: number }>().accuracy).toBe(100);
  });

  it('leaves out drawing for kanji without stroke data, and for learners who turned it off (FR-072, FR-074)', async () => {
    const { courseId, lesson, items } = await seed();
    await sql(`DELETE FROM stroke_data WHERE item_id = $1`, [items['k:本']]);
    const { userId, session } = await learner(courseId);
    await completeEarlier(userId, lesson);

    const body = (await start(lesson.k!, session)).json<LessonSession>();
    const drawing = body.exercises.filter((e) => ['stroke_trace', 'draw_memory'].includes(e.type));
    expect(drawing.map((e) => e.payload.character)).toEqual(['休', '休']);
    expect(body.teachingCards.map((c) => c.strokeAnimation)).toEqual([true, false, false, false]);

    await sql(`UPDATE users SET settings = settings || '{"drawingExercises": false}'`);
    await sql(`DELETE FROM lesson_sessions`);
    const off = (await start(lesson.k!, session)).json<LessonSession>();
    expect(off.exercises.map((e) => e.type)).not.toContain('stroke_trace');
    expect(off.exercises.map((e) => e.type)).not.toContain('draw_memory');
  });

  it('gives completed kanji a meaning and a reading review entry (FR-110)', async () => {
    const { courseId, lesson, items } = await seed();
    const { userId, session } = await learner(courseId);
    await completeEarlier(userId, lesson);
    const started = (await start(lesson.k!, session)).json<LessonSession>();

    const completed = await app.inject({
      method: 'POST',
      url: `/api/v1/lesson-sessions/${started.id}/complete`,
      ...session,
      payload: { responses: started.exercises.map((e) => ({ attempts: [rightAnswer(e)] })) },
    });
    expect(completed.statusCode).toBe(200);
    expect(completed.json<{ accuracy: number }>().accuracy).toBe(100);
    expect(
      await sql(
        `SELECT item_id AS id, facet FROM item_progress WHERE user_id = $1 ORDER BY item_id, facet`,
        [userId],
      ),
    ).toEqual([
      { id: items['k:休'], facet: 'meaning' },
      { id: items['k:休'], facet: 'reading' },
      { id: items['k:本'], facet: 'meaning' },
      { id: items['k:本'], facet: 'reading' },
    ]);
  });

  it('backfills a meaning entry for kanji already in reviews, served in a review session (FR-110)', async () => {
    const { courseId, items } = await seed();
    const { userId, session } = await learner(courseId);
    // Before #53 kanji were reviewed on their reading only; 休み is a learned word using 休.
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       VALUES ($1, $2, 'reading', 3, now() - interval '1 hour'),
              ($1, $3, 'reading', 8, NULL),
              ($1, $4, 'meaning', 2, now() + interval '1 day')`,
      [userId, items['k:休'], items['k:体'], items['w:休み']],
    );

    await backfillReviewFacets(pool());
    await backfillReviewFacets(pool()); // A second run changes nothing.
    const rows = await sql<{ item_id: number; facet: string; stage: number; same_due: boolean }>(
      `SELECT p.item_id, p.facet, p.stage, p.due_at IS NOT DISTINCT FROM r.due_at AS same_due
         FROM item_progress p
         JOIN item_progress r ON r.user_id = p.user_id AND r.item_id = p.item_id
                             AND r.facet = 'reading'
        WHERE p.user_id = $1 AND p.facet = 'meaning' AND p.item_id <> $2
        ORDER BY p.item_id`,
      [userId, items['w:休み']],
    );
    expect(rows).toEqual([
      { item_id: items['k:体'], facet: 'meaning', stage: 8, same_due: true },
      { item_id: items['k:休'], facet: 'meaning', stage: 3, same_due: true },
    ]);
    // The word gained only its own facets (#225: reading), not the kanji's.
    expect(
      await sql(`SELECT facet FROM item_progress WHERE item_id = $1 ORDER BY facet`, [
        items['w:休み'],
      ]),
    ).toEqual([{ facet: 'meaning' }, { facet: 'reading' }]);

    const reviews = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews/sessions',
      ...session,
    });
    expect(reviews.statusCode).toBe(200);
    const exercises = reviews.json<ReviewSession>().exercises;
    const meaning = exercises.find((e) => e.itemId === items['k:休'] && e.facet === 'meaning');
    expect(['choice', 'typed_answer']).toContain(meaning?.type);
    // A kanji's meaning exercise asks for its meaning, never its reading.
    if (meaning?.type === 'typed_answer') {
      expect(meaning.payload).toMatchObject({ answerLanguage: 'base', accept: [{ text: 'rest' }] });
    }
    expect(exercises.find((e) => e.itemId === items['k:休'] && e.facet === 'reading')?.type).toBe(
      'reading_in_context',
    );
  });

  it('backfills a reading entry for words already in reviews, served as a word reading exercise (#225, FR-110)', async () => {
    const { courseId, items } = await seed();
    const { userId, session } = await learner(courseId);
    // Before #225 words were reviewed on their meaning only.
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       VALUES ($1, $2, 'meaning', 3, now() - interval '1 hour'),
              ($1, $3, 'meaning', 8, NULL)`,
      [userId, items['w:休み'], items['w:本']],
    );

    await backfillReviewFacets(pool());
    await backfillReviewFacets(pool()); // A second run changes nothing.
    expect(
      await sql(
        `SELECT p.item_id, p.stage, p.due_at IS NOT DISTINCT FROM m.due_at AS same_due
           FROM item_progress p
           JOIN item_progress m ON m.user_id = p.user_id AND m.item_id = p.item_id
                               AND m.facet = 'meaning'
          WHERE p.user_id = $1 AND p.facet = 'reading'
          ORDER BY p.item_id`,
        [userId],
      ),
    ).toEqual([
      // Seeded in this order, so by id.
      { item_id: items['w:休み'], stage: 3, same_due: true },
      { item_id: items['w:本'], stage: 8, same_due: true },
    ]);

    const reviews = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews/sessions',
      ...session,
    });
    expect(reviews.statusCode).toBe(200);
    const exercises = reviews.json<ReviewSession>().exercises;
    expect(exercises.map((e) => [e.itemId, e.facet])).toEqual([
      [items['w:休み'], 'meaning'],
      [items['w:休み'], 'reading'],
    ]);
    expect(exercises[1]).toMatchObject({
      type: 'typed_answer',
      payload: {
        prompt: 'How do you read 休み?',
        answerLanguage: 'target',
        accept: [{ text: 'やすみ' }],
      },
    });
    // The meaning exercise does not ask for the reading.
    expect(exercises[0]!.payload.prompt).not.toBe('How do you read 休み?');
    const answered = await app.inject({
      method: 'POST',
      url: `/api/v1/review-sessions/${reviews.json<ReviewSession>().id}/answers`,
      ...session,
      payload: { index: 1, response: { attempts: ['yasumi'] } },
    });
    expect(answered.statusCode).toBe(200);
    expect(answered.json<{ correct: boolean }>().correct).toBe(true);
  });

  /** What the session practises for one kanji: draw, meaning and reading exercises, by prompt. */
  function coverage(body: LessonSession, character: string, meaning: string) {
    const prompt = (e: SessionExercise) => String(e.payload.prompt ?? '');
    const about = (e: SessionExercise) =>
      prompt(e).includes(character) || prompt(e).includes(`“${meaning}”`);
    const isKanjiStep = (e: SessionExercise, steps: number[]) =>
      steps.includes(stepOf(e, new Set(payloadItemIds(e.payload))));
    return {
      draw: body.exercises.some(
        (e) => e.type === 'draw_memory' && e.payload.character === character,
      ),
      meaning: body.exercises.some(
        (e) =>
          ['choice', 'typed_answer'].includes(e.type) &&
          e.payload.answerLanguage !== 'target' &&
          !prompt(e).includes(' read') &&
          about(e) &&
          !isKanjiStep(e, [flowIndex('choice:containing')]),
      ),
      reading: body.exercises.some(
        (e) =>
          (e.type === 'reading_in_context' || e.payload.answerLanguage === 'target') &&
          prompt(e).includes(character),
      ),
      trace: body.exercises.some(
        (e) => e.type === 'stroke_trace' && e.payload.character === character,
      ),
    };
  }

  it.each([
    [3, 1],
    [5, 3],
  ])(
    'gives each of %i kanji its draw, a meaning and a reading exercise within 15 (owner decision on #53)',
    async (count, extra) => {
      const { courseId, lesson, items } = await seed(extra);
      const { userId, session } = await learner(courseId);
      await completeEarlier(userId, lesson);

      const body = (await start(lesson.k!, session)).json<LessonSession>();
      const kanjiList: [string, string][] = (
        [
          ['休', 'rest'],
          ['本', 'origin'],
          ['山', 'mountain'],
          ['川', 'river'],
          ['火', 'fire'],
        ] as [string, string][]
      ).slice(0, count);
      expect(body.exercises.length).toBeLessThanOrEqual(15);
      expect(body.exercises.length).toBeGreaterThanOrEqual(10);
      for (const [character, meaning] of kanjiList) {
        expect({ character, ...coverage(body, character, meaning) }).toMatchObject({
          character,
          draw: true,
          meaning: true,
          reading: true,
        });
      }
      const kanjiIds = new Set(kanjiList.map(([c]) => items[`k:${c}`]!));
      const steps = body.exercises.map((e) => stepOf(e, kanjiIds));
      expect(steps).toEqual([...steps].sort((a, b) => a - b));
      const traces = body.exercises.filter((e) => e.type === 'stroke_trace').length;
      if (count === 3) {
        // 9 required; the traces and a word exercise fit too.
        expect(traces).toBe(3);
        expect(
          steps.some(
            (step) =>
              step === flowIndex('choice:containing') ||
              step === flowIndex('match_pairs:containing'),
          ),
        ).toBe(true);
      } else {
        // 15 required: no room for traces or words.
        expect(body.exercises).toHaveLength(15);
        expect(traces).toBe(0);
      }
    },
  );

  it('keeps stored exercises first and puts each in the step it tests', async () => {
    const { courseId, lesson, items } = await seed();
    await sql(
      `INSERT INTO exercises (lesson_id, item_id, key, position, type, payload, origin)
       VALUES ($1, $2, 'r', 0, 'typed_answer', $3, 'authored')`,
      [
        lesson.k,
        items['k:休'],
        {
          prompt: 'Authored: read 休 in 休み',
          answerLanguage: 'target',
          accept: [{ text: 'やす', tiles: [] }],
        },
      ],
    );
    const { userId, session } = await learner(courseId);
    await completeEarlier(userId, lesson);

    const body = (await start(lesson.k!, session)).json<LessonSession>();
    const kanjiIds = new Set([items['k:休']!, items['k:本']!]);
    const at = body.exercises.findIndex((e) => e.payload.prompt === 'Authored: read 休 in 休み');
    expect(at).toBeGreaterThanOrEqual(0);
    const steps = body.exercises.map((e) => stepOf(e, kanjiIds));
    expect(steps).toEqual([...steps].sort((a, b) => a - b));
    // It sits with the reading exercises, after every meaning exercise.
    expect(steps[at]).toBe(flowIndex('typed_answer:reading'));
    // The reading cards still come right before the reading exercises (#237).
    const readingAt = steps.findIndex((step) => step > flowIndex('card:reading'));
    expect(readingAt).toBeLessThanOrEqual(at);
    expect(body.teachingCards.filter((c) => c.facet === 'reading').map((c) => c.before)).toEqual([
      readingAt,
      readingAt,
    ]);
  });

  it('leaves the guided stroke trace out of test-outs (FR-024)', async () => {
    const { courseId } = await seed(3);
    const { session } = await learner(courseId);
    const [unit] = await sql(`SELECT id FROM units`);
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/units/${unit!.id}/test-out`,
      ...session,
    });
    expect(response.statusCode).toBe(200);
    const types = response.json<{ exercises: SessionExercise[] }>().exercises.map((e) => e.type);
    expect(types).not.toContain('stroke_trace');
    expect(types).toContain('draw_memory');
  });

  it("does not review a kanji's meaning with a stored exercise asking its reading (FR-112)", async () => {
    const { courseId, lesson, items } = await seed();
    await sql(
      `INSERT INTO exercises (lesson_id, item_id, key, position, type, payload, origin)
       VALUES ($1, $2, 'r', 0, 'typed_answer', $3, 'pinned')`,
      [
        lesson.k,
        items['k:休'],
        {
          prompt: 'Type the reading of 休 in 休み.',
          answerLanguage: 'target',
          accept: [{ text: 'やす', tiles: [] }],
        },
      ],
    );
    const { userId, session } = await learner(courseId);
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       VALUES ($1, $2, 'meaning', 2, now() - interval '1 hour'),
              ($1, $3, 'meaning', 2, now() + interval '1 day')`,
      [userId, items['k:休'], items['w:休み']],
    );
    for (let run = 0; run < 5; run++) {
      await sql(`DELETE FROM review_sessions`);
      const reviews = await app.inject({
        method: 'POST',
        url: '/api/v1/reviews/sessions',
        ...session,
      });
      expect(reviews.statusCode).toBe(200);
      const [exercise] = reviews.json<ReviewSession>().exercises;
      expect(exercise).toMatchObject({ itemId: items['k:休'], facet: 'meaning' });
      expect(exercise!.payload.answerLanguage).not.toBe('target');
    }
  });
});
