// Rendering snapshots only: the authoritative Battle and RNG stay inside the worker.
export const NUMBERS=['x','y','z','vx','vy','vz','yaw','pitch','roll','walk','speed','hp','hit','stun','cool','parry','parryCooldown','buffUntil','deadAt','heldBy','target','guardUntil','guardHeight','guardReach','guardSlew','hardStunUntil','headDownFor','deathSide','attack','parrySide','kills','assists','damageDealt','attackCount','buffUses','ramLockedUntil','guardBlocks','guardFatigueUntil','lastBucketParryAt','lastTailParryAt','guardBrokenUntil','thrownBy'];
const NULLABLE=new Set(['deadAt','heldBy','target','thrownBy']);
const FLAGS=['buffActive','moving','counterFall','jawLaunched'];
const EXTRAS=['armPose','aerialAttack','groundThrow','nextTechniqueAt','ramRechargeEnds','tailRechargeEnds','directorChain','directorLaunch','lastContact','throwImpact','techniqueUses'];
const DETAIL_KEYS=[...FLAGS,...EXTRAS];
const PREVIOUS=['px','py','pz','prevPitch','prevRoll','prevHit','prevSpeed','prevParry','prevHeadDown'];
const CURRENT=['x','y','z','pitch','roll','hit','speed','parry','headDownFor'];
const HEADERS=['time','tick','done','winner','combatTime','damage','parries','parryAttempts','impacts','explosions','aerialCounters','aerialCounterAttempts','friendlyFire','landings','peakAir','quake','hitStopSerial','logDropped'];
export function createWireState(){return{actions:new WeakMap(),effects:new WeakMap(),nextAction:1,nextEffect:1,logCursor:0};}
export function packBattle(b,wire){
 const numbers=new Float64Array(b.units.length*NUMBERS.length),details=[];
 for(const u of b.units){
  const base=u.id*NUMBERS.length;for(let j=0;j<NUMBERS.length;j++)numbers[base+j]=typeof u[NUMBERS[j]]==='number'?u[NUMBERS[j]]:NaN;
  const extra={};for(const key of DETAIL_KEYS)extra[key]=u[key]??null;
  if(u.action){let id=wire.actions.get(u.action);if(!id){id=wire.nextAction++;wire.actions.set(u.action,id);}extra.action={id,value:u.action};}else extra.action=null;
  details.push(extra);
 }
 const state={};for(const key of HEADERS)state[key]=b[key];
 const effects=b.effects.map(value=>{let id=wire.effects.get(value);if(!id){id=wire.nextEffect++;wire.effects.set(value,id);}return{id,value};});
 const logOffset=Math.max(wire.logCursor,b.logDropped),log=b.log.slice(logOffset-b.logDropped);wire.logCursor=b.logDropped+b.log.length;
 return{state,numbers,details,effects,particles:b.particles,scorches:b.scorches,events:b.events,log,logOffset,
  groups:[...b.squadState.values()].map(g=>({id:g.id,x:g.x,z:g.z,members:g.members.map(u=>u.id)})),directorCandidates:b.directorCandidates||new Map(),
  settled:b.done&&b.time-b.combatTime>2};
}
export function applyBattle(b,packet,alpha=1){
 const previousTime=b.time,dt=Math.max(1/30,packet.state.time-previousTime),old=new Float64Array(13);
 for(const u of b.units){
  for(let j=0;j<PREVIOUS.length;j++){const prior=u[PREVIOUS[j]]??u[CURRENT[j]]??0;old[j]=prior+((u[CURRENT[j]]??0)-prior)*alpha;}
  old[9]=(u.prevYaw??u.yaw)+Math.atan2(Math.sin(u.yaw-(u.prevYaw??u.yaw)),Math.cos(u.yaw-(u.prevYaw??u.yaw)))*alpha;
  const hadArm=!!u.armPose;
  if(hadArm){old[10]=(u.prevArmX??u.armPose.x)+(u.armPose.x-(u.prevArmX??u.armPose.x))*alpha;old[11]=(u.prevArmY??u.armPose.y)+(u.armPose.y-(u.prevArmY??u.armPose.y))*alpha;old[12]=(u.prevArmSlew??u.armPose.slew)+(u.armPose.slew-(u.prevArmSlew??u.armPose.slew))*alpha;}
  const base=u.id*NUMBERS.length;for(let j=0;j<NUMBERS.length;j++){const key=NUMBERS[j],value=packet.numbers[base+j];if(Number.isNaN(value)){if(NULLABLE.has(key))u[key]=null;else delete u[key];}else u[key]=value;}
  const extra=packet.details[u.id];for(const key of FLAGS)u[key]=!!extra[key];for(const key of EXTRAS)u[key]=extra[key];
  if(extra.action){if(u.remoteActionId!==extra.action.id)u.action={};Object.assign(u.action,extra.action.value);u.remoteActionId=extra.action.id;}else{u.action=null;u.remoteActionId=null;}
  for(let j=0;j<PREVIOUS.length;j++)u[PREVIOUS[j]]=old[j];u.prevYaw=old[9];if(hadArm){u.prevArmX=old[10];u.prevArmY=old[11];u.prevArmSlew=old[12];}u.remoteMotionSpan=dt;
 }
 Object.assign(b,packet.state);b.remotePreviousTime=previousTime;b.remoteSnapshot=true;
 b.remoteEffects??=new Map();const ids=new Set();b.effects=packet.effects.map(e=>{ids.add(e.id);let value=b.remoteEffects.get(e.id);if(!value){value={};b.remoteEffects.set(e.id,value);}Object.assign(value,e.value);return value;});for(const id of b.remoteEffects.keys())if(!ids.has(id))b.remoteEffects.delete(id);
 b.particles=packet.particles;b.scorches=packet.scorches;b.events=packet.events;b.directorCandidates=packet.directorCandidates;
 if(b.remoteLogCursor==null||packet.logOffset>b.remoteLogCursor)b.log=[];
 b.log.push(...packet.log);if(b.log.length>2000)b.log.splice(0,b.log.length-2000);b.remoteLogCursor=packet.logOffset+packet.log.length;
 b.squadState=new Map(packet.groups.map(g=>[g.id,{...g,members:g.members.map(id=>b.units[id])}]));
 return packet.settled;
}
