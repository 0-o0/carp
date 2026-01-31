// 数据库操作封装 - 使用 Drizzle ORM
import 'server-only';
import { eq, like, or, sql, desc, and, gte, lte, asc } from 'drizzle-orm';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { CloudflareEnv } from '@/types/cloudflare';
import { getDb, type DrizzleDB } from './client';
import { admins, guests, settings, usageLogs, submissionLogs, auditLogs, discountTypes, type Guest, type Admin, type Setting, type UsageLog, type SubmissionLog, type AuditLog, type DiscountTypeRecord } from './schema';

// 重新导出类型
export type { Admin, Guest, Setting, UsageLog, SubmissionLog, AuditLog, GuestStatus, DiscountTypeRecord } from './schema';
export { getDb } from './client';

// 当前请求的数据库实例（通过中间件设置）
let currentDb: DrizzleDB | null = null;
let currentDbPromise: Promise<DrizzleDB> | null = null;

function isProbablyWorkerdRuntime(): boolean {
  return (
    typeof (globalThis as any).WebSocketPair === 'function' &&
    typeof (globalThis as any).caches !== 'undefined'
  );
}

function tryGetCloudflareD1(): D1Database | null {
  try {
    const context = getCloudflareContext();
    const env = (context?.env as CloudflareEnv) ?? null;
    return env?.DB ?? env?.carp ?? null;
  } catch {
    return null;
  }
}

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

  const d1 = tryGetCloudflareD1();
  if (d1) {
    currentDbPromise = getDb(d1);
    currentDb = await currentDbPromise;
    return currentDb;
  }

  if (isProbablyWorkerdRuntime()) {
    throw new Error(
      'Cloudflare D1 binding is missing. Ensure your deployment binds a D1 database as \"DB\" (or \"carp\") in wrangler.toml.'
    );
  }

  currentDbPromise = getDb();
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
    SUPER_ADMIN_USERNAME: readEnvValue('SUPER_ADMIN_USERNAME', 'test'),
    SUPER_ADMIN_PASSWORD: readEnvValue('SUPER_ADMIN_PASSWORD', 'test@2026'),
    DEFAULT_ADMIN_PASSWORD: readEnvValue('DEFAULT_ADMIN_PASSWORD', 'changeme@123456'),
    DEFAULT_USE_COUNT: readEnvValue('DEFAULT_USE_COUNT', '5'),
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
    mustChangePassword: !isSuperAdmin,
  }).returning();
  return result[0] || null;
}

export async function updateAdminPassword(id: number, password: string): Promise<boolean> {
  const database = await db();
  await database.update(admins)
    .set({
      password,
      mustChangePassword: false,
      updatedAt: sql`datetime('now', 'localtime')`,
    })
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
      like(guests.notes, pattern),
      like(guests.plateNumber, pattern)
    )
  ).orderBy(desc(guests.createdAt));
}


export interface FindGuestResult {
  guest: Guest | null;
  matchedBy: 'plate' | 'name_phone' | 'phone' | 'name' | null;
  reason?: 'not_found' | 'multiple_matches';
}

export async function findGuestByInfo(
  name?: string,
  phone?: string,
  plateNumber?: string
): Promise<FindGuestResult> {
  const database = await db();
  
  // 1. 优先通过车牌号匹配（如果提供了车牌号）
  if (plateNumber) {
    const result = await database.select().from(guests).where(
      eq(guests.plateNumber, plateNumber.toUpperCase())
    ).limit(1);
    if (result[0]) {
      return { guest: result[0], matchedBy: 'plate' };
    }
  }
  
  // 2. 通过姓名+手机号同时匹配（最精确）
  if (name && phone) {
    const result = await database.select().from(guests).where(
      and(
        eq(guests.name, name.trim()),
        eq(guests.phone, phone.trim())
      )
    ).limit(1);
    if (result[0]) {
      return { guest: result[0], matchedBy: 'name_phone' };
    }
  }
  
  // 3. 仅通过手机号匹配
  if (phone) {
    const result = await database.select().from(guests).where(
      eq(guests.phone, phone.trim())
    ).limit(2);
    if (result.length === 1) {
      return { guest: result[0], matchedBy: 'phone' };
    }
    // 存在多个匹配，需要更多信息
    if (result.length > 1) {
      return { guest: null, matchedBy: null, reason: 'multiple_matches' };
    }
  }
  
  // 4. 仅通过姓名匹配
  if (name) {
    const results = await database.select().from(guests).where(
      eq(guests.name, name.trim())
    );
    if (results.length === 1) {
      return { guest: results[0], matchedBy: 'name' };
    }
    // 存在多个匹配，需要更多信息
    if (results.length > 1) {
      return { guest: null, matchedBy: null, reason: 'multiple_matches' };
    }
  }
  
  return { guest: null, matchedBy: null, reason: 'not_found' };
}

