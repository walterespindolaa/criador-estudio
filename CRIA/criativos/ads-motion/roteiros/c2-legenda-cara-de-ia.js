// C2 · CRIADOR · "Legenda com cara de IA" (Brandbook + ideia vira post no seu tom)
window.AD={id:'c2-legenda-cara-de-ia',title:'C2 · Legenda com cara de IA',desc:'Criador. Brandbook + ideia vira post no seu tom. 25s, 9:16.',seed:21,
 texts:{
  gancho:TX(['Todo mundo #percebe','quando é IA.'],{y:390,size:96,lh:110,start:0.05,stagger:0.1,out:2.9}),
  agita:TX(['A IA não sabe','~quem ~você ~é.'],{y:390,size:96,lh:110,start:3.05,stagger:0.1,out:6.75}),
  virada:TX(['E se ela lesse a sua','~essência antes?'],{y:430,size:86,lh:104,start:7.15,stagger:0.09,out:8.55}),
 },
 prova:{lines:['Parece você.','Porque #foi você.']},provaSelo:'seloRosa',provaSeloW:470,
 lampHops:[13.45,17.9],shakes:[[5.6,16]],scenes:[],cues:[]};
(function(){
 // layout de legenda com palavras marcáveis (clichê / tom)
 function layoutWords(words,x,y,maxW,size,lh){ctx.font=F(400,size,'Roboto');const sp=ctx.measureText(' ').width;let cx=x,cy=y;return words.map(w=>{const ww=ctx.measureText(w.w).width;if(cx+ww>x+maxW){cx=x;cy+=lh}const o={...w,x:cx,y:cy,ww};cx+=ww+sp;return o})}
 function drawCaption(L,t,t0,t1,size,markT,markCol){const total=L.reduce((s,w)=>s+w.w.length+1,0);let n=Math.floor(P(t,t0,t1)*total);L.forEach(w=>{if(n<=0)return;const vis=w.w.slice(0,n);n-=w.w.length+1;if(w.m&&t>markT){const mp=eOut(P(t,markT+w.k*0.12,markT+0.3+w.k*0.12));ctx.fillStyle=hexA(markCol,0.28);rr(w.x-4,w.y-size*0.82,(w.ww+8)*mp,size*1.08,8);ctx.fill();ctx.fillStyle=markCol;ctx.fillRect(w.x,w.y+8,w.ww*mp,5)}label(vis,w.x,w.y,size,{w:400})})}
 const RUIM='Em um mundo cada vez mais conectado, descubra o poder de transformar sua jornada e alcançar resultados extraordinários.'.split(' ');
 const RUIMm=new Set([0,1,2,3,4,5,6,7,8,9,13,16,17]);let kk=0;
 const WR=RUIM.map((w,i)=>({w,m:RUIMm.has(i),k:RUIMm.has(i)?kk++:0}));
 function posIA(t){
  if(t>7)return;const inS=spring(0,t,1.4,6),out=eIn(P(t,6.5,6.9));const s=lerp(0.85,1,Math.min(inS,1.04))*(1-out*0.3);
  ctx.save();ctx.globalAlpha*=1-out;ctx.translate(540,860);ctx.scale(s,s);ctx.rotate(out*0.3);ctx.translate(-540,-860);
  card(90,500,900,720,44,C.branco);avatar(160,575,36,C.lilas,'V',C.branco);label('@voce',214,588,36,{w:700});label('agora',870,588,28,{w:400,color:'rgba(10,10,10,0.4)',align:'right'});
  const L=layoutWords(WR,140,700,800,50,68);drawCaption(L,t,0.1,2.3,50,2.4,C.vermelho);
  [['parece texto de robô',3.4,C.rosa,'M'],['cadê você nisso?',4.1,C.amarelo,'J'],['escreveu com IA, né?',4.8,C.verde,'L']].forEach(([s2,t0,c,l],i)=>{const e=enter(t,t0,0.4);if(!e.on)return;const y=990+i*84;withT(e,300,y,()=>{avatar(160,y,24,c,l);ctx.font=F(500,34,'Roboto');const w=ctx.measureText(s2).width+44;ctx.fillStyle=C.papel;rr(200,y-30,w,60,30);ctx.fill();label(s2,222,y+12,34,{w:500})})});
  ctx.restore();
  stamp('CARA DE IA',600,800,t,5.6,C.vermelho,100,-0.1);
 }
 function brandbook(t){
  if(t<T.DROP-0.05||t>13.9)return;const inS=spring(T.DROP-0.05,t,1.3,6);const shrink=eInOut(P(t,13.35,13.8));
  const a=clamp(inS*2)*(1-shrink);if(a<=0)return;const s=lerp(0.7,1,Math.min(inS,1.03))*(1-shrink*0.6);
  ctx.save();ctx.globalAlpha*=a;ctx.translate(540,850);ctx.scale(s,s);ctx.translate(-540,-850);
  card(90,470,900,760,44,C.branco);label('Brandbook',140,545,54,{w:800,fam:'"Baloo 2"'});label('Duda Reis',940,540,30,{w:700,color:C.laranja,align:'right'});
  const sec=[['TOM DE VOZ',9.4,['leve','direto','com humor'],C.amarelo,C.ink,false],['PALAVRAS QUE EU USO',10.15,['gente','bora','sem enrolação'],C.verde,C.branco,false],['EU NUNCA DIGO',10.9,['transforme sua vida','jornada'],C.vermelho,C.branco,true]];
  sec.forEach(([tt,t0,ps,bg,fg,strike],i)=>{const e=enter(t,t0,0.4);if(!e.on)return;const y=615+i*150;withT(e,540,y,()=>{label(tt,140,y,26,{w:700,color:'rgba(10,10,10,0.45)',ls:3});let x=140;ps.forEach((p,k)=>{const pe=spring(t0+0.15+k*0.15,t,1.6,6);if(pe<=0)return;ctx.save();ctx.font=F(700,36,'Roboto');const w=ctx.measureText(p).width+48;ctx.translate(x+w/2,y+62);ctx.scale(pe,pe);ctx.fillStyle=strike?hexA(bg,0.12):bg;rr(-w/2,-30,w,60,30);ctx.fill();ctx.fillStyle=strike?bg:fg;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(p,0,2);if(strike){ctx.strokeStyle=bg;ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-w/2+18,2);ctx.lineTo(-w/2+18+(w-36)*eOut(P(t,t0+0.4+k*0.15,t0+0.7+k*0.15)),2);ctx.stroke()}ctx.restore();x+=w+16})})});
  const e4=enter(t,11.65,0.4);if(e4.on)withT(e4,540,1080,()=>{label('MINHAS CORES',140,1065,26,{w:700,color:'rgba(10,10,10,0.45)',ls:3});[C.laranja,C.amarelo,C.rosa,C.azul,C.ink].forEach((c,k)=>{const pe=spring(11.8+k*0.1,t,1.6,6);ctx.fillStyle=c;circle(170+k*84,1125,32*pe)})});
  const e5=enter(t,12.3,0.4);if(e5.on)withT(e5,540,1100,()=>{label('PRA QUEM EU FALO',590,1065,26,{w:700,color:'rgba(10,10,10,0.45)',ls:3});label('criadoras começando',590,1115,34,{w:500});label('no Instagram',590,1155,34,{w:500})});
  ctx.restore();
 }
 const BOA='Gente, bora falar sério? Tem 3 erros que travam quem tá começando, e o segundo eu cometi por um ano inteiro. Salva esse post que eu te conto.'.split(' ');
 const BOAm=new Set([0,1]);let k2=0;const WB=BOA.map((w,i)=>({w,m:BOAm.has(i),k:BOAm.has(i)?k2++:0}));
 function post(t){
  if(t<13.3||t>19.2)return;const out=eIn(P(t,18.8,19.1));ctx.save();ctx.globalAlpha*=1-out;
  const e0=enter(t,13.55,0.4);if(e0.on)withT(e0,540,500,()=>pill('ideia: 3 erros de quem tá começando',540,500,{bg:C.ink,fg:C.creme,size:36,h:80,w:700,fam:'Roboto'}));
  const e1=enter(t,13.9,0.35,14.95);if(e1.on)withT(e1,540,640,()=>{card(240,590,600,110,55,C.branco);drawImg(IMG.lamp,300,645,70,{rot:Math.sin(t*8)*0.15});label('lendo seu brandbook...',350,640,34,{w:700});bar(350,660,440,14,eInOut(P(t,14.0,14.85)),C.laranja)});
  const e2=enter(t,14.9,0.45);if(e2.on)withT(e2,540,900,()=>{card(90,580,900,650,44,C.branco);avatar(160,655,36,C.amarelo,'D');label('@dudareis',214,668,36,{w:700});
    const L=layoutWords(WB,140,770,800,48,66);drawCaption(L,t,15.1,17.3,48,17.4,C.verde);
    const pe=spring(17.75,t,1.6,6);if(pe>0){ctx.save();ctx.translate(300,1150);ctx.scale(pe,pe);ctx.fillStyle=hexA(C.verde,0.14);rr(-160,-34,320,68,34);ctx.fill();check(-118,0,20,1);label('no seu tom',-86,12,34,{w:700,color:C.verde});ctx.restore()}
    const pe2=spring(18.0,t,1.6,6);if(pe2>0){ctx.save();ctx.translate(690,1150);ctx.scale(pe2,pe2);ctx.fillStyle=hexA(C.verde,0.14);rr(-190,-34,380,68,34);ctx.fill();check(-148,0,20,1);label('com suas palavras',-116,12,34,{w:700,color:C.verde});ctx.restore()}
  });
  burst(300,1150,17.75,t,5,10,140,16);
  ctx.restore();
 }
 AD.scenes=[posIA,brandbook,post,
  t=>stepChip(t,T.DROP+0.1,13.3,'Brandbook',C.amarelo,C.ink,'a sua essência'),
  t=>stepChip(t,13.45,18.8,'Ideia vira post',C.laranja,C.ink,'no seu tom')];
 const q=AD.cues;const nR=RUIM.join(' ').length;for(let i=0;i<nR;i+=3)q.push([0.1+i*(2.2/nR),'keysoft']);q.push([2.45,'error']);
 [3.4,4.1,4.8].forEach(x=>q.push([x,'notif']));q.push([5.6,'stamp']);q.push([6.5,'whoosh',0.4]);
 [9.4,10.15,10.9,11.65,12.3].forEach((x,i)=>q.push([x,'pop',520+i*80]));q.push([11.3,'error']);
 q.push([13.35,'whoosh',0.45]);q.push([13.55,'pop',600]);q.push([14.9,'ding',1318.5]);const nB=BOA.join(' ').length;for(let i=0;i<nB;i+=3)q.push([15.1+i*(2.2/nB),'keysoft']);q.push([17.75,'ding',1568]);q.push([18.0,'pop',900]);q.push([18.8,'whoosh',0.4]);
})();
