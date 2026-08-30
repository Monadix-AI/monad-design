import type { HttpError } from './api-contract';

import { randomUUID } from 'node:crypto';

export class CoreApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryable = false,
    readonly details?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'CoreApiError';
  }
}

export const requestCorrelationId = () => `req_${randomUUID()}`;

export const projectHttpError = (error: unknown, requestId: string): { status: number; body: HttpError } => {
  const mapped = error instanceof CoreApiError ? error : new CoreApiError(500, 'INTERNAL', 'internal server error');
  return {
    status: mapped.status,
    body: {
      error: mapped.message,
      code: mapped.code,
      retryable: mapped.retryable,
      requestId,
      ...(mapped.details ? { details: mapped.details } : {})
    }
  };
};
