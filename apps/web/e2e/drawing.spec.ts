import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { LessonSession } from '@manabi/core';
import {
  answer,
  createLearner,
  drawStroke,
  loadMedians,
  openLesson,
  playLesson,
  strokePath,
  uniqueUsername,
} from './helpers';

// FR-072, FR-044, FR-073: the first kanji lesson, whose EX-11 (stroke trace) and EX-12 (draw from
// memory) exercises are drawn with synthetic pointer input: a mouse in the desktop project and
// touch events in the mobile one (IF-11). Wrong strokes are refused (order and direction); right
// ones complete the exercise. The stroke paths are generated from the fixture's stroke data.

const MISTAKE = 'Not that stroke. Try again.';

/** The kanji's strokes as page coordinates, from the data the app loads for its canvas. */
async function strokesOnScreen(page: Page, itemKey: string, canvasName: string) {
  const medians = await loadMedians(page, itemKey);
  const svg = page.getByRole('img', { name: canvasName }).locator('svg');
  await expect(svg).toBeVisible();
  const box = (await svg.boundingBox())!;
  return medians.map((median) => strokePath(median, box));
}

test('draw kanji by tracing and from memory', async ({ page, isMobile }, testInfo) => {
  const input = isMobile ? 'touch' : 'mouse';
  await createLearner(page, uniqueUsername('drawing', testInfo));
  await page.getByRole('button', { name: 'Enroll in Japanese for English speakers' }).click();
  // The kanji lesson unlocks with the first kana lesson.
  await playLesson(page, await openLesson(page, /Kana lesson, available/));
  await page.getByRole('link', { name: 'Done' }).click();

  // IF-11: count the raw events, to prove each project drew with its own kind of pointer.
  await page.evaluate(() => {
    const w = window as unknown as { pointerEvents: Record<string, number> };
    w.pointerEvents = { mousedown: 0, touchstart: 0 };
    for (const type of ['mousedown', 'touchstart']) {
      document.addEventListener(type, () => w.pointerEvents[type]!++, true);
    }
  });

  const session: LessonSession = await openLesson(page, /Kanji lesson, available/);
  await page.getByRole('button', { name: 'Start' }).click();
  // The canvas's own status line (the player has a live region of its own).
  const status = page.locator('p[role="status"]');
  let mistakesTried = 0;

  for (const [i, exercise] of session.exercises.entries()) {
    // Product Spec section 5: the kanji's cards come before their exercises (`before`).
    for (const card of session.teachingCards) {
      if (card.before !== i) continue;
      const character = (card.item.data as { character: string }).character;
      await expect(
        page.getByRole('heading', {
          name: card.facet === 'reading' ? `How to read ${character}` : /^New item \d+ of/,
        }),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Next', exact: true }).click();
    }
    if (exercise.type !== 'stroke_trace' && exercise.type !== 'draw_memory') {
      await answer(page, exercise);
      continue;
    }

    const { itemKey, character } = exercise.payload as { itemKey: string; character: string };
    const trace = exercise.type === 'stroke_trace';
    const strokes = await strokesOnScreen(
      page,
      itemKey,
      trace ? `Drawing area for ${character}` : 'Drawing area',
    );
    if (strokes.length > 1 && mistakesTried < 2) {
      // FR-072: the second stroke drawn first is out of order, and the first stroke drawn
      // backwards runs the wrong way; both are refused and the exercise stays open.
      await drawStroke(page, strokes[1]!, input);
      await expect(status).toHaveText(MISTAKE);
      await drawStroke(page, [...strokes[0]!].reverse(), input);
      await expect(status).toHaveText(MISTAKE);
      mistakesTried++;
    }
    for (const [s, stroke] of strokes.entries()) {
      await drawStroke(page, stroke, input);
      // FR-073: memory mode keeps the stroke count to itself; trace shows the progress.
      if (trace && s < strokes.length - 1) {
        await expect(status).toHaveText(`Stroke ${s + 1} of ${strokes.length}`);
      }
    }
    await expect(status).toHaveText('All strokes done');
    await page.getByRole('button', { name: 'Check' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
  }

  const events = await page.evaluate(
    () => (window as unknown as { pointerEvents: Record<string, number> }).pointerEvents,
  );
  expect(isMobile ? events.touchstart : events.mousedown).toBeGreaterThan(0);

  await expect(page.getByText(/^\+\d+ XP$/)).toBeVisible();
  await page.getByRole('link', { name: 'Done' }).click();
  await expect(page.getByRole('button', { name: /Kanji lesson, (completed|done)/i })).toBeVisible();
});
