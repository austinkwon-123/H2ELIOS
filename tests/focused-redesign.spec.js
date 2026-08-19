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

test('the opening camera frames Europe, where the infrastructure is', async ({ page }) => {
  await open(page);
  // Only the constant is assertable here. The store's map.camera looks like a
  // second copy of this default but is really live state — it tracks the map
  // and by this point the 3D entrance has flown it to another zoom and pitch
  // entirely. The store's own default is covered in tests/store.test.js.
  const home = await page.evaluate(() => H2GRID_HOME_VIEW.center);
  // An opening view that frames elsewhere puts the dataset off-screen, which is
  // what made the 3D pipeline layer look broken rather than merely off-frame:
  // toggling it moved 261 pixels from [24, 8] and 4,062 from [9, 51].
  expect(home[0], 'longitude within Europe').toBeGreaterThan(-15);
  expect(home[0], 'longitude within Europe').toBeLessThan(35);
  expect(home[1], 'latitude within Europe').toBeGreaterThan(35);
  expect(home[1], 'latitude within Europe').toBeLessThan(65);
});

test('Explore shell keeps the desktop sidebar in proportion to the map', async ({ page }) => {
  await open(page);
  const sidebar = await page.locator('#app-sidebar').boundingBox();
  const ribbon = await page.locator('#command-ribbon').boundingBox();
  expect(sidebar).not.toBeNull();
  expect(ribbon).not.toBeNull();
  expect(sidebar.width).toBeGreaterThanOrEqual(220);
  expect(sidebar.width).toBeLessThanOrEqual(240);
  expect(sidebar.width / page.viewportSize().width).toBeLessThan(0.17);
  expect(Math.abs(ribbon.x - sidebar.width)).toBeLessThanOrEqual(1);
  await expect(page.locator('#data-quality-btn')).toHaveCount(0);
  await expect(page.locator('#data-quality-panel')).toHaveCount(0);

  await page.evaluate(() => setSidebarExpanded(false, false));
  await page.waitForTimeout(500);
  const railAlignment = await page.evaluate(() => {
    const sidebarRect = document.getElementById('app-sidebar').getBoundingClientRect();
    return [...document.querySelectorAll(
      '#app-sidebar .tab-btn:not([hidden]), #app-sidebar .dock-btn, #app-sidebar .flyout-trigger'
    )].filter((button) => button.getClientRects().length).map((button) => {
      const icon = button.querySelector('svg');
      const buttonRect = button.getBoundingClientRect();
      const iconRect = icon.getBoundingClientRect();
      return {
        label: button.getAttribute('aria-label') || button.title,
        railX: (buttonRect.left + buttonRect.width / 2) - (sidebarRect.left + sidebarRect.width / 2),
        x: (iconRect.left + iconRect.width / 2) - (buttonRect.left + buttonRect.width / 2),
        y: (iconRect.top + iconRect.height / 2) - (buttonRect.top + buttonRect.height / 2)
      };
    });
  });
  for (const alignment of railAlignment) {
    expect.soft(Math.abs(alignment.railX), `${alignment.label} control offset from rail`).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(alignment.x), `${alignment.label} horizontal icon offset`).toBeLessThanOrEqual(1);
    expect.soft(Math.abs(alignment.y), `${alignment.label} vertical icon offset`).toBeLessThanOrEqual(1);
  }
});

