import { describe, expect, test } from 'bun:test';

import { resolveInstallDefaults } from '../../src/install';

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
});
