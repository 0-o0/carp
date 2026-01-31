import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getAllSettings, getSetting, updateSetting } from '@/lib/db';
import { errorResponse, okResponse } from '@/lib/api-response';

interface SettingUpdateBody {
  key: string;
  value: string;
}

// 获取所有设置
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      const payUrl = await getSetting('pay_url');
      const welcomUrl = await getSetting('welcome_url');
      return okResponse({
        settings: {
          pay_url: payUrl || '',
          welcome_url: welcomUrl || '',
        },
      });
    }

    // 已登录管理员返回所有设置
    const settings = await getAllSettings();
    return okResponse({ settings });
  } catch (error) {
    console.error('获取设置失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误', 500);
  }
}

// 更新设置
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', '未授权', 401);
    }

    const body = await request.json() as SettingUpdateBody;
    const { key, value } = body;

    if (!key) {
      return errorResponse('VALIDATION_ERROR', '缺少设置项', 400);
    }

    // 普通设置更新
    const success = await updateSetting(key, value);

    if (!success) {
      return errorResponse('INTERNAL_ERROR', '更新失败', 500);
    }

    return okResponse({ message: '设置已更新' });
  } catch (error) {
    console.error('更新设置失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误', 500);
  }
}
