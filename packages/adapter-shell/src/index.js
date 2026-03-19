import { spawn } from 'node:child_process';

export const id = 'shell';
export const description = 'Shell command adapter';

export function createShellAdapter() {
  return {
    id,
    description,
    phase: 3,
    async run({ project, suite }) {
      const commandSpec = parseCommandSpec(suite.command);
      const execution = await spawnCommand(commandSpec.command, commandSpec.args, {
        cwd: suite.cwd || project.rootDir,
        env: resolveSuiteEnv(suite.env),
      });
      if (suite.resultFormat === 'suite-json-v1') {
        return buildSuiteJsonResult(suite, execution);
      }
      if (suite.resultFormat === 'single-check-json-v1') {
        return buildSingleCheckJsonResult(project, suite, execution);
      }

      const combinedOutput = [execution.stdout, execution.stderr].filter(Boolean).join('\n');
      const parsedSummary = parseShellSummary(combinedOutput);
      const syntheticStatus = execution.exitCode === 0 ? 'passed' : 'failed';
      const syntheticTest = {
        name: `${suite.label} completed`,
        fullName: `${suite.packageName || 'default'} ${suite.label} completed`,
        status: syntheticStatus,
        durationMs: execution.durationMs,
        file: null,
        line: null,
        column: null,
        assertions: ['Shell command completed without adapter-level execution errors.'],
        setup: [],
        mocks: [],
        failureMessages: execution.exitCode === 0 ? [] : [execution.stderr || execution.stdout || 'Shell command failed.'],
        rawDetails: {
          stdout: trimForReport(execution.stdout, 2000),
          stderr: trimForReport(execution.stderr, 2000),
        },
      };
      const summary = parsedSummary.total > 0
        ? parsedSummary
        : createSummary({
            total: 1,
            passed: syntheticStatus === 'passed' ? 1 : 0,
            failed: syntheticStatus === 'failed' ? 1 : 0,
            skipped: 0,
          });

      return {
        status: syntheticStatus,
        durationMs: execution.durationMs,
        summary,
        coverage: null,
        tests: [syntheticTest],
        warnings: [],
        output: {
          stdout: execution.stdout,
          stderr: execution.stderr,
        },
        rawArtifacts: [
          {
            relativePath: `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}-shell.log`,
            content: combinedOutput,
          },
        ],
      };
    },
  };
}

function buildSuiteJsonResult(suite, execution) {
  const payload = parseJsonObject(execution.stdout);
  const syntheticStatus = execution.exitCode === 0 ? 'passed' : 'failed';
  const status = normalizeResultStatus(payload?.status) || syntheticStatus;
  const tests = Array.isArray(payload?.tests) ? payload.tests : [];
  const summary = normalizeSummary(payload?.summary) || synthesizeSummaryFromTests(tests, status);
  const warnings = normalizeStringArray(payload?.warnings);
  const rawArtifacts = [
    ...normalizeSuiteJsonRawArtifacts(payload?.rawArtifacts),
    {
      relativePath: `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}-shell.json`,
      content: execution.stdout || '{}\n',
    },
  ];

  return {
    status,
    durationMs: Number.isFinite(payload?.durationMs) ? payload.durationMs : execution.durationMs,
    summary,
    coverage: payload?.coverage || null,
    tests,
    warnings,
    output: {
      stdout: execution.stdout,
      stderr: execution.stderr,
    },
    rawArtifacts,
    performanceStats: Array.isArray(payload?.performanceStats) ? payload.performanceStats : [],
  };
}

