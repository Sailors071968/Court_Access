import { chromium } from 'playwright';
const BASE='http://localhost:8080';
const OUT='reports/screenshots/ui-refinement';
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:1440,height:900}});
const errs=[];
pg.on('console',m=>{if(m.type()==='error')errs.push(m.text().slice(0,120));});
async function shot(name,path,wait=1500){
  try{await pg.goto(BASE+path,{waitUntil:'networkidle',timeout:20000});}catch{await pg.goto(BASE+path,{timeout:20000}).catch(()=>{});}
  await pg.waitForTimeout(wait);
  await pg.screenshot({path:`${OUT}/${name}.png`,fullPage:false});
  console.log(`  ${name}: ${path}`);
}
// public
await shot('01-landing','/');
await shot('02-login','/login');
await shot('03-register','/register');
await shot('04-pricing','/pricing');
// login as attorney
await pg.goto(BASE+'/login',{waitUntil:'networkidle'});
try{
  await pg.fill('input[type=email]','attorney2@courtaccess.test');
  await pg.fill('input[type=password]','TestPass123!');
  await pg.click('button[type=submit]');
  await pg.waitForTimeout(3000);
}catch(e){console.log('  login flow note:',e.message.slice(0,80));}
await shot('05-dashboard','/dashboard',2500);
await shot('06-cases','/cases',2000);
await shot('07-search','/search',2000);
await b.close();
console.log('CONSOLE_ERRORS:',errs.length); errs.slice(0,5).forEach(e=>console.log('   ',e));
