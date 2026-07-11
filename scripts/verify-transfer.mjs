import { chromium } from 'playwright';
const U='https://nicholas-continued-shot-supported.trycloudflare.com';
const OUT='reports/screenshots/transfer';
const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,90));});
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,90)));
const R=[];
async function go(n,p,w=2500){const r=await pg.goto(U+p,{waitUntil:'networkidle',timeout:45000});await pg.waitForTimeout(w);R.push(`${n}: ${r?.status()}`);return r;}
await go('landing','/'); await pg.screenshot({path:`${OUT}/landing.png`});
await go('login','/login',1500);
await pg.fill('input[type=email]','demo.attorney@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(5000);
R.push('after-login url: '+(pg.url().replace(U,'')||'/'));
await pg.screenshot({path:`${OUT}/after-login.png`});
const authed = !pg.url().includes('/login');
R.push('authenticated: '+authed);
// try dashboard + demo
await go('dashboard','/dashboard'); await pg.screenshot({path:`${OUT}/dashboard.png`});
await go('demo','/demo'); await pg.screenshot({path:`${OUT}/demo.png`});
await go('demo-workbench','/demo/workbench');
await b.close();
console.log(R.join('\n'));console.log('CONSOLE_ERRORS: '+errs.length);errs.slice(0,10).forEach(e=>console.log('  '+e));
