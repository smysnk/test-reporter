import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 1024 } });

test('project benchmark dashboard renders namespace and metric drill-downs', async ({ page }) => {
  const projectSlug = await resolveBenchmarkProjectSlug(page);
  test.skip(!projectSlug, 'Unable to resolve a public project with benchmark data.');

  await page.goto(`/projects/${projectSlug}`);
  await page.waitForURL(new RegExp(`/projects/${escapeRegExp(projectSlug)}(?:\\?|$)`), { timeout: 45_000 });

  const topChanges = page.locator('[data-perf-id="benchmark-top-changes"]');
  const namespaceCards = page.locator('[data-perf-id^="benchmark-namespace:"]');
  const metricCards = page.locator('[data-perf-id^="benchmark-metric:"]');
  const detailInspector = page.locator('[data-perf-id="benchmark-detail-inspector"]');

  await expect(topChanges).toBeVisible({ timeout: 45_000 });
  test.skip(await namespaceCards.count() === 0, 'Benchmark dashboard rendered without namespace cards.');
  await expect(namespaceCards.first()).toBeVisible();
  await namespaceCards.first().click();
  await expect(metricCards.first()).toBeVisible();
  await expect(detailInspector).toBeVisible();
});

test('benchmark dashboard run links lead to the run benchmark movement view', async ({ page }) => {
  const projectSlug = await resolveBenchmarkProjectSlug(page);
  test.skip(!projectSlug, 'Unable to resolve a public project with benchmark data.');

  await page.goto(`/projects/${projectSlug}`);
  await page.waitForURL(new RegExp(`/projects/${escapeRegExp(projectSlug)}(?:\\?|$)`), { timeout: 45_000 });

  const runLink = page.locator('[data-perf-id="benchmark-top-changes"] a[href^="/runs/"]').first();
  test.skip(await runLink.count() === 0, 'No benchmark top-change run links are visible.');

  const href = await runLink.getAttribute('href');
  const runId = getRunIdFromUrl(href);
  test.skip(!runId, 'Unable to resolve a run id from the benchmark dashboard.');

  await runLink.click();
  await page.waitForURL(new RegExp(`/runs/${escapeRegExp(runId)}(?:\\?|$)`), { timeout: 45_000 });
  await page.goto(`/runs/${runId}?template=web`);
  await page.waitForURL(new RegExp(`/runs/${escapeRegExp(runId)}\\?template=web(?:&|$)`), { timeout: 45_000 });
  await expect(page.locator('[data-perf-id="run-benchmark-delta"]')).toBeVisible({ timeout: 45_000 });
  await expect(page.getByText('Top regressions', { exact: true })).toBeVisible({ timeout: 45_000 });
});

async function resolveBenchmarkProjectSlug(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  if (page.url().includes('/auth/signin')) {
    test.skip(true, 'Live interaction checks require public benchmark pages or a pre-authenticated storage state.');
  }

  const projectSlugs = await page.evaluate(() => {
    const nextDataNode = document.getElementById('__NEXT_DATA__');
    if (!nextDataNode?.textContent) {
      return [];
    }

    try {
      const parsed = JSON.parse(nextDataNode.textContent);
      return Array.isArray(parsed?.props?.pageProps?.data?.projects)
        ? parsed.props.pageProps.data.projects.map((project) => project?.slug).filter(Boolean)
        : [];
    } catch {
      return [];
    }
  });

  for (const slug of projectSlugs.slice(0, 8)) {
    await page.goto(`/projects/${slug}`);
    await page.waitForLoadState('domcontentloaded');
    if (await page.locator('[data-perf-id^="benchmark-namespace:"]').count() > 0) {
      return slug;
    }
  }

  return null;
}

function getRunIdFromUrl(url) {
  const match = String(url || '').match(/\/runs\/([^/?#]+)/);
  return match ? match[1] : null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
