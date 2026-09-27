// ORG C · "Um lugar pra cada coisa" · criador de conteúdo · organização
// Metáfora de gaveteiro: cada gaveta é uma parte do CRIA e abre com a tela real dentro.
const BT=60/96;
SHAKES=[[.9,14],[1.3,10],[3.1,8],[3.7,8],[4.3,8],[4.9,8],[18.2,16]];
const GAV=[['Ideias viram post',C.amarelo,'p4',{fy:.35,zoom:1.05}],['Plano do mês','#FFB3D6','p1',{fy:.2,zoom:1.04}],['Agenda do mês','#B8C4FA','p2',{fy:.1,zoom:1.04}],['Stories da semana','#9FE0B8','p3',{fy:.3,zoom:1.04}]];
const CAB={x:150,y:640,w:780,dh:190,gap:18};
const T_OPEN=i=>7.4+i*2.6;
function gaveta(i,t,dim){const[nome,col]=GAV[i];const y=CAB.y+i*(CAB.dh+CAB.gap);const t0=T_OPEN(i);const op=o4(P(t,t0,t0+.3))*(1-io3(P(t,t0+2.1,t0+2.4)));const shut=t>t0+2.4?Math.sin(P(t,t0+2.4,t0+2.6)*Math.PI)*.04:0;
 ctx.save();ctx.globalAlpha*=dim;const s=1+op*.06+shut;ctx.translate(CAB.x+CAB.w/2,y+CAB.dh/2+op*40);ctx.scale(s,s);
 if(op>0){ctx.fillStyle=hexA(C.ink,.35*op);rr(-CAB.w/2+20,-CAB.dh/2-30*op,CAB.w-40,40,10);ctx.fill()}
 box(-CAB.w/2,-CAB.dh/2,CAB.w,CAB.dh,28,col);ctx.fillStyle=hexA(C.ink,.85);rr(-110,40,220,26,13);ctx.fill();
 txt(nome,-CAB.w/2+40,-CAB.dh/2+70,50,{al:'left'});
 const ok=P(t,t0+2.55,t0+2.8);if(ok>0){ctx.save();ctx.translate(CAB.w/2-60,-CAB.dh/2+48);ctx.scale(back(ok),back(ok));ctx.fillStyle=C.verde;ctx.beginPath();ctx.arc(0,0,30,0,7);ctx.fill();ctx.strokeStyle=C.branco;ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(-12,0);ctx.lineTo(-3,10);ctx.lineTo(14,-10);ctx.stroke();ctx.restore()}
 ctx.restore()}
function conteudo(i,t){const t0=T_OPEN(i);const up=o4(P(t,t0+.2,t0+.6)),dn=i4(P(t,t0+1.9,t0+2.25));const k=up*(1-dn);if(k<=0)return;const y0=CAB.y+i*(CAB.dh+CAB.gap)+CAB.dh/2;const g=GAV[i];
 phone3(IMG[g[2]],540,lerp(y0,1120,k),500,{sc:lerp(.2,1,k),rot:lerp(.1,i%2?.03:-.03,k),a:cl(k*1.5),zoom:lerp(1,g[3].zoom,P(t,t0+.6,t0+1.9)),fy:g[3].fy},kk=>{
  if(i===0)ring(kk,34,330,322,230,P(t,t0+.9,t0+1.4),'legenda no seu tom',C.laranja,'top');
  if(i===1)ring(kk,238,196,118,20,P(t,t0+.9,t0+1.4),'pilar certo');
  if(i===2)ring(kk,253,212,90,20,P(t,t0+.9,t0+1.4),'12 agendados');
  if(i===3)ring(kk,96,368,48,14,P(t,t0+.9,t0+1.4),'por tipo','#0061EE','right')})}

