import { describe, expect, test } from 'bun:test';

import { prioritizeLocalAddresses } from '../../src/server/core-server';

describe('Core client address priority', () => {
  test('puts the default-route interface first', () => {
    expect(
      prioritizeLocalAddresses(
        [
          { address: '169.254.24.93', interfaceName: 'en11' },
          { address: '172.24.162.86', interfaceName: 'en0' },
          { address: '10.0.0.2', interfaceName: 'utun4' }
        ],
        'en0'
      )
    ).toEqual(['172.24.162.86', '10.0.0.2', '169.254.24.93']);
  });

  test('prefers private LAN addresses and leaves link-local addresses last without a default route', () => {
    expect(
      prioritizeLocalAddresses([
        { address: '169.254.24.93', interfaceName: 'en11' },
        { address: '198.18.0.1', interfaceName: 'utun4' },
        { address: '192.168.1.20', interfaceName: 'en0' }
      ])
    ).toEqual(['192.168.1.20', '198.18.0.1', '169.254.24.93']);
  });

  test('does not prefer a VPN default-route interface over the LAN', () => {
    expect(
      prioritizeLocalAddresses(
        [
          { address: '169.254.24.93', interfaceName: 'en11' },
          { address: '172.24.162.86', interfaceName: 'en0' },
          { address: '198.18.0.1', interfaceName: 'utun4' }
        ],
        'utun4'
      )
    ).toEqual(['172.24.162.86', '198.18.0.1', '169.254.24.93']);
  });

  test('prefers a physical network address over a private VPN address', () => {
    expect(
      prioritizeLocalAddresses([
        { address: '10.0.0.2', interfaceName: 'utun4' },
        { address: '172.24.162.86', interfaceName: 'en0' }
      ])
    ).toEqual(['172.24.162.86', '10.0.0.2']);
  });

  test('deduplicates addresses while retaining the preferred interface', () => {
    expect(
      prioritizeLocalAddresses(
        [
          { address: '10.0.0.8', interfaceName: 'utun2' },
          { address: '10.0.0.8', interfaceName: 'en0' },
          { address: '192.168.1.20', interfaceName: 'en1' }
        ],
        'en0'
      )
    ).toEqual(['10.0.0.8', '192.168.1.20']);
  });
});
