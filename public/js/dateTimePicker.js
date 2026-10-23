// Keep day-first text while using the browser's calendar and time picker.
document.querySelectorAll('[data-schedule-date]').forEach((input, index) => {
  const control = document.createElement('span');
  control.className = 'schedule-control';
  input.before(control);
  control.append(input);
  input.id ||= `schedule-date-${index}`;
  const label = control.closest('label');
  if (label) label.htmlFor = input.id;

  const picker = document.createElement('input');
  picker.type = 'datetime-local';
  picker.className = 'schedule-native-picker';
  picker.step = '60';
  picker.tabIndex = -1;
  picker.setAttribute('aria-label', 'Choose date and time');
  // Only the formatted text field is submitted, including for draft edits.
  picker.value = window.ScheduleDates.normalize(input.value) || '';

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'schedule-picker-button';
  button.textContent = '\uD83D\uDCC5';
  button.setAttribute('aria-label', `Choose date and time for ${label?.firstChild?.textContent.trim() || 'schedule'}`);
  button.setAttribute('aria-controls', input.id);
  button.addEventListener('click', () => {
    picker.value = window.ScheduleDates.normalize(input.value) || '';
    if (typeof picker.showPicker === 'function') {
      try { picker.showPicker(); return; } catch (_) { /* Use an inline native control when unavailable. */ }
    }
    picker.classList.add('is-visible');
    picker.tabIndex = 0;
    picker.focus();
  });
  picker.addEventListener('change', () => {
    if (!picker.value) return;
    input.value = window.ScheduleDates.display(picker.value + ':00+06:00');
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    picker.classList.remove('is-visible');
    picker.tabIndex = -1;
  });
  control.append(button, picker);
});
