// C1 v2 · "Não sei o que postar" · PAS · prints reais da conta demo (Duda)
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
// transição "corta a curva": sai pra cima, entra de baixo
function cut(t,tc){const out=i4(P(t,tc-.3,tc)),inn=o4(P(t,tc,tc+.3));return t<tc?{dy:-130*out,a:1-out}:{dy:130*(1-inn),a:inn}}
function zoomThrough(t,tc){if(t<tc){const p=P(t,tc-.22,tc);return{sc:1+.2*p,blur:10*p,a:1-p*.3}}const p=expo(P(t,tc,tc+.5));return{sc:lerp(.75,1,p),blur:0,a:p}}

function render(t){TT=t;ctx.save();ctx.clearRect(0,0,W,H);
 // ---------- 0 a 3.2 GANCHO ----------
 if(t<3.2){bg(t);const c=cut(t,3.2);ctx.save();ctx.translate(0,c.dy);ctx.globalAlpha=t>2.9?c.a:1;
  words(['Sua ideia','~#morre','no bloco de notas?'],540,700,100,140,.05,.1);
  adesivo('sticker-interrogacao',850,420,230,t,1.5,.18);adesivo('sticker-lampada',250,1230,210,t,1.9,-.14);ctx.restore()}
 // ---------- 3.2 a 7 AGITAR ----------
 else if(t<7){bg(t);const c=cut(t,3.2),o=t>6.7?{dy:-130*i4(P(t,6.7,7)),a:1-i4(P(t,6.7,7))}:c;ctx.save();ctx.translate(0,o.dy);ctx.globalAlpha=o.a;
  const n=Math.floor(lerp(0,37,o3(P(t,3.4,4.6))));const sh=t>5.2&&t<5.6?Math.sin(t*90)*10:0;
  box(190+sh,520,700,420,48,C.branco);txt('ideias salvas',540,610,44,{w:500,f:'Roboto',col:'rgba(10,10,10,.55)'});txt(String(n),540+sh,800,200,{});
  const pz=o4(P(t,4.9,5.2));if(pz>0){ctx.save();ctx.translate(540,880);ctx.scale(lerp(1.6,1,pz),lerp(1.6,1,pz));ctx.globalAlpha*=pz;box(-150,-40,300,80,40,'#FDE3DF',false);txt('0 postadas',0,16,44,{col:C.vermelho});ctx.restore()}
  words(['E o mês começa','de #novo #sem #plano.'],540,1110,86,108,5.6,.08);ctx.restore()}
 // ---------- 7 a 9 VIRADA: criaturas acordam ----------
 else if(t<9){const k=o4(P(t,7.35,7.6));bg(t);ctx.fillStyle=C.amarelo;ctx.beginPath();ctx.arc(540,860,lerp(0,1500,k),0,7);ctx.fill();
  if(t>7.45)logoFatias('laranja',540,780,860,i=>{const t0=7.75+i*.25;const fp=P(t,t0,t0+.3);const sq=t>t0?Math.sin((t-t0)*22)*.08*Math.exp(-(t-t0)*6):0;const e=o4(P(t,7.45,7.8));return{dy:(1-e)*80,sc:lerp(.8,1,e),face:fp>0?back(fp):0,sy:1-sq}});
  const e2=o3(P(t,8.35,8.6));txt('dá pra organizar isso',540,1180,76,{f:'"Grand Hotel"',w:400,col:C.ink,a:e2})}
 // ---------- 9 a 19 DEMO com prints reais ----------
 else if(t<19){bg(t);
  // título por etapa (máx. 3 a 5 palavras por batida)
  const cap=(s1,s2,t0,t1,chipS,chipC)=>{if(t<t0||t>t1)return;const a=o3(P(t,t0,t0+.25))*(1-i4(P(t,t1-.2,t1)));chip(chipS,540,300,chipC,C.ink,a);ctx.save();ctx.globalAlpha=a;const dy=(1-o4(P(t,t0,t0+.35)))*40;txt(s1,540,410+dy,70,{});if(s2)txt(s2,540,490+dy,70,{col:C.laranja});ctx.restore()};
  cap('Seu mês organizado','post por post',9.05,12.9,'Cria Plano','#FFD9EC');
  cap('Cada post no seu dia,','com pilar e horário',13.05,15.9,'Calendário','#D6E6FF');
  cap('E os stories','no lugar certo também',16.05,18.95,'Cria Stories','#D5F2E1');
  // cena A: plano gerado, scroll leve e toque no Enviar
  if(t<13.2){const z=t<13?{sc:1,blur:0,a:1}:zoomThrough(t,13.0);const e=o4(P(t,9.0,9.5));const scroll=0;
   const ph=phone(IMG.p1,540,560+(1-e)*300,560,{sc:z.sc*lerp(.9,1,e),blur:z.blur,a:z.a*e});
   if(ph&&t>11.2&&t<12.9){const tx=ph.x0+285*ph.k,ty=ph.y0+(153-scroll)*ph.k;const pr=t>12.0&&t<12.35?Math.sin(P(t,12.0,12.35)*Math.PI):0;const ca=o3(P(t,11.2,11.5))*(1-P(t,12.6,12.9));cursor(lerp(tx+160,tx,o4(P(t,11.2,11.9))),lerp(ty+320,ty,o4(P(t,11.2,11.9))),pr,ca)}
   if(t>12.3&&t<13){const p=o3(P(t,12.3,12.55));pill('✓ Enviado pra agenda',540,1560,{bg:C.verde,fg:C.branco,size:42,sc:lerp(.7,1,back(p)),a:p*(1-P(t,12.8,13))})}}
  // cena B: calendário
  else if(t<16.2){const z=t<16?zoomThrough(t,13.0):zoomThrough(t,16.0);ph2(IMG.p2,z,lerp(1,1.1,io3(P(t,13.6,15.8))),.35)}
  // cena C: stories
  else{const z=zoomThrough(t,16.0);ph2(IMG.p3,z,lerp(1,1.14,io3(P(t,16.6,18.8))),.4)}
  function ph2(im,z,zoom,fy){phone(im,540,560,560,{zoom,fy,sc:z.sc,blur:z.blur,a:z.a})}}
 // ---------- 19 a 21 PROVA: holofote no card real ----------
 else if(t<21){bg(t);ctx.fillStyle='rgba(10,10,10,.55)';ctx.fillRect(0,0,W,H);const e=o4(P(t,19,19.45));const s=lerp(.6,1,e);
  ctx.save();ctx.translate(540,860);ctx.scale(s,s);ctx.globalAlpha=e;const cw=940,k=cw/370,ch=270*k;box(-cw/2-16,-ch/2-16,cw+32,ch+32,40,C.branco);ctx.save();rr(-cw/2,-ch/2,cw,ch,28);ctx.clip();ctx.drawImage(IMG.p1,10,183,370,270,-cw/2,-ch/2,cw,ch);ctx.restore();ctx.restore();
  const pa=o3(P(t,19.5,19.8));chip('feito no app, conta demo',540,1330,C.amarelo,C.ink,pa);
  txt('nada mais solto',540,340,64,{col:C.branco,a:pa});txt('tudo num lugar só',540,420,64,{col:C.amarelo,a:pa})}
 // ---------- 21 a 25 CTA ----------
 else{const w=o4(P(t,21,21.35));ctx.fillStyle=C.creme;ctx.fillRect(0,0,W,H);ctx.fillStyle=C.laranja;ctx.beginPath();ctx.arc(540,1920,lerp(0,2400,w),0,7);ctx.fill();
  const g=ctx.createRadialGradient(200,400,0,200,400,650);g.addColorStop(0,hexA(C.amarelo,.3*w));g.addColorStop(1,hexA(C.amarelo,0));ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  if(t>21.25)logoFatias('amarelo',540,560,780,i=>{const ph=((t-21.25-i*.09)%.5+.5)%.5/.5;const up=Math.sin(Math.min(1,ph/.5)*Math.PI);const e=o4(P(t,21.25,21.6));return{dy:-up*34+(1-e)*120,rot:(i%2?1:-1)*up*.06,sc:lerp(.7,1,e)}});
  const a1=o3(P(t,21.6,21.9));txt('Seu mês organizado.',540,960,84,{col:C.branco,a:a1});
  const cp=o4(P(t,22.0,22.35));const pulse=1+.035*Math.sin((t-22)*Math.PI*4)*(t>22.4?1:0);pill('Criar conta grátis',540,1110,{bg:C.amarelo,fg:C.ink,size:66,padX:58,sc:lerp(.7,1,back(cp))*pulse,a:cp});
  txt('No celular e no computador.',540,1240,44,{w:500,f:'Roboto',col:C.creme,a:o3(P(t,22.4,22.7))})}
 if(window.SAFE){ctx.fillStyle='rgba(224,52,43,.25)';ctx.fillRect(0,0,W,270);ctx.fillRect(0,1250,W,H-1250)}
 ctx.restore()}

