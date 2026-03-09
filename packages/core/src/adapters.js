import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createNodeTestAdapter } from '@test-station/adapter-node-test';
import { createVitestAdapter } from '@test-station/adapter-vitest';
import { createPlaywrightAdapter } from '@test-station/adapter-playwright';
import { createShellAdapter } from '@test-station/adapter-shell';
import { createJestAdapter } from '@test-station/adapter-jest';

const builtInAdapterFactories = {
  'node-test': createNodeTestAdapter,
  vitest: createVitestAdapter,
  playwright: createPlaywrightAdapter,
  shell: createShellAdapter,
  jest: createJestAdapter,
};

export async function resolveAdapterForSuite(suite, loadedConfig) {
  if (suite?.handler) {
    return loadAdapterModule(resolveMaybeRelative(loadedConfig.configDir, suite.handler));
  }

  if (suite?.adapter && typeof suite.adapter === 'object' && typeof suite.adapter.run === 'function') {
    return suite.adapter;
  }

  if (typeof suite?.adapter === 'string') {
    const configured = resolveConfiguredAdapter(suite.adapter, loadedConfig.config?.adapters || [], loadedConfig.configDir);
    if (configured) {
      return configured;
    }
    if (builtInAdapterFactories[suite.adapter]) {
      return builtInAdapterFactories[suite.adapter]();
    }
  }

  throw new Error(`Unable to resolve adapter for suite ${suite?.id || '<unknown>'}`);
}

function resolveConfiguredAdapter(adapterId, configuredAdapters, configDir) {
  for (const entry of configuredAdapters) {
    if (!entry || entry.id !== adapterId) {
      continue;
    }
    if (entry.adapter && typeof entry.adapter.run === 'function') {
      return entry.adapter;
    }
    if (entry.handler) {
      return loadAdapterModule(resolveMaybeRelative(configDir, entry.handler));
    }
  }
  return null;
}

export async function loadAdapterModule(modulePath) {
  const mod = await import(pathToFileURL(modulePath).href);
  if (mod.default && typeof mod.default.run === 'function') {
    return mod.default;
  }
  if (typeof mod.createAdapter === 'function') {
    return mod.createAdapter();
  }
  if (mod.default && typeof mod.default === 'function') {
    return mod.default();
  }
  throw new Error(`Adapter module ${modulePath} did not export a supported adapter contract.`);
}

function resolveMaybeRelative(baseDir, targetPath) {
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }
  return path.resolve(baseDir, targetPath);
}
