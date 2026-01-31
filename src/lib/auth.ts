import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';
import { getEnv } from '@/lib/db';


export interface TokenPayload {
  id: number;
  username: string;
  isSuperAdmin: boolean;
}

const JWT_EXPIRATION = '24h';
const BCRYPT_SALT_ROUNDS = 12;

function getJwtSecret(): Uint8Array {
  const env = getEnv();
  return new TextEncoder().encode(env.JWT_SECRET);
}


/**
 * 生成 JWT Token
 */
export async function generateToken(payload: TokenPayload): Promise<string> {
  const secret = getJwtSecret();
  
  const token = await new SignJWT({
    id: payload.id,
    username: payload.username,
    isSuperAdmin: payload.isSuperAdmin,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(JWT_EXPIRATION)
    .sign(secret);
  
  return token;
}

/**
 * 验证并解析 JWT Token
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);
    
    return {
      id: payload.id as number,
      username: payload.username as string,
      isSuperAdmin: payload.isSuperAdmin as boolean,
    };
  } catch {
    return null;
  }
}

/**
 * 从请求中获取 Token
 */
export function getTokenFromRequest(request: Request): string | null {
  const cookieHeader = request.headers.get('Cookie') || '';
  const tokenMatch = cookieHeader.match(/auth_token=([^;]+)/);
  if (tokenMatch) return tokenMatch[1];

  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }

  return null;
}

/**
 * 验证请求中的 Token
 */
export async function authenticateRequest(request: Request): Promise<TokenPayload | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;
  return verifyToken(token);
}

/**
 * 从服务端组件获取当前用户
 */
export async function getCurrentUser(): Promise<TokenPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('auth_token')?.value;
    if (!token) return null;
    return verifyToken(token);
  } catch {
    return null;
  }
}


/**
 * 哈希密码 - 使用 bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
}

/**
 * 验证密码
 */
export async function verifyPassword(
  password: string,
  hashedPassword: string
): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}


/**
 * 设置认证 Cookie 的选项
 */
export function getAuthCookieOptions(secure: boolean = false) {
  return {
    httpOnly: true,
    secure,
    sameSite: 'lax' as const,
    maxAge: 24 * 60 * 60,
    path: '/',
  };
}

/**
 * 判断请求是否是安全连接
 */
export function isSecureRequest(request: Request): boolean {
  const forwardedProto = request.headers.get('x-forwarded-proto');
  if (forwardedProto) return forwardedProto === 'https';
  
  const url = new URL(request.url);
  return url.protocol === 'https:';
}
