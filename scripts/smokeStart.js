// Runs the real npm start command on a temporary port and isolated test databases.
require('../config/testEnvironment').loadTestEnvironment();
const net = require('net');
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('child_process');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const reservation = net.createServer();
  await new Promise(resolve => reservation.listen(0, '127.0.0.1', resolve));
  const port = reservation.address().port;
  await new Promise(resolve => reservation.close(resolve));
  const windows = process.platform === 'win32';
  const command = windows ? 'cmd.exe' : 'npm';
  const args = windows ? ['/d', '/s', '/c', 'npm.cmd start'] : ['start'];
  const child = spawn(command, args, {
    cwd: path.join(__dirname, '..'), windowsHide: true,
    env: { ...process.env, PORT: String(port), HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  // Do not print arbitrary runtime output that might contain configuration values.
  child.stdout.resume(); child.stderr.resume();
  let launchError;
  child.once('error', error => { launchError = error; });
  try {
    let response;
    for (let attempt = 0; attempt < 100; attempt++) {
      if (launchError) throw new Error('Could not launch npm start.');
      try { response = await fetch(`http://127.0.0.1:${port}/health`); if (response.ok) break; }
      catch (_) { /* The server may still be connecting to the test databases. */ }
      await delay(100);
    }
    assert.ok(response?.ok, 'npm start must serve /health');
    const body = await response.json();
    assert.deepEqual(body, { status: 'ok', application: 'Sherubtse Freelancing' });
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    fs.mkdirSync(path.join(__dirname, '../delivery'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../delivery/startup-check.json'), JSON.stringify({ npmStart: 'passed', health: body, environment: 'isolated test databases and temporary HTTP port' }, null, 2));
    console.log('PASS: npm start launches server.js; /health returns safe JSON and security headers.');
  } finally {
    if (windows && child.pid) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    else child.kill('SIGTERM');
  }
}
main().catch(() => { console.error('Startup smoke check failed. Check test database setup and server configuration.'); process.exitCode = 1; });
