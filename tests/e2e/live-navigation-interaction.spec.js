import { test, expect } from '@playwright/test';

const runLinkSelector = '.web-list__item[href^="/runs/"], a.web-list__item[href^="/runs/"], a[href^="/runs/"]';
const projectLinkSelector = '[data-perf-id="run-project-link"], .web-run-detail__header a[href^="/projects/"]';
test.use({ viewport: { width: 1440, height: 1024 } });

test('home run rows open the in-context inspector and retain a run-detail action', async ({ page }) => {
  await goToPublicHome(page);

  const row = await getFirstRunRow(page);
  const runId = await resolveExpectedHomeRunId(page, row);
  test.skip(!runId, 'Unable to resolve a run id for the first home-row interaction check.');

  await row.locator('td').nth(1).click();

  await page.waitForURL(new RegExp(`/?\\?(?:.*&)?inspectRun=${escapeRegExp(runId)}(?:&.*)?$`), { timeout: 15_000 });
  const inspector = page.getByRole('complementary', { name: 'Run inspector' });
  await expect(inspector).toBeVisible();
  await inspector.getByRole('link', { name: 'Open run', exact: true }).click();

  await page.waitForURL(new RegExp(`/runs/${escapeRegExp(runId)}(?:\\?|$)`), { timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'Runner report', exact: true })).toBeVisible({ timeout: 45_000 });
});

