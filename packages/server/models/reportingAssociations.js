import Artifact from './Artifact.js';
import CoverageFile from './CoverageFile.js';
import CoverageSnapshot from './CoverageSnapshot.js';
import CoverageTrendPoint from './CoverageTrendPoint.js';
import ErrorOccurrence from './ErrorOccurrence.js';
import PerformanceStat from './PerformanceStat.js';
import Project from './Project.js';
import ProjectFile from './ProjectFile.js';
import ProjectModule from './ProjectModule.js';
import ProjectPackage from './ProjectPackage.js';
import ProjectVersion from './ProjectVersion.js';
import ReleaseNote from './ReleaseNote.js';
import Run from './Run.js';
import SuiteRun from './SuiteRun.js';
import TestExecution from './TestExecution.js';

Project.hasMany(ProjectVersion, { foreignKey: 'projectId', as: 'projectVersions' });
ProjectVersion.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

Project.hasMany(ProjectPackage, { foreignKey: 'projectId', as: 'projectPackages' });
ProjectPackage.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

Project.hasMany(ProjectModule, { foreignKey: 'projectId', as: 'projectModules' });
ProjectModule.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

ProjectPackage.hasMany(ProjectModule, { foreignKey: 'projectPackageId', as: 'projectModules' });
ProjectModule.belongsTo(ProjectPackage, { foreignKey: 'projectPackageId', as: 'projectPackage' });

Project.hasMany(ProjectFile, { foreignKey: 'projectId', as: 'projectFiles' });
ProjectFile.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

Project.hasMany(CoverageTrendPoint, { foreignKey: 'projectId', as: 'coverageTrendPoints' });
CoverageTrendPoint.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

ProjectPackage.hasMany(ProjectFile, { foreignKey: 'projectPackageId', as: 'projectFiles' });
ProjectFile.belongsTo(ProjectPackage, { foreignKey: 'projectPackageId', as: 'projectPackage' });

ProjectModule.hasMany(ProjectFile, { foreignKey: 'projectModuleId', as: 'projectFiles' });
ProjectFile.belongsTo(ProjectModule, { foreignKey: 'projectModuleId', as: 'projectModule' });

Project.hasMany(Run, { foreignKey: 'projectId', as: 'runs' });
Run.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

ProjectVersion.hasMany(Run, { foreignKey: 'projectVersionId', as: 'runs' });
Run.belongsTo(ProjectVersion, { foreignKey: 'projectVersionId', as: 'projectVersion' });

ProjectVersion.hasMany(CoverageTrendPoint, { foreignKey: 'projectVersionId', as: 'coverageTrendPoints' });
CoverageTrendPoint.belongsTo(ProjectVersion, { foreignKey: 'projectVersionId', as: 'projectVersion' });

Run.hasMany(SuiteRun, { foreignKey: 'runId', as: 'suiteRuns' });
SuiteRun.belongsTo(Run, { foreignKey: 'runId', as: 'run' });

ProjectPackage.hasMany(SuiteRun, { foreignKey: 'projectPackageId', as: 'suiteRuns' });
SuiteRun.belongsTo(ProjectPackage, { foreignKey: 'projectPackageId', as: 'projectPackage' });

ProjectPackage.hasMany(CoverageTrendPoint, { foreignKey: 'projectPackageId', as: 'coverageTrendPoints' });
CoverageTrendPoint.belongsTo(ProjectPackage, { foreignKey: 'projectPackageId', as: 'projectPackage' });

SuiteRun.hasMany(TestExecution, { foreignKey: 'suiteRunId', as: 'testExecutions' });
TestExecution.belongsTo(SuiteRun, { foreignKey: 'suiteRunId', as: 'suiteRun' });

ProjectModule.hasMany(TestExecution, { foreignKey: 'projectModuleId', as: 'testExecutions' });
TestExecution.belongsTo(ProjectModule, { foreignKey: 'projectModuleId', as: 'projectModule' });

ProjectFile.hasMany(TestExecution, { foreignKey: 'projectFileId', as: 'testExecutions' });
TestExecution.belongsTo(ProjectFile, { foreignKey: 'projectFileId', as: 'projectFile' });

Run.hasOne(CoverageSnapshot, { foreignKey: 'runId', as: 'coverageSnapshot' });
CoverageSnapshot.belongsTo(Run, { foreignKey: 'runId', as: 'run' });