test('collapsing the sidebar re-centres the globe instead of leaving it underneath', async ({ page }) => {
  await open(page);
  if (await page.locator('html').getAttribute('data-map-runtime') === 'offline') test.skip(true, 'no map runtime');
  // Regression: syncSpatialMapPadding() reads sidebar.offsetWidth, and it ran
  // one frame after the collapse class flipped — sampling the start of the
  // 0.3s width transition. Expanding left the map padded for the collapsed
  // 56px rail, so the globe sat ~176px off-centre, partly behind the sidebar,
  // until some unrelated event happened to re-sync.
  const settle = async (expanded) => {
    await page.evaluate((e) => setSidebarExpanded(e, false), expanded);
    // A saturated CI renderer can delay both transitionend and MapLibre's
    // padding update well past a fixed sleep. Wait for the actual contract:
    // no width animation remains and the map owns the settled sidebar width.
    await expect.poll(() => page.evaluate(() => {
      const sidebar = document.getElementById('app-sidebar');
      const animating = sidebar.getAnimations().some((animation) => animation.playState === 'running');
      return animating ? null : Math.abs(map.getPadding().left - sidebar.offsetWidth);
    })).toBe(0);
    return page.evaluate(() => ({
      padding: map.getPadding().left,
      sidebar: document.getElementById('app-sidebar').offsetWidth
    }));
  };
  for (const expanded of [false, true, false, true]) {
    const { padding, sidebar } = await settle(expanded);
    expect(padding, `map padding must match a ${expanded ? 'expanded' : 'collapsed'} sidebar`).toBe(sidebar);
  }
});

