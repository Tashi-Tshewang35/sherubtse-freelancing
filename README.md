> **Current platform upgrade:** Follow [docs/PLATFORM_UPGRADE.md](docs/PLATFORM_UPGRADE.md) for the current architecture, migrations, environment variables, seed safety, test commands, and Render deployment. Migration **002** is required before starting this version. Earlier setup notes below are historical where they differ.

## Current setup and release commands

Use Node.js 22 or newer. Preserve an existing `.env`; for a new checkout only, copy
`.env.example` to `.env` and fill placeholders privately. Never commit credentials.

```sh
npm ci
```

New PostgreSQL databases need `database/postgresql_schema.sql`, then
`database/migrations/001_professional_upgrade.sql`, then
`database/migrations/002_security_and_trust.sql`, in that order. Existing upgraded
databases need only migration 002. Back up first; the explicit command below makes
a local `pg_dump` backup and refuses to migrate if that fails:

```sh
npm run migrate:security
npm run seed:admin
npm run dev
```

Administrator setup uses `ADMIN_NAME`, `ADMIN_EMAIL`, and `ADMIN_PASSWORD`; ordinary
registration never grants administrator access. Passwords need at least 8 characters
and must fit within bcrypt's 72-byte limit. Existing hashes remain usable.

MongoDB Atlas: create a database user with access only to the application database,
permit the hosting service's network access, and privately set `MONGODB_URI` and
`MONGODB_DB`. The application creates session, rate-limit, and rating indexes without
deleting documents. PostgreSQL remains required for core records.

Email: retain the existing provider settings. `gmail` uses `GMAIL_USER` and
`GMAIL_APP_PASSWORD`; `gmail-api` additionally uses `GOOGLE_CLIENT_ID`,
`GOOGLE_CLIENT_SECRET`, and `GOOGLE_REFRESH_TOKEN`; `resend` uses `RESEND_API_KEY` and
`EMAIL_FROM`. Set `APP_URL` to the HTTPS public origin. Verification links last 24
hours; single-use password-reset links last 30 minutes. No new required Render
variables were introduced.

Tests only use the separately named PostgreSQL and MongoDB test databases:

```sh
npm run test:setup
npm test
npm run lint
npm run test:start
npm audit --omit=dev
```

Development demonstration data is optional: `npm run seed:demo`. It requires
`NODE_ENV=development`, `ALLOW_DEMO_SEED=true`, `DEMO_SEED_PASSWORD`, and local
PostgreSQL/MongoDB database names ending in `_demo`. It refuses production and
remote targets, never deletes existing records, and never prints passwords.

Render: use Node 22+, build command `npm ci --omit=dev`, start command `npm start`,
and health-check path `/health`. Configure `NODE_ENV=production`, `SESSION_SECRET`,
`DATABASE_URL` (or the existing `DB_*` variables), MongoDB, email, and administrator
settings privately. The server binds to `process.env.PORT`. Docker uses the same
production dependencies and `node server.js`; EJS needs no frontend build step.
Apply migration 002 with a backup before deploying this branch. Merge and deployment
require the owner's approval; neither is performed by these commands automatically.

---

The following sections retain earlier project documentation for reference.

> **October 2026 redesign:** See [REDESIGN.md](REDESIGN.md) for the current setup, migration, verification results, changed files and manual checks. Existing installations need `npm.cmd run migrate:ui` after the profile migration. Your existing `.env` should be retained.

# Sherubtse Freelancing

Sherubtse Freelancing is an MVC web application for short-term work within Sherubtse College and the Kanglung community. Verified students can apply for jobs. Approved employers can publish jobs, review applicants, directly recruit available students for urgent work, confirm completion and rate employees.

## Technology

For public HTTPS hosting and verification across devices and networks, follow
[DEPLOYMENT.md](DEPLOYMENT.md). Production settings are documented in
`.env.production.example`; keep real credentials in your host's secret settings.

- Node.js and Express
- EJS views with shared partials
- PostgreSQL with pg-promise for users, jobs, applications and calendar tasks
- MongoDB native driver for ratings and written feedback
- bcrypt password hashing
- express-session authentication
- Nodemailer Gmail verification links

## Account rules

- A student email must match `8-digit-student-number.sherubtse@rub.edu.bt`, for example `07240057.sherubtse@rub.edu.bt`
- Clicking the emailed verification link activates the account.
- Students can apply for jobs.
- Employer accounts require email verification and administrator approval.
- A student may also request employer access. The same account can then apply as a student and post as an approved employer.
- A non-student employer cannot apply for student jobs.

## 1. Open the project in VS Code

Open the `sherubtse-freelance` folder, then open its terminal.

```bash
npm install
```

## 2. Create the PostgreSQL database in pgAdmin

