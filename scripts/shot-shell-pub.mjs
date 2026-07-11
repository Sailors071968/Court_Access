import { chromium } from 'playwright';
const U='https://eric-collaborative-pmid-safari.trycloudflare.com'; const OUT='reports/screenshots/shell-p84';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:900}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80));});
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:30000});
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(4000);
await pg.goto(U+'/dashboard',{waitUntil:'networkidle',timeout:30000}).catch(()=>{});await pg.waitForTimeout(2500);
await pg.screenshot({path:OUT+'/public-shell.png'});console.log('public shell shot done; CONSOLE_ERRORS',errs.length);
await b.close();
