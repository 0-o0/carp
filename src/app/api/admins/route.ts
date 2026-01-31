import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { 
  getAllAdmins, 
  getAdminById, 
  toggleAdminStatus, 
  deleteAdmin 
} from '@/lib/db';
import { parseShanghaiDateTime } from '@/lib/datetime';
import { errorResponse, okResponse } from '@/lib/api-response';

interface AdminActionBody {
  id: number;
  action: 'toggle' | 'delete';
}

export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', '未授权', 401);
    }

    if (!user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', '权限不足', 403);
    }

    const admins = await getAllAdmins();
    

    const safeAdmins = admins.map(admin => {
      const createdDate = parseShanghaiDateTime(admin.createdAt);
      const updatedDate = parseShanghaiDateTime(admin.updatedAt);
      return {
        id: admin.id,
        username: admin.username,
        is_super_admin: admin.isSuperAdmin ? 1 : 0,
        is_active: admin.isActive ? 1 : 0,
        created_at: createdDate?.toISOString() || admin.createdAt,
        updated_at: updatedDate?.toISOString() || admin.updatedAt,
      };
    });

    return okResponse({ admins: safeAdmins });
  } catch (error) {
    console.error('获取管理员列表失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误', 500);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', '未授权', 401);
    }

    if (!user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', '权限不足', 403);
    }

    const body = await request.json() as AdminActionBody;
    const { id, action } = body;

    if (!id || !action) {
      return errorResponse('VALIDATION_ERROR', '参数错误', 400);
    }

    const admin = await getAdminById(id);
    if (!admin) {
      return errorResponse('NOT_FOUND', '管理员不存在', 404);
    }

    if (admin.isSuperAdmin) {
      return errorResponse('FORBIDDEN', '不能操作超级管理员', 403);
    }

    if (action === 'toggle') {
      await toggleAdminStatus(id);
      return okResponse();
    }

    if (action === 'delete') {
      await deleteAdmin(id);
      return okResponse();
    }

    return errorResponse('VALIDATION_ERROR', '未知操作', 400);
  } catch (error) {
    console.error('管理员操作失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误', 500);
  }
}
