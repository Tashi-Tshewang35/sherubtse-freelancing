# PostgreSQL and pgAdmin

Existing data is preserved. PostgreSQL owns accounts/roles, work, applications/history, profiles/skills, calendars/tasks, notifications and the rating summary. MongoDB owns full ratings/comments.

## Connect and back up

1. Start PostgreSQL and open pgAdmin. The pgAdmin master password differs from the PostgreSQL role password.
2. Expand Servers → your server → Databases → `sherubtse_freelance_db`. If needed, Register → Server: enter localhost, port 5432, maintenance database postgres and your role credentials under Connection.
3. Open Query Tool on the application database and run `SELECT current_database();`. Verify the result before executing changes.
4. Right-click the database → Backup → choose Custom format and a private file path. Check the process succeeds. Keep dumps out of GitHub/screenshots. Rehearse Restore into a separate database, not over working data.

`npm run migrate:professional` first creates a private pg_dump backup and refuses to migrate if backup fails. Set PG_DUMP_PATH if required. Keep matching source and database backups. Do not rerun older migration commands individually after adopting new application statuses.

## Fresh database

1. Right-click Databases → Create → Database. Use `sherubtse_freelance_db` only if absent, or choose a different name for a separate installation.
2. In Query Tool for the new database, open and execute `database/postgresql_schema.sql`.
3. Open and execute `database/migrations/001_professional_upgrade.sql` in the same database. Both files are needed for a complete fresh setup.
4. Check Messages, then refresh Schemas → public → Tables.

## Existing database

Back up and verify the selected database. Execute **only** `database/migrations/001_professional_upgrade.sql`. It adds missing structures transactionally without dropping tables or deleting user/work records. It supports the current schema; historical files remain for reference. Legacy verification links without expiry remain unusable and can be resent.

This implementation does not automatically upgrade the development/production database. The current workspace already had the profile/calendar/UI schema from the earlier redesign.

## Check tables

```sql
SELECT current_database();
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;
SELECT id,title,status FROM jobs ORDER BY id DESC LIMIT 5;
SELECT id,status FROM applications ORDER BY id DESC LIMIT 5;
```

Expect users, jobs, applications, calendar_tasks, rating_summary, student_profiles, skills, user_skills, employer_types, employer_profiles, application_status_history and notifications. Refresh the object tree when needed. Do not display password hashes or verification tokens in screenshots.

## Separate test database

Connect Query Tool to `postgres` and execute this statement alone, outside a transaction:

```sql
CREATE DATABASE sherubtse_freelance_test_db;
```

Switch Query Tool to that database, verify current_database(), then run `database/test_database_setup.sql`. Its database-name guard protects other databases. Configure `.env.test` with the exact test name; do not change development `.env`. `npm run test:setup` is the command-line alternative.

## SSL and common errors

Local PostgreSQL normally uses `DB_SSL=false`; hosted PostgreSQL such as Neon uses `DB_SSL=true` with certificate verification. The app accepts DATABASE_URL or separate DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS variables. DATABASE_URL takes precedence; clear it when using separate fields. The password variable is DB_PASS, not DB_PASSWORD. URL-encode passwords inside connection URLs.

| Error | What to check |
| --- | --- |
| Connection refused | PostgreSQL service, host and port; a hosted app cannot use localhost to reach your PC |
| Password authentication failed | PostgreSQL username/password, not pgAdmin master password |
| Database missing | Create it first; check DB_NAME/DATABASE_URL |
| Permission denied creating database | Use an authorized pgAdmin role; do not weaken production permissions |
| Missing relation/column | Correct database? Base+upgrade for fresh; upgrade for existing |
| SSL/certificate error | DB_SSL and provider TLS/CA requirements; do not disable verification as a general fix |
| Node port in use | Stop its existing process or choose a different HTTP PORT |
| Test-name guard fails | Correct the test names; do not remove the guard |
