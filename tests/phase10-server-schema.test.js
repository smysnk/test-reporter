import test from 'node:test';
import assert from 'node:assert/strict';
import { Sequelize } from 'sequelize';
import * as coverageTrendMigration from '../packages/server/migrations/20260309_coverage_trend_points.js';
import * as initialMigration from '../packages/server/migrations/20260309_initial_reporting_schema.js';
import { loadMigrations, runMigrations } from '../packages/server/migrations/runMigrations.js';
import {
  Artifact,
  CoverageFile,
  CoverageSnapshot,
  CoverageTrendPoint,
  ErrorOccurrence,
  PerformanceStat,
  Project,
  ProjectFile,
  ProjectModule,
  ProjectPackage,
  ProjectVersion,
  ReleaseNote,
  Run,
  SuiteRun,
  TestExecution,
} from '../packages/server/models/index.js';

test('loadMigrations includes the initial reporting schema migration', async () => {
  const migrations = await loadMigrations();
  assert.ok(migrations.some((migration) => migration.id === initialMigration.id));
  assert.ok(migrations.some((migration) => migration.id === coverageTrendMigration.id));
});

test('runMigrations applies the initial reporting schema exactly once', async () => {
  const state = createFakeMigrationState();

  await runMigrations(state.sequelize, {
    migrations: [initialMigration, coverageTrendMigration],
  });

  assert.equal(state.createdTables.length, 15);
  assert.ok(state.createdTables.some((entry) => entry.tableName === 'projects'));
  assert.ok(state.createdTables.some((entry) => entry.tableName === 'runs'));
  assert.ok(state.createdTables.some((entry) => entry.tableName === 'coverage_files'));
  assert.ok(state.createdTables.some((entry) => entry.tableName === 'artifacts'));
  assert.ok(state.createdTables.some((entry) => entry.tableName === 'coverage_trend_points'));
  assert.ok(state.indexes.some((entry) => entry.options?.name === 'runs_project_id_external_key_unique'));
  assert.ok(state.indexes.some((entry) => entry.options?.name === 'coverage_snapshots_run_id_unique'));
  assert.ok(state.indexes.some((entry) => entry.options?.name === 'coverage_trend_points_run_scope_unique'));
  assert.deepEqual(state.insertedMigrations, [initialMigration.id, coverageTrendMigration.id]);
  assert.equal(state.transactions.length, 2);
  assert.equal(state.transactions.every((entry) => entry.committed === true), true);
  assert.equal(state.transactions.every((entry) => entry.rolledBack === false), true);

  const rerunState = createFakeMigrationState([initialMigration.id, coverageTrendMigration.id]);
  await runMigrations(rerunState.sequelize, {
    migrations: [initialMigration, coverageTrendMigration],
  });
  assert.equal(rerunState.createdTables.length, 0);
  assert.deepEqual(rerunState.insertedMigrations, []);
});

test('server model registry wires the expected reporting associations', () => {
  assert.equal(Project.associations.projectVersions.target, ProjectVersion);
  assert.equal(Project.associations.projectPackages.target, ProjectPackage);
  assert.equal(Project.associations.projectModules.target, ProjectModule);
  assert.equal(Project.associations.projectFiles.target, ProjectFile);
  assert.equal(Project.associations.coverageTrendPoints.target, CoverageTrendPoint);
  assert.equal(Project.associations.runs.target, Run);
  assert.equal(Project.associations.releaseNotes.target, ReleaseNote);

  assert.equal(ProjectVersion.associations.runs.target, Run);
  assert.equal(ProjectVersion.associations.coverageTrendPoints.target, CoverageTrendPoint);
  assert.equal(ProjectPackage.associations.projectModules.target, ProjectModule);
  assert.equal(ProjectPackage.associations.projectFiles.target, ProjectFile);
  assert.equal(ProjectPackage.associations.suiteRuns.target, SuiteRun);
  assert.equal(ProjectPackage.associations.coverageTrendPoints.target, CoverageTrendPoint);
  assert.equal(ProjectModule.associations.projectFiles.target, ProjectFile);
  assert.equal(ProjectModule.associations.testExecutions.target, TestExecution);
  assert.equal(ProjectModule.associations.coverageFiles.target, CoverageFile);
  assert.equal(ProjectModule.associations.coverageTrendPoints.target, CoverageTrendPoint);
  assert.equal(ProjectFile.associations.testExecutions.target, TestExecution);
  assert.equal(ProjectFile.associations.coverageFiles.target, CoverageFile);
  assert.equal(ProjectFile.associations.coverageTrendPoints.target, CoverageTrendPoint);

  assert.equal(Run.associations.suiteRuns.target, SuiteRun);
  assert.equal(Run.associations.coverageSnapshot.target, CoverageSnapshot);
  assert.equal(Run.associations.coverageTrendPoints.target, CoverageTrendPoint);
  assert.equal(Run.associations.errorOccurrences.target, ErrorOccurrence);
  assert.equal(Run.associations.performanceStats.target, PerformanceStat);
  assert.equal(Run.associations.artifacts.target, Artifact);

  assert.equal(SuiteRun.associations.testExecutions.target, TestExecution);
  assert.equal(SuiteRun.associations.errorOccurrences.target, ErrorOccurrence);
  assert.equal(SuiteRun.associations.performanceStats.target, PerformanceStat);
  assert.equal(SuiteRun.associations.artifacts.target, Artifact);

  assert.equal(TestExecution.associations.errorOccurrences.target, ErrorOccurrence);
  assert.equal(TestExecution.associations.performanceStats.target, PerformanceStat);
  assert.equal(TestExecution.associations.artifacts.target, Artifact);

  assert.equal(CoverageSnapshot.associations.coverageFiles.target, CoverageFile);
});

function createFakeMigrationState(appliedMigrationIds = []) {
  const createdTables = [];
  const indexes = [];
  const insertedMigrations = [];
  const applied = new Set(appliedMigrationIds);
  const transactions = [];

  const sequelize = {
    getQueryInterface() {
      return queryInterface;
    },
    async query(sql, options = {}) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      if (normalized.startsWith('CREATE TABLE IF NOT EXISTS "schema_migrations"')) {
        return [[], null];
      }
      if (normalized.startsWith('SELECT id FROM "schema_migrations"')) {
        return [[...applied].map((id) => ({ id })), null];
      }
      if (normalized.startsWith('INSERT INTO "schema_migrations"')) {
        const id = options?.replacements?.id;
        applied.add(id);
        insertedMigrations.push(id);
        return [[], null];
      }
      throw new Error(`Unexpected raw SQL in migration test: ${normalized}`);
    },
    async transaction() {
      const transaction = {
        committed: false,
        rolledBack: false,
        async commit() {
          this.committed = true;
        },
        async rollback() {
          this.rolledBack = true;
        },
      };
      transactions.push(transaction);
      return transaction;
    },
  };

  const queryInterface = {
    sequelize,
    async createTable(tableName, columns, options) {
      createdTables.push({ tableName, columns, options });
    },
    async addIndex(tableName, fields, options) {
      indexes.push({ tableName, fields, options });
    },
    async dropTable() {},
  };

  return {
    sequelize,
    createdTables,
    indexes,
    insertedMigrations,
    transactions,
  };
}
