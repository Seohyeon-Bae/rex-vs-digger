// Skill icons — Claude 1.9.x pixel-art set (approach benchmarked from classic MMO skill icons: full-tile
// coloured background with bevel, 1px dark outline, top-light shading, a bright effect trail).
// Drawn on a 24×24 grid so the HUD's 24px slots show every pixel 1:1 (crispEdges, no blur).
const N=24;
const PAL={
 outline:'#141c17',mouth:'#7a2626',tooth:'#fff6dc',eye:'#fffbe8',
 rex:['#cfe58f','#8aab5e','#57733f'],metal:['#ffe28c','#e0a838','#9e6b1c'],steel:['#c9d8d2','#93a8a0','#5f6f69'],cab:['#d8f0fb','#9fcbe0','#5f8ea6'],
 glowRex:['#f4ffc4','#b8f06a'],glowDig:['#fff2b8','#ffb24a'],glowParry:['#e8f6ff','#8fd0ff'],impact:['#fff1b0','#ff8a3d'],glowRage:['#ffe7b0','#ff6a2a','#c8361c'],smoke:['#d8d6cc','#9a9b92'],
 bg:{rex:['#3f7a5c','#1a3a2c','#0f2219'],dig:['#8a5a20','#3c2610','#1f1408'],parry:['#3c5f8c','#18294a','#0d1628']}};

// ── tiny raster engine ───────────────────────────────────────────────
const newLayer=()=>Array.from({length:N},()=>Array(N).fill(null));
const mat=(m,t)=>[[1,0,0,1,0,0],m,t];
function tf(points,{x=0,y=0,s=1,r=0}={}){const c=Math.cos(r*Math.PI/180),n=Math.sin(r*Math.PI/180),out=[];for(let i=0;i<points.length;i+=2){const px=points[i]*s,py=points[i+1]*s;out.push(x+px*c-py*n,y+px*n+py*c);}return out;}
function inside(pts,x,y){let k=false;for(let i=0,j=pts.length-2;i<pts.length;j=i,i+=2){const xi=pts[i],yi=pts[i+1],xj=pts[j],yj=pts[j+1];if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)k=!k;}return k;}
// fill: material name (auto-shaded) or {c:'#hex'} (flat)
function fill(L,pts,paint){for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(inside(pts,x+.5,y+.5))L[y][x]=paint;}
function stroke(L,pts,paint,w=1){for(let i=0;i<pts.length-2;i+=2){const [x0,y0,x1,y1]=pts.slice(i,i+4),len=Math.hypot(x1-x0,y1-y0),steps=Math.max(1,Math.ceil(len*3));for(let k=0;k<=steps;k++){const x=x0+(x1-x0)*k/steps,y=y0+(y1-y0)*k/steps;for(let dy=0;dy<w;dy++)for(let dx=0;dx<w;dx++){const px=Math.floor(x-(w-1)/2+dx),py=Math.floor(y-(w-1)/2+dy);if(px>=0&&py>=0&&px<N&&py<N)L[py][px]=paint;}}}}
const curve=(x0,y0,cx,cy,x1,y1,n=14)=>{const p=[];for(let i=0;i<=n;i++){const t=i/n,u=1-t;p.push(u*u*x0+2*u*t*cx+t*t*x1,u*u*y0+2*u*t*cy+t*t*y1);}return p;};
const arc=(cx,cy,r,a0,a1,n=16)=>{const p=[];for(let i=0;i<=n;i++){const a=(a0+(a1-a0)*i/n)*Math.PI/180;p.push(cx+Math.cos(a)*r,cy+Math.sin(a)*r);}return p;};
const px=(L,x,y,paint)=>{if(x>=0&&y>=0&&x<N&&y<N)L[y][x]=paint;};
// Resolve sprite layer: outline around shapes, then shade materials (top/left lit, bottom/right shadow).
function bake(L){const out=newLayer(),has=(x,y)=>x>=0&&y>=0&&x<N&&y<N&&L[y][x]!==null;
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const p=L[y][x];
  if(p===null){if(has(x-1,y)||has(x+1,y)||has(x,y-1)||has(x,y+1))out[y][x]=PAL.outline;continue;}
  if(typeof p==='object'){out[y][x]=p.c;continue;}
  const tone=PAL[p];out[y][x]=!has(x,y-1)||!has(x-1,y)?tone[0]:!has(x,y+1)||!has(x+1,y)?tone[2]:tone[1];}
 return out;}
