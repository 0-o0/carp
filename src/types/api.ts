// API 响应类型定义

export interface ApiResponse {
  success: boolean;
  message?: string;
  [key: string]: unknown;
}

export interface AuthResponse extends ApiResponse {
  user?: {
    id: number;
    username: string;
    isSuperAdmin: boolean;
  };
  needChangePassword?: boolean;
}

export interface AdminsResponse extends ApiResponse {
  admins?: Array<{
    id: number;
    username: string;
    is_super_admin: number;
    is_active: number;
    created_at: string;
    updated_at: string;
  }>;
}

export interface GuestsResponse extends ApiResponse {
  guests?: Array<{
    id: number;
    name: string;
    phone: string;
    room_number: string;
    plate_number: string | null;
    use_count: number;
    check_in_time: string;
    check_out_time: string;
    discount_type: '24hour' | '5day';
    status: 'active' | 'exhausted' | 'expired' | 'disabled';
    created_at: string;
    updated_at: string;
  }>;
  guest?: GuestsResponse['guests'] extends Array<infer T> ? T : never;
}

export interface SettingsResponse extends ApiResponse {
  settings?: Record<string, string>;
  jsessionid?: string;
}

export interface SubmitResponse extends ApiResponse {
  requirePlate?: boolean;
  redirectUrl?: string;
}
