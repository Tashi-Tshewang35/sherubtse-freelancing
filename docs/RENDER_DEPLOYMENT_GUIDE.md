# Render deployment — Unit 6

Follow Madam's Unit 6.2 and Unit 6.4. The existing Express/EJS, SQL records and MongoDB feedback are preserved. These instructions do not claim a live service or cloud databases have been created.

## Prepare source and cloud databases

Complete TESTING_GUIDE.md and GITHUB_GUIDE.md; run tests, syntax checks and delivery checks before pushing reviewed source.

Create hosted PostgreSQL, such as Neon from the notes. Use its connection details as either DATABASE_URL or DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS. Set DB_SSL=true; certificate verification stays enabled. A hosted application database may be neondb; strict test names apply only in test mode.

In the cloud SQL editor for a **fresh** database run `database/postgresql_schema.sql`, then `database/migrations/001_professional_upgrade.sql`. For an existing installation back up first, then apply only the upgrade. A new cloud database has no local accounts/work until a separate backed-up export/restore is performed. Never run test setup against live application data.

Follow MONGODB_GUIDE.md for Atlas: cluster, database user, network access and driver URI. Use **MONGODB_URI** and **MONGODB_DB**, preserving this project's variable names rather than Campus Eats' MONGO_URI. Startup creates matching rating/session indexes safely.

## Create a Web Service

Connect Render to the GitHub repository/main branch. Choose a region compatible with both databases. Select one runtime:

| Runtime | Build | Start |
| --- | --- | --- |
| Native Node | `npm ci` | `npm start` |
| Docker, matching Lab 10 | Dockerfile runs `npm ci --omit=dev` | CMD runs `node server.js` |

Native Node uses a supported compatible release (22 or newer). Docker uses node:22-alpine, supplies native bcrypt build tools when needed and runs as the non-root node user. Docker services use Dockerfile commands; do not confuse them with native Node command fields. Real environment files, tests, Git metadata and coverage are excluded from the image.

If Docker Desktop is available, rehearse locally:

```bash
docker build -t sherubtse-freelancing .
docker run --rm -p 3000:3000 --env-file YOUR_PRIVATE_DOCKER_ENV_FILE sherubtse-freelancing
```

Use a private external environment file with reachable databases. Docker localhost means the container; a deliberate Docker Desktop rehearsal can use host.docker.internal for databases on the PC. The image uses production mode and therefore requires a valid HTTPS APP_URL and strong secrets. No credentials are baked into it. If local Docker is unavailable, record this rehearsal as not run; Render can still build the Dockerfile, as in Madam's record.

## Environment settings

Enter actual values privately under Render → Environment. Use `.env.production.example` as a checklist, not a source of real credentials.

| Variable | Value/purpose |
| --- | --- |
| NODE_ENV | production |
| HOST | 0.0.0.0 |
| PORT | Hosting service's assigned/configured HTTP port |
| APP_URL | Optional on Render: custom HTTPS origin; otherwise the built-in Render HTTPS URL is used |
| SESSION_SECRET | Strong random value, at least 32 characters, stable across restarts |
| TRUST_PROXY_HOPS | Trusted reverse-proxy count; normally 1 for the documented single-proxy setup |
| DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASS | Hosted PostgreSQL details; alternatively DATABASE_URL |
| DB_SSL | true for hosted PostgreSQL requiring TLS |
| MONGODB_URI/MONGODB_DB | Atlas URI/application database |
| EMAIL_PROVIDER | resend for Render Free; gmail for an SMTP-capable host |
| RESEND_API_KEY/EMAIL_FROM | Private Resend API key and sender on your verified domain |
| GMAIL_USER/GMAIL_APP_PASSWORD | Required only when using gmail |
| ADMIN_NAME/ADMIN_EMAIL/ADMIN_PASSWORD | Used when deliberately seeding the first administrator |

