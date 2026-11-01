const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const ROLL={attackDuration:2.3,evasionDuration:2.4,attackTravel:18,evasionTravel:26,pushRadius:4,waveRadius:6,pushTargets:12};
function disperse(b,u,hits,finish){
 const a=u.action;a.rollPushedIds??=new Set();let pushed=0;const radius=finish?ROLL.waveRadius:ROLL.pushRadius;
 for(const v of b.nearby(u.x,u.z,radius+2)){
  if(v.team===u.team||v.hp<=0||v.heldBy!==null||Math.abs(v.y-u.y)>2.5||!finish&&a.rollPushedIds.has(v.id))continue;
  const distance=Math.hypot(v.x-u.x,v.z-u.z);if(distance>radius)continue;
  if(finish&&a.rollContacts?.get(v.id)?.finished)continue;
  if(!finish&&a.rollPushedIds.size>=ROLL.pushTargets||pushed>=ROLL.pushTargets)break;
  if(!finish)a.rollPushedIds.add(v.id);pushed++;
  hits.push({source:u,target:v,attackToken:a,kind:'pounce',technique:'pounce',damage:0,side:a.side,critical:false,parryable:!finish,rollTick:true,impactScale:finish?1.4*Math.max(.4,1-distance/radius*.6):.8,launchOverride:finish?2:1,stagger:finish?.1:.06});
 }
 if(finish){if(b.rollWaveTick!==b.tick){b.rollWaveTick=b.tick;b.rollWaveCount=0;}if((b.rollWaveCount||0)<24){b.rollWaveCount=(b.rollWaveCount||0)+1;b.effects.push({x:u.x,y:.1,z:u.z,kind:'roll-wave',radius:ROLL.waveRadius,strength:1,life:.32,max:.32,team:'rex'});}}
}
// A roll has one shared damage budget: three small contacts and one finishing impact.
export function rollContacts(b,u,hits,finish=false){
 const a=u.action;if(!a||u.hp<=0||u.stun>.25||u.heldBy!==null||u.y>.5)return;
 if(finish&&a.rollFinished)return;if(finish)a.rollFinished=true;
 a.rollHitIds??=new Set();a.rollContacts??=new Map();
 const yaw=a.rollYaw??a.yaw,ca=Math.cos(yaw),sa=Math.sin(yaw);
 for(const v of b.nearby(u.x,u.z,6)){
  if(v.team===u.team||v.hp<=0||v.heldBy!==null||Math.abs(v.y-u.y)>2.2)continue;
  const dx=v.x-u.x,dz=v.z-u.z,t=clamp(dx*ca+dz*sa,-1.4,1.4),radius=(u.stats.radius+v.stats.radius)*.8;
  if((dx-ca*t)**2+(dz-sa*t)**2>radius*radius)continue;
  let contact=a.rollContacts.get(v.id);
  if(!contact){if(a.rollHitIds.size>=5)continue;contact={ticks:0,nextAt:0,finished:false};a.rollContacts.set(v.id,contact);a.rollHitIds.add(v.id);a.rollPrimaryId??=v.id;}
  if(finish?contact.finished:contact.ticks>=3||b.time+1e-8<contact.nextAt)continue;
  if(finish)contact.finished=true;else{contact.ticks++;contact.nextAt=b.time+.25;}
  const factor=v.id===a.rollPrimaryId?1:.1;
  a.rollSpeedScale=Math.min(a.rollSpeedScale??1,.48);a.rollImpactAt=a.age;
  if(contact.ticks===1&&!finish){u.vx*=.65;u.vz*=.65;}
  hits.push({source:u,target:v,attackToken:a,kind:finish?'pounce':'leap',technique:'pounce',damage:u.stats.damage*(finish?.6:.2)*factor,side:a.side,critical:false,parryable:true,rollTick:!finish,rollFinisher:finish,impactScale:finish?(factor<1?.7:1.6):.08,launchOverride:finish?2.5:0,stagger:finish?(factor<1?.08:.3):.025});
 }
 disperse(b,u,hits,finish);
}
