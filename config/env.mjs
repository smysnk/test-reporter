import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse as parseDotenv } from 'dotenv';
import env from 'env-var';

const configDir = path.dirname(fileURLToPath(import.meta.url));

export const repoRootDir = path.resolve(configDir, '..');

export function loadRepoEnv(options = {}) {
  const rootDir = path.resolve(options.rootDir || repoRootDir);
  const targetEnv = options.targetEnv || process.env;

  mergeEnvFile(path.join(rootDir, '.env'), targetEnv);
  mergeEnvFile(path.join(rootDir, '.env.local'), targetEnv, { override: true });

  return env;
}

function mergeEnvFile(filePath, targetEnv, options = {}) {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const parsed = parseDotenv(fs.readFileSync(filePath));
  for (const [key, value] of Object.entries(parsed)) {
    if (options.override || !(key in targetEnv)) {
      targetEnv[key] = value;
    }
  }

  return true;
}

const loadedEnv = loadRepoEnv();

export default loadedEnv;
