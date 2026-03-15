const payload = {
  config: {
    rootDir: process.cwd(),
  },
  suites: [],
  errors: [
    {
      message: 'Error: Failed to launch: Error: spawn /bin/sh ENOENT',
      stack: 'Error: Failed to launch: Error: spawn /bin/sh ENOENT',
    },
  ],
  stats: {
    startTime: new Date().toISOString(),
    duration: 22.298,
    expected: 0,
    skipped: 0,
    unexpected: 0,
    flaky: 0,
  },
};

process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
process.exit(1);
