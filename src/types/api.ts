// API 响应类型定义

export interface ApiResponse {
  success: boolean;
  message?: string;
  code?: string;
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

// 单个住客项类型定义
export interface GuestItem {
  id: number;
  name: string;
  phone: string;
  notes: string | null;
  plate_number: string | null;
  use_count: number;
  check_in_time: string;
  check_out_time: string;
  discount_type: string; // 动态优惠类型（discount_types.code）
  status: 'active' | 'exhausted' | 'expired' | 'disabled';
  created_by?: number | null;
  created_at: string;
  updated_at: string;
}

export interface GuestsResponse extends ApiResponse {
  guests?: GuestItem[];
  guest?: GuestItem;
}

export interface SettingsResponse extends ApiResponse {
  settings?: Record<string, string>;
  jsessionid?: string;
}

export interface SubmitResponse extends ApiResponse {
  requirePlate?: boolean;
  redirectUrl?: string;
  remoteResponse?: string;
  guestId?: number;
  useCount?: number;
  status?: 'active' | 'exhausted' | 'expired' | 'disabled';
}
