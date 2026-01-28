-- 酒店停车管理系统数据库架构
-- 支持 SQLite 和 Cloudflare D1

-- 管理员表
CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    is_super_admin INTEGER DEFAULT 0 NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    must_change_password INTEGER DEFAULT 0 NOT NULL,
    created_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL
);

-- 自定义优惠类型表（支持自定义/动态扩展）
CREATE TABLE IF NOT EXISTS discount_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    color TEXT DEFAULT 'orange' NOT NULL,
    sort_order INTEGER DEFAULT 0 NOT NULL,
    is_active INTEGER DEFAULT 1 NOT NULL,
    is_system INTEGER DEFAULT 0 NOT NULL,
    scan_url TEXT,
    jsessionid TEXT,
    referer_url TEXT,
    post_params TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL
);

-- 住客表
CREATE TABLE IF NOT EXISTS guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    notes TEXT,
    plate_number TEXT,
    use_count INTEGER DEFAULT 3 NOT NULL,
    uses_default_snapshot INTEGER DEFAULT 3 NOT NULL,
    check_in_time TEXT NOT NULL,
    check_out_time TEXT NOT NULL,
    discount_type TEXT NOT NULL,
    status TEXT CHECK(status IN ('active', 'exhausted', 'expired', 'disabled')) DEFAULT 'active' NOT NULL,
    created_by INTEGER REFERENCES admins(id),
    created_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL,
    updated_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL
);

-- 系统设置表
CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL
);

-- 优惠配置表
CREATE TABLE IF NOT EXISTS discount_configs (
    type TEXT PRIMARY KEY CHECK(type IN ('24hour', '5day')),
    scan_url TEXT NOT NULL,
    redirect_url TEXT NOT NULL,
    jsessionid TEXT NOT NULL,
    id_param TEXT NOT NULL,
    businessid_param TEXT NOT NULL,
    parkid_param TEXT NOT NULL,
    totalcount_param TEXT NOT NULL,
    adposid_param TEXT NOT NULL,
    updated_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL
);

-- 提交日志
CREATE TABLE IF NOT EXISTS submission_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    discount_type TEXT NOT NULL,
    plate_used TEXT NOT NULL,
    request_ok INTEGER DEFAULT 0 NOT NULL,
    remote_result_key TEXT,
    remote_raw_snippet TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL
);

-- 审计日志
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    actor_type TEXT NOT NULL,
    actor_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    target_type TEXT NOT NULL,
    target_id INTEGER,
    detail_json TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL
);

-- 使用记录表
CREATE TABLE IF NOT EXISTS usage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    guest_id INTEGER NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
    plate_number TEXT NOT NULL,
    request_success INTEGER DEFAULT 0 NOT NULL,
    response_data TEXT,
    created_at TEXT DEFAULT (datetime('now', 'localtime')) NOT NULL
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone);
CREATE INDEX IF NOT EXISTS idx_guests_plate ON guests(plate_number);
CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status);
CREATE INDEX IF NOT EXISTS idx_guests_lookup ON guests(name, phone);
CREATE INDEX IF NOT EXISTS idx_submission_logs_created ON submission_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_created ON usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_guest ON usage_logs(guest_id);
CREATE INDEX IF NOT EXISTS idx_discount_types_code ON discount_types(code);
CREATE INDEX IF NOT EXISTS idx_discount_types_active ON discount_types(is_active);

-- 初始化默认设置
INSERT OR IGNORE INTO settings (key, value) VALUES 
    ('url_24hour', ''),
    ('url_5day', ''),
    ('jsessionid_24hour', ''),
    ('jsessionid_5day', ''),
    ('referer_24hour', ''),
    ('referer_5day', ''),
    ('post_params_24hour', ''),
    ('post_params_5day', ''),
    ('default_use_count', '3'),
    ('error_redirect_url', ''),
    ('log_enabled', 'false'),
    ('log_retention_days', '7'),
    ('pay_url', ''),
    ('welcome_url', '');

-- 初始化默认优惠类型
INSERT OR IGNORE INTO discount_types (code, name, description, color, sort_order, is_system, is_active) VALUES
    ('24hour', '24小时优惠', '短期停车优惠，适用于1天内离店', 'orange', 1, 1, 1),
    ('5day', '5天优惠', '长期停车优惠，适用于多日住宿', 'purple', 2, 1, 1);
