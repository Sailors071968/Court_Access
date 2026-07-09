import { chromium } from 'playwright';
const U='https://networking-editor-dated-comment.trycloudflare.com';
const OUT='/workspace/reports/screenshots/p91';
const CASES={ burglary:'e78580cc-8da7-45e9-87c6-73d27e86b5cb', charges:'edfce74b-b3fd-4c9f-b799-a553daf32df9' };
const b=await chromium.launch();
const ctx=await b.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const pg=await ctx.newPage();
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,100));});
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,100)));
const R=[];
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:40000});await pg.waitForTimeout(1200);
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(4000);
R.push('login: '+(pg.url().includes('/login')?'FAILED':'ok'));
async function open(name,cid){
  const r=await pg.goto(`${U}/cases/${cid}/calcrim`,{waitUntil:'networkidle',timeout:40000});
  await pg.waitForTimeout(4000);
  const sections=await pg.$$eval('.report-section h2',els=>els.map(e=>e.textContent.trim()));
  const cards=await pg.$$eval('.report-charge',els=>els.length);
  const unknowns=await pg.$$eval('.report-root',els=>{const t=els[0]?.innerText||'';return (t.match(/UNKNOWN/g)||[]).length;});
  R.push(`${name}: HTTP ${r?.status()} | sections=${sections.length} | instruction-cards=${cards} | UNKNOWN=${unknowns}`);
  await pg.screenshot({path:`${OUT}/${name}.png`});
}
await open('burglary',CASES.burglary);
await pg.screenshot({path:`${OUT}/burglary-full.png`,fullPage:true});
// DOCX notebook
try{
  await pg.$$eval('button', els=>{const el=[...els].find(e=>/DOCX/.test(e.textContent));if(el)el.click();});
  await pg.waitForTimeout(500);
  const [dl]=await Promise.all([pg.waitForEvent('download',{timeout:15000}), pg.$$eval('button', els=>{const el=[...els].find(e=>/CALCRIM Notebook/.test(e.textContent));if(el)el.click();})]);
  const fn=dl.suggestedFilename(); await dl.saveAs(`${OUT}/${fn}`);
  R.push('DOCX CALCRIM Notebook: '+fn);
}catch(e){R.push('DOCX: FAILED '+e.message.slice(0,50));}
await open('charges',CASES.charges);
await pg.emulateMedia({media:'print'});await pg.waitForTimeout(600);
await pg.screenshot({path:`${OUT}/print-emulation.png`});
await pg.emulateMedia({media:'screen'});
R.push('print-emulation: rendered');
await b.close();
console.log(R.join('\n'));
console.log('CONSOLE_ERRORS: '+errs.length);
errs.slice(0,10).forEach(e=>console.log('  '+e));
