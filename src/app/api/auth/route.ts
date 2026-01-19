import { NextRequest, NextResponse } from 'next/server';
import { getAdminByUsername, createAdmin, updateAdminPassword, getEnv } from '@/lib/db';
import { parseShanghaiDateTime } from '@/lib/datetime';
import { errorResponse, okResponse } from '@/lib/api-response';
import { 
  authenticateRequest, 
  generateToken, 
  hashPassword, 
  verifyPassword, 
  verifyToken,
  getAuthCookieOptions,
  isSecureRequest 
} from '@/lib/auth';

interface AuthRequestBody {
  action?: string;
  username?: string;
  password?: string;
  newPassword?: string;
}

interface CreateAdminBody {
  username: string;
  isSuperAdmin?: boolean;
}

// 验证当前登录状态
export async function GET(request: NextRequest) {
  try {
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return errorResponse('UNAUTHORIZED', '未登录', 401);
    }

    const payload = await verifyToken(token);
    
    if (!payload) {
      // Token 无效，清除 cookie
      const response = errorResponse('UNAUTHORIZED', '登录已过期', 401);
      response.cookies.delete('auth_token');
      return response;
    }

    return okResponse({
      user: {
        id: payload.id,
        username: payload.username,
        isSuperAdmin: payload.isSuperAdmin,
      },
    });
  } catch (error) {
    console.error('验证登录状态失败:', error);
    return errorResponse('INTERNAL_ERROR', '验证失败', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as AuthRequestBody;
    const { action, username, password, newPassword } = body;

    const env = await getEnv();

    if (action === 'login') {
      // 登录逻辑
      if (!username || !password) {
        return errorResponse('VALIDATION_ERROR', '请输入用户名和密码', 400);
      }

      // 检查是否是超级管理员
      if (username === env.SUPER_ADMIN_USERNAME) {
        if (password === env.SUPER_ADMIN_PASSWORD) {
          const token = await generateToken({
            id: 0,
            username: env.SUPER_ADMIN_USERNAME,
            isSuperAdmin: true,
          });

          const response = okResponse({
            user: {
              id: 0,
              username: env.SUPER_ADMIN_USERNAME,
              isSuperAdmin: true,
            },
          });

          // 设置 Cookie
          const cookieOptions = getAuthCookieOptions(isSecureRequest(request));
          response.cookies.set('auth_token', token, cookieOptions);

          return response;
        } else {
          return errorResponse('UNAUTHORIZED', '密码错误', 401);
        }
      }

      // 检查普通管理员
      const admin = await getAdminByUsername(username);
      if (!admin) {
        return errorResponse('UNAUTHORIZED', '用户不存在', 401);
      }

      if (!admin.isActive) {
        return errorResponse('FORBIDDEN', '账号已被禁用', 403);
      }

      // 验证密码
      const isValidPassword = await verifyPassword(password, admin.password);

      if (!isValidPassword) {
        return errorResponse('UNAUTHORIZED', '密码错误', 401);
      }

      // 检查是否需要修改默认密码
      const usesDefaultPassword = await verifyPassword(env.DEFAULT_ADMIN_PASSWORD, admin.password);
      const needChangePassword = admin.mustChangePassword || usesDefaultPassword;

      const response = okResponse({
        user: {
          id: admin.id,
          username: admin.username,
          isSuperAdmin: false,
        },
        needChangePassword,
      });

      if (!needChangePassword) {
        const token = await generateToken({
          id: admin.id,
          username: admin.username,
          isSuperAdmin: false,
        });
        const cookieOptions = getAuthCookieOptions(isSecureRequest(request));
        response.cookies.set('auth_token', token, cookieOptions);
      }

      return response;
    }

    if (action === 'changePassword') {
      // 修改密码逻辑
      if (!username || !password || !newPassword) {
        return errorResponse('VALIDATION_ERROR', '请填写完整信息', 400);
      }

      if (newPassword.length < 6) {
        return errorResponse('VALIDATION_ERROR', '新密码至少需要6位', 400);
      }

      const admin = await getAdminByUsername(username);
      if (!admin) {
        return errorResponse('NOT_FOUND', '用户不存在', 404);
      }

      // 验证旧密码
      const isValidPassword = await verifyPassword(password, admin.password);

      if (!isValidPassword) {
        return errorResponse('UNAUTHORIZED', '原密码错误', 401);
      }

      // 更新密码
      const hashedNewPassword = await hashPassword(newPassword);
      await updateAdminPassword(admin.id, hashedNewPassword);

      return okResponse({ message: '密码修改成功' });
    }

    if (action === 'logout') {
      const response = okResponse();
      response.cookies.delete('auth_token');
      return response;
    }

    return errorResponse('VALIDATION_ERROR', '未知操作', 400);
  } catch (error) {
    console.error('认证处理失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误，请稍后重试', 500);
  }
}

// 创建管理员（仅超级管理员可用）
export async function PUT(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', '未授权', 401);
    }

    // 仅超级管理员可新增管理员
    if (!user.isSuperAdmin) {
      return errorResponse('FORBIDDEN', '权限不足', 403);
    }

    const body = (await request.json()) as CreateAdminBody;
    const username = body.username?.trim();

    if (!username) {
      return errorResponse('VALIDATION_ERROR', '请输入用户名', 400);
    }

    // 检查用户名是否已存在
    const existingAdmin = await getAdminByUsername(username);
    if (existingAdmin) {
      return errorResponse('CONFLICT', '用户名已存在', 409);
    }

    // 使用默认密码创建管理员
    const env = await getEnv();
    const hashedPassword = await hashPassword(env.DEFAULT_ADMIN_PASSWORD);

    const admin = await createAdmin(username, hashedPassword, false);
    if (!admin) {
      return errorResponse('INTERNAL_ERROR', '创建失败', 500);
    }

    return okResponse({
      admin: {
        id: admin.id,
        username: admin.username,
        is_super_admin: admin.isSuperAdmin,
        is_active: admin.isActive,
        created_at: parseShanghaiDateTime(admin.createdAt)?.toISOString() || admin.createdAt,
      },
    });
  } catch (error) {
    console.error('创建管理员失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误，请稍后重试', 500);
  }
}
