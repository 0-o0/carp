-- Hotel parking management schema (SQLite / Cloudflare D1)

CREATE TABLE IF NOT EXISTS admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  is_super_admin INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  must_change_password INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS guests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  room_number TEXT NOT NULL,
  plate_number TEXT,
  use_count INTEGER DEFAULT 3,
  uses_default_snapshot INTEGER DEFAULT 3,
  check_in_time TEXT NOT NULL,
  check_out_time TEXT NOT NULL,
  discount_type TEXT CHECK(discount_type IN ('24hour', '5day')) NOT NULL,
  status TEXT CHECK(status IN ('active', 'exhausted', 'expired', 'disabled')) DEFAULT 'active',
  created_by INTEGER,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  updated_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (created_by) REFERENCES admins(id)
);

CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  value TEXT NOT NULL,
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

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
  updated_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS submission_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id INTEGER NOT NULL,
  discount_type TEXT CHECK(discount_type IN ('24hour', '5day')) NOT NULL,
  plate_used TEXT NOT NULL,
  request_ok INTEGER DEFAULT 0,
  remote_result_key TEXT,
  remote_raw_snippet TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (guest_id) REFERENCES guests(id)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_type TEXT NOT NULL,
  actor_id INTEGER NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  detail_json TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime'))
);

CREATE TABLE IF NOT EXISTS usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  guest_id INTEGER NOT NULL,
  plate_number TEXT NOT NULL,
  request_success INTEGER DEFAULT 0,
  response_data TEXT,
  created_at TEXT DEFAULT (datetime('now', 'localtime')),
  FOREIGN KEY (guest_id) REFERENCES guests(id)
);

CREATE INDEX IF NOT EXISTS idx_admins_username ON admins(username);
CREATE INDEX IF NOT EXISTS idx_guests_phone ON guests(phone);
CREATE INDEX IF NOT EXISTS idx_guests_room ON guests(room_number);
CREATE INDEX IF NOT EXISTS idx_guests_plate ON guests(plate_number);
CREATE INDEX IF NOT EXISTS idx_guests_status ON guests(status);
CREATE INDEX IF NOT EXISTS idx_guests_lookup ON guests(name, phone, room_number);
CREATE INDEX IF NOT EXISTS idx_submission_logs_created ON submission_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at);

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
  ('error_redirect_url', '');

