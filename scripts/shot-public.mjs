import { chromium } from 'playwright';
const U='https://dependent-commitments-conviction-charter.trycloudflare.com';
const OUT='reports/screenshots/ui-refinement';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:900}});
async function shot(n,p){await pg.goto(U+p,{waitUntil:'networkidle',timeout:30000}).catch(()=>{});await pg.waitForTimeout(2500);await pg.screenshot({path:`${OUT}/${n}.png`});console.log('  '+n);}
await shot('public-01-landing','/');
await shot('public-02-register','/register');
await b.close(); console.log('done');
