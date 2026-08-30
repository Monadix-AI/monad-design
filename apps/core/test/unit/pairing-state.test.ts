import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolvePairingCode } from '../../src/server/pairing-state';

const directories: string[] = [];

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

const statePath = () => {
  const directory = mkdtempSync(join(tmpdir(), 'monaddesign-pairing-'));
  directories.push(directory);
  return join(directory, 'pairing.json');
};

describe('persistent pairing state', () => {
  test('reuses the pairing code when the Client IP addresses are unchanged', () => {
    const path = statePath();

    expect(resolvePairingCode(path, ['192.168.1.20'], () => '123456')).toBe('123456');
    expect(resolvePairingCode(path, ['192.168.1.20'], () => '654321')).toBe('123456');
  });

  test('rotates the pairing code when the Client IP addresses change', () => {
    const path = statePath();

    resolvePairingCode(path, ['192.168.1.20'], () => '123456');
    expect(resolvePairingCode(path, ['192.168.1.21'], () => '654321')).toBe('654321');
    expect(JSON.parse(readFileSync(path, 'utf8'))).toMatchObject({
      addresses: ['192.168.1.21'],
      pairingCode: '654321'
    });
  });

  test('replaces invalid persisted state instead of accepting it', () => {
    const path = statePath();
    writeFileSync(path, '{"schemaVersion":1,"addresses":[],"pairingCode":"not-a-code"}');

    expect(resolvePairingCode(path, [], () => '246810')).toBe('246810');
  });
});
