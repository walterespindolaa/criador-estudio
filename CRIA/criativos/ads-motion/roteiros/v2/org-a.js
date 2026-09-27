// ORG A · "Caos que se encaixa" · criador de conteúdo · organização
// Antes: bagunça que treme e apita (sem música). Depois: cada coisa voa pro seu lugar com som de encaixe, lo-fi entra.
SHAKES=[[2.9,8],[3.6,8],[4.3,10],[5,12],[12.1,16],[16.5,12]];
const BEAT=60/84;
const PIL={rot:['Rotina real','#F7C9A8'],casa:['Casa e organização','#E6D3B0'],auto:['Autocuidado','#D9E3B5'],publi:['Achadinhos e publis','#FFE38A']};
// itens da bagunça: tipo, texto, posição no caos, destino (col 0-6, linha 0-1) ou null (sai de cena), pilar
const ITENS=[
 ['nota','ideia: minha manhã real',[250,640],[0,0],'rot'],
 ['zap','marca: e a publi do café?',[760,600],[3,0],'publi'],
 ['nota','faxina de 15 min',[560,820],[1,0],'casa'],
 ['audio','áudio de 0:47 com ideia',[300,1010],[2,0],'auto'],
 ['aba','8 abas abertas',[800,900],null],
 ['nota','trend da semana??',[480,1180],[4,0],'rot'],
 ['zap','amiga: grava o arruma comigo!',[250,1340],[5,0],'casa'],
 ['planilha','planilha de 2023',[800,1240],null],
 ['nota','roteiro do stories',[600,1480],[6,0],'auto'],
 ['print','print salvo',[220,800],null],
 ['nota','achadinho da semana',[840,1440],[3,1],'publi'],
 ['audio','áudio: rotina noturna',[440,1600],[0,1],'rot'],
];
const BOARD={x:70,y:540,w:940,h:720};
function slot(d,pos){return[BOARD.x+300+pos*310,BOARD.y+130+d*84]}
function pileXY(i){return[150+(i%6)*156,1420+Math.floor(i/6)*190]}
function itemDraw(it,sc=1,chipP=0){const[tp,s,,,pil]=it;ctx.save();ctx.scale(sc,sc);
 if(chipP>0.5&&pil){const[nm,col]=PIL[pil];box(-145,-34,290,68,20,col,false);ctx.font=F(800,25);ctx.fillStyle=C.ink;ctx.textAlign='left';let tx=s.replace(/^[a-zá]+: /i,'');while(ctx.measureText(tx).width>250&&tx.length>4)tx=tx.slice(0,-2);if(tx!==s.replace(/^[a-zá]+: /i,''))tx=tx.trim()+'…';ctx.fillText(tx,-128,9);ctx.restore();return}
 if(tp==='nota'){box(-150,-100,300,200,10,[C.amarelo,C.rosa,'#B8C4FA','#9FE0B8'][s.length%4]);ctx.font=F(800,34);ctx.fillStyle=C.ink;ctx.textAlign='center';const ws=s.split(' ');const l1=ws.slice(0,Math.ceil(ws.length/2)).join(' '),l2=ws.slice(Math.ceil(ws.length/2)).join(' ');ctx.fillText(l1,0,-6);ctx.fillText(l2,0,36)}
 else if(tp==='zap'){box(-190,-62,380,124,26,'#DCF8C6');ctx.font=F(500,28,'Roboto');ctx.fillStyle=C.ink;ctx.textAlign='left';const[a,b]=s.split(': ');ctx.fillStyle='#128C7E';ctx.font=F(700,24,'Roboto');ctx.fillText(a,-165,-18);ctx.fillStyle=C.ink;ctx.font=F(500,28,'Roboto');ctx.fillText(b,-165,22)}
 else if(tp==='audio'){box(-180,-50,360,100,50,C.branco);ctx.fillStyle=C.verde;ctx.beginPath();ctx.arc(-130,0,30,0,7);ctx.fill();ctx.fillStyle=C.branco;ctx.beginPath();ctx.moveTo(-138,-14);ctx.lineTo(-116,0);ctx.lineTo(-138,14);ctx.fill();for(let i=0;i<22;i++){const hh=8+Math.abs(Math.sin(i*1.7))*30;ctx.fillStyle=hexA(C.ink,.5);ctx.fillRect(-88+i*10,-hh/2,5,hh)}ctx.font=F(500,22,'Roboto');ctx.fillStyle=hexA(C.ink,.6);ctx.fillText(s.match(/\d+:\d+/)?'0:47':'1:12',140,40)}
 else if(tp==='aba'){box(-220,-40,440,80,14,'#E8E6DE');for(let i=0;i<8;i++){ctx.fillStyle=i===3?C.branco:'#D2CFC4';rr(-210+i*53,-28,48,56,10);ctx.fill()}ctx.fillStyle=C.vermelho;ctx.beginPath();ctx.arc(205,-40,22,0,7);ctx.fill();ctx.fillStyle=C.branco;ctx.font=F(800,24);ctx.textAlign='center';ctx.fillText('8',205,-32)}
 else if(tp==='planilha'){box(-170,-110,340,220,8,C.branco);ctx.strokeStyle='#9FD8B5';ctx.lineWidth=2;for(let i=0;i<=6;i++){ctx.beginPath();ctx.moveTo(-160,-100+i*33);ctx.lineTo(160,-100+i*33);ctx.stroke()}for(let i=0;i<=4;i++){ctx.beginPath();ctx.moveTo(-160+i*80,-100);ctx.lineTo(-160+i*80,98);ctx.stroke()}ctx.fillStyle=C.verde;ctx.fillRect(-160,-100,320,33)}
 else if(tp==='print'){box(-120,-160,240,320,18,C.ink);ctx.fillStyle='#CFCBBE';rr(-106,-146,212,292,12);ctx.fill();ctx.fillStyle=hexA(C.ink,.25);ctx.beginPath();ctx.moveTo(-60,60);ctx.lineTo(-10,0);ctx.lineTo(20,40);ctx.lineTo(40,20);ctx.lineTo(80,60);ctx.fill()}
 ctx.restore()}
