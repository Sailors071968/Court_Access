import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/final';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1200}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80));});
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
await pg.fill('input[type=email]','admin@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);
await pg.goto(BASE+'/admin/provider-integrations',{waitUntil:'networkidle',timeout:20000}).catch(()=>{});await pg.waitForTimeout(2000);
// click first Configure button
try{await pg.click('text=Configure',{timeout:5000});await pg.waitForTimeout(900);}catch(e){console.log('cfg miss',e.message.slice(0,50));}
await pg.screenshot({path:OUT+'/provider-configure.png',fullPage:false});console.log('configure shot');
await b.close();console.log('CONSOLE_ERRORS',errs.length);
