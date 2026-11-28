import { expect } from '@playwright/test';
import type { Page, TestInfo } from '@playwright/test';
import pg from 'pg';
import type { LessonSession } from '@manabi/core';

// Shared by the end-to-end specs: a learner made from an invite, an exercise answerer driven by
// the session payload, and direct database access for what the UI cannot do (time travel).

/** Test-only value; every learner is created from an invite. */
export const LEARNER_PASSWORD = 'e2e-learner-pw-7c1d4f';

/**
 * A username that is unique per spec, project and run, so specs sharing the database never
 * collide, also with `--repeat-each`.
 */
export function uniqueUsername(spec: string, testInfo: TestInfo): string {
  const run = `${Date.now().toString(36)}${testInfo.repeatEachIndex}`;
  return `e2e-${spec}-${testInfo.project.name}-${run}`;
}

/** FR-001: the admin creates an invite; the invitee accepts it and ends up signed in. */
export async function createLearner(page: Page, username: string) {
  await page.goto('/sign-in');
  await page.getByLabel('Username or email').fill('e2eadmin');
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin' }).click();
  await page.getByRole('button', { name: 'Create invite' }).click();
  const link = await page.getByLabel('Invite link').inputValue();

  // The invitee has no session of their own.
  await page.context().clearCookies();
  await page.goto(new URL(link).pathname);
  await page.getByLabel('Username').fill(username);
  await page.getByLabel('Display name').fill('E2E Learner');
  await page.getByLabel('Password', { exact: true }).fill(LEARNER_PASSWORD);
  await page.getByLabel('Confirm password').fill(LEARNER_PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();
}

/** The parts of an exercise the answerer reads (a subset of `LessonSession['exercises'][number]`). */
export interface AnswerableExercise {
  type: string;
  payload: unknown;
}

/** Answers the exercise on screen correctly, from its payload in the session, up to Continue. */
export async function answer(page: Page, exercise: AnswerableExercise) {
  const payload = exercise.payload as {
    prompt?: string;
    options?: unknown[];
    correct?: number;
    accept?: { text: string }[];
    pairs?: { term: string; match: string }[];
  };
  if (exercise.type === 'choice') {
    // The renderer loads lazily; keys pressed before it mounts are lost.
    await expect(page.getByRole('group', { name: payload.prompt })).toBeVisible();
    await page.keyboard.press(String(payload.correct! + 1));
  } else if (exercise.type === 'typed_answer') {
    // shortcut: types the first accepted answer as is; a kana-field exercise would need romaji.
    await page.getByRole('textbox').fill(payload.accept![0]!.text);
  } else if (exercise.type === 'match_pairs') {
    for (const { term, match } of payload.pairs!) {
      await page.getByRole('button', { name: term, exact: true }).click();
      await page.getByRole('button', { name: match, exact: true }).click();
    }
  } else {
    throw new Error(`No e2e answer for exercise type ${exercise.type}`);
  }
  await page.getByRole('button', { name: 'Check' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Correct!' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue' }).click();
}

/** Runs `use` with a client of the scratch database (E2E_DATABASE_URL, as in resetDb.mjs). */
export async function withDb<T>(use: (db: pg.Client) => Promise<T>): Promise<T> {
  const url = process.env.E2E_DATABASE_URL;
  if (!url) throw new Error('Set E2E_DATABASE_URL to the scratch database.');
  const db = new pg.Client({ connectionString: url });
  await db.connect();
  try {
    return await use(db);
  } finally {
    await db.end();
  }
}

/**
 * Time travel for a review test: every facet the learner has in progress becomes due a day ago,
 * the oldest first (one minute apart per item), without waiting for the real intervals.
 * Returns the number of facets moved.
 */
export function makeAllDue(username: string): Promise<number> {
  return withDb(async (db) => {
    const { rowCount } = await db.query(
      `UPDATE item_progress p
          SET due_at = now() - interval '1 day' - make_interval(mins => p.item_id::int)
         FROM users u
        WHERE u.id = p.user_id AND u.username = $1 AND p.stage < 8`,
      [username],
    );
    return rowCount ?? 0;
  });
}

/** Opens a lesson from the Learn tab and returns its session (the response to starting it). */
export async function openLesson(page: Page, buttonName: RegExp): Promise<LessonSession> {
  const sessionResponse = page.waitForResponse(
    (r) => /\/lessons\/\d+\/sessions$/.test(r.url()) && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: buttonName }).click();
  return (await (await sessionResponse).json()) as LessonSession;
}