// badges de problema
const BADGES=[[1,'sem data'],[3,'esqueci'],[5,'cadê?'],[6,'pra quando?'],[10,'sem data']];

function drawChaos(t,freeze,intens){ITENS.forEach((it,i)=>{const t0=.1+i*.17;if(t<t0)return;const p=back(P(t,t0,t0+.25));const tt=freeze??t;const j=intens*(1+i%3);const x=it[2][0]+Math.sin(tt*7+i*2)*j,y=it[2][1]+Math.cos(tt*6.3+i)*j;const r=[-.12,.08,-.05,.14,-.09,.06,.1,-.07,.04,-.15,.09,-.04][i]+Math.sin(tt*5+i)*.02*intens/4;
 ctx.save();ctx.translate(x,y);ctx.rotate(r);ctx.scale(p*.92,p*.92);itemDraw(it);ctx.restore()});
 BADGES.forEach(([i,s],k)=>{const t0=2.7+k*.45;if(t<t0)return;const p=back(P(t,t0,t0+.25));const it=ITENS[i];ctx.save();ctx.translate(it[2][0]+110,it[2][1]-80);ctx.scale(p,p);ctx.rotate(.08);box(-90,-28,180,56,28,C.vermelho,false);ctx.fillStyle=C.branco;ctx.font=F(800,28);ctx.textAlign='center';ctx.fillText(s,0,10);ctx.restore()})}

