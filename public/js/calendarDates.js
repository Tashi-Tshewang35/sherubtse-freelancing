// All calendar days use Bhutan time, regardless of the browser's time zone.
(function (root) {
  const zone = 'Asia/Thimphu';
  function dayKey(value) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(new Date(value));
    const part = type => parts.find(p => p.type === type).value;
    return `${part('year')}-${part('month')}-${part('day')}`;
  }
  function overlaps(event, day) {
    const start = new Date(`${day}T00:00:00+06:00`).getTime();
    return new Date(event.start).getTime() < start + 86400000 && new Date(event.end).getTime() > start;
  }
  function format(value, options = {}) {
    return new Intl.DateTimeFormat('en-GB', { timeZone: zone, ...options }).format(new Date(value)).replace(/\b(am|pm)\b/g, part => part.toUpperCase());
  }
  const helpers = { dayKey, overlaps, format };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  else root.CalendarDates = helpers;
})(typeof window === 'undefined' ? globalThis : window);
