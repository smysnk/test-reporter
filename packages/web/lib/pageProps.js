import { resolvePublicRuntimeConfig } from './runtimeConfig.js';

export function buildOverviewPageResult({ store, session, data, pageProfile = null, dispatchers = {} }) {
  dispatchPageState(store, dispatchers, {
    viewMode: 'overview',
    selectedProjectSlug: null,
    selectedRunId: null,
  });

  return {
    props: {
      session,
      data,
      pageProfile,
    },
  };
}

export function buildProjectPageResult({ store, session, slug, data, pageProfile = null, dispatchers = {} }) {
  if (!data) {
    return {
      notFound: true,
    };
  }

  dispatchPageState(store, dispatchers, {
    viewMode: 'project',
    selectedProjectSlug: slug,
    selectedRunId: null,
  });

  return {
    props: {
      session,
      data,
      pageProfile,
    },
  };
}

export function buildRunPageResult({ store, session, runId, templateMode, data, pageProfile = null, dispatchers = {} }) {
  if (!data) {
    return {
      notFound: true,
    };
  }

  dispatchPageState(store, dispatchers, {
    viewMode: 'run',
    selectedProjectSlug: data.run?.project?.slug || null,
    selectedRunId: runId,
  });

  return {
    props: {
      session,
      data,
      templateMode,
      pageProfile,
    },
  };
}

export function buildAdminPageResult({ store, session, data, selectedProjectSlug = null, pageProfile = null, dispatchers = {} }) {
  if (!data) {
    return {
      notFound: true,
    };
  }

  dispatchPageState(store, dispatchers, {
    viewMode: 'admin',
    selectedProjectSlug,
    selectedRunId: null,
  });

  return {
    props: {
      session,
      data,
      pageProfile,
    },
  };
}

function dispatchPageState(store, dispatchers, values) {
  if (!store || typeof store.dispatch !== 'function') {
    return;
  }

  if (typeof dispatchers.setViewMode === 'function') {
    store.dispatch(dispatchers.setViewMode(values.viewMode));
  }
  if (typeof dispatchers.setRuntimeConfig === 'function') {
    store.dispatch(dispatchers.setRuntimeConfig(resolvePublicRuntimeConfig()));
  }
  if (typeof dispatchers.setSelectedProjectSlug === 'function') {
    store.dispatch(dispatchers.setSelectedProjectSlug(values.selectedProjectSlug));
  }
  if (typeof dispatchers.setSelectedRunId === 'function') {
    store.dispatch(dispatchers.setSelectedRunId(values.selectedRunId));
  }
}