function board(t,a){if(a<=0)return;ctx.save();ctx.globalAlpha*=a;box(BOARD.x,BOARD.y,BOARD.w,BOARD.h,44,C.branco);txt('Semana da Duda',BOARD.x+40,BOARD.y+64,46,{al:'left'});txt('28 set a 4 out',BOARD.x+BOARD.w-40,BOARD.y+64,30,{al:'right',w:500,f:'Roboto',col:'rgba(10,10,10,.5)'});
 ['SEG 28','TER 29','QUA 30','QUI 1','SEX 2','SÁB 3','DOM 4'].forEach((d,i)=>{const y=BOARD.y+130+i*84;txt(d,BOARD.x+40,y+10,30,{al:'left',w:700,f:'Roboto',col:'rgba(10,10,10,.5)'});ctx.strokeStyle='rgba(10,10,10,.08)';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(BOARD.x+30,y+42);ctx.lineTo(BOARD.x+BOARD.w-30,y+42);ctx.stroke();for(let pos=0;pos<2;pos++){const[sx,sy]=slot(i,pos);ctx.strokeStyle='rgba(10,10,10,.1)';ctx.setLineDash([8,8]);rr(sx-145,sy-34,290,68,20);ctx.stroke();ctx.setLineDash([])}});ctx.restore()}
