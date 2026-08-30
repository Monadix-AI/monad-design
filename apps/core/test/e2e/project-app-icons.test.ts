import type { MonadDesignProject } from '../../src/project-store';

import { afterEach, describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveProjectTargetIcons } from '../../src/project-app-icons';

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

const project = (path: string, sourcePath: string): MonadDesignProject => ({
  id: 'example',
  name: 'Example',
  path,
  configPath: join(path, '.monaddesign', 'project.json'),
  lastOpenedAt: '2026-08-28T00:00:00.000Z',
  targetApps: [{ bundleIdentifier: 'com.example.app', name: 'Example', sourcePath }]
});

describe('project app icons', () => {
  test('reads an Expo icon without persisting it in project metadata', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monaddesign-icon-test-'));
    temporaryDirectories.push(root);
    await mkdir(join(root, 'apps', 'mobile', 'assets'), { recursive: true });
    await writeFile(
      join(root, 'apps', 'mobile', 'app.json'),
      JSON.stringify({ expo: { icon: './assets/icon.png' } }),
      'utf8'
    );
    await writeFile(join(root, 'apps', 'mobile', 'assets', 'icon.png'), Buffer.from('expo-icon'));

    expect(await resolveProjectTargetIcons(project(root, 'apps/mobile/app.json'))).toEqual({
      'com.example.app': `data:image/png;base64,${Buffer.from('expo-icon').toString('base64')}`
    });
  });

  test('reads the largest image from the configured Xcode app icon set', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monaddesign-icon-test-'));
    temporaryDirectories.push(root);
    const xcode = join(root, 'ios', 'Example.xcodeproj');
    const iconSet = join(root, 'ios', 'Example', 'Images.xcassets', 'BrandIcon.appiconset');
    await Promise.all([mkdir(xcode, { recursive: true }), mkdir(iconSet, { recursive: true })]);
    await writeFile(
      join(xcode, 'project.pbxproj'),
      'buildSettings = { PRODUCT_BUNDLE_IDENTIFIER = com.example.app; ASSETCATALOG_COMPILER_APPICON_NAME = BrandIcon; };',
      'utf8'
    );
    await writeFile(
      join(iconSet, 'Contents.json'),
      JSON.stringify({
        images: [
          { filename: 'small.png', size: '60x60' },
          { filename: 'large.png', size: '1024x1024' }
        ]
      }),
      'utf8'
    );
    await Promise.all([
      writeFile(join(iconSet, 'small.png'), Buffer.from('small')),
      writeFile(join(iconSet, 'large.png'), Buffer.from('large'))
    ]);

    expect(await resolveProjectTargetIcons(project(root, 'ios/Example.xcodeproj/project.pbxproj'))).toEqual({
      'com.example.app': `data:image/png;base64,${Buffer.from('large').toString('base64')}`
    });
  });
});
