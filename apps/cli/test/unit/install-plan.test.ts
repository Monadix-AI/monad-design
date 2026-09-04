import { describe, expect, test } from 'bun:test';

import { detectedAgentsForScope, installableAgentsForScope, resolveInstallDefaults } from '../../src/install';

describe('install defaults', () => {
  test('prefers project agents and project scope inside a Git project', () => {
    expect(resolveInstallDefaults({ project: ['codex'], global: ['codex', 'claude-code'] }, true)).toEqual({
      agents: ['codex'],
      scope: 'project'
    });
  });

  test('uses global agent detection but keeps project scope inside Git', () => {
    expect(resolveInstallDefaults({ project: [], global: ['cursor'] }, true)).toEqual({
      agents: ['cursor'],
      scope: 'project'
    });
  });

  test('defaults to project-capable agents instead of forcing mixed global installation', () => {
    expect(resolveInstallDefaults({ project: [], global: ['antigravity', 'codex', 'goose'] }, true)).toEqual({
      agents: ['codex'],
      scope: 'project'
    });
  });

  test('uses global scope when only global-MCP agents are available', () => {
    expect(resolveInstallDefaults({ project: [], global: ['antigravity', 'goose'] }, true)).toEqual({
      agents: ['antigravity', 'goose'],
      scope: 'global'
    });
  });

  test('cannot choose project scope outside a Git project', () => {
    expect(resolveInstallDefaults({ project: [], global: ['gemini-cli'] }, false)).toEqual({
      agents: ['gemini-cli'],
      scope: 'global'
    });
  });

  test('offers every supported agent with a documented global MCP target', () => {
    expect(installableAgentsForScope('global')).toHaveLength(21);
    expect(installableAgentsForScope('global')).toContain('qoder');
    expect(installableAgentsForScope('global')).toContain('codebuddy');
    expect(installableAgentsForScope('global')).toContain('qwen-code');
    expect(installableAgentsForScope('global')).toContain('zcode');
    expect(installableAgentsForScope('global')).not.toContain('trae');
  });

  test('only offers agents that can install both MCP and Skill for project scope', () => {
    const agents = installableAgentsForScope('project');
    expect(agents).toContain('codex');
    expect(agents).toContain('qoder');
    expect(agents).toContain('trae');
    expect(agents).toContain('codebuddy');
    expect(agents).toContain('qwen-code');
    expect(agents).toContain('zcode');
    expect(agents).not.toContain('antigravity');
    expect(agents).not.toContain('goose');
  });

  test('checks agents detected in the selected project scope', () => {
    expect(
      detectedAgentsForScope(
        { project: ['codex', 'cursor'], global: ['claude-code', 'codex', 'gemini-cli'] },
        'project'
      )
    ).toEqual(['codex', 'cursor']);
  });

  test('checks agents detected in the selected global scope', () => {
    expect(
      detectedAgentsForScope({ project: ['codex', 'cursor'], global: ['claude-code', 'codex', 'gemini-cli'] }, 'global')
    ).toEqual(['claude-code', 'codex', 'gemini-cli']);
  });

  test('keeps the selection empty when the selected scope has no detections', () => {
    expect(detectedAgentsForScope({ project: [], global: ['codex'] }, 'project')).toEqual([]);
  });
});
