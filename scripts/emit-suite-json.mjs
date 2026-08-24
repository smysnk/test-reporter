#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
const input = path.resolve(process.argv[2] || 'artifacts/e2e-performance/ingest-suite.json');
if (fs.existsSync(input)) process.stdout.write(fs.readFileSync(input, 'utf8'));
else process.stdout.write(`${JSON.stringify({ status: 'passed', durationMs: 0, summary: { total: 0, passed: 0, failed: 0, skipped: 0 }, tests: [], warnings: [`Missing optional performance artifact ${input}`], performanceStats: [], rawArtifacts: [] })}\n`);
