import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/typography';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1100}});
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);
async function shot(n,p,full=true){await pg.goto(BASE+p,{waitUntil:'networkidle',timeout:20000}).catch(()=>{});await pg.waitForTimeout(1800);await pg.screenshot({path:`${OUT}/after-${n}.png`,fullPage:full});console.log('  '+n);}
async function tab(label,n){try{await pg.click(`text=${label}`,{timeout:4000});await pg.waitForTimeout(1200);await pg.screenshot({path:`${OUT}/after-firm-${n}.png`,fullPage:true});console.log('  firm-'+n);}catch(e){console.log('  tab miss',label);}}
await shot('firm','/firm');
await tab('Offices & Departments','offices');
await tab('Personnel','personnel');
await tab('Security','security');
await shot('org-settings','/organization/settings');
await shot('settings','/settings');
await shot('billing','/billing');
await b.close(); console.log('done');
