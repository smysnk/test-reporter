# Test Station Admin Access Control Implementation Plan

## Status

- Proposed.
- Phase 0 completed.
- Phase 1 completed.
- Phase 2 completed.
- Phase 3 completed.
- Phase 4 completed.
- Phase 5 completed.
- Phase 6 completed.
- Phase 7 completed.
- Phase 8 completed.
- This document turns the admin-area and access-control design into a concrete implementation checklist.

## Goals

1. Add an admin area where administrators can manage:
   - projects
   - public/private visibility
   - roles
   - groups
   - user membership in roles and groups
   - project access granted to roles and groups
2. Move project visibility rules into the database so they are enforced server-side.
3. Allow unauthenticated guest users to browse projects explicitly marked public.
4. Prevent unauthorized access and data leakage from GraphQL, web pages, and nested run/test/artifact reads.
5. Preserve the existing ingest flow and shared-key authentication for CI/report publishing.

## Current Constraints

- Project access is currently derived from `projectKeys` on the web session token in [packages/web/lib/auth.js](/Users/josh/play/test-station/packages/web/lib/auth.js).
- The server trusts forwarded actor headers in [packages/server/graphql/context.js](/Users/josh/play/test-station/packages/server/graphql/context.js).
- Query filtering is centralized in [packages/server/graphql/query-service.js](/Users/josh/play/test-station/packages/server/graphql/query-service.js).
- All current GraphQL reads require an authenticated actor in [packages/server/graphql/queries.js](/Users/josh/play/test-station/packages/server/graphql/queries.js).
- The same-origin web GraphQL proxy rejects anonymous requests in [packages/web/pages/api/graphql-proxy.js](/Users/josh/play/test-station/packages/web/pages/api/graphql-proxy.js).
- Projects are created and updated through ingest, so admin-managed access settings must not be stored in fields ingest overwrites casually.

## Design Principles

- Keep authorization decisions on the server.
- Treat guest access as a first-class actor mode, not a client-side exception.
- Return `404` or `null` for private resources that the current viewer should not know about.
- Keep `admin` as an explicit privileged capability, separate from normal project roles.
- Preserve `WEB_ADMIN_EMAILS` as a bootstrap escape hatch during rollout.

## Data Model

### New Tables

- `users`
- `roles`
- `groups`
- `user_roles`
- `user_groups`
- `project_role_access`
- `project_group_access`

### Project Changes

- Add `is_public` to `projects`

### User Changes

- Persist normalized user identity from OAuth:
  - `email`
  - `normalized_email`
  - `name`
  - `avatar_url`
  - `is_admin`
  - `metadata`

### Recommended Relationship Shape

- A `User` can belong to many `Role`s.
- A `User` can belong to many `Group`s.
- A `Project` can be visible to many `Role`s.
- A `Project` can be visible to many `Group`s.
- A `Project` can be public via `isPublic = true`.
- An admin can see and manage everything.

## Non-Goals

- Per-run ACLs
- Per-artifact ACLs independent of project visibility
- External identity-provider role sync in the first pass
- Fine-grained mutation permissions for non-admin editors

## Phases

### Phase 0: Finalize Access Semantics

Objective:

- Lock the rules before touching migrations or auth flow.

Checklist:

- [x] Define the viewer types:
  - guest
  - member
  - admin
- [x] Confirm the access rules:
  - guests can see only public projects
  - members can see public projects plus projects granted by role/group membership
  - admins can see everything
- [x] Confirm private resource behavior:
  - private projects/runs should resolve as `null` in GraphQL lookups
  - SSR pages should translate unauthorized private access into `404`
- [x] Confirm whether a user can hold multiple roles.
- [x] Confirm whether roles are global or project-scoped.
  - Recommended: global roles, project-specific grants via join tables.
- [x] Confirm whether groups are purely manual in the admin area.

Decisions:

#### Viewer Types

- `guest`
  - unauthenticated viewer
  - may read only public projects and their related data
- `member`
  - authenticated non-admin viewer
  - may read:
    - public projects
    - private projects granted through role membership
    - private projects granted through group membership
- `admin`
  - authenticated viewer with `isAdmin = true`
  - may read and manage all access-control objects and all projects

#### Access Rules

- Project visibility is determined in this order:
  1. admin override
  2. project `isPublic`
  3. project access granted to any of the actor's roles
  4. project access granted to any of the actor's groups