test('narrow Explore shell uses a compact rail without shrinking touch targets', async ({ page }) => {
  await open(page, 'map', 582);
  const sidebar = await page.locator('#app-sidebar').boundingBox();
  const ribbon = await page.locator('#command-ribbon').boundingBox();
  const explore = await page.locator('#app-sidebar .tab-btn[data-route="map"]').boundingBox();
  expect(sidebar).not.toBeNull();
  expect(ribbon).not.toBeNull();
  expect(explore).not.toBeNull();
  expect(sidebar.width).toBe(52);
  expect(sidebar.width / page.viewportSize().width).toBeLessThan(0.1);
  expect(Math.abs(ribbon.x - sidebar.width)).toBeLessThanOrEqual(1);
  expect(explore.width).toBeGreaterThanOrEqual(44);
  expect(explore.height).toBeGreaterThanOrEqual(44);
  await expect(page.locator('#dock-3d-btn')).toBeHidden();
  expect(await page.evaluate(() => window.is3DActive)).toBe(false);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

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

test('every local script and stylesheet shares one fresh cache token', async ({ page }) => {
  await open(page);
  const readAssets = () => page.evaluate(() => {
    const urls = [...document.querySelectorAll('script[src], link[rel="stylesheet"][href]')]
      .map((element) => new URL(element.src || element.href))
      .filter((url) => url.origin === location.origin && /\.(?:js|css)$/.test(url.pathname));
    return {
      token: window.H2ELIOS_ASSETS && window.H2ELIOS_ASSETS.token,
      versions: urls.map((url) => url.searchParams.get('v')),
      paths: urls.map((url) => url.pathname)
    };
  });

  const first = await readAssets();
  expect(first.paths.length).toBeGreaterThan(30);
  expect(new Set(first.versions)).toEqual(new Set([first.token]));

  await page.reload({ waitUntil: 'domcontentloaded' });
  const second = await readAssets();
  expect(second.token).not.toBe(first.token);
  expect(new Set(second.versions)).toEqual(new Set([second.token]));
});

test('dark low-zoom atmosphere preserves the limb without the blow-out value', async ({ page }) => {
  await open(page);
  const blends = await page.evaluate(() => {
    const resolveAtZoom = (expression, zoom) => {
      const stops = expression.slice(3);
      if (zoom <= stops[0]) return stops[1];
      for (let i = 2; i < stops.length; i += 2) {
        if (zoom <= stops[i]) {
          const t = (zoom - stops[i - 2]) / (stops[i] - stops[i - 2]);
          return stops[i - 1] + (stops[i + 1] - stops[i - 1]) * t;
        }
      }
      return stops[stops.length - 1];
    };
    const read = () => {
      const sky = map.getSky ? map.getSky() : map._sky;
      const expression = sky['atmosphere-blend'];
      return { expression, resolved: resolveAtZoom(expression, map.getZoom()) };
    };

    setTheme('dark');
    const dark = read();
    setTheme('light');
    const light = read();
    setTheme('dark');
    return { dark, light };
  });

  expect(blends.dark.expression).toEqual(['interpolate', ['linear'], ['zoom'], 0, 0.42, 3, 0.42, 6, 0.08, 9, 0]);
  expect(blends.dark.resolved).toBeCloseTo(0.42, 5);
  expect(blends.light.resolved).toBeCloseTo(0.22, 5);
});

test('map defaults to five active layer groups, 3D capacity, and then stays stationary', async ({ page }) => {
  await open(page);
  await expect(page.locator('#layer-dock .dock-btn[data-layer]')).toHaveCount(6);
  await expect(page.locator('#layer-dock .dock-btn.active[data-layer]')).toHaveCount(5);
  // Corridors and pipelines are drawn by two different modules on purpose:
  // arcs for contractual supply relationships with no physical route, ribbons
  // for surveyed steel. Both load; the day/night terminator stays out.
  expect(await page.evaluate(() => Boolean(window.H2GArcs))).toBe(true);
  expect(await page.evaluate(() => Boolean(window.H2GPipelines))).toBe(true);
  expect(await page.evaluate(() => Boolean(window.H2GDayNight))).toBe(false);
  if (await page.locator('html').getAttribute('data-map-runtime') === 'offline') {
    await expect(page.getByText('Map runtime unavailable')).toBeVisible();
    return;
  }
  await expect(page.locator('#dock-3d-btn')).toHaveClass(/active/);
  await expect.poll(() => page.evaluate(() => Boolean(map.getLayer('h2grid-3d-pipelines')))).toBe(true);
  const pipelines3d = await page.evaluate(() => window.H2GPipelines.debug());
  expect(pipelines3d.pipelines).toBeGreaterThan(0);
  expect(pipelines3d.buffers).toBe(pipelines3d.pipelines);
  expect(pipelines3d.visible).toBe(true);
  expect(pipelines3d.ambientMotion).toBe(false);
  expect(pipelines3d.minHalfWidth).toBeGreaterThanOrEqual(0.00045);
  expect(pipelines3d.minLiftM).toBeGreaterThanOrEqual(45000);
  // A real pipeline stays visually attached to its reported route. The failed
  // version used a 1,800km floor, which disappeared from orbit and became a
  // near-vertical screen-height wall after selecting a regional project.
  expect(pipelines3d.maxLiftM).toBeLessThanOrEqual(220000);

  // 3D Capacity owns both implementations: curated/IEA data is WebGL, while
  // live API projects use a native fill-extrusion layer. The latter used to
  // stay behind after the mode button looked off and obscure every pipeline.
  const hasLiveExtrusions = await page.evaluate(() => Boolean(map.getLayer('api-projects-extrusion')));
  await page.locator('#dock-3d-btn').click();
  await expect(page.locator('#dock-3d-btn')).not.toHaveClass(/active/);
  if (hasLiveExtrusions) {
    expect(await page.evaluate(() => map.getLayoutProperty('api-projects-extrusion', 'visibility'))).toBe('none');
  }
  await page.locator('#dock-3d-btn').click();
  await expect(page.locator('#dock-3d-btn')).toHaveClass(/active/);
  if (hasLiveExtrusions) {
    expect(await page.evaluate(() => map.getLayoutProperty('api-projects-extrusion', 'visibility'))).toBe('visible');
  }

  const pipelineToggle = page.locator('.dock-btn[data-layer="pipelines"]');
  await pipelineToggle.click();
  expect(await page.evaluate(() => window.H2GPipelines.debug().visible)).toBe(false);
  await pipelineToggle.click();
  expect(await page.evaluate(() => window.H2GPipelines.debug().visible)).toBe(true);
  // The 3D entrance animates the camera into place. Wait for it to actually
  // finish rather than assuming a fixed delay covers it — under load the
  // easing can still be running, which made this read as idle drift.
  const camera = () => page.evaluate(() => ({
    center: map.getCenter().toArray(), zoom: map.getZoom(), bearing: map.getBearing(), pitch: map.getPitch()
  }));
  await expect.poll(async () => {
    const a = await camera();
    await page.waitForTimeout(250);
    return JSON.stringify(a) === JSON.stringify(await camera());
  }, { timeout: 15000 }).toBe(true);

  // Now that it has settled, nothing may move it again on its own.
  const before = await camera();
  await page.waitForTimeout(1200);
  expect(await camera()).toEqual(before);
  expect(await page.evaluate(() => Boolean(
    map.getSource('satellites') ||
    map.getSource('hub-comets') ||
    map.getLayer('night-hemisphere') ||
    map.getLayer('h2grid-daynight')
  ))).toBe(false);
  // The corridor arcs are back and this layer is expected to exist. What must
  // not come back is its unconditional per-frame repaint, which is why the
  // module was cut in the first place — it now asks the same policy gate the
  // rest of the globe obeys, and that gate is off.
  expect(await page.evaluate(() => Boolean(map.getLayer('h2grid-3d-arcs')))).toBe(true);
  expect(await page.evaluate(() => ambientMotionAllowed())).toBe(false);
});

test('mobile inspectors enforce one owner for their shared bottom-sheet slot', async ({ page }) => {
  await open(page, 'map', 424);
  await page.locator('#analytics-btn').click();
  await expect(page.locator('#analytics-panel')).toBeVisible();
  await page.evaluate(() => showDetail({
    name: 'Direct selection project', status: 'Operating', statusClass: 'operating',
    color: 'green', category: 'storage', capacity: '10 MW', region: 'europe'
  }));
  await expect(page.locator('#detail-card')).toBeVisible();
  await expect(page.locator('#analytics-panel')).toBeHidden();
  await expect(page.locator('#analytics-btn')).not.toHaveClass(/active/);
  await page.evaluate(() => closeDetailPanel(false));

  await page.evaluate(() => showDetail({
    name: 'Mobile restore project', status: 'Operating', statusClass: 'operating',
    color: 'green', category: 'storage', capacity: '25 MW', region: 'europe'
  }));
  await expect(page.locator('#detail-card')).toBeVisible();
  await page.locator('#analytics-btn').click();
  await expect(page.locator('#analytics-panel')).toBeVisible();
  await expect(page.locator('#minimized-tray .mini-card')).toHaveCount(1);

  // The restore builds a new .right-panel-slot after startup, already visible.
  // That dynamic node was outside the old per-panel observer, leaving Insights
  // underneath it as a second scroll surface at the exact same coordinates.
  await page.locator('#minimized-tray .wc-zoom').click();
  await expect(page.locator('#snapshot-row .detail-snapshot')).toBeVisible();
  await expect(page.locator('#analytics-panel')).toBeHidden();
  await expect(page.locator('#analytics-btn')).not.toHaveClass(/active/);
  await expect(page.locator('.right-panel-slot:not([hidden])')).toHaveCount(1);
});

test('the custom 3D pipeline layer changes real map pixels when toggled', async ({ page }) => {
  await open(page);
  if (await page.locator('html').getAttribute('data-map-runtime') === 'offline') test.skip(true, 'no map runtime');
  await expect.poll(() => page.evaluate(() => window.H2GPipelines?.debug().buffers || 0)).toBeGreaterThan(0);
  // Async IEA/API points continue populating the capacity VBO for several
  // seconds. Compare only after that settles, otherwise their arrival looks
  // like a pipeline pixel change and gives a false positive.
  await page.waitForTimeout(8000);
  await page.evaluate(() => window.H2GPipelines.setVisible(true));
  await page.waitForTimeout(150);
  const canvas = page.locator('#map .maplibregl-canvas');
  const on = await canvas.screenshot();
  await page.evaluate(() => window.H2GPipelines.setVisible(false));
  await page.waitForTimeout(100);
  const off = await canvas.screenshot();
  await page.evaluate(() => window.H2GPipelines.setVisible(true));

  const diff = await page.evaluate(async ({ onBase64, offBase64 }) => {
    const pixels = async (base64) => {
      const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
      const surface = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = surface.getContext('2d');
      context.drawImage(bitmap, 0, 0);
      return context.getImageData(0, 0, bitmap.width, bitmap.height).data;
    };
    const a = await pixels(onBase64), b = await pixels(offBase64);
    let over8 = 0, over20 = 0;
    for (let i = 0; i < a.length; i += 4) {
      const delta = Math.max(Math.abs(a[i] - b[i]), Math.abs(a[i + 1] - b[i + 1]), Math.abs(a[i + 2] - b[i + 2]));
      if (delta > 8) over8++;
      if (delta > 20) over20++;
    }
    return { over8, over20 };
  }, { onBase64: on.toString('base64'), offBase64: off.toString('base64') });

  // The failed implementation changed only a few dozen anti-aliased pixels:
  // the custom layer existed in map.getLayer() but was optically absent.
  expect(diff.over8).toBeGreaterThan(800);
  expect(diff.over20).toBeGreaterThan(400);
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
  await page.route('**/api/quotes?**', async (route) => {
    const symbols = ['PLUG', 'BE', 'BLDP', 'HTOO', 'AIQUY', 'FCEL', 'APD', 'LIN', 'CMI', 'GTLS'];
    const quotes = Object.fromEntries(symbols.map((symbol, index) => [symbol, { c: 10 + index, dp: index % 2 ? -0.4 : 0.6 }]));
    await route.fulfill({ json: { configured: true, quotes, failed: [] } });
  });
  await open(page);
  await page.locator('#markets-btn').click();
  await expect(page.locator('#markets-panel')).toBeVisible();
  await expect(page.locator('#analytics-markets-video iframe')).toHaveCount(1);
  await expect(page.locator('#analytics-markets-chart .tradingview-widget-container')).toHaveCount(1);
  await expect(page.locator('#analytics-markets')).toBeVisible();
  await expect(page.locator('#analytics-markets .stock-row')).toHaveCount(10);
  await expect(page.locator('#analytics-markets [data-symbol="PLUG"]')).toContainText('Plug Power');
  await expect(page.locator('#analytics-markets [data-symbol="PLUG"]')).toContainText('10.00');
  await expect(page.locator('#analytics-markets .markets-status')).toContainText('Live · 10/10 symbols');

  // Beyond "an iframe exists": it must be the live-stream embed, already
  // playing, and muted — browsers block unmuted autoplay outright, so
  // autoplay=1 without mute=1 would silently not play at all.
  const frame = page.locator('#analytics-markets-video iframe');
  const src = await frame.getAttribute('src');
  expect(src).toContain('/embed/live_stream');
  expect(src).toMatch(/[?&]autoplay=1(&|$)/);
  expect(src).toMatch(/[?&]mute=1(&|$)/);
  // The iframe must also be *permitted* to autoplay by its allow policy.
  expect(await frame.getAttribute('allow')).toContain('autoplay');
});

test('Markets falls back to a live TradingView equity watchlist when Finnhub is unavailable', async ({ page }) => {
  await page.route('**/api/quotes?**', (route) => route.fulfill({
    json: { configured: true, quotes: {}, failed: ['PLUG', 'BE', 'BLDP'] }
  }));
  await open(page);
  await page.locator('#markets-btn').click();

  await expect(page.locator('#analytics-markets .markets-status')).toContainText('Live equities · TradingView');
  await expect(page.locator('#analytics-markets .markets-equities-widget')).toBeVisible();
  await expect(page.locator('#analytics-markets .markets-equities-widget'))
    .toHaveAttribute('data-symbols', /NASDAQ:PLUG.*NYSE:GTLS/);
});

test('Markets teardown disposes the video and a reopen autoplays a fresh one', async ({ page }) => {
  await open(page);
  await page.locator('#markets-btn').click();
  await expect(page.locator('#analytics-markets-video iframe')).toHaveCount(1);

  await page.locator('#markets-btn').click();
  await expect(page.locator('#markets-panel')).toBeHidden();
  // Disposed, not merely hidden — an iframe left in the DOM keeps streaming.
  await expect(page.locator('#analytics-markets-video iframe')).toHaveCount(0);
  await expect(page.locator('#markets-btn')).not.toHaveClass(/active/);

  await page.locator('#markets-btn').click();
  await expect(page.locator('#analytics-markets-video iframe')).toHaveCount(1);
  expect(await page.locator('#analytics-markets-video iframe').getAttribute('src'))
    .toMatch(/[?&]autoplay=1(&|$)/);
});

test('comparison tray shows only on Explore while its snapshots survive navigation', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const snapshot = H2Store.createSnapshot('project', { id: 'route-scope-project', label: 'Route scope project', payload: {} });
    H2Store.dispatch({ type: 'COMPARISON_ADD', payload: { snapshot } });
  });
  await expect(page.locator('#comparison-tray')).toBeVisible();

  for (const route of ['market', 'technology', 'demand-transport', 'policy', 'timeline', 'tools']) {
    await page.evaluate((r) => navigateTo(r), route);
    await expect(page.locator('#comparison-tray'), `tray must be hidden on ${route}`).toBeHidden();
    // Hidden, not discarded: the snapshot stays in session state throughout.
    expect(await page.evaluate(() => H2Store.getState().comparisons.length)).toBe(1);
  }

  await page.evaluate(() => navigateTo('map'));
  await expect(page.locator('#comparison-tray')).toBeVisible();
  await expect(page.locator('[data-comparison-remove="route-scope-project"]')).toHaveCount(1);
});

