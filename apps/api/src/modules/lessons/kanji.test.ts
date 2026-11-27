import type { FastifyInstance } from 'fastify';
import { KANJI_LESSON_FLOW, getExerciseType, payloadItemIds } from '@manabi/core';
import type { LessonSession, ReviewSession, SessionExercise } from '@manabi/core';
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

/** The flow step an exercise of the kanji lesson belongs to (Product Spec section 5). */
function stepOf(e: SessionExercise, kanjiIds: Set<number>): number {
  const ids = payloadItemIds(e.payload);
  const step = (type: string, test: (s: (typeof KANJI_LESSON_FLOW)[number]) => boolean) =>
    KANJI_LESSON_FLOW.findIndex((s) => s.type === type && test(s));
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
   * A Japanese N5 unit: a vocabulary lesson (休み, 本, 日本 and three more), a kanji lesson teaching 体, 木, 雨
   * and 電 (distractors), then the kanji lesson under test teaching 休 and 本, which the words
   * contain. Every kanji has stroke data.
   */
  async function seed() {
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
    for (const step of [1, 3, 5]) expect(steps).toContain(step);
  });

  it("shows each kanji's words and stroke animation on its teaching card (Product Spec 5)", async () => {
    const { courseId, lesson, items } = await seed();
    const { userId, session } = await learner(courseId);
    await completeEarlier(userId, lesson);

    const body = (await start(lesson.k!, session)).json<LessonSession>();
    expect(
      body.teachingCards.map((c) => ({
        item: c.item.id,
        words: c.words.map((w) => w.id),
        strokeAnimation: c.strokeAnimation,
      })),
    ).toEqual([
      { item: items['k:休'], words: [items['w:休み']], strokeAnimation: true },
      { item: items['k:本'], words: [items['w:本'], items['w:日本']], strokeAnimation: true },
    ]);
  });

  it('leaves out drawing for kanji without stroke data, and for learners who turned it off (FR-072, FR-074)', async () => {
    const { courseId, lesson, items } = await seed();
    await sql(`DELETE FROM stroke_data WHERE item_id = $1`, [items['k:本']]);
    const { userId, session } = await learner(courseId);
    await completeEarlier(userId, lesson);

    const body = (await start(lesson.k!, session)).json<LessonSession>();
    const drawing = body.exercises.filter((e) => ['stroke_trace', 'draw_memory'].includes(e.type));
    expect(drawing.map((e) => e.payload.character)).toEqual(['休', '休']);
    expect(body.teachingCards.map((c) => c.strokeAnimation)).toEqual([true, false]);

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
        WHERE p.user_id = $1 AND p.facet = 'meaning'
        ORDER BY p.item_id`,
      [userId],
    );
    expect(rows).toEqual([
      { item_id: items['k:体'], facet: 'meaning', stage: 8, same_due: true },
      { item_id: items['k:休'], facet: 'meaning', stage: 3, same_due: true },
    ]);
    // The word gained no facet it does not have.
    expect(
      await sql(`SELECT facet FROM item_progress WHERE item_id = $1`, [items['w:休み']]),
    ).toEqual([{ facet: 'meaning' }]);

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
});
