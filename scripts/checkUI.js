// Syntax checks do not connect to a database or read environment secrets.
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const ejs = require('ejs');
const roots = ['app.js', 'server.js', 'jest.config.js', 'jest.setup.js', 'jest.afterEnv.js', 'utils', 'config', 'controllers', 'middleware', 'models', 'routes', 'scripts', 'public/js', 'database', 'tests', 'views'];
function files(entry) {
  return fs.statSync(entry).isDirectory() ? fs.readdirSync(entry).flatMap(name => files(path.join(entry, name))) : [entry];
}
let javascript = 0;
let templates = 0;
for (const file of roots.flatMap(files)) {
  if (file.endsWith('.js')) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8', windowsHide: true });
    if (result.status !== 0) throw new Error(`${file}: ${result.stderr}`);
    javascript++;
  }
  if (file.endsWith('.ejs')) { ejs.compile(fs.readFileSync(file, 'utf8'), { filename: file }); templates++; }
}
console.log(`PASS: ${javascript} JavaScript files and ${templates} EJS templates compile.`);