test('Live viewport recomputes count, capacity and gauge after the map moves', async ({ page, request }) => {
  // This gauge is computed entirely from the backend, so it cannot be asserted
  // without one. Probe first and skip with a named reason rather than failing
  // ambiguously — a red test here would otherwise just mean "Postgres is down".
  const summary = await request.get('/api/analytics/summary').catch(() => null);
  test.skip(!summary || !summary.ok(),
    `live API unavailable (/api/analytics/summary -> ${summary ? summary.status() : 'no response'}); start Postgres to run this`);

  await open(page);
  await page.locator('#analytics-btn').click();
  await expect(page.locator('#analytics-panel')).toBeVisible();

  // Under the offline fallback style the API tier cannot run at all; assert the
  // honest degraded state rather than pretending the gauge should populate.
  if (await page.locator('html').getAttribute('data-map-runtime') === 'offline') {
    await expect(page.getByText('Map runtime unavailable')).toBeVisible();
    return;
  }

  // The tier must actually initialise. It previously failed silently, because
  // MapLibre swallows exceptions thrown inside its event listeners.
  await expect
    .poll(() => page.evaluate(() => Boolean(map.getSource('api-projects'))), { timeout: 15000 })
    .toBe(true);
  await expect
    .poll(() => page.evaluate(() => document.getElementById('gauge-pct').textContent), { timeout: 15000 })
    .not.toBe('0%');
  await expect(page.locator('#viewport-gauge')).not.toHaveClass(/gauge-loading/);
  const read = () => page.evaluate(() => ({
    pct: document.getElementById('gauge-pct').textContent,
    dash: document.getElementById('gauge-fill-path').style.strokeDashoffset,
    dotCx: document.getElementById('gauge-fill-dot').getAttribute('cx'),
    count: document.getElementById('api-summary-count').textContent,
    mw: document.getElementById('api-summary-mw').textContent
  }));
  const before = await read();

  // Jump somewhere with a very different project density.
  await page.evaluate(() => map.jumpTo({ center: [9.9, 53.5], zoom: 6 }));
  await expect.poll(async () => (await read()).pct, { timeout: 15000 }).not.toBe(before.pct);

  const after = await read();
  expect(after.dash, 'arc fill must move').not.toBe(before.dash);
  expect(after.dotCx, 'gauge dot must move along the arc').not.toBe(before.dotCx);
  expect(after.count, 'projects-in-view must recompute').not.toBe(before.count);
  expect(after.mw, 'capacity-in-view must recompute').not.toBe(before.mw);
  // No duplicate sources/layers from the retrying initialiser.
  expect(await page.evaluate(() => map.getStyle().layers.filter((l) => l.id === 'api-projects').length)).toBe(1);
});

