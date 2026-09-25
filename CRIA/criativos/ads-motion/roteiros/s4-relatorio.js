// S4 · SOCIAL MÍDIA · "Valeu a pena?" (relatório do cliente com a sua marca)
window.AD={id:'s4-relatorio',title:'S4 · Relatório',desc:'Social mídia. Relatório do cliente pronto e com a sua marca. 25s, 9:16.',seed:81,
 texts:{
  gancho:TX(['Fim do mês.','O cliente pergunta:','~valeu ~a ~pena?'],{y:350,size:80,lh:92,start:0.05,stagger:0.09,out:2.9}),
  agita:TX(['Print solto','não #renova contrato.'],{y:390,size:92,lh:108,start:3.05,stagger:0.1,out:6.75}),
  virada:TX(['E se o relatório','se ~montasse ~sozinho?'],{y:430,size:84,lh:102,start:7.15,stagger:0.09,out:8.55}),
 },
 prova:{lines:['Relatório pronto.','#Com a sua marca.'],size:92,lh:108},provaSelo:'seloRosa',provaSeloW:470,
 lampHops:[15.8,17.2],shakes:[[5.8,14]],scenes:[],cues:[]};
(function(){
 function caos(t){
  if(t>7.1)return;const out=eIn(P(t,6.5,6.9));ctx.save();ctx.globalAlpha*=1-out;
  // folha de calendário
  const e0=spring(0,t,1.4,6);const flip=eInOut(P(t,0.2,0.9));ctx.save();ctx.translate(540,720);ctx.scale(e0*(t<3.2?1:1-eIn(P(t,3.2,3.6))),e0*(t<3.2?1:1-eIn(P(t,3.2,3.6))));card(-160,-150,320,300,32,C.branco);ctx.fillStyle=C.vermelho;rr(-160,-150,320,80,32);ctx.fill();ctx.fillRect(-160,-100,320,30);label('OUTUBRO',0,-98,30,{w:700,color:C.branco,align:'center',ls:3});label(String(Math.round(lerp(24,31,flip))),0,90,150,{w:800,fam:'"Baloo 2"',align:'center'});ctx.restore();
  notif(540,960,860,t,1.0,'Café Aurora','E aí, como foi o mês? Valeu a pena?',C.amarelo,'CA',3.2);
  // prints caindo
  const r=rng(8);for(let i=0;i<9;i++){const t0=3.2+i*0.22;const sp=spring(t0,t,1.3,6);if(sp<=0)continue;const x=200+r()*680,y=lerp(-300,640+r()*480,sp);ctx.save();ctx.translate(x,y);ctx.rotate((r()-0.5)*0.7);card(-110,-150,220,300,18,C.branco);ctx.fillStyle=C.papel;rr(-94,-134,188,190,12);ctx.fill();ctx.strokeStyle=[C.azul,C.rosa,C.verde,C.laranja][i%4];ctx.lineWidth=6;ctx.beginPath();for(let k=0;k<5;k++){const px=-80+k*40,py=20-r()*120;k?ctx.lineTo(px,py):ctx.moveTo(px,py)}ctx.stroke();label(i%3===2?'planilha.xlsx':'print_'+(i+1)+'.png',-94,110,22,{w:500});ctx.restore()}
  const e=enter(t,4.6,0.4);if(e.on){withT(e,540,1200,()=>{const pw=pill('     3h montando',540,1200,{bg:C.ink,fg:C.creme,size:44,h:92});ctx.save();ctx.translate(540-pw/2+52,1200);ctx.strokeStyle=C.amarelo;ctx.lineWidth=6;ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.stroke();ctx.rotate(t*12);ctx.beginPath();ctx.moveTo(0,0);ctx.lineTo(0,-14);ctx.stroke();ctx.restore()})}
  ctx.restore();stamp('NA RAÇA',540,860,t,5.8,C.vermelho,110,-0.1);
 }
 function relatorio(t){
  if(t<T.DROP-0.05||t>19.2)return;const inS=spring(T.DROP-0.05,t,1.3,6);const out=eIn(P(t,18.8,19.1));const fly=eInOut(P(t,15.7,16.3));
  const s=lerp(0.7,1,Math.min(inS,1.03))*(1-out*0.2)*(1-fly*0.45);
  ctx.save();ctx.globalAlpha*=clamp(inS*2)*(1-out);ctx.translate(540,850-fly*170);ctx.scale(s,s);ctx.rotate(-fly*0.05);ctx.translate(-540,-850);
  card(130,470,820,770,32,C.branco);
  ctx.save();rr(130,470,820,770,32);ctx.clip();ctx.fillStyle=C.azul;ctx.fillRect(130,470,820,170);ctx.fillStyle=hexA(C.amarelo,0.35);circle(900,480,150);ctx.restore();
  label('RELATÓRIO · OUTUBRO',180,540,26,{w:700,color:C.creme,ls:3});label('Café Aurora',180,605,56,{w:800,fam:'"Baloo 2"',color:C.branco});
  const lg=spring(9.5,t,1.6,6);if(lg>0){ctx.save();ctx.translate(840,560);ctx.scale(lg,lg);ctx.fillStyle=C.branco;circle(0,0,58);label('SUA',0,-4,24,{w:800,fam:'"Baloo 2"',color:C.azul,align:'center'});label('MARCA',0,22,24,{w:800,fam:'"Baloo 2"',color:C.azul,align:'center'});ctx.restore()}
  const k=eOut(P(t,10.0,11.0));[['Alcance','+'+Math.round(32*k)+'%',C.verde],['Seguidores','+'+BR(840*k),C.azul],['Engajamento',(5.1*k).toFixed(1).replace('.',',')+'%',C.laranja]].forEach(([n,v,c],i)=>{const e=enter(t,9.9+i*0.15,0.35);if(!e.on)return;const x=160+i*258;withT(e,x+120,720,()=>{ctx.fillStyle=C.papel;rr(x,670,240,120,22);ctx.fill();label(v,x+22,735,46,{w:800,fam:'"Baloo 2"',color:c});label(n,x+22,772,24,{w:500,color:'rgba(10,10,10,0.55)'})})});
  const lp=eOut(P(t,11.2,12.6));if(lp>0){ctx.strokeStyle=C.azul;ctx.lineWidth=8;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();const pts=[0.2,0.28,0.25,0.4,0.38,0.55,0.62,0.8];pts.forEach((v,i)=>{const px=170+i*(740/7),py=990-v*150;if(i/7<=lp)i?ctx.lineTo(px,py):ctx.moveTo(px,py)});ctx.stroke();ctx.fillStyle=hexA(C.azul,0.08);ctx.fillRect(170,840,740,160)}
  const e1=enter(t,12.8,0.4);if(e1.on)withT(e1,540,1060,()=>{ctx.fillStyle=hexA(C.rosa,0.9);rr(170,1020,90,90,14);ctx.fill();label('Top post: Reels',285,1058,34,{w:700});label('41 mil views · 1.200 salvamentos',285,1096,28,{w:400,color:'rgba(10,10,10,0.6)'})});
  ['12 posts publicados','2 collabs com marcas locais'].forEach((s2,i)=>{const e=enter(t,13.6+i*0.4,0.35);if(!e.on)return;const y=1160+i*52;withT(e,540,y,()=>{check(190,y-10,18,1);label(s2,222,y,30,{w:500})})});
  ctx.restore();
  if(t>16){const e=spring(16.1,t,1.6,6);ctx.save();ctx.globalAlpha*=1-out;ctx.translate(310,1015);ctx.scale(e,e);pill('PDF',0,0,{bg:C.vermelho,fg:C.branco,size:40,h:84});ctx.restore();const e2=spring(16.35,t,1.6,6);ctx.save();ctx.globalAlpha*=1-out;ctx.translate(690,1015);ctx.scale(e2,e2);pill('link pro cliente',0,0,{bg:C.ink,fg:C.creme,size:40,h:84});ctx.restore();
   const b=enter(t,17.1,0.4);if(b.on){ctx.save();ctx.globalAlpha*=1-out;withT(b,540,1150,()=>{card(150,1100,780,110,40,C.papel,true);avatar(210,1155,34,C.amarelo,'CA');label('Adorei! Bora pro próximo mês.',262,1167,36,{w:500})});ctx.restore()}
   burst(540,1150,17.3,t,4,14,300,22)}
 }
 AD.scenes=[caos,relatorio,t=>stepChip(t,T.DROP+0.1,18.8,'Relatório',C.azul,C.ink,'com a sua marca')];
 const q=AD.cues;q.push([0.3,'whoosh',0.4]);q.push([1.0,'notif']);for(let i=0;i<9;i++)q.push([3.35+i*0.22,'lowpop']);q.push([4.6,'tick',1]);q.push([4.9,'tick',0]);q.push([5.8,'stamp']);q.push([6.5,'whoosh',0.4]);
 q.push([9.5,'pop',700]);for(let x=10;x<11;x+=0.1)q.push([x,'keysoft']);q.push([11.2,'whoosh',0.8]);q.push([12.6,'ding',1318.5]);q.push([12.8,'pop',800]);q.push([13.6,'pop',900]);q.push([14.0,'pop',1000]);q.push([15.7,'whoosh',0.5]);q.push([16.1,'pop',700]);q.push([16.35,'pop',900]);q.push([17.1,'notif']);q.push([17.3,'coin']);q.push([18.8,'whoosh',0.4]);
})();
