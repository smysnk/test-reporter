import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
const cwd = process.cwd();
const outputFile = readOption(args, '--outputFile');
const coverageEnabled = args.includes('--coverage');
const coverageDirectory = readOption(args, '--coverageDirectory');
const envMode = args.some((arg) => arg.includes('env.test.js'));

const report = envMode ? createEnvReport(cwd) : createDefaultReport(cwd);

if (outputFile) {
  fs.mkdirSync(path.dirname(outputFile), { recursive: true });
  fs.writeFileSync(outputFile, `${JSON.stringify(report, null, 2)}\n`);
} else {
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

if (coverageEnabled && coverageDirectory) {
  fs.mkdirSync(coverageDirectory, { recursive: true });
  const coverageSummary = createCoverageSummary(cwd);
  fs.writeFileSync(
    path.join(coverageDirectory, 'coverage-summary.json'),
    `${JSON.stringify(coverageSummary, null, 2)}\n`,
  );
}

process.exit(report.success ? 0 : 1);

function createDefaultReport(rootDir) {
  const file = path.join(rootDir, 'math.test.js');
  return {
    success: false,
    numTotalTests: 3,
    numPassedTests: 1,
    numFailedTests: 1,
    numPendingTests: 1,
    numTodoTests: 0,
    testResults: [
      {
        name: file,
        assertionResults: [
          {
            ancestorTitles: ['math helpers'],
            title: 'adds numbers',
            fullName: 'math helpers adds numbers',
            status: 'passed',
            duration: 4,
            failureMessages: [],
            location: { line: 4, column: 1 },
          },
          {
            ancestorTitles: ['math helpers'],
            title: 'fails subtraction',
            fullName: 'math helpers fails subtraction',
            status: 'failed',
            duration: 3,
            failureMessages: ['Expected: 2\nReceived: 1'],
            location: { line: 8, column: 1 },
          },
          {
            ancestorTitles: ['math helpers'],
            title: 'skips pending work',
            fullName: 'math helpers skips pending work',
            status: 'pending',
            duration: 0,
            failureMessages: [],
            location: { line: 12, column: 1 },
          },
        ],
      },
    ],
  };
}

function createEnvReport(rootDir) {
  const envOk = process.env.TEST_STATION_PHASE3_ENV === 'enabled';
  const file = path.join(rootDir, 'env.test.js');
  return {
    success: envOk,
    numTotalTests: 1,
    numPassedTests: envOk ? 1 : 0,
    numFailedTests: envOk ? 0 : 1,
    numPendingTests: 0,
    numTodoTests: 0,
    testResults: [
      {
        name: file,
        assertionResults: [
          {
            ancestorTitles: ['env'],
            title: 'inherits suite env',
            fullName: 'env inherits suite env',
            status: envOk ? 'passed' : 'failed',
            duration: 2,
            failureMessages: envOk ? [] : [`Expected TEST_STATION_PHASE3_ENV=enabled but received ${process.env.TEST_STATION_PHASE3_ENV || '<missing>'}`],
            location: { line: 2, column: 1 },
          },
        ],
      },
    ],
  };
}

function createCoverageSummary(rootDir) {
  const sourceFile = path.join(rootDir, 'src', 'math.js');
  return {
    total: {
      lines: { total: 10, covered: 8, skipped: 0, pct: 80 },
      statements: { total: 10, covered: 8, skipped: 0, pct: 80 },
      functions: { total: 4, covered: 3, skipped: 0, pct: 75 },
      branches: { total: 6, covered: 4, skipped: 0, pct: 66.67 },
    },
    [sourceFile]: {
      lines: { total: 10, covered: 8, skipped: 0, pct: 80 },
      statements: { total: 10, covered: 8, skipped: 0, pct: 80 },
      functions: { total: 4, covered: 3, skipped: 0, pct: 75 },
      branches: { total: 6, covered: 4, skipped: 0, pct: 66.67 },
    },
  };
}

function readOption(tokens, optionName) {
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    if (token === optionName) {
      return tokens[index + 1] || null;
    }
    if (token.startsWith(`${optionName}=`)) {
      return token.slice(optionName.length + 1);
    }
  }
  return null;
}
