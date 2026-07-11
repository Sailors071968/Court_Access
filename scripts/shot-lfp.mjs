import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/typography';
import {mkdirSync} from 'node:fs'; mkdirSync(OUT,{recursive:true});
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1200}});
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
try{await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);}catch(e){console.log('login',e.message.slice(0,50));}
async function shot(n,p){await pg.goto(BASE+p,{waitUntil:'networkidle',timeout:20000}).catch(()=>{});await pg.waitForTimeout(2000);await pg.screenshot({path:`${OUT}/before-${n}.png`,fullPage:true});console.log('  '+n);}
await shot('firm','/firm');
await shot('org-settings','/organization/settings');
await shot('account-settings','/settings');
await b.close();