/** Steps through a lesson's teaching cards, then answers every exercise right (as listed). */
export async function playLesson(page: Page, session: LessonSession) {
  await page.getByRole('button', { name: 'Start' }).click();
  for (const [i] of session.teachingCards.entries()) {
    await expect(
      page.getByRole('heading', { name: new RegExp(`^New item ${i + 1} of`) }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next', exact: true }).click();
  }
  for (const exercise of session.exercises) await answer(page, exercise);
}

// Every test signs the admin in once to make its invite, and the API allows 10 login attempts
// per 15 minutes (NFR-12), counting the successful ones. A run uses 2 per spec (desktop and
// mobile), so a fifth spec, or --repeat-each against one server, needs a shared admin session.

/** One stroke of a character as Hanzi Writer data: its median, in a 1024 x 1024 space, y up. */
export type Median = Array<[number, number]>;

/** Hanzi Writer's drawing area is 300 px square with 16 px of padding (StrokeCanvas.tsx). */
const CANVAS_SIZE = 300;
const CANVAS_PADDING = 16;

/**
 * FR-072, IF-11: a stroke as the points a hand would produce on the canvas, in page coordinates.
 * Hanzi Writer's data runs in a 1024 square with y up and its top at y = 900, drawn inside the
 * padding; the points are the median's own, a few dozen per stroke.
 */
export function strokePath(
  median: Median,
  canvas: { x: number; y: number },
): { x: number; y: number }[] {
  const scale = (CANVAS_SIZE - 2 * CANVAS_PADDING) / 1024;
  const toPage = ([x, y]: [number, number]) => ({
    x: canvas.x + CANVAS_PADDING + x * scale,
    y: canvas.y + CANVAS_PADDING + (900 - y) * scale,
  });
  return median.map(toPage);
}

/** The stroke data of a kanji, as the app loads it. */
export async function loadMedians(page: Page, itemKey: string): Promise<Median[]> {
  const response = await page.request.get(`/api/v1/media/strokes/${encodeURIComponent(itemKey)}`);
  expect(response.ok()).toBe(true);
  return ((await response.json()) as { medians: Median[] }).medians;
}

/**
 * Draws one stroke with a synthetic pointer: a mouse on desktop, touch events (through the
 * Chrome DevTools protocol, which Playwright's own touchscreen cannot do for a drag) on mobile.
 */
export async function drawStroke(
  page: Page,
  path: { x: number; y: number }[],
  input: 'mouse' | 'touch',
) {
  if (input === 'mouse') {
    await page.mouse.move(path[0]!.x, path[0]!.y);
    await page.mouse.down();
    for (const point of path.slice(1)) await page.mouse.move(point.x, point.y);
    await page.mouse.up();
    return;
  }
  const cdp = await page.context().newCDPSession(page);
  const touch = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    points: { x: number; y: number }[],
  ) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points });
  await touch('touchStart', [path[0]!]);
  for (const point of path.slice(1)) await touch('touchMove', [point]);
  await touch('touchEnd', []);
  await cdp.detach();
}

/** FR-165: achievements unlocked by a lesson are each celebrated once over its results, in order. */
export async function dismissAchievements(page: Page, titles: string[]) {
  for (const title of titles) {
    await expect(page.getByRole('dialog', { name: title })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/** The achievements the fixture's first kana lesson unlocks when answered perfectly. */
export const FIRST_LESSON_ACHIEVEMENTS = ['Kana complete', 'First perfect lesson'];
