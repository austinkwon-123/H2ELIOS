const { test, expect } = require('@playwright/test');

const ROUTES = [
  ['map', 'page-map', '#map'],
  ['market', 'page-market', '#page-market'],
  ['technology', 'page-technology', '#page-technology'],
  ['demand-transport', 'page-demand-transport', '#page-demand-transport'],
  ['policy', 'page-policy', '#page-policy'],
  ['timeline', 'page-timeline', '#page-timeline'],
  ['tools', 'page-tools', '#page-tools']
];

async function open(page, route = 'map', width = 1440) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto(`/#${route}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2200);
}

for (const width of [1440, 1100]) {
  test(`all primary routes fit the ${width}px desktop contract`, async ({ page }) => {
    for (const [route, pageId, visibleSelector] of ROUTES) {
      await open(page, route, width);
      // #page-map intentionally has no box of its own because its map child
      // is fixed to the workspace viewport. Assert the real visible surface.
      await expect(page.locator(visibleSelector)).toBeVisible();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect.soft(overflow, `${route} overflow at ${width}px`).toBeLessThanOrEqual(1);
      await expect(page.locator(`#${pageId} [data-provenance="illustrative"]`)).toHaveCount(0);
    }
  });
}

test('fresh theme is dark and explicit Light preference persists', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => localStorage.removeItem('h2elios-theme'));
  await open(page);
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.locator('#toolbar-more').click();
  await page.locator('[data-theme-choice="light"]').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
});

test('map defaults to four active layer groups, 3D capacity, and then stays stationary', async ({ page }) => {
  await open(page);
  await expect(page.locator('#layer-dock .dock-btn[data-layer]')).toHaveCount(5);
  await expect(page.locator('#layer-dock .dock-btn.active[data-layer]')).toHaveCount(4);
  if (await page.locator('html').getAttribute('data-map-runtime') === 'offline') {
    await expect(page.getByText('Map runtime unavailable')).toBeVisible();
    return;
  }
  await expect(page.locator('#dock-3d-btn')).toHaveClass(/active/);
  const before = await page.evaluate(() => ({ center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }));
  await page.waitForTimeout(1200);
  const after = await page.evaluate(() => ({ center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch() }));
  expect(after).toEqual(before);
  expect(await page.evaluate(() => Boolean(map.getSource('satellites') || map.getSource('hub-comets') || map.getLayer('night-hemisphere')))).toBe(false);
});

test('Technology project hand-off returns with originating route intact', async ({ page }) => {
  await open(page, 'technology');
  const project = page.locator('.tech-dot[role="button"]').first();
  await expect(project).toBeVisible();
  await project.click();
  await expect(page).toHaveURL(/#map$/);
  await expect(page.locator('#detail-card')).toBeVisible();
  await expect(page.locator('#handoff-return')).toContainText('Technology');
  await page.locator('#handoff-return').click();
  await expect(page).toHaveURL(/#technology$/);
});

test('Timeline year is explicitly applied to Explore', async ({ page }) => {
  await open(page, 'timeline');
  await page.locator('#sandbox-slider').evaluate((input) => { input.value = '2030'; input.dispatchEvent(new Event('input', { bubbles: true })); });
  await page.locator('#timeline-apply-map').click();
  await expect(page).toHaveURL(/#map$/);
  expect(await page.evaluate(() => H2Store.getState().timelineYear)).toBe(2030);
  await expect(page.locator('#handoff-return')).toContainText('Timeline');
});

test('Markets side surface restores video, comparison chart, and ticker area', async ({ page }) => {
  await open(page);
  await page.locator('#markets-btn').click();
  await expect(page.locator('#markets-panel')).toBeVisible();
  await expect(page.locator('#analytics-markets-video iframe')).toHaveCount(1);
  await expect(page.locator('#analytics-markets-chart .tradingview-widget-container')).toHaveCount(1);
  await expect(page.locator('#analytics-markets')).toBeVisible();
});

test('comparison removal and Data Quality menu are keyboard operable', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const snapshot = H2Store.createSnapshot('project', { id: 'keyboard-project', label: 'Keyboard project', payload: {} });
    H2Store.dispatch({ type: 'COMPARISON_ADD', payload: { snapshot } });
  });
  const remove = page.locator('[data-comparison-remove="keyboard-project"]');
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-comparison-remove="keyboard-project"]')).toHaveCount(0);

  await page.locator('#data-quality-btn').focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#data-quality-panel')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('#data-quality-panel')).toBeHidden();
  await expect(page.locator('#data-quality-btn')).toBeFocused();
});

test('390px reader mode keeps search and project detail while suppressing advanced controls', async ({ page }) => {
  await open(page, 'map', 390);
  await expect(page.locator('#mobile-analysis-notice')).toBeVisible();
  await expect(page.locator('#dock-3d-btn')).toBeHidden();
  await page.keyboard.press('Control+K');
  await page.locator('#network-search').fill('kobe');
  await page.locator('#search-results .fac-item').first().click();
  await expect(page.locator('#detail-card')).toBeVisible();
});
