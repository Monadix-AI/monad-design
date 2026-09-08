import { describe, expect, test } from 'bun:test';
import { access, cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { installSkillBundle, installSkillDirectory, removeLegacyMonadDesignSkill } from '../../src/skill-installer';

describe('skill installation', () => {
  test('installs the complete discoverable pack and preserves unrelated skills on replacement', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monad-design-pack-'));
    try {
      const source = resolve(import.meta.dir, '../../assets/skill');
      const destination = join(root, 'skills', 'monad-design');
      const names = JSON.parse(await readFile(join(source, 'companion-skills.json'), 'utf8')) as string[];
      await Bun.write(join(root, 'skills', 'unrelated', 'SKILL.md'), 'Keep me');
      for (const includeOpenAiMetadata of [true, false]) {
        const installed = await installSkillBundle(source, destination, { includeOpenAiMetadata });
        expect(installed).toHaveLength(7);
        for (const name of names) {
          const body = await readFile(join(destination, '..', name, 'SKILL.md'), 'utf8');
          expect(body).toBe(await readFile(join(source, '..', 'adjustment-skills', name, 'SKILL.md'), 'utf8'));
          expect(body).toBe(
            await readFile(resolve(import.meta.dir, '../../../../.agents/skills', name, 'SKILL.md'), 'utf8')
          );
          expect(body).toContain('version: "2"');
          expect(
            await access(join(destination, '..', name, 'agents/openai.yaml')).then(
              () => true,
              () => false
            )
          ).toBe(includeOpenAiMetadata);
        }
      }
      expect(await readFile(join(root, 'skills', 'unrelated', 'SKILL.md'), 'utf8')).toBe('Keep me');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('fails before replacing installed skills when a companion asset is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monad-design-pack-missing-'));
    try {
      const assets = join(root, 'assets');
      await cp(resolve(import.meta.dir, '../../assets/skill'), join(assets, 'skill'), { recursive: true });
      const destination = join(root, 'installed', 'monad-design');
      await Bun.write(join(destination, 'SKILL.md'), 'Previous working entrypoint');
      await expect(installSkillBundle(join(assets, 'skill'), destination)).rejects.toThrow();
      expect(await readFile(join(destination, 'SKILL.md'), 'utf8')).toBe('Previous working entrypoint');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
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
