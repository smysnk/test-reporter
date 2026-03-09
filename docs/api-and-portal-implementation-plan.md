# Test Station API and Portal Implementation Plan

## Status

- Proposed.
- Completed now:
  - Phase 1 workspace scaffold for `packages/server` and `packages/portal`
  - shared env bootstrap at `config/env.mjs`
  - server health and GraphQL scaffold
  - portal provider shell and route scaffold
  - Phase 2 Sequelize bootstrap, migration runner, initial reporting schema migration, and model/association registry
  - Phase 3 shared-key ingest endpoint, report normalization layer, and idempotent run persistence
  - Phase 4 guarded GraphQL query layer, read queries, and service ingest mutation
  - Phase 5 NextAuth portal shell, protected routes, same-origin GraphQL proxy, and SSR explorer pages
  - Phase 6 precomputed coverage trend storage, run-to-run comparison queries, and historical portal trend views
- Scope in this document:
  - add one long-running Node server package for ingestion, storage, and GraphQL
  - add one Next.js portal package for exploration, auth, and historical reporting

## Goals

1. Keep the current `test-station` report contract as the ingestion source of truth.
2. Add a durable backend that stores test execution history in Postgres.
3. Add a portal that can browse projects, runs, artifacts, failures, and coverage trends over time.
4. Reuse proven patterns from the sibling `varcad.io` project for auth, GraphQL, Redux, provider composition, Sequelize, and `.env` loading.
5. Minimize special cases by keeping the new runtime additive to the existing CLI and package surface.

## Recommended Package Additions

### `packages/server`

Purpose:

- long-running Node service
- ingestion endpoint for runner output
- GraphQL API for portal and internal automation
- Sequelize/Postgres persistence layer
- artifact metadata registry and artifact delivery helpers

Recommended stack:

- `express`
- `@apollo/server`
- `@as-integrations/express5`
- `graphql`
- `sequelize`
- `pg`
- `dotenv` plus `env-var`

Recommended scripts:

- `dev`
- `start`
- `migrate`
- `seed` (optional once fixtures exist)
- `lint`

### `packages/portal`

Purpose:

- Next.js project explorer and historical reporting UI
- SSO-authenticated operator/admin portal
- explorer for projects, runs, packages, modules, files, tests, errors, and artifacts
- coverage-over-time dashboards

Recommended stack:

- `next`
- `next-auth`
- `@apollo/client`
- `@reduxjs/toolkit`
- `next-redux-wrapper`
- `react-redux`
- `styled-components`

Recommended scripts:

- `dev`
- `build`
- `start`
- `lint`

## Chosen Architecture

### Runtime boundary

- Keep existing reporter packages (`@test-station/*`) focused on execution and artifact generation.
- Add the new server and portal as non-publishable application workspaces.
- Ingestion accepts `report.json` plus raw artifact metadata from test-station runs.
- The server stores both:
  - raw run payloads for audit/debugging
  - normalized relational data for querying and trend reporting

### Auth model

Use two auth modes, because a single shared-key-only model does not fit both machine ingestion and interactive SSO usage:

- machine-to-server ingest:
  - shared key via `Authorization: Bearer <key>` or `x-api-key`
  - used by CI runners and backfill/import tools
- portal-to-server GraphQL:
  - SSO session auth via `next-auth`
  - user/session context resolved server-side
  - role and project membership guards for protected queries/mutations

This keeps the ingest path simple while preserving proper user identity and auditability in the portal.

### Data ownership

- Postgres stores relational facts and queryable history.
- artifact binaries should not live in Postgres.
- artifact content should be stored in object storage or a mounted artifact directory, with metadata stored in Postgres.

## Reference Patterns To Copy From `varcad.io`

### `.env` loading

Reference:

- `../varcad.io/packages/env/index.js`

Pattern to copy:

- load `.env`
- load `.env.local` with override
- expose parsed env access through `env-var`

Recommendation:

- do not add a third new workspace package initially
- place a shared env bootstrap helper under a repo-level module such as `config/env.mjs` or `lib/env/index.mjs`
- import that helper from both `packages/server` and `packages/portal`

### Sequelize + Postgres bootstrap

Reference:

