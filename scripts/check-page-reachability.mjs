import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join, basename, relative } from 'node:path';
function walk(d, a=[]){for(const e of readdirSync(d,{withFileTypes:true})){const p=join(d,e.name);if(e.isDirectory())walk(p,a);else if(/\.(tsx|jsx)$/.test(e.name))a.push(p);}return a;}
const pages = walk('src/pages');
const app = readFileSync('src/App.tsx','utf-8');
// all src files for reference check
function walkAll(d,a=[]){for(const e of readdirSync(d,{withFileTypes:true})){const p=join(d,e.name);if(e.isDirectory()){if(!/node_modules/.test(p))walkAll(p,a);}else if(/\.(ts|tsx)$/.test(e.name))a.push(p);}return a;}
const all = walkAll('src');
const contents = new Map(all.map(f=>[f,readFileSync(f,'utf-8')]));
const disconnected=[];
for(const f of pages){
  const base=basename(f).replace(/\.(tsx|jsx)$/,'');
  const re=new RegExp(`[\\'"/]${base}[\\'"]`);
  if(re.test(app)) continue; // imported in App
  // referenced by any other file (nested route/layout)?
  let refd=false;
  for(const [g,c] of contents){ if(g===f) continue; if(re.test(c)){refd=true;break;} }
  disconnected.push({file:relative('.',f), referencedElsewhere:refd, size:statSync(f).size});
}
console.log('Total page files:',pages.length);
console.log('Not imported by App.tsx:',disconnected.length);
for(const d of disconnected) console.log(`  ${d.referencedElsewhere?'[nested]':'[ORPHAN]'} ${d.file}`);
