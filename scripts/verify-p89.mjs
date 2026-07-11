import { chromium } from 'playwright';
const U='https://networking-editor-dated-comment.trycloudflare.com';
const OUT='/workspace/reports/screenshots/p89';
const CASES={ charges:'edfce74b-b3fd-4c9f-b799-a553daf32df9', rich:'46f6002a-cb7b-4ad5-a3bc-967c88eeebe7' };
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,100));});
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,100)));
const R=[];
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:40000});await pg.waitForTimeout(1200);
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(4000);
R.push('login: '+(pg.url().includes('/login')?'FAILED':'ok'));

async function openMotion(name,cid){
  const r=await pg.goto(`${U}/cases/${cid}/motions`,{waitUntil:'networkidle',timeout:40000});
  await pg.waitForTimeout(4000);
  const sections=await pg.$$eval('.report-charge h2',els=>els.map(e=>e.textContent.trim()));
  const unknowns=await pg.$$eval('.motion-builder',els=>{const t=els[0]?.innerText||'';return (t.match(/UNKNOWN/g)||[]).length;});
  const listBtns=await pg.$$eval('aside button',els=>els.length);
  R.push(`${name}: HTTP ${r?.status()} | draft-sections=${sections.length} | motion-list-items~${listBtns} | UNKNOWN=${unknowns}`);
  await pg.screenshot({path:`${OUT}/${name}.png`});
}
await openMotion('charges-suppress',CASES.charges);
// switch panel to Review
await pg.$$eval('aside button', els=>{const el=[...els].find(e=>/Review/.test(e.textContent));if(el)el.click();});
await pg.waitForTimeout(800);
await pg.screenshot({path:`${OUT}/charges-review-panel.png`});
// switch motion type to Brady via list
await pg.$$eval('aside button', els=>{const el=[...els].find(e=>/Brady/.test(e.textContent));if(el)el.click();});
await pg.waitForTimeout(3500);
R.push('switch-to-brady: '+(await pg.$$eval('.report-charge h2',e=>e.length))+' sections');
await openMotion('rich-suppress',CASES.rich);
// DOCX download test
try{
  const [dl]=await Promise.all([
    pg.waitForEvent('download',{timeout:15000}),
    pg.$$eval('button', els=>{const el=[...els].find(e=>/DOCX/.test(e.textContent));if(el)el.click();}),
  ]);
  const fn=dl.suggestedFilename();
  await dl.saveAs(`${OUT}/${fn}`);
  R.push('DOCX export: downloaded '+fn);
}catch(e){R.push('DOCX export: FAILED '+e.message.slice(0,50));}
// print emulation
await pg.emulateMedia({media:'print'});await pg.waitForTimeout(600);
await pg.screenshot({path:`${OUT}/print-emulation.png`});
await pg.emulateMedia({media:'screen'});
R.push('print-emulation: rendered');
await b.close();
console.log(R.join('\n'));
console.log('CONSOLE_ERRORS: '+errs.length);
errs.slice(0,10).forEach(e=>console.log('  '+e));