- `../varcad.io/packages/server/db.js`
- `../varcad.io/packages/server/migrations/runMigrations.js`
- `../varcad.io/packages/server/models/*.js`
- `../varcad.io/packages/server/models/testExecutionAssociations.js`

Pattern to copy:

- central Sequelize bootstrap
- explicit migrations at service startup or deploy time
- model-per-file
- separate association wiring module
- `underscored: true` naming convention

### GraphQL server shape

Reference:

- `../varcad.io/packages/server/index.js`
- `../varcad.io/packages/server/graphql/index.js`
- `../varcad.io/packages/server/graphql/guards.js`

Pattern to copy:

- Express host with Apollo mounted at `/graphql`
- GraphQL schema split by queries and mutations
- guard helpers such as `requireActor(...)` / `requireAdminActor(...)`
- health endpoint outside GraphQL

### NextAuth and portal auth flow

Reference:

- `../varcad.io/packages/web/pages/api/auth/[...nextauth].js`
- `../varcad.io/packages/web/middleware.js`

Pattern to copy:

- NextAuth session handling
- auth middleware for protected routes
- cookie-based session propagation
- route guard behavior that redirects unauthenticated users cleanly

### Apollo client and provider composition

Reference:

- `../varcad.io/packages/web/lib/apolloClient.js`
- `../varcad.io/packages/web/pages/_app.js`

Pattern to copy:

- relative same-origin GraphQL endpoint (`/graphql`)
- Apollo error link for unauthorized handling
- provider composition in `_app`
- SSR/bootstrap hooks near the app shell instead of per page

### Redux and style provider patterns

Reference:

- `../varcad.io/packages/web/store/index.js`
- `../varcad.io/packages/admin/store/index.js`
- `../varcad.io/packages/web/pages/_app.js`

Pattern to copy:

- Redux Toolkit slices
- `next-redux-wrapper` hydration pattern
- global provider composition in `_app`
- `styled-components` `ThemeProvider` plus global styles

## Current Gaps In `test-station`

- no long-running server package
- no persistent database
- no GraphQL schema or query/mutation surface
- no user/session model
- no object-storage or durable artifact delivery layer
- no portal UI
- no historical coverage trend storage
- no role or membership system for project access

## Proposed Domain Model

The database should separate stable reference entities from per-run fact tables.

### Reference entities

- `Project`
  - top-level tracked repository or product
- `ProjectPackage`
  - logical package/workspace within a project
- `ProjectModule`
  - normalized module label within a project/package
- `ProjectFile`
  - canonical source file record scoped to project
- `ProjectVersion`
  - branch, tag, commit, semantic version, or release snapshot
- `ReleaseNote`
  - release-note records attached to a project version

### Run and result entities

- `Run`
  - one ingested `report.json`
  - stores summary counts, source metadata, schema version, timestamps
- `SuiteRun`
  - one suite within a run
- `TestExecution`
  - one normalized test result within a suite run
- `CoverageSnapshot`
  - run-level coverage summary
- `CoverageFile`
  - per-file coverage metrics for a coverage snapshot
- `ErrorOccurrence`
  - normalized failure/error rows linked to test executions or suite runs
- `PerformanceStat`
  - duration metrics and optional custom performance dimensions
- `Artifact`
  - artifact metadata plus storage location for raw files/assets

### Relations

- `Project 1->N ProjectVersion`
- `Project 1->N ProjectPackage`
- `ProjectPackage 1->N ProjectModule`
- `ProjectModule 1->N ProjectFile`
- `Project 1->N Run`
- `ProjectVersion 1->N Run`
- `Run 1->N SuiteRun`
- `SuiteRun 1->N TestExecution`
- `Run 1->1 CoverageSnapshot`
- `CoverageSnapshot 1->N CoverageFile`
- `TestExecution 1->N ErrorOccurrence`
- `Run|SuiteRun|TestExecution 1->N PerformanceStat`
- `Run|SuiteRun|TestExecution 1->N Artifact`
- `ProjectVersion 1->N ReleaseNote`

### Modeling rules

- treat `Project`, `ProjectPackage`, `ProjectModule`, and `ProjectFile` as durable dimensions
- treat `Run`, `SuiteRun`, `TestExecution`, `CoverageSnapshot`, `CoverageFile`, and `ErrorOccurrence` as append-only facts
- keep the original raw `report.json` payload stored on `Run` for audit/debug parity
- use foreign keys plus explicit associations instead of implicit JSON joins

