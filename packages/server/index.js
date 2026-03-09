import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApolloServer } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import { expressMiddleware } from '@as-integrations/express5';
import cors from 'cors';
import express from 'express';
import env from '../../config/env.mjs';
import { dbReady } from './db.js';
import { buildGraphqlContext, resolvers, schemaVersion, typeDefs } from './graphql/index.js';
import { createIngestRouter } from './ingest/index.js';
import './models/index.js';

export async function createServer(options = {}) {
  const app = express();
  const httpServer = http.createServer(app);
  const graphqlServer = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await graphqlServer.start();

  app.use(cors({
    origin: resolveCorsOrigin(options),
    credentials: true,
  }));
  app.use(express.json({ limit: options.jsonLimit || '10mb' }));

  app.get('/healthz', (_req, res) => {
    res.status(200).json({
      status: 'ok',
      schemaVersion,
      service: 'test-station-server',
    });
  });

  app.use('/api/ingest', createIngestRouter(options));

  app.use('/graphql', expressMiddleware(graphqlServer, {
    context: async ({ req }) => buildGraphqlContext({
      req,
      options,
    }),
  }));

  return {
    app,
    httpServer,
    graphqlServer,
    port: resolvePort(options),
  };
}

export async function startServer(options = {}) {
  await dbReady({
    skipMigrations: options.skipMigrations,
    skipAuthenticate: options.skipAuthenticate,
  });
  const server = await createServer(options);

  await new Promise((resolve) => {
    server.httpServer.listen(server.port, resolve);
  });

  process.stdout.write(`[server] listening on http://localhost:${server.port}\n`);
  return server;
}

function resolvePort(options = {}) {
  if (Number.isFinite(options.port)) {
    return Number(options.port);
  }
  return env.get('SERVER_PORT').default(4400).asPortNumber();
}

function resolveCorsOrigin(options = {}) {
  if (options.corsOrigin) {
    return options.corsOrigin;
  }
  const configured = env.get('PORTAL_URL').default('').asString().trim();
  return configured || true;
}

function isDirectInvocation(moduleUrl) {
  if (!process.argv[1]) {
    return false;
  }
  return path.resolve(process.argv[1]) === fileURLToPath(moduleUrl);
}

if (isDirectInvocation(import.meta.url)) {
  startServer().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack || error.message : String(error)}\n`);
    process.exit(1);
  });
}
