# Editable deployment architecture

This describes the planned deployment; it is not evidence of a live service. Edit [the Mermaid source](deployment-architecture.mmd) in any text editor.

```mermaid
flowchart TD
  browser[Student / employer / dual-role / administrator browser]
  render[Render HTTPS web service]
  server[server.js: check schema, connect MongoDB, listen on PORT]
  app[app.js: Express, EJS, sessions, routes and security headers]
  mvc[Controllers and models]
  pg[(PostgreSQL / Neon: accounts, work, profiles, applications, calendar, notifications and rating summary)]
  mongo[(MongoDB / Atlas: ratings, written feedback and persistent sessions)]
  gmail[Gmail SMTP verification sender]
  verify[APP_URL plus unique verification token]
  github[GitHub: reviewed source and Dockerfile]
  tests[Jest and Supertest: separate SQL and MongoDB test databases]
  browser --> render
  github --> render
  render --> server
  server --> app
  app --> mvc
  mvc --> pg
  mvc --> mongo
  app --> mongo
  mvc --> gmail
  gmail --> verify
  verify --> browser
  tests -. imported app and mocked email .-> app
```

PostgreSQL and MongoDB retain their separate roles. Tests use distinct databases and mocked email. Website and verification links share APP_URL while account tokens remain unique.
