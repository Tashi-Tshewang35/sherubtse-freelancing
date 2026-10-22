# Sherubtse profile and shared calendar update

The existing MVC layout, email verification, dual roles, employer approvals, urgent recruitment and MongoDB ratings remain in place. Backups are in `backups/before-profile-calendar` (ignored by Git). The real `.env` was not read or changed.

## Install and run

1. Back up your PostgreSQL database through pgAdmin.
2. For an existing database, run `npm.cmd run migrate:profiles` to create a PostgreSQL backup and apply the migration automatically, or run `database/profile_calendar_migration.sql` in its pgAdmin Query Tool. Do not rerun the base schema to upgrade.
3. For a new database, run `database/postgresql_schema.sql`, then `database/profile_calendar_migration.sql`.
4. Keep PostgreSQL and MongoDB running. Copy `.env.example` to `.env` only for a new installation, and enter your own settings. Existing installations retain their `.env`.
5. On Windows PowerShell:

```powershell
npm.cmd install
npm.cmd test
npm.cmd start
```

Use `npm.cmd run dev` for development; `npm.cmd run seed:admin` creates the administrator if needed. Open http://localhost:3000. No new npm dependency is needed.

## Database changes

| Object | Purpose |
| --- | --- |
| student_profiles | One profile per student, unique eight-digit student number and biography. Existing student numbers are derived from verified-format education emails. New student accounts receive profiles through a trigger. Student numbers and education emails are identity fields and cannot be edited through the profile form. |
| skills | Shared skill catalogue with predefined choices and custom skills; a case-insensitive unique index prevents duplicates. |
| user_skills | Normalized many-to-many assignments with a composite primary key. Editing the profile replaces assignments transactionally. Removing a skill removes only the assignment, preserving shared catalogue entries. |
| employer_types | Predefined employer classification lookup. |
| employer_profiles | One business profile per employer; type foreign key, optional custom Other type, description, location, contact and update timestamp. Pending and rejected employers may edit profiles but cannot publish or recruit. |
| jobs | Application opening/closing timestamps, publication timestamp, draft/cancelled statuses and a window index. CHECK requires opening < closing <= work start. Legacy postings receive opening=min(created_at,start minus one second), closing=start, publication=created_at. Existing records are preserved. |
| application_status_history | Initial status snapshot for existing applications, then an insert/update trigger records every transition, including automatic withdrawals. Index supports history lookup. Earlier historical transitions cannot be reconstructed from existing records. |

The migration runs transactionally and can be rerun. No tables are dropped and no existing rows are deleted. Foreign keys preserve ownership and referential integrity. Profile and history primary keys, uniqueness checks, timestamps and indexes are included.

PostgreSQL owns accounts, verification, roles, profiles, skills, businesses, postings, applications, their progress, calendars and rating summaries. MongoDB continues to own individual rating documents/comments and persistent login sessions. No MongoDB migration is needed. Employer ratings are not introduced because the existing system only rates students.

## Behaviour

An employer-only account sees its own postings in its calendar. An employee account sees published work while its application window is open, plus its own application history. A dual-role account receives both sets, without duplicate work entries. Employers whose approval has been revoked cannot use employer routes; permissions refresh from PostgreSQL on requests.

Application opening is inclusive and closing is exclusive. Draft, closed and cancelled work cannot accept new applications. Normal employers can decide applications after the closing deadline while the posting remains open and work has not ended; urgent direct recruitment requires an open application window. Bhutan time is used for entered schedules. Students cannot apply to their own postings.

Only drafts can be edited so existing recruited schedules remain stable. Publish a saved draft from its details page. Cancellation withdraws pending applications and retains accepted/completed records for recruitment history. A manual inactive status hides a student from urgent recruitment. Accepted/completed work and calendar tasks make the student unavailable for overlapping schedules without disabling availability globally. Accepting/recruiting withdraws overlapping pending applications.

Applicants link to profiles showing skills, availability, completed work, rating average and MongoDB rating history. Account profiles are accessible to their owner, administrators and approved employers with an application from that student. Password hashes and verification/session secrets are never selected for these pages.

## Testing

`npm.cmd test` runs the full HTTP workflow test (with temporary accounts and cleanup), alongside existing verification and MongoDB session checks plus `tests/profile-calendar.test.js`. The new integration test applies the migration inside a rolled-back transaction, creates temporary users/postings and checks predefined/custom skills, editing/removal, employer profiles, window boundaries, employer-only and dual-role calendars, draft editing/publication, applicant summaries, conflict withdrawal and progress history. It renders the new templates. PostgreSQL sequences may advance during rolled-back tests, which is normal. Use a dedicated test database for running the complete suite.

