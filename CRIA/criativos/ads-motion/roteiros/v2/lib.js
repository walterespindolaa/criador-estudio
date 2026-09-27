// lib comum dos anúncios v3
const W=1080,H=1920,FPS=30,DUR=25;
const C={verde:'#01A652',rosa:'#FF77B9',laranja:'#EA4918',ink:'#0A0A0A',creme:'#F5F3E7',branco:'#FDFBF5',azul:'#0061EE',amarelo:'#FFCF03',lilas:'#7C90F0',vermelho:'#E0342B'};
const cv=document.getElementById('c'),ctx=cv.getContext('2d');const IMG={m:{}};
const cl=(x,a=0,b=1)=>Math.max(a,Math.min(b,x)),lerp=(a,b,p)=>a+(b-a)*p,P=(t,a,b)=>cl((t-a)/(b-a));
const o3=p=>1-Math.pow(1-p,3),o4=p=>1-Math.pow(1-p,4),i4=p=>p*p*p*p,io3=p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2,expo=p=>p>=1?1:1-Math.pow(2,-10*p);
const back=p=>{const c1=1.5,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2)};
function hexA(h,a){const n=parseInt(h.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
function F(w,s,f){return `${w} ${s}px ${f||'"Baloo 2"'}`}
function rr(x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function box(x,y,w,h,r,fill,sh=true){ctx.save();if(sh){ctx.shadowColor='rgba(10,10,10,.16)';ctx.shadowBlur=50;ctx.shadowOffsetY=20}ctx.fillStyle=fill;rr(x,y,w,h,r);ctx.fill();ctx.restore()}
function img(im,cx,cy,w,o={}){if(!im)return;const{rot=0,sx=1,sy=1,a=1}=o;if(a<=0)return;const h=w*im.height/im.width;ctx.save();ctx.globalAlpha*=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(sx,sy);ctx.drawImage(im,-w/2,-h/2,w,h);ctx.restore()}
function txt(s,x,y,size,o={}){const{w=800,f='"Baloo 2"',col=C.ink,a=1,al='center'}=o;if(a<=0)return;ctx.save();ctx.globalAlpha*=a;ctx.font=F(w,size,f);ctx.fillStyle=col;ctx.textAlign=al;ctx.textBaseline='alphabetic';ctx.fillText(s,x,y);ctx.restore()}
function pill(s,cx,cy,o={}){const{bg=C.ink,fg=C.creme,size=46,padX=40,sc=1,a=1}=o;if(sc<=0||a<=0)return;ctx.save();ctx.globalAlpha*=a;ctx.font=F(800,size);const tw=ctx.measureText(s).width+padX*2,h=size*1.9;ctx.translate(cx,cy);ctx.scale(sc,sc);box(-tw/2,-h/2,tw,h,h/2,bg);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s,0,size*.06);ctx.restore()}
// fundo creme + grid + blobs
function bg(t,base=C.creme){ctx.fillStyle=base;ctx.fillRect(0,0,W,H);ctx.save();ctx.strokeStyle='rgba(10,10,10,.045)';ctx.lineWidth=2;for(let x=0;x<=W;x+=72){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}for(let y=0;y<=H;y+=72){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}ctx.restore();
 if(base===C.creme)[[C.amarelo,160,380,560,0],[C.rosa,940,760,560,1.7],[C.azul,120,1350,600,3.1],[C.verde,980,1680,520,4.4]].forEach(([c,x,y,r,ph])=>{x+=Math.sin(t*.55+ph)*90;y+=Math.cos(t*.42+ph)*100;const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,hexA(c,.2));g.addColorStop(1,hexA(c,0));ctx.fillStyle=g;ctx.fillRect(0,0,W,H)})}
// palavras em cascata (# = laranja, ~ = riscado)
function words(lines,x,y,size,lh,t0,st=.09,o={}){const{col=C.ink,acc=C.laranja}=o;let k=0;lines.forEach((ln,li)=>{const ws=ln.split(' ');ctx.font=F(800,size);const parts=ws.map(w=>{let a=false,s=false;while(w[0]==='#'||w[0]==='~'){if(w[0]==='#')a=true;else s=true;w=w.slice(1)}return{w,a,s,wd:ctx.measureText(w).width}});const sp=size*.28;const tot=parts.reduce((s,p)=>s+p.wd,0)+sp*(parts.length-1);let cx=x-tot/2;parts.forEach(p=>{const tt=t0+k*st;k++;const e=P(0,0,1);const pp=P(TT,tt,tt+.35);if(pp>0){const dy=(1-o4(pp))*-70;ctx.save();ctx.globalAlpha=o3(P(TT,tt,tt+.18));ctx.font=F(800,size);ctx.fillStyle=p.a?acc:col;ctx.textAlign='left';ctx.fillText(p.w,cx,y+li*lh+dy);if(p.s){const sp2=o3(P(TT,tt+.35,tt+.6));ctx.strokeStyle=C.laranja;ctx.lineWidth=size*.1;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(cx-6,y+li*lh-size*.32);ctx.lineTo(cx-6+(p.wd+12)*sp2,y+li*lh-size*.32);ctx.stroke()}ctx.restore()}cx+=p.wd+sp})})}
let TT=0;
function wordTimes(lines,t0,st=.09){const n=lines.join(' ').split(' ').length;return Array.from({length:n},(_,k)=>t0+k*st)}
// logo criatura fatiada
const LF=[0,.395,.7255,1],RF=[0,.395,.787,1];
function logoFatias(cor,cx,cy,w,f){const L=IMG.m['logo-letras-'+cor],R=IMG.m['logo-rostos-'+cor];if(!L)return;const h=w*L.height/L.width;
 for(let i=0;i<3;i++){const o=f(i)||{};const{dx=0,dy=0,rot=0,sc=1,face=1,sy=1}=o;const x0=LF[i]*L.width,x1=LF[i+1]*L.width;const sx0=x0/L.width*w,sw=(x1-x0)/L.width*w;const px=cx-w/2+sx0+sw/2,py=cy+h/2;
  ctx.save();ctx.translate(px+dx,py+dy);ctx.rotate(rot);ctx.scale(sc*(2-sy),sc*sy);ctx.drawImage(L,x0,0,x1-x0,L.height,-sw/2,-h,sw,h);
  if(face>0){ctx.save();const fy=-h/2;ctx.translate(0,fy);ctx.scale(face,face);ctx.translate(0,-fy);const rx0=RF[i]*R.width,rx1=RF[i+1]*R.width;const rsx=(rx0-x0)/L.width*w,rsw=(rx1-rx0)/L.width*w;ctx.drawImage(R,rx0,0,rx1-rx0,R.height,-sw/2+rsx,-h,rsw,h);ctx.restore()}
  ctx.restore()}}
function adesivo(nome,x,y,w,t,t0,rot=0){const im=IMG.m[nome];if(!im||t<t0-.14)return;const p=P(t,t0-.14,t0);const s=lerp(2.4,1,i4(p));const dt=Math.max(0,t-t0);img(im,x,y,w,{sx:s,sy:s,rot:rot+Math.sin(dt*20)*.06*Math.exp(-dt*6),a:o3(p)})}
// celular com print real (scroll em px do print 390 de largura)
function phone(im,cx,top,w,o={}){const{zoom=1,fy=0,sc=1,a=1,rot=0,blur=0}=o;if(a<=0||sc<=0)return;const inner=w-28,k=inner/390,ih=im.height*k,h=ih+28;
 const z=Math.max(1,zoom),sw=390/z,sh=im.height/z,sx=(390-sw)/2,sy=cl((im.height-sh)*fy,0,im.height-sh);
 ctx.save();ctx.globalAlpha*=a;ctx.translate(cx,top+h/2);ctx.rotate(rot);ctx.scale(sc,sc);if(blur)ctx.filter=`blur(${blur}px)`;box(-w/2,-h/2,w,h,64,C.ink);ctx.save();rr(-w/2+14,-h/2+14,inner,ih,52);ctx.clip();ctx.drawImage(im,sx,sy,sw,sh,-w/2+14,-h/2+14,inner,ih);ctx.restore();ctx.restore();return{k,x0:cx-w/2+14,y0:top+14}}
function cursor(x,y,press,a=1){if(a<=0)return;ctx.save();ctx.globalAlpha*=a;ctx.translate(x,y);const s=lerp(1,.88,press);ctx.scale(s,s);if(press>0){ctx.fillStyle=hexA(C.amarelo,.45*press);ctx.beginPath();ctx.arc(0,0,70*press+20,0,7);ctx.fill()}ctx.fillStyle=C.ink;ctx.strokeStyle=C.branco;ctx.lineWidth=6;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,76);ctx.lineTo(20,58);ctx.lineTo(34,90);ctx.lineTo(48,84);ctx.lineTo(34,52);ctx.lineTo(60,52);ctx.closePath();ctx.stroke();ctx.fill();ctx.restore()}
function chip(s,x,y,col,fg,a){if(a<=0)return;ctx.save();ctx.globalAlpha*=a;ctx.font=F(800,40);const w=ctx.measureText(s).width+56;box(x-w/2,y-38,w,76,38,col,false);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s,x,y+2);ctx.restore()}
// celular v3: callback over(k) desenha por cima do print em coordenadas do print (px de 390)
function phone3(im,cx,cy,w,o={},over){const{zoom=1,fy=0,sc=1,a=1,rot=0}=o;if(a<=0||sc<=0)return;const inner=w-28,k=inner/390,ih=im.height*k,h=ih+28;
 const z=Math.max(1,zoom),sw=390/z,sh=im.height/z,sx=(390-sw)/2,sy=cl((im.height-sh)*fy,0,im.height-sh);
 ctx.save();ctx.globalAlpha*=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(sc,sc);box(-w/2,-h/2,w,h,64,C.ink);ctx.save();rr(-w/2+14,-h/2+14,inner,ih,52);ctx.clip();ctx.drawImage(im,sx,sy,sw,sh,-w/2+14,-h/2+14,inner,ih);
 if(over){ctx.translate(-w/2+14,-h/2+14);const kk=k*z;ctx.translate(-sx*kk,-sy*kk);over(kk)}ctx.restore();ctx.restore()}