// Background tile: vertical gradient in 3 bands + bevel + diagonal light streak.
function tile(kind){const [a,b,c]=PAL.bg[kind],L=newLayer();
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const t=(y+x*.35)/(N*1.35);L[y][x]=t<.33?a:t<.7?b:c;}
 for(let i=0;i<N;i++){L[0][i]=L[i][0]=lift(a);L[N-1][i]=L[i][N-1]='#090d0b';}
 for(let i=2;i<9;i++)if(i<N)L[i-1][i+1]=lift(a);
 L[0][0]=L[0][N-1]=L[N-1][0]=L[N-1][N-1]=null;return L;}
function lift(hex){const n=parseInt(hex.slice(1),16),f=v=>Math.min(255,Math.round(v+(255-v)*.28));return '#'+[n>>16,n>>8&255,n&255].map(v=>f(v).toString(16).padStart(2,'0')).join('');}
function svg(layers){let rects='';for(let y=0;y<N;y++){let x=0;while(x<N){let c=null;for(const L of layers)if(L[y][x])c=L[y][x];let w=1;while(x+w<N){let c2=null;for(const L of layers)if(L[y][x+w])c2=L[y][x+w];if(c2!==c)break;w++;}if(c)rects+=`<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;x+=w;}}return rects;}

// ── shapes (local coordinates, transformed with tf) ─────────────────
function rexHead(L,o,open=true){
 fill(L,tf([3,27,4,14,10,6,20,3,31,5,39,9.5,38.6,13.6,22,14.6,15,18,12,27],o),'rex');
 if(open){fill(L,tf([22,14.6,38.4,13.6,35,23.5,22,17],o),{c:PAL.mouth});fill(L,tf([15,18,22,17,35,23.5,32,27.5,24,29,15,27],o),'rex');
  for(const t of [[25,14.4,26.6,18,28,14.2],[31,14,32.4,17.6,33.8,13.9]])fill(L,tf(t,o),{c:PAL.tooth});
  for(const t of [[27,21,28.4,17.6,29.8,21.6],[31.6,22.6,33,19.4,34.4,23.2]])fill(L,tf(t,o),{c:PAL.tooth});}
 else fill(L,tf([15,18,22,15.6,37,15.4,34,19,26,22,16,22],o),'rex');
 const [ex,ey]=tf([25.4,8.2],o);px(L,Math.floor(ex),Math.floor(ey),{c:PAL.eye});px(L,Math.floor(ex)+1,Math.floor(ey),{c:PAL.outline});
}
function bucket(L,o){fill(L,tf([2,2,14,1,17,8,15,15,4,16,1,9],o),'metal');fill(L,tf([5,7,12,6,14.4,9.4,12.4,13,6,13.2],o),{c:PAL.metal[2]});
 for(const t of [[3.6,15,5.6,19.4,7.4,15],[8.4,15,10.2,19.4,12,15],[12.4,14.6,14.6,18.8,15.8,14.2]])fill(L,tf(t,o),'steel');}
function arm(L,x1,y1,x2,y2,w=3){const dx=x2-x1,dy=y2-y1,l=Math.hypot(dx,dy)||1,nx=-dy/l*w/2,ny=dx/l*w/2;fill(L,[x1+nx,y1+ny,x2+nx,y2+ny,x2-nx,y2-ny,x1-nx,y1-ny],'metal');}
function joint(L,x,y){for(const [a,b] of [[0,0],[1,0],[0,1],[1,1]])px(L,Math.floor(x)+a-1+1,Math.floor(y)+b-1+1,'steel');}
// effects (drawn on top, not outlined)
function trail(E,pts,glow,w=2){stroke(E,pts,{c:glow[1]},w);stroke(E,pts,{c:glow[0]},1);}
function star(E,x,y,col=PAL.impact){for(const [a,b,c] of [[0,0,0],[0,-1,1],[0,1,1],[-1,0,1],[1,0,1],[0,-2,1],[0,2,1],[-2,0,1],[2,0,1]])px(E,x+a,y+b,{c:col[c]});}
function head(E,x,y,dx,dy,col){px(E,x,y,{c:col[0]});px(E,x-dx,y-dy,{c:col[1]});px(E,x-dx-dy,y-dy+dx,{c:col[1]});px(E,x-dx+dy,y-dy-dx,{c:col[1]});}

const ICONS={
 rage(S,E){rexHead(S,{x:0,y:6,s:.5});for(const t of [[1,8,2,1,5,7],[5,6,7,0,10,6],[10,5,13,0,15,5]])fill(E,t,{c:PAL.glowRage[2]});for(const t of [[2,7,2,3,4,6],[6,5,7,2,9,5],[11,4,13,2,14,4]])fill(E,t,{c:PAL.glowRage[1]});for(const [x,y] of [[2,5],[7,3],[12,3]])px(E,x,y,{c:PAL.glowRage[0]});for(const [a,b,c,d] of [[19,1,21,3],[23,1,21,3],[19,5,21,3],[23,5,21,3]])stroke(E,[a,b,c,d],{c:PAL.glowRage[1]},1);px(E,21,3,{c:PAL.glowRage[0]});}, overdrive(S,E){fill(S,arc(12,13,8,0,360,24),'steel');fill(S,arc(12,13,6,0,360,24),{c:'#1d2629'});stroke(S,arc(12,13,5,290,345,8),{c:PAL.glowDig[1]},2);stroke(S,[12,13,17,9],{c:PAL.impact[0]},1);for(const [x,y,c] of [[2,4,0],[4,2,1],[3,6,1],[5,4,0],[1,2,1],[6,1,0]])px(E,x,y,{c:PAL.smoke[c]});for(const y of [20,22])trail(E,[1,y,6,y],PAL.glowDig,1);trail(E,arc(13,12,10,200,250,6),PAL.glowDig,1);star(E,21,4);}, bite(S,E){trail(E,curve(19,3,23,7,21,13),PAL.glowRex);rexHead(S,{x:0,y:4,s:.5});star(E,20,16);},
 ram(S,E){for(const y of [8,12,16])trail(E,[1,y,5,y],PAL.glowRex,1);rexHead(S,{x:5,y:5,s:.44,r:10},false);star(E,20,5);},
 tail(S,E){trail(E,curve(3,13,11,5,20,3),PAL.glowRex);fill(S,[1,23,3,17,8,13,13,11,17,8,20,3,23,7,22,12,18,16,12,19,6,22],'rex');for(const [x,y] of [[8,13],[12,11],[16,8]])px(S,x,y,{c:PAL.rex[0]});star(E,21,3);},
 leap(S,E){for(let i=0;i<5;i++)px(E,2+i*2,21-i*3,{c:PAL.glowRex[0]});fill(S,tf([2,33,14,26,22,20,29,17,33,11,38,6.5,45,8.5,46,12,39,13,35,15,33,21,28,27,20,29,12,31],{s:.5}),'rex');fill(S,tf([20,28,26,26,27,32,23,36,19,35,22,32],{s:.5}),'rex');const [ex,ey]=[19,4];px(S,ex,ey,{c:PAL.eye});trail(E,[16,22,22,22],PAL.impact,1);},
 pounce(S,E){trail(E,arc(12,12,10.5,200,320),PAL.glowRex);head(E,20,5,1,1,PAL.glowRex);trail(E,arc(12,12,10.5,20,140),PAL.glowRex);head(E,4,19,-1,-1,PAL.glowRex);fill(S,[12,5,17,6,19,10,19,14,17,17,12,19,7,17,5,14,5,10,7,6],'rex');fill(S,[13,3,20,1.6,23,5.6,17,8.4],'rex');fill(S,[18,6.4,22.6,6,21,8.6,17.6,8.8],{c:PAL.mouth});px(S,19,3,{c:PAL.eye});px(S,20,3,{c:PAL.outline});},
 smash(S,E){arm(S,1,4,10,3,3);arm(S,10,3,13,10,3);joint(S,9,2);bucket(S,{x:9,y:10,s:.5,r:-6});trail(E,[20,2,20,8],PAL.glowDig,1);head(E,20,9,0,1,PAL.glowDig);trail(E,[4,22,20,22],PAL.impact,1);star(E,12,21);},
 sweep(S,E){trail(E,curve(2,19,12,24,22,15),PAL.glowDig);head(E,22,15,1,-1,PAL.glowDig);arm(S,1,13,8,11,3);arm(S,8,11,14,11,3);joint(S,7,10);bucket(S,{x:22,y:6,s:.5,r:80});},
 uppercut(S,E){arm(S,1,22,7,17,3);arm(S,7,17,11,11,3);joint(S,6,16);bucket(S,{x:15,y:12,s:.5,r:195});trail(E,curve(17,22,23,15,19,4),PAL.glowDig);head(E,19,3,0,-1,PAL.glowDig);star(E,4,4);},
 spin(S,E){trail(E,arc(12,12,10.5,190,330),PAL.glowDig);head(E,21,6,1,1,PAL.glowDig);trail(E,arc(12,12,10.5,10,150),PAL.impact);fill(S,[4,10,13,10,13,19,4,19],'metal');fill(S,[6,12,9,12,9,15,6,15],'cab');arm(S,12,14,17,11,2.6);bucket(S,{x:16,y:5,s:.45,r:12});},
 grapple(S,E){trail(E,curve(11,3,18,-1,22,6),PAL.glowDig);head(E,22,7,0,1,PAL.glowDig);arm(S,1,22,6,16,3);arm(S,6,16,9,11,3);joint(S,5,15);rexHead(S,{x:10,y:12,s:.28});bucket(S,{x:6,y:4,s:.5,r:-12});},
 parry(S,E){fill(S,[1,22,5,18,9,16,13,15,16,12,16,9,18,13,16,16,12,18,7,20],'rex');arm(S,23,1,18,6,2.6);bucket(S,{x:15,y:3,s:.45,r:40});trail(E,arc(15,11,6,200,340),PAL.glowParry,1);star(E,15,10,PAL.glowParry.slice().reverse().length?[PAL.glowParry[0],PAL.glowParry[1]]:PAL.impact);}
};
const BG={rage:'rex',overdrive:'dig',bite:'rex',ram:'rex',tail:'rex',leap:'rex',pounce:'rex',smash:'dig',sweep:'dig',uppercut:'dig',spin:'dig',grapple:'dig',parry:'parry'};
const cache=new Map(),modelIcons=new Map();
const effectLayer=kind=>{const S=newLayer(),E=newLayer();(ICONS[kind]||ICONS.parry)(S,E);return E.map(r=>r.map(p=>p?.c??null));};
function picture(kind){if(modelIcons.has(kind))return modelIcons.get(kind);if(cache.has(kind))return cache.get(kind);const draw=ICONS[kind]||ICONS.parry,S=newLayer(),E=newLayer();draw(S,E);
 const html=`<svg class="skill-picture" data-skill-kind="${kind}" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" aria-hidden="true">${svg([tile(BG[kind]||'parry'),bake(S),E.map(r=>r.map(p=>p?.c??null))])}</svg>`;cache.set(kind,html);return html;}
export function skillIcon(kind){return picture(kind)+`<svg class="skill-clock" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="16" pathLength="100" fill="none"/></svg>`;}

// ── 실제 3D 모델 아이콘 ─────────────────────────────────────────────
// 전투 엔진의 beginAttack으로 진짜 스킬 동작을 만들고, 정한 순간의 자세를 캐릭터 렌더러로 그린 뒤
// 24×24 도트(1px 외곽선, 색 단계 축소)로 바꿔 메이플식 칸과 효과 궤적 위에 얹는다. 준비 전에는 위 도트 그림을 쓴다.
const POSE={bite:['rex',.42],ram:['rex',.38],tail:['rex',.5],leap:['rex',.5,2.2],pounce:['rex',.55,1.2],smash:['dig',.5],sweep:['dig',.55],uppercut:['dig',.55],spin:['dig',.5],grapple:['dig',.4],parry:['rex',.45],rage:['rex',.3,0,'bite'],overdrive:['dig',.25,0,'uppercut']};
async function buildModelIcons(){
 const [{Battle,STEP},{CharacterRenderer},{updateBucketArm},{portraitPose}]=await Promise.all([import('./engine.js'),import('./character-guide.js'),import('./weapon-geometry.js'),import('./combat-motion.js')]);
 const stage=document.createElement('div');stage.style.cssText='position:fixed;left:-10000px;top:0;width:150px;height:110px;visibility:hidden;pointer-events:none';stage.setAttribute('aria-hidden','true');
 const canvas=document.createElement('canvas');canvas.style.cssText='width:150px;height:110px;display:block';stage.append(canvas);document.body.append(stage);
 let renderer;try{renderer=new CharacterRenderer(canvas,new Battle({rex:1,dig:1}),{transparent:true});renderer.portrait=true;renderer.follow=false;
 const shot=document.createElement('canvas'),small=document.createElement('canvas');small.width=small.height=N;
 for(const [kind,[team,phase,lift=0,mimic]] of Object.entries(POSE)){
  await new Promise(done=>typeof requestIdleCallback==='function'?requestIdleCallback(done,{timeout:250}):setTimeout(done,0));
  const b=new Battle({rex:1,dig:1,seed:7}),u=b.units.find(v=>v.team===team),v=b.units.find(w=>w.team!==team);
  Object.assign(u,{x:0,z:0,y:0,yaw:0,prevYaw:0});Object.assign(v,{x:team==='rex'?4.5:kind==='grapple'?3.2:6.5,z:0,yaw:Math.PI});
  const tech=mimic||(kind==='parry'?'tail':kind);if(mimic){u.buffActive=true;u.buffUntil=team==='rex'?5:6;}if(!b.beginAttack(u,v,Math.hypot(v.x-u.x,v.z-u.z),tech)||!u.action)continue;
  const a=u.action;a.age=a.duration*phase;a.yaw=0;if(lift){u.y=lift;u.py=lift;a.landAt=null;}
  if(team==='dig')for(let i=0;i<40;i++)updateBucketArm(u,STEP);
  renderer.show(team,b.config);const posed=portraitPose(u,renderer,1);posed.y=lift?lift*.5:0;renderer.unit=posed;renderer.battle.units=[posed];renderer.battle.time=1;
  renderer.yaw=team==='rex'?-.95:-.75;renderer.elev=.38;renderer.zoom=1.05;renderer.focusX=team==='rex'?-.5:1.2;renderer.focusZ=0;renderer.resize();renderer.draw(1);
  shot.width=canvas.width;shot.height=canvas.height;const sc=shot.getContext('2d');sc.clearRect(0,0,shot.width,shot.height);if(renderer.gpuCanvas&&!renderer.gpuLost)sc.drawImage(renderer.gpuCanvas,0,0);sc.drawImage(canvas,0,0);
  // 내용 영역 자르기
  const px=sc.getImageData(0,0,shot.width,shot.height).data;let l=shot.width,t=shot.height,r=-1,bt=-1;for(let y=0;y<shot.height;y++)for(let x=0;x<shot.width;x++)if(px[(y*shot.width+x)*4+3]>20){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);bt=Math.max(bt,y);}if(r<l)continue;
  // 20×20 안에 맞춰 부드럽게 축소 → 도트로 양자화
  const w=r-l+1,h=bt-t+1,fit=Math.min(21/w,20/h),dw=Math.max(1,Math.round(w*fit)),dh=Math.max(1,Math.round(h*fit)),ox=Math.round((N-dw)/2)+(team==='rex'?-1:0),oy=N-2-dh;
  const s2=small.getContext('2d');s2.clearRect(0,0,N,N);s2.imageSmoothingEnabled=true;s2.imageSmoothingQuality='high';s2.drawImage(shot,l,t,w,h,ox,oy,dw,dh);
  const d=s2.getImageData(0,0,N,N).data,sprite=newLayer();
  for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=(y*N+x)*4;if(d[i+3]<110)continue;const m=(d[i]+d[i+1]+d[i+2])/3,q=v=>Math.max(0,Math.min(255,Math.round((m+(v-m)*1.5)*1.12/32)*32));sprite[y][x]=`rgb(${q(d[i])},${q(d[i+1])},${q(d[i+2])})`;}
  // 튀는 점 정리: 이웃 4칸 중 3칸 이상이 같은 색이면 그 색으로
  const raw=sprite.map(r=>r.slice());for(let y=1;y<N-1;y++)for(let x=1;x<N-1;x++){if(!raw[y][x])continue;const n=[raw[y-1][x],raw[y+1][x],raw[y][x-1],raw[y][x+1]].filter(Boolean),c={};for(const k of n)c[k]=(c[k]||0)+1;const [best,cnt]=Object.entries(c).sort((a,b)=>b[1]-a[1])[0]||[];if(cnt>=3&&best!==raw[y][x])sprite[y][x]=best;}
  const outline=newLayer(),has=(x,y)=>x>=0&&y>=0&&x<N&&y<N&&sprite[y][x];for(let y=0;y<N;y++)for(let x=0;x<N;x++)if(!sprite[y][x]&&(has(x-1,y)||has(x+1,y)||has(x,y-1)||has(x,y+1)))outline[y][x]=PAL.outline;
  modelIcons.set(kind,`<svg class="skill-picture" data-skill-kind="${kind}" viewBox="0 0 ${N} ${N}" shape-rendering="crispEdges" aria-hidden="true">${svg([tile(BG[kind]),outline,sprite,effectLayer(kind)])}</svg>`);
 }
 // 이미 화면에 있는 아이콘도 교체
 for(const el of document.querySelectorAll('svg.skill-picture[data-skill-kind]')){const html=modelIcons.get(el.dataset.skillKind);if(html)el.outerHTML=html;}
 }finally{renderer?.dispose();stage.remove();}
}
if(typeof document!=='undefined'){const start=()=>setTimeout(()=>buildModelIcons().catch(()=>{}),300);document.readyState==='complete'?start():addEventListener('load',start,{once:true});}