Manual checks after applying the migration:

1. Student: add several predefined skills and Other skills, including repeated names; save, edit and remove. Verify biography, identity, availability and ratings.
2. Employer: create/edit business information; choose Other and require a custom type. With pending/rejected approval, attempt posting and recruitment and verify access denial.
3. Publish future-opening work, open work, expired work and a draft. Compare the student, employer-only, owner and dual-role calendars. Click entries and check dates, wage, business, location, urgency and application status. Submit an application directly after its deadline to verify the server rejects it.
4. Apply to overlapping postings; accept one and verify the other is withdrawn, history records the change and urgent recruitment excludes the occupied student. Reject another application; complete accepted work; rate it and inspect rating history.
5. Administrator: search by name/email/student number; select employee, employer, both and admin roles; filter every employer approval and application status. Open user details to inspect application and recruitment history.
6. Attempt admin routes as a student, another employer's applicant list, another account's profile and another employer's draft editing. Expect denial. Revoke employer approval while logged in and verify the next request is denied.
7. Check profile, admin, applicant and calendar pages at phone and desktop widths. Browser appearance and the complete manual matrix require review in your environment.

## Progress report screenshots

- Student identity, biography, multi-select and Other skills.
- Applications showing all five status badges, schedule, wage and progress.
- Applicant review with skills, schedule availability and rating history.
- Administrator account search, dual-role filter, approval list and application status filters.
- Employer business profile with Other type and approval status.
- Student calendar with open, applied, accepted, completed and closed colours.
- Employer-only calendar alongside dual-role calendar for the same work.
- Draft edit/publish screen and work details showing all four timestamps.
- Overlap withdrawal and application status history.
- pgAdmin migration results and new tables; MongoDB rating document with comments.
- Test output and an unauthorized-access screen.

Avoid capturing `.env`, password hashes, verification tokens or session data in screenshots.

## Fix for the ?Unable to continue? error

The running database was missing the new profile tables and job application-window columns. The upgrade has now been applied to the configured database after a custom-format pg_dump backup in `backups/`. The application checks its database schema before listening and reports the migration command if it is missing, preventing misleading page errors on an unupgraded database.

For another installation, use `npm.cmd run migrate:profiles` before `npm.cmd start`. If pg_dump is installed elsewhere, set `PG_DUMP_PATH` to its executable. The backup includes private account data: keep the ignored `backups/` directory private. Restore it using pgAdmin Restore if needed.

`tests/routes.test.js` checks real HTTP requests for public pages, all role dashboards/profiles, skill updates, employer profiles, posting, role visibility, applying, applicant access, acceptance/completion, MongoDB ratings, draft editing/publishing, admin filters and denied access. It requires an upgraded database and removes its temporary records and sessions afterward. Run the suite against a test database when possible.

## Calendar improvements

The calendar is now above the two-column dashboard and uses a full-width month view. Its detailed monthly/day list shows work title, employer, location, wages, urgency, application opening/closing dates, work schedule and the employee's application status. Selecting a date filters this list; work links open details. Today and month controls support navigation, with Bhutan dates independent of browser time zone. Overnight work appears on every occupied day, excluding the exact ending midnight.

Employee calendars refresh every 15 seconds and on returning to the tab. The API disallows caching. Failed refreshes retain existing items and report an error instead of displaying an apparently empty calendar. Personal tasks can be added and removed. Employer-owned drafts and future-opening postings have separate Draft and Scheduled labels; these postings remain hidden from other employees until published and open. The work form defaults application opening to now and explains future scheduling. Posting confirmation explains when employee calendars will display the work.

The two postings investigated during this fix had future application opening dates (October 16 and 17, 2026). Their dates were preserved. To make newly published work visible immediately, use an application opening time of now or earlier and a future closing time. Existing open posting dates are not changed automatically.

Added frontend calendar tests and HTTP tests for publication-window transitions, scheduled owner visibility, cache headers and dual-role eligibility. No further database migration is required for this calendar update.

## Development server port conflict

Run one application server at a time. Starting `npm.cmd run dev` while another `node app.js` instance is listening on port 3000 causes `EADDRINUSE` and nodemon reports ?app crashed?. Stop the earlier server with Ctrl+C, then start or restart the development server. The temporary server used during calendar verification has been stopped.

The development watcher now watches application code and `.env` only. Changes to tests and backed-up source files do not restart the app. EJS/CSS changes appear on browser reload in development without restarting Node.
