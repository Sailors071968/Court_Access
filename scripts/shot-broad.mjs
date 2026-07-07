import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/typography';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80));});
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);
async function shot(n,p){await pg.goto(BASE+p,{waitUntil:'networkidle',timeout:20000}).catch(()=>{});await pg.waitForTimeout(1800);await pg.screenshot({path:`${OUT}/after-${n}.png`});console.log('  '+n);}
await shot('dashboard','/dashboard');
await shot('admin','/admin');
await shot('notifications','/notifications');
await shot('cases','/cases');
await b.close(); console.log('CONSOLE_ERRORS',errs.length);
