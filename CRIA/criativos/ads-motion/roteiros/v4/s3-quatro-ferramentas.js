// @kit  S3 · "4 ferramentas. Nenhuma fala com a outra." · custo + integração · PAS + demo
const TITLE='S3 · Quatro ferramentas que não conversam';
const DESC='Social mídia pagando várias assinaturas soltas. No CRIA cada uma vira um módulo conectado: conta grátis pra sempre, paga só o módulo que usar, e o Cria Caixa mostra quanto sobra de cada cliente. Valores da fatura ilustrativos; preços do CRIA da página de vendas.';
SHAKES=[[.1,10],[1.9,16],[2.4,12],[3.05,10],[4.4,14],[5.3,16],[7.0,22],[18,16],[20.6,16]];
const FAT=[['Agendador',49.90],['Aprovação',39.90],['Relatórios',74.90],['Financeiro',29.90]];
const MOD=[['Cria Post',C.laranja,'aprova',19.90],['Cria Captação',C.amarelo,'agenda',19.90],['Cria Caixa',C.verde,'dinheiro',24.90],['Cria Gestão',C.azul,'notas',29.90]];
function nos(t,cx,cy,R,a0,pulse){MOD.forEach(([n,col,ic],i)=>{const a=-Math.PI/2+i*Math.PI/2+a0;const x=cx+Math.cos(a)*R,y=cy+Math.sin(a)*R*.9;
  ctx.save();ctx.strokeStyle=hexA(col,.6);ctx.lineWidth=8;ctx.setLineDash([2,18]);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(x,y);ctx.stroke();ctx.restore();
  if(pulse)for(let k=0;k<2;k++){const u=((t*.9+k*.5+i*.25)%1);ctx.fillStyle=col;ctx.beginPath();ctx.arc(lerp(cx,x,u),lerp(cy,y,u),11,0,7);ctx.fill()}});
 MOD.forEach(([n,col,ic],i)=>{const a=-Math.PI/2+i*Math.PI/2+a0;const x=cx+Math.cos(a)*R,y=cy+Math.sin(a)*R*.9;ctx.save();ctx.translate(x,y);box(-170,-62,340,124,32,C.branco);ctx.fillStyle=hexA(col,.2);ctx.beginPath();ctx.arc(-115,0,36,0,7);ctx.fill();icon(ic,-115,0,.95,col);txt(n,-68,11,32,{al:'left'});ctx.restore()})}
