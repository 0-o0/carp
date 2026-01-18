import { NextRequest } from 'next/server';
import { 
  findGuestByInfo, 
  decrementGuestUseCount, 
  createUsageLog,
  getSetting,
  updateGuest
} from '@/lib/db';
import { sendParkingDiscount } from '@/lib/parking-api';
import { validatePlateNumber } from '@/components/ui/PlateInput';
import { parseShanghaiDateTime } from '@/lib/datetime';
import { errorResponse, okResponse } from '@/lib/api-response';

interface SubmitRequestBody {
  name: string;
  phone: string;
  roomNumber: string;
  plateNumber?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SubmitRequestBody;
    const { name, phone, roomNumber, plateNumber } = body;

    // 基本验证
    if (!name || !phone || !roomNumber) {
      return errorResponse('VALIDATION_ERROR', '请填写完整信息', 400);
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return errorResponse('VALIDATION_ERROR', '手机号格式不正确', 400);
    }

    // 查找用户信息
    const guest = await findGuestByInfo(name.trim(), phone.trim(), roomNumber.trim());

    if (!guest) {
      return errorResponse('NOT_FOUND', '未找到您的登记信息，请联系前台工作人员', 404);
    }

    // 检查状态
    if (guest.status === 'disabled') {
      return errorResponse('FORBIDDEN', '您的优惠已被禁用，请联系前台工作人员', 403);
    }

    if (guest.status === 'exhausted' || guest.useCount <= 0) {
      return errorResponse('FORBIDDEN', '您的优惠次数已用完，请联系前台工作人员', 403);
    }

    // 检查是否超时
    const now = new Date();
    const checkOutTime = parseShanghaiDateTime(guest.checkOutTime);
    if (!checkOutTime) {
      console.error('Invalid check_out_time in DB:', guest.checkOutTime);
      return errorResponse('INTERNAL_ERROR', '系统数据异常，请联系前台工作人员', 500);
    }
    if (now > checkOutTime) {
      // 更新状态为已超时
      await updateGuest(guest.id, { status: 'expired' });
      return errorResponse('FORBIDDEN', '您的住宿时间已过期，请联系前台工作人员', 403);
    }

    // 确定使用的车牌号
    let finalPlateNumber = guest.plateNumber;

    // 如果管理员没有登记车牌，需要用户提供
    if (!finalPlateNumber) {
      if (!plateNumber) {
        return errorResponse('VALIDATION_ERROR', '请输入您的车牌号', 400, { requirePlate: true });
      }
      finalPlateNumber = plateNumber.toUpperCase();
    }

    // 如果用户提供了车牌号，使用用户提供的（覆盖管理员的）
    if (plateNumber) {
      finalPlateNumber = plateNumber.toUpperCase();
    }

    // 确保有车牌号
    if (!finalPlateNumber) {
      return errorResponse('VALIDATION_ERROR', '请输入您的车牌号', 400, { requirePlate: true });
    }

    // 验证车牌号格式
    if (!validatePlateNumber(finalPlateNumber)) {
      return errorResponse('VALIDATION_ERROR', '车牌号格式不正确', 400);
    }

    // 减少使用次数（不管请求成功与否都减少）
    await decrementGuestUseCount(guest.id);

    // 发送停车优惠请求
    const result = await sendParkingDiscount(finalPlateNumber, guest.discountType);

    // 记录使用日志
    await createUsageLog({
      guestId: guest.id,
      plateNumber: finalPlateNumber,
      requestSuccess: result.success,
      responseData: result.rawResponse,
    });

    if (result.success) {
      return okResponse();
    } else {
      // 请求失败，重定向到原优惠网页
      const urlKey = guest.discountType === '24hour' ? 'url_24hour' : 'url_5day';
      const redirectUrl = await getSetting(urlKey);

      if (redirectUrl) {
        return errorResponse('EXTERNAL_ERROR', '系统正在处理，请稍候...', 200, { redirectUrl });
      }

      const fallbackUrl = await getSetting('error_redirect_url');
      if (fallbackUrl) {
        return errorResponse('EXTERNAL_ERROR', '系统正在处理，请稍候...', 200, { redirectUrl: fallbackUrl });
      }

      return errorResponse('EXTERNAL_ERROR', '优惠申请暂时无法处理，请联系前台工作人员', 500);
    }
  } catch (error) {
    console.error('提交处理失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误，请稍后重试', 500);
  }
}
