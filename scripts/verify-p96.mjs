import { chromium } from 'playwright';
const U='https://networking-editor-dated-comment.trycloudflare.com';
const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80));});
const R=[];
for(const [n,p] of [['landing','/'],['pricing','/pricing'],['demo','/demo']]){
  const r=await pg.goto(U+p,{waitUntil:'networkidle',timeout:40000});await pg.waitForTimeout(2000);
  R.push(`${n}: HTTP ${r?.status()}`);
}
// login + dashboard
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:40000});await pg.waitForTimeout(1200);
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(4000);
R.push('login+dashboard: '+(pg.url().includes('/login')?'FAILED':'ok'));
await b.close();
console.log(R.join('\n'));console.log('CONSOLE_ERRORS: '+errs.length);errs.slice(0,6).forEach(e=>console.log('  '+e));
