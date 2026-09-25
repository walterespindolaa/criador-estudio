// C1 · CRIADOR · "Não sei o que postar" (Cria Plano + Cria Stories)
window.AD={id:'c1-nao-sei-o-que-postar',title:'C1 · Não sei o que postar',desc:'Criador. Cria Plano + Cria Stories. 25s, 9:16.',seed:11,
 texts:{
  gancho:TX(['#12 dias','sem postar.'],{y:400,size:112,lh:118,start:0.05,stagger:0.14,out:2.9}),
  agita:TX(['Não é falta de talento.','É falta de ~plano.'],{y:390,size:80,lh:100,start:3.05,stagger:0.08,out:6.75}),
  virada:TX(['E se o mês viesse','~pronto?'],{y:430,size:96,lh:112,start:7.15,stagger:0.1,out:8.55}),
 },
 prova:{lines:['Seu mês de conteúdo,','#planejado.']},
 lampHops:[13.8,16.6],
 shakes:[[4.4,14],[4.9,10],[5.4,10]],
 scenes:[],cues:[]};
(function(){
 const CAL={x:90,y:520,w:900,h:660};
 const cw=(CAL.w-60)/7, ch=100, gx=CAL.x+30, gy=CAL.y+150;
 const cell=d=>{const i=d-1+4;return{x:gx+(i%7)*cw,y:gy+Math.floor(i/7)*ch}};
 const FMT=[['Reels',C.rosa],['Carrossel',C.amarelo],['Foto',C.azul],['Reels',C.rosa],['Carrossel',C.amarelo]];
 function calendario(t){
  if(t>13.9)return;
  const inS=spring(0,t,1.4,6);const out=eIn(P(t,6.55,6.95));const out2=eIn(P(t,13.6,13.95));
  const back=t>=T.DROP-0.05?spring(T.DROP-0.05,t,1.3,6):0; // volta na demo
  let s,a;
  if(t<T.DROP-0.05){s=lerp(0.85,1,Math.min(inS,1.05))*(1-out*0.3);a=(1-out)}else{s=lerp(0.7,1,Math.min(back,1.03))*(1-out2*0.2);a=clamp(back*2)*(1-out2)}
  if(a<=0)return;
  const cx=540,cy=CAL.y+CAL.h/2;
  ctx.save();ctx.globalAlpha*=a;ctx.translate(cx,cy);ctx.scale(s,s);ctx.translate(-cx,-cy);
  card(CAL.x,CAL.y,CAL.w,CAL.h,44,C.branco);
  label('Outubro',CAL.x+44,CAL.y+80,56,{w:800,fam:'"Baloo 2"'});
  const demo=t>=T.DROP-0.05;
  if(demo)label('Cria Plano',CAL.x+CAL.w-44,CAL.y+76,30,{w:700,color:C.laranja,align:'right'});
  ['D','S','T','Q','Q','S','S'].forEach((d,i)=>label(d,gx+cw*i+cw/2,CAL.y+130,26,{color:'rgba(10,10,10,0.4)',align:'center'}));
  const passed=demo?0:Math.floor(P(t,0.15,2.4)*12);
  for(let d=1;d<=31;d++){const c=cell(d);
   ctx.fillStyle=C.papel;rr(c.x+5,c.y+5,cw-10,ch-10,14);ctx.fill();
   label(String(d),c.x+16,c.y+36,24,{w:500,color:'rgba(10,10,10,0.55)'});
   if(!demo&&d<=passed){ctx.save();ctx.strokeStyle=hexA(C.vermelho,0.55);ctx.lineWidth=5;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(c.x+cw/2-16,c.y+ch/2+2);ctx.lineTo(c.x+cw/2+16,c.y+ch/2+30);ctx.moveTo(c.x+cw/2+16,c.y+ch/2+2);ctx.lineTo(c.x+cw/2-16,c.y+ch/2+30);ctx.stroke();ctx.restore()}
   if(!demo&&d===passed+1&&t<2.6){ctx.strokeStyle=C.laranja;ctx.lineWidth=5;rr(c.x+5,c.y+5,cw-10,ch-10,14);ctx.stroke()}
   if(demo){const tf=9.35+d*0.07;const p=spring(tf,t,1.6,7);if(p>0){const f=FMT[(d*7)%5];ctx.save();const px=c.x+cw/2,py=c.y+ch/2+14;ctx.translate(px,py);ctx.scale(p,p);ctx.fillStyle=f[1];rr(-cw/2+12,-18,cw-24,36,12);ctx.fill();ctx.font=F(700,19,'Roboto');ctx.fillStyle=f[1]===C.azul?C.branco:C.ink;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(f[0],0,1);ctx.restore()}}
  }
  if(demo){[[9,12.0],[23,12.4]].forEach(([d,tt])=>{const c=cell(d);const p=spring(tt,t,1.6,6);if(p>0){ctx.save();ctx.translate(c.x+cw-14,c.y+12);ctx.scale(p,p);ctx.rotate(0.12);ctx.fillStyle=C.laranja;rr(-58,-18,116,36,18);ctx.fill();label('em alta',0,8,20,{w:700,color:C.branco,align:'center'});ctx.restore()}})}
  ctx.restore();
  if(demo&&t<13.9){const e=enter(t,11.7,0.4,13.55);if(e.on){const n=Math.round(eOut(P(t,11.7,12.4))*31);withT(e,540,1225,()=>pill(n+' posts planejados',540,1225,{bg:C.ink,fg:C.creme,size:40,h:84}))}}
 }
 function dores(t){
  if(t<4.2||t>7)return;const out=eIn(P(t,6.55,6.9));
  [['sem ideia',300,700,-0.14,4.4,C.vermelho],['sem tempo',760,860,0.1,4.9,C.ink],['sem constância',470,1040,-0.06,5.4,C.laranja]].forEach(([s,x,y,r,t0,col])=>{ctx.save();ctx.globalAlpha*=1-out;stamp(s,x,y,t,t0,col,72,r);ctx.restore()});
 }
 function stories(t){
  if(t<13.75||t>19.2)return;const out=eIn(P(t,18.8,19.1));
  const days=['SEG','TER','QUA','QUI','SEX','SÁB','DOM'],tipos=['bastidor','enquete','caixinha','rotina','dica','collab','resumo'];
  const cols=[C.amarelo,C.rosa,C.azul,C.verde,C.laranja,C.lilas,C.amarelo];
  const w=118,h=210,gap=12,x0=540-(7*w+6*gap)/2,y0=520;
  ctx.save();ctx.globalAlpha*=1-out;
  days.forEach((d,i)=>{const tf=14.05+i*0.22;const p=spring(tf,t,1.5,6);if(p<=0)return;const x=x0+i*(w+gap);
   ctx.save();ctx.translate(x+w/2,y0+h/2);ctx.scale(p,p);ctx.translate(-(x+w/2),-(y0+h/2));
   label(d,x+w/2,y0-18,24,{w:700,color:'rgba(10,10,10,0.5)',align:'center'});
   card(x,y0,w,h,20,C.ink);for(let k=0;k<3;k++){const fp=P(t,tf+0.2+k*0.12,tf+0.35+k*0.12);ctx.fillStyle=hexA(cols[i],0.35+0.65*fp);rr(x+8+k*((w-16)/3),y0+10,(w-16)/3-4,6,3);ctx.fill()}
   ctx.fillStyle=hexA(cols[i],0.9);rr(x+10,y0+30,w-20,h-44,14);ctx.fill();
   label(tipos[i],x+w/2,y0+h/2+18,21,{w:700,color:cols[i]===C.azul?C.branco:C.ink,align:'center'});
   ctx.restore()});
  // story ampliado (enquete)
  const e=enter(t,16.55,0.5);if(e.on){withT(e,540,1060,()=>{card(290,860,500,380,36,C.branco);label('Qual você prefere?',540,935,40,{w:800,fam:'"Baloo 2"',align:'center'});const vote=eOut(P(t,17.2,18.2));[['Reels',0.62,C.rosa],['Carrossel',0.38,C.amarelo]].forEach(([s,v,c],k)=>{const y=980+k*110;ctx.fillStyle=C.papel;rr(330,y,420,84,42);ctx.fill();ctx.fillStyle=c;rr(330,y,Math.max(84,420*v*vote),84,42);ctx.fill();label(s,360,y+54,34,{w:700});label(Math.round(v*100*vote)+'%',720,y+54,34,{w:700,align:'right'})})})}
  ctx.restore();
 }
 AD.scenes=[calendario,dores,stories,
  t=>stepChip(t,T.DROP+0.1,13.6,'Cria Plano',C.laranja,C.ink,'seu mês inteiro'),
  t=>stepChip(t,13.85,18.8,'Cria Stories',C.rosa,C.ink,'a semana toda')];
 const q=AD.cues;
 for(let d=1;d<=12;d++)q.push([0.15+d*(2.25/12),'keysoft']);q.push([2.45,'error']);
 [4.4,4.9,5.4].forEach(x=>q.push([x,'stamp']));q.push([6.55,'whoosh',0.4]);
 for(let d=1;d<=31;d+=2)q.push([9.35+d*0.07,'keysoft']);q.push([11.6,'ding',1318.5]);q.push([12.0,'coin']);q.push([12.4,'coin']);q.push([11.7,'pop',700]);
 q.push([13.6,'whoosh',0.45]);for(let i=0;i<7;i++)q.push([14.05+i*0.22,'pop',520+i*60]);q.push([16.55,'notif']);q.push([17.2,'whoosh',0.5]);q.push([18.2,'ding',1568]);q.push([18.8,'whoosh',0.4]);
})();
