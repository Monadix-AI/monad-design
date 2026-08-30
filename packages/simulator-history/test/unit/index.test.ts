import { describe, expect, test } from 'bun:test';

import { parseSimulatorHistory, recordUsedSimulator, sortSimulatorsForProject } from '../../src';

const simulator = (udid: string, state: 'Booted' | 'Shutdown') => ({ udid, state });

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

  test('puts connected and used simulators first, then booted simulators, while preserving source order', () => {
    const sorted = sortSimulatorsForProject(
      [
        simulator('shutdown-a', 'Shutdown'),
        simulator('booted-a', 'Booted'),
        simulator('used', 'Shutdown'),
        simulator('booted-b', 'Booted'),
        { ...simulator('connected', 'Booted'), connected: true }
      ],
      ['used']
    );
    expect(sorted.map(({ udid }) => udid)).toEqual(['connected', 'used', 'booted-a', 'booted-b', 'shutdown-a']);
  });

  test('uses recent history before boot state', () => {
    const sorted = sortSimulatorsForProject(
      [simulator('booted-a', 'Booted'), simulator('booted-b', 'Booted'), simulator('shutdown-a', 'Shutdown')],
      ['booted-b', 'shutdown-a']
    );
    expect(sorted.map(({ udid }) => udid)).toEqual(['booted-b', 'shutdown-a', 'booted-a']);
  });
});
