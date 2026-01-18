import { NextResponse } from 'next/server';

export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'INTERNAL_ERROR'
  | 'CONFIG_ERROR'
  | 'EXTERNAL_ERROR';

export function okResponse<T extends Record<string, unknown>>(data?: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, ...(data || {}) }, init);
}

export function errorResponse(
  code: ApiErrorCode,
  message: string,
  status = 400,
  details?: Record<string, unknown>
) {
  return NextResponse.json(
    { success: false, code, message, ...(details || {}) },
    { status }
  );
}

