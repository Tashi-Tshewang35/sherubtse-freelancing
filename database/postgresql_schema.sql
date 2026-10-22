-- SHERUBTSE FREELANCING: PostgreSQL schema
-- In pgAdmin, first create a database named sherubtse_freelance_db.
-- Open that database's Query Tool and run this entire file.

BEGIN;

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_student BOOLEAN NOT NULL DEFAULT false,
  is_employer BOOLEAN NOT NULL DEFAULT false,
  employer_status VARCHAR(20) NOT NULL DEFAULT 'not_requested'
    CHECK (employer_status IN ('not_requested', 'pending', 'approved', 'rejected')),
  is_admin BOOLEAN NOT NULL DEFAULT false,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  verification_token VARCHAR(255) UNIQUE,
  verification_expires_at TIMESTAMPTZ,
  verification_sent_at TIMESTAMPTZ,
  availability_status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (availability_status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (is_student = false OR email ~ '^[0-9]{8}\.sherubtse@rub\.edu\.bt$'),
  CHECK (is_employer = true OR employer_status = 'not_requested')
);

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  employer_id INTEGER NOT NULL REFERENCES users(id),
  title VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  work_type VARCHAR(60) NOT NULL,
  location VARCHAR(150) NOT NULL,
  wage_rate NUMERIC(10,2) NOT NULL CHECK (wage_rate > 0),
  wage_unit VARCHAR(20) NOT NULL CHECK (wage_unit IN ('hour', 'day', 'task')),
  workers_needed INTEGER NOT NULL DEFAULT 1 CHECK (workers_needed > 0),
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  urgency VARCHAR(20) NOT NULL DEFAULT 'normal' CHECK (urgency IN ('normal', 'urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);

CREATE TABLE IF NOT EXISTS applications (
  id SERIAL PRIMARY KEY,
  job_id INTEGER NOT NULL REFERENCES jobs(id),
  student_id INTEGER NOT NULL REFERENCES users(id),
  cover_note VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'rejected', 'withdrawn', 'completed')),
  source VARCHAR(30) NOT NULL DEFAULT 'application'
    CHECK (source IN ('application', 'direct_recruitment')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  decided_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  UNIQUE (job_id, student_id)
);

CREATE TABLE IF NOT EXISTS calendar_tasks (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(120) NOT NULL,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (end_at > start_at)
);

-- MongoDB stores full rating comments. This summary table makes applicant
-- sorting fast inside PostgreSQL without duplicating the review documents.
CREATE TABLE IF NOT EXISTS rating_summary (
  student_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  average_rating NUMERIC(3,2) NOT NULL DEFAULT 0 CHECK (average_rating BETWEEN 0 AND 5),
  rating_count INTEGER NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_employer ON jobs(employer_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status_start ON jobs(status, start_at);
CREATE INDEX IF NOT EXISTS idx_applications_job ON applications(job_id);
CREATE INDEX IF NOT EXISTS idx_applications_student_status ON applications(student_id, status);
CREATE INDEX IF NOT EXISTS idx_calendar_tasks_user_start ON calendar_tasks(user_id, start_at);

COMMIT;

-- Useful checks after setup:
-- SELECT * FROM users ORDER BY id;
-- SELECT * FROM jobs ORDER BY created_at DESC;
-- SELECT * FROM applications ORDER BY created_at DESC;

-- Next run migrations/001_professional_upgrade.sql for profiles and the full workflow.
