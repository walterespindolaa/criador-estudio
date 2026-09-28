// C2 · "Por que esse bombou e esse não?" · Instagram conectado → direcionamento · PAS + demo
const TITLE='C2 · Seu Instagram sabe o que postar';
const DESC='Criador que posta no escuro. Conecta o Instagram, vê o que rende e sai com as ações da próxima semana. Telas redesenhadas a partir do app (exemplo ilustrativo).';

// ---------- helpers próprios ----------
const fmt=n=>Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
function wrap(s,maxW,size,w=500,f='Roboto'){ctx.font=F(w,size,f);const ws=s.split(' ');const out=[];let ln='';ws.forEach(x=>{const tt=ln?ln+' '+x:x;if(ctx.measureText(tt).width>maxW&&ln){out.push(ln);ln=x}else ln=tt});if(ln)out.push(ln);return out}
function para(s,x,y,maxW,size,lh,o={}){const{w=500,f='Roboto',col=C.ink,a=1,al='left',upto=1e9}=o;if(a<=0)return;const L=wrap(s,maxW,size,w,f);let left=upto;ctx.save();ctx.globalAlpha*=a;ctx.font=F(w,size,f);ctx.fillStyle=col;ctx.textAlign=al;L.forEach((ln,i)=>{if(left<=0)return;const part=ln.slice(0,Math.max(0,left));left-=ln.length+1;ctx.fillText(part,x,y+i*lh)});ctx.restore();return L}
function eye(x,y,s,col){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.strokeStyle=col;ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(-26,0);ctx.quadraticCurveTo(0,-26,26,0);ctx.quadraticCurveTo(0,26,-26,0);ctx.stroke();ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,8,0,7);ctx.fill();ctx.restore()}
function arrowUp(x,y,s,col){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle=col;ctx.beginPath();ctx.moveTo(0,-22);ctx.lineTo(18,2);ctx.lineTo(7,2);ctx.lineTo(7,22);ctx.lineTo(-7,22);ctx.lineTo(-7,2);ctx.lineTo(-18,2);ctx.closePath();ctx.fill();ctx.restore()}
function check(x,y,r,col,p=1){if(p<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(back(p),back(p));ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();ctx.strokeStyle=C.branco;ctx.lineWidth=r*.22;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(-r*.42,0);ctx.lineTo(-r*.1,r*.32);ctx.lineTo(r*.45,-r*.3);ctx.stroke();ctx.restore()}
function spark(x,y,s,col){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.fillStyle=col;ctx.beginPath();for(let i=0;i<4;i++){const a=i*Math.PI/2;ctx.lineTo(Math.cos(a)*22,Math.sin(a)*22);ctx.lineTo(Math.cos(a+Math.PI/4)*6,Math.sin(a+Math.PI/4)*6)}ctx.closePath();ctx.fill();ctx.restore()}
// miniatura de post (foto abstrata + visualizações)
const PAL=[[C.lilas,'#B9C4F7'],[C.laranja,C.rosa],[C.verde,'#9BE0B9'],[C.azul,C.lilas],[C.amarelo,C.laranja],[C.rosa,'#FFC7E1'],['#9C9A91','#CFCBBE']];
function thumb(cx,cy,w,pal,count,o={}){const{rot=0,sc=1,a=1,gray=0,countCol=C.ink,hl=0}=o;if(a<=0||sc<=0)return;const h=w*1.25,ph=h-w*.26;ctx.save();ctx.globalAlpha*=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(sc,sc);
 box(-w/2,-h/2,w,h,w*.08,C.branco);ctx.save();rr(-w/2+w*.04,-h/2+w*.04,w*.92,ph-w*.04,w*.06);ctx.clip();const g=ctx.createLinearGradient(0,-h/2,0,-h/2+ph);g.addColorStop(0,pal[0]);g.addColorStop(1,pal[1]);ctx.fillStyle=g;ctx.fillRect(-w/2,-h/2,w,ph);
 ctx.fillStyle='rgba(253,251,245,.55)';ctx.beginPath();ctx.arc(w*.2,-h/2+ph*.3,w*.14,0,7);ctx.fill();ctx.fillStyle='rgba(10,10,10,.14)';ctx.beginPath();ctx.moveTo(-w/2,-h/2+ph);ctx.quadraticCurveTo(-w*.1,-h/2+ph*.45,w/2,-h/2+ph*.8);ctx.lineTo(w/2,-h/2+ph);ctx.fill();
 if(gray>0){ctx.fillStyle=`rgba(120,118,110,${.55*gray})`;ctx.fillRect(-w/2,-h/2,w,ph)}ctx.restore();
 eye(-w/2+w*.14,h/2-w*.13,w/260,hexA(C.ink,.6));txt(count,-w/2+w*.26,h/2-w*.13+w*.07,w*.18,{col:countCol,al:'left'});
 if(hl>0){ctx.strokeStyle=hexA(C.laranja,hl);ctx.lineWidth=10;rr(-w/2-8,-h/2-8,w+16,h+16,w*.1);ctx.stroke()}ctx.restore()}
// cartão branco padrão
function card(x,y,w,h,o={}){const{a=1,sc=1,rot=0,fill=C.branco}=o;if(a<=0||sc<=0)return false;ctx.save();ctx.globalAlpha*=a;ctx.translate(x+w/2,y+h/2);ctx.rotate(rot);ctx.scale(sc,sc);ctx.transform(1,Math.sin(TT*1.1+x*.013)*.012,Math.sin(TT*1.3+y*.01)*.02,1,0,0);ctx.translate(-w/2,-h/2);box(0,0,w,h,36,fill);return true}
function endCard(){ctx.restore()}
function instaMark(cx,cy,size,a=1){ // só usa o glifo oficial se o arquivo existir em a/terceiros/instagram.png
 const im=IMG.x&&IMG.x.instagram;if(im)img(im,cx,cy,size,{a});return !!im}

SHAKES=[[.05,16],[1.0,12],[3.05,14],[4.4,16],[5.0,16],[5.6,20],[7.0,22],[18,18],[20.6,18]];

function render(t){TT=t;ctx.save();ctx.clearRect(0,0,W,H);const[sx,sy]=shake(t);ctx.translate(sx,sy);
 // ===== 0 a 3 · GANCHO =====
 if(t<3){bg(t);const out=i4(P(t,2.75,3));ctx.save();const rv=o4(P(t,0,.7));const zz=lerp(1.22,1,rv)*(1+out*.6);ctx.translate(540,990);ctx.scale(zz,zz);ctx.rotate(lerp(.05,0,rv));ctx.translate(-540,-990);ctx.globalAlpha*=1-out;
  words(['Por que esse #bombou'],540,430,92,100,.05,.08);words(['e esse não?'],540,540,92,100,.95,.1);
  const e1=back(P(t,.1,.45)),e2=back(P(t,.25,.6));const n=lerp(0,8400,o3(P(t,.35,1.35)));const pz=punch(t,[1.35]);
  thumb(310,1010,400,PAL[6],'312',{rot:-.07+Math.sin(t*2)*.01,sc:e1,gray:o3(P(t,1.5,2)),countCol:'#8A877E'});
  thumb(770,990,400,PAL[1],fmt(n),{rot:.06+Math.sin(t*2+1)*.01,sc:e2*pz,countCol:t>1.35?C.laranja:C.ink,hl:o3(P(t,1.35,1.6))});
  if(t>1.35){const p=back(P(t,1.35,1.6));ctx.save();ctx.translate(900,760);ctx.scale(p,p);box(-70,-70,140,140,70,C.laranja);arrowUp(0,0,1.8,C.branco);ctx.restore()}
  ctx.restore()}
 // ===== 3 a 7 · AGITAR =====
 else if(t<7){bg(t);ctx.save();const cz=1+.08*P(t,3,6.6);ctx.translate(540,1000);ctx.scale(cz,cz);ctx.translate(-540,-1000);
  const CNT=['1.240','340','89','5.100','210','760','45','2.300','130'];
  for(let i=0;i<9;i++){const r=Math.floor(i/3),c=i%3;const ti=3.05+i*.06;const p=back(P(t,ti,ti+.3));thumb(250+c*290,900+r*330,250,PAL[(i*3)%6],CNT[i],{sc:p,rot:[-.05,.04,-.02,.06,-.04,.03,-.06,.02,.05][i]})}
  // luz apagando: holofote que fecha
  const d=o3(P(t,3.6,5.2));if(d>0){const g=ctx.createRadialGradient(540,1230,lerp(900,160,d),540,1230,lerp(1400,520,d));g.addColorStop(0,'rgba(10,10,10,0)');g.addColorStop(1,`rgba(10,10,10,${.78*d})`);ctx.fillStyle=g;ctx.fillRect(-60,-60,W+120,H+120)}
  const lc=d>.5?C.creme:C.ink;words(['Você posta'],540,420,104,110,3.1,.1,{col:lc});words(['#no #escuro.'],540,540,120,110,3.35,.12,{col:lc});
  [['chuta o formato',4.4,-.08,C.amarelo,700],['chuta o horário',5.0,.06,C.rosa,1000],['e torce.',5.6,-.04,C.laranja,1300]].forEach(([s,t0,rot,col,y])=>{const p=P(t,t0-.12,t0);if(p<=0)return;const sc=lerp(2.4,1,i4(p));ctx.save();ctx.translate(540,y);ctx.rotate(rot);ctx.scale(sc,sc);ctx.globalAlpha=o3(p);pill(s,0,0,{bg:col,fg:C.ink,size:66,padX:50});ctx.restore()});
  ctx.restore();viradaCirculo(t,540,1300)}
 // ===== 7 a 9 · VIRADA =====
 else if(t<9){virada(t,'seu Instagram','tem a resposta')}
 // ===== 9 a 18 · DEMO =====
 else if(t<18){bg(t);
  const cap=(chipS,chipC,s1,s2,t0,t1)=>{if(t<t0||t>=t1)return;const a=o3(P(t,t0,t0+.2));const d1=o4(P(t,t0,t0+.3)),d2=o4(P(t,t0+.12,t0+.42));chip(chipS,540,300,chipC,C.ink,a);txt(s1,540+(1-d1)*-200,410,72,{a:d1});txt(s2,540+(1-d2)*200,490,72,{col:C.laranja,a:d2})};
  const slide=(t0,t1)=>{const en=o4(P(t,t0-.05,t0+.35));const ex=o4(P(t,t1-.12,t1+.05));return{dx:(1-en)*900-ex*900,a:1,ghost:(whip(t,t0)+whip(t,t1))}};
  cap2(t,'Instagram','#FFD9EC','Conecta em 20 segundos.','Só leitura, nada é postado.',9,12);
  cap2(t,'Insights','#D6E6FF','Seus números reais,','tudo num lugar só.',12,15);
  cap2(t,'Cruzamentos','#D5F2E1','O que rende mais','no SEU perfil.',15,18);
  // --- cena 1: conectar
  if(t<12.15){ctx.save();zt(t,9,12);ctx.translate(0,Math.sin(t*2.2)*8);
   card(170,620,740,600,{});
   txt('Insights',60,95,54,{al:'left'});txt('Métricas reais do seu Instagram.',60,145,30,{w:400,f:'Roboto',col:'#6B6960',al:'left'});
   const conn=t>10.55;
   if(!conn){box(60,190,620,190,28,'#F3EFE3',false);txt('Conecte seu Instagram',90,250,40,{al:'left'});para('Conta Business ou Creator. Só leitura: o CRIA não publica nada por você.',90,300,560,30,38,{col:'#6B6960'});}
   const pr=t>10.3&&t<10.55?Math.sin(P(t,10.3,10.55)*Math.PI):0;const bw=620,bx=60,by=410;
   if(!conn){box(bx,by,bw,110,55,C.ink,false);const has=instaMark(bx+90,by+55,56);txt('Conectar Instagram',bx+bw/2+(has?30:0),by+72,44,{col:C.creme})}
   else{const p=back(P(t,10.55,10.85));ctx.save();ctx.translate(bx+bw/2,by-40);ctx.scale(p,p);box(-bw/2,-150,bw,300,28,'#E3F6EA',false);check(-bw/2+80,-70,40,C.verde,1);txt('Conectado',-bw/2+140,-55,48,{al:'left',col:C.verde});txt('@duda.reis · atualizado agora',-bw/2+140,-5,30,{w:500,f:'Roboto',al:'left',col:'#4B6B57'});
    // barras carregando
    for(let i=0;i<3;i++){const q=o3(P(t,10.9+i*.25,11.4+i*.25));ctx.fillStyle='rgba(1,166,82,.18)';rr(-bw/2+60,40+i*34,bw-120,18,9);ctx.fill();ctx.fillStyle=C.verde;rr(-bw/2+60,40+i*34,(bw-120)*q,18,9);ctx.fill()}ctx.restore()}
   if(t>9.8&&t<10.9)cursor(lerp(bx+bw*.7+220,bx+bw*.7,o4(P(t,9.8,10.25))),lerp(by+300,by+60,o4(P(t,9.8,10.25))),pr,o3(P(t,9.8,9.95))*(1-P(t,10.7,10.9)));
   endCard();ctx.restore()}
  // --- cena 2: KPIs
  if(t>11.85&&t<15.15){const s={dx:0};ctx.save();zt(t,12,15);const K=[['Seguidores',4812,'+312 em 30 dias'],['Alcance (30d)',38200,'+18%'],['Interações (30d)',2140,'+9%'],['Visitas ao perfil',1096,'+24%']];
   K.forEach(([lb,v,d],i)=>{const r=Math.floor(i/2),c=i%2;const ti=12.1+i*.15;const e=back(P(t,ti,ti+.35));const x=90+c*460+s.dx,y=620+r*300+Math.sin(t*2.2+i)*6;if(!card(x,y,440,270,{sc:e}))return;
    txt(lb,40,70,32,{w:500,f:'Roboto',col:'#6B6960',al:'left'});const cnt=v*o3(P(t,ti+.2,ti+1.3));const s2=v>=10000?(cnt/1000).toFixed(1).replace('.',',')+' mil':fmt(cnt);txt(s2,40,165,84,{al:'left'});
    const dp=o3(P(t,ti+1.2,ti+1.4));if(dp>0){ctx.globalAlpha=dp;arrowUp(52,215,.7,C.verde);txt(d,76,228,32,{w:700,f:'Roboto',col:C.verde,al:'left'})}
    if(i===1){ctx.strokeStyle=C.azul;ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();const pts=[0,.2,.15,.35,.3,.55,.5,.8,.72,1];const q=P(t,ti+.3,ti+1.3);pts.forEach((v2,j)=>{const xx=270+j*15,yy=95-v2*50;if(j/(pts.length-1)<=q)j?ctx.lineTo(xx,yy):ctx.moveTo(xx,yy)});ctx.stroke()}
    endCard()});
   const g=o3(P(t,13.8,14.1));chip('4 números que mostram se você está crescendo',540,1270,C.ink,C.creme,g*(1-P(t,14.8,15)));ctx.restore()}
  // --- cena 3: cruzamento + direcionamento
  if(t>14.85){const e=back(P(t,15,15.35));ctx.save();zt(t,15,18.4);
   if(card(90,600,900,380,{sc:e})){txt('Alcance médio por formato',50,75,40,{al:'left'});
    [['Reels',5200,C.laranja],['Carrossel',2100,C.azul],['Foto',900,'#9C9A91']].forEach(([lb,v,col],i)=>{const q=o4(P(t,15.3+i*.18,16+i*.18));const y=140+i*80;txt(lb,50,y+36,36,{w:500,f:'Roboto',al:'left'});ctx.fillStyle='#EEE9DC';rr(250,y,560,48,24);ctx.fill();ctx.fillStyle=col;rr(250,y,Math.max(48,560*v/5200*q),48,24);ctx.fill();txt(v>=1000?(v*q/1000).toFixed(1).replace('.',',')+' mil':fmt(v*q),250+Math.max(48,560*v/5200*q)-18,y+36,32,{w:700,f:'Roboto',col:C.branco,al:'right',a:q>.4?1:0})});endCard()}
   const e2=back(P(t,16.3,16.6));if(card(90,1010,900,250,{sc:e2,fill:'#FFF1E9'})){spark(62,62,1.1,C.laranja);txt('Direcionamento',100,76,40,{al:'left'});
    const S='Reels performam 2,5x melhor que Carrosséis. Priorize esse formato na próxima leva.';const n=Math.floor(S.length*P(t,16.6,17.7));para(S,50,140,800,36,48,{w:500,upto:n});if(t>16.6&&t<17.8&&Math.floor(t*6)%2)null;endCard()}
   ctx.restore()}
  adesivo('sticker-lampada',960,575,140,t,16.35,.18);wipe(t,9,C.laranja,C.rosa);wipe(t,12,C.azul,C.amarelo);wipe(t,15,C.verde,C.rosa)}
 // ===== 18 a 20.6 · PROVA =====
 else if(t<20.6){bg(t);ctx.save();const pz0=1+.04*P(t,18,20.6);ctx.translate(540,960);ctx.scale(pz0,pz0);ctx.translate(-540,-960);const w1=back(P(t,18.1,18.35)),w2=back(P(t,18.35,18.6));if(w1>0){ctx.save();ctx.translate(540,420);ctx.scale(w1,w1);txt('Agora você sabe',0,0,92,{});ctx.restore()}if(w2>0){ctx.save();ctx.translate(540,525);ctx.scale(w2,w2);txt('o que postar amanhã.',0,0,92,{col:C.laranja});ctx.restore()}
  const e=P(t,18,18.3);const s=lerp(1.5,1,o4(e));if(card(110,640,860,560,{sc:s,a:o3(e),rot:lerp(.06,-.015,o4(e))})){spark(64,70,1.1,C.laranja);txt('Leitura da IA',104,84,44,{al:'left'});txt('Ações pra próxima semana',52,160,34,{w:500,f:'Roboto',col:'#6B6960',al:'left'});
   [['3 Reels do pilar rotina',18.55],['Postar entre 19h e 21h',18.95],['Pergunta no gancho',19.35]].forEach(([s2,t0],i)=>{const p=P(t,t0,t0+.3);const y=250+i*100;ctx.globalAlpha=o3(p);box(40,y,780,80,40,'#F3EFE3',false);check(90,y+40,28,C.verde,p);txt(s2,140,y+54,40,{w:700,f:'Roboto',al:'left'});ctx.globalAlpha=1});endCard()}
  chip('exemplo ilustrativo',540,1245,'#EEE9DC','#6B6960',o3(P(t,19.6,19.8)));
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2,d=o4(P(t,18.05,18.8))*(420+(i%5)*60),al=1-P(t,18.5,19.3);if(al>0){ctx.fillStyle=[C.amarelo,C.rosa,C.azul,C.verde][i%4];ctx.globalAlpha=al;ctx.fillRect(540+Math.cos(a)*d-10,920+Math.sin(a)*d*.8-10,20,20);ctx.globalAlpha=1}}ctx.restore();wipe(t,18,C.laranja,C.amarelo)}
 // ===== 20.6 a 25 · CTA =====
 else{const w=o4(P(t,20.6,20.95));ctx.fillStyle=C.creme;ctx.fillRect(-40,-40,W+80,H+80);ctx.fillStyle=C.laranja;ctx.beginPath();ctx.arc(540,960,lerp(0,1500,w),0,7);ctx.fill();
  const g=ctx.createRadialGradient(200,400,0,200,400,700);g.addColorStop(0,hexA(C.amarelo,.35*w));g.addColorStop(1,hexA(C.amarelo,0));ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ['sticker-lampada','sticker-coracao','sticker-agenda','selo-club-verde'].forEach((n,i)=>adesivo(n,[150,930,140,940][i],[250,250,1500,1500][i],[180,170,160,190][i],t,21.3+i*.25,[.2,-.15,.15,-.2][i]));
  if(t>20.85)logoFatias('amarelo',540,540,800,i=>{const ph=((t-20.85-i*.1)%.5+.5)%.5/.5;const up=Math.sin(Math.min(1,ph/.5)*Math.PI);const e=o4(P(t,20.85,21.2));return{dy:-up*40+(1-e)*160,rot:(i%2?1:-1)*up*.07,sc:lerp(.6,1,e)}});
  const a1=back(P(t,21.3,21.55));if(a1>0){ctx.save();ctx.translate(540,950);ctx.scale(a1,a1);txt('Pare de postar no escuro.',0,0,78,{col:C.branco});ctx.restore()}
  const cp=back(P(t,21.8,22.1));const beat=Math.exp(-((t-22)%.5)*8)*(t>22.2?1:0);pill('Criar conta grátis',540,1100,{bg:C.amarelo,fg:C.ink,size:68,padX:60,sc:cp*(1+.05*beat),a:o3(P(t,21.8,21.95))});
  if(t>22.3){const ay=1195+Math.sin((t-22.3)*Math.PI*4)*12;ctx.save();ctx.globalAlpha=o3(P(t,22.3,22.5));ctx.strokeStyle=C.amarelo;ctx.lineWidth=12;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(540,ay+80);ctx.lineTo(540,ay);ctx.moveTo(505,ay+35);ctx.lineTo(540,ay);ctx.lineTo(575,ay+35);ctx.stroke();ctx.restore()}
  txt('Conecta com o Instagram. Celular e computador.',540,1320,40,{w:500,f:'Roboto',col:C.creme,a:o3(P(t,22.5,22.8))})}
 if(window.SAFE){ctx.fillStyle='rgba(224,52,43,.25)';ctx.fillRect(0,0,W,270);ctx.fillRect(0,1250,W,H-1250)}
 ctx.restore()}

