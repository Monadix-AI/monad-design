import type { Dirent } from 'node:fs';

import { readdir, readFile } from 'node:fs/promises';
import { basename, dirname, join, relative, resolve } from 'node:path';

import { assertGitProjectRoot } from './git-project-root';
import { createSharedOperation } from './shared-operation';
import { assertBundleIdentifier } from './simulator-variants';

export type ProjectTargetSource = 'project-config' | 'expo' | 'xcode';

export interface ProjectTargetCandidate {
  bundleIdentifier: string;
  name: string;
  source: ProjectTargetSource;
  sourcePath: string;
}

export interface ProjectTargetDetection {
  candidates: ProjectTargetCandidate[];
  inspectedFiles: number;
  warnings: string[];
}

const ignoredDirectories = new Set(['.git', 'DerivedData', 'Pods', 'build', 'dist', 'node_modules', 'release']);
const maximumDepth = 6;
const maximumCandidateFiles = 200;
const maximumDirectories = 500;

const validBundleIdentifier = (value: unknown) => {
  try {
    return assertBundleIdentifier(value);
  } catch {
    return null;
  }
};

export const expoTargetCandidate = (value: string, sourcePath: string): ProjectTargetCandidate | null => {
  try {
    const parsed = JSON.parse(value) as {
      expo?: { name?: unknown; ios?: { bundleIdentifier?: unknown } };
    };
    const parentName = basename(dirname(sourcePath));
    const bundleIdentifier = validBundleIdentifier(parsed.expo?.ios?.bundleIdentifier);
    if (!bundleIdentifier) return null;
    return {
      bundleIdentifier,
      name:
        typeof parsed.expo?.name === 'string' && parsed.expo.name.trim()
          ? parsed.expo.name.trim()
          : parentName && parentName !== '.'
            ? parentName
            : 'Expo app',
      source: 'expo',
      sourcePath
    };
  } catch {
    return null;
  }
};

export const xcodeTargetCandidates = (value: string, sourcePath: string): ProjectTargetCandidate[] => {
  const objectBody = (uuid: string) => {
    const assignment = new RegExp(`${uuid}[^=\\n]*=\\s*\\{`).exec(value);
    if (!assignment) return null;
    const start = assignment.index + assignment[0].length;
    let depth = 1;
    let quoted = false;
    for (let index = start; index < value.length; index += 1) {
      const character = value[index];
      if (character === '"' && value[index - 1] !== '\\') quoted = !quoted;
      if (quoted) continue;
      if (character === '{') depth += 1;
      if (character === '}') depth -= 1;
      if (depth === 0) return value.slice(start, index);
    }
    return null;
  };
  const candidates: ProjectTargetCandidate[] = [];
  const objectPattern = /([A-Fa-f0-9]{24})[^=\n]*=\s*\{/g;
  for (const match of value.matchAll(objectPattern)) {
    const body = objectBody(match[1] ?? '');
    if (
      !body?.includes('isa = PBXNativeTarget;') ||
      !body.includes('productType = "com.apple.product-type.application";')
    ) {
      continue;
    }
    const targetName =
      /(?:^|\n)\s*name = (?:"([^"]+)"|([^;\n]+));/.exec(body)?.slice(1).find(Boolean)?.trim() ??
      basename(sourcePath.replace(/\/project\.pbxproj$/, ''), '.xcodeproj');
    const configurationListId = /buildConfigurationList = ([A-Fa-f0-9]{24})/.exec(body)?.[1];
    const configurationList = configurationListId ? objectBody(configurationListId) : null;
    const configurationIds =
      /buildConfigurations = \(([\s\S]*?)\);/.exec(configurationList ?? '')?.[1]?.match(/[A-Fa-f0-9]{24}/g) ?? [];
    for (const configurationId of configurationIds) {
      const configuration = objectBody(configurationId);
      const identifierMatch = /PRODUCT_BUNDLE_IDENTIFIER\s*=\s*(?:"([^"]+)"|([^;\n]+))\s*;/.exec(configuration ?? '');
      const bundleIdentifier = validBundleIdentifier((identifierMatch?.[1] ?? identifierMatch?.[2] ?? '').trim());
      if (bundleIdentifier) {
        candidates.push({
          bundleIdentifier,
          name: targetName,
          source: 'xcode',
          sourcePath
        });
      }
    }
  }
  return candidates.filter(
    (candidate, index, items) =>
      items.findIndex((item) => item.bundleIdentifier === candidate.bundleIdentifier) === index
  );
};