test('the retired Film feature leaves no control, runtime, or keyboard override', async ({ page }) => {
  await open(page);
  await expect(page.locator('#demo-btn, #demo-card, #cine')).toHaveCount(0);
  expect(await page.evaluate(() => typeof window.H2GDemo)).toBe('undefined');
  expect(await page.evaluate(() => [...document.scripts].some((script) => script.src.includes('25-cinematic')))).toBe(false);

  const prevented = await page.evaluate(() => {
    const event = new KeyboardEvent('keydown', {
      key: 'f', code: 'KeyF', ctrlKey: true, bubbles: true, cancelable: true
    });
    document.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(prevented).toBe(false);
});

// Regression: a desktop workspace must never render content taller than its
// container while clipping it. The Timeline's left column did exactly that —
// overflow:hidden over ~80px of surplus, so the capacity chart's lower edge was
// unreachable at ordinary desktop heights while the right-hand list scrolled
// normally, which made it look intermittent rather than broken.
for (const height of [900, 760]) {
  test(`no desktop workspace clips unreachable content at 1440x${height}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height });
    for (const [route] of ROUTES) {
      await page.goto(`/#${route}`, { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2200);
      const clipped = await page.evaluate(() => {
        const offenders = [];
        document.querySelectorAll('.page:not([hidden]) *').forEach((el) => {
          const style = getComputedStyle(el);
          if (style.overflowY !== 'hidden' && style.overflowY !== 'clip') return;
          // Screen-reader-only text is a deliberately clipped 1px box, not a
          // layout fault — exclude it rather than weakening the real check.
          if (el.clientHeight <= 4 || el.clientWidth <= 4) return;
          if (style.clipPath && style.clipPath !== 'none') return;
          if (el.scrollHeight > el.clientHeight + 2) {
            offenders.push(`${el.className || el.tagName}: ${el.scrollHeight}>${el.clientHeight}`);
          }
        });
        return offenders;
      });
      expect.soft(clipped, `${route} @${height} clips unreachable content`).toEqual([]);
    }
  });
}

