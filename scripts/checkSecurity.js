// Lightweight project lint rules; no environment files or databases are read.
const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(entry=>entry.isDirectory()?files(path.join(dir,entry.name)):[path.join(dir,entry.name)]);}
let forms=0;
for(const file of files('views').filter(file=>file.endsWith('.ejs'))){
 const source=fs.readFileSync(file,'utf8');
 const formPattern=/<form\b(?:<%[\s\S]*?%>|[^>])*>([\s\S]*?)<\/form>/g;
 for(const match of source.matchAll(formPattern)){
  if(!/method="POST"/.test(match[0]))continue;
  assert.match(match[1],/name="_csrf"/,`${file}: state-changing form needs a CSRF field`);forms++;
 }
 assert.ok(!/password_hash|reset_token_hash|verification_token/.test(source),`${file}: private account fields cannot appear in templates`);
}
assert.ok(fs.readFileSync('app.js','utf8').includes("require('./middleware/security').csrf"),'Global CSRF middleware is required');
assert.ok(!fs.readFileSync('server.js','utf8').includes('seedDemo'),'Production startup cannot seed demo accounts');
console.log(`PASS: ${forms} POST forms include CSRF fields; private account fields excluded from views; demo seed excluded from startup.`);
