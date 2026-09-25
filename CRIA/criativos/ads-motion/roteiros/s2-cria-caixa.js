// S2 · SOCIAL MÍDIA · "Quanto sobra de cada cliente?" (Cria Caixa: margem por cliente, PF e PJ)
window.AD={id:'s2-cria-caixa',title:'S2 · Cria Caixa',desc:'Social mídia. Margem por cliente, PF e PJ separados. 25s, 9:16.',seed:61,
 texts:{
  gancho:TX(['Quanto #sobra','de cada cliente?'],{y:390,size:100,lh:112,start:0.05,stagger:0.12,out:2.9}),
  agita:TX(['Faturar não é','~lucrar.'],{y:390,size:108,lh:118,start:3.05,stagger:0.12,out:6.75}),
  virada:TX(['E se o app','te ~mostrasse?'],{y:430,size:100,lh:114,start:7.15,stagger:0.1,out:8.55}),
 },
 prova:{lines:['Margem por cliente.','#PF e PJ separados.'],size:88,lh:104},provaSelo:'clubVerde',provaSeloW:300,
 lampHops:[14.2,16.8],shakes:[[5.7,14]],scenes:[],cues:[]};
(function(){
 const R=v=>'R$ '+BR(v);
 const DESC=[['Ferramentas',180,1.3],['Freela de design',450,1.8],['Impostos',108,2.3],['Captação e deslocamento',160,3.4],['Suas horas',null,4.0]];
 function conta(t){
  if(t>7.1)return;const inS=spring(0,t,1.4,6),out=eIn(P(t,6.5,6.9));const s=lerp(0.85,1,Math.min(inS,1.04))*(1-out*0.3);
  ctx.save();ctx.globalAlpha*=1-out;ctx.translate(540,860);ctx.scale(s,s);ctx.translate(-540,-860);
  card(120,500,840,730,44,C.branco);avatar(190,570,36,C.amarelo,'CA');label('Café Aurora',245,583,40,{w:800,fam:'"Baloo 2"'});
  label('Mensalidade',170,675,32,{w:500,color:'rgba(10,10,10,0.55)'});label(R(1800*eOut(P(t,0.1,1.0))),910,680,56,{w:800,fam:'"Baloo 2"',color:C.verde,align:'right'});
  ctx.fillStyle='rgba(10,10,10,0.07)';ctx.fillRect(160,710,760,3);
  DESC.forEach(([n,v,t0],i)=>{const e=enter(t,t0,0.35);if(!e.on)return;const y=770+i*72;withT(e,540,y,()=>{label('− '+n,170,y,34,{w:500});label(v?R(v):'???',910,y,38,{w:800,fam:'"Baloo 2"',color:v?C.vermelho:C.laranja,align:'right'})})});
  const e=enter(t,4.6,0.4);if(e.on)withT(e,540,1160,()=>{ctx.fillStyle=C.papel;rr(160,1115,760,90,24);ctx.fill();label('Sobra no fim do mês',190,1172,36,{w:700});const sh=Math.sin(t*30)*6*P(t,4.6,5.0)*(1-P(t,5.2,5.6));label('?',880+sh,1178,64,{w:800,fam:'"Baloo 2"',color:C.vermelho,align:'right'})});
  ctx.restore();
  stamp('NO ACHISMO',540,900,t,5.7,C.vermelho,100,-0.1);
 }
 const CLI=[['Café Aurora','CA',C.amarelo,0.61],['Studio Mar','SM',C.rosa,0.48],['Bella Praia','BP',C.azul,0.35],['Loja Onda','LO',C.verde,0.22],['Clínica Sol','CS',C.laranja,0.08]];
 function caixa(t){
  if(t<T.DROP-0.05||t>19.2)return;const inS=spring(T.DROP-0.05,t,1.3,6);const out=eIn(P(t,18.8,19.1));const s=lerp(0.7,1,Math.min(inS,1.03))*(1-out*0.2);
  ctx.save();ctx.globalAlpha*=clamp(inS*2)*(1-out);ctx.translate(540,850);ctx.scale(s,s);ctx.translate(-540,-850);
  card(90,470,900,770,44,C.branco);
  const pf=eInOut(P(t,14.1,14.5))*(1-eInOut(P(t,16.5,16.9)));
  // alternador PJ/PF
  ctx.fillStyle=C.papel;rr(140,505,520,76,38);ctx.fill();ctx.fillStyle=C.ink;rr(146+pf*254,511,254,64,32);ctx.fill();label('Empresa (PJ)',273,553,32,{w:800,fam:'"Baloo 2"',color:pf<0.5?C.creme:C.ink,align:'center'});label('Pessoal (PF)',527,553,32,{w:800,fam:'"Baloo 2"',color:pf>=0.5?C.creme:C.ink,align:'center'});
  label('Outubro',940,555,32,{w:700,color:'rgba(10,10,10,0.45)',align:'right'});
  // PJ
  if(pf<1){ctx.save();ctx.globalAlpha*=1-pf;
   const k=eOut(P(t,9.6,10.6));[['Faturamento',R(12600*k),C.ink],['Custos',R(7180*k),C.vermelho],['Margem',Math.round(43*k)+'%',C.verde]].forEach(([n,v,c],i)=>{const x=130+i*280;ctx.fillStyle=C.papel;rr(x,620,260,130,24);ctx.fill();label(n,x+24,665,26,{w:500,color:'rgba(10,10,10,0.55)'});label(v,x+24,725,44,{w:800,fam:'"Baloo 2"',color:c})});
   label('MARGEM POR CLIENTE',140,810,26,{w:700,color:'rgba(10,10,10,0.45)',ls:3});
   CLI.forEach(([n,l,c,m],i)=>{const t0=10.8+i*0.35;const e=enter(t,t0,0.35);if(!e.on)return;const y=870+i*72;const mc=m>0.4?C.verde:m>0.15?C.amarelo:C.vermelho;const hi=i===4&&t>16.9;
    withT(e,540,y,()=>{if(hi){ctx.fillStyle=hexA(C.vermelho,0.08+0.05*Math.sin(t*8));rr(120,y-34,840,68,20);ctx.fill()}avatar(165,y,24,c,l);label(n,205,y+11,32,{w:700});bar(470,y-9,340,18,m*eOut(P(t,t0+0.1,t0+0.8)),mc);label(Math.round(m*100*eOut(P(t,t0+0.1,t0+0.8)))+'%',920,y+11,32,{w:800,fam:'"Baloo 2"',color:mc,align:'right'})})});
   const tp=spring(12.8,t,1.6,6);if(tp>0&&t<14.2||t>16.9&&tp>0){ctx.save();ctx.translate(700,1212);ctx.scale(Math.min(tp,1.05),Math.min(tp,1.05));pill(t>16.9?'Clínica Sol: rever valor ou custo':'margem baixa: atenção',0,0,{bg:C.vermelho,fg:C.branco,size:32,h:70,w:700,fam:'Roboto'});ctx.restore()}
   ctx.restore()}
  // PF
  if(pf>0){ctx.save();ctx.globalAlpha*=pf;
   [['Pró-labore que caiu',5000,C.verde],['Contas da casa',2900,C.vermelho],['Assinaturas pessoais',210,C.vermelho]].forEach(([n,v,c],i)=>{const y=680+i*100;const e=enter(t,14.4+i*0.25,0.35);if(!e.on)return;withT(e,540,y,()=>{ctx.fillStyle=C.papel;rr(130,y-50,820,84,22);ctx.fill();label(n,165,y+4,34,{w:500});label((c===C.verde?'+ ':'− ')+R(v),915,y+6,40,{w:800,fam:'"Baloo 2"',color:c,align:'right'})})});
   const e=enter(t,15.3,0.4);if(e.on)withT(e,540,1020,()=>{ctx.fillStyle=hexA(C.verde,0.12);rr(130,960,820,120,28);ctx.fill();label('Sobrou pra você',165,1033,38,{w:700});label(R(1890*eOut(P(t,15.3,16))),915,1036,54,{w:800,fam:'"Baloo 2"',color:C.verde,align:'right'})});
   const e2=enter(t,15.8,0.4);if(e2.on)label('sem misturar com o caixa da empresa',540,1150,30,{w:500,color:'rgba(10,10,10,0.55)',align:'center',alpha:e2.a});
   ctx.restore()}
  ctx.restore();
 }
 AD.scenes=[conta,caixa,t=>stepChip(t,T.DROP+0.1,18.8,'Cria Caixa',C.verde,C.ink,'margem por cliente')];
 const q=AD.cues;for(let x=0.1;x<1.0;x+=0.1)q.push([x,'coin']);DESC.forEach(([n,v,t0])=>q.push([t0,v?'error':'buzz']));q.push([4.6,'pop',500]);q.push([5.7,'stamp']);q.push([6.5,'whoosh',0.4]);
 for(let x=9.6;x<10.6;x+=0.12)q.push([x,'keysoft']);CLI.forEach((c,i)=>q.push([10.8+i*0.35,'pop',900-i*90]));q.push([12.8,'error']);q.push([14.1,'whoosh',0.4]);[14.4,14.65,14.9].forEach(x=>q.push([x,'pop',700]));q.push([15.3,'coin']);q.push([16.5,'whoosh',0.4]);q.push([16.9,'ding',1318.5]);q.push([18.8,'whoosh',0.4]);
})();
