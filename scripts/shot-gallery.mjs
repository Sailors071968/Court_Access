import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/ui-refinement';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:900}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,100));});
async function shot(n,p,w=1800){try{await pg.goto(BASE+p,{waitUntil:'networkidle',timeout:20000});}catch{await pg.goto(BASE+p,{timeout:20000}).catch(()=>{});}await pg.waitForTimeout(w);await pg.screenshot({path:`${OUT}/${n}.png`});console.log('  '+n);}
// login first
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
try{await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);}catch(e){console.log('login note',e.message.slice(0,60));}
const CID='d68de226-fcc4-4e22-b385-3403a589098f';
await shot('g-dashboard','/dashboard',2500);
await shot('g-cases','/cases');
await shot('g-case-overview',`/cases/${CID}/overview`);
await shot('g-evidence',`/cases/${CID}/evidence`);
await shot('g-charges',`/cases/${CID}/charges`);
await shot('g-motions',`/cases/${CID}/motions`);
await shot('g-research',`/cases/${CID}/research`);
await shot('g-search','/search');
await b.close(); console.log('CONSOLE_ERRORS:',errs.length); errs.slice(0,6).forEach(e=>console.log('  ',e));
