import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { test, expect } from '@playwright/test';

const benchmarkRecords = [];
const outputRoot = path.resolve(process.cwd(), process.env.TEST_STATION_E2E_OUTPUT_DIR || 'artifacts/e2e-performance');
const baseURL = process.env.TEST_STATION_E2E_BASE_URL || 'https://test-station.smysnk.com';
const budgetConfig = {
  homeReadyMs: readBudget('TEST_STATION_E2E_BUDGET_HOME_READY_MS'),
  projectFocusMs: readBudget('TEST_STATION_E2E_BUDGET_PROJECT_FOCUS_MS'),
  clearProjectFocusMs: readBudget('TEST_STATION_E2E_BUDGET_PROJECT_CLEAR_MS'),
  runNavigationMs: readBudget('TEST_STATION_E2E_BUDGET_RUN_NAVIGATION_MS'),
  runnerReportReadyMs: readBudget('TEST_STATION_E2E_BUDGET_RUNNER_REPORT_READY_MS'),
  operationsViewSwitchMs: readBudget('TEST_STATION_E2E_BUDGET_OPERATIONS_VIEW_SWITCH_MS'),
  projectPageNavigationMs: readBudget('TEST_STATION_E2E_BUDGET_PROJECT_PAGE_NAVIGATION_MS'),
};

test.describe.configure({ mode: 'serial' });
test.use({ viewport: { width: 1440, height: 1024 } });

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__TEST_STATION_PERF__ = {
      lcp: null,
      cls: 0,
      longTaskCount: 0,
      longTaskDurationMs: 0,
    };

    try {
      const perfStore = window.__TEST_STATION_PERF__;
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          perfStore.lcp = Math.max(perfStore.lcp || 0, entry.startTime || 0);
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
    } catch {}

    try {
      const perfStore = window.__TEST_STATION_PERF__;
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          if (!entry.hadRecentInput) {
            perfStore.cls += entry.value || 0;
          }
        }
      }).observe({ type: 'layout-shift', buffered: true });
    } catch {}

    try {
      const perfStore = window.__TEST_STATION_PERF__;
      new PerformanceObserver((entryList) => {
        for (const entry of entryList.getEntries()) {
          perfStore.longTaskCount += 1;
          perfStore.longTaskDurationMs += entry.duration || 0;
        }
      }).observe({ type: 'longtask', buffered: true });
    } catch {}
  });
});

test.afterAll(async () => {
  if (benchmarkRecords.length === 0) {
    return;
  }

  const generatedAt = new Date().toISOString();
  const payload = {
    generatedAt,
    baseURL,
    viewport: { width: 1440, height: 1024 },
    budgets: budgetConfig,
    benchmarks: benchmarkRecords,
  };

  fs.mkdirSync(outputRoot, { recursive: true });
  const latestPath = path.join(outputRoot, 'latest.json');
  const timestampedPath = path.join(outputRoot, `benchmark-${generatedAt.replace(/[:.]/g, '-')}.json`);
  fs.writeFileSync(latestPath, `${JSON.stringify(payload, null, 2)}\n`);
  fs.writeFileSync(timestampedPath, `${JSON.stringify(payload, null, 2)}\n`);
});

test('benchmarks the public home page with live data', async ({ page }, testInfo) => {
  const homeReadyStart = performance.now();
  await goToPublicHome(page);
  const homeReadyMs = round(performance.now() - homeReadyStart);

  const runRows = await getRunRows(page);
  const projects = await getProjectButtons(page);
  const record = {
    scenario: 'home-load',
    route: page.url(),
    metrics: {
      homeReadyMs,
      ...await collectBrowserMetrics(page),
    },
    context: {
      visibleRunCount: runRows.count,
      visibleProjectCount: projects.count,
    },
  };

  assertBudget('homeReadyMs', record.metrics.homeReadyMs);
  await recordBenchmark(testInfo, record);
});

test('benchmarks sidebar project focus and project-page load', async ({ page }, testInfo) => {
  await goToPublicHome(page);

  const projects = await getProjectButtons(page);
  test.skip(projects.count === 0 || !projects.first, 'No public projects are visible to benchmark.');

  const projectTitle = await getSidebarButtonTitle(projects.first);
  const projectFocusMs = await measureInteraction(
    async () => {
      await projects.first.click();
    },
    async () => {
      await expect(projects.first).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText('Project focus', { exact: true })).toBeVisible();
    },
  );

  const clearButton = await getAllRunsButton(page);
  const clearProjectFocusMs = await measureInteraction(
    async () => {
      await clearButton.click();
    },
    async () => {
      await expect(clearButton).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText('Operations overview', { exact: true })).toBeVisible();
    },
  );

  const projectSlug = await resolveBenchmarkProjectSlug(page, projectTitle);
  test.skip(!projectSlug, 'Unable to resolve a project slug for the live benchmark.');
  const projectPageReadyMs = await measureInteraction(
    async () => {
      await page.goto(`/projects/${projectSlug}`);
    },
    async () => {
      await page.waitForURL(new RegExp(`/projects/${escapeRegExp(projectSlug)}$`), { timeout: 45_000 });
      await expect(page.getByText('Execution feed', { exact: true })).toBeVisible({ timeout: 45_000 });
    },
  );

  const record = {
    scenario: 'sidebar-focus-and-project-load',
    route: page.url(),
    metrics: {
      projectFocusMs,
      clearProjectFocusMs,
      projectPageReadyMs,
      ...await collectBrowserMetrics(page),
    },
    context: {
      projectSlug,
      projectTitle,
    },
  };

  assertBudget('projectFocusMs', record.metrics.projectFocusMs);
  assertBudget('clearProjectFocusMs', record.metrics.clearProjectFocusMs);
  assertBudget('projectPageNavigationMs', record.metrics.projectPageReadyMs);
  await recordBenchmark(testInfo, record);
});

