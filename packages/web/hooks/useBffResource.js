import React from 'react';

const resourceCache = new Map();
const inflight = new Map();

async function fetchResource(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  const payload = await response.json().catch(() => null);
  if (!response.ok) throw new Error(payload?.error?.message || `Request failed (${response.status})`);
  return payload && typeof payload === 'object' && 'data' in payload ? payload : { data: payload, meta: {} };
}

export function useBffResource(url, { initialData = null, enabled = true, retain = true } = {}) {
  const [revision, setRevision] = React.useState(0);
  const previousUrl = React.useRef(url);
  const cached = url ? resourceCache.get(url) : null;
  const [state, setState] = React.useState({
    data: cached?.data ?? initialData,
    meta: cached?.meta || null,
    loading: Boolean(url && enabled && !cached && initialData === null),
    stale: false,
    error: null,
  });

  React.useEffect(() => {
    if (!url || !enabled) {
      setState((current) => ({ ...current, loading: false }));
      return undefined;
    }
    const controller = new AbortController();
    const urlChanged = previousUrl.current !== url;
    previousUrl.current = url;
    const nextCached = resourceCache.get(url);
    setState((current) => ({
      ...current,
      data: urlChanged ? nextCached?.data ?? null : current.data,
      meta: urlChanged ? nextCached?.meta ?? null : current.meta,
      loading: true,
      stale: false,
      error: null,
    }));
    let request = inflight.get(url);
    if (!request) {
      request = fetchResource(url, controller.signal).finally(() => inflight.delete(url));
      inflight.set(url, request);
    }
    request.then((resource) => {
      resourceCache.set(url, resource);
      setState({ data: resource.data, meta: resource.meta, loading: false, stale: false, error: null });
    }).catch((error) => {
      if (error?.name === 'AbortError') return;
      setState((current) => ({
        ...current,
        data: retain ? current.data : null,
        loading: false,
        stale: Boolean(retain && current.data),
        error: error instanceof Error ? error.message : 'Unable to load this panel.',
      }));
    });
    return () => controller.abort();
  }, [enabled, retain, revision, url]);

  return { ...state, retry: React.useCallback(() => setRevision((value) => value + 1), []) };
}

export function prefetchBffResource(url) {
  if (!url || resourceCache.has(url) || inflight.has(url)) return;
  const request = fetchResource(url).then((resource) => {
    resourceCache.set(url, resource);
    return resource;
  }).finally(() => inflight.delete(url));
  inflight.set(url, request);
}