const projectConfigCandidates = (value: string, sourcePath: string): ProjectTargetCandidate[] => {
  try {
    const parsed = JSON.parse(value) as {
      name?: unknown;
      simulator?: {
        targetApps?: Array<{
          bundleIdentifier?: unknown;
          name?: unknown;
          sourcePath?: unknown;
        }>;
      };
    };
    return (parsed.simulator?.targetApps ?? []).flatMap((app) => {
      const bundleIdentifier = validBundleIdentifier(app.bundleIdentifier);
      if (!bundleIdentifier) return [];
      return [
        {
          bundleIdentifier,
          name: typeof app.name === 'string' && app.name.trim() ? app.name.trim() : bundleIdentifier,
          source: 'project-config' as const,
          sourcePath: typeof app.sourcePath === 'string' && app.sourcePath.trim() ? app.sourcePath : sourcePath
        }
      ];
    });
  } catch {
    return [];
  }
};

const candidateFiles = async (root: string) => {
  const paths: string[] = [];
  let visitedDirectories = 0;
  const visit = async (directory: string, depth: number): Promise<void> => {
    if (depth > maximumDepth || paths.length >= maximumCandidateFiles || visitedDirectories >= maximumDirectories) {
      return;
    }
    visitedDirectories += 1;
    let entries: Dirent[];
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (paths.length >= maximumCandidateFiles) return;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name)) await visit(path, depth + 1);
        continue;
      }
      if (
        entry.isFile() &&
        (entry.name === 'app.json' || (entry.name === 'project.pbxproj' && directory.endsWith('.xcodeproj')))
      ) {
        paths.push(path);
      }
    }
  };
  await visit(root, 0);
  return paths;
};

const sourcePriority: Record<ProjectTargetSource, number> = {
  'project-config': 0,
  expo: 1,
  xcode: 2
};

const scanProjectTargets = createSharedOperation(
  async (root: string): Promise<ProjectTargetDetection> => {
    await assertGitProjectRoot(root);

    const warnings: string[] = [];
    const detected: ProjectTargetCandidate[] = [];
    const configPaths = [join(root, '.monaddesign', 'project.json')];
    for (const configPath of configPaths) {
      try {
        const candidates = projectConfigCandidates(await readFile(configPath, 'utf8'), relative(root, configPath));
        detected.push(...candidates);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          warnings.push(`Could not inspect ${relative(root, configPath)}.`);
        }
      }
    }

    const files = await candidateFiles(root);
    for (const path of files) {
      const sourcePath = relative(root, path);
      try {
        const value = await readFile(path, 'utf8');
        if (basename(path) === 'app.json') {
          const candidate = expoTargetCandidate(value, sourcePath);
          if (candidate) detected.push(candidate);
        } else {
          detected.push(...xcodeTargetCandidates(value, sourcePath));
        }
      } catch {
        warnings.push(`Could not inspect ${sourcePath}.`);
      }
    }

    const candidates = [...detected]
      .sort(
        (left, right) =>
          sourcePriority[left.source] - sourcePriority[right.source] ||
          left.bundleIdentifier.localeCompare(right.bundleIdentifier)
      )
      .filter(
        (candidate, index, items) =>
          items.findIndex((item) => item.bundleIdentifier === candidate.bundleIdentifier) === index
      );

    return {
      candidates,
      inspectedFiles: files.length + configPaths.length,
      warnings
    };
  },
  { key: (root) => resolve(root) }
);

export const detectProjectTargets = (root: string) => scanProjectTargets(root);
