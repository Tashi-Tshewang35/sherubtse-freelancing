// Small progressive enhancements: every essential link and form works without JS.
document.documentElement.classList.add('js-ready');
document.querySelectorAll('.menu-toggle').forEach(button => {
  button.hidden = false;
  button.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    document.getElementById(button.getAttribute('aria-controls')).classList.toggle('is-open', open);
  });
});
document.querySelectorAll('#main-nav a').forEach(link => {
  if (link.getAttribute('href') === window.location.pathname) link.setAttribute('aria-current', 'page');
});
document.querySelectorAll('input[type="password"]').forEach((input, index) => {
  input.id ||= `password-${index}`;
  const wrapper = document.createElement('span');
  wrapper.className = 'password-control';
  input.before(wrapper);
  wrapper.append(input);
  const button = document.createElement('button');
  button.type = 'button'; button.className = 'password-toggle'; button.textContent = 'Show';
  button.setAttribute('aria-controls', input.id); button.setAttribute('aria-label', 'Show password');
  button.setAttribute('aria-pressed', 'false');
  button.addEventListener('click', () => {
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password'; button.textContent = show ? 'Hide' : 'Show';
    button.setAttribute('aria-pressed', String(show)); button.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
  wrapper.append(button);
});
document.querySelectorAll('form[data-confirm]').forEach(form => {
  form.addEventListener('submit', event => { if (!window.confirm(form.dataset.confirm)) event.preventDefault(); });
});
function paginate(container, allItems, size) {
  let items = allItems;
  let page = 0;
  const navigation = document.createElement('nav');
  navigation.className = 'pagination'; navigation.setAttribute('aria-label', 'Result pages');
  const previous = document.createElement('button');
  previous.type = 'button'; previous.className = 'btn secondary'; previous.textContent = 'Previous';
  const label = document.createElement('span'); label.setAttribute('role', 'status');
  const next = document.createElement('button');
  next.type = 'button'; next.className = 'btn secondary'; next.textContent = 'Next';
  navigation.append(previous, label, next); container.after(navigation);
  const render = () => {
    allItems.forEach(item => { item.hidden = true; });
    items.slice(page * size, (page + 1) * size).forEach(item => { item.hidden = false; });
    const pages = Math.max(1, Math.ceil(items.length / size));
    label.textContent = `Page ${page + 1} of ${pages}`;
    previous.disabled = page === 0; next.disabled = page >= pages - 1;
    navigation.hidden = pages <= 1;
  };
  previous.addEventListener('click', () => { page--; render(); });
  next.addEventListener('click', () => { page++; render(); });
  return { reset(visible) { items = visible; page = 0; render(); } };
}
document.querySelectorAll('.table-wrap').forEach(container => {
  const rows = [...container.querySelectorAll('tbody > tr')];
  if (rows.length > 10) paginate(container, rows, 10).reset(rows);
});
const filters = document.getElementById('workFilters');
if (filters) {
  const cards = [...document.querySelectorAll('[data-work-card]')];
  const pager = paginate(document.getElementById('workResults'), cards, 9);
  const update = () => {
    const query = filters.elements.search.value.trim().toLowerCase();
    let count = 0;
    cards.forEach(card => {
      card.hidden = !card.dataset.search.includes(query) ||
        (filters.elements.type.value && card.dataset.type !== filters.elements.type.value) ||
        (filters.elements.urgency.value && card.dataset.urgency !== filters.elements.urgency.value);
      if (!card.hidden) count++;
    });
    document.getElementById('workCount').textContent = `${count} matching opportunities. All times are Bhutan time.`;
    document.getElementById('workEmpty').hidden = count > 0;
    pager.reset(cards.filter(card => !card.hidden));
  };
  filters.addEventListener('submit', event => { event.preventDefault(); update(); });
  filters.addEventListener('input', update);
  filters.addEventListener('reset', () => window.setTimeout(update, 0));
  update();
}
const scheduleValue = input => window.ScheduleDates.normalize(input.value);
document.querySelectorAll('[data-schedule-date]').forEach(input => {
  const validate = () => input.setCustomValidity(input.value && !scheduleValue(input) ? 'Enter DD/MM/YYYY hh:mm AM/PM, for example 23/10/2026 02:30 PM.' : '');
  input.addEventListener('input', validate);
  input.addEventListener('change', validate);
});
const posting = document.querySelector('form[data-posting]');
if (posting) {
  const fields = posting.elements;
  const validate = () => {
    for (const name of ['opensAt', 'closesAt', 'startAt', 'endAt']) {
      const input = fields[name];
      input.setCustomValidity(input.value && !scheduleValue(input) ? 'Enter DD/MM/YYYY hh:mm AM/PM.' : '');
    }
    if (scheduleValue(fields.opensAt) && scheduleValue(fields.closesAt) && scheduleValue(fields.closesAt) <= scheduleValue(fields.opensAt)) fields.closesAt.setCustomValidity('Applications must close after they open.');
    if (scheduleValue(fields.closesAt) && scheduleValue(fields.startAt) && scheduleValue(fields.startAt) < scheduleValue(fields.closesAt)) fields.startAt.setCustomValidity('Work must start on or after applications close.');
    if (scheduleValue(fields.startAt) && scheduleValue(fields.endAt) && scheduleValue(fields.endAt) <= scheduleValue(fields.startAt)) fields.endAt.setCustomValidity('Work must end after it starts.');
    const review = document.getElementById('postingReview');
    if (review) review.textContent = `${fields.title.value || 'Your opportunity'}: Nu. ${fields.wageRate.value || '0'} per ${fields.wageUnit.value}, ${fields.workersNeeded.value} worker(s), ${fields.location.value || 'location to be added'}.`;
  };
  posting.addEventListener('input', validate);
  posting.addEventListener('submit', event => { validate(); if (!posting.reportValidity()) event.preventDefault(); });
}
