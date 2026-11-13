-- ============================================================================
-- ADDITIVE MIGRATION: SECURE ADMIN AUTHENTICATION FOR CLOUDFLARE D1
-- Project: Pizzeria Kamal Digital Menu & Administration
-- Description: Creates authentication and rate-limiting tables.
-- NON-DESTRUCTIVE: Does not modify or drop dishes, categories, or settings.
-- ============================================================================

-- 1. Admin Users Table (Stores salted & iterated PBKDF2-SHA256 password hashes)
CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  salt TEXT NOT NULL,
  iterations INTEGER NOT NULL DEFAULT 100000,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);

-- 2. Admin Sessions Table (Stores SHA-256 hashed session tokens, never raw tokens)
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  user_agent TEXT,
  ip TEXT,
  FOREIGN KEY (user_id) REFERENCES admin_users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON admin_sessions(user_id);

-- 3. Login Attempts Table (Brute-force protection & exponential backoff)
CREATE TABLE IF NOT EXISTS login_attempts (
  key TEXT PRIMARY KEY,
  attempt_count INTEGER DEFAULT 1,
  first_attempt_at INTEGER NOT NULL,
  locked_until INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_login_attempts_locked ON login_attempts(locked_until);
