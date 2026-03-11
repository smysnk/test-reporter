import fs from 'node:fs';
import path from 'node:path';

export function writeReportArtifacts(context, report, suiteResults) {
  fs.mkdirSync(context.project.outputDir, { recursive: true });
  fs.mkdirSync(context.project.rawDir, { recursive: true });

  const reportJsonPath = path.join(context.project.outputDir, 'report.json');
  fs.writeFileSync(reportJsonPath, `${JSON.stringify(report, null, 2)}\n`);
  const modulesJsonPath = path.join(context.project.outputDir, 'modules.json');
  fs.writeFileSync(modulesJsonPath, `${JSON.stringify(createModulesArtifact(report), null, 2)}\n`);
  const ownershipJsonPath = path.join(context.project.outputDir, 'ownership.json');
  fs.writeFileSync(ownershipJsonPath, `${JSON.stringify(createOwnershipArtifact(report), null, 2)}\n`);

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
      diagnostics: suite.diagnostics || null,
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
    modulesJsonPath,
    ownershipJsonPath,
    rawSuitePaths,
  };
}

function createModulesArtifact(report) {
  return {
    schemaVersion: '1',
    generatedAt: report?.generatedAt || new Date().toISOString(),
    projectName: report?.meta?.projectName || null,
    modules: Array.isArray(report?.modules) ? report.modules : [],
  };
}

function createOwnershipArtifact(report) {
  const modules = Array.isArray(report?.modules) ? report.modules : [];
  return {
    schemaVersion: '1',
    generatedAt: report?.generatedAt || new Date().toISOString(),
    projectName: report?.meta?.projectName || null,
    modules: modules.map((moduleEntry) => ({
      module: moduleEntry.module,
      owner: moduleEntry.owner || null,
    })),
    themes: modules.flatMap((moduleEntry) => (Array.isArray(moduleEntry.themes) ? moduleEntry.themes : []).map((themeEntry) => ({
      module: moduleEntry.module,
      theme: themeEntry.theme,
      owner: themeEntry.owner || null,
    }))),
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