test('Compare pins without closing the panel and its rows open side-by-side panels', async ({ page }) => {
  await open(page);
  // Regressions this covers, all from the same rewiring:
  //   - the only way to pin was the Minimize dot, which then closed the panel,
  //     so you could never see the pinned project next to the next one;
  //   - tray rows carried data-snapshot-id that nothing ever read, making the
  //     side-by-side panel machinery in js/01-core.js unreachable;
  //   - pins used timestamped ids, so re-pinning stacked duplicate rows.
  await page.evaluate(() => {
    window.__mkProject = (name) => ({
      name, status: 'Operating', statusClass: 'operating', color: 'green',
      category: 'production', subtype: 'Electrolysis', capacity: '30 MW', country: 'Germany'
    });
    showDetail(window.__mkProject('Alpha electrolyser'));
    document.getElementById('detail-compare').click();
    document.getElementById('detail-compare').click();
  });
  await expect(page.locator('#detail-card')).toBeVisible();
  await expect(page.locator('#detail-compare')).toHaveText('Pinned');
  await expect(page.locator('#comparison-tray-items .comparison-item')).toHaveCount(1);

  await page.evaluate(() => showDetail(window.__mkProject('Beta electrolyser')));
  await expect(page.locator('#detail-compare')).toHaveText('Compare');

  await page.locator('#comparison-tray-items .comparison-open').click();
  const snapshot = page.locator('#snapshot-row .detail-snapshot');
  await expect(snapshot).toHaveCount(1);
  await expect(snapshot.locator('.detail-name')).toHaveText('Alpha electrolyser');
  await expect(page.locator('#detail-content .detail-name')).toHaveText('Beta electrolyser');

  // Clicking the same row again points at the panel instead of stacking a copy.
  await page.locator('#comparison-tray-items .comparison-open').click();
  await expect(page.locator('#snapshot-row .detail-snapshot')).toHaveCount(1);

  // Minimize is minimize again: a mini-card, and the tray is left alone.
  await page.locator('#detail-minimize').click();
  await expect(page.locator('#minimized-tray .mini-card')).toHaveCount(1);
  await expect(page.locator('#comparison-tray-items .comparison-item')).toHaveCount(1);
});

