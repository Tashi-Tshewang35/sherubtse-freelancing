-- First create sherubtse_freelance_test_db in pgAdmin, then connect to it.
DO $$ BEGIN
 IF current_database() <> 'sherubtse_freelance_test_db' THEN
  RAISE EXCEPTION 'Select sherubtse_freelance_test_db; no other database is allowed';
 END IF;
END $$;
-- SHERUBTSE FREELANCE: PostgreSQL schema
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

-- Next run profile_calendar_migration.sql to add profiles, skills and publication windows.

-- Sherubtse Freelancing: non-destructive upgrade of the existing base schema.
-- Back up first. Run against the selected application database, never another project.
BEGIN;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_expires_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verification_sent_at TIMESTAMPTZ;


-- Original migration: profile_calendar_migration.sql
CREATE TABLE IF NOT EXISTS student_profiles (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 student_number VARCHAR(8) UNIQUE NOT NULL CHECK (student_number ~ '^[0-9]{8}$'),
 bio VARCHAR(1000) NOT NULL DEFAULT '', updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO student_profiles(user_id,student_number) SELECT id,substring(email,1,8) FROM users WHERE is_student ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS skills (
 id SERIAL PRIMARY KEY, name VARCHAR(80) NOT NULL CHECK (length(trim(name)) > 0), predefined BOOLEAN NOT NULL DEFAULT false
);
CREATE UNIQUE INDEX IF NOT EXISTS skills_name_unique ON skills(lower(name));
INSERT INTO skills(name,predefined) VALUES ('Cleaning',true),('Food service',true),('Tutoring',true),('Delivery',true),('Event assistance',true),('Shop assistance',true),('Data entry',true),('Photography',true),('Technical support',true) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS user_skills (
 user_id INTEGER REFERENCES users(id) ON DELETE CASCADE, skill_id INTEGER REFERENCES skills(id),
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(user_id,skill_id)
);
CREATE INDEX IF NOT EXISTS user_skills_skill ON user_skills(skill_id);
CREATE TABLE IF NOT EXISTS employer_types(id SERIAL PRIMARY KEY,name VARCHAR(80) UNIQUE NOT NULL);
INSERT INTO employer_types(name) VALUES ('Restaurant or caf?'),('Shop'),('College department'),('Event organiser'),('Individual'),('Organisation'),('Other') ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS employer_profiles (
 user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 business_name VARCHAR(150) NOT NULL CHECK(length(trim(business_name))>0), type_id INTEGER NOT NULL REFERENCES employer_types(id),
 custom_type VARCHAR(80) CHECK(custom_type IS NULL OR length(trim(custom_type))>0), description VARCHAR(1000) NOT NULL DEFAULT '',
 location VARCHAR(150) NOT NULL, contact_number VARCHAR(30) NOT NULL,
 updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_opens_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS application_closes_at TIMESTAMPTZ;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
UPDATE jobs SET application_opens_at=LEAST(created_at,start_at-INTERVAL '1 second'), application_closes_at=start_at WHERE application_opens_at IS NULL;
UPDATE jobs SET published_at=created_at WHERE status <> 'draft' AND published_at IS NULL;
ALTER TABLE jobs ALTER COLUMN application_opens_at SET NOT NULL;
ALTER TABLE jobs ALTER COLUMN application_closes_at SET NOT NULL;
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check CHECK(status IN ('draft','open','closed','cancelled','completed'));
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_application_window_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_application_window_check CHECK(application_opens_at < application_closes_at AND application_closes_at <= start_at);
CREATE INDEX IF NOT EXISTS jobs_application_window ON jobs(status,application_opens_at,application_closes_at);
CREATE TABLE IF NOT EXISTS application_status_history (
 id SERIAL PRIMARY KEY, application_id INTEGER NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
 status VARCHAR(20) NOT NULL CHECK(status IN ('pending','accepted','rejected','withdrawn','completed')),
 changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS application_history_application ON application_status_history(application_id,changed_at);
INSERT INTO application_status_history(application_id,status,changed_at) SELECT id,status,COALESCE(completed_at,decided_at,created_at) FROM applications a WHERE NOT EXISTS(SELECT 1 FROM application_status_history h WHERE h.application_id=a.id);
CREATE OR REPLACE FUNCTION record_application_status() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' THEN
  INSERT INTO application_status_history(application_id,status) VALUES(NEW.id,NEW.status);
 ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO application_status_history(application_id,status) VALUES(NEW.id,NEW.status);
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS application_status_audit ON applications;
CREATE TRIGGER application_status_audit AFTER INSERT OR UPDATE OF status ON applications FOR EACH ROW EXECUTE FUNCTION record_application_status();
CREATE OR REPLACE FUNCTION create_student_profile() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.is_student THEN
  INSERT INTO student_profiles(user_id,student_number) VALUES(NEW.id,substring(NEW.email,1,8)) ON CONFLICT(user_id) DO NOTHING;
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS user_student_profile ON users;
CREATE TRIGGER user_student_profile AFTER INSERT OR UPDATE OF is_student ON users FOR EACH ROW EXECUTE FUNCTION create_student_profile();


-- Original migration: ui_workflow_migration.sql
-- Run after profile_calendar_migration.sql. Existing records are retained.
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS programme VARCHAR(120) NOT NULL DEFAULT '';
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS study_year VARCHAR(30) NOT NULL DEFAULT '';
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS contact VARCHAR(100) NOT NULL DEFAULT '';
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS experience VARCHAR(1500) NOT NULL DEFAULT '';
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS preferred_hours VARCHAR(250) NOT NULL DEFAULT '';
-- Remember the user's manual availability before automatic recruitment changes.
ALTER TABLE student_profiles ADD COLUMN IF NOT EXISTS availability_before_work VARCHAR(20);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS requirements VARCHAR(1500) NOT NULL DEFAULT '';
ALTER TABLE applications ADD COLUMN IF NOT EXISTS decision_note VARCHAR(500) NOT NULL DEFAULT '';
ALTER TABLE applications DROP CONSTRAINT IF EXISTS applications_status_check;
ALTER TABLE applications ADD CONSTRAINT applications_status_check CHECK(status IN ('pending','invited','accepted','in_progress','completed','rejected','declined','withdrawn'));
ALTER TABLE application_status_history DROP CONSTRAINT IF EXISTS application_status_history_status_check;
ALTER TABLE application_status_history ADD CONSTRAINT application_status_history_status_check CHECK(status IN ('pending','invited','accepted','in_progress','completed','rejected','declined','withdrawn'));
CREATE TABLE IF NOT EXISTS notifications (
 id SERIAL PRIMARY KEY,
 user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 category VARCHAR(30) NOT NULL,
 message VARCHAR(700) NOT NULL,
 href VARCHAR(150) NOT NULL DEFAULT '/dashboard',
 is_read BOOLEAN NOT NULL DEFAULT false,
 created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS notifications_user_date ON notifications(user_id,created_at DESC);
CREATE OR REPLACE FUNCTION notify_application_change() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE employer INTEGER; work_title TEXT;
BEGIN
 SELECT employer_id,title INTO employer,work_title FROM jobs WHERE id=NEW.job_id;
 IF TG_OP='INSERT' OR NEW.status IS DISTINCT FROM OLD.status THEN
  INSERT INTO notifications(user_id,category,message,href)
  VALUES(NEW.student_id,'application',left(work_title || ': ' || replace(NEW.status,'_',' ') || CASE WHEN NEW.decision_note<>'' THEN '. ' || NEW.decision_note ELSE '' END,700),'/jobs/' || NEW.job_id);
  INSERT INTO notifications(user_id,category,message,href)
  VALUES(employer,'recruitment',left(work_title || ': application ' || replace(NEW.status,'_',' '),700),'/jobs/' || NEW.job_id || '/applicants');
 END IF;
 RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS application_notifications ON applications;
CREATE TRIGGER application_notifications AFTER INSERT OR UPDATE OF status ON applications FOR EACH ROW EXECUTE FUNCTION notify_application_change();


COMMIT;
