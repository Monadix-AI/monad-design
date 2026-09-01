import type { IOSSimulator } from '@monaddesign/client-contract';

import { describe, expect, test } from 'bun:test';
import { parseSimulatorHistory, recordUsedSimulator, sortSimulatorsForProject } from '@monaddesign/simulator-history';

const simulator = (udid: string, state: IOSSimulator['state']): IOSSimulator => ({
  udid,
  name: udid,
  runtime: 'iOS 26.0',
  state,
  connected: false
});

describe('simulator history', () => {
  test('parses valid project histories and ignores malformed values', () => {
    expect(parseSimulatorHistory('{"project-a":["one",2,"two"],"project-b":"bad"}')).toEqual({
      'project-a': ['one', 'two']
    });
    expect(parseSimulatorHistory('not json')).toEqual({});
  });

  test('records the most recently used simulator first without duplicates', () => {
    expect(recordUsedSimulator({ project: ['one', 'two'] }, 'project', 'two')).toEqual({
      project: ['two', 'one']
    });
  });

  test('puts connected and project-used simulators first, then booted simulators, while preserving source order', () => {
    const sorted = sortSimulatorsForProject(
      [
        simulator('shutdown-a', 'Shutdown'),
        simulator('booted-a', 'Booted'),
        simulator('used', 'Shutdown'),
        { ...simulator('connected', 'Booted'), connected: true }
      ],
      ['used']
    );
    expect(sorted.map(({ udid }) => udid)).toEqual(['connected', 'used', 'booted-a', 'shutdown-a']);
  });
});
