import type { Dirent } from 'node:fs';

import { createHash } from 'node:crypto';
import { access, mkdir, readdir, readFile, rename, stat, writeFile } from 'node:fs/promises';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';

import { assertGitProjectRoot } from './git-project-root';
import { resolveProjectTargetIcons } from './project-app-icons';
import { createSharedOperation } from './shared-operation';
import { assertBundleIdentifier } from './simulator-variants';

const projectSchemaVersion = 1;
const projectDirectoryName = '.monaddesign';
const projectConfigName = 'project.json';
const projectGitignoreRule = `${projectDirectoryName}/`;
const designDocumentName = 'DESIGN.md';
const ignoredDesignDocumentDirectories = new Set([
  '.git',
  '.monaddesign',
  '.next',
  '.turbo',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'Pods'
]);
const maximumDesignDocumentDepth = 4;

export interface ProjectTargetApp {
  bundleIdentifier: string;
  name: string;
  sourcePath?: string;
  live?: ProjectFrameworkAdapter;
}

export type ProjectFramework = 'swiftui' | 'uikit-swift' | 'uikit-objective-c' | 'react-native' | 'expo' | 'flutter';

export interface ProjectFrameworkAdapter {
  schemaVersion: 1;
  framework: ProjectFramework;
  sourceRoots: string[];
  variant: {
    bridge: 'native-launch-arguments' | 'react-native-initial-properties' | 'flutter-method-channel';
    bootstrapPath: string;
    launchArgument: '-MonadDesignVariant';
    values: ['original', 'v1', 'v2', 'v3'] | ['original', 'v1', 'v2', 'v3', 'v4', 'v5'];
  };
  build: {
    system: 'xcodebuild' | 'react-native' | 'expo' | 'flutter' | 'custom';
    workingDirectory: string;
    configuration: 'Debug';
    containerPath?: string;
    scheme?: string;
    flavor?: string;
    command?: string[];
    artifactPath?: string;
  };
  navigation: {
    strategy: 'app-router' | 'deep-link' | 'state-restoration' | 'debug-bootstrap';
    bootstrapPath: string;
  };
}

interface ProjectConfigFile {
  schemaVersion: typeof projectSchemaVersion;
  name: string;
  createdAt: string;
  simulator: {
    platform: 'ios';
    targetApps: ProjectTargetApp[];
    launchOnConnect: true;
  };
}

type ProjectConfig = ProjectConfigFile;

interface StoredProject {
  path: string;
  lastOpenedAt: string;
}

interface StoredProjects {
  schemaVersion: 1;
  projects: StoredProject[];
}

export interface MonadDesignProject {
  id: string;
  name: string;
  path: string;
  configPath: string;
  lastOpenedAt: string;
  targetApps: ProjectTargetApp[];
}

export interface ProjectDesignDocument {
  exists: boolean;
  path: string;
  content: string;
  modifiedAt: string | null;
  version: string | null;
}

const pathIsInside = (root: string, path: string) => {
  const value = relative(root, path);
  return value !== '..' && !value.startsWith(`..${sep}`) && !isAbsolute(value);
};

const existingFile = async (path: string) => {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
    throw error;
  }
};

const findProjectDesignDocument = async (project: MonadDesignProject) => {
  const rootDocument = join(project.path, designDocumentName);
  if (await existingFile(rootDocument)) return rootDocument;

  const targetDirectories = project.targetApps
    .flatMap(({ sourcePath }) => {
      if (!sourcePath) return [];
      const source = resolve(project.path, sourcePath);
      return pathIsInside(project.path, source) ? [dirname(source)] : [];
    })
    .filter((path, index, paths) => paths.indexOf(path) === index);
  for (const directory of targetDirectories) {
    const candidate = join(directory, designDocumentName);
    if (await existingFile(candidate)) return candidate;
  }

  const matches: Array<{ depth: number; path: string }> = [];
  const queue = [{ depth: 0, path: project.path }];
  while (queue.length) {
    const current = queue.shift();
    if (!current || current.depth >= maximumDesignDocumentDepth) continue;
    let entries: Dirent[];
    try {
      entries = await readdir(current.path, { withFileTypes: true });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') continue;
      throw error;
    }
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(current.path, entry.name);
      if (entry.isFile() && entry.name === designDocumentName) {
        matches.push({ depth: current.depth + 1, path });
      } else if (entry.isDirectory() && !ignoredDesignDocumentDirectories.has(entry.name)) {
        queue.push({ depth: current.depth + 1, path });
      }
    }
  }
  return (
    matches.sort((left, right) => left.depth - right.depth || left.path.localeCompare(right.path))[0]?.path ?? null
  );
};

