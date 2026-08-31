import { describe, expect, test } from 'bun:test';

import { launchPreferredUi } from '../../src/ui-launcher';

describe('launchPreferredUi', () => {
  test('prefers the installed desktop app', async () => {
    const calls: string[][] = [];
    const result = await launchPreferredUi('http://127.0.0.1:41765/?accessToken=token', {
      open: async (arguments_) => {
        calls.push(arguments_);
      }
    });

    expect(result).toBe('desktop');
    expect(calls).toEqual([['-b', 'design.mona.client']]);
  });

  test('falls back to the browser when Desktop is unavailable', async () => {
    const calls: string[][] = [];
    const url = 'http://127.0.0.1:41765/?accessToken=token';
    const result = await launchPreferredUi(url, {
      open: async (arguments_) => {
        calls.push(arguments_);
        if (arguments_[0] === '-b') throw new Error('application not found');
      }
    });

    expect(result).toBe('browser');
    expect(calls).toEqual([['-b', 'design.mona.client'], [url]]);
  });

  test('does not reject when neither UI can be opened', async () => {
    const errors: string[] = [];
    const result = await launchPreferredUi('http://127.0.0.1:41765/?accessToken=token', {
      open: async () => {
        throw new Error('open failed');
      },
      reportError: (message) => errors.push(message)
    });

    expect(result).toBe('unavailable');
    expect(errors).toEqual(['Could not open the Monad Design desktop or browser UI.']);
  });
});
