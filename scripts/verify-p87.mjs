import { chromium } from 'playwright';
const U='https://networking-editor-dated-comment.trycloudflare.com';
const OUT='reports/screenshots/staging-p87';
const CID='46f6002a-cb7b-4ad5-a3bc-967c88eeebe7';
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:900}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,80));});
const results=[];
async function go(name,path,wait=2200){try{const r=await pg.goto(U+path,{waitUntil:'networkidle',timeout:30000});await pg.waitForTimeout(wait);results.push(`${name}: HTTP ${r?.status()??'?'}`);return true;}catch(e){results.push(`${name}: ERR ${e.message.slice(0,40)}`);return false;}}
// Landing
await go('Landing','/'); await pg.screenshot({path:OUT+'/landing.png'});
// Login
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:30000});await pg.waitForTimeout(1500);
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(4000);
results.push('Login: '+(pg.url().includes('/dashboard')||!pg.url().includes('/login')?'OK (redirected)':'stayed on login'));
await go('Dashboard','/dashboard'); await pg.screenshot({path:OUT+'/dashboard.png'});
await go('Case Overview',`/cases/${CID}/overview`); await pg.screenshot({path:OUT+'/overview.png'});
await go('Evidence',`/cases/${CID}/evidence`);
await go('Timeline',`/cases/${CID}/timeline`);
await go('Knowledge Graph',`/cases/${CID}/knowledge-graph`); await pg.screenshot({path:OUT+'/kg.png'});
await go('Witnesses',`/cases/${CID}/witnesses`);
await go('Discovery',`/cases/${CID}/discovery`);
await go('Search','/search');
await b.close();
console.log(results.join('\n'));
console.log('CONSOLE_ERRORS: '+errs.length);
errs.slice(0,8).forEach(e=>console.log('  '+e));
