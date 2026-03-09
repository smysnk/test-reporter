export function createAdapter() {
  return {
    id: 'fixture-static',
    async run({ suite, execution }) {
      const fixture = suite.fixture || {};
      return {
        status: fixture.status || 'passed',
        durationMs: fixture.durationMs || 12,
        summary: fixture.summary,
        coverage: fixture.coverage,
        tests: fixture.tests,
        warnings: execution.coverage && fixture.coverageWarning ? [fixture.coverageWarning] : (fixture.warnings || []),
        output: {
          stdout: fixture.stdout || `executed ${suite.id}`,
          stderr: fixture.stderr || '',
        },
        rawArtifacts: [
          {
            relativePath: `${suite.id}.txt`,
            content: fixture.rawText || `raw artifact for ${suite.id}\n`,
          },
        ],
      };
    },
  };
}
