import { describe, expect, test } from 'bun:test';
import { access, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  installMonadDesignSkill,
  installSkillDirectory,
  removeLegacyAdjustmentSkills,
  removeLegacyMonadDesignSkill
} from '../../src/skill-installer';

describe('skill installation', () => {
  test('installs one self-contained skill and preserves unrelated skills on replacement', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monad-design-skill-'));
    try {
      const source = resolve(import.meta.dir, '../../../../.agents/skills/monad-design');
      const destination = join(root, 'skills', 'monad-design');
      await Bun.write(join(root, 'skills', 'unrelated', 'SKILL.md'), 'Keep me');
      for (const includeOpenAiMetadata of [true, false]) {
        await installMonadDesignSkill(source, destination, { includeOpenAiMetadata });
        expect(await readFile(join(destination, 'SKILL.md'), 'utf8')).toBe(
          await readFile(join(source, 'SKILL.md'), 'utf8')
        );
        if (includeOpenAiMetadata) {
          const metadata = Bun.YAML.parse(await readFile(join(destination, 'agents/openai.yaml'), 'utf8')) as {
            policy: { allow_implicit_invocation: boolean };
          };
          expect(metadata.policy.allow_implicit_invocation).toBe(false);
        }
        const guides = JSON.parse(await readFile(join(destination, 'adjustments.json'), 'utf8')) as Array<{
          name: string;
          version: string;
          relativePath: string;
        }>;
        expect(guides).toHaveLength(6);
        for (const guide of guides) {
          const body = await readFile(join(destination, guide.relativePath), 'utf8');
          expect(body).toBe(await readFile(join(source, guide.relativePath), 'utf8'));
          expect(body).toContain(`name: ${guide.name}`);
          expect(body).toContain(`version: "${guide.version}"`);
        }
        expect((await readdir(join(root, 'skills'))).sort()).toEqual(['monad-design', 'unrelated']);
        expect(
          await access(join(destination, 'agents/openai.yaml')).then(
            () => true,
            () => false
          )
        ).toBe(includeOpenAiMetadata);
      }
      expect(await readFile(join(root, 'skills', 'unrelated', 'SKILL.md'), 'utf8')).toBe('Keep me');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('fails before replacing an installed skill when its source is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monad-design-skill-missing-'));
    try {
      const destination = join(root, 'installed', 'monad-design');
      await Bun.write(join(destination, 'SKILL.md'), 'Previous working entrypoint');
      await expect(installMonadDesignSkill(join(root, 'missing'), destination)).rejects.toThrow();
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

  test('removes managed sibling guides without deleting unrelated skill content', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monad-design-adjustment-migration-'));
    const source = resolve(import.meta.dir, '../../../../.agents/skills/monad-design');
    const destination = join(root, 'skills', 'monad-design');
    const managed = join(root, 'skills', 'monad-design-layout');
    const unrelated = join(root, 'skills', 'monad-design-motion');
    await Bun.write(join(managed, 'SKILL.md'), '---\nname: monad-design-layout\n---\n');
    await Bun.write(join(unrelated, 'SKILL.md'), '---\nname: another-skill\n---\n');

    expect(await removeLegacyAdjustmentSkills(source, destination)).toEqual([managed]);
    expect(
      await access(managed).then(
        () => true,
        () => false
      )
    ).toBe(false);
    expect(await readFile(join(unrelated, 'SKILL.md'), 'utf8')).toContain('another-skill');
  });
});
