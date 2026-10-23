// Read-only checks; never prints any actual credential value.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
const { spawnSync } = require('child_process');
const root = path.join(__dirname, '..');
const ignoredFolders = new Set(['node_modules', '.git', '.cache', 'backups', 'delivery', 'coverage', '.aws', '.codex', '.agents']);
function sourceFiles(folder) {
  return fs.readdirSync(folder, { withFileTypes: true }).flatMap(entry => {
    if (ignoredFolders.has(entry.name)) return [];
    if (entry.name.startsWith('.env') && !entry.name.endsWith('.example')) return [];
    const full = path.join(folder, entry.name);
    return entry.isDirectory() ? sourceFiles(full) : [full];
  });
}
const secretKeys = ['RESEND_API_KEY', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN', 'DB_PASS', 'SESSION_SECRET', 'GMAIL_APP_PASSWORD', 'ADMIN_PASSWORD', 'DATABASE_URL', 'MONGODB_URI'];
const local = fs.existsSync(path.join(root, '.env')) ? require('dotenv').parse(fs.readFileSync(path.join(root, '.env'))) : {};
const secrets = secretKeys.filter(key => {
  const value = local[key];
  if (!value || value.length < 8 || /^(your_|replace-|development-)/.test(value)) return false;
  // A credential-free localhost URI is a shareable default, not a password.
  if (key.endsWith('_URI') || key.endsWith('_URL')) {
    try { if (!new URL(value).username && !new URL(value).password) return false; }
    catch (_) { /* Check malformed configured values too, without printing them. */ }
  }
  return true;
});
let scanned = 0;
for (const file of sourceFiles(root)) {
  if (!/\.(js|json|sql|md|yml|yaml|example|mmd)$/.test(file) && !['Dockerfile', '.dockerignore', '.gitignore'].includes(path.basename(file))) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const key of secrets) assert.ok(!text.includes(local[key]), `Possible exposed ${key} in ${path.relative(root, file)}; value withheld.`);
  scanned++;
}
const gitFolder = fs.existsSync(path.join(root, '.git'));
if (gitFolder) {
  for (const file of ['.env', '.env.test', 'backups/', 'node_modules/', 'coverage/']) {
    const result = spawnSync('git', ['check-ignore', '-q', file], { cwd: root, windowsHide: true });
    assert.equal(result.status, 0, `${file} must be ignored`);
  }
  const tracked = spawnSync('git', ['ls-files', '.env', '.env.test'], { cwd: root, encoding: 'utf8', windowsHide: true });
  assert.equal(tracked.status, 0);
  assert.equal(tracked.stdout.trim(), '', 'Private environment files must not be tracked');
}
const dockerIgnore = fs.readFileSync(path.join(root, '.dockerignore'), 'utf8').split(/\r?\n/);
for (const name of ['.env', '.env.*', 'node_modules', '.git', 'coverage', 'backups', 'delivery', '.cache']) assert.ok(dockerIgnore.includes(name), `Missing Docker exclusion: ${name}`);
const app = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
assert.ok(!/app\.listen\s*\(/.test(app), 'app.js must not listen');
assert.ok(/module\.exports\s*=\s*app\s*;/.test(app), 'app.js must export Express');
assert.ok(/app\.listen\s*\(/.test(fs.readFileSync(path.join(root, 'server.js'), 'utf8')), 'server.js starts HTTP');
console.log(`PASS: ${scanned} source/example files checked against known local secret values; environment/Docker exclusions and app/server split verified.`);
console.log('This is a targeted credential check, not a complete security audit.');
