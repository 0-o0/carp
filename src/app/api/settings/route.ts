import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { getAllSettings, updateSetting } from '@/lib/db';
import { updateDiscountUrl } from '@/lib/parking-api';
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
      return errorResponse('UNAUTHORIZED', '未授权', 401);
    }

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

    // 如果是更新优惠URL，需要重新获取jsessionid
    if (key === 'url_24hour' || key === 'url_5day') {
      const discountType = key === 'url_24hour' ? '24hour' : '5day';
      const result = await updateDiscountUrl(discountType, value);

      if (!result.success) {
        return errorResponse('CONFIG_ERROR', result.message || 'URL 解析失败', 400);
      }

      return okResponse({
        jsessionid: result.jsessionid,
        message: 'URL 和 Session ID 已更新',
      });
    }

    // 普通设置更新
    const success = await updateSetting(key, value);

    if (!success) {
      return errorResponse('INTERNAL_ERROR', '更新失败', 500);
    }

    return okResponse();
  } catch (error) {
    console.error('更新设置失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误', 500);
  }
}
