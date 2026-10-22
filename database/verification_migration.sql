BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMPTZ;
-- Old links have no expiry and cannot be accepted. Accounts can request a new link.
UPDATE users SET verification_token = NULL
WHERE is_verified = false AND verification_expires_at IS NULL;
COMMIT;
