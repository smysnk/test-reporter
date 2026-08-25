import React from 'react';
import { formatRepositoryName } from '../lib/format.js';
import { OperationsStatus } from './OperationsBits.js';

function projectTitle(project) {
  const repositoryName = formatRepositoryName(project?.repositoryUrl);
  return repositoryName && repositoryName !== 'Repository unavailable'
    ? repositoryName
    : project?.name || 'Unknown project';
}

function DistributionBar({ distribution }) {
  if (!distribution?.total) return React.createElement('span', { className: 'operations-project__distribution operations-project__distribution--empty' });
  return React.createElement(
    'span',
    { className: 'operations-project__distribution', 'aria-label': `${distribution.passed} passed, ${distribution.failed} failed, ${distribution.other} other in the active window` },
    React.createElement('span', { className: 'operations-project__distribution-pass', style: { width: `${distribution.passedPct}%` } }),
    React.createElement('span', { className: 'operations-project__distribution-fail', style: { width: `${distribution.failedPct}%` } }),
    React.createElement('span', { className: 'operations-project__distribution-other', style: { width: `${distribution.otherPct}%` } }),
  );
}

function ProjectButton({ project, active, onSelect }) {
  return React.createElement(
    'button',
    {
      type: 'button',
      className: active ? 'operations-project operations-project--active' : 'operations-project',
      onClick: onSelect,
      'aria-pressed': active,
      'data-perf-id': `sidebar-project:${project.slug}`,
      'data-project-slug': project.slug,
    },
    React.createElement('span', { className: 'operations-project__name' }, projectTitle(project)),
    React.createElement(
      'span',
      { className: 'operations-project__meta' },
      project.latestRun ? React.createElement(OperationsStatus, { run: project.latestRun }) : null,
      React.createElement('span', null, `${project.windowRunCount} in window`),
    ),
    React.createElement(DistributionBar, { distribution: project.distribution }),
  );
}

export function OperationsProjectRail({
  projects,
  selectedProject,
  projectSearch,
  onProjectSearch,
  onSelectProject,
  totalLoadedRuns,
  collapsed = false,
  open = false,
  onCollapse,
  onDismiss,
}) {
  const normalizedSearch = String(projectSearch || '').trim().toLowerCase();
  const visibleProjects = (Array.isArray(projects) ? projects : []).filter((project) => (
    !normalizedSearch || [project.name, project.slug, project.repositoryUrl]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalizedSearch))
  ));

  return React.createElement(
    'aside',
    {
      className: [
        'operations-rail',
        collapsed ? 'operations-rail--collapsed' : '',
        open ? 'operations-rail--open' : '',
      ].filter(Boolean).join(' '),
      'aria-label': 'Project scope',
    },
    React.createElement('div', { className: 'operations-rail__heading' },
      React.createElement('p', { className: 'operations-kicker' }, collapsed ? 'P' : 'Projects'),
      React.createElement('span', null, collapsed ? null : String(projects.length)),
      React.createElement('button', {
        type: 'button',
        className: 'operations-rail__collapse',
        onClick: onCollapse,
        'aria-label': collapsed ? 'Expand project rail' : 'Collapse project rail',
        title: collapsed ? 'Expand project rail' : 'Collapse project rail',
      }, collapsed ? '›' : '‹'),
      React.createElement('button', {
        type: 'button',
        className: 'operations-rail__dismiss',
        onClick: onDismiss,
        'aria-label': 'Close project chooser',
      }, '×')),
    React.createElement('label', { className: 'operations-rail__search' },
      React.createElement('span', { className: 'sr-only' }, 'Filter projects'),
      React.createElement('input', {
        type: 'search',
        value: projectSearch,
        onChange: (event) => onProjectSearch(event.target.value),
        placeholder: 'Filter projects',
        'aria-label': 'Filter projects',
      })),
    React.createElement(
      'div',
      { className: 'operations-projects' },
      React.createElement(
        'button',
        {
          type: 'button',
          className: selectedProject ? 'operations-project' : 'operations-project operations-project--active',
          onClick: () => onSelectProject(null),
          'aria-pressed': !selectedProject,
          'data-perf-id': 'sidebar-all-runs',
        },
        React.createElement('span', { className: 'operations-project__name' }, 'All projects'),
        React.createElement('span', { className: 'operations-project__meta' }, `${totalLoadedRuns} loaded`),
      ),
      ...visibleProjects.map((project) => React.createElement(ProjectButton, {
        key: project.id,
        project,
        active: selectedProject?.slug === project.slug,
        onSelect: () => onSelectProject(project.slug),
      })),
      visibleProjects.length === 0
        ? React.createElement('p', { className: 'operations-rail__empty' }, 'No matching projects')
        : null,
    ),
  );
}
