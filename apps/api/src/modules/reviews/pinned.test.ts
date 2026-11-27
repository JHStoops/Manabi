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

// API tests for item-level pins in reviews (issue #241): FR-114, FR-229, SDD section 6. A pin is
// one candidate among the generated exercises of its facet, and takes its own original's place.

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

  /** The exercise a fresh review session serves, with Math.random fixed at `random`. */
  async function served(random: number) {
    await sql(`DELETE FROM review_sessions`);
    jest.spyOn(Math, 'random').mockReturnValue(random);
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

    // Candidates in facet type order: the generated choice, then the pin for the typed answer.
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
    for (const random of [0, 0.25, 0.5, 0.75, 0.99]) seen.push(await served(random));
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

  it('serves a pin whose original the generators no longer make as a candidate of its own', async () => {
    const stale = { ...typedPayload('ja:word:mizu', ['water', 'aqua']), prompt: 'Old prompt' };
    await pin(stale);

    // Candidates: the choice, the generated typed answer (not this pin's original), the pin.
    expect((await served(0)).type).toBe('choice');
    expect(await served(0.5)).toEqual({
      type: 'typed_answer',
      payload: typedPayload('ja:word:mizu', ['water']),
    });
    expect(await served(0.99)).toEqual({ type: 'typed_answer', payload: stale });
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
});
