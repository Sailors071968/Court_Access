import { chromium } from 'playwright';
const U='https://networking-editor-dated-comment.trycloudflare.com';
const OUT='/workspace/reports/screenshots/p94';
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,100));});
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,100)));
const R=[];
async function check(name,path,label){
  const r=await pg.goto(U+path,{waitUntil:'networkidle',timeout:40000});
  await pg.waitForTimeout(2500);
  const body=await pg.$eval('body',el=>el.innerText).catch(()=>'');
  const hasLabel=/ILLUSTRATIVE EXAMPLE/i.test(body);
  R.push(`${name}: HTTP ${r?.status()} | ILLUSTRATIVE-label=${hasLabel} | ${label||''}`);
  await pg.screenshot({path:`${OUT}/${name}.png`});
}
// Public — NO login
await check('landing','/','demo section');
await check('gallery','/demo','main gallery');
await pg.screenshot({path:`${OUT}/gallery-full.png`,fullPage:true});
await check('knowledge-graph','/demo/knowledge-graph','KG');
await check('timeline','/demo/timeline','timeline');
await check('report-attorney','/demo/reports/attorney-report','attorney report');
await check('report-motion','/demo/reports/motion','motion');
await check('report-sentencing','/demo/reports/sentencing','sentencing');
await b.close();
console.log(R.join('\n'));
console.log('CONSOLE_ERRORS: '+errs.length);
errs.slice(0,10).forEach(e=>console.log('  '+e));