function render(t){TT=t;ctx.save();ctx.clearRect(0,0,W,H);const[sx,sy]=shake(t);ctx.translate(sx,sy);bg(t);
 // ===== 0 a 3 GANCHO: gaveta que não fecha =====
 if(t<3){const a1=back(P(t,0,.3));if(a1>0){ctx.save();ctx.translate(540,380);ctx.scale(a1,a1);txt('Onde você guarda',0,0,86,{});ctx.restore()}const a2=back(P(t,.3,.6));if(a2>0){ctx.save();ctx.translate(540,480);ctx.scale(a2,a2);txt('suas ideias?',0,0,100,{col:C.laranja});ctx.restore()}
  const e=o4(P(t,.5,.8));const bump=t>.9?Math.sin((t-.9)*18)*14*Math.exp(-(t-.9)*3):0;ctx.save();ctx.translate(540,1150+(1-e)*500);box(-380,-150,760,300,34,'#E6D3B0');ctx.fillStyle=hexA(C.ink,.85);rr(-110,-14,220,28,14);ctx.fill();ctx.restore();
  // post-its escapando da gaveta
  for(let i=0;i<9;i++){const t0=.9+i*.13;if(t<t0)continue;const d=t-t0;const vx=[-520,-300,-120,160,420,-420,280,-60,520][i],vy=-[900,1200,1400,1300,1000,1500,1600,1700,1100][i];const x=540+vx*d,y=1000+vy*d+1900*d*d;if(y>2100)continue;ctx.save();ctx.translate(x,y);ctx.rotate(d*[3,-4,2,-3,5,-2,4,-5,3][i]);box(-80,-60,160,120,8,[C.amarelo,C.rosa,'#B8C4FA','#9FE0B8'][i%4]);ctx.restore()}}
 // ===== 3 a 5.5 ONDE FICA TUDO =====
 else if(t<5.6){const L=[['no bloco de notas',C.amarelo],['num print',C.rosa],['num áudio de 0:47',C.lilas],['na sua cabeça',C.verde]];L.forEach(([s,c],i)=>{const t0=3+i*.6;const p=back(P(t,t0,t0+.25));if(p<=0)return;const y=560+i*190;ctx.save();ctx.translate(540,y);ctx.rotate([-.04,.03,-.02,.04][i]);ctx.scale(p,p);ctx.font=F(800,64);const w=ctx.measureText(s).width+80;box(-w/2,-60,w,120,60,c);txt(s,0,22,64,{});ctx.restore()});
  const out=o3(P(t,5.2,5.5));if(out>0){ctx.fillStyle=hexA(C.creme,out);ctx.fillRect(0,0,W,H)}}
 // ===== 5.5 a 7.4 MONTA O GAVETEIRO =====
 else if(t<7.4){txt('E se cada coisa',540,380,82,{a:o3(P(t,5.6,5.85))});txt('tivesse uma gaveta?',540,475,82,{col:C.laranja,a:o3(P(t,5.8,6.05))});
  GAV.forEach((g,i)=>{const t0=6.1+i*BT/2;const p=o4(P(t,t0,t0+.3));ctx.save();ctx.translate((1-p)*(i%2?1200:-1200),0);gaveta(i,0,1);ctx.restore()})}
 // ===== 7.4 a 17.8 CADA GAVETA ABRE =====
 else if(t<17.8){const i=cl(Math.floor((t-7.4)/2.6),0,3);const t0=T_OPEN(i);
  txt(GAV[i][0],540,380,86,{a:o3(P(t,t0,t0+.25))*(1-o3(P(t,t0+2.35,t0+2.6)))});txt(['tudo que vira post','seu mês no lugar','cada dia com o seu','nada no improviso'][i],540,470,62,{col:C.laranja,a:o3(P(t,t0+.1,t0+.35))*(1-o3(P(t,t0+2.35,t0+2.6)))});
  const opening=P(t,t0+.2,t0+.5)*(1-P(t,t0+2,t0+2.3));
  GAV.forEach((g,j)=>gaveta(j,t,j===i?1:lerp(1,.35,opening)));
  ctx.fillStyle=hexA(C.creme,.55*opening);ctx.fillRect(0,540,W,1100);conteudo(i,t)}
 // ===== 17.8 a 20.4 TUDO NO LUGAR =====
 else if(t<20.4){GAV.forEach((g,j)=>gaveta(j,t,1));const p=P(t,18.1,18.3);ctx.save();ctx.translate(540,470);ctx.rotate(-.04);const s=lerp(2.4,1,i4(o3(p)));ctx.scale(s,s);ctx.globalAlpha=o3(p);ctx.strokeStyle=C.verde;ctx.lineWidth=10;rr(-420,-62,840,124,26);ctx.fillStyle=C.creme;ctx.fill();ctx.stroke();txt('UM LUGAR PRA CADA COISA',0,20,56,{col:C.verde});ctx.restore();
  chip('telas reais do app',540,360,C.amarelo,C.ink,o3(P(t,18.6,18.8)))}
 // ===== 20.4 a 25 CTA =====
 else{const w=o4(P(t,20.4,20.8));ctx.fillStyle=C.rosa;ctx.beginPath();ctx.arc(540,960,lerp(0,1500,w),0,7);ctx.fill();
  if(t>20.6)logoFatias('azul',540,560,800,i=>{const ph=((t-20.6-i*.14)%BT+BT)%BT/BT;const up=Math.sin(Math.min(1,ph/.5)*Math.PI);const e=o4(P(t,20.6,21));return{dy:-up*28+(1-e)*160,rot:(i%2?1:-1)*up*.05,sc:lerp(.6,1,e)}});
  const a1=back(P(t,21.1,21.4));if(a1>0){ctx.save();ctx.translate(540,960);ctx.scale(a1,a1);txt('Tudo no seu lugar.',0,0,84,{col:C.ink});ctx.restore()}
  const cp=back(P(t,21.7,22));const beat=Math.exp(-((t-21.7)%BT)*7)*(t>22.1?1:0);pill('Criar conta grátis',540,1110,{bg:C.ink,fg:C.amarelo,size:68,padX:60,sc:cp*(1+.045*beat),a:o3(P(t,21.7,21.85))});
  txt('No celular e no computador.',540,1240,44,{w:500,f:'Roboto',col:C.ink,a:o3(P(t,22.3,22.6))});
  ['sticker-agenda','sticker-lampada'].forEach((n,i)=>adesivo(n,[160,920][i],[1500,1480][i],180,t,22.2+i*.3,[.18,-.15][i]))}
 if(window.SAFE){ctx.fillStyle='rgba(224,52,43,.25)';ctx.fillRect(0,0,W,270);ctx.fillRect(0,1250,W,H-1250)}
 ctx.restore()}

