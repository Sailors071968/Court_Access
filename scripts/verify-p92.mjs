import { chromium } from 'playwright';
const U='https://networking-editor-dated-comment.trycloudflare.com';
const OUT='/workspace/reports/screenshots/p92';
const CID='e78580cc-8da7-45e9-87c6-73d27e86b5cb';
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,100));});
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,100)));
const R=[];
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:40000});await pg.waitForTimeout(1200);
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(4000);
R.push('login: '+(pg.url().includes('/login')?'FAILED':'ok'));
const r=await pg.goto(`${U}/cases/${CID}/voir-dire`,{waitUntil:'networkidle',timeout:40000});
await pg.waitForTimeout(4000);
const sections=await pg.$$eval('.report-section h2',els=>els.map(e=>e.textContent.trim()));
R.push(`voir-dire: HTTP ${r?.status()} | sections=${sections.length} [${sections.slice(0,5).join(', ')}...]`);
await pg.screenshot({path:`${OUT}/voir-dire.png`});
// Add a juror
await pg.$$eval('button', els=>{const el=[...els].find(e=>/Add Juror/.test(e.textContent));if(el)el.click();});
await pg.waitForTimeout(1000);
const jurorInputs=await pg.$$eval('#jurors input, #jurors textarea, #jurors select', els=>els.length);
R.push('add-juror: juror-fields='+jurorInputs);
// Add a cause challenge
await pg.$$eval('button', els=>{const el=[...els].find(e=>/Cause Challenge/.test(e.textContent));if(el)el.click();});
await pg.waitForTimeout(800);
await pg.screenshot({path:`${OUT}/voir-dire-workspaces.png`,fullPage:true});
// DOCX notebook
try{
  await pg.$$eval('button', els=>{const el=[...els].find(e=>/DOCX/.test(e.textContent));if(el)el.click();});
  await pg.waitForTimeout(500);
  const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:15000}), pg.$$eval('button', els=>{const el=[...els].find(e=>/Voir Dire Notebook/.test(e.textContent));if(el)el.click();})]);
  const fn=dl.suggestedFilename(); await dl.saveAs(`${OUT}/${fn}`);
  R.push('DOCX Voir Dire Notebook: '+fn);
}catch(e){R.push('DOCX: FAILED '+e.message.slice(0,50));}
// print emulation
await pg.emulateMedia({media:'print'});await pg.waitForTimeout(600);
await pg.screenshot({path:`${OUT}/print-emulation.png`});
await pg.emulateMedia({media:'screen'});
R.push('print-emulation: rendered');
const unknowns=await pg.$$eval('.report-root',els=>{const t=els[0]?.innerText||'';return (t.match(/UNKNOWN/g)||[]).length;});
R.push('UNKNOWN markers='+unknowns);
await b.close();
console.log(R.join('\n'));
console.log('CONSOLE_ERRORS: '+errs.length);
errs.slice(0,10).forEach(e=>console.log('  '+e));
