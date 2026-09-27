// C1 v3 · "Sua ideia morre no bloco de notas?" · PAS · organização · prints reais
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

SHAKES=[[.5,18],[1.5,10],[2,10],[4.5,22],[6.5,14],[7.4,26],[18,20],[20.6,18]];
const BEATS=[];for(let b=9;b<18;b+=.5)BEATS.push(b);

function render(t){TT=t;ctx.save();ctx.clearRect(0,0,W,H);const[sx,sy]=shake(t);ctx.translate(sx,sy);
 // ===== 0 a 3 GANCHO =====
 if(t<3){bg(t);notas(t,1.4);const pz=punch(t,[0,.5,1]);ctx.save();ctx.translate(540,760);ctx.scale(pz,pz);ctx.translate(-540,-760);
  const s1=o4(P(t,0,.25));txt('Sua ideia',540,600-(1-s1)*60,110,{a:s1});
  const m=P(t,.5,.72);if(m>0){ctx.save();ctx.translate(540,790);const ms=lerp(2.2,1,o4(m));ctx.scale(ms,ms);txt('MORRE',0,0,190,{col:C.laranja,a:o3(m)});const st=o4(P(t,.85,1.05));if(st>0){ctx.strokeStyle=C.ink;ctx.lineWidth=18;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-270,-62);ctx.lineTo(-270+540*st,-62);ctx.stroke()}ctx.restore()}
  const s3=o4(P(t,1.0,1.25));txt('no bloco de notas?',540,960-(1-s3)*60,96,{a:s3});ctx.restore();
  adesivo('sticker-interrogacao',860,380,220,t,1.5,.18);adesivo('sticker-lampada',210,400,200,t,2.0,-.14);
  if(t>2.85){const w=whip(t,3);ctx.fillStyle=hexA(C.ink,.0)}}
 // ===== 3 a 7 AGITAR =====
 else if(t<7){const inn=o4(P(t,3,3.25)),fall=i4(P(t,6.55,7));bg(t);ctx.save();ctx.translate((1-inn)*W*.6,fall*1400);ctx.rotate(fall*.15);
  const pz=punch(t,[3.5,4,4.5,5,5.5,6]);ctx.translate(540,700);ctx.scale(pz,pz);ctx.translate(-540,-700);
  const n=Math.floor(lerp(0,37,o3(P(t,3.1,4.3))));box(190,420,700,440,48,C.branco);txt('ideias salvas',540,510,44,{w:500,f:'Roboto',col:'rgba(10,10,10,.55)'});txt(String(n),540,720,210,{});
  const z=P(t,4.4,4.6);if(z>0){ctx.save();ctx.translate(540,800);ctx.rotate(-.06);const zs=lerp(2.4,1,i4(o3(z)));ctx.scale(zs,zs);ctx.globalAlpha=o3(z);ctx.strokeStyle=C.vermelho;ctx.lineWidth=10;rr(-190,-52,380,104,20);ctx.stroke();txt('0 POSTADAS',0,22,58,{col:C.vermelho});ctx.restore()}
  // mês vazio
  const g=o4(P(t,5,5.3));if(g>0){ctx.save();ctx.globalAlpha=g;ctx.translate(0,(1-g)*80);box(190,930,700,330,36,C.branco);txt('outubro',540,995,40,{col:'rgba(10,10,10,.5)'});for(let r=0;r<3;r++)for(let c=0;c<7;c++){const x=230+c*90,y=1030+r*72;ctx.fillStyle='rgba(10,10,10,.05)';rr(x,y,70,56,10);ctx.fill();const q=P(t,5.3+(r*7+c)*.03,5.5+(r*7+c)*.03);if(q>0)txt('?',x+35,y+42,40,{col:C.laranja,a:o3(q)})}ctx.restore()}
  const w1=o4(P(t,5.8,6.05)),w2=o4(P(t,6.1,6.35));txt('E o mês começa',540,1390-(1-w1)*50,74,{a:w1});txt('de novo sem plano.',540,1475-(1-w2)*50,74,{col:C.laranja,a:w2});ctx.restore()}
 // ===== 7 a 9 VIRADA =====
 else if(t<9){ctx.fillStyle=C.ink;ctx.fillRect(-40,-40,W+80,H+80);const k=o4(P(t,7.4,7.7));ctx.fillStyle=C.amarelo;ctx.beginPath();ctx.arc(540,860,lerp(0,1700,k),0,7);ctx.fill();
  if(t<7.4)txt('...',540,900,120,{col:C.creme,a:o3(P(t,7,7.15))});
  if(t>7.45)logoFatias('laranja',540,760,880,i=>{const t0=7.6+i*.25;const fp=P(t,t0,t0+.3);const sq=t>t0?Math.sin((t-t0)*22)*.1*Math.exp(-(t-t0)*6):0;const e=o4(P(t,7.45,7.75));const bob=t>8.4?Math.sin((t-8.4)*Math.PI*4+i)*10:0;return{dy:(1-e)*120+bob,sc:lerp(.7,1,e),face:fp>0?back(fp):0,sy:1-sq}});
  const e2=back(P(t,8.4,8.7));if(e2>0){ctx.save();ctx.translate(540,1170);ctx.scale(e2,e2);txt('dá pra organizar isso',0,0,84,{f:'"Grand Hotel"',w:400,col:C.ink});ctx.restore()}}
 // ===== 9 a 18 DEMO =====
 else if(t<18){bg(t);const pz=punch(t,BEATS.filter((b,i)=>i%2===0));
  const cap=(chipS,chipC,s1,s2,t0,t1)=>{if(t<t0||t>=t1)return;const a=o3(P(t,t0,t0+.2));const d1=o4(P(t,t0,t0+.3)),d2=o4(P(t,t0+.12,t0+.42));chip(chipS,540,300,chipC,C.ink,a);txt(s1,540+(1-d1)*-200,410,72,{a:d1});txt(s2,540+(1-d2)*200,490,72,{col:C.laranja,a:d2})};
  const scene=(t0,t1,im,rotA,draw)=>{if(t<t0-.15||t>t1+.15)return;const inP=t<t0+.15?whip(t,t0):0,outP=t>t1-.15?whip(t,t1):0;const enter=o4(P(t,t0-.05,t0+.35));const dx=(1-enter)*900-(t>t1?o4(P(t,t1,t1+.15))*900:0);const bob=Math.sin(t*2.2)*10;const rot=rotA+Math.sin(t*1.7)*.012;
   const f=()=>phone3(im,540+dx,1130+bob,560,{sc:pz*lerp(.85,1,enter),rot,zoom:draw.zoom?draw.zoom(t):1,fy:draw.fy||0},k=>draw.over&&draw.over(k));ghost(f,(inP+outP)*-160)};
  cap('Cria Plano','#FFD9EC','Seu mês organizado','post por post',9,12);
  cap('Calendário','#D6E6FF','Cada post no seu dia,','com pilar e horário',12,15);
  cap('Cria Stories','#D5F2E1','E os stories','no lugar certo',15,18);
  scene(9,12,IMG.p1,-.04,{over:k=>{ring(k,238,196,118,20,P(t,9.8,10.3),'pilar');ring(k,34,282,340,26,P(t,10.4,10.9),'data e horário','#0061EE','bottom');
    if(t>10.9&&t<11.9){const pr=t>11.35&&t<11.6?Math.sin(P(t,11.35,11.6)*Math.PI):0;const mv=o4(P(t,10.9,11.35));ctx.save();ctx.scale(1/1,1/1);cursor(lerp(285*k+200,285*k,mv),lerp(153*k+300,153*k,mv),pr,o3(P(t,10.9,11.1))*(1-P(t,11.7,11.9)));ctx.restore()}
    if(t>11.5){const p=back(P(t,11.5,11.8));ctx.save();ctx.translate(195*k,420*k);ctx.scale(p,p);box(-200,-44,400,88,44,C.verde);txt('✓ na agenda',0,16,46,{col:C.branco});ctx.restore()}}});
  scene(12,15,IMG.p2,.035,{zoom:tt=>lerp(1,1.08,io3(P(tt,12.3,14.8))),fy:.2,over:k=>{ring(k,253,212,90,20,P(t,12.8,13.3),'12 agendados');ring(k,32,528,316,70,P(t,13.6,14.1),'no dia certo',C.verde,'bottom')}});
  scene(15,18,IMG.p3,-.03,{zoom:tt=>lerp(1,1.06,io3(P(tt,15.3,17.8))),fy:.3,over:k=>{ring(k,96,368,48,14,P(t,15.6,16.1),'tutorial','#0061EE','right');ring(k,93,421,48,14,P(t,16.1,16.6),'caixinha',C.verde,'right');ring(k,96,473,48,14,P(t,16.6,17.1),'bastidor',C.laranja,'right')}});
  adesivo('sticker-agenda',880,760,190,t,13,.15);adesivo('sticker-coracao',200,800,170,t,16.1,-.2)}
 // ===== 18 a 20.6 PROVA =====
 else if(t<20.6){bg(t);const e=P(t,18,18.25);const s=lerp(1.6,1,o4(e));ctx.save();ctx.translate(540,1000);ctx.rotate(lerp(.08,-.02,o4(e)));ctx.scale(s,s);ctx.globalAlpha=o3(e);const cw=940,k=cw/370,ch=270*k;box(-cw/2-16,-ch/2-16,cw+32,ch+32,40,C.branco);ctx.save();rr(-cw/2,-ch/2,cw,ch,28);ctx.clip();ctx.drawImage(IMG.p1,10,183,370,270,-cw/2,-ch/2,cw,ch);ctx.restore();ctx.restore();
  const w1=back(P(t,18.35,18.6)),w2=back(P(t,18.7,18.95));if(w1>0){ctx.save();ctx.translate(540,470);ctx.scale(w1,w1);txt('nada mais solto.',0,0,96,{});ctx.restore()}if(w2>0){ctx.save();ctx.translate(540,580);ctx.scale(w2,w2);txt('tudo num lugar só.',0,0,96,{col:C.laranja});ctx.restore()}
  chip('tela real do app',540,1450,C.amarelo,C.ink,o3(P(t,19.1,19.3)));
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2,d=o4(P(t,18.05,18.8))*(420+(i%5)*60),al=1-P(t,18.5,19.3);if(al>0){ctx.fillStyle=[C.amarelo,C.rosa,C.azul,C.verde][i%4];ctx.globalAlpha=al;ctx.fillRect(540+Math.cos(a)*d-10,1000+Math.sin(a)*d*.8-10,20,20);ctx.globalAlpha=1}}}
 // ===== 20.6 a 25 CTA =====
 else{const w=o4(P(t,20.6,20.95));ctx.fillStyle=C.creme;ctx.fillRect(-40,-40,W+80,H+80);ctx.fillStyle=C.laranja;ctx.beginPath();ctx.arc(540,960,lerp(0,1500,w),0,7);ctx.fill();
  const g=ctx.createRadialGradient(200,400,0,200,400,700);g.addColorStop(0,hexA(C.amarelo,.35*w));g.addColorStop(1,hexA(C.amarelo,0));ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ['sticker-lampada','sticker-agenda','sticker-coracao','selo-club-verde'].forEach((n,i)=>adesivo(n,[150,930,140,940][i],[250,250,1500,1500][i],[180,170,160,190][i],t,21.3+i*.25,[.2,-.15,.15,-.2][i]));
  if(t>20.85)logoFatias('amarelo',540,540,800,i=>{const ph=((t-20.85-i*.1)%.5+.5)%.5/.5;const up=Math.sin(Math.min(1,ph/.5)*Math.PI);const e=o4(P(t,20.85,21.2));return{dy:-up*40+(1-e)*160,rot:(i%2?1:-1)*up*.07,sc:lerp(.6,1,e)}});
  const a1=back(P(t,21.3,21.55));if(a1>0){ctx.save();ctx.translate(540,950);ctx.scale(a1,a1);txt('Seu mês organizado.',0,0,86,{col:C.branco});ctx.restore()}
  const cp=back(P(t,21.8,22.1));const beat=Math.exp(-((t-22)%.5)*8)*(t>22.2?1:0);pill('Criar conta grátis',540,1100,{bg:C.amarelo,fg:C.ink,size:68,padX:60,sc:cp*(1+.05*beat),a:o3(P(t,21.8,21.95))});
  if(t>22.3){const ay=1195+Math.sin((t-22.3)*Math.PI*4)*12;ctx.save();ctx.globalAlpha=o3(P(t,22.3,22.5));ctx.strokeStyle=C.amarelo;ctx.lineWidth=12;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(540,ay+80);ctx.lineTo(540,ay);ctx.moveTo(505,ay+35);ctx.lineTo(540,ay);ctx.lineTo(575,ay+35);ctx.stroke();ctx.restore()}
  txt('No celular e no computador.',540,1320,44,{w:500,f:'Roboto',col:C.creme,a:o3(P(t,22.5,22.8))})}
 if(window.SAFE){ctx.fillStyle='rgba(224,52,43,.25)';ctx.fillRect(0,0,W,270);ctx.fillRect(0,1250,W,H-1250)}
 ctx.restore()}

