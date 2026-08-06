export type AiliciaApiErrorCode =
  | 'invalid_input'
  | 'unauthorized'
  | 'content_too_long'
  | 'rate_limited'
  | 'request_failed';

export class AiliciaApiError extends Error {
  public readonly status?: number;
  public readonly code: AiliciaApiErrorCode;

  constructor(message: string, code: AiliciaApiErrorCode, status?: number) {
    super(message);
    this.name = 'AiliciaApiError';
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, AiliciaApiError.prototype);
  }
}

export const isAiliciaApiError = (error: unknown): error is AiliciaApiError =>
  error instanceof AiliciaApiError;
