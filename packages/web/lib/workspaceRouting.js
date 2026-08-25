import { RUN_WORKSPACE_VIEWS } from './runPresentation.js';

export const PROJECT_WORKSPACE_VIEWS = Object.freeze(['runs', 'coverage', 'performance']);

function first(value) {
  return Array.isArray(value) ? value[0] : value;
}
function optional(value) {
  const normalized = typeof first(value) === 'string' ? first(value).trim() : '';
  return normalized || null;
}

function enumValue(value, allowed, fallback) {
  const normalized = optional(value);
  return normalized && allowed.includes(normalized) ? normalized : fallback;
}

export function parseProjectWorkspaceState(query = {}) {
  return {
    view: enumValue(query.view, PROJECT_WORKSPACE_VIEWS, 'runs'),
    branch: optional(query.branch),
    search: optional(query.search),
    status: optional(query.status),
    after: optional(query.after),
    inspectRun: optional(query.inspectRun),
  };
}

export function parseRunWorkspaceState(query = {}, presentation = null) {
  const availableViews = Array.isArray(presentation?.availableViews) && presentation.availableViews.length
    ? presentation.availableViews
    : ['summary'];
  const fallback = availableViews.includes(presentation?.defaultView)
    ? presentation.defaultView
    : availableViews[0];
  const requestedView = enumValue(query.view, RUN_WORKSPACE_VIEWS, fallback);
  const view = availableViews.includes(requestedView) ? requestedView : fallback;
  return {
    view,
    requestedView: optional(query.view),
    redirected: Boolean(optional(query.view) && optional(query.view) !== view),
    suite: optional(query.suite),
    test: optional(query.test),
    failure: optional(query.failure),
    file: optional(query.file),
    search: optional(query.search),
    status: optional(query.status),
    after: optional(query.after),
    group: enumValue(query.group, ['suite', 'file'], 'suite'),
    scopeType: enumValue(query.scopeType, ['run', 'package', 'module', 'file'], 'run'),
    scopeId: optional(query.scopeId),
    sort: optional(query.sort),
    below: optional(query.below),
    kind: optional(query.kind),
    metric: optional(query.metric),
    series: optional(query.series),
  };
}

export function compactWorkspaceQuery(state = {}) {
  return Object.fromEntries(Object.entries(state)
    .filter(([key, value]) => !['requestedView', 'redirected'].includes(key) && value !== null && value !== undefined && value !== ''));
}

export function buildLegacyRunWorkspaceDestination(runId, query = {}, template = 'runner') {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (key === 'id' || key === 'template' || value === null || value === undefined || value === '') continue;
    for (const entry of Array.isArray(value) ? value : [value]) params.append(key, String(entry));
  }
  params.set('view', template === 'runner' ? 'report' : 'summary');
  return `/runs/${encodeURIComponent(runId)}?${params.toString()}`;
}