- There is no direct user-to-project grant in the first pass.
- A user may hold multiple roles.
- A user may belong to multiple groups.
- Roles are global definitions.
- Project access is assigned to roles through `project_role_access`.
- Groups are global definitions.
- Project access is assigned to groups through `project_group_access`.
- Groups are manual only in the first pass.
  - no IdP sync
  - no automatic membership rules

#### Public and Private Defaults

- Existing projects default to private on migration.
- New projects created by ingest default to private unless explicitly made public in the admin area.
- Public visibility applies at the project boundary.
  - if a project is public, its runs, suites, tests, artifacts, release notes, and coverage views are public
  - if a project is private, all derived resources are private

#### Private Resource Behavior

- GraphQL list queries return only visible resources.
- GraphQL direct lookup queries return `null` when the target resource is not visible.
- Nested resolvers return only data associated with already-visible parent resources.
- SSR pages return `404` for private resources that the current viewer cannot access.
- The web UI must not display "access denied" pages that confirm private project existence to guests or unauthorized members.

#### Guest Behavior

- Guests can load the public home page.
- The public home page shows only public projects and public runs.
- Guests may open public project and run detail pages directly.
- Guests cannot access the admin area.
- Guests cannot call admin GraphQL queries or mutations.
- Guests cannot call ingest mutations or the ingest HTTP endpoint without the shared key.

#### Auth and Admin Bootstrap

- `admin` remains a hard privileged capability, separate from normal roles.
- `WEB_ADMIN_EMAILS` remains a bootstrap admin source during rollout.
- Persisted `User.isAdmin` becomes the durable source of truth after Phase 2.
- During rollout, a matching `WEB_ADMIN_EMAILS` entry should elevate the persisted user to admin if needed.

#### GraphQL Semantics

- Public read queries will become guest-safe in Phase 4.
- Admin queries and mutations will always require admin access.
- The authenticated viewer identity query will move to a nullable `viewer` field.
- Existing `me` behavior should be retired in favor of `viewer` once guest-safe reads are in place.

#### Admin Area Scope

- The first admin UI includes:
  - user list and admin toggle
  - role management
  - group management
  - project public/private toggle
  - project-to-role assignments
  - project-to-group assignments
  - user-to-role membership management
  - user-to-group membership management
- Non-admin users do not get access to admin screens in the first pass.
- There is no delegated project-manager role in the first pass.

Exit criteria:

- We have one written rule set for guest/member/admin access behavior.

### Phase 1: Add Sequelize Models and Migrations

Objective:

- Create the persistent access-control schema.

Checklist:

- [x] Add a migration for:
  - `users`
  - `roles`
  - `groups`
  - `user_roles`
  - `user_groups`
  - `project_role_access`
  - `project_group_access`
  - `projects.is_public`
- [x] Add Sequelize models:
  - [packages/server/models/User.js](/Users/josh/play/test-station/packages/server/models/User.js)
  - [packages/server/models/Role.js](/Users/josh/play/test-station/packages/server/models/Role.js)
  - [packages/server/models/Group.js](/Users/josh/play/test-station/packages/server/models/Group.js)
  - [packages/server/models/UserRole.js](/Users/josh/play/test-station/packages/server/models/UserRole.js)
  - [packages/server/models/UserGroup.js](/Users/josh/play/test-station/packages/server/models/UserGroup.js)
  - [packages/server/models/ProjectRoleAccess.js](/Users/josh/play/test-station/packages/server/models/ProjectRoleAccess.js)
  - [packages/server/models/ProjectGroupAccess.js](/Users/josh/play/test-station/packages/server/models/ProjectGroupAccess.js)
- [x] Update [packages/server/models/Project.js](/Users/josh/play/test-station/packages/server/models/Project.js) with `isPublic`.
- [x] Wire associations in [packages/server/models/reportingAssociations.js](/Users/josh/play/test-station/packages/server/models/reportingAssociations.js).
- [x] Export the new models from [packages/server/models/index.js](/Users/josh/play/test-station/packages/server/models/index.js).
- [x] Add unique indexes for:
  - user normalized email
  - role key
  - group key
  - user-role pair
  - user-group pair
  - project-role pair
  - project-group pair

Implementation notes:

- Do not store access rules inside `projects.metadata`.
- Keep access tables separate so ingest can continue updating project name/slug/repository metadata safely.

Exit criteria:

- Migrations run cleanly on a fresh database.
- Existing ingest still succeeds against the migrated schema.

