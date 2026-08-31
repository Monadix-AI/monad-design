import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

export const findGitProjectRoot = (start = process.cwd()): string | null => {
  let directory = resolve(start);
  while (true) {
    if (existsSync(resolve(directory, '.git'))) return directory;
    const parent = dirname(directory);
    if (parent === directory) return null;
    directory = parent;
  }
};