test('benchmarks runner report readiness, operations view, and project-page navigation', async ({ page }, testInfo) => {
  await goToPublicHome(page);
  const projectSlug = await resolveBenchmarkProjectSlug(page);
  test.skip(!projectSlug, 'Unable to resolve a project slug for the live benchmark.');

  await page.goto(`/projects/${projectSlug}`);
  await page.waitForURL(new RegExp(`/projects/${escapeRegExp(projectSlug)}$`), { timeout: 45_000 });

  const runLink = page.locator('.web-list__item[href^="/runs/"], a.web-list__item[href^="/runs/"], a[href^="/runs/"]').first();
  test.skip(await runLink.count() === 0, 'No project-scoped run links are visible to benchmark.');
  const runNavigation = await navigateByHrefWithFallback(page, runLink, /\/runs\/[^/?#]+$/);
  await expect(page.getByRole('link', { name: 'Runner report' })).toBeVisible();
  const runId = getRunIdFromUrl(page.url());

  const runnerFrame = page.frameLocator('iframe.web-runner-frame');
  const runnerReportReadyMs = await measureInteraction(
    async () => {},
    async () => {
      await expect(page.locator('iframe.web-runner-frame')).toBeVisible();
      await expect(runnerFrame.locator('main')).toBeVisible();
    },
  );

  const operationsViewLink = page.getByRole('link', { name: 'Operations view' });
  const operationsViewSwitchMs = await measureInteraction(
    async () => {
      await operationsViewLink.click();
    },
    async () => {
      await expect(page).toHaveURL(new RegExp(`/runs/${escapeRegExp(runId)}\\?template=web`));
      await expect(page.getByText('Run-to-run comparison', { exact: true })).toBeVisible();
    },
  );

  const projectLink = page.locator('[data-perf-id="run-project-link"], .web-run-detail__header a[href^="/projects/"]').first();
  const projectNavigation = await navigateByHrefWithFallback(page, projectLink, /\/projects\/[^/?#]+$/);
  await expect(page.getByText('Execution feed', { exact: true })).toBeVisible({ timeout: 45_000 });

  const record = {
    scenario: 'run-and-project-navigation',
    route: page.url(),
    metrics: {
      runNavigationMs: runNavigation.durationMs,
      runnerReportReadyMs,
      operationsViewSwitchMs,
      projectPageNavigationMs: projectNavigation.durationMs,
      ...await collectBrowserMetrics(page),
    },
    context: {
      runId,
      runNavigationMode: runNavigation.mode,
      projectPageNavigationMode: projectNavigation.mode,
    },
  };

  assertBudget('runNavigationMs', record.metrics.runNavigationMs);
  assertBudget('runnerReportReadyMs', record.metrics.runnerReportReadyMs);
  assertBudget('operationsViewSwitchMs', record.metrics.operationsViewSwitchMs);
  assertBudget('projectPageNavigationMs', record.metrics.projectPageNavigationMs);
  await recordBenchmark(testInfo, record);
});

async function goToPublicHome(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  if (page.url().includes('/auth/signin')) {
    test.skip(true, 'Live performance benchmarks require public pages or a pre-authenticated storage state.');
  }

  const allRunsButton = await getAllRunsButton(page);
  await expect(allRunsButton).toBeVisible();
  await page.locator('[data-perf-id^="run-row:"], .web-explorer-table__row, a[href^="/runs/"]').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});
  const runRows = await getRunRows(page);
  test.skip(runRows.count === 0 || !runRows.first, 'No public runs are visible to benchmark.');
  await expect(runRows.first).toBeVisible();
}

async function measureInteraction(action, ready) {
  const start = performance.now();
  await action();
  await ready();
  return round(performance.now() - start);
}

async function collectBrowserMetrics(page) {
  return page.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const firstContentfulPaint = performance.getEntriesByName('first-contentful-paint')[0];
    const perfStore = window.__TEST_STATION_PERF__ || {};

    return {
      responseEndMs: roundMetric(nav?.responseEnd),
      domContentLoadedMs: roundMetric(nav?.domContentLoadedEventEnd),
      loadEventMs: roundMetric(nav?.loadEventEnd),
      firstContentfulPaintMs: roundMetric(firstContentfulPaint?.startTime),
      largestContentfulPaintMs: roundMetric(perfStore.lcp),
      cumulativeLayoutShift: roundMetric(perfStore.cls, 4),
      longTaskCount: Number.isFinite(perfStore.longTaskCount) ? perfStore.longTaskCount : 0,
      longTaskDurationMs: roundMetric(perfStore.longTaskDurationMs),
      decodedBodySizeBytes: Number.isFinite(nav?.decodedBodySize) ? nav.decodedBodySize : null,
      transferSizeBytes: Number.isFinite(nav?.transferSize) ? nav.transferSize : null,
    };

    function roundMetric(value, precision = 1) {
      if (!Number.isFinite(value)) {
        return null;
      }
      const factor = 10 ** precision;
      return Math.round(value * factor) / factor;
    }
  });
}

