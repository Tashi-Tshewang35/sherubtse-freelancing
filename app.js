if (process.env.NODE_ENV !== 'test') require('dotenv').config();
process.env.TZ = 'Asia/Thimphu';
require('./config/production').validateProduction();

const path = require('path');
const express = require('express');
const session = require('express-session');
const MongoSessionStore = require('./config/sessionStore');
const indexRoutes = require('./routes/index');
const apiRoutes = require('./routes/api');

const app = express();
const production = process.env.NODE_ENV === 'production';
app.disable('x-powered-by');
if (production) app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 1));
// Small headers without adding another framework or hiding application errors.
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  });
  if (production) res.set('Strict-Transport-Security', 'max-age=31536000');
  next();
});
app.get('/health', (req, res) => res.json({ status: 'ok', application: 'Sherubtse Freelancing' }));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
Object.assign(app.locals, require('./config/viewHelpers'));
app.locals.title = 'Sherubtse Freelancing';
app.locals.user = null;
app.locals.success = null;
app.locals.error = null;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.use(session({
  name: 'sherubtse.sid',
  store: new MongoSessionStore(),
  secret: process.env.SESSION_SECRET || 'development-secret-change-me',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 1000 * 60 * 60 * 8 },
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success = req.session.success || null;
  res.locals.error = req.session.error || null;
  delete req.session.success;
  delete req.session.error;
  next();
});

app.use('/', indexRoutes);
app.use('/api', apiRoutes);

app.use((req, res) => res.status(404).render('error', { title: 'Page Not Found', message: 'Page not found.' }));
app.use((err, req, res, next) => {
  console.error('Request failed:', { code: err.code || 'UNKNOWN' });
  if (res.headersSent) return next(err);
  res.status(500).render('error', { title: 'Error', message: 'Something went wrong. Please try again.' });
});

// Importing this module never connects to MongoDB or opens an HTTP listener.
module.exports = app;
