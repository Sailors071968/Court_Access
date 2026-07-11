import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/landing-p83';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,90));});
await pg.goto(BASE+'/',{waitUntil:'networkidle',timeout:25000}).catch(()=>{});await pg.waitForTimeout(2500);
await pg.screenshot({path:OUT+'/hero.png'});
await pg.screenshot({path:OUT+'/landing-full.png',fullPage:true});
console.log('landing shots');
await b.close();console.log('CONSOLE_ERRORS',errs.length);errs.slice(0,6).forEach(e=>console.log('  ',e));
