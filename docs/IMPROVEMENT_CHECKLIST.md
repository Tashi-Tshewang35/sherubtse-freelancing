# Platform improvement checklist

Branch: `improve/platform-security-workflows`.

The existing application is Express/EJS with PostgreSQL for identities, profiles,
jobs, applications, calendars and notifications. MongoDB stores sessions and full
rating documents. Preserve both databases and the existing Render/Docker entrypoint.

Pre-existing uncommitted work: authController.js, signup.ejs and validator tests.
Preserve the education-email validation and support for all admission years.

- [ ] Security: CSRF, rate limits, 8-character passwords, confirmation, recovery.
- [ ] Account lifecycle and authorization; retain explicit administrator bootstrap.
- [ ] Saved jobs, filters, dashboard roles, profile completion and recommendations.
- [ ] Recruitment, cancellation, availability, calendar and application history.
- [ ] Reports, disputes, review moderation and administrator audit controls.
- [ ] Support/legal pages, responsive polish and safe demonstration data.
- [ ] Tests, syntax/lint, production startup checks, browser QA and documentation.

Database notice: additive migration 002 is needed for account lifecycle, password
recovery, saved jobs, reports and audit records. Existing rating documents receive
optional moderation fields. No new required Render variables are planned.
Migration execution against development/production is a manual deployment step;
automated tests must use only the explicitly named test databases.

Do not merge, push or deploy as part of this work.
