// @kit  C3 · "Postou 3 dias. Sumiu 3 semanas." · constância · PAS + demo
const TITLE='C3 · Postou 3 dias e sumiu';
const DESC='Criador que não mantém constância. O CRIA avisa no celular o que é pra hoje, marca hábitos, mostra a meta da semana e deixa a agenda pronta (print real dos próximos posts).';
SHAKES=[[.1,10],[1.3,16],[2.2,14],[3.05,12],[4.8,16],[5.4,14],[7.0,22],[18,16],[20.6,16]];
function render(t){TT=t;ctx.save();ctx.clearRect(0,0,W,H);const[sx,sy]=shake(t);ctx.translate(sx,sy);
 // ===== 0 a 3 · GANCHO =====
 if(t<3){bg(t);const out=i4(P(t,2.75,3));ctx.save();ctx.translate(540,1000);ctx.scale(1+out*.5,1+out*.5);ctx.translate(-540,-1000);ctx.globalAlpha*=1-out;
  bate('Postou 3 dias.',540,420,100,t,.1);bate('Sumiu 3 semanas.',540,530,100,t,1.3,{col:C.laranja});
  for(let i=0;i<24;i++){const r=Math.floor(i/6),c=i%6;const x=165+c*150,y=760+r*150;const e=back(P(t,.05+i*.015,.3+i*.015));if(e<=0)continue;ctx.save();ctx.translate(x,y);ctx.scale(e,e);const post=i<3;const fl=post?0:P(t,.8+(i-3)*.065,.9+(i-3)*.065);
   box(-62,-62,124,124,22,post?C.laranja:fl>0?'#E4E0D5':C.branco);txt(String(i+1),0,-18,30,{w:700,f:'Roboto',col:post?C.branco:'#9C9A91'});if(post)check(0,26,20,C.verde,P(t,.15+i*.12,.4+i*.12));else if(fl>0)txt('—',0,34,34,{col:'#B8B4A8',a:fl});ctx.restore()}
  const cp=back(P(t,2.2,2.45));if(cp>0){ctx.save();ctx.translate(540,1400);ctx.rotate(-.04);ctx.scale(cp,cp);pill('21 dias sem postar',0,0,{bg:C.vermelho,fg:C.branco,size:56,padX:46});ctx.restore()}ctx.restore()}
 // ===== 3 a 6.55 · AGITAR: bateria da motivação =====
 else if(t<7){bg(t);ctx.save();const cz=1+.06*P(t,3,6.6);ctx.translate(540,960);ctx.scale(cz,cz);ctx.translate(-540,-960);
  bate('Motivação dura',540,420,96,t,3.05);bate('uns 3 dias.',540,530,96,t,3.3,{col:C.laranja});
  const lv=lerp(1,.05,io3(P(t,3.4,4.8)));const col=lv>.5?C.verde:lv>.2?C.amarelo:C.vermelho;const e=back(P(t,3.05,3.35));ctx.save();ctx.translate(540,930);ctx.scale(e,e);ctx.rotate(Math.sin(t*14)*.02*(lv<.2?1:0));
  box(-300,-150,600,300,50,C.branco);ctx.strokeStyle=C.ink;ctx.lineWidth=16;rr(-270,-120,500,240,36);ctx.stroke();ctx.fillStyle=C.ink;rr(236,-50,40,100,14);ctx.fill();ctx.fillStyle=col;rr(-250,-100,Math.max(30,460*lv),200,24);ctx.fill();txt(Math.round(lv*100)+'%',-20,30,90,{col:lv>.2?C.ink:C.vermelho});ctx.restore();
  txt('motivação',540,1130,40,{w:500,f:'Roboto',col:'#6B6960'});
  const f1=o4(P(t,5.4,5.65)),f2=o4(P(t,5.8,6.05));if(f1>0){box(90,1300-(1-f1)*30,900,210,36,C.ink,false);txt('O que segura',540,1385,70,{col:C.creme,a:f1});txt('é sistema.',540,1470,70,{col:C.amarelo,a:f2})}
  ctx.restore();viradaCirculo(t,540,1400)}
 // ===== 7 a 9 · VIRADA =====
 else if(t<9){virada(t,'e se o app','lembrasse por você?','verde')}
 // ===== 9 a 18 · DEMO =====
 else if(t<18){bg(t);
  cap2(t,'Lembretes','#FFE3D6','O celular te avisa','o que é pra hoje.',9,12);
  cap2(t,'Hábitos e metas','#D6E6FF','Um passo por dia,','e você vê o progresso.',12,15);
  cap2(t,'Agenda','#D5F2E1','A semana inteira','já no lugar.',15,18);
  // cena 1: tela bloqueada com notificações
  if(t<12.2){ctx.save();zt(t,9,12);phoneDraw(540,1130+Math.sin(t*2)*6,580,1000,{rot:-.02,bgc:'#2A2F4A'},(w,h)=>{const g=ctx.createLinearGradient(0,0,0,h);g.addColorStop(0,'#3C3F7A');g.addColorStop(1,'#E77F63');ctx.fillStyle=g;ctx.fillRect(0,0,w,h);
    txt('08:30',w/2,190,130,{w:700,f:'Roboto',col:C.branco});txt('terça-feira, 30 de setembro',w/2,245,28,{w:500,f:'Roboto',col:'rgba(255,255,255,.85)'});
    [['Seu dia no CRIA','1 post e 2 tarefas pra hoje.',9.6],['Amanhã sai um post','que ainda não está pronto.',10.9]].forEach(([a,b2,t0],i)=>{const p=P(t,t0,t0+.4);if(p<=0)return;const y=300+i*170+lerp(-260,0,o4(p));ctx.save();ctx.globalAlpha*=o3(p);ctx.fillStyle='rgba(253,251,245,.92)';rr(20,y,w-40,150,32);ctx.fill();img(IMG.m['icone-app'],72,y+52,56,{});txt('CRIA',110,y+62,24,{w:700,f:'Roboto',col:'#6B6960',al:'left'});txt('agora',w-50,y+62,22,{w:500,f:'Roboto',col:'#9C9A91',al:'right'});txt(a,44,y+104,30,{w:700,f:'Roboto',al:'left'});txt(b2,44,y+136,26,{w:500,f:'Roboto',al:'left',col:'#4A4840'});ctx.restore()})});
   ctx.restore()}
  // cena 2: hábitos + meta
  if(t>11.8&&t<15.2){ctx.save();zt(t,12,15);if(card(90,590,900,660,{})){txt('Hábitos de criação',40,75,46,{al:'left'});
    ['Anotar 1 ideia','Gravar 1 story','Responder comentários'].forEach((h,i)=>{const y=110+i*100;const t0=12.5+i*.4;box(40,y,500,80,40,'#F3EFE3',false);ctx.strokeStyle='#C9C4B6';ctx.lineWidth=5;ctx.beginPath();ctx.arc(90,y+40,24,0,7);ctx.stroke();check(90,y+40,26,C.verde,P(t,t0,t0+.3));txt(h,132,y+52,32,{w:700,f:'Roboto',al:'left',col:t>t0?'#9C9A91':C.ink});if(t>t0+.15){ctx.strokeStyle='#9C9A91';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(132,y+42);ctx.font=F(700,32,'Roboto');ctx.lineTo(132+ctx.measureText(h).width*o4(P(t,t0+.15,t0+.4)),y+42);ctx.stroke()}});
    txt('Meta da semana',720,160,34,{w:700,f:'Roboto',col:'#6B6960'});const q=lerp(1/3,1,o4(P(t,13.7,14.5)));ctx.lineWidth=34;ctx.strokeStyle='#EEE9DC';ctx.beginPath();ctx.arc(720,330,120,0,7);ctx.stroke();ctx.strokeStyle=q>=1?C.verde:C.laranja;ctx.lineCap='round';ctx.beginPath();ctx.arc(720,330,120,-Math.PI/2,-Math.PI/2+Math.PI*2*q);ctx.stroke();txt(`${Math.round(q*3)}/3`,720,350,72,{});txt('posts',720,395,28,{w:500,f:'Roboto',col:'#6B6960'});
    if(q>=1){const p=back(P(t,14.5,14.8));ctx.save();ctx.translate(720,540);ctx.scale(p,p);pill('meta batida',0,0,{bg:C.verde,fg:C.branco,size:40,padX:34});ctx.restore()}
    endCard()}ctx.restore()}
  // cena 3: print real dos próximos posts
  if(t>14.8){ctx.save();zt(t,15,18.4);const im=IMG.pr['04-proximos-posts-recorte'];const cw=760,k=cw/390,ch=im.height*k;if(card(160,600,cw+40,ch+40,{sc:lerp(.9,1,o4(P(t,15,15.4))),rot:-.02})){ctx.save();rr(20,20,cw,ch,24);ctx.clip();ctx.drawImage(im,20,20,cw,ch);ctx.translate(20,20);
    ring(k,15,90,360,58,P(t,15.6,16.1),'amanhã',C.laranja,'top');ring(k,15,150,360,58,P(t,16.2,16.7),'próximo',C.azul,'bottom');ctx.restore();endCard()}
   chip('tela real do app',540,1250,C.amarelo,C.ink,o3(P(t,16.9,17.1)));ctx.restore()}
  wipe(t,9,C.laranja,C.rosa);stickerSweep(t,12,['criatures-azul','selo-club-verde','sticker-lampada']);stickerSweep(t,15,['criatures-laranja','selo-ideia-post-amarelo','selo-club-azul'],-1)}
 // ===== 18 a 20.6 · PROVA =====
 else if(t<20.6){bg(t);ctx.save();const pz0=1+.04*P(t,18,20.6);ctx.translate(540,960);ctx.scale(pz0,pz0);ctx.translate(-540,-960);
  const w1=back(P(t,18.15,18.4)),w2=back(P(t,18.4,18.65));if(w1>0){ctx.save();ctx.translate(540,410);ctx.scale(w1,w1);txt('Constância não é',0,0,86,{});ctx.restore()}if(w2>0){ctx.save();ctx.translate(540,510);ctx.scale(w2,w2);txt('força de vontade.',0,0,86,{col:C.laranja});ctx.restore()}
  for(let i=0;i<21;i++){const r=Math.floor(i/7),c=i%7;const x=180+c*120,y=720+r*140;const e=back(P(t,18.1+i*.02,18.35+i*.02));if(e<=0)continue;ctx.save();ctx.translate(x,y);ctx.scale(e,e);const on=[0,2,4,7,9,11,14,16,18].includes(i);box(-52,-58,104,116,20,C.branco);if(on)check(0,0,30,C.verde,P(t,18.6+i*.05,18.85+i*.05));else{ctx.fillStyle='#EEE9DC';ctx.beginPath();ctx.arc(0,0,14,0,7);ctx.fill()}ctx.restore()}
  bate('É sistema.',540,1210,110,t,19.5,{col:C.verde});confete(t,18.05);ctx.restore();stickerSweep(t,18,['criatures-verde','selo-club-amarelo','sticker-coracao'])}
 // ===== 20.6 a 25 · CTA =====
 else ctaFinal(t,C.verde,'Constância que se mantém.','Teste tudo grátis por 7 dias. Celular e computador.',['sticker-agenda','sticker-lampada','sticker-coracao','selo-club-amarelo'],'amarelo',72);
 if(window.SAFE){ctx.fillStyle='rgba(224,52,43,.25)';ctx.fillRect(0,0,W,270);ctx.fillRect(0,1250,W,H-1250)}
 ctx.restore()}