Generate a private session secret with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`; paste it only into secret settings. DB_PASS is the exact variable name, not DB_PASSWORD. URL-encode credentials in connection strings. Leave development `.env` unchanged.

## APP_URL, health and logs

Render supplies an HTTPS onrender.com address. Use it for both the website and APP_URL; emails automatically append `/verify/<unique-token>`. The startup log displays one shared-address line. Each account still needs its own token.

**Automatic Render address:** when APP_URL is blank or still an example placeholder, startup uses Render's documented RENDER_EXTERNAL_URL. A valid custom APP_URL takes priority. Website and verification emails share the resolved origin. Other hosting providers must supply APP_URL explicitly. Production still rejects localhost, HTTP, malformed URLs, user information and paths. Missing settings are reported together without an uncaught stack trace. Old emails keep their old address; request fresh verification emails after changing APP_URL. Run `npm run check:config` for a preflight without database connections or email delivery. See [Render default environment variables](https://render.com/docs/environment-variables#render_external_url).

Set Render's health-check path to `/health`. Check both build and runtime logs: a successful build does not prove the environment/databases are correct. Once Live, visit the HTTPS homepage and `/health`:

```json
{"status":"ok","application":"Sherubtse Freelancing"}
```

This is safe liveness JSON, not a public database diagnostic. Startup checks SQL schema and connects MongoDB before listening; exercise a database-backed route to check continued readiness after startup.

## Email on Render Free

Render Free blocks SMTP ports 25/465/587. The app supports Resend over HTTPS without extra dependencies. Local Gmail remains supported. Set EMAIL_PROVIDER=resend explicitly on Render; configuring RESEND_API_KEY also selects Resend unless EMAIL_PROVIDER overrides it.

1. Create a Resend account at https://resend.com and add a domain you control. Add the DNS records Resend supplies at your DNS provider and wait for verification. The shared onrender.com domain cannot be verified as your sending domain. The website can continue using its Render URL.
2. Create a sending API key. Keep it private; never commit it or paste it into chat.
3. Under Render service Environment, set EMAIL_PROVIDER=resend, RESEND_API_KEY to that private key, and EMAIL_FROM to a sender such as Sherubtse Freelancing <noreply@your-verified-domain.com>. Gmail credentials are not needed for this provider.
4. Keep the existing hosted database connections and session secret. Leave APP_URL blank to use RENDER_EXTERNAL_URL, or set it to the actual public HTTPS origin.
5. Deploy the updated source and environment settings. Register or request a fresh verification email, inspect the Resend dashboard delivery status, then open the link and log in.

Resend's onboarding@resend.dev test sender can only send to the email address associated with your Resend account. It cannot verify arbitrary student or employer accounts. Production sending requires a verified domain. An accepted API request does not guarantee inbox placement; check delivery status and Spam.

Provider failures keep the account unverified and permit retry through /resend-verification. There is no silent SMTP fallback. Automated tests use mocked delivery and never prove real inbox delivery.

References: [Render Free limits](https://render.com/docs/free), [Resend domains](https://resend.com/docs/dashboard/domains/introduction), [Resend testing restrictions](https://resend.com/docs/knowledge-base/403-error-resend-dev-domain), [Resend email API](https://resend.com/docs/api-reference/emails/send-email).

## Admin setup and acceptance

If the hosted database has no admin, set ADMIN_* privately and run `npm run seed:admin` in an authorized environment connected to that database. Deployment does not automatically create a public default admin. Verify the account and remove bootstrap credentials from hosting settings if no longer needed.

Manually register/verify a student, check the actual HTTPS email, log in, verify and approve an employer, publish work, apply, accept/decline invitations, start/complete work and rate it. Check SQL rows/Atlas feedback using non-sensitive evidence. Complete DEPLOYMENT_CHECKLIST.md. Automated email mocks do not prove real delivery.

## Common failures and rollback

- Build: check runtime/version, lockfile and native bcrypt build logs.
- Startup: exact variable names, schema upgrade and hosted database access; no local .env exists in the container.
- Mongo timeout/authentication: Atlas access list, database-user credentials, encoded password and URI spelling.
- PostgreSQL: DB_SSL, provider certificates, DB_PASS and correct host/database.
- Login not persisting: HTTPS, stable SESSION_SECRET, MongoDB sessions and correct proxy count. Production cookies are Secure/HttpOnly/SameSite=Lax.
- Verification: SMTP plan restrictions, sender/App Password and network errors; APP_URL controls the link, not transport.

Retain a known-good source commit and private data backups. Roll back to compatible code if needed; code rollback does not reverse database changes. Restore data only through a reviewed recovery plan. This single-service deployment does not implement rolling or blue-green infrastructure.

References: [Render Express setup](https://render.com/docs/deploy-node-express-app), [Neon connections](https://neon.com/docs/connect/connect-from-any-app).
