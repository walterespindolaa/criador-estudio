// S1 · "1 cliente. 6 lugares." · organização + integração · PAS + demo
const TITLE='S1 · 1 cliente, 6 lugares';
const DESC='Social mídia com o cliente espalhado em várias ferramentas. No CRIA vira uma ficha só: brandbook, roteiro, aprovação por link, calendário e relatório conectados. Telas redesenhadas a partir do app (exemplo ilustrativo).';

// ---------- helpers ----------
const fmt=n=>Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
function wrap(s,maxW,size,w=500,f='Roboto'){ctx.font=F(w,size,f);const ws=s.split(' ');const out=[];let ln='';ws.forEach(x=>{const tt=ln?ln+' '+x:x;if(ctx.measureText(tt).width>maxW&&ln){out.push(ln);ln=x}else ln=tt});if(ln)out.push(ln);return out}
function para(s,x,y,maxW,size,lh,o={}){const{w=500,f='Roboto',col=C.ink,a=1,al='left',upto=1e9}=o;if(a<=0)return;const L=wrap(s,maxW,size,w,f);let left=upto;ctx.save();ctx.globalAlpha*=a;ctx.font=F(w,size,f);ctx.fillStyle=col;ctx.textAlign=al;L.forEach((ln,i)=>{if(left<=0)return;ctx.fillText(ln.slice(0,Math.max(0,left)),x,y+i*lh);left-=ln.length+1});ctx.restore();return L}
function check(x,y,r,col,p=1){if(p<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(back(p),back(p));ctx.fillStyle=col;ctx.beginPath();ctx.arc(0,0,r,0,7);ctx.fill();ctx.strokeStyle=C.branco;ctx.lineWidth=r*.22;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();ctx.moveTo(-r*.42,0);ctx.lineTo(-r*.1,r*.32);ctx.lineTo(r*.45,-r*.3);ctx.stroke();ctx.restore()}
function card(x,y,w,h,o={}){const{a=1,sc=1,rot=0,fill=C.branco,r=36}=o;if(a<=0||sc<=0)return false;ctx.save();ctx.globalAlpha*=a;ctx.translate(x+w/2,y+h/2);ctx.rotate(rot);ctx.scale(sc,sc);ctx.transform(1,Math.sin(TT*1.1+x*.013)*.012,Math.sin(TT*1.3+y*.01)*.02,1,0,0);ctx.translate(-w/2,-h/2);box(0,0,w,h,r,fill);return true}
function endCard(){ctx.restore()}
function badge(x,y,n,p){if(p<=0)return;ctx.save();ctx.translate(x,y);ctx.scale(back(p),back(p));ctx.fillStyle=C.vermelho;ctx.beginPath();ctx.arc(0,0,30,0,7);ctx.fill();txt(String(n),0,12,36,{col:C.branco});ctx.restore()}
// ícones genéricos (nenhuma marca de terceiros)
function icon(k,x,y,s,col){ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';
 if(k==='planilha'){rr(-22,-22,44,44,6);ctx.stroke();ctx.beginPath();ctx.moveTo(-22,-7);ctx.lineTo(22,-7);ctx.moveTo(-22,8);ctx.lineTo(22,8);ctx.moveTo(-7,-22);ctx.lineTo(-7,22);ctx.stroke()}
 else if(k==='conversa'){rr(-24,-20,48,32,12);ctx.stroke();ctx.beginPath();ctx.moveTo(-8,12);ctx.lineTo(-14,24);ctx.lineTo(4,12);ctx.stroke();[-10,0,10].forEach(d=>{ctx.beginPath();ctx.arc(d,-4,3,0,7);ctx.fill()})}
 else if(k==='arte'){ctx.beginPath();ctx.arc(0,0,22,0,7);ctx.stroke();[[-8,-8],[8,-9],[11,5]].forEach(([a,b])=>{ctx.beginPath();ctx.arc(a,b,4,0,7);ctx.fill()})}
 else if(k==='notas'){rr(-18,-24,36,48,5);ctx.stroke();[-10,0,10].forEach(d=>{ctx.beginPath();ctx.moveTo(-10,d);ctx.lineTo(10,d);ctx.stroke()})}
 else if(k==='tarefas'){[-16,0,16].forEach((d,i)=>{rr(d-6,-22,12,[40,28,34][i],4);ctx.stroke()})}
 else if(k==='aprova'){ctx.beginPath();ctx.arc(0,0,22,0,7);ctx.stroke();ctx.beginPath();ctx.moveTo(-10,0);ctx.lineTo(-3,8);ctx.lineTo(11,-8);ctx.stroke()}
 ctx.restore()}
const APPS=[['planilha','Planilha',C.verde],['conversa','Mensagens',C.azul],['arte','Arte',C.rosa],['notas','Anotações',C.amarelo],['tarefas','Tarefas',C.lilas],['aprova','Aprovação',C.laranja]];
function janela(i,cx,cy,w,o={}){const{sc=1,rot=0,a=1,n=0,bp=0}=o;if(sc<=0||a<=0)return;const[k,lb,col]=APPS[i];const h=w*.72;ctx.save();ctx.globalAlpha*=a;ctx.translate(cx,cy);ctx.rotate(rot);ctx.scale(sc,sc);
 box(-w/2,-h/2,w,h,26,C.branco);ctx.save();rr(-w/2,-h/2,w,h,26);ctx.clip();ctx.fillStyle=col;ctx.fillRect(-w/2,-h/2,w,70);ctx.restore();
 [0,1,2].forEach(j=>{ctx.fillStyle='rgba(253,251,245,.7)';ctx.beginPath();ctx.arc(-w/2+30+j*24,-h/2+35,7,0,7);ctx.fill()});
 icon(k,-w/2+52,-h/2+130,1.2,col);txt(lb,-w/2+95,-h/2+145,42,{al:'left'});
 for(let j=0;j<3;j++){ctx.fillStyle='#EEE9DC';rr(-w/2+30,-h/2+185+j*36,w-60-(j===2?90:0),18,9);ctx.fill()}
 badge(w/2-10,-h/2+10,n,bp);ctx.restore()}
const POS=[[260,810,-.1],[800,770,.08],[300,1170,.06],[810,1140,-.07],[540,980,.02],[560,1330,-.04]];

SHAKES=[[.05,14],[.6,18],[3.2,6],[3.6,6],[4.0,6],[4.4,6],[4.8,6],[6.5,16],[7.0,22],[18,18],[20.6,18]];

function render(t){TT=t;ctx.save();ctx.clearRect(0,0,W,H);const[sx,sy]=shake(t);ctx.translate(sx,sy);
 // ===== 0 a 3 · GANCHO + 3 a 7 AGITAR (mesmo palco) =====
 if(t<7){bg(t);ctx.save();const cz=lerp(1.25,1,o4(P(t,0,.8)))*(1+.06*P(t,1,6.5));ctx.translate(540,960);ctx.scale(cz,cz);ctx.rotate(lerp(-.05,0,o4(P(t,0,.8))));ctx.translate(-540,-960);const conv=io3(P(t,6.05,6.55));
  const jit=t>3?1:0;
  APPS.forEach((_,i)=>{const t0=.05+i*.11;const p=P(t,t0,t0+.35);if(p<=0)return;const[x,y,r]=POS[i];const fromX=[-500,1600,-500,1600,540,540][i],fromY=[400,300,1500,1500,-400,2300][i];const e=o4(p);
   const jx=jit*Math.sin(t*23+i*2)*6,jy=jit*Math.cos(t*19+i)*6;const n=Math.max(1,Math.floor(lerp(1,[7,23,4,9,12,5][i],o3(P(t,1.3,3.2)))));
   const X=lerp(lerp(fromX,x,e)+jx,540,conv),Y=lerp(lerp(fromY,y,e)+jy,960,conv);const dr=()=>janela(i,X,Y,400,{sc:lerp(.6,1,e)*(1-conv*.75),rot:(r+(1-e)*.6)*(1-conv)+conv*(i-2.5)*.3,n,bp:P(t,1.2+i*.08,1.45+i*.08)});if(p<1)ghost(dr,(fromX-x)*(1-e)*.25,4);else dr()});
  // título
  const pz=punch(t,[.05,.6]);ctx.save();ctx.translate(540,420);ctx.scale(pz,pz);ctx.translate(-540,-420);
  if(t<3.05){const a1=P(t,.05,.2),a2=P(t,.55,.72);if(a1>0){ctx.save();ctx.translate(540,400);const s=lerp(2,1,o4(a1));ctx.scale(s,s);txt('1 cliente.',0,0,130,{a:o3(a1)});ctx.restore()}if(a2>0){ctx.save();ctx.translate(540,540);const s=lerp(2.4,1,o4(a2));ctx.scale(s,s);txt('6 lugares.',0,0,140,{col:C.laranja,a:o3(a2)});ctx.restore()}}
  ctx.restore();
  // agitar: mensagens + copia e cola
  if(t>3){const MS=[['cadê a arte?',3.2,300,560,-.05],['aprovou?',3.6,790,520,.06],['manda o relatório',4.0,330,1450,.04],['qual era o briefing?',4.4,760,1400,-.05],['quanto ele paga mesmo?',4.8,560,1010,.03]];
   MS.forEach(([s,t0,x,y,r])=>{const p=P(t,t0,t0+.25);if(p<=0)return;ctx.save();ctx.translate(x,y);ctx.rotate(r);ctx.scale(back(p),back(p));ctx.font=F(800,44);const w=ctx.measureText(s).width+60;box(-w/2,-45,w,90,45,C.ink);ctx.beginPath();ctx.moveTo(-w/2+40,40);ctx.lineTo(-w/2+30,70);ctx.lineTo(-w/2+70,40);ctx.fillStyle=C.ink;ctx.fill();txt(s,0,15,44,{col:C.creme});ctx.restore()});
   const cpA=o3(P(t,5.2,5.4));if(cpA>0){const u=((t-5.2)*1.6)%1;const leg=Math.floor((t-5.2)*1.6)%3;const A=POS[[0,4,1][leg]],B=POS[[4,1,3][leg]];const x=lerp(A[0],B[0],io3(u)),y=lerp(A[1],B[1],io3(u))-Math.sin(u*Math.PI)*200;ctx.save();ctx.globalAlpha=cpA;pill('Ctrl C · Ctrl V',x,y,{bg:C.amarelo,fg:C.ink,size:40,padX:30});ctx.restore()}
   const f1=o4(P(t,5.4,5.7)),f2=o4(P(t,5.7,6));if(f1>0){box(90,300-(1-f1)*40,900,220,40,hexA(C.creme,.92*f1),false);txt('E você no meio,',540,390-(1-f1)*40,84,{a:f1});txt('copiando e colando.',540,480-(1-f2)*40,84,{col:C.laranja,a:f2})}}
  ctx.restore();viradaCirculo(t,540,960)}
 // ===== 7 a 9 · VIRADA =====
 else if(t<9){virada(t,'e se tudo','conversasse?')}
 // ===== 9 a 18 · DEMO =====
 else if(t<18){bg(t);
  const cap=(chipS,chipC,s1,s2,t0,t1)=>{if(t<t0||t>=t1)return;const a=o3(P(t,t0,t0+.2));const d1=o4(P(t,t0,t0+.3)),d2=o4(P(t,t0+.12,t0+.42));chip(chipS,540,300,chipC,C.ink,a);txt(s1,540+(1-d1)*-200,410,72,{a:d1});txt(s2,540+(1-d2)*200,490,72,{col:C.laranja,a:d2})};
  const dxOf=(t0,t1)=>(1-o4(P(t,t0-.05,t0+.35)))*900-o4(P(t,t1-.12,t1+.05))*900;
  cap2(t,'Cliente 360','#FFE3D6','Cada cliente','numa ficha só.',9,12);
  cap2(t,'Cria Post','#D6E6FF','Do brandbook ao post,','sem copiar e colar.',12,15);
  cap2(t,'Aprovação por link','#D5F2E1','O cliente aprova no celular','e cai no calendário.',15,18);
  // --- cena 1: ficha do cliente
  if(t<12.15){const dx=0;ctx.save();zt(t,9,12);ctx.translate(0,Math.sin(t*2)*6);
   if(card(110,590,860,680,{sc:back(P(t,9,9.35))})){ctx.fillStyle='#C7663F';ctx.beginPath();ctx.arc(95,95,55,0,7);ctx.fill();txt('CA',95,112,48,{col:C.branco});txt('Café Aurora',175,95,56,{al:'left'});
    txt('R$ 1.200/mês · renova em 15/11',175,145,30,{w:500,f:'Roboto',col:'#6B6960',al:'left'});const hp=back(P(t,11.1,11.4));if(hp>0){ctx.save();ctx.translate(760,85);ctx.scale(hp,hp);box(-60,-24,120,48,24,'#E3F6EA',false);ctx.fillStyle=C.verde;ctx.beginPath();ctx.arc(-34,0,9,0,7);ctx.fill();txt('em dia',8,11,30,{col:C.verde});ctx.restore()}
    const TABS=['Brandbook','Ideias','Posts','Aprovação','Caixa','Relatório'];
    TABS.forEach((lb,i)=>{const r=Math.floor(i/2),c=i%2;const t0=9.45+i*.18;const p=P(t,t0,t0+.35);if(p<=0)return;const tx=50+c*390,ty=210+r*145;const e=o4(p);const[x0,y0]=[POS[i][0]-110-dx,POS[i][1]-590];
     ctx.save();ctx.translate(lerp(x0,tx+185,e),lerp(y0,ty+60,e));ctx.rotate((1-e)*POS[i][2]*3);ctx.scale(lerp(1.4,1,e),lerp(1.4,1,e));box(-185,-60,370,120,26,'#F3EFE3',false);icon(APPS[i][0],-120,0,1.1,APPS[i][2]);txt(lb,-75,14,40,{al:'left'});ctx.restore()});
    endCard()}ctx.restore()}
  // --- cena 2: brandbook -> roteiro -> kanban
  if(t>11.85&&t<15.15){ctx.save();zt(t,12,15);
   if(card(90,590,420,330,{sc:back(P(t,12.05,12.4))})){txt('Brandbook',36,70,44,{al:'left'});txt('Café Aurora',36,112,30,{w:500,f:'Roboto',col:'#6B6960',al:'left'});[['tom: acolhedor',C.amarelo],['pilar: receitas',C.rosa],['pilar: bastidor',C.lilas]].forEach(([s,col],i)=>{const p=back(P(t,12.3+i*.12,12.6+i*.12));if(p<=0)return;ctx.save();ctx.translate(36,150+i*56);ctx.scale(p,p);ctx.font=F(800,30);const w=ctx.measureText(s).width+36;box(0,0,w,46,23,hexA(col,.5),false);txt(s,w/2,33,30,{});ctx.restore()});endCard()}
   // seta
   const ap=o4(P(t,12.7,13.1));if(ap>0){ctx.save();ctx.strokeStyle=C.laranja;ctx.lineWidth=10;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(520,750);ctx.lineTo(520+50*ap,750);ctx.stroke();if(ap>.9){ctx.beginPath();ctx.moveTo(555,730);ctx.lineTo(575,750);ctx.lineTo(555,770);ctx.stroke()}ctx.restore()}
   if(card(590,590,400,330,{sc:back(P(t,12.9,13.25))})){txt('Roteiro',32,70,44,{al:'left'});txt('no tom do cliente',32,112,30,{w:500,f:'Roboto',col:C.laranja,al:'left'});const S='Cena 1: o pão saindo do forno. "Aqui a manhã começa com cheiro de casa..."';para(S,32,165,340,28,38,{upto:Math.floor(S.length*P(t,13.2,14.1))});endCard()}
   // kanban
   if(card(90,960,900,300,{sc:back(P(t,13.5,13.85)),fill:'#F3EFE3'})){['Produção','Aguardando','Aprovado'].forEach((lb,i)=>{txt(lb,40+i*290,60,32,{al:'left',col:'#4A4840'});ctx.fillStyle='rgba(10,10,10,.06)';rr(30+i*290,85,270,180,20);ctx.fill()});
    const mv=io3(P(t,14.2,14.7));const x=lerp(45,335,mv),y=110;ctx.save();ctx.translate(x+120,y+65);ctx.rotate(Math.sin(mv*Math.PI)*.08);box(-120,-65,240,130,18,C.branco);ctx.fillStyle=hexA(C.laranja,.8);rr(-100,-45,70,70,12);ctx.fill();txt('Reels',-15,-12,30,{al:'left'});txt('pão da manhã',-15,24,24,{w:500,f:'Roboto',al:'left',col:'#6B6960'});ctx.restore();endCard()}
   ctx.restore()}
  // --- cena 3: aprovação no celular do cliente + calendário
  if(t>14.85){ctx.save();zt(t,15,18.4);
   // celular do cliente
   const pe=back(P(t,15,15.35));ctx.save();ctx.translate(330,960+Math.sin(t*2)*6);ctx.rotate(-.03);ctx.scale(pe,pe);box(-230,-400,460,800,56,C.ink);ctx.save();rr(-216,-386,432,772,44);ctx.clip();ctx.fillStyle=C.branco;ctx.fillRect(-216,-386,432,772);
    ctx.fillStyle='#C7663F';ctx.fillRect(-216,-386,432,150);ctx.fillStyle=C.branco;ctx.beginPath();ctx.arc(-150,-311,34,0,7);ctx.fill();txt('CA',-150,-299,30,{col:'#C7663F'});txt('Café Aurora',-100,-306,34,{al:'left',col:C.branco});txt('Aprove seus posts',-100,-270,22,{w:500,f:'Roboto',al:'left',col:C.branco});
    const ok=t>16.25;const nA=ok?6:5;txt(`${nA} de 8 aprovados`,-190,-190,26,{w:700,f:'Roboto',al:'left'});ctx.fillStyle='#EEE9DC';rr(-190,-172,380,16,8);ctx.fill();ctx.fillStyle=C.verde;rr(-190,-172,380*lerp(5/8,6/8,o4(P(t,16.25,16.6))),16,8);ctx.fill();
    ctx.fillStyle=hexA(C.laranja,.75);rr(-190,-135,380,300,20);ctx.fill();ctx.fillStyle='rgba(253,251,245,.6)';ctx.beginPath();ctx.arc(80,-60,50,0,7);ctx.fill();txt('Reels · pão da manhã',-190,210,26,{w:700,f:'Roboto',al:'left'});
    box(-190,250,175,76,38,'#F3EFE3',false);txt('Pedir ajuste',-102,297,24,{w:700,f:'Roboto'});const ap=ok?o3(P(t,16.25,16.4)):0;box(-5,250,195,76,38,ok?C.verde:C.ink,false);txt(ok?'Aprovado ✓':'Aprovar',92,297,26,{w:700,f:'Roboto',col:C.branco});
    ctx.restore();ctx.restore();
   const pr=t>16.0&&t<16.25?Math.sin(P(t,16.0,16.25)*Math.PI):0;if(t>15.5&&t<16.7)cursor(lerp(560,420,o4(P(t,15.5,15.95))),lerp(1500,1245,o4(P(t,15.5,15.95))),pr,o3(P(t,15.5,15.65))*(1-P(t,16.5,16.7)));
   // calendário
   if(card(600,660,400,520,{sc:back(P(t,15.2,15.55))})){txt('Novembro',30,64,40,{al:'left'});const D=['S','T','Q','Q','S','S','D'];D.forEach((d,i)=>txt(d,42+i*50,112,24,{w:700,f:'Roboto',col:'#9C9A91'}));
    for(let r=0;r<5;r++)for(let c=0;c<7;c++){const n=r*7+c+1;if(n>30)continue;const x=20+c*50,y=130+r*72;const isT=n===18;const has=[4,7,11,14,21,25].includes(n);ctx.fillStyle=isT&&t>16.9?hexA(C.verde,.22):'rgba(10,10,10,.04)';rr(x,y,44,62,10);ctx.fill();txt(String(n),x+22,y+28,22,{w:500,f:'Roboto',col:'#6B6960'});if(has){ctx.fillStyle=C.lilas;ctx.beginPath();ctx.arc(x+22,y+46,6,0,7);ctx.fill()}}
    // post voando pro dia 18
    const fp=P(t,16.45,16.95);if(fp>0){const e=io3(fp);const tx=20+3*50+22,ty=130+2*72+46;const x=lerp(-270,tx,e),y=lerp(300,ty,e)-Math.sin(e*Math.PI)*160;ctx.save();ctx.translate(x,y);const s=lerp(1.6,1,e);ctx.scale(s,s);ctx.fillStyle=C.laranja;ctx.beginPath();ctx.arc(0,0,e>=1?9:16,0,7);ctx.fill();ctx.restore()}
    if(t>16.95){const p=back(P(t,16.95,17.25));ctx.save();ctx.translate(200,480);ctx.scale(p,p);box(-150,-30,300,60,30,C.verde,false);txt('18/11 · 19h',0,11,30,{col:C.branco});ctx.restore()}
    endCard()}
   ctx.restore()}wipe(t,9,C.laranja,C.rosa);wipe(t,12,C.azul,C.amarelo);wipe(t,15,C.verde,C.rosa)}
 // ===== 18 a 20.6 · PROVA: relatório =====
 else if(t<20.6){bg(t);ctx.save();const pz0=1+.04*P(t,18,20.6);ctx.translate(540,960);ctx.scale(pz0,pz0);ctx.translate(-540,-960);const w1=back(P(t,18.1,18.35)),w2=back(P(t,18.35,18.6));if(w1>0){ctx.save();ctx.translate(540,410);ctx.scale(w1,w1);txt('E o relatório do mês',0,0,82,{});ctx.restore()}if(w2>0){ctx.save();ctx.translate(540,505);ctx.scale(w2,w2);txt('se monta sozinho.',0,0,82,{col:C.laranja});ctx.restore()}
  const e=P(t,18,18.3);if(card(120,600,840,640,{sc:lerp(1.5,1,o4(e)),a:o3(e),rot:lerp(.06,-.015,o4(e))})){ctx.fillStyle=C.ink;ctx.beginPath();ctx.arc(80,80,40,0,7);ctx.fill();txt('GS',80,93,32,{col:C.amarelo});ctx.fillStyle='#C7663F';ctx.beginPath();ctx.arc(160,80,40,0,7);ctx.fill();txt('CA',160,93,32,{col:C.branco});
   txt('Relatório de Entregas',225,78,44,{al:'left'});txt('Café Aurora · outubro',225,118,30,{w:500,f:'Roboto',col:'#6B6960',al:'left'});
   [['Posts entregues',12,''],['Alcance',41800,'mil'],['Seguidores','+380','']].forEach(([lb,v,u],i)=>{const q=o3(P(t,18.4+i*.15,19.3+i*.15));const x=40+i*262;box(x,170,242,170,24,'#F3EFE3',false);txt(lb,x+22,212,24,{w:500,f:'Roboto',col:'#6B6960',al:'left'});const s=typeof v==='number'?(u?(v*q/1000).toFixed(1).replace('.',',')+' mil':fmt(v*q)):v;txt(s,x+22,295,u?52:62,{al:'left',a:typeof v==='number'?1:q})});
   txt('Alcance por semana',40,400,30,{w:700,f:'Roboto',al:'left'});[.45,.7,.55,1].forEach((v,i)=>{const q=o4(P(t,18.8+i*.1,19.4+i*.1));ctx.fillStyle=i===3?C.laranja:C.lilas;rr(60+i*190,590-170*v*q,120,170*v*q,14);ctx.fill()});
   endCard()}
  chip('exemplo ilustrativo',540,1285,'#EEE9DC','#6B6960',o3(P(t,19.6,19.8)));
  for(let i=0;i<24;i++){const a=i/24*Math.PI*2,d=o4(P(t,18.05,18.8))*(420+(i%5)*60),al=1-P(t,18.5,19.3);if(al>0){ctx.fillStyle=[C.amarelo,C.rosa,C.azul,C.verde][i%4];ctx.globalAlpha=al;ctx.fillRect(540+Math.cos(a)*d-10,920+Math.sin(a)*d*.8-10,20,20);ctx.globalAlpha=1}}ctx.restore();wipe(t,18,C.laranja,C.amarelo)}
 // ===== 20.6 a 25 · CTA =====
 else{const w=o4(P(t,20.6,20.95));ctx.fillStyle=C.creme;ctx.fillRect(-40,-40,W+80,H+80);ctx.fillStyle=C.azul;ctx.beginPath();ctx.arc(540,960,lerp(0,1500,w),0,7);ctx.fill();
  const g=ctx.createRadialGradient(880,400,0,880,400,700);g.addColorStop(0,hexA(C.lilas,.45*w));g.addColorStop(1,hexA(C.lilas,0));ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  ['sticker-agenda','sticker-lampada','sticker-coracao','selo-club-amarelo'].forEach((n,i)=>adesivo(n,[150,930,140,940][i],[250,250,1500,1500][i],[180,170,160,190][i],t,21.3+i*.25,[.2,-.15,.15,-.2][i]));
  if(t>20.85)logoFatias('amarelo',540,540,800,i=>{const ph=((t-20.85-i*.1)%.5+.5)%.5/.5;const up=Math.sin(Math.min(1,ph/.5)*Math.PI);const e=o4(P(t,20.85,21.2));return{dy:-up*40+(1-e)*160,rot:(i%2?1:-1)*up*.07,sc:lerp(.6,1,e)}});
  const a1=back(P(t,21.3,21.55));if(a1>0){ctx.save();ctx.translate(540,950);ctx.scale(a1,a1);txt('Seu cliente inteiro num lugar.',0,0,70,{col:C.branco});ctx.restore()}
  const cp=back(P(t,21.8,22.1));const beat=Math.exp(-((t-22)%.5)*8)*(t>22.2?1:0);pill('Criar conta grátis',540,1100,{bg:C.amarelo,fg:C.ink,size:68,padX:60,sc:cp*(1+.05*beat),a:o3(P(t,21.8,21.95))});
  if(t>22.3){const ay=1195+Math.sin((t-22.3)*Math.PI*4)*12;ctx.save();ctx.globalAlpha=o3(P(t,22.3,22.5));ctx.strokeStyle=C.amarelo;ctx.lineWidth=12;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(540,ay+80);ctx.lineTo(540,ay);ctx.moveTo(505,ay+35);ctx.lineTo(540,ay);ctx.lineTo(575,ay+35);ctx.stroke();ctx.restore()}
  txt('Conta grátis pra sempre. Pague só o módulo que usar.',540,1320,36,{w:500,f:'Roboto',col:C.creme,a:o3(P(t,22.5,22.8))})}
 if(window.SAFE){ctx.fillStyle='rgba(224,52,43,.25)';ctx.fillRect(0,0,W,270);ctx.fillRect(0,1250,W,H-1250)}
 ctx.restore()}

function buildAudio(ac,out,T0=0){const S=criaSons(ac,out,T0);const fx=S.fx;
 S.trilha.house(0,20.6);
 fx.impacto(.05);for(let i=0;i<6;i++){fx.whooshCurto(.05+i*.11);fx.popGrave(.3+i*.11)}fx.impacto(.6);for(let i=0;i<6;i++)fx.notificacao(1.2+i*.08+(i%2)*.03);
 [3.2,3.6,4.0,4.4,4.8].forEach(b=>fx.mensagem(b));fx.zumbido(3.1,2);[5.3,5.9,6.3].forEach(b=>{fx.tecla(b);fx.tecla(b+.08)});fx.pop(5.4,620);fx.pop(5.7,780);fx.subida(5.9,.6);fx.whoosh(6.05,.5);fx.popGrave(6.5);
 fx.impacto(7.0);[0,1,2].forEach(i=>{fx.boing(7.0+i*.12);fx.criatura(7.45+i*.2)});S.assinatura.brilho(8.05);
 [9,12,15].forEach(b=>{fx.whoosh(b-.25,.4);fx.whip(b-.05)});fx.whoosh(17.8,.4);for(let i=0;i<6;i++)fx.popAgudo(9.45+i*.18+.3);fx.sucesso(11.1);
 [12.3,12.42,12.54].forEach(b=>fx.pop(b,760));fx.whoosh(12.7,.3);fx.digitando(13.2);fx.digitando(13.7);fx.whooshCurto(14.2);fx.carimbo(14.7);
 fx.clique(16.0);fx.sucesso(16.25);fx.whoosh(16.45,.4);fx.carimbo(16.95);fx.confete(16.3);
 fx.impacto(18);fx.confete(18.05);fx.pop(18.1,700);fx.pop(18.35,900);fx.contador(18.4,1);[18.8,18.9,19,19.1].forEach(b=>fx.popAgudo(b));fx.whoosh(20.4);S.assinatura.groove(20.6);[21.3,21.55,21.8,22.05].forEach(b=>fx.popAgudo(b));fx.brilho(22.3)}

function loadImg(s){return new Promise((r,j)=>{const i=new Image();i.onload=()=>r(i);i.onerror=j;i.src=s})}
const ready=(async()=>{await Promise.all(Object.entries(MARCA).map(async([k,s])=>{IMG.m[k]=await loadImg(s)}));IMG.x={};await Promise.all(Object.entries(EXTRA).map(async([k,s])=>{IMG.x[k]=await loadImg(s)}));
 await Promise.all(['800 40px "Baloo 2"','400 40px Roboto','500 40px Roboto','700 40px Roboto','400 40px "Grand Hotel"'].map(f=>document.fonts.load(f)));render(0)})();
window.render=render;window.buildAudio=buildAudio;window.ready=ready;
