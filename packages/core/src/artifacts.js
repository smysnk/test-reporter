import fs from 'node:fs';
import path from 'node:path';

export function writeReportArtifacts(context, report, suiteResults) {
  fs.mkdirSync(context.project.outputDir, { recursive: true });
  fs.mkdirSync(context.project.rawDir, { recursive: true });

  const reportJsonPath = path.join(context.project.outputDir, 'report.json');
  fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);

  const rawSuitePaths = [];
  for (const suite of suiteResults) {
    const suiteFileName = `${slugify(suite.packageName || 'default')}-${slugify(suite.id)}.json`;
    const suitePath = path.join(context.project.rawDir, suiteFileName);
    const payload = {
      id: suite.id,
      packageName: suite.packageName,
      status: suite.status,
      runtime: suite.runtime,
      command: suite.command,
      summary: suite.summary,
      coverage: suite.coverage,
      warnings: suite.warnings,
      rawArtifacts: suite.rawArtifacts,
      output: suite.output,
      tests: suite.tests,
    };
    fs.writeFileSync(suitePath, `${JSON.stringify(payload, null, 2)}\n`);
    rawSuitePaths.push(suitePath);

    for (const artifact of suite.rawArtifacts || []) {
      const relativePath = artifact?.relativePath;
      if (!relativePath) {
        continue;
      }
      const artifactPath = path.join(context.project.rawDir, relativePath);
      fs.mkdirSync(path.dirname(artifactPath), { recursive: true });
      if (artifact.sourcePath) {
        copyArtifactSource(artifact.sourcePath, artifactPath, artifact.kind);
      } else {
        fs.writeFileSync(artifactPath, artifact.content || '', artifact.encoding || 'utf8');
      }
      rawSuitePaths.push(artifactPath);
    }
  }

  return {
    reportJsonPath,
    rawSuitePaths,
  };
}

function copyArtifactSource(sourcePath, destinationPath, kind) {
  const sourceStat = fs.statSync(sourcePath);
  if (kind === 'directory' || sourceStat.isDirectory()) {
    fs.rmSync(destinationPath, { recursive: true, force: true });
    fs.cpSync(sourcePath, destinationPath, { recursive: true });
    return;
  }
  fs.copyFileSync(sourcePath, destinationPath);
}

function slugify(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
