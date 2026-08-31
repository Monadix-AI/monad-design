import { describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { installSkillDirectory } from '../../src/skill-installer';

describe('skill installation', () => {
  test('installs and safely replaces one managed skill directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monad-design-skill-'));
    const source = join(root, 'source');
    const destination = join(root, 'agent', 'skills', 'monad-design-live');
    await Bun.write(join(source, 'SKILL.md'), 'version one');

    await installSkillDirectory(source, destination);
    expect(await readFile(join(destination, 'SKILL.md'), 'utf8')).toBe('version one');

    await writeFile(join(source, 'SKILL.md'), 'version two');
    await installSkillDirectory(source, destination);
    expect(await readFile(join(destination, 'SKILL.md'), 'utf8')).toBe('version two');
  });
});
