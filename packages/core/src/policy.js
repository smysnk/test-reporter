import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createSourceAnalysisPlugin } from '@test-reporter/plugin-source-analysis';
import { readJson, resolveMaybeRelative } from './config.js';

const builtInPluginFactories = {
  'source-analysis': createSourceAnalysisPlugin,
};

export async function preparePolicyContext(loadedConfig, project) {
  const manifests = loadPolicyManifests(loadedConfig.config, loadedConfig.configDir);
  const plugins = await resolvePolicyPlugins(loadedConfig.config, loadedConfig.configDir);
  const ownershipLookup = buildOwnershipLookup(manifests);

  return {
    manifests,
    plugins,
    ownershipLookup,
    projectRootDir: project.rootDir,
  };
}

export async function applyPolicyPipeline(context, suiteResults) {
  if (!context?.policy) {
    return suiteResults;
  }

  const normalizedSuites = [];
  for (const suite of suiteResults) {
    const tests = [];
    for (const test of suite.tests || []) {
      const classified = resolveTestClassification(context, suite, test);
      let nextTest = {
        ...test,
        module: classified.module,
        theme: classified.theme,
        classificationSource: classified.source,
      };

      for (const plugin of context.policy.plugins || []) {
        if (typeof plugin?.enrichTest !== 'function') {
          continue;
        }
        const patch = await plugin.enrichTest({
          config: context.config,
          project: context.project,
          suite,
          test: nextTest,
          manifests: context.policy.manifests,
          helpers: {
            packageRelativeCandidates: getPackageRelativeCandidates(context, suite, test.file),
          },
        });
        if (patch && typeof patch === 'object') {
          nextTest = mergeTestPatch(nextTest, patch);
        }
      }

      tests.push(nextTest);
    }

    normalizedSuites.push({
      ...suite,
      tests,
    });
  }

  return normalizedSuites;
}

export function collectCoverageAttribution(policy, packages, project) {
  const files = [];
  const summary = {
    totalFiles: 0,
    attributedFiles: 0,
    sharedFiles: 0,
    moduleOnlyFiles: 0,
    packageOnlySharedFiles: 0,
    unattributedFiles: 0,
    manifestFiles: 0,
    heuristicFiles: 0,
    pluginFiles: 0,
  };

  for (const pkg of packages || []) {
    for (const file of pkg.coverage?.files || []) {
      summary.totalFiles += 1;
      const attribution = classifyCoverageFile(policy, pkg, file, project);
      if (attribution.shared) {
        summary.sharedFiles += 1;
      }
      if (attribution.packageOnly) {
        summary.packageOnlySharedFiles += 1;
        continue;
      }
      if (!attribution.targets.length) {
        summary.unattributedFiles += 1;
        continue;
      }
      summary.attributedFiles += 1;
      if (attribution.source === 'manifest') summary.manifestFiles += 1;
      if (attribution.source === 'heuristic') summary.heuristicFiles += 1;
      if (attribution.source === 'plugin') summary.pluginFiles += 1;
      if (attribution.targets.every((target) => !target.theme)) {
        summary.moduleOnlyFiles += 1;
      }

      const sharedWeight = attribution.targets.length > 1
        ? Number((1 / attribution.targets.length).toFixed(6))
        : 1;
      for (const target of attribution.targets) {
        files.push({
          ...file,
          packageName: pkg.name,
          module: target.module,
          theme: target.theme || null,
          shared: Boolean(target.shared || attribution.shared),
          attributionSource: attribution.source,
          attributionReason: attribution.reason || null,
          attributionWeight: sharedWeight,
        });
      }
    }
  }

  return { files, summary };
}

export function lookupOwner(policy, moduleName, themeName = null, details = {}) {
  for (const plugin of policy?.plugins || []) {
    if (typeof plugin?.lookupOwner !== 'function') {
      continue;
    }
    const owner = plugin.lookupOwner({
      module: moduleName,
      theme: themeName,
      manifests: policy.manifests,
      details,
    });
    if (owner) {
      return String(owner);
    }
  }

  if (themeName) {
    const themeOwner = policy?.ownershipLookup?.themeOwners?.get(`${moduleName}/${themeName}`);
    if (themeOwner) {
      return themeOwner;
    }
  }

  return policy?.ownershipLookup?.moduleOwners?.get(moduleName || '') || null;
}

