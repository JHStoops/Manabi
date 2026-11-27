import type { FastifyInstance } from 'fastify';
import type { ExerciseGenerator, LanguagePlugin, ReviewSession } from '@manabi/core';
import type * as Core from '@manabi/core';
import type * as LangJa from '@manabi/lang-ja';
import { query } from '../../db/db';
import { testApp } from '../../test/app';
import type { TestApp } from '../../test/app';
import { describeWithDb, useTestDatabase } from '../../test/db';
import { seedUser } from '../../test/fixtures';
import { SESSION_COOKIE } from '../auth/guard';
import { hashPassword } from '../auth/passwords';

// API tests for pins in reviews (issues #241, #254, #255): FR-114, FR-229, SDD section 6. A pin
// (item level, or in a lesson that teaches only the item) is one candidate among the generated
// exercises of its facet, and takes the place of the generated original it was pinned from.

// Japanese, where a word's one facet is reviewed by a choice or a typed answer, one of each.
jest.mock('../../plugins', () => {
  const core = jest.requireActual<typeof Core>('@manabi/core');
  const { japanese } = jest.requireActual<typeof LangJa>('@manabi/lang-ja');
  const choice: ExerciseGenerator = (item) => [
    { type: 'choice', payload: { prompt: item.key, options: ['a', 'b'] } },
  ];
  const typed: ExerciseGenerator = (item) => [
    {
      type: 'typed_answer',
      payload: {
        prompt: `Meaning of ${item.key}`,
        answerLanguage: 'base',
        accept: [{ text: 'water', tiles: [] }],
      },
    },
  ];
  const ja: LanguagePlugin = {
    ...japanese,
    generators: { choice, typed_answer: typed },
    reviewFacets: (type): Record<string, string[]> =>
      type === 'word' ? { meaning: ['choice', 'typed_answer'] } : {},
    testsFacet: () => true,
  };
  return { languagePlugins: core.createLanguagePluginRegistry([ja]) };
});

const PASSWORD = 'correct horse battery';

/** The generated typed answer for `key` with `accept` as its answers. */
const typedPayload = (key: string, accept: string[]) => ({
  prompt: `Meaning of ${key}`,
  answerLanguage: 'base',
  accept: accept.map((text) => ({ text, tiles: [] })),
});

