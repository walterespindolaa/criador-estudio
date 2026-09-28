// @kit  S2 · "Seu cliente não vê metade do que você faz" · valor pro cliente final · PAS + demo
const TITLE='S2 · Seu cliente não vê o que você faz';
const DESC='Social mídia que entrega muito e o cliente não enxerga. No CRIA o cliente aprova por link com a marca dele, recebe o relatório com as métricas do Instagram e ganha o link na bio. Telas redesenhadas a partir do app (exemplo ilustrativo).';
SHAKES=[[.9,14],[1.6,10],[2.3,14],[3.05,10],[5.2,20],[7.0,22],[18,16],[20.6,16]];
const TAREFAS=['roteiro','captação','edição','legenda','arte','aprovação','agendamento','métricas','reunião','relatório','referências','stories'];
const TERRA='#C7663F';
function clientePhone(t,cx,cy,rot,fn){phoneDraw(cx,cy,560,1000,{rot},(w,h)=>{ctx.fillStyle=TERRA;ctx.fillRect(0,0,w,170);ctx.fillStyle=C.branco;ctx.beginPath();ctx.arc(80,95,42,0,7);ctx.fill();txt('CA',80,110,34,{col:TERRA});txt('Café Aurora',140,90,38,{al:'left',col:C.branco});txt('conteúdo por Studio Gabi',140,130,24,{w:500,f:'Roboto',al:'left',col:'rgba(255,255,255,.85)'});fn(w,h)})}
function render(t){TT=t;ctx.save();ctx.clearRect(0,0,W,H);const[sx,sy]=shake(t);ctx.translate(sx,sy);
 // ===== 0 a 3 · GANCHO: a pergunta do cliente =====
 if(t<3){bg(t);const out=i4(P(t,2.75,3));ctx.save();ctx.translate(540,1000);ctx.scale(1+out*.5,1+out*.5);ctx.translate(-540,-1000);ctx.globalAlpha*=1-out;
  phoneDraw(540,1080,580,900,{sc:back(P(t,0,.3)),rot:.02,bgc:'#EFE9DC'},(w,h)=>{ctx.fillStyle=C.branco;ctx.fillRect(0,0,w,110);ctx.fillStyle=TERRA;ctx.beginPath();ctx.arc(70,56,34,0,7);ctx.fill();txt('CA',70,68,28,{col:C.branco});txt('Café Aurora',120,52,32,{w:700,f:'Roboto',al:'left'});txt(t<.85?'digitando...':'online',120,86,24,{w:500,f:'Roboto',al:'left',col:C.verde});
   if(t<.85&&t>.2){box(30,160,150,70,35,C.branco,false);[0,1,2].forEach(i=>{ctx.fillStyle='#9C9A91';ctx.beginPath();ctx.arc(75+i*30,195+Math.sin(t*14+i)*6,8,0,7);ctx.fill()})}
   const p=back(P(t,.85,1.15));if(p>0){ctx.save();ctx.translate(30,160);ctx.scale(p,p);box(0,0,470,140,30,C.branco,false);txt('Oi! O que você fez',28,56,34,{w:500,f:'Roboto',al:'left'});txt('esse mês?',28,100,34,{w:500,f:'Roboto',al:'left'});ctx.restore()}});
  bate('Se ele pergunta,',540,420,96,t,1.6);bate('ele não viu.',540,530,96,t,2.3,{col:C.laranja});ctx.restore()}
 // ===== 3 a 6.55 · AGITAR: o iceberg =====
 else if(t<7){bg(t);ctx.save();const cz=1+.05*P(t,3,6.6);ctx.translate(540,960);ctx.scale(cz,cz);ctx.translate(-540,-960);
  const wl=900+Math.sin(t*2)*8;const e=o4(P(t,3.05,3.4));ctx.fillStyle=hexA(C.azul,.14*e);ctx.fillRect(-60,wl,W+120,H);ctx.strokeStyle=hexA(C.azul,.5*e);ctx.lineWidth=6;ctx.beginPath();for(let x=-60;x<=W+60;x+=20)ctx.lineTo(x,wl+Math.sin(x*.02+t*3)*8);ctx.stroke();
  // ponta visível: 3 posts
  for(let i=0;i<3;i++){const p=back(P(t,3.1+i*.1,3.4+i*.1));if(p<=0)continue;ctx.save();ctx.translate(340+i*200,790);ctx.scale(p,p);box(-85,-85,170,170,24,[C.laranja,C.rosa,C.amarelo][i]);ctx.fillStyle='rgba(253,251,245,.6)';ctx.beginPath();ctx.arc(30,-30,26,0,7);ctx.fill();ctx.restore()}
  txt('o que o cliente vê',540,680,36,{w:700,f:'Roboto',col:'#6B6960',a:o3(P(t,3.3,3.5))});
  TAREFAS.forEach((s,i)=>{const t0=3.6+i*.12;const p=P(t,t0,t0+.3);if(p<=0)return;const r=Math.floor(i/3),c=i%3;const x=220+c*320,y=1000+r*95;ctx.save();ctx.translate(x,y+(1-o4(p))*120);ctx.globalAlpha*=o3(p);pill(s,0,0,{bg:C.branco,fg:C.ink,size:36,padX:28});ctx.restore()});
  bate('Ele vê 3 posts.',540,420,92,t,3.1);bate('Você fez 40 tarefas.',540,525,92,t,4.2,{col:C.laranja});
  const sp=P(t,5.2,5.4);if(sp>0){ctx.save();ctx.translate(540,1440);ctx.rotate(-.06);const s=lerp(2.4,1,i4(sp));ctx.scale(s,s);ctx.globalAlpha=o3(sp);pill('e aí ele pechincha.',0,0,{bg:C.vermelho,fg:C.branco,size:60,padX:48});ctx.restore()}
  ctx.restore();viradaCirculo(t,540,1440)}
 // ===== 7 a 9 · VIRADA =====
 else if(t<9){virada(t,'e se ele visse','tudo que você faz?','azul')}
 // ===== 9 a 18 · DEMO =====
 else if(t<18){bg(t);
  cap2(t,'Aprovação por link','#FFE3D6','Ele aprova no celular,','com a cara da marca dele.',9,12);
  cap2(t,'Relatório do mês','#D6E6FF','Pronto, com as métricas','do Instagram dele.',12,15);
  cap2(t,'Link na bio','#D5F2E1','Até o link na bio','do cliente, você entrega.',15,18);
  // cena 1: portal de aprovação + marcação na arte
  if(t<12.2){ctx.save();zt(t,9,12);clientePhone(t,540,1130+Math.sin(t*2)*6,-.02,(w,h)=>{txt('Aprove seus posts',30,230,34,{w:700,f:'Roboto',al:'left'});txt('5 de 8 aprovados',30,275,26,{w:500,f:'Roboto',al:'left',col:'#6B6960'});ctx.fillStyle='#EEE9DC';rr(30,290,w-60,14,7);ctx.fill();ctx.fillStyle=C.verde;rr(30,290,(w-60)*5/8,14,7);ctx.fill();
    ctx.fillStyle=hexA(C.laranja,.8);rr(30,330,w-60,400,26);ctx.fill();ctx.fillStyle='rgba(253,251,245,.6)';ctx.beginPath();ctx.arc(w-130,440,70,0,7);ctx.fill();txt('Pão da manhã',60,420,52,{col:C.branco,al:'left'});
    const pin=back(P(t,10.2,10.45));if(pin>0){ctx.save();ctx.translate(300,490);ctx.scale(pin,pin);ctx.fillStyle=C.ink;ctx.beginPath();ctx.arc(0,0,28,0,7);ctx.fill();txt('1',0,11,30,{col:C.branco});ctx.restore()}
    const bb=back(P(t,10.5,10.8));if(bb>0){ctx.save();ctx.translate(60,560);ctx.scale(bb,bb);box(0,0,w-120,110,24,C.branco);txt('1 · trocar a cor do título',24,48,26,{w:700,f:'Roboto',al:'left'});txt('pra ficar igual ao cardápio',24,84,24,{w:500,f:'Roboto',al:'left',col:'#6B6960'});ctx.restore()}
    const sent=t>11.35;box(30,760,w-60,90,45,sent?C.verde:C.ink,false);txt(sent?'Ajuste enviado ✓':'Enviar ajuste',w/2,818,32,{w:700,f:'Roboto',col:C.branco})});
   if(t>9.7&&t<10.35)cursor(lerp(800,574,o4(P(t,9.7,10.1))),lerp(1500,1134,o4(P(t,9.7,10.1))),t>10.1?Math.sin(P(t,10.1,10.3)*Math.PI):0);
   if(t>10.95&&t<11.6)cursor(lerp(760,560,o4(P(t,10.95,11.2))),lerp(1650,1450,o4(P(t,10.95,11.2))),t>11.2?Math.sin(P(t,11.2,11.4)*Math.PI):0);
   ctx.restore()}
  // cena 2: relatório com métricas do IG + envio
  if(t>11.8&&t<15.2){ctx.save();zt(t,12,15);if(card(110,590,860,640,{})){ctx.fillStyle=C.ink;ctx.beginPath();ctx.arc(80,80,40,0,7);ctx.fill();txt('SG',80,93,30,{col:C.amarelo});ctx.fillStyle=TERRA;ctx.beginPath();ctx.arc(160,80,40,0,7);ctx.fill();txt('CA',160,93,30,{col:C.branco});
    txt('Relatório de Entregas',225,78,42,{al:'left'});txt('Café Aurora · outubro',225,118,28,{w:500,f:'Roboto',col:'#6B6960',al:'left'});
    [['Alcance',41800],['Seguidores',380],['Posts',12]].forEach(([lb,v],i)=>{const q=o3(P(t,12.3+i*.15,13.2+i*.15));const x=40+i*262;box(x,165,242,160,24,'#F3EFE3',false);txt(lb,x+22,205,24,{w:500,f:'Roboto',col:'#6B6960',al:'left'});txt(i===0?(v*q/1000).toFixed(1).replace('.',',')+' mil':(i===1?'+':'')+fmt(v*q),x+22,285,52,{al:'left'})});
    const ig=IMG.x&&IMG.x.instagram;if(ig)img(ig,64,380,40,{});txt('métricas do Instagram do cliente',ig?96:40,392,26,{w:700,f:'Roboto',al:'left',col:'#6B6960'});
    [.4,.62,.5,.8,.7,1].forEach((v,i)=>{const q=o4(P(t,12.6+i*.08,13.2+i*.08));ctx.fillStyle=i===5?C.laranja:C.lilas;rr(50+i*130,600-170*v*q,90,170*v*q,12);ctx.fill()});
    endCard()}
   ['PDF','WhatsApp','E-mail'].forEach((s,i)=>{const p=back(P(t,13.7+i*.1,14+i*.1));if(p<=0)return;ctx.save();ctx.translate(290+i*250,1300);ctx.scale(p,p);const on=i===1&&t>14.3;pill(s,0,0,{bg:on?C.verde:C.ink,fg:C.branco,size:36,padX:32});ctx.restore()});
   if(t>14.05&&t<14.6)cursor(lerp(820,545,o4(P(t,14.05,14.3))),lerp(1500,1305,o4(P(t,14.05,14.3))),t>14.3?Math.sin(P(t,14.3,14.5)*Math.PI):0);
   ctx.restore()}
  // cena 3: link na bio do cliente
  if(t>14.8){ctx.save();zt(t,15,18.4);phoneDraw(540,1130+Math.sin(t*2)*6,560,1000,{rot:.02,bgc:'#F6E9DF'},(w,h)=>{ctx.fillStyle=TERRA;ctx.beginPath();ctx.arc(w/2,150,80,0,7);ctx.fill();txt('CA',w/2,172,62,{col:C.branco});txt('Café Aurora',w/2,290,44,{});txt('pães de fermentação natural · Itajaí',w/2,330,24,{w:500,f:'Roboto',col:'#6B6960'});
    ['Cardápio da semana','Fazer encomenda','Como chegar','Nosso Instagram'].forEach((s,i)=>{const p=back(P(t,15.4+i*.15,15.7+i*.15));if(p<=0)return;ctx.save();ctx.translate(w/2,410+i*110);ctx.scale(p,p);box(-(w-80)/2,-42,w-80,84,42,i===0?TERRA:C.branco,false);txt(s,0,12,32,{w:700,f:'Roboto',col:i===0?C.branco:C.ink});ctx.restore()});
    const pp=back(P(t,16.6,16.9));if(pp>0){ctx.save();ctx.translate(w/2,880);ctx.scale(pp,pp);pill('criado no CRIA pela social mídia',0,0,{bg:C.amarelo,fg:C.ink,size:24,padX:22});ctx.restore()}});
   ctx.restore()}
  wipe(t,9,C.laranja,C.rosa);stickerSweep(t,12,['criatures-azul','selo-club-amarelo','sticker-agenda']);stickerSweep(t,15,['criatures-rosa','selo-club-verde','selo-ideia-post-amarelo'],-1)}
 // ===== 18 a 20.6 · PROVA: o iceberg virou vitrine =====
 else if(t<20.6){bg(t);ctx.save();const pz0=1+.04*P(t,18,20.6);ctx.translate(540,960);ctx.scale(pz0,pz0);ctx.translate(-540,-960);
  const w1=back(P(t,18.15,18.4)),w2=back(P(t,18.4,18.65));if(w1>0){ctx.save();ctx.translate(540,410);ctx.scale(w1,w1);txt('Entrega que ele vê',0,0,88,{});ctx.restore()}if(w2>0){ctx.save();ctx.translate(540,510);ctx.scale(w2,w2);txt('é entrega que ele paga.',0,0,82,{col:C.laranja});ctx.restore()}
  TAREFAS.forEach((s,i)=>{const r=Math.floor(i/3),c=i%3;const p=back(P(t,18.5+i*.06,18.8+i*.06));if(p<=0)return;ctx.save();ctx.translate(220+c*320,700+r*110);ctx.scale(p,p);pill(s,0,0,{bg:[C.amarelo,C.rosa,C.lilas,C.verde][i%4],fg:C.ink,size:38,padX:30});ctx.restore()});
  confete(t,18.05);chip('exemplo ilustrativo',540,1245,'#EEE9DC','#6B6960',o3(P(t,19.6,19.8)));ctx.restore();stickerSweep(t,18,['criatures-amarelo','selo-club-azul','sticker-coracao'])}
 // ===== 20.6 a 25 · CTA =====
 else ctaFinal(t,C.azul,'Mostre tudo que você entrega.','Conta grátis pra sempre. Pague só o módulo que usar.',['sticker-agenda','sticker-lampada','sticker-coracao','selo-club-amarelo'],'amarelo',66);
 if(window.SAFE){ctx.fillStyle='rgba(224,52,43,.25)';ctx.fillRect(0,0,W,270);ctx.fillRect(0,1250,W,H-1250)}
 ctx.restore()}