function resolveTestClassification(context, suite, test) {
  const pluginClassification = runPluginClassification(context, suite, test);
  if (pluginClassification) {
    return pluginClassification;
  }

  const manifestMatch = matchClassificationManifest(context.policy?.manifests?.classification, context, suite, test);
  if (manifestMatch) {
    return manifestMatch;
  }

  if (test?.module && test.module !== 'uncategorized') {
    return {
      module: test.module,
      theme: test.theme || 'uncategorized',
      source: test.classificationSource || 'adapter',
    };
  }

  return {
    module: 'uncategorized',
    theme: 'uncategorized',
    source: 'default',
  };
}

function runPluginClassification(context, suite, test) {
  for (const plugin of context.policy?.plugins || []) {
    if (typeof plugin?.classifyTest !== 'function') {
      continue;
    }
    const classification = plugin.classifyTest({
      config: context.config,
      project: context.project,
      suite,
      test,
      manifests: context.policy.manifests,
      helpers: {
        packageRelativeCandidates: getPackageRelativeCandidates(context, suite, test.file),
      },
    });
    const normalized = normalizeClassification(classification, 'plugin');
    if (normalized) {
      return normalized;
    }
  }
  return null;
}

function matchClassificationManifest(manifest, context, suite, test) {
  const rules = Array.isArray(manifest?.rules) ? manifest.rules : [];
  const relativeCandidates = getPackageRelativeCandidates(context, suite, test.file);
  if (relativeCandidates.length === 0) {
    return null;
  }

  for (const rule of rules) {
    if (suite?.packageName && rule.package && rule.package !== suite.packageName) {
      continue;
    }
    for (const relativePath of relativeCandidates) {
      if (!matchesConfiguredRule(rule, relativePath, suite?.packageName || null)) {
        continue;
      }
      return {
        module: rule.module || 'uncategorized',
        theme: rule.theme || 'uncategorized',
        source: 'manifest',
      };
    }
  }

  return null;
}

function classifyCoverageFile(policy, pkg, file, project) {
  for (const plugin of policy?.plugins || []) {
    if (typeof plugin?.attributeCoverageFile !== 'function') {
      continue;
    }
    const attribution = plugin.attributeCoverageFile({
      packageName: pkg.name,
      file,
      project,
      manifests: policy.manifests,
      relativePath: normalizeProjectRelative(project?.rootDir, file.path),
    });
    const normalized = normalizeCoverageAttribution(attribution, 'plugin');
    if (normalized) {
      return normalized;
    }
  }

  const manifestMatch = matchCoverageManifestRule(policy?.manifests?.coverageAttribution, normalizeProjectRelative(project?.rootDir, file.path), pkg.name);
  if (manifestMatch) {
    return manifestMatch;
  }

  if (file?.module) {
    return {
      targets: [
        {
          module: file.module,
          theme: file.theme || null,
          shared: Boolean(file.shared),
        },
      ],
      shared: Boolean(file.shared),
      packageOnly: false,
      source: file.attributionSource || 'adapter',
      reason: file.attributionReason || null,
    };
  }

  return {
    targets: [],
    shared: false,
    packageOnly: false,
    source: 'default',
    reason: null,
  };
}

function matchCoverageManifestRule(manifest, relativePath, packageName = null) {
  const coverageRules = Array.isArray(manifest?.coverageRules) ? manifest.coverageRules : [];
  for (const rule of coverageRules) {
    if (!matchesConfiguredRule(rule, relativePath, packageName)) {
      continue;
    }
    return {
      targets: normalizeCoverageTargets(rule),
      shared: Boolean(rule.shared),
      packageOnly: rule.scope === 'package-only' || normalizeCoverageTargets(rule).length === 0,
      source: 'manifest',
      reason: rule.reason || null,
    };
  }
  return null;
}

function normalizeCoverageTargets(rule) {
  const ruleTargets = Array.isArray(rule.targets)
    ? rule.targets
    : (rule.module ? [{ module: rule.module, theme: rule.theme || null }] : []);

  return ruleTargets
    .filter((target) => target && target.module)
    .map((target) => ({
      module: target.module,
      theme: target.theme || null,
      shared: Boolean(rule.shared || target.shared),
    }));
}

function normalizeClassification(value, sourceFallback) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  if (!value.module) {
    return null;
  }
  return {
    module: value.module,
    theme: value.theme || 'uncategorized',
    source: value.source || sourceFallback,
  };
}

