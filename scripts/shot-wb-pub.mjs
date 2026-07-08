import { chromium } from 'playwright';
const U='https://eric-collaborative-pmid-safari.trycloudflare.com'; const OUT='reports/screenshots/workbench';
const CID='edfce74b-b3fd-4c9f-b799-a553daf32df9';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1000}});
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:30000});
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(4000);
await pg.goto(U+'/cases/'+CID+'/attorney-workbench',{waitUntil:'networkidle',timeout:30000}).catch(()=>{});await pg.waitForTimeout(3000);
await pg.screenshot({path:OUT+'/public-workbench-home.png'});console.log('public workbench shot done');
await b.close();
