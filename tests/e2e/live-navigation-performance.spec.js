import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { test, expect } from '@playwright/test';

const benchmarkRecords = [];
const outputRoot = path.resolve(process.cwd(), process.env.TEST_STATION_E2E_OUTPUT_DIR || 'artifacts/e2e-performance');
const baseURL = process.env.TEST_STATION_E2E_BASE_URL || 'https://test-station.smysnk.com';
const enforceBudgets = process.env.TEST_STATION_E2E_ENFORCE_BUDGETS === 'true';
const budgetConfig = {
  homeReadyMs: readBudget('TEST_STATION_E2E_BUDGET_HOME_READY_MS', 1_000),
  evidenceRequestMs: readBudget('TEST_STATION_E2E_BUDGET_EVIDENCE_REQUEST_MS', 750),
  projectFocusMs: readBudget('TEST_STATION_E2E_BUDGET_PROJECT_FOCUS_MS', 1_000),
  clearProjectFocusMs: readBudget('TEST_STATION_E2E_BUDGET_PROJECT_CLEAR_MS', 1_000),
  runNavigationMs: readBudget('TEST_STATION_E2E_BUDGET_RUN_NAVIGATION_MS', 1_000),
  runnerReportReadyMs: readBudget('TEST_STATION_E2E_BUDGET_RUNNER_REPORT_READY_MS', 2_000),
  operationsViewSwitchMs: readBudget('TEST_STATION_E2E_BUDGET_OPERATIONS_VIEW_SWITCH_MS', 1_500),
  projectPageNavigationMs: readBudget('TEST_STATION_E2E_BUDGET_PROJECT_PAGE_NAVIGATION_MS', 1_500),
  suiteExpansionMs: readBudget('TEST_STATION_E2E_BUDGET_SUITE_EXPANSION_MS', 300),
  paginatedTestFetchMs: readBudget('TEST_STATION_E2E_BUDGET_PAGINATED_TEST_FETCH_MS', 500),
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
      interactionLatencyMs: 0,
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
          if (entry.interactionId) perfStore.interactionLatencyMs = Math.max(perfStore.interactionLatencyMs, entry.duration || 0);
        }
      }).observe({ type: 'event', buffered: true, durationThreshold: 16 });
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
  await goToPublicHome(page, { requireInteractive: false });
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
    profiling: await collectProfilingSnapshot(page, 'overview-page-ready'),
  };

  await recordBenchmark(testInfo, record);
  assertBudget('homeReadyMs', record.metrics.homeReadyMs);
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
  const projectFocusProfiling = await collectProfilingSnapshot(page, 'overview-page-ready');

  const clearButton = await getAllRunsButton(page);
  const clearProjectFocusMs = await measureInteraction(
    async () => {
      await clearButton.click();
    },
    async () => {
      await expect(clearButton).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByText('All recent publications', { exact: true })).toBeVisible();
    },
  );
  const clearProjectFocusProfiling = await collectProfilingSnapshot(page, 'overview-page-ready');

  const projectSlug = await resolveBenchmarkProjectSlug(page, projectTitle);
  test.skip(!projectSlug, 'Unable to resolve a project slug for the live benchmark.');
  const projectPageReadyMs = await measureInteraction(
    async () => {
      await page.goto(`/projects/${projectSlug}`);
    },
    async () => {
      await page.waitForURL(new RegExp(`/projects/${escapeRegExp(projectSlug)}$`), { timeout: 45_000 });
      await expect(page.getByText('Test Runs', { exact: true })).toBeVisible({ timeout: 45_000 });
    },
  );
  const projectPageProfiling = await collectProfilingSnapshot(page, 'project-page-ready');

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
    profiling: {
      projectFocus: projectFocusProfiling,
      clearProjectFocus: clearProjectFocusProfiling,
      projectPage: projectPageProfiling,
    },
  };

  await recordBenchmark(testInfo, record);
  assertBudget('projectFocusMs', record.metrics.projectFocusMs);
  assertBudget('clearProjectFocusMs', record.metrics.clearProjectFocusMs);
  assertBudget('projectPageNavigationMs', record.metrics.projectPageReadyMs);
});

