import {
  Group,
  Project,
  ProjectGroupAccess,
  ProjectRoleAccess,
  Role,
} from '../models/index.js';
import { isAdminActor } from './guards.js';

export function createProjectAccessService(options = {}) {
  const models = options.models || {
    Project,
    Role,
    Group,
    ProjectRoleAccess,
    ProjectGroupAccess,
  };

  return {
    async filterProjects({ actor, projects = null }) {
      const projectList = projects ? normalizeProjects(projects) : await loadAll(models.Project);
      const visibleProjectIds = await this.listVisibleProjectIds({ actor, projects: projectList });
      return projectList.filter((project) => visibleProjectIds.has(project.id));
    },

    async canViewProject({ actor, project }) {
      if (!project || !project.id) {
        return false;
      }

      const visibleProjectIds = await this.listVisibleProjectIds({
        actor,
        projects: [project],
      });
      return visibleProjectIds.has(project.id);
    },

    async canViewProjectByKey({ actor, projectKey }) {
      if (typeof projectKey !== 'string' || !projectKey.trim()) {
        return false;
      }

      const projects = await loadAll(models.Project);
      const project = projects.find((candidate) => candidate.key === projectKey.trim()) || null;
      if (!project) {
        return false;
      }

      return this.canViewProject({ actor, project });
    },

    async listVisibleProjectIds({ actor, projects = null }) {
      const projectList = projects ? normalizeProjects(projects) : await loadAll(models.Project);

      if (isAdminActor(actor)) {
        return new Set(projectList.map((project) => project.id));
      }

      const visibleProjectIds = new Set(
        projectList
          .filter((project) => project.isPublic === true)
          .map((project) => project.id),
      );

      if (!actor || actor.isGuest === true) {
        return visibleProjectIds;
      }

      const [roles, groups, projectRoleAccess, projectGroupAccess] = await Promise.all([
        loadAll(models.Role),
        loadAll(models.Group),
        loadAll(models.ProjectRoleAccess),
        loadAll(models.ProjectGroupAccess),
      ]);

      const roleIds = new Set(
        roles
          .filter((role) => Array.isArray(actor.roleKeys) && actor.roleKeys.includes(role.key))
          .map((role) => role.id),
      );
      const groupIds = new Set(
        groups
          .filter((group) => Array.isArray(actor.groupKeys) && actor.groupKeys.includes(group.key))
          .map((group) => group.id),
      );

      for (const entry of projectRoleAccess) {
        if (roleIds.has(entry.roleId)) {
          visibleProjectIds.add(entry.projectId);
        }
      }

      for (const entry of projectGroupAccess) {
        if (groupIds.has(entry.groupId)) {
          visibleProjectIds.add(entry.projectId);
        }
      }

      return visibleProjectIds;
    },
  };
}

async function loadAll(model) {
  if (!model || typeof model.findAll !== 'function') {
    return [];
  }

  const rows = await model.findAll();
  return rows.map((row) => toPlainRecord(row));
}

function normalizeProjects(projects) {
  return (Array.isArray(projects) ? projects : [])
    .map((project) => toPlainRecord(project))
    .filter(Boolean);
}

function toPlainRecord(row) {
  if (!row) {
    return null;
  }

  if (typeof row.toJSON === 'function') {
    return row.toJSON();
  }

  return Object.fromEntries(
    Object.entries(row).filter(([, value]) => typeof value !== 'function'),
  );
}
