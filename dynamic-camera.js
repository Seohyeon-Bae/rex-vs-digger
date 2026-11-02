import {BUFFS} from './buffs.js';
import {fieldView,projectField} from './field-camera.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
// Living combatants: crowd is 0 up to 10 left and 1 from 40 left; mass keeps growing to 1 near 320 left.
// Many simultaneous fights need calmer, longer, nearer shots; as a battle thins out the camera
// regains its small-battle liveliness.
const crowdCache=new WeakMap();
const crowdState=b=>{let c=crowdCache.get(b);if(c&&c.tick===b.tick)return c;let alive=0;for(const u of b.units)if(u.hp>0)alive++;c={tick:b.tick,crowd:clamp((alive-10)/30,0,1),mass:clamp(Math.log2(Math.max(1,alive)/40)/3,0,1)};crowdCache.set(b,c);return c;};
const crowdOf=b=>crowdState(b).crowd,massOf=b=>crowdState(b).mass;
// Shots glide from the current view toward the fight; crowded battles move slower and never jump.
function glide(shot,now,crowd,mass){const dt=clamp((now-(shot.glideAt??now))/1000,0,.05);shot.glideAt=now;const k=1-Math.exp(-dt*(5-crowd*2-mass*1.2));let dx=(shot.x-shot.viewX)*k,dz=(shot.z-shot.viewZ)*k;const d=Math.hypot(dx,dz),max=(36-crowd*14-mass*8)*dt;if(d>max){dx*=max/d;dz*=max/d;}shot.viewX+=dx;shot.viewZ+=dz;}
// Only live combatants may anchor automatic shots. Sampling bounds large-battle work.
export function updateDynamicDirector(r){
 const b=r.battle,t=b.time,now=performance.now(),crowd=crowdOf(b),mass=massOf(b);
 const visible=u=>u&&(u.hp>0||u.directorLaunch&&t-u.directorLaunch.time<.9&&u.y>.2);
 if(r.directorBattle!==b){r.directorBattle=b;r.directorShot=null;r.directorScanAt=0;r.directorNextAt=0;r.directorHome=null;r.directorZoomState=null;r.directorLaunchSeen=null;}
 if(b.done){r.directorShot=null;return null;}
 let active=r.directorShot;
 if(active?.kind==='launch'){
  const victim=b.units[active.ids[1]],ended=!victim||t-victim.directorLaunch?.time>1.8||(victim.y<.25&&victim.vy<=0)||Math.hypot(victim.vx,victim.vz)<3;
  // Hold each launch shot instead of chaining cuts; crowded battles launch someone every moment.
  if(ended&&(!victim||now-active.realStarted>=1000+crowd*3000+mass*2000)){r.directorShot=null;active=null;r.directorNextAt=0;r.directorScanAt=0;}
 }

 if(active){const units=active.ids.map(id=>b.units[id]).filter(visible);if(units.length<2){r.directorShot=null;active=null;r.directorNextAt=t+.25;}else if(t<active.until||now<active.realUntil){const x=units.reduce((s,u)=>s+u.x,0)/units.length,z=units.reduce((s,u)=>s+u.z,0)/units.length;active.x=x;active.z=z;glide(active,now,crowd,mass);}else{r.directorShot=null;active=null;r.directorNextAt=t+1.8+crowd*1.2+mass*1.5;}}
 if(t<(r.directorScanAt||0))return active;
 r.directorScanAt=t+.22;
 let best=null,bestScore=0;
 // In crowded battles a distant fight must be clearly better than one near the current view.
 const consider=(u,v,score,kind,extra=null)=>{if(!u||!v||u.hp<=0||!visible(v)||u.team===v.team||Math.hypot(u.x-v.x,u.z-v.z)>30)return;if(crowd)score-=crowd*Math.min(6+mass*3,Math.hypot((u.x+v.x)/2-r.focusX,(u.z+v.z)/2-r.focusZ)/8);if(score>bestScore){bestScore=score;best={u,v,score,kind,extra};}};
 // Rare events are not skipped by the ordinary large-battle sampling stride.
 const cinematic=[];if(b.directorCandidates)for(const [id,until] of b.directorCandidates){if(until<t)b.directorCandidates.delete(id);else cinematic.push(b.units[id]);}
 for(const u of cinematic){
  const launch=u.directorLaunch;if(launch&&r.directorLaunchSeen!==u.id+':'+launch.time&&t-launch.time<1.6&&Math.hypot(u.vx,u.vz)>4&&(u.y>.25||u.vy>0))consider(b.units[launch.source],u,18,'launch');
  if(u.hp<=0)continue;const a=u.action;
  const chain=u.directorChain;if(chain&&t-chain.time<1.5)consider(u,b.units[chain.target],12+Math.min(3,chain.count-2),'combo');
  if(a?.kind==='grapple'&&a.captured!=null){const v=b.units[a.captured],aim=b.units[a.throwAim?.target];consider(u,v,15,'throw',aim);}
  if(u.groundThrow||u.thrownBy!=null){const source=b.units[u.groundThrow?.source??u.thrownBy];consider(source,u,16,'throw',b.units[u.groundThrow?.target??u.throwImpact?.target]);}
  if(u.buffActive&&u.buffUntil-t>BUFFS[u.team].duration-1.1)consider(u,b.units[u.target],10,'buff');
  if(a?.kind==='tail'&&a.defensive)consider(u,b.units[a.target??u.target],11,'parry');
  else if(u.parry>0&&t-(u.lastBucketParryAt??-Infinity)<.45)consider(u,b.units[u.target],10,'parry');
 }
 const stride=Math.max(1,Math.ceil(b.units.length/96));
 for(let i=0;i<b.units.length;i+=stride){
  const u=b.units[i],a=u.action,v=b.units[a?.target??u.target];if(!a||a.age/a.duration<.08||a.age/a.duration>.83||a.missed)continue;
  let score=a.kind==='pounce'?8:a.kind==='spin'?7:a.kind==='tail'?5:3;if(a.evasion)score-=2;if(u.buffActive)score++;if(u.parry>0||v?.parry>0)score+=2;
  if(v&&Math.min(u.hp/u.maxHp,v.hp/v.maxHp)<.25)score+=2;if(r.directorLastActor===u.id)score-=2.5;consider(u,v,score,a.kind);
 }
 if(active&&(!best||best.score<active.score+3+crowd*3+mass*3||now-active.realStarted<3000+crowd*2000+mass*2500))return active;
 if(!best||!active&&best.score<10&&t<(r.directorNextAt||0))return active;
 const {u,v,kind,extra}=best,units=[u,v];if(extra?.hp>0&&extra.id!==v.id&&extra.id!==u.id&&Math.hypot(extra.x-v.x,extra.z-v.z)<22)units.push(extra);
 if(kind==='launch')r.directorLaunchSeen=v.id+':'+v.directorLaunch.time;
 const xs=units.map(u=>u.x),zs=units.map(u=>u.z),span=Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs));r.directorLastActor=u.id;
 r.directorShot={ids:units.map(u=>u.id),kind,score:best.score,x:xs.reduce((a,b)=>a+b,0)/units.length,z:zs.reduce((a,b)=>a+b,0)/units.length,viewX:Number.isFinite(r.focusX)?r.focusX:xs.reduce((a,b)=>a+b,0)/units.length,viewZ:Number.isFinite(r.focusZ)?r.focusZ:zs.reduce((a,b)=>a+b,0)/units.length,started:t,until:t+(kind==='throw'||kind==='launch'||kind==='combo'?4.5:3.2),realStarted:now,realUntil:now+(best.score>=10?2400:1400)+crowd*2000+mass*1500,yaw:Math.atan2(v.z-u.z,v.x-u.x)+Math.PI/2,side:(u.id+v.id)%2?1:-1,zoomFactor:clamp(1.55-span*.025,1.05,1.5-crowd*.25-mass*.1),elev:kind==='pounce'?.72:kind==='spin'||kind==='throw'||kind==='launch'?.66:.48};
 return r.directorShot;
}
export function applyDynamicMotion(r,shot){
 const now=performance.now(),dt=clamp((now-(r.directorFrameAt??now))/1000,0,.05);r.directorFrameAt=now;
 if(shot&&!r.directorHome)r.directorHome={yaw:r.yaw,elev:r.elev};
 const home=r.directorHome;if(!home)return;
 const phase=shot?clamp((r.battle.time-shot.started)/(shot.until-shot.started),0,1):0;
 // A short orbit reveals the contact angle; no sudden cuts or full rotations.
 // Crowded battles keep the viewer's orientation: smaller, slower turns and height changes.
 const crowd=crowdOf(r.battle),mass=massOf(r.battle),turn=.65-crowd*.42-mass*.1;
 const goal=shot?home.yaw+clamp(angle(shot.yaw-home.yaw),-turn,turn)+shot.side*(phase-.5)*.28*(1-crowd*.7-mass*.2):home.yaw;
 const elevation=shot?home.elev+(shot.elev-home.elev)*(1-crowd*.6-mass*.25):home.elev,ease=1-Math.exp(-dt*(shot?3.8-crowd*1.8-mass*.8:4.5-crowd*2-mass));
 r.yaw+=angle(goal-r.yaw)*ease;r.elev+=(elevation-r.elev)*ease;
 if(!shot&&Math.abs(angle(home.yaw-r.yaw))<.002&&Math.abs(home.elev-r.elev)<.002)r.directorHome=null;
}