CoverageSnapshot.hasMany(CoverageFile, { foreignKey: 'coverageSnapshotId', as: 'coverageFiles' });
CoverageFile.belongsTo(CoverageSnapshot, { foreignKey: 'coverageSnapshotId', as: 'coverageSnapshot' });

ProjectFile.hasMany(CoverageFile, { foreignKey: 'projectFileId', as: 'coverageFiles' });
CoverageFile.belongsTo(ProjectFile, { foreignKey: 'projectFileId', as: 'projectFile' });

ProjectFile.hasMany(CoverageTrendPoint, { foreignKey: 'projectFileId', as: 'coverageTrendPoints' });
CoverageTrendPoint.belongsTo(ProjectFile, { foreignKey: 'projectFileId', as: 'projectFile' });

ProjectPackage.hasMany(CoverageFile, { foreignKey: 'projectPackageId', as: 'coverageFiles' });
CoverageFile.belongsTo(ProjectPackage, { foreignKey: 'projectPackageId', as: 'projectPackage' });

ProjectModule.hasMany(CoverageFile, { foreignKey: 'projectModuleId', as: 'coverageFiles' });
CoverageFile.belongsTo(ProjectModule, { foreignKey: 'projectModuleId', as: 'projectModule' });

ProjectModule.hasMany(CoverageTrendPoint, { foreignKey: 'projectModuleId', as: 'coverageTrendPoints' });
CoverageTrendPoint.belongsTo(ProjectModule, { foreignKey: 'projectModuleId', as: 'projectModule' });

Run.hasMany(ErrorOccurrence, { foreignKey: 'runId', as: 'errorOccurrences' });
ErrorOccurrence.belongsTo(Run, { foreignKey: 'runId', as: 'run' });

SuiteRun.hasMany(ErrorOccurrence, { foreignKey: 'suiteRunId', as: 'errorOccurrences' });
ErrorOccurrence.belongsTo(SuiteRun, { foreignKey: 'suiteRunId', as: 'suiteRun' });

TestExecution.hasMany(ErrorOccurrence, { foreignKey: 'testExecutionId', as: 'errorOccurrences' });
ErrorOccurrence.belongsTo(TestExecution, { foreignKey: 'testExecutionId', as: 'testExecution' });

Run.hasMany(PerformanceStat, { foreignKey: 'runId', as: 'performanceStats' });
PerformanceStat.belongsTo(Run, { foreignKey: 'runId', as: 'run' });

SuiteRun.hasMany(PerformanceStat, { foreignKey: 'suiteRunId', as: 'performanceStats' });
PerformanceStat.belongsTo(SuiteRun, { foreignKey: 'suiteRunId', as: 'suiteRun' });

TestExecution.hasMany(PerformanceStat, { foreignKey: 'testExecutionId', as: 'performanceStats' });
PerformanceStat.belongsTo(TestExecution, { foreignKey: 'testExecutionId', as: 'testExecution' });

Run.hasMany(Artifact, { foreignKey: 'runId', as: 'artifacts' });
Artifact.belongsTo(Run, { foreignKey: 'runId', as: 'run' });

Run.hasMany(CoverageTrendPoint, { foreignKey: 'runId', as: 'coverageTrendPoints' });
CoverageTrendPoint.belongsTo(Run, { foreignKey: 'runId', as: 'run' });

SuiteRun.hasMany(Artifact, { foreignKey: 'suiteRunId', as: 'artifacts' });
Artifact.belongsTo(SuiteRun, { foreignKey: 'suiteRunId', as: 'suiteRun' });

TestExecution.hasMany(Artifact, { foreignKey: 'testExecutionId', as: 'artifacts' });
Artifact.belongsTo(TestExecution, { foreignKey: 'testExecutionId', as: 'testExecution' });

Project.hasMany(ReleaseNote, { foreignKey: 'projectId', as: 'releaseNotes' });
ReleaseNote.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

ProjectVersion.hasMany(ReleaseNote, { foreignKey: 'projectVersionId', as: 'releaseNotes' });
ReleaseNote.belongsTo(ProjectVersion, { foreignKey: 'projectVersionId', as: 'projectVersion' });

export {
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
};