function buildSingleCheckJsonResult(project, suite, execution) {
  const payload = parseJsonSafe(execution.stdout);
  const options = suite.resultFormatOptions || {};
  const status = deriveJsonCheckStatus(execution, payload, options);
  const combinedOutput = [execution.stdout, execution.stderr].filter(Boolean).join('\n');
  const testName = options.name || suite.label || `${suite.id || 'suite'} completed`;
  const fullName = options.fullName || `${suite.packageName || 'default'} ${testName}`;
  const failureMessage = status === 'failed'
    ? deriveJsonCheckFailureMessage(execution, payload, options)
    : null;

  return {
    status,
    durationMs: execution.durationMs,
    summary: createSummary({
      total: 1,
      passed: status === 'passed' ? 1 : 0,
      failed: status === 'failed' ? 1 : 0,
      skipped: 0,
    }),
    coverage: null,
    tests: [
      {
        name: testName,
        fullName,
        status,
        durationMs: execution.durationMs,
        file: options.file || null,
        line: normalizeNumber(options.line),
        column: normalizeNumber(options.column),
        assertions: normalizeStringArray(options.assertions),
        setup: normalizeStringArray(options.setup),
        mocks: normalizeStringArray(options.mocks),
        failureMessages: failureMessage ? [failureMessage] : [],
        rawDetails: selectRawDetails(payload, options),
        module: options.module || null,
        theme: options.theme || null,
        classificationSource: options.classificationSource || 'adapter',
      },
    ],
    warnings: collectJsonCheckWarnings(payload, options),
    output: {
      stdout: execution.stdout,
      stderr: execution.stderr,
    },
    rawArtifacts: [
      {
        relativePath: options.artifactFileName || `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}-shell.json`,
        content: execution.stdout || '{}\n',
      },
    ],
  };
}

function normalizeSuiteJsonRawArtifacts(rawArtifacts) {
  return (Array.isArray(rawArtifacts) ? rawArtifacts : [])
    .filter((artifact) => artifact && typeof artifact === 'object' && typeof artifact.relativePath === 'string');
}

function parseCommandSpec(command) {
  if (Array.isArray(command) && command.length > 0) {
    return { command: String(command[0]), args: command.slice(1).map((entry) => String(entry)) };
  }
  if (typeof command === 'string' && command.trim().length > 0) {
    const tokens = tokenizeCommand(command);
    return { command: tokens[0], args: tokens.slice(1) };
  }
  throw new Error('Shell adapter requires suite.command as a non-empty string or array.');
}

function tokenizeCommand(command) {
  const tokens = [];
  let current = '';
  let quote = null;
  for (let index = 0; index < command.length; index += 1) {
    const char = command[index];
    if (quote) {
      if (char === quote) {
        quote = null;
      } else if (char === '\\' && quote === '"' && index + 1 < command.length) {
        current += command[index + 1];
        index += 1;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current.length > 0) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }
  if (current.length > 0) {
    tokens.push(current);
  }
  return tokens;
}

function spawnCommand(command, args, options) {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.on('error', (error) => {
      stderr += `${error.message}\n`;
      resolve({ exitCode: 1, stdout, stderr, durationMs: Date.now() - startedAt });
    });
    child.on('close', (code) => {
      resolve({
        exitCode: Number.isInteger(code) ? code : 1,
        stdout,
        stderr,
        durationMs: Date.now() - startedAt,
      });
    });
  });
}

function parseShellSummary(output) {
  const lines = String(output || '').split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const matchers = [
    /^tests?\s+(\d+)\s*\|\s*pass\s+(\d+)\s*\|\s*fail\s+(\d+)\s*\|\s*skip\s+(\d+)$/i,
    /^Tests:\s*(?:.*?)(\d+)\s+total.*?(\d+)\s+passed.*?(\d+)\s+failed.*?(\d+)\s+(?:skipped|pending|todo)/i,
  ];

  for (const line of lines.reverse()) {
    for (const matcher of matchers) {
      const matched = line.match(matcher);
      if (matched) {
        return createSummary({
          total: Number(matched[1]),
          passed: Number(matched[2]),
          failed: Number(matched[3]),
          skipped: Number(matched[4]),
        });
      }
    }
  }

  return createSummary();
}

function createSummary(values = {}) {
  return {
    total: Number.isFinite(values.total) ? values.total : 0,
    passed: Number.isFinite(values.passed) ? values.passed : 0,
    failed: Number.isFinite(values.failed) ? values.failed : 0,
    skipped: Number.isFinite(values.skipped) ? values.skipped : 0,
  };
}

function collectJsonCheckWarnings(payload, options) {
  return (Array.isArray(options.warningFields) ? options.warningFields : [])
    .map((entry) => formatJsonCheckWarning(payload, entry))
    .filter(Boolean);
}