### Phase 2: Persist and Resolve Viewer Identity on the Server

Objective:

- Make the server, not the session token, the source of truth for user/admin/group/role membership.

Checklist:

- [x] Add a user lookup/upsert layer keyed by normalized email.
- [x] On authenticated web requests, resolve the current user record from session identity.
- [x] Continue supporting `WEB_ADMIN_EMAILS` as bootstrap admin fallback.
- [x] Mark persisted users as admin when they match bootstrap admin config, or when explicitly set in the admin area.
- [x] Extend the GraphQL actor shape to include:
  - `userId`
  - `email`
  - `name`
  - `isAdmin`
  - `roleKeys`
  - `groupKeys`
  - `isGuest`
- [x] Update [packages/server/graphql/context.js](/Users/josh/play/test-station/packages/server/graphql/context.js) to resolve guest/member/admin actors cleanly.
- [x] Stop relying on `projectKeys` as the long-term access source.

Implementation notes:

- The web may still forward basic identity headers for the initial phase.
- The server should enrich that identity from persisted membership data before any query executes.
- `projectKeys` remains as a temporary compatibility field for existing query filtering until Phase 3 replaces access evaluation.

Exit criteria:

- The server can identify guest, member, and admin viewers without relying on `projectKeys`.

### Phase 3: Implement Central Access Evaluation

Objective:

- Replace header-driven project access with database-backed rules.

Checklist:

- [x] Add an access evaluation service, for example:
  - `canViewProject(actor, project)`
  - `listVisibleProjectIds(actor)`
- [x] Update [packages/server/graphql/guards.js](/Users/josh/play/test-station/packages/server/graphql/guards.js) to support guest actors and DB-backed checks.
- [x] Update [packages/server/graphql/query-service.js](/Users/josh/play/test-station/packages/server/graphql/query-service.js):
  - `listProjects`
  - `findProject`
  - `listRuns`
  - `findRun`
  - `listSuitesForRun`
  - `listTestsForRun`
  - `listTestsForSuiteRun`
  - `listArtifacts`
  - `listReleaseNotes`
  - `listCoverageTrend`
  - `getRunCoverageComparison`
- [x] Ensure nested lookups never bypass project visibility by starting from a visible project/run set.
- [x] Ensure private objects return no data for guests and unauthorized members.

Implementation notes:

- Keep this logic in one reusable service.
- Avoid duplicating access logic across resolvers and web pages.
- Query-time project visibility now comes from `isPublic`, `project_role_access`, and `project_group_access`.
- `projectKeys` remains on the actor only as a compatibility field for older web/session code, not as the query-layer source of truth.

Exit criteria:

- Every read path is filtered by the same server-side visibility rules.

### Phase 4: Open Public Read Access Safely

Objective:

- Allow anonymous browsing of public projects without weakening private data protection.

Checklist:

- [x] Make `me` nullable, or introduce a new nullable `viewer` query.
- [x] Remove unconditional `requireActor(...)` from read-only queries that should work for guests.
- [x] Keep admin-only queries and mutations behind admin guards.
- [x] Update [packages/server/graphql/queries.js](/Users/josh/play/test-station/packages/server/graphql/queries.js) so these can run as guest-safe reads:
  - `projects`
  - `project`
  - `runs`
  - `run`
  - `runPackages`
  - `runModules`
  - `runFiles`
  - `tests`
  - `coverageTrend`
  - `runCoverageComparison`
  - `artifacts`
  - `releaseNotes`
- [x] Update [packages/web/pages/api/graphql-proxy.js](/Users/josh/play/test-station/packages/web/pages/api/graphql-proxy.js) to pass through anonymous requests.
- [x] Update [packages/web/lib/serverGraphql.js](/Users/josh/play/test-station/packages/web/lib/serverGraphql.js) to work with a missing session.
- [x] Update [packages/web/lib/routeProtection.js](/Users/josh/play/test-station/packages/web/lib/routeProtection.js):
  - keep `/admin/**` protected
  - allow `/`, `/projects/**`, and `/runs/**` to be requested anonymously
- [x] Update SSR pages to render:
  - public data for guests
  - `404` for private resources
  - sign-in CTA where appropriate

Implementation notes:

