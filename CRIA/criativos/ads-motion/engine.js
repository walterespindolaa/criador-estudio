// ============================================================
//  MOTOR DE ANÚNCIOS CRIA  (compartilhado pelos 8 vídeos)
//  Cada roteiro em /roteiros define window.AD = {...}
//  Linha do tempo padrão (25s):
//   0-3 gancho | 3-7 agitar | 7-9 virada (lâmpada) | 9-19 demo | 19-21 prova | 21-25 CTA
//  Área segura Reels: nada importante acima de y=270 nem abaixo de y=1250 (secundário até 1530)
// ============================================================
const W=1080,H=1920,FPS=30;
const C={verde:'#01A652',rosa:'#FF77B9',laranja:'#EA4918',ink:'#0A0A0A',creme:'#F5F3E7',branco:'#FDFBF5',azul:'#0061EE',amarelo:'#FFCF03',lilas:'#7C90F0',papel:'#F1EEE0',vermelho:'#E0342B',cinza:'rgba(10,10,10,0.5)'};
const cv=document.getElementById('c');const ctx=cv.getContext('2d');
const IMG={};
const T={LAMP_IN:7.0,FLASH:8.55,DROP:9.0,PROVA:19.0,WIPE:20.85,END:25};
// ---------- matemática ----------
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,p)=>a+(b-a)*p;
const P=(t,a,b)=>clamp((t-a)/(b-a));
const eOut=p=>1-Math.pow(1-p,3);
const eIn=p=>p*p*p;
const eInOut=p=>p<.5?4*p*p*p:1-Math.pow(-2*p+2,3)/2;
const eBack=p=>{const c1=1.70158,c3=c1+1;return 1+c3*Math.pow(p-1,3)+c1*Math.pow(p-1,2)};
const spring=(t0,t,f=1.6,d=6)=>t<t0?0:1-Math.exp(-d*(t-t0))*Math.cos(f*2*Math.PI*(t-t0));
function rng(seed){let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296}}
function hexA(h,a){if(h[0]!=='#')return h;const n=parseInt(h.slice(1),16);return `rgba(${n>>16&255},${n>>8&255},${n&255},${a})`}
function kf(t,frames){if(t<=frames[0][0])return{...frames[0][1]};for(let i=0;i<frames.length-1;i++){const[a,A]=frames[i],[b,B]=frames[i+1];if(t<=b){const p=eInOut(P(t,a,b));const o={};for(const k in A)o[k]=lerp(A[k],B[k],p);return o}}return{...frames[frames.length-1][1]}}
const nChars=(t,t0,t1,len)=>Math.floor(P(t,t0,t1)*len);
const BR=n=>Math.round(n).toLocaleString('pt-BR');
// ---------- desenho básico ----------
function F(w,s,fam){return `${w} ${s}px ${fam||'"Baloo 2"'}`}
function rr(x,y,w,h,r){r=Math.max(0,Math.min(r,w/2,h/2));ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function circle(x,y,r){ctx.beginPath();ctx.arc(x,y,Math.max(0,r),0,Math.PI*2);ctx.fill()}
function card(x,y,w,h,r,fill,shadow=true){ctx.save();if(shadow){ctx.shadowColor='rgba(10,10,10,0.14)';ctx.shadowBlur=44;ctx.shadowOffsetY=18}ctx.fillStyle=fill;rr(x,y,w,h,r);ctx.fill();ctx.restore()}
function drawImg(img,cx,cy,w,o={}){if(!img)return;const{rot=0,sx=1,sy=1,alpha=1}=o;if(alpha<=0||w<=0)return;const h=w*img.height/img.width;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(sx,sy);ctx.drawImage(img,-w/2,-h/2,w,h);ctx.restore()}
function wrap(text,maxW){const ws=text.split(' ');const out=[];let cur='';for(const w of ws){const tt=cur?cur+' '+w:w;if(ctx.measureText(tt).width>maxW&&cur){out.push(cur);cur=w}else cur=tt}if(cur)out.push(cur);return out}
function typeLines(lines,n){const o=[];let left=n;for(const l of lines){if(left<=0)break;o.push(l.slice(0,left));left-=l.length+1}return o}
function label(s,x,y,size,o={}){const{w=700,fam='Roboto',color=C.ink,align='left',alpha=1,ls=0}=o;ctx.save();ctx.globalAlpha*=alpha;ctx.font=F(w,size,fam);ctx.fillStyle=color;ctx.textAlign=align;if(ls)ctx.letterSpacing=ls+'px';ctx.fillText(s,x,y);ctx.restore()}
function pill(s,cx,cy,o={}){const{bg=C.ink,fg=C.creme,size=40,w=800,fam='"Baloo 2"',padX=34,h=size*1.9,shadow=true,sc=1,alpha=1}=o;if(sc<=0||alpha<=0)return 0;ctx.save();ctx.globalAlpha*=alpha;ctx.font=F(w,size,fam);const tw=ctx.measureText(s).width+padX*2;ctx.translate(cx,cy);ctx.scale(sc,sc);card(-tw/2,-h/2,tw,h,h/2,bg,shadow);ctx.fillStyle=fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s,0,size*0.06);ctx.restore();return tw}
function tag(s,x,y,bg,fg,size=26){ctx.save();ctx.font=F(700,size,'Roboto');ctx.letterSpacing='3px';const tw=ctx.measureText(s).width;ctx.fillStyle=bg;rr(x,y-size,tw+size*1.4,size*2,size);ctx.fill();ctx.fillStyle=fg;ctx.textBaseline='middle';ctx.fillText(s,x+size*0.7,y+1);ctx.restore();return tw+size*1.4}
function bar(x,y,w,h,p,col,bg='rgba(10,10,10,0.07)'){ctx.fillStyle=bg;rr(x,y,w,h,h/2);ctx.fill();if(p>0){ctx.fillStyle=col;rr(x,y,Math.max(h,w*p),h,h/2);ctx.fill()}}
function avatar(x,y,r,col,letter,fg=C.ink){ctx.fillStyle=col;circle(x,y,r);if(letter){ctx.fillStyle=fg;ctx.font=F(800,r*1.05);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(letter,x,y+r*0.08);ctx.textBaseline='alphabetic'}}
function check(x,y,r,s,col=C.verde){if(s<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle=col;circle(0,0,r);ctx.strokeStyle=C.branco;ctx.lineWidth=r*0.22;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(-r*0.42,0);ctx.lineTo(-r*0.1,r*0.32);ctx.lineTo(r*0.45,-r*0.3);ctx.stroke();ctx.restore()}
function xmark(x,y,r,s,col=C.vermelho){if(s<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle=col;circle(0,0,r);ctx.strokeStyle=C.branco;ctx.lineWidth=r*0.22;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-r*0.35,-r*0.35);ctx.lineTo(r*0.35,r*0.35);ctx.moveTo(r*0.35,-r*0.35);ctx.lineTo(-r*0.35,r*0.35);ctx.stroke();ctx.restore()}
function star(x,y,s){ctx.beginPath();for(let i=0;i<8;i++){const a=i*Math.PI/4;const r=i%2?s*0.38:s;ctx.lineTo(x+Math.cos(a)*r,y+Math.sin(a)*r)}ctx.closePath();ctx.fill()}
function arrowDown(x,y,s,col){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.strokeStyle=col;ctx.lineWidth=16;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(0,-60);ctx.lineTo(0,40);ctx.moveTo(-42,0);ctx.lineTo(0,42);ctx.lineTo(42,0);ctx.stroke();ctx.restore()}
// entrada padrão de um elemento: devolve {a,s,dy}
function enter(t,t0,d=0.45,out=null,outD=0.3){const p=P(t,t0,t0+d);const o=out!=null?eIn(P(t,out,out+outD)):0;return{p,a:eOut(P(t,t0,t0+d*0.5))*(1-o),s:lerp(0.6,1,eBack(p))*(1-o*0.15),dy:(1-eOut(p))*50-o*50,on:p>0&&o<1}}
function withT(e,cx,cy,fn){if(!e.on)return;ctx.save();ctx.globalAlpha*=e.a;ctx.translate(cx,cy+e.dy);ctx.scale(e.s,e.s);ctx.translate(-cx,-cy);fn();ctx.restore()}
function burst(x,y,t0,t,seed,n=12,spd=230,size=22){const p=(t-t0)/0.75;if(p<0||p>1)return;const r=rng(seed);const cols=[C.amarelo,C.rosa,C.azul,C.verde,C.laranja];ctx.save();for(let i=0;i<n;i++){const a=i/n*Math.PI*2+r()*0.5;const d=spd*eOut(p)*(0.6+r()*0.7);ctx.fillStyle=cols[i%cols.length];ctx.globalAlpha=1-eIn(p);star(x+Math.cos(a)*d,y+Math.sin(a)*d,(1-p*0.7)*size*(0.6+r()*0.6))}ctx.restore()}
function confetti(t,t0,x,y,n,seed){if(t<t0)return;const dt=t-t0;const r=rng(seed);const cols=[C.amarelo,C.rosa,C.azul,C.verde,C.laranja,C.lilas];ctx.save();for(let i=0;i<n;i++){const a=-Math.PI/2+(r()-0.5)*2.8;const v=900+r()*1300;const k=2.2;const px=x+Math.cos(a)*v*(1-Math.exp(-k*dt))/k;const py=y+Math.sin(a)*v*(1-Math.exp(-k*dt))/k+260*dt*dt;const rot=r()*6+dt*(r()*14-7);const w=16+r()*16,h=9+r()*9;const al=1-P(dt,1.6,2.2);if(al<=0)continue;ctx.globalAlpha=al;ctx.fillStyle=cols[i%cols.length];ctx.save();ctx.translate(px,py);ctx.rotate(rot);ctx.scale(1,Math.cos(dt*(4+r()*6)));ctx.fillRect(-w/2,-h/2,w,h);ctx.restore()}ctx.restore()}
// carimbo de texto (ex.: PUBLI PERDIDA)
function stamp(s,cx,cy,t,t0,col=C.vermelho,size=84,rot=-0.12){if(t<t0-0.2)return;const p=P(t,t0-0.2,t0);const sc=lerp(2.6,1,eIn(p));const dt=Math.max(0,t-t0);const r=rot+Math.sin(dt*22)*0.06*Math.exp(-dt*6);ctx.save();ctx.globalAlpha*=eOut(p);ctx.translate(cx,cy);ctx.rotate(r);ctx.scale(sc,sc);ctx.font=F(800,size);const w=ctx.measureText(s).width+size*0.9,h=size*1.45;ctx.strokeStyle=col;ctx.lineWidth=size*0.1;rr(-w/2,-h/2,w,h,size*0.22);ctx.stroke();ctx.fillStyle=hexA(col,0.08);ctx.fill();ctx.fillStyle=col;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(s,0,size*0.07);ctx.restore()}
// celular
function phone(cx,cy,w,h,fn,o={}){const{sc=1,alpha=1,rot=0}=o;if(sc<=0||alpha<=0)return;ctx.save();ctx.globalAlpha*=alpha;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(sc,sc);card(-w/2,-h/2,w,h,64,C.ink);ctx.fillStyle=C.branco;rr(-w/2+16,-h/2+16,w-32,h-32,50);ctx.fill();ctx.save();rr(-w/2+16,-h/2+16,w-32,h-32,50);ctx.clip();ctx.translate(-w/2+16,-h/2+16);fn(w-32,h-32);ctx.restore();ctx.fillStyle=C.ink;rr(-60,-h/2+28,120,30,15);ctx.fill();ctx.restore()}
// notificação estilo push
function notif(cx,y,w,t,t0,title,body,col=C.azul,letter='C',out=null){const e=enter(t,t0,0.5,out);if(!e.on)return;ctx.save();ctx.globalAlpha*=e.a;ctx.translate(0,(1-eOut(e.p))*-160-(out!=null?eIn(P(t,out,out+0.3))*120:0));card(cx-w/2,y,w,150,36,C.branco);avatar(cx-w/2+70,y+75,40,col,letter,C.branco);label(title,cx-w/2+130,y+62,34,{w:700});ctx.font=F(400,32,'Roboto');const b=wrap(body,w-170)[0];label(b+(wrap(body,w-170).length>1?'...':''),cx-w/2+130,y+108,32,{w:400,color:'rgba(10,10,10,0.7)'});ctx.restore()}

// ---------- texto palavra por palavra (# destaque de cor, ~ marca-texto) ----------
function parseLines(lines){return lines.map(l=>l.split(' ').map(w=>{let acc=false,hl=false;while(w[0]==='#'||w[0]==='~'){if(w[0]==='#')acc=true;else hl=true;w=w.slice(1)}return{w,acc,hl}}))}
function wordTimes(sp){const n=parseLines(sp.lines).flat().length;return Array.from({length:n},(_,k)=>sp.start+k*sp.stagger)}
function drawWords(sp,t){
  if(t<sp.start)return;
  const outP=sp.out!=null?eInOut(P(t,sp.out,sp.out+0.3)):0;if(outP>=1)return;
  const lines=sp._p||(sp._p=parseLines(sp.lines));
  ctx.save();ctx.font=F(sp.weight||800,sp.size,sp.family);ctx.textBaseline='alphabetic';ctx.textAlign='center';
  const gap=sp.size*0.26;let k=0;
  lines.forEach((line,li)=>{
    const ws=line.map(o=>ctx.measureText(o.w).width);const total=ws.reduce((a,b)=>a+b,0)+gap*(line.length-1);
    let x=sp.x-total/2;const y=sp.y+li*(sp.lh||sp.size*1.18);
    line.forEach((o,wi)=>{
      const tw=sp.start+k*sp.stagger;k++;const p=P(t,tw,tw+0.45);
      if(p>0){
        const a=eOut(P(t,tw,tw+0.16))*(1-outP);const s=lerp(0.55,1,eBack(p));const dy=(1-eOut(p))*sp.size*0.55-outP*60;
        ctx.save();ctx.globalAlpha=a;ctx.translate(x+ws[wi]/2,y+dy);ctx.scale(s,s);
        if(o.hl){const hp=eOut(P(t,tw+0.1,tw+0.4));if(hp>0){ctx.save();ctx.rotate(-0.025);ctx.fillStyle=sp.hl||C.amarelo;const next=wi<line.length-1&&line[wi+1].hl;const full=ws[wi]+sp.size*0.14+(next?gap:0);rr(-ws[wi]/2-sp.size*0.07,-sp.size*0.6,full*hp,sp.size*0.74,sp.size*0.14);ctx.fill();ctx.restore()}}
        ctx.fillStyle=o.acc?(sp.accent||C.laranja):(sp.color||C.ink);ctx.fillText(o.w,0,0);ctx.restore();
      }
      x+=ws[wi]+gap;
    });
  });
  ctx.restore();
}
// atalho: txt(['linha 1','linha #2'],{y,size,start,...})
function TX(lines,o){return Object.assign({lines,x:540,size:84,stagger:0.08},o)}

// ---------- fundo ----------
let GRAIN=[];
function makeGrain(){for(let k=0;k<3;k++){const g=document.createElement('canvas');g.width=540;g.height=960;const gc=g.getContext('2d');const id=gc.createImageData(540,960);const r=rng(99+k);for(let i=0;i<id.data.length;i+=4){const v=r()*255;id.data[i]=id.data[i+1]=id.data[i+2]=v;id.data[i+3]=r()<0.5?26:0}gc.putImageData(id,0,0);GRAIN.push(g)}}
const BLOBS=[{c:C.amarelo,x:180,y:420,r:560,ph:0},{c:C.rosa,x:930,y:760,r:560,ph:1.7},{c:C.azul,x:140,y:1300,r:620,ph:3.1},{c:C.verde,x:960,y:1650,r:540,ph:4.4}];
function beatPulse(t){if(t>=T.DROP&&t<T.WIPE){return Math.exp(-((t-T.DROP)%0.5)*9)}if(t<T.DROP){return 0.45*Math.exp(-(t%0.5)*11)}return 0}
function blobs(t,list,alpha){const pu=beatPulse(t);list.forEach(b=>{const x=b.x+Math.sin(t*0.55+b.ph)*90,y=b.y+Math.cos(t*0.42+b.ph)*100;const r=b.r*(1+0.05*pu);const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,hexA(b.c,alpha));g.addColorStop(1,hexA(b.c,0));ctx.fillStyle=g;ctx.fillRect(0,0,W,H)})}
function drawBg(t){
  ctx.fillStyle=C.creme;ctx.fillRect(0,0,W,H);
  blobs(t,AD.blobs||BLOBS,t<T.DROP?0.10:lerp(0.10,0.24,P(t,T.DROP,T.DROP+0.6)));
  ctx.save();ctx.strokeStyle='rgba(10,10,10,0.045)';ctx.lineWidth=2;const off=(t*14)%60;ctx.beginPath();for(let x=0;x<=W;x+=60){ctx.moveTo(x,0);ctx.lineTo(x,H)}for(let y=-60+off;y<=H;y+=60){ctx.moveTo(0,y);ctx.lineTo(W,y)}ctx.stroke();ctx.restore();
  if(t<T.DROP){ctx.fillStyle=`rgba(60,56,48,${0.09*(1-P(t,T.FLASH,T.DROP))})`;ctx.fillRect(0,0,W,H)}
}
function drawOverlay(t){const g=ctx.createRadialGradient(W/2,H/2,H*0.3,W/2,H/2,H*0.75);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(0,0,0,0.12)');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);if(GRAIN.length){ctx.save();ctx.globalAlpha=0.5;ctx.drawImage(GRAIN[Math.floor(t*FPS)%3],0,0,W,H);ctx.restore()}}

// ---------- lâmpada (personagem) ----------
function lampState(t){
  const b=kf(t,[[T.LAMP_IN,{x:540,y:1080,w:420}],[T.DROP-0.1,{x:540,y:1080,w:420}],[T.DROP+0.45,{x:930,y:385,w:150}],[40,{x:930,y:385,w:150}]]);
  let{x,y,w}=b,rot=0,sx=1,sy=1;
  if(t<T.DROP){const sp=spring(T.LAMP_IN,t,1.4,6);y=lerp(2200,1080,sp);const dt=Math.max(0,t-T.LAMP_IN-0.3);sy=1-0.15*Math.sin(dt*18)*Math.exp(-dt*6);sx=2-sy;const gl=eOut(P(t,T.FLASH-0.5,T.FLASH));sx*=1+gl*0.12;sy*=1+gl*0.12}
  else{const ph=((t-T.DROP)%0.5)/0.5;y-=Math.sin(ph*Math.PI)*8;rot=Math.sin(t*2.6)*0.08;(AD.lampHops||[]).forEach(ts=>{const jp=P(t,ts,ts+0.45);y-=Math.sin(jp*Math.PI)*40;rot+=Math.sin(jp*Math.PI*2)*0.25})}
  return{x,y,w,rot,sx,sy};
}
function drawLamp(t){if(t<T.LAMP_IN||t>T.WIPE+0.6)return;const L=lampState(t);const gl=t<T.DROP?eOut(P(t,T.FLASH-0.5,T.FLASH)):0.35+0.25*beatPulse(t);const gr=ctx.createRadialGradient(L.x,L.y,0,L.x,L.y,L.w*(0.9+gl*0.8));gr.addColorStop(0,hexA(C.amarelo,0.55*gl));gr.addColorStop(1,hexA(C.amarelo,0));ctx.fillStyle=gr;ctx.fillRect(L.x-L.w*2,L.y-L.w*2,L.w*4,L.w*4);drawImg(IMG.lamp,L.x,L.y,L.w,{rot:L.rot,sx:L.sx,sy:L.sy})}
function drawFlash(t){if(t<T.FLASH||t>T.DROP+0.5)return;const L={x:540,y:1080};const r=lerp(0,2300,eIn(P(t,T.FLASH,T.DROP)));const fade=1-P(t,T.DROP,T.DROP+0.45);ctx.save();ctx.globalAlpha=fade;const g=ctx.createRadialGradient(L.x,L.y,0,L.x,L.y,Math.max(1,r));g.addColorStop(0,C.branco);g.addColorStop(0.55,'#FFF3B0');g.addColorStop(1,hexA(C.amarelo,0.9));ctx.fillStyle=g;ctx.beginPath();ctx.arc(L.x,L.y,r,0,Math.PI*2);ctx.fill();ctx.restore()}

// ---------- prova + CTA (iguais em todos) ----------
function drawProva(t){if(t<T.PROVA-0.1||t>T.WIPE+0.6)return;confetti(t,T.PROVA+0.1,540,760,80,AD.seed||7);drawWords(Object.assign({x:540,y:700,size:96,lh:112,stagger:0.1,start:T.PROVA+0.05},AD.prova),t);if(IMG[AD.provaSelo||'semformula']){const e=enter(t,T.PROVA+0.7,0.5);if(e.on)drawImg(IMG[AD.provaSelo||'semformula'],540,1040,AD.provaSeloW||360,{rot:-0.08+Math.sin(t*2)*0.04,sx:e.s,sy:e.s,alpha:e.a})}}
function drawCTA(t){
  if(t<T.WIPE)return;const L={x:930,y:385};
  const r=lerp(0,2400,eIn(P(t,T.WIPE,T.WIPE+0.5)));
  ctx.save();ctx.beginPath();ctx.arc(L.x,L.y,r,0,Math.PI*2);ctx.clip();
  ctx.fillStyle=C.laranja;ctx.fillRect(0,0,W,H);
  blobs(t,[{c:C.amarelo,x:200,y:420,r:620,ph:0.3},{c:C.rosa,x:920,y:1400,r:640,ph:2.2}],0.28);
  const t0=T.WIPE+0.35;
  const cs=spring(t0+0.2,t,1.3,5);drawImg(IMG.clubVerde,860,420,190,{rot:t*0.7,sx:cs,sy:cs});
  const ls=spring(t0,t,1.15,5);drawImg(IMG.logoY,540,600+Math.sin(t*2.2)*6,760,{sx:ls,sy:ls,rot:(1-Math.min(1,ls))*-0.25});
  burst(540,600,t0+0.1,t,88,16,480,32);
  const ps=spring(t0+0.55,t,1.5,6);const pulse=1+0.04*Math.max(0,Math.sin((t-t0)*6.28*1.5));
  pill('Criar conta grátis',540,925,{bg:C.amarelo,fg:C.ink,size:66,h:132,padX:56,sc:ps*pulse});
  const e=enter(t,t0+0.95,0.4);if(e.on)label(AD.ctaSub||'No celular e no computador.',540,1062,44,{w:700,fam:'"Baloo 2"',color:C.creme,align:'center',alpha:e.a});
  const ap=spring(t0+1.3,t,1.5,6);if(ap>0){const bounce=Math.abs(Math.sin((t-t0)*Math.PI*2))*22;arrowDown(540,1175+bounce,ap*0.9,C.amarelo)}
  ctx.restore();
}

// ---------- render(t) ----------
function render(t){
  t=clamp(t,0,T.END);
  ctx.setTransform(1,0,0,1,0,0);ctx.globalAlpha=1;
  drawBg(t);
  let zoom=1+0.008*beatPulse(t)+0.012*Math.sin(t*0.35);
  let amp=0;(AD.shakes||[]).concat([[T.DROP,12],[T.WIPE+0.5,8]]).forEach(([ts,a])=>{if(t>=ts)amp+=a*Math.exp(-(t-ts)*9)});
  ctx.save();ctx.translate(W/2+Math.sin(t*93)*amp,H/2+Math.cos(t*71)*amp);ctx.scale(zoom,zoom);ctx.translate(-W/2,-H/2);
  AD.scenes.forEach(fn=>fn(t));
  Object.values(AD.texts||{}).forEach(sp=>drawWords(sp,t));
  if(t>=T.PROVA-0.1)drawProva(t);
  drawLamp(t);
  ctx.restore();
  drawFlash(t);
  drawCTA(t);
  drawOverlay(t);
  if(window.SAFE)drawSafe();
}
function drawSafe(){ctx.save();ctx.fillStyle='rgba(224,52,43,0.28)';ctx.fillRect(0,0,W,269);ctx.fillRect(0,1250,W,H-1250);ctx.fillStyle='rgba(224,52,43,0.14)';ctx.fillRect(0,1250,W,280);ctx.fillRect(0,0,65,H);ctx.fillRect(W-65,0,65,H);ctx.font=F(700,30,'Roboto');ctx.fillStyle=C.branco;ctx.fillText('ÁREA COBERTA PELO INSTAGRAM',90,150);ctx.fillText('SÓ SECUNDÁRIO',90,1300);ctx.restore()}

// ---------- SOM ----------
function allCues(){
  const c=[];const add=(t,type,a)=>c.push([t,type,a]);
  for(let tt=0,k=0;tt<T.LAMP_IN;tt+=0.5,k++)add(tt,'tick',k%2);
  add(T.LAMP_IN,'boing');add(T.LAMP_IN+0.3,'lowpop');add(T.LAMP_IN+0.2,'riser',T.DROP-0.05);add(T.FLASH-0.3,'shimmer');add(T.DROP,'crash');
  Object.values(AD.texts||{}).forEach(sp=>wordTimes(sp).forEach((tw,k)=>add(tw+0.02,'wpop',[520,620,700,780][k%4])));
  wordTimes(Object.assign({start:T.PROVA+0.05,stagger:0.1},AD.prova)).forEach((tw,k)=>add(tw+0.02,'wpop',[700,800,900,1000][k%4]));
  add(T.PROVA+0.1,'confetti');add(T.PROVA+0.7,'stamp');
  add(T.WIPE-0.1,'whoosh',0.55);add(T.WIPE+0.35,'crash');add(T.WIPE+0.5,'shimmer');add(T.WIPE+0.9,'pop',700);add(T.WIPE+0.95,'ding',1568);add(T.WIPE+1.35,'pop',900);
  (AD.cues||[]).forEach(q=>c.push(q));
  return c;
}
function buildAudio(ac,out,T0=0){
  const master=ac.createGain();master.gain.value=0.8;
  const comp=ac.createDynamicsCompressor();comp.threshold.value=-16;comp.knee.value=8;comp.ratio.value=4;comp.attack.value=0.003;comp.release.value=0.18;
  master.connect(comp);comp.connect(out);
  const sr=ac.sampleRate;const nb=ac.createBuffer(1,sr*2,sr);const nd=nb.getChannelData(0);const r=rng(4242);for(let i=0;i<nd.length;i++)nd[i]=r()*2-1;
  const bassLP=ac.createBiquadFilter();bassLP.type='lowpass';bassLP.frequency.value=720;bassLP.Q.value=4;bassLP.connect(master);
  const keysLP=ac.createBiquadFilter();keysLP.type='lowpass';keysLP.frequency.value=3200;keysLP.connect(master);
  const TT=x=>T0+x;
  function env(g,t,a,peak,dec){g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(Math.max(peak,0.0002),t+a);g.gain.exponentialRampToValueAtTime(0.0001,t+a+dec)}
  function osc(type,f,t,dur,peak,o={}){const{f2,a=0.004,dest=master,det=0}=o;t=TT(t);const n=ac.createOscillator();n.type=type;n.frequency.setValueAtTime(f,t);n.detune.value=det;if(f2)n.frequency.exponentialRampToValueAtTime(f2,t+dur);const g=ac.createGain();env(g,t,a,peak,dur);n.connect(g);g.connect(dest);n.start(t);n.stop(t+a+dur+0.05)}
  function noise(t,dur,peak,o={}){const{type='highpass',f=1000,q=0.8,f2,a=0.002,dest=master}=o;t=TT(t);const s=ac.createBufferSource();s.buffer=nb;const fl=ac.createBiquadFilter();fl.type=type;fl.frequency.setValueAtTime(f,t);if(f2)fl.frequency.exponentialRampToValueAtTime(f2,t+dur);fl.Q.value=q;const g=ac.createGain();env(g,t,a,peak,dur);s.connect(fl);fl.connect(g);g.connect(dest);s.start(t,(t*0.37)%1.2);s.stop(t+a+dur+0.05)}
  const kick=(t,v=0.72)=>{osc('sine',160,t,0.3,v,{f2:45});noise(t,0.02,0.2,{type:'lowpass',f:2500})};
  const clap=t=>{[0,0.011,0.022].forEach((d,i)=>noise(t+d,i<2?0.02:0.16,i<2?0.25:0.42,{type:'bandpass',f:1500,q:0.9}))};
  const hat=(t,v=0.12)=>noise(t,0.045,v,{type:'highpass',f:7500});
  const S={
    key:t=>{noise(t,0.028,0.22,{type:'bandpass',f:3200,q:2});osc('square',1900,t,0.012,0.02)},
    keysoft:t=>noise(t,0.02,0.1,{type:'bandpass',f:3800,q:2}),
    tick:(t,hi)=>{osc('triangle',hi?1800:1350,t,0.04,0.22);noise(t,0.015,0.08,{type:'highpass',f:6000})},
    lowpop:t=>{osc('sine',240,t,0.2,0.6,{f2:85});noise(t,0.05,0.18,{type:'lowpass',f:900})},
    pop:(t,f=640)=>osc('sine',f*1.7,t,0.09,0.32,{f2:f*0.7}),
    wpop:(t,f=600)=>osc('sine',f*1.5,t,0.08,0.22,{f2:f*0.8}),
    click:t=>{osc('square',2400,t,0.012,0.08);noise(t,0.02,0.25,{type:'bandpass',f:2500,q:3})},
    whoosh:(t,d=0.5)=>noise(t,d*0.45,0.36,{type:'bandpass',f:260,f2:3800,q:1.1,a:d*0.55}),
    stamp:t=>{osc('sine',130,t,0.45,1,{f2:38});noise(t,0.3,0.7,{type:'lowpass',f:1400})},
    boing:t=>{osc('sine',180,t,0.28,0.32,{f2:760});osc('triangle',90,t+0.02,0.2,0.1,{f2:380})},
    riser:(t,t1)=>{const a=TT(t),b=TT(t1);const s=ac.createBufferSource();s.buffer=nb;s.loop=true;const fl=ac.createBiquadFilter();fl.type='bandpass';fl.Q.value=2.5;fl.frequency.setValueAtTime(200,a);fl.frequency.exponentialRampToValueAtTime(5200,b);const g=ac.createGain();g.gain.setValueAtTime(0.0001,a);g.gain.exponentialRampToValueAtTime(0.28,b);g.gain.exponentialRampToValueAtTime(0.0001,b+0.06);s.connect(fl);fl.connect(g);g.connect(master);s.start(a);s.stop(b+0.1)},
    shimmer:t=>[1568,2093,2637,3136].forEach((f,i)=>osc('sine',f,t+i*0.045,0.35,0.07)),
    crash:t=>{noise(t,1.3,0.28,{type:'highpass',f:3500});kick(t,0.9)},
    ding:(t,f=1318.5)=>{osc('sine',f,t,0.9,0.3);osc('sine',f*2,t,0.45,0.06);osc('triangle',f*3,t,0.2,0.03)},
    bell:t=>{[[1,0.3,2.2],[2.01,0.12,1.4],[2.76,0.08,1.0],[5.4,0.05,0.6]].forEach(([m,p,d])=>osc('sine',1046.5*m,t,d,p))},
    buzz:t=>{osc('sawtooth',110,t,0.25,0.12,{dest:bassLP});osc('square',220,t,0.18,0.05,{dest:keysLP})},
    error:t=>{osc('square',330,t,0.09,0.08,{dest:keysLP});osc('square',262,t+0.11,0.14,0.08,{dest:keysLP})},
    coin:t=>{osc('square',988,t,0.06,0.07,{dest:keysLP});osc('square',1319,t+0.07,0.22,0.07,{dest:keysLP})},
    notif:t=>{osc('sine',1318.5,t,0.12,0.2);osc('sine',1760,t+0.1,0.25,0.18)},
    confetti:t=>{const rr2=rng(9);for(let i=0;i<22;i++)hat(t+rr2()*0.6,0.05+rr2()*0.06)}
  };
  allCues().forEach(([t,type,a])=>{if(S[type])S[type](t,a)});
  // tensão (0 a 9s): pulso grave abafado
  for(let t=0;t<T.DROP-0.01;t+=0.5){osc('sine',55,t,0.35,t<T.LAMP_IN?0.35:0.5,{f2:48});if(t>=3)hat(t+0.25,0.04)}
  // groove (9 a 21s) 120bpm: C G Am F
  const ROOT=[130.81,98.0,110.0,87.31];const CH=[[261.63,329.63,392.0],[392.0,493.88,587.33],[440.0,523.25,659.25],[349.23,440.0,523.25]];
  for(let t=T.DROP,b=0;t<T.WIPE-0.2;t+=0.5,b++){const bar=Math.floor(b/4)%4;kick(t);if(b%2===1||t>=T.PROVA)clap(t);hat(t+0.25);hat(t+0.125,0.05);hat(t+0.375,0.05);osc('sawtooth',ROOT[bar],t,0.2,0.34,{dest:bassLP});osc('sawtooth',ROOT[bar],t+0.25,0.18,0.26,{dest:bassLP});if(b%2===0)CH[bar].forEach((f,i)=>osc('triangle',f,t+0.25,0.24,0.1,{dest:keysLP,det:i*4}))}
  // acorde final
  [261.63,329.63,392.0,587.33,130.81].forEach((f,i)=>{const t=TT(T.WIPE+0.35);const o=ac.createOscillator();o.type=i===4?'sawtooth':'triangle';o.frequency.value=f;const g=ac.createGain();g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(i===4?0.18:0.09,t+0.35);g.gain.exponentialRampToValueAtTime(0.0001,TT(T.END-0.1));o.connect(g);g.connect(i===4?bassLP:keysLP);o.start(t);o.stop(TT(T.END))});
}

// ---------- carregar + UI ----------
function loadImg(src){return new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=src})}
const ready=(async()=>{
  await Promise.all(Object.entries(SRC).map(async([k,s])=>{IMG[k]=await loadImg('data:image/png;base64,'+s)}));
  const c=document.createElement('canvas');c.width=IMG.logo.width;c.height=IMG.logo.height;const g=c.getContext('2d');g.drawImage(IMG.logo,0,0);g.globalCompositeOperation='source-in';g.fillStyle=C.amarelo;g.fillRect(0,0,c.width,c.height);IMG.logoY=c;
  const c2=document.createElement('canvas');c2.width=IMG.logo.width;c2.height=IMG.logo.height;const g2=c2.getContext('2d');g2.drawImage(IMG.logo,0,0);IMG.logoInk=c2;
  await Promise.all(['700 40px "Baloo 2"','800 40px "Baloo 2"','400 40px Roboto','500 40px Roboto','700 40px Roboto','400 40px "Grand Hotel"'].map(f=>document.fonts.load(f)));
  makeGrain();render(0);
})();
window.render=render;window.buildAudio=buildAudio;window.ready=ready;
const $=id=>document.getElementById(id);let busy=false;
function playLive(record){return ready.then(()=>new Promise(resolve=>{busy=true;$('play').disabled=$('rec').disabled=true;const ac=new (window.AudioContext||window.webkitAudioContext)();const bus=ac.createGain();bus.connect(ac.destination);let rec,chunks=[],mime='';
  if(record){const dest=ac.createMediaStreamDestination();bus.connect(dest);const st=new MediaStream([...cv.captureStream(30).getVideoTracks(),...dest.stream.getAudioTracks()]);mime=['video/mp4;codecs=avc1.640028,mp4a.40.2','video/mp4','video/webm;codecs=vp9,opus','video/webm'].find(m=>window.MediaRecorder&&MediaRecorder.isTypeSupported(m))||'';rec=new MediaRecorder(st,{mimeType:mime,videoBitsPerSecond:16000000,audioBitsPerSecond:192000});rec.ondataavailable=e=>e.data.size&&chunks.push(e.data);rec.start(250);$('status').textContent='Gravando... não troque de aba'}
  const T0=ac.currentTime+0.25;buildAudio(ac,bus,T0);
  const loop=()=>{const t=ac.currentTime-T0;render(Math.max(0,t));$('scrub').value=Math.max(0,t);if(t<T.END+0.2)requestAnimationFrame(loop);else finish()};
  const finish=()=>{const done=()=>{ac.close();busy=false;$('play').disabled=$('rec').disabled=false;resolve()};if(rec){rec.onstop=()=>{const ext=mime.includes('mp4')?'mp4':'webm';const blob=new Blob(chunks,{type:mime||'video/webm'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=AD.id+'.'+ext;a.click();$('status').textContent='Pronto! Arquivo baixado.';done()};rec.stop()}else{$('status').textContent='';done()}};
  requestAnimationFrame(loop)}))}
$('play').onclick=()=>!busy&&playLive(false);$('rec').onclick=()=>!busy&&playLive(true);
$('scrub').oninput=e=>{if(!busy)ready.then(()=>render(+e.target.value))};
$('safe').onchange=e=>{window.SAFE=e.target.checked;if(!busy)render(+$('scrub').value)};

// chip de etapa da demo (ex.: "Cria Plano · seu mês inteiro")
function stepChip(t,t0,t1,title,col,fg=C.ink,sub=''){const inP=P(t,t0,t0+0.45),outP=eIn(P(t,t1,t1+0.3));if(inP<=0||outP>=1)return;ctx.save();ctx.font=F(800,48);const tw=ctx.measureText(title).width;ctx.font=F(500,30,'Roboto');const sw=sub?ctx.measureText(sub).width+24:0;const w=64+tw+sw+44,h=92;const cx=470,y=368-(1-eOut(inP))*60-outP*50;const s=lerp(0.7,1,eBack(inP));ctx.globalAlpha=eOut(P(t,t0,t0+0.2))*(1-outP);ctx.translate(cx,y);ctx.scale(s,s);card(-w/2,-h/2,w,h,h/2,C.branco);ctx.fillStyle=col;circle(-w/2+44,0,20);ctx.fillStyle=C.ink;ctx.font=F(800,48);ctx.textAlign='left';ctx.textBaseline='middle';ctx.fillText(title,-w/2+76,3);if(sub){ctx.font=F(500,30,'Roboto');ctx.fillStyle='rgba(10,10,10,0.5)';ctx.fillText(sub,-w/2+76+tw+24,4)}ctx.restore()}
