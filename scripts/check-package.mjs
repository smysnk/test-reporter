#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const relativeEntry = process.argv[2];
if (!relativeEntry) {
  throw new Error('Expected a package entry file path');
}

const resolved = path.resolve(process.cwd(), relativeEntry);
await import(pathToFileURL(resolved).href);
process.stdout.write(`${path.basename(process.cwd())}: ok\n`);
