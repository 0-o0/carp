import { getDiscountTypeByCode, updateDiscountType } from './db';

// 请求配置
const PARKING_API_URL = 'http://www.szdaqin.cn/shopDiscount/goDicount.do?responseFunction=goDicount&querytype=0';

// 默认请求参数
const DEFAULT_BODY_PARAMS = {
  id: '8',
  businessid: '3',
  parkid: '229',
  type: 'null',
  serialNumber: '',
  orderno: '',
  totalcount: '1',
};

interface DiscountPostParams {
  id?: string;
  businessid?: string;
  parkid?: string;
  totalcount?: string;
  adposid?: string;
}

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export interface ParkingRequestResult {
  success: boolean;
  message?: string;
  rawResponse?: string;
  discountInfo?: {
    plate: string;
    discountcharge: number;
    needcharge: string;
    entertime: string;
    staytime: string;
  };
}

/**
 * 发送停车优惠请求（支持动态优惠类型）
 * @param plateNumber 车牌号
 * @param discountTypeCode 优惠类型代码（如 '24hour', '5day', '4hour' 等自定义类型）
 */
export async function sendParkingDiscount(
  plateNumber: string,
  discountTypeCode: string
): Promise<ParkingRequestResult> {
  try {
    // 特殊处理 'none' 类型
    if (discountTypeCode === 'none') {
      return {
        success: false,
        message: '该住客未设置优惠类型',
      };
    }

    // 从数据库获取优惠类型配置
    const discountType = await getDiscountTypeByCode(discountTypeCode);
    
    if (!discountType) {
      return {
        success: false,
        message: `未找到优惠类型: ${discountTypeCode}`,
      };
    }

    if (!discountType.jsessionid) {
      return {
        success: false,
        message: `优惠类型「${discountType.name}」未配置Session ID，请先在系统设置中配置`,
      };
    }

    const jsessionid = discountType.jsessionid;
    const referer = discountType.refererUrl;
    const storedPostParams = safeJsonParse<DiscountPostParams>(discountType.postParams);

    // 构建请求头
    const headers: Record<string, string> = {
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'Origin': 'http://www.szdaqin.cn',
      'Accept': 'text/plain, */*; q=0.01',
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1',
      'Cookie': `JSESSIONID=${jsessionid}`,
    };
    if (referer) {
      headers['Referer'] = referer;
    }

    // 构建请求体 - 对车牌号进行 URL 编码
    const bodyParams = {
      ...DEFAULT_BODY_PARAMS,
      ...(storedPostParams || {}),
      plate: plateNumber,
    };
    const body = new URLSearchParams(
      Object.entries(bodyParams).map(([k, v]) => [k, String(v)])
    ).toString();

    // 发送请求
    const response = await fetch(PARKING_API_URL, {
      method: 'POST',
      headers,
      body,
    });

    const responseText = await response.text();

    // 尝试解析 JSON 响应
    let jsonResponse: Record<string, unknown> | null = null;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch {
    }


    if (jsonResponse && 
        typeof jsonResponse.info === 'object' && 
        jsonResponse.info !== null &&
        'discountcharge' in (jsonResponse.info as Record<string, unknown>)) {
      const info = jsonResponse.info as Record<string, unknown>;
      return {
        success: true,
        rawResponse: responseText,
        discountInfo: {
          plate: String(info.plate || ''),
          discountcharge: Number(info.discountcharge || 0),
          needcharge: String(info.needcharge || '0'),
          entertime: String(info.entertime || ''),
          staytime: String(info.staytime || ''),
        },
      };
    }

    let errorMessage = '停车优惠申请失败';
    if (jsonResponse?.info && typeof jsonResponse.info === 'object') {
      const info = jsonResponse.info as Record<string, unknown>;
      if (info.errmsg && info.errmsg !== 'ok') {
        errorMessage = String(info.errmsg);
      }
    }

    return {
      success: false,
      message: errorMessage,
      rawResponse: responseText,
    };
  } catch (error) {
    console.error('停车优惠请求失败:', error);
    return {
      success: false,
      message: '请求停车系统时发生错误',
    };
  }
}

interface DiscountUrlResolveResult {
  jsessionid: string;
  redirectUrl?: string;
  query?: Record<string, string>;
}

async function resolveDiscountUrl(url: string): Promise<DiscountUrlResolveResult | null> {
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.2 Mobile/15E148 Safari/604.1',
      },
    });

    const location = response.headers.get('Location');
    if (location) {
      const absoluteLocation = new URL(location, url).toString();
      const jsessionidMatch = absoluteLocation.match(/jsessionid=([A-Z0-9]+)/i);
      if (!jsessionidMatch) return null;

      const redirectUrl = absoluteLocation;
      const parsed = new URL(redirectUrl);
      const query: Record<string, string> = {};
      for (const [key, value] of parsed.searchParams.entries()) query[key] = value;

      return {
        jsessionid: jsessionidMatch[1],
        redirectUrl,
        query,
      };
    }

    // 如果没有重定向，尝试从响应体中解析
    const responseText = await response.text();
    const jsessionidMatch = responseText.match(/jsessionid=([A-Z0-9]+)/i);
    if (jsessionidMatch) {
      return { jsessionid: jsessionidMatch[1] };
    }

    return null;
  } catch (error) {
    console.error('解析优惠 URL 失败:', error);
    return null;
  }
}

/**
 * 从优惠 URL 中提取 jsessionid
 * @param url 优惠 URL（会302重定向）
 */
export async function fetchJSessionId(url: string): Promise<string | null> {
  const resolved = await resolveDiscountUrl(url);
  return resolved?.jsessionid || null;
}

/**
 * 更新优惠类型的 URL 并获取新的 jsessionid（支持动态优惠类型）
 * @param discountTypeCode 优惠类型代码
 * @param url 新的优惠 URL
 */
export async function updateDiscountUrl(
  discountTypeCode: string,
  url: string
): Promise<{ success: boolean; jsessionid?: string; message?: string }> {
  try {
    // 从数据库获取优惠类型
    const discountType = await getDiscountTypeByCode(discountTypeCode);
    
    if (!discountType) {
      return {
        success: false,
        message: `未找到优惠类型: ${discountTypeCode}`,
      };
    }

    const resolved = await resolveDiscountUrl(url);

    if (!resolved?.jsessionid) {
      return {
        success: false,
        message: '无法从 URL 中获取会话ID，请检查 URL 是否正确',
      };
    }

    // 从 302 的 URL query 中提取 POST 需要的参数（避免硬编码）
    const nextPostParams: DiscountPostParams = {
      id: resolved.query?.id || DEFAULT_BODY_PARAMS.id,
      businessid: resolved.query?.businessid || DEFAULT_BODY_PARAMS.businessid,
      parkid: resolved.query?.parkid || DEFAULT_BODY_PARAMS.parkid,
      totalcount: resolved.query?.totalcount || DEFAULT_BODY_PARAMS.totalcount,
    };

    // 更新数据库中的优惠类型配置
    await updateDiscountType(discountType.id, {
      scanUrl: url,
      jsessionid: resolved.jsessionid,
      refererUrl: resolved.redirectUrl,
      postParams: JSON.stringify(nextPostParams),
    });

    return {
      success: true,
      jsessionid: resolved.jsessionid,
    };
  } catch (error) {
    console.error('更新优惠 URL 失败:', error);
    return {
      success: false,
      message: '更新失败，请稍后重试',
    };
  }
}
