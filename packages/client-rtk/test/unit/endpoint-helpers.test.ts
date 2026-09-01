import { describe, expect, test } from 'bun:test';

import { errorMessage, runTreaty, toError } from '../../src/endpoint-helpers';

describe('client RTK endpoint helpers', () => {
  test('maps the standardized Core error response', () => {
    expect(
      toError({
        status: 409,
        value: {
          error: 'The session state changed.',
          code: 'CONFLICT',
          retryable: false,
          requestId: 'req_example'
        }
      })
    ).toMatchObject({
      message: 'The session state changed.',
      status: 409,
      code: 'CONFLICT',
      retryable: false,
      requestId: 'req_example'
    });
  });

  test('serializes native transport errors before returning them to RTK Query', () => {
    expect(
      toError({
        status: 0,
        value: new Error('fetch failed: Could not connect to the server.')
      })
    ).toEqual({
      message: 'fetch failed: Could not connect to the server.',
      status: 0,
      raw: {
        name: 'Error',
        message: 'fetch failed: Could not connect to the server.'
      }
    });
  });

  test('maps successful treaty data', async () => {
    expect(
      await runTreaty(
        async () => ({ data: { value: 2 }, error: null }),
        (raw) => raw.value * 2
      )
    ).toEqual({ data: 4 });
  });

  test('uses one display-message fallback across clients', () => {
    expect(errorMessage({ message: 'Disconnected' })).toBe('Disconnected');
    expect(errorMessage(undefined, 'Unavailable')).toBe('Unavailable');
  });
});
