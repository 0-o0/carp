import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getUsageLogs, getSubmissionLogs, getAuditLogs, getLogStats, cleanOldLogs, type LogQueryParams } from '@/lib/db';
import { errorResponse } from '@/lib/api-response';

export const runtime = 'nodejs';

/**
 * GET /api/logs - 获取日志列表
 * 
 * Query params:
 * - type: 'usage' | 'submission' | 'audit' (默认 'usage')
 * - page: 页码 (默认 1)
 * - pageSize: 每页条数 (默认 20, 最大 100)
 * - startDate: 开始日期 (YYYY-MM-DD)
 * - endDate: 结束日期 (YYYY-MM-DD)
 * - guestId: 住客ID
 * - search: 搜索关键词（车牌号）
 * - success: 是否成功 ('true' | 'false')
 * - stats: 如果为 'true'，返回统计数据
 */
export async function GET(request: NextRequest) {
  try {
    // 验证管理员权限
    const auth = await authenticateRequest(request);
    if (!auth) {
      return errorResponse('UNAUTHORIZED', '请先登录', 401);
    }

    const { searchParams } = new URL(request.url);
    
    // 如果请求统计数据
    if (searchParams.get('stats') === 'true') {
      const days = parseInt(searchParams.get('days') || '7', 10);
      const stats = await getLogStats(days);
      return Response.json({ success: true, stats });
    }

    const type = searchParams.get('type') || 'usage';
    
    // 解析查询参数
    const params: LogQueryParams = {
      page: parseInt(searchParams.get('page') || '1', 10),
      pageSize: parseInt(searchParams.get('pageSize') || '20', 10),
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      guestId: searchParams.get('guestId') ? parseInt(searchParams.get('guestId')!, 10) : undefined,
      search: searchParams.get('search') || undefined,
      success: searchParams.get('success') === 'true' ? true : 
               searchParams.get('success') === 'false' ? false : undefined,
    };

    // 根据类型获取不同的日志
    let result;
    switch (type) {
      case 'submission':
        result = await getSubmissionLogs(params);
        break;
      case 'audit':
        const action = searchParams.get('action') || undefined;
        result = await getAuditLogs({ ...params, action });
        break;
      case 'usage':
      default:
        result = await getUsageLogs(params);
        break;
    }

    return Response.json({
      success: true,
      type,
      ...result,
    });
  } catch (error) {
    console.error('获取日志失败:', error);
    return errorResponse('INTERNAL_ERROR', '获取日志失败', 500);
  }
}

/**
 * DELETE /api/logs - 清理过期日志
 * 
 * Body:
 * - retentionDays: 保留天数（清理该天数之前的日志）
 */
export async function DELETE(request: NextRequest) {
  try {
    // 验证管理员权限
    const auth = await authenticateRequest(request);
    if (!auth) {
      return errorResponse('UNAUTHORIZED', '请先登录', 401);
    }

    const body = await request.json() as { retentionDays?: number };
    const retentionDays = body.retentionDays || 7;

    // 清理日志
    const deleted = await cleanOldLogs(retentionDays);

    return Response.json({
      success: true,
      deleted,
      message: `已清理 ${deleted} 条过期日志`,
    });
  } catch (error) {
    console.error('清理日志失败:', error);
    return errorResponse('INTERNAL_ERROR', '清理日志失败', 500);
  }
}