test('overview filters and activity cells remain composable in URL state', async ({ page }) => {
  await goToPublicHome(page);

  await page.getByRole('button', { name: 'Activity', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Activity', exact: true })).toBeVisible();
  const activityCell = page.locator('.operations-activity__cell').first();
  test.skip(await activityCell.count() === 0, 'No public activity bucket is available for URL-state checks.');
  await activityCell.click();
  await expect(page).toHaveURL(/[?&]project=[^&]+/);
  await expect(page).toHaveURL(/[?&]day=\d{4}-\d{2}-\d{2}/);

  await page.getByLabel('Filter by status').selectOption('failed');
  await expect(page).toHaveURL(/[?&]status=failed/);
  await page.getByLabel('Search publications').fill('main');
  await expect(page).toHaveURL(/[?&]search=main/);

  await page.locator('.operations-active-filters button').filter({ hasText: /^\d{4}-\d{2}-\d{2} ×$/ }).click();
  await expect(page).not.toHaveURL(/[?&]day=/);
  await expect(page).toHaveURL(/[?&]project=[^&]+/);
  await expect(page).toHaveURL(/[?&]status=failed/);
  await expect(page).toHaveURL(/[?&]search=main/);
});

test('closing the run inspector restores focus to its selected row', async ({ page }) => {
  await goToPublicHome(page);
  const row = await getFirstRunRow(page);
  const runId = await resolveExpectedHomeRunId(page, row);
  test.skip(!runId, 'Unable to resolve a run id for the focus-restoration check.');

  await row.locator('td').nth(1).click();
  await expect(page.getByRole('complementary', { name: 'Run inspector' })).toBeVisible();
  await page.getByRole('button', { name: 'Close run inspector' }).click();
  await expect(page).not.toHaveURL(/[?&]inspectRun=/);
  await expect(row).toBeFocused();
});

test('project execution feed run links navigate to run detail when clicked', async ({ page }) => {
  await goToPublicProjectPage(page);

  const runLink = await getFirstProjectRunLink(page);
  const href = await runLink.getAttribute('href');
  const runId = getRunIdFromUrl(href);
  test.skip(!runId, 'Unable to resolve a run id from the first project-feed run link.');

  await runLink.click();

  await page.waitForURL(new RegExp(`/runs/${escapeRegExp(runId)}(?:\\?|$)`), { timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'Runner report', exact: true })).toBeVisible({ timeout: 45_000 });
});

test('run detail operations switch navigates to the operations view when clicked', async ({ page }) => {
  const { runId } = await openRunDetailFromPublicProject(page);
  test.skip(!runId, 'Unable to resolve a run id for the operations-view interaction check.');

  const operationsViewLink = page.getByRole('link', { name: 'Operations view' });
  await expect(operationsViewLink).toBeVisible();
  await operationsViewLink.click();

  await page.waitForURL(new RegExp(`/runs/${escapeRegExp(runId)}\\?(?:.*&)?template=web(?:&.*)?$`), { timeout: 15_000 });
  await expect(page.getByText('Run-to-run comparison', { exact: true })).toBeVisible({ timeout: 45_000 });
});

test('run detail project links navigate back to the project page when clicked', async ({ page }) => {
  const { projectSlug } = await openRunDetailFromPublicProject(page);
  test.skip(!projectSlug, 'Unable to resolve a project slug for the run-to-project interaction check.');

  const projectLink = page.locator(projectLinkSelector).first();
  await expect(projectLink).toBeVisible();
  await projectLink.click();

  await page.waitForURL(new RegExp(`/projects/${escapeRegExp(projectSlug)}(?:\\?|$)`), { timeout: 15_000 });
  await expect(page.getByText('Test Runs', { exact: true })).toBeVisible({ timeout: 45_000 });
});

async function goToPublicHome(page) {
  await page.goto('/');
  await page.waitForLoadState('domcontentloaded');

  if (page.url().includes('/auth/signin')) {
    test.skip(true, 'Live interaction checks require public pages or a pre-authenticated storage state.');
  }

  const allRunsButton = await getAllRunsButton(page);
  await expect(allRunsButton).toBeVisible();

  const row = await getFirstRunRow(page);
  await expect(row).toBeVisible();
}

async function goToPublicProjectPage(page) {
  await goToPublicHome(page);

  const projectSlug = await resolvePublicProjectSlug(page);
  test.skip(!projectSlug, 'Unable to resolve a public project slug for the live interaction checks.');

  await page.goto(`/projects/${projectSlug}`);
  await page.waitForURL(new RegExp(`/projects/${escapeRegExp(projectSlug)}(?:\\?|$)`), { timeout: 45_000 });
  await expect(page.getByText('Test Runs', { exact: true })).toBeVisible({ timeout: 45_000 });

  return projectSlug;
}

async function openRunDetailFromPublicProject(page) {
  const projectSlug = await goToPublicProjectPage(page);
  const runLink = await getFirstProjectRunLink(page);
  const href = await runLink.getAttribute('href');
  const runId = getRunIdFromUrl(href);
  test.skip(!href || !runId, 'Unable to resolve a run detail route for the interaction checks.');

  await page.goto(href);
  await page.waitForURL(new RegExp(`/runs/${escapeRegExp(runId)}(?:\\?|$)`), { timeout: 45_000 });
  await expect(page.getByRole('link', { name: 'Operations view' })).toBeVisible({ timeout: 45_000 });

  return { projectSlug, runId };
}

async function getAllRunsButton(page) {
  const byDataHook = page.locator('[data-perf-id="sidebar-all-runs"]');
  if (await byDataHook.count() > 0) {
    return byDataHook.first();
  }

  return page.getByRole('button', { name: /All (?:projects|recent runs)/i });
}

async function getFirstRunRow(page) {
  const byDataHook = page.locator('[data-perf-id^="run-row:"]');
  if (await byDataHook.count() > 0) {
    return byDataHook.first();
  }

  const rows = page.locator('.web-explorer-table__row, a[href^="/runs/"]');
  test.skip(await rows.count() === 0, 'No public home-page run rows are visible to click.');
  return rows.first();
}

async function getFirstProjectRunLink(page) {
  await page.getByText('Loading project activity…', { exact: true })
    .waitFor({ state: 'hidden', timeout: 45_000 })
    .catch(() => {});
  const runLink = page.locator(runLinkSelector).first();
  test.skip(await runLink.count() === 0, 'No project execution-feed run links are visible to click.');
  await expect(runLink).toBeVisible();
  return runLink;
}

async function resolveExpectedHomeRunId(page, row) {
  const dataRunId = await row.getAttribute('data-run-id');
  if (dataRunId) {
    return dataRunId;
  }

  const perfId = await row.getAttribute('data-perf-id');
  const perfIdMatch = String(perfId || '').match(/^run-row:(.+)$/);
  if (perfIdMatch?.[1]) {
    return perfIdMatch[1];
  }

  const nestedRunLink = row.locator('a[href^="/runs/"]').first();
  if (await nestedRunLink.count() > 0) {
    return getRunIdFromUrl(await nestedRunLink.getAttribute('href'));
  }

  const runs = await page.evaluate(() => {
    const nextDataNode = document.getElementById('__NEXT_DATA__');
    if (!nextDataNode?.textContent) {
      return [];
    }

    try {
      const parsed = JSON.parse(nextDataNode.textContent);
      return Array.isArray(parsed?.props?.pageProps?.data?.runs) ? parsed.props.pageProps.data.runs : [];
    } catch {
      return [];
    }
  });

  return runs[0]?.id || null;
}

async function resolvePublicProjectSlug(page) {
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

  return projects[0]?.slug || null;
}

function getRunIdFromUrl(url) {
  const match = String(url || '').match(/\/runs\/([^/?#]+)/);
  return match ? match[1] : null;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
