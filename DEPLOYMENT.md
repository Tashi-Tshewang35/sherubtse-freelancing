> **Current guide:** Follow [docs/RENDER_DEPLOYMENT_GUIDE.md](docs/RENDER_DEPLOYMENT_GUIDE.md). It documents the Unit 6 server split, native/Docker commands, combined migration, provider email limits and manual acceptance checks. Earlier notes below are retained as history.

# Public hosting

The app needs a Node.js or Docker host with outbound Gmail SMTP access, managed
PostgreSQL, and MongoDB. Local PostgreSQL/MongoDB addresses are not reachable from
a hosted app. Use your provider's private database connections or permitted network
access. This checkout is prepared for deployment; no public site has been created.

1. Push the project to your repository without `.env` or any credentials.
2. Create PostgreSQL and MongoDB databases at your hosting provider.
3. Create a Node.js web service (install: `npm ci --omit=dev`, start: `npm start`)
   or deploy the included Dockerfile. Use Node.js 22 or newer. Configure `/health`
   as the health-check path. The app accepts the hosting provider's `PORT`.
4. Add the values from `.env.production.example` in the host's secret/environment
   settings. Set `APP_URL` to the actual public HTTPS URL assigned to the app.
   Set `DATABASE_URL` and `MONGODB_URI` to the hosted database connections.
   `DB_SSL=true` enables PostgreSQL TLS certificate verification; use the provider's
   required TLS settings and CA configuration. URL-encode special characters in
   database passwords. Keep Gmail credentials in the host's secret settings.
5. Generate `SESSION_SECRET` with `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.
   Keep it unchanged between deployments. Configure `TRUST_PROXY_HOPS` to match
   your host's trusted reverse proxy count (default: one). Restrict direct access
   to the app behind that proxy. HTTPS cookies require correct proxy forwarding.
6. Run `database/postgresql_schema.sql` on a new PostgreSQL database. For an existing
   schema run the verification migration only if not already installed. Then apply
   `database/profile_calendar_migration.sql` if profiles are not yet installed, followed
   by `database/ui_workflow_migration.sql`. Do not rerun older migrations after adopting
   new application statuses. Back up existing hosted data before upgrading. Run `npm run seed:admin` in the host's
   shell with the desired admin settings. A newly hosted database does not include
   local accounts or jobs: migrate your data separately if you want to keep them.
7. Start the deployment. Check `/health`, register, receive a verification email,
   open the link on another device/network, and log in. Test employer approval.

Sessions are stored in MongoDB and expire after eight hours. They survive app
restarts and can be shared by app instances using the same secret and MongoDB.
MongoDB needs permission to create the sessions TTL index. Expired sessions are
rejected immediately even before MongoDB's background cleanup runs.

Old verification emails keep their original localhost/Wi-Fi URL. Request new emails
after deployment. Local development remains HTTP; do not set NODE_ENV=production
in the local `.env`. If your host blocks Gmail SMTP, choose hosting that allows it
or change mail delivery to a supported service before launch.


## One address for the website and verification

Use the hosting provider's assigned HTTPS address as the website address and as
`APP_URL` in the hosting environment. No purchased domain is required if the
provider supplies a subdomain. Example only (not a deployed site):

```
APP_URL=https://your-service.onrender.com
```

Visitors open that address. The mailer automatically appends `/verify/<unique-token>`
for each verification email. Request fresh verification messages after changing
APP_URL; previously sent emails retain the earlier address. Keep local `.env`
settings separate from hosting environment variables.

The running server, PostgreSQL and MongoDB must all be reachable in the hosted
environment. Localhost database settings cannot connect a hosted app to your PC.
Your laptop does not need to stay on once the app and both databases are hosted.

Provider email restrictions checked on 22 October 2026:
- Render Free blocks outbound SMTP ports, including Gmail's mail ports. Retaining
  this project's Gmail/Nodemailer transport needs a service tier allowing SMTP.
  See https://render.com/docs/free and
  https://render.com/changelog/free-web-services-will-no-longer-allow-outbound-traffic-to-smtp-ports.
- Railway requires Pro or above for SMTP. Its lower plans require an HTTPS email
  API, which would require a mailer change. See
  https://docs.railway.com/networking/outbound-networking.

No public deployment has been created yet. Connect a hosting account, choose an
appropriate plan, and provision hosted databases before assigning the real APP_URL.
