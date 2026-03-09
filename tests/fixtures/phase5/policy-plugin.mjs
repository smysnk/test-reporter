export function createPlugin(options = {}) {
  const owner = options.owner || 'repository-team';
  return {
    id: 'fixture-policy-plugin',
    classifyTest({ test, helpers }) {
      const candidates = helpers.packageRelativeCandidates || [];
      if (candidates.includes('specs/plugin.test.js') || /plugin\.test\.js$/.test(test.file || '')) {
        return {
          module: 'repository',
          theme: 'sync',
        };
      }
      return null;
    },
    attributeCoverageFile({ relativePath }) {
      if (relativePath === 'src/custom.js') {
        return {
          module: 'repository',
          theme: 'sync',
          source: 'plugin',
          reason: 'fixture plugin coverage mapping',
        };
      }
      return null;
    },
    lookupOwner({ module, theme }) {
      if (module === 'repository' && theme === 'sync') {
        return owner;
      }
      if (module === 'repository') {
        return owner;
      }
      return null;
    },
  };
}
