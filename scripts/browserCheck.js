// Uses installed Chrome's DevTools protocol; no extra npm dependency.
// Start Chrome headless with --remote-debugging-port=9223 before running.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json();
  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
  let id = 0;
  const pending = new Map();
  const errors = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id); pending.delete(message.id);
      message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    }
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await send('Page.enable'); await send('Runtime.enable');
  const output = path.join(__dirname, '../delivery/screenshots'); fs.mkdirSync(output, { recursive: true });
  const routes = ['/', '/jobs', '/login', '/signup', '/resend-verification', '/check-email', '/verified', '/dashboard', '/dashboard?role=employer', '/dashboard?role=dual', '/profile', '/profile?role=employer', '/jobs/new?role=employer', '/jobs/1', '/jobs/1/applicants?role=employer', '/notifications', '/admin?role=admin', '/error'];
  const results = [];
  try {
    for (const width of [360, 768, 1440]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width === 360 });
      for (const route of routes) {
        await send('Page.navigate', { url: 'http://127.0.0.1:3100' + route });
        for (let i = 0; i < 40; i++) { await delay(50); if (await evaluate("document.readyState==='complete' && !!document.querySelector('footer')")) break; }
        const layout = await evaluate(`(() => {
          const controls=[...document.querySelectorAll('input:not([type=hidden]),select,textarea,button')].filter(n=>n.getBoundingClientRect().width);
          return { width:innerWidth, scroll:document.documentElement.scrollWidth, title:document.title,
            missingLabels:controls.filter(n=>n.tagName!=='BUTTON' && !n.labels?.length && !n.getAttribute('aria-label')).map(n=>n.name),
            smallControls:controls.filter(n=>n.type!=='checkbox' && n.getBoundingClientRect().height<43).map(n=>n.name || n.textContent),
            main:!!document.querySelector('main h1'), errors:document.body.textContent.includes('ReferenceError') };
        })()`);
        assert.ok(!layout.errors && layout.main, route + ' renders');
        assert.ok(layout.scroll <= layout.width + 1, `${route} overflows at ${width}: ${layout.scroll}`);
        assert.deepEqual(layout.missingLabels, [], route + ' labels');
        assert.deepEqual(layout.smallControls, [], route + ' targets');
        if (route.startsWith('/dashboard')) {
          assert.ok(await evaluate("document.getElementById('calendarAgenda').children.length>0"), 'Calendar loads via /api/calendar');
        }
        if (route === '/jobs') {
          assert.equal(await evaluate("document.querySelector('[name=search]').value='zzzz'; document.querySelector('[name=search]').dispatchEvent(new Event('input',{bubbles:true})); document.querySelectorAll('[data-work-card]:not([hidden])').length"), 0);
          await evaluate("document.querySelector('[name=search]').value=''; document.querySelector('[name=search]').dispatchEvent(new Event('input',{bubbles:true}))");
        }
        if (route === '/login') assert.equal(await evaluate("document.querySelector('.password-toggle').click();document.querySelector('[name=password]').type"), 'text');
        const selected = ['/', '/jobs', '/login', '/signup', '/dashboard', '/dashboard?role=employer', '/profile', '/jobs/new?role=employer', '/jobs/1', '/jobs/1/applicants?role=employer', '/notifications', '/admin?role=admin'];
        if (width !== 768 && selected.includes(route)) {
          const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true });
          const name = route === '/' ? 'landing' : route.slice(1).replace(/[^a-z0-9]+/gi, '-');
          fs.writeFileSync(path.join(output, `${name}-${width}.png`), Buffer.from(shot.data, 'base64'));
        }
        results.push({ route, width, passed: true });
      }
    }
    assert.deepEqual(errors, [], 'No browser JavaScript errors');
    fs.writeFileSync(path.join(output, '../browser-results.json'), JSON.stringify(results, null, 2));
    console.log(`PASS: ${results.length} browser page/viewport checks; labels, controls, overflow, calendar, search and password toggle. Screenshots saved in delivery/screenshots.`);
  } finally { socket.close(); await fetch(`http://127.0.0.1:9223/json/close/${target.id}`); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
