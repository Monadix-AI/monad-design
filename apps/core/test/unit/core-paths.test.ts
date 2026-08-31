import { describe, expect, test } from 'bun:test';

import { resolveCorePaths } from '../../src/core-paths';

describe('machine Core paths', () => {
  test('derives one bootstrap, executable, and session store from the canonical state directory', () => {
    expect(resolveCorePaths({ MONAD_DESIGN_CORE_STATE_DIR: '/tmp/monad-design-machine-core' })).toEqual({
      stateDirectory: '/tmp/monad-design-machine-core',
      bootstrapPath: '/tmp/monad-design-machine-core/bootstrap.json',
      credentialsPath: '/tmp/monad-design-machine-core/credentials.json',
      executablePath: '/tmp/monad-design-machine-core/bin/monad-design',
      nativeAddonPath: '/tmp/monad-design-machine-core/bin/native/serve-sim-native.node',
      installManifestPath: '/tmp/monad-design-machine-core/install.json',
      lockPath: '/tmp/monad-design-machine-core/core.lock',
      sessionsPath: '/tmp/monad-design-machine-core/agent-sessions.json',
      versionsDirectory: '/tmp/monad-design-machine-core/versions'
    });
  });

  test('allows deployment tests and managed installations to override public artifacts', () => {
    const paths = resolveCorePaths({
      MONAD_DESIGN_CORE_STATE_DIR: '/tmp/state',
      MONAD_DESIGN_CORE_BOOTSTRAP_PATH: '/tmp/runtime/bootstrap.json',
      MONAD_DESIGN_CORE_EXECUTABLE_PATH: '/tmp/runtime/core'
    });
    expect(paths.bootstrapPath).toBe('/tmp/runtime/bootstrap.json');
    expect(paths.executablePath).toBe('/tmp/runtime/core');
    expect(paths.sessionsPath).toBe('/tmp/state/agent-sessions.json');
  });
});