// ---------- SOM: trilha pop + efeitos do banco Sons do CRIA ----------
function buildAudio(ac,out,T0=0){const S=criaSons(ac,out,T0);const fx=S.fx;
 fx.impacto(0.02);wordTimes(['Sua ideia','morre','no bloco de notas?'],.05,.1).forEach((w,k)=>fx.pop(w+.02,[520,620,700,780][k%4]));fx.carimbo(1.5);fx.carimbo(1.9);
 fx.tictac(3.3,7);
 fx.whooshCurto(3.1);fx.contador(3.4,1.2);fx.erro(4.95);fx.tremor(5.2);wordTimes(['E o mês começa','de novo sem plano.'],5.6,.08).forEach((w,k)=>fx.pop(w+.02,[520,620,700,780][k%4]));
 fx.whoosh(6.75);fx.zoomIn(7.35);[0,1,2].forEach(i=>fx.criatura(7.75+i*.25));S.assinatura.brilho(8.3);
 S.trilha.pop(9,12);fx.whooshCurto(9);fx.clique(12.05);fx.sucesso(12.3);fx.zoomIn(13);fx.zoomIn(16);fx.papel(14.2);fx.papel(16.8);
 fx.impacto(19);fx.moeda(19.5);fx.whoosh(20.8);S.assinatura.groove(21.1);fx.pop(22.05,880);fx.brilho(22.4)}

function loadImg(s){return new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=j;i.src=s})}
const ready=(async()=>{await Promise.all(Object.entries(MARCA).map(async([k,s])=>{IMG.m[k]=await loadImg(s)}));
 IMG.p1=await loadImg(PRINTS.p1);IMG.p2=await loadImg(PRINTS.p2);IMG.p3=await loadImg(PRINTS.p3);
 await Promise.all(['800 40px "Baloo 2"','400 40px Roboto','500 40px Roboto','400 40px "Grand Hotel"'].map(f=>document.fonts.load(f)));render(0)})();
window.render=render;window.buildAudio=buildAudio;window.ready=ready;
