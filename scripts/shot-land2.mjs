import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/landing-p83';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,90));});
await pg.goto(BASE+'/',{waitUntil:'networkidle',timeout:25000}).catch(()=>{});await pg.waitForTimeout(2500);
// features section
await pg.evaluate(()=>document.querySelector('#features')?.scrollIntoView());await pg.waitForTimeout(800);
await pg.screenshot({path:OUT+'/features.png'});
// roles
await pg.evaluate(()=>document.querySelector('#who')?.scrollIntoView());await pg.waitForTimeout(800);
await pg.screenshot({path:OUT+'/roles.png'});
// pricing
await pg.evaluate(()=>document.querySelector('#pricing')?.scrollIntoView());await pg.waitForTimeout(800);
await pg.screenshot({path:OUT+'/pricing.png'});
console.log('section shots');
await b.close();console.log('CONSOLE_ERRORS',errs.length);errs.slice(0,6).forEach(e=>console.log('  ',e));
