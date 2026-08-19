const { test, expect } = require('@playwright/test');

async function openH2ELIOS(page, width, height = 800) {
  await page.setViewportSize({ width, height });
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2_500);
}

test.describe('H2ELIOS responsive interaction contract', () => {
  test('mobile search implements a keyboard-operated combobox', async ({ page }) => {
    await openH2ELIOS(page, 360);

    const input = page.locator('#network-search');
    const results = page.locator('#search-results');
    await page.keyboard.press('Control+K');

    await expect(input).toBeFocused();
    expect.soft(await input.getAttribute('role')).toBe('combobox');
    expect.soft(await input.getAttribute('aria-controls')).toBe('search-results');
    expect.soft(await input.getAttribute('aria-expanded')).toBe('true');
    expect.soft(await results.getAttribute('role')).toBe('listbox');

    await input.fill('kobe');
    const options = results.locator('.fac-item, .palette-item');
    await expect(options).toHaveCount(2);
    expect.soft(await options.first().getAttribute('role')).toBe('option');
    expect.soft(await options.first().getAttribute('tabindex')).toBe('-1');
    expect.soft(await options.first().getAttribute('id')).toBeTruthy();

    await input.press('ArrowDown');
    const activeDescendant = await input.getAttribute('aria-activedescendant');
    expect.soft(activeDescendant).toBeTruthy();
    if (activeDescendant) await expect.soft(page.locator(`#${activeDescendant}`)).toHaveAttribute('aria-selected', 'true');
  });

  test('search-originated project details own and restore focus', async ({ page }) => {
    await openH2ELIOS(page, 360);

    const input = page.locator('#network-search');
    const detail = page.locator('#detail-card');
    const close = page.locator('#detail-close');
    await page.keyboard.press('Control+K');
    await input.fill('kobe');
    await page.locator('#search-results .fac-item').first().click();

    await expect(detail).toBeVisible();
    expect.soft(await detail.getAttribute('role')).toBe('region');
    expect.soft((await detail.getAttribute('aria-label')) ?? '').toMatch(/project details/i);
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('detail-close');

    const detailBox = await detail.boundingBox();
    expect(detailBox).not.toBeNull();
    expect.soft(detailBox.y + detailBox.height).toBeLessThanOrEqual(800);
    await expect.soft(detail).toHaveCSS('overflow-y', /auto|scroll/);

    await close.click();
    await expect(detail).toBeHidden();
    // closeDetailPanel restores the invoking control on requestAnimationFrame;
    // hidden changes synchronously, so observing hidden alone can precede the
    // focus hand-off on a busy renderer.
    await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('network-search');
  });

  test('sub-1100 sidebar semantics match its visible state and Escape lifecycle', async ({ page }) => {
    await openH2ELIOS(page, 1099);

    const sidebar = page.locator('#app-sidebar');
    const toggle = page.locator('#sidebar-toggle');
    const filter = page.locator('#sidebar-filter');
    const initialBox = await sidebar.boundingBox();
    expect(initialBox).not.toBeNull();
    if (initialBox.width <= 64) expect.soft(await toggle.getAttribute('aria-expanded')).toBe('false');

    if (await toggle.getAttribute('aria-expanded') === 'true') await toggle.click();
    expect.soft(await filter.getAttribute('tabindex')).toBe('-1');

    await toggle.click();
    // Width transitions from the compact rail to the full sidebar. Measuring
    // on the click frame races that transition and intermittently reads 56px
    // even though aria-expanded has already changed.
    await expect.poll(async () => (await sidebar.boundingBox())?.width || 0)
      .toBeGreaterThan(200);
    expect.soft(await toggle.getAttribute('aria-expanded')).toBe('true');

    await page.keyboard.press('Escape');
    expect.soft(await toggle.getAttribute('aria-expanded')).toBe('false');
    expect.soft(await page.evaluate(() => document.activeElement?.id)).toBe('sidebar-toggle');
  });

  test('route and layer state is announced programmatically', async ({ page }) => {
    await openH2ELIOS(page, 1099);

    const explore = page.getByRole('button', { name: 'Explore — the global network', exact: true });
    const economics = page.getByRole('button', { name: 'Economics', exact: true });
    const production = page.getByRole('button', { name: 'Facilities', exact: true });

    expect.soft(await explore.getAttribute('aria-current')).toBe('page');
    expect.soft(await production.getAttribute('aria-pressed')).toBe('true');
    await production.click();
    expect.soft(await production.getAttribute('aria-pressed')).toBe('false');

    await economics.click();
    expect.soft(await economics.getAttribute('aria-current')).toBe('page');
    expect.soft(await explore.getAttribute('aria-current')).toBeNull();
  });

  test('mobile controls meet 44 by 44 CSS pixel touch targets', async ({ page }) => {
    await openH2ELIOS(page, 360);

    const targets = [
      page.locator('#sidebar-toggle'),
      page.locator('#toolbar-more'),
      page.locator('#tab-nav button').first()
    ];
    for (const target of targets) {
      const box = await target.boundingBox();
      expect(box).not.toBeNull();
      expect.soft(box.width, await target.getAttribute('aria-label') || 'control width').toBeGreaterThanOrEqual(44);
      expect.soft(box.height, await target.getAttribute('aria-label') || 'control height').toBeGreaterThanOrEqual(44);
    }

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(360);
  });
});
