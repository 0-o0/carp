import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { 
  findGuestByInfo, 
  getGuestById,
  decrementGuestUseCount, 
  createUsageLog,
  createSubmissionLog,
  getSetting,
  updateGuest,
  getDiscountTypeByCode
} from '@/lib/db';
import { sendParkingDiscount } from '@/lib/parking-api';
import { validatePlateNumber } from '@/lib/validation';
import { parseShanghaiDateTime } from '@/lib/datetime';
import { errorResponse, okResponse } from '@/lib/api-response';

interface SubmitRequestBody {
  guestId?: number;
  name?: string;
  phone?: string;
  plateNumber?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as SubmitRequestBody;
    const { guestId, name, phone, plateNumber } = body;

    const hasGuestId = typeof guestId === 'number' && Number.isFinite(guestId);

    // 基本验证 - 至少需要 (guestId) 或 (姓名/手机号) 或 (车牌号)
    const hasNameOrPhone = name?.trim() || phone?.trim();
    const hasPlate = plateNumber?.trim();

    if (!hasGuestId && !hasNameOrPhone && !hasPlate) {
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

    // 查找用户信息：guestId(管理员辅助提交) 或 姓名/手机号/车牌(住客提交)
    let guest = null as Awaited<ReturnType<typeof getGuestById>>;
    let reason: 'not_found' | 'multiple_matches' | undefined;

    if (hasGuestId) {
      const user = await authenticateRequest(request);
      if (!user) {
        return errorResponse('UNAUTHORIZED', '未授权', 401);
      }
      guest = await getGuestById(guestId!);
      if (!guest) {
        return errorResponse('NOT_FOUND', '未找到住客记录', 404);
      }
    } else {
      const found = await findGuestByInfo(name?.trim(), phone?.trim(), plateNumber?.trim());
      guest = found.guest;
      reason = found.reason;
    }

    if (!guest) {
      // 根据原因返回不同的错误提示
      if (reason === 'multiple_matches') {
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

    // 检查优惠类型 - 无折扣用户（空字符串或 'none'）需要去付费页面
    if (!guest.discountType || guest.discountType === 'none') {
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

    const discountTypeRecord = await getDiscountTypeByCode(guest.discountType);
    if (!discountTypeRecord) {
      return errorResponse('CONFIG_ERROR', 'Discount type configuration missing.', 400);
    }
    const hasCustomRequest = Boolean(discountTypeRecord.requestTemplate && discountTypeRecord.requestTemplate.trim());
    if (!hasCustomRequest && !discountTypeRecord.jsessionid && !discountTypeRecord.scanUrl) {
      return errorResponse('CONFIG_ERROR', 'Discount type missing session, scan URL, or custom request template.', 400);
    }

    // 发送停车优惠请求
    const result = await sendParkingDiscount(finalPlateNumber, guest.discountType, {
      note: guest.notes || null,
      name: guest.name,
      phone: guest.phone,
    });
    const updatedGuest = result.success ? await decrementGuestUseCount(guest.id) : null;

    await Promise.allSettled([
      createUsageLog({
        guestId: guest.id,
        plateNumber: finalPlateNumber,
        requestSuccess: result.success,
        responseData: result.rawResponse,
      }),
      createSubmissionLog({
        guestId: guest.id,
        discountType: guest.discountType,
        plateUsed: finalPlateNumber,
        requestOk: result.success,
        remoteRawSnippet: result.rawResponse?.substring(0, 500), // 限制长度
      }),
    ]);

    if (result.success) {
      const useCount = typeof updatedGuest?.useCount === 'number' ? updatedGuest.useCount : Math.max(0, guest.useCount - 1);
      const status = typeof updatedGuest?.status === 'string' ? updatedGuest.status : (useCount <= 0 ? 'exhausted' : guest.status);

      return okResponse({
        message: '提交成功',
        guestId: guest.id,
        useCount,
        status,
        remoteResponse: result.rawResponse,
      });
    } else {
      // 从优惠类型表中获取扫描URL作为重定向
      const redirectUrl = result.redirectUrl || discountTypeRecord?.scanUrl;

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
