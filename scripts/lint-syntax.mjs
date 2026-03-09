#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const target = path.resolve(process.cwd(), process.argv[2] || '.');
const files = [];

function walk(entryPath) {
  const stat = fs.statSync(entryPath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(entryPath)) {
      if (entry === 'node_modules' || entry === '.yarn' || entry === 'dist') continue;
      walk(path.join(entryPath, entry));
    }
    return;
  }
  if (/\.[cm]?js$/.test(entryPath)) {
    files.push(entryPath);
  }
}

walk(target);
let failures = 0;
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', file], { stdio: 'pipe', encoding: 'utf8' });
  if (result.status !== 0) {
    failures += 1;
    process.stderr.write(result.stderr || result.stdout || `Syntax check failed: ${file}\n`);
  }
}
if (failures > 0) {
  process.exit(1);
}
process.stdout.write(`Checked ${files.length} JavaScript files.\n`);