function buildAudio(ac,out,T0=0){const S=criaSons(ac,out,T0);const fx=S.fx;
 fx.pop(0,620);fx.pop(.3,780);fx.carimbo(.9);fx.boing(.95);for(let i=0;i<9;i++)fx.papel(.9+i*.13);fx.tremor(1.3);
 [3,3.6,4.2,4.8].forEach((b,i)=>{fx.popGrave(b);(i===2?fx.notificacao:fx.clique)(b+.05)});
 S.trilha.piano(5.6,14.8);fx.pop(5.6,620);fx.pop(5.8,780);GAV.forEach((g,i)=>fx.whooshCurto(6.1+i*BT/2));
 GAV.forEach((g,i)=>{const t0=T_OPEN(i);fx.caixa(t0);fx.subida(t0+.2,.4);fx.popAgudo(t0+.9);fx.whooshCurto(t0+1.9);fx.carimbo(t0+2.4);fx.sucesso(t0+2.55)});
 fx.impacto(18.1);fx.carimbo(18.1);fx.whoosh(20.2);S.assinatura.suave(20.4);fx.popAgudo(21.1);fx.popAgudo(21.7);fx.brilho(22.2)}

function loadImg(s){return new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=j;i.src=s})}
const ready=(async()=>{await Promise.all(Object.entries(MARCA).map(async([k,s])=>{IMG.m[k]=await loadImg(s)}));
 for(const k of ['p1','p2','p3','p4'])IMG[k]=await loadImg(PRINTS[k]);
 await Promise.all(['800 40px "Baloo 2"','700 40px Roboto','400 40px Roboto','500 40px Roboto','400 40px "Grand Hotel"'].map(f=>document.fonts.load(f)));render(0)})();
window.render=render;window.buildAudio=buildAudio;window.ready=ready;
