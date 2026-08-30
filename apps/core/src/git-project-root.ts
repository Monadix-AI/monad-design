import { readFile, realpath, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const isGitRoot = async (path: string) => {
  try {
    const gitEntry = join(path, '.git');
    const gitStat = await stat(gitEntry);
    if (gitStat.isDirectory()) return true;
    return gitStat.isFile() && (await readFile(gitEntry, 'utf8')).startsWith('gitdir:');
  } catch {
    return false;
  }
};

export const assertGitProjectRoot = async (path: string) => {
  const projectStat = await stat(path);
  if (!projectStat.isDirectory()) throw new Error('Select a project directory.');

  const selectedPath = await realpath(path);
  const root = await findGitProjectRoot(selectedPath);
  if (root === selectedPath) return selectedPath;

  throw new Error(`Select the Git repository root: ${root}`);
};

export const findGitProjectRoot = async (path: string) => {
  const projectStat = await stat(path);
  if (!projectStat.isDirectory()) throw new Error('Select a project directory.');

  const selectedPath = await realpath(path);
  if (await isGitRoot(selectedPath)) return selectedPath;

  let parent = dirname(selectedPath);
  while (parent !== dirname(parent)) {
    if (await isGitRoot(parent)) return parent;
    parent = dirname(parent);
  }
  throw new Error('Select the root directory of a Git repository.');
};
