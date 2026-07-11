import { chromium } from 'playwright';
const U='https://nicholas-continued-shot-supported.trycloudflare.com';
const OUT='reports/screenshots/premium-demo';
const b=await chromium.launch();const pg=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[];pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,100));});
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,100)));
const R=[];
async function shot(name,path,check){
  const r=await pg.goto(U+path,{waitUntil:'networkidle',timeout:45000});await pg.waitForTimeout(2500);
  const body=await pg.$eval('body',el=>el.innerText).catch(()=>'');
  const ill=/ILLUSTRATIVE/i.test(body);
  const extra=check?check(body):'';
  R.push(`${name}: ${r?.status()} | ILLUSTRATIVE=${ill} ${extra}`);
  await pg.screenshot({path:`${OUT}/${name}.png`});
}
await shot('landing','/');
await shot('gallery','/demo',(b)=>'| scorecard='+/Case Strength/i.test(b)+' findings='+/Key Findings/i.test(b));
await pg.screenshot({path:`${OUT}/gallery-full.png`,fullPage:true});
await shot('workbench','/demo/workbench',(b)=>'| weaknesses='+/Prosecution Weaknesses/i.test(b)+' elements='+/Element-Based Analysis/i.test(b)+' defense='+/Defense Opportunities/i.test(b)+' tasks='+/Investigative Tasks/i.test(b)+' contra='+/Contradiction Workspace/i.test(b));
await pg.screenshot({path:`${OUT}/workbench-full.png`,fullPage:true});
await shot('brief','/demo/brief',(b)=>'| brief='+/Case Brief/i.test(b));
await shot('map','/demo/map',(b)=>'| aid='+/Investigative/i.test(b));
await shot('kg','/demo/knowledge-graph',(b)=>'| kg='+/Knowledge Graph/i.test(b));
await shot('timeline','/demo/timeline',(b)=>'| tl='+/Timeline/i.test(b));
// interactive timeline click
try{ await pg.$$eval('button', els=>{const el=[...els].find(e=>/Incident occurred/i.test(e.textContent));if(el)el.click();}); await pg.waitForTimeout(800);
  const opened=await pg.$eval('body',el=>/Source \/ Evidence|Attorney note/i.test(el.innerText)); R.push('timeline-interactive: expanded='+opened);
}catch(e){R.push('timeline-interactive: '+e.message.slice(0,40));}
await b.close();
console.log(R.join('\n'));console.log('CONSOLE_ERRORS: '+errs.length);errs.slice(0,8).forEach(e=>console.log('  '+e));
