import { describe, expect, test } from 'bun:test';

import { createPairingPayload, parsePairingPayload } from '../../src';

describe('pairing QR payload', () => {
  test('round-trips a LAN client connection', () => {
    const connection = {
      origin: 'http://192.168.1.20:41765',
      pairingCode: '482901'
    };
    expect(parsePairingPayload(createPairingPayload(connection))).toEqual(connection);
  });

  test('normalizes a trailing slash', () => {
    expect(
      parsePairingPayload(
        createPairingPayload({
          origin: 'http://10.0.0.8:41765/',
          pairingCode: '123456'
        })
      )
    ).toEqual({ origin: 'http://10.0.0.8:41765', pairingCode: '123456' });
  });

  test('rejects unrelated and malformed codes', () => {
    expect(parsePairingPayload('https://example.com')).toBeNull();
    expect(parsePairingPayload('monaddesign://pair?v=1&origin=http%3A%2F%2F192.168.1.20%3A41765&code=123')).toBeNull();
  });

  test('rejects credentials embedded in an origin', () => {
    expect(() =>
      createPairingPayload({
        origin: 'http://user:password@192.168.1.20:41765',
        pairingCode: '123456'
      })
    ).toThrow();
  });
});
