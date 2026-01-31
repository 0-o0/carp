import { NextRequest } from 'next/server';
import { authenticateRequest } from '@/lib/auth';
import { calculateDefaultCheckOutTimeShanghai, formatShanghaiDateTimeForDB, parseShanghaiDateTime } from '@/lib/datetime';
import { errorResponse, okResponse } from '@/lib/api-response';
import { 
  getAllGuests, 
  getGuestById, 
  createGuest, 
  updateGuest, 
  deleteGuest,
  searchGuests,
  getSetting,
  createAuditLog,
  type Guest,
  type GuestStatus
} from '@/lib/db';

interface CreateGuestBody {
  name: string;
  phone: string;
  notes?: string;
  plateNumber?: string;
  useCount?: number;
  checkInTime?: string;
  checkOutTime?: string;
  discountType?: string;  // 动态优惠类型
}

interface UpdateGuestBody {
  id: number;
  name?: string;
  phone?: string;
  notes?: string;
  plateNumber?: string;
  useCount?: number;
  checkInTime?: string;
  checkOutTime?: string;
  discountType?: string;  // 动态优惠类型
  status?: 'active' | 'exhausted' | 'expired' | 'disabled';
}

// 计算离店时间
function calculateCheckOutTime(checkInTime: Date): Date {
  return calculateDefaultCheckOutTimeShanghai(checkInTime);
}

// 解析日期时间字符串
function parseDateTime(value: string): Date | null {
  return parseShanghaiDateTime(value);
}

// 格式化日期时间为 ISO 字符串（前端显示用）
function formatGuestForResponse(guest: Guest) {
  // 将数据库中的时间字符串转换为 ISO 格式
  const checkInDate = parseShanghaiDateTime(guest.checkInTime);
  const checkOutDate = parseShanghaiDateTime(guest.checkOutTime);
  const createdDate = parseShanghaiDateTime(guest.createdAt);
  const updatedDate = parseShanghaiDateTime(guest.updatedAt);

  return {
    id: guest.id,
    name: guest.name,
    phone: guest.phone,
    notes: guest.notes,
    plate_number: guest.plateNumber,
    use_count: guest.useCount,
    check_in_time: checkInDate?.toISOString() || guest.checkInTime,
    check_out_time: checkOutDate?.toISOString() || guest.checkOutTime,
    discount_type: guest.discountType,
    status: guest.status,
    created_by: guest.createdBy,
    created_at: createdDate?.toISOString() || guest.createdAt,
    updated_at: updatedDate?.toISOString() || guest.updatedAt,
  };
}

// 获取住客列表
export async function GET(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', '未授权', 401);
    }

    const url = new URL(request.url);
    const search = url.searchParams.get('search');

    let guests;
    if (search) {
      guests = await searchGuests(search);
    } else {
      guests = await getAllGuests();
    }

    return okResponse({ guests: guests.map(formatGuestForResponse) });
  } catch (error) {
    console.error('获取住客列表失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误', 500);
  }
}

// 创建住客
export async function POST(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', '未授权', 401);
    }

    const body = await request.json() as CreateGuestBody;
    const { name, phone, notes, plateNumber, useCount, checkInTime, checkOutTime, discountType } = body;

    if (!name || !phone) {
      return errorResponse('VALIDATION_ERROR', '请填写必要信息（姓名、手机号）', 400);
    }

    // 验证手机号格式
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      return errorResponse('VALIDATION_ERROR', '手机号格式不正确', 400);
    }

    // 获取默认使用次数
    const defaultUseCount = await getSetting('default_use_count');
    const finalUseCount = useCount ?? parseInt(defaultUseCount || '3', 10);

    // 计算时间
    const checkIn = checkInTime ? parseDateTime(checkInTime) : new Date();
    if (!checkIn) {
      return errorResponse('VALIDATION_ERROR', '到店时间格式不正确', 400);
    }

    const checkOut = checkOutTime ? parseDateTime(checkOutTime) : calculateCheckOutTime(checkIn);
    if (!checkOut) {
      return errorResponse('VALIDATION_ERROR', '离店时间格式不正确', 400);
    }

    // 优惠类型：管理员手动设置，默认24hour
    const finalDiscountType = (discountType || '').trim();
    if (!finalDiscountType || finalDiscountType === 'none') {
      return errorResponse('VALIDATION_ERROR', 'Invalid discount type', 400);
    }

    const guest = await createGuest({
      name: name.trim(),
      phone: phone.trim(),
      notes: notes?.trim() || null,
      plateNumber: plateNumber?.toUpperCase() || null,
      useCount: finalUseCount,
      checkInTime: formatShanghaiDateTimeForDB(checkIn),
      checkOutTime: formatShanghaiDateTimeForDB(checkOut),
      discountType: finalDiscountType,
      createdBy: user.id || null,
    });

    if (!guest) {
      return errorResponse('INTERNAL_ERROR', '创建失败', 500);
    }

    // 记录审计日志（异步，不阻塞响应）
    createAuditLog({
      actorType: 'admin',
      actorId: user.id || 0,
      action: 'create_guest',
      targetType: 'guest',
      targetId: guest.id,
      detailJson: JSON.stringify({ name, phone, notes }),
    }).catch(console.error);

    return okResponse({ guest: formatGuestForResponse(guest) });
  } catch (error) {
    console.error('创建住客失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误', 500);
  }
}

