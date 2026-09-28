// @kit  C1 · "Abriu pra postar. Fechou sem postar." · quem não sabe por onde começar · PAS + demo com prints reais
const TITLE='C1 · Por onde eu começo';
const DESC='Criador travado que não sabe o que postar. Responde o onboarding, ganha pilares por dia da semana e sai com a semana montada no Cria Plano (prints reais da conta demo).';
SHAKES=[[.1,10],[1.4,16],[2.3,12],[3.4,8],[3.7,8],[4.0,8],[4.3,8],[4.6,8],[5.2,14],[7.0,22],[18,16],[20.6,16]];
const NICHOS=['Rotina','Casa e organização','Autocuidado','Moda','Receitas','Fitness','Maternidade','Viagem','Finanças'];
const PIL=[['Rotina real',C.rosa],['Casa e organização',C.amarelo],['Autocuidado',C.verde],['Bastidor',C.lilas],['Dica rápida',C.azul]];
function render(t){TT=t;ctx.save();ctx.clearRect(0,0,W,H);const[sx,sy]=shake(t);ctx.translate(sx,sy);
 // ===== 0 a 3 · GANCHO: legenda que nunca sai =====
 if(t<3){bg(t);const out=i4(P(t,2.6,3));const e=back(P(t,0,.35));
  bate('Abriu pra postar.',540,420,96,t,.1);bate('Fechou sem postar.',540,530,96,t,1.4,{col:C.laranja});
  phoneDraw(540,1080+out*900,560,860,{sc:e*(1-out*.4),rot:-.03+out*.3},(w,h)=>{ctx.fillStyle='#F3EFE3';ctx.fillRect(0,0,w,90);txt('Nova publicação',w/2,58,32,{w:700,f:'Roboto'});
   ctx.fillStyle=hexA(C.lilas,.55);rr(30,120,w-60,360,24);ctx.fill();ctx.fillStyle='rgba(253,251,245,.6)';ctx.beginPath();ctx.arc(w-110,210,50,0,7);ctx.fill();
   const S='hoje eu vou falar sobre';const tp=t<1.3?P(t,.35,1.2):1-P(t,1.5,2.2);const n=Math.floor(S.length*tp);box(30,510,w-60,160,20,C.branco,false);ctx.save();ctx.font=F(500,32,'Roboto');ctx.fillStyle=n?C.ink:'#A9A69C';ctx.textAlign='left';const s2=n?S.slice(0,n):'Escreva uma legenda...';ctx.fillText(s2,56,570);const cw=n?ctx.measureText(s2).width:0;ctx.restore();
   if(Math.floor(t*3)%2===0){ctx.fillStyle=C.laranja;ctx.fillRect(58+cw,540,4,40)}
   box(30,700,w-60,90,45,t>2.2?'#E7E3D8':C.ink,false);txt('Compartilhar',w/2,757,34,{w:700,f:'Roboto',col:t>2.2?'#A9A69C':C.branco})});
  if(t>2.25){const p=P(t,2.25,2.6);xmark(540,1080,1.6,C.vermelho,p)}}
 // ===== 3 a 6.55 · AGITAR: a semana inteira sem post =====
 else if(t<7){bg(t);ctx.save();const cz=1+.06*P(t,3,6.6);ctx.translate(540,960);ctx.scale(cz,cz);ctx.translate(-540,-960);
  bate('E amanhã',540,420,100,t,3.05);bate('de novo.',540,530,100,t,3.3,{col:C.laranja});
  const D=['seg','ter','qua','qui','sex','sáb','dom'];D.forEach((d,i)=>{const r=Math.floor(i/4),c=i%4;const x=r?290+c*250:165+c*250,y=820+r*250;const e=back(P(t,3.1+i*.05,3.4+i*.05));if(e<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(e,e);box(-105,-100,210,200,28,C.branco);txt(d,0,-40,40,{col:'#9C9A91'});txt('0 posts',0,30,32,{w:500,f:'Roboto',col:'#9C9A91'});ctx.restore();xmark(x,y,1,C.vermelho,P(t,3.4+i*.3,3.55+i*.3))});
  const f1=o4(P(t,5.4,5.65)),f2=o4(P(t,5.8,6.05));if(f1>0){box(90,1330-(1-f1)*30,900,210,36,C.ink,false);txt('Não é preguiça.',540,1415,70,{col:C.creme,a:f1});txt('É falta de caminho.',540,1500,70,{col:C.amarelo,a:f2})}
  ctx.restore();viradaCirculo(t,540,1440)}
 // ===== 7 a 9 · VIRADA =====
 else if(t<9){virada(t,'e se o caminho','já viesse pronto?')}
 // ===== 9 a 18 · DEMO =====
 else if(t<18){bg(t);
  cap2(t,'Comece aqui','#FFE3D6','Responde umas perguntas','sobre você e seu público.',9,12);
  cap2(t,'Seus pilares','#D6E6FF','Sobre o que falar','em cada dia da semana.',12,15);
  cap2(t,'Cria Plano','#D5F2E1','A semana montada,','post por post.',15,18);
  // cena 1: onboarding
  if(t<12.2){ctx.save();zt(t,9,12);if(card(110,600,860,660,{})){const st=t<10.6?3:t<11.3?4:5;txt(`${st}/6`,780,70,34,{w:700,f:'Roboto',col:'#9C9A91'});ctx.fillStyle='#EEE9DC';rr(40,95,780,14,7);ctx.fill();ctx.fillStyle=C.laranja;rr(40,95,780*lerp(2/6,5/6,o3(P(t,9.2,11.6))),14,7);ctx.fill();
    txt('Sobre o que você cria?',40,175,50,{al:'left'});
    const SEL={1:10.0,0:10.4,2:10.8};NICHOS.forEach((n,i)=>{const r=Math.floor(i/3),c=i%3;const x=40+c*262,y=220+r*120;const on=SEL[i]!==undefined&&t>SEL[i];const p=on?back(P(t,SEL[i],SEL[i]+.25)):0;ctx.save();ctx.translate(x+125,y+50);ctx.scale(1+.06*Math.sin(p*Math.PI),1+.06*Math.sin(p*Math.PI));box(-125,-45,250,90,45,on?C.laranja:'#F3EFE3',false);const L=wrap(n,210,28,700,'Roboto');L.forEach((ln,j)=>txt(ln,0,(j-(L.length-1)/2)*30+10,28,{w:700,f:'Roboto',col:on?C.branco:C.ink}));ctx.restore()});
    const cur=[[1,10.0],[0,10.4],[2,10.8]].find(([i,tt])=>t<tt+.3&&t>tt-.45);if(cur){const[i,tt]=cur;const x=40+(i%3)*262+150,y=220+Math.floor(i/3)*120+70;cursor(x,y,t>tt-.1&&t<tt+.1?1-Math.abs(t-tt)*10:0)}
    const bp=back(P(t,11.2,11.5));if(bp>0){ctx.save();ctx.translate(430,590);ctx.scale(bp,bp);box(-230,-45,460,90,45,C.ink,false);txt('Continuar',0,14,40,{col:C.branco});ctx.restore()}
    endCard()}ctx.restore()}
  // cena 2: pilares por dia
  if(t>11.8&&t<15.2){ctx.save();zt(t,12,15);if(card(90,600,900,660,{})){txt('Sua linha editorial',40,75,48,{al:'left'});
    ['seg','ter','qua','qui','sex'].forEach((d,i)=>{const y=120+i*104;txt(d,40,y+62,36,{col:'#9C9A91',al:'left'});ctx.fillStyle='rgba(10,10,10,.04)';rr(150,y+10,710,82,41);ctx.fill();
     const t0=12.4+i*.28;const p=P(t,t0,t0+.35);if(p>0){const[lb,col]=PIL[i];const yy=lerp(-500,0,o4(p));ctx.save();ctx.translate(505,y+51+yy);ctx.rotate((1-o4(p))*(i%2?.3:-.3));box(-355,-41,710,82,41,col,false);txt(lb,0,14,40,{col:C.ink});ctx.restore()}});
    endCard()}ctx.restore();adesivo('selo-ideia-post-amarelo',900,610,210,t,13.9,.15)}
  // cena 3: print real do Cria Plano
  if(t>14.8){ctx.save();zt(t,15,18.4);const im=IMG.pr['01-cria-plano-gerado'];const b=Math.sin(t*2.2)*8;
   phone3(im,540,1130+b,560,{sc:lerp(.9,1,o4(P(t,15,15.4))),rot:-.03,zoom:lerp(1,1.1,io3(P(t,15.3,17.8)))},k=>{ring(k,20,224,350,48,P(t,15.6,16.1),'o gancho');ring(k,238,196,118,20,P(t,16.2,16.7),'pilar',C.azul,'top');ring(k,34,282,340,26,P(t,16.8,17.3),'data e horário',C.verde,'bottom')});
   ctx.restore()}
  wipe(t,9,C.laranja,C.rosa);stickerSweep(t,12,['criatures-rosa','selo-club-amarelo','sticker-lampada']);stickerSweep(t,15,['criatures-verde','selo-ideia-post-rosa','selo-club-azul'],-1)}
 // ===== 18 a 20.6 · PROVA =====
 else if(t<20.6){bg(t);ctx.save();const pz0=1+.04*P(t,18,20.6);ctx.translate(540,960);ctx.scale(pz0,pz0);ctx.translate(-540,-960);
  const w1=back(P(t,18.15,18.4)),w2=back(P(t,18.4,18.65));if(w1>0){ctx.save();ctx.translate(540,410);ctx.scale(w1,w1);txt('Seu mês inteiro',0,0,90,{});ctx.restore()}if(w2>0){ctx.save();ctx.translate(540,515);ctx.scale(w2,w2);txt('com direção.',0,0,90,{col:C.laranja});ctx.restore()}
  const im=IMG.pr['02-calendario-do-mes'];const e=P(t,18,18.3);phone3(im,540,1150,540,{sc:lerp(1.3,1,o4(e)),a:o3(e),rot:lerp(.08,.02,o4(e)),zoom:1.05,fy:.25},k=>{ring(k,248,212,95,20,P(t,18.8,19.3),'12 agendados',C.laranja)});
  chip('tela real do app',540,1250,C.amarelo,C.ink,o3(P(t,19.4,19.6)));confete(t,18.05);ctx.restore();stickerSweep(t,18,['criatures-amarelo','selo-club-verde','sticker-coracao'])}
 // ===== 20.6 a 25 · CTA =====
 else ctaFinal(t,C.laranja,'Seu perfil com direção.','Teste tudo grátis por 7 dias. Celular e computador.',['sticker-lampada','sticker-agenda','sticker-coracao','selo-club-verde']);
 if(window.SAFE){ctx.fillStyle='rgba(224,52,43,.25)';ctx.fillRect(0,0,W,270);ctx.fillRect(0,1250,W,H-1250)}
 ctx.restore()}
function buildAudio(ac,out,T0=0){const S=criaSons(ac,out,T0);const fx=S.fx;S.trilha.pop(0,20.6);
 fx.whooshCurto(0);fx.impacto(.1);fx.digitando(.4);fx.digitando(.8);fx.impacto(1.4);for(let i=0;i<5;i++)fx.tecla(1.5+i*.13);fx.erro(2.25);fx.carimbo(2.3);fx.whoosh(2.6,.4);
 fx.impacto(3.05);fx.pop(3.3,780);for(let i=0;i<7;i++){fx.popAgudo(3.1+i*.05);fx.carimbo(3.4+i*.3)}fx.impacto(5.4);fx.pop(5.8,900);sfxVirada(fx,S);
 [10,10.4,10.8].forEach(b=>{fx.clique(b);fx.popAgudo(b+.02)});fx.sucesso(11.2);sfxSweep(fx,12);for(let i=0;i<5;i++)fx.papel(12.4+i*.28+.3);fx.carimbo(13.9);
 sfxSweep(fx,15);[15.6,16.2,16.8].forEach(b=>fx.popAgudo(b));sfxSweep(fx,18);fx.confete(18.05);fx.pop(18.15,700);fx.pop(18.4,900);fx.popAgudo(18.8);sfxCta(fx,S)}
const ready=(async()=>{await carrega();render(0)})();window.render=render;window.buildAudio=buildAudio;window.ready=ready;
