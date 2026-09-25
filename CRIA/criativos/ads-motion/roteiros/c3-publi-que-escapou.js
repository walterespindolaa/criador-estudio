// C3 · CRIADOR · "A publi que escapou" (Mídia kit + Link na bio)
window.AD={id:'c3-publi-que-escapou',title:'C3 · A publi que escapou',desc:'Criador. Mídia kit + link na bio. 25s, 9:16.',seed:31,
 texts:{
  gancho:TX(['A marca pediu','seu ~mídia ~kit.'],{y:390,size:96,lh:110,start:0.05,stagger:0.1,out:2.9}),
  agita:TX(['A publi foi pra quem','#respondeu #primeiro.'],{y:390,size:84,lh:100,start:3.05,stagger:0.08,out:6.75}),
  virada:TX(['E se o seu mídia kit','estivesse ~sempre ~pronto?'],{y:430,size:80,lh:98,start:7.15,stagger:0.08,out:8.55}),
 },
 prova:{lines:['Mídia kit e bio','#sempre prontos.']},provaSelo:'seloAmarelo',provaSeloW:400,
 lampHops:[14.25,17.6],shakes:[[5.9,16],[17.6,8]],scenes:[],cues:[]};
(function(){
 function bubble(x,y,text,t,t0,mine,maxW=620,col){const e=enter(t,t0,0.4);if(!e.on)return;ctx.font=F(400,38,'Roboto');const ls=wrap(text,maxW-60);const w=Math.max(...ls.map(l=>ctx.measureText(l).width))+60,h=ls.length*50+36;const bx=mine?x-w:x;withT(e,bx+w/2,y+h/2,()=>{card(bx,y,w,h,32,mine?C.azul:C.papel,false);ls.forEach((l,i)=>label(l,bx+30,y+58+i*50,38,{w:400,color:mine?C.branco:C.ink}))});return h}
 function dm(t){
  if(t>7)return;const inS=spring(0,t,1.4,6),out=eIn(P(t,6.5,6.9));const s=lerp(0.85,1,Math.min(inS,1.04))*(1-out*0.3);
  ctx.save();ctx.globalAlpha*=1-out;ctx.translate(540,860);ctx.scale(s,s);ctx.translate(-540,-860);
  card(90,490,900,740,44,C.branco);avatar(160,565,36,C.laranja,'CA',C.branco);label('Café Aurora',214,560,36,{w:700});label('Marca · te seguiu há 2 meses',214,598,26,{w:400,color:'rgba(10,10,10,0.5)'});
  ctx.fillStyle='rgba(10,10,10,0.07)';ctx.fillRect(90,630,900,3);
  bubble(130,660,'Oi! Amamos seu conteúdo. Pode mandar seu mídia kit? Queremos fechar uma publi.',t,0.2,false,700);
  if(t>1.2&&t<4.6){const e=enter(t,1.2,0.3);ctx.save();ctx.globalAlpha*=e.a;card(760,900,190,80,40,C.azul,false);for(let i=0;i<3;i++){ctx.fillStyle=hexA(C.branco,0.4+0.6*Math.max(0,Math.sin(t*9-i*0.9)));circle(812+i*44,940,11)}ctx.restore()}
  const d=enter(t,4.7,0.35);if(d.on)withT(d,540,1010,()=>pill('2 dias depois...',540,1010,{bg:C.ink,fg:C.creme,size:34,h:72}));
  bubble(130,1070,'Ah, já fechamos com outra criadora. Fica pra próxima!',t,5.25,false,700);
  ctx.restore();
  // arquivos voando
  [['print_insights_v3.png',3.1,C.azul],['planilha-final-2.xlsx',3.45,C.verde],['midia kit 2023.pdf',3.8,C.vermelho],['pasta sem nome',4.15,C.amarelo]].forEach(([s2,t0,c],i)=>{const p=P(t,t0,t0+1.3);if(p<=0||p>=1)return;const x=lerp(-250,1330,p)+(i%2?0:0),y=760+i*90-Math.sin(p*Math.PI)*260;ctx.save();ctx.translate(x,y);ctx.rotate((p-0.5)*1.6*(i%2?1:-1));card(-200,-40,400,80,20,C.branco);ctx.fillStyle=c;rr(-180,-24,40,48,8);ctx.fill();label(s2,-124,12,28,{w:500});ctx.restore()});
  stamp('PUBLI PERDIDA',540,860,t,5.9,C.vermelho,92,-0.1);
 }
 const PH={x:540,y:852,w:540,h:800};
 function celular(t){
  if(t<T.DROP-0.05||t>19.2)return;const inS=spring(T.DROP-0.05,t,1.3,6);const out=eIn(P(t,18.8,19.1));
  phone(PH.x,PH.y,PH.w,PH.h,(w,h)=>{
   const bio=eInOut(P(t,14.1,14.6));
   ctx.save();ctx.translate(-bio*w,0);
   ctx.fillStyle=C.laranja;ctx.fillRect(0,0,w,170);label('MÍDIA KIT',36,112,30,{w:700,color:C.creme,ls:4});
   avatar(w/2,190,62,C.amarelo,'D');label('Duda Reis',w/2,306,48,{w:800,fam:'"Baloo 2"',align:'center'});label('criadora de conteúdo · Itajaí',w/2,344,26,{w:400,color:'rgba(10,10,10,0.55)',align:'center'});
   const cnt=eOut(P(t,9.6,10.8));[['Seguidores',BR(18400*cnt)],['Alcance/mês',BR(212000*cnt)],['Engaj.',(4.8*cnt).toFixed(1).replace('.',',')+'%']].forEach(([k,v],i)=>{const x=18+i*((w-36)/3);ctx.fillStyle=C.papel;rr(x+4,375,(w-36)/3-8,120,18);ctx.fill();label(v,x+(w-36)/6,432,36,{w:800,fam:'"Baloo 2"',align:'center'});label(k,x+(w-36)/6,470,22,{w:500,color:'rgba(10,10,10,0.55)',align:'center'})});
   const tg=spring(10.9,t,1.6,6);if(tg>0){ctx.save();ctx.translate(w/2,528);ctx.scale(tg,tg);ctx.fillStyle=hexA(C.verde,0.14);rr(-180,-24,360,48,24);ctx.fill();label('direto do seu Instagram',0,9,26,{w:700,color:C.verde,align:'center'});ctx.restore()}
   const ap=eOut(P(t,11.1,11.9));[['Mulheres',0.78,C.rosa],['18 a 34 anos',0.71,C.azul]].forEach(([k,v,c],i)=>{const y=590+i*66;label(k,26,y,26,{w:700});label(Math.round(v*100*ap)+'%',w-26,y,26,{w:700,align:'right'});bar(26,y+14,w-52,18,v*ap,c)});
   const bp=spring(12.3,t,1.5,6);const press=1-0.08*Math.sin(P(t,13.2,13.45)*Math.PI);if(bp>0){ctx.save();ctx.translate(w/2,h-62);ctx.scale(bp*press,bp*press);ctx.fillStyle=C.ink;rr(-(w-60)/2,-40,w-60,80,40);ctx.fill();label('Enviar mídia kit',0,12,36,{w:800,fam:'"Baloo 2"',color:C.creme,align:'center'});ctx.restore()}
   ctx.restore();
   if(bio>0){ctx.save();ctx.translate((1-bio)*w,0);ctx.fillStyle=C.creme;ctx.fillRect(0,0,w,h);ctx.fillStyle=hexA(C.rosa,0.35);circle(w*0.8,90,170);avatar(w/2,160,66,C.amarelo,'D');label('Duda Reis',w/2,282,48,{w:800,fam:'"Baloo 2"',align:'center'});label('conteúdo leve pra quem tá começando',w/2,322,24,{w:400,color:'rgba(10,10,10,0.6)',align:'center'});
    [['Mídia kit',C.laranja,C.branco],['Meu último vídeo',C.ink,C.creme],['Publis e parcerias',C.amarelo,C.ink],['Minha lojinha',C.azul,C.branco]].forEach(([s2,bg,fg],i)=>{const pe=spring(14.6+i*0.18,t,1.6,6);if(pe<=0)return;ctx.save();ctx.translate(w/2,400+i*100);ctx.scale(pe,pe);ctx.fillStyle=bg;rr(-(w-70)/2,-38,w-70,76,38);ctx.fill();label(s2,0,12,34,{w:800,fam:'"Baloo 2"',color:fg,align:'center'});ctx.restore()});
    ctx.restore()}
  },{sc:lerp(0.7,1,Math.min(inS,1.03))*(1-out*0.2),alpha:clamp(inS*2)*(1-out)});
  if(t<19.1){ctx.save();ctx.globalAlpha*=1-out;bubble(1010,560,'Tá aqui, no link da minha bio',t,15.9,true,420);bubble(70,760,'Perfeito! Vamos fechar?',t,16.9,false,420);ctx.restore();stamp('PUBLI FECHADA',540,1010,t,17.6,C.verde,80,-0.08);burst(540,1010,17.6,t,3,14,320,24)}
 }
 AD.scenes=[dm,celular,
  t=>stepChip(t,T.DROP+0.1,14.1,'Mídia kit',C.laranja,C.ink,'sempre atualizado'),
  t=>stepChip(t,14.25,18.8,'Link na bio',C.rosa,C.ink,'com a sua cara')];
 const q=AD.cues;q.push([0.2,'notif']);for(let x=1.3;x<2.9;x+=0.3)q.push([x,'keysoft']);[3.1,3.45,3.8,4.15].forEach(x=>q.push([x,'whoosh',0.35]));q.push([4.7,'pop',500]);q.push([5.25,'notif']);q.push([5.9,'stamp']);q.push([6.5,'whoosh',0.4]);
 for(let x=9.6;x<10.8;x+=0.1)q.push([x,'keysoft']);q.push([10.9,'ding',1318.5]);q.push([11.1,'pop',700]);q.push([12.3,'pop',800]);q.push([13.2,'click']);q.push([13.3,'shimmer']);
 q.push([14.1,'whoosh',0.45]);for(let i=0;i<4;i++)q.push([14.6+i*0.18,'pop',600+i*80]);q.push([15.9,'pop',900]);q.push([16.9,'notif']);q.push([17.6,'stamp']);q.push([17.65,'coin']);q.push([18.8,'whoosh',0.4]);
})();
