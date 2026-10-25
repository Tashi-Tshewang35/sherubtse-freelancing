# Sherubtse Freelancing platform upgrade

## Architecture and compatibility

The application remains an Express MVC project with EJS views and progressive
browser JavaScript. `app.js` exports the app; `server.js` validates configuration,
checks database schema, connects MongoDB and binds to `PORT` on `0.0.0.0`.
There is no frontend compilation step.

PostgreSQL owns accounts, profiles, skills, jobs, applications, application history,
calendar tasks, notifications, saved jobs, reports and administrator audit records.
MongoDB owns sessions, shared rate-limit buckets and full rating documents. The
PostgreSQL rating summary remains a derived cache. Existing identities, hashes,
relationships and MongoDB documents are retained.

## Migration and rollback

Before updating production, take tested PostgreSQL and MongoDB backups. Existing
installations with professional migration 001 need migration 002. Run:

```sh
npm run migrate:security
```

This uses `PG_DUMP_PATH` or an installed `pg_dump`, saves a custom-format backup in
ignored `backups/`, then applies `database/migrations/002_security_and_trust.sql`.
If backup fails, no migration is applied. The SQL is transactional and repeatable.
Alternatively apply it manually after taking a verified backup. It never runs at
startup. Test setup applies it only to the explicitly named test databases.

New installations apply the base schema, migration 001 and migration 002 in order.
Migration 001's status checks also recognize `under_review` for safe reruns.

002 adds account status, session version, hashed reset tokens and expiry to users;
job suspension; saved jobs; reports and audit records; and the under-review
application status. It does not drop existing tables, records or MongoDB fields.
Review moderation adds optional `hidden`, `moderationReason`, `moderatedAt` and
`moderatedBy` fields to existing rating documents. Legacy documents remain visible
unless explicitly hidden.

For rollback, stop new writes and return to the prior application release without
removing additive columns. Older status validators may not recognize under-review
records. Do not run destructive down migrations; use your verified backup and
an operator-reviewed recovery plan if a database restoration is necessary.

## Environment and administrator setup

No new required Render environment variable is introduced. Keep existing secrets.