export interface ProjectDirectorySelection {
  name: string;
  path: string;
}

const projectId = (path: string) => createHash('sha256').update(path).digest('hex').slice(0, 16);

const projectConfigPath = (path: string) => join(path, projectDirectoryName, projectConfigName);

const nonEmptyString = (value: unknown): value is string => typeof value === 'string' && Boolean(value.trim());

const frameworks = new Set<ProjectFramework>([
  'swiftui',
  'uikit-swift',
  'uikit-objective-c',
  'react-native',
  'expo',
  'flutter'
]);
const variantBridges = new Set<ProjectFrameworkAdapter['variant']['bridge']>([
  'native-launch-arguments',
  'react-native-initial-properties',
  'flutter-method-channel'
]);
const buildSystems = new Set<ProjectFrameworkAdapter['build']['system']>([
  'xcodebuild',
  'react-native',
  'expo',
  'flutter',
  'custom'
]);
const navigationStrategies = new Set<ProjectFrameworkAdapter['navigation']['strategy']>([
  'app-router',
  'deep-link',
  'state-restoration',
  'debug-bootstrap'
]);

const assertFrameworkAdapter = (value: unknown, path: string): ProjectFrameworkAdapter => {
  const adapter = value as Partial<ProjectFrameworkAdapter>;
  const variant = adapter?.variant as Partial<ProjectFrameworkAdapter['variant']> | undefined;
  const build = adapter?.build as Partial<ProjectFrameworkAdapter['build']> | undefined;
  const navigation = adapter?.navigation as Partial<ProjectFrameworkAdapter['navigation']> | undefined;
  if (
    adapter?.schemaVersion !== 1 ||
    !frameworks.has(adapter.framework as ProjectFramework) ||
    !Array.isArray(adapter.sourceRoots) ||
    adapter.sourceRoots.length === 0 ||
    !adapter.sourceRoots.every(nonEmptyString) ||
    !variantBridges.has(variant?.bridge as ProjectFrameworkAdapter['variant']['bridge']) ||
    !nonEmptyString(variant?.bootstrapPath) ||
    variant?.launchArgument !== '-MonadDesignVariant' ||
    ![
      JSON.stringify(['original', 'v1', 'v2', 'v3']),
      JSON.stringify(['original', 'v1', 'v2', 'v3', 'v4', 'v5'])
    ].includes(JSON.stringify(variant?.values)) ||
    !buildSystems.has(build?.system as ProjectFrameworkAdapter['build']['system']) ||
    !nonEmptyString(build?.workingDirectory) ||
    build?.configuration !== 'Debug' ||
    (build.containerPath !== undefined && !nonEmptyString(build.containerPath)) ||
    (build.scheme !== undefined && !nonEmptyString(build.scheme)) ||
    (build.flavor !== undefined && !nonEmptyString(build.flavor)) ||
    (build.artifactPath !== undefined && !nonEmptyString(build.artifactPath)) ||
    (build.command !== undefined &&
      (!Array.isArray(build.command) || build.command.length === 0 || !build.command.every(nonEmptyString))) ||
    !navigationStrategies.has(navigation?.strategy as ProjectFrameworkAdapter['navigation']['strategy']) ||
    !nonEmptyString(navigation?.bootstrapPath)
  ) {
    throw new Error(`Invalid Monad Design framework adapter at ${path}.`);
  }
  return structuredClone(adapter as ProjectFrameworkAdapter);
};

