import { describe, expect, test } from 'bun:test';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  agentTargets,
  detectGlobalSkillAgents,
  detectProjectSkillAgents,
  supportedAgents,
  supportsProjectInstallation
} from '../../src/agent-targets';
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
    await Promise.all([mkdir(join(home, '.cursor')), mkdir(join(home, '.gemini'))]);

    expect(detectGlobalSkillAgents(home)).toEqual(['cursor', 'gemini-cli']);
  });

  test('covers the supported Skill and MCP target matrix', () => {
    expect(supportedAgents).toEqual([
      'antigravity',
      'cline',
      'cline-cli',
      'claude-code',
      'codex',
      'cursor',
      'gemini-cli',
      'goose',
      'github-copilot-cli',
      'grok-build',
      'kilo-code',
      'kimi-code',
      'kiro-cli',
      'opencode',
      'vscode',
      'windsurf',
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
      'gemini-cli': '.agents/skills/monad-design',
      goose: '.goose/skills/monad-design',
      'github-copilot-cli': '.agents/skills/monad-design',
      'grok-build': '.grok/skills/monad-design',
      'kilo-code': '.kilocode/skills/monad-design',
      'kimi-code': '.agents/skills/monad-design',
      'kiro-cli': '.kiro/skills/monad-design',
      opencode: '.agents/skills/monad-design',
      vscode: '.agents/skills/monad-design',
      windsurf: '.windsurf/skills/monad-design',
      zed: '.agents/skills/monad-design'
    });
  });

  test('tracks which targets can pair project MCP with project Skills', () => {
    expect(supportedAgents.filter(supportsProjectInstallation)).toEqual([
      'claude-code',
      'codex',
      'cursor',
      'gemini-cli',
      'github-copilot-cli',
      'grok-build',
      'kilo-code',
      'kimi-code',
      'kiro-cli',
      'opencode',
      'vscode',
      'zed'
    ]);
  });
});