function buildAudio(ac,out,T0=0){const S=criaSons(ac,out,T0);const fx=S.fx;S.trilha.piano(0,20.6);
 fx.whooshCurto(0);fx.digitando(.25);fx.mensagem(.85);fx.impacto(1.6);fx.pop(2.3,780);fx.whoosh(2.75,.3);
 fx.impacto(3.05);for(let i=0;i<3;i++)fx.popGrave(3.1+i*.1);for(let i=0;i<12;i++)fx.bolha(3.6+i*.12);fx.pop(4.2,900);fx.carimbo(5.2);fx.erro(5.25);sfxVirada(fx,S);
 fx.clique(10.1);fx.pop(10.2,760);fx.popAgudo(10.5);fx.clique(11.2);fx.sucesso(11.35);sfxSweep(fx,12);fx.contador(12.3,1);[12.6,12.7,12.8,12.9,13,13.1].forEach(b=>fx.popAgudo(b));fx.clique(14.3);fx.mensagem(14.35);
 sfxSweep(fx,15);[15.4,15.55,15.7,15.85].forEach(b=>fx.pop(b,760));fx.brilho(16.6);sfxSweep(fx,18);fx.confete(18.05);fx.pop(18.15,700);fx.pop(18.4,900);for(let i=0;i<12;i++)fx.popAgudo(18.5+i*.06);sfxCta(fx,S)}
const ready=(async()=>{await carrega();render(0)})();window.render=render;window.buildAudio=buildAudio;window.ready=ready;
