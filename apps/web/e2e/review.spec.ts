import { expect, test } from '@playwright/test';
import type { ReviewSession } from '@manabi/core';
import {
  answer,
  dismissAchievements,
  FIRST_LESSON_ACHIEVEMENTS,
  createLearner,
  makeAllDue,
  openLesson,
  playLesson,
  uniqueUsername,
  withDb,
} from './helpers';

// FR-114, FR-113, FR-112, FR-117: after the first kana lesson its items are due once time has
// passed (the test moves due_at into the past); the Review tab shows how many, the session is
// played to the end with every answer saved as it is given, and the items move up a stage.
// Runs in the desktop and mobile projects (playwright.config.ts).

test('review session after the first lesson', async ({ page }, testInfo) => {
  const username = uniqueUsername('review', testInfo);
  await createLearner(page, username);
  await page.getByRole('button', { name: 'Enroll in Japanese for English speakers' }).click();
  const lesson = await openLesson(page, /Kana lesson, available/);
  await playLesson(page, lesson);
  await dismissAchievements(page, FIRST_LESSON_ACHIEVEMENTS);
  await page.getByRole('link', { name: 'Done' }).click();

  // FR-113: the lesson's items are not due yet.
  const reviewTab = page.getByRole('navigation', { name: 'Main' }).getByRole('link', {
    name: 'Review',
  });
  await reviewTab.click();
  await expect(page.getByText('Due now: 0')).toBeVisible();
  await expect(page.getByText('Nothing is due right now.')).toBeVisible();

  // Time travel: every facet the lesson started is now due.
  const due = await makeAllDue(username);
  expect(due).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByText(`Due now: ${due}`)).toBeVisible();

  const stages = () =>
    withDb(async (db) => {
      const { rows } = await db.query<{ facet: string; stage: number }>(
        `SELECT p.item_id || ':' || p.facet AS facet, p.stage
           FROM item_progress p JOIN users u ON u.id = p.user_id
          WHERE u.username = $1 ORDER BY p.item_id, p.facet`,
        [username],
      );
      return new Map(rows.map((r) => [r.facet, r.stage]));
    });
  const stagesBefore = await stages();
  expect(stagesBefore.size).toBe(due);

  const sessionResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/reviews/sessions') && r.request().method() === 'POST',
  );
  await page.getByRole('link', { name: 'Start review' }).click();
  const session = (await (await sessionResponse).json()) as ReviewSession;
  // FR-114: at most 20 items, one exercise per due facet.
  expect(session.exercises.length).toBeGreaterThan(0);
  await expect(page.getByText(`Questions: ${session.exercises.length}`)).toBeVisible();

  // FR-114: each answer is saved as it is given, so the review log grows with every Continue.
  const logged = () =>
    withDb(async (db) => {
      const { rows } = await db.query<{ n: string }>(
        `SELECT count(*) AS n FROM review_log l JOIN users u ON u.id = l.user_id
          WHERE u.username = $1`,
        [username],
      );
      return Number(rows[0]!.n);
    });
  const before = await logged();
  await page.getByRole('button', { name: 'Start' }).click();
  for (const [i, exercise] of session.exercises.entries()) {
    await answer(page, exercise);
    await expect.poll(logged).toBe(before + i + 1);
  }

  await expect(page.getByRole('heading', { name: 'Review complete' })).toBeVisible();
  await expect(page.getByText('Accuracy 100%')).toBeVisible();
  await expect(page.getByText(/^\+\d+ XP$/)).toBeVisible();

  // FR-112: every item answered right moved up exactly one stage and is no longer due.
  const after = await stages();
  expect([...after.keys()]).toEqual([...stagesBefore.keys()]);
  for (const [facet, stage] of after) expect(stage, facet).toBe(stagesBefore.get(facet)! + 1);
  await page.goto('/review');
  await expect(page.getByText('Due now: 0')).toBeVisible();
});
