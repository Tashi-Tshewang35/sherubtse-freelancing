// Small pure functions: no databases, sessions or network calls.
const { dateInput } = require('../config/workRules');
const STUDENT_EMAIL = /^\d{8}\.sherubtse@rub\.edu\.bt$/i;
function isValidStudentEmail(email) {
  return typeof email === 'string' && STUDENT_EMAIL.test(email.trim());
}
function extractStudentNumber(email) {
  return isValidStudentEmail(email) ? email.trim().slice(0, 8) : null;
}
function isValidPassword(password) {
  // Keep the existing six-character minimum and bcrypt's 72-byte ceiling.
  return typeof password === 'string' && password.length >= 6 && Buffer.byteLength(password, 'utf8') <= 72;
}
function hasRequiredFields(values, names) {
  if (!values || typeof values !== 'object') return false;
  return names.every(name => {
    const value = values[name];
    if (value === null || value === undefined) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'number') return Number.isFinite(value);
    return true;
  });
}
function timestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value !== 'string' || !value) return NaN;
  // datetime-local values use Bhutan time; normalized ISO timestamps retain their offset.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || /^\d{2}\/\d{2}\/\d{4} /.test(value)) {
    const normalized = dateInput(value);
    return normalized ? new Date(normalized).getTime() : NaN;
  }
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  // Validate the local calendar date before Date can normalize February 30.
  if (!dateInput(value.slice(0, 16))) return NaN;
  return new Date(value).getTime();
}
function isValidWorkRange(start, end) {
  return Number.isFinite(timestamp(start)) && Number.isFinite(timestamp(end)) && timestamp(end) > timestamp(start);
}
function isValidApplicationWindow(opens, closes, workStart) {
  return isValidWorkRange(opens, closes) && Number.isFinite(timestamp(workStart)) && timestamp(closes) <= timestamp(workStart);
}
function isWithinApplicationWindow(opens, closes, now = new Date()) {
  return isValidWorkRange(opens, closes) && timestamp(opens) <= timestamp(now) && timestamp(now) < timestamp(closes);
}
function isValidRating(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') return false;
  const score = Number(value);
  return Number.isInteger(score) && score >= 1 && score <= 5;
}
const APPLICATION_TRANSITIONS = Object.freeze({
  pending: ['invited', 'accepted', 'rejected', 'withdrawn'],
  invited: ['accepted', 'declined', 'rejected', 'withdrawn'],
  accepted: ['in_progress', 'completed'], // Direct completion remains compatible.
  in_progress: ['completed'],
  rejected: ['invited'], declined: ['invited'], withdrawn: ['invited'], completed: [],
});
function canTransitionApplication(from, to) {
  return Object.hasOwn(APPLICATION_TRANSITIONS, from) && APPLICATION_TRANSITIONS[from].includes(to);
}
module.exports = { isValidStudentEmail, extractStudentNumber, isValidPassword,
  hasRequiredFields, isValidWorkRange, isValidApplicationWindow, isWithinApplicationWindow,
  isValidRating, canTransitionApplication, APPLICATION_TRANSITIONS };
