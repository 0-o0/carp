// 停车优惠 API - 封装对第三方停车系统的请求
import { getSetting, updateSetting } from './db';

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

type DiscountType = '24hour' | '5day';

const DISCOUNT_KEYS = {
  '24hour': {
    urlKey: 'url_24hour',
    jsessionidKey: 'jsessionid_24hour',
    refererKey: 'referer_24hour',
    postParamsKey: 'post_params_24hour',
  },
  '5day': {
    urlKey: 'url_5day',
    jsessionidKey: 'jsessionid_5day',
    refererKey: 'referer_5day',
    postParamsKey: 'post_params_5day',
  },
} as const;

interface DiscountPostParams {
  id: string;
  businessid: string;
  parkid: string;
  totalcount: string;
}

function safeJsonParse<T>(value: string | null): T | null {
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
  resultKey?: string;
}

/**
 * 发送停车优惠请求
 * @param plateNumber 车牌号
 * @param discountType 优惠类型 24hour 或 5day
 */
export async function sendParkingDiscount(
  plateNumber: string,
  discountType: DiscountType
): Promise<ParkingRequestResult> {
  try {
    // 获取对应优惠类型的 jsessionid
    const { jsessionidKey, refererKey, postParamsKey } = DISCOUNT_KEYS[discountType];
    const jsessionid = await getSetting(jsessionidKey);

    if (!jsessionid) {
      return {
        success: false,
        message: `未配置${discountType === '24hour' ? '24小时' : '5天'}优惠的会话ID`,
      };
    }

    const referer = await getSetting(refererKey);
    const storedPostParams = safeJsonParse<Partial<DiscountPostParams>>(await getSetting(postParamsKey));

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

    // 提取远程系统的 result_key
    const resultKeyMatch = responseText.match(/"system_result_key"\s*:\s*"?(\d+)"?/);
    const resultKey = resultKeyMatch ? resultKeyMatch[1] : undefined;

    // 检查响应
    // 如果包含 "system_result_key":"0" 表示失败
    if (responseText.includes('"system_result_key":"0"')) {
      return {
        success: false,
        message: '停车优惠申请失败',
        rawResponse: responseText,
        resultKey,
      };
    }

    // 其他情况视为成功
    return {
      success: true,
      rawResponse: responseText,
      resultKey,
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
 * 更新优惠 URL 并获取新的 jsessionid
 * @param discountType 优惠类型
 * @param url 新的优惠 URL
 */
export async function updateDiscountUrl(
  discountType: DiscountType,
  url: string
): Promise<{ success: boolean; jsessionid?: string; message?: string }> {
  try {
    const resolved = await resolveDiscountUrl(url);

    if (!resolved?.jsessionid) {
      return {
        success: false,
        message: '无法从 URL 中获取会话ID，请检查 URL 是否正确',
      };
    }

    const { urlKey, jsessionidKey, refererKey, postParamsKey } = DISCOUNT_KEYS[discountType];

    await updateSetting(urlKey, url);
    await updateSetting(jsessionidKey, resolved.jsessionid);

    // 保存 referer（重定向后的 plate 页面 URL，便于模拟浏览器请求）
    if (resolved.redirectUrl) {
      await updateSetting(refererKey, resolved.redirectUrl);
    }

    // 从 302 的 URL query 中提取 POST 需要的参数（避免硬编码）
    const nextPostParams: DiscountPostParams = {
      id: resolved.query?.id || DEFAULT_BODY_PARAMS.id,
      businessid: resolved.query?.businessid || DEFAULT_BODY_PARAMS.businessid,
      parkid: resolved.query?.parkid || DEFAULT_BODY_PARAMS.parkid,
      totalcount: resolved.query?.totalcount || DEFAULT_BODY_PARAMS.totalcount,
    };
    await updateSetting(postParamsKey, JSON.stringify(nextPostParams));

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
