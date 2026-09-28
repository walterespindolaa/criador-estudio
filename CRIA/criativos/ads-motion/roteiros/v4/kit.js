// ===== kit v6: helpers comuns dos roteiros novos =====
const fmt=n=>Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
const brl=v=>'R$ '+v.toFixed(2).replace('.',',').replace(/\B(?=(\d{3})+(?!\d),)/g,'.');
function wrap(s,maxW,size,w=500,f='Roboto'){ctx.font=F(w,size,f);const ws=s.split(' ');const out=[];let ln='';ws.forEach(x=>{const tt=ln?ln+' '+x:x;if(ctx.measureText(tt).width>maxW&&ln){out.push(ln);ln=x}else ln=tt});if(ln)out.push(ln);return out}
function para(s,x,y,maxW,size,lh,o={}){const{w=500,f='Roboto',col=C.ink,a=1,al='left',upto=1e9}=o;if(a<=0)return;const L=wrap(s,maxW,size,w,f);let left=upto;ctx.save();ctx.globalAlpha*=a;ctx.font=F(w,size,f);ctx.fillStyle=col;ctx.textAlign=al;L.forEach((ln,i)=>{if(left<=0)return;ctx.fillText(ln.slice(0,Math.max(0,left)),x,y+i*lh);left-=ln.length+1});ctx.restore();return L}
function check(x,y,r,col,p=1){if(p<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(back(p),back(p));ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();ctx.strokeStyle=C.branco;ctx.lineWidth=r*.22;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(-r*.42,0);ctx.lineTo(-r*.1,r*.32);ctx.lineTo(r*.45,-r*.3);ctx.stroke();ctx.restore()}
function xmark(x,y,s,col,p){if(p<=0)return;ctx.save();ctx.translate(x,y);const sc=lerp(2.2,1,i4(p));ctx.scale(sc*s,sc*s);ctx.globalAlpha*=o3(p);ctx.strokeStyle=col;ctx.lineWidth=16;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-40,-40);ctx.lineTo(40,40);ctx.moveTo(40,-40);ctx.lineTo(-40,40);ctx.stroke();ctx.restore()}
function spark(x,y,s,col){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle=col;ctx.beginPath();for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.lineTo(Math.cos(a)*22,Math.sin(a)*22);ctx.lineTo(Math.cos(a+Math.PI/4)*6,Math.sin(a+Math.PI/4)*6)}ctx.closePath();ctx.fill();ctx.restore()}
function card(x,y,w,h,o={}){const{a=1,sc=1,rot=0,fill=C.branco,r=36,tilt=1}=o;if(a<=0||sc<=0)return false;ctx.save();ctx.globalAlpha*=a;ctx.translate(x+w/2,y+h/2);ctx.rotate(rot);ctx.scale(sc,sc);ctx.transform(1,tilt*Math.sin(TT*1.1+x*.013)*.012,tilt*Math.sin(TT*1.3+y*.01)*.02,1,0,0);ctx.translate(-w/2,-h/2);box(0,0,w,h,r,fill);return true}
function endCard(){ctx.restore()}
function badge(x,y,n,p,col=C.vermelho){if(p<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(back(p),back(p));ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,30,0,7);ctx.fill();txt(String(n),0,12,36,{col:C.branco});ctx.restore()}
function icon(k,x,y,s,col){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';
 if(k==='planilha'){rr(-22,-22,44,44,6);ctx.stroke();ctx.beginPath();ctx.moveTo(-22,-7);ctx.lineTo(22,-7);ctx.moveTo(-22,8);ctx.lineTo(22,8);ctx.moveTo(-7,-22);ctx.lineTo(-7,22);ctx.stroke()}
 else if(k==='conversa'){rr(-24,-20,48,32,12);ctx.stroke();ctx.beginPath();ctx.moveTo(-8,12);ctx.lineTo(-14,24);ctx.lineTo(4,12);ctx.stroke();[-10,0,10].forEach(d=>{ctx.beginPath();ctx.arc(d,-4,3,0,7);ctx.fill()})}
 else if(k==='arte'){ctx.beginPath();ctx.arc(0,0,22,0,7);ctx.stroke();[[-8,-8],[8,-9],[11,5]].forEach(([a,b])=>{ctx.beginPath();ctx.arc(a,b,4,0,7);ctx.fill()})}
 else if(k==='notas'){rr(-18,-24,36,48,5);ctx.stroke();[-10,0,10].forEach(d=>{ctx.beginPath();ctx.moveTo(-10,d);ctx.lineTo(10,d);ctx.stroke()})}
 else if(k==='tarefas'){[-16,0,16].forEach((d,i)=>{rr(d-6,-22,12,[40,28,34][i],4);ctx.stroke()})}
 else if(k==='aprova'){ctx.beginPath();ctx.arc(0,0,22,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(-3,8);ctx.lineTo(11,-8);ctx.stroke()}
 else if(k==='agenda'){rr(-22,-18,44,40,6);ctx.stroke();ctx.beginPath();ctx.moveTo(-22,-6);ctx.lineTo(22,-6);ctx.moveTo(-10,-24);ctx.lineTo(-10,-12);ctx.moveTo(10,-24);ctx.lineTo(10,-12);ctx.stroke()}
 else if(k==='grafico'){ctx.beginPath();ctx.moveTo(-22,22);ctx.lineTo(-22,-22);ctx.moveTo(-22,22);ctx.lineTo(22,22);ctx.stroke();[[-12,8],[0,-2],[12,-14]].forEach(([a,b],i)=>{rr(a-4,b,8,22-b,2);ctx.fill()})}
 else if(k==='dinheiro'){ctx.beginPath();ctx.arc(0,0,22,0,7);ctx.stroke();ctx.font=F(800,30);ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('$',0,2)}
 else if(k==='sino'){ctx.beginPath();ctx.moveTo(-16,12);ctx.quadraticCurveTo(-16,-20,0,-20);ctx.quadraticCurveTo(16,-20,16,12);ctx.lineTo(-20,12);ctx.lineTo(20,12);ctx.stroke();ctx.beginPath();ctx.arc(0,18,5,0,7);ctx.fill()}
 else if(k==='link'){ctx.beginPath();rr(-24,-10,26,20,10);ctx.stroke();rr(-2,-10,26,20,10);ctx.stroke()}
 ctx.restore()}
// celular desenhado: fn(w,h) desenha a tela em coordenadas locais (0,0 = canto da tela)
function phoneDraw(cx,cy,w,h,o,fn){const{sc=1,rot=0,a=1,bgc=C.branco}=o||{};if(sc<=0||a<=0)return;ctx.save();ctx.globalAlpha*=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(sc,sc);box(-w/2,-h/2,w,h,60,C.ink);ctx.save();rr(-w/2+14,-h/2+14,w-28,h-28,48);ctx.clip();ctx.translate(-w/2+14,-h/2+14);ctx.fillStyle=bgc;ctx.fillRect(0,0,w-28,h-28);fn(w-28,h-28);ctx.restore();ctx.restore()}
// adesivo gigante atravessando a tela no corte (a transição de sticker)
function stickerSweep(t,tc,names,dir=1){const d=.36;[0,1,2].forEach(k=>{const nm=names[k];if(!nm)return;const im=IMG.m[nm];if(!im)return;const lag=k*.07;const p=P(t,tc-d-lag,tc+d-lag);if(p<=0||p>=1)return;const e=io3(p);
 const w=[1150,520,420][k];const x0=dir>0?-760:1840,x1=dir>0?1840:-760;const x=lerp(x0,x1,e)+[0,-160,220][k],y=lerp([1550,1750,1300][k],[380,560,250][k],e);const rot=lerp(-.5,.45,e)*dir+Math.sin(p*20)*.05;
 ctx.save();ctx.shadowColor='rgba(10,10,10,.22)';ctx.shadowBlur=40;ctx.shadowOffsetY=24;img(im,x,y,w,{rot,sx:1+Math.sin(p*Math.PI)*.08,sy:1-Math.sin(p*Math.PI)*.05});ctx.restore()})}
// confete radial
function confete(t,t0,cx=540,cy=920){for(let i=0;i<26;i++){const a=i/26*Math.PI*2,d=o4(P(t,t0,t0+.75))*(420+(i%5)*60),al=1-P(t,t0+.45,t0+1.25);if(al>0&&t>t0){ctx.fillStyle=[C.amarelo,C.rosa,C.azul,C.verde,C.laranja][i%5];ctx.globalAlpha=al;ctx.save();ctx.translate(cx+Math.cos(a)*d,cy+Math.sin(a)*d*.8);ctx.rotate(t*6+i);ctx.fillRect(-10,-10,20,i%2?20:34);ctx.restore();ctx.globalAlpha=1}}}
// título de impacto que entra batendo (escala 2.2 -> 1)
function bate(s,x,y,size,t,t0,o={}){const p=P(t,t0,t0+.2);if(p<=0)return;ctx.save();ctx.translate(x,y);const s2=lerp(2.2,1,o4(p));ctx.scale(s2,s2);txt(s,0,0,size,{...o,a:o3(p)});ctx.restore()}
// CTA final padrão (fundo de cor, logo dançando, frase, pílula, seta, subtítulo)
function ctaFinal(t,cor,frase,sub,stickers,logoCor='amarelo',fsize=76){const w=o4(P(t,20.6,20.95));ctx.fillStyle=C.creme;ctx.fillRect(-40,-40,W+80,H+80);ctx.fillStyle=cor;ctx.beginPath();ctx.arc(540,960,lerp(0,1500,w),0,7);ctx.fill();
 const g=ctx.createRadialGradient(200,400,0,200,400,700);g.addColorStop(0,hexA(C.amarelo,.3*w));g.addColorStop(1,hexA(C.amarelo,0));ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
 stickers.forEach((n,i)=>adesivo(n,[150,930,140,940][i],[250,250,1500,1500][i],[190,180,170,190][i],t,21.3+i*.25,[.2,-.15,.15,-.2][i]));
 if(t>20.85)logoFatias(logoCor,540,540,800,i=>{const ph=((t-20.85-i*.1)%.5+.5)%.5/.5;const up=Math.sin(Math.min(1,ph/.5)*Math.PI);const e=o4(P(t,20.85,21.2));return{dy:-up*40+(1-e)*160,rot:(i%2?1:-1)*up*.07,sc:lerp(.6,1,e)}});
 const a1=back(P(t,21.3,21.55));if(a1>0){ctx.save();ctx.translate(540,950);ctx.scale(a1,a1);txt(frase,0,0,fsize,{col:C.branco});ctx.restore()}
 const cp=back(P(t,21.8,22.1));const beat=Math.exp(-((t-22)%.5)*8)*(t>22.2?1:0);pill('Criar conta grátis',540,1100,{bg:C.amarelo,fg:C.ink,size:68,padX:60,sc:cp*(1+.05*beat),a:o3(P(t,21.8,21.95))});
 if(t>22.3){const ay=1195+Math.sin((t-22.3)*Math.PI*4)*12;ctx.save();ctx.globalAlpha=o3(P(t,22.3,22.5));ctx.strokeStyle=C.amarelo;ctx.lineWidth=12;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(540,ay+80);ctx.lineTo(540,ay);ctx.moveTo(505,ay+35);ctx.lineTo(540,ay);ctx.lineTo(575,ay+35);ctx.stroke();ctx.restore()}
 txt(sub,540,1320,38,{w:500,f:'Roboto',col:C.creme,a:o3(P(t,22.5,22.8))})}
function sfxCta(fx,S){fx.whoosh(20.4);S.assinatura.groove(20.6);[21.3,21.55,21.8,22.05].forEach(b=>fx.popAgudo(b));fx.brilho(22.3)}
function sfxVirada(fx,S){fx.whoosh(6.55,.5);fx.impacto(7.0);[0,1,2].forEach(i=>{fx.boing(7.0+i*.12);fx.criatura(7.45+i*.2)});S.assinatura.brilho(8.05);fx.whoosh(8.8,.4);fx.whip(8.95)}
function sfxSweep(fx,tc){fx.whoosh(tc-.35,.6);fx.boing(tc-.05);fx.popAgudo(tc+.05)}
function loadImg(s){return new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=j;i.src=s})}
async function carrega(){await Promise.all(Object.entries(MARCA).map(async([k,s])=>{IMG.m[k]=await loadImg(s)}));IMG.x={};await Promise.all(Object.entries(EXTRA).map(async([k,s])=>{IMG.x[k]=await loadImg(s)}));IMG.pr={};await Promise.all(Object.entries(PRINTS).map(async([k,s])=>{IMG.pr[k]=await loadImg(s)}));
 await Promise.all(['800 40px "Baloo 2"','400 40px Roboto','500 40px Roboto','700 40px Roboto','400 40px "Grand Hotel"'].map(f=>document.fonts.load(f)))}
