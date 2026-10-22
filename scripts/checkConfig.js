// Preflight checks never connect to databases, send email or print secret values.
if (process.env.NODE_ENV !== 'test') require('dotenv').config();
try {
  require('../config/production').configureProduction();
  console.log(process.env.NODE_ENV === 'production'
    ? 'Production configuration passes validation. Database reachability and email delivery still need deployment checks.'
    : 'Local development mode. Production URL checks apply only when NODE_ENV=production.');
} catch (error) {
  console.error(error.code === 'CONFIGURATION_ERROR' ? error.message : 'Configuration could not be checked.');
  process.exitCode = 1;
}
