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

type RequestBodyType = 'raw' | 'form' | 'json';

type TemplateContext = {
  plate: string;
  discountType: string;
  jsessionid?: string;
  referer?: string;
  scanUrl?: string;
  note?: string;
  name?: string;
  phone?: string;
  [key: string]: string | undefined;
};

interface CustomRequestConfig {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, string | number | boolean | null>;
  bodyType?: RequestBodyType;
}

interface CustomResponseConfig {
  type?: 'json' | 'text';
  success?: {
    path?: string;
    equals?: string | number | boolean;
    regex?: string;
  };
  messagePath?: string;
  redirectPath?: string;
}

const TEMPLATE_TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g;

function applyTemplate(value: string, context: TemplateContext): string {
  const normalized = value.replace(/#\{([a-zA-Z0-9_.-]+)\}/g, '{{$1}}');
  return normalized.replace(TEMPLATE_TOKEN_RE, (_, key) => {
    const rawValue = key.includes('.') ? getValueByPath(context, key) : context[key];
    if (rawValue === undefined || rawValue === null) return '';
    if (typeof rawValue === 'string') return rawValue;
    return String(rawValue);
  });
}

function replaceTemplates(value: unknown, context: TemplateContext): unknown {
  if (typeof value === 'string') return applyTemplate(value, context);
  if (Array.isArray(value)) return value.map(item => replaceTemplates(item, context));
  if (value && typeof value === 'object') {
    const next: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      next[key] = replaceTemplates(val, context);
    }
    return next;
  }
  return value;
}

function parseObjectLiteral(raw: string): Record<string, string> | null {
  let cleaned = raw.trim();
  if (!cleaned.startsWith('{')) return null;
  cleaned = cleaned
    .replace(/`/g, '"')
    .replace(/'/g, '"')
    .replace(/([,{]\s*)([\w-]+)\s*:/g, '$1"$2":')
    .replace(/,\s*([}\]])/g, '$1');
  return safeJsonParse<Record<string, string>>(cleaned);
}


function extractDirective(raw: string, name: string): string | null {
  const match = raw.match(new RegExp(`#${name}\\{([\\s\\S]*?)\\}`, 'i'));
  if (!match) return null;
  return match[1].trim();
}

function parseHeaderDirective(raw: string): Record<string, string> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) {
    const obj = parseObjectLiteral(trimmed) || safeJsonParse<Record<string, string>>(trimmed);
    if (obj) return obj;
  }
  const pairs = trimmed.split(/[&;\n]+/).map(part => part.trim()).filter(Boolean);
  if (pairs.length === 0) return null;
  const headers: Record<string, string> = {};
  for (const pair of pairs) {
    const sepIndex = pair.indexOf('=') >= 0 ? pair.indexOf('=') : pair.indexOf(':');
    if (sepIndex <= 0) continue;
    const key = pair.slice(0, sepIndex).trim();
    const value = pair.slice(sepIndex + 1).trim();
    if (key) headers[key] = value;
  }
  return Object.keys(headers).length ? headers : null;
}

function stripDirectives(raw: string, names: string[]): string {
  if (!raw) return raw;
  const pattern = new RegExp(`#(?:${names.join('|')})\\{[\\s\\S]*?\\}`, 'gi');
  return raw.replace(pattern, '');
}

function findHeaderKey(headers: Record<string, string>, lowerName: string): string | null {
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === lowerName) return key;
  }
  return null;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  return findHeaderKey(headers, name.toLowerCase()) !== null;
}

function setHeader(headers: Record<string, string>, name: string, value: string) {
  const existingKey = findHeaderKey(headers, name.toLowerCase());
  if (existingKey) {
    headers[existingKey] = value;
    return;
  }
  headers[name] = value;
}

function mergeHeaders(headers: Record<string, string>, overrides: Record<string, string>): Record<string, string> {
  const next: Record<string, string> = { ...headers };
  for (const [key, value] of Object.entries(overrides)) {
    const existingKey = findHeaderKey(next, key.toLowerCase());
    if (existingKey && existingKey !== key) delete next[existingKey];
    next[key] = value;
  }
  return next;
}

