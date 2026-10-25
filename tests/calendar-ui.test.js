const assert = require('node:assert/strict');
const fs = require('fs');
const vm = require('vm');
const { dayKey, overlaps } = require('../public/js/calendarDates');

test('Bhutan calendar dates and exclusive multi-day end boundaries', () => {
  assert.equal(dayKey('2030-01-01T20:00:00Z'), '2030-01-02');
  const event = { start: '2030-01-01T22:00:00+06:00', end: '2030-01-03T00:00:00+06:00' };
  assert.equal(overlaps(event, '2030-01-01'), true);
  assert.equal(overlaps(event, '2030-01-02'), true);
  assert.equal(overlaps(event, '2030-01-03'), false);
});

test('calendar renders work, refreshes newly published opportunities, navigates and reports errors', async () => {
  class Node {
    constructor(tag = 'div') { this.tag = tag; this.dataset = {}; this.children = []; this.listeners = {}; this.attributes = {}; this.classList = { add: () => {} }; this.hidden = false; }
    append(...nodes) { this.children.push(...nodes); }
    appendChild(node) { this.children.push(node); return node; }
    replaceChildren(...nodes) { this.children = nodes; }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, callback) { this.listeners[name] = callback; }
    querySelector() { return new Node('button'); }
  }
  const nodes = new Map();
  const documentListeners = {};
  const windowListeners = {};
  const document = {
    hidden: false,
    getElementById(id) { if (!nodes.has(id)) nodes.set(id, new Node()); return nodes.get(id); },
    createElement: tag => new Node(tag),
    addEventListener(name, callback) { documentListeners[name] = callback; },
  };
  let refresh;
  let requests = 0;
  let fail = false;
  const day = dayKey(new Date());
  let events = [{ id: 1, title: 'Published campus work with full title', start: day + 'T09:00:00+06:00', end: day + 'T12:00:00+06:00',
    event_type: 'work', status: 'open', employer_name: 'Business', location: 'Campus', wage_rate: 100, wage_unit: 'hour', urgency: 'normal',
    application_opens_at: day + 'T00:00:00+06:00', application_closes_at: day + 'T08:00:00+06:00' }];
  const window = { addEventListener: (name, callback) => { windowListeners[name] = callback; },
    setInterval: (callback, delay) => { assert.equal(delay, 15000); refresh = callback; return 1; }, clearInterval: () => {} };
  const context = vm.createContext({ window, document, Intl, Date, console,
    fetch: async () => { requests++; return { ok: !fail, status: fail ? 500 : 200, json: async () => events }; } });
  vm.runInContext(fs.readFileSync('public/js/calendarDates.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('public/js/calendar.js', 'utf8'), context);
  const settle = () => new Promise(resolve => setImmediate(resolve));
  documentListeners.DOMContentLoaded(); await settle();
  assert.equal(requests, 1);
  assert.equal(nodes.get('calendarAgenda').children.length, 2);
  const card = nodes.get('calendarAgenda').children[0];
  assert.equal(card.children[0].children[0].textContent, events[0].title);
  assert.equal(card.children[0].children[0].href, '/jobs/1');
  events = [...events, { ...events[0], id: 2, title: 'New employer posting' }];
  refresh(); await settle();
  assert.equal(nodes.get('calendarAgenda').children.length, 4);
  document.hidden = true; refresh(); await settle(); assert.equal(requests, 2);
  document.hidden = false; windowListeners.focus(); await settle(); assert.equal(requests, 3);
  nodes.get('nextMonth').listeners.click(); assert.equal(nodes.get('calendarAgenda').children[0].className, 'empty');
  nodes.get('prevMonth').listeners.click(); assert.equal(nodes.get('calendarAgenda').children.length, 4);
  fail = true; await nodes.get('calendarRefresh').listeners.click();
  assert.match(nodes.get('calendarMessage').textContent, /could not be refreshed/);
  assert.equal(nodes.get('calendarAgenda').children.length, 4);
});
