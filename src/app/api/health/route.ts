import { errorResponse, okResponse } from '@/lib/api-response';
import { getEnv, db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export async function GET() {
  const details: Record<string, unknown> = {
    ok: true,
    db: { ok: false },
    env: {},
    timestamp: new Date().toISOString(),
  };

  // 检查环境变量
  try {
    const env = getEnv();
    details.env = {
      hasJwtSecret: Boolean(env.JWT_SECRET && env.JWT_SECRET !== 'default-secret-change-in-production'),
      hasSuperAdminUsername: Boolean(env.SUPER_ADMIN_USERNAME),
      hasSuperAdminPassword: Boolean(env.SUPER_ADMIN_PASSWORD),
      hasDefaultAdminPassword: Boolean(env.DEFAULT_ADMIN_PASSWORD),
    };
  } catch (error) {
    details.ok = false;
    details.env = { ok: false, error: String(error) };
  }

  // 检查数据库连接
  try {
    const database = await db();
    await database.run(sql`SELECT 1`);
    details.db = { ok: true };
  } catch (error) {
    details.ok = false;
    details.db = { ok: false, error: String(error) };
  }

  if (details.ok) {
    return okResponse(details, { status: 200 });
  }

  return errorResponse('INTERNAL_ERROR', 'Health check failed', 500, details);
}
