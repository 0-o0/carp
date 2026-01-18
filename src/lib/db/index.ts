// 数据库操作封装 - 使用 Drizzle ORM
import 'server-only';
import { eq, like, or, sql, desc, and, gte, lte } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { CloudflareEnv } from '@/types/cloudflare';
import { getDb, type DrizzleDB } from './client';
import { admins, guests, settings, usageLogs, submissionLogs, auditLogs, type Guest, type Admin, type Setting, type UsageLog, type SubmissionLog, type AuditLog } from './schema';

// 重新导出类型
export type { Admin, Guest, Setting, UsageLog, SubmissionLog, AuditLog, DiscountType, GuestStatus } from './schema';
export { getDb } from './client';

// 当前请求的数据库实例（通过中间件设置）
let currentDb: DrizzleDB | null = null;
let currentDbPromise: Promise<DrizzleDB> | null = null;

/**
 * 设置当前请求的数据库实例
 */
export function setCurrentDb(db: DrizzleDB) {
  currentDb = db;
  currentDbPromise = Promise.resolve(db);
}

/**
 * 获取当前数据库实例
 */
export async function db(): Promise<DrizzleDB> {
  if (currentDb) return currentDb;
  if (currentDbPromise) return currentDbPromise;

  const env = tryGetCloudflareEnv();
  currentDbPromise = getDb(env?.DB);
  currentDb = await currentDbPromise;
  return currentDb;
}

// ==================== 环境变量获取 ====================

type StringEnvKey =
  | 'SUPER_ADMIN_USERNAME'
  | 'SUPER_ADMIN_PASSWORD'
  | 'DEFAULT_ADMIN_PASSWORD'
  | 'DEFAULT_USE_COUNT'
  | 'JWT_SECRET';

function tryGetCloudflareEnv(): CloudflareEnv | null {
  try {
    const context = getCloudflareContext();
    return (context?.env as CloudflareEnv) ?? null;
  } catch {
    return null;
  }
}

function readEnvValue(key: StringEnvKey, fallback: string): string {
  const cfEnv = tryGetCloudflareEnv();
  const cfValue = cfEnv?.[key];
  if (typeof cfValue === 'string' && cfValue.length > 0) {
    return cfValue;
  }

  const nodeValue = process.env[key];
  if (typeof nodeValue === 'string' && nodeValue.length > 0) {
    return nodeValue;
  }

  return fallback;
}

export function getEnv() {
  return {
    SUPER_ADMIN_USERNAME: readEnvValue('SUPER_ADMIN_USERNAME', 'admin'),
    SUPER_ADMIN_PASSWORD: readEnvValue('SUPER_ADMIN_PASSWORD', 'admin@2026'),
    DEFAULT_ADMIN_PASSWORD: readEnvValue('DEFAULT_ADMIN_PASSWORD', 'changeme@123456'),
    DEFAULT_USE_COUNT: readEnvValue('DEFAULT_USE_COUNT', '3'),
    JWT_SECRET: readEnvValue('JWT_SECRET', 'default-secret-change-in-production'),
  };
}

// ==================== 管理员操作 ====================

export async function getAdminByUsername(username: string): Promise<Admin | null> {
  const database = await db();
  const result = await database.select().from(admins).where(eq(admins.username, username)).limit(1);
  return result[0] || null;
}

export async function getAdminById(id: number): Promise<Admin | null> {
  const database = await db();
  const result = await database.select().from(admins).where(eq(admins.id, id)).limit(1);
  return result[0] || null;
}

export async function getAllAdmins(): Promise<Admin[]> {
  const database = await db();
  return database.select().from(admins).orderBy(desc(admins.createdAt));
}

export async function createAdmin(
  username: string,
  password: string,
  isSuperAdmin: boolean = false
): Promise<Admin | null> {
  const database = await db();
  const result = await database.insert(admins).values({
    username,
    password,
    isSuperAdmin,
  }).returning();
  return result[0] || null;
}

