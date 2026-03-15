const pendingEvents = [];
let isInitialized = false;
let flushIntervalId = null;

function getMeasurementId() {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.__RUNTIME_CONFIG__?.GA_MEASUREMENT_ID || null;
}

function hasGtag() {
  return typeof window !== 'undefined' && typeof window.gtag === 'function';
}

function flushPendingEvents() {
  if (!hasGtag()) {
    return false;
  }

  pendingEvents.splice(0).forEach(({ action, category, label, value }) => {
    window.gtag('event', action, {
      event_category: category,
      event_label: label,
      value,
    });
  });

  return true;
}

export function initializeAnalytics() {
  if (isInitialized || !getMeasurementId() || typeof window === 'undefined') {
    return;
  }

  if (flushPendingEvents()) {
    isInitialized = true;
    return;
  }

  if (flushIntervalId) {
    return;
  }

  flushIntervalId = window.setInterval(() => {
    if (flushPendingEvents()) {
      isInitialized = true;
      window.clearInterval(flushIntervalId);
      flushIntervalId = null;
    }
  }, 200);

  window.setTimeout(() => {
    if (!flushIntervalId) {
      return;
    }
    window.clearInterval(flushIntervalId);
    flushIntervalId = null;
  }, 5000);
}

export function event(action, category, label, value) {
  if (!getMeasurementId()) {
    return;
  }

  if (!isInitialized) {
    pendingEvents.push({ action, category, label, value });
    return;
  }

  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  });
}

export function pageview(url) {
  event('page_view', 'navigation', 'page_path', url);
}