function normalizeCoverageAttribution(value, sourceFallback) {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const targets = Array.isArray(value.targets)
    ? value.targets.filter((target) => target && target.module).map((target) => ({
        module: target.module,
        theme: target.theme || null,
        shared: Boolean(target.shared),
      }))
    : (value.module ? [{ module: value.module, theme: value.theme || null, shared: Boolean(value.shared) }] : []);

  return {
    targets,
    shared: Boolean(value.shared),
    packageOnly: Boolean(value.packageOnly),
    source: value.source || sourceFallback,
    reason: value.reason || null,
  };
}

function buildOwnershipLookup(manifests) {
  const moduleOwners = new Map();
  const themeOwners = new Map();
  const ownership = manifests?.ownership?.ownership || {};

  for (const entry of ownership.modules || []) {
    if (!entry?.module || !entry?.owner) {
      continue;
    }
    moduleOwners.set(entry.module, String(entry.owner));
  }

  for (const entry of ownership.themes || []) {
    if (!entry?.module || !entry?.theme || !entry?.owner) {
      continue;
    }
    themeOwners.set(`${entry.module}/${entry.theme}`, String(entry.owner));
  }

  return { moduleOwners, themeOwners };
}

function loadPolicyManifests(config, configDir) {
  const cache = new Map();
  return {
    classification: loadManifestEntry(resolveManifestPath(config, 'classification'), configDir, cache),
    coverageAttribution: loadManifestEntry(resolveManifestPath(config, 'coverageAttribution'), configDir, cache),
    ownership: loadManifestEntry(resolveManifestPath(config, 'ownership'), configDir, cache),
  };
}

function resolveManifestPath(config, key) {
  if (config?.manifests?.[key]) {
    return config.manifests[key];
  }
  const legacySection = config?.[key];
  if (legacySection?.manifestPath) {
    return legacySection.manifestPath;
  }
  return null;
}

function loadManifestEntry(manifestPath, configDir, cache) {
  if (!manifestPath) {
    return null;
  }
  const resolved = resolveMaybeRelative(configDir, manifestPath);
  if (cache.has(resolved)) {
    return cache.get(resolved);
  }
  if (!fs.existsSync(resolved)) {
    cache.set(resolved, null);
    return null;
  }
  const payload = readJson(resolved);
  const manifest = {
    path: resolved,
    rules: Array.isArray(payload.rules) ? payload.rules : [],
    coverageRules: Array.isArray(payload.coverageRules) ? payload.coverageRules : [],
    ownership: {
      modules: Array.isArray(payload.ownership?.modules) ? payload.ownership.modules : [],
      themes: Array.isArray(payload.ownership?.themes) ? payload.ownership.themes : [],
    },
    raw: payload,
  };
  cache.set(resolved, manifest);
  return manifest;
}

async function resolvePolicyPlugins(config, configDir) {
  const entries = gatherPluginEntries(config);
  const loaded = [];
  const seen = new Set();

  for (const entry of entries) {
    const plugin = await resolvePluginEntry(entry, configDir);
    if (!plugin) {
      continue;
    }
    const key = plugin.id || JSON.stringify(Object.keys(plugin).sort());
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    loaded.push(plugin);
  }

  return loaded;
}

function gatherPluginEntries(config) {
  const entries = [];
  if (Array.isArray(config?.plugins)) {
    entries.push(...config.plugins);
  }
  if (Array.isArray(config?.classification?.plugins)) {
    entries.push(...config.classification.plugins);
  }
  if (Array.isArray(config?.coverageAttribution?.plugins)) {
    entries.push(...config.coverageAttribution.plugins);
  }
  if (Array.isArray(config?.ownership?.plugins)) {
    entries.push(...config.ownership.plugins);
  }
  const sourceAnalysis = config?.enrichers?.sourceAnalysis;
  if (Array.isArray(sourceAnalysis?.plugins) && sourceAnalysis.plugins.length > 0) {
    entries.push(...sourceAnalysis.plugins);
  } else if (sourceAnalysis?.enabled !== false) {
    entries.push({ use: 'source-analysis', options: sourceAnalysis || {} });
  }
  return entries;
}