| Purpose | Variables |
| --- | --- |
| Runtime | `NODE_ENV=production`, Render-supplied `PORT`, Node 22+ |
| Sessions | `SESSION_SECRET` with at least 32 random characters |
| Public origin | `APP_URL` HTTPS origin, or Render's `RENDER_EXTERNAL_URL` |
| PostgreSQL | `DATABASE_URL`, or `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS`; `DB_SSL=true` for verified TLS where required |
| MongoDB Atlas | `MONGO_URI` or backwards-compatible `MONGODB_URI`, plus `MONGODB_DB` |
| Email provider | `EMAIL_PROVIDER` (`gmail`, `gmail-api`, `resend`) |
| Gmail SMTP | `GMAIL_USER`, `GMAIL_APP_PASSWORD` |
| Gmail API | `GMAIL_USER`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REFRESH_TOKEN` |
| Resend | `RESEND_API_KEY`, `EMAIL_FROM` |
| Admin bootstrap | `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` |
| Optional tooling | `PG_DUMP_PATH`, `TRUST_PROXY_HOPS` (default 1 behind Render) |

Choose only one mail provider. Password recovery reuses its delivery implementation
and the trusted configured origin, never the request Host header. Providers are
mocked in automated tests; actual inbox delivery must be verified by the operator.
Startup preserves the existing Render administrator bootstrap when `ADMIN_EMAIL`
and `ADMIN_PASSWORD` are configured; `npm run seed:admin` also supports deliberate
manual setup. No web signup can set `is_admin`.
Use a unique strong administrator password and never paste it into reports or logs.

Atlas must permit the hosting network and the configured database user. Duplicate
rating index creation errors are surfaced for review; no duplicates are deleted.
Keep private environment files, database dumps and generated delivery files out of
Git and Docker. `.env.example` has placeholders only.

## Security and account behavior

- All POST forms include session-bound CSRF tokens; calendar writes send the token
  in a header. Invalid or missing tokens fail before controllers mutate data.
- Authentication, signup, resend and reset requests have shared MongoDB rate limits
  per client IP. MongoDB failure does not disable rate limiting. Configure trusted
  proxy hops for the actual hosting topology; do not blindly trust arbitrary proxies.
- Login regenerates the session. Password reset is hashed, single-use and limited
  to 30 minutes. A session version invalidates existing sessions after password
  changes, suspension, deactivation or deletion.
- Deactivation disables access until an administrator reactivates it. Deletion
  anonymizes identity and removes profile details rather than breaking historical
  work and dispute references. Active work must be resolved first. Administrators
  cannot delete or suspend themselves through these controls.
- Passwords are accepted only when at least 8 characters and at most 72 UTF-8 bytes.
  Confirmation is checked on the server. Existing shorter passwords still work at
  login so existing users are not locked out; new passwords follow the stronger rule.
- Cookies are HTTP-only, SameSite Lax and Secure in production. Dynamic pages use
  no-store caching. Account queries exposed to templates exclude password hashes
  and reset/verification tokens.

## Workflows

An available student may apply to multiple jobs. Acceptance locks the student and
job, checks capacity and overlapping work/personal tasks, marks the student
unavailable and withdraws overlapping pending, under-review and invited applications.
The existing PostgreSQL triggers notify both parties and record status timestamps.
Completing or cancelling the last active placement restores prior/manual availability.
Users cannot override an active placement by selecting Available in their profile.

Employers can edit drafts and published open jobs before any applications exist.
After applications exist, cancel/repost to change the agreement. This avoids silently
changing a student's schedule after applying. Job edits and application creation
serialize on the posting row. Applications close at the deadline (exclusive).
Closed, cancelled, expired and suspended states are presented explicitly.

Students see eligible published work, including future scheduled application
openings, deadlines and their own placements. Employer-only calendars include only
their own jobs. Combined accounts switch dashboard modes, with employer mode
showing the employer calendar. Private applicant records are never exposed by the
calendar. Employers viewing a student profile see only their own application history.

The timeline is Applied → Under Review → Accepted → In Progress → Completed → Rated.
Employers can accept directly or complete accepted work for compatibility with the
existing workflow. Rated is derived from the rating document, rather than changing
the established completed application status. Rejected and withdrawn states remain
visible. Reviews require completed work and have a unique application/employer index.

Users submit reports privately and follow administrator responses. Administrators
review reports, suspend/reactivate access or job visibility, hide/restore abusive
reviews, and inspect moderation/application history. Admin lists are paginated on
the server. Payments are always arranged directly; no payment processing is added.

## Demonstration data

`npm run seed:demo` is never called by production startup, tests or migration. Use a
separate local PostgreSQL database and MongoDB database, both ending in `_demo`.
Bootstrap their schemas, set `NODE_ENV=development`, `ALLOW_DEMO_SEED=true`, and a
private `DEMO_SEED_PASSWORD`. The script rejects production, remote database hosts,
ordinary database names and missing/weak demo passwords before connecting.

The dataset includes one admin, two employer-only accounts, four students (one
combined account), five realistic jobs, pending/accepted/rejected/in-progress/
completed applications, personal/calendar work events, a rating and notifications.
Emails are fictional; no messages are sent. Re-running skips an existing dataset
and never clears a database. Do not enable demo flags on Render.

## Verification commands

```sh
npm ci
npm run test:setup
npm test
npm run lint
npm run test:start
npm audit --omit=dev
```

Test isolation requires `sherubtse_freelance_test_db` for PostgreSQL and
`sherubtse_freelance_test_feedback` for MongoDB. Configure `.env.test` privately or
use CI settings. Tests refuse other database names and do not send real email.
The lint command compiles JavaScript/EJS and checks CSRF form coverage and private
field exclusion; it is a lightweight project lint, not ESLint.

For fictional-data UI review run `npm run preview:ui`. The retained Chrome DevTools
browser checker covers 360, 768 and 1440 pixel widths without a browser dependency
in production. Use a separate headless profile. It writes ignored screenshots and
results under `delivery/`. Preview forms never save data and preview screenshots
do not establish real database/authentication behavior.

## Render and GitHub release

Keep the existing GitHub repository and Render service. The branch is
`improve/platform-security-workflows`; do not merge or deploy without owner approval.
Build: `npm ci --omit=dev`. Start: `npm start`. Health: `/health`.
Docker retains Node 22 Alpine, production-only installation, a non-root user and
`node server.js`. The process listens on Render's `PORT`.

Before an approved deploy: verify backups, apply migration 002, retain existing
runtime secrets, confirm PostgreSQL/Atlas access, run checks, and configure the
public HTTPS origin and mail provider. After deployment, verify health, a real
verification email and reset email, employer approval, one full placement, and
account/session behavior. Avoid logging raw tokens or credentials during checks.

## Remaining operational limits

- A public support email/phone and operator-approved policy/retention details were
  not provided. Contact states that accurately; legal/support copy needs owner review.
- Full MongoDB reviews and PostgreSQL summaries cannot share a cross-database
  transaction. A database failure after saving a review can temporarily leave a
  stale summary; the authoritative review remains in MongoDB. Moderation can retry
  summary refresh. This existing storage split is preserved.
- IP limits can affect a college network sharing one public IP. Tune limits based
  on observed traffic and consider an account-based or edge limit in a later release.
- Highest wage compares listed numerical rates; hour/day/task units need human
  comparison. Recommended jobs use transparent skill text matching.
- Suspension hides jobs and blocks new recruitment without deleting historical
  work; operators must resolve ongoing disputes and placements deliberately.
- Automated checks do not prove actual Render deployment, Linux Docker execution,
  real email delivery or all accessibility requirements. See the final implementation
  report for exactly what was run.
