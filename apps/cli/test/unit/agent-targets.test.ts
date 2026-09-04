import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { upsertServer } from 'add-mcp';

import {
  agentTargets,
  detectGlobalSkillAgents,
  detectProjectSkillAgents,
  supportedAgents,
  supportsInstallationScope,
  supportsProjectInstallation
} from '../../src/agent-targets';
import { upsertDeepSeekHarnessServer } from '../../src/deepseek-harness';
import { findGitProjectRoot } from '../../src/project-root';

describe('agent and project detection', () => {
  test('detects project harnesses from the canonical Git root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monad-design-project-'));
    const nested = join(root, 'packages', 'app');
    await Promise.all([mkdir(join(root, '.git')), mkdir(join(root, '.claude')), mkdir(nested, { recursive: true })]);

    expect(findGitProjectRoot(nested)).toBe(root);
    expect(detectProjectSkillAgents(root)).toEqual(['claude-code']);
  });

  test('detects global agent homes without touching real user configuration', async () => {
    const home = await mkdtemp(join(tmpdir(), 'monad-design-home-'));
    await Promise.all([
      mkdir(join(home, '.cursor')),
      mkdir(join(home, '.dsh')),
      mkdir(join(home, '.gemini')),
      mkdir(join(home, '.qoder')),
      mkdir(join(home, '.qwen')),
      mkdir(join(home, '.trae-cn')),
      mkdir(join(home, '.codebuddy')),
      mkdir(join(home, '.zcode'))
    ]);

    expect(detectGlobalSkillAgents(home)).toEqual([
      'cursor',
      'deepseek-harness',
      'gemini-cli',
      'qoder',
      'qwen-code',
      'trae',
      'codebuddy',
      'zcode'
    ]);
  });

  test('covers the supported Skill and MCP target matrix', () => {
    expect(supportedAgents).toEqual([
      'antigravity',
      'cline',
      'cline-cli',
      'claude-code',
      'codex',
      'cursor',
      'deepseek-harness',
      'gemini-cli',
      'goose',
      'github-copilot-cli',
      'grok-build',
      'kilo-code',
      'kimi-code',
      'kiro-cli',
      'opencode',
      'qoder',
      'qwen-code',
      'trae',
      'codebuddy',
      'vscode',
      'windsurf',
      'zcode',
      'zed'
    ]);
  });

  test('uses current project Skill paths from the Agent Skills registry', () => {
    const root = '/workspace';
    const relativeParents = Object.fromEntries(
      supportedAgents.map((agent) => [agent, agentTargets[agent].projectSkillDirectory(root).slice(`${root}/`.length)])
    );

    expect(relativeParents).toEqual({
      antigravity: '.agents/skills/monad-design',
      cline: '.agents/skills/monad-design',
      'cline-cli': '.agents/skills/monad-design',
      'claude-code': '.claude/skills/monad-design',
      codex: '.agents/skills/monad-design',
      cursor: '.agents/skills/monad-design',
      'deepseek-harness': '.dsh/skills/monad-design',
      'gemini-cli': '.agents/skills/monad-design',
      goose: '.goose/skills/monad-design',
      'github-copilot-cli': '.agents/skills/monad-design',
      'grok-build': '.grok/skills/monad-design',
      'kilo-code': '.kilocode/skills/monad-design',
      'kimi-code': '.agents/skills/monad-design',
      'kiro-cli': '.kiro/skills/monad-design',
      opencode: '.agents/skills/monad-design',
      qoder: '.qoder/skills/monad-design',
      'qwen-code': '.qwen/skills/monad-design',
      trae: '.trae/skills/monad-design',
      codebuddy: '.codebuddy/skills/monad-design',
      vscode: '.agents/skills/monad-design',
      windsurf: '.windsurf/skills/monad-design',
      zcode: '.zcode/skills/monad-design',
      zed: '.agents/skills/monad-design'
    });
  });

  test('tracks which targets can pair project MCP with project Skills', () => {
    expect(supportedAgents.filter(supportsProjectInstallation)).toEqual([
      'claude-code',
      'codex',
      'cursor',
      'deepseek-harness',
      'gemini-cli',
      'github-copilot-cli',
      'grok-build',
      'kilo-code',
      'kimi-code',
      'kiro-cli',
      'opencode',
      'qoder',
      'qwen-code',
      'trae',
      'codebuddy',
      'vscode',
      'zcode',
      'zed'
    ]);
    expect(supportedAgents.filter((agent) => supportsInstallationScope(agent, 'global'))).not.toContain('trae');
  });

  test('upserts the DeepSeek Harness MCP client in its shared home patch', async () => {
    const home = await mkdtemp(join(tmpdir(), 'monad-design-dsh-home-'));
    const dshHome = join(home, '.dsh');
    await mkdir(dshHome);
    await writeFile(join(dshHome, 'cordis.patch.yml'), '[]\n');

    const path = await upsertDeepSeekHarnessServer('http://127.0.0.1:41765/mcp', home);
    await upsertDeepSeekHarnessServer('http://127.0.0.1:52760/mcp', home);
    const patch = await readFile(path, 'utf8');

    expect(path).toBe(join(dshHome, 'cordis.patch.yml'));
    expect(patch.match(/id: mcp-monad-design/g)).toHaveLength(1);
    expect(patch).toContain("name: '@deepseek-ai/dsh-mcp-client'");
    expect(patch).toContain('transport: streamable-http');
    expect(patch).toContain("url: 'http://127.0.0.1:52760/mcp'");
  });

  test('writes documented project MCP files for Chinese agent targets', async () => {
    const root = await mkdtemp(join(tmpdir(), 'monad-design-agent-targets-'));
    const server = { type: 'http' as const, url: 'http://127.0.0.1:52760/mcp' };

    for (const [agent, relativePath] of [
      ['qoder', '.qoder/settings.json'],
      ['qwen-code', '.qwen/settings.json'],
      ['trae', '.trae/mcp.json'],
      ['codebuddy', '.mcp.json'],
      ['zcode', '.zcode/config.json']
    ] as const) {
      const result = upsertServer(agent, 'monad-design', server, { local: true, cwd: root });
      expect(result.success).toBe(true);
      expect(result.path).toBe(join(root, relativePath));
      const config = JSON.parse(await readFile(result.path, 'utf8'));
      if (agent === 'zcode') {
        expect(config).toMatchObject({ mcp: { servers: { 'monad-design': server } } });
      } else if (agent === 'qwen-code') {
        expect(config).toMatchObject({ mcpServers: { 'monad-design': { httpUrl: server.url } } });
      } else {
        expect(config).toMatchObject({ mcpServers: { 'monad-design': server } });
      }
    }
  });
});
