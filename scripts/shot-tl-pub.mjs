import { chromium } from 'playwright';
const U='https://eric-collaborative-pmid-safari.trycloudflare.com'; const OUT='reports/screenshots/timeline'; const CID='46f6002a-cb7b-4ad5-a3bc-967c88eeebe7';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1050}});
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:30000});
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(4000);
await pg.goto(U+'/cases/'+CID+'/timeline',{waitUntil:'networkidle',timeout:30000}).catch(()=>{});await pg.waitForTimeout(3000);
await pg.screenshot({path:OUT+'/public-timeline-home.png'});console.log('public timeline shot done');
await b.close();
