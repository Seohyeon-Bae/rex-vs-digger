const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));
// Only live combatants may anchor automatic shots. Sampling bounds large-battle work.
export function updateDynamicDirector(r){
 const b=r.battle,t=b.time;
 if(r.directorBattle!==b){r.directorBattle=b;r.directorShot=null;r.directorScanAt=0;r.directorNextAt=0;r.directorHome=null;}
 if(b.done||!b.alive.rex||!b.alive.dig){r.directorShot=null;return null;}
 const active=r.directorShot;
 if(active){
  const units=active.ids.map(id=>b.units[id]).filter(u=>u?.hp>0);
  if(units.length<2){r.directorShot=null;r.directorNextAt=t+.25;r.directorReturnUntil=t+.7;}
  else if(t<active.until){active.x=units.reduce((s,u)=>s+u.x,0)/units.length;active.z=units.reduce((s,u)=>s+u.z,0)/units.length;return active;}
  else{r.directorShot=null;r.directorNextAt=t+1.2;r.directorReturnUntil=t+.9;}
 }
 if(t<(r.directorNextAt||0)||t<(r.directorScanAt||0))return null;
 r.directorScanAt=t+.22;
 let best=null,bestScore=0;
 const stride=Math.max(1,Math.ceil(b.units.length/96));
 for(let i=0;i<b.units.length;i+=stride){
  const u=b.units[i],a=u.action,v=b.units[a?.target??u.target];
  if(u.hp<=0||!a||!v||v.hp<=0||v.team===u.team||Math.hypot(u.x-v.x,u.z-v.z)>18)continue;
  const phase=a.age/a.duration;if(phase<.08||phase>.83||a.missed)continue;
  let score=a.kind==='grapple'&&a.captured!=null?10:a.kind==='pounce'?8:a.kind==='spin'?7:a.kind==='tail'?5:3;
  if(a.evasion)score-=2;if(u.buffActive)score+=1;if(u.parry>0||v.parry>0)score+=2;
  if(Math.min(u.hp/u.maxHp,v.hp/v.maxHp)<.25)score+=2;
  if(u.lastContact?.target===v.id&&t-u.lastContact.time<.8)score+=1.5;
  if(r.directorLastActor===u.id)score-=2.5;
  if(score>bestScore){bestScore=score;best={u,v,a};}
 }
 if(!best)return null;
 const {u,v,a}=best,span=Math.hypot(u.x-v.x,u.z-v.z),side=((u.id+v.id)%2?1:-1);
 r.directorLastActor=u.id;
 r.directorShot={ids:[u.id,v.id],x:(u.x+v.x)/2,z:(u.z+v.z)/2,started:t,until:t+(a.kind==='grapple'?1.8:1.5),yaw:Math.atan2(v.z-u.z,v.x-u.x)+Math.PI/2,side,zoomFactor:clamp(2.35-span*.055,1.4,2.2),elev:a.kind==='pounce'?.72:a.kind==='spin'?.66:.48};
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
