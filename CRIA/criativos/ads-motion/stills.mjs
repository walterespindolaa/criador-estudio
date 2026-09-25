import {chromium} from 'playwright';import fs from 'fs';
const [id,...ts]=process.argv.slice(2);
const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>m.type()==='error'&&errs.push(m.text()));
await p.goto('file://'+process.cwd()+`/out/${id}.html`);await p.evaluate(()=>window.ready);
if(process.env.SAFE)await p.evaluate(()=>window.SAFE=true);
for(const t of ts.map(Number)){const d=await p.evaluate(t=>{render(t);return document.getElementById('c').toDataURL('image/jpeg',0.8)},t);fs.writeFileSync(`s_${t}.jpg`,Buffer.from(d.split(',')[1],'base64'))}
console.log('errors',errs);await b.close();
