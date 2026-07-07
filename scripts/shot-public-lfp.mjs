import { chromium } from 'playwright';
const U='https://dependent-commitments-conviction-charter.trycloudflare.com';
const OUT='reports/screenshots/typography';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1000}});
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:30000});
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(4000);
await pg.goto(U+'/firm',{waitUntil:'networkidle',timeout:30000}).catch(()=>{});await pg.waitForTimeout(2500);
await pg.screenshot({path:`${OUT}/public-firm.png`});console.log('public-firm captured');
await b.close();
