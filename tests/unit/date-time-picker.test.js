const fs = require('fs');
const vm = require('vm');
const dates = require('../../public/js/dateTimeInput');
function mount(nativePicker = true) {
  class Node {
    constructor() { this.children = []; this.handlers = {}; this.events = []; this.value = ''; this.classList = { add: jest.fn(), remove: jest.fn() }; }
    before() {}
    append(...nodes) { this.children.push(...nodes); }
    closest() { return null; }
    setAttribute() {}
    addEventListener(name, handler) { this.handlers[name] = handler; }
    dispatchEvent(event) { this.events.push(event.type); }
    focus() { this.focused = true; }
  }
  const input = new Node();
  input.value = '23/10/2026 02:30 PM';
  const created = [];
  const document = { querySelectorAll: () => [input], createElement: () => { const node = new Node(); created.push(node); return node; } };
  vm.runInNewContext(fs.readFileSync(require.resolve('../../public/js/dateTimePicker'), 'utf8'), {
    document, window: { ScheduleDates: dates }, Event: class { constructor(type) { this.type = type; } },
  });
  const [, picker, button] = created;
  if (nativePicker) picker.showPicker = jest.fn();
  return { input, picker, button };
}
test('right-side button opens a picker using the displayed date and selection preserves day-first AM/PM', () => {
  const { input, picker, button } = mount();
  button.handlers.click();
  expect(picker.showPicker).toHaveBeenCalled();
  expect(picker.value).toBe('2026-10-23T14:30');
  picker.value = '2026-11-05T09:15';
  picker.handlers.change();
  expect(input.value).toBe('05/11/2026 09:15 AM');
  expect(input.events).toEqual(['input', 'change']);
  expect(picker.name).toBeUndefined();
});
test('browsers without showPicker get a visible native date and time control', () => {
  const { picker, button } = mount(false);
  button.handlers.click();
  expect(picker.classList.add).toHaveBeenCalledWith('is-visible');
  expect(picker.focused).toBe(true);
});
