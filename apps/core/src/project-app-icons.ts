import type { Dirent } from 'node:fs';
import type { MonadDesignProject, ProjectTargetApp } from './project-store';

import { readdir, readFile } from 'node:fs/promises';
import { dirname, extname, isAbsolute, join, relative, resolve } from 'node:path';

const ignoredDirectories = new Set([
  '.git',
  'DerivedData',
  'Pods',
  'build',
  'dist',
  'node_modules',
  'release'
]);
const maximumDepth = 8;
const maximumDirectories = 800;
const maximumIconBytes = 5 * 1024 * 1024;

const pathInside = (root: string, path: string) => {
  const child = relative(root, path);
  return child === '' || (!child.startsWith('..') && !isAbsolute(child));
};

const imageMimeType = (path: string) => {
  switch (extname(path).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
};

const imageDataUrl = async (root: string, path: string) => {
  const resolved = resolve(path);
  if (!pathInside(root, resolved)) return undefined;
  try {
    const image = await readFile(resolved);
    if (image.byteLength > maximumIconBytes) return undefined;
    return `data:${imageMimeType(resolved)};base64,${image.toString('base64')}`;
  } catch {
    return undefined;
  }
};

const expoIconPath = async (root: string, sourcePath: string) => {
  const configPath = resolve(root, sourcePath);
  if (!pathInside(root, configPath)) return undefined;
  try {
    const config = JSON.parse(await readFile(configPath, 'utf8')) as {
      expo?: {
        icon?: unknown;
        ios?: { icon?: unknown };
      };
    };
    const iosIcon = config.expo?.ios?.icon;
    const configured =
      typeof iosIcon === 'string'
        ? iosIcon
        : iosIcon && typeof iosIcon === 'object' && 'light' in iosIcon && typeof iosIcon.light === 'string'
          ? iosIcon.light
          : typeof config.expo?.icon === 'string'
            ? config.expo.icon
            : undefined;
    return configured ? resolve(dirname(configPath), configured) : undefined;
  } catch {
    return undefined;
  }
};

const appIconSetPaths = async (root: string) => {
  const paths: string[] = [];
  let visitedDirectories = 0;
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > maximumDepth || visitedDirectories >= maximumDirectories) return;
    visitedDirectories += 1;
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || ignoredDirectories.has(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.name.endsWith('.appiconset')) {
        paths.push(path);
      } else {
        await visit(path, depth + 1);
      }
    }
  };
  await visit(root, 0);
  return paths;
};

const xcodeAppIconName = async (root: string, target: ProjectTargetApp) => {
  if (!target.sourcePath) return 'AppIcon';
  const projectPath = resolve(root, target.sourcePath);
  if (!pathInside(root, projectPath)) return 'AppIcon';
  try {
    const project = await readFile(projectPath, 'utf8');
    const buildSettings = [...project.matchAll(/buildSettings\s*=\s*\{([\s\S]*?)\};/g)].map((match) => match[1] ?? '');
    const targetSettings = buildSettings.find((settings) => settings.includes(target.bundleIdentifier));
    const value = /ASSETCATALOG_COMPILER_APPICON_NAME\s*=\s*(?:"([^"]+)"|([^;\n]+))\s*;/.exec(
      targetSettings ?? project
    );
    return (value?.[1] ?? value?.[2] ?? 'AppIcon').trim();
  } catch {
    return 'AppIcon';
  }
};

const imageFromAppIconSet = async (root: string, path: string) => {
  try {
    const contents = JSON.parse(await readFile(join(path, 'Contents.json'), 'utf8')) as {
      images?: Array<{ filename?: unknown; idiom?: unknown; size?: unknown; scale?: unknown }>;
    };
    const images = (contents.images ?? [])
      .filter((image): image is { filename: string; idiom?: unknown; size?: unknown; scale?: unknown } =>
        Boolean(typeof image.filename === 'string' && image.filename)
      )
      .sort((left, right) => {
        const score = (image: { idiom?: unknown; size?: unknown; scale?: unknown }) => {
          const size = typeof image.size === 'string' ? Number.parseFloat(image.size) : 0;
          const scale = typeof image.scale === 'string' ? Number.parseFloat(image.scale) : 1;
          return (image.idiom === 'ios-marketing' ? 1_000_000 : 0) + size * scale;
        };
        return score(right) - score(left);
      });
    for (const image of images) {
      const dataUrl = await imageDataUrl(root, join(path, image.filename));
      if (dataUrl) return dataUrl;
    }
  } catch {
    return undefined;
  }
  return undefined;
};

export const resolveProjectTargetIcons = async (project: MonadDesignProject) => {
  const iconSets = await appIconSetPaths(project.path);
  const entries = await Promise.all(
    project.targetApps.map(async (target) => {
      if (target.sourcePath?.endsWith('app.json')) {
        const path = await expoIconPath(project.path, target.sourcePath);
        const icon = path ? await imageDataUrl(project.path, path) : undefined;
        if (icon) return [target.bundleIdentifier, icon] as const;
      }

      const iconName = await xcodeAppIconName(project.path, target);
      const orderedSets = [...iconSets].sort((left, right) => {
        const rank = (path: string) => (path.endsWith(`/${iconName}.appiconset`) ? 0 : 1);
        return rank(left) - rank(right);
      });
      for (const path of orderedSets) {
        const icon = await imageFromAppIconSet(project.path, path);
        if (icon) return [target.bundleIdentifier, icon] as const;
      }
      return undefined;
    })
  );
  return Object.fromEntries(entries.filter((entry): entry is readonly [string, string] => Boolean(entry)));
};
