import Artifact from './Artifact.js';
import CoverageFile from './CoverageFile.js';
import CoverageSnapshot from './CoverageSnapshot.js';
import CoverageTrendPoint from './CoverageTrendPoint.js';
import ErrorOccurrence from './ErrorOccurrence.js';
import Group from './Group.js';
import PerformanceStat from './PerformanceStat.js';
import Project from './Project.js';
import ProjectFile from './ProjectFile.js';
import ProjectGroupAccess from './ProjectGroupAccess.js';
import ProjectModule from './ProjectModule.js';
import ProjectPackage from './ProjectPackage.js';
import ProjectRoleAccess from './ProjectRoleAccess.js';
import ProjectVersion from './ProjectVersion.js';
import ProjectOverview from './ProjectOverview.js';
import ReleaseNote from './ReleaseNote.js';
import ReportSubmission from './ReportSubmission.js';
import Role from './Role.js';
import Run from './Run.js';
import RunActiveSubmission from './RunActiveSubmission.js';
import RunOverview from './RunOverview.js';
import SuiteRun from './SuiteRun.js';
import TestExecution from './TestExecution.js';
import User from './User.js';
import UserGroup from './UserGroup.js';
import UserRole from './UserRole.js';

User.hasMany(UserRole, { foreignKey: 'userId', as: 'userRoles' });
UserRole.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Role.hasMany(UserRole, { foreignKey: 'roleId', as: 'userRoles' });
UserRole.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

User.belongsToMany(Role, { through: UserRole, foreignKey: 'userId', otherKey: 'roleId', as: 'roles' });
Role.belongsToMany(User, { through: UserRole, foreignKey: 'roleId', otherKey: 'userId', as: 'users' });

User.hasMany(UserGroup, { foreignKey: 'userId', as: 'userGroups' });
UserGroup.belongsTo(User, { foreignKey: 'userId', as: 'user' });

Group.hasMany(UserGroup, { foreignKey: 'groupId', as: 'userGroups' });
UserGroup.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });

User.belongsToMany(Group, { through: UserGroup, foreignKey: 'userId', otherKey: 'groupId', as: 'groups' });
Group.belongsToMany(User, { through: UserGroup, foreignKey: 'groupId', otherKey: 'userId', as: 'users' });

Project.hasMany(ProjectRoleAccess, { foreignKey: 'projectId', as: 'projectRoleAccesses' });
ProjectRoleAccess.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

Role.hasMany(ProjectRoleAccess, { foreignKey: 'roleId', as: 'projectRoleAccesses' });
ProjectRoleAccess.belongsTo(Role, { foreignKey: 'roleId', as: 'role' });

Project.belongsToMany(Role, { through: ProjectRoleAccess, foreignKey: 'projectId', otherKey: 'roleId', as: 'accessRoles' });
Role.belongsToMany(Project, { through: ProjectRoleAccess, foreignKey: 'roleId', otherKey: 'projectId', as: 'accessibleProjects' });

Project.hasMany(ProjectGroupAccess, { foreignKey: 'projectId', as: 'projectGroupAccesses' });
ProjectGroupAccess.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });

Group.hasMany(ProjectGroupAccess, { foreignKey: 'groupId', as: 'projectGroupAccesses' });
ProjectGroupAccess.belongsTo(Group, { foreignKey: 'groupId', as: 'group' });

Project.belongsToMany(Group, { through: ProjectGroupAccess, foreignKey: 'projectId', otherKey: 'groupId', as: 'accessGroups' });
Group.belongsToMany(Project, { through: ProjectGroupAccess, foreignKey: 'groupId', otherKey: 'projectId', as: 'accessibleProjects' });

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
Project.hasOne(ProjectOverview, { foreignKey: 'projectId', as: 'overview' });
ProjectOverview.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Project.hasMany(RunOverview, { foreignKey: 'projectId', as: 'runOverviews' });
RunOverview.belongsTo(Project, { foreignKey: 'projectId', as: 'project' });
Run.hasOne(RunOverview, { foreignKey: 'runId', as: 'overview' });
RunOverview.belongsTo(Run, { foreignKey: 'runId', as: 'run' });

ProjectVersion.hasMany(Run, { foreignKey: 'projectVersionId', as: 'runs' });
Run.belongsTo(ProjectVersion, { foreignKey: 'projectVersionId', as: 'projectVersion' });

