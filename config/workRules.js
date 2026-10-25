const { normalize } = require('../public/js/dateTimeInput');
function isOpen(job, now = new Date()) {
  return !job.is_suspended && (!job.employer_account_status || job.employer_account_status==='active') && job.employer_status !== 'rejected' && job.employer_status !== 'pending' && job.employer_verified !== false && job.status === 'open' && !!job.published_at &&
    new Date(job.application_opens_at) <= now && now < new Date(job.application_closes_at);
}
function canView(job, user, hasApplication = false) {
  if (user && (user.isAdmin || job.employer_id === user.id)) return true;
  if (user && !user.isStudent) return false;
  return hasApplication || isOpen(job) || (!job.is_suspended && !!job.published_at && job.status!=='draft' && job.employer_status==='approved' && job.employer_account_status==='active');
}
function dateInput(value) {
  value = normalize(value);
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value + ':00+06:00');
  if (!Number.isFinite(date.getTime())) return null;
  // Reject calendar overflow (for example February 30 or hour 24).
  const local = new Date(date.getTime() + 6 * 60 * 60 * 1000);
  if (local.toISOString().slice(0, 16) !== value) return null;
  return date.toISOString();
}
module.exports = { isOpen, canView, dateInput };
