import { chromium } from 'playwright';
const U='https://networking-editor-dated-comment.trycloudflare.com';
const OUT='/workspace/reports/screenshots/p97';
const CID='e78580cc-8da7-45e9-87c6-73d27e86b5cb';
const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,90));});
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,90)));
const R=[];
for(const [n,p] of [['landing','/'],['pricing','/pricing'],['demo','/demo']]){const r=await pg.goto(U+p,{waitUntil:'networkidle',timeout:40000});await pg.waitForTimeout(1500);R.push(`${n}: ${r?.status()}`);}
// attorney login + key workspaces
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:40000});await pg.waitForTimeout(1000);
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(4000);
R.push('login: '+(pg.url().includes('/login')?'FAIL':'ok'));
for(const [n,p] of [['dashboard','/dashboard'],['workbench',`/cases/${CID}/attorney-workbench`],['report',`/cases/${CID}/report`],['sentencing',`/cases/${CID}/sentencing`]]){
  const r=await pg.goto(U+p,{waitUntil:'networkidle',timeout:40000});await pg.waitForTimeout(2500);R.push(`${n}: ${r?.status()}`);
}
await pg.screenshot({path:`${OUT}/workbench.png`});
// admin provider management
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:40000});await pg.waitForTimeout(800);
await pg.fill('input[type=email]','admin@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);
const rr=await pg.goto(U+'/admin/integrations',{waitUntil:'networkidle',timeout:40000}).catch(()=>null);await pg.waitForTimeout(2500);
const body=await pg.$eval('body',el=>el.innerText).catch(()=>'');
R.push('admin/integrations: '+(rr?rr.status():'?')+' | Stripe listed='+/stripe/i.test(body));
await pg.screenshot({path:`${OUT}/admin-integrations.png`});
await b.close();
console.log(R.join('\n'));console.log('CONSOLE_ERRORS: '+errs.length);errs.slice(0,8).forEach(e=>console.log('  '+e));
