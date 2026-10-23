# Gmail API on Render Free without a custom domain

The website can keep its free onrender.com address. Gmail API sends as your Gmail account over HTTPS, avoiding the SMTP ports blocked by Render Free. This setup is for the application's single sending mailbox, not Google sign-in for students or employers.

## One-time Google account setup

1. Open https://console.cloud.google.com/ and create/select a project.
2. Under APIs & Services > Library, enable Gmail API.
3. Under Google Auth Platform, configure the consent screen using your own contact details. For initial testing choose External and add your sending Gmail address as a test user. Request only https://www.googleapis.com/auth/gmail.send.
4. Under Clients, create an OAuth client with type Web application. Add this exact authorized redirect URI: https://developers.google.com/oauthplayground . Keep the client secret private. Do not add website home/privacy URLs you do not own or provide.
5. Open https://developers.google.com/oauthplayground/ . In its settings, enable Use your own OAuth credentials and enter the client ID and secret privately.
6. Enter https://www.googleapis.com/auth/gmail.send in the scope box. Authorize with the same Gmail account you will put in GMAIL_USER. Review and grant the send-email permission.
7. Exchange the authorization code for tokens. Keep the refresh token private. If it is missing, revoke the earlier authorization and authorize again with offline consent. Do not use the short-lived access token as the refresh token.

Google OAuth external apps in Testing issue refresh tokens that expire after seven days for Gmail scopes. This is suitable for initial testing only. Before relying on unattended sending, configure the app's production publishing status and complete any Google requirements that apply to the account/use case, then authorize again. Publishing status and Google app verification are separate steps; do not assume changing a toggle completes verification. Workspace administrators may restrict Gmail API authorization.

## Render environment

Set the following privately in the existing Render service:

```
EMAIL_PROVIDER=gmail-api
GMAIL_USER=your-sending-account@gmail.com
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret
GOOGLE_REFRESH_TOKEN=your-google-refresh-token
```

Keep the existing hosted PostgreSQL/MongoDB connections and SESSION_SECRET. APP_URL can remain blank on Render to use RENDER_EXTERNAL_URL, or be the actual public HTTPS website origin. Do not use localhost database settings on Render.

For gmail-api, GMAIL_APP_PASSWORD, RESEND_API_KEY and EMAIL_FROM are not required. If Resend variables remain configured, the explicit EMAIL_PROVIDER=gmail-api selects Gmail API. Local development keeps the default Gmail SMTP transport unless you deliberately change EMAIL_PROVIDER locally.

Save and deploy the environment together with this source version. Request a new verification email through /resend-verification, check Inbox/Spam and the sender's Sent folder, then open the link and log in. Gmail quotas still apply. API acceptance is not proof of inbox delivery.

## Troubleshooting

- HTTP 400 at authorization refresh: revoked, expired or mismatched refresh token/client credentials. Reauthorize the sender using the same client.
- HTTP 403 at send: Gmail API disabled, missing gmail.send scope, account policy or account quota. Check the Google Cloud project's Gmail API configuration.
- HTTP 429: quota/rate limit; retry later.
- Registration remains unverified on provider failure; use the existing resend flow after fixing configuration. No automatic SMTP fallback is attempted.

Keep credentials in Render's private environment settings or ignored local .env only. Never put refresh tokens in source, screenshots or chat.

References:
- https://developers.google.com/workspace/gmail/api/guides/sending
- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/protocols/oauth2#expiration
- https://render.com/docs/free
