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

  test('round-trips normalized fallback addresses for alternate Mac interfaces', () => {
    expect(
      parsePairingPayload(
        createPairingPayload({
          origin: 'http://172.24.162.86:41765',
          pairingCode: '123456',
          fallbackOrigins: ['http://198.18.0.1:41765/', 'http://169.254.146.167:41765', 'http://172.24.162.86:41765']
        })
      )
    ).toEqual({
      origin: 'http://172.24.162.86:41765',
      pairingCode: '123456',
      fallbackOrigins: ['http://198.18.0.1:41765', 'http://169.254.146.167:41765']
    });
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

  test('rejects invalid fallback origins', () => {
    expect(() =>
      createPairingPayload({
        origin: 'http://192.168.1.20:41765',
        pairingCode: '123456',
        fallbackOrigins: ['file:///tmp/core']
      })
    ).toThrow();
    expect(
      parsePairingPayload(
        'monaddesign://pair?v=1&origin=http%3A%2F%2F192.168.1.20%3A41765&fallback=file%3A%2F%2F%2Ftmp%2Fcore&code=123456'
      )
    ).toBeNull();
  });

  test('limits the number of fallback origins in generated and scanned payloads', () => {
    const fallbackOrigins = Array.from({ length: 9 }, (_, index) => `http://192.168.1.${index + 2}:41765`);
    expect(() =>
      createPairingPayload({
        origin: 'http://192.168.1.1:41765',
        pairingCode: '123456',
        fallbackOrigins
      })
    ).toThrow();
    const payload = new URL('monaddesign://pair?v=1&origin=http%3A%2F%2F192.168.1.1%3A41765&code=123456');
    for (const fallbackOrigin of fallbackOrigins) payload.searchParams.append('fallback', fallbackOrigin);
    expect(parsePairingPayload(payload.toString())).toBeNull();
  });
});
