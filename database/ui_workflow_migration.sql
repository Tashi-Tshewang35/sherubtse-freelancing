-- Run after profile_calendar_migration.sql. Existing records are retained.
BEGIN;
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
