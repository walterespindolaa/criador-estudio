// C4 · CRIADOR · "Tudo num app só" (montagem das funções)
window.AD={id:'c4-tudo-num-app-so',title:'C4 · Tudo num app só',desc:'Criador. Montagem: ideias, brandbook, plano, stories, métricas, bio, mídia kit, tendências. 25s, 9:16.',seed:41,
 texts:{
  gancho:TX(['#8 abas','pra fazer 1 post.'],{y:400,size:104,lh:112,start:0.05,stagger:0.12,out:2.9}),
  agita:TX(['Trocar de app','também ~cansa.'],{y:390,size:100,lh:112,start:3.05,stagger:0.1,out:6.75}),
  virada:TX(['E se fosse','~um ~lugar ~só?'],{y:430,size:104,lh:116,start:7.15,stagger:0.1,out:8.55}),
 },
 prova:{lines:['Da ideia ao resultado,','#num lugar só.']},provaSelo:'clubVerde',provaSeloW:300,
 lampHops:[11.5,14.8,17.9],shakes:[[3.4,10],[4.1,10],[4.8,10],[5.6,16]],scenes:[],cues:[]};
(function(){
 const TABS=[['Notas',C.amarelo],['Planilha de posts',C.verde],['Gerador de legenda',C.lilas],['Banco de imagens',C.rosa],['Agendador',C.azul],['Link da bio',C.laranja],['Mídia kit.pdf',C.vermelho],['Métricas',C.verde]];
 function navegador(t){
  if(t>7.2)return;const inS=spring(0,t,1.4,6);const crush=eIn(P(t,6.4,6.95));
  const s=lerp(0.85,1,Math.min(inS,1.04))*(1-crush*0.85);
  ctx.save();ctx.globalAlpha*=1-P(t,6.8,6.95);ctx.translate(0,40);ctx.translate(540,850);ctx.rotate(crush*0.6+(t>3&&t<6?Math.sin(t*40)*0.006:0));ctx.scale(s,s);ctx.translate(-540,-850);
  card(90,500,900,680,36,C.branco);ctx.fillStyle=C.papel;rr(90,500,900,110,36);ctx.fill();ctx.fillRect(90,560,900,50);
  const n=Math.min(8,1+Math.floor(P(t,0.1,2.3)*8));const tw=(860)/n;
  for(let i=0;i<n;i++){const x=110+i*tw;const act=i===n-1;ctx.fillStyle=act?C.branco:'rgba(10,10,10,0.06)';rr(x,530,tw-6,80,16);ctx.fill();ctx.fillStyle=TABS[i][1];circle(x+22,570,9);ctx.save();ctx.beginPath();ctx.rect(x+38,540,tw-54,60);ctx.clip();label(TABS[i][0],x+40,580,26,{w:500});ctx.restore()}
  const cur=TABS[n-1][1];ctx.fillStyle=hexA(cur,0.18);rr(130,650,820,490,24);ctx.fill();for(let k=0;k<4;k++){ctx.fillStyle=hexA(cur,0.45);rr(170,700+k*100,k%2?520:680,40,20);ctx.fill()}
  const b=spring(0.4,t,1.6,6);if(b>0){ctx.save();ctx.translate(930,520);ctx.scale(b,b);ctx.fillStyle=C.vermelho;circle(0,0,40);label(String(n),0,14,40,{w:800,fam:'"Baloo 2"',color:C.branco,align:'center'});ctx.restore()}
  [['Esqueceu a senha?','Digite seu e-mail para recuperar',3.4,700],['Seu teste grátis acabou','Assine para continuar',4.1,830],['Sessão expirada','Faça login de novo',4.8,960]].forEach(([a,b2,t0,y],i)=>{const e=enter(t,t0,0.35);if(!e.on)return;withT(e,540,y,()=>{card(190+i*20,y-70,700,150,28,C.branco);xmark(260+i*20,y+4,34,1);label(a,315+i*20,y-4,38,{w:800,fam:'"Baloo 2"'});label(b2,315+i*20,y+38,28,{w:400,color:'rgba(10,10,10,0.6)'})})});
  ctx.restore();
  stamp('CANSEI',540,900,t,5.6,C.vermelho,110,-0.12);
  // ícones das abas sendo sugados pela lâmpada
  if(t>7.0&&t<8.7){TABS.forEach(([s2,c],i)=>{const p=eIn(P(t,7.15+i*0.08,8.2+i*0.05));if(p>=1)return;const a=i/8*Math.PI*2;const r=lerp(430,0,p);ctx.save();ctx.globalAlpha*=1-p*0.6;ctx.translate(540+Math.cos(a+p*3)*r,1080+Math.sin(a+p*3)*r);ctx.rotate(p*4);ctx.fillStyle=c;rr(-40,-40,80,80,22);ctx.fill();ctx.restore()})}
 }
 const MODS=[['Ideias',C.amarelo],['Brandbook',C.laranja],['Cria Plano',C.rosa],['Stories',C.lilas],['Métricas',C.verde],['Link na bio',C.azul],['Mídia kit',C.laranja],['Tendências',C.rosa]];
 const M0=9.35,MD=1.05;
 function preview(i,x,y,w,h,t,t0){const c=MODS[i][1];const p=eOut(P(t,t0,t0+0.5));
  if(i===0){['3 erros de quem tá começando','bastidor da semana','antes e depois do perfil','minha rotina real'].forEach((s,k)=>{const e=P(t,t0+k*0.12,t0+0.3+k*0.12);ctx.save();ctx.globalAlpha*=eOut(e);ctx.fillStyle=C.papel;rr(x,y+k*92,w,76,20);ctx.fill();ctx.fillStyle=c;circle(x+34,y+k*92+38,10);label(s,x+60,y+k*92+48,28,{w:500});ctx.restore()})}
  if(i===1){label('Tom: leve, direto',x,y+40,32,{w:700});[C.laranja,C.amarelo,C.rosa,C.azul,C.ink].forEach((cc,k)=>{ctx.fillStyle=cc;circle(x+40+k*90,y+120,34*eBack(P(t,t0+k*0.08,t0+0.4+k*0.08)))});label('Nunca: "jornada"',x,y+220,32,{w:700,color:C.vermelho})}
  if(i===2){for(let k=0;k<28;k++){const e=P(t,t0+k*0.02,t0+0.2+k*0.02);ctx.fillStyle=k%3?C.papel:hexA([C.rosa,C.amarelo,C.azul][k%3===0?(k/3)%3:0],0.9);if(k%3===0)ctx.fillStyle=[C.rosa,C.amarelo,C.azul][Math.floor(k/3)%3];ctx.save();ctx.globalAlpha*=eOut(e);rr(x+(k%7)*(w/7)+3,y+Math.floor(k/7)*84,w/7-6,74,12);ctx.fill();ctx.restore()}}
  if(i===3){for(let k=0;k<5;k++){const e=eBack(P(t,t0+k*0.08,t0+0.4+k*0.08));ctx.save();ctx.translate(x+44+k*(w/5),y+170);ctx.scale(e,e);ctx.fillStyle=C.ink;rr(-38,-150,76,300,16);ctx.fill();ctx.fillStyle=[C.amarelo,C.rosa,C.azul,C.verde,C.laranja][k];rr(-30,-130,60,260,12);ctx.fill();ctx.restore()}}
  if(i===4){ctx.strokeStyle=c;ctx.lineWidth=10;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();const pts=[0.2,0.35,0.3,0.55,0.5,0.75,0.9];pts.forEach((v,k)=>{const px=x+k*(w/6),py=y+320-v*280;if(k/6<=p)k?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.stroke();label('+32% alcance',x,y+30,40,{w:800,fam:'"Baloo 2"',color:C.verde,alpha:p})}
  if(i===5){avatar(x+w/2,y+50,46,C.amarelo,'D');['Mídia kit','Último vídeo','Publis'].forEach((s,k)=>{const e=eBack(P(t,t0+k*0.1,t0+0.4+k*0.1));ctx.save();ctx.translate(x+w/2,y+150+k*80);ctx.scale(e,e);ctx.fillStyle=[C.laranja,C.ink,C.amarelo][k];rr(-w/2+30,-30,w-60,60,30);ctx.fill();label(s,0,10,28,{w:800,fam:'"Baloo 2"',color:k===2?C.ink:C.creme,align:'center'});ctx.restore()})}
  if(i===6){[['18,4 mil','seguidores'],['4,8%','engajamento'],['212 mil','alcance/mês']].forEach(([v,k2],k)=>{const e=eOut(P(t,t0+k*0.1,t0+0.4+k*0.1));ctx.save();ctx.globalAlpha*=e;ctx.fillStyle=C.papel;rr(x,y+k*110,w,94,20);ctx.fill();label(v,x+30,y+k*110+62,44,{w:800,fam:'"Baloo 2"'});label(k2,x+w-30,y+k*110+58,28,{w:500,color:'rgba(10,10,10,0.5)',align:'right'});ctx.restore()})}
  if(i===7){['#bastidores','trend do áudio X','carrossel antes e depois','pergunta no gancho'].forEach((s,k)=>{const e=eBack(P(t,t0+k*0.1,t0+0.4+k*0.1));ctx.save();ctx.translate(x,y+40+k*84);ctx.scale(e,e);ctx.font=F(700,30,'Roboto');const tw=ctx.measureText(s).width+60;ctx.fillStyle=hexA(C.laranja,0.14);rr(0,-34,tw,68,34);ctx.fill();label(s,30,10,30,{w:700,color:C.laranja});ctx.restore()});label('em alta no seu nicho',x,y+400,30,{w:700,color:'rgba(10,10,10,0.5)',alpha:p})}
 }
 function app(t){
  if(t<T.DROP-0.05||t>19.2)return;const inS=spring(T.DROP-0.05,t,1.3,6);const out=eIn(P(t,18.8,19.1));const s=lerp(0.7,1,Math.min(inS,1.03))*(1-out*0.2);
  ctx.save();ctx.globalAlpha*=clamp(inS*2)*(1-out);ctx.translate(540,850);ctx.scale(s,s);ctx.translate(-540,-850);
  card(90,470,900,760,44,C.branco);ctx.fillStyle=C.papel;rr(90,470,300,760,44);ctx.fill();ctx.fillRect(340,470,50,760);
  drawImg(IMG.logoInk,240,530,170);
  const act=Math.max(0,Math.min(7,Math.floor((t-M0)/MD)));
  MODS.forEach(([n,c],i)=>{const y=610+i*74;const on=t>=M0+i*MD;const isAct=i===act&&t>=M0;if(isAct){ctx.fillStyle=C.branco;rr(106,y-30,268,62,31);ctx.fill()}ctx.fillStyle=on?c:'rgba(10,10,10,0.15)';circle(136,y,12);label(n,160,y+11,30,{w:isAct?800:500,fam:isAct?'"Baloo 2"':'Roboto',color:on?C.ink:'rgba(10,10,10,0.35)'});if(on&&!isAct)check(355,y,13,spring(M0+i*MD+MD,t,1.6,6))});
  if(t>=M0){const t0=M0+act*MD;const e=P(t,t0,t0+0.3);ctx.save();ctx.globalAlpha*=eOut(e);ctx.translate((1-eOut(e))*40,0);label(MODS[act][0],430,560,48,{w:800,fam:'"Baloo 2"'});ctx.fillStyle=MODS[act][1];rr(430,580,80,8,4);ctx.fill();preview(act,430,640,520,560,t,t0);ctx.restore()}
  ctx.restore();
  notif(540,1080,760,t,17.95,'Cria · hora de postar','Seu Reels das 18h está pronto pra sair',C.laranja,'C',18.8);
 }
 AD.scenes=[navegador,app,t=>stepChip(t,T.DROP+0.1,18.8,'Um app só',C.verde,C.ink,'tudo conversa')];
 const q=AD.cues;for(let i=1;i<8;i++)q.push([0.1+i*(2.2/8),'pop',500+i*50]);[3.4,4.1,4.8].forEach(x=>q.push([x,'error']));q.push([5.6,'stamp']);q.push([6.4,'whoosh',0.5]);
 for(let i=0;i<8;i++){q.push([M0+i*MD,'pop',560+i*60]);if(i)q.push([M0+i*MD,'keysoft'])}q.push([13.55,'ding',1318.5]);q.push([17.95,'notif']);q.push([18.8,'whoosh',0.4]);
})();
