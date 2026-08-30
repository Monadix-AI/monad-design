import { randomInt, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

interface StoredPairingState {
  schemaVersion: 1;
  addresses: string[];
  pairingCode: string;
}

const normalizeAddresses = (addresses: readonly string[]) => [...new Set(addresses)].sort();

const isStoredPairingState = (value: unknown): value is StoredPairingState => {
  if (!value || typeof value !== 'object') return false;
  const state = value as Partial<StoredPairingState>;
  return (
    state.schemaVersion === 1 &&
    Array.isArray(state.addresses) &&
    state.addresses.every((address) => typeof address === 'string') &&
    typeof state.pairingCode === 'string' &&
    /^\d{6}$/.test(state.pairingCode)
  );
};

const sameAddresses = (left: readonly string[], right: readonly string[]) =>
  left.length === right.length && left.every((address, index) => address === right[index]);

const generatePairingCode = () => String(randomInt(100_000, 1_000_000));

export const resolvePairingCode = (
  statePath: string,
  currentAddresses: readonly string[],
  generate = generatePairingCode
) => {
  const addresses = normalizeAddresses(currentAddresses);
  try {
    const stored = JSON.parse(readFileSync(statePath, 'utf8')) as unknown;
    if (isStoredPairingState(stored) && sameAddresses(normalizeAddresses(stored.addresses), addresses)) {
      return stored.pairingCode;
    }
  } catch {
    // A missing or invalid state file is replaced with a fresh pairing identity.
  }

  const pairingCode = generate();
  if (!/^\d{6}$/.test(pairingCode)) throw new Error('Pairing code generation must return six digits.');

  const state: StoredPairingState = {
    schemaVersion: 1,
    addresses,
    pairingCode
  };
  mkdirSync(dirname(statePath), { recursive: true });
  const temporaryPath = `${statePath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  renameSync(temporaryPath, statePath);
  return pairingCode;
};