function buildAudio(ac,out,T0=0){const S=criaSons(ac,out,T0);const fx=S.fx;
 S.trilha.pop(0,7);S.trilha.pop(7.5,13.1);
 fx.impacto(0);fx.pop(0.02,620);fx.impacto(.5);fx.whip(.5);fx.carimbo(.9);fx.pop(1.02,780);for(let i=0;i<8;i++)fx.papel(1.4+i*.16);fx.carimbo(1.5);fx.carimbo(2);
 fx.whip(2.95);fx.contador(3.1,1.2);[3.5,4,4.5,5,5.5,6].forEach(b=>fx.popGrave(b));fx.carimbo(4.45);fx.erro(4.5);fx.whooshCurto(5);fx.pop(5.8,620);fx.pop(6.1,780);fx.queda(6.5);
 fx.tremor(7.35);fx.zoomIn(7.4);[0,1,2].forEach(i=>fx.criatura(7.6+i*.25));S.assinatura.brilho(8.4);
 [9,12,15].forEach(b=>{fx.whip(b-.05);fx.whooshCurto(b)});[9.8,10.4,12.8,13.6,15.6,16.1,16.6].forEach(b=>fx.popAgudo(b));fx.clique(11.4);fx.sucesso(11.5);fx.carimbo(13);fx.carimbo(16.1);
 fx.impacto(18);fx.confete(18.05);fx.pop(18.35,700);fx.pop(18.7,900);fx.whoosh(20.4);S.assinatura.groove(20.6);[21.3,21.55,21.8,22.05].forEach((b,i)=>fx.popAgudo(b));fx.brilho(22.3)}

function loadImg(s){return new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=j;i.src=s})}
const ready=(async()=>{await Promise.all(Object.entries(MARCA).map(async([k,s])=>{IMG.m[k]=await loadImg(s)}));
 IMG.p1=await loadImg(PRINTS.p1);IMG.p2=await loadImg(PRINTS.p2);IMG.p3=await loadImg(PRINTS.p3);
 await Promise.all(['800 40px "Baloo 2"','400 40px Roboto','500 40px Roboto','400 40px "Grand Hotel"'].map(f=>document.fonts.load(f)));render(0)})();
window.render=render;window.buildAudio=buildAudio;window.ready=ready;