Run.hasMany(ReportSubmission, { foreignKey: 'runId', as: 'reportSubmissions' });
ReportSubmission.belongsTo(Run, { foreignKey: 'runId', as: 'run' });
Run.hasMany(RunActiveSubmission, { foreignKey: 'runId', as: 'activeSubmissions' });
RunActiveSubmission.belongsTo(Run, { foreignKey: 'runId', as: 'run' });
ReportSubmission.hasMany(RunActiveSubmission, { foreignKey: 'reportSubmissionId', as: 'activeSelections' });
RunActiveSubmission.belongsTo(ReportSubmission, { foreignKey: 'reportSubmissionId', as: 'reportSubmission' });

ProjectVersion.hasMany(CoverageTrendPoint, { foreignKey: 'projectVersionId', as: 'coverageTrendPoints' });
CoverageTrendPoint.belongsTo(ProjectVersion, { foreignKey: 'projectVersionId', as: 'projectVersion' });

Run.hasMany(SuiteRun, { foreignKey: 'runId', as: 'suiteRuns' });
SuiteRun.belongsTo(Run, { foreignKey: 'runId', as: 'run' });
ReportSubmission.hasMany(SuiteRun, { foreignKey: 'reportSubmissionId', as: 'suiteRuns' });
SuiteRun.belongsTo(ReportSubmission, { foreignKey: 'reportSubmissionId', as: 'reportSubmission' });

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
ReportSubmission.hasMany(CoverageSnapshot, { foreignKey: 'reportSubmissionId', as: 'coverageSnapshots' });
CoverageSnapshot.belongsTo(ReportSubmission, { foreignKey: 'reportSubmissionId', as: 'reportSubmission' });

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
ReportSubmission.hasMany(ErrorOccurrence, { foreignKey: 'reportSubmissionId', as: 'errorOccurrences' });
ErrorOccurrence.belongsTo(ReportSubmission, { foreignKey: 'reportSubmissionId', as: 'reportSubmission' });

SuiteRun.hasMany(ErrorOccurrence, { foreignKey: 'suiteRunId', as: 'errorOccurrences' });
ErrorOccurrence.belongsTo(SuiteRun, { foreignKey: 'suiteRunId', as: 'suiteRun' });

TestExecution.hasMany(ErrorOccurrence, { foreignKey: 'testExecutionId', as: 'errorOccurrences' });
ErrorOccurrence.belongsTo(TestExecution, { foreignKey: 'testExecutionId', as: 'testExecution' });

Run.hasMany(PerformanceStat, { foreignKey: 'runId', as: 'performanceStats' });
PerformanceStat.belongsTo(Run, { foreignKey: 'runId', as: 'run' });
ReportSubmission.hasMany(PerformanceStat, { foreignKey: 'reportSubmissionId', as: 'performanceStats' });
PerformanceStat.belongsTo(ReportSubmission, { foreignKey: 'reportSubmissionId', as: 'reportSubmission' });

SuiteRun.hasMany(PerformanceStat, { foreignKey: 'suiteRunId', as: 'performanceStats' });
PerformanceStat.belongsTo(SuiteRun, { foreignKey: 'suiteRunId', as: 'suiteRun' });

TestExecution.hasMany(PerformanceStat, { foreignKey: 'testExecutionId', as: 'performanceStats' });
PerformanceStat.belongsTo(TestExecution, { foreignKey: 'testExecutionId', as: 'testExecution' });

Run.hasMany(Artifact, { foreignKey: 'runId', as: 'artifacts' });
Artifact.belongsTo(Run, { foreignKey: 'runId', as: 'run' });
ReportSubmission.hasMany(Artifact, { foreignKey: 'reportSubmissionId', as: 'artifacts' });
Artifact.belongsTo(ReportSubmission, { foreignKey: 'reportSubmissionId', as: 'reportSubmission' });

Run.hasMany(CoverageTrendPoint, { foreignKey: 'runId', as: 'coverageTrendPoints' });
CoverageTrendPoint.belongsTo(Run, { foreignKey: 'runId', as: 'run' });
ReportSubmission.hasMany(CoverageTrendPoint, { foreignKey: 'reportSubmissionId', as: 'coverageTrendPoints' });
CoverageTrendPoint.belongsTo(ReportSubmission, { foreignKey: 'reportSubmissionId', as: 'reportSubmission' });

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
  Group,
  PerformanceStat,
  Project,
  ProjectFile,
  ProjectGroupAccess,
  ProjectModule,
  ProjectPackage,
  ProjectRoleAccess,
  ProjectVersion,
  ProjectOverview,
  ReleaseNote,
  ReportSubmission,
  Role,
  Run,
  RunActiveSubmission,
  RunOverview,
  SuiteRun,
  TestExecution,
  User,
  UserGroup,
  UserRole,
};
