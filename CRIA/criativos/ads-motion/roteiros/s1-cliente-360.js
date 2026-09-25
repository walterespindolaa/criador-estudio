// S1 · SOCIAL MÍDIA · "Cliente 360" (do briefing ao relatório na ficha do cliente)
window.AD={id:'s1-cliente-360',title:'S1 · Cliente 360',desc:'Social mídia. Ficha do cliente: briefing, estratégia, posts, aprovação, métricas e relatório. 25s, 9:16.',seed:51,
 texts:{
  gancho:TX(['1 cliente.','#4 lugares diferentes.'],{y:390,size:92,lh:108,start:0.05,stagger:0.12,out:2.9}),
  agita:TX(['Com 8 clientes,','são ~32.'],{y:390,size:100,lh:112,start:3.05,stagger:0.12,out:6.75}),
  virada:TX(['E se cada cliente tivesse','~uma ~ficha ~só?'],{y:430,size:78,lh:98,start:7.15,stagger:0.08,out:8.55}),
 },
 prova:{lines:['Do briefing ao relatório,','#sem sair do cliente.'],size:84,lh:100},provaSelo:'seloRosa',provaSeloW:470,
 lampHops:[11.6,14.2,16.8],shakes:[[5.8,14]],scenes:[],cues:[]};
