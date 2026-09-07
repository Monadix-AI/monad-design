import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { CoreErrorJournal, type CoreErrorRecord } from '../../src/server/error-journal';

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

const temporaryJournalPath = async () => {
  const directory = await mkdtemp(join(tmpdir(), 'monaddesign-error-journal-'));
  directories.push(directory);
  return join(directory, 'state', 'core-errors.jsonl');
};

const context = (requestId: string, error: unknown = new Error('database failed')) => ({
  requestId,
  status: 500,
  method: 'GET',
  pathname: '/v1/admin/projects/',
  frameworkCode: 'UNKNOWN',
  responseCode: 'INTERNAL',
  error
});

const recordsAt = async (path: string) =>
  (await readFile(path, 'utf8'))
    .trim()
    .split('\n')
    .map((line) => JSON.parse(line) as CoreErrorRecord);

describe('Core error journal', () => {
  test('persists structured errors privately and emits only correlation metadata to the system log', async () => {
    const path = await temporaryJournalPath();
    const systemMessages: string[] = [];
    const journal = new CoreErrorJournal(path, {
      now: () => new Date('2026-09-07T06:00:00.000Z'),
      systemLog: (message) => systemMessages.push(message)
    });
    const error = new Error('database failed', { cause: new Error('disk unavailable') });

    await journal.report(context('req_test', error));

    expect(await recordsAt(path)).toEqual([
      expect.objectContaining({
        schemaVersion: 1,
        timestamp: '2026-09-07T06:00:00.000Z',
        requestId: 'req_test',
        status: 500,
        method: 'GET',
        pathname: '/v1/admin/projects/',
        frameworkCode: 'UNKNOWN',
        responseCode: 'INTERNAL',
        error: expect.objectContaining({
          name: 'Error',
          message: 'database failed',
          cause: { name: 'Error', message: 'disk unavailable' }
        })
      })
    ]);
    expect((await stat(path)).mode & 0o777).toBe(0o600);
    expect(systemMessages).toEqual([
      '[ai.monadix.design.core:http] request_id=req_test status=500 method=GET response_code=INTERNAL framework_code=UNKNOWN error=Error'
    ]);
    expect(systemMessages[0]).not.toContain('database failed');
    expect(systemMessages[0]).not.toContain('/v1/admin/projects/');
  });

  test('serializes concurrent writes and rotates the bounded journal', async () => {
    const path = await temporaryJournalPath();
    const journal = new CoreErrorJournal(path, { maximumBytes: 450, systemLog: () => undefined });

    await Promise.all([
      journal.report(context('req_first', new Error('first failure'))),
      journal.report(context('req_second', new Error('second failure')))
    ]);

    const current = await recordsAt(path);
    const previous = await recordsAt(`${path}.previous`);
    expect([...previous, ...current].map(({ requestId }) => requestId)).toEqual(['req_first', 'req_second']);
  });

  test('records values thrown without an Error instance', async () => {
    const path = await temporaryJournalPath();
    const journal = new CoreErrorJournal(path, { systemLog: () => undefined });

    await journal.report(context('req_non_error', 'plain failure'));

    expect((await recordsAt(path))[0]?.error).toEqual({ name: 'NonErrorThrown', message: 'plain failure' });
  });

  test('keeps the private journal authoritative when the system log is unavailable', async () => {
    const path = await temporaryJournalPath();
    const journal = new CoreErrorJournal(path, {
      systemLog: () => {
        throw new Error('system log unavailable');
      }
    });

    await journal.report(context('req_file_only'));

    expect((await recordsAt(path))[0]?.requestId).toBe('req_file_only');
  });
});
