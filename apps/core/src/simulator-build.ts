import type { MonadDesignProject, ProjectTargetApp } from './project-store';

import { execFile } from 'node:child_process';
import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const exec = promisify(execFile);
export type BuildRunner = (command: string, args: string[], cwd: string) => Promise<string>;
const run: BuildRunner = async (command, args, cwd) => {
  try {
    const result = await exec(command, args, {
      cwd,
      encoding: 'utf8',
      timeout: 15 * 60_000,
      maxBuffer: 16 * 1024 * 1024
    });
    return result.stdout;
  } catch (error) {
    const failure = error as Error & { stdout?: string; stderr?: string };
    throw new Error(
      `${command} failed: ${failure.message}\n${failure.stderr ?? ''}\n${failure.stdout ?? ''}`.slice(-12_000)
    );
  }
};

type BuildSettings = { buildSettings: Record<string, string> };
const applicationSettings = (output: string, bundleIdentifier: string) =>
  (JSON.parse(output) as BuildSettings[]).filter(
    ({ buildSettings: settings }) =>
      settings.PRODUCT_BUNDLE_IDENTIFIER === bundleIdentifier &&
      settings.WRAPPER_EXTENSION === 'app' &&
      settings.PLATFORM_NAME === 'iphonesimulator'
  );

// Search only project sources, never dependency trees or generated build products.
const containersIn = async (root: string) => {
  const containers: string[] = [];
  let visited = 0;
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > 5 || ++visited > 500) return;
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (
        !entry.isDirectory() ||
        entry.name.startsWith('.') ||
        ['node_modules', 'Pods', 'build', 'dist', 'DerivedData'].includes(entry.name)
      )
        continue;
      const path = join(directory, entry.name);
      if (/\.xc(workspace|odeproj)$/.test(entry.name)) containers.push(path);
      else await visit(path, depth + 1);
    }
  };
  await visit(root, 0);
  return containers;
};

export const buildAndInstallSimulatorApp = async (
  project: Pick<MonadDesignProject, 'path'>,
  target: ProjectTargetApp,
  udid: string,
  onPhase: (phase: 'building' | 'installing') => void = () => {},
  runner: BuildRunner = run
) => {
  const build = target.live?.build;
  const cwd = resolve(project.path, build?.workingDirectory ?? '.');
  const buildPath = async (path: string) => {
    const local = resolve(cwd, path);
    try {
      await access(local);
      return local;
    } catch {
      return resolve(project.path, path);
    }
  };
  const temporaryDirectory = await mkdtemp(join(tmpdir(), 'monadesign-build-'));
  try {
    onPhase('building');
    let artifact: string;
    if (build?.command?.length) {
      if (!build.artifactPath)
        throw new Error(
          'Configure live.build.artifactPath to the Debug Simulator .app produced by live.build.command.'
        );
      const [command, ...args] = build.command;
      if (!command) throw new Error('The build command is empty.');
      await runner(command, args, cwd);
      artifact = await buildPath(build.artifactPath);
    } else {
      if (build && build.system !== 'xcodebuild' && !build.containerPath) {
        throw new Error(
          `Configure live.build.command and artifactPath for ${build.system}, or provide an Xcode containerPath and scheme.`
        );
      }
      let containers = build?.containerPath ? [await buildPath(build.containerPath)] : await containersIn(cwd);
      const sourceContainer = target.sourcePath?.replace(/\/project\.pbxproj$/, '');
      if (!build?.containerPath && sourceContainer?.endsWith('.xcodeproj')) {
        const source = resolve(project.path, sourceContainer);
        containers = containers.filter(
          (path) => path === source || (path.endsWith('.xcworkspace') && dirname(path) === dirname(source))
        );
      }
      // A sibling workspace carries CocoaPods/package integration that its project may omit.
      if (!build?.containerPath && containers.some((path) => path.endsWith('.xcworkspace'))) {
        containers = containers.filter((path) => path.endsWith('.xcworkspace'));
      }
      const matches: { args: string[]; settings: Record<string, string> }[] = [];
      const diagnostics: string[] = [];
      for (const container of containers) {
        const containerArgs = [container.endsWith('.xcworkspace') ? '-workspace' : '-project', container];
        let schemes: string[];
        if (build?.scheme) schemes = [build.scheme];
        else {
          const listing = JSON.parse(await runner('xcodebuild', [...containerArgs, '-list', '-json'], cwd)) as {
            project?: { schemes?: string[] };
            workspace?: { schemes?: string[] };
          };
          schemes = (listing.workspace ?? listing.project)?.schemes ?? [];
        }
        for (const scheme of schemes) {
          const args = [
            ...containerArgs,
            '-scheme',
            scheme,
            '-configuration',
            'Debug',
            '-sdk',
            'iphonesimulator',
            '-destination',
            `platform=iOS Simulator,id=${udid}`,
            '-derivedDataPath',
            temporaryDirectory,
            'CODE_SIGNING_ALLOWED=NO'
          ];
          try {
            const settings = applicationSettings(
              await runner('xcodebuild', [...args, '-showBuildSettings', '-json'], cwd),
              target.bundleIdentifier
            );
            for (const item of settings) matches.push({ args, settings: item.buildSettings });
          } catch (error) {
            diagnostics.push(error instanceof Error ? error.message : String(error));
          }
        }
      }
      if (matches.length !== 1) {
        throw new Error(
          `Could not select a unique Debug Simulator scheme for ${target.bundleIdentifier} (${matches.length} matches). Configure live.build.containerPath and live.build.scheme.\n${diagnostics.join('\n').slice(-8_000)}`
        );
      }
      const match = matches[0];
      if (!match) throw new Error('No matching Simulator build settings.');
      await runner('xcodebuild', [...match.args, '-quiet', 'build'], cwd);
      if (!match.settings.TARGET_BUILD_DIR || !match.settings.FULL_PRODUCT_NAME)
        throw new Error('Xcode did not report the built .app path.');
      artifact = join(match.settings.TARGET_BUILD_DIR, match.settings.FULL_PRODUCT_NAME);
    }
    const info = JSON.parse(
      await runner('/usr/bin/plutil', ['-convert', 'json', '-o', '-', join(artifact, 'Info.plist')], cwd)
    ) as {
      CFBundleIdentifier?: string;
      CFBundleSupportedPlatforms?: string[];
    };
    if (
      info.CFBundleIdentifier !== target.bundleIdentifier ||
      !info.CFBundleSupportedPlatforms?.includes('iPhoneSimulator')
    ) {
      throw new Error(`The built app must be an iOS Simulator app with bundle identifier ${target.bundleIdentifier}.`);
    }
    onPhase('installing');
    await runner('xcrun', ['simctl', 'install', udid, artifact], cwd);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
};
