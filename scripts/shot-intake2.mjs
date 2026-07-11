import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/intake';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1250}});
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);
await pg.goto(BASE+'/cases',{waitUntil:'networkidle',timeout:20000}).catch(()=>{});await pg.waitForTimeout(1200);
await pg.getByRole('button',{name:/New Case/i}).first().click({timeout:5000}).catch(()=>{});
await pg.waitForTimeout(1000);
await pg.fill('#ci-title','People v. Demo').catch(()=>{});
// select Penal Code in the charge code selector
await pg.locator('select:has(option[value="PEN"])').first().selectOption('PEN').catch((e)=>console.log('code sel',e.message.slice(0,40)));
await pg.waitForTimeout(500);
const sec = pg.getByPlaceholder(/Type e.g/).first();
await sec.fill('459').catch((e)=>console.log('sec fill',e.message.slice(0,40)));
await pg.waitForTimeout(1600);
await pg.screenshot({path:OUT+'/intake-section-search.png'});
await pg.getByText('PEN 459',{exact:false}).first().click({timeout:4000}).catch((e)=>console.log('pick',e.message.slice(0,40)));
await pg.waitForTimeout(2000);
// scroll charges into view
await pg.getByText('CRIMINAL CHARGES',{exact:false}).scrollIntoViewIfNeeded().catch(()=>{});
await pg.waitForTimeout(400);
await pg.screenshot({path:OUT+'/intake-populated.png'});
await b.close();console.log('done');
