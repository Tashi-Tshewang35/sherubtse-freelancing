document.addEventListener('DOMContentLoaded', () => {
  const calendar = document.getElementById('calendar');
  if (!calendar) return;
  const { dayKey, overlaps, format } = window.CalendarDates;
  const today = () => dayKey(new Date());
  let month = today().slice(0, 7);
  let selectedDay = null;
  let events = [];
  let loading = false;
  const title = document.getElementById('calendarTitle');
  const message = document.getElementById('calendarMessage');
  const agenda = document.getElementById('calendarAgenda');
  const picker = document.getElementById('calendarMonth');
  const labels = { open: 'Open', applied: 'Applied', accepted: 'Accepted', completed: 'Completed',
    opening: 'Applications open', deadline: 'Application deadline', invited: 'Invited', in_progress: 'Work in progress', closed: 'Closed', scheduled: 'Scheduled', draft: 'Draft', cancelled: 'Cancelled', personal: 'Personal task' };
  const time = value => format(value, { hour: '2-digit', minute: '2-digit', hour12: true });
  const dateTime = value => format(value, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text) node.textContent = text;
    return node;
  }
  function eventLabel(event) {
    return `${event.title} - ${labels[event.status] || event.status}, ${dateTime(event.start)} to ${dateTime(event.end)}`;
  }
  function showAgenda() {
    agenda.replaceChildren();
    const [year, monthNumber] = month.split('-').map(Number);
    const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    const visible = events.filter(event => selectedDay ? overlaps(event, selectedDay) :
      Array.from({ length: lastDay }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`).some(day => overlaps(event, day)));
    document.getElementById('agendaTitle').textContent = selectedDay ?
      `Work and tasks for ${format(selectedDay + 'T12:00:00+06:00', { day: '2-digit', month: '2-digit', year: 'numeric' })}` : 'Work and tasks this month';
    document.getElementById('showMonthEvents').hidden = !selectedDay;
    if (!visible.length) {
      agenda.appendChild(element('p', 'empty', 'No work or tasks for this selection. Open work in another month can be found using the month selector.'));
      return;
    }
    visible.forEach(event => {
      const card = element('article', 'calendar-detail');
      const heading = element('div', 'calendar-detail-heading');
      const link = element(event.event_type === 'work' ? 'a' : 'strong', '', event.title);
      if (event.event_type === 'work') link.href = `/jobs/${event.id}`;
      heading.append(link, element('span', `status ${event.status}`, labels[event.status] || event.status));
      card.appendChild(heading);
      card.appendChild(element('p', '', `Work schedule: ${dateTime(event.work_start || event.start)} - ${dateTime(event.work_end || event.end)}`));
      if (event.event_type === 'work') {
        card.appendChild(element('p', '', `${event.employer_name} - ${event.location} - Nu. ${event.wage_rate}/${event.wage_unit} - ${event.urgency}`));
        card.appendChild(element('p', '', `Applications: ${dateTime(event.application_opens_at)} - ${dateTime(event.application_closes_at)}`));
        card.appendChild(element('p', '', `Your application: ${event.application_status || 'Not applied'}${event.is_owner ? ' - Your posting' : ''}`));
        if (event.status === 'scheduled') card.appendChild(element('p', 'calendar-notice', 'Published work is visible now. Applications will open on the scheduled date.'));
        if (event.status === 'draft') card.appendChild(element('p', 'calendar-notice', 'Publish this draft to make it available when applications open.'));
      } else {
        const remove = element('button', 'btn secondary', 'Remove task');
        remove.type = 'button';
        remove.addEventListener('click', async () => {
          remove.disabled = true;
          try {
            const response = await fetch(`/api/calendar/tasks/${event.id}`, { method: 'DELETE', headers: { 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content } });
            if (!response.ok) throw new Error('Could not remove the task.');
            await loadEvents();
          } catch (error) { message.textContent = error.message; }
          finally { remove.disabled = false; }
        });
        card.appendChild(remove);
      }
      agenda.appendChild(card);
    });
  }
  function render() {
    const [year, monthNumber] = month.split('-').map(Number);
    const firstDay = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
    const days = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
    title.textContent = format(`${month}-01T12:00:00+06:00`, { month: 'long', year: 'numeric' });
    picker.value = month;
    calendar.replaceChildren();
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].forEach(day => calendar.appendChild(element('div', 'calendar-day-name', day)));
    const total = Math.ceil((firstDay + days) / 7) * 7;
    for (let index = 0; index < total; index += 1) {
      const day = index - firstDay + 1;
      const cell = element('div', 'calendar-cell');
      if (day < 1 || day > days) { cell.classList.add('muted-cell'); calendar.appendChild(cell); continue; }
      const key = `${month}-${String(day).padStart(2, '0')}`;
      if (key === today()) cell.classList.add('is-today');
      if (key === selectedDay) cell.classList.add('is-selected');
      const button = element('button', 'calendar-date', String(day));
      button.type = 'button';
      button.setAttribute('aria-label', `View work and tasks on ${key}`);
      button.setAttribute('aria-pressed', String(key === selectedDay));
      button.addEventListener('click', () => { selectedDay = key; render(); });
      cell.appendChild(button);
      const dayEvents = events.filter(event => overlaps(event, key));
      dayEvents.slice(0, 3).forEach(event => {
        const item = element(event.event_type === 'work' ? 'a' : 'button', `calendar-event ${event.status}${event.is_owner ? ' owner' : ''}`);
        if (event.event_type === 'work') item.href = `/jobs/${event.id}`;
        else { item.type = 'button'; item.addEventListener('click', () => { selectedDay = key; render(); }); }
        item.append(element('strong', '', event.title), element('span', '', `${dayKey(event.start) === key ? time(event.start) : 'Continues'} - ${labels[event.status] || event.status}`));
        item.title = eventLabel(event);
        item.setAttribute('aria-label', eventLabel(event));
        cell.appendChild(item);
      });
      if (dayEvents.length > 3) {
        const more = element('button', 'calendar-more', `+${dayEvents.length - 3} more`);
        more.type = 'button'; more.addEventListener('click', () => { selectedDay = key; render(); }); cell.appendChild(more);
      }
      calendar.appendChild(cell);
    }
    showAgenda();
  }
  async function loadEvents() {
    if (loading) return;
    loading = true;
    calendar.setAttribute('aria-busy', 'true');
    try {
      const response = await fetch('/api/calendar?mode=' + encodeURIComponent(calendar.dataset.mode || 'student'), { cache: 'no-store' });
      if (response.status === 401) throw new Error('Your session expired. Please log in again.');
      if (!response.ok) throw new Error('Calendar could not be refreshed. Use Refresh to try again.');
      const nextEvents = await response.json();
      if (!Array.isArray(nextEvents)) throw new Error('Calendar returned an invalid response.');
      events = nextEvents.flatMap(event => {
        if (event.event_type !== 'work' || !event.application_closes_at || !['open','applied','scheduled'].includes(event.status)) return [event];
        const deadline = { ...event, title: 'Apply by: ' + event.title, status: 'deadline', start: event.application_closes_at,
          end: new Date(new Date(event.application_closes_at).getTime() + 60000).toISOString(), milestone: true,
          work_start: event.start, work_end: event.end };
        if(event.status==='scheduled')return [event,deadline,{...event,title:'Applications open: '+event.title,status:'opening',start:event.application_opens_at,end:new Date(new Date(event.application_opens_at).getTime()+60000).toISOString(),milestone:true,work_start:event.start,work_end:event.end}];
        return [event, deadline];
      });
      render();
      message.textContent = `Updated ${time(new Date())} - Bhutan time - Updates automatically every 15 seconds.`;
    } catch (error) { message.textContent = error.message; }
    finally { loading = false; calendar.setAttribute('aria-busy', 'false'); }
  }
  function moveMonth(amount) {
    const [year, number] = month.split('-').map(Number);
    const next = new Date(Date.UTC(year, number - 1 + amount, 1));
    month = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, '0')}`;
    selectedDay = null; render();
  }
  document.getElementById('prevMonth').addEventListener('click', () => moveMonth(-1));
  document.getElementById('nextMonth').addEventListener('click', () => moveMonth(1));
  document.getElementById('calendarToday').addEventListener('click', () => { month = today().slice(0, 7); selectedDay = today(); render(); });
  document.getElementById('calendarRefresh').addEventListener('click', loadEvents);
  document.getElementById('showMonthEvents').addEventListener('click', () => { selectedDay = null; render(); });
  picker.addEventListener('change', () => { if (/^\d{4}-\d{2}$/.test(picker.value)) { month = picker.value; selectedDay = null; render(); } });
  const form = document.getElementById('taskForm');
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const submit = form.querySelector('button'); submit.disabled = true;
    try {
      const response = await fetch('/api/calendar/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': document.querySelector('meta[name="csrf-token"]').content }, body: JSON.stringify(Object.fromEntries(new FormData(form).entries())) });
      if (!response.ok) {
        const data = await response.json(); throw new Error(data.error || 'Unable to add task.');
      }
      const task = await response.json(); month = dayKey(task.start_at).slice(0, 7); selectedDay = dayKey(task.start_at);
      form.reset(); await loadEvents();
    } catch (error) { message.textContent = error.message; }
    finally { submit.disabled = false; }
  });
  window.addEventListener('focus', loadEvents);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loadEvents(); });
  let timer = null;
  function startRefresh() {
    if (timer === null) timer = window.setInterval(() => { if (!document.hidden) loadEvents(); }, 15000);
  }
  window.addEventListener('pagehide', () => { window.clearInterval(timer); timer = null; });
  window.addEventListener('pageshow', () => { startRefresh(); loadEvents(); });
  startRefresh();
  render(); loadEvents();
});