(function(){
 const ITENS=[['briefing.docx',C.azul,-275,-200],['posts no drive',C.verde,275,-200],['aprovação no chat',C.rosa,-275,200],['relatorio_final.pdf',C.vermelho,275,200]];
 function espalhado(t){
  if(t>7.1)return;const out=eIn(P(t,6.55,6.95));const zo=eInOut(P(t,2.9,3.6));
  ctx.save();ctx.globalAlpha*=1-out;
  // cliente único (0-3s)
  const s1=1-zo;if(s1>0.01){ctx.save();ctx.globalAlpha*=s1;const cx=540,cy=820;
   ITENS.forEach(([s,c,dx,dy],i)=>{const e=spring(0.25+i*0.4,t,1.5,6);if(e<=0)return;ctx.save();ctx.setLineDash([12,12]);ctx.strokeStyle=hexA(c,0.6);ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+dx*Math.min(e,1),cy+dy*Math.min(e,1));ctx.stroke();ctx.restore();ctx.save();ctx.translate(cx+dx,cy+dy);ctx.scale(e,e);ctx.rotate((i%2?1:-1)*0.05);card(-170,-56,340,112,24,C.branco);ctx.fillStyle=c;rr(-150,-32,52,64,10);ctx.fill();ctx.save();ctx.beginPath();ctx.rect(-86,-40,250,80);ctx.clip();label(s,-84,11,27,{w:700});ctx.restore();ctx.restore()});
   const e0=spring(0,t,1.4,6);ctx.save();ctx.translate(cx,cy);ctx.scale(e0,e0);ctx.fillStyle=C.branco;circle(0,0,110);avatar(0,0,92,C.amarelo,'CA');ctx.restore();label('Café Aurora',cx,cy+160,40,{w:800,fam:'"Baloo 2"',align:'center'});ctx.restore()}
  // 8 clientes (3-7s)
  if(zo>0){const r=rng(3);const nomes=['CA','SM','BP','LO','CS','PF','AT','VN'];const cols=[C.amarelo,C.rosa,C.azul,C.verde,C.laranja,C.lilas,C.amarelo,C.rosa];
   for(let i=0;i<8;i++){const gx=250+(i%3)*290,gy=640+Math.floor(i/3)*250;const x=i===7?540+290:gx,y=i===7?890:gy;const px=i<6?gx:(i===6?250:830),py=i<6?gy:1140;const e=spring(3.0+i*0.12,t,1.5,6);if(e<=0)continue;ctx.save();ctx.translate(px,py);ctx.scale(e*0.9,e*0.9);
    for(let k=0;k<4;k++){const a=k*Math.PI/2+0.6+Math.sin(t*3+i+k)*0.25;const d=95+r()*20;ctx.strokeStyle=hexA(ITENS[k][1],0.5);ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(Math.cos(a)*d,Math.sin(a)*d);ctx.stroke();ctx.fillStyle=ITENS[k][1];rr(Math.cos(a)*d-16,Math.sin(a)*d-20,32,40,6);ctx.fill()}
    ctx.fillStyle=C.branco;circle(0,0,56);avatar(0,0,48,cols[i],nomes[i]);ctx.restore()}
   const n=Math.round(eOut(P(t,3.4,5.2))*32);const e=enter(t,3.4,0.4);if(e.on)withT(e,540,1210,()=>pill(n+' lugares pra olhar',540,1210,{bg:C.vermelho,fg:C.branco,size:44,h:92}))}
  ctx.restore();
  stamp('BAGUNÇA',540,850,t,5.8,C.vermelho,110,-0.1);
 }
 const ST=[
  ['Briefing','link enviado · cliente respondeu',C.azul,9.4],
  ['Estratégia','3 pilares · tom · persona',C.amarelo,10.6],
  ['Posts','roteiro, design e agenda',C.rosa,11.8],
  ['Aprovação','cliente aprovou pelo link',C.verde,13.0],
  ['Métricas','Instagram do cliente conectado',C.laranja,14.2],
  ['Relatório','PDF com a sua marca',C.lilas,15.4]];
 function ficha(t){
  if(t<T.DROP-0.05||t>19.2)return;const inS=spring(T.DROP-0.05,t,1.3,6);const out=eIn(P(t,18.8,19.1));const s=lerp(0.7,1,Math.min(inS,1.03))*(1-out*0.2);
  ctx.save();ctx.globalAlpha*=clamp(inS*2)*(1-out);ctx.translate(540,850);ctx.scale(s,s);ctx.translate(-540,-850);
  card(90,470,900,770,44,C.branco);avatar(160,540,40,C.amarelo,'CA');label('Café Aurora',218,535,44,{w:800,fam:'"Baloo 2"'});label('cafeteria · cliente desde março',218,572,26,{w:400,color:'rgba(10,10,10,0.5)'});
  [['CRM',16.7,C.ink],['agenda',17.0,C.azul],['bio',17.3,C.rosa]].forEach(([s2,t0,c],i)=>{const e=spring(t0,t,1.6,6);if(e<=0)return;ctx.save();ctx.translate(765+i*0,0);ctx.restore();const x=[700,800,905][i];ctx.save();ctx.translate(x,540);ctx.scale(e,e);ctx.font=F(700,24,'Roboto');const w=ctx.measureText(s2).width+34;ctx.fillStyle=c;rr(-w/2,-22,w,44,22);ctx.fill();label(s2,0,8,24,{w:700,color:C.branco,align:'center'});ctx.restore()});
  ctx.fillStyle='rgba(10,10,10,0.07)';ctx.fillRect(90,610,900,3);
  const x0=170,y0=680,dy=100;
  const prog=clamp((t-9.4)/(15.4+0.7-9.4));ctx.fillStyle='rgba(10,10,10,0.08)';rr(x0-5,y0,10,dy*5,5);ctx.fill();ctx.fillStyle=C.verde;rr(x0-5,y0,10,dy*5*eInOut(prog),5);ctx.fill();
  ST.forEach(([n,d,c,t0],i)=>{const y=y0+i*dy;const e=enter(t,t0,0.4);const done=t>t0+0.75;
   ctx.fillStyle=e.p>0?c:'rgba(10,10,10,0.12)';circle(x0,y,24*(e.p>0?lerp(0.6,1,eBack(e.p)):0.7));
   if(e.on){ctx.save();ctx.globalAlpha*=e.a;ctx.translate((1-eOut(e.p))*40,0);label(n,x0+50,y-2,40,{w:800,fam:'"Baloo 2"'});label(d,x0+50,y+34,28,{w:400,color:'rgba(10,10,10,0.6)'});ctx.restore()}
   if(done)check(930,y+6,24,spring(t0+0.75,t,1.6,6));
   if(i===4&&t>t0+0.2){ctx.save();ctx.strokeStyle=C.laranja;ctx.lineWidth=6;ctx.lineCap='round';ctx.beginPath();const pp=eOut(P(t,t0+0.2,t0+1));[0.2,0.3,0.25,0.5,0.45,0.8].forEach((v,k)=>{const px=720+k*30,py=y+20-v*50;if(k/5<=pp)k?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.stroke();ctx.restore();label('+32%',795,y-30,26,{w:800,fam:'"Baloo 2"',color:C.laranja,alpha:pp})}
  });
  ctx.restore();
 }
 AD.scenes=[espalhado,ficha,t=>stepChip(t,T.DROP+0.1,18.8,'Ficha do cliente',C.amarelo,C.ink,'tudo num lugar')];
 const q=AD.cues;[0.25,0.65,1.05,1.45].forEach(x=>q.push([x,'pop',560]));q.push([2.9,'whoosh',0.5]);for(let i=0;i<8;i++)q.push([3.0+i*0.12,'pop',500+i*40]);q.push([3.4,'error']);q.push([5.8,'stamp']);q.push([6.55,'whoosh',0.4]);
 ST.forEach(([n,d,c,t0],i)=>{q.push([t0,'pop',560+i*70]);q.push([t0+0.75,'ding',[1046.5,1174.7,1318.5,1396.9,1568,1760][i]])});[16.7,17.0,17.3].forEach(x=>q.push([x,'pop',900]));q.push([18.8,'whoosh',0.4]);
})();
