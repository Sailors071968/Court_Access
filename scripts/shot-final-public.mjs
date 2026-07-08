import { chromium } from 'playwright';
const U='https://eric-collaborative-pmid-safari.trycloudflare.com'; const OUT='reports/screenshots/final';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1100}});
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:30000});
await pg.fill('input[type=email]','admin@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(4000);
await pg.goto(U+'/admin/provider-integrations',{waitUntil:'networkidle',timeout:30000}).catch(()=>{});await pg.waitForTimeout(2500);
await pg.screenshot({path:`${OUT}/public-provider-integrations.png`});console.log('public shot done');
await b.close();
