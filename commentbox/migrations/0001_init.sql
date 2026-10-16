-- CommentBox schema (SQLite / Cloudflare D1). Applied by both servers on start or via wrangler d1 migrations apply.
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new',
  type TEXT NOT NULL,
  text TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  page_url TEXT NOT NULL,
  pathname TEXT NOT NULL,
  selector TEXT,
  tag_name TEXT,
  element_text TEXT,
  rect TEXT,
  scroll_y REAL NOT NULL DEFAULT 0,
  viewport_width INTEGER NOT NULL DEFAULT 0,
  viewport_height INTEGER NOT NULL DEFAULT 0,
  device_pixel_ratio REAL NOT NULL DEFAULT 1,
  user_agent TEXT NOT NULL DEFAULT '',
  screenshot_id TEXT,
  meta TEXT,
  note TEXT
);
CREATE INDEX IF NOT EXISTS comments_created_at ON comments (created_at);
CREATE INDEX IF NOT EXISTS comments_status ON comments (status);

CREATE TABLE IF NOT EXISTS screenshots (
  id TEXT PRIMARY KEY,
  mime TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  comment_id TEXT,
  event TEXT NOT NULL,
  url TEXT NOT NULL,
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  last_status INTEGER,
  last_error TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS deliveries_due ON deliveries (status, next_attempt_at);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
