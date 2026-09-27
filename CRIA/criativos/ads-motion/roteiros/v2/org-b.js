// ORG B · "Antes e depois da semana" · criador de conteúdo · organização
// Tela dividida: a mesma semana no improviso (esquerda) e organizada (direita). Os dias avançam juntos.
const BPM=122,BT=60/BPM,DAY=4*BT,D0=2.6;
const DIAS=['SEG','TER','QUA','QUI','SEX','SÁB','DOM'];
const ESQ=['acordou sem saber o que postar','ideia do bloco de notas: sumiu','marca cobrou a publi no direct','3h rolando o feed atrás de trend','gravou, mas cadê a legenda?','esqueceu os stories de novo','domingo: culpa e zero post'];
const DIR=['post da manhã agendado 06:00','ideia virou post da semana','publi no dia certo, com lembrete','trend salva direto na pauta','legenda pronta no seu tom','3 stories planejados no dia','domingo: próxima semana pronta'];
SHAKES=[];for(let i=0;i<7;i++)SHAKES.push([D0+i*DAY+.05,7]);SHAKES.push([16.4,14]);
const L={x:36,w:492},R={x:552,w:492},PY=690,PH=720;
function evCard(x,w,y,s,good,a,rot){ctx.save();ctx.globalAlpha*=a;ctx.translate(x+w/2,y);ctx.rotate(rot);const h=112;box(-w/2+18,-h/2,w-36,h,24,good?C.branco:'#F2EFE8');
 ctx.fillStyle=good?C.verde:C.vermelho;ctx.beginPath();ctx.arc(-w/2+62,0,22,0,7);ctx.fill();ctx.strokeStyle=C.branco;ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();if(good){ctx.moveTo(-w/2+52,0);ctx.lineTo(-w/2+60,8);ctx.lineTo(-w/2+73,-8)}else{ctx.moveTo(-w/2+55,-7);ctx.lineTo(-w/2+69,7);ctx.moveTo(-w/2+69,-7);ctx.lineTo(-w/2+55,7)}ctx.stroke();
 ctx.font=F(700,27,'Roboto');ctx.fillStyle=good?C.ink:'rgba(10,10,10,.7)';ctx.textAlign='left';const ws=s.split(' ');let l1='',l2='';ws.forEach(wd=>{if(ctx.measureText((l1?l1+' ':'')+wd).width<w-150&&!l2)l1=(l1?l1+' ':'')+wd;else l2=(l2?l2+' ':'')+wd});ctx.fillText(l1,-w/2+98,l2?-6:9);if(l2)ctx.fillText(l2,-w/2+98,26);ctx.restore()}
function painel(t,side){const P_=side===0?L:R,good=side===1;const op=o4(P(t,1.2,1.7));if(op<=0)return;ctx.save();
 const x=P_.x+(1-op)*(side?300:-300);ctx.globalAlpha=op;box(x,PY-90,P_.w,PH+90,40,good?'#FFF8E6':'#E7E4DB');
 txt(good?'organizada':'no improviso',x+P_.w/2,PY-30,40,{col:good?C.verde:'rgba(10,10,10,.55)'});
 const day=Math.floor((t-D0)/DAY);const n=cl(day+1,0,7);
 for(let i=0;i<n;i++){const t0=D0+i*DAY+(good?.45:.12);const e=good?back(P(t,t0,t0+.3)):o4(P(t,t0,t0+.25));if(e<=0)continue;
  const idx=n-1-i;const y=PY+70+idx*118;if(y>PY+PH-40)continue;const jit=good?0:Math.sin(t*6+i*2)*3;
  evCard(x,P_.w,y+(1-e)*(good?-60:80)+jit,(good?DIR:ESQ)[i],good,cl(e)*(idx>5?.5:1),good?0:[-.04,.03,-.02,.05,-.03,.04,-.05][i])}
 ctx.restore()}
function contador(t,side){const day=cl(Math.floor((t-D0)/DAY)+1,0,7);const P_=side?R:L;const v=side?day*3:day;const x=P_.x+P_.w/2;const k=P(t,D0+(day-1)*DAY+(side?.45:.12),D0+(day-1)*DAY+(side?.75:.4));const s=1+.25*Math.sin(k*Math.PI);
 ctx.save();ctx.translate(x,PY+PH+80);ctx.scale(s,s);txt(String(v),0,0,96,{col:side?C.verde:C.vermelho});ctx.restore();txt(side?'coisas no lugar':'coisas esquecidas',x,PY+PH+130,30,{w:500,f:'Roboto',col:'rgba(10,10,10,.6)'})}

