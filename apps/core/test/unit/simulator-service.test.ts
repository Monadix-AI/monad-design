import type { ProjectStore } from '../../src/project-store';

import { expect, test } from 'bun:test';

import { createSimulatorService } from '../../src/server/simulator-service';
import { SimulatorAppNotInstalledError } from '../../src/simulators';

const fixture = (installed = false) => {
  const events: string[] = [];
  const project = {
    id: 'project',
    path: '/project',
    name: 'Example',
    configPath: '',
    lastOpenedAt: '',
    targetApps: [{ name: 'Example', bundleIdentifier: 'com.example.app' }]
  };
  const dependencies: NonNullable<Parameters<typeof createSimulatorService>[1]> = {
    ensureSimulatorBooted: async (udid) => {
      events.push('boot');
      return { udid, name: 'Phone', runtime: 'iOS', state: 'Booted', connected: false };
    },
    ensureSimulatorAppInstalled: async () => {
      events.push('check');
      if (!installed) throw new SimulatorAppNotInstalledError('missing');
      return 'com.example.app';
    },
    buildAndInstallSimulatorApp: async (_project, _target, _udid, phase) => {
      events.push('build');
      phase?.('building');
      phase?.('installing');
      installed = true;
    },
    launchSimulatorApp: async () => {
      events.push('launch');
      return { bundleId: 'com.example.app', process: '123' };
    },
    connectBridge: async (udid, options) => {
      events.push('bridge');
      return { ...options, udid, streamUrl: '', wsUrl: '', orientation: 'portrait' };
    }
  };
  const store: Pick<ProjectStore, 'open'> = { open: async () => project };
  const service = createSimulatorService(store, dependencies);
  return { service, dependencies, events };
};

test('builds missing app, verifies installation, then launches and connects', async () => {
  const f = fixture();
  await f.service.connect('project', 'device', 'com.example.app');
  expect(f.events).toEqual(['boot', 'check', 'build', 'check', 'launch', 'bridge']);
});

test('installed app connects directly; explicit rebuild builds again', async () => {
  const f = fixture(true);
  await f.service.connect('project', 'device', 'com.example.app');
  expect(f.events).toEqual(['boot', 'check', 'launch', 'bridge']);
  f.events.length = 0;
  await f.service.connect('project', 'device', 'com.example.app', true);
  expect(f.events).toEqual(['boot', 'build', 'check', 'launch', 'bridge']);
});

test('inspection failure does not trigger a build', async () => {
  const f = fixture();
  f.dependencies.ensureSimulatorAppInstalled = async () => {
    throw new Error('Simulator unavailable');
  };
  await expect(f.service.connect('project', 'device', 'com.example.app')).rejects.toThrow('Simulator unavailable');
  expect(f.events).toEqual(['boot']);
});

test('failed build stops connection and permits retry', async () => {
  const f = fixture();
  const build = f.dependencies.buildAndInstallSimulatorApp;
  f.dependencies.buildAndInstallSimulatorApp = async () => {
    throw new Error('Compiler error');
  };
  await expect(f.service.connect('project', 'device', 'com.example.app')).rejects.toThrow('Compiler error');
  expect(f.events).not.toContain('launch');
  f.dependencies.buildAndInstallSimulatorApp = build;
  await f.service.connect('project', 'device', 'com.example.app');
  expect(f.events.at(-1)).toBe('bridge');
});

test('shares duplicate requests and exposes progress while refusing competing connections', async () => {
  const f = fixture();
  let release = () => {};
  const wait = new Promise<void>((resolve) => {
    release = resolve;
  });
  const build = f.dependencies.buildAndInstallSimulatorApp;
  f.dependencies.buildAndInstallSimulatorApp = async (...args) => {
    await build(...args);
    await wait;
  };
  const first = f.service.connect('project', 'device', 'com.example.app');
  const duplicate = f.service.connect('project', 'device', 'com.example.app');
  expect(first).toBe(duplicate);
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(f.service.status('project', 'device', 'com.example.app').phase).toBe('installing');
  await expect(f.service.connect('project', 'other', 'com.example.app')).rejects.toThrow('in progress');
  release();
  await first;
  expect(f.events.filter((event) => event === 'build')).toHaveLength(1);
});
