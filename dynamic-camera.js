import {BUFFS} from './buffs.js';
import {fieldView,projectField} from './field-camera.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
// Only live combatants may anchor automatic shots. Sampling bounds large-battle work.
export function updateDynamicDirector(r){
 const b=r.battle,t=b.time,now=performance.now();
 const visible=u=>u&&(u.hp>0||u.directorLaunch&&t-u.directorLaunch.time<.9&&u.y>.2);
 if(r.directorBattle!==b){r.directorBattle=b;r.directorShot=null;r.directorScanAt=0;r.directorNextAt=0;r.directorHome=null;r.directorZoomState=null;r.directorLaunchSeen=null;}
 if(b.done){r.directorShot=null;return null;}
 let active=r.directorShot;
 if(active?.kind==='launch'){
  const victim=b.units[active.ids[1]],ended=!victim||t-victim.directorLaunch?.time>1.8||(victim.y<.25&&victim.vy<=0)||Math.hypot(victim.vx,victim.vz)<3;
  if(ended){r.directorShot=null;active=null;r.directorNextAt=0;r.directorScanAt=0;}
 }

 if(active){const units=active.ids.map(id=>b.units[id]).filter(visible);if(units.length<2){r.directorShot=null;active=null;r.directorNextAt=t+.25;}else if(t<active.until||now<active.realUntil){active.x=units.reduce((s,u)=>s+u.x,0)/units.length;active.z=units.reduce((s,u)=>s+u.z,0)/units.length;}else{r.directorShot=null;active=null;r.directorNextAt=t+1.2;}}
 if(t<(r.directorScanAt||0))return active;
 r.directorScanAt=t+.22;
 let best=null,bestScore=0;
 const consider=(u,v,score,kind,extra=null)=>{if(!u||!v||u.hp<=0||!visible(v)||u.team===v.team||Math.hypot(u.x-v.x,u.z-v.z)>30)return;if(score>bestScore){bestScore=score;best={u,v,score,kind,extra};}};
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
 if(active&&(!best||best.score<active.score+3||now-active.realStarted<2200))return active;
 if(!best||!active&&best.score<10&&t<(r.directorNextAt||0))return active;
 const {u,v,kind,extra}=best,units=[u,v];if(extra?.hp>0&&extra.id!==v.id&&extra.id!==u.id&&Math.hypot(extra.x-v.x,extra.z-v.z)<22)units.push(extra);
 if(kind==='launch')r.directorLaunchSeen=v.id+':'+v.directorLaunch.time;
 const xs=units.map(u=>u.x),zs=units.map(u=>u.z),span=Math.hypot(Math.max(...xs)-Math.min(...xs),Math.max(...zs)-Math.min(...zs));r.directorLastActor=u.id;
 r.directorShot={ids:units.map(u=>u.id),kind,score:best.score,x:xs.reduce((a,b)=>a+b,0)/units.length,z:zs.reduce((a,b)=>a+b,0)/units.length,started:t,until:t+(kind==='throw'||kind==='launch'||kind==='combo'?4.5:3.2),realStarted:now,realUntil:now+(best.score>=10?2400:1400),yaw:Math.atan2(v.z-u.z,v.x-u.x)+Math.PI/2,side:(u.id+v.id)%2?1:-1,zoomFactor:clamp(1.55-span*.025,1.05,1.5),elev:kind==='pounce'?.72:kind==='spin'||kind==='throw'||kind==='launch'?.66:.48};
 return r.directorShot;
}
export function applyDynamicMotion(r,shot){
 const now=performance.now(),dt=clamp((now-(r.directorFrameAt??now))/1000,0,.05);r.directorFrameAt=now;
 if(shot&&!r.directorHome)r.directorHome={yaw:r.yaw,elev:r.elev};
 const home=r.directorHome;if(!home)return;
 const phase=shot?clamp((r.battle.time-shot.started)/(shot.until-shot.started),0,1):0;
 // A short orbit reveals the contact angle; no sudden cuts or full rotations.
 const goal=shot?home.yaw+clamp(angle(shot.yaw-home.yaw),-.65,.65)+shot.side*(phase-.5)*.28:home.yaw;
 const elevation=shot?shot.elev:home.elev,ease=1-Math.exp(-dt*(shot?3.8:4.5));
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
  if(age>=3000&&state.unsafeSince!=null&&now-state.unsafeSince>1200){
   const other=(r.fieldSide||1)===1?2:1;
   if(comfortableField(r,units,other)!==null){next='field';nextSide=other;}else next='overview';
  }else if(age>=10000&&now-state.lastClose>4000)next='overview';
 }else if(age>=7000&&close&&bestSide!==null)next='field';
 if(!next)return;
 r.directorHome=null;r.directorFrameAt=now;r.directorZoomState=null;
 if(next==='field'){
  if(r.cameraMode==='field')r.selectFieldCamera();
  else{r.fieldSide=nextSide;r.setCameraMode('field');}
  r.zoom=1.25;r.focusX=shot.x;r.focusZ=shot.z;r.fieldProjection=null;
 }else r.setCameraMode(next);
 state.changed=now;state.unsafeSince=null;
}
