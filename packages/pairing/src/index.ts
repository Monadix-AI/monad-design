export interface PairingConnection {
  origin: string;
  pairingCode: string;
}

const pairingProtocol = 'monaddesign:';
const pairingHost = 'pair';
const pairingVersion = '1';

const normalizeOrigin = (value: string) => value.replace(/\/+$/, '');

const validOrigin = (value: string) => {
  try {
    const url = new URL(value);
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      Boolean(url.hostname) &&
      !url.username &&
      !url.password &&
      url.pathname === '/' &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
};

export const createPairingPayload = ({ origin, pairingCode }: PairingConnection) => {
  const normalizedOrigin = normalizeOrigin(origin.trim());
  const normalizedCode = pairingCode.trim();
  if (!validOrigin(normalizedOrigin)) {
    throw new Error('A valid HTTP client origin is required.');
  }
  if (!/^\d{6}$/.test(normalizedCode)) {
    throw new Error('A six-digit pairing code is required.');
  }
  const payload = new URL(`${pairingProtocol}//${pairingHost}`);
  payload.searchParams.set('v', pairingVersion);
  payload.searchParams.set('origin', normalizedOrigin);
  payload.searchParams.set('code', normalizedCode);
  return payload.toString();
};

export const parsePairingPayload = (value: string): PairingConnection | null => {
  try {
    const payload = new URL(value.trim());
    if (
      payload.protocol !== pairingProtocol ||
      payload.hostname !== pairingHost ||
      payload.searchParams.get('v') !== pairingVersion
    ) {
      return null;
    }
    const origin = normalizeOrigin(payload.searchParams.get('origin')?.trim() ?? '');
    const pairingCode = payload.searchParams.get('code')?.trim() ?? '';
    if (!validOrigin(origin) || !/^\d{6}$/.test(pairingCode)) return null;
    return { origin, pairingCode };
  } catch {
    return null;
  }
};
