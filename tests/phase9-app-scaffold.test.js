import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadRepoEnv } from '../config/env.mjs';
import { createServer, resolveCorsOrigin } from '../packages/server/index.js';

test('loadRepoEnv loads .env and lets .env.local override values', () => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'test-station-env-'));
  fs.writeFileSync(path.join(tempRoot, '.env'), 'BASE_ONLY=from-env\nSHARED=value-from-env\n');
  fs.writeFileSync(path.join(tempRoot, '.env.local'), 'LOCAL_ONLY=from-env-local\nSHARED=value-from-env-local\n');

  const targetEnv = {};
  loadRepoEnv({ rootDir: tempRoot, targetEnv });

  assert.equal(targetEnv.BASE_ONLY, 'from-env');
  assert.equal(targetEnv.LOCAL_ONLY, 'from-env-local');
  assert.equal(targetEnv.SHARED, 'value-from-env-local');

  fs.rmSync(tempRoot, { recursive: true, force: true });
});

test('server scaffold exposes health and GraphQL endpoints', async () => {
  const server = await createServer({ port: 0, corsOrigin: 'http://localhost:3001' });

  try {
    await new Promise((resolve) => {
      server.httpServer.listen(0, resolve);
    });

    const address = server.httpServer.address();
    assert.equal(typeof address?.port, 'number');

    const baseUrl = `http://127.0.0.1:${address.port}`;

    const healthResponse = await fetch(`${baseUrl}/healthz`);
    assert.equal(healthResponse.status, 200);
    const healthPayload = await healthResponse.json();
    assert.equal(healthPayload.status, 'ok');
    assert.equal(healthPayload.service, 'test-station-server');

    const graphqlResponse = await fetch(`${baseUrl}/graphql`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ schemaVersion serviceStatus }',
      }),
    });
    assert.equal(graphqlResponse.status, 200);
    const graphqlPayload = await graphqlResponse.json();
    assert.deepEqual(graphqlPayload.data, {
      schemaVersion: '1',
      serviceStatus: 'phase-8-access-control',
    });
  } finally {
    await server.graphqlServer.stop();
    if (server.httpServer.listening) {
      await new Promise((resolve, reject) => {
        server.httpServer.close((error) => {
          if (error) {
            reject(error);
            return;
          }
          resolve();
        });
      });
    }
  }
});

test('server defaults WEB_URL to localhost using WEB_PORT when unset', () => {
  const originalWebUrl = process.env.WEB_URL;
  const originalWebPort = process.env.WEB_PORT;

  try {
    delete process.env.WEB_URL;
    process.env.WEB_PORT = '3015';

    assert.equal(resolveCorsOrigin(), 'http://localhost:3015');
  } finally {
    if (originalWebUrl === undefined) {
      delete process.env.WEB_URL;
    } else {
      process.env.WEB_URL = originalWebUrl;
    }

    if (originalWebPort === undefined) {
      delete process.env.WEB_PORT;
    } else {
      process.env.WEB_PORT = originalWebPort;
    }
  }
});
