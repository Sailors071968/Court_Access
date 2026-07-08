import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/intake';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1200}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,90));});
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);
await pg.goto(BASE+'/cases',{waitUntil:'networkidle',timeout:20000}).catch(()=>{});await pg.waitForTimeout(1500);
// open intake — click New Case / Create button
try{ await pg.getByRole('button',{name:/New Case|Create|New/i}).first().click({timeout:5000}); }catch(e){ console.log('open miss',e.message.slice(0,50)); }
await pg.waitForTimeout(1200);
await pg.screenshot({path:OUT+'/intake-open.png'});
// fill title + select a code + search section
try{
  await pg.fill('#ci-title','People v. Demo');
  await pg.selectOption('select', { label: /Penal Code/ }).catch(()=>{});
  // find the section search input (placeholder Type e.g.)
  const sec = pg.getByPlaceholder(/Type e.g/);
  await sec.first().fill('459');
  await pg.waitForTimeout(1500);
  await pg.screenshot({path:OUT+'/intake-section-search.png'});
  // click first result
  await pg.getByText('PEN 459', { exact: false }).first().click({timeout:4000}).catch(()=>{});
  await pg.waitForTimeout(1800);
  await pg.screenshot({path:OUT+'/intake-populated.png'});
}catch(e){ console.log('flow note', e.message.slice(0,60)); }
await b.close();console.log('CONSOLE_ERRORS',errs.length);errs.slice(0,5).forEach(e=>console.log('  ',e));
