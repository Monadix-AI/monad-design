import { spawn } from 'node:child_process';
import { appendFile, chmod, mkdir, rename, rm, stat } from 'node:fs/promises';
import { dirname } from 'node:path';

const defaultMaximumBytes = 1024 * 1024;
const maximumFieldLength = 16 * 1024;
const systemLogTag = 'ai.monadix.design.core';

export interface CoreErrorContext {
  requestId: string;
  status: number;
  method: string;
  pathname: string;
  frameworkCode: string;
  responseCode: string;
  error: unknown;
}

export type CoreErrorReporter = (context: CoreErrorContext) => void | Promise<void>;

interface SerializedError {
  name: string;
  message: string;
  stack?: string;
  systemCode?: string;
  cause?: { name: string; message: string };
}

export interface CoreErrorRecord {
  schemaVersion: 1;
  timestamp: string;
  requestId: string;
  status: number;
  method: string;
  pathname: string;
  frameworkCode: string;
  responseCode: string;
  error: SerializedError;
}

interface CoreErrorJournalOptions {
  maximumBytes?: number;
  now?: () => Date;
  systemLog?: (message: string) => void;
}

const truncate = (value: string) =>
  value.length <= maximumFieldLength ? value : `${value.slice(0, maximumFieldLength)}... [truncated]`;

const serializeCause = (cause: unknown): SerializedError['cause'] | undefined => {
  if (cause instanceof Error) return { name: cause.name, message: truncate(cause.message) };
  if (cause === undefined) return undefined;
  return { name: 'NonErrorCause', message: truncate(String(cause)) };
};

const serializeError = (error: unknown): SerializedError => {
  if (!(error instanceof Error)) return { name: 'NonErrorThrown', message: truncate(String(error)) };
  const systemCode = (error as NodeJS.ErrnoException).code;
  return {
    name: error.name,
    message: truncate(error.message),
    ...(error.stack ? { stack: truncate(error.stack) } : {}),
    ...(typeof systemCode === 'string' ? { systemCode } : {}),
    ...(error.cause !== undefined ? { cause: serializeCause(error.cause) } : {})
  };
};

const writeMacOsSystemLog = (message: string) => {
  if (process.platform !== 'darwin') return;
  const child = spawn('/usr/bin/logger', ['-p', 'user.err', '-t', systemLogTag, message], {
    stdio: 'ignore'
  });
  child.once('error', () => undefined);
  child.unref();
};

export class CoreErrorJournal {
  readonly #maximumBytes: number;
  readonly #now: () => Date;
  readonly #systemLog: (message: string) => void;
  #pendingWrite: Promise<void> = Promise.resolve();

  constructor(
    readonly path: string,
    options: CoreErrorJournalOptions = {}
  ) {
    this.#maximumBytes = options.maximumBytes ?? defaultMaximumBytes;
    this.#now = options.now ?? (() => new Date());
    this.#systemLog = options.systemLog ?? writeMacOsSystemLog;
  }

  readonly report: CoreErrorReporter = async (context) => {
    const record: CoreErrorRecord = {
      schemaVersion: 1,
      timestamp: this.#now().toISOString(),
      requestId: context.requestId,
      status: context.status,
      method: context.method,
      pathname: context.pathname,
      frameworkCode: context.frameworkCode,
      responseCode: context.responseCode,
      error: serializeError(context.error)
    };
    const line = `${JSON.stringify(record)}\n`;
    const write = this.#pendingWrite.then(() => this.#append(line));
    this.#pendingWrite = write.catch(() => undefined);

    // Keep dynamic error details and paths in the private JSONL journal. The
    // system log contains only stable correlation metadata.
    try {
      this.#systemLog(
        `[${systemLogTag}:http] request_id=${record.requestId} status=${record.status} method=${record.method} response_code=${record.responseCode} framework_code=${record.frameworkCode} error=${record.error.name}`
      );
    } catch {
      // The private journal remains authoritative when macOS logging is unavailable.
    }
    await write;
  };

  async #append(line: string) {
    await mkdir(dirname(this.path), { recursive: true });
    const currentSize = await stat(this.path)
      .then(({ size }) => size)
      .catch(() => 0);
    if (currentSize > 0 && currentSize + Buffer.byteLength(line) > this.#maximumBytes) {
      const previousPath = `${this.path}.previous`;
      await rm(previousPath, { force: true });
      await rename(this.path, previousPath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') throw error;
      });
    }
    await appendFile(this.path, line, { encoding: 'utf8', mode: 0o600 });
    await chmod(this.path, 0o600);
  }
}
