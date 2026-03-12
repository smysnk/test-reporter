export function buildRunTemplateHref(runId, template) {
  const encodedRunId = encodeURIComponent(runId);
  return template === 'web'
    ? `/runs/${encodedRunId}?template=web`
    : `/runs/${encodedRunId}`;
}

export function resolveRunTemplateMode(template) {
  return template === 'web' ? 'web' : 'runner';
}