test('benchmarks in-context failure evidence without navigating away', async ({ page }, testInfo) => {
  await goToPublicHome(page);
  const failedRow = page.locator('.operations-table__row').filter({ has: page.locator('.web-pill--failed') }).first();
  test.skip(await failedRow.count() === 0, 'No failed public run is visible to benchmark failure evidence.');
  const runId = await failedRow.getAttribute('data-run-id');
  const evidenceRequestMs = await measureInteraction(
    async () => failedRow.click(),
    async () => {
      await expect(page.getByRole('complementary', { name: 'Run inspector' })).toBeVisible();
      await expect(page.locator('.operations-inspector__loading')).toHaveCount(0);
    },
  );
  const record = {
    scenario: 'failure-evidence-selection',
    route: page.url(),
    metrics: {
      evidenceRequestMs,
      ...await collectBrowserMetrics(page),
    },
    context: {
      runId,
      inspectorError: await page.locator('.operations-inspector__error').count() > 0,
      inspectorHasEvidence: await page.locator('.operations-inspector__test-name').count() > 0,
    },
    profiling: await collectProfilingSnapshot(page, 'overview-page-ready'),
  };

  await recordBenchmark(testInfo, record);
  assertBudget('evidenceRequestMs', record.metrics.evidenceRequestMs);
});