function formatJsonCheckWarning(payload, entry) {
  const field = entry?.field;
  if (!field) {
    return null;
  }
  const value = payload?.[field];
  const label = String(entry?.label || field);
  const mode = entry?.mode || inferWarningMode(value);

  if (mode === 'count-array') {
    return Array.isArray(value) && value.length > 0 ? `${value.length} ${label}` : null;
  }
  if (mode === 'count-number') {
    return Number.isFinite(value) && value > 0 ? `${value} ${label}` : null;
  }
  if (mode === 'truthy') {
    return value ? label : null;
  }

  return null;
}

function inferWarningMode(value) {
  if (Array.isArray(value)) {
    return 'count-array';
  }
  if (typeof value === 'number') {
    return 'count-number';
  }
  return 'truthy';
}

function deriveJsonCheckStatus(execution, payload, options) {
  if (typeof options.statusField === 'string' && payload?.[options.statusField]) {
    return String(payload[options.statusField]);
  }
  return execution.exitCode === 0 ? 'passed' : 'failed';
}

function deriveJsonCheckFailureMessage(execution, payload, options) {
  if (typeof options.failureMessageField === 'string' && payload?.[options.failureMessageField]) {
    return String(payload[options.failureMessageField]);
  }
  if (typeof payload?.message === 'string' && payload.message.trim()) {
    return payload.message;
  }
  return execution.stderr || execution.stdout || 'Shell command failed.';
}

function selectRawDetails(payload, options) {
  const fields = Array.isArray(options.rawDetailsFields) ? options.rawDetailsFields : null;
  if (!fields || fields.length === 0) {
    return payload;
  }
  const selected = {};
  for (const field of fields) {
    if (Object.prototype.hasOwnProperty.call(payload || {}, field)) {
      selected[field] = payload[field];
    }
  }
  return selected;
}

function parseJsonObject(value) {
  try {
    const parsed = JSON.parse(String(value || '{}'));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function parseJsonSafe(value) {
  try {
    return JSON.parse(String(value || '{}'));
  } catch {
    return {};
  }
}

function normalizeStringArray(values) {
  return (Array.isArray(values) ? values : [])
    .map((entry) => String(entry || '').trim())
    .filter(Boolean);
}

function normalizeNumber(value) {
  return Number.isFinite(value) ? value : null;
}

function normalizeResultStatus(status) {
  if (status === 'failed' || status === 'skipped' || status === 'passed') {
    return status;
  }
  return null;
}

function normalizeSummary(summary) {
  if (!summary || typeof summary !== 'object') {
    return null;
  }

  const total = Number.isFinite(summary.total) ? summary.total : null;
  const passed = Number.isFinite(summary.passed) ? summary.passed : null;
  const failed = Number.isFinite(summary.failed) ? summary.failed : null;
  const skipped = Number.isFinite(summary.skipped) ? summary.skipped : null;

  if (total === null || passed === null || failed === null || skipped === null) {
    return null;
  }

  return { total, passed, failed, skipped };
}

function synthesizeSummaryFromTests(tests, status) {
  if (tests.length > 0) {
    return tests.reduce((summary, test) => {
      summary.total += 1;
      if (test?.status === 'failed') {
        summary.failed += 1;
      } else if (test?.status === 'skipped') {
        summary.skipped += 1;
      } else {
        summary.passed += 1;
      }
      return summary;
    }, { total: 0, passed: 0, failed: 0, skipped: 0 });
  }

  return {
    total: status === 'skipped' ? 0 : 1,
    passed: status === 'passed' ? 1 : 0,
    failed: status === 'failed' ? 1 : 0,
    skipped: status === 'skipped' ? 0 : 0,
  };
}

function trimForReport(value, limit) {
  if (typeof value !== 'string') {
    return '';
  }
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function sanitizeEnv(env) {
  const nextEnv = { ...env };
  delete nextEnv.NODE_TEST_CONTEXT;
  return nextEnv;
}

function resolveSuiteEnv(suiteEnv) {
  return {
    ...sanitizeEnv(process.env),
    ...normalizeEnvRecord(suiteEnv),
  };
}

function normalizeEnvRecord(env) {
  if (!env || typeof env !== 'object') {
    return {};
  }
  const normalized = {};
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined || value === null) {
      continue;
    }
    normalized[key] = String(value);
  }
  return normalized;
}