function render(t){TT=t;ctx.save();ctx.clearRect(0,0,W,H);const[sx,sy]=shake(t);ctx.translate(sx,sy);bg(t);
 // ===== 0 a 6.4 CAOS =====
 if(t<6.4){const intens=lerp(2,9,P(t,1,5.8));const fr=t>5.8?5.8:null;drawChaos(t,fr,t>5.8?0:intens);
  if(t<5.8){const a=o3(P(t,0,.25));ctx.save();ctx.fillStyle=hexA(C.creme,.9*a);rr(90,250,900,230,40);ctx.fill();ctx.restore();txt('Sua semana de conteúdo',540,350,74,{a});const a2=back(P(t,.5,.8));if(a2>0){ctx.save();ctx.translate(540,445);ctx.scale(a2,a2);txt('tá assim?',0,0,92,{col:C.laranja});ctx.restore()}
   if(t>3.2){const b=o3(P(t,3.2,3.4));ctx.save();ctx.fillStyle=hexA(C.ink,.9*b);rr(190,1700-(1-b)*40,700,110,55);ctx.fill();ctx.restore();txt('tudo solto. nada no lugar.',540,1772-(1-b)*40,50,{col:C.amarelo,a:b})}}
  else{ctx.fillStyle=hexA(C.creme,.55*o3(P(t,5.8,6)));ctx.fillRect(0,0,W,H);const a=o4(P(t,5.85,6.1));txt('E se cada coisa',540,380,84,{a});txt('tivesse um lugar?',540,475,84,{col:C.laranja,a:o4(P(t,6,6.25))})}}
 // ===== 6.4 a 12.6 ENCAIXE =====
 else if(t<12.6){const bi=o4(P(t,6.4,6.9));ctx.save();ctx.translate(0,(1-bi)*1300);board(t,1);ctx.restore();
  txt('cada ideia',540,330,80,{a:o3(P(t,6.5,6.8))});txt('no dia certo',540,420,80,{col:C.laranja,a:o3(P(t,6.65,6.95))});
  let k=0;ITENS.forEach((it,i)=>{const t0=7+i*(BEAT/2);const fly=P(t,t0,t0+.35);const pm=io3(P(t,6.4,6.9));const pl=pileXY(i);const from=[lerp(it[2][0],pl[0],pm),lerp(it[2][1],pl[1],pm)];
   if(it[3]){const[tx,ty]=slot(it[3][0],it[3][1]);const e=io3(fly);const x=lerp(from[0],tx,e),y=lerp(from[1],ty,e)-Math.sin(e*Math.PI)*180;const land=t-(t0+.35);const sq=land>0&&land<.3?Math.sin(land*30)*.12*Math.exp(-land*10):0;const sc=lerp(.92,1,e);ctx.save();ctx.translate(x,y);ctx.rotate(lerp(.1,0,e));ctx.scale(1+sq,1-sq);itemDraw(it,e>.5?1:lerp(lerp(.92,.5,pm),.45,e*2),e);ctx.restore()}
   else{const e=i4(fly);if(e>=1)return;const x=lerp(from[0],from[0]<540?-400:1480,e),y=from[1]-e*300;ctx.save();ctx.translate(x,y);ctx.rotate(e*1.2);ctx.globalAlpha=1-e;itemDraw(it,lerp(lerp(.92,.5,pm),.3,e));ctx.restore()}});
  if(t>11.4){const p=P(t,11.4,11.58);ctx.save();ctx.translate(540,1330);ctx.rotate(-.03);const s=lerp(2.4,1,i4(o3(p)));ctx.scale(s,s);ctx.globalAlpha=o3(p);ctx.strokeStyle=C.verde;ctx.lineWidth=10;rr(-330,-56,660,112,24);ctx.fillStyle=C.creme;ctx.fill();ctx.stroke();txt('SEMANA ORGANIZADA ✓',0,18,50,{col:C.verde});ctx.restore()}}
 // ===== 12.6 a 16.6 NO APP DE VERDADE =====
 else if(t<16.6){const pz=punch(t,[12.6,14.6]);const e=o4(P(t,12.6,13.0));
  txt('igualzinho no app',540,330,80,{a:o3(P(t,12.7,12.95))});txt('no seu celular',540,420,80,{col:C.laranja,a:o3(P(t,12.85,13.1))});
  if(t<14.6){phone3(IMG.p2,540,1130,560,{sc:pz*lerp(.7,1,e),rot:lerp(.1,-.03,e),a:e,zoom:lerp(1,1.06,P(t,13,14.6)),fy:.2},k=>{ring(k,253,212,90,20,P(t,13.3,13.8),'12 agendados');ring(k,32,528,316,70,P(t,13.9,14.4),'no dia certo',C.verde,'bottom')})}
  else{const e2=o4(P(t,14.6,14.95));const f=()=>phone3(IMG.p3,540+(1-e2)*900,1130,560,{sc:pz,rot:.03,zoom:lerp(1,1.05,P(t,14.8,16.6)),fy:.3},k=>{ring(k,96,368,48,14,P(t,15.1,15.5),'tutorial','#0061EE','right');ring(k,93,421,48,14,P(t,15.5,15.9),'caixinha',C.verde,'right');ring(k,96,473,48,14,P(t,15.9,16.3),'bastidor',C.laranja,'right')});ghost(f,whip(t,14.6)*-160)}}
 // ===== 16.6 a 20 ANTES E DEPOIS =====
 else if(t<20){const e=o4(P(t,16.6,17));txt('cada coisa',540,330,84,{a:e});txt('no seu lugar.',540,425,84,{col:C.laranja,a:o4(P(t,16.8,17.2))});
  // antes (miniatura do caos)
  ctx.save();ctx.translate(290-(1-e)*500,1000);ctx.rotate(-.05);box(-230,-330,460,660,36,'#EFEBDD');ctx.save();rr(-230,-330,460,660,36);ctx.clip();ctx.scale(.42,.42);ctx.translate(-540,-1080);drawChaos(20,20,6);ctx.restore();ctx.restore();
  chip('antes',290-(1-e)*500,1380,C.ink,C.creme,e);
  // depois (print real)
  const e2=o4(P(t,17.1,17.5));phone3(IMG.p2,790+(1-e2)*500,1000,420,{rot:.04,a:e2});chip('depois',790+(1-e2)*500,1380,C.verde,C.branco,e2);
  txt('tela real do app',790,1470,32,{w:500,f:'Roboto',col:'rgba(10,10,10,.55)',a:o3(P(t,17.6,17.9))})}
 // ===== 20 a 25 CTA =====
 else{const w=o4(P(t,20,20.4));ctx.fillStyle=C.verde;ctx.beginPath();ctx.arc(540,960,lerp(0,1500,w),0,7);ctx.fill();
  if(t>20.2)logoFatias('amarelo',540,560,800,i=>{const ph=((t-20.2-i*.15)%BEAT+BEAT)%BEAT/BEAT;const up=Math.sin(Math.min(1,ph/.5)*Math.PI);const e=o4(P(t,20.2,20.6));return{dy:-up*28+(1-e)*160,rot:(i%2?1:-1)*up*.05,sc:lerp(.6,1,e)}});
  const a1=back(P(t,20.8,21.1));if(a1>0){ctx.save();ctx.translate(540,960);ctx.scale(a1,a1);txt('Organize seu conteúdo.',0,0,80,{col:C.branco});ctx.restore()}
  const cp=back(P(t,21.4,21.7));const beat=Math.exp(-((t-21.4)%BEAT)*7)*(t>21.8?1:0);pill('Criar conta grátis',540,1110,{bg:C.amarelo,fg:C.ink,size:68,padX:60,sc:cp*(1+.045*beat),a:o3(P(t,21.4,21.55))});
  txt('No celular e no computador.',540,1240,44,{w:500,f:'Roboto',col:C.creme,a:o3(P(t,22,22.3))});
  ['sticker-agenda','sticker-lampada'].forEach((n,i)=>adesivo(n,[160,920][i],[1500,1480][i],180,t,21.9+i*.3,[.18,-.15][i]))}
 if(window.SAFE){ctx.fillStyle='rgba(224,52,43,.25)';ctx.fillRect(0,0,W,270);ctx.fillRect(0,1250,W,H-1250)}
 ctx.restore()}

