import { expect, test } from '@playwright/test';

// NFR-60: the production build requests nothing from other hosts. IF-03: tabs are at least 44 px.
for (const viewport of [
  { width: 360, height: 740 },
  { width: 1280, height: 800 },
]) {
  test(`app shell at ${viewport.width} px stays on its own origin`, async ({ page, baseURL }) => {
    const foreign: string[] = [];
    page.on('request', (request) => {
      if (new URL(request.url()).origin !== baseURL) foreign.push(request.url());
    });
    // No API runs here: answer the session request with a signed-in learner.
    await page.route('**/api/v1/me', (route) =>
      route.fulfill({ json: { role: 'learner', displayName: 'Test' } }),
    );
    await page.setViewportSize(viewport);
    await page.goto('/');

    const tabs = page.getByRole('navigation', { name: 'Main' }).getByRole('link');
    await expect(tabs).toHaveCount(5);
    for (const tab of await tabs.all()) {
      const box = await tab.boundingBox();
      expect(box?.width).toBeGreaterThanOrEqual(44);
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }
    await page.keyboard.press('Tab');
    await expect(tabs.first()).toBeFocused();
    await expect(page.getByRole('heading', { name: 'Learn' })).toBeVisible();
    expect(foreign).toEqual([]);
  });
}