function render(t){TT=t;ctx.save();ctx.clearRect(0,0,W,H);const[sx,sy]=shake(t);ctx.translate(sx,sy);bg(t);
 if(t<16.4){
  // título
  const a1=back(P(t,0,.3)),a2=back(P(t,.45,.75));if(a1>0){ctx.save();ctx.translate(540,330);ctx.scale(a1,a1);txt('A mesma semana.',0,0,92,{});ctx.restore()}if(a2>0){ctx.save();ctx.translate(540,425);ctx.scale(a2,a2);txt('Duas criadoras.',0,0,92,{col:C.laranja});ctx.restore()}
  painel(t,0);painel(t,1);
  // dia atual no meio, trocando na batida
  if(t>=D0){const day=cl(Math.floor((t-D0)/DAY),0,6);const k=P(t,D0+day*DAY,D0+day*DAY+.2);const s=lerp(1.5,1,o4(k));ctx.save();ctx.translate(540,PY-130);ctx.scale(s,s);pill(DIAS[day]+' '+[28,29,30,1,2,3,4][day],0,-40,{bg:C.ink,fg:C.amarelo,size:44});ctx.restore()}
  if(t>=D0){contador(t,0);contador(t,1)}}
 // ===== 16.4 a 20 RESULTADO + PRINT REAL =====
 else if(t<20){const e=o4(P(t,16.4,16.8));
  txt('improviso: 7 coisas esquecidas',540,360,56,{col:'rgba(10,10,10,.55)',a:e});
  txt('organizada: 21 no lugar',540,445,64,{col:C.verde,a:o4(P(t,16.7,17.1))});
  const e2=o4(P(t,17.3,17.8));phone3(IMG.p2,540,1180,560,{sc:lerp(.7,1,e2),rot:lerp(.12,-.03,e2),a:e2,zoom:lerp(1,1.06,P(t,17.5,20)),fy:.2},k=>{ring(k,253,212,90,20,P(t,18.2,18.7),'12 agendados');ring(k,32,528,316,70,P(t,18.8,19.3),'no dia certo',C.verde,'bottom')});
  chip('tela real do app',540,560,C.amarelo,C.ink,o3(P(t,17.8,18)))}
 // ===== 20 a 25 CTA =====
 else{const w=o4(P(t,20,20.35));ctx.fillStyle=C.azul;ctx.beginPath();ctx.arc(540,960,lerp(0,1500,w),0,7);ctx.fill();
  if(t>20.2)logoFatias('amarelo',540,560,800,i=>{const ph=((t-20.2-i*.12)%BT+BT)%BT/BT;const up=Math.sin(Math.min(1,ph/.5)*Math.PI);const e=o4(P(t,20.2,20.55));return{dy:-up*30+(1-e)*160,rot:(i%2?1:-1)*up*.06,sc:lerp(.6,1,e)}});
  const a1=back(P(t,20.7,21));if(a1>0){ctx.save();ctx.translate(540,960);ctx.scale(a1,a1);txt('Qual semana é a sua?',0,0,80,{col:C.branco});ctx.restore()}
  const cp=back(P(t,21.3,21.6));const beat=Math.exp(-((t-21.3)%BT)*8)*(t>21.7?1:0);pill('Criar conta grátis',540,1110,{bg:C.amarelo,fg:C.ink,size:64,padX:56,sc:cp*(1+.045*beat),a:o3(P(t,21.3,21.45))});
  txt('No celular e no computador.',540,1240,44,{w:500,f:'Roboto',col:C.creme,a:o3(P(t,21.9,22.2))});
  ['sticker-agenda','sticker-coracao'].forEach((n,i)=>adesivo(n,[160,920][i],[1500,1480][i],180,t,21.9+i*.3,[.18,-.15][i]))}
 if(window.SAFE){ctx.fillStyle='rgba(224,52,43,.25)';ctx.fillRect(0,0,W,270);ctx.fillRect(0,1250,W,H-1250)}
 ctx.restore()}

function buildAudio(ac,out,T0=0){const S=criaSons(ac,out,T0);const fx=S.fx;
 fx.impacto(0);fx.pop(0.02,620);fx.pop(.47,780);fx.whooshCurto(1.2);
 S.trilha.house(D0-4*BT,16.4-(D0-4*BT));
 for(let i=0;i<7;i++){const t0=D0+i*DAY;fx.whip(t0-.05);fx.erro(t0+.12);fx.clique(t0+.45);fx.sucesso(t0+.47)}
 fx.impacto(16.4);fx.pop(16.4,620);fx.pop(16.7,880);fx.zoomIn(17.3);fx.popAgudo(18.2);fx.popAgudo(18.8);
 fx.whoosh(19.8);S.assinatura.groove(20);fx.popAgudo(20.7);fx.popAgudo(21.3);fx.brilho(21.9)}

function loadImg(s){return new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=j;i.src=s})}
const ready=(async()=>{await Promise.all(Object.entries(MARCA).map(async([k,s])=>{IMG.m[k]=await loadImg(s)}));
 IMG.p1=await loadImg(PRINTS.p1);IMG.p2=await loadImg(PRINTS.p2);IMG.p3=await loadImg(PRINTS.p3);
 await Promise.all(['800 40px "Baloo 2"','700 40px Roboto','400 40px Roboto','500 40px Roboto','400 40px "Grand Hotel"'].map(f=>document.fonts.load(f)));render(0)})();
window.render=render;window.buildAudio=buildAudio;window.ready=ready;
