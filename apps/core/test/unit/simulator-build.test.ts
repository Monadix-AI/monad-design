import type { ProjectTargetApp } from '../../src/project-store';

import { afterEach, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { type BuildRunner, buildAndInstallSimulatorApp } from '../../src/simulator-build';

const directories: string[] = [];
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});
const fixture = async () => {
  const path = await mkdtemp(join(tmpdir(), 'monad-build-test-'));
  directories.push(path);
  await mkdir(join(path, 'ios', 'Example.xcworkspace'), { recursive: true });
  const target: ProjectTargetApp = { name: 'Example', bundleIdentifier: 'com.example.app' };
  const calls: { command: string; args: string[] }[] = [];
  const runner: BuildRunner = async (command, args) => {
    calls.push({ command, args });
    if (args.includes('-list')) return JSON.stringify({ workspace: { schemes: ['Example'] } });
    if (args.includes('-showBuildSettings'))
      return JSON.stringify([
        {
          buildSettings: {
            PRODUCT_BUNDLE_IDENTIFIER: target.bundleIdentifier,
            WRAPPER_EXTENSION: 'app',
            PLATFORM_NAME: 'iphonesimulator',
            TARGET_BUILD_DIR: '/tmp/products',
            FULL_PRODUCT_NAME: 'Example.app'
          }
        }
      ]);
    if (command === '/usr/bin/plutil')
      return JSON.stringify({
        CFBundleIdentifier: target.bundleIdentifier,
        CFBundleSupportedPlatforms: ['iPhoneSimulator']
      });
    return '';
  };
  return { path, target, calls, runner };
};

test('discovers a scheme, builds Debug for the selected Simulator, validates and installs in order', async () => {
  const f = await fixture();
  const phases: string[] = [];
  await buildAndInstallSimulatorApp(f, f.target, 'device-123', (phase) => phases.push(phase), f.runner);
  expect(phases).toEqual(['building', 'installing']);
  const build = f.calls.find(({ args }) => args.includes('build'));
  expect(build?.args).toContain('Debug');
  expect(build?.args).toContain('platform=iOS Simulator,id=device-123');
  expect(f.calls.at(-1)?.args).toEqual(['simctl', 'install', 'device-123', '/tmp/products/Example.app']);
});

test('never installs an app with the wrong bundle ID or device platform', async () => {
  for (const info of [
    { CFBundleIdentifier: 'com.other.app', CFBundleSupportedPlatforms: ['iPhoneSimulator'] },
    { CFBundleIdentifier: 'com.example.app', CFBundleSupportedPlatforms: ['iPhoneOS'] }
  ]) {
    const f = await fixture();
    await expect(
      buildAndInstallSimulatorApp(f, f.target, 'device', undefined, async (command, args, cwd) =>
        command === '/usr/bin/plutil' ? JSON.stringify(info) : f.runner(command, args, cwd)
      )
    ).rejects.toThrow('must be an iOS Simulator app');
    expect(f.calls.some(({ args }) => args.includes('install'))).toBe(false);
  }
});

test('propagates build logs and never installs on build failure', async () => {
  const f = await fixture();
  await expect(
    buildAndInstallSimulatorApp(f, f.target, 'device', undefined, async (command, args, cwd) => {
      if (args.includes('build')) throw new Error('Compile failed: MissingModule');
      return f.runner(command, args, cwd);
    })
  ).rejects.toThrow('MissingModule');
  expect(f.calls.some(({ args }) => args.includes('install'))).toBe(false);
});

test('refuses ambiguous schemes instead of building an arbitrary app', async () => {
  const f = await fixture();
  await expect(
    buildAndInstallSimulatorApp(f, f.target, 'device', undefined, async (command, args, cwd) =>
      args.includes('-list') ? JSON.stringify({ workspace: { schemes: ['One', 'Two'] } }) : f.runner(command, args, cwd)
    )
  ).rejects.toThrow('2 matches');
  expect(f.calls.some(({ args }) => args.includes('build'))).toBe(false);
});

test('resolves configured container paths relative to the build directory', async () => {
  const f = await fixture();
  await mkdir(join(f.path, 'mobile', 'ios', 'Example.xcworkspace'), { recursive: true });
  f.target.live = {
    schemaVersion: 1,
    framework: 'swiftui',
    sourceRoots: ['mobile'],
    variant: {
      bridge: 'native-launch-arguments',
      bootstrapPath: 'mobile/App.swift',
      launchArgument: '-MonadDesignVariant',
      values: ['original', 'v1', 'v2', 'v3']
    },
    build: {
      system: 'xcodebuild',
      workingDirectory: 'mobile',
      configuration: 'Debug',
      containerPath: 'ios/Example.xcworkspace',
      scheme: 'Example'
    },
    navigation: { strategy: 'debug-bootstrap', bootstrapPath: 'mobile/App.swift' }
  };
  await buildAndInstallSimulatorApp(f, f.target, 'device', undefined, f.runner);
  expect(f.calls[0]?.args).toContain(join(f.path, 'mobile', 'ios', 'Example.xcworkspace'));
  expect(f.calls.some(({ args }) => args.includes('-list'))).toBe(false);
  f.target.live.build = {
    system: 'custom',
    workingDirectory: 'mobile',
    configuration: 'Debug',
    command: ['builder', '--simulator'],
    artifactPath: 'Example.app'
  };
  f.calls.length = 0;
  await buildAndInstallSimulatorApp(f, f.target, 'device', undefined, f.runner);
  expect(f.calls[0]).toEqual({ command: 'builder', args: ['--simulator'] });
  expect(f.calls.at(-1)?.args).toContain('install');
});
