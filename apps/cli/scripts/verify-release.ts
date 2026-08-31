import { constants } from 'node:fs';
import { access, readFile, stat } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

interface PackageManifest {
  version: string;
  os?: string[];
  dependencies?: Record<string, string>;
}

interface ReleaseTarget {
  platform: string;
  arch: string;
  core: string;
  coreNativeAddon: string;
}

interface ReleaseManifest {
  schemaVersion: number;
  version: string;
  targets: ReleaseTarget[];
  skill: string;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const packageManifest = JSON.parse(await readFile(join(root, 'package.json'), 'utf8')) as PackageManifest;
const releaseManifest = JSON.parse(
  await readFile(join(root, 'dist', 'assets', 'release.json'), 'utf8')
) as ReleaseManifest;

const fail = (message: string): never => {
  throw new Error(`Release verification failed: ${message}`);
};

if (packageManifest.version !== releaseManifest.version) {
  fail(`package version ${packageManifest.version} does not match bundled Core ${releaseManifest.version}`);
}
if (
  releaseManifest.schemaVersion !== 1 ||
  !Array.isArray(releaseManifest.targets) ||
  !releaseManifest.targets.every(
    (target) =>
      typeof target?.platform === 'string' &&
      typeof target.arch === 'string' &&
      typeof target.core === 'string' &&
      typeof target.coreNativeAddon === 'string'
  )
) {
  fail('release.json has an invalid target manifest');
}
const expectedTargets = ['darwin-arm64', 'darwin-x64'];
const actualTargets = releaseManifest.targets.map(({ platform, arch }) => `${platform}-${arch}`).sort();
if (JSON.stringify(actualTargets) !== JSON.stringify(expectedTargets)) {
  fail(`expected release targets ${expectedTargets.join(', ')}, found ${actualTargets.join(', ')}`);
}
for (const target of releaseManifest.targets) {
  if (!packageManifest.os?.includes(target.platform)) {
    fail(`bundled platform ${target.platform} is not declared in package.json#os`);
  }
}
for (const [name, version] of Object.entries(packageManifest.dependencies ?? {})) {
  if (version.startsWith('workspace:')) fail(`runtime dependency ${name} uses ${version}`);
}

const cliPath = join(root, 'dist', 'cli.js');
const corePaths = releaseManifest.targets.map(({ core }) => join(root, 'dist', 'assets', core));
const nativeAddonPaths = [
  ...new Set(releaseManifest.targets.map(({ coreNativeAddon }) => join(root, 'dist', 'assets', coreNativeAddon)))
];
const requiredFiles = [
  cliPath,
  ...corePaths,
  ...nativeAddonPaths,
  join(root, 'dist', 'assets', releaseManifest.skill, 'SKILL.md')
];
for (const path of requiredFiles) await access(path, constants.R_OK);

const cli = await readFile(cliPath, 'utf8');
if (!cli.startsWith('#!/usr/bin/env node\n')) fail('dist/cli.js is missing its Node.js shebang');
for (const path of [cliPath, ...corePaths, ...nativeAddonPaths]) {
  if (((await stat(path)).mode & 0o111) === 0) fail(`${path} is not executable`);
}

process.stdout.write(`Verified monad-design@${packageManifest.version} for ${actualTargets.join(' and ')}.\n`);