- Added a nullable `viewer` query and made `me` nullable as a compatibility alias.
- Public read queries now execute against the persisted guest/member/admin actor model without requiring a logged-in session first.
- The web GraphQL proxy and runner report endpoint now pass anonymous requests through to the server so public run pages work end to end.
- Route protection is now reserved for `/admin/**`; overview, project, and run pages can be requested anonymously and rely on server-side filtering plus `404` handling for private resources.
- The shared web shell now shows a sign-in CTA when there is no active session.

Exit criteria:

- A guest can browse only public projects and their public data.
- Private project existence is not leaked through SSR or GraphQL.

### Phase 5: Add Admin GraphQL Schema and Mutations

Objective:

- Provide the management API needed by the admin area.

Checklist:

- [x] Add admin queries for:
  - users
  - user by id/email
  - roles
  - groups
  - project access configuration
- [x] Add admin mutations for:
  - create/update/delete role
  - create/update/delete group
  - create/update/delete user admin status
  - add/remove user role
  - add/remove user group
  - set project `isPublic`
  - add/remove project role access
  - add/remove project group access
- [x] Keep all admin queries/mutations behind `requireAdminActor(...)`.
- [x] Make sure admin responses do not expose secrets or auth-provider tokens.
- [x] Update type defs in:
  - [packages/server/graphql/queries.js](/Users/josh/play/test-station/packages/server/graphql/queries.js)
  - [packages/server/graphql/mutations.js](/Users/josh/play/test-station/packages/server/graphql/mutations.js)

Implementation notes:

- Added a dedicated admin service in [packages/server/graphql/admin-service.js](/Users/josh/play/test-station/packages/server/graphql/admin-service.js) so management CRUD is kept separate from the public read query service.
- Added admin-only query types for users, roles, groups, and per-project access configuration.
- Added admin-only mutations for role/group CRUD, user membership changes, admin toggles, and project visibility/access updates.
- Admin user responses are intentionally sanitized to exclude metadata, provider tokens, and other auth-provider internals.
- The regression suite now covers:
  - non-admin rejection for admin queries
  - full admin role/group/user/project access management through GraphQL

Exit criteria:

- Admin workflows can be driven entirely from GraphQL without direct database edits.

### Phase 6: Build the Admin Area in the Web App

Objective:

- Add the UI needed to manage visibility, roles, and groups.

Checklist:

- [ ] Add admin navigation to [packages/web/components/WebShell.js](/Users/josh/play/test-station/packages/web/components/WebShell.js) for admins only.
- [x] Add admin navigation to [packages/web/components/WebShell.js](/Users/josh/play/test-station/packages/web/components/WebShell.js) for admins only.
- [x] Add `/admin` overview page.
- [x] Add `/admin/projects` list page.
- [x] Add `/admin/projects/[slug]` project access editor.
- [x] Add `/admin/roles` role management page.
- [x] Add `/admin/groups` group management page.
- [x] Add `/admin/users` user management page.
- [x] Add server-side admin page loaders in [packages/web/lib/serverGraphql.js](/Users/josh/play/test-station/packages/web/lib/serverGraphql.js).
- [x] Add admin-specific queries in [packages/web/lib/queries.js](/Users/josh/play/test-station/packages/web/lib/queries.js).
- [x] Add clear UI states for:
  - public/private toggle
  - assigned roles
  - assigned groups
  - user memberships
  - admin privileges

Implementation notes:

- Protect `/admin/**` with authenticated admin checks.
- Do not rely on hidden buttons alone; the server must still reject unauthorized admin operations.
- Added a shared admin page loader in [packages/web/lib/adminPageLoader.js](/Users/josh/play/test-station/packages/web/lib/adminPageLoader.js) so every admin route redirects unauthenticated users to sign-in and translates non-admin/private responses into `404`.
- Added admin-only SSR loaders in [packages/web/lib/serverGraphql.js](/Users/josh/play/test-station/packages/web/lib/serverGraphql.js) that first resolve `viewer` and only request admin datasets when `viewer.isAdmin` is true.
- Added the admin page set:
  - [packages/web/pages/admin/index.js](/Users/josh/play/test-station/packages/web/pages/admin/index.js)
  - [packages/web/pages/admin/projects/index.js](/Users/josh/play/test-station/packages/web/pages/admin/projects/index.js)
  - [packages/web/pages/admin/projects/[slug].js](/Users/josh/play/test-station/packages/web/pages/admin/projects/%5Bslug%5D.js)
  - [packages/web/pages/admin/roles.js](/Users/josh/play/test-station/packages/web/pages/admin/roles.js)
  - [packages/web/pages/admin/groups.js](/Users/josh/play/test-station/packages/web/pages/admin/groups.js)
  - [packages/web/pages/admin/users.js](/Users/josh/play/test-station/packages/web/pages/admin/users.js)