function buildAudio(ac,out,T0=0){const S=criaSons(ac,out,T0);const fx=S.fx;
 S.trilha.eletro(0,20.6);
 fx.impacto(.05);fx.pop(.1,620);fx.pop(.25,780);fx.contador(.35,1);fx.moeda(1.35);fx.sucesso(1.36);fx.erro(1.6);fx.carimbo(1.9);
 fx.whip(2.9);for(let i=0;i<9;i++)fx.popAgudo(3.05+i*.06);fx.zumbido(3.6,1.6);fx.carimbo(4.4);fx.carimbo(5.0);fx.carimbo(5.6);fx.impacto(5.6);fx.subida(6.0,.6);fx.whoosh(6.55,.5);
 fx.impacto(7.0);[0,1,2].forEach(i=>{fx.boing(7.0+i*.12);fx.criatura(7.45+i*.2)});S.assinatura.brilho(8.05);
 [9,12,15].forEach(b=>{fx.whoosh(b-.25,.4);fx.whip(b-.05)});fx.whoosh(17.8,.4);fx.clique(10.3);fx.toggle(10.4);fx.sucesso(10.55);fx.subida(10.9,.9);
 [12.1,12.25,12.4,12.55].forEach(b=>fx.popAgudo(b));fx.contador(12.3,1.3);fx.pop(13.8,700);
 [15.3,15.48,15.66].forEach(b=>fx.popGrave(b));fx.carimbo(16.35);fx.brilho(16.3);fx.digitando(16.6);fx.digitando(17.1);
 fx.impacto(18);fx.confete(18.05);fx.pop(18.1,700);fx.pop(18.35,900);[18.55,18.95,19.35].forEach(b=>fx.sucesso(b));fx.whoosh(20.4);S.assinatura.groove(20.6);[21.3,21.55,21.8,22.05].forEach(b=>fx.popAgudo(b));fx.brilho(22.3)}

function loadImg(s){return new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=j;i.src=s})}
const ready=(async()=>{await Promise.all(Object.entries(MARCA).map(async([k,s])=>{IMG.m[k]=await loadImg(s)}));IMG.x={};await Promise.all(Object.entries(EXTRA).map(async([k,s])=>{IMG.x[k]=await loadImg(s)}));
 await Promise.all(['800 40px "Baloo 2"','400 40px Roboto','500 40px Roboto','700 40px Roboto','400 40px "Grand Hotel"'].map(f=>document.fonts.load(f)));render(0)})();
window.render=render;window.buildAudio=buildAudio;window.ready=ready;
