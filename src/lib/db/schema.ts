import { sql } from 'drizzle-orm';
import { sqliteTable, text, integer, index } from 'drizzle-orm/sqlite-core';

// 管理员表
export const admins = sqliteTable('admins', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  password: text('password').notNull(),
  isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }).default(false).notNull(),
  isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
  mustChangePassword: integer('must_change_password', { mode: 'boolean' }).default(false).notNull(),
  createdAt: text('created_at').default(sql`(datetime('now', 'localtime'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now', 'localtime'))`).notNull(),
}, (table) => [
  index('idx_admins_username').on(table.username),
]);

// 住客表
export const guests = sqliteTable('guests', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  phone: text('phone').notNull(),
  roomNumber: text('room_number').notNull(),
  plateNumber: text('plate_number'),
  useCount: integer('use_count').default(3).notNull(),
  usesDefaultSnapshot: integer('uses_default_snapshot').default(3).notNull(),
  checkInTime: text('check_in_time').notNull(),
  checkOutTime: text('check_out_time').notNull(),
  discountType: text('discount_type', { enum: ['24hour', '5day'] }).notNull(),
  status: text('status', { enum: ['active', 'exhausted', 'expired', 'disabled'] }).default('active').notNull(),
  createdBy: integer('created_by').references(() => admins.id),
  createdAt: text('created_at').default(sql`(datetime('now', 'localtime'))`).notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now', 'localtime'))`).notNull(),
}, (table) => [
  index('idx_guests_phone').on(table.phone),
  index('idx_guests_room').on(table.roomNumber),
  index('idx_guests_plate').on(table.plateNumber),
  index('idx_guests_status').on(table.status),
  index('idx_guests_lookup').on(table.name, table.phone, table.roomNumber),
]);

// 系统设置表
export const settings = sqliteTable('settings', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  key: text('key').notNull().unique(),
  value: text('value').notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now', 'localtime'))`).notNull(),
});

// 优惠配置表
export const discountConfigs = sqliteTable('discount_configs', {
  type: text('type', { enum: ['24hour', '5day'] }).primaryKey(),
  scanUrl: text('scan_url').notNull(),
  redirectUrl: text('redirect_url').notNull(),
  jsessionid: text('jsessionid').notNull(),
  idParam: text('id_param').notNull(),
  businessidParam: text('businessid_param').notNull(),
  parkidParam: text('parkid_param').notNull(),
  totalcountParam: text('totalcount_param').notNull(),
  adposidParam: text('adposid_param').notNull(),
  updatedAt: text('updated_at').default(sql`(datetime('now', 'localtime'))`).notNull(),
});

// 使用记录表
export const usageLogs = sqliteTable('usage_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guestId: integer('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  plateNumber: text('plate_number').notNull(),
  requestSuccess: integer('request_success', { mode: 'boolean' }).default(false).notNull(),
  responseData: text('response_data'),
  createdAt: text('created_at').default(sql`(datetime('now', 'localtime'))`).notNull(),
}, (table) => [
  index('idx_usage_logs_created').on(table.createdAt),
  index('idx_usage_logs_guest').on(table.guestId),
]);

// 提交日志
export const submissionLogs = sqliteTable('submission_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  guestId: integer('guest_id').notNull().references(() => guests.id, { onDelete: 'cascade' }),
  discountType: text('discount_type', { enum: ['24hour', '5day'] }).notNull(),
  plateUsed: text('plate_used').notNull(),
  requestOk: integer('request_ok', { mode: 'boolean' }).default(false).notNull(),
  remoteResultKey: text('remote_result_key'),
  remoteRawSnippet: text('remote_raw_snippet'),
  createdAt: text('created_at').default(sql`(datetime('now', 'localtime'))`).notNull(),
}, (table) => [
  index('idx_submission_logs_created').on(table.createdAt),
]);

// 审计日志
export const auditLogs = sqliteTable('audit_logs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  actorType: text('actor_type').notNull(),
  actorId: integer('actor_id').notNull(),
  action: text('action').notNull(),
  targetType: text('target_type').notNull(),
  targetId: integer('target_id'),
  detailJson: text('detail_json'),
  createdAt: text('created_at').default(sql`(datetime('now', 'localtime'))`).notNull(),
}, (table) => [
  index('idx_audit_logs_created').on(table.createdAt),
]);

// 类型导出
export type Admin = typeof admins.$inferSelect;
export type NewAdmin = typeof admins.$inferInsert;
export type Guest = typeof guests.$inferSelect;
export type NewGuest = typeof guests.$inferInsert;
export type Setting = typeof settings.$inferSelect;
export type DiscountConfig = typeof discountConfigs.$inferSelect;
export type NewDiscountConfig = typeof discountConfigs.$inferInsert;
export type UsageLog = typeof usageLogs.$inferSelect;
export type SubmissionLog = typeof submissionLogs.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;

// 优惠类型和状态
export type DiscountType = '24hour' | '5day';
export type GuestStatus = 'active' | 'exhausted' | 'expired' | 'disabled';
