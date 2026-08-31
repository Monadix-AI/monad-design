import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { chmod, copyFile, mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export interface CorePathsEnvironment {
  MONAD_DESIGN_CORE_BOOTSTRAP_PATH?: string;
  MONAD_DESIGN_CORE_EXECUTABLE_PATH?: string;
  MONAD_DESIGN_CORE_STATE_DIR?: string;
}

export interface CoreInstallationManifest {
  schemaVersion: 1;
  version: string;
  platform: NodeJS.Platform;
  arch: string;
  sha256: string;
  source: 'cli' | 'desktop';
  installedAt: string;
}

export interface InstallCoreExecutableOptions {
  sourcePath: string;
  version: string;
  source: CoreInstallationManifest['source'];
  environment?: CorePathsEnvironment;
  platform?: NodeJS.Platform;
  arch?: string;
  force?: boolean;
}

export type CoreInstallStatus = 'installed' | 'up-to-date' | 'newer-preserved';

export interface CoreInstallResult {
  status: CoreInstallStatus;
  executablePath: string;
  manifest: CoreInstallationManifest;
}

export const resolveCorePaths = (environment: CorePathsEnvironment = process.env as CorePathsEnvironment) => {
  const stateDirectory =
    environment.MONAD_DESIGN_CORE_STATE_DIR ?? join(homedir(), 'Library', 'Application Support', 'Monad Design');
  return {
    stateDirectory,
    bootstrapPath: environment.MONAD_DESIGN_CORE_BOOTSTRAP_PATH ?? join(stateDirectory, 'bootstrap.json'),
    credentialsPath: join(stateDirectory, 'credentials.json'),
    executablePath: environment.MONAD_DESIGN_CORE_EXECUTABLE_PATH ?? join(stateDirectory, 'bin', 'monad-design'),
    installManifestPath: join(stateDirectory, 'install.json'),
    lockPath: join(stateDirectory, 'core.lock'),
    sessionsPath: join(stateDirectory, 'agent-sessions.json'),
    versionsDirectory: join(stateDirectory, 'versions')
  };
};

const fileHash = (path: string) =>
  new Promise<string>((resolveHash, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(path);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.once('error', reject);
    stream.once('end', () => resolveHash(hash.digest('hex')));
  });

const fileMatchesHash = async (path: string, sha256: string) => {
  try {
    return (await fileHash(path)) === sha256;
  } catch {
    return false;
  }
};

const readManifest = async (path: string): Promise<CoreInstallationManifest | null> => {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as Partial<CoreInstallationManifest>;
    return value.schemaVersion === 1 &&
      typeof value.version === 'string' &&
      typeof value.platform === 'string' &&
      typeof value.arch === 'string' &&
      typeof value.sha256 === 'string' &&
      (value.source === 'cli' || value.source === 'desktop') &&
      typeof value.installedAt === 'string'
      ? (value as CoreInstallationManifest)
      : null;
  } catch {
    return null;
  }
};

const versionParts = (value: string) => {
  const match = value.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  return match ? match.slice(1).map(Number) : null;
};

export const compareCoreVersions = (left: string, right: string) => {
  const leftParts = versionParts(left);
  const rightParts = versionParts(right);
  if (!leftParts || !rightParts) return null;
  for (let index = 0; index < 3; index += 1) {
    const difference = (leftParts[index] ?? 0) - (rightParts[index] ?? 0);
    if (difference !== 0) return Math.sign(difference);
  }
  return 0;
};

const writeExecutable = async (sourcePath: string, destinationPath: string) => {
  await mkdir(dirname(destinationPath), { recursive: true });
  const temporaryPath = `${destinationPath}.${process.pid}.${Date.now()}.tmp`;
  await copyFile(sourcePath, temporaryPath);
  await chmod(temporaryPath, 0o755);
  await rename(temporaryPath, destinationPath);
};

const writeManifest = async (path: string, manifest: CoreInstallationManifest) => {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.${Date.now()}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await chmod(temporaryPath, 0o600);
  await rename(temporaryPath, path);
};

export const installCoreExecutable = async (options: InstallCoreExecutableOptions): Promise<CoreInstallResult> => {
  const paths = resolveCorePaths(options.environment);
  const platform = options.platform ?? process.platform;
  const arch = options.arch ?? process.arch;
  const sha256 = await fileHash(options.sourcePath);
  const existing = await readManifest(paths.installManifestPath);
  const comparison = existing ? compareCoreVersions(existing.version, options.version) : null;

  if (!options.force && existing && comparison === 1) {
    if (await fileMatchesHash(paths.executablePath, existing.sha256)) {
      return { status: 'newer-preserved', executablePath: paths.executablePath, manifest: existing };
    }
    const existingVersionPath = join(
      paths.versionsDirectory,
      `${existing.version}-${existing.platform}-${existing.arch}`,
      'monad-design'
    );
    if (await fileMatchesHash(existingVersionPath, existing.sha256)) {
      await writeExecutable(existingVersionPath, paths.executablePath);
      return { status: 'newer-preserved', executablePath: paths.executablePath, manifest: existing };
    }
  }
  if (!options.force && existing?.sha256 === sha256 && (await fileMatchesHash(paths.executablePath, sha256))) {
    return { status: 'up-to-date', executablePath: paths.executablePath, manifest: existing };
  }

  const manifest: CoreInstallationManifest = {
    schemaVersion: 1,
    version: options.version,
    platform,
    arch,
    sha256,
    source: options.source,
    installedAt: new Date().toISOString()
  };
  const versionDirectory = join(paths.versionsDirectory, `${options.version}-${platform}-${arch}`);
  await writeExecutable(options.sourcePath, join(versionDirectory, 'monad-design'));
  await writeExecutable(options.sourcePath, paths.executablePath);
  await writeManifest(paths.installManifestPath, manifest);
  return { status: 'installed', executablePath: paths.executablePath, manifest };
};
