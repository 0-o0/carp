/**
 * 服务端验证工具函数
 * 这些函数可以在 API 路由（服务端）中安全使用
 */

/**
 * 验证车牌号格式
 * 规则：第一位必须是中文，后面6-7位字母或数字
 * @param plate 车牌号
 * @returns 是否有效
 */
export function validatePlateNumber(plate: string): boolean {
  if (!plate || plate.length < 7 || plate.length > 8) return false;
  const firstChar = plate[0];
  // 第一位必须是中文
  if (!/[\u4e00-\u9fa5]/.test(firstChar)) return false;
  // 后面的字符必须是字母或数字
  for (let i = 1; i < plate.length; i++) {
    if (!/^[A-Z0-9]$/i.test(plate[i])) return false;
  }
  return true;
}

/**
 * 验证手机号格式
 * @param phone 手机号
 * @returns 是否有效
 */
export function validatePhone(phone: string): boolean {
  return /^1[3-9]\d{9}$/.test(phone);
}

/**
 * 验证必填字段
 * @param value 值
 * @returns 是否非空
 */
export function isNotEmpty(value: string | undefined | null): boolean {
  return !!value && value.trim().length > 0;
}
