import { NextResponse } from 'next/server';

/**
 * API 错误码枚举
 */
export type ApiErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN' 
  | 'VALIDATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'   
  | 'INTERNAL_ERROR'
  | 'CONFIG_ERROR'   
  | 'EXTERNAL_ERROR'
  | 'NO_DISCOUNT';

/**
 * 错误码对应的默认消息
 */
export const ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  UNAUTHORIZED: '请先登录',
  FORBIDDEN: '权限不足',
  VALIDATION_ERROR: '参数验证失败',
  NOT_FOUND: '资源不存在',
  CONFLICT: '资源已存在',
  INTERNAL_ERROR: '系统错误，请稍后重试',
  CONFIG_ERROR: '系统配置错误',
  EXTERNAL_ERROR: '外部服务异常',
  NO_DISCOUNT: '您没有停车优惠资格',
};

/**
 * 成功响应
 */
export function okResponse<T extends Record<string, unknown>>(data?: T, init?: ResponseInit) {
  return NextResponse.json({ success: true, ...(data || {}) }, init);
}

/**
 * 错误响应
 * @param code 错误码
 * @param message 错误消息（可选，不传则使用默认消息）
 * @param status HTTP 状态码
 * @param details 额外详情（如 redirectUrl、requirePlate 等）
 */
export function errorResponse(
  code: ApiErrorCode,
  message?: string,
  status = 400,
  details?: Record<string, unknown>
) {
  const finalMessage = message || ERROR_MESSAGES[code];
  return NextResponse.json(
    { success: false, code, message: finalMessage, ...(details || {}) },
    { status }
  );
}