async function recordBenchmark(testInfo, record) {
  benchmarkRecords.push(record);
  await testInfo.attach(`${record.scenario}.json`, {
    body: Buffer.from(`${JSON.stringify(record, null, 2)}\n`),
    contentType: 'application/json',
  });
}

function assertBudget(metricName, durationMs) {
  const budget = budgetConfig[metricName];
  if (!Number.isFinite(budget)) {
    return;
  }

  expect(durationMs, `${metricName} exceeded its configured budget of ${budget}ms`).toBeLessThanOrEqual(budget);
}

function readBudget(name) {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function round(value) {
  return Math.round(value * 10) / 10;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function getAllRunsButton(page) {
  const byDataHook = page.locator('[data-perf-id="sidebar-all-runs"]');
  if (await byDataHook.count() > 0) {
    return byDataHook.first();
  }

  return page.getByRole('button', { name: /All recent runs/i });
}

async function getProjectButtons(page) {
  const byDataHook = page.locator('[data-perf-id^="sidebar-project:"]');
  const hookedCount = await byDataHook.count();
  if (hookedCount > 0) {
    return {
      count: hookedCount,
      first: byDataHook.first(),
    };
  }

  const buttons = page.locator('.web-explorer__sidebar-list > button');
  const count = await buttons.count();
  return {
    count: Math.max(0, count - 1),
    first: count > 1 ? buttons.nth(1) : null,
  };
}

async function getRunRows(page) {
  const byDataHook = page.locator('[data-perf-id^="run-row:"]');
  const hookedCount = await byDataHook.count();
  if (hookedCount > 0) {
    return {
      count: hookedCount,
      first: byDataHook.first(),
    };
  }

  const rows = page.locator('.web-explorer-table__row, a[href^="/runs/"]');
  const count = await rows.count();
  return {
    count,
    first: count > 0 ? rows.first() : null,
  };
}

async function getSidebarButtonTitle(locator) {
  const titleNode = locator.locator('.web-explorer__sidebar-title');
  if (await titleNode.count() > 0) {
    return ((await titleNode.first().textContent()) || '').trim();
  }

  return ((await locator.textContent()) || '').trim();
}

function getRunIdFromUrl(url) {
  const match = String(url).match(/\/runs\/([^/?#]+)/);
  return match ? match[1] : null;
}

async function navigateByHrefWithFallback(page, linkLocator, urlPattern) {
  const href = await linkLocator.getAttribute('href');
  const start = performance.now();
  let mode = 'click';

  await linkLocator.click();

  try {
    await page.waitForURL(urlPattern, { timeout: 2_000 });
  } catch {
    if (!href) {
      throw new Error(`Navigation target did not change and no href was available for ${String(urlPattern)}.`);
    }

    mode = 'direct-route-fallback';
    await page.goto(href);
    await page.waitForURL(urlPattern, { timeout: 45_000 });
  }

  return {
    durationMs: round(performance.now() - start),
    href,
    mode,
  };
}

async function resolveBenchmarkProjectSlug(page, fallbackTitle = null) {
  const projectButton = page.locator('[data-project-slug]').first();
  if (await projectButton.count() > 0) {
    return projectButton.getAttribute('data-project-slug');
  }

  const projects = await page.evaluate(() => {
    const nextDataNode = document.getElementById('__NEXT_DATA__');
    if (!nextDataNode?.textContent) {
      return [];
    }

    try {
      const parsed = JSON.parse(nextDataNode.textContent);
      return Array.isArray(parsed?.props?.pageProps?.data?.projects) ? parsed.props.pageProps.data.projects : [];
    } catch {
      return [];
    }
  });

  if (fallbackTitle) {
    const normalizedTitle = fallbackTitle.trim().toLowerCase();
    const matchedProject = projects.find((project) => {
      const name = String(project?.name || '').trim().toLowerCase();
      const repositoryUrl = String(project?.repositoryUrl || '').trim().toLowerCase();
      return name === normalizedTitle || repositoryUrl.includes(normalizedTitle);
    });
    if (matchedProject?.slug) {
      return matchedProject.slug;
    }
  }

  return projects[0]?.slug || null;
}
