# Sherubtse Freelancing — Unit 6 handover

Prepared on 22 October 2026, following all four uploaded notes and Parts A–I. Existing Express/EJS MVC routes, PostgreSQL responsibilities, MongoDB ratings, dual roles and the existing UI are retained. No payment feature or frontend framework is added. The complete updated source is in `delivery/Sherubtse-Freelancing-Unit6-Ready.zip`.

## Local setup

For this existing workspace, retain `.env` and the prepared private `.env.test`. PostgreSQL and MongoDB must be running. No development/production schema migration was applied during this preparation.

```powershell
npm.cmd ci
npm.cmd run test:setup
npm.cmd test
npm.cmd run test:coverage
npm.cmd run check:ui
npm.cmd run check:delivery
npm.cmd start
```

Open http://localhost:3000. `npm.cmd run dev` uses nodemon/server.js. Website and email links still share APP_URL. Each verification token is unique.

For a fresh extracted copy, environment secrets are deliberately absent. Copy `.env.example` to `.env` and `.env.test.example` to `.env.test` only when those files do not exist; enter your own connection settings privately. Create a fresh development database with the base schema then professional upgrade, or retain/upgrade an existing backed-up database as explained in PGADMIN_GUIDE.md. Configure Gmail only for manual email tests. Automated tests use mocks and need no Gmail credentials.

The test database names are exactly `sherubtse_freelance_test_db` and `sherubtse_freelance_test_feedback`. Guards reject other test targets before connecting. The local setup command only prepares those databases and retains lookup seeds. Temporary fixture records are removed after tests.

## Requirement mapping

| Part | Implementation / guide |
| --- | --- |
| A | app/server split; Jest/Supertest scripts/config; isolated test environment; pure validators; real route/workflow tests; mocked email; TESTING_GUIDE.md |
| B | Preserved base SQL; new combined `database/migrations/001_professional_upgrade.sql`; guarded test schema; local/hosted SSL; PGADMIN_GUIDE.md |
| C | Existing Mongo API retained; connection reuse/cleanup and safe indexes; optional setup script preserves existing collections; MONGODB_GUIDE.md |
| D | server.js, app.js, node:22-alpine Dockerfile, npm ci --omit=dev, protected context and placeholder environment examples |
| E | RENDER_DEPLOYMENT_GUIDE.md covers GitHub, Neon/Atlas, native Node/Docker commands, environment, schema, APP_URL, logs and email |
| F | GITHUB_GUIDE.md explains every requested command, ignore verification and secret recovery |
| G | Safe health JSON, no public stack traces, production secure cookies/trust proxy, basic security headers and no payment feature |
| H | DEPLOYMENT_CHECKLIST.md covers data/configuration, all roles/workflows and manual live acceptance |
| I | Syntax/EJS checks, coverage, real npm-start smoke, health, secret/exclusion checks, data isolation evidence and this ZIP |

The notes are teaching references, not instructions to copy Campus Eats tables, weaken student identity checks or replace this project's variables. Important adaptations are the exact test names, preserved MONGODB_URI/MONGODB_DB, hashed verification tokens, supported Node 22 Alpine instead of the notes' older Node 20 image, and a production APP_URL check before startup.

## Final results

| Check | Result |
| --- | --- |
| Jest/Supertest | 90 tests passed, 12 suites, no skipped tests |
| JavaScript syntax | 64 files passed node --check |
| EJS | All 19 templates compile |
| Existing route declarations | All 42 page routes and 3 calendar API routes preserved |
| npm start / server.js | Passed on a temporary HTTP port using isolated test databases |
| GET /health | 200, exactly status=ok and application=Sherubtse Freelancing |
| Import app.js | Express exported without listen/Mongo connection; verified by Jest |
| Data isolation | Development SQL row counts and MongoDB rating count unchanged; real .env hash unchanged; test fixtures cleaned |
| Git / secrets | .env and .env.test ignored and untracked; known local credentials absent from distributable source; private files excluded from ZIP |
| Combined migration | Fresh setup passed; two repeat upgrades preserved existing identity, work description and in_progress status inside a rolled-back test |
| Coverage | 81.19% statements, 73.24% branches, 86.54% functions, 86.22% lines |

Coverage HTML was opened and reviewed. server.js remains at 0% in Jest instrumentation because the actual startup is exercised separately by `npm run test:start`; do not interpret its zero as an untested startup or the overall percentage as proof of complete correctness. Error branches and some controller paths remain uncovered.

See `delivery/unit6-test-results.json`, `delivery/startup-check.json`, `delivery/data-isolation-check.json` and `delivery/unit6-changed-files.txt`. The architecture is editable Mermaid source in `docs/deployment-architecture.mmd`, rendered in ARCHITECTURE.md. Run coverage locally for the full HTML report; its summary, preview and an offline HTML copy at `delivery/coverage-report/index.html` are also supplied as artifacts.

## Preserved workflows

Real test databases and Supertest exercise student/employer/dual/admin login/navigation, profiles/skills, business data, posting/drafts/windows, applications, urgent consent/decline, conflicting withdrawal/inactive availability, start/completion, SQL/MongoDB ratings, notifications, calendar privacy/tasks and administrator approval/rejection. Original assertions remain in the converted suites, while additional focused route tests cover the requested authorization boundaries.

No testing technique replaces manual acceptance: use DEPLOYMENT_CHECKLIST.md for real devices, keyboard/screen-reader use, live Gmail, hosted security/proxy settings and load checks. Existing earlier responsive screenshots are sample-data UI previews, not proof of a live deployment.

## Outstanding external steps

- No Render deployment, GitHub push, Neon database or Atlas cluster was created by this task. Supply/sign in to those accounts and put real connection/sender secrets in the host settings.
- Docker is not installed here, so the Alpine image build/run was not executed. The Dockerfile is prepared; its native bcrypt installation must be verified in a Docker-capable environment or Render build logs.
- The optional GitHub Actions workflow is prepared but was not run remotely.
- Real Gmail delivery is intentionally not tested automatically. Render Free blocks SMTP; keep Gmail on a suitable SMTP-enabled service tier or separately approve an HTTPS email-provider change. See the current provider reference in the Render guide.
- Existing local records are not automatically transferred to new cloud databases. Choose a backed-up migration/restore plan before moving real data.
- No complete penetration, CSRF, accessibility or load certification is claimed. Preserve backups and complete live acceptance before public use.

The source backup is `backups/before-unit6-implementation/`; earlier dependency-install backups are also private. No credentials or database dumps are included in the updated ZIP.