function hub(cx,cy,s){ctx.save();ctx.translate(cx,cy);ctx.scale(s,s);box(-120,-120,240,240,60,C.branco);img(IMG.m['icone-app'],0,0,190,{});ctx.restore()}
function render(t){TT=t;ctx.save();ctx.clearRect(0,0,W,H);const[sx,sy]=shake(t);ctx.translate(sx,sy);
 // ===== 0 a 3 · GANCHO: a fatura =====
 if(t<3){bg(t);const out=i4(P(t,2.75,3));ctx.save();ctx.translate(540,1000);ctx.scale(1+out*.5,1+out*.5);ctx.translate(-540,-1000);ctx.globalAlpha*=1-out;
  bate('4 ferramentas.',540,420,100,t,.1);bate('Nenhuma fala com a outra.',540,525,80,t,1.9,{col:C.laranja});
  const rh=lerp(0,720,o3(P(t,.2,1.6)));ctx.save();ctx.translate(540,640);ctx.rotate(-.02);ctx.beginPath();ctx.rect(-330,0,660,rh+30);ctx.clip();ctx.fillStyle=C.branco;ctx.shadowColor='rgba(10,10,10,.14)';ctx.shadowBlur=40;ctx.beginPath();ctx.moveTo(-300,0);ctx.lineTo(300,0);ctx.lineTo(300,rh);for(let x=300;x>=-300;x-=30)ctx.lineTo(x,rh+((x/30)%2?18:0));ctx.closePath();ctx.fill();ctx.shadowBlur=0;
   txt('FATURA DO CARTÃO',0,70,34,{w:700,f:'Roboto',col:'#9C9A91'});
   FAT.forEach(([n,v],i)=>{const y=150+i*105;const p=P(t,.45+i*.25,.7+i*.25);if(p<=0)return;ctx.globalAlpha=o3(p);icon(['agenda','aprova','grafico','dinheiro'][i],-240,y-12,.9,'#6B6960');txt(n,-195,y,40,{w:700,f:'Roboto',al:'left'});txt(brl(v),250,y,40,{w:700,f:'Roboto',al:'right'});ctx.globalAlpha=1});
   const tp=P(t,1.5,1.9);if(tp>0){ctx.strokeStyle='#DDD8CB';ctx.lineWidth=3;ctx.setLineDash([10,10]);ctx.beginPath();ctx.moveTo(-250,570);ctx.lineTo(250,570);ctx.stroke();ctx.setLineDash([]);txt('Total',-250,640,46,{al:'left'});txt(brl(194.60*o3(tp))+'/mês',250,640,46,{col:C.vermelho,al:'right'})}
   txt('valores ilustrativos',0,700,24,{w:500,f:'Roboto',col:'#B8B4A8',a:o3(P(t,1.9,2.1))});ctx.restore();
  ctx.restore()}
 // ===== 3 a 6.55 · AGITAR: nada conversa =====
 else if(t<7){bg(t);ctx.save();const cz=1+.05*P(t,3,6.6);ctx.translate(540,960);ctx.scale(cz,cz);ctx.translate(-540,-960);
  bate('Você paga 4 vezes',540,420,90,t,3.05);bate('e ainda copia e cola.',540,525,86,t,3.4,{col:C.laranja});
  const P4=[[300,800],[780,800],[780,1200],[300,1200]];
  P4.forEach(([x,y],i)=>{const e=back(P(t,3.1+i*.08,3.4+i*.08));if(e<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(e,e);box(-150,-80,300,160,32,C.branco);icon(['agenda','aprova','grafico','dinheiro'][i],-80,0,1.1,'#6B6960');txt(FAT[i][0],30,12,34,{w:700,f:'Roboto'});ctx.restore()});
  [[0,1],[1,2],[2,3],[3,0]].forEach(([a,b],k)=>{const p=o4(P(t,3.6+k*.15,3.9+k*.15));if(p<=0)return;const[x1,y1]=P4[a],[x2,y2]=P4[b];const mx=(x1+x2)/2,my=(y1+y2)/2;ctx.save();ctx.strokeStyle='#C9C4B6';ctx.lineWidth=8;ctx.setLineDash([16,16]);ctx.beginPath();ctx.moveTo(lerp(x1,mx,.35),lerp(y1,my,.35));ctx.lineTo(lerp(x1,mx,.35)+(mx-lerp(x1,mx,.35))*p*.8,lerp(y1,my,.35)+(my-lerp(y1,my,.35))*p*.8);ctx.stroke();ctx.restore();xmark(mx,my,.7,C.vermelho,P(t,4.3+k*.1,4.45+k*.1))});
  // o dado do cliente batendo e voltando
  if(t>4.8){const u=((t-4.8)*1.7)%1;const leg=Math.floor((t-4.8)*1.7)%4;const[x1,y1]=P4[leg],[x2,y2]=P4[(leg+1)%4];const go=u<.5?u*2:(1-u)*2;const x=lerp(x1,(x1+x2)/2,io3(go)*.85),y=lerp(y1,(y1+y2)/2,io3(go)*.85);ctx.save();ctx.globalAlpha=o3(P(t,4.8,5));pill('dados do cliente',x,y-60,{bg:C.amarelo,fg:C.ink,size:32,padX:24});ctx.restore()}
  const sp=P(t,5.3,5.5);if(sp>0){ctx.save();ctx.translate(540,1440);ctx.rotate(-.05);const s=lerp(2.4,1,i4(sp));ctx.scale(s,s);ctx.globalAlpha=o3(sp);pill('e nada se conecta.',0,0,{bg:C.vermelho,fg:C.branco,size:58,padX:46});ctx.restore()}
  ctx.restore();viradaCirculo(t,540,1000)}
 // ===== 7 a 9 · VIRADA =====
 else if(t<9){virada(t,'e se fosse','um lugar só?','rosa')}
 // ===== 9 a 18 · DEMO =====
 else if(t<18){bg(t);
  cap2(t,'Tudo conectado','#FFE3D6','Cada ferramenta vira','um módulo do CRIA.',9,12);
  cap2(t,'Preço','#D6E6FF','Conta grátis pra sempre.','Pague só o que usar.',12,15);
  cap2(t,'Cria Caixa','#D5F2E1','E ainda mostra quanto','sobra de cada cliente.',15,18);
  // cena 1: hub com módulos pulsando
  if(t<12.2){ctx.save();zt(t,9,12);const e=o4(P(t,9.1,9.8));const R=lerp(700,310,e);ctx.globalAlpha*=1;nos(t,540,960,R,(1-e)*1.2,t>9.8);hub(540,960,back(P(t,9.3,9.6)));
   ctx.restore()}
  // cena 2: preço modular
  if(t>11.8&&t<15.2){ctx.save();zt(t,12,15);if(card(110,590,860,660,{})){box(30,30,800,120,28,'#E3F6EA',false);txt('Conta de social mídia',60,82,36,{w:700,f:'Roboto',al:'left'});txt('grátis pra sempre',60,124,28,{w:500,f:'Roboto',al:'left',col:C.verde});txt('R$ 0',800,110,64,{col:C.verde,al:'right'});
    const ON=[12.9,null,13.5,null];MOD.forEach(([n,col,ic,v],i)=>{const y=180+i*96;const on=ON[i]&&t>ON[i];const tp=ON[i]?o4(P(t,ON[i],ON[i]+.2)):0;txt(n,60,y+56,36,{al:'left'});txt(brl(v)+'/mês',560,y+56,32,{w:500,f:'Roboto',col:'#6B6960',al:'right'});
     ctx.fillStyle=on?col:'#DDD8CB';rr(650,y+22,120,56,28);ctx.fill();ctx.fillStyle=C.branco;ctx.beginPath();ctx.arc(678+64*tp,y+50,22,0,7);ctx.fill()});
    const tot=t<12.9?0:t<13.5?19.90:44.80;const pp=punch(t,[12.95,13.55]);ctx.save();ctx.translate(430,610);ctx.scale(pp,pp);txt('Você paga: '+brl(tot)+'/mês',0,0,50,{col:C.laranja});ctx.restore();endCard()}
   ctx.restore()}
  // cena 3: rentabilidade por cliente
  if(t>14.8){ctx.save();zt(t,15,18.4);if(card(90,590,900,640,{})){txt('Rentabilidade por cliente',40,75,44,{al:'left'});txt('outubro',40,115,28,{w:500,f:'Roboto',col:'#6B6960',al:'left'});
    [['Café Aurora',1200,62,C.verde],['Studio Lume',900,48,C.verde],['Pet Mia',650,21,C.amarelo]].forEach(([n,v,m,col],i)=>{const y=160+i*150;const q=o4(P(t,15.4+i*.25,16.1+i*.25));txt(n,40,y+44,36,{al:'left'});txt(brl(v)+'/mês',860,y+44,30,{w:500,f:'Roboto',col:'#6B6960',al:'right'});ctx.fillStyle='#EEE9DC';rr(40,y+70,820,40,20);ctx.fill();ctx.fillStyle=col;rr(40,y+70,Math.max(40,820*m/100*q),40,20);ctx.fill();txt('sobra '+Math.round(m*q)+'%',40+Math.max(40,820*m/100*q)+14,y+100,28,{w:700,f:'Roboto',al:'left',col:m<30?'#B07A00':C.verde})});
    endCard()}
   const wp=back(P(t,16.8,17.1));if(wp>0){ctx.save();ctx.translate(540,1290);ctx.scale(wp,wp);pill('aqui sobra pouco',0,0,{bg:C.amarelo,fg:C.ink,size:36,padX:30});ctx.restore()}
   ctx.restore()}
  wipe(t,9,C.laranja,C.rosa);stickerSweep(t,12,['criatures-rosa','selo-club-verde','sticker-agenda']);stickerSweep(t,15,['criatures-azul','selo-club-amarelo','selo-ideia-post-rosa'],-1)}
 // ===== 18 a 20.6 · PROVA =====
 else if(t<20.6){bg(t);ctx.save();const pz0=1+.04*P(t,18,20.6);ctx.translate(540,960);ctx.scale(pz0,pz0);ctx.translate(-540,-960);
  const w1=back(P(t,18.15,18.4)),w2=back(P(t,18.4,18.65));if(w1>0){ctx.save();ctx.translate(540,410);ctx.scale(w1,w1);txt('Tudo conversando.',0,0,92,{});ctx.restore()}if(w2>0){ctx.save();ctx.translate(540,515);ctx.scale(w2,w2);txt('Num lugar só.',0,0,92,{col:C.laranja});ctx.restore()}
  nos(t,540,960,310,0,true);hub(540,960,1+.05*Math.sin(t*6));confete(t,18.05,540,960);chip('valores de fatura ilustrativos',540,1255,'#EEE9DC','#6B6960',o3(P(t,19.6,19.8)));ctx.restore();stickerSweep(t,18,['criatures-verde','selo-club-azul','sticker-coracao'])}
 // ===== 20.6 a 25 · CTA =====
 else ctaFinal(t,C.laranja,'Pague só o que usar.','Conta grátis pra sempre. Módulos a partir de R$ 19,90.',['sticker-agenda','sticker-lampada','sticker-coracao','selo-club-verde']);
 if(window.SAFE){ctx.fillStyle='rgba(224,52,43,.25)';ctx.fillRect(0,0,W,270);ctx.fillRect(0,1250,W,H-1250)}
 ctx.restore()}
function buildAudio(ac,out,T0=0){const S=criaSons(ac,out,T0);const fx=S.fx;S.trilha.grave(0,20.6);
 fx.impacto(.1);fx.papel(.2);[.45,.7,.95,1.2].forEach(b=>{fx.tecla(b);fx.moeda(b+.05)});fx.caixa(1.55);fx.contador(1.5,.4);fx.impacto(1.9);fx.whoosh(2.75,.3);
 fx.impacto(3.05);for(let i=0;i<4;i++)fx.popGrave(3.1+i*.08);for(let i=0;i<4;i++)fx.erro(4.3+i*.1);[5,5.6,6.2].forEach(b=>fx.boing(b));fx.carimbo(5.3);sfxVirada(fx,S);
 fx.subida(9.1,.7);fx.brilho(9.6);sfxSweep(fx,12);fx.toggle(12.9);fx.moeda(12.95);fx.toggle(13.5);fx.moeda(13.55);sfxSweep(fx,15);[15.4,15.65,15.9].forEach(b=>fx.subida(b,.6));fx.pop(16.8,700);
 sfxSweep(fx,18);fx.confete(18.05);fx.pop(18.15,700);fx.pop(18.4,900);sfxCta(fx,S)}
const ready=(async()=>{await carrega();render(0)})();window.render=render;window.buildAudio=buildAudio;window.ready=ready;
