export const RUNNER_REPORT_HEIGHT_MESSAGE_TYPE = 'test-station:runner-report-height';

const EMBED_BASE_TAG = '<base target="_blank" />';
const EMBED_RESIZE_SCRIPT = `<script>
(() => {
  const messageType = '${RUNNER_REPORT_HEIGHT_MESSAGE_TYPE}';

  const postHeight = () => {
    const root = document.documentElement;
    const body = document.body;
    const height = Math.max(
      root?.scrollHeight || 0,
      body?.scrollHeight || 0,
      root?.offsetHeight || 0,
      body?.offsetHeight || 0,
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
      if (document.body) {
        observer.observe(document.body);
      }
    }, { once: true });
  }

  window.setTimeout(postHeight, 0);
})();
</script>`;

export function prepareEmbeddedRunnerReport(report) {
  const clonedReport = cloneJson(report);
  if (!clonedReport || typeof clonedReport !== 'object') {
    return report;
  }

  const packages = Array.isArray(clonedReport.packages) ? clonedReport.packages : [];
  for (const packageEntry of packages) {
    const suites = Array.isArray(packageEntry?.suites) ? packageEntry.suites : [];
    for (const suite of suites) {
      suite.rawArtifacts = Array.isArray(suite?.rawArtifacts)
        ? suite.rawArtifacts.map((artifact) => normalizeEmbeddedArtifact(artifact))
        : [];
    }
  }

  return clonedReport;
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
