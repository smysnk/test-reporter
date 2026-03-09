import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const CONFIG_SCHEMA_VERSION = '1';
export const REPORT_SCHEMA_VERSION = '1';

export function defineConfig(config) {
  return config;
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export async function loadConfig(configPath, options = {}) {
  const cwd = path.resolve(options.cwd || process.cwd());
  const resolved = path.resolve(cwd, configPath);
  const mod = await import(pathToFileURL(resolved).href);
  const config = mod.default || mod;
  return {
    resolvedPath: resolved,
    config,
    configDir: path.dirname(resolved),
  };
}

export function applyConfigOverrides(config, configDir, overrides = {}) {
  const nextConfig = {
    ...config,
    project: {
      ...(config?.project || {}),
    },
    suites: Array.isArray(config?.suites) ? [...config.suites] : [],
    adapters: Array.isArray(config?.adapters) ? [...config.adapters] : [],
  };
  const overrideCwd = path.resolve(overrides.cwd || process.cwd());
  const workspaceFilters = normalizeStringList(overrides.workspaceFilters);

  if (overrides.outputDir) {
    const outputDir = resolveMaybeRelative(overrideCwd, overrides.outputDir);
    nextConfig.project.outputDir = outputDir;
    nextConfig.project.rawDir = path.join(outputDir, 'raw');
  }

  if (workspaceFilters.length > 0) {
    nextConfig.suites = nextConfig.suites.filter((suite) => workspaceFilters.includes(resolveSuitePackageName(suite)));
    if (nextConfig.suites.length === 0) {
      throw new Error(`No suites matched workspaces: ${workspaceFilters.join(', ')}`);
    }
  }

  return nextConfig;
}

export function summarizeConfig(config) {
  return {
    schemaVersion: String(config?.schemaVersion || CONFIG_SCHEMA_VERSION),
    projectName: config?.project?.name || null,
    workspaceProvider: config?.workspaceDiscovery?.provider || null,
    suiteCount: Array.isArray(config?.suites) ? config.suites.length : 0,
    adapterCount: Array.isArray(config?.adapters) ? config.adapters.length : 0,
    manifestKeys: Object.keys(config?.manifests || {}),
  };
}

export function resolveProjectContext(config, configDir) {
  const rootDir = resolveMaybeRelative(configDir, config?.project?.rootDir || '.');
  const outputDir = resolveMaybeRelative(rootDir, config?.project?.outputDir || 'artifacts/workspace-tests');
  const rawDir = resolveMaybeRelative(rootDir, config?.project?.rawDir || path.join(path.relative(rootDir, outputDir), 'raw'));

  return {
    name: config?.project?.name || path.basename(rootDir),
    rootDir,
    outputDir,
    rawDir,
    configDir,
  };
}

export function resolveMaybeRelative(baseDir, targetPath) {
  if (!targetPath) {
    return path.resolve(baseDir);
  }
  if (path.isAbsolute(targetPath)) {
    return targetPath;
  }
  return path.resolve(baseDir, targetPath);
}

function normalizeStringList(values) {
  return (Array.isArray(values) ? values : [])
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function resolveSuitePackageName(suite) {
  return String(suite?.package || suite?.project || 'default');
}