// Smooth zoom in log space. Brief changes cannot repeatedly reverse the lens.
export function directorZoom(r,desired,now=performance.now()){
 const key=r.cameraMode==='field'?'field'+(r.fieldSide||1):'overview';
 let state=r.directorZoomState;
 if(!state||state.key!==key)state=r.directorZoomState={key,target:r.zoom,last:now,velocity:0,direction:0,pending:0,pendingSince:now};
 const dt=clamp((now-state.last)/1000,0,.05);state.last=now;
 if(!Number.isFinite(desired)||desired<=0)return r.zoom;
 const difference=Math.log(desired/r.zoom),direction=Math.abs(difference)<.045?0:Math.sign(difference);
 if(direction&&direction!==state.direction){
  if(state.pending!==direction){state.pending=direction;state.pendingSince=now;}
  if(!state.direction||now-state.pendingSince>=1800){state.direction=direction;state.pending=0;}
 }else{state.pending=0;state.pendingSince=now;}
 if(direction&&direction===state.direction)state.target=Math.exp(Math.log(state.target)+(Math.log(desired)-Math.log(state.target))*(1-Math.exp(-dt*.65)));
 else state.target=r.zoom;
 const error=Math.log(state.target/r.zoom),wanted=clamp(error*.9,-.18,.18),acceleration=.14*dt;
 state.velocity+=clamp(wanted-state.velocity,-acceleration,acceleration);
 const step=state.velocity*dt;
 if(Math.abs(step)>Math.abs(error)&&Math.sign(step)===Math.sign(error)){state.velocity=0;return state.target;}
 return r.zoom*Math.exp(step);
}