- Added a shared admin component/action layer in [packages/web/components/AdminBits.js](/Users/josh/play/test-station/packages/web/components/AdminBits.js) so role/group/project/user mutations all use the same browser GraphQL + reload flow.

Exit criteria:

- An admin can manage users, roles, groups, and project visibility entirely from the web UI.

### Phase 7: Remove Old Project-Key Access Assumptions

Objective:

- Complete the transition from session `projectKeys` to database-backed authorization.

Checklist:

- [x] Remove project access as a normal responsibility of `WEB_DEFAULT_PROJECT_KEYS`.
- [x] Limit any remaining default project key behavior to demo/local bootstrap only, if still needed.
- [x] Simplify [packages/web/lib/auth.js](/Users/josh/play/test-station/packages/web/lib/auth.js) so session payload does not pretend to be the access-control source of truth.
- [x] Remove or de-emphasize `x-test-station-actor-project-keys` from web-to-server auth flow.
- [x] Update tests that currently assume `projectKeys` is the durable access control model.

Implementation notes:

- Removed `projectKeys` from the web JWT/session payload and from the web-to-server actor headers in [packages/web/lib/auth.js](/Users/josh/play/test-station/packages/web/lib/auth.js).
- Removed the demo sign-in `projectKeys` input from [packages/web/pages/auth/signin.js](/Users/josh/play/test-station/packages/web/pages/auth/signin.js) so demo access no longer implies direct project grants.
- Removed `projectKeys` from the public web viewer query in [packages/web/lib/queries.js](/Users/josh/play/test-station/packages/web/lib/queries.js) and from the GraphQL `Actor` type in [packages/server/graphql/queries.js](/Users/josh/play/test-station/packages/server/graphql/queries.js).
- Updated [packages/server/graphql/context.js](/Users/josh/play/test-station/packages/server/graphql/context.js) to ignore legacy `x-test-station-actor-project-keys` input and normalize actors without project-key lists.
- Tightened [packages/server/graphql/guards.js](/Users/josh/play/test-station/packages/server/graphql/guards.js) so fallback project access no longer relies on actor `projectKeys`; persisted access service data is now the only non-admin/private access path.
- Removed `WEB_DEFAULT_PROJECT_KEYS` from the tracked env examples in [.env.example](/Users/josh/play/test-station/.env.example) and [packages/web/.env.example](/Users/josh/play/test-station/packages/web/.env.example).

Exit criteria:

- Project visibility is determined by persisted access rules, not by a session token list.

### Phase 8: Hardening, Leakage Audit, and Backfill

Objective:

- Make sure the new model is safe in real-world use.

Checklist:

- [x] Audit every GraphQL resolver for guest/private leakage.
- [x] Audit every SSR page for unauthorized private data exposure in props.
- [x] Verify artifact lists and release notes respect project visibility.
- [x] Verify run-detail nested data respects project visibility.
- [x] Add seed/bootstrap behavior for the first admin user.
- [x] Add migration or startup backfill to initialize existing admins from `WEB_ADMIN_EMAILS`.
- [x] Decide whether legacy projects default to:
  - private
  - public
  - configurable migration default
  - Recommended: private by default.
- [x] Update docs and env examples.

Implementation notes:

- Kept the visibility model centralized in [packages/server/graphql/query-service.js](/Users/josh/play/test-station/packages/server/graphql/query-service.js) and [packages/server/graphql/access-service.js](/Users/josh/play/test-station/packages/server/graphql/access-service.js), then verified the public/private boundaries through the Phase 12 and Phase 13 suites instead of duplicating access checks in individual web pages.
- Added startup admin backfill in [packages/server/bootstrapAdminUsers.js](/Users/josh/play/test-station/packages/server/bootstrapAdminUsers.js) and wired it into [packages/server/db.js](/Users/josh/play/test-station/packages/server/db.js) so `WEB_ADMIN_EMAILS` can seed the first admin user and elevate matching existing users during startup.
- Kept legacy project defaults private by leaving [packages/server/models/Project.js](/Users/josh/play/test-station/packages/server/models/Project.js) and the access-control migration default at `isPublic = false`.
- Updated the operator docs and env examples to describe startup admin bootstrap and the public/private project model in [README.md](/Users/josh/play/test-station/README.md), [.env.example](/Users/josh/play/test-station/.env.example), and [packages/web/.env.example](/Users/josh/play/test-station/packages/web/.env.example).

