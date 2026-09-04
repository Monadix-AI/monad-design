import { afterEach, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { initializeProject, ProjectStore } from '../../src/project-store';

const temporaryDirectories: string[] = [];

const temporaryDirectory = async () => {
  const path = await mkdtemp(join(tmpdir(), 'monaddesign-project-test-'));
  temporaryDirectories.push(path);
  return path;
};

const initializeGit = (path: string) => {
  execFileSync('git', ['init', '--quiet', path], { stdio: 'ignore' });
};

const target = (bundleIdentifier: string, name = 'Example') => ({
  bundleIdentifier,
  name
});

const live = {
  schemaVersion: 1 as const,
  framework: 'flutter' as const,
  sourceRoots: ['lib'],
  variant: {
    bridge: 'flutter-method-channel' as const,
    bootstrapPath: 'ios/Runner/AppDelegate.swift',
    launchArgument: '-MonadDesignVariant' as const,
    values: ['original', 'v1', 'v2', 'v3', 'v4', 'v5'] as ['original', 'v1', 'v2', 'v3', 'v4', 'v5']
  },
  build: {
    system: 'flutter' as const,
    workingDirectory: '.',
    configuration: 'Debug' as const,
    artifactPath: 'build/ios/iphonesimulator/Runner.app'
  },
  navigation: { strategy: 'app-router' as const, bootstrapPath: 'lib/router.dart' }
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('project initialization', () => {
  test('writes a durable project configuration without replacing it', async () => {
    const path = await temporaryDirectory();
    initializeGit(path);
    await writeFile(join(path, '.gitignore'), 'dist', 'utf8');
    const created = await initializeProject(
      path,
      [target('com.example.sample', 'Sample'), target('com.example.admin', 'Admin')],
      new Date('2026-08-27T08:00:00Z')
    );
    const reopened = await initializeProject(
      path,
      [target('com.example.sample', 'Sample'), target('com.example.admin', 'Admin')],
      new Date('2026-08-28T08:00:00Z')
    );
    const config = JSON.parse(await readFile(created.configPath, 'utf8'));

    expect(config).toEqual({
      schemaVersion: 1,
      name: created.name,
      createdAt: '2026-08-27T08:00:00.000Z',
      simulator: {
        platform: 'ios',
        targetApps: [target('com.example.sample', 'Sample'), target('com.example.admin', 'Admin')],
        launchOnConnect: true
      }
    });
    expect(reopened.id).toBe(created.id);
    expect(reopened.name).toBe(created.name);
    expect(await readFile(join(path, '.gitignore'), 'utf8')).toBe('dist\n.monaddesign/\n');
  });

  test('persists framework adapters and preserves them when target metadata is refreshed', async () => {
    const root = await temporaryDirectory();
    initializeGit(root);
    const store = new ProjectStore(join(root, 'state', 'projects.json'));
    const created = await store.add(root, [target('com.example.runner', 'Runner')]);

    const configured = await store.configureLiveTargets(created.id, [{ bundleIdentifier: 'com.example.runner', live }]);
    await store.configure(configured.id, [target('com.example.runner', 'Renamed Runner')]);
    const [reopened] = await store.list();
    const config = JSON.parse(await readFile(created.configPath, 'utf8'));

    expect(reopened?.targetApps[0]?.live).toEqual(live);
    expect(config.schemaVersion).toBe(1);
    expect(config.simulator.targetApps[0].name).toBe('Renamed Runner');
    expect(config.simulator.targetApps[0].live.framework).toBe('flutter');
  });

  test('rejects unpublished schema version 2 instead of carrying a compatibility path', async () => {
    const root = await temporaryDirectory();
    initializeGit(root);
    await mkdir(join(root, '.monaddesign'));
    await writeFile(
      join(root, '.monaddesign', 'project.json'),
      JSON.stringify({
        schemaVersion: 2,
        name: 'Example',
        createdAt: '2026-08-28T00:00:00.000Z',
        simulator: {
          platform: 'ios',
          targetApps: [target('com.example.app')],
          launchOnConnect: true
        }
      }),
      'utf8'
    );

    await expect(initializeProject(root, [target('com.example.app')])).rejects.toThrow(
      'Invalid Monad Design project configuration'
    );
  });

  test('keeps recently opened projects ordered and unique', async () => {
    const root = await temporaryDirectory();
    const first = join(root, 'First');
    const second = join(root, 'Second');
    await Promise.all([mkdir(first), mkdir(second)]);
    initializeGit(first);
    initializeGit(second);
    const store = new ProjectStore(join(root, 'state', 'projects.json'));

    const firstProject = await store.add(first, [target('com.example.first')]);
    await store.add(second, [target('com.example.second')]);
    await store.open(firstProject.id);

    const projects = await store.list();
    expect(projects.map(({ name }) => name)).toEqual(['First', 'Second']);
    expect(new Set(projects.map(({ path }) => path)).size).toBe(2);
  });

  test('reads the root DESIGN.md and reports content changes', async () => {
    const root = await temporaryDirectory();
    initializeGit(root);
    const store = new ProjectStore(join(root, 'state', 'projects.json'));
    const project = await store.add(root, [target('com.example.app')]);

    expect(await store.designDocument(project.id)).toEqual({
      exists: false,
      path: join(root, 'DESIGN.md'),
      content: '',
      modifiedAt: null,
      version: null
    });

    await writeFile(join(root, 'DESIGN.md'), '# First\n', 'utf8');
    const first = await store.designDocument(project.id);
    await writeFile(join(root, 'DESIGN.md'), '# Second\n', 'utf8');
    const second = await store.designDocument(project.id);

    expect(first).toMatchObject({ exists: true, content: '# First\n' });
    expect(first.modifiedAt).not.toBeNull();
    expect(first.version).toHaveLength(16);
    expect(second).toMatchObject({ exists: true, content: '# Second\n' });
    expect(second.version).not.toBe(first.version);
  });

  test('discovers a nested DESIGN.md while keeping the root document authoritative', async () => {
    const root = await temporaryDirectory();
    initializeGit(root);
    await mkdir(join(root, 'apps', 'desktop'), { recursive: true });
    const store = new ProjectStore(join(root, 'state', 'projects.json'));
    const project = await store.add(root, [{ ...target('com.example.app'), sourcePath: 'apps/mobile/app.json' }]);
    const nestedPath = join(root, 'apps', 'desktop', 'DESIGN.md');
    await writeFile(nestedPath, '# Nested\n', 'utf8');

    expect(await store.designDocument(project.id)).toMatchObject({ path: nestedPath, content: '# Nested\n' });

    const rootPath = join(root, 'DESIGN.md');
    await writeFile(rootPath, '# Root\n', 'utf8');
    expect(await store.designDocument(project.id)).toMatchObject({ path: rootPath, content: '# Root\n' });
  });

  test('removes a project from the local registry without deleting its configuration', async () => {
    const root = await temporaryDirectory();
    const projectPath = join(root, 'Example');
    await mkdir(projectPath);
    initializeGit(projectPath);
    const store = new ProjectStore(join(root, 'state', 'projects.json'));
    const project = await store.add(projectPath, [target('com.example.app')]);

    await store.remove(project.id);

    expect(await store.list()).toEqual([]);
    expect(JSON.parse(await readFile(project.configPath, 'utf8')).name).toBe('Example');
    await expect(store.remove(project.id)).rejects.toThrow('This project is no longer available.');
  });

  test('keeps every registered project available', async () => {
    const root = await temporaryDirectory();
    const paths = Array.from({ length: 24 }, (_, index) => join(root, `Project ${index + 1}`));
    await Promise.all(paths.map((path) => mkdir(path)));
    for (const path of paths) initializeGit(path);
    const store = new ProjectStore(join(root, 'state', 'projects.json'));

    for (const [index, path] of paths.entries()) {
      await store.add(path, [target(`com.example.project${index + 1}`)]);
    }

    expect(await store.list()).toHaveLength(24);
  });

  test('requires the selected directory to be the Git repository root', async () => {
    const root = await temporaryDirectory();
    const nested = join(root, 'apps', 'mobile');
    await mkdir(nested, { recursive: true });
    await expect(initializeProject(root, [target('com.example.app')])).rejects.toThrow('Git repository');

    initializeGit(root);
    await expect(initializeProject(nested, [target('com.example.app')])).rejects.toThrow('Git repository root');
  });
});
