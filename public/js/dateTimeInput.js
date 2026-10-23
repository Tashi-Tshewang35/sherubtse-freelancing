(function(root) {
  function normalize(value) {
    if (typeof value !== 'string') return null;
    let local = value.trim();
    const parts = local.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}):(\d{2})\s+(AM|PM)$/i);
    if (parts) {
      const [, day, month, year, hour, minute, period] = parts;
      if (Number(hour) < 1 || Number(hour) > 12) return null;
      const hour24 = Number(hour) % 12 + (period.toUpperCase() === 'PM' ? 12 : 0);
      local = `${year}-${month}-${day}T${String(hour24).padStart(2,'0')}:${minute}`;
    }
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
    const date = new Date(local + ':00Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0,16) === local ? local : null;
  }
  function display(value) {
    return new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Thimphu', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })
      .format(new Date(value)).replace(',', '').replace(/\b(am|pm)\b/g, part => part.toUpperCase());
  }
  const helpers = { normalize, display };
  if (typeof module !== 'undefined' && module.exports) module.exports = helpers;
  else root.ScheduleDates = helpers;
})(typeof window === 'undefined' ? globalThis : window);
