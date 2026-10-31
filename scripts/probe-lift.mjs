// Headless probe of the 1.3 elevators (claude/js/beta_lift.js). Exit 0 = PASS.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
const root = process.cwd();
const PORT = Number(process.env.MV_LIFT_PORT || 8797);
const types = { '.html':'text/html','.js':'text/javascript','.json':'application/json','.ldtk':'application/json','.png':'image/png','.woff2':'font/woff2','.mp3':'audio/mpeg','.ogg':'audio/ogg','.tmj':'application/json' };
const srv = http.createServer((req,res)=>{ const p=path.join(root,decodeURIComponent(req.url.split('?')[0])); fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;} res.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'}); res.end(d); }); }).listen(PORT);
const out='test-results/lift'; fs.mkdirSync(out,{recursive:true});
const exe=fs.readdirSync('/opt/pw-browsers').includes('chromium_headless_shell-1243')?'/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell':undefined;
const b=await chromium.launch({executablePath:process.env.MV_CHROME||exe,args:['--use-gl=swiftshader','--enable-webgl','--ignore-gpu-blocklist','--autoplay-policy=no-user-gesture-required']});
const pg=await b.newPage({viewport:{width:1100,height:900}});
const errs=[]; pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(`http://127.0.0.1:${PORT}/index.html?lvl=1.3`,{waitUntil:'load'});
await pg.focus('#c').catch(()=>{});
for(let i=0;i<80;i++){ const ok=await pg.evaluate(()=>typeof _gameState!=='undefined'&&_gameState==='game'&&window.MV_BETA&&!MV_BETA.loading&&MV_BETA.stageId==='1.3'); if(ok) break; await pg.keyboard.press('Enter'); await pg.waitForTimeout(250); }
await pg.evaluate(()=>startBetaLab('1.3',15));
await pg.waitForFunction(()=>MV_BETA.stageId==='1.3'&&!MV_BETA.loading&&_gameState==='game',null,{timeout:20000});
await pg.waitForTimeout(800);
const ctx={pg,out,errs};
const mod=await import(process.argv[2]?path.resolve(process.argv[2]):'./probe-lift-steps.mjs');
let code=1; try{ code=await mod.default(ctx); }catch(e){ console.log('ERR',e); }
if(errs.length) code=1;
console.log('page errors:',errs.slice(0,5));
await b.close(); srv.close(); process.exit(code);
