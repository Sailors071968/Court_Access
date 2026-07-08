import { chromium } from 'playwright';
const U='https://eric-collaborative-pmid-safari.trycloudflare.com'; const OUT='reports/screenshots/landing-p83';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:900}});
await pg.goto(U+'/',{waitUntil:'networkidle',timeout:30000}).catch(()=>{});await pg.waitForTimeout(3000);
await pg.screenshot({path:OUT+'/public-hero.png'});console.log('public hero shot done');
await b.close();