## Ingestion Contract

### Input

Recommended initial ingestion payload:

- `projectKey`
- `source`
  - CI provider, repo, branch, commit SHA, tag, actor, run URL
- `report`
  - normalized `report.json`
- `artifacts`
  - optional artifact manifest and/or upload references

### Delivery

- `POST /api/ingest`
- auth:
  - `Authorization: Bearer <shared-key>`
  - or `x-api-key`
- content types:
  - phase 1: JSON payload only
  - phase 2: multipart or signed-upload flow for binary artifacts

### Idempotency

Require a deterministic external run identity:

- preferred key:
  - `projectKey + ciProvider + ciRunId`
- fallback:
  - `projectKey + commitSha + startedAt + report.summary.totalTests`

Duplicate ingests should upsert the `Run` row rather than create duplicates.

## GraphQL Surface

### Queries

Phase 1 query set:

- `me`
- `projects`
- `project(id|slug)`
- `runs(projectId, filters...)`
- `run(id)`
- `runPackages(runId)`
- `runModules(runId)`
- `runFiles(runId, filters...)`
- `coverageTrend(projectId, packageId, moduleId, fileId, range)`
- `artifacts(runId, suiteRunId, testExecutionId)`
- `releaseNotes(projectId, versionId)`

### Mutations

Phase 1 mutation set:

- `ingestRun(report: JSON!, projectKey: String!, secret: String)`
- `upsertProject(...)`
- `upsertProjectVersion(...)`
- `createReleaseNote(...)`
- `updateReleaseNote(...)`

### Guard policy

- GraphQL reads for portal require authenticated user context
- write/admin mutations require role guard
- service-only mutations may also accept shared-key auth where user identity is not needed

## Portal Scope

### Initial views

- project list
- project detail
- run list with filters
- run detail
- package/module/file drilldown
- failed test explorer
- artifact viewer/download panel
- coverage over time charts
- release notes panel

### State management policy

To reduce complexity:

- Apollo owns remote entity fetching and caching
- Redux owns UI state only:
  - selected filters
  - view mode
  - chart range
  - sidebar/panel state
  - persisted portal preferences

Do not mirror the full GraphQL entity graph into Redux.

### Styling policy

- use the varcad-style provider composition:
  - `ThemeProvider`
  - global styles
  - route-level shell
- establish one portal design system early
- do not mix multiple styling systems in the first implementation

## Implementation Phases

## Phase 1: Workspace Scaffold and Runtime Foundations

### Deliverables

- add `packages/server`
- add `packages/portal`
- add shared env bootstrap helper patterned after `varcad.io/packages/env/index.js`
- add root scripts for server and portal dev/build/lint
- mark both new packages `private: true` so npm publish flow ignores them

### Technical decisions

- keep new applications under existing `packages/*` workspaces
- use Express + Apollo in server
- use Next.js Pages Router in portal to stay aligned with the varcad auth/provider patterns

### Acceptance criteria

- `yarn workspace server dev` starts a health endpoint
- `yarn workspace portal dev` starts a Next.js shell
- both packages load `.env` and `.env.local` consistently

## Phase 2: Database Schema and Migrations

### Deliverables

- Sequelize bootstrap
- migration runner
- initial models:
  - `Project`
  - `ProjectVersion`
  - `ProjectPackage`
  - `ProjectModule`
  - `ProjectFile`
  - `Run`
  - `SuiteRun`
  - `TestExecution`
  - `CoverageSnapshot`
  - `CoverageFile`
  - `ErrorOccurrence`
  - `PerformanceStat`
  - `Artifact`
  - `ReleaseNote`
- association wiring module

### Acceptance criteria

- fresh database can be created from migrations only
- schema supports one ingested run with packages, modules, files, tests, coverage, and artifacts
- no `sequelize.sync({ alter: true })` dependency for production correctness

## Phase 3: Ingestion API

### Deliverables

- `POST /api/ingest`
- shared-key auth middleware
- raw payload persistence
- report-to-model normalization layer
- idempotent upsert behavior for repeated CI deliveries

### Recommended normalization strategy

