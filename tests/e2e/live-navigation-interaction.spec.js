import { test, expect } from '@playwright/test';

const runLinkSelector = '.web-list__item[href^="/runs/"], a.web-list__item[href^="/runs/"], a[href^="/runs/"]';
const projectLinkSelector = '[data-perf-id="run-project-link"], .web-run-detail__header a[href^="/projects/"]';
test.use({ viewport: { width: 1440, height: 1024 } });

test('home run rows navigate to run detail when clicked', async ({ page }) => {
  await goToPublicHome(page);

  const row = await getFirstRunRow(page);
  const runId = await resolveExpectedHomeRunId(page, row);
  test.skip(!runId, 'Unable to resolve a run id for the first home-row interaction check.');

  await row.locator('td').first().click();

  await page.waitForURL(new RegExp(`/runs/${escapeRegExp(runId)}(?:\\?|$)`), { timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'Runner report' })).toBeVisible({ timeout: 45_000 });
});

test('project execution feed run links navigate to run detail when clicked', async ({ page }) => {
  await goToPublicProjectPage(page);

  const runLink = await getFirstProjectRunLink(page);
  const href = await runLink.getAttribute('href');
  const runId = getRunIdFromUrl(href);
  test.skip(!runId, 'Unable to resolve a run id from the first project-feed run link.');

  await runLink.click();

  await page.waitForURL(new RegExp(`/runs/${escapeRegExp(runId)}(?:\\?|$)`), { timeout: 15_000 });
  await expect(page.getByRole('link', { name: 'Runner report' })).toBeVisible({ timeout: 45_000 });
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
  await expect(page.getByText('Execution feed', { exact: true })).toBeVisible({ timeout: 45_000 });
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
  await expect(page.getByText('Execution feed', { exact: true })).toBeVisible({ timeout: 45_000 });

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

  return page.getByRole('button', { name: /All recent runs/i });
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