async function resolvePluginEntry(entry, configDir) {
  if (!entry) {
    return null;
  }
  if (hasPolicyHooks(entry)) {
    return entry;
  }
  if (typeof entry === 'string') {
    if (builtInPluginFactories[entry]) {
      return builtInPluginFactories[entry]();
    }
    return loadPluginModule(resolveMaybeRelative(configDir, entry));
  }
  if (typeof entry === 'object') {
    if (entry.plugin && hasPolicyHooks(entry.plugin)) {
      return entry.plugin;
    }
    if (entry.use && builtInPluginFactories[entry.use]) {
      return builtInPluginFactories[entry.use](entry.options || {});
    }
    if (entry.handler) {
      return loadPluginModule(resolveMaybeRelative(configDir, entry.handler), entry.options || {});
    }
  }
  return null;
}

async function loadPluginModule(modulePath, options = {}) {
  const mod = await import(pathToFileURL(modulePath).href);
  if (hasPolicyHooks(mod.default)) {
    return mod.default;
  }
  if (typeof mod.createPlugin === 'function') {
    return mod.createPlugin(options);
  }
  if (mod.default && typeof mod.default === 'function') {
    return mod.default(options);
  }
  throw new Error(`Policy plugin module ${modulePath} did not export a supported plugin contract.`);
}

function hasPolicyHooks(value) {
  if (!value || typeof value !== 'object') {
    return false;
  }
  return ['classifyTest', 'attributeCoverageFile', 'lookupOwner', 'enrichTest'].some((key) => typeof value[key] === 'function');
}

function getPackageRelativeCandidates(context, suite, filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return [];
  }
  const absoluteFilePath = path.resolve(filePath);
  const roots = [];
  if (suite?.packageRoot) {
    roots.push(path.resolve(suite.packageRoot));
  }
  if (suite?.packageName && context?.project?.rootDir) {
    roots.push(path.resolve(context.project.rootDir, 'packages', suite.packageName));
    roots.push(path.resolve(context.project.rootDir, suite.packageName));
  }
  if (suite?.cwd) {
    roots.push(path.resolve(suite.cwd));
  }
  if (context?.project?.rootDir) {
    roots.push(path.resolve(context.project.rootDir));
  }

  const candidates = [];
  for (const root of roots) {
    if (!absoluteFilePath.startsWith(root)) {
      continue;
    }
    candidates.push(normalizePath(path.relative(root, absoluteFilePath)));
  }

  return dedupe(candidates);
}

function normalizeProjectRelative(rootDir, filePath) {
  if (!rootDir || !filePath) {
    return null;
  }
  return normalizePath(path.relative(rootDir, path.resolve(filePath)));
}

function matchesConfiguredRule(rule, targetPath, packageName = null) {
  if (!targetPath) {
    return false;
  }
  if (packageName && rule.package && rule.package !== packageName) {
    return false;
  }

  const includes = Array.isArray(rule.include) ? rule.include : [];
  if (includes.length > 0 && !includes.some((pattern) => matchSimpleGlob(targetPath, pattern))) {
    return false;
  }

  const excludes = Array.isArray(rule.exclude) ? rule.exclude : [];
  if (excludes.some((pattern) => matchSimpleGlob(targetPath, pattern))) {
    return false;
  }

  return true;
}

function matchSimpleGlob(value, pattern) {
  const escaped = normalizePath(pattern)
    .replace(/[|\\{}()[\]^$+?.]/g, '\\$&')
    // `**/` should match zero or more nested directories.
    .replace(/\*\*\/?/g, (segment) => (segment.endsWith('/') ? '::DOUBLE_STAR_DIR::' : '::DOUBLE_STAR::'))
    .replace(/\*/g, '[^/]*')
    .replace(/::DOUBLE_STAR_DIR::/g, '(?:.*/)?')
    .replace(/::DOUBLE_STAR::/g, '.*');
  return new RegExp(`^${escaped}$`).test(normalizePath(value));
}

function mergeTestPatch(test, patch) {
  return {
    ...test,
    ...patch,
    assertions: dedupe([...(test.assertions || []), ...(patch.assertions || [])]),
    setup: dedupe([...(test.setup || []), ...(patch.setup || [])]),
    mocks: dedupe([...(test.mocks || []), ...(patch.mocks || [])]),
    failureMessages: dedupe([...(test.failureMessages || []), ...(patch.failureMessages || [])]),
    rawDetails: {
      ...(test.rawDetails || {}),
      ...(patch.rawDetails || {}),
    },
  };
}

function dedupe(values) {
  return Array.from(new Set((values || []).filter(Boolean)));
}

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/');
}