Exit criteria:

- Existing installations can roll forward without manual SQL surgery.
- Private data is not exposed through guest or non-admin paths.

## Test Checklist

### Server / GraphQL

- [x] Guest cannot query private projects.
- [x] Guest can query public projects.
- [x] Guest can query runs only for public projects.
- [x] Guest cannot access artifacts/tests/release notes for private projects.
- [x] Member gains access through assigned role.
- [x] Member gains access through assigned group.
- [x] Member without grant cannot infer private project existence.
- [x] Admin can see all projects regardless of public flag or grants.
- [x] Admin mutations reject non-admin actors.
- [x] Ingest mutation still accepts shared-key auth.
- [x] Ingest mutation remains inaccessible to guests and normal members.

### Web / SSR

- [x] Guest can open the home page and see public projects.
- [x] Guest can open a public project page.
- [x] Guest can open a public run page.
- [x] Guest receives `404` for private project/run pages.
- [x] Admin pages redirect unauthenticated users to sign-in.
- [x] Admin pages reject authenticated non-admin users.
- [x] Admin pages render current role/group/project state correctly.

### Migration / Persistence

- [x] Fresh database migrate succeeds.
- [x] Existing database migrate succeeds.
- [x] Existing project ingest still works after schema changes.
- [x] Access-control tables maintain uniqueness and referential integrity.

## Suggested File Touch List

### Server

- [packages/server/migrations/](/Users/josh/play/test-station/packages/server/migrations)
- [packages/server/models/index.js](/Users/josh/play/test-station/packages/server/models/index.js)
- [packages/server/models/reportingAssociations.js](/Users/josh/play/test-station/packages/server/models/reportingAssociations.js)
- [packages/server/models/Project.js](/Users/josh/play/test-station/packages/server/models/Project.js)
- [packages/server/graphql/context.js](/Users/josh/play/test-station/packages/server/graphql/context.js)
- [packages/server/graphql/guards.js](/Users/josh/play/test-station/packages/server/graphql/guards.js)
- [packages/server/graphql/query-service.js](/Users/josh/play/test-station/packages/server/graphql/query-service.js)
- [packages/server/graphql/queries.js](/Users/josh/play/test-station/packages/server/graphql/queries.js)
- [packages/server/graphql/mutations.js](/Users/josh/play/test-station/packages/server/graphql/mutations.js)

### Web

- [packages/web/lib/auth.js](/Users/josh/play/test-station/packages/web/lib/auth.js)
- [packages/web/lib/routeProtection.js](/Users/josh/play/test-station/packages/web/lib/routeProtection.js)
- [packages/web/lib/serverGraphql.js](/Users/josh/play/test-station/packages/web/lib/serverGraphql.js)
- [packages/web/lib/queries.js](/Users/josh/play/test-station/packages/web/lib/queries.js)
- [packages/web/pages/api/graphql-proxy.js](/Users/josh/play/test-station/packages/web/pages/api/graphql-proxy.js)
- [packages/web/components/WebShell.js](/Users/josh/play/test-station/packages/web/components/WebShell.js)
- [packages/web/pages/index.js](/Users/josh/play/test-station/packages/web/pages/index.js)
- [packages/web/pages/projects/[slug].js](/Users/josh/play/test-station/packages/web/pages/projects/%5Bslug%5D.js)
- [packages/web/pages/runs/[id].js](/Users/josh/play/test-station/packages/web/pages/runs/%5Bid%5D.js)

### Tests

- [tests/phase12-graphql-query-layer.test.js](/Users/josh/play/test-station/tests/phase12-graphql-query-layer.test.js)
- [tests/phase13-web-phase5.test.js](/Users/josh/play/test-station/tests/phase13-web-phase5.test.js)
- add new access-control coverage as needed

## Recommended Delivery Order

1. Phase 0
2. Phase 1
3. Phase 2
4. Phase 3
5. Phase 4
6. Phase 5
7. Phase 6
8. Phase 7
9. Phase 8

## Rollout Recommendation

- Ship server-side filtering before opening guest browsing.
- Ship admin mutations before the full admin UI if needed.
- Keep `WEB_ADMIN_EMAILS` enabled until the first real admin records are verified in production.
- Default all existing projects to private unless there is an explicit reason to expose them publicly.