export async function updateAdminPassword(id: number, password: string): Promise<boolean> {
  const database = await db();
  await database.update(admins)
    .set({ password, updatedAt: sql`datetime('now', 'localtime')` })
    .where(eq(admins.id, id));
  return true;
}

export async function toggleAdminStatus(id: number): Promise<boolean> {
  const admin = await getAdminById(id);
  if (!admin || admin.isSuperAdmin) return false;

  const database = await db();
  await database.update(admins)
    .set({ 
      isActive: !admin.isActive, 
      updatedAt: sql`datetime('now', 'localtime')` 
    })
    .where(eq(admins.id, id));
  return true;
}

export async function deleteAdmin(id: number): Promise<boolean> {
  const admin = await getAdminById(id);
  if (!admin || admin.isSuperAdmin) return false;

  const database = await db();
  await database.delete(admins).where(eq(admins.id, id));
  return true;
}

// ==================== 住客操作 ====================

export async function getGuestById(id: number): Promise<Guest | null> {
  const database = await db();
  const result = await database.select().from(guests).where(eq(guests.id, id)).limit(1);
  return result[0] || null;
}

export async function getAllGuests(): Promise<Guest[]> {
  const database = await db();
  return database.select().from(guests).orderBy(desc(guests.createdAt));
}

export async function searchGuests(query: string): Promise<Guest[]> {
  const pattern = `%${query}%`;
  const database = await db();
  return database.select().from(guests).where(
    or(
      like(guests.name, pattern),
      like(guests.phone, pattern),
      like(guests.roomNumber, pattern),
      like(guests.plateNumber, pattern)
    )
  ).orderBy(desc(guests.createdAt));
}

export async function findGuestByInfo(
  name: string,
  phone: string,
  roomNumber: string
): Promise<Guest | null> {
  const database = await db();
  const result = await database.select().from(guests).where(
    sql`${guests.name} = ${name} AND ${guests.phone} = ${phone} AND ${guests.roomNumber} = ${roomNumber}`
  ).limit(1);
  return result[0] || null;
}

export interface CreateGuestData {
  name: string;
  phone: string;
  roomNumber: string;
  plateNumber?: string | null;
  useCount: number;
  checkInTime: string;
  checkOutTime: string;
  discountType: '24hour' | '5day';
  createdBy?: number | null;
}

export async function createGuest(data: CreateGuestData): Promise<Guest | null> {
  const database = await db();
  const result = await database.insert(guests).values({
    name: data.name,
    phone: data.phone,
    roomNumber: data.roomNumber,
    plateNumber: data.plateNumber,
    useCount: data.useCount,
    checkInTime: data.checkInTime,
    checkOutTime: data.checkOutTime,
    discountType: data.discountType,
    createdBy: data.createdBy,
  }).returning();
  return result[0] || null;
}

export interface UpdateGuestData {
  name?: string;
  phone?: string;
  roomNumber?: string;
  plateNumber?: string | null;
  useCount?: number;
  checkInTime?: string;
  checkOutTime?: string;
  discountType?: '24hour' | '5day';
  status?: 'active' | 'exhausted' | 'expired' | 'disabled';
}

export async function updateGuest(id: number, data: UpdateGuestData): Promise<boolean> {
  const database = await db();
  await database.update(guests)
    .set({
      ...data,
      updatedAt: sql`datetime('now', 'localtime')`,
    })
    .where(eq(guests.id, id));
  return true;
}

export async function decrementGuestUseCount(id: number): Promise<Guest | null> {
  const guest = await getGuestById(id);
  if (!guest) return null;

  const newUseCount = Math.max(0, guest.useCount - 1);
  const newStatus = newUseCount <= 0 ? 'exhausted' : guest.status;

  const database = await db();
  await database.update(guests)
    .set({
      useCount: newUseCount,
      status: newStatus,
      updatedAt: sql`datetime('now', 'localtime')`,
    })
    .where(eq(guests.id, id));

  return getGuestById(id);
}

export async function deleteGuest(id: number): Promise<boolean> {
  const database = await db();
  await database.delete(guests).where(eq(guests.id, id));
  return true;
}

