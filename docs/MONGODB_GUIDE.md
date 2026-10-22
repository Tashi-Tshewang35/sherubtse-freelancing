# MongoDB and Atlas

MongoDB stores individual ratings/written feedback and persistent Express sessions. PostgreSQL retains the rating summary. No payment system is added.

## Local server and Compass

Start MongoDB Community Server. Compass is a GUI client and does not start the server itself. Connect to `mongodb://127.0.0.1:27017`, or your own authenticated local connection.

Development uses `sherubtse_freelance_feedback`; tests use only `sherubtse_freelance_test_feedback`. In Compass open the database → ratings → Documents. Inspect score, comment, applicationId, jobId, employeeId, employerId and createdAt. Filter by applicationId to find its feedback. Do not publish real comments, tokens or session details.

## Setup and safe indexes

`config/mongo.js` exports connectMongo(), getMongoDb() and closeMongo(). Importing does not connect. server.js connects before listening; integration suites connect explicitly and close afterward. Concurrent calls share a connection.

Startup safely repeats these indexes:

- ratings.employeeId for lookup;
- unique ratings(applicationId, employerId), preventing duplicate feedback per placement;
- sessions.expiresAt TTL; the store also rejects expired sessions before background cleanup.

The optional `database/mongodb_setup.js` preserves an existing collection, creates validation when the collection is absent and repeats matching indexes. Select the intended application/test feedback database before running it in Compass mongosh. For a local shell:

```powershell
mongosh mongodb://127.0.0.1:27017/sherubtse_freelance_feedback database/mongodb_setup.js
```

A duplicate-key error needs review and a backup, not automatic deletion. Changing index options requires an explicit reviewed migration. Integer ratings 1–5 are enforced by the app; the setup validator limits score range/comment size. Existing collection validation is not silently replaced.

## Atlas setup

1. Create/sign in to Atlas, make a Sherubtse Freelancing project and choose a cluster.
2. Database Access: create a database user, separate from your Atlas website login. Prefer permissions limited to the application database and necessary index operations.
3. Network Access: allow your current IP for Compass; add the Render service's outbound addresses/ranges for hosting. Madam's `0.0.0.0/0` example permits every IP: use it deliberately with strong authentication and tighten it where possible.
4. Connect → Drivers: copy the Node.js `mongodb+srv://...` string, replace placeholders and URL-encode special characters in credentials.
5. Store the string privately as MONGODB_URI in Render, and set MONGODB_DB to the application feedback database. Collections may appear only after first write/index creation.
6. Restart/deploy, check runtime logs and inspect a completed-work rating. Its work/application IDs should match PostgreSQL.

The notes use MONGO_URI/MONGO_DB_NAME for Campus Eats. This project preserves **MONGODB_URI/MONGODB_DB**. A connection username is not a database name. Test names are enforced before connection; never point automated tests at hosted application data.

Authentication errors: check the database user, encoded password and auth database. Timeouts: check network access, DNS and cluster availability. Missing URI: check exact variable spelling. Duplicate rating: the unique index may be working correctly. Direct tests must connect in beforeAll and close in afterAll.

Never place connection strings in GitHub, chat, screenshots or environment examples. Rotate exposed credentials, separate test/production users where possible and back up feedback before manual cleanup.

Reference: [Atlas IP access lists](https://www.mongodb.com/docs/atlas/security/ip-access-list/).
