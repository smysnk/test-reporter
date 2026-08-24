export const RUNNER_REPORT_HEIGHT_MESSAGE_TYPE = 'test-station:runner-report-height';

const EMBED_BASE_TAG = '<base target="_blank" />';
const EMBED_RESIZE_SCRIPT = `<script>
(() => {
  const messageType = '${RUNNER_REPORT_HEIGHT_MESSAGE_TYPE}';

  const postHeight = () => {
    const content = document.querySelector('main');
    const root = document.documentElement;
    const height = Math.max(
      Math.ceil(content?.getBoundingClientRect().height || 0),
      content?.scrollHeight || 0,
      root?.clientHeight || 0,
    );

    if (height > 0) {
      window.parent.postMessage({ type: messageType, height }, '*');
    }
  };

  const queueHeight = () => {
    if (typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(postHeight);
      return;
    }

    window.setTimeout(postHeight, 0);
  };

  window.addEventListener('load', queueHeight);
  window.addEventListener('resize', queueHeight);
  document.addEventListener('click', () => window.setTimeout(postHeight, 0), true);
  document.addEventListener('toggle', queueHeight, true);

  if (typeof ResizeObserver === 'function') {
    const observer = new ResizeObserver(queueHeight);
    window.addEventListener('load', () => {
      const content = document.querySelector('main');
      if (content) {
        observer.observe(content);
      } else if (document.body) {
        observer.observe(document.body);
      }
    }, { once: true });
  }

  window.setTimeout(postHeight, 0);
})();
</script>`;

export function prepareEmbeddedRunnerReport(report, { maxTestsPerSuite = null } = {}) {
  const clonedReport = cloneJson(report);
  if (!clonedReport || typeof clonedReport !== 'object') {
    return report;
  }

  const packages = Array.isArray(clonedReport.packages) ? clonedReport.packages : [];
  for (const packageEntry of packages) {
    const suites = Array.isArray(packageEntry?.suites) ? packageEntry.suites : [];
    for (const suite of suites) {
      if (Number.isFinite(maxTestsPerSuite) && maxTestsPerSuite > 0 && Array.isArray(suite?.tests) && suite.tests.length > maxTestsPerSuite) {
        const totalTests = suite.tests.length;
        suite.tests = suite.tests.slice(0, maxTestsPerSuite);
        suite.warnings = [
          ...(Array.isArray(suite.warnings) ? suite.warnings : []),
          `Embedded preview shows ${maxTestsPerSuite} of ${totalTests} tests. Open the full runner report for every row.`,
        ];
      }
      if (Number.isFinite(maxTestsPerSuite) && maxTestsPerSuite > 0 && Array.isArray(suite?.tests)) {
        suite.tests = suite.tests.map(projectEmbeddedTestSummary);
      }
      suite.rawArtifacts = Array.isArray(suite?.rawArtifacts)
        ? suite.rawArtifacts.map((artifact) => normalizeEmbeddedArtifact(artifact))
        : [];
    }
  }

  return clonedReport;
}

function projectEmbeddedTestSummary(test) {
  if (!test || typeof test !== 'object') return test;
  const firstFailure = Array.isArray(test.failureMessages)
    ? normalizeString(test.failureMessages[0]).slice(0, 500)
    : '';
  return {
    id: test.id,
    name: test.name,
    fullName: test.fullName,
    status: test.status,
    durationMs: test.durationMs,
    filePath: test.filePath,
    location: test.location,
    module: test.module,
    failureMessages: firstFailure ? [firstFailure] : [],
    assertions: [],
    setup: [],
    mocks: [],
    rawDetails: {},
    sourceSnippet: null,
  };
}

export function decorateEmbeddedRunnerReportHtml(html) {
  let decorated = typeof html === 'string' ? html : '';

  if (decorated && !decorated.includes(EMBED_BASE_TAG) && decorated.includes('</head>')) {
    decorated = decorated.replace('</head>', `${EMBED_BASE_TAG}\n</head>`);
  }

  if (decorated && !decorated.includes(RUNNER_REPORT_HEIGHT_MESSAGE_TYPE) && decorated.includes('</body>')) {
    decorated = decorated.replace('</body>', `${EMBED_RESIZE_SCRIPT}\n</body>`);
  }

  return decorated;
}

function normalizeEmbeddedArtifact(artifact) {
  if (!artifact || typeof artifact !== 'object') {
    return artifact;
  }

  const sourceUrl = normalizeString(artifact.sourceUrl);
  const href = normalizeString(artifact.href);

  return {
    ...artifact,
    href: sourceUrl || href || null,
  };
}

function normalizeString(value) {
  return typeof value === 'string' && value.trim()
    ? value.trim()
    : '';
}

function cloneJson(value) {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value));
}