function parseNoteVariables(note?: string | null): Record<string, string> {
  const vars: Record<string, string> = {};
  if (!note) return vars;
  const trimmed = note.trim();
  if (!trimmed) return vars;

  if (trimmed.startsWith('{')) {
    const parsed = safeJsonParse<Record<string, unknown>>(trimmed);
    if (parsed && typeof parsed === 'object') {
      for (const [key, value] of Object.entries(parsed)) {
        if (value === undefined || value === null) continue;
        vars[key] = typeof value === 'string' ? value : String(value);
      }
      return vars;
    }
  }

  const parts = trimmed.split(/[&;\r\n]+/).map(part => part.trim()).filter(Boolean);
  for (const part of parts) {
    const sepIndex = part.indexOf('=') >= 0 ? part.indexOf('=') : part.indexOf(':');
    if (sepIndex <= 0) continue;
    const key = part.slice(0, sepIndex).trim();
    const value = part.slice(sepIndex + 1).trim();
    if (key) vars[key] = value;
  }

  return vars;
}


function parseKeyValuePairs(raw: string): Record<string, string> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('{')) {
    const obj = parseObjectLiteral(trimmed) || safeJsonParse<Record<string, string>>(trimmed);
    return obj || null;
  }
  if (!trimmed.includes('=') && !trimmed.includes(':')) return null;
  const params = new URLSearchParams(trimmed);
  const result: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    result[key] = value;
  }
  return Object.keys(result).length ? result : null;
}

function applyBodyDirective(config: CustomRequestConfig, directive: string) {
  const trimmed = directive.trim();
  if (!trimmed) return;

  const overrides = parseKeyValuePairs(trimmed);

  if (config.body && typeof config.body === 'object') {
    if (overrides) {
      config.body = { ...config.body, ...overrides };
      return;
    }
    config.body = trimmed;
    config.bodyType = 'raw';
    return;
  }

  if (typeof config.body === 'string' && config.body.length > 0 && overrides) {
    const baseParams = new URLSearchParams(config.body);
    for (const [key, value] of Object.entries(overrides)) {
      baseParams.set(key, value);
    }
    config.body = baseParams.toString();
    if (!config.bodyType) config.bodyType = 'form';
    return;
  }

  config.body = trimmed;
  config.bodyType = 'raw';
}

