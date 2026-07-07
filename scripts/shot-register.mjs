import { chromium } from 'playwright';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:900}});
await pg.goto('http://localhost:8080/register',{waitUntil:'networkidle',timeout:20000}); await pg.waitForTimeout(2000);
await pg.screenshot({path:'reports/screenshots/ui-refinement/03-register-after.png'});
await b.close(); console.log('captured register-after');
