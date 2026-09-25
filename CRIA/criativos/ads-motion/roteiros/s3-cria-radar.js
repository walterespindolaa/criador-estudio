// S3 · SOCIAL MÍDIA · "Por que o post dele bombou?" (Cria Radar: engenharia reversa)
window.AD={id:'s3-cria-radar',title:'S3 · Cria Radar',desc:'Social mídia. Engenharia reversa de perfis e pautas pro cliente. 25s, 9:16.',seed:71,
 texts:{
  gancho:TX(['Por que o post','#dele bombou?'],{y:390,size:100,lh:112,start:0.05,stagger:0.12,out:2.9}),
  agita:TX(['Achismo não é','~estratégia.'],{y:390,size:104,lh:116,start:3.05,stagger:0.12,out:6.75}),
  virada:TX(['E se desse pra ver','~por ~dentro?'],{y:430,size:92,lh:108,start:7.15,stagger:0.1,out:8.55}),
 },
 prova:{lines:['Do post que bombou','#à pauta do cliente.'],size:88,lh:104},provaSelo:'seloAmarelo',provaSeloW:380,
 lampHops:[12.6,15.8],shakes:[[5.8,12]],scenes:[],cues:[]};
(function(){
 const VIEWS=['12 mil','8 mil','1,2 mi','15 mil','9 mil','21 mil','11 mil','7 mil','14 mil'];
 const TC=[C.azul,C.rosa,C.laranja,C.verde,C.lilas,C.amarelo,C.rosa,C.azul,C.verde];
 function grade(t){
  if(t>7.1)return;const inS=spring(0,t,1.4,6),out=eIn(P(t,6.5,6.9));const s=lerp(0.85,1,Math.min(inS,1.04))*(1-out*0.3);
  ctx.save();ctx.globalAlpha*=1-out;ctx.translate(540,860);ctx.scale(s,s);ctx.translate(-540,-860);
  card(120,490,840,740,44,C.branco);avatar(185,555,32,C.ink,'@',C.creme);label('@concorrente',235,567,36,{w:700});
  const sc=(t*40)%0;const cw=248,chh=300;ctx.save();rr(140,610,800,600,24);ctx.clip();
  for(let i=0;i<9;i++){const x=150+(i%3)*(cw+14),y=620+Math.floor(i/3)*(chh+14)-eInOut(P(t,0,2.2))*120;const hot=i===2;ctx.fillStyle=hexA(TC[i],hot?0.95:0.35);rr(x,y,cw,chh,18);ctx.fill();
   if(hot){const g=0.5+0.5*Math.sin(t*10);ctx.strokeStyle=hexA(C.amarelo,0.6+0.4*g);ctx.lineWidth=10;rr(x+5,y+5,cw-10,chh-10,16);ctx.stroke()}
   ctx.fillStyle='rgba(10,10,10,0.55)';rr(x+14,y+chh-58,hot?150:118,44,22);ctx.fill();label('▶ '+VIEWS[i],x+28,y+chh-27,hot?28:24,{w:700,color:C.branco})}
  ctx.restore();ctx.restore();
  const r=rng(5);['?','?','?','?','?'].forEach((q,i)=>{const t0=3.2+i*0.35;const e=spring(t0,t,1.6,6);if(e<=0)return;ctx.save();ctx.globalAlpha*=1-out;ctx.translate(180+r()*720,640+r()*520);ctx.rotate((r()-0.5)*0.8);ctx.scale(e,e);label(q,0,0,150,{w:800,fam:'"Baloo 2"',color:[C.laranja,C.azul,C.rosa,C.verde,C.vermelho][i],align:'center'});ctx.restore()});
  [['trend?',4.2,300,1060],['horário?',4.6,760,700],['sorte?',5.0,700,1150]].forEach(([s2,t0,x,y])=>{const e=spring(t0,t,1.6,6);if(e<=0)return;ctx.save();ctx.globalAlpha*=1-out;ctx.translate(x,y);ctx.scale(e,e);pill(s2,0,0,{bg:C.ink,fg:C.creme,size:40,h:84});ctx.restore()});
  stamp('CHUTE',540,880,t,5.8,C.vermelho,120,-0.1);
 }
 const TOP=[['1,2 mi',1.0,C.laranja],['640 mil',0.53,C.rosa],['410 mil',0.34,C.azul],['380 mil',0.32,C.verde]];
 const WHY=[['GANCHO','pergunta nos 2 primeiros segundos',C.amarelo],['FORMATO','Reels de 18s, legenda na tela',C.rosa],['TEMA','um erro comum do nicho',C.azul],['HORÁRIO','terça, 19h',C.verde]];
 const PAUTAS=['Por que seu café amarga? (pergunta no gancho)','3 erros ao passar café em casa','Bastidor: o dia da torra'];
 function radar(t){
  if(t<T.DROP-0.05||t>19.2)return;const inS=spring(T.DROP-0.05,t,1.3,6);const out=eIn(P(t,18.8,19.1));const s=lerp(0.7,1,Math.min(inS,1.03))*(1-out*0.2);
  ctx.save();ctx.globalAlpha*=clamp(inS*2)*(1-out);ctx.translate(540,850);ctx.scale(s,s);ctx.translate(-540,-850);
  card(90,470,900,770,44,C.branco);
  ctx.fillStyle=C.papel;rr(130,505,820,84,42);ctx.fill();ctx.strokeStyle=C.ink;ctx.lineWidth=5;ctx.beginPath();ctx.arc(180,545,18,0,Math.PI*2);ctx.moveTo(193,558);ctx.lineTo(208,573);ctx.stroke();
  const q='@concorrente';label(q.slice(0,nChars(t,9.3,9.9,q.length)),225,558,38,{w:700});
  const ph1=1-eInOut(P(t,12.5,12.85)),ph2=eInOut(P(t,12.5,12.85))*(1-eInOut(P(t,15.6,15.95))),ph3=eInOut(P(t,15.6,15.95));
  if(ph1>0){ctx.save();ctx.globalAlpha*=ph1;label('POSTS QUE MAIS PERFORMARAM',140,650,26,{w:700,color:'rgba(10,10,10,0.45)',ls:3});
   TOP.forEach(([v,p,c],i)=>{const t0=10.1+i*0.3;const e=enter(t,t0,0.35);if(!e.on)return;const y=720+i*120;withT(e,540,y,()=>{ctx.fillStyle=hexA(c,0.85);rr(140,y-45,80,100,14);ctx.fill();label('#'+(i+1),240,y+4,36,{w:800,fam:'"Baloo 2"'});bar(310,y-12,480,28,p*eOut(P(t,t0+0.1,t0+0.9)),c);label(v,930,y+12,34,{w:800,fam:'"Baloo 2"',align:'right'})})});
   ctx.restore()}
  if(ph2>0){ctx.save();ctx.globalAlpha*=ph2;ctx.fillStyle=hexA(C.laranja,0.9);rr(140,630,150,190,18);ctx.fill();label('#1 · 1,2 mi views',320,690,40,{w:800,fam:'"Baloo 2"'});label('Por que bombou',320,740,34,{w:500,color:'rgba(10,10,10,0.55)'});
   WHY.forEach(([k,v,c],i)=>{const t0=12.95+i*0.55;const e=enter(t,t0,0.35);if(!e.on)return;const y=890+i*88;withT(e,540,y,()=>{const w=tag(k,140,y,c,c===C.azul?C.branco:C.ink,24);label(v,140+w+22,y+12,34,{w:500})})});
   ctx.restore()}
  if(ph3>0){ctx.save();ctx.globalAlpha*=ph3;avatar(170,660,32,C.amarelo,'CA');label('Pautas pro Café Aurora',220,672,40,{w:800,fam:'"Baloo 2"'});
   PAUTAS.forEach((p,i)=>{const t0=16.0+i*0.5;const e=enter(t,t0,0.4);if(!e.on)return;const y=770+i*140;withT(e,540,y+50,()=>{ctx.fillStyle=C.papel;rr(130,y,820,120,26);ctx.fill();ctx.font=F(700,34,'Roboto');const ls=wrap(p,640);ls.forEach((l,k)=>label(l,170,y+(ls.length>1?52:70)+k*44,34,{w:700}));check(900,y+60,26,spring(t0+0.35,t,1.6,6))})});
   ctx.restore()}
  ctx.restore();
 }
 AD.scenes=[grade,radar,t=>stepChip(t,T.DROP+0.1,18.8,'Cria Radar',C.azul,C.ink,'engenharia reversa')];
 const q=AD.cues;q.push([0.6,'shimmer']);for(let i=0;i<5;i++)q.push([3.2+i*0.35,'pop',400+i*60]);[4.2,4.6,5.0].forEach(x=>q.push([x,'error']));q.push([5.8,'stamp']);q.push([6.5,'whoosh',0.4]);
 for(let x=9.3;x<9.9;x+=0.05)q.push([x,'key']);TOP.forEach((v,i)=>q.push([10.1+i*0.3,'pop',900-i*100]));q.push([12.5,'whoosh',0.4]);WHY.forEach((w,i)=>q.push([12.95+i*0.55,'pop',560+i*80]));q.push([15.6,'whoosh',0.4]);PAUTAS.forEach((p,i)=>q.push([16.35+i*0.5,'ding',[1318.5,1568,2093][i]]));q.push([18.8,'whoosh',0.4]);
})();
