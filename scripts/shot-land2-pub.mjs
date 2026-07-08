import { chromium } from 'playwright';
const U='https://eric-collaborative-pmid-safari.trycloudflare.com'; const OUT='reports/screenshots/landing-p83';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80));});
await pg.goto(U+'/',{waitUntil:'networkidle',timeout:30000}).catch(()=>{});await pg.waitForTimeout(2500);
await pg.evaluate(()=>document.querySelector('#features')?.scrollIntoView());await pg.waitForTimeout(1000);
await pg.screenshot({path:OUT+'/public-features.png'});
console.log('public features shot done; CONSOLE_ERRORS',errs.length);
await b.close();
