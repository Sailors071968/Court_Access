import { chromium } from 'playwright';
const U='https://networking-editor-dated-comment.trycloudflare.com';
const OUT='/workspace/reports/screenshots/p88';
const CASES={ large:'edfce74b-b3fd-4c9f-b799-a553daf32df9', rich:'46f6002a-cb7b-4ad5-a3bc-967c88eeebe7' };
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1440,height:1000}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,100));});
pg.on('pageerror',e=>errs.push('PAGEERR '+e.message.slice(0,100)));
const R=[];
// login
await pg.goto(U+'/login',{waitUntil:'networkidle',timeout:40000});await pg.waitForTimeout(1200);
await pg.fill('input[type=email]','attorney2@courtaccess.test');await pg.fill('input[type=password]','TestPass123!');await pg.click('button[type=submit]');await pg.waitForTimeout(4000);
R.push('login: '+(pg.url().includes('/login')?'FAILED':'ok'));
async function report(name,cid){
  const r=await pg.goto(`${U}/cases/${cid}/report`,{waitUntil:'networkidle',timeout:40000});
  await pg.waitForTimeout(3500);
  const h2=await pg.$$eval('.report-section h2',els=>els.map(e=>e.textContent.trim()));
  const unknowns=await pg.$$eval('.report-root', els=>{const t=els[0]?.innerText||'';return (t.match(/UNKNOWN/g)||[]).length;});
  R.push(`${name}: HTTP ${r?.status()} | sections=${h2.length} [${h2.slice(0,4).join(', ')}...] | UNKNOWN markers=${unknowns}`);
  await pg.screenshot({path:`${OUT}/${name}.png`,fullPage:false});
}
await report('large-ten-charges',CASES.large);
// full-page capture of large
await pg.screenshot({path:`${OUT}/large-full.png`,fullPage:true});
await report('rich-evidence-test',CASES.rich);
// print emulation
await pg.emulateMedia({media:'print'});
await pg.waitForTimeout(800);
await pg.screenshot({path:`${OUT}/print-emulation.png`,fullPage:false});
R.push('print-media-emulation: rendered');
await pg.emulateMedia({media:'screen'});
await b.close();
console.log(R.join('\n'));
console.log('CONSOLE_ERRORS: '+errs.length);
errs.slice(0,10).forEach(e=>console.log('  '+e));