function buildAudio(ac,out,T0=0){const S=criaSons(ac,out,T0);const fx=S.fx;S.trilha.brasil(0,20.6);
 fx.impacto(.1);[.15,.27,.39].forEach(b=>fx.sucesso(b));fx.tictac(.8,14);fx.impacto(1.3);fx.erro(2.2);fx.carimbo(2.2);fx.whoosh(2.75,.3);
 fx.impacto(3.05);fx.pop(3.3,780);fx.zumbido(3.4,1.4);fx.erro(4.8);fx.impacto(5.4);fx.pop(5.8,900);sfxVirada(fx,S);
 fx.notificacao(9.6);fx.notificacao(10.9);sfxSweep(fx,12);[12.5,12.9,13.3].forEach(b=>fx.sucesso(b));fx.subida(13.7,.8);fx.carimbo(14.5);
 sfxSweep(fx,15);fx.popAgudo(15.6);fx.popAgudo(16.2);fx.pop(16.9,700);sfxSweep(fx,18);fx.confete(18.05);fx.pop(18.15,700);fx.pop(18.4,900);for(let i=0;i<9;i++)fx.popAgudo(18.6+i*.1);fx.impacto(19.5);sfxCta(fx,S)}
const ready=(async()=>{await carrega();render(0)})();window.render=render;window.buildAudio=buildAudio;window.ready=ready;