export interface CreateGuestData {
  name: string;
  phone: string;
  notes?: string | null;
  plateNumber?: string | null;
  useCount: number;
  checkInTime: string;
  checkOutTime: string;
  discountType: string;  // 动态优惠类型
  createdBy?: number | null;
}

export async function createGuest(data: CreateGuestData): Promise<Guest | null> {
  const database = await db();
  const result = await database.insert(guests).values({
    name: data.name,
    phone: data.phone,
    notes: data.notes,
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
  notes?: string | null;
  plateNumber?: string | null;
  useCount?: number;
  checkInTime?: string;
  checkOutTime?: string;
  discountType?: string;  // 动态优惠类型
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
  const database = await db();
  const result = await database.run(sql`
    UPDATE guests
    SET
      use_count = use_count - 1,
      status = CASE
        WHEN use_count - 1 <= 0 THEN 'exhausted'
        ELSE status
      END,
      updated_at = datetime('now', 'localtime')
    WHERE id = ${id} AND use_count > 0
  `);

  const changes = (result as any)?.changes ?? (result as any)?.meta?.changes;
  if (!changes) return null;

  return getGuestById(id);
}

export async function deleteGuest(id: number): Promise<boolean> {
  const database = await db();
  await database.delete(guests).where(eq(guests.id, id));
  return true;
}

// ==================== 设置操作 ====================

let settingsInitDone = false;
let settingsInitPromise: Promise<void> | null = null;

async function ensureSettingsInitialized(): Promise<void> {
  if (settingsInitDone) return;
  if (settingsInitPromise) return settingsInitPromise;

  settingsInitPromise = (async () => {
    const envDefaultUseCount = getEnv().DEFAULT_USE_COUNT || '3';
    const database = await db();
    let tableExists = true;
    try {
      await database.select().from(settings).limit(1);
    } catch (error) {
      const message = String((error as any)?.message || error);
      if (message.includes('no such table') || message.toLowerCase().includes('does not exist')) {
        tableExists = false;
      } else {
        throw error;
      }
    }

    if (!tableExists) {
      await database.run(sql`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          key TEXT UNIQUE NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL
        );
      `);
    }

    await database.run(sql`
      INSERT OR IGNORE INTO settings (key, value, updated_at) VALUES
        ('url_24hour', '', datetime('now', 'localtime')),
        ('url_5day', '', datetime('now', 'localtime')),
        ('jsessionid_24hour', '', datetime('now', 'localtime')),
        ('jsessionid_5day', '', datetime('now', 'localtime')),
        ('referer_24hour', '', datetime('now', 'localtime')),
        ('referer_5day', '', datetime('now', 'localtime')),
        ('post_params_24hour', '', datetime('now', 'localtime')),
        ('post_params_5day', '', datetime('now', 'localtime')),
        ('default_use_count', ${envDefaultUseCount}, datetime('now', 'localtime')),
        ('error_redirect_url', '', datetime('now', 'localtime')),
        ('log_enabled', 'false', datetime('now', 'localtime')),
        ('log_retention_days', '7', datetime('now', 'localtime')),
        ('pay_url', '', datetime('now', 'localtime')),
        ('welcome_url', '', datetime('now', 'localtime'))
    `);

    const existingDefault = await database
      .select()
      .from(settings)
      .where(eq(settings.key, 'default_use_count'))
      .limit(1);
    const currentValue = existingDefault[0]?.value ?? '';
    if ((currentValue === '' || currentValue === '3') && envDefaultUseCount && envDefaultUseCount !== currentValue) {
      await database.run(sql`
        UPDATE settings
        SET value = ${envDefaultUseCount}, updated_at = datetime('now', 'localtime')
        WHERE key = 'default_use_count'
      `);
    }
  })();

  try {
    await settingsInitPromise;
    settingsInitDone = true;
  } finally {
    settingsInitPromise = null;
  }
}

export async function getSetting(key: string): Promise<string | null> {
  await ensureSettingsInitialized();
  const database = await db();
  const result = await database.select().from(settings).where(eq(settings.key, key)).limit(1);
  return result[0]?.value || null;
}

export async function getAllSettings(): Promise<Record<string, string>> {
  await ensureSettingsInitialized();
  const database = await db();
  const result = await database.select().from(settings);
  const settingsMap: Record<string, string> = {};
  for (const row of result) {
    settingsMap[row.key] = row.value;
  }
  return settingsMap;
}

export async function updateSetting(key: string, value: string): Promise<boolean> {
  await ensureSettingsInitialized();
  // 使用 upsert 模式
  const database = await db();
  await database.run(sql`
    INSERT INTO settings (key, value, updated_at)
    VALUES (${key}, ${value}, datetime('now', 'localtime'))
    ON CONFLICT(key) DO UPDATE SET
      value = excluded.value,
      updated_at = datetime('now', 'localtime')
  `);
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
  discountType: string;  // 动态优惠类型
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
    guestRoom: guestMap.get(log.guestId)?.notes ?? null,
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

// ==================== 优惠类型操作 ====================

let discountTypesInitDone = false;
let discountTypesInitPromise: Promise<void> | null = null;

async function ensureDiscountTypesInitialized(): Promise<void> {
  if (discountTypesInitDone) return;
  if (discountTypesInitPromise) return discountTypesInitPromise;

  discountTypesInitPromise = (async () => {
    await ensureSettingsInitialized();
    const database = await db();

    // 检测表是否存在：尝试读取一行即可（不存在会抛错）
    let tableExists = true;
    try {
      await database.select().from(discountTypes).limit(1);
    } catch (error) {
      const message = String((error as any)?.message || error);
      if (message.includes('no such table') || message.toLowerCase().includes('does not exist')) {
        tableExists = false;
      } else {
        throw error;
      }
    }

    if (!tableExists) {
      // 创建 discount_types 表（用于历史数据库兼容：旧dev.db/旧D1未包含该表）
      await database.run(sql`
        CREATE TABLE IF NOT EXISTS discount_types (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          color TEXT DEFAULT 'orange' NOT NULL,
          sort_order INTEGER DEFAULT 0 NOT NULL,
          is_active INTEGER DEFAULT 1 NOT NULL,
          is_system INTEGER DEFAULT 0 NOT NULL,
          use_custom_request INTEGER DEFAULT 0 NOT NULL,
          scan_url TEXT,
          jsessionid TEXT,
          referer_url TEXT,
          post_params TEXT,
          request_template TEXT,
          response_template TEXT,
          created_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL,
          updated_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL
        );
      `);
      await database.run(sql`CREATE INDEX IF NOT EXISTS idx_discount_types_code ON discount_types(code);`);
      await database.run(sql`CREATE INDEX IF NOT EXISTS idx_discount_types_active ON discount_types(is_active);`);
    }


    // Ensure new columns exist (for older databases)
    try {
      await database.run(sql`ALTER TABLE discount_types ADD COLUMN request_template TEXT`);
    } catch (error) {
      const message = String((error as any)?.message || error);
      if (!message.includes('duplicate column') && !message.includes('already exists')) {
        throw error;
      }
    }
    try {
      await database.run(sql`ALTER TABLE discount_types ADD COLUMN response_template TEXT`);
    } catch (error) {
      const message = String((error as any)?.message || error);
      if (!message.includes('duplicate column') && !message.includes('already exists')) {
        throw error;
      }
    }
    try {
      await database.run(sql`ALTER TABLE discount_types ADD COLUMN use_custom_request INTEGER DEFAULT 0 NOT NULL`);
    } catch (error) {
      const message = String((error as any)?.message || error);
      if (!message.includes('duplicate column') && !message.includes('already exists')) {
        throw error;
      }
    }

    // Insert default discount types (idempotent)
    await database.run(sql`
      INSERT OR IGNORE INTO discount_types (code, name, description, color, sort_order, is_system, is_active)
      VALUES
        ('24hour', '24小时优惠', '短期停车优惠，适用于1天内离店', 'orange', 1, 1, 1),
        ('5day', '5天优惠', '长期停车优惠，适用于多日住宿', 'purple', 2, 1, 1)
    `);

    // 兼容旧版本：从 settings 迁移 24hour/5day 的扫码URL与会话信息（仅在新表字段为空时补齐）
    const allSettings = await database.select().from(settings);
    const settingsMap: Record<string, string> = {};
    for (const row of allSettings) settingsMap[row.key] = row.value;

    const legacy24 = {
      scanUrl: settingsMap['url_24hour'] || null,
      jsessionid: settingsMap['jsessionid_24hour'] || null,
      refererUrl: settingsMap['referer_24hour'] || null,
      postParams: settingsMap['post_params_24hour'] || null,
    };
    const legacy5 = {
      scanUrl: settingsMap['url_5day'] || null,
      jsessionid: settingsMap['jsessionid_5day'] || null,
      refererUrl: settingsMap['referer_5day'] || null,
      postParams: settingsMap['post_params_5day'] || null,
    };

    await database.run(sql`
      UPDATE discount_types
      SET
        scan_url = CASE WHEN scan_url IS NULL OR scan_url = '' THEN ${legacy24.scanUrl} ELSE scan_url END,
        jsessionid = CASE WHEN jsessionid IS NULL OR jsessionid = '' THEN ${legacy24.jsessionid} ELSE jsessionid END,
        referer_url = CASE WHEN referer_url IS NULL OR referer_url = '' THEN ${legacy24.refererUrl} ELSE referer_url END,
        post_params = CASE WHEN post_params IS NULL OR post_params = '' THEN ${legacy24.postParams} ELSE post_params END,
        updated_at = datetime('now', 'localtime')
      WHERE code = '24hour';
    `);

    await database.run(sql`
      UPDATE discount_types
      SET
        scan_url = CASE WHEN scan_url IS NULL OR scan_url = '' THEN ${legacy5.scanUrl} ELSE scan_url END,
        jsessionid = CASE WHEN jsessionid IS NULL OR jsessionid = '' THEN ${legacy5.jsessionid} ELSE jsessionid END,
        referer_url = CASE WHEN referer_url IS NULL OR referer_url = '' THEN ${legacy5.refererUrl} ELSE referer_url END,
        post_params = CASE WHEN post_params IS NULL OR post_params = '' THEN ${legacy5.postParams} ELSE post_params END,
        updated_at = datetime('now', 'localtime')
      WHERE code = '5day';
    `);

    const defaultActiveType = await database
      .select()
      .from(discountTypes)
      .where(eq(discountTypes.isActive, true))
      .orderBy(asc(discountTypes.sortOrder))
      .limit(1);
    const fallbackCode = defaultActiveType[0]?.code || '24hour';

    await database.run(sql`
      UPDATE guests
      SET
        discount_type = ${fallbackCode},
        updated_at = datetime('now', 'localtime')
      WHERE
        discount_type = ''
        OR discount_type = 'none'
        OR discount_type NOT IN (SELECT code FROM discount_types);
    `);
  })();

  try {
    await discountTypesInitPromise;
    discountTypesInitDone = true;
  } finally {
    discountTypesInitPromise = null;
  }
}

/**
 * 获取所有优惠类型
 */
export async function getAllDiscountTypes(): Promise<DiscountTypeRecord[]> {
  await ensureDiscountTypesInitialized();
  const database = await db();
  return database.select().from(discountTypes).orderBy(asc(discountTypes.sortOrder));
}

/**
 * 获取所有启用的优惠类型
 */
export async function getActiveDiscountTypes(): Promise<DiscountTypeRecord[]> {
  await ensureDiscountTypesInitialized();
  const database = await db();
  return database.select().from(discountTypes)
    .where(eq(discountTypes.isActive, true))
    .orderBy(asc(discountTypes.sortOrder));
}

/**
 * 通过code获取优惠类型
 */
export async function getDiscountTypeByCode(code: string): Promise<DiscountTypeRecord | null> {
  await ensureDiscountTypesInitialized();
  const database = await db();
  const result = await database.select().from(discountTypes)
    .where(eq(discountTypes.code, code))
    .limit(1);
  return result[0] || null;
}

/**
 * 通过ID获取优惠类型
 */
export async function getDiscountTypeById(id: number): Promise<DiscountTypeRecord | null> {
  await ensureDiscountTypesInitialized();
  const database = await db();
  const result = await database.select().from(discountTypes)
    .where(eq(discountTypes.id, id))
    .limit(1);
  return result[0] || null;
}

export interface CreateDiscountTypeData {
  code: string;
  name: string;
  description?: string;
  color?: string;
  sortOrder?: number;
  useCustomRequest?: boolean;
  requestTemplate?: string | null;
  responseTemplate?: string | null;
}

/**
 * 创建新的优惠类型
 */
export async function createDiscountType(data: CreateDiscountTypeData): Promise<DiscountTypeRecord | null> {
  await ensureDiscountTypesInitialized();
  const database = await db();
  const result = await database.insert(discountTypes).values({
    code: data.code,
    name: data.name,
    description: data.description,
    color: data.color || 'orange',
    sortOrder: data.sortOrder || 0,
    isSystem: false,
    useCustomRequest: Boolean(data.useCustomRequest),
    requestTemplate: typeof data.requestTemplate === 'string' ? data.requestTemplate : null,
    responseTemplate: typeof data.responseTemplate === 'string' ? data.responseTemplate : null,
  }).returning();
  return result[0] || null;
}

export interface UpdateDiscountTypeData {
  name?: string;
  description?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
  scanUrl?: string;
  jsessionid?: string;
  refererUrl?: string;
  postParams?: string;
  useCustomRequest?: boolean;
  requestTemplate?: string | null;
  responseTemplate?: string | null;
}

/**
 * 更新优惠类型
 */
export async function updateDiscountType(id: number, data: UpdateDiscountTypeData): Promise<boolean> {
  await ensureDiscountTypesInitialized();
  const database = await db();
  await database.update(discountTypes)
    .set({
      ...data,
      updatedAt: sql`datetime('now', 'localtime')`,
    })
    .where(eq(discountTypes.id, id));
  return true;
}

/**
 * 更新优惠类型（通过code）
 */
export async function updateDiscountTypeByCode(code: string, data: UpdateDiscountTypeData): Promise<boolean> {
  await ensureDiscountTypesInitialized();
  const database = await db();
  await database.update(discountTypes)
    .set({
      ...data,
      updatedAt: sql`datetime('now', 'localtime')`,
    })
    .where(eq(discountTypes.code, code));
  return true;
}

/**
 * 删除优惠类型（不能删除系统内置类型）
 */
export async function deleteDiscountType(id: number): Promise<{ success: boolean; message?: string }> {
  await ensureDiscountTypesInitialized();
  const discountType = await getDiscountTypeById(id);
  if (!discountType) {
    return { success: false, message: '优惠类型不存在' };
  }
  if (discountType.isSystem) {
    return { success: false, message: '不能删除系统内置优惠类型' };
  }
  
  const database = await db();
  await database.delete(discountTypes).where(eq(discountTypes.id, id));
  return { success: true };
}

// ==================== 数据库初始化 ====================

export async function initializeSettings(): Promise<void> {
  const envDefaultUseCount = getEnv().DEFAULT_USE_COUNT || '5';
  const defaultSettings = [
    { key: 'default_use_count', value: envDefaultUseCount },
    { key: 'error_redirect_url', value: '' },
    { key: 'pay_url', value: '' },
    { key: 'welcome_url', value: '' },
    { key: 'log_enabled', value: 'false' },
    { key: 'log_retention_days', value: '7' },
  ];

  for (const setting of defaultSettings) {
    const existing = await getSetting(setting.key);
    if (existing === null) {
      await updateSetting(setting.key, setting.value);
    }
  }
  
  // 初始化默认优惠类型
  const defaultDiscountTypes = [
    { code: '24hour', name: '24小时优惠', description: '短期停车优惠，适用于1天内离店', color: 'orange', sortOrder: 1, isSystem: true },
    { code: '5day', name: '5天优惠', description: '长期停车优惠，适用于多日住宿', color: 'purple', sortOrder: 2, isSystem: true }
  ];
  
  for (const dt of defaultDiscountTypes) {
    const existing = await getDiscountTypeByCode(dt.code);
    if (!existing) {
      const database = await db();
      await database.insert(discountTypes).values(dt);
    }
  }
}
