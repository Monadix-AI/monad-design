import { describe, expect, test } from 'bun:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { acquireCoreInstance } from '../src/single-instance';

describe('machine Core instance lock', () => {
  test('allows only one owner and releases the canonical lock', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'monad-design-core-lock-'));
    const lockPath = join(directory, 'core.lock');
    try {
      const first = await acquireCoreInstance(lockPath);
      expect(first.acquired).toBe(true);

      const second = await acquireCoreInstance(lockPath);
      expect(second).toEqual({ acquired: false, owner: process.pid });

      if (first.acquired) await first.release();
      const replacement = await acquireCoreInstance(lockPath);
      expect(replacement.acquired).toBe(true);
      if (replacement.acquired) await replacement.release();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