// anel de destaque + etiqueta presa ao elemento
function ring(k,x,y,w,h,p,label,col=C.laranja,side='top'){if(p<=0)return;const e=o4(P(p,0,.5));ctx.save();ctx.lineWidth=5/k*1.6;ctx.strokeStyle=col;const pad=6;ctx.globalAlpha=e;const s=lerp(1.25,1,e);ctx.translate((x+w/2)*k,(y+h/2)*k);ctx.scale(s,s);ctx.lineWidth=6;rr(-(w/2+pad)*k,-(h/2+pad)*k,(w+pad*2)*k,(h+pad*2)*k,14);ctx.stroke();
 if(label){const lp=back(P(p,.15,.6));if(lp>0){ctx.font=F(800,34);const tw=ctx.measureText(label).width+40;const ly=side==='top'?-(h/2+pad)*k-50:side==='bottom'?(h/2+pad)*k+50:0,lx=side==='right'?(w/2+pad)*k+tw/2+20:0;ctx.save();ctx.translate(lx,ly);ctx.scale(lp,lp);box(-tw/2,-30,tw,60,30,col,false);ctx.fillStyle=C.branco;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(label,0,2);ctx.restore()}}ctx.restore()}
// post-its de ideia caindo e empilhando
const NOTAS=[['ideia de reels',C.amarelo],['trend da semana',C.rosa],['roteiro??',C.lilas],['publi do café',C.verde],['antes e depois',C.amarelo],['dia na vida',C.rosa],['arruma comigo',C.lilas],['caixinha',C.amarelo]];
function notas(t,t0,n=8){for(let i=0;i<n;i++){const ti=t0+i*.16;if(t<ti)continue;const dt=t-ti;const tx=[250,760,420,860,180,600,330,700][i],ty=[1500,1540,1420,1460,1600,1380,1520,1600][i];const y=Math.min(ty,-150+dt*dt*5200);const land=P(dt,Math.sqrt((ty+150)/5200),Math.sqrt((ty+150)/5200)+.25);const r=[-.2,.16,-.08,.24,.12,-.18,.2,-.1][i]+(1-land)*.4*(i%2?1:-1);
 ctx.save();ctx.translate(tx,y);ctx.rotate(r);box(-150,-110,300,220,14,NOTAS[i][1]);ctx.font=F(800,38);ctx.fillStyle=C.ink;ctx.textAlign='center';ctx.fillText(NOTAS[i][0],0,10);ctx.restore()}}
// tremida de câmera por impacto
let SHAKES=[];function shake(t){let x=0,y=0;SHAKES.forEach(([t0,a])=>{const d=t-t0;if(d>=0&&d<.35){const k=a*Math.exp(-d*14);x+=Math.sin(d*95)*k;y+=Math.cos(d*83)*k}});return[x,y]}
function punch(t,list){let s=1;list.forEach(t0=>{const d=t-t0;if(d>=0&&d<.4)s+=.045*Math.exp(-d*10)});return s}
function whip(t,tc){const p=P(t,tc-.15,tc+.15);return p<=0||p>=1?0:Math.sin(p*Math.PI)}
function ghost(draw,dx,n=4){for(let i=n;i>=1;i--){ctx.save();ctx.globalAlpha*=.12;ctx.translate(dx*i/n,0);draw();ctx.restore()}draw()}

