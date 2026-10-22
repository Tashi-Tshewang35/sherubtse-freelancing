const db = require('./db');
async function checkSchema() {
  const schema = await db.one(`SELECT to_regclass('public.student_profiles') IS NOT NULL
    AND to_regclass('public.employer_profiles') IS NOT NULL
    AND to_regclass('public.notifications') IS NOT NULL
    AND to_regclass('public.skills') IS NOT NULL
    AND to_regclass('public.user_skills') IS NOT NULL
    AND to_regclass('public.employer_types') IS NOT NULL
    AND to_regclass('public.application_status_history') IS NOT NULL
    AND EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='jobs' AND column_name='application_opens_at')
    AND EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='jobs' AND column_name='application_closes_at')
    AND EXISTS(SELECT 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name='jobs' AND column_name='published_at') AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='student_profiles' AND column_name='availability_before_work')
    AND EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='jobs' AND column_name='requirements') AS ready`);
  if (!schema.ready) throw new Error('Database upgrade required: run npm.cmd run migrate:profiles (or apply database/profile_calendar_migration.sql in pgAdmin), then run npm.cmd run migrate:ui and restart.');
}
module.exports = { checkSchema };
