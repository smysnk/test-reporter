export function createAdapter() {
  return {
    id: 'raw-artifact-fixture',
    async run({ suite }) {
      return {
        status: 'failed',
        durationMs: 12,
        summary: {
          total: 1,
          passed: 0,
          failed: 1,
          skipped: 0,
        },
        tests: [
          {
            name: 'fails with external artifacts',
            fullName: 'fixture fails with external artifacts',
            status: 'failed',
            durationMs: 12,
            failureMessages: ['fixture failure'],
            module: 'runtime',
            theme: 'artifacts',
          },
        ],
        rawArtifacts: [
          {
            relativePath: 'fixture-inline/log.txt',
            label: 'Inline log',
            content: 'inline artifact\n',
          },
          {
            relativePath: 'fixture-file/trace.zip',
            label: 'Trace ZIP',
            sourcePath: './source/trace.zip',
            mediaType: 'application/zip',
          },
          {
            relativePath: 'fixture-dir/test-results',
            label: 'Copied test-results directory',
            kind: 'directory',
            sourcePath: './source/copied-directory',
          },
        ],
      };
    },
  };
}
