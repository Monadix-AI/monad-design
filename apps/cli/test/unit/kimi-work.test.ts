import { afterEach, describe, expect, test } from 'bun:test';
import { access, mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { exportKimiWorkPlugin } from '../../src/kimi-work';

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'kimi-work-test-'));
  roots.push(root);
  return {
    outputDirectory: join(root, 'exports'),
    skillSourcePath: resolve(import.meta.dir, '../../assets/skill'),
    version: '0.0.9',
    mcpUrl: 'http://127.0.0.1:54321/mcp'
  };
};

describe('Kimi Work native plugin export', () => {
  test('packages the real skill and references with the runtime endpoint', async () => {
    const options = await fixture();
    const directory = await exportKimiWorkPlugin(options);
    const manifest = JSON.parse(await readFile(join(directory, 'kimi.plugin.json'), 'utf8'));
    expect(manifest.name).toBe('monad-design');
    expect(manifest.version).toBe(options.version);
    expect(manifest.mcpServers['monad-design']).toEqual({ url: options.mcpUrl });
    const skill = join(directory, manifest.skills, 'monad-design');
    for (const file of ['SKILL.md', 'references/protocol.md', 'references/framework-adapters.md']) {
      expect(await readFile(join(skill, file), 'utf8')).toBe(
        await readFile(join(options.skillSourcePath, file), 'utf8')
      );
    }
    expect(
      await access(join(skill, 'agents/openai.yaml')).then(
        () => true,
        () => false
      )
    ).toBe(false);
    expect(await readFile(join(directory, 'README.md'), 'utf8')).toContain('does not install or enable');
  });

  test('repeated exports preserve previously imported source directories', async () => {
    const options = await fixture();
    const first = await exportKimiWorkPlugin(options);
    const original = await readFile(join(first, 'kimi.plugin.json'), 'utf8');
    const second = await exportKimiWorkPlugin({ ...options, mcpUrl: 'http://localhost:54322/mcp' });
    expect(second).not.toBe(first);
    expect(await readFile(join(first, 'kimi.plugin.json'), 'utf8')).toBe(original);
  });

  test('rejects non-Core endpoints before writing plugin files', async () => {
    const options = await fixture();
    for (const mcpUrl of [
      'https://example.com/mcp',
      'http://127.0.0.1/admin',
      'http://user:secret@localhost/mcp',
      'http://localhost/mcp?token=secret'
    ]) {
      await expect(exportKimiWorkPlugin({ ...options, mcpUrl })).rejects.toThrow('local Monad Design Core');
    }
    expect(
      await access(options.outputDirectory).then(
        () => true,
        () => false
      )
    ).toBe(false);
  });

  test('removes incomplete exports when the skill source cannot be copied', async () => {
    const options = await fixture();
    await expect(
      exportKimiWorkPlugin({ ...options, skillSourcePath: join(options.outputDirectory, 'missing') })
    ).rejects.toThrow();
    expect(await readdir(options.outputDirectory)).toEqual([]);
  });
});
