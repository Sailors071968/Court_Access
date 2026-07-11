import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/final';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1200}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80));});
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
await pg.fill('input[type=email]','admin@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);
await pg.goto(BASE+'/admin/provider-integrations',{waitUntil:'networkidle',timeout:20000}).catch(()=>{});await pg.waitForTimeout(2500);
await pg.screenshot({path:`${OUT}/provider-integrations.png`,fullPage:true});console.log('provider-integrations');
await b.close(); console.log('CONSOLE_ERRORS',errs.length); errs.slice(0,5).forEach(e=>console.log('  ',e));
