import { chromium } from 'playwright';
const BASE='http://localhost:8090'; const OUT='reports/screenshots/collaboration';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80));});
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(3500);
// Open account menu (upper-right)
try{await pg.click('[aria-label="Account menu"]',{timeout:5000});await pg.waitForTimeout(800);await pg.screenshot({path:`${OUT}/account-menu.png`});console.log('account-menu');}catch(e){console.log('menu miss',e.message.slice(0,60));}
// Collaborators page
await pg.goto(BASE+'/collaborators',{waitUntil:'networkidle',timeout:20000}).catch(()=>{});await pg.waitForTimeout(2500);
await pg.screenshot({path:`${OUT}/collaborators.png`,fullPage:true});console.log('collaborators');
await b.close(); console.log('CONSOLE_ERRORS',errs.length); errs.slice(0,5).forEach(e=>console.log('  ',e));
