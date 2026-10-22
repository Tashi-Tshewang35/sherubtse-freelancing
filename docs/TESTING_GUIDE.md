# Testing Sherubtse Freelancing — Unit 6

Read alongside Madam's Unit 6.1 theory and Unit 6.3 (Lab 9). Campus Eats examples are adapted to accounts, work and ratings. The stricter eight-digit student-email rule, hashed verification tokens and dual roles are preserved.

## Prepare separate test databases

Install Node.js 22 or newer, PostgreSQL and MongoDB. Run `npm install`. Jest and Supertest are development dependencies.

Copy `.env.test.example` to `.env.test` **only if it does not already exist**. Supply the local test-server PostgreSQL password privately. Do not edit the development `.env` or use production credentials for tests. The prepared workspace may already have a private test environment file; retain it.

| System | Required test database | Development database, unchanged |
| --- | --- | --- |
| PostgreSQL | sherubtse_freelance_test_db | sherubtse_freelance_db |
| MongoDB | sherubtse_freelance_test_feedback | sherubtse_freelance_feedback |

Run `npm run test:setup`. It creates the named PostgreSQL test database if permitted, installs the base schema and professional upgrade in an unprepared test database, and creates safe MongoDB rating indexes. It never drops a database. Alternatively, create the test database through pgAdmin and run `database/test_database_setup.sql` there. That file refuses other database names. MongoDB creates its test database on first write/index creation.

`jest.setup.js` loads only `.env.test` before app models. `NODE_ENV=test` prevents app/config code loading `.env`. `config/testEnvironment.js` rejects any other PostgreSQL or MongoDB database, including a conflicting DATABASE_URL. It refuses TEST_BASE_URL, so route tests cannot target a deployed site. Guards also run inside the database modules before connecting.

## Commands

On Windows PowerShell use `npm.cmd` if execution policy blocks `npm`:

```powershell
npm.cmd run test:setup
npm.cmd test
npm.cmd run test:unit
npm.cmd run test:coverage
npm.cmd run check:ui
npm.cmd run check:delivery
```

`npm test` is exactly `jest --runInBand`. Serial execution keeps fixture cleanup understandable. Supertest imports `app.js` without starting the normal HTTP server. `request.agent(app)` remembers login cookies; ordinary `request(app)` suits public requests. For individual suites use `npx jest validators --runInBand`, `npx jest access.routes --runInBand` or `npx jest signup.mock --runInBand`.

## Coverage and dependencies

- Pure unit tests cover email, leading-zero student number, six-character/72-byte passwords, required fields, date order, application-window boundaries, integer ratings and status transitions.
- Import-safety tests check Express export, no listener/Mongo connection on import, safe health JSON and headers.
- Supertest checks public pages, invalid signup/login, protected redirects, role permissions, pending approval, dual roles, calendar authentication and logout.
- Real SQL/MongoDB workflows exercise profiles/skills, businesses, drafts/publication, application windows, invitations/consent, overlap withdrawal, availability, start/completion, ratings, notifications, approval and calendar privacy.
- Signup uses `jest.mock` for the mailer and verifies that the sent token hashes to the stored token. The older verification suite mocks Nodemailer to simulate transport success/failure, resend and expiry. A global guard makes an unmocked transporter fail before any network call.

Existing assertions were retained during conversion from Node's test runner. Their `node:assert` calls work inside Jest; new tests use `describe`, `test`, `expect` and Arrange–Act–Assert.

The validator tests were run before helper implementation: 56 failed as expected (RED), then all 56 passed (GREEN). Signup/password/rating refactoring uses those helpers (REFACTOR). Existing date/status SQL checks remain authoritative: helpers do not bypass ownership, capacity or schedule conflicts.

`npm run test:coverage` creates `coverage/index.html`, `coverage/lcov.info` and `coverage/coverage-summary.json`. Open the HTML report. Coverage records executed statements/branches/functions/lines, not proof that all inputs are safe. Low percentages identify missing scenarios; do not chase a percentage without useful assertions. One existing workflow test contains many HTTP requests, so test count is not route count.

## Isolation, cleanup and interpretation

PASS means the assertions passed. FAIL identifies the suite/assertion to inspect. For connection failures, check services, test setup and `.env.test`; do not bypass guards or skip integration tests. Connections close after their suites. Do not hide open handles using `--forceExit`.

Tests create their own temporary records and delete them in foreign-key order. The model scenario rolls back its transaction. Anonymous test sessions are cleared only from the explicitly named MongoDB test database. Seeded skills/employer types remain; test users/work/applications/tasks/notifications/history/ratings should be empty afterward. Sequences can advance normally. No tests truncate or drop development/production databases.

The optional `.github/workflows/test.yml` provisions disposable PostgreSQL and MongoDB services, installs the complete schema and runs coverage/syntax checks. It needs no production or Gmail secrets and does not deploy the site.

Real Gmail delivery, hosted TLS/proxy behavior, physical devices, complete CSRF assessment and load capacity remain manual checks. Follow DEPLOYMENT_CHECKLIST.md.