function buildAudio(ac,out,T0=0){const S=criaSons(ac,out,T0);const fx=S.fx;
 // caos: sem música, só notificação e mensagem se sobrepondo cada vez mais rápido
 ITENS.forEach((it,i)=>{const t0=.1+i*.17;(it[0]==='zap'?fx.mensagem:it[0]==='audio'?fx.notificacao:fx.popAgudo)(t0)});
 for(let t=2.6,d=.55;t<5.8;t+=d,d*=.86)(Math.round(t*10)%2?fx.notificacao:fx.mensagem)(t);BADGES.forEach((b,k)=>fx.erro(2.7+k*.45));fx.zumbido(3.2);fx.tictac(4.2,6);
 fx.impacto(5.8);fx.pop(5.9,620);fx.pop(6.05,780);
 // organização: lo-fi entra e cada encaixe tem som
 S.trilha.lofi(6.4,18.6);fx.whooshCurto(6.4);
 ITENS.forEach((it,i)=>{const t0=7+i*(BEAT/2);if(it[3]){fx.whip(t0);fx.clique(t0+.35);fx.popGrave(t0+.36)}else fx.whoosh(t0,.4)});
 fx.carimbo(11.4);fx.sucesso(11.5);fx.zoomIn(12.55);[13.3,13.9,15.1,15.5,15.9].forEach(b=>fx.popAgudo(b));fx.whip(14.55);
 fx.whooshCurto(16.6);fx.pop(17.1,700);fx.whoosh(19.8);S.assinatura.suave(20.1);[20.8,21.4].forEach(b=>fx.popAgudo(b));fx.brilho(22)}

function loadImg(s){return new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=j;i.src=s})}
const ready=(async()=>{await Promise.all(Object.entries(MARCA).map(async([k,s])=>{IMG.m[k]=await loadImg(s)}));
 IMG.p1=await loadImg(PRINTS.p1);IMG.p2=await loadImg(PRINTS.p2);IMG.p3=await loadImg(PRINTS.p3);
 await Promise.all(['800 40px "Baloo 2"','700 40px Roboto','400 40px Roboto','500 40px Roboto','400 40px "Grand Hotel"'].map(f=>document.fonts.load(f)));render(0)})();
window.render=render;window.buildAudio=buildAudio;window.ready=ready;