const parseConfig = (value: string, path: string): ProjectConfig => {
  const config = JSON.parse(value) as {
    schemaVersion?: unknown;
    name?: unknown;
    createdAt?: unknown;
    simulator?: unknown;
  };
  if (
    config.schemaVersion !== projectSchemaVersion ||
    typeof config.name !== 'string' ||
    !config.name.trim() ||
    typeof config.createdAt !== 'string'
  ) {
    throw new Error(`Invalid Monad Design project configuration at ${path}.`);
  }
  const simulator = config.simulator as Partial<ProjectConfigFile['simulator']>;
  if (
    simulator?.platform !== 'ios' ||
    simulator.launchOnConnect !== true ||
    !Array.isArray(simulator.targetApps) ||
    simulator.targetApps.length === 0
  ) {
    throw new Error(`Invalid Monad Design project configuration at ${path}.`);
  }
  for (const app of simulator.targetApps) {
    if (
      typeof app?.name !== 'string' ||
      !app.name.trim() ||
      (app.sourcePath !== undefined && typeof app.sourcePath !== 'string')
    ) {
      throw new Error(`Invalid Monad Design project configuration at ${path}.`);
    }
    assertBundleIdentifier(app.bundleIdentifier);
    if (app.live !== undefined) assertFrameworkAdapter(app.live, path);
  }
  const parsed = config as ProjectConfigFile;
  return {
    ...parsed,
    schemaVersion: projectSchemaVersion,
    simulator: {
      ...parsed.simulator,
      targetApps: parsed.simulator.targetApps.map((app) => ({
        ...app,
        ...(app.live ? { live: assertFrameworkAdapter(app.live, path) } : {})
      }))
    }
  };
};

const writeProjectConfig = async (path: string, config: ProjectConfigFile) => {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, path);
};