describeWithDb('item-level pins in reviews (#241)', () => {
  const pool = useTestDatabase();
  let current: TestApp | undefined;
  let app: FastifyInstance;
  let itemId: number;
  let courseId: number;
  let session: { cookies: Record<string, string>; headers: Record<string, string> };

  const sql = <R extends object = { id: number }>(text: string, params: unknown[] = []) =>
    query<R>(pool(), text, params);

  beforeEach(async () => {
    current = await testApp({ pool: pool() });
    app = current.app;
    const [course] = await sql(
      `INSERT INTO courses (key, target_lang, base_lang, plugin, title, status)
       VALUES ('ja-en', 'ja', 'en', 'ja', 'Japanese', 'published') RETURNING id`,
    );
    const [item] = await sql(
      `INSERT INTO items (course_id, key, type, level_code)
       VALUES ($1, 'ja:word:mizu', 'word', 'N5') RETURNING id`,
      [course!.id],
    );
    itemId = item!.id;
    courseId = course!.id;
    const user = await seedUser(pool(), {
      username: 'aiko',
      passwordHash: await hashPassword(PASSWORD),
    });
    await sql(`INSERT INTO enrollments (user_id, course_id) VALUES ($1, $2)`, [
      user.id,
      course!.id,
    ]);
    await sql(
      `INSERT INTO item_progress (user_id, item_id, facet, stage, due_at)
       VALUES ($1, $2, 'meaning', 2, now() - interval '1 hour')`,
      [user.id, itemId],
    );
    const login = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { identifier: 'aiko', password: PASSWORD },
    });
    session = {
      cookies: { [SESSION_COOKIE]: login.cookies.find((c) => c.name === SESSION_COOKIE)!.value },
      headers: { origin: 'http://localhost:3000' },
    };
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await current?.close();
    current = undefined;
  });

  const pin = (payload: object) =>
    sql(`INSERT INTO exercises (item_id, type, payload, origin) VALUES ($1, $2, $3, 'pinned')`, [
      itemId,
      'typed_answer',
      payload,
    ]);

  /** A pin made from the generated `original`, as accepting a report records it (#254). */
  const pinFrom = (original: object, payload: object, at: { lessonId?: number } = {}) =>
    sql(
      `INSERT INTO exercises (item_id, lesson_id, type, payload, origin, original_payload)
       VALUES ($1, $2, 'typed_answer', $3, $4, $5::jsonb - 'accept')`,
      [at.lessonId ? null : itemId, at.lessonId ?? null, payload, 'pinned', original],
    );

  /** A published lesson teaching `items` (by id), in a new section and unit. */
  async function lesson(key: string, items: number[]): Promise<number> {
    const [section] = await sql(
      `INSERT INTO sections (course_id, key, position, title, level_code)
       VALUES ($1, $2, (SELECT count(*) FROM sections), 'S', 'N5') RETURNING id`,
      [courseId, `${key}:s`],
    );
    const [unit] = await sql(
      `INSERT INTO units (section_id, key, position, title, status)
       VALUES ($1, $2, 0, 'U', 'published') RETURNING id`,
      [section!.id, `${key}:u`],
    );
    const [row] = await sql(
      `INSERT INTO lessons (unit_id, key, position, type, title, status)
       VALUES ($1, $2, 0, 'vocabulary', 'L', 'published') RETURNING id`,
      [unit!.id, key],
    );
    for (const [position, id] of items.entries())
      await sql(`INSERT INTO lesson_items (lesson_id, item_id, position) VALUES ($1, $2, $3)`, [
        row!.id,
        id,
        position,
      ]);
    return row!.id;
  }

  /**
   * The exercise a fresh review session serves when Math.random picks the type slot with `slot`,
   * then the exercise within it with `within` (and 0 after that).
   */
  async function served(slot: number, within = 0) {
    await sql(`DELETE FROM review_sessions`);
    jest
      .spyOn(Math, 'random')
      .mockReturnValueOnce(slot)
      .mockReturnValueOnce(within)
      .mockReturnValue(0);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/reviews/sessions',
      ...session,
    });
    jest.restoreAllMocks();
    expect(response.statusCode).toBe(200);
    const { exercises } = response.json<ReviewSession>();
    expect(exercises).toHaveLength(1);
    return { type: exercises[0]!.type, payload: exercises[0]!.payload };
  }

  it('still serves the other exercise types for the facet after a pin', async () => {
    await pin(typedPayload('ja:word:mizu', ['water', 'aqua']));

    // Slots in facet type order: the generated choice, then the pin for the typed answer.
    expect(await served(0)).toEqual({
      type: 'choice',
      payload: { prompt: 'ja:word:mizu', options: ['a', 'b'] },
    });
    expect(await served(0.99)).toEqual({
      type: 'typed_answer',
      payload: typedPayload('ja:word:mizu', ['water', 'aqua']),
    });
  });

  it('serves the pin in place of its own original, never both', async () => {
    await pin(typedPayload('ja:word:mizu', ['water', 'aqua']));
    const seen = [];
    for (const slot of [0, 0.5, 0.99])
      for (const within of [0, 0.99]) seen.push(await served(slot, within));
    const typed = seen.filter((e) => e.type === 'typed_answer');
    expect(typed.length).toBeGreaterThan(0);
    // The original's accept list (only 'water') is never served while the pin exists.
    for (const e of typed)
      expect(e.payload).toEqual(typedPayload('ja:word:mizu', ['water', 'aqua']));
  });

  it('keeps serving the generated original when there is no pin', async () => {
    expect(await served(0.99)).toEqual({
      type: 'typed_answer',
      payload: typedPayload('ja:word:mizu', ['water']),
    });
  });

  it("serves a pin whose original is no longer generated within its type's slot", async () => {
    const stale = { ...typedPayload('ja:word:mizu', ['water', 'aqua']), prompt: 'Old prompt' };
    await pin(stale);

    // Slots: [choice], [the generated typed answer (not this pin's original), the pin].
    expect((await served(0, 0.99)).type).toBe('choice');
    expect(await served(0.5, 0)).toEqual({
      type: 'typed_answer',
      payload: typedPayload('ja:word:mizu', ['water']),
    });
    expect(await served(0.5, 0.99)).toEqual({ type: 'typed_answer', payload: stale });
  });

  it('keeps one slot per type however many pins a type has', async () => {
    await pin(typedPayload('ja:word:mizu', ['water', 'aqua']));
    for (const prompt of ['Old prompt 1', 'Old prompt 2', 'Old prompt 3'])
      await pin({ ...typedPayload('ja:word:mizu', ['water', 'aqua']), prompt });

    // The choice keeps half the slots: any `within` in the first half of the slot draw.
    for (const within of [0, 0.5, 0.99]) expect((await served(0.49, within)).type).toBe('choice');
    // The typed slot holds the matched pin first, then the three stale pins.
    expect(await served(0.5, 0)).toEqual({
      type: 'typed_answer',
      payload: typedPayload('ja:word:mizu', ['water', 'aqua']),
    });
    expect((await served(0.5, 0.99)).payload).toMatchObject({ prompt: 'Old prompt 3' });
  });

  it('still prefers an authored stored exercise over generated ones and pins', async () => {
    await pin(typedPayload('ja:word:mizu', ['water', 'aqua']));
    const authored = typedPayload('ja:word:mizu', ['water', 'H2O']);
    authored.prompt = 'Authored prompt';
    await sql(
      `INSERT INTO exercises (item_id, type, payload, origin) VALUES ($1, 'typed_answer', $2, 'authored')`,
      [itemId, authored],
    );
    for (const random of [0, 0.99]) {
      expect(await served(random)).toEqual({ type: 'typed_answer', payload: authored });
    }
  });

  it('keeps an edited pin in place of its recorded original (#254)', async () => {
    const original = typedPayload('ja:word:mizu', ['water']);
    const edited = { ...typedPayload('ja:word:mizu', ['water', 'aqua']), prompt: 'Fixed prompt' };
    await pinFrom(original, edited);

    // Slots: [choice], [the pin alone]: its generated original is never served next to it.
    for (const within of [0, 0.99]) {
      expect(await served(0.99, within)).toEqual({ type: 'typed_answer', payload: edited });
      expect((await served(0, within)).type).toBe('choice');
    }
  });

  it('treats a pin in a single-item lesson as one candidate, like an item-level pin (#255)', async () => {
    const lessonId = await lesson('ja-en:mizu', [itemId]);
    const pinned = typedPayload('ja:word:mizu', ['water', 'aqua']);
    await pinFrom(typedPayload('ja:word:mizu', ['water']), pinned, { lessonId });

    // The other type is still served, and the pin replaces its own original in its slot.
    expect(await served(0)).toEqual({
      type: 'choice',
      payload: { prompt: 'ja:word:mizu', options: ['a', 'b'] },
    });
    for (const within of [0, 0.99])
      expect(await served(0.99, within)).toEqual({ type: 'typed_answer', payload: pinned });
  });

  it('still always serves an authored exercise of a single-item lesson (#255)', async () => {
    const lessonId = await lesson('ja-en:mizu', [itemId]);
    await pinFrom(
      typedPayload('ja:word:mizu', ['water']),
      typedPayload('ja:word:mizu', ['water', 'aqua']),
      { lessonId },
    );
    const authored = { ...typedPayload('ja:word:mizu', ['water', 'H2O']), prompt: 'Authored' };
    await sql(
      `INSERT INTO exercises (lesson_id, type, payload, origin) VALUES ($1, 'typed_answer', $2, 'authored')`,
      [lessonId, authored],
    );
    for (const random of [0, 0.5, 0.99])
      expect(await served(random)).toEqual({ type: 'typed_answer', payload: authored });
  });

  it('ignores pins of a lesson that teaches more than one item (#255)', async () => {
    const [other] = await sql(
      `INSERT INTO items (course_id, key, type, level_code)
       VALUES ($1, 'ja:word:yama', 'word', 'N5') RETURNING id`,
      [courseId],
    );
    const lessonId = await lesson('ja-en:two', [itemId, other!.id]);
    await pinFrom(
      typedPayload('ja:word:mizu', ['water']),
      typedPayload('ja:word:mizu', ['water', 'aqua']),
      { lessonId },
    );
    for (const within of [0, 0.99])
      expect(await served(0.99, within)).toEqual({
        type: 'typed_answer',
        payload: typedPayload('ja:word:mizu', ['water']),
      });
  });

  it('counts an edited pin once in its slot (#254)', async () => {
    const edited = { ...typedPayload('ja:word:mizu', ['water', 'aqua']), prompt: 'Fixed prompt' };
    await pinFrom(typedPayload('ja:word:mizu', ['water']), edited);
    const stale = { ...typedPayload('ja:word:mizu', ['water', 'H2O']), prompt: 'Old prompt' };
    await pin(stale);

    // The typed slot is [edited pin, stale pin]: each half of the draw, not two thirds to one.
    expect(await served(0.99, 0.49)).toEqual({ type: 'typed_answer', payload: edited });
    expect(await served(0.99, 0.5)).toEqual({ type: 'typed_answer', payload: stale });
  });

  it('serves two pins of one original as one, with both accept lists (#254, #255)', async () => {
    const lessonId = await lesson('ja-en:mizu', [itemId]);
    const original = typedPayload('ja:word:mizu', ['water']);
    await pinFrom(original, typedPayload('ja:word:mizu', ['water', 'aqua']), { lessonId });
    await pinFrom(original, typedPayload('ja:word:mizu', ['water', 'H2O']));
    for (const within of [0, 0.99])
      expect(await served(0.99, within)).toEqual({
        type: 'typed_answer',
        payload: typedPayload('ja:word:mizu', ['water', 'aqua', 'H2O']),
      });
  });
});
