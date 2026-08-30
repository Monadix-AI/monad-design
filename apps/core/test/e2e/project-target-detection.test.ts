import { afterEach, describe, expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { detectProjectTargets, expoTargetCandidate, xcodeTargetCandidates } from '../../src/project-target-detection';

const temporaryDirectories: string[] = [];

const temporaryDirectory = async () => {
  const path = await mkdtemp(join(tmpdir(), 'monaddesign-detection-test-'));
  temporaryDirectories.push(path);
  return path;
};

const initializeGit = (path: string) => {
  execFileSync('git', ['init', '--quiet', path], { stdio: 'ignore' });
};

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe('project target detection', () => {
  test('reads an Expo iOS bundle identifier', () => {
    expect(
      expoTargetCandidate(
        JSON.stringify({
          expo: {
            name: 'Example',
            ios: { bundleIdentifier: 'com.example.mobile' }
          }
        }),
        'apps/mobile/app.json'
      )
    ).toEqual({
      bundleIdentifier: 'com.example.mobile',
      name: 'Example',
      source: 'expo',
      sourcePath: 'apps/mobile/app.json'
    });
  });

  test('deduplicates Xcode build configurations and ignores variable values', () => {
    expect(
      xcodeTargetCandidates(
        `111111111111111111111111 /* Example */ = {
	isa = PBXNativeTarget;
	buildConfigurationList = 222222222222222222222222;
	name = Example;
	productType = "com.apple.product-type.application";
};
222222222222222222222222 = {
	isa = XCConfigurationList;
	buildConfigurations = (
		333333333333333333333333,
		444444444444444444444444,
	);
};
333333333333333333333333 = {
	isa = XCBuildConfiguration;
	buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.native; };
};
444444444444444444444444 = {
	isa = XCBuildConfiguration;
	buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = "com.example.native"; };
};
555555555555555555555555 /* Tests */ = {
	isa = PBXNativeTarget;
	buildConfigurationList = 666666666666666666666666;
	name = ExampleTests;
	productType = "com.apple.product-type.bundle.unit-test";
};`,
        'ios/Example.xcodeproj/project.pbxproj'
      )
    ).toEqual([
      {
        bundleIdentifier: 'com.example.native',
        name: 'Example',
        source: 'xcode',
        sourcePath: 'ios/Example.xcodeproj/project.pbxproj'
      }
    ]);
  });

  test('scans nested Expo and Xcode projects and keeps one candidate per app', async () => {
    const root = await temporaryDirectory();
    initializeGit(root);
    const mobile = join(root, 'apps', 'mobile');
    const xcode = join(mobile, 'ios', 'Example.xcodeproj');
    await mkdir(xcode, { recursive: true });
    await writeFile(
      join(mobile, 'app.json'),
      JSON.stringify({
        expo: {
          name: 'Example',
          ios: { bundleIdentifier: 'com.example.mobile' }
        }
      }),
      'utf8'
    );
    await writeFile(
      join(xcode, 'project.pbxproj'),
      `111111111111111111111111 = {
	isa = PBXNativeTarget;
	buildConfigurationList = 222222222222222222222222;
	name = Example;
	productType = "com.apple.product-type.application";
};
222222222222222222222222 = {
	isa = XCConfigurationList;
	buildConfigurations = (333333333333333333333333);
};
333333333333333333333333 = {
	isa = XCBuildConfiguration;
	buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.mobile; };
};`,
      'utf8'
    );

    const result = await detectProjectTargets(root);
    expect(result.candidates).toEqual([
      {
        bundleIdentifier: 'com.example.mobile',
        name: 'Example',
        source: 'expo',
        sourcePath: 'apps/mobile/app.json'
      }
    ]);
    expect(result.warnings).toEqual([]);
  });

  test('returns no candidates when the project has no explicit iOS target', async () => {
    const root = await temporaryDirectory();
    initializeGit(root);
    await writeFile(join(root, 'package.json'), '{}', 'utf8');

    expect((await detectProjectTargets(root)).candidates).toEqual([]);
  });

  test('prefers an existing project configuration over duplicate source metadata', async () => {
    const root = await temporaryDirectory();
    initializeGit(root);
    await mkdir(join(root, '.monaddesign'));
    await writeFile(
      join(root, '.monaddesign', 'project.json'),
      JSON.stringify({
        schemaVersion: 1,
        name: 'Configured Example',
        createdAt: '2026-08-28T00:00:00.000Z',
        simulator: {
          platform: 'ios',
          launchOnConnect: true,
          targetApps: [
            {
              bundleIdentifier: 'com.example.configured',
              name: 'Configured Example'
            }
          ]
        }
      }),
      'utf8'
    );
    await writeFile(
      join(root, 'app.json'),
      JSON.stringify({
        expo: {
          name: 'Expo Example',
          ios: { bundleIdentifier: 'com.example.configured' }
        }
      }),
      'utf8'
    );

    expect((await detectProjectTargets(root)).candidates).toEqual([
      {
        bundleIdentifier: 'com.example.configured',
        name: 'Configured Example',
        source: 'project-config',
        sourcePath: '.monaddesign/project.json'
      }
    ]);
  });

  test('rejects a Git subdirectory instead of treating it as the project root', async () => {
    const root = await temporaryDirectory();
    initializeGit(root);
    const nested = join(root, 'apps', 'mobile');
    await mkdir(nested, { recursive: true });

    await expect(detectProjectTargets(nested)).rejects.toThrow('Select the Git repository root');
  });
});
