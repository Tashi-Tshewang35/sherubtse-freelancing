// Explicit operator command only. No migrations are run by npm start.
require('dotenv').config();
const fs=require('fs');
const path=require('path');
const {spawnSync}=require('child_process');
const db=require('../config/db');
async function main(){
  const env={...process.env};
  if(env.DATABASE_URL){
    const url=new URL(env.DATABASE_URL);
    Object.assign(env,{PGHOST:url.hostname,PGPORT:url.port||'5432',PGDATABASE:decodeURIComponent(url.pathname.slice(1)),PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password)});
    if(url.searchParams.get('sslmode'))env.PGSSLMODE=url.searchParams.get('sslmode');
  }else Object.assign(env,{PGHOST:env.DB_HOST||'localhost',PGPORT:env.DB_PORT||'5432',PGDATABASE:env.DB_NAME||'sherubtse_freelance_db',PGUSER:env.DB_USER||'postgres',PGPASSWORD:env.DB_PASS||''});
  if(env.DB_SSL==='true')env.PGSSLMODE='verify-full';
  const candidates=process.platform==='win32'?[env.PG_DUMP_PATH,...[18,17,16].map(version=>`C:/Program Files/PostgreSQL/${version}/bin/pg_dump.exe`)]:[env.PG_DUMP_PATH||'pg_dump'];
  const executable=candidates.filter(Boolean).find(file=>file==='pg_dump'||fs.existsSync(file));
  if(!executable)throw new Error('Set PG_DUMP_PATH to pg_dump. No migration applied.');
  const folder=path.join(__dirname,'../backups');fs.mkdirSync(folder,{recursive:true});
  const result=spawnSync(executable,['--format=custom','--no-password','--file',path.join(folder,`before-security-${Date.now()}.dump`)],{env,windowsHide:true,stdio:'ignore'});
  if(result.error||result.status!==0)throw new Error('Database backup failed. No migration applied.');
  await db.none(fs.readFileSync(path.join(__dirname,'../database/migrations/002_security_and_trust.sql'),'utf8'));
  console.log('Security migration completed. Existing data retained; backup saved locally.');
}
main().catch(()=>{console.error('Security migration failed. Verify the backup tool, database connectivity and migration prerequisites. Credentials withheld.');process.exitCode=1;}).finally(()=>db.$pool.end());
