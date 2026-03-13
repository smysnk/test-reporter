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
