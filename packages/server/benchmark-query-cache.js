import env from '../../config/env.mjs';

const DEFAULT_TTL_MS = resolveCacheTtlMs();

export function createBenchmarkQueryCache(options = {}) {
  const ttlMs = normalizePositiveInteger(options.ttlMs) ?? DEFAULT_TTL_MS;
  const summaryEntries = new Map();
  const catalogEntries = new Map();

  return {
    ttlMs,
    readSummary(scope = {}) {
      return readCacheEntry(summaryEntries, scope, ttlMs);
    },
    writeSummary(scope = {}, value) {
      writeCacheEntry(summaryEntries, scope, value, ttlMs);
      return value;
    },
    readCatalog(scope = {}) {
      return readCacheEntry(catalogEntries, scope, ttlMs);
    },
    writeCatalog(scope = {}, value) {
      writeCacheEntry(catalogEntries, scope, value, ttlMs);
      return value;
    },
    invalidateProject(scope = {}) {
      invalidateCacheEntries(summaryEntries, scope);
      invalidateCacheEntries(catalogEntries, scope);
    },
    clear() {
      summaryEntries.clear();
      catalogEntries.clear();
    },
  };
}

const defaultBenchmarkQueryCache = createBenchmarkQueryCache();

export function getDefaultBenchmarkQueryCache() {
  return defaultBenchmarkQueryCache;
}

export function invalidateProjectBenchmarkQueryCache(scope = {}) {
  defaultBenchmarkQueryCache.invalidateProject(scope);
}

function readCacheEntry(cache, scope, ttlMs) {
  pruneExpiredEntries(cache, ttlMs);

  for (const key of createScopeKeys(scope)) {
    const entry = cache.get(key);
    if (!entry) {
      continue;
    }
    if (ttlMs > 0 && Number.isFinite(entry.expiresAt) && entry.expiresAt <= Date.now()) {
      cache.delete(key);
      continue;
    }
    return entry.value;
  }

  return null;
}

function writeCacheEntry(cache, scope, value, ttlMs) {
  const keys = createScopeKeys(scope);
  if (keys.length === 0) {
    return;
  }

  const expiresAt = ttlMs > 0 ? Date.now() + ttlMs : Number.POSITIVE_INFINITY;
  const entry = {
    expiresAt,
    keys,
    value,
  };

  for (const key of keys) {
    cache.set(key, entry);
  }
}

function invalidateCacheEntries(cache, scope) {
  for (const key of createScopeKeys(scope)) {
    const entry = cache.get(key);
    if (!entry) {
      continue;
    }
    for (const aliasKey of Array.isArray(entry.keys) ? entry.keys : [key]) {
      cache.delete(aliasKey);
    }
  }
}

function pruneExpiredEntries(cache, ttlMs) {
  if (!(ttlMs > 0)) {
    return;
  }

  const now = Date.now();
  for (const [key, entry] of cache.entries()) {
    if (!entry || !Number.isFinite(entry.expiresAt) || entry.expiresAt > now) {
      continue;
    }
    cache.delete(key);
  }
}

function createScopeKeys(scope) {
  const keys = [];
  if (typeof scope.projectId === 'string' && scope.projectId.trim()) {
    keys.push(`project-id:${scope.projectId.trim()}`);
  }
  if (typeof scope.projectKey === 'string' && scope.projectKey.trim()) {
    keys.push(`project-key:${scope.projectKey.trim().toLowerCase()}`);
  }
  return keys;
}

function normalizePositiveInteger(value) {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function resolveCacheTtlMs() {
  return normalizePositiveInteger(env.get('BENCHMARK_QUERY_CACHE_TTL_MS').default('300000').asString()) ?? 300000;
}
