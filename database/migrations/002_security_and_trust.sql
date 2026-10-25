-- Additive upgrade. Apply after 001; existing accounts and records are retained.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_expires_at TIMESTAMPTZ;
CREATE UNIQUE INDEX IF NOT EXISTS users_reset_token_unique ON users(reset_token_hash) WHERE reset_token_hash IS NOT NULL;
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_account_status_check;
ALTER TABLE users ADD CONSTRAINT users_account_status_check CHECK(account_status IN ('active','deactivated','suspended','deleted'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS saved_jobs (
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 job_id INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id,job_id)
);
CREATE TABLE IF NOT EXISTS reports (
 id SERIAL PRIMARY KEY, reporter_id INTEGER NOT NULL REFERENCES users(id),
 target_user_id INTEGER REFERENCES users(id), job_id INTEGER REFERENCES jobs(id),
 kind VARCHAR(20) NOT NULL CHECK(kind IN ('job','user','complaint')),
 subject VARCHAR(150) NOT NULL, details VARCHAR(3000) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK(status IN ('open','under_review','resolved','dismissed')),
 resolution VARCHAR(1500) NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS reports_status_date ON reports(status,created_at DESC);
CREATE TABLE IF NOT EXISTS audit_records (
 id SERIAL PRIMARY KEY, actor_id INTEGER REFERENCES users(id), action VARCHAR(80) NOT NULL,
 target_type VARCHAR(40) NOT NULL, target_id VARCHAR(80) NOT NULL,
 note VARCHAR(1500) NOT NULL DEFAULT '', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_records_date ON audit_records(created_at DESC);
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK(status IN ('pending','under_review','invited','accepted','in_progress','completed','rejected','declined','withdrawn'));
ALTER TABLE application_status_history DROP CONSTRAINT IF EXISTS application_status_history_status_check;
ALTER TABLE application_status_history ADD CONSTRAINT application_status_history_status_check CHECK(status IN ('pending','under_review','invited','accepted','in_progress','completed','rejected','declined','withdrawn'));
COMMIT;