test('the selection chip and the Compare tray do not stack into one column', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    H2Store.dispatch({ type: 'PROJECT_SELECT', payload: { props: { name: 'Chip project' }, lngLat: [10, 50] } });
    const snapshot = H2Store.createSnapshot('project', { id: 'chip-vs-tray', label: 'Tray project', payload: {} });
    H2Store.dispatch({ type: 'COMPARISON_ADD', payload: { snapshot } });
  });
  const chip = await page.locator('#selection-chip').boundingBox();
  const tray = await page.locator('#comparison-tray').boundingBox();
  expect(chip).not.toBeNull();
  expect(tray).not.toBeNull();
  // Different corners: the chip is "what is selected", the tray is "what is
  // pinned". Sharing a column made the chip read as a third tray row.
  expect(chip.x).toBeGreaterThan(tray.x + tray.width);
  expect(chip.x + chip.width).toBeLessThanOrEqual(page.viewportSize().width);
});

test('comparison removal is keyboard operable', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const snapshot = H2Store.createSnapshot('project', { id: 'keyboard-project', label: 'Keyboard project', payload: {} });
    H2Store.dispatch({ type: 'COMPARISON_ADD', payload: { snapshot } });
  });
  const remove = page.locator('[data-comparison-remove="keyboard-project"]');
  await remove.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('[data-comparison-remove="keyboard-project"]')).toHaveCount(0);
});

test('390px reader mode keeps search and project detail while suppressing advanced controls', async ({ page }) => {
  await open(page, 'map', 390);
  await expect(page.locator('#mobile-analysis-notice')).toBeVisible();
  await expect(page.locator('#dock-3d-btn')).toBeHidden();
  // The searchable set is assembled from several feeds that land asynchronously
  // (curated data, EU stations, then the live API tier). Typing before it has
  // settled renders an empty dropdown, which then closes — so wait for the
  // dataset to stop growing before querying it, rather than retrying the click.
  await expect.poll(async () => {
    const n = await page.evaluate(() => (typeof allFacilities === 'function' ? allFacilities().length : 0));
    await page.waitForTimeout(400);
    return n > 0 && n === await page.evaluate(() => allFacilities().length);
  }, { timeout: 25000 }).toBe(true);

  await page.keyboard.press('Control+K');
  await page.locator('#network-search').fill('kobe');
  const firstResult = page.locator('#search-results .fac-item').first();
  await expect(firstResult).toBeVisible({ timeout: 10000 });
  await firstResult.click();
  await expect(page.locator('#detail-card')).toBeVisible();
});
