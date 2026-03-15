import {
  TRACE_COOKIE_NAME,
  buildTraceHeaders,
  createChildTraceContext,
  generateTraceIdentifier,
  serializeTraceCookie,
} from '../../../config/request-trace.mjs';

function nowMs() {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
}

function roundMetric(value, precision = 1) {
  if (!Number.isFinite(value)) {
    return null;
  }

  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function sanitizeServerTimingName(name) {
  const sanitized = String(name || 'step')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return sanitized || 'step';
}

function limitList(list, maxLength) {
  if (!Array.isArray(list) || list.length <= maxLength) {
    return list;
  }

  list.splice(0, list.length - maxLength);
  return list;
}

function getCurrentBrowserRoute() {
  if (typeof window === 'undefined' || !window.location) {
    return null;
  }

  const { pathname = '', search = '', hash = '' } = window.location;
  return `${pathname}${search}${hash}`;
}

export function createPageLoadProfiler({ pageType, route = null } = {}) {
  const startedAt = nowMs();
  const steps = [];

  return {
    async measureStep(name, fn, details = null) {
      const stepStartedAt = nowMs();
      let result;
      try {
        result = await fn();
        return result;
      } finally {
        steps.push({
          name,
          startMs: roundMetric(stepStartedAt - startedAt),
          durationMs: roundMetric(nowMs() - stepStartedAt),
          details: typeof details === 'function' ? details(result) : (details || null),
        });
      }
    },
    finalize(extra = {}) {
      return {
        pageType: pageType || 'unknown',
        route,
        totalMs: roundMetric(nowMs() - startedAt),
        steps: steps.map((step) => ({
          ...step,
          details: step.details || null,
        })),
        ...extra,
      };
    },
  };
}

export function buildServerTimingHeader(pageProfile) {
  if (!pageProfile || !Array.isArray(pageProfile.steps)) {
    return '';
  }

  const headerEntries = [];
  if (Number.isFinite(pageProfile.totalMs)) {
    headerEntries.push(`${sanitizeServerTimingName(pageProfile.pageType || 'page')};dur=${pageProfile.totalMs}`);
  }

  for (const step of pageProfile.steps) {
    if (!Number.isFinite(step?.durationMs)) {
      continue;
    }

    headerEntries.push(`${sanitizeServerTimingName(step.name)};dur=${step.durationMs}`);
  }

  return headerEntries.join(', ');
}

export function ensureClientProfilerStore() {
  if (typeof window === 'undefined') {
    return null;
  }

  const store = window.__TEST_STATION_PERF__ = window.__TEST_STATION_PERF__ || {};
  if (!Array.isArray(store.routeTransitions)) {
    store.routeTransitions = [];
  }
  if (!Array.isArray(store.pageMarks)) {
    store.pageMarks = [];
  }
  if (!Array.isArray(store.requestTraces)) {
    store.requestTraces = [];
  }
  if (!Number.isInteger(store.routeTransitionSequence)) {
    store.routeTransitionSequence = 0;
  }
  if (!Object.prototype.hasOwnProperty.call(store, 'serverPageProfile')) {
    store.serverPageProfile = null;
  }
  if (!Object.prototype.hasOwnProperty.call(store, 'currentPageTrace')) {
    store.currentPageTrace = null;
  }

  return store;
}

export function setClientServerPageProfile(pageProfile) {
  const store = ensureClientProfilerStore();
  if (!store) {
    return null;
  }

  store.serverPageProfile = pageProfile || null;
  store.currentPageTrace = pageProfile?.trace || null;
  if (pageProfile?.trace) {
    store.requestTraces.push({
      type: 'page-response',
      route: pageProfile.route || getCurrentBrowserRoute(),
      trace: pageProfile.trace,
      serverTiming: pageProfile.serverTiming || null,
      pageType: pageProfile.pageType || null,
      totalMs: pageProfile.totalMs || null,
    });
    limitList(store.requestTraces, 40);
  }
  return store.serverPageProfile;
}

export function beginClientRouteProfile(url, details = null) {
  const store = ensureClientProfilerStore();
  if (!store) {
    return null;
  }

  const absoluteStartMs = nowMs();
  const traceId = generateTraceIdentifier('trace');
  const routeTransition = {
    id: store.routeTransitionSequence + 1,
    from: getCurrentBrowserRoute(),
    to: url || null,
    traceId,
    status: 'pending',
    startedAtMs: roundMetric(absoluteStartMs),
    durationMs: null,
    marks: [],
    pageMarks: [],
    details: details || null,
    absoluteStartMs,
  };

  store.routeTransitionSequence = routeTransition.id;
  store.activeRouteTransition = routeTransition;
  store.routeTransitions.push(routeTransition);
  limitList(store.routeTransitions, 25);
  if (typeof document !== 'undefined') {
    document.cookie = serializeTraceCookie(traceId);
  }
  return routeTransition;
}

export function recordClientRouteStage(name, details = null) {
  const store = ensureClientProfilerStore();
  const activeTransition = store?.activeRouteTransition;
  if (!activeTransition) {
    return null;
  }

  const mark = {
    name,
    atMs: roundMetric(nowMs() - activeTransition.absoluteStartMs),
    details: details || null,
  };
  activeTransition.marks.push(mark);
  limitList(activeTransition.marks, 20);
  return mark;
}

export function completeClientRouteProfile(url, details = null) {
  const store = ensureClientProfilerStore();
  const activeTransition = store?.activeRouteTransition;
  if (!activeTransition) {
    return null;
  }

  if (url) {
    activeTransition.to = url;
  }
  if (details) {
    activeTransition.completionDetails = details;
  }

  activeTransition.durationMs = roundMetric(nowMs() - activeTransition.absoluteStartMs);
  activeTransition.status = 'completed';
  delete activeTransition.absoluteStartMs;
  store.activeRouteTransition = null;
  return activeTransition;
}

export function failClientRouteProfile(url, error = null) {
  const store = ensureClientProfilerStore();
  const activeTransition = store?.activeRouteTransition;
  if (!activeTransition) {
    return null;
  }

  if (url) {
    activeTransition.to = url;
  }

  activeTransition.durationMs = roundMetric(nowMs() - activeTransition.absoluteStartMs);
  activeTransition.status = 'error';
  activeTransition.error = error
    ? {
      cancelled: error.cancelled === true,
      message: error.message || String(error),
    }
    : null;
  delete activeTransition.absoluteStartMs;
  store.activeRouteTransition = null;
  return activeTransition;
}

export function recordClientPageMark(name, details = null) {
  const store = ensureClientProfilerStore();
  if (!store) {
    return null;
  }

  const activeTransition = store.activeRouteTransition || null;
  const pageMark = {
    name,
    route: getCurrentBrowserRoute(),
    documentMs: roundMetric(nowMs()),
    routeMs: activeTransition ? roundMetric(nowMs() - activeTransition.absoluteStartMs) : null,
    details: details || null,
  };

  store.pageMarks.push(pageMark);
  limitList(store.pageMarks, 40);
  if (activeTransition) {
    activeTransition.pageMarks.push(pageMark);
    limitList(activeTransition.pageMarks, 20);
  }
  return pageMark;
}

export function createClientRequestTrace(details = null) {
  const store = ensureClientProfilerStore();
  if (!store) {
    return null;
  }

  const activeTransition = store.activeRouteTransition || null;
  const currentPageTrace = store.currentPageTrace || null;
  const traceContext = createChildTraceContext({
    requestId: currentPageTrace?.requestId || null,
    traceId: activeTransition?.traceId || currentPageTrace?.traceId || generateTraceIdentifier('trace'),
    parentRequestId: currentPageTrace?.parentRequestId || null,
  }, {
    requestIdPrefix: 'webapi',
  });

  return {
    traceContext,
    headers: buildTraceHeaders(traceContext),
    details: details || null,
  };
}

export function recordClientRequestTrace(entry) {
  const store = ensureClientProfilerStore();
  if (!store) {
    return null;
  }

  store.requestTraces.push({
    ...entry,
    route: getCurrentBrowserRoute(),
    recordedAtMs: roundMetric(nowMs()),
  });
  limitList(store.requestTraces, 40);
  return store.requestTraces[store.requestTraces.length - 1] || null;
}

export { TRACE_COOKIE_NAME };
