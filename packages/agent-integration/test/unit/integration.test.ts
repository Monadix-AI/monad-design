import { afterEach, describe, expect, test } from 'bun:test';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { inspectAgentIntegration, installAgent } from '../../src';

const roots: string[] = [];
const source = resolve(import.meta.dir, '../../../../.agents/skills/monad-design');
const url = 'http://127.0.0.1:41765/mcp';
afterEach(async () => {
  for (const root of roots.splice(0)) await rm(root, { recursive: true, force: true });
});
const fixture = async () => {
  const root = await mkdtemp(join(tmpdir(), 'monad-integration-'));
  roots.push(root);
  return root;
};

describe('shared agent installation', () => {
  test('writes and verifies project integration, preserves other MCP servers, and detects drift', async () => {
    const root = await fixture();
    await writeFile(join(root, '.mcp.json'), JSON.stringify({ mcpServers: { other: { command: 'other-server' } } }));
    const initial = await inspectAgentIntegration('codebuddy', 'project', root, source, url);
    expect(initial.skill).toBe('missing');
    expect(initial.mcp).toBe('missing');
    const installed = await installAgent('codebuddy', 'project', root, source, url);
    const verified = await inspectAgentIntegration('codebuddy', 'project', root, source, url);
    expect(verified.skill).toBe('current');
    expect(verified.mcp).toBe('configured');
    expect(JSON.parse(await readFile(installed.mcpPath, 'utf8')).mcpServers.other.command).toBe('other-server');
    await writeFile(join(installed.skillPath, 'custom.md'), 'local changes');
    expect((await inspectAgentIntegration('codebuddy', 'project', root, source, url)).skill).toBe('modified');
    expect(
      (await inspectAgentIntegration('codebuddy', 'project', root, source, 'http://127.0.0.1:41766/mcp')).mcp
    ).toBe('stale');
  });
  test('distinguishes an untouched old managed skill from user changes', async () => {
    const root = await fixture();
    const localSource = join(root, 'source');
    await cp(source, localSource, { recursive: true });
    await installAgent('qoder', 'project', root, localSource, url);
    await writeFile(join(localSource, 'new-guide.md'), 'new version');
    expect((await inspectAgentIntegration('qoder', 'project', root, localSource, url)).skill).toBe('outdated');
  });
  test('TRAE remains project only and verifies its transport format', async () => {
    const root = await fixture();
    expect((await inspectAgentIntegration('trae', 'global', null, source, url)).supported).toBe(false);
    await expect(installAgent('trae', 'global', null, source, url)).rejects.toThrow('scope');
    await installAgent('trae', 'project', root, source, url);
    expect((await inspectAgentIntegration('trae', 'project', root, source, url)).mcp).toBe('configured');
  });
  test('malformed MCP configuration is reported without rewriting it', async () => {
    const root = await fixture();
    await writeFile(join(root, '.mcp.json'), '{ malformed');
    const status = await inspectAgentIntegration('codebuddy', 'project', root, source, url);
    expect(status.mcp).toBe('conflict');
    expect(await readFile(join(root, '.mcp.json'), 'utf8')).toBe('{ malformed');
  });
});