const ensureProjectConfigIgnored = async (projectPath: string) => {
  const gitignorePath = join(projectPath, '.gitignore');
  let current = '';
  try {
    current = await readFile(gitignorePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  const rules = current.split(/\r?\n/).map((line) => line.trim());
  if (rules.includes(projectGitignoreRule) || rules.includes(`/${projectGitignoreRule}`)) {
    return;
  }
  const separator = current.length > 0 && !current.endsWith('\n') ? '\n' : '';
  const temporaryPath = `${gitignorePath}.monaddesign.tmp`;
  await writeFile(temporaryPath, `${current}${separator}${projectGitignoreRule}\n`, 'utf8');
  await rename(temporaryPath, gitignorePath);
};

const readStoredProjects = async (path: string): Promise<StoredProjects> => {
  try {
    const parsed = JSON.parse(await readFile(path, 'utf8')) as Partial<StoredProjects>;
    if (parsed.schemaVersion !== 1 || !Array.isArray(parsed.projects)) {
      return { schemaVersion: 1, projects: [] };
    }
    return {
      schemaVersion: 1,
      projects: parsed.projects.filter(
        (item): item is StoredProject => typeof item?.path === 'string' && typeof item?.lastOpenedAt === 'string'
      )
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { schemaVersion: 1, projects: [] };
    }
    throw error;
  }
};

const writeStoredProjects = async (path: string, value: StoredProjects) => {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp`;
  await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  await rename(temporaryPath, path);
};

export const initializeProject = async (
  path: string,
  targets: ProjectTargetApp[],
  now = new Date()
): Promise<MonadDesignProject> => {
  await assertGitProjectRoot(path);

  const configPath = projectConfigPath(path);
  let existingConfig: ProjectConfig | null = null;
  try {
    existingConfig = parseConfig(await readFile(configPath, 'utf8'), configPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
  if (targets.length === 0) throw new Error('At least one target app is required.');
  const apps = targets
    .map((target) => {
      const existingTarget = existingConfig?.simulator.targetApps.find(
        ({ bundleIdentifier }) => bundleIdentifier === target.bundleIdentifier
      );
      return {
        bundleIdentifier: assertBundleIdentifier(target.bundleIdentifier),
        name: target.name.trim() || target.bundleIdentifier,
        ...(target.sourcePath ? { sourcePath: target.sourcePath } : {}),
        ...((target.live ?? existingTarget?.live) ? { live: target.live ?? existingTarget?.live } : {})
      };
    })
    .filter(
      (target, index, items) => items.findIndex((item) => item.bundleIdentifier === target.bundleIdentifier) === index
    );
  const config: ProjectConfigFile = {
    schemaVersion: projectSchemaVersion,
    name: existingConfig?.name ?? basename(path),
    createdAt: existingConfig?.createdAt ?? now.toISOString(),
    simulator: {
      platform: 'ios',
      targetApps: apps,
      launchOnConnect: true
    }
  };
  await ensureProjectConfigIgnored(path);
  await writeProjectConfig(configPath, config);

  return {
    id: projectId(path),
    name: config.name,
    path,
    configPath,
    lastOpenedAt: now.toISOString(),
    targetApps: apps
  };
};

export class ProjectStore {
  readonly #listProjects: () => Promise<MonadDesignProject[]>;

  constructor(private readonly statePath: string) {
    this.#listProjects = createSharedOperation(() => this.#readProjects());
  }

  async #readProjects(): Promise<MonadDesignProject[]> {
    const stored = await readStoredProjects(this.statePath);
    const projects = await Promise.all(
      stored.projects.map(async (item) => {
        try {
          await access(item.path);
          const configPath = projectConfigPath(item.path);
          const config = parseConfig(await readFile(configPath, 'utf8'), configPath);
          return {
            id: projectId(item.path),
            name: config.name,
            path: item.path,
            configPath,
            lastOpenedAt: item.lastOpenedAt,
            targetApps: config.simulator.targetApps
          };
        } catch {
          return null;
        }
      })
    );
    return projects
      .filter((project): project is MonadDesignProject => project !== null)
      .sort((left, right) => right.lastOpenedAt.localeCompare(left.lastOpenedAt));
  }

  list(): Promise<MonadDesignProject[]> {
    return this.#listProjects();
  }

  async add(path: string, targets: ProjectTargetApp[]): Promise<MonadDesignProject> {
    const project = await initializeProject(path, targets);
    await this.record(project);
    return project;
  }

  async configure(id: string, targets: ProjectTargetApp[]): Promise<MonadDesignProject> {
    const project = (await this.list()).find((item) => item.id === id);
    if (!project) throw new Error('This project is no longer available.');
    const configured = await initializeProject(project.path, targets);
    await this.record(configured);
    return configured;
  }

  async configureLiveTargets(
    id: string,
    targets: Array<{ bundleIdentifier: string; live: ProjectFrameworkAdapter }>
  ): Promise<MonadDesignProject> {
    const project = (await this.list()).find((item) => item.id === id);
    if (!project) throw new Error('This project is no longer available.');
    const configuredBundleIdentifiers = new Set(targets.map(({ bundleIdentifier }) => bundleIdentifier));
    if (
      targets.length !== project.targetApps.length ||
      project.targetApps.some(({ bundleIdentifier }) => !configuredBundleIdentifiers.has(bundleIdentifier))
    ) {
      throw new Error('Framework adapters are required for every target app in this project.');
    }
    const configuredTargets = project.targetApps.map((target) => {
      const configured = targets.find(({ bundleIdentifier }) => bundleIdentifier === target.bundleIdentifier);
      if (!configured) throw new Error(`Missing framework adapter for ${target.bundleIdentifier}.`);
      return {
        ...target,
        live: assertFrameworkAdapter(configured.live, project.configPath)
      };
    });
    const configured = await initializeProject(project.path, configuredTargets);
    await this.record(configured);
    return configured;
  }

  async open(id: string): Promise<MonadDesignProject> {
    const project = (await this.list()).find((item) => item.id === id);
    if (!project) throw new Error('This project is no longer available.');
    const opened = { ...project, lastOpenedAt: new Date().toISOString() };
    await this.record(opened);
    return opened;
  }

  async remove(id: string): Promise<void> {
    const stored = await readStoredProjects(this.statePath);
    const projects = stored.projects.filter((item) => projectId(item.path) !== id);
    if (projects.length === stored.projects.length) {
      throw new Error('This project is no longer available.');
    }
    await writeStoredProjects(this.statePath, {
      schemaVersion: 1,
      projects
    });
  }

  async icons(id: string): Promise<Record<string, string>> {
    const project = (await this.list()).find((item) => item.id === id);
    if (!project) throw new Error('This project is no longer available.');
    return resolveProjectTargetIcons(project);
  }

  async designDocument(id: string): Promise<ProjectDesignDocument> {
    const project = (await this.list()).find((item) => item.id === id);
    if (!project) throw new Error('This project is no longer available.');
    const rootPath = join(project.path, designDocumentName);
    const path = await findProjectDesignDocument(project);
    if (!path) return { exists: false, path: rootPath, content: '', modifiedAt: null, version: null };
    try {
      const [content, details] = await Promise.all([readFile(path, 'utf8'), stat(path)]);
      return {
        exists: true,
        path,
        content,
        modifiedAt: details.mtime.toISOString(),
        version: createHash('sha256').update(content).digest('hex').slice(0, 16)
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return { exists: false, path: rootPath, content: '', modifiedAt: null, version: null };
    }
  }

  private async record(project: MonadDesignProject) {
    const stored = await readStoredProjects(this.statePath);
    await writeStoredProjects(this.statePath, {
      schemaVersion: 1,
      projects: [
        { path: project.path, lastOpenedAt: project.lastOpenedAt },
        ...stored.projects.filter((item) => item.path !== project.path)
      ]
    });
  }
}
