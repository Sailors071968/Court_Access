import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/kg';
const CID='edfce74b-b3fd-4c9f-b799-a553daf32df9';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1150}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,90));});
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);
await pg.goto(BASE+'/cases/'+CID+'/knowledge-graph',{waitUntil:'networkidle',timeout:25000}).catch(()=>{});await pg.waitForTimeout(3500);
await pg.screenshot({path:OUT+'/kg-home.png'});
console.log('kg home shot');
// click a node to open detail panel
try{ await pg.locator('svg').first().waitFor({timeout:3000}); }catch{}
try{ await pg.getByText(/PEN|Charge|§/).first().click({timeout:4000}); await pg.waitForTimeout(1200); await pg.screenshot({path:OUT+'/kg-node-detail.png'}); console.log('node detail shot'); }catch(e){ console.log('node click miss',e.message.slice(0,50)); }
await b.close();console.log('CONSOLE_ERRORS',errs.length);errs.slice(0,6).forEach(e=>console.log('  ',e));
