// 上海时区偏移量（UTC+8）
const SHANGHAI_OFFSET_MS = 8 * 60 * 60 * 1000;

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function getShanghaiPartsFromEpochMs(epochMs: number) {
  const shifted = new Date(epochMs + SHANGHAI_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds(),
  };
}

/**
 * 格式化日期为上海时区字符串
 * @returns "YYYY-MM-DD HH:mm:ss"
 */
export function formatShanghaiDateTime(date: Date): string {
  const p = getShanghaiPartsFromEpochMs(date.getTime());
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
}

/**
 * 格式化日期为 HTML datetime-local 输入格式
 * @returns "YYYY-MM-DDTHH:mm:ss" 或 "YYYY-MM-DDTHH:mm"
 */
export function formatShanghaiDateTimeLocalInput(date: Date, options?: { withSeconds?: boolean }): string {
  const withSeconds = options?.withSeconds ?? true;
  const p = getShanghaiPartsFromEpochMs(date.getTime());
  const base = `${p.year}-${pad2(p.month)}-${pad2(p.day)}T${pad2(p.hour)}:${pad2(p.minute)}`;
  return withSeconds ? `${base}:${pad2(p.second)}` : base;
}

/**
 * 解析上海时区日期字符串或 ISO 格式
 * @param value "YYYY-MM-DD HH:mm:ss" 或 "YYYY-MM-DDTHH:mm:ss" 或 ISO 格式
 */
export function parseShanghaiDateTime(value: string): Date | null {
  if (!value) return null;
  
  const trimmed = value.trim();
  
  // 先尝试 ISO 格式（如 2026-01-19T08:00:00.000Z）
  if (trimmed.includes('Z') || trimmed.match(/[+-]\d{2}:\d{2}$/)) {
    try {
      const date = new Date(trimmed);
      return isNaN(date.getTime()) ? null : date;
    } catch {
      return null;
    }
  }
  
  // 尝试本地格式
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = match[6] ? Number(match[6]) : 0;

  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    !Number.isFinite(hour) ||
    !Number.isFinite(minute) ||
    !Number.isFinite(second)
  ) {
    return null;
  }

  // 从上海时间转换为 UTC
  const utcMs = Date.UTC(year, month - 1, day, hour - 8, minute, second);
  return new Date(utcMs);
}

/**
 * 计算默认离店时间（上海时区）
 * 规则：入住时间 + 25 小时，如果小于 17:00 则设为 17:00
 */
export function calculateDefaultCheckOutTimeShanghai(checkInTime: Date): Date {
  const checkOutMs = checkInTime.getTime() + 25 * 60 * 60 * 1000;
  const p = getShanghaiPartsFromEpochMs(checkOutMs);

  // 如果小于17:00，则设置为17:00（以上海时间为准）
  if (p.hour < 17) {
    const utcMs = Date.UTC(p.year, p.month - 1, p.day, 17 - 8, 0, 0);
    return new Date(utcMs);
  }

  return new Date(checkOutMs);
}

/**
 * 获取当前上海时间
 */
export function getNowShanghai(): Date {
  return new Date();
}

/**
 * 格式化日期为数据库存储格式（上海时区）
 * @returns "YYYY-MM-DD HH:mm:ss"
 */
export function formatShanghaiDateTimeForDB(date: Date): string {
  return formatShanghaiDateTime(date);
}

/**
 * 将 ISO 字符串转换为 Date 对象
 */
export function parseISODateTime(value: string): Date | null {
  try {
    const date = new Date(value);
    return isNaN(date.getTime()) ? null : date;
  } catch {
    return null;
  }
}
