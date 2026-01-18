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
  type Guest,
  type DiscountType,
  type GuestStatus
} from '@/lib/db';

interface CreateGuestBody {
  name: string;
  phone: string;
  roomNumber: string;
  plateNumber?: string;
  useCount?: number;
  checkInTime?: string;
  checkOutTime?: string;
}

interface UpdateGuestBody {
  id: number;
  name?: string;
  phone?: string;
  roomNumber?: string;
  plateNumber?: string;
  useCount?: number;
  checkInTime?: string;
  checkOutTime?: string;
  status?: string;
}

// 计算离店时间
function calculateCheckOutTime(checkInTime: Date): Date {
  return calculateDefaultCheckOutTimeShanghai(checkInTime);
}

// 计算优惠类型
function calculateDiscountType(checkInTime: Date, checkOutTime: Date): DiscountType {
  const diffTime = checkOutTime.getTime() - checkInTime.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 1 ? '5day' : '24hour';
}

// 解析日期时间字符串
function parseDateTime(value: string): Date | null {
  const trimmed = value.trim();
  const match = trimmed.match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/
  );
  if (!match) return null;

  const [, year, month, day, hour, minute, second] = match;
  const date = new Date(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    second ? Number(second) : 0
  );
  
  return isNaN(date.getTime()) ? null : date;
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
    room_number: guest.roomNumber,
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
    const { name, phone, roomNumber, plateNumber, useCount, checkInTime, checkOutTime } = body;

    if (!name || !phone || !roomNumber) {
      return errorResponse('VALIDATION_ERROR', '请填写必要信息（姓名、手机号、房间号）', 400);
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

    // 计算优惠类型
    const discountType = calculateDiscountType(checkIn, checkOut);

    const guest = await createGuest({
      name: name.trim(),
      phone: phone.trim(),
      roomNumber: roomNumber.trim(),
      plateNumber: plateNumber?.toUpperCase() || null,
      useCount: finalUseCount,
      checkInTime: formatShanghaiDateTimeForDB(checkIn),
      checkOutTime: formatShanghaiDateTimeForDB(checkOut),
      discountType,
      createdBy: user.id || null,
    });

    if (!guest) {
      return errorResponse('INTERNAL_ERROR', '创建失败', 500);
    }

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
      roomNumber?: string;
      plateNumber?: string | null;
      useCount?: number;
      checkInTime?: string;
      checkOutTime?: string;
      discountType?: DiscountType;
      status?: GuestStatus;
    } = {};

    if (updateData.name) finalUpdateData.name = updateData.name.trim();
    if (updateData.phone) finalUpdateData.phone = updateData.phone.trim();
    if (updateData.roomNumber) finalUpdateData.roomNumber = updateData.roomNumber.trim();
    if (updateData.plateNumber !== undefined) {
      finalUpdateData.plateNumber = updateData.plateNumber?.toUpperCase() || null;
    }
    if (updateData.useCount !== undefined) finalUpdateData.useCount = updateData.useCount;
    
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
      
      // 重新计算优惠类型
      const checkInStr = finalUpdateData.checkInTime || guest.checkInTime;
      const checkInDate = parseShanghaiDateTime(checkInStr);
      if (checkInDate) {
        finalUpdateData.discountType = calculateDiscountType(checkInDate, parsed);
      }
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

    const success = await deleteGuest(parseInt(id, 10));

    if (!success) {
      return errorResponse('INTERNAL_ERROR', '删除失败', 500);
    }

    return okResponse();
  } catch (error) {
    console.error('删除住客失败:', error);
    return errorResponse('INTERNAL_ERROR', '系统错误', 500);
  }
}