function parseRequestTemplate(raw: string): CustomRequestConfig | null {
  const bodyDirective = extractDirective(raw, 'body');
  const headerDirective = extractDirective(raw, 'header');
  const trimmed = raw.replace(/#(?:body|header)\{[\s\S]*?\}/gi, '').trim();
  if (!trimmed) return null;

  let config: CustomRequestConfig | null = null;

  if (trimmed.startsWith('{')) {
    const parsed = safeJsonParse<CustomRequestConfig>(trimmed);
    config = parsed?.url ? parsed : null;
  } else {
    const urlMatch = trimmed.match(/const\s+url\s*=\s*([`'"])([\s\S]*?)\1\s*;?/);
    if (!urlMatch) return null;

    const methodMatch = trimmed.match(/const\s+method\s*=\s*([`'"])([\s\S]*?)\1\s*;?/);
    const headersMatch = trimmed.match(/const\s+headers\s*=\s*({[\s\S]*?})\s*;?/);
    const bodyTypeMatch = trimmed.match(/const\s+bodyType\s*=\s*([`'"])([\s\S]*?)\1\s*;?/);
    const bodyObjectMatch = trimmed.match(/const\s+body\s*=\s*({[\s\S]*?})\s*;?/);
    const bodyStringMatch = trimmed.match(/const\s+body\s*=\s*([`'"])([\s\S]*?)\1\s*;?/);

    const headers = headersMatch ? parseObjectLiteral(headersMatch[1]) || undefined : undefined;

    let body: CustomRequestConfig['body'] | undefined;
    if (bodyObjectMatch) {
      body = parseObjectLiteral(bodyObjectMatch[1]) || safeJsonParse<Record<string, string | number | boolean | null>>(bodyObjectMatch[1]) || undefined;
    } else if (bodyStringMatch) {
      body = bodyStringMatch[2];
    }

    const rawBodyType = bodyTypeMatch?.[2]?.trim().toLowerCase();
    const explicitBodyType: RequestBodyType | undefined =
      rawBodyType === 'json' || rawBodyType === 'form' || rawBodyType === 'raw'
        ? (rawBodyType as RequestBodyType)
        : undefined;
    const inferredBodyType: RequestBodyType | undefined =
      typeof body === 'object'
        ? 'form'
        : typeof body === 'string'
          ? (body.includes('=') ? 'form' : 'raw')
          : undefined;

    config = {
      url: urlMatch[2],
      method: methodMatch?.[2],
      headers,
      body,
      bodyType: explicitBodyType || inferredBodyType,
    };
  }

  if (!config) return null;

  if (headerDirective) {
    const headerOverrides = parseHeaderDirective(headerDirective);
    if (headerOverrides) {
      config.headers = { ...(config.headers || {}), ...headerOverrides };
    }
  }

  if (bodyDirective) {
    applyBodyDirective(config, bodyDirective);
  }

  return config;
}


function parseResponseTemplate(raw?: string | null): CustomResponseConfig | null {
  if (!raw) return null;
  const parsed = safeJsonParse<CustomResponseConfig>(raw);
  return parsed || null;
}

function tryParseJsonFromText(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const trimmed = text.trim();
  if (!trimmed) return null;

  const functionMatch = trimmed.match(/^[a-zA-Z_$][\w$]*\(([\s\S]*)\)\s*;?$/);
  const candidate = functionMatch ? functionMatch[1] : trimmed;

  const direct = safeJsonParse<Record<string, unknown>>(candidate);
  if (direct) return direct;

  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const slice = trimmed.slice(firstBrace, lastBrace + 1);
    return safeJsonParse<Record<string, unknown>>(slice);
  }

  return null;
}

function getValueByPath(obj: unknown, path?: string): unknown {
  if (!path) return undefined;
  const normalized = path.replace(/\[(\d+)\]/g, '.$1');
  const parts = normalized.split('.').filter(Boolean);
  let current: any = obj;
  for (const part of parts) {
    if (current == null) return undefined;
    current = current[part];
  }
  return current;
}

function extractDiscountInfo(jsonResponse: Record<string, unknown> | null | undefined) {
  if (!jsonResponse || typeof jsonResponse.info !== 'object' || jsonResponse.info === null) return null;
  const info = jsonResponse.info as Record<string, unknown>;
  if (!('discountcharge' in info)) return null;
  return {
    plate: String(info.plate || ''),
    discountcharge: Number(info.discountcharge || 0),
    needcharge: String(info.needcharge || '0'),
    entertime: String(info.entertime || ''),
    staytime: String(info.staytime || ''),
  };
}

function evaluateCustomResponse(
  responseText: string,
  config: CustomResponseConfig | null
): { success: boolean; message?: string; redirectUrl?: string; json?: Record<string, unknown> } | null {
  if (!config) return null;

  const type = config.type || (config.success?.path || config.messagePath || config.redirectPath ? 'json' : 'text');

  if (type === 'json') {
    const json = tryParseJsonFromText(responseText);
    if (!json) {
      return { success: false, message: 'Invalid JSON response' };
    }

    const successRule = config.success;
    let success = false;
    if (successRule) {
      const targetValue = successRule.path ? getValueByPath(json, successRule.path) : undefined;
      if (successRule.equals !== undefined) {
        success = targetValue === successRule.equals || String(targetValue) === String(successRule.equals);
      } else if (successRule.regex) {
        const regex = new RegExp(successRule.regex);
        const target = targetValue !== undefined ? String(targetValue) : JSON.stringify(json);
        success = regex.test(target);
      } else if (successRule.path) {
        success = Boolean(targetValue);
      }
    }

    const messageValue = config.messagePath ? getValueByPath(json, config.messagePath) : undefined;
    const redirectValue = config.redirectPath ? getValueByPath(json, config.redirectPath) : undefined;

    return {
      success,
      message: messageValue !== undefined ? String(messageValue) : undefined,
      redirectUrl: typeof redirectValue === 'string' ? redirectValue : undefined,
      json,
    };
  }

  if (config.success?.regex) {
    const regex = new RegExp(config.success.regex);
    return { success: regex.test(responseText), message: responseText };
  }
  if (config.success?.equals !== undefined) {
    return { success: responseText.includes(String(config.success.equals)), message: responseText };
  }

  return { success: false, message: responseText };
}

function buildRequestBody(
  body: CustomRequestConfig['body'],
  bodyType: RequestBodyType | undefined,
  context: TemplateContext
): string | undefined {
  if (body === undefined) return undefined;
  const resolved = replaceTemplates(body, context);

  if (typeof resolved === 'string') return resolved;

  const resolvedObj = resolved as Record<string, string | number | boolean | null>;

  if (bodyType === 'json') {
    return JSON.stringify(resolvedObj);
  }

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(resolvedObj)) {
    params.set(key, value === null ? '' : String(value));
  }
  return params.toString();
}

export interface ParkingRequestResult {
  success: boolean;
  message?: string;
  rawResponse?: string;
  redirectUrl?: string;
  discountInfo?: {
    plate: string;
    discountcharge: number;
    needcharge: string;
    entertime: string;
    staytime: string;
  };
}

/**
 * Send parking discount request (supports dynamic discount types)
 * @param plateNumber License plate
 * @param discountTypeCode Discount type code (e.g. '24hour', '5day', '4hour')
 */
export async function sendParkingDiscount(
  plateNumber: string,
  discountTypeCode: string,
  contextOverrides?: {
    note?: string | null;
    name?: string | null;
    phone?: string | null;
    extra?: Record<string, string | undefined>;
  }
): Promise<ParkingRequestResult> {
  try {
    // Special handling for 'none' type
    if (discountTypeCode === 'none') {
      return {
        success: false,
        message: 'Discount type not set',
      };
    }

    // Load discount type config
    const discountType = await getDiscountTypeByCode(discountTypeCode);

    if (!discountType) {
      return {
        success: false,
        message: `Discount type not found: ${discountTypeCode}`,
      };
    }

    const useCustomRequest = Boolean(discountType.useCustomRequest);
    const customRequestRaw = useCustomRequest ? discountType.requestTemplate?.trim() : '';
    const customResponse = parseResponseTemplate(discountType.responseTemplate);

    if (discountType.responseTemplate && !customResponse) {
      return {
        success: false,
        message: `Custom response template parse failed for ${discountType.name}`,
      };
    }

    if (useCustomRequest && !customRequestRaw) {
      return {
        success: false,
        message: `Custom request enabled but template is empty for ${discountType.name}`,
      };
    }

    if (customRequestRaw) {
      const requestConfig = parseRequestTemplate(customRequestRaw);
    if (!requestConfig) {
      return {
        success: false,
        message: `Custom request template parse failed for ${discountType.name}`,
      };
    }

    const noteRaw = contextOverrides?.note ?? null;
    const noteBodyDirective = noteRaw ? extractDirective(noteRaw, 'body') : null;
    const noteHeaderDirective = noteRaw ? extractDirective(noteRaw, 'header') : null;
    const cleanedNote = noteRaw ? stripDirectives(noteRaw, ['body', 'header']).trim() : null;
    const noteVars = parseNoteVariables(cleanedNote);
    const context: TemplateContext = {
      plate: plateNumber,
      discountType: discountTypeCode,
      jsessionid: discountType.jsessionid || undefined,
      referer: discountType.refererUrl || undefined,
      scanUrl: discountType.scanUrl || undefined,
      note: cleanedNote || undefined,
      name: contextOverrides?.name || undefined,
      phone: contextOverrides?.phone || undefined,
      ...noteVars,
      ...(contextOverrides?.extra || {}),
    };

      const effectiveRequestConfig: CustomRequestConfig = {
        ...requestConfig,
        headers: requestConfig.headers ? { ...requestConfig.headers } : undefined,
        body:
          requestConfig.body && typeof requestConfig.body === 'object'
            ? { ...(requestConfig.body as Record<string, string | number | boolean | null>) }
            : requestConfig.body,
      };

      if (noteHeaderDirective) {
        const headerOverrides = parseHeaderDirective(noteHeaderDirective);
        if (headerOverrides) {
          effectiveRequestConfig.headers = mergeHeaders(effectiveRequestConfig.headers || {}, headerOverrides);
        }
      }

      if (noteBodyDirective) {
        applyBodyDirective(effectiveRequestConfig, noteBodyDirective);
      }

      const url = applyTemplate(effectiveRequestConfig.url, context);
      const method = (effectiveRequestConfig.method || 'POST').toUpperCase();
      const headers: Record<string, string> = { ...(effectiveRequestConfig.headers || {}) };

      if (!hasHeader(headers, 'cookie') && context.jsessionid) {
        setHeader(headers, 'Cookie', `JSESSIONID=${context.jsessionid}`);
      }

      const resolvedHeaders: Record<string, string> = {};
      for (const [key, value] of Object.entries(headers)) {
        resolvedHeaders[key] = applyTemplate(String(value), context);
      }

      if (!hasHeader(resolvedHeaders, 'referer') && context.referer) {
        setHeader(resolvedHeaders, 'Referer', context.referer);
      }

      let body: string | undefined;
      if (method !== 'GET') {
        const resolvedBodyType = effectiveRequestConfig.bodyType || (typeof effectiveRequestConfig.body === 'object' ? 'form' : undefined);
        body = buildRequestBody(effectiveRequestConfig.body, resolvedBodyType, context);
        if (resolvedBodyType === 'json') {
          if (!hasHeader(resolvedHeaders, 'content-type')) {
            setHeader(resolvedHeaders, 'Content-Type', 'application/json');
          }
        } else if (resolvedBodyType === 'form') {
          if (!hasHeader(resolvedHeaders, 'content-type')) {
            setHeader(resolvedHeaders, 'Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
          }
        }
      }

      const response = await fetch(url, {
        method,
        headers: resolvedHeaders,
        body,
      });

      const responseText = await response.text();
      const evaluated = evaluateCustomResponse(responseText, customResponse);

      if (evaluated) {
        const info = extractDiscountInfo(evaluated.json);
        return {
          success: evaluated.success,
          message: evaluated.message,
          rawResponse: responseText,
          redirectUrl: evaluated.redirectUrl,
          discountInfo: info || undefined,
        };
      }

      const jsonResponse = tryParseJsonFromText(responseText);
      const info = extractDiscountInfo(jsonResponse || undefined);
      if (info) {
        return {
          success: true,
          rawResponse: responseText,
          discountInfo: info,
        };
      }

      return {
        success: response.ok,
        message: response.ok ? undefined : 'Request failed',
        rawResponse: responseText,
      };
    }

    if (!discountType.jsessionid) {
      return {
        success: false,
        message: `Discount type ${discountType.name} missing Session ID. Configure in settings.`,
      };
    }

    const jsessionid = discountType.jsessionid;
    const referer = discountType.refererUrl;
    const storedPostParams = safeJsonParse<DiscountPostParams>(discountType.postParams);

    // Send request?
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

    // Build request body
    const bodyParams = {
      ...DEFAULT_BODY_PARAMS,
      ...(storedPostParams || {}),
      plate: plateNumber,
    };
    const body = new URLSearchParams(
      Object.entries(bodyParams).map(([k, v]) => [k, String(v)])
    ).toString();

    // Send request
    const response = await fetch(PARKING_API_URL, {
      method: 'POST',
      headers,
      body,
    });

    const responseText = await response.text();

    // Parse JSON response
    const jsonResponse = tryParseJsonFromText(responseText);

    const info = extractDiscountInfo(jsonResponse || undefined);
    if (info) {
      return {
        success: true,
        rawResponse: responseText,
        discountInfo: info,
      };
    }

    let errorMessage = 'Parking discount request failed';
    if (jsonResponse?.info && typeof jsonResponse.info === 'object') {
      const infoObj = jsonResponse.info as Record<string, unknown>;
      if (infoObj.errmsg && infoObj.errmsg !== 'ok') {
        errorMessage = String(infoObj.errmsg);
      }
    }

    return {
      success: false,
      message: errorMessage,
      rawResponse: responseText,
    };
  } catch (error) {
    console.error('Parking discount request failed:', error);
    return {
      success: false,
      message: 'Failed to request parking system',
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
