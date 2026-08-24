#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

export function validatePhaseCheckpoint(checkpoint, { now = new Date() } = {}) {
  const errors = [];
  if (checkpoint?.schemaVersion !== '1') errors.push('schemaVersion must be 1');
  if (!/^phase-[0-6]$/.test(checkpoint?.phase || '')) errors.push('phase must be phase-0 through phase-6');
  if (!['candidate', 'accepted', 'green', 'rejected'].includes(checkpoint?.status)) errors.push('invalid status');
  if (!/^[0-9a-f]{7,64}$/.test(checkpoint?.target?.commit || '')) errors.push('target.commit must be a git sha');
  if (!/^sha256:[0-9a-f]{64}$/.test(checkpoint?.target?.imageDigest || '')) errors.push('target.imageDigest must be immutable');
  if (checkpoint?.status !== 'candidate' && checkpoint?.target?.deployedRevisionVerified !== true) errors.push('accepted checkpoints require deployed revision proof');
  if (!Array.isArray(checkpoint?.metrics) || checkpoint.metrics.length === 0) errors.push('metrics are required');
  for (const metric of checkpoint?.metrics || []) {
    if (!metric.key || !Number.isFinite(metric.current) || !Number.isInteger(metric.sampleCount) || metric.sampleCount < 1) errors.push(`invalid metric ${metric?.key || '<unknown>'}`);
    if (!isImmutableArtifact(metric.artifact)) errors.push(`metric ${metric.key} has a mutable artifact reference`);
    if (metric.critical && !Number.isFinite(metric.target)) errors.push(`critical metric ${metric.key} has no target`);
    if (metric.status === 'red' && checkpoint.status !== 'rejected' && !hasWaiver(checkpoint.waivers, metric.key, now)) errors.push(`regression ${metric.key} requires a valid waiver`);
  }
  for (const waiver of checkpoint?.waivers || []) {
    if (!waiver.owner || !waiver.rationale || !waiver.expiresAt || new Date(waiver.expiresAt) <= now) errors.push(`invalid or expired waiver ${waiver.metricKey || '<unknown>'}`);
  }
  return errors;
}

function isImmutableArtifact(value) { return /^github:\/\/actions\/runs\/\d+\/artifacts\/\d+$/.test(value || '') || /^sha256:[0-9a-f]{64}$/.test(value || ''); }
function hasWaiver(waivers, key, now) { return (waivers || []).some((waiver) => waiver.metricKey === key && waiver.owner && waiver.rationale && new Date(waiver.expiresAt) > now); }

if (process.argv[1]?.endsWith('validate-phase-checkpoint.mjs')) {
  const input = process.argv[2];
  const checkpoint = JSON.parse(fs.readFileSync(path.resolve(input), 'utf8'));
  const errors = validatePhaseCheckpoint(checkpoint);
  if (errors.length) { process.stderr.write(`${errors.join('\n')}\n`); process.exitCode = 1; }
  else process.stdout.write(`valid ${input}\n`);
}
