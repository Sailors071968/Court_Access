import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const BASE='http://localhost:8080'; const OUT='reports/screenshots/program-141'; mkdirSync(OUT,{recursive:true});
async function seed(page,email){const r=await page.request.post(`${BASE}/api/auth/login`,{data:{email,password:'TestPass123!'},headers:{'Content-Type':'application/json'}});const a=await r.json();await page.goto(`${BASE}/`,{waitUntil:'domcontentloaded'});await page.evaluate(({a})=>{localStorage.setItem('court-access-token',a.accessToken);localStorage.setItem('court-access-refresh-token',a.refreshToken);localStorage.setItem('court-access-auth',JSON.stringify({state:{user:a.user,isAuthenticated:true,subscriptionStatus:a.user.subscriptionStatus||'trial'},version:0}));},{a});}
const checks=[];
const b=await chromium.launch();
// Enterprise settings: admin granted, attorney denied
for(const [email,label,expect] of [['admin@courtaccess.test','admin','granted'],['attorney2@courtaccess.test','attorney','denied']]){
  const ctx=await b.newContext({viewport:{width:1440,height:900}});const p=await ctx.newPage();const errs=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await seed(p,email);await p.goto(`${BASE}/dashboard/enterprise-settings`,{waitUntil:'networkidle'});await p.waitForTimeout(1500);
  const t=await p.evaluate(()=>document.body.innerText);
  const granted=/Permission Matrix/.test(t)&&/Principal/.test(t); const denied=/Access Denied/.test(t);
  const outcome=granted?'granted':denied?'denied':'unknown';
  await p.screenshot({path:`${OUT}/enterprise-${label}.png`,fullPage:true});
  checks.push({page:'enterprise-settings',role:label,expect,outcome,pass:outcome===expect,errors:errs.length});
  await ctx.close();
}
// Public reel library (no auth)
{const ctx=await b.newContext({viewport:{width:1440,height:1000}});const p=await ctx.newPage();const errs=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(`${BASE}/marketing/reels`,{waitUntil:'networkidle'});await p.waitForTimeout(1500);
  const t=await p.evaluate(()=>document.body.innerText); const ok=/Marketing Reel Library/.test(t)&&/Illustrative Demonstration/.test(t);
  await p.screenshot({path:`${OUT}/marketing-reels.png`,fullPage:true});
  checks.push({page:'marketing-reels',role:'public',expect:'granted',outcome:ok?'granted':'unknown',pass:ok,errors:errs.length});
  await ctx.close();
}
await b.close();
checks.forEach(c=>console.log(`[${c.pass&&c.errors===0?'PASS':'FAIL'}] ${c.page}/${c.role}: ${c.outcome} errors=${c.errors}`));
process.exit(checks.every(c=>c.pass&&c.errors===0)?0:1);