// ==================== 设置操作 ====================

export async function getSetting(key: string): Promise<string | null> {
  const database = await db();
  const result = await database.select().from(settings).where(eq(settings.key, key)).limit(1);
  return result[0]?.value || null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  const database = await db();
  const result = await database.select().from(settings);
  const settingsMap: Record<string, string> = {};
  for (const row of result) {
    settingsMap[row.key] = row.value;
  }
  return settingsMap;
}

export async function updateSetting(key: string, value: string): Promise<boolean> {
  // 使用 upsert 模式
  const database = await db();
  const existing = await database.select().from(settings).where(eq(settings.key, key)).limit(1);
  
  if (existing.length > 0) {
    await database.update(settings)
      .set({ value, updatedAt: sql`datetime('now', 'localtime')` })
      .where(eq(settings.key, key));
  } else {
    await database.insert(settings).values({ key, value });
  }
  return true;
}

// ==================== 日志开关检查 ====================

/**
 * 检查日志是否启用
 */
export async function isLogEnabled(): Promise<boolean> {
  const value = await getSetting('log_enabled');
  return value === 'true';
}

// ==================== 使用记录操作 ====================

export interface CreateUsageLogData {
  guestId: number;
  plateNumber: string;
  requestSuccess: boolean;
  responseData?: string;
}

export async function createUsageLog(data: CreateUsageLogData): Promise<boolean> {
  // 检查日志开关
  const logEnabled = await isLogEnabled();
  if (!logEnabled) return false;

  const database = await db();
  await database.insert(usageLogs).values({
    guestId: data.guestId,
    plateNumber: data.plateNumber,
    requestSuccess: data.requestSuccess,
    responseData: data.responseData,
  });
  return true;
}

export async function getUsageLogsByGuestId(guestId: number): Promise<UsageLog[]> {
  const database = await db();
  return database.select().from(usageLogs)
    .where(eq(usageLogs.guestId, guestId))
    .orderBy(desc(usageLogs.createdAt));
}

// ==================== 提交日志操作 ====================

export interface CreateSubmissionLogData {
  guestId: number;
  discountType: '24hour' | '5day';
  plateUsed: string;
  requestOk: boolean;
  remoteResultKey?: string;
  remoteRawSnippet?: string;
}

export async function createSubmissionLog(data: CreateSubmissionLogData): Promise<boolean> {
  // 检查日志开关
  const logEnabled = await isLogEnabled();
  if (!logEnabled) return false;

  const database = await db();
  await database.insert(submissionLogs).values({
    guestId: data.guestId,
    discountType: data.discountType,
    plateUsed: data.plateUsed,
    requestOk: data.requestOk,
    remoteResultKey: data.remoteResultKey,
    remoteRawSnippet: data.remoteRawSnippet,
  });
  return true;
}

// ==================== 审计日志操作 ====================

export interface CreateAuditLogData {
  actorType: 'admin' | 'system' | 'guest';
  actorId: number;
  action: string;
  targetType: 'guest' | 'admin' | 'setting' | 'system';
  targetId?: number;
  detailJson?: string;
}

export async function createAuditLog(data: CreateAuditLogData): Promise<boolean> {
  // 检查日志开关
  const logEnabled = await isLogEnabled();
  if (!logEnabled) return false;

  const database = await db();
  await database.insert(auditLogs).values({
    actorType: data.actorType,
    actorId: data.actorId,
    action: data.action,
    targetType: data.targetType,
    targetId: data.targetId,
    detailJson: data.detailJson,
  });
  return true;
}

// ==================== 日志查询（带分页和筛选） ====================

export interface LogQueryParams {
  page?: number;
  pageSize?: number;
  startDate?: string;
  endDate?: string;
  guestId?: number;
  search?: string;
  success?: boolean;
}

export interface UsageLogWithGuest extends UsageLog {
  guestName: string | null;
  guestPhone: string | null;
  guestRoom: string | null;
}

export interface LogQueryResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * 获取使用日志（带分页、筛选和住客信息）
 * 性能优化：使用 JOIN 减少查询次数，支持索引的条件查询
 */
