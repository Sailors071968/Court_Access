import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/final';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1000}});
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
await pg.fill('input[type=email]','admin@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);
await pg.goto(BASE+'/admin/provider-integrations',{waitUntil:'networkidle',timeout:20000}).catch(()=>{});await pg.waitForTimeout(2000);
// find the OpenAI card and click its Configure
const card = pg.locator('div', { hasText: 'GPT models for drafting' }).last();
await pg.getByText('OpenAI', { exact: true }).scrollIntoViewIfNeeded().catch(()=>{});
// click Configure buttons until a panel opens; target the OpenAI card region
const cfgButtons = pg.getByRole('button', { name: /Configure/ });
const n = await cfgButtons.count();
// OpenAI is the 6th provider (index 5) — click that one
try{ await cfgButtons.nth(5).click(); }catch{ await cfgButtons.first().click(); }
await pg.waitForTimeout(1000);
await pg.getByText('Configure OpenAI').scrollIntoViewIfNeeded().catch(()=>{});
await pg.waitForTimeout(500);
await pg.screenshot({path:OUT+'/provider-configure.png'});
console.log('buttons:', n, 'shot done');
await b.close();
