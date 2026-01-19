import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import type { drizzle as drizzleSqlite } from 'drizzle-orm/better-sqlite3';
import * as schema from './schema';


type SqliteDrizzle = ReturnType<typeof drizzleSqlite<typeof schema>>;
type D1Drizzle = ReturnType<typeof drizzleD1<typeof schema>>;
export type DrizzleDB = SqliteDrizzle | D1Drizzle;


const globalForDb = globalThis as unknown as {
  db: DrizzleDB | undefined;
};

/**
 * 获取本地 SQLite 数据库实例（用于本地开发）
 */
export async function getLocalDb(): Promise<DrizzleDB> {
  if (globalForDb.db) {
    return globalForDb.db;
  }

  const { drizzle: drizzleSqlite } = await import('drizzle-orm/better-sqlite3');
  const sqliteModule = await import('better-sqlite3');
  const Database: any = (sqliteModule as any)?.default ?? sqliteModule;
  if (typeof Database !== 'function') {
    throw new Error('better-sqlite3 is not available in this runtime');
  }
  const dbPath = process.env.DATABASE_URL?.replace('file:', '') || './dev.db';
  const sqlite = new Database(dbPath);
  
  // 启用 WAL 模式以提高性能
  sqlite.pragma('journal_mode = WAL');
  
  const db = drizzleSqlite(sqlite, { schema });
  
  if (process.env.NODE_ENV !== 'production') {
    globalForDb.db = db;
  }
  
  return db;
}

/**
 * 获取 Cloudflare D1 数据库实例
 * @param d1 Cloudflare D1 绑定
 */
export function getD1Db(d1: D1Database): DrizzleDB {
  return drizzleD1(d1, { schema });
}

/**
 * 自动选择数据库
 * - 在 Cloudflare 环境中使用 D1
 * - 在本地环境中使用 SQLite
 */
export async function getDb(d1?: D1Database): Promise<DrizzleDB> {
  if (d1) {
    return getD1Db(d1);
  }
  return getLocalDb();
}

export { schema };
