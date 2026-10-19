CREATE TABLE IF NOT EXISTS oauth_states (state TEXT PRIMARY KEY, cookie_hash TEXT NOT NULL, challenge TEXT NOT NULL, client_state TEXT NOT NULL, port INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS auth_codes (code_hash TEXT PRIMARY KEY, challenge TEXT NOT NULL, user_id TEXT NOT NULL, username TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL, username TEXT NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS submissions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, username TEXT NOT NULL, kind TEXT NOT NULL, title TEXT NOT NULL, body TEXT NOT NULL, skin_url TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open', created INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS submission_feed ON submissions(kind,created);
CREATE TABLE IF NOT EXISTS rate_limits (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS notifications (submission_id TEXT PRIMARY KEY, sent INTEGER NOT NULL DEFAULT 0, attempts INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS profiles (user_id TEXT PRIMARY KEY, color TEXT NOT NULL DEFAULT '#9bb9ff');

CREATE TABLE IF NOT EXISTS mentions (id TEXT PRIMARY KEY, submission_id TEXT NOT NULL, recipient_id TEXT NOT NULL, sender_id TEXT NOT NULL, sender_name TEXT NOT NULL, body TEXT NOT NULL, created INTEGER NOT NULL, read_at INTEGER);
CREATE INDEX IF NOT EXISTS mentions_recipient ON mentions(recipient_id,created);
CREATE TABLE IF NOT EXISTS request_media (id TEXT PRIMARY KEY, user_id TEXT NOT NULL, name TEXT NOT NULL, kind TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL, created INTEGER NOT NULL, expires INTEGER NOT NULL, submission_id TEXT, ready INTEGER NOT NULL DEFAULT 0);
CREATE INDEX IF NOT EXISTS request_media_submission ON request_media(submission_id);
CREATE INDEX IF NOT EXISTS request_media_expiry ON request_media(expires);
CREATE TABLE IF NOT EXISTS r2_budget (id INTEGER PRIMARY KEY CHECK(id=1), cycle_start INTEGER NOT NULL, cycle_end INTEGER NOT NULL, verified_at INTEGER NOT NULL, baseline_a INTEGER NOT NULL, baseline_b INTEGER NOT NULL, used_a INTEGER NOT NULL DEFAULT 0, used_b INTEGER NOT NULL DEFAULT 0, storage_bytes INTEGER NOT NULL, baseline_note TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS r2_storage_reservations (id TEXT PRIMARY KEY, bytes INTEGER NOT NULL CHECK(bytes>=0), created INTEGER NOT NULL);