1. Open pgAdmin.
2. Right-click **Databases** and choose **Create > Database**.
3. Name it `sherubtse_freelance_db`.
4. Open its **Query Tool**.
5. Open and run `database/postgresql_schema.sql`.

The SQL is kept separately from the VS Code application files, as requested.

## 3. Prepare MongoDB

Start MongoDB locally. The application creates the database and indexes automatically when it starts. To create the validated collection manually, run `database/mongodb_setup.js` in MongoDB Compass mongosh.

## 4. Configure environment variables

Copy `.env.example` to `.env` and replace the placeholder values. For Gmail:

1. Enable 2-Step Verification on the sender Gmail account.
2. Create a Google App Password for Mail.
3. Put the Gmail address in `GMAIL_USER`.
4. Put the 16-character app password in `GMAIL_APP_PASSWORD`.

Never upload `.env` to GitHub.

Email verification uses real Gmail delivery. Set GMAIL_USER to your sending Gmail
address, GMAIL_APP_PASSWORD to its Google App Password, and APP_URL to
http://localhost:3000 locally (your HTTPS public URL when deployed). Ordinary Gmail
passwords cannot be used. Students and employees require a Sherubtse student email;
employers can use a normal valid email. Both accounts use one verification link.

For an existing database, run npm run migrate:verification before starting the app.
New database setups use database/postgresql_schema.sql. Links expire after 24 hours;
resending replaces the previous link and requires the registered password. Requests
are limited to one per minute per account. Failed deliveries can be retried immediately
at /resend-verification. Old pre-migration links must be resent. Verification does
not approve employers: students can log in and work while employer access remains
pending administrator approval. APP_URL must be reachable by the email recipient;
localhost links only work on the machine running the app.

Run npm test for automated verification flow tests. Live registration also needs
working PostgreSQL credentials, the schema/migration, and reachable Gmail SMTP.

## 5. Create the first administrator

After running the PostgreSQL schema and setting `ADMIN_EMAIL` and `ADMIN_PASSWORD`:

```bash
npm run seed:admin
```

Log in with that account and open `/admin` to approve employers.

## 6. Run the project

```bash
npm run dev
```

Open `http://localhost:3000`.

To open email verification links on another device, connect both devices to the
same Wi-Fi. Set `HOST=0.0.0.0` and `APP_URL=http://YOUR_COMPUTER_WIFI_IP:3000`
in `.env`, then restart the app and request a new verification email. Open that
same URL on the other device to check access first. Existing emails still contain
the old URL. Wi-Fi addresses can change; update `APP_URL` when yours changes.
Windows Firewall must allow the Node.js application on your trusted network.
Some campus or guest Wi-Fi networks block connections between devices. For access
from any network, deploy the app and set `APP_URL` to its public HTTPS address.

## Main workflow

1. A student creates an account with a Sherubtse education email.
2. The system sends a verification link using Nodemailer.
3. An employer verifies their email and waits for administrator approval.
4. An approved employer posts a job with work type, wage, workers needed, location and working hours.
5. A student applies for an open job.
6. The employer accepts or rejects the application.
7. Acceptance uses a PostgreSQL transaction. If another accepted job overlaps, recruitment stops. Other pending applications that overlap are automatically withdrawn.
8. Urgent jobs allow direct recruitment of a verified student who is available during the job period.
9. Accepted jobs and personal tasks appear in the dashboard calendar.
10. After completion, the employer rates the employee. MongoDB stores the rating and comment; PostgreSQL stores an updated rating summary for fast applicant display.

## MVC folder structure

```text
config/       PostgreSQL, MongoDB and email configuration
controllers/  Request validation and business decisions
models/       PostgreSQL queries, transactions and MongoDB operations
routes/       Page routes and REST API routes
views/        EJS pages and partials
public/       CSS and browser-side calendar JavaScript
database/     Separate pgAdmin SQL and MongoDB setup
scripts/      Administrator seeding
```

## Important test cases

- Reject an invalid student email such as `student@gmail.com` when student mode is selected.
- Verify that an unverified account cannot log in.
- Verify that a pending employer cannot post a job.
- Approve the employer from the admin dashboard, log out and back in, then post a job.
- Apply to two jobs with overlapping hours and accept one. The other pending application should become `withdrawn`.
- Try direct recruitment on a normal job. The server should reject it.
- Complete a job, submit a rating, and confirm it appears on the student dashboard.
- Add a personal calendar task and confirm it appears without reloading the page.


## Profile and calendar upgrade

See [PROJECT_UPDATE.md](PROJECT_UPDATE.md) for the pgAdmin migration, updated profiles/calendar/admin features, setup commands, tests and progress-report screenshots. Existing databases must run `database/profile_calendar_migration.sql` before starting this version.
