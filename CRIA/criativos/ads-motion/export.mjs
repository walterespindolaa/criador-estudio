import {chromium} from 'playwright';import {spawn} from 'child_process';import fs from 'fs';
const id=process.argv[2];const DUR=25;
const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('file://'+process.cwd()+`/out/${id}.html`);await p.evaluate(()=>window.ready);
const wav=await p.evaluate(async(DUR)=>{const sr=48000;const oac=new OfflineAudioContext(2,sr*DUR,sr);buildAudio(oac,oac.destination,0);const buf=await oac.startRendering();
 const L=buf.getChannelData(0),R=buf.getChannelData(1);let peak=0;for(let i=0;i<L.length;i++)peak=Math.max(peak,Math.abs(L[i]),Math.abs(R[i]));const g=peak>0?0.89/peak:1;
 const n=L.length;const ab=new ArrayBuffer(44+n*4);const v=new DataView(ab);const ws=(o,s)=>{for(let i=0;i<s.length;i++)v.setUint8(o+i,s.charCodeAt(i))};
 ws(0,'RIFF');v.setUint32(4,36+n*4,true);ws(8,'WAVE');ws(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);v.setUint32(24,sr,true);v.setUint32(28,sr*4,true);v.setUint16(32,4,true);v.setUint16(34,16,true);ws(36,'data');v.setUint32(40,n*4,true);
 for(let i=0;i<n;i++){v.setInt16(44+i*4,Math.max(-1,Math.min(1,L[i]*g))*32767,true);v.setInt16(46+i*4,Math.max(-1,Math.min(1,R[i]*g))*32767,true)}
 let s='';const u=new Uint8Array(ab);for(let i=0;i<u.length;i+=32768)s+=String.fromCharCode.apply(null,u.subarray(i,i+32768));return btoa(s)},DUR);
fs.writeFileSync(`out/${id}.wav`,Buffer.from(wav,'base64'));
const ff=spawn('ffmpeg',['-y','-loglevel','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-i',`out/${id}.wav`,'-c:v','libx264','-preset','medium','-b:v','5M','-maxrate','6M','-bufsize','12M','-pix_fmt','yuv420p','-profile:v','high','-r','30','-af','loudnorm=I=-14:TP=-1.5:LRA=11','-ar','48000','-c:a','aac','-b:a','192k','-shortest','-movflags','+faststart',`out/${id}.mp4`],{stdio:['pipe','ignore','inherit']});
for(let f=0;f<DUR*30;f++){const d=await p.evaluate(t=>{render(t);return document.getElementById('c').toDataURL('image/jpeg',0.95)},f/30);if(!ff.stdin.write(Buffer.from(d.split(',')[1],'base64')))await new Promise(r=>ff.stdin.once('drain',r))}
ff.stdin.end();await new Promise(r=>ff.on('close',r));console.log(id,'done errors',errs);await b.close();