- persist raw report first
- derive dimension records second
- write fact rows in a transaction
- store artifact metadata even before full binary upload support exists

### Acceptance criteria

- a `test-station` run can be ingested without changing the existing CLI output contract
- duplicate ingest does not create duplicate run rows
- ingestion failures return actionable validation errors

## Phase 4: GraphQL Query Layer

### Deliverables

- GraphQL schema split into query and mutation modules
- actor/admin guard utilities
- read queries for projects, runs, files, tests, coverage trends, and release notes
- service mutation for ingest backfill or administrative run repair if needed

### Acceptance criteria

- portal can fetch all data from GraphQL without REST fallbacks
- GraphQL unauthorized requests fail consistently
- same-origin `/graphql` is usable from the portal app

## Phase 5: Portal Shell, SSO, and Explorer

### Deliverables

- NextAuth setup copied from varcad patterns
- route middleware for protected portal routes
- Apollo client with relative `/graphql`
- Redux store for UI state and hydration
- provider composition in `_app`
- initial pages:
  - `/`
  - `/projects/[slug]`
  - `/runs/[id]`

### Acceptance criteria

- unauthenticated users are redirected to sign-in
- authenticated users can explore projects and runs
- portal shell uses one consistent theme/provider stack

## Phase 6: Coverage Trends and Historical Reporting

### Deliverables

- coverage trend query shapes
- project/package/module/file trend charts
- run-to-run comparison summaries
- release-note and version overlays on trend charts

### Recommended implementation choice

- precompute daily or per-run aggregate tables for coverage trends
- do not compute long historical trend lines from raw `CoverageFile` rows on every request

### Acceptance criteria

- portal can show line coverage changes over time
- trend queries remain fast at multi-thousand-run scale

## Phase 7: Artifact Delivery and Hardening

### Deliverables

- artifact binary storage integration
- artifact access authorization checks
- pagination and search hardening
- audit logging for admin writes
- retention policy for raw payloads and artifacts

### Acceptance criteria

- artifact downloads are authorized and traceable
- retention jobs do not break run history integrity
- operational dashboards expose ingest failure rate and queue health

## Alternatives and Complexity Controls

### Recommended path

- one server package
- one portal package
- shared-key REST ingest
- SSO-authenticated same-origin GraphQL for portal
- Apollo for remote data, Redux for UI state only
- Sequelize with explicit migrations

### Alternative 1: shared-key-only GraphQL everywhere

Why not recommended:

- conflicts with interactive SSO portal requirements
- weakens auditability for user actions
- pushes secret management into the browser or a server-side proxy layer

### Alternative 2: skip GraphQL and use REST for portal reads

Why not recommended:

- duplicates query composition logic across run explorer screens
- makes package/module/file drilldown harder to evolve
- conflicts with the requested varcad GraphQL pattern reuse

### Alternative 3: no Redux in portal

Why only partially recommended:

- viable for small portals
- but the requested varcad pattern reuse explicitly includes Redux
- keep Redux, but limit it to UI/runtime state instead of remote entity duplication

### Alternative 4: store artifacts in Postgres

Why not recommended:

- makes storage growth and backup cost worse
- slows ingestion and retrieval
- is unnecessary when artifact metadata plus object storage is enough

## Out Of Scope For Initial Release

- multi-tenant billing
- fine-grained RBAC beyond admin/project membership
- custom report-schema mutation by portal users
- arbitrary ad hoc analytics builder
- live websocket push updates
- editing historical run facts after ingest except for controlled admin repair flows

## Rollout Recommendation

1. Deliver server scaffold, DB schema, and ingest path first.
2. Prove ingestion against the current `test-station` self-test report and one external consumer example.
3. Add read-only GraphQL and a read-only portal explorer before any write-heavy admin tooling.
4. Add coverage-over-time charts only after per-run ingestion is stable.
5. Add artifact binary handling after metadata and access patterns are settled.

## Definition Of Done

- CI runners can ingest `test-station` run output into the new server
- project, package, module, file, run, coverage, error, performance, artifact, version, and release-note data are queryable
- portal users can browse projects and inspect individual test executions
- coverage-over-time views are available and performant
- auth, migrations, env loading, GraphQL structure, Redux usage, and provider composition follow the same broad conventions as `varcad.io`
