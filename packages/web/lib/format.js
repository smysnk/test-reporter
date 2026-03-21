export function formatDateTime(value) {
  if (!value) {
    return 'Unavailable';
  }

  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return 'Unavailable';
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export function formatDuration(value) {
  if (!Number.isFinite(value)) {
    return 'Unknown';
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  const seconds = value / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)} s`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = Math.round(seconds % 60);
  return `${minutes}m ${remainder}s`;
}

export function formatCoveragePct(value) {
  return Number.isFinite(value) ? `${Number(value).toFixed(value % 1 === 0 ? 0 : 1)}%` : 'N/A';
}

export function formatCommitSha(value, length = 7) {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'Unknown';
  }

  const normalized = value.trim();
  return normalized.slice(0, Math.max(1, length));
}

export function formatBuildNumber(value) {
  return Number.isFinite(value) ? `build #${Math.trunc(Number(value))}` : 'Build unavailable';
}

export function resolveRunBuildNumber(run) {
  return normalizeBuildNumber(run?.projectVersion?.buildNumber)
    ?? normalizeBuildNumber(run?.buildNumber)
    ?? normalizeBuildNumber(run?.metadata?.source?.buildNumber)
    ?? normalizeBuildNumber(run?.metadata?.source?.environment?.GITHUB_RUN_NUMBER)
    ?? normalizeBuildNumber(run?.metadata?.source?.ci?.environment?.GITHUB_RUN_NUMBER)
    ?? normalizeBuildNumber(run?.rawReport?.meta?.ci?.environment?.GITHUB_RUN_NUMBER);
}

export function formatRunBuildLabel(run) {
  const buildNumber = resolveRunBuildNumber(run);
  if (Number.isFinite(buildNumber)) {
    return formatBuildNumber(buildNumber);
  }

  if (typeof run?.sourceRunId === 'string' && run.sourceRunId.trim() !== '') {
    return `run ${run.sourceRunId.trim()}`;
  }

  return null;
}

export function formatRepositoryName(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'Repository unavailable';
  }

  const normalized = value.trim().replace(/\/+$/, '').replace(/\.git$/i, '');

  try {
    const parsed = new URL(normalized);
    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length >= 2) {
      return `${segments.at(-2)}/${segments.at(-1)}`;
    }
    if (segments.length === 1) {
      return segments[0];
    }
  } catch {
    // fall through to looser path parsing for SCP-like git remotes
  }

  const segments = normalized.split(/[/:]/).filter(Boolean);
  if (segments.length >= 2) {
    return `${segments.at(-2)}/${segments.at(-1)}`;
  }

  return normalized;
}

export function formatStatusLabel(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'unknown';
  }

  return value.replace(/-/g, ' ');
}

export function formatSignedDelta(value) {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }
  const rounded = Number(value).toFixed(value % 1 === 0 ? 0 : 1);
  return `${value > 0 ? '+' : ''}${rounded} pts`;
}

export function formatBenchmarkValue(value, unit = null) {
  if (!Number.isFinite(value)) {
    return 'N/A';
  }

  switch (unit) {
    case 'ms':
      return `${formatRoundedNumber(value)} ms`;
    case 'us':
      return `${formatRoundedNumber(value)} us`;
    case 'bytes':
      return formatBytes(value);
    case 'ops_per_sec':
      return `${formatRoundedNumber(value, Math.abs(value) >= 1000 ? 0 : 1)} ops/s`;
    case 'count':
      return formatRoundedNumber(value, 0);
    default:
      return unit ? `${formatRoundedNumber(value)} ${unit}` : formatRoundedNumber(value);
  }
}

export function formatBenchmarkMetricLabel(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'Metric';
  }

  return value
    .trim()
    .split(/[_\-.]+/g)
    .filter(Boolean)
    .map((token) => token.toUpperCase() === token ? token : `${token[0].toUpperCase()}${token.slice(1)}`)
    .join(' ');
}

export function formatBenchmarkNamespace(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    return 'Benchmark';
  }

  return value
    .trim()
    .replace(/^benchmark\./, '')
    .split('.')
    .map((token) => formatBenchmarkMetricLabel(token))
    .join(' / ');
}

function formatBytes(value) {
  const absolute = Math.abs(value);
  if (absolute >= 1024 * 1024) {
    return `${formatRoundedNumber(value / (1024 * 1024))} MiB`;
  }
  if (absolute >= 1024) {
    return `${formatRoundedNumber(value / 1024)} KiB`;
  }
  return `${formatRoundedNumber(value, 0)} B`;
}

function formatRoundedNumber(value, digits = null) {
  const resolvedDigits = digits ?? (
    Math.abs(value) >= 100
      ? 0
      : Math.abs(value) >= 10
        ? 1
        : 2
  );

  const rounded = Number(value).toFixed(resolvedDigits);
  return resolvedDigits > 0
    ? rounded.replace(/\.0+$/, '').replace(/(\.\d*?)0+$/, '$1')
    : rounded;
}

function normalizeBuildNumber(value) {
  if (value == null || value === '') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}
