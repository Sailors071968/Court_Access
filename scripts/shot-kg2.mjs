import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/kg';
const CID='edfce74b-b3fd-4c9f-b799-a553daf32df9';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1150}});
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);
await pg.goto(BASE+'/cases/'+CID+'/knowledge-graph',{waitUntil:'networkidle',timeout:25000}).catch(()=>{});await pg.waitForTimeout(3500);
// Click the case hub node chip precisely
const hub = pg.getByText(/Ten Charges \(F10/).first();
await hub.click({timeout:5000, force:true}).catch(e=>console.log('hub click',e.message.slice(0,40)));
await pg.waitForTimeout(1500);
await pg.screenshot({path:OUT+'/kg-node-detail.png'});
console.log('done');
await b.close();
