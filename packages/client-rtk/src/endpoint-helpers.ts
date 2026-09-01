import type { HttpError } from '@monaddesign/client-contract';
import type { CoreTreaty } from './treaty-client';

export interface ClientApiError {
  message: string;
  status?: number;
  code?: string;
  retryable?: boolean;
  requestId?: string;
  details?: Record<string, unknown>;
  raw?: unknown;
}

export interface ClientExtra {
  client: CoreTreaty;
}

export const clientOf = (api: { extra: unknown }): CoreTreaty => {
  const extra = api.extra as Partial<ClientExtra> | undefined;
  if (!extra?.client) {
    throw new Error('coreApi: configure the store with a Core Treaty client.');
  }
  return extra.client;
};

interface TreatyError {
  status?: number;
  value?: unknown;
}

const errorSnapshot = (value: Error) => ({
  name: value.name,
  message: value.message
});

export const errorMessage = (error: unknown, fallback = 'Something went wrong.') => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return fallback;
};

export const toError = (error: unknown): ClientApiError => {
  if (error && typeof error === 'object' && 'status' in error) {
    const treatyError = error as TreatyError;
    const value = treatyError.value;
    const body = value && typeof value === 'object' ? (value as Partial<HttpError>) : undefined;
    return {
      message:
        body?.error ??
        (value instanceof Error ? value.message : undefined) ??
        (treatyError.status ? `request failed (${treatyError.status})` : 'request failed'),
      ...(treatyError.status !== undefined ? { status: treatyError.status } : {}),
      ...(body?.code ? { code: body.code } : {}),
      ...(body?.retryable !== undefined ? { retryable: body.retryable } : {}),
      ...(body?.requestId ? { requestId: body.requestId } : {}),
      ...(body?.details ? { details: body.details } : {}),
      raw: value instanceof Error ? errorSnapshot(value) : value
    };
  }
  return {
    message: error instanceof Error ? error.message : String(error)
  };
};

export async function runTreaty<T>(
  call: () => Promise<{ data: T | null | undefined; error: unknown }>
): Promise<{ data: NonNullable<T> } | { error: ClientApiError }>;
export async function runTreaty<R, T>(
  call: () => Promise<{ data: R | null | undefined; error: unknown }>,
  map: (raw: NonNullable<R>) => T
): Promise<{ data: T } | { error: ClientApiError }>;
export async function runTreaty<R, T>(
  call: () => Promise<{ data: R | null | undefined; error: unknown }>,
  map?: (raw: NonNullable<R>) => T
): Promise<{ data: T } | { error: ClientApiError }> {
  try {
    const { data, error } = await call();
    if (error) return { error: toError(error) };
    if (data == null) return { error: { message: 'request returned no data' } };
    const raw = data as NonNullable<R>;
    return { data: (map ? map(raw) : raw) as T };
  } catch (error) {
    return { error: toError(error) };
  }
}
