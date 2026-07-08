import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/evidence-p77'; const CID='46f6002a-cb7b-4ad5-a3bc-967c88eeebe7';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1150}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,90));});
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);
await pg.goto(BASE+'/cases/'+CID+'/evidence',{waitUntil:'networkidle',timeout:25000}).catch(()=>{});await pg.waitForTimeout(2500);
await pg.screenshot({path:OUT+'/evidence-home.png',fullPage:true});
console.log('home shot');
// open detail drawer
try{ await pg.getByText('witness.txt',{exact:false}).first().click({timeout:5000}); await pg.waitForTimeout(1500); await pg.screenshot({path:OUT+'/evidence-detail.png'}); console.log('detail shot'); }catch(e){ console.log('detail miss',e.message.slice(0,50)); }
await b.close();console.log('CONSOLE_ERRORS',errs.length);errs.slice(0,6).forEach(e=>console.log('  ',e));
