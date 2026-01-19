import { NextRequest } from 'next/server';
import { 
  findGuestByInfo, 
  decrementGuestUseCount, 
  createUsageLog,
  createSubmissionLog,
  getSetting,
  updateGuest
} from '@/lib/db';
import { sendParkingDiscount } from '@/lib/parking-api';
import { validatePlateNumber } from '@/lib/validation';
import { parseShanghaiDateTime } from '@/lib/datetime';
import { errorResponse, okResponse } from '@/lib/api-response';

interface SubmitRequestBody {
  name?: string;
  phone?: string;
  plateNumber?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SubmitRequestBody;
    const { name, phone, plateNumber } = body;

    // 基本验证 - 至少需要 (姓名或手机号) 或 车牌号
    const hasNameOrPhone = name?.trim() || phone?.trim();
    const hasPlate = plateNumber?.trim();

    if (!hasNameOrPhone && !hasPlate) {
      return errorResponse('VALIDATION_ERROR', '请填写姓名/手机号，或填写车牌号', 400);
    }

    // 验证手机号格式（如果提供了）
    if (phone && !/^1[3-9]\d{9}$/.test(phone)) {
      return errorResponse('VALIDATION_ERROR', '手机号格式不正确', 400);
    }

    // 验证车牌号格式（如果提供了）
    if (plateNumber && !validatePlateNumber(plateNumber)) {
      return errorResponse('VALIDATION_ERROR', '车牌号格式不正确', 400);
    }

    // 查找用户信息 - 新匹配逻辑
    const { guest, matchedBy, reason } = await findGuestByInfo(
      name?.trim(),
      phone?.trim(),
      plateNumber?.trim()
    );

    if (!guest) {
      // 根据原因返回不同的错误提示
      if (reason === 'multiple_matches') {
        // 存在多个匹配，建议用户提供更多信息
        return errorResponse('VALIDATION_ERROR', '存在多条相似记录，请同时填写姓名和手机号，或直接填写车牌号', 400);
      }
      return errorResponse('NOT_FOUND', '未找到您的登记信息，请联系前台工作人员', 404);
    }

    // 检查状态
    if (guest.status === 'disabled') {
      return errorResponse('FORBIDDEN', '您的优惠已被禁用，请联系前台工作人员', 403);
    }

    if (guest.status === 'exhausted' || guest.useCount <= 0) {
      return errorResponse('FORBIDDEN', '您的优惠次数已用完，请联系前台工作人员', 403);
    }

    // 检查优惠类型 - 无折扣用户需要去付费页面
    if (guest.discountType === 'none') {
      const payUrl = await getSetting('pay_url');
      if (payUrl) {
        return errorResponse('NO_DISCOUNT', '您没有停车优惠，请前往付费页面', 200, { redirectUrl: payUrl });
      }
      return errorResponse('NO_DISCOUNT', '您没有停车优惠，请联系前台工作人员', 403);
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
    const normalizedInputPlate = plateNumber?.trim().toUpperCase();
    const normalizedStoredPlate = guest.plateNumber?.toUpperCase();

    // 如果用户提供了车牌号，需要校验是否与后台记录一致
    if (normalizedInputPlate && normalizedStoredPlate && normalizedInputPlate !== normalizedStoredPlate) {
      return errorResponse('VALIDATION_ERROR', '车牌不匹配', 400);
    }

    // 确定最终使用的车牌号
    let finalPlateNumber: string | null = null;
    if (normalizedInputPlate) {
      // 用户提供了车牌号，使用用户提供的
      finalPlateNumber = normalizedInputPlate;
    } else if (normalizedStoredPlate) {
      // 用户没有提供，使用后台记录的
      finalPlateNumber = normalizedStoredPlate;
    } else {
      // 都没有，要求用户填写
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

    // 并行写入两种日志（性能优化，使用 allSettled 避免一个失败影响另一个）
    await Promise.allSettled([
      // 使用记录日志
      createUsageLog({
        guestId: guest.id,
        plateNumber: finalPlateNumber,
        requestSuccess: result.success,
        responseData: result.rawResponse,
      }),
      // 提交详情日志（含远程结果）
      createSubmissionLog({
        guestId: guest.id,
        discountType: guest.discountType,
        plateUsed: finalPlateNumber,
        requestOk: result.success,
        remoteResultKey: result.resultKey,
        remoteRawSnippet: result.rawResponse?.substring(0, 500), // 限制长度
      }),
    ]);

    if (result.success) {
      return okResponse();
    } else {
      // 请求失败，重定向到原优惠网页
      const urlKey = guest.discountType === '24hour' ? 'url_24hour' : 'url_5day';
      const redirectUrl = await getSetting(urlKey);

      if (redirectUrl) {
        return errorResponse('EXTERNAL_ERROR', '系统正在处理，请稍候...', 200, { 
          redirectUrl,
          remoteResponse: result.rawResponse,
        });
      }

      const fallbackUrl = await getSetting('error_redirect_url');
      if (fallbackUrl) {
        return errorResponse('EXTERNAL_ERROR', '系统正在处理，请稍候...', 200, { 
          redirectUrl: fallbackUrl,
          remoteResponse: result.rawResponse,
        });
      }

      return errorResponse('EXTERNAL_ERROR', '优惠申请暂时无法处理，请联系前台工作人员', 500, {
        remoteResponse: result.rawResponse,
      });
    }
  } catch (error) {
    console.error('提交处理失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误，请稍后重试', 500);
  }
}
