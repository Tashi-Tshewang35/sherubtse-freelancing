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
document.querySelectorAll('[data-strength]').forEach(input => {
  const form=input.form;
  const feedback=form.querySelector('#password-strength');
  const confirm=form.elements.confirmPassword;
  const validate=()=>{
    const length=input.value.length;
    const bytes=new TextEncoder().encode(input.value).length;
    const variety=[/[a-z]/,/[A-Z]/,/\d/,/[^a-zA-Z0-9]/].filter(pattern=>pattern.test(input.value)).length;
    if(feedback)feedback.textContent=bytes>72?'Use at most 72 bytes.':length<8?'Use at least 8 characters.':length>=14||length>=10&&variety>=3?'Strong password length and variety.':'Valid length. Add length and variety for a stronger password.';
    input.setCustomValidity(bytes>72?'Use at most 72 bytes.':'');
    if(confirm)confirm.setCustomValidity(confirm.value && confirm.value!==input.value?'Passwords must match.':'');
  };
  input.addEventListener('input',validate);
  if(confirm)confirm.addEventListener('input',validate);
});
document.querySelectorAll('form[method="POST"]').forEach(form=>{
  form.addEventListener('submit',()=>{
    if(!form.checkValidity())return;
    // Defer until confirmation listeners have had an opportunity to cancel.
    window.setTimeout(()=>{
      if(form.dataset.confirm)return;
      form.setAttribute('aria-busy','true');
      form.querySelectorAll('button[type="submit"],button:not([type])').forEach(button=>{button.disabled=true;});
    },0);
  });
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
        (filters.elements.urgency.value && card.dataset.urgency !== filters.elements.urgency.value) ||
        (filters.elements.location?.value && !card.dataset.location.includes(filters.elements.location.value.trim().toLowerCase())) ||
        (filters.elements.date?.value && card.dataset.date !== filters.elements.date.value);
      if (!card.hidden) count++;
    });
    document.getElementById('workCount').textContent = `${count} matching opportunities. All times are Bhutan time.`;
    document.getElementById('workEmpty').hidden = count > 0;
    const sort=filters.elements.sort?.value;
    const visible=cards.filter(card=>!card.hidden).sort((a,b)=>sort==='closing'?Number(a.dataset.closing)-Number(b.dataset.closing):sort==='wage'?Number(b.dataset.wage)-Number(a.dataset.wage):sort==='urgent'?Number(b.dataset.urgency==='urgent')-Number(a.dataset.urgency==='urgent'):Number(b.dataset.created)-Number(a.dataset.created));
    visible.forEach(card=>document.getElementById('workResults').appendChild(card));
    pager.reset(visible);
  };
  // GET submission remains available to widen previously submitted filters.
  filters.addEventListener('submit', event => { if(!filters.hasAttribute('data-server-filters'))event.preventDefault(); update(); });
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
