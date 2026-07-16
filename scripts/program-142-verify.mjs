import { chromium } from 'playwright';
const BASE=process.env.BASE||'http://localhost:8080';
const b=await chromium.launch();
const results=[];
for(const [fmt,w,h] of [['vertical',1080,1920],['wide',1920,1080],['square',1080,1080]]){
  const ctx=await b.newContext({viewport:{width:w,height:h}});const p=await ctx.newPage();const errs=[];
  p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  await p.goto(`${BASE}/commercial?format=${fmt}&duration=30&autoplay=1`,{waitUntil:'networkidle'});
  await p.waitForTimeout(4000);
  const t=await p.evaluate(()=>document.body.innerText);
  const ok=/Illustrative Demonstration/i.test(t);
  results.push({fmt,errs:errs.length,ok});
  console.log(`[${errs.length===0&&ok?'PASS':'FAIL'}] commercial/${fmt}: illustrativeLabel=${ok} errors=${errs.length}`);
  await ctx.close();
}
await b.close();
process.exit(results.every(r=>r.errs===0&&r.ok)?0:1);