// Evaluate both physical cameras before choosing a close shot.
function comfortableField(r,units,side,live=false){
 const saved=r.cameraViews?.['field'+side]||{yaw:side===1?.8+Math.PI:.8,elev:.48,zoom:1};
 const candidate=live?r:{...r,...saved,fieldSide:side,zoom:1.25,focusX:units.reduce((sum,u)=>sum+u.x,0)/units.length,focusZ:units.reduce((sum,u)=>sum+u.z,0)/units.length};
 const view=fieldView(candidate),points=[];let largest=0;
 for(const u of units){
  const scale=u.scale||1,box=[];
  for(const dx of [-4.5,4.5])for(const dz of [-4.5,4.5])for(const y of [.1,6.5])box.push(projectField(view,u.x+dx*scale,u.y+y*scale,u.z+dz*scale));
  if(box.some(p=>!p.visible))return null;
  largest=Math.max(largest,Math.max(...box.map(p=>p.y))-Math.min(...box.map(p=>p.y)));points.push(...box);
 }
 const left=Math.min(...points.map(p=>p.x)),right=Math.max(...points.map(p=>p.x)),top=Math.min(...points.map(p=>p.y)),bottom=Math.max(...points.map(p=>p.y));
 if(largest>r.height*.58||left<r.width*.06||right>r.width*.94||top<r.height*.06||bottom>r.height*.9)return null;
 return largest/r.height;
}
// Prefer wide coverage between close fights. Dwell times use real seconds even at 4x.
export function updateDynamicView(r,now=performance.now()){
 if(!r.director||!r.follow||r.followId!==null||r.selectedId!=null||r.battle.done||!r.battle.tick)return;
 let state=r.directorViewState;
 if(!state||state.battle!==r.battle)state=r.directorViewState={battle:r.battle,changed:now,lastTime:r.battle.time,lastClose:now};
 if(state.pending&&now>=state.pending.at){const p=state.pending;state.pending=null;switchView(r,state,p,now);}
 if(state.lastTime===r.battle.time)return;state.lastTime=r.battle.time;
 if(now<(r.directorManualUntil||0))return;
 const shot=updateDynamicDirector(r),units=shot?.ids.map(id=>r.battle.units[id]);
 const close=units?.length>=2&&units.every(u=>u?.hp>0)&&Math.hypot(units[0].x-units[1].x,units[0].z-units[1].z)<14;
 if(close)state.lastClose=now;
 if(now<(state.nextGeometryAt||0))return;state.nextGeometryAt=now+300;
 const age=now-state.changed;
 let bestSide=null,bestSize=Infinity;
 if(close)for(const side of [1,2]){const size=comfortableField(r,units,side);if(size!==null&&size<bestSize){bestSide=side;bestSize=size;}}
 const tooClose=r.cameraMode==='field'&&close&&comfortableField(r,units,r.fieldSide||1,true)===null;
 if(tooClose)state.unsafeSince??=now;else state.unsafeSince=null;
 let next=null,nextSide=bestSide;
 if(r.cameraMode==='field'){
  if(age>=4500&&state.unsafeSince!=null&&now-state.unsafeSince>1500){
   const other=(r.fieldSide||1)===1?2:1;
   if(comfortableField(r,units,other)!==null){next='field';nextSide=other;}else next='overview';
  }else if(age>=12000&&now-state.lastClose>4000)next='overview';
 // Crowded battles (about 28+ alive) stay on the overview: a cut to the close camera is the harshest change.
 }else if(crowdOf(r.battle)<.6&&age>=9000+crowdOf(r.battle)*8000&&close&&bestSide!==null)next='field';
 if(!next||state.pending)return;
 // Dissolve through a short dip instead of a hard cut; the view changes at the darkest moment.
 const live=units?.filter(u=>u?.hp>0)||[];
 state.pending={next,side:nextSide,x:live.length?live.reduce((s,u)=>s+u.x,0)/live.length:shot?.x,z:live.length?live.reduce((s,u)=>s+u.z,0)/live.length:shot?.z,at:now+230};
 r.canvas?.animate?.([{opacity:1},{opacity:.15,offset:.45},{opacity:.15,offset:.55},{opacity:1}],{duration:520,easing:'ease-in-out'});
}
function switchView(r,state,{next,side,x,z},now){
 if(!r.director||r.battle.done)return;
 r.directorHome=null;r.directorFrameAt=now;r.directorZoomState=null;
 if(next==='field'){
  if(r.cameraMode==='field')r.selectFieldCamera();
  else{r.fieldSide=side;r.setCameraMode('field');}
  r.zoom=1.25;if(Number.isFinite(x)){r.focusX=x;r.focusZ=z;}r.fieldProjection=null;
 }else r.setCameraMode(next);
 state.changed=now;state.unsafeSince=null;
}
