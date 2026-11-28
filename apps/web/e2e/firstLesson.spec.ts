import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { LessonSession } from '@manabi/core';

// NFR-32, FR-001, FR-051: an admin invites, the invitee accepts, enrolls and finishes the first
// kana lesson of the fixture pack, then sees XP on the results and the streak on the Learn tab.
// Runs in the desktop and mobile projects (playwright.config.ts).

// Test-only value; the learner is created from the invite (one per project, sharing the database).
const PASSWORD = 'e2e-learner-pw-7c1d4f';
const FLOW_BUDGET_MS = 60_000;

/** Answers the exercise on screen correctly, from its payload in the lesson session. */
async function answer(page: Page, exercise: LessonSession['exercises'][number]) {
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

test('invite to first lesson', async ({ page }, testInfo) => {
  // FR-001: the admin creates an invite and copies its link.
  await page.goto('/sign-in');
  await page.getByLabel('Username or email').fill('e2eadmin');
  await page.getByLabel('Password').fill(process.env.E2E_ADMIN_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.getByRole('navigation', { name: 'Main' }).getByRole('link', { name: 'Admin' }).click();
  await page.getByRole('button', { name: 'Create invite' }).click();
  const link = await page.getByLabel('Invite link').inputValue();

  // The invitee has no session of their own.
  await page.context().clearCookies();
  const started = Date.now();
  await page.goto(new URL(link).pathname);
  await page.getByLabel('Username').fill(`e2e-${testInfo.project.name}`);
  await page.getByLabel('Display name').fill('E2E Learner');
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Create account' }).click();

  await page.getByRole('button', { name: 'Enroll in Japanese for English speakers' }).click();
  const sessionResponse = page.waitForResponse(
    (r) => /\/lessons\/\d+\/sessions$/.test(r.url()) && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Kana lesson, available/ }).click();
  const session = (await (await sessionResponse).json()) as LessonSession;

  await page.getByRole('button', { name: 'Start' }).click();
  for (const [i] of session.teachingCards.entries()) {
    await expect(
      page.getByRole('heading', { name: new RegExp(`^New item ${i + 1} of`) }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Next' }).click();
  }
  // Every answer is right, so the exercises come in session order.
  for (const exercise of session.exercises) await answer(page, exercise);

  // FR-051, FR-160: the results show the XP earned.
  await expect(page.getByText(/^\+\d+ XP$/)).toBeVisible();
  await expect(page.getByText('Accuracy 100%')).toBeVisible();
  expect(Date.now() - started).toBeLessThan(FLOW_BUDGET_MS);

  // FR-165: the fixture's only kana lesson, done perfectly, unlocks two achievements, each
  // celebrated once over the results.
  for (const title of ['Kana complete', 'First perfect lesson']) {
    await expect(page.getByRole('dialog', { name: title })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // FR-051, FR-161: the first lesson of the day starts a one-day streak.
  await page.getByRole('link', { name: 'Done' }).click();
  await expect(page.getByLabel('1 day streak')).toBeVisible();
});
