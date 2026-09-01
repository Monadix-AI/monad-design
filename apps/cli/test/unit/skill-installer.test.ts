import { describe, expect, test } from 'bun:test';
import { access, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { installSkillDirectory, removeLegacyMonadDesignSkill } from '../../src/skill-installer';

describe('skill installation', () => {
  test('installs and safely replaces one managed skill directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monad-design-skill-'));
    const source = join(root, 'source');
    const destination = join(root, 'agent', 'skills', 'monad-design');
    await Bun.write(join(source, 'SKILL.md'), 'version one');

    await installSkillDirectory(source, destination);
    expect(await readFile(join(destination, 'SKILL.md'), 'utf8')).toBe('version one');

    await writeFile(join(source, 'SKILL.md'), 'version two');
    await installSkillDirectory(source, destination);
    expect(await readFile(join(destination, 'SKILL.md'), 'utf8')).toBe('version two');
  });

  test('installs OpenAI metadata only when requested', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monad-design-skill-metadata-'));
    const source = join(root, 'source');
    const codexDestination = join(root, 'codex', 'skills', 'monad-design');
    const otherDestination = join(root, 'other', 'skills', 'monad-design');
    await Bun.write(join(source, 'SKILL.md'), 'shared skill');
    await Bun.write(join(source, 'agents', 'openai.yaml'), 'interface: {}');

    await installSkillDirectory(source, codexDestination, { includeOpenAiMetadata: true });
    expect(await readFile(join(codexDestination, 'agents', 'openai.yaml'), 'utf8')).toBe('interface: {}');

    await installSkillDirectory(source, otherDestination, { includeOpenAiMetadata: false });
    expect(await readFile(join(otherDestination, 'SKILL.md'), 'utf8')).toBe('shared skill');
    expect(
      await access(join(otherDestination, 'agents')).then(
        () => true,
        () => false
      )
    ).toBe(false);
  });

  test('removes only the legacy Monad Design skill after migration', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monad-design-skill-migration-'));
    const legacy = join(root, 'monad-design-live');
    const unrelated = join(root, 'unrelated');
    await Bun.write(join(legacy, 'SKILL.md'), '---\nname: monad-design-live\n---\n');
    await Bun.write(join(unrelated, 'SKILL.md'), '---\nname: another-skill\n---\n');

    expect(await removeLegacyMonadDesignSkill(legacy)).toBe(true);
    expect(
      await access(legacy).then(
        () => true,
        () => false
      )
    ).toBe(false);
    expect(await removeLegacyMonadDesignSkill(unrelated)).toBe(false);
    expect(await readFile(join(unrelated, 'SKILL.md'), 'utf8')).toContain('another-skill');
  });
});