test('benchmarks runner report readiness, operations view, and project-page navigation', async ({ page }, testInfo) => {
  await goToPublicHome(page);
  const projectSlug = await resolveBenchmarkProjectSlug(page);
  test.skip(!projectSlug, 'Unable to resolve a project slug for the live benchmark.');

  await page.goto(`/projects/${projectSlug}`);
  await page.waitForURL(new RegExp(`/projects/${escapeRegExp(projectSlug)}$`), { timeout: 45_000 });

  const runLink = page.locator('[data-perf-id^="project-run-link:"]').first();
  await expect(runLink).toBeVisible({ timeout: 45_000 });
  const runNavigation = await navigateByHrefWithFallback(page, runLink, /\/runs\/[^/?#]+$/);
  await expect(page.getByRole('link', { name: 'Runner report', exact: true })).toBeVisible();
  const runPageProfiling = await collectProfilingSnapshot(page, 'run-page-ready');
  const runId = getRunIdFromUrl(page.url());

  const runnerFrame = page.frameLocator('iframe.web-runner-frame');
  const runnerReportReadyMs = await measureInteraction(
    async () => {},
    async () => {
      await expect(page.locator('iframe.web-runner-frame')).toBeVisible();
      await expect(runnerFrame.locator('main')).toBeVisible();
    },
  );
  const runnerReportProfiling = await collectProfilingSnapshot(page, 'runner-frame-height-ready');

  const operationsViewLink = page.getByRole('link', { name: 'Operations view' });
  const operationsReadyStart = performance.now();
  const operationsNavigation = await navigateByHrefWithFallback(
    page,
    operationsViewLink,
    new RegExp(`/runs/${escapeRegExp(runId)}\\?template=web`),
  );
  await expect(page.getByText('Run-to-run comparison', { exact: true })).toBeVisible();
  const operationsViewSwitchMs = round(performance.now() - operationsReadyStart);
  const operationsProfiling = await collectProfilingSnapshot(page, 'run-operations-ready');
  const suiteLoadButton = page.getByRole('button', { name: 'Load tests' }).first();
  let suiteExpansionMs = null;
  let paginatedTestFetchMs = null;
  let renderedTestRows = 0;
  if (await suiteLoadButton.count() > 0) {
    suiteExpansionMs = await measureInteraction(
      async () => suiteLoadButton.click(),
      async () => {
        await expect(page.getByRole('button', { name: 'Collapse tests' }).first()).toBeVisible();
        await expect(page.getByText('Loading tests…', { exact: true })).toHaveCount(0);
      },
    );
    const nextPageButton = page.getByRole('button', { name: /Load next 100/ }).first();
    if (await nextPageButton.count() > 0) {
      paginatedTestFetchMs = await measureInteraction(
        async () => nextPageButton.click(),
        async () => {
          await expect(page.getByRole('button', { name: /Loading more/ })).toHaveCount(0);
          await expect(page.getByRole('list', { name: '200 loaded tests' })).toBeVisible();
        },
      );
    }
    renderedTestRows = await page.locator('.web-list .web-list .web-list__item').count();
  }

  const projectLink = page.locator('[data-perf-id="run-project-link"], .web-run-detail__header a[href^="/projects/"]').first();
  const projectNavigation = await navigateByHrefWithFallback(page, projectLink, /\/projects\/[^/?#]+$/);
  await expect(page.getByText('Test Runs', { exact: true })).toBeVisible({ timeout: 45_000 });
  const projectPageProfiling = await collectProfilingSnapshot(page, 'project-page-ready');

  const record = {
    scenario: 'run-and-project-navigation',
    route: page.url(),
    metrics: {
      runNavigationMs: runNavigation.durationMs,
      runnerReportReadyMs,
      operationsViewSwitchMs,
      suiteExpansionMs,
      paginatedTestFetchMs,
      projectPageNavigationMs: projectNavigation.durationMs,
      ...await collectBrowserMetrics(page),
    },
    context: {
      runId,
      runNavigationMode: runNavigation.mode,
      operationsViewSwitchMode: operationsNavigation.mode,
      renderedTestRows,
      projectPageNavigationMode: projectNavigation.mode,
    },
    profiling: {
      runPage: runPageProfiling,
      runnerReport: runnerReportProfiling,
      operationsView: operationsProfiling,
      projectPage: projectPageProfiling,
    },
  };

  await recordBenchmark(testInfo, record);
  assertBudget('runNavigationMs', record.metrics.runNavigationMs);
  assertBudget('runnerReportReadyMs', record.metrics.runnerReportReadyMs);
  assertBudget('operationsViewSwitchMs', record.metrics.operationsViewSwitchMs);
  if (Number.isFinite(record.metrics.suiteExpansionMs)) assertBudget('suiteExpansionMs', record.metrics.suiteExpansionMs);
  if (Number.isFinite(record.metrics.paginatedTestFetchMs)) assertBudget('paginatedTestFetchMs', record.metrics.paginatedTestFetchMs);
  assertBudget('projectPageNavigationMs', record.metrics.projectPageNavigationMs);
});

async function goToPublicHome(page, { requireInteractive = true } = {}) {
  await page.goto('/', { waitUntil: 'commit' });

  if (page.url().includes('/auth/signin')) {
    test.skip(true, 'Live performance benchmarks require public pages or a pre-authenticated storage state.');
  }

  const allRunsButton = await getAllRunsButton(page);
  await expect(allRunsButton).toBeVisible();
  if (requireInteractive) {
    await expect(page.locator('[data-page-interactive="true"]')).toBeVisible({ timeout: 45_000 });
  }
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
    const resources = performance.getEntriesByType('resource');
    const selectedResources = resources.filter((entry) => entry.name.includes('/graphql')
      || entry.name.includes('/_next/data/')
      || entry.name.includes('/api/runs/')
      || entry.name.includes('/api/projects/'));
    const resourceBytes = (entries, field) => entries.reduce((total, entry) => total + (Number(entry[field]) || 0), 0);

    return {
      timeToFirstByteMs: roundMetric(nav?.responseStart),
      responseEndMs: roundMetric(nav?.responseEnd),
      domContentLoadedMs: roundMetric(nav?.domContentLoadedEventEnd),
      loadEventMs: roundMetric(nav?.loadEventEnd),
      firstContentfulPaintMs: roundMetric(firstContentfulPaint?.startTime),
      largestContentfulPaintMs: roundMetric(perfStore.lcp),
      cumulativeLayoutShift: roundMetric(perfStore.cls, 4),
      longTaskCount: Number.isFinite(perfStore.longTaskCount) ? perfStore.longTaskCount : 0,
      longTaskDurationMs: roundMetric(perfStore.longTaskDurationMs),
      interactionLatencyMs: roundMetric(perfStore.interactionLatencyMs),
      decodedBodySizeBytes: Number.isFinite(nav?.decodedBodySize) ? nav.decodedBodySize : null,
      transferSizeBytes: Number.isFinite(nav?.transferSize) ? nav.transferSize : null,
      domNodeCount: document.getElementsByTagName('*').length,
      jsHeapUsedBytes: Number.isFinite(performance.memory?.usedJSHeapSize) ? performance.memory.usedJSHeapSize : null,
      resourceRequestCount: selectedResources.length,
      resourceTransferSizeBytes: resourceBytes(selectedResources, 'transferSize'),
      resourceDecodedBodySizeBytes: resourceBytes(selectedResources, 'decodedBodySize'),
      graphqlRequestCount: selectedResources.filter((entry) => entry.name.includes('/graphql')).length,
      graphqlTransferSizeBytes: resourceBytes(selectedResources.filter((entry) => entry.name.includes('/graphql')), 'transferSize'),
      bffRequestCount: selectedResources.filter((entry) => entry.name.includes('/api/runs/') || entry.name.includes('/api/projects/')).length,
      bffTransferSizeBytes: resourceBytes(selectedResources.filter((entry) => entry.name.includes('/api/runs/') || entry.name.includes('/api/projects/')), 'transferSize'),
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

async function collectProfilingSnapshot(page, expectedMarkName = null) {
  return page.evaluate((markName) => {
    const perfStore = window.__TEST_STATION_PERF__ || {};
    const nextDataNode = document.getElementById('__NEXT_DATA__');
    let nextPageProfile = null;

    if (nextDataNode?.textContent) {
      try {
        const parsed = JSON.parse(nextDataNode.textContent);
        nextPageProfile = parsed?.props?.pageProps?.pageProfile || null;
      } catch {}
    }

    const recentPageMarks = Array.isArray(perfStore.pageMarks)
      ? perfStore.pageMarks.slice(-12)
      : [];
    const recentRouteTransitions = Array.isArray(perfStore.routeTransitions)
      ? perfStore.routeTransitions.slice(-6).map((entry) => ({
        id: entry.id,
        from: entry.from,
        to: entry.to,
        status: entry.status,
        durationMs: roundMetric(entry.durationMs),
        details: entry.details || null,
        completionDetails: entry.completionDetails || null,
        error: entry.error || null,
        marks: Array.isArray(entry.marks) ? entry.marks : [],
        pageMarks: Array.isArray(entry.pageMarks) ? entry.pageMarks : [],
      }))
      : [];
    const recentResources = performance.getEntriesByType('resource')
      .filter((entry) => {
        return entry.name.includes('/graphql')
          || entry.name.includes('/_next/data/')
          || entry.name.includes('/api/runs/');
      })
      .slice(-20)
      .map((entry) => ({
        name: toRelativeResourceName(entry.name),
        initiatorType: entry.initiatorType || null,
        startTimeMs: roundMetric(entry.startTime),
        responseEndMs: roundMetric(entry.responseEnd),
        durationMs: roundMetric(entry.duration),
        transferSizeBytes: Number.isFinite(entry.transferSize) ? entry.transferSize : null,
        encodedBodySizeBytes: Number.isFinite(entry.encodedBodySize) ? entry.encodedBodySize : null,
        decodedBodySizeBytes: Number.isFinite(entry.decodedBodySize) ? entry.decodedBodySize : null,
      }));

    return {
      serverPageProfile: perfStore.serverPageProfile || nextPageProfile,
      currentPageTrace: perfStore.currentPageTrace || nextPageProfile?.trace || null,
      matchingPageMark: markName
        ? [...recentPageMarks].reverse().find((entry) => entry.name === markName) || null
        : null,
      recentPageMarks,
      recentRequestTraces: Array.isArray(perfStore.requestTraces)
        ? perfStore.requestTraces.slice(-12)
        : [],
      recentRouteTransitions,
      recentResources,
      resourceSummary: {
        graphqlRequests: recentResources.filter((entry) => entry.name.includes('/graphql')),
        nextDataRequests: recentResources.filter((entry) => entry.name.includes('/_next/data/')),
        runnerReportRequests: recentResources.filter((entry) => entry.name.includes('/api/runs/')),
      },
    };

    function toRelativeResourceName(name) {
      try {
        const resourceUrl = new URL(name, window.location.origin);
        return `${resourceUrl.pathname}${resourceUrl.search}`;
      } catch {
        return name;
      }
    }

    function roundMetric(value, precision = 1) {
      if (!Number.isFinite(value)) {
        return null;
      }

      const factor = 10 ** precision;
      return Math.round(value * factor) / factor;
    }
  }, expectedMarkName);
}

async function recordBenchmark(testInfo, record) {
  benchmarkRecords.push(record);
  await testInfo.attach(`${record.scenario}.json`, {
    body: Buffer.from(`${JSON.stringify(record, null, 2)}\n`),
    contentType: 'application/json',
  });
}

function assertBudget(metricName, durationMs) {
  if (!enforceBudgets) {
    return;
  }
  const budget = budgetConfig[metricName];
  if (!Number.isFinite(budget)) {
    return;
  }

  expect(durationMs, `${metricName} exceeded its configured budget of ${budget}ms`).toBeLessThanOrEqual(budget);
}

function readBudget(name, fallback) {
  const raw = process.env[name];
  if (!raw) {
    return fallback;
  }

  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
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
  if (process.env.TEST_STATION_BENCHMARK_PROJECT_SLUG) return process.env.TEST_STATION_BENCHMARK_PROJECT_SLUG;
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