// 更新住客
export async function PATCH(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', '未授权', 401);
    }

    const body = await request.json() as UpdateGuestBody;
    const { id, ...updateData } = body;

    if (!id) {
      return errorResponse('VALIDATION_ERROR', '缺少ID', 400);
    }

    const guest = await getGuestById(id);
    if (!guest) {
      return errorResponse('NOT_FOUND', '住客不存在', 404);
    }

    // 处理更新数据
    const finalUpdateData: {
      name?: string;
      phone?: string;
      notes?: string | null;
      plateNumber?: string | null;
      useCount?: number;
      checkInTime?: string;
      checkOutTime?: string;
      discountType?: string;
      status?: GuestStatus;
    } = {};

    if (updateData.name) finalUpdateData.name = updateData.name.trim();
    if (updateData.phone) finalUpdateData.phone = updateData.phone.trim();
    if (updateData.notes !== undefined) finalUpdateData.notes = updateData.notes?.trim() || null;
    if (updateData.plateNumber !== undefined) {
      finalUpdateData.plateNumber = updateData.plateNumber?.toUpperCase() || null;
    }
    if (updateData.useCount !== undefined) finalUpdateData.useCount = updateData.useCount;
    
    // 处理优惠类型更新（管理员手动设置，支持动态类型）
    if (updateData.discountType) {
      const nextDiscountType = updateData.discountType.trim();
      if (nextDiscountType === 'none') {
        return errorResponse('VALIDATION_ERROR', 'Invalid discount type', 400);
      }
      finalUpdateData.discountType = nextDiscountType;
    }
    
    // 处理状态更新
    if (updateData.status) {
      const validStatuses: GuestStatus[] = ['active', 'exhausted', 'expired', 'disabled'];
      if (validStatuses.includes(updateData.status as GuestStatus)) {
        finalUpdateData.status = updateData.status as GuestStatus;
      } else {
        finalUpdateData.status = 'active';
      }
    }

    // 处理时间更新
    if (updateData.checkInTime) {
      const parsed = parseDateTime(updateData.checkInTime);
      if (!parsed) {
        return errorResponse('VALIDATION_ERROR', '到店时间格式不正确', 400);
      }
      finalUpdateData.checkInTime = formatShanghaiDateTimeForDB(parsed);
    }
    
    if (updateData.checkOutTime) {
      const parsed = parseDateTime(updateData.checkOutTime);
      if (!parsed) {
        return errorResponse('VALIDATION_ERROR', '离店时间格式不正确', 400);
      }
      finalUpdateData.checkOutTime = formatShanghaiDateTimeForDB(parsed);
    }

    // 如果次数从0变为大于0，或者延长了离店时间，重置状态为active
    const checkOutDate = finalUpdateData.checkOutTime 
      ? parseShanghaiDateTime(finalUpdateData.checkOutTime) 
      : null;
    
    if (
      (updateData.useCount && updateData.useCount > 0 && guest.useCount <= 0) ||
      (checkOutDate && checkOutDate.getTime() > Date.now())
    ) {
      if (guest.status === 'exhausted' || guest.status === 'expired') {
        finalUpdateData.status = 'active';
      }
    }

    const success = await updateGuest(id, finalUpdateData);

    if (!success) {
      return errorResponse('INTERNAL_ERROR', '更新失败', 500);
    }

    // 记录审计日志（异步，不阻塞响应）
    createAuditLog({
      actorType: 'admin',
      actorId: user.id || 0,
      action: 'update_guest',
      targetType: 'guest',
      targetId: id,
      detailJson: JSON.stringify(finalUpdateData),
    }).catch(console.error);

    const updatedGuest = await getGuestById(id);
    return okResponse({ guest: updatedGuest ? formatGuestForResponse(updatedGuest) : null });
  } catch (error) {
    console.error('更新住客失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误', 500);
  }
}

// 删除住客
export async function DELETE(request: NextRequest) {
  try {
    const user = await authenticateRequest(request);
    if (!user) {
      return errorResponse('UNAUTHORIZED', '未授权', 401);
    }

    const url = new URL(request.url);
    const id = url.searchParams.get('id');

    if (!id) {
      return errorResponse('VALIDATION_ERROR', '缺少ID', 400);
    }

    const guestId = parseInt(id, 10);
    const success = await deleteGuest(guestId);

    if (!success) {
      return errorResponse('INTERNAL_ERROR', '删除失败', 500);
    }

    // 记录审计日志（异步，不阻塞响应）
    createAuditLog({
      actorType: 'admin',
      actorId: user.id || 0,
      action: 'delete_guest',
      targetType: 'guest',
      targetId: guestId,
    }).catch(console.error);

    return okResponse();
  } catch (error) {
    console.error('删除住客失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误', 500);
  }
}