export async function getUsageLogs(params: LogQueryParams): Promise<LogQueryResult<UsageLogWithGuest>> {
  const database = await db();
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 100); // 限制最大100条
  const offset = (page - 1) * pageSize;

  // 构建条件
  const conditions = [];
  
  if (params.guestId) {
    conditions.push(eq(usageLogs.guestId, params.guestId));
  }
  
  if (params.startDate) {
    conditions.push(gte(usageLogs.createdAt, params.startDate));
  }
  
  if (params.endDate) {
    conditions.push(lte(usageLogs.createdAt, params.endDate + ' 23:59:59'));
  }
  
  if (params.success !== undefined) {
    conditions.push(eq(usageLogs.requestSuccess, params.success));
  }

  // 搜索条件（车牌号）
  if (params.search) {
    conditions.push(like(usageLogs.plateNumber, `%${params.search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 获取总数
  const countResult = await database.select().from(usageLogs).where(whereClause);
  const total = countResult.length;

  // 获取数据 - 先获取日志，再关联住客信息
  const logsData = await database
    .select()
    .from(usageLogs)
    .where(whereClause)
    .orderBy(desc(usageLogs.createdAt))
    .limit(pageSize)
    .offset(offset);

  // 获取相关住客信息
  const guestIds = [...new Set(logsData.map(log => log.guestId))];
  const guestsData = guestIds.length > 0 
    ? await database.select().from(guests).where(or(...guestIds.map(id => eq(guests.id, id))))
    : [];
  
  const guestMap = new Map(guestsData.map(g => [g.id, g]));

  // 组合数据
  const data: UsageLogWithGuest[] = logsData.map(log => ({
    ...log,
    guestName: guestMap.get(log.guestId)?.name ?? null,
    guestPhone: guestMap.get(log.guestId)?.phone ?? null,
    guestRoom: guestMap.get(log.guestId)?.roomNumber ?? null,
  }));

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取提交日志（带分页和筛选）
 */
export async function getSubmissionLogs(params: LogQueryParams): Promise<LogQueryResult<SubmissionLog & { guestName: string | null }>> {
  const database = await db();
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 100);
  const offset = (page - 1) * pageSize;

  const conditions = [];
  
  if (params.guestId) {
    conditions.push(eq(submissionLogs.guestId, params.guestId));
  }
  
  if (params.startDate) {
    conditions.push(gte(submissionLogs.createdAt, params.startDate));
  }
  
  if (params.endDate) {
    conditions.push(lte(submissionLogs.createdAt, params.endDate + ' 23:59:59'));
  }
  
  if (params.success !== undefined) {
    conditions.push(eq(submissionLogs.requestOk, params.success));
  }

  if (params.search) {
    conditions.push(like(submissionLogs.plateUsed, `%${params.search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 获取总数
  const countResult = await database.select().from(submissionLogs).where(whereClause);
  const total = countResult.length;

  // 获取数据
  const logsData = await database
    .select()
    .from(submissionLogs)
    .where(whereClause)
    .orderBy(desc(submissionLogs.createdAt))
    .limit(pageSize)
    .offset(offset);

  // 获取相关住客信息
  const guestIds = [...new Set(logsData.map(log => log.guestId))];
  const guestsData = guestIds.length > 0 
    ? await database.select().from(guests).where(or(...guestIds.map(id => eq(guests.id, id))))
    : [];
  
  const guestMap = new Map(guestsData.map(g => [g.id, g]));

  // 组合数据
  const data = logsData.map(log => ({
    ...log,
    guestName: guestMap.get(log.guestId)?.name ?? null,
  }));

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取审计日志（带分页和筛选）
 */
export async function getAuditLogs(params: LogQueryParams & { action?: string }): Promise<LogQueryResult<AuditLog>> {
  const database = await db();
  const page = params.page || 1;
  const pageSize = Math.min(params.pageSize || 20, 100);
  const offset = (page - 1) * pageSize;

  const conditions = [];
  
  if (params.startDate) {
    conditions.push(gte(auditLogs.createdAt, params.startDate));
  }
  
  if (params.endDate) {
    conditions.push(lte(auditLogs.createdAt, params.endDate + ' 23:59:59'));
  }

  if (params.action) {
    conditions.push(eq(auditLogs.action, params.action));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // 获取总数
  const countResult = await database.select().from(auditLogs).where(whereClause);
  const total = countResult.length;

  const data = await database
    .select()
    .from(auditLogs)
    .where(whereClause)
    .orderBy(desc(auditLogs.createdAt))
    .limit(pageSize)
    .offset(offset);

  return {
    data,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

/**
 * 获取日志统计信息（用于仪表盘）
 */
export async function getLogStats(days: number = 7): Promise<{
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  todayRequests: number;
}> {
  const database = await db();
  
  // 计算起始日期
  const now = new Date();
  const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
  const startDateStr = startDate.toISOString().split('T')[0];
  const todayStr = now.toISOString().split('T')[0];

  // 获取近 N 天的所有日志
  const allLogs = await database
    .select()
    .from(usageLogs)
    .where(gte(usageLogs.createdAt, startDateStr));
  
  // 统计
  const total = allLogs.length;
  const success = allLogs.filter(log => log.requestSuccess).length;
  const todayLogs = allLogs.filter(log => log.createdAt >= todayStr);

  return {
    totalRequests: total,
    successRequests: success,
    failedRequests: total - success,
    todayRequests: todayLogs.length,
  };
}

/**
 * 清理过期日志
 * @param retentionDays 保留天数
 * @returns 删除的记录数
 */
export async function cleanOldLogs(retentionDays: number): Promise<number> {
  const database = await db();
  
  // 计算截止日期
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
  const cutoffDateStr = cutoffDate.toISOString().split('T')[0];

  let totalDeleted = 0;

  // 删除过期的 usage_logs
  const oldUsageLogs = await database
    .select()
    .from(usageLogs)
    .where(lte(usageLogs.createdAt, cutoffDateStr));
  
  if (oldUsageLogs.length > 0) {
    await database.delete(usageLogs).where(lte(usageLogs.createdAt, cutoffDateStr));
    totalDeleted += oldUsageLogs.length;
  }

  // 删除过期的 submission_logs
  const oldSubmissionLogs = await database
    .select()
    .from(submissionLogs)
    .where(lte(submissionLogs.createdAt, cutoffDateStr));
  
  if (oldSubmissionLogs.length > 0) {
    await database.delete(submissionLogs).where(lte(submissionLogs.createdAt, cutoffDateStr));
    totalDeleted += oldSubmissionLogs.length;
  }

  // 删除过期的 audit_logs
  const oldAuditLogs = await database
    .select()
    .from(auditLogs)
    .where(lte(auditLogs.createdAt, cutoffDateStr));
  
  if (oldAuditLogs.length > 0) {
    await database.delete(auditLogs).where(lte(auditLogs.createdAt, cutoffDateStr));
    totalDeleted += oldAuditLogs.length;
  }

  return totalDeleted;
}

// ==================== 数据库初始化 ====================

export async function initializeSettings(): Promise<void> {
  const defaultSettings = [
    { key: 'url_24hour', value: '' },
    { key: 'url_5day', value: '' },
    { key: 'jsessionid_24hour', value: '' },
    { key: 'jsessionid_5day', value: '' },
    { key: 'referer_24hour', value: '' },
    { key: 'referer_5day', value: '' },
    { key: 'post_params_24hour', value: '' },
    { key: 'post_params_5day', value: '' },
    { key: 'default_use_count', value: '3' },
    { key: 'error_redirect_url', value: '' },
    // 日志设置
    { key: 'log_enabled', value: 'false' },
    { key: 'log_retention_days', value: '7' },
  ];

  for (const setting of defaultSettings) {
    const existing = await getSetting(setting.key);
    if (existing === null) {
      await updateSetting(setting.key, setting.value);
    }
  }
}
