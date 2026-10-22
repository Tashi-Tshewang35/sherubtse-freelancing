# Deployment and manual acceptance checklist

Mark completed items only. Use disposable accounts and non-sensitive evidence.

## Environment and data

- [ ] Back up existing PostgreSQL and MongoDB data privately.
- [ ] Separate development, test and production connection settings.
- [ ] Fresh SQL: base schema plus professional upgrade; existing SQL: backup plus upgrade only.
- [ ] Refresh pgAdmin tables and confirm selected database.
- [ ] DB_SSL=false locally; DB_SSL=true where the hosted provider requires it.
- [ ] Verify Atlas user, network access, MONGODB_URI/MONGODB_DB and rating/session indexes.
- [ ] Set host secrets privately; exclude real env files, dumps and backups from Git/Docker.
- [ ] Configure Gmail/App Password and a hosting plan permitting SMTP.
- [ ] Verify the resolved public HTTPS URL (custom APP_URL or automatic Render URL); request fresh email links.
- [ ] Run npm run check:config in the hosting environment.
- [ ] Seed the first administrator deliberately; use no public default password.

## Automated and local checks

- [ ] npm ci succeeds using the lockfile.
- [ ] npm run test:setup uses only the exact named test databases.
- [ ] npm test and npm run test:coverage pass; no debugging .only/.skip remains.
- [ ] Open coverage/index.html and review missing paths honestly.
- [ ] npm run check:ui checks JavaScript/EJS; check:delivery verifies exclusions/known secrets.
- [ ] Importing app.js does not listen/connect; server.js starts through npm start.
- [ ] GET /health returns only safe status/application JSON.
- [ ] Rehearse Docker build/run if available; otherwise record not run.
- [ ] CI initializes both disposable test databases before integration tests.

## Roles and workflows

- [ ] Public, authentication and verification pages render.
- [ ] Reject invalid student email; preserve eight digits/leading zero.
- [ ] Register student, manually receive real verification email, verify and log in.
- [ ] Student/employer/dual/admin permissions and navigation remain correct.
- [ ] Pending employers cannot publish/recruit; admin approval/rejection works.
- [ ] Save student programme/year, biography, contact, experience, skills/custom skills and hours.
- [ ] Save business/type/Other, description, location and contact.
- [ ] Publish work with wage/unit, workers, type, requirements and valid dates.
- [ ] Save/edit/publish drafts; respect application windows and own-post restrictions.
- [ ] Apply, accept/reject with optional reason; show application progress.
- [ ] Urgent invitations need student consent; decline and ownership protection work.
- [ ] Confirmation sets inactive availability and withdraws overlapping applications/invitations.
- [ ] Start/complete work; restore availability without overriding later manual choices.
- [ ] Rate completed work once; MongoDB comment and SQL summary match the correct student.
- [ ] Calendar API authentication/privacy, deadlines, accepted work and Bhutan-time boundaries hold.
- [ ] Add/remove personal tasks.
- [ ] Notifications show category/time/action/read state; read-one/all respects ownership.
- [ ] Admin search/filters/approvals work without exposing passwords or tokens.
- [ ] Errors are friendly, with no stack traces/credentials/private management information.
- [ ] Wages remain informational; no payment gateway is added.

## Public deployment

- [ ] Both build and startup logs pass; Render service is Live.
- [ ] HTTPS website/email links work from another device/network.
- [ ] Secure cookies/proxy settings preserve login; Mongo sessions survive restart.
- [ ] Keyboard navigation, visible focus and labels work for every role.
- [ ] Check 360px phone, tablet and desktop layouts, including long content.
- [ ] Check real Gmail delivery manually; mocks prove no actual email delivery.
- [ ] Try SQL-injection-like strings and escaped script comments with disposable records.
- [ ] Assess CSRF separately; SameSite alone is not a complete security audit.
- [ ] Run authorized modest load checks, e.g. ab -n 100 -c 10 YOUR_URL/, and record results.
- [ ] Configure uptime/log/resource monitoring.
- [ ] Record backup/restore and rollback procedures before public use.
- [ ] Remove only disposable records in foreign-key order; do not copy Campus Eats cleanup SQL.
