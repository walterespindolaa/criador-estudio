// ===== fx5: camadas de movimento (câmera, transições, legenda cinética, virada sem preto) =====
// câmera da cena: entra de 0.82, empurra devagar, sai atravessando (zoom-through)
function zt(t,t0,t1){const en=o4(P(t,t0-.1,t0+.35)),ex=i4(P(t,t1-.16,t1+.1));const push=1+.05*P(t,t0,t1);const s=lerp(.82,1,en)*lerp(1,1.5,ex)*push;const a=o3(P(t,t0-.1,t0+.18))*(1-ex);
 ctx.translate(540,960);ctx.rotate((1-en)*-.05+ex*.04);ctx.scale(s,s);ctx.translate(-540,-960);ctx.globalAlpha*=a}
// faixa diagonal na cor da marca que varre a tela no corte
function wipe(t,tc,col,col2){const p=P(t,tc-.22,tc+.22);if(p<=0||p>=1)return;ctx.save();ctx.translate(540,960);ctx.rotate(-.35);const x=lerp(-1900,1900,io3(p));ctx.fillStyle=col;ctx.fillRect(x-260,-1600,520,3200);if(col2){ctx.fillStyle=col2;ctx.fillRect(x-420,-1600,110,3200);ctx.fillRect(x+330,-1600,60,3200)}ctx.restore()}
// legenda cinética: chip com mola + palavras subindo + sublinhado desenhado na linha laranja
function cap2(t,chipS,chipC,s1,s2,t0,t1){if(t<t0-.05||t>=t1+.05)return;const out=o3(P(t,t1-.15,t1+.05));ctx.save();ctx.globalAlpha*=1-out;ctx.translate(0,-out*60);
 const cp=back(P(t,t0,t0+.3));if(cp>0){ctx.save();ctx.translate(540,300);ctx.scale(cp,cp);chip(chipS,0,0,chipC,C.ink,1);ctx.restore()}
 words([s1],540,410,72,80,t0+.08,.06);words([s2.split(' ').map(w=>'#'+w).join(' ')],540,495,72,80,t0+.2,.06);
 const u=o4(P(t,t0+.55,t0+.95));if(u>0){ctx.font=F(800,72);const w=ctx.measureText(s2).width;ctx.strokeStyle=hexA(C.amarelo,.9);ctx.lineWidth=16;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(540-w/2,520);ctx.quadraticCurveTo(540,532,540-w/2+w*u,518);ctx.stroke()}
 ctx.restore()}
// virada: círculo amarelo nasce do último elemento (sem tela preta), logo acorda, frase em Grand Hotel
function viradaCirculo(t,x,y,t0=6.55){const k=P(t,t0,t0+.5);if(k<=0)return;const r1=lerp(0,2300,io3(P(t,t0,t0+.42))),r2=lerp(0,2300,io3(P(t,t0+.05,t0+.47)));ctx.save();ctx.fillStyle=C.laranja;ctx.beginPath();ctx.arc(x,y,r1,0,7);ctx.fill();ctx.fillStyle=C.amarelo;ctx.beginPath();ctx.arc(x,y,r2,0,7);ctx.fill();ctx.restore()}
function virada(t,l1,l2,cor='laranja'){ctx.fillStyle=C.amarelo;ctx.fillRect(-60,-60,W+120,H+120);
 for(let i=0;i<14;i++){const a=i/14*Math.PI*2+t*.3,d=lerp(200,900,o4(P(t,7,7.6)))+Math.sin(t*3+i)*30,al=.25*(1-P(t,8.2,8.9));if(al>0){ctx.fillStyle=hexA([C.laranja,C.rosa,C.branco][i%3],al);ctx.beginPath();ctx.arc(540+Math.cos(a)*d,820+Math.sin(a)*d,12+i%3*8,0,7);ctx.fill()}}
 const zin=lerp(1.25,1,o4(P(t,7,9)));ctx.save();ctx.translate(540,860);ctx.scale(zin,zin);ctx.translate(-540,-860);
 logoFatias(cor,540,760,880,i=>{const t0=7.0+i*.12;const p=P(t,t0,t0+.4);const e=back(p);const fp=P(t,7.45+i*.2,7.75+i*.2);const sq=t>t0+.4?Math.sin((t-t0-.4)*22)*.12*Math.exp(-(t-t0-.4)*6):0;const bob=t>8.3?Math.sin((t-8.3)*Math.PI*4+i)*10:0;return{dy:(1-e)*260+bob,sc:Math.max(.001,e),face:fp>0?back(fp):0,sy:1-sq,rot:(1-o4(p))*(i-1)*.4}});
 ctx.restore();const e2=back(P(t,8.05,8.35)),e3=back(P(t,8.2,8.5));if(e2>0){ctx.save();ctx.translate(540,1150);ctx.scale(e2,e2);txt(l1,0,0,100,{f:'"Grand Hotel"',w:400});ctx.restore()}if(e3>0){ctx.save();ctx.translate(540,1255);ctx.scale(e3,e3);txt(l2,0,0,100,{f:'"Grand Hotel"',w:400,col:C.laranja});ctx.restore()}
 wipe(t,9,C.laranja,C.rosa)}
