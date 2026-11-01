import {rollContacts,ROLL} from './roll-contact.js';
import {BUFFS,buffReady,rageUnlimited} from './buffs.js';
import {advanceGroundThrow} from './ground-throw.js';
import {chooseThrowAim} from './throw-aim.js';
import {bucketContact,bucketWorld,updateBucketArm,bucketTurnSpeed} from './weapon-geometry.js';
import {tailTurn} from './combat-motion.js';
import {pressureDelay,sectorPriority,routeBudget} from './front-tactics.js';
import {normalizeTuning,moveTuning} from './battle-settings.js';
const unitLabel=u=>(u.team==='rex'?'티라노':'포크레인')+' #'+(u.teamNumber??u.id+1);
export const STEP = 1 / 30;
export const MAX_UNITS = 1000;
export const SPECS = {
  rex: { hp: 5800, armor:.13, damage: 480, period: 1.1, range: 4.8, speed: 8.8, radius: 1.65, mass: 1 },
  dig: { hp: 8800, armor:.23, damage: 180, period: 1.9, range: 7.8, speed: 4, radius: 1.9, mass: 2.15 }
};
export const EXPLOSION = Object.freeze({radius:10,damage:750,impulse:18});
export const CREW_LEVELS = Object.freeze([
  {label:'입문',attack:.9,speed:.82,accuracy:.65,reaction:.65,windup:1.25,recovery:1.3,turn:.6,critical:.04,parry:.05,parryCooldown:2.6},
  {label:'초급',attack:.95,speed:.9,accuracy:.75,reaction:.4,windup:1.15,recovery:1.18,turn:.78,critical:.07,parry:.1,parryCooldown:2.3},
  {label:'중급',attack:1,speed:.96,accuracy:.84,reaction:.22,windup:1.05,recovery:1.08,turn:.92,critical:.1,parry:.15,parryCooldown:2},
  {label:'숙련',attack:1.05,speed:1,accuracy:.93,reaction:.08,windup:1,recovery:1,turn:1,critical:.13,parry:.2,parryCooldown:1.7},
  {label:'전문가',attack:1.1,speed:1.08,accuracy:.98,reaction:.02,windup:.9,recovery:.87,turn:1.25,critical:.16,parry:.25,parryCooldown:1.4}
].map(level=>Object.freeze(level)));
const skillLevel=value=>{const n=Number(value);return value===null||value===undefined||value===''||!Number.isFinite(n)?4:Math.min(5,Math.max(1,Math.round(n)));};
export const crewProfile=value=>CREW_LEVELS[skillLevel(value)-1];
export function attackCriticalChance(unit,kind,config,time){
  const level=config[unit.team+'Skill'],base=crewProfile(level).critical;
  if(unit.team==='rex')return kind==='tail'?.55:base;
  if(unit.buffActive&&unit.buffUntil>time&&['smash','uppercut','sweep','spin','grapple','grip','throw'].includes(kind))return 1;
  if(!['smash','uppercut','sweep','spin'].includes(kind))return 0;
  const chance=['sweep','spin'].includes(kind)?Math.min(.5,base+.34*level/5):base;
  return chance;
}
export const TACTICS_LEVELS=Object.freeze([
 {awareness:0,interval:.85,label:'가까운 상대 추격'},
 {awareness:.25,interval:.65,label:'부상 상대 우선'},
 {awareness:.5,interval:.45,label:'방어 방향·빈틈 파악'},
 {awareness:.75,interval:.3,label:'우회 접근·상황별 기술 선택'},
 {awareness:1,interval:.2,label:'반격 타이밍·접근 경로 선택'}
].map(p=>Object.freeze(p)));
export const tacticalProfile=level=>TACTICS_LEVELS[skillLevel(level)-1];
export const TECHNIQUES=Object.freeze({
 rex:Object.freeze([
  {kind:'bite',name:'물기',level:1,weight:1,damage:1,targets:1,cooldown:0},
  {kind:'ram',name:'돌진',level:2,weight:.8,damage:1.6,targets:2,cooldown:2},
  {kind:'tail',name:'꼬리 휘두르기',level:3,weight:1.2,damage:1.65,targets:5,cooldown:2},
  {kind:'leap',name:'도약 공격',level:4,weight:1.2,damage:1.9,targets:4,cooldown:5},
  {kind:'pounce',name:'도약 구르기',level:5,weight:2,damage:2.2,targets:5,cooldown:8}
 ].map(t=>Object.freeze(t))),
 dig:Object.freeze([
  {kind:'smash',name:'버킷 내려치기',level:1,weight:1,damage:2,targets:2,cooldown:0},
  {kind:'sweep',name:'횡베기',level:2,weight:1,damage:2,targets:4,cooldown:1.5},
  {kind:'uppercut',name:'올려치기',level:3,weight:1,damage:1.2,targets:2,cooldown:3},
  {kind:'spin',name:'전방위 회전',level:4,weight:1.3,damage:3.4,targets:4,cooldown:5},
  {kind:'grapple',name:'붙잡아 던지기',level:5,weight:2,damage:.8,targets:1,cooldown:8}
 ].map(t=>Object.freeze(t)))
});
export {BUFFS};
export const SKILLS={rex:[...TECHNIQUES.rex,BUFFS.rex],dig:[...TECHNIQUES.dig,BUFFS.dig]};
export const availableTechniques=(team,level=5,tuning=null)=>TECHNIQUES[team].filter(t=>tuning?.moves?.[t.kind]?.enabled!==false);
export function guardStats(team,level,tuning=null){const p=crewProfile(5);return{chance:team==='rex'&&tuning?.moves?.tail?.enabled===false?0:tuning?.parryChance??p.parry*(team==='dig'?2:1),cooldown:p.parryCooldown*(team==='dig'?.85:1)*(tuning?.parryCooldown??1),reach:SPECS[team].range+(team==='dig'?2:1),arc:(team==='dig'?75:90)*Math.PI/180};}
export function unitStats(team,level,power=1,tuning=null){const b=SPECS[team],p=crewProfile(5);return{...b,explosionResistance:team==='dig'?.5:0,hp:b.hp*(tuning?.hp??1),damage:Math.round(b.damage*p.attack*power),speed:b.speed*p.speed*(tuning?.speed??1),armor:tuning?.armor??b.armor,period:b.period*p.recovery+p.reaction};}
export function seededRandom(seed) { let n=seed>>>0;return()=>{n+=0x6D2B79F5;let t=n;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;}; }
export function normalizeConfig(c={}) {return{rexSkill:5,digSkill:5,rex:Math.min(MAX_UNITS,Math.max(1,Math.round(Number(c.rex)||1))),dig:Math.min(MAX_UNITS,Math.max(1,Math.round(Number(c.dig)||1))),rexPower:Math.min(2,Math.max(.5,Number(c.rexPower)||1)),digPower:Math.min(2,Math.max(.5,Number(c.digPower)||1)),seed:Math.min(999999,Math.max(1,Math.round(Number(c.seed)||2026))),tuning:normalizeTuning(c.tuning),formation:['faction','line','wedge','scatter'].includes(c.formation)?c.formation:'faction'};}
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
// A rebuilt uniform grid narrows broad-phase searches; exact hit tests stay unchanged.
export class SpatialGrid {
  constructor(units,size=8){this.size=size;this.cells=new Map();this.queryCache=new Map();for(const u of units){const key=this.key(Math.floor(u.x/size),Math.floor(u.z/size));let cell=this.cells.get(key);if(!cell)this.cells.set(key,cell=[]);cell.push(u);}}
  key(x,z){return x*65536+z;}
  query(x,z,r,team=null,ordered=true){const s=this.size,x0=Math.floor((x-r)/s),x1=Math.floor((x+r)/s),z0=Math.floor((z-r)/s),z1=Math.floor((z+r)/s),key=ordered?[x0,x1,z0,z1,team||''].join(':'):null,cached=ordered?this.queryCache.get(key):null;if(cached)return cached;const out=[];for(let a=x0;a<=x1;a++)for(let b=z0;b<=z1;b++){const cell=this.cells.get(this.key(a,b));if(cell)for(const u of cell)if(!team||u.team===team)out.push(u);}if(ordered){out.sort((a,b)=>a.id-b.id);if(this.queryCache.size<4096)this.queryCache.set(key,out);}return out;}
}
export class Battle {
  constructor(config) {
    this.config=normalizeConfig(config);this.rng=seededRandom(this.config.seed);this.fxRng=seededRandom(this.config.seed^0x51f297);this.tacticRng=seededRandom(this.config.seed^0x7a31bd);
    this.time=0;this.tick=0;this.done=false;this.winner=null;this.combatTime=null;this.damage={rex:0,dig:0};this.events=[];this.log=[];this.logDropped=0;this.effects=[];this.particles=[];this.trails=[];this.units=[];this.squads=[];this.squadState=new Map();this.impacts=0;this.parries={rex:0,dig:0};this.hitStopSerial=0;this.parryAttempts={rex:0,dig:0};this.explosions=0;this.aerialCounters=0;this.aerialCounterAttempts=0;this.explosionQueue=[];this.scorches=[];this.friendlyFire=0;this.landings=0;this.peakAir=0;this.quake=0;
    this.radius=Math.max(36,Math.sqrt(this.config.rex+this.config.dig)*5.4);this.spawn('rex');this.spawn('dig');for(const u of this.units)this.radius=Math.max(this.radius,Math.abs(u.x)+18,Math.abs(u.z)+18);for(const team of ['rex','dig']){const units=this.units.filter(u=>u.team===team),back=team==='rex'?Math.min(...units.map(u=>u.x)):Math.max(...units.map(u=>u.x)),desired=team==='rex'?-this.radius+9:this.radius-6,shift=desired-back;for(const u of units){u.x+=shift;u.px=u.x;}}this.assignMissions();this.event('양 팀 배치 완료');
  }
  brain(team){const intelligence=this.config.tuning[team].intelligence;return{awareness:.25+.75*intelligence,interval:.65-.45*intelligence};}
  formationSlots(team,count){
    const slots=[],groups=Math.ceil(count/40);
    if(count<=40){
      for(let i=0;i<count;i++){let x,z;if(team==='rex'){const row=Math.floor(Math.sqrt(i)),width=Math.min(2*row+1,count-row*row);x=-12-row*5.2;z=(i-row*row-(width-1)/2)*5.2;}else{const width=Math.min(count,Math.ceil(Math.sqrt(count)*1.7)),row=Math.floor(i/width),rowWidth=Math.min(width,count-row*width),half=Math.max(5.8,(width-1)*2.9);z=(i%width-(rowWidth-1)/2)*5.8+(row%2?.5:0)*5.8;x=16+row*6.2-Math.min(8,half*.12)*(z/half)**2;}slots.push({x,z});}
    }else if(team==='rex'){
      // Three connected thrusts: a central spear, swept wings and a deeper rear body.
      const largeFormation=clamp((count-80)/240,0,1),columns=Math.ceil(Math.sqrt(count)*(1.5+.2*largeFormation)),weights=Array.from({length:columns},(_,col)=>.8+.2*Math.cos(Math.PI*(col-(columns-1)/2)/((columns-1)/2))),total=weights.reduce((a,b)=>a+b,0),half=(columns-1)*2.6;let used=0,cumulative=0;
      for(let col=0;col<columns;col++){cumulative+=weights[col];const depth=Math.round(count*cumulative/total)-used;used+=depth;const z=(col-(columns-1)/2)*5.2,n=z/half,front=-14-Math.min(16,half*.16)*(1-Math.cos(n*Math.PI*2))+(-12+18*largeFormation)*Math.abs(n)+largeFormation*(5*(1-Math.abs(n))**3+3*Math.abs(n)**3);
        for(let row=0;row<depth;row++)slots.push({x:front-row*5.2,z});
      }
    }else{
      // Broad staggered ranks form an angular block with clipped outer corners.
      const rows=Math.ceil(Math.sqrt(count*(team==='rex'?.8:.42))),weights=Array.from({length:rows},(_,i)=>{const t=i/(rows-1);return team==='rex'?.12+.88*Math.sin(Math.PI*t*.8):1-.27*t;}),total=weights.reduce((a,b)=>a+b,0);let used=0,cumulative=0;
      const maxWidth=Math.ceil(count/total*Math.max(...weights)),half=Math.max(6,(maxWidth-1)*2.85);
      for(let row=0;row<rows;row++){cumulative+=weights[row];const width=Math.round(count*cumulative/total)-used,t=row/(rows-1);used+=width;
        for(let col=0;col<width;col++){const z=(col-(width-1)/2)*(team==='rex'?5.2:6.3)+(row%2?2.1:0),x=team==='rex'?-12-row*5.2+Math.abs(z)*.18*Math.sin(Math.PI*t):16+row*6.25+Math.min(6,half*.08)*clamp((Math.abs(z)/(half*6.3/5.7)-.75)/.25,0,1);slots.push({x,z});}
      }
    }
    // Partition contiguous positions internally; no physical gaps between squadrons.
    const partition=(points,n)=>{if(n===1){const x=points.reduce((sum,p)=>sum+p.x,0)/points.length,z=points.reduce((sum,p)=>sum+p.z,0)/points.length,id=this.squads.length,span=Math.max(...slots.map(p=>Math.abs(p.z))),rear=team==='rex'?x<-12-Math.sqrt(count)*2.9:x>16+Math.sqrt(count)*2.3,role=Math.abs(z)>span*.38?'wing':rear?'reserve':'center';
      this.squads.push({id,team,laneZ:z,split:groups>1,role,initialSize:points.length,objective:null,nextOrderAt:0,mergedInto:null,commander:{leaderId:null,mode:'advance',side:Math.sign(z)||(id%2?1:-1),lateral:0}});for(const point of points){point.squadId=id;point.offsetZ=point.z-z;}return;}
      const xs=points.map(p=>p.x),zs=points.map(p=>p.z),axis=Math.max(...xs)-Math.min(...xs)>Math.max(...zs)-Math.min(...zs)?'x':'z',left=Math.floor(n/2),cut=Math.round(points.length*left/n),ordered=[...points].sort((a,b)=>a[axis]-b[axis]||a.x-b.x||a.z-b.z);partition(ordered.slice(0,cut),left);partition(ordered.slice(cut),n-left);};
    partition(slots,groups);return slots;
  }
  spawn(team) {
    const count=this.config[team],cols=Math.ceil(Math.sqrt(count)),sign=team==='rex'?-1:1,s=unitStats(team,this.config[team+'Skill'],this.config[team+'Power'],this.config.tuning[team]),slots=this.config.formation==='faction'?this.formationSlots(team,count):null;
    for(let i=0;i<count;i++) {let x,z;
      if(slots){({x,z}=slots[i]);}else{
        const col=i%cols,row=Math.floor(i/cols);x=sign*(12+row*4.9);z=(col-(cols-1)/2)*4.9;
        if(this.config.formation==='wedge')x+=sign*Math.abs(col-(cols-1)/2)*2.2;
        if(this.config.formation==='scatter'){x+=(this.rng()-.5)*3;z+=(this.rng()-.5)*3;}
      }
      this.units.push({id:this.units.length,teamNumber:i+1,team,stats:s,squadId:slots?.[i].squadId??null,formationOffsetZ:slots?.[i].offsetZ??0,traits:this.makeTraits(),plan:null,nextPlanAt:0,heldBy:null,thrownBy:null,attackHistory:[],nextTechniqueAt:{},counterFall:false,parry:0,parryCooldown:0,parrySide:1,opening:0,x:x+(this.rng()-.5)*.6,z:z+(this.rng()-.5)*.6,y:0,px:x,pz:z,py:0,yaw:team==='rex'?0:Math.PI,prevYaw:team==='rex'?0:Math.PI,vx:0,vz:0,vy:0,roll:0,pitch:0,prevRoll:0,prevPitch:0,rollV:0,pitchV:0,hp:s.hp,maxHp:s.hp,cool:this.rng()*s.period,reactionWait:crewProfile(this.config[team+'Skill']).reaction,attack:0,action:null,aerialAttack:null,attackCount:0,hit:0,walk:this.rng()*6.28,deadAt:null,kills:0,assists:0,damageDealt:0,target:null,moving:false,stun:0,charge:0,runUp:0,runYaw:team==='rex'?0:Math.PI,speed:0,decision:0,intent:'approach',scale:.92+this.rng()*.16,side:i%2?1:-1,deathSide:i%2?1:-1,exploded:false,distMoved:0});
    }
  }
  assignMissions(){
    const wings=this.squads.filter(g=>g.team==='rex');for(const g of this.squads)g.mission=g.team==='rex'?'pressure':'defend';
    if(wings.length<2)return;const count=Math.min(wings.length-1,Math.max(2,Math.round(wings.length*.45*this.config.tuning.rex.flank)));
    wings.sort((a,b)=>Math.abs(b.laneZ)-Math.abs(a.laneZ)||a.id-b.id);
    const span=Math.max(1,...wings.map(g=>Math.abs(g.laneZ)));for(const g of wings)g.commander.pressureDelay=pressureDelay(this.config,g.laneZ,span);
    const corridors={};for(let i=0;i<count;i++){const g=wings[i];g.mission='encircle';g.commander.side=Math.sign(g.laneZ)||(i%2?1:-1);g.commander.corridor=corridors[g.commander.side]||0;corridors[g.commander.side]=g.commander.corridor+1;g.commander.routeStage='outward';}
  }
  updateEncirclement(group,enemy,front){
    const c=this.squads[group.id].commander,side=c.side,room=this.radius-7;
    // The original approach is fixed; a shifting enemy line cannot drag the waypoint around.
    if(!c.entry){const edge=side>0?front.maxZ:front.minZ;c.entry={edge,flankZ:clamp(edge+side*(15+(c.corridor||0)*3.5),-room,room),frontX:clamp(Math.min(enemy.minX-14,front.minX-13),-room,room),rearX:clamp(enemy.x+10,-room,room),assaultX:enemy.x+3};c.routeObjective=enemy.id;}
    const entry=c.entry;
    if(c.stageTracked!==c.routeStage){c.stageTracked=c.routeStage;c.stageSince=this.time;c.stageBudget=routeBudget(group,entry,c.routeStage);}
    if(c.routeStage==='outward'&&(side*(group.z-entry.edge)>6||Math.abs(group.z)>=room-3||this.time-c.stageSince>(c.stageBudget||8))){c.routeStage='rear';c.stageTracked='rear';c.stageSince=this.time;c.stageBudget=routeBudget(group,entry,'rear');}
    if(c.routeStage==='rear'&&(group.x>entry.assaultX||this.time-c.stageSince>(c.stageBudget||8)))c.routeStage='assault';
    c.routeX=c.routeStage==='outward'?entry.frontX:entry.rearX;
    c.routeZ=entry.flankZ;
  }
  commandRoute(u,target,dist){
    if(u.team!=='rex'||u.action||u.flankComplete||u.supportUntil>this.time)return null;const group=this.squadState.get(u.squadId),c=group?.commander;
    if(!group?.split||group.mission!=='encircle'||!c?.entry||c.routeStage==='assault')return null;
    // Seeing an enemy is not yet contact: finish the manoeuvre unless personally threatened.
    if(dist<=8.2||u.lastContact||u.hp<u.maxHp*.85){u.flankComplete=true;return null;}
    const room=this.radius-5,e=c.entry,offset=clamp(u.formationOffsetZ*.55,-11,11)+(Math.floor(u.id/5)%3-1)*1.5,z=clamp(e.flankZ+offset,-room,room),slotX=(u.id%5-2)*2.2,frontX=clamp(e.frontX+slotX,-room,room),rearX=clamp(e.rearX+slotX,-room,room);
    if(!u.flankStage)u.flankStage=c.routeStage==='rear'?'rear':'outward';
    if(u.flankStage==='outward'&&Math.hypot(u.x-frontX,u.z-z)<4)u.flankStage='rear';
    if(u.flankStage==='rear'&&Math.hypot(u.x-rearX,u.z-z)<5){u.flankComplete=true;u.decision=0;return null;}
    return{x:u.flankStage==='outward'?frontX:rearX,z,stage:u.flankStage};
  }
  updateSquads(alive){
    this.squadState=new Map(this.squads.map(g=>[g.id,{...g,x:0,z:0,health:0,engaged:0,minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity,faceX:0,faceZ:0,members:[]}]));
    for(const u of alive){const group=this.squadState.get(u.squadId);if(group){group.x+=u.x;group.z+=u.z;group.health+=u.hp/u.maxHp;group.minX=Math.min(group.minX,u.x);group.maxX=Math.max(group.maxX,u.x);group.minZ=Math.min(group.minZ,u.z);group.maxZ=Math.max(group.maxZ,u.z);group.faceX+=Math.cos(u.yaw);group.faceZ+=Math.sin(u.yaw);group.members.push(u);const target=this.units[u.target];if(target?.hp>0&&Math.hypot(target.x-u.x,target.z-u.z)<14)group.engaged++;}}
    for(const group of this.squadState.values())if(group.members.length){group.x/=group.members.length;group.z/=group.members.length;group.health/=group.members.length;}
    // Commanders are ordinary units with an invisible role, never extra combat bodies.
    for(const group of this.squadState.values()){
      if(!group.members.length)continue;const original=this.squads[group.id],leader=group.members.find(u=>u.id===original.commander.leaderId);
      if(!leader){
        if(original.commander.leaderId!==null&&group.members.length<8){let recipient=null,distance=48;for(const ally of this.squadState.values())if(ally.team===group.team&&ally.id!==group.id&&ally.members.length>=8){const d=Math.hypot(ally.x-group.x,ally.z-group.z);if(d<distance){recipient=ally;distance=d;}}
          if(recipient){const n=recipient.members.length,m=group.members.length;recipient.x=(recipient.x*n+group.x*m)/(n+m);recipient.z=(recipient.z*n+group.z*m)/(n+m);recipient.health=(recipient.health*n+group.health*m)/(n+m);recipient.engaged+=group.engaged;for(const u of group.members){u.squadId=recipient.id;u.formationOffsetZ=clamp(u.z-recipient.z,-12,12);u.decision=0;recipient.members.push(u);}group.members=[];original.mergedInto=recipient.id;original.commander.leaderId=null;original.commander.mode='merged';continue;}
        }
        let best=null,score=-Infinity;for(const u of group.members){const value=u.hp/u.maxHp-Math.hypot(u.x-group.x,u.z-group.z)*.005-u.stun*.1;if(value>score){score=value;best=u;}}original.commander.leaderId=best.id;original.nextOrderAt=0;
      }
    }
    const fronts={rex:{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity,x:0,z:0,count:0},dig:{minX:Infinity,maxX:-Infinity,minZ:Infinity,maxZ:-Infinity,x:0,z:0,count:0}};
    for(const u of alive){const f=fronts[u.team];f.minX=Math.min(f.minX,u.x);f.maxX=Math.max(f.maxX,u.x);f.minZ=Math.min(f.minZ,u.z);f.maxZ=Math.max(f.maxZ,u.z);f.x+=u.x;f.z+=u.z;f.count++;}for(const f of Object.values(fronts))if(f.count){f.x/=f.count;f.z/=f.count;}
    const allocations=new Map();
    for(const group of this.squadState.values()){
      if(!group.split||!group.members.length)continue;const original=this.squads[group.id],previous=this.squadState.get(original.objective),command=original.commander;
      if(!previous?.members.length||this.time>=original.nextOrderAt){
        let support=null,supportDistance=50;if(original.role==='reserve')for(const ally of this.squadState.values())if(ally.team===group.team&&ally.id!==group.id&&ally.engaged>0&&ally.objective!==null){const distance=Math.hypot(ally.x-group.x,ally.z-group.z);if(distance<supportDistance){support=ally.objective;supportDistance=distance;}}
        const leader=this.units[command.leaderId],leadTarget=leader?.hp>0?this.units[leader.target]:null,awareness=this.brain(group.team).awareness,anchorX=leader?.hp>0?group.x*.55+leader.x*.45:group.x,anchorZ=leader?.hp>0?group.z*.55+leader.z*.45:group.z;
        let best=null,score=Infinity;for(const enemy of this.squadState.values())if(enemy.team!==group.team&&enemy.members.length){const flankPenalty=group.mission==='encircle'?Math.abs((command.side>0?enemy.maxZ:enemy.minZ)-(command.side>0?fronts.dig.maxZ:fronts.dig.minZ))*.8:0,value=Math.hypot(enemy.x-anchorX,enemy.z-anchorZ)*.35+Math.abs(enemy.z-group.laneZ)*.5+flankPenalty+(group.team==='rex'&&group.mission==='pressure'?Math.max(0,(allocations.get(enemy.id)||0)-1)*8:(allocations.get(enemy.id)||0)*(group.team==='rex'?8:3))+sectorPriority(this.config,group,enemy)-(enemy.id===original.objective?6:0)-(enemy.id===support?8:0)-(leadTarget?.hp>0&&leadTarget.squadId===enemy.id&&Math.hypot(leadTarget.x-leader.x,leadTarget.z-leader.z)<25?7*awareness*((allocations.get(enemy.id)||0)>0?.25:1):0)-(1-enemy.health)*4*awareness;if(value<score){score=value;best=enemy;}}
        let counter=null,counterScore=Infinity;
        if(group.team==='dig')for(const enemy of this.squadState.values())if(enemy.team==='rex'&&enemy.members.length){const dx=enemy.x-group.x,dz=enemy.z-group.z,d=Math.hypot(dx,dz),bearing=Math.abs(angle(Math.atan2(dz,dx)-Math.atan2(group.faceZ,group.faceX)));if(d<45&&bearing>1.05){const score=d-bearing*5;if(score<counterScore){counter=enemy;counterScore=score;}}}
        if(counter)best=counter;
        original.objective=best?.id??null;original.nextOrderAt=this.time+3.6-1.6*this.brain(group.team).awareness+(group.id%3)*.15;
        if(best){command.mode=group.team==='rex'?(original.mission==='encircle'?'flank':original.role==='reserve'&&group.engaged/group.members.length<.15?'support':'pressure'):(group.health<.45&&group.engaged/group.members.length>.25?'withdraw':original.role==='wing'?'cover':'hold');command.lateral=command.mode==='flank'?command.side*6:command.mode==='cover'?command.side*3:0;command.orderedAt=this.time;if(counter){command.mode='counter_flank';}}
      }
      const objective=this.squadState.get(original.objective);if(group.mission==='encircle'&&objective?.members.length&&fronts.dig.count)this.updateEncirclement(group,objective,fronts.dig);
      group.objective=original.objective;group.commander=command;allocations.set(original.objective,(allocations.get(original.objective)||0)+1);
    }
    this.coordinateAssaults();this.coordinateBreakthrough();this.assignSupport();
  }
  coordinateBreakthrough(){
    if(this.config.rex<250||this.time<(this.nextBreakthroughCheck||0))return;this.nextBreakthroughCheck=this.time+2;
    const groups=[...this.squadState.values()].filter(g=>g.team==='rex'&&g.mission==='pressure'&&g.members.length>=8),used=new Set();for(const g of groups)g.commander.reserveNeeded=groups.some(a=>a.id!==g.id&&Math.hypot(a.x-g.x,a.z-g.z)<45&&a.engaged>0&&(a.health<.7||a.members.length<a.initialSize*.7||a.members.some(v=>v.breached)));
    for(const g of groups){if(used.has(g.id)||g.role==='reserve'||g.health<.55)continue;const enemy=this.squadState.get(g.objective);if(!enemy?.members.length||enemy.health>.8||Math.hypot(g.x-enemy.x,g.z-enemy.z)>38)continue;
      let partner=null,best=35;for(const a of groups){if(a.id===g.id||used.has(a.id)||a.role==='reserve'||a.engaged>a.members.length*.2||a.health<.65)continue;const d=Math.hypot(a.x-g.x,a.z-g.z);if(d<best){best=d;partner=a;}}
      if(partner){used.add(g.id);used.add(partner.id);partner.objective=enemy.id;this.squads[partner.id].objective=enemy.id;this.squads[partner.id].nextOrderAt=this.time+2;partner.commander.surgeUntil=this.time+2;g.commander.surgeUntil=this.time+2;}
    }
  }
  assignSupport(){
    if(this.config.rex<100||this.time<(this.nextSupportCheck||0))return;this.nextSupportCheck=this.time+1;
    const groups=[...this.squadState.values()].filter(g=>g.team==='rex'&&g.members.length),used=new Set();
    for(const g of groups){if(g.members.length<4||g.members.length>g.initialSize*.65||g.health>.7||g.engaged<g.members.length*.4)continue;
      const enemy=this.squadState.get(g.objective);if(!enemy?.members.length||enemy.members.length<g.members.length)continue;
      if(groups.some(a=>a.members.some(u=>u.supportGroup===g.id&&u.supportUntil>this.time)))continue;
      let donor=null,best=45;for(const a of groups){if(a.id===g.id||used.has(a.id)||a.members.length<a.initialSize*.7||a.health<.65)continue;const d=Math.hypot(a.x-g.x,a.z-g.z);if(d<best){best=d;donor=a;}}
      if(!donor)continue;const candidates=donor.members.filter(u=>!u.action&&u.hp>u.maxHp*.6&&(!this.units[u.target]||Math.hypot(this.units[u.target].x-u.x,this.units[u.target].z-u.z)>14)&&!(u.supportUntil>this.time)).sort((a,b)=>Math.hypot(a.x-g.x,a.z-g.z)-Math.hypot(b.x-g.x,b.z-g.z));
      const count=Math.min(candidates.length,Math.max(1,Math.floor(donor.members.length*.2)));if(!count)continue;used.add(donor.id);for(const u of candidates.slice(0,count)){u.supportGroup=g.id;u.supportUntil=this.time+Math.min(9,2+Math.hypot(u.x-g.x,u.z-g.z)/Math.max(1,u.stats.speed)*1.5);u.targetLockUntil=0;u.decision=0;}
    }
  }
  coordinateAssaults(){
    const groups=[...this.squadState.values()].filter(g=>g.team==='rex'&&g.split&&g.members.length);
    for(const g of groups)g.commander.rallyFront=false;
    for(const wing of groups){
      const c=wing.commander;if(wing.mission!=='encircle'||!['rear','rally'].includes(c.routeStage))continue;
      const objective=this.squadState.get(wing.objective);if(!objective?.members.length)continue;
      const partners=groups.filter(g=>g.mission==='pressure'&&Math.abs(g.z-wing.z)<65&&Math.hypot(g.x-objective.x,g.z-objective.z)<45);
      if(c.routeStage==='rally'){
        // A brief local rendezvous; never wait for the entire army or a dead commander.
        const ready=partners.some(g=>g.engaged>0||Math.hypot(g.x-objective.x,g.z-objective.z)<28);
        if(ready||this.time-c.readyAt>=1.2){c.routeStage='assault';for(const g of partners)g.commander.surgeUntil=this.time+2;}
      }else if(wing.x>objective.minX-12){
        for(const g of partners)if(g.engaged===0){const order=g.commander;if(!order.rallySince)order.rallySince=this.time;if(this.time-order.rallySince<1.6)order.rallyFront=true;}
      }
    }
  }
  nearby(x,z,r){return this.spatial?this.spatial.query(x,z,r):this.units;}
  isolatedDigger(v){if(v.team!=='dig')return false;const cached=this.isolationCache?.get(v.id);if(cached!==undefined)return cached;const isolated=!this.nearby(v.x,v.z,10).some(other=>other!==v&&other.team==='dig'&&other.hp>0&&Math.hypot(other.x-v.x,other.z-v.z)<10);this.isolationCache?.set(v.id,isolated);return isolated;}
  buildSpatial(){this.spatial=new SpatialGrid(this.units.filter(u=>u.hp>0||this.time-u.deadAt<=4));}
  setTarget(u,id){if(this.assignments&&u.target!==id){const m=this.assignments[u.team];if(u.target!==null)m.set(u.target,Math.max(0,(m.get(u.target)||0)-1));if(id!==null)m.set(id,(m.get(id)||0)+1);}u.target=id;}
  event(message){const entry={time:this.time,message};this.log.push(entry);if(this.log.length>2000){this.log.shift();this.logDropped++;}this.events.unshift(entry);this.events.length=Math.min(this.events.length,12);}
  makeTraits(){const r=this.tacticRng;return{style:Math.floor(r()*3),pace:.94+r()*.12,arc:(r()-.5)*.4};}
  updateTactics(u,target){
    if(u.action||u.plan&&this.time<u.nextPlanAt)return false;
    const r=this.tacticRng,traits=u.traits;let style=r()<.8?traits.style:Math.floor(r()*3),allies=0,enemies=0;
    for(const v of this.nearby(u.x,u.z,9))if(v.hp>0&&Math.hypot(v.x-u.x,v.z-u.z)<9){if(v.team===u.team)allies++;else enemies++;}
    if(enemies>allies+1&&r()<.6)style=u.team==='rex'?1:2;
    if(u.hp/u.maxHp<.3&&r()<.65)style=u.team==='rex'?2:0;
    const rex=u.team==='rex',prefs=rex?[[1.12,1.12,.9,1,1],[1,.95,1.2,1,1],[1.08,.93,1,1,1]]:[[1.12,1.04,.96,.9,.9],[1.08,.92,1.12,.95,1],[.9,1.15,1,1.15,.92]];
    if(!u.plan)u.side=r()<.5?-1:1;
    u.plan={style,pace:traits.pace*(rex?[1.06,.97,.97][style]:[1.02,.99,.99][style]),orbit:rex?[.85,1.2,.95][style]:[1.1,.9,1][style],standOff:(rex?[-.15,0,.15]:[.3,.05,-.3])[style]+(r()-.5)*.15,angleOffset:traits.arc,decisionPace:.9+r()*.2,preferences:prefs[style],salt:(r()*4294967296)>>>0};
    u.nextPlanAt=this.time+3+r()*3;return true;
  }
  varyTechniqueWeights(u,pool,weights){
    if(!u.plan)return weights;
    const varied=weights.map((w,i)=>w>0?w*u.plan.preferences[pool[i].level-1]:0),ground=pool.map((t,i)=>!['leap','pounce'].includes(t.kind)&&varied[i]>0?i:-1).filter(i=>i>=0);
    if(ground.length>1){const last=u.attackHistory.at(-1),repeated=last===u.attackHistory.at(-2);for(const i of ground)if(pool[i].kind===last)varied[i]*=repeated?.64:.8;}
    return varied;
  }
  cancelJump(u,fall=true){
    if(!u.aerialAttack&&!['leap','pounce'].includes(u.action?.kind))return false;
    u.action=null;u.aerialAttack=null;u.attack=0;if(fall&&(u.y>.02||u.vy>0))u.counterFall=true;return true;
  }
  flightGravity(u){return u.aerialAttack&&!u.counterFall?(u.aerialAttack.kind==='pounce'?30:28):18;}
  get alive(){const a={rex:0,dig:0};for(const u of this.units)if(u.hp>0)a[u.team]++;return a;}
  snapshot(){for(const u of this.units){u.px=u.x;u.pz=u.z;u.py=u.y;u.prevYaw=u.yaw;u.prevRoll=u.roll;u.prevPitch=u.pitch;u.prevHit=u.hit;u.prevSpeed=u.speed;u.prevParry=u.parry;u.prevHeadDown=u.headDownFor||0;if(u.armPose){u.prevArmX=u.armPose.x;u.prevArmY=u.armPose.y;u.prevArmSlew=u.armPose.slew;}}}
  effect(x,y,z,kind,strength=1,team='rex') {
    this.effects.push({x,y,z,kind,team,strength,life:kind==='parry'?.42:kind==='explosion'?1.35:kind==='death'?1.1:.65,max:kind==='parry'?.42:kind==='explosion'?1.35:kind==='death'?1.1:.65});
    const dust=kind==='dust'||kind==='step'||kind==='collapse',count=kind==='collapse'?16:kind==='explosion'?48:kind==='step'?2:dust?5:kind==='death'?22:14,r=this.fxRng;
    for(let i=0;i<count;i++){const a=r()*Math.PI*2,s=(dust?1.4:3.5)*strength*(.4+r());this.particles.push({x,y:Math.max(.1,y),z,vx:Math.cos(a)*s,vz:Math.sin(a)*s,vy:(dust?1.3:3+r()*4)*strength,life:dust?.5+r()*.4:.5+r()*.7,max:1.3,size:(dust?.5:.08+r()*.17)*strength,kind:dust?'dust':i%3?'debris':'spark',spin:r()*6.28,team});}
    if(kind==='explosion'){const start=Math.max(0,this.particles.length-count);for(let i=start;i<this.particles.length;i++){const p=this.particles[i],n=i-start;p.kind=n%4===0?'smoke':n%4<3?'fire':'debris';p.size=p.kind==='fire'?.5+r()*.7:p.kind==='smoke'?.8+r()*.8:.15+r()*.25;p.life=p.max=p.kind==='smoke'?1.5+r():p.kind==='fire'?.5+r()*.55:1.1+r()*.5;p.vy=p.kind==='smoke'?3+r()*3:p.vy;p.vx*=p.kind==='smoke'?.3:1;p.vz*=p.kind==='smoke'?.3:1;}}
    if(this.particles.length>480)this.particles.splice(0,this.particles.length-480);
    if(!dust)this.quake=Math.min(1.7,this.quake+.12*strength);
  }
  bucketCommitted(u){const a=u.action;return u.team==='dig'&&a&&a.age/a.duration>=.28&&a.age/a.duration<.68;}
  guardExposure(u,target){
    if(this.bucketCommitted(target)||target.hp<=0||target.stun>0||target.opening>0||target.heldBy!==null||target.y>.7||target.parryCooldown>.15)return 0;
    const guard=guardStats(target.team,this.config[target.team+'Skill'],this.config.tuning[target.team]),dx=u.x-target.x,dz=u.z-target.z;
    const facing=angle(Math.atan2(dz,dx)-target.yaw-(target.team==='rex'?Math.PI:0));
    return Math.hypot(dx,dz)<=guard.reach+2&&Math.abs(facing)<=guard.arc?guard.chance:0;
  }
  selectTarget(u,enemies){
    const level=this.config[u.team+'Skill'],awareness=this.brain(u.team).awareness;
    if(u.team==='rex'&&u.supportUntil>this.time&&!this.nearby(u.x,u.z,7).some(v=>v.team==='dig'&&v.hp>0&&v.heldBy===null&&(v.x-u.x)**2+(v.z-u.z)**2<49)){const group=this.squadState.get(u.supportGroup),enemy=this.squadState.get(group?.objective);if(group?.members.length>=4&&enemy?.members.length){let best=null,dist=Infinity;for(const v of enemy.members)if(v.hp>0&&v.heldBy===null){const d=Math.hypot(v.x-u.x,v.z-u.z);if(d<dist){best=v;dist=d;}}if(best)return best;}u.supportUntil=0;}
    const group=this.squadState.get(u.squadId),objective=this.squadState.get(group?.objective);
    if(u.team==='dig'&&group?.commander.mode==='counter_flank'&&objective?.members.length&&!this.bucketCommitted(u)){
      const emergency=this.nearby(u.x,u.z,4.8).some(v=>v.team==='rex'&&v.hp>0&&Math.hypot(v.x-u.x,v.z-u.z)<4.8);
      if(!emergency){let best=null,nearest=Infinity;for(const v of objective.members)if(v.hp>0&&v.heldBy===null){const d=Math.hypot(v.x-u.x,v.z-u.z);if(d<nearest){best=v;nearest=d;}}if(best)return best;}
    }
    if(group?.split&&objective?.members.length){
      const threatened=this.nearby(u.x,u.z,16).some(v=>v.team!==u.team&&v.hp>0&&(level===1||v.heldBy===null)&&Math.hypot(v.x-u.x,v.z-u.z)<=16);
      if(!threatened){let best=null,nearest=Infinity;for(const v of objective.members)if(v.hp>0&&(level===1||v.heldBy===null)){const distance=Math.hypot(v.x-u.x,v.z-u.z);if(distance<nearest){best=v;nearest=distance;}}if(best)return best;}
    }
    let search=enemies;
    if(this.spatial){let reach=16;while(reach<this.radius*4){let nearest=null,nearestDist=Infinity;
      for(const v of this.spatial.query(u.x,u.z,reach,u.team==='rex'?'dig':'rex',false)){if(v.hp<=0||level>1&&v.heldBy!==null)continue;const d=Math.hypot(v.x-u.x,v.z-u.z);if(d<=reach&&(d<nearestDist||d===nearestDist&&v.id<nearest.id)){nearest=v;nearestDist=d;}}
      if(nearest){if(nearestDist>24)return nearest;search=this.spatial.query(u.x,u.z,nearestDist+10,u.team==='rex'?'dig':'rex');break;}reach*=2;}}
    const candidates=search.filter(v=>v.team!==u.team&&v.hp>0&&(level===1||v.heldBy===null));if(!candidates.length)return null;
    let nearest=candidates[0],nearestDist=Infinity;
    for(const v of candidates){const d=Math.hypot(v.x-u.x,v.z-u.z);if(d<nearestDist){nearest=v;nearestDist=d;}}
    if(level===1)return nearest;
    const assigned=this.assignments?.[u.team]||new Map();const assignedCount=id=>(assigned.get(id)||0)-(this.assignments&&u.target===id?1:0);if(!this.assignments)for(const ally of this.units)if(ally!==u&&ally.team===u.team&&ally.hp>0&&ally.target!==null)assigned.set(ally.target,(assigned.get(ally.target)||0)+1);
    const nearbyCommitments=new Map();if(u.team==='dig'||u.team==='rex'&&group?.split)for(const ally of this.nearby(u.x,u.z,18)){const enemy=this.units[ally.target];if(ally!==u&&ally.team===u.team&&ally.hp>0&&enemy?.hp>0&&Math.hypot(ally.x-enemy.x,ally.z-enemy.z)<(u.team==='rex'?7.5:13))nearbyCommitments.set(enemy.id,(nearbyCommitments.get(enemy.id)||0)+1);}
    const areaReady=level>=3&&availableTechniques(u.team,level,this.config.tuning[u.team]).some(t=>t.targets>1&&(u.nextTechniqueAt[t.kind]||0)<=this.time);
    let best=nearest,bestScore=Infinity;
    for(const v of candidates){const distance=Math.hypot(v.x-u.x,v.z-u.z);if(distance>nearestDist+5+awareness*5)continue;
      let score=distance-(1-Math.max(0,v.hp)/v.maxHp)*(2+5*awareness);
      if(u.team==='dig'&&this.isRolling(v))score+=3*awareness;
      const isolated=u.team==='rex'&&u.breached&&group?.split&&this.isolatedDigger(v);
      if(isolated){const committed=nearbyCommitments.get(v.id)||0;score-=committed<4?3*awareness:0;}
      if(u.team==='rex'&&distance<8&&v.lastBucketParrySource!==u.id&&this.time-(v.lastBucketParryAt??-Infinity)<.65&&assignedCount(v.id)<3)score-=1.5*awareness;
      if(u.team==='rex'&&candidates.length>1)score+=group?.split?Math.max(0,(nearbyCommitments.get(v.id)||0)-(isolated?3:1))*(2+awareness*2):Math.max(0,assignedCount(v.id)-1)*(.65+awareness*.6);
      if(u.team==='dig'&&distance<11&&this.aerialThreat(u,v))score-=6*awareness;
      if(u.team==='dig'&&candidates.length>1&&distance<14){const committed=nearbyCommitments.get(v.id)||0;score-=Math.min(3,committed)*1.4*awareness;score+=Math.max(0,committed-4)*2*awareness;}
      if(level>=3){score-=(v.opening>0?5:0)*awareness;score-=(v.stun>.15&&v.y<1?3:0)*awareness;score+=this.guardExposure(u,v)*4*awareness;
        if(areaReady){let clustered=this.clusters?.get(v.id);if(clustered===undefined){clustered=0;for(const other of this.nearby(v.x,v.z,5.5))if(other.team===v.team&&other.hp>0&&other.heldBy===null&&other.y<2.5&&Math.hypot(other.x-v.x,other.z-v.z)<5.5)clustered++;this.clusters?.set(v.id,clustered);}score+=Math.min(3,clustered-1)*awareness*(u.team==='rex'&&group?.split ? .65 : -1.2);}
        if(assignedCount(v.id)>=2&&v.hp<u.stats.damage*1.5)score+=5*awareness;
        if(v.action?.missed)score-=2*awareness;if(v.y>2.5&&u.team==='rex')score+=2*awareness;
        if(v.team==='dig'&&v.hp<u.stats.damage&&u.hp<EXPLOSION.damage)score+=4*awareness;
      }
      if(u.team==='rex'&&u.breached&&group?.split&&distance>0){const direction=(u.id%4)*Math.PI/2;score-=2.5*awareness*((v.x-u.x)*Math.cos(direction)+(v.z-u.z)*Math.sin(direction))/distance;}
      if(group?.split&&v.squadId===group.objective)score-=1.5;
      if(u.team==='rex'&&u.buffActive&&u.rageUntil>this.time&&v.id===u.rageTarget&&distance<12)score-=2;
      if(v.id===u.target)score-=.7;if(u.team==='rex'&&u.lastContact?.target===v.id&&this.time-u.lastContact.time<1.6&&distance<8)score-=2.2; // Small hysteresis prevents chasing a different unit every decision.
      if(u.plan){let jitter=Math.imul(v.id+1,0x45d9f3b)^u.plan.salt;jitter^=jitter>>>16;score+=((jitter>>>0)/4294967296-.5)*.8;}
      if(score<bestScore){bestScore=score;best=v;}
    }
    return best;
  }
  rushThreat(u){
    if(u.team!=='dig')return null;if(this.time<(u.nextRushScanAt||0))return u.rushThreat;
    u.nextRushScanAt=this.time+.1;let count=0,left=0,right=0,behind=0;
    for(const v of this.nearby(u.x,u.z,11)){if(v.team!=='rex'||v.hp<=0||v.heldBy!==null||v.y>1.5)continue;const dx=v.x-u.x,dz=v.z-u.z,d=Math.hypot(dx,dz),closing=-((v.vx-u.vx)*dx+(v.vz-u.vz)*dz)/(d||1),charging=v.action?.kind==='ram'&&!v.action.evasion;if(d<10&&(closing>2||charging)){count++;if(Math.abs(angle(Math.atan2(dz,dx)-u.yaw))>1.15)behind++;if(Math.sin(Math.atan2(dz,dx)-u.yaw)>0)left++;else right++;}}
    return u.rushThreat=count>=2?{count,left,right,behind}:null;
  }
  prepareRushResponse(u){
    if(u.team!=='dig'||u.action||u.y>.3||u.stun>0||u.heldBy!==null||this.time<(u.nextRushResponseAt||0)||!this.rushThreat(u))return;
    if(!availableTechniques('dig',5,this.config.tuning.dig).some(t=>['sweep','spin'].includes(t.kind)&&(u.nextTechniqueAt[t.kind]||0)<=this.time))return;
    u.nextRushResponseAt=this.time+3;u.rushResponseUntil=this.time+.5;u.cool=Math.min(u.cool,.08);u.reactionWait=0;u.guardUntil=0;
  }
  updateBuff(u){
    const spec=BUFFS[u.team],tuning=this.config.tuning[u.team],allowed=tuning.moves[spec.kind]?.enabled!==false;
    if(u.buffActive&&(this.time>=u.buffUntil||u.hp<=0||!allowed)){if(u.hp>0&&this.time>=u.buffUntil)this.effects.push({x:u.x,y:.2,z:u.z,kind:'buff-end',team:u.team,strength:1,life:.15,max:.15});u.buffActive=false;u.buffUntil=0;u.overdrivePressure=0;u.rageUntil=0;}
    if(!buffReady(u,this.time,tuning)||u.y>.3)return;
    const target=this.units[u.target];if(!target||target.hp<=0||Math.hypot(target.x-u.x,target.z-u.z)>11)return;
    const recent=u.lastContact&&this.time-u.lastContact.time<1.5,pressure=u.rexPressure&&this.time-u.rexPressure.time<1.5&&u.rexPressure.count>=2;
    let trigger=u.team==='rex'&&(recent||u.counterUntil>this.time||u.rollReentryUntil>this.time);
    if(u.team==='dig')trigger=recent&&target.action&&!target.action.resolved||pressure||(u.guardBlocks||0)>=2&&this.time-(u.lastBucketParryAt??-Infinity)<1||this.nearby(u.x,u.z,8).filter(v=>v.team==='rex'&&v.hp>0&&v.heldBy===null&&Math.hypot(v.x-u.x,v.z-u.z)<8).length>=2;
    if(!trigger)return;
    u.overdrivePressure=0;u.overdriveHits=null;u.buffActive=true;u.buffUntil=this.time+spec.duration;u.nextTechniqueAt[spec.kind]=u.buffUntil+spec.cooldown*tuning.moves[spec.kind].cooldown;u.buffUses=(u.buffUses||0)+1;
    this.event(unitLabel(u)+' · '+spec.name);this.effects.push({x:u.x,y:.2,z:u.z,kind:'buff',team:u.team,strength:1,life:.15,max:.15});
  }
  chooseRollingSide(u,target){const a=target.action,yaw=a.rollYaw??a.yaw,cross=Math.cos(yaw)*(u.z-target.z)-Math.sin(yaw)*(u.x-target.x);return Math.abs(cross)>.2?Math.sign(cross):u.side;}
  diggerCounterOpening(u,target){const recent=u.lastContact?.target===target.id&&this.time-u.lastContact.time<.65;return !recent&&target.opening>.2&&(target.action?.missed||target.stun>.35);}
  approach(u,target,dist){
    const route=this.commandRoute(u,target,dist);if(route){target={...target,x:route.x,z:route.z,vx:0,vz:0,action:null,opening:0,stun:0,parryCooldown:99};dist=Math.hypot(target.x-u.x,target.z-u.z);}
    const level=this.config[u.team+'Skill'],awareness=this.brain(u.team).awareness,s=u.stats,moveSpeed=s.speed*(u.buffActive&&u.team==='rex'?BUFFS.rex.moveSpeed:1),plan=u.plan;
    // Predict visible motion only; never inspect the opponent's random choice.
    const lead=u.team==='rex'?awareness*.45:0;
    const group=this.squadState.get(u.squadId),objective=this.squadState.get(group?.objective),routeBias=!route&&!u.enteredCombat&&group?.split&&objective&&dist>14?clamp(objective.z+u.formationOffsetZ*.4+(group.commander?.lateral||0)-target.z,-8,8)*clamp((dist-14)/20,0,1):0;
    const dx=target.x-u.x+clamp(target.vx,-6,6)*lead,dz=target.z-u.z+clamp(target.vz,-6,6)*lead+routeBias,aimDist=Math.hypot(dx,dz)||1,nx=dx/aimDist,nz=dz/aimDist;
    const opening=target.opening>0||target.stun>.2||target.action?.missed;
    let advance,orbit,intent;
    if(u.team==='rex'){
      // Close to bite distance and continue pressing between attacks.
      const ideal=route?1:3.25-awareness*.3+(plan?.standOff||0);advance=clamp((dist-ideal)*2.6,-.35,moveSpeed);orbit=route?0:u.side*(.15+awareness*.2);intent=dist>5.2?'chase':'pressure';
      if(opening){orbit*=.15;intent='punish';}if(!route&&!u.action&&this.isolatedOpponent(u,target)&&['smash','uppercut'].includes(target.action?.kind)&&!target.action.resolved&&target.action.age<target.action.peakImpact){orbit+=u.side*moveSpeed*.65;advance=Math.min(advance,moveSpeed*.65);intent='slip_bucket';}
      if(!route&&dist>3.2&&dist<8&&target.team==='dig'&&target.lastBucketParrySource!==u.id&&this.time-(target.lastBucketParryAt??-Infinity)<.65){const tip=bucketWorld(target,0),cross=(tip.x-target.x)*(u.z-target.z)-(tip.z-target.z)*(u.x-target.x);orbit+=(Math.sign(cross)||u.side)*1.8*awareness;advance=Math.max(advance,moveSpeed*.65);intent='press_guard_gap';}
      if(dist>7&&Math.abs(angle(Math.atan2(dz,dx)-u.yaw))<.7)advance*=1.45;
      if(dist>5.2&&Math.abs(angle(Math.atan2(dz,dx)-u.yaw))<.5)advance*=1+.2*(u.charge||0);
      if(dist>3.7){let avoid=0,blockage=0,left=0,right=0;for(const ally of this.nearby(u.x,u.z,6)){if(ally===u||ally.team!=='rex'||ally.hp<=0||ally.y>1)continue;
        const ax=ally.x-u.x,az=ally.z-u.z,along=ax*nx+az*nz,cross=-ax*nz+az*nx;
        if(along>.2&&along<4.5&&Math.abs(cross)<2.5){avoid-=Math.sign(cross||-u.side)*(1-along/5)*(1-Math.abs(cross)/3);if(along<2.8)blockage++;}
        if(along>-.5&&along<5){if(cross>0&&cross<4)left+=1-along/6;else if(cross<=0&&cross>-4)right+=1-along/6;}}
        // A crowd must not multiply the forward slowdown once per ally.
        if(blockage){advance*=Math.max(.65,1-.15*blockage);const open=left+.8<right?1:right+.8<left?-1:u.side;if(blockage>1||Math.abs(avoid)<.1)avoid=open*Math.max(.6,Math.abs(avoid));}
        if(Math.abs(avoid)>.1){orbit+=clamp(avoid,-1.5,1.5)*(1.3+awareness);intent='spread';}}


    }else{
      // Work near the end of the arm, rather than walking into bite range.
      let ideal=Math.min(s.range+.3,Math.max(s.range*.94,target.stats.range+2.1+awareness*.35))+(plan?.standOff||0);
      orbit=u.side*(.35+awareness*.55);intent='keep_distance';
      const counter=this.diggerCounterOpening(u,target),followup=this.diggerFollowThrough(u,target,dist);if(counter){ideal-=.45;orbit*=.25;intent='counter';}
      if(this.isRolling(target)){ideal+=1;orbit=this.chooseRollingSide(u,target)*moveSpeed*.65;intent='deflect_roll';}
      if(target.action?.kind==='pounce'&&target.action.landAt===null&&target.y>.7&&u.parryCooldown<=.15){ideal=6.5;orbit*=.2;intent='intercept';}
      // Begin retreat before a closing rex reaches the bucket, even at low skill.
      const closing=Math.max(0,-((target.vx-u.vx)*nx+(target.vz-u.vz)*nz));
      ideal+=Math.min(1.2,closing*(.15+awareness*.12));ideal+=awareness*(this.config.tuning.dig.distance-1)*1.4;
      const gap=dist-ideal;advance=Math.abs(gap)<.35?0:clamp(gap*1.8,-moveSpeed*(.7+awareness*.2),moveSpeed*.8);
      if(followup){advance=dist<3.6?-moveSpeed*.3:0;orbit*=.15;intent='follow_through';}
      if(dist>ideal+1)intent='approach';if(!counter&&!followup&&u.repositionUntil>this.time&&dist<ideal+.5){advance=Math.min(advance,-moveSpeed*.85);orbit=u.side*moveSpeed*.28;intent='reset_distance';}else if(!counter&&closing>2&&dist<ideal+.5){orbit=u.side*(.65+awareness);intent='intercept';}
    }
    if(u.team==='rex'&&group?.split&&u.enteredCombat&&!u.breached&&!route&&dist>5&&dist<13&&!this.isolatedDigger(target)){advance=Math.max(advance,moveSpeed*.55*this.config.tuning.rex.breakthrough);orbit+=(u.id%2?1:-1)*1.6;intent='break_line';}
    if(group?.split&&!opening&&!(u.team==='rex'&&u.enteredCombat)){const order=group.commander;if(order.mode==='flank'&&dist>6&&intent!=='flank')orbit+=order.side*.7;if(order.mode==='cover'&&dist>6)orbit+=order.side*.45;if(order.mode==='withdraw'&&u.team==='dig'&&dist<7.5){advance=Math.min(advance,-moveSpeed*.75);intent='command_withdraw';}}
    if(!route&&u.engagementWait>.65&&dist>(u.team==='rex'?4.5:7.5)){advance=Math.max(advance,moveSpeed*(u.team==='rex'?.55:.3));orbit*=.3;intent='engage';}
    if(u.team==='rex'&&!u.enteredCombat&&group?.commander.rallyFront&&!route&&dist>13&&dist<25){advance*=.45;intent='rally_front';}
    if(u.team==='rex'&&group?.commander.surgeUntil>this.time&&dist>5.2)advance*=1.1;
    // A local staging beat lets neighboring sectors arrive at different times.
    const order=group?.commander;if(u.team==='rex'&&group?.mission==='pressure'&&!u.enteredCombat&&!route&&dist>13&&dist<30&&order.pressureDelay>0){if(order.stagingAt===undefined)order.stagingAt=this.time;if(this.time-order.stagingAt<order.pressureDelay){advance*=.2;intent='stage_sector';}}
    if(u.team==='rex'&&this.config.rex>=250&&group?.role==='reserve'&&!u.enteredCombat&&!route&&dist>16&&dist<35){const order=group.commander;if(order.reserveSince===undefined)order.reserveSince=this.time;const needed=order.reserveNeeded;if(!needed&&this.time-order.reserveSince<3){advance*=.2;intent='reserve';}}
    advance*=plan?.pace||1;orbit*=plan?.orbit||1;
    const flank=route&&intent!=='spread'?0:dist<s.range+5||intent==='spread'?orbit:u.side*.35;
    let vx=nx*advance-nz*flank,vz=nz*advance+nx*flank;
    if(u.team==='dig'&&!route&&dist<13){const allies=this.nearby(u.x,u.z,14).filter(v=>v!==u&&v.team==='dig'&&v.hp>0&&v.heldBy===null&&v.y<1&&(v.x-u.x)**2+(v.z-u.z)**2<196);if(allies.length>0&&allies.length<=4){allies.sort((a,b)=>(a.x-u.x)**2+(a.z-u.z)**2-((b.x-u.x)**2+(b.z-u.z)**2));const close=allies.slice(0,2),cx=close.reduce((s,v)=>s+v.x,0)/close.length-u.x,cz=close.reduce((s,v)=>s+v.z,0)/close.length-u.z,spacing=Math.hypot(cx,cz);if(spacing>5){const pull=Math.min(moveSpeed*.65,(spacing-5)*.7);vx+=cx/spacing*pull;vz+=cz/spacing*pull;intent='cover_allies';}}}

    if(u.team==='dig'&&Math.max(Math.abs(u.x),Math.abs(u.z))>this.radius-5&&(vx*u.x+vz*u.z)>0){
      // Leave the wall along the open side; do not reverse direction every frame.
      const side=Math.sign(nz*u.x-nx*u.z)||u.side,r=Math.hypot(u.x,u.z)||1;
      vx=-nz*side*moveSpeed*.7-u.x/r*.5;vz=nx*side*moveSpeed*.7-u.z/r*.5;intent='sidestep';
    }
    if(u.team==='rex'&&group?.split&&!route){
      // After contact, steer into a nearby gap between machines; retain it briefly to avoid indecision.
      if(u.enteredCombat&&level>=3&&dist>3.8&&dist<18){
        if(u.gapPhase==='gather'&&u.gapPoint&&Math.hypot(u.gapPoint.x-u.x,u.gapPoint.z-u.z)<3.1)u.breached=true;
        const phase=u.breached?'spread':'gather',order=group.commander;
        if(u.gapPhase!==phase||this.time>=(u.gapUntil||0)||u.gapPoint&&Math.hypot(u.gapPoint.x-u.x,u.gapPoint.z-u.z)<2){
          const machines=this.nearby(u.x,u.z,17).filter(v=>v.team==='dig'&&v.hp>0&&v.y<1&&Math.hypot(v.x-u.x,v.z-u.z)<17).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z)).slice(0,9);
          const allies=this.nearby(u.x,u.z,18).filter(v=>v!==u&&v.team==='rex'&&v.hp>0&&v.gapPoint&&v.gapUntil>this.time);
          let best=null,bestScore=-Infinity;
          for(let i=0;i<machines.length;i++)for(let j=i+1;j<machines.length;j++){
            const a=machines[i],b=machines[j],width=Math.hypot(a.x-b.x,a.z-b.z);if(width<6.1||width>14)continue;
            const x=(a.x+b.x)/2,z=(a.z+b.z)/2,d=Math.hypot(x-u.x,z-u.z);if(d<2||d>14)continue;
            let clearance=Infinity;for(const m of machines)clearance=Math.min(clearance,Math.hypot(x-m.x,z-m.z));if(clearance<3)continue;
            const forward=((x-u.x)*nx+(z-u.z)*nz)/d,claimed=phase==='spread'?allies.reduce((n,v)=>n+(Math.hypot(x-v.gapPoint.x,z-v.gapPoint.z)<4?1:0),0):0,bias=Math.sin((u.id+1)*12.9898+(a.id+1)*.41+(b.id+1)*.73)*.35,direction=(u.id%4)*Math.PI/2,spread=((x-u.x)*Math.cos(direction)+(z-u.z)*Math.sin(direction))/d,score=clearance*.6+forward*(phase==='spread'?1.5:4)+(phase==='spread'?spread*5:0)-d*.12-claimed*2.4+bias;if(score>bestScore){bestScore=score;best={x,z};}
          }
          if(phase==='gather'){const leader=this.units[order.leaderId];if(leader===u&&best)order.sharedGap={...best,until:this.time+.8};const shared=order.sharedGap;if(shared&&shared.until>this.time&&Math.hypot(shared.x-u.x,shared.z-u.z)<14)best={x:shared.x,z:shared.z};else if(best)order.sharedGap={...best,until:this.time+.8};}
          u.gapPoint=best;u.gapUntil=this.time+.8;u.gapPhase=phase;
        }
        if(u.gapPoint){const dx=u.gapPoint.x-u.x,dz=u.gapPoint.z-u.z,d=Math.hypot(dx,dz)||1;const push=6.2*(.4+.6*awareness)*this.config.tuning.rex.breakthrough;vx=vx*.45+dx/d*push;vz=vz*.45+dz/d*push;intent='infiltrate';}
      }
      if(u.enteredCombat&&level>=3&&dist>5&&dist<12&&this.isolatedDigger(target)){const desired=(u.id%4)*Math.PI/2,polar=Math.atan2(u.z-target.z,u.x-target.x),orbit=-clamp(angle(desired-polar),-1,1)*2.2*awareness;vx-=nz*orbit;vz+=nx*orbit;intent='surround';}
      let sx=0,sz=0;for(const ally of this.nearby(u.x,u.z,4.2)){if(ally===u||ally.team!=='rex'||ally.hp<=0||ally.y>1)continue;const ax=u.x-ally.x,az=u.z-ally.z,d=Math.hypot(ax,az);if(d>.01&&d<4.2){sx+=ax/d*(4.2-d);sz+=az/d*(4.2-d);}}
      const length=Math.hypot(sx,sz),scale=length>2?2/length:1;vx+=sx*scale;vz+=sz*scale;
      const speed=Math.hypot(vx,vz),limit=moveSpeed*(dist>7?1.65:1.1);if(speed>limit){vx*=limit/speed;vz*=limit/speed;}
    }
    if(u.team==='dig'&&group?.split){
      // Crossing threats force separate defensive lanes instead of pulling the whole army inward.
      const local=this.nearby(u.x,u.z,12);let tx=0,tz=0,threats=0;
      for(const v of local)if(v.team==='rex'&&v.hp>0){const dx=v.x-u.x,dz=v.z-u.z,d=Math.hypot(dx,dz);if(d>.01&&d<12){tx+=dx/d;tz+=dz/d;threats++;}}
      const surrounded=threats>=2&&Math.hypot(tx,tz)/threats<.87,spacing=(surrounded?4.4:threats?4.2:4.4)*(1+awareness*(this.config.tuning.dig.defense-1)*.4);let sx=0,sz=0;
      for(const ally of local)if(ally!==u&&ally.team==='dig'&&ally.hp>0){const dx=u.x-ally.x,dz=u.z-ally.z,d=Math.hypot(dx,dz);if(d>.01&&d<spacing){sx+=dx/d*(spacing-d);sz+=dz/d*(spacing-d);}}
      const length=Math.hypot(sx,sz),cap=surrounded?moveSpeed*.4:1,scale=length>cap?cap/length:1;vx+=sx*scale;vz+=sz*scale;if(surrounded)intent='break_encirclement';
      const speed=Math.hypot(vx,vz);if(speed>moveSpeed){vx*=moveSpeed/speed;vz*=moveSpeed/speed;}
    }
    ({vx,vz}=this.avoidBlast(u,target,vx,vz));
    return{vx,vz,intent:route?'encircle_'+route.stage:intent};
  }
  avoidBlast(u,target,vx,vz){
    if(this.config[u.team+'Skill']<3||u.y>.7||this.config.tuning.explosion.damage===0)return{vx,vz};
    const radius=EXPLOSION.radius*this.config.tuning.explosion.radius,near=this.nearby(u.x,u.z,radius+2);let x=0,z=0;
    for(const v of near){if(v===u||v.team!=='dig'||v.hp<=0||v.y>1||v.hp>Math.min(v.maxHp*.22,650))continue;
      const enemy=this.units[v.action?.target??v.target];if(!enemy||enemy.hp<=0||Math.hypot(enemy.x-v.x,enemy.z-v.z)>12)continue;
      // Keep one finisher; supporting attackers avoid piling onto a dying machine.
      if(u.team==='rex'&&v===target&&u.hp>EXPLOSION.damage*this.config.tuning.explosion.damage){const distance=Math.hypot(u.x-v.x,u.z-v.z);if(!near.some(ally=>ally!==u&&ally.team==='rex'&&ally.hp>EXPLOSION.damage*this.config.tuning.explosion.damage&&ally.target===v.id&&Math.hypot(ally.x-v.x,ally.z-v.z)<distance-.25))continue;}
      const dx=u.x-v.x,dz=u.z-v.z,d=Math.hypot(dx,dz);if(d<.01||d>radius+1)continue;
      const urgency=(1-d/(radius+1))*(1-v.hp/Math.min(v.maxHp*.22,650));x+=dx/d*urgency;z+=dz/d*urgency;
    }
    const before=Math.hypot(vx,vz),length=Math.hypot(x,z);if(length>.01){const gain=u.stats.speed*(u.team==='rex'?.55:.45)/Math.max(1,length);vx+=x*gain;vz+=z*gain;const cap=Math.max(before,u.stats.speed*(u.team==='rex'?1.1:1)),speed=Math.hypot(vx,vz);if(speed>cap){vx*=cap/speed;vz*=cap/speed;}}
    return{vx,vz};
  }
  probeAttack(u,target,dist){
    if(u.team==='dig'&&target.action?.kind==='ram')return false;if(this.config.rex>20||this.config.dig>20||this.config[u.team+'Skill']<3||dist>10||this.guardExposure(u,target)<=0||target.action||target.opening>0||target.stun>.2||u.lastContact&&this.time-u.lastContact.time<1)return false;
    if(u.probeTarget!==target.id||this.time-(u.lastProbeAt??-Infinity)>2.2){u.probeTarget=target.id;u.lastProbeAt=this.time;u.probeUntil=this.time+.32+.18*this.brain(u.team).awareness;}
    return this.time<u.probeUntil;
  }
  chooseEscapeSide(u,target){
    const dx=target.x-u.x,dz=target.z-u.z,d=Math.hypot(dx,dz)||1,nx=dx/d,nz=dz/d;
    const risk=side=>{const x=u.x-nx*2-nz*side*3,z=u.z-nz*2+nx*side*3;let score=Math.max(0,Math.max(Math.abs(x),Math.abs(z))-(this.radius-5))*3;
      for(const v of this.nearby(u.x,u.z,13))if(v.hp>0&&v.team!==u.team&&v!==target)score+=Math.max(0,8-Math.hypot(v.x-x,v.z-z));return score;};
    if(risk(-u.side)+.6<risk(u.side))u.side*=-1;
  }
  jumpOpportunity(u,target,dist){
    const dx=target.x-u.x,dz=target.z-u.z,nx=dx/(dist||1),nz=dz/(dist||1);let clustered=0,blocked=false,jumpers=0;
    for(const v of this.nearby(u.x,u.z,dist+22)){if(v===u||v.hp<=0||v.heldBy!==null)continue;
      if(v.team!==u.team&&v.y<2.5&&Math.hypot(v.x-target.x,v.z-target.z)<6.5)clustered++;
      if(v!==target&&v.y<1.5&&dist>6.1){const x=v.x-u.x,z=v.z-u.z,along=x*nx+z*nz;if(along>1&&along<dist-2&&Math.abs(-x*nz+z*nx)<2.4)blocked=true;}
      if(v.team===u.team&&['leap','pounce'].includes(v.action?.kind)&&v.action.landAt===null&&Number.isFinite(v.action.landingX)&&Math.hypot(v.action.landingX-target.x,v.action.landingZ-target.z)<5.5)jumpers++;
    }
    const a=target.action,until=a?(a.impact??a.duration*.48)-a.age:Infinity;
    const sweepThreat=a?.kind==='sweep'&&target.stun<=0&&target.y<.7&&dist<=10&&until>.22&&until<.65&&Math.abs(angle(Math.atan2(u.z-target.z,u.x-target.x)-(a.yaw??target.yaw)))<1.9;
    const recentContact=u.lastContact?.target===target.id&&this.time-u.lastContact.time<3;
    const recoveringGuard=(target.guardFatigueUntil||0)-this.time>.65,missedRecovery=!!a?.missed&&a.age<a.duration;
    const punish=recoveringGuard||missedRecovery||target.stun>.4||target.opening>.3||target.opening>.45&&(a?.missed||target.stun>.3)||!recentContact&&target.hp<target.maxHp*.35&&dist>6.1&&target.parryCooldown>.6;
    if(blocked){if(u.groundBlockedAt==null)u.groundBlockedAt=this.time;}else u.groundBlockedAt=null;
    const blockedFor=blocked?this.time-u.groundBlockedAt:0;
    return{clustered,blocked,blockedFor,sweepThreat,punish,recoveringGuard,missedRecovery,claimed:jumpers>=Math.max(1,Math.ceil(clustered/3))};
  }
  predictedTargets(u,target,tech,nearby=null){
    const horizon=.35*crewProfile(this.config[u.team+'Skill']).windup,lead=.24*this.brain(u.team).awareness;
    const yaw=Math.atan2(target.z+clamp(target.vz,-9,9)*lead-u.z,target.x+clamp(target.vx,-9,9)*lead-u.x),radial=tech.kind==='spin',wide=tech.targets>1,range=tech.kind==='grapple'?6.2:tech.kind==='sweep'?10:u.stats.range+1.4,arc=tech.kind==='grapple'?.75:tech.kind==='sweep'?1.9:wide?1.5:.85;
    let count=0;for(const v of nearby||this.nearby(u.x,u.z,range+4)){if(v.team===u.team||v.hp<=0||v.heldBy!==null||!wide&&v!==target||tech.kind==='grapple'&&v.y>1.5||tech.kind==='sweep'&&v.y>2)continue;
      const dx=v.x+clamp(v.vx,-9,9)*horizon-u.x,dz=v.z+clamp(v.vz,-9,9)*horizon-u.z;if(Math.hypot(dx,dz)>range||!radial&&Math.abs(angle(Math.atan2(dz,dx)-yaw))>arc)continue;if(++count>=tech.targets)break;
    }return count;
  }
  friendlySpace(u,target,tech,near=null){
    if(u.team==='dig'||!['tail','sweep','spin','leap','pounce'].includes(tech.kind))return 1;
    const landing=['leap','pounce'].includes(tech.kind),x=landing?target.x:u.x,z=landing?target.z:u.z,range=landing?(tech.kind==='leap'?2.5:3.5):tech.kind==='sweep'?10:u.stats.range+1.4;
    const yaw=Math.atan2(target.z-u.z,target.x-u.x),arc=tech.kind==='tail'?2.6:1.9,radial=landing||tech.kind==='spin';let blocked=0;
    for(const ally of near||this.nearby(x,z,range+2)){if(ally===u||ally.team!==u.team||ally.hp<=0||ally.heldBy!==null||ally.y>2)continue;const dx=ally.x-x,dz=ally.z-z,d=Math.hypot(dx,dz);if(d>range+ally.stats.radius)continue;
      if(radial||Math.abs(angle(Math.atan2(dz,dx)-yaw))<arc+Math.asin(Math.min(1,ally.stats.radius/Math.max(.1,d)))){if(++blocked===3)break;}}
    return blocked===0?1:blocked===1?.9:u.team==='dig'?(blocked===2?.8:.65):(blocked===2?.65:.4);
  }
  techniqueWeights(u,target,dist,pool){
    const level=this.config[u.team+'Skill'],awareness=this.brain(u.team).awareness,groundSpace=this.nearby(u.x,u.z,14),landingSpace=pool.some(t=>['leap','pounce'].includes(t.kind))?this.nearby(target.x,target.z,9):[],space=t=>this.friendlySpace(u,target,t,['leap','pounce'].includes(t.kind)?landingSpace:groundSpace);
    if(level===1)return pool.map(t=>t.weight*space(t));
    const exposed=this.guardExposure(u,target),opening=target.opening>0||target.stun>.2||target.action?.missed;
    const airborne=target.y>1.2,incoming=target.action?.kind==='pounce'&&target.action.landAt===null&&target.y>.8&&target.vy<2;
    const jump=u.team==='rex'&&level>=4?this.jumpOpportunity(u,target,dist):null,forecast=u.team==='dig'?groundSpace:null;
    let crowd=0,flankers=0;for(const v of groundSpace)if(v.team!==u.team&&v.hp>0&&v.heldBy===null&&v.y<2.5&&(v.x-u.x)**2+(v.z-u.z)**2<36){crowd++;const bearing=Math.abs(angle(Math.atan2(v.z-u.z,v.x-u.x)-u.yaw));if(bearing>.8&&bearing<2.6)flankers++;}
    // A follow-up is an ordinary attack choice, and only follows a confirmed contact.
    const contact=u.lastContact,follow=contact&&contact.target===target.id&&this.time-contact.time<3;
    const weights=pool.map(t=>{
      let score=t.weight;
      if(u.team==='rex'){
        if(t.kind==='bite')score+=(opening?4:0)+(dist<4.2?2:0)+(follow&&contact.kind==='ram'?10:0);
        if(t.kind==='ram'){
          // A ready bucket lowers dash preference, but must not force an aerial opener.
          
          score+=(dist>4.5?6:0)+(opening?1:0)+(follow&&contact.kind==='tail'&&dist>4.5?6:0)+(u.enteredCombat&&u.gapPoint&&dist>5?3*awareness:0);
          if(dist<3.8||follow&&contact.kind==='ram'&&dist<=6.1)score*=.25;
        }
        if(t.kind==='tail'){if(follow&&contact.kind==='ram'&&dist<=7.2&&target.y<1)score+=8;score+=Math.max(0,crowd-1)*2.2+Math.min(2,flankers)*1.5+(follow&&contact.kind==='bite'&&crowd>1?5:0);if(target.action&&['smash','uppercut'].includes(target.action.kind)&&target.action.age/target.action.duration>.68)score+=3;}
        if(t.kind==='leap'){
          if(follow&&contact.kind==='ram'&&dist>6.1&&dist<10.5&&target.parryCooldown>.25&&jump&&!jump.claimed)return 6*awareness;
          if(airborne||!jump||jump.claimed||!(jump.blockedFor>.55&&dist>6.1&&((u.nextTechniqueAt.ram||0)>this.time||dist>8.5||u.enteredCombat&&jump.clustered>=3)||jump.sweepThreat)||follow&&!jump.sweepThreat&&!(contact.kind==='ram'&&dist>5.8&&target.parryCooldown>.25))return 0;
          score+=jump.sweepThreat?3:2;
        }
        if(t.kind==='pounce'){
          const breakthrough=jump&&jump.blockedFor>.8&&jump.clustered>=3&&dist>6.1;
          if(airborne||!jump||!jump.punish&&!breakthrough||jump.claimed||follow&&!jump.punish)return 0;
          score+=Math.min(3,Math.max(0,jump.clustered-1))*1.5+(jump.punish?1.5:opening?1:0);
          // A busy bucket can still intercept a dive; evaluate this separately from ground guard.
          const interceptor=this.nearby(target.x,target.z,8).some(v=>v.team==='dig'&&v.hp>0&&v.stun<=0&&v.y<.7&&v.parryCooldown<=.15&&!this.bucketCommitted(v)&&guardStats('dig',5,this.config.tuning.dig).chance>0&&Math.hypot(v.x-target.x,v.z-target.z)<8&&Math.abs(angle(Math.atan2(u.z-v.z,u.x-v.x)-v.yaw))<1.31);
          if(interceptor)score*=target.action&&!target.action.missed?.35:.6;
          score*=.6;
        }
        if(exposed&&['ram','leap'].includes(t.kind))score*=.55;
      }else{
        if(u.counterUntil>this.time&&u.counterTarget===target.id){if(t.kind==='uppercut'&&dist<5.5)score+=9;if(t.kind==='sweep')score+=8;if(t.kind==='smash'&&target.y<1)score+=6;}
        if(t.kind==='smash')score+=(opening?4:0)+(target.hp<u.stats.damage*t.damage*moveTuning(this.config,u.team,t.kind).damage*(1-target.stats.armor)?1.5:0)+(dist>6&&crowd<=1?1.5:0)+(follow&&['sweep','uppercut','spin','throw'].includes(contact.kind)&&dist>5&&!airborne?2:0);
        if(t.kind==='sweep'){const closing=((target.vx-u.vx)*(u.x-target.x)+(target.vz-u.vz)*(u.z-target.z))/(dist||1);score+=Math.min(2,flankers)*4+Math.max(0,crowd-1)*1.8+(dist>5?2.3:0)+(closing>2?2:0)+(follow&&contact.kind==='smash'?3:0);}
        if(t.kind==='uppercut')score+=(airborne?4:0)+(incoming?10:0)+(follow&&contact.kind==='sweep'&&dist<7?3:0);
        if(t.kind==='spin'){score+=Math.min(3,Math.max(0,crowd-1))*1.8+(crowd>1&&dist<4.5?1.5:0);if(crowd<=1&&flankers===0)score*=.55;else score+=Math.min(2,flankers)*5;}
        if(t.kind==='spin'&&follow&&contact.kind==='sweep')score+=8;if(t.kind==='smash'&&follow&&contact.kind==='uppercut'&&target.y<3.5&&target.vy<=0)score+=7;if(target.action?.kind==='ram'){if(t.kind==='sweep')score+=4;if(t.kind==='smash'&&dist>5)score+=3;if(t.kind==='uppercut'&&dist<5)score+=4;}
        if(t.kind==='grapple'){score+=(opening?8:0)+(exposed===0?1:0)+(dist<4.5?1.5:0);if(dist>5.5||Math.hypot(target.vx,target.vz)>4)score*=.25;if(crowd>1)score*=crowd<=3?.45:.15;if(!this.diggerCounterOpening(u,target)&&!opening)score*=.6;}
        if(crowd>=2&&['sweep','spin'].includes(t.kind))score*=2.4;
        // Preserve single-opponent technique weights.
        const expected=this.predictedTargets(u,target,t,forecast);score*=expected===0?.35:1;
      }
      if(u.team==='rex'&&follow)score*=contact.kind===t.kind?.75:1.35;
      return Math.max(.08,t.weight+(score-t.weight)*awareness);
    });return this.varyTechniqueWeights(u,pool,weights).map((weight,i)=>weight*space(pool[i]));
  }
  aerialThreat(u,target){const a=target.action;if(target.team!=='rex'||!a||!['leap','pounce'].includes(a.kind)||a.landAt!==null||target.y<.6||target.vy>=-.5)return false;const g=this.flightGravity(target),remaining=(target.vy+Math.sqrt(target.vy*target.vy+2*g*target.y))/g,lead=Math.min(.5,remaining);return remaining<=.8&&Math.hypot(target.x+target.vx*lead-u.x,target.z+target.vz*lead-u.z)<7.5;}
  aerialCounterChoice(u,target,pool){
    if(!this.aerialThreat(u,target))return null;const g=this.flightGravity(target);let best=null,bestScore=0;
    for(const tech of pool){if(!['smash','uppercut','sweep','spin'].includes(tech.kind))continue;
      const duration=(tech.kind==='spin'?1.4:1.05)/1.25*crewProfile(5).windup,virtual={...u,parry:0,guardUntil:0,armPose:u.armPose?{...u.armPose}:null,action:{kind:tech.kind,age:0,duration,side:u.side||1,bucketReach:clamp(Math.hypot(target.x-u.x,target.z-u.z)-2.2,.9,6.5)/(u.scale||1)}};let contacts=0,first=.8;
      for(let t=1/30;t<=.8;t+=1/30){virtual.action.age=t;updateBucketArm(virtual,STEP);const phase=t/duration;if(phase<.18||phase>.65)continue;const predicted={...target,x:target.x+target.vx*t,z:target.z+target.vz*t,y:target.y+target.vy*t-.5*g*t*t};if(predicted.y<=.25)break;if(bucketContact(virtual,predicted)){contacts++;first=Math.min(first,t);}}
      const score=contacts*1.5+ (contacts?.8-first:0);if(score>bestScore){best=tech.kind;bestScore=score;}
    }return best;
  }
  techniquePriority(u,target,dist,pool){
    if(u.y>.1||target.hp<=0||target.heldBy!==null)return null;
    const ready=kind=>pool.find(t=>t.kind===kind);
    if(u.team==='rex'){
      if(u.rollReentryUntil>this.time&&u.rollReentryTarget===target.id&&ready('ram')&&dist>=2.8&&dist<=8.5)return 'ram';
      if(u.rollFollowUntil>this.time&&u.rollFollowTarget===target.id){if(ready('bite')&&dist<=4.8)return 'bite';if(ready('tail')&&dist<=7.2)return 'tail';}
      if(u.counterUntil>this.time&&u.counterTarget===target.id){if(ready('bite')&&dist<=5.8)return 'bite';if(ready('ram')&&dist<=8.5)return 'ram';if(ready('leap')&&dist<=10.5)return 'leap';}
      // An isolated opponent's missed swing or exhausted guard is a short punish window.
      if(this.isolatedOpponent(u,target)&&((target.action?.missed&&target.action.age>target.action.impact)||target.guardFatigueUntil>this.time||target.guardBrokenUntil>this.time)){
        if(ready('bite')&&dist<=4.8)return 'bite';
        if(ready('ram')&&dist>=4.8&&dist<=8.5)return 'ram';
        if(ready('tail')&&dist<=7.2)return 'tail';
      }
      if(ready('pounce')&&this.flankRollPlan(u,target,dist))return 'pounce';
      const leap=ready('leap'),pounce=ready('pounce');if(!leap&&!pounce)return null;const jump=this.jumpOpportunity(u,target,dist);
      if(jump.claimed||target.y>1.2)return null;
      if(leap&&jump.sweepThreat&&this.friendlySpace(u,target,leap)>=.65)return 'leap';
      if(pounce&&(jump.recoveringGuard||jump.missedRecovery||target.stun>.7)&&dist>=2.2&&this.friendlySpace(u,target,pounce)>=.65){
        const intercepted=this.nearby(target.x,target.z,8).some(v=>(v!==target||!jump.missedRecovery)&&v.team==='dig'&&v.hp>0&&v.stun<=0&&v.y<.7&&v.parryCooldown<=.15&&!this.bucketCommitted(v)&&guardStats('dig',5,this.config.tuning.dig).chance>0&&Math.hypot(v.x-target.x,v.z-target.z)<8&&Math.abs(angle(Math.atan2(u.z-v.z,u.x-v.x)-v.yaw))<1.31);
        if(!intercepted)return 'pounce';
      }
      if(pounce&&dist>9&&dist<=11.5&&this.time-(u.lastKnockbackAt??-Infinity)<3&&this.friendlySpace(u,target,pounce)>=.65)return 'pounce';
      if(leap&&dist>6.1&&dist<=10.5&&this.time-(u.lastKnockbackAt??-Infinity)<3&&this.friendlySpace(u,target,leap)>=.65)return 'leap';
    }else{
      if(u.buffActive){let count=0;for(const v of this.nearby(u.x,u.z,8))if(v.team==='rex'&&v.hp>0&&v.heldBy===null&&v.y<2.5&&(v.x-u.x)**2+(v.z-u.z)**2<64)count++;if(count>=2)for(const kind of ['spin','sweep']){const t=ready(kind);if(t&&this.predictedTargets(u,target,t)>=2)return kind;}}
      const rush=this.rushThreat(u);if(rush){const order=rush.behind?['spin','sweep']:['sweep','spin'];for(const kind of order){const t=ready(kind);if(t&&this.predictedTargets(u,target,t)>0)return kind;}}
      if(this.aerialThreat(u,target))return this.aerialCounterChoice(u,target,pool);
      const crowd=this.crowdCounterChoice(u,target,pool);if(crowd)return crowd;
      const grapple=ready('grapple');if(!grapple||target.y>1||dist>6.2||Math.hypot(target.vx,target.vz)>6)return null;
      const lateRecovery=target.action&&['bite','tail','ram'].includes(target.action.kind)&&!target.action.evasion&&target.action.age>target.action.duration*.78;const counter=u.counterUntil>this.time&&u.counterTarget===target.id,recovering=target.stun>.1||!target.action&&target.cool>.1||target.action?.missed||lateRecovery;
      if(!recovering||!counter&&!this.diggerCounterOpening(u,target)&&target.stun<=.3&&target.opening<=.2&&!lateRecovery)return null;
      let threats=0;for(const v of this.nearby(u.x,u.z,7))if(v.team==='rex'&&v.hp>0&&v.heldBy===null&&v.y<2.5&&(v.x-u.x)**2+(v.z-u.z)**2<49&&++threats>=3)return null;
      if(this.predictedTargets(u,target,grapple)>0)return 'grapple';
    }
    return null;
  }
  diggerFollowThrough(u,target,dist){
    const c=u.lastContact;if(u.team!=='dig'||!c||c.target!==target.id||this.time-c.time>1.35||target.hp<=0||target.y>2.5||target.heldBy!==null||dist>u.stats.range+.8||this.isRolling(target))return false;
    if(target.stun<=.1&&target.opening<=.2&&!target.action?.missed)return false;
    return availableTechniques('dig',5,this.config.tuning.dig).some(t=>t.kind!=='grapple'&&(u.nextTechniqueAt[t.kind]||0)<=this.time+.15);
  }
  crowdCounterChoice(u,target,pool){
    if(u.team!=='dig'||this.brain('dig').awareness<.4)return null;let count=0,flankers=0;
    for(const v of this.nearby(u.x,u.z,8.5)){if(v.team!=='rex'||v.hp<=0||v.heldBy!==null||v.y>2.5||(v.x-u.x)**2+(v.z-u.z)**2>72.25)continue;count++;if(Math.abs(angle(Math.atan2(v.z-u.z,v.x-u.x)-u.yaw))>1.1)flankers++;if(count>=6)break;}
    if(count<2)return null;const order=flankers||count>=3?['spin','sweep']:['sweep','spin'];
    for(const kind of order){const t=pool.find(t=>t.kind===kind);if(!t)continue;const contacts=this.predictedTargets(u,target,t);if(contacts>=2||flankers&&contacts>0)return kind;}return null;
  }
  comboChoice(u,target,dist,pool){
    const contact=u.lastContact;if(!contact||contact.target!==target.id||this.time-contact.time>2.5)return null;
    const ready=kind=>pool.find(t=>t.kind===kind),kind=contact.kind;
    if(u.team==='rex'){
      if(target.y>1.2)return null;
      if(contact.kind==='ram'&&contact.fromFlankRoll&&ready('tail')&&dist<=7.2)return 'tail';
      const crowded=this.nearby(u.x,u.z,7).filter(v=>v.team!==u.team&&v.hp>0&&v.heldBy===null&&v.y<1.5&&(v.x-u.x)**2+(v.z-u.z)**2<49).length>1;
      const order=kind==='ram'?(crowded?['tail','bite']:dist<4.5?['bite','tail']:['tail','bite']):kind==='bite'?['tail','ram']:kind==='tail'?(dist>4.8?['ram','bite']:['bite','ram']):['leap','pounce'].includes(kind)?['bite','tail','ram']:[];
      for(const next of order){const t=ready(next);if(!t)continue;const reach=next==='bite'?4.8:next==='tail'?7.2:8.5;if(dist<=reach&&(next!=='ram'||dist>=4.8)&&this.friendlySpace(u,target,t)>=.4)return next;}
    }else{
      const crowded=this.nearby(u.x,u.z,8).filter(v=>v.team!==u.team&&v.hp>0&&v.heldBy===null&&v.y<2&&(v.x-u.x)**2+(v.z-u.z)**2<64).length>1;
      if(kind==='uppercut'&&target.y>3.5&&!crowded)return 'wait';
      const order=kind==='uppercut'?(target.vy<=0?['smash','sweep']:[]):kind==='sweep'?(crowded?['spin','uppercut']:['uppercut','smash']):kind==='smash'?(target.stun>.3?['grapple','uppercut','sweep']:['sweep','uppercut']):kind==='spin'?['sweep','uppercut','smash']:kind==='throw'?(crowded?['spin','sweep','smash']:['smash','uppercut','sweep']):[];
      for(const next of order){const t=ready(next);if(!t||next==='grapple'&&(dist>5.5||target.y>1||Math.hypot(target.vx,target.vz)>5||crowded))continue;if(this.predictedTargets(u,target,t)>0)return next;}
    }
    return null;
  }
  rollingResponse(u,target,pool){
    if(u.team!=='dig'||!this.isRolling(target))return undefined;
    const a=target.action,remaining=(a.rollDuration??1.6)-(a.age-a.landAt),dx=target.x-u.x,dz=target.z-u.z,dist=Math.hypot(dx,dz),closing=-((target.vx-u.vx)*dx+(target.vz-u.vz)*dz)/(dist||1),ready=kind=>pool.find(t=>t.kind===kind);
    // A healthy attacker in reach matters more than chasing an immune roller.
    const threat=this.nearby(u.x,u.z,7).some(v=>v!==target&&v.team==='rex'&&v.hp>0&&v.heldBy===null&&!this.isRolling(v)&&v.action&&!v.action.resolved&&v.action.target===u.id);
    if(threat)return undefined;
    if(remaining>.45){if(closing<1||dist>8)return null;for(const kind of ['sweep','spin']){const tech=ready(kind);if(tech&&this.predictedTargets(u,target,tech)>0)return kind;}return null;}
    // Commit a normal windup near the visible end of the roll; no damage bypass or instant counter.
    const lead=Math.min(.3,remaining),x=target.x+target.vx*lead,z=target.z+target.vz*lead,predicted={...target,x,z,y:0,vx:0,vz:0};
    if(Math.hypot(x-u.x,z-u.z)>u.stats.range+1)return null;
    for(const kind of ['smash','uppercut','sweep']){const tech=ready(kind);if(tech&&this.predictedTargets(u,predicted,tech,[predicted])>0)return kind;}
    return null;
  }
  chooseTechnique(u,target,dist,pool){

    const response=this.rollingResponse(u,target,pool);if(response!==undefined)return response;
    const priority=this.techniquePriority(u,target,dist,pool);if(priority)return priority;if(u.team==='dig'&&this.aerialThreat(u,target))return null;const combo=this.comboChoice(u,target,dist,pool);if(combo==='wait')return null;if(combo&&(u.team==='rex'&&this.isDuel(u,target)||u.team==='dig'&&this.diggerFollowThrough(u,target,dist)))return combo;

    const weights=this.techniqueWeights(u,target,dist,pool).map((weight,i)=>pool[i].kind===combo?weight*1.8:weight),total=weights.reduce((a,b)=>a+b,0);if(total<=0)return null;let roll=this.rng()*total;
    for(let i=0;i<pool.length;i++){if(weights[i]<=0)continue;roll-=weights[i];if(roll<=0)return pool[i].kind;}return pool.findLast((_,i)=>weights[i]>0)?.kind||null;
  }
  refreshTail(u){if(!u.tailRechargeEnds)return;while(u.tailRechargeEnds.length&&u.tailRechargeEnds[0]<=this.time)u.tailRechargeEnds.shift();u.nextTechniqueAt.tail=u.tailRechargeEnds.length>=2?u.tailRechargeEnds[0]:0;}
  spendTail(u){this.refreshTail(u);const queue=u.tailRechargeEnds||(u.tailRechargeEnds=[]);if(queue.length>=2)return false;queue.push(Math.max(this.time,queue.at(-1)||0)+2*moveTuning(this.config,'rex','tail').cooldown);this.refreshTail(u);return true;}
  refreshRam(u){
    const queue=u.ramRechargeEnds;if(queue)while(queue.length&&queue[0]<=this.time)queue.shift();
    u.nextTechniqueAt.ram=Math.max(u.ramLockedUntil||0,rageUnlimited(u,this.time)?0:queue?(queue.length>=3?queue[0]:0):(u.nextTechniqueAt.ram||0));
  }
  spendRam(u){this.refreshRam(u);if((u.ramLockedUntil||0)>this.time)return false;if(rageUnlimited(u,this.time))return true;const queue=u.ramRechargeEnds||(u.ramRechargeEnds=[]);if(queue.length>=3)return false;queue.push(Math.max(this.time,queue.at(-1)||0)+2*moveTuning(this.config,'rex','ram').cooldown);this.refreshRam(u);return true;}
  canGrabSafely(u,target){
    return !this.nearby(u.x,u.z,8.5).some(v=>v!==target&&v.team!==u.team&&v.hp>0&&v.heldBy===null&&v.y<1.5&&v.stun<=.2&&(v.x-u.x)**2+(v.z-u.z)**2<72.25&&((v.x-u.x)**2+(v.z-u.z)**2<36||v.target===u.id||v.action?.target===u.id));
  }
  beginAttack(u,target,dist,preferred=null){
    if(u.team==='rex')this.refreshRam(u);
    const level=this.config[u.team+'Skill'],skill=crewProfile(level),s=u.stats;
    const pool=availableTechniques(u.team,level,this.config.tuning[u.team]).filter(t=>(u.nextTechniqueAt[t.kind]||0)<=this.time&&(u.team!=='rex'||dist<=s.range+1.3||t.kind==='tail'&&(dist<=7.2||preferred==='tail'&&dist<=8.2)||t.kind==='ram'&&dist<=8.5||t.kind==='leap'&&dist<=10.5||t.kind==='pounce'&&dist<=11.5)&&(t.kind!=='grapple'||target.y<1.5&&target.heldBy===null&&dist<=6.2&&this.canGrabSafely(u,target)));
    if(!pool.length)return false;const kind=preferred||this.chooseTechnique(u,target,dist,pool);if(!kind||!pool.some(t=>t.kind===kind))return false;u.attackCount++;u.techniqueUses??={};u.techniqueUses[kind]=(u.techniqueUses[kind]||0)+1;if(u.team==='dig'&&u.rushResponseUntil>this.time&&['sweep','spin'].includes(kind)){u.guardUntil=0;u.parry=0;}
    const momentum=kind==='ram'?clamp((u.runUp||0)/12,0,1):0;u.runUp=0;u.charge=0;
    const tech=pool.find(t=>t.kind===kind);if(u.team==='rex'&&kind==='ram')this.spendRam(u);else if(u.team==='rex'&&kind==='tail')this.spendTail(u);else u.nextTechniqueAt[kind]=this.time+tech.cooldown*moveTuning(this.config,u.team,kind).cooldown;
    const baseDuration=kind==='pounce'?2.1:kind==='grapple'?1.6:kind==='spin'?1.4:u.team==='dig'?1.05:kind==='tail'?1.04:kind==='leap'?.9:.66;
    const counter=u.counterUntil>this.time&&u.counterTarget===target.id&&(u.team==='rex'?['bite','ram','leap']:['smash','uppercut','sweep','grapple']).includes(kind),linked=u.lastContact?.target===target.id&&this.time-u.lastContact.time<2&&u.lastContact.kind!==kind,duration=baseDuration*(u.team==='dig'&&u.buffActive&&['sweep','spin'].includes(kind)&&this.nearby(u.x,u.z,9).filter(v=>v.team==='rex'&&v.hp>0&&v.heldBy===null&&(v.x-u.x)**2+(v.z-u.z)**2<81).length>=2?.8:1)*(u.buffActive&&u.team==='rex'?.85:1)*(u.buffActive&&u.team==='rex'&&linked&&['ram','pounce','leap'].includes(u.lastContact?.kind)?.9:1)*(kind==='ram'&&u.rollReentryTarget===target.id&&u.rollReentryUntil>this.time?.85:1)*(u.rollFollowUntil>this.time&&u.rollFollowTarget===target.id&&['bite','tail'].includes(kind)?.85:1)*(counter?.75:1)*(linked?(u.team==='rex'?.8:kind==='grapple'?1:.94):1)*(u.team==='dig'&&kind!=='grapple'?1/1.25:1)*(.92+this.rng()*.16)*skill.windup;
    const pulses=kind==='spin'?[.28,.36,.44,.52,.6,.68,.76,.84,.92,1]:kind==='grapple'?[.28,.72]:['tail','sweep','spin','smash','uppercut'].includes(kind)?[.3,.36,.42,.48,.54,.6,.66,.72]:[.48];
    const pressureBoost=u.team==='dig'&&u.buffActive&&['sweep','spin'].includes(kind)?1+.18*(u.overdrivePressure||0):1;if(pressureBoost>1)u.overdrivePressure=0;
    u.action={kind,momentum,fromFlankRoll:kind==='ram'&&u.rollReentryTarget===target.id&&u.rollReentryUntil>this.time,pressureBoost,buffRecovery:u.buffActive&&u.team==='dig'?1.4:1,age:0,duration,impact:duration*pulses[0],peakImpact:duration*(kind==='uppercut'?.52:.48),pulses:pulses.map(p=>p*duration),pulse:0,resolved:false,target:target.id,captured:null,landAt:null,followPulse:0,counterChecked:false,missed:false,yaw:Math.atan2(target.z-u.z,target.x-u.x),side:u.side};
    if(u.team==='rex'&&u.tailBypassLink){const link=u.tailBypassLink;if(kind!=='tail'&&target.id===link.target&&this.time<=link.until)u.action.parryBypassTarget=target.id;u.tailBypassLink=null;}
    if(counter){u.counterUntil=0;u.parry=0;u.guardUntil=0;}if(u.team==='dig'){u.action.counterDrive=['smash','uppercut'].includes(kind)&&dist<6.5&&this.diggerCounterOpening(u,target);u.action.driveX=u.x;u.action.driveZ=u.z;u.action.bucketReach=clamp(dist-2.2,.9,6.5)/(u.scale||1);const near=this.nearby(u.x,u.z,14),close=near.filter(v=>v.team==='rex'&&v.hp>0&&Math.hypot(v.x-u.x,v.z-u.z)<14).length;u.action.multiDefense=['sweep','spin'].includes(kind)&&near.filter(v=>v.team==='rex'&&v.hp>0&&v.heldBy===null&&v.y<2.5&&(v.x-u.x)**2+(v.z-u.z)**2<81).length>=2;u.action.aimLead=(close<=2?.24:close<=5?.18:close<=10?.1:0)*this.brain('dig').awareness;}
    if(kind==='leap'||kind==='pounce'){const point=this.jumpLandingPoint(u,target,kind);u.action.landingX=point.x;u.action.landingZ=point.z;u.action.landingOffsetX=point.x-target.x;u.action.landingOffsetZ=point.z-target.z;}
    u.cool=s.period*(.92+this.rng()*.16)*(kind==='grapple'?1.2:1)*moveTuning(this.config,u.team,kind).cooldown;u.attack=1;u.attackHistory.push(kind);if(u.attackHistory.length>30)u.attackHistory.shift();
    if(kind==='leap'||kind==='pounce'){u.aerialAttack={kind,startedAt:this.time};u.vy=kind==='pounce'?13+this.rng()*1.5:11.5+this.rng();u.vx+=Math.cos(u.yaw)*(kind==='pounce'?7:6);u.vz+=Math.sin(u.yaw)*(kind==='pounce'?7:6);u.pitchV=-1.4;this.effect(u.x,.1,u.z,'dust',kind==='pounce'?2:1.2);}
    if(kind==='ram'){if(u.rollReentryTarget===target.id&&u.rollReentryUntil>this.time)u.rollReentryUntil=0;u.action.dashStart=Math.min(.08,u.action.impact*.25);u.action.dashSpeed=26+3*momentum;u.action.dashDistance=Math.min(4.8,Math.max(0,dist-3.2));}
    if(kind==='pounce'){const plan=this.flankRollPlan(u,target,dist);if(plan){Object.assign(u.action,{evasion:true,evadeFlank:true,tacticalFlank:true,evadeSide:plan.side,evadeHeading:plan.yaw,rollGoalX:plan.goalX,rollGoalZ:plan.goalZ,landingX:plan.x,landingZ:plan.z,landingOffsetX:undefined,landingOffsetZ:undefined,yaw:plan.yaw});u.vy=7.6;u.vx=Math.cos(plan.yaw)*12;u.vz=Math.sin(plan.yaw)*12;u.intent='flank_roll';}}
    if(kind==='uppercut'){u.vy=2.7;u.pitchV=-1.9;}
    if(u.rollFollowUntil>this.time&&u.rollFollowTarget===target.id&&['bite','tail'].includes(kind))u.rollFollowUntil=0;
    if(kind==='pounce'||kind==='grapple')this.event(unitLabel(u)+' → '+unitLabel(target)+' · '+TECHNIQUES[u.team].find(t=>t.kind===kind).name);
    return true;
  }
  flankRollPlan(u,target,dist){
    if(u.team!=='rex'||!this.isDuel(u,target)||target.y>1||dist<3.5||dist>9||u.lastContact?.kind!=='ram'||u.lastContact.target!==target.id||this.time-u.lastContact.time>1.8||(u.nextTechniqueAt.ram||0)>this.time)return null;
    const forward=Math.atan2(target.z-u.z,target.x-u.x),fx=Math.cos(target.yaw),fz=Math.sin(target.yaw),px=-fz,pz=fx;let best=null,score=Infinity;
    for(const side of [-1,1]){const x=target.x+px*side*4.8-fx*.8,z=target.z+pz*side*4.8-fz*.8,goalX=target.x+px*side*3.8-fx*4.6,goalZ=target.z+pz*side*3.8-fz*4.6,dx=x-u.x,dz=z-u.z;
      if(dx*Math.cos(forward)+dz*Math.sin(forward)<1.5||Math.max(Math.abs(x),Math.abs(z),Math.abs(goalX),Math.abs(goalZ))>this.radius-3)continue;
      let risk=Math.hypot(dx,dz)*.05;for(const f of [.4,.75,1])for(const v of this.nearby(u.x+dx*f,u.z+dz*f,3.5))if(v!==u&&v!==target&&v.hp>0)risk+=Math.max(0,3.5-Math.hypot(v.x-u.x-dx*f,v.z-u.z-dz*f));
      if(risk<score){score=risk;best={x,z,yaw:Math.atan2(dz,dx),goalX,goalZ,side};}
    }return score<=6?best:null;
  }
  tryTailCounter(u,target,dist,probe=false){
    if(u.team!=='rex'||this.config.tuning.rex.parryChance===0||!this.config.tuning.rex.moves.tail.enabled||this.config.rexSkill<3||u.stun>0||u.y>.1||u.heldBy!==null||u.cool>.75||u.parryCooldown>.1||(u.nextTechniqueAt.tail||0)>this.time||dist>8.2)return false;
    const own=u.action;if(own&&(!own.resolved||own.evasion||own.age<own.impact+.1))return false;
    const threat=target.action;if(!threat||!['smash','sweep','uppercut','spin'].includes(threat.kind)||threat.missed)return false;
    let until=(threat.peakImpact??threat.impact)-threat.age;if(threat.kind==='spin'){const direction=threat.side||1,tipYaw=target.yaw+(target.armPose?.slew||0),bearing=Math.atan2(u.z-target.z,u.x-target.x),remaining=((bearing-tipYaw)*direction%(Math.PI*2)+Math.PI*2)%(Math.PI*2),rate=Math.max(.5,Math.abs(target.armPose?.vs||0)||Math.PI*2/threat.duration);until=remaining/rate;}if(until<.1||until>.55||threat.kind!=='spin'&&Math.abs(angle(Math.atan2(u.z-target.z,u.x-target.x)-threat.yaw))>1.4)return false;
    if(probe)return true;if(!this.beginAttack(u,target,dist,'tail'))return false;const a=u.action;a.defensive=true;const ratio=(until<.26?.6:.8)*(.8/1.04);a.duration*=ratio;a.impact*=ratio;a.peakImpact*=ratio;a.pulses=a.pulses.map(t=>t*ratio);u.intent='tail_counter';return true;
  }
  evadeRam(u,target,probe=false){
    if(u.team==='rex')this.refreshRam(u);
    if(u.team!=='rex'||!this.config.tuning.rex.moves.ram.enabled||this.config.rexSkill<3||u.action||u.cool>(['smash','uppercut'].includes(target.action?.kind)?.75:.25)||u.stun>0||u.y>.1||(u.nextTechniqueAt.ram||0)>this.time)return false;
    const a=target.action;if(!a||!['smash','uppercut','sweep'].includes(a.kind))return false;const until=a.impact-a.age,d=Math.hypot(target.x-u.x,target.z-u.z);if(until<.04||until>.38||d>9.5)return false;
    const aim=Math.atan2(u.z-target.z,u.x-target.x);if(Math.abs(angle(aim-a.yaw))>1)return false;
    const committedCounter=['smash','uppercut'].includes(a.kind)&&a.age/a.duration>=.24&&!a.missed;if(target.stun>.1||!committedCounter&&(target.opening>.1||target.parryCooldown>.25||u.lastContact?.target===target.id&&this.time-u.lastContact.time<1.25))return false;const forward=u.speed>u.stats.speed*.5?Math.atan2(u.vz,u.vx):u.yaw;const escapeDistance=clamp(6+u.speed*.12,6.5,9);let best=null,risk=Infinity;
    for(const side of [-1,1]){const yaw=forward+side*Math.PI/5.5,x=u.x+Math.cos(yaw)*escapeDistance,z=u.z+Math.sin(yaw)*escapeDistance;if(Math.abs(x)>this.radius-3||Math.abs(z)>this.radius-3)continue;let score=0;for(const fraction of [.33,.66,1]){const px=u.x+(x-u.x)*fraction,pz=u.z+(z-u.z)*fraction;for(const ally of this.nearby(px,pz,4))if(ally!==u&&ally.hp>0)score+=Math.max(0,(u.stats.radius+ally.stats.radius)*.85-Math.hypot(ally.x-px,ally.z-pz));}if(score<risk){risk=score;best=yaw;}}
    if(best===null||risk>2)return false;if(probe)return true;this.spendRam(u);u.cool=Math.max(u.cool,.4);u.action={kind:'ram',evasion:true,evadeSide:Math.sign(angle(best-forward)),target:target.id,age:0,duration:.68,impact:.5,pulses:[],pulse:0,resolved:true,yaw:best,side:u.side,dashStart:0,dashYaw:best,dashDistance:escapeDistance,evadeStartSpeed:Math.max(u.speed,u.stats.speed*.8),dashSpeed:22};u.intent='evade_dash';return true;
  }
  isDuel(u,target){return this.isolatedOpponent(u,target)&&!this.nearby(u.x,u.z,11).some(v=>v!==u&&v.team===u.team&&v.hp>0&&v.heldBy===null&&(v.x-u.x)**2+(v.z-u.z)**2<121);}
  isolatedOpponent(u,target){for(const v of this.nearby(u.x,u.z,11))if(v!==target&&v.team!==u.team&&v.hp>0&&v.heldBy===null&&(v.x-u.x)**2+(v.z-u.z)**2<121)return false;return true;}
  chooseRexDefense(u,target,dist){if(u.team!=='rex')return false;const isolated=this.isDuel(u,target);if(!isolated&&this.evadePounce(u,target,dist))return true;const tail=this.tryTailCounter(u,target,dist,true),dash=this.evadeRam(u,target,true);if(!tail&&!dash)return isolated?this.evadePounce(u,target,dist):false;const useTail=tail&&(!dash||(u.lastBalancedDefense?u.lastBalancedDefense==='ram':this.rng()<.5));const ok=useTail?this.tryTailCounter(u,target,dist):this.evadeRam(u,target);if(ok&&tail&&dash)u.lastBalancedDefense=useTail?'tail':'ram';return ok;}
  evadePounce(u,target,dist){
    if(u.team!=='rex'||u.action||u.stun>0||u.y>.1||u.heldBy!==null||u.cool>.35||!this.config.tuning.rex.moves.pounce.enabled||(u.nextTechniqueAt.pounce||0)>this.time||dist>11.5)return false;
    const a=target.action,until=a?(a.peakImpact??a.impact)-a.age:Infinity;
    if(!a||a.missed||!['smash','sweep','spin'].includes(a.kind)||until<.25||until>.6||dist<3.5)return false;
    const forward=Math.atan2(target.z-u.z,target.x-u.x),fx=Math.cos(target.yaw),fz=Math.sin(target.yaw),px=-fz,pz=fx;let best=null,score=Infinity;
    for(const side of [-1,1]){const x=target.x+px*side*4.8-fx*.8,z=target.z+pz*side*4.8-fz*.8,goalX=target.x+px*side*3.8-fx*4.6,goalZ=target.z+pz*side*3.8-fz*4.6,dx=x-u.x,dz=z-u.z,yaw=Math.atan2(dz,dx);
      if(dx*Math.cos(forward)+dz*Math.sin(forward)<1.5||Math.abs(x)>this.radius-3||Math.abs(z)>this.radius-3||Math.abs(goalX)>this.radius-3||Math.abs(goalZ)>this.radius-3)continue;
      let risk=Math.hypot(dx,dz)*.05;for(const fraction of [.4,.75,1]){const cx=u.x+dx*fraction,cz=u.z+dz*fraction;for(const v of this.nearby(cx,cz,3.5))if(v!==u&&v!==target&&v.hp>0)risk+=Math.max(0,3.5-Math.hypot(v.x-cx,v.z-cz));}
      if(risk<score){best={x,z,yaw,goalX,goalZ,side};score=risk;}
    }
    if(!best||score>6||!this.beginAttack(u,target,dist,'pounce'))return false;
    Object.assign(u.action,{evasion:true,evadeFlank:true,evadeSide:best.side,evadeHeading:best.yaw,rollGoalX:best.goalX,rollGoalZ:best.goalZ,landingX:best.x,landingZ:best.z,landingOffsetX:undefined,landingOffsetZ:undefined,yaw:best.yaw});u.vy=7.6;u.vx=Math.cos(best.yaw)*12;u.vz=Math.sin(best.yaw)*12;u.intent='evade_roll';return true;
  }
  isRolling(u){const a=u?.action;return u?.team==='rex'&&u.hp>0&&a?.kind==='pounce'&&a.landAt!=null&&a.age-a.landAt>=.06&&a.age-a.landAt<(a.rollDuration??1.6)&&!a.resolved;}
  guardThreat(u,fallback=null){
    let best=null,bestScore=Infinity;const slew=u.armPose?.slew||0,rate=bucketTurnSpeed(u);
    for(const enemy of this.nearby(u.x,u.z,11)){const a=enemy.action;if(enemy.team!=='rex'||enemy.hp<=0||enemy.heldBy!==null||!a||a.resolved||a.parryBypassTarget===u.id||!['bite','ram','leap','pounce'].includes(a.kind))continue;
      const d=Math.hypot(enemy.x-u.x,enemy.z-u.z);if(a.target!==u.id&&d>5.5)continue;
      const airborne=['leap','pounce'].includes(a.kind)&&a.landAt===null;
      const until=airborne?(enemy.vy+Math.sqrt(enemy.vy**2+2*this.flightGravity(enemy)*enemy.y))/this.flightGravity(enemy):(a.pulses?.find(t=>t>a.age)??a.impact)-a.age;
      if(until<.03||until>1.15)continue;const turn=Math.abs(angle(Math.atan2(enemy.z-u.z,enemy.x-u.x)-u.yaw-slew)),arrival=turn/rate;
      const score=until+Math.max(0,arrival-until)*1.5+(u.guardTarget===enemy.id?-.06:0);if(score<bestScore){best=enemy;bestScore=score;}
    }return best||fallback;
  }
  prepareGuard(u,target){
    if(u.team!=='dig'||u.guardUntil>this.time||u.parryCooldown>0||u.guardBrokenUntil>this.time)return;
    target=this.guardThreat(u,target);const breaking=u.comboBreakUntil>this.time&&u.comboThreat===target?.id,a=target?.action;
    if(this.isRolling(target)||a?.kind==='tail'||a?.parryBypassTarget===u.id)return;
    if((u.action&&u.action.age/u.action.duration>=.24&&u.action.age/u.action.duration<(breaking?.65:.76))||u.stun>(breaking?.18:0)||u.y>.4||!a||a.resolved||u.guardAgainst===a)return;
    const guard=guardStats('dig',5,this.config.tuning.dig),until=a.impact-a.age,d=Math.hypot(target.x-u.x,target.z-u.z),turn=Math.abs(angle(Math.atan2(target.z-u.z,target.x-u.x)-u.yaw-(u.armPose?.slew||0))),lookahead=.34+Math.min(.85,turn/bucketTurnSpeed(u))*this.brain('dig').awareness;
    if(guard.chance<=0||until<.03||until>lookahead||d>guard.reach)return;
    u.action=null;u.attack=0;u.guardAgainst=a;u.guardTarget=target.id;u.guardCapacity=10;if(this.time-(u.lastBucketParryAt??-Infinity)>=1){u.guardBlocks=0;u.guardBlockedActions=new WeakSet();}else{u.guardBlocks??=0;u.guardBlockedActions??=new WeakSet();}u.guardUntil=this.time+Math.max(.42,until+.15);u.guardReach=clamp(d-2.8,.9,6.3)/(u.scale||1);u.guardHeight=clamp(target.y+3.2-u.y,1.7,6.3);u.guardSlew=angle(Math.atan2(target.z-u.z,target.x-u.x)-u.yaw);u.parry=.28;
  }
  advanceRam(u){
    const a=u.action;if(a?.kind!=='ram'||a.dashStart===undefined||a.dashInterrupted||u.stun>0||u.y>.7||u.heldBy!==null)return;
    if(a.age<a.dashStart)return;
    if(a.dashX===undefined){a.dashX=u.x;a.dashZ=u.z;a.dashYaw=a.yaw;if(!a.evasion)u.yaw=a.dashYaw;}
    const nx=Math.cos(a.dashYaw),nz=Math.sin(a.dashYaw),target=this.units[a.target];
    const travelled=Math.max(0,(u.x-a.dashX)*nx+(u.z-a.dashZ)*nz);if(a.evasion){const obstacle=this.nearby(u.x,u.z,4).some(v=>v!==u&&v.hp>0&&v.y<1&&Math.hypot(v.x-u.x,v.z-u.z)<u.stats.radius+v.stats.radius&&(v.x-u.x)*nx+(v.z-u.z)*nz>.3);if(obstacle){a.dashInterrupted=true;u.vx*=.7;u.vz*=.7;return;}const t=a.age/a.duration,ramp=clamp(a.age/.12,0,1),brake=1-clamp((a.age-.38)/.22,0,1),speed=Math.min((a.evadeStartSpeed+(a.dashSpeed-a.evadeStartSpeed)*ramp)*brake,Math.sqrt(Math.max(0,120*(a.dashDistance-travelled))));const acceleration=65*STEP;u.vx+=clamp(nx*speed-u.vx,-acceleration,acceleration);u.vz+=clamp(nz*speed-u.vz,-acceleration,acceleration);const facing=t<.6?a.dashYaw:target?Math.atan2(target.z-u.z,target.x-u.x):u.yaw;u.yaw+=clamp(angle(facing-u.yaw),-.11,.11);u.intent='evade_dash';return;} const gap=target?.hp>0?(target.x-u.x)*nx+(target.z-u.z)*nz-3.2:0;
    if(a.age<a.impact&&!a.dashStopped&&target?.hp>0&&target.heldBy===null&&gap>.05&&travelled<a.dashDistance){
      const speed=Math.min(a.dashSpeed,gap/STEP,(a.dashDistance-travelled)/STEP);u.vx=nx*speed;u.vz=nz*speed;u.intent='dash';
    }else if(!a.dashStopped){u.vx*=.27;u.vz*=.27;a.dashStopped=true;}
  }
  jumpLandingPoint(u,target,kind){
    const radius=kind==='pounce'?6.5:3.6,edge=this.radius-3;
    const cx=clamp(target.x+clamp(target.vx,-4,4)*.5,-edge,edge),cz=clamp(target.z+clamp(target.vz,-4,4)*.5,-edge,edge);
    const offsets=[[0,0]];if(u.gapPoint&&Math.hypot(u.gapPoint.x-cx,u.gapPoint.z-cz)<radius*.8)offsets.push([u.gapPoint.x-cx,u.gapPoint.z-cz]);for(const delta of [Math.PI,Math.PI*.65,-Math.PI*.65,0])for(const reach of [1.7,3])offsets.push([Math.cos(target.yaw+delta)*reach,Math.sin(target.yaw+delta)*reach]);
    let best={x:cx,z:cz},bestScore=-Infinity;
    const enemies=this.nearby(cx,cz,11).filter(v=>v.team!==u.team&&v.hp>0&&v.heldBy===null),allies=this.nearby(cx,cz,23).filter(v=>v!==u&&v.team===u.team&&v.hp>0&&['leap','pounce'].includes(v.action?.kind)&&v.action.landAt===null);
    const lineBreak=u.enteredCombat&&this.squadState.get(u.squadId)?.split&&enemies.filter(v=>Math.hypot(v.x-cx,v.z-cz)<7).length>=3,fx=cx-u.x,fz=cz-u.z,fd=Math.hypot(fx,fz)||1;
    if(lineBreak)offsets.push([fx/fd*2.2,fz/fd*2.2]);
    for(const [ox,oz] of offsets){const x=clamp(cx+ox,-edge,edge),z=clamp(cz+oz,-edge,edge),travel=Math.hypot(x-u.x,z-u.z);if(travel>14)continue;
      let score=-travel*.08+(lineBreak?Math.max(0,(ox*fx+oz*fz)/fd)*1.1:0),risk=0;for(const v of enemies){const dx=x-v.x,dz=z-v.z,d=Math.hypot(dx,dz);if(d<radius&&v.y<2.5)score+=v===target?2.2:1.1;
        if(d<7&&v.y<.7&&v.stun<=0&&v.parryCooldown<=.15&&Math.abs(angle(Math.atan2(dz,dx)-v.yaw))<guardStats('dig',this.config.digSkill,this.config.tuning.dig).arc)risk=Math.max(risk,guardStats('dig',this.config.digSkill,this.config.tuning.dig).chance);}
      score-=risk*(kind==='pounce'?3.5:1.5);
      for(const ally of allies)if(Number.isFinite(ally.action.landingX)&&Math.hypot(x-ally.action.landingX,z-ally.action.landingZ)<3)score-=1.2;
      if(score>bestScore){bestScore=score;best={x,z};}
    }return best;
  }
  steerJump(u){
    const a=u.action;if(!a||!['leap','pounce'].includes(a.kind)||a.landAt!==null||u.y<.3||u.stun>.2||u.heldBy!==null)return;
    const target=this.units[a.target];
    if(u.vy>0&&target?.hp>0&&Number.isFinite(a.landingOffsetX)){const edge=this.radius-3;a.landingX=clamp(a.landingX+clamp(target.x+a.landingOffsetX-a.landingX,-.1,.1),-edge,edge);a.landingZ=clamp(a.landingZ+clamp(target.z+a.landingOffsetZ-a.landingZ,-.1,.1),-edge,edge);}
    const x=a.landingX??target?.x,z=a.landingZ??target?.z;if(!Number.isFinite(x)||!Number.isFinite(z))return;
    const dx=x-u.x,dz=z-u.z,g=this.flightGravity(u),remaining=Math.max(.18,(u.vy+Math.sqrt(u.vy*u.vy+2*g*u.y))/g),cap=a.kind==='pounce'?12:10;
    if(a.evadeFlank){const heading=a.evadeHeading,along=dx*Math.cos(heading)+dz*Math.sin(heading),speed=clamp(along/remaining,4,16),cross=clamp((-dx*Math.sin(heading)+dz*Math.cos(heading))/remaining,-4,4);u.vx+=(Math.cos(heading)*speed-Math.sin(heading)*cross-u.vx)*STEP*5.5;u.vz+=(Math.sin(heading)*speed+Math.cos(heading)*cross-u.vz)*STEP*5.5;}else{u.vx+=(clamp(dx/remaining,-cap,cap)-u.vx)*STEP*5.5;u.vz+=(clamp(dz/remaining,-cap,cap)-u.vz)*STEP*5.5;}
    if(Math.hypot(dx,dz)>1){const face=a.evadeFlank?a.evadeHeading:!a.evasion&&remaining<.45&&target?.hp>0?Math.atan2(target.z-u.z,target.x-u.x):Math.atan2(dz,dx),turn=remaining<.45?.18:.07;u.yaw+=clamp(angle(face-u.yaw),-turn,turn);a.yaw=u.yaw;}
  }
  strikeLeapLanding(u,hits){
    const a=u.action,target=this.units[a.target],tech=TECHNIQUES.rex.find(t=>t.kind==='leap'),skill=crewProfile(this.config.rexSkill);
    const nearby=this.nearby(u.x,u.z,4.5).filter(v=>v.team!==u.team&&v.hp>0&&v.heldBy===null&&v.y<2&&Math.hypot(v.x-u.x,v.z-u.z)<=4.5).sort((x,y)=>(x===target?-1:y===target?1:Math.hypot(x.x-u.x,x.z-u.z)-Math.hypot(y.x-u.x,y.z-u.z)));
    let count=0;for(const v of nearby){const primary=v===target;if(primary&&this.rng()>skill.accuracy)continue;const critical=this.rng()<skill.critical;
      hits.push({source:u,target:v,attackToken:a,damage:u.stats.damage*tech.damage*(primary?1:.1)*(.78+this.rng()*.44)*(critical?1.55:1),kind:'leap',side:a.side,critical,parryable:primary,landingShock:true,impactScale:primary?1:.45});if(++count>=tech.targets)break;}
    a.missed=count===0;if(a.missed){u.opening=Math.max(u.opening,.8);u.cool=Math.max(u.cool,.8);}
    this.effect(u.x,.15,u.z,'impact',1.8,'rex');this.effect(u.x,.1,u.z,'dust',1.8);
  }
  tailTouches(u,v,action=u.action){
    const a=action;if(!a)return false;const scale=u.scale||1,r=(v.stats.radius+.45)*(v.scale||1),body=v.team==='dig'?1.5:1.2;
    if(Math.abs((u.y+2.1*scale)-(v.y+2))>2.4)return false;
    for(let i=0;i<4;i++){const t=i/3,phase=clamp((a.age-STEP*(1-t))/a.duration,0,1),yaw=u.yaw+tailTurn(phase,a.side,a.defensive),ca=Math.cos(yaw),sa=Math.sin(yaw),cx=u.x-u.vx*STEP*(1-t),cz=u.z-u.vz*STEP*(1-t),sway=Math.sin(phase*Math.PI)*1.4;
      const ax=cx-2.8*scale*ca,az=cz-2.8*scale*sa,bx=cx-7.2*scale*ca-sway*scale*sa,bz=cz-7.2*scale*sa+sway*scale*ca,dx=bx-ax,dz=bz-az;
      for(const offset of [-body,0,body]){const x=v.x+Math.cos(v.yaw)*offset,z=v.z+Math.sin(v.yaw)*offset,q=clamp(((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1),0,1);if(Math.hypot(x-ax-q*dx,z-az-q*dz)<=r)return true;}
    }return false;
  }
  advanceRoll(u,hits){
    const a=u.action,elapsed=a.age-a.landAt,duration=a.rollDuration??1.6,q=clamp((elapsed-.06)/(duration-.1),0,1);
    if(elapsed>=duration){rollContacts(this,u,hits,true);const opponent=this.units[a.target];if(a.evadeFlank&&opponent?.hp>0&&u.stun<=.2&&u.y<.3){const gap=Math.hypot(opponent.x-u.x,opponent.z-u.z),bearing=Math.abs(angle(Math.atan2(u.z-opponent.z,u.x-opponent.x)-opponent.yaw));if(gap>=2.8&&gap<=9&&bearing>Math.PI/3){u.rollReentryTarget=opponent.id;u.rollReentryUntil=this.time+1.3;u.cool=Math.min(u.cool,.06);u.reactionWait=0;}}a.resolved=true;a.duration=Math.min(a.duration,a.age+.04);const contact=u.lastContact;if(contact?.kind==='leap'&&a.rollHitIds?.has(contact.target)&&this.time-contact.time<1.5){u.rollFollowTarget=contact.target;u.rollFollowUntil=this.time+1.2;u.cool=Math.min(u.cool,.18);}return;}
    if(u.stun>.25||u.heldBy!==null||u.y>.5||elapsed<.06)return;
    a.rollStartYaw??=a.rollYaw??a.yaw;a.rollYaw??=a.yaw;a.rollDistance??=0;
    if(a.rollLastX!=null&&this.time>=(u.rollPushUntil||0))a.rollDistance+=Math.hypot(u.x-a.rollLastX,u.z-a.rollLastZ);
    a.rollLastX=u.x;a.rollLastZ=u.z;
    const target=this.units[a.target],limit=a.evasion?ROLL.evasionTravel:ROLL.attackTravel,remaining=Math.max(0,limit-a.rollDistance);
    let desired=a.rollStartYaw,approach=Infinity;
    if(a.evadeFlank){const gx=a.rollGoalX-u.x,gz=a.rollGoalZ-u.z;desired=a.rollStartYaw+clamp(angle(Math.atan2(gz,gx)-a.rollStartYaw),-.9,.9);}
    if(!a.evasion&&target?.hp>0&&target.heldBy===null){const dx=target.x+clamp(target.vx,-5,5)*.12-u.x,dz=target.z+clamp(target.vz,-5,5)*.12-u.z;approach=dx*Math.cos(a.rollYaw)+dz*Math.sin(a.rollYaw);desired=a.rollStartYaw+clamp(angle(Math.atan2(dz,dx)-a.rollStartYaw),-.75,.75);}
    // Curved steering preserves forward momentum; it never flips toward a target behind the roll.
    if(this.time>=(u.rollPushUntil||0)){a.rollYaw+=clamp(angle(desired-a.rollYaw),-.8*STEP,.8*STEP);const face=a.evadeFlank&&q>.72&&target?.hp>0?Math.atan2(target.z-u.z,target.x-u.x):a.rollYaw,rate=a.evadeFlank&&q>.72?5:.8;u.yaw+=clamp(angle(face-u.yaw),-rate*STEP,rate*STEP);}
    a.rollSpeedScale??=1;a.rollSpeedScale+=(1-a.rollSpeedScale)*STEP*2;
    let speed=Math.min((a.evadeFlank?24:a.evasion?20.5:18.2)*Math.sin(Math.PI*q)*a.rollSpeedScale,remaining/STEP);
    if(!a.evasion&&target?.hp>0&&(approach<0||a.rollHitIds?.has(target.id)))speed=Math.min(speed,Math.max(1.2*(1-q),approach-3.3)*5);
    if(a.evadeFlank){const gx=a.rollGoalX-u.x,gz=a.rollGoalZ-u.z,along=gx*Math.cos(a.rollYaw)+gz*Math.sin(a.rollYaw);speed=Math.min(speed,Math.max(0,along)*8);}
    const yaw=a.rollYaw;
    if(this.time>=(u.rollPushUntil||0)){u.vx+=clamp(Math.cos(yaw)*speed-u.vx,-60*STEP,60*STEP);u.vz+=clamp(Math.sin(yaw)*speed-u.vz,-60*STEP,60*STEP);}
    if(elapsed<duration-.1)rollContacts(this,u,hits);
    if(this.tick%5===0)this.effect(u.x,.1,u.z,'dust',.8,u.team);
  }
  strike(u,hits){
    const a=u.action,s=u.stats,skill=crewProfile(this.config[u.team+'Skill']);let target=this.units[a.target];if(!target)return;
    const tech=TECHNIQUES[u.team].find(t=>t.kind===a.kind),pulse=a.pulse||0;
    if(a.kind==='grapple'){
      if(pulse===0){if(target.hp<=0||target.heldBy!==null||target.y>1.5||Math.hypot(target.x-u.x,target.z-u.z)>6.2||Math.abs(angle(Math.atan2(target.z-u.z,target.x-u.x)-a.yaw))>.75||this.rng()>skill.accuracy){a.missed=true;u.lastContact=null;a.pulses=[a.impact];a.duration=Math.min(a.duration,a.age+.55);u.opening=Math.max(u.opening,1);u.cool=Math.max(u.cool,1.2);return;}
        hits.push({source:u,target,attackToken:a,damage:s.damage*tech.damage,kind:'grip',side:a.side,critical:false,capture:a});
      }else if(a.captured!==null){const v=this.units[a.captured];if(v.heldBy!==u.id)return;const aim=chooseThrowAim(this,u,v);v.heldBy=null;const yaw=a.yaw;v.vx=aim?.vx??Math.cos(yaw)*19*moveTuning(this.config,u.team,a.kind).knockback;v.vz=aim?.vz??Math.sin(yaw)*19*moveTuning(this.config,u.team,a.kind).knockback;v.vy=aim?.vy??-19;v.throwImpact={mode:aim?.mode||'arc',target:aim?.target??null};a.throwAim=aim;v.rollV=a.side*8;v.pitchV=-7;v.thrownBy=u.id;v.stun=1.2;v.opening=Math.max(v.opening,1.4);hits.push({source:u,target:v,damage:s.damage*1.4,kind:'throw',technique:'grapple',side:a.side,critical:false,flightRelease:true});this.effect(v.x,v.y,v.z,'impact',2,'dig');}
      return;
    }
    if(a.kind==='pounce'&&a.landAt!==null&&(target.hp<=0||Math.hypot(target.x-u.x,target.z-u.z)>4.8)){target=this.nearby(u.x,u.z,6.2).filter(v=>v.hp>0&&v.team!==u.team&&v.heldBy===null).sort((a,b)=>Math.hypot(a.x-u.x,a.z-u.z)-Math.hypot(b.x-u.x,b.z-u.z))[0];if(!target)return;a.target=target.id;}
    const follow=a.kind==='pounce'&&a.landAt!==null,radial=a.kind==='pounce'&&!follow||a.kind==='spin',range=a.kind==='tail'?10*(u.scale||1):a.kind==='pounce'&&!follow?6.5:a.kind==='sweep'?10:s.range+1.4,candidates=this.nearby(u.x,u.z,range).filter(v=>v.team!==u.team&&v.hp>0&&v.heldBy===null),yaw=a.yaw,aimed=radial||this.rng()<skill.accuracy;
    const sorted=candidates.map(v=>({v,dist:Math.hypot(v.x-u.x,v.z-u.z)})).sort((a,b)=>a.dist-b.dist);
    let count=0;a.hitIds??=new Set();const wide=!follow&&(tech?.targets||1)>1,max=follow?1:a.multiDefense?6:tech?.targets||1;
    for(const {v,dist} of sorted){const delta=angle(Math.atan2(v.z-u.z,v.x-u.x)-yaw),inArc=radial||Math.abs(delta)<(a.kind==='tail'?2.6:a.kind==='sweep'?1.9:a.kind==='ram'?.85:wide?1.5:.85);
      if(!follow&&(a.hitIds.has(v.id)||a.hitIds.size>=max)||!aimed||dist>range||(a.kind==='tail'?!this.tailTouches(u,v):!inArc)||a.kind==='ram'&&count>0&&Math.abs(delta)>.38||a.kind==='pounce'&&!follow&&v.y>2||(!wide&&v!==target))continue;
      const contactPoint=u.team==='dig'&&['smash','sweep','uppercut','spin'].includes(a.kind)?bucketContact(u,v):null;if(u.team==='dig'&&['smash','sweep','uppercut','spin'].includes(a.kind)&&!contactPoint)continue;
      const factor=follow||a.hitIds.size===0?1:u.team==='rex'?.1:.95,boost=follow?.6:(tech?.damage||1)*(a.kind==='ram'?1+.35*(a.momentum||0):1),critical=u.team==='dig'&&['sweep','spin'].includes(a.kind)?(a.criticalStrike??=this.rng()<attackCriticalChance(u,a.kind,this.config,this.time)):u.team==='rex'&&a.kind==='tail'&&v.team==='dig'?(a.criticalStrike??=this.rng()<.55):this.rng()<attackCriticalChance(u,a.kind,this.config,this.time);
      const kind=follow?'bite':a.kind,overdriveStrike=u.team==='dig'&&u.buffActive&&a.multiDefense&&['sweep','spin'].includes(a.kind)?1.35:1;
      hits.push({source:u,target:v,attackToken:a,contactPoint,secondary:factor<1,damage:s.damage*overdriveStrike*(.78+this.rng()*.44)*factor*boost*(critical?(a.kind==='ram'?1.3:1.55):1),kind,technique:a.kind,side:a.side,critical,momentum:a.kind==='ram'?a.momentum||0:0,impactScale:a.kind==='pounce'&&factor<1?.4:a.kind==='ram'&&count>0?.6:1});if(!follow)a.hitIds.add(v.id);count++;if(follow?count>=max:a.hitIds.size>=max)break;
    }
    if(a.kind==='pounce'&&!follow){a.missed=count===0;if(a.missed&&!a.evasion){u.opening=Math.max(u.opening,1.2);u.cool=Math.max(u.cool,1.2);}this.effect(u.x,.15,u.z,'impact',3.2,'rex');this.effect(u.x,.1,u.z,'dust',2.5);this.quake=Math.min(2.6,this.quake+.7);}
    else if(!count&&a.hitIds.size===0&&a.pulse>=a.pulses.length-1){if(!follow){a.missed=true;u.lastContact=null;if(u.team==='rex'){if(a.kind==='tail')this.breakRexChain(u,'tail');}u.opening=Math.max(u.opening,['ram','tail','smash','uppercut','spin'].includes(a.kind)?.45:.2);}this.effect(u.x+Math.cos(yaw)*s.range*.75,.1,u.z+Math.sin(yaw)*s.range*.75,'dust',.8);}
    if(a.kind==='tail')u.rollV+=a.side*1.2;
  }
  tickReadiness(u){this.updateBuff(u);this.prepareRushResponse(u);
    if(u.guardUntil>0&&this.time>u.guardUntil){u.guardUntil=0;if(!u.guardBlocks){u.parryCooldown=Math.max(u.parryCooldown,.45);u.opening=Math.max(u.opening,.35);}}
    if(u.guardUntil&&u.guardUntil<=this.time)u.guardUntil=0;if(u.team==='dig'&&u.guardUntil>this.time){u.parry=Math.max(u.parry,Math.min(.28,u.guardUntil-this.time));const threat=this.guardThreat(u,this.units[u.guardTarget]);if(threat?.hp>0){u.guardTarget=threat.id;}if(threat?.hp>0){const reach=clamp((Math.hypot(threat.x-u.x,threat.z-u.z)-2.8)/(u.scale||1),.9,6.3);u.guardHeight=clamp(threat.y+(threat.action?.kind==='ram'?2.9:3.5)-u.y,1.7,6.3);u.guardSlew=angle(Math.atan2(threat.z-u.z,threat.x-u.x)-u.yaw);u.guardReach=(u.guardReach||reach)+clamp(reach-(u.guardReach||reach),-(reach<(u.guardReach||reach)?16:10)*STEP,10*STEP);}}this.refreshRam(u);this.refreshTail(u);if(!u.action)updateBucketArm(u,STEP);u.headDownFor=Math.max(0,(u.headDownFor||0)-STEP);u.cool-=STEP;u.parry=Math.max(0,u.parry-STEP);u.parryCooldown=Math.max(0,u.parryCooldown-STEP);u.opening=Math.max(0,u.opening-STEP);u.reactionWait=Math.max(0,u.reactionWait-STEP);u.hit=Math.max(0,u.hit-STEP*3);u.stun=Math.max(0,u.stun-STEP,(u.hardStunUntil||0)-this.time);
  }
  tryAerialCounters(alive){
    for(const attacker of alive){const a=attacker.action;
      if(attacker.team!=='rex'||attacker.hp<=0||!['leap','pounce'].includes(a?.kind)||a.landAt!==null||a.counterChecked||attacker.heldBy!==null||attacker.vy>=-2||attacker.y<=.25||attacker.y>4.2)continue;
      const candidates=this.nearby(attacker.x,attacker.z,10).filter(d=>{
        const action=d.action;if(d.team!=='dig'||d.hp<=0||d.y>.7||d.stun>0||d.heldBy!==null||d.parryCooldown>0||a.parryBypassTarget===d.id||!action||!['smash','uppercut','sweep','spin'].includes(action.kind)||action.captured!=null)return false;
        const phase=action.age/action.duration,dx=attacker.x-d.x,dz=attacker.z-d.z;
        return phase>=.18&&phase<=.65&&Math.hypot(dx,dz)<=guardStats('dig',5,this.config.tuning.dig).reach&&!!bucketContact(d,attacker);
      }).sort((a,b)=>Math.hypot(a.x-attacker.x,a.z-attacker.z)-Math.hypot(b.x-attacker.x,b.z-attacker.z)||a.id-b.id);
      const defender=candidates[0];if(!defender)continue;
      // Stop an aerial attack only after the moving bucket actually touches it.
      a.counterChecked=true;this.aerialCounterAttempts++;this.parryAttempts.dig++;
      if(guardStats('dig',this.config.digSkill,this.config.tuning.dig).chance<=0)continue;
      const contact=bucketContact(defender,attacker);if(this.time-(defender.lastBucketParryAt??-Infinity)>=1)defender.guardBlocks=0;defender.guardCapacity=10;defender.guardBlocks=(defender.guardBlocks||0)+1;defender.lastBucketParryAt=this.time;defender.lastBucketParrySource=attacker.id;if(defender.guardBlocks>=10){const recovery=guardStats('dig',5,this.config.tuning.dig).cooldown*1.5;defender.guardFatigueUntil=this.time+recovery;defender.parryCooldown=recovery;defender.stun=Math.max(defender.stun,.25);defender.opening=Math.max(defender.opening,.5);}defender.counterTarget=attacker.id;defender.counterUntil=defender.guardBlocks<9?this.time+.9:0;
      const dx=attacker.x-defender.x,dz=attacker.z-defender.z,d=Math.hypot(dx,dz)||1,nx=dx/d,nz=dz/d;
      this.cancelJump(attacker);attacker.counterFall=true;attacker.stun=Math.max(attacker.stun,.3);attacker.opening=Math.max(attacker.opening,.7);attacker.cool=Math.max(attacker.cool,.8);
      attacker.vx=nx*18*this.config.tuning.dig.parryPush;attacker.vz=nz*18*this.config.tuning.dig.parryPush;attacker.vy=9;attacker.rollV+=defender.side*7;attacker.pitchV=-7;
      defender.action=null;defender.attack=0;defender.parry=.45;defender.parrySide=defender.side;defender.cool=defender.guardBlocks>=10?Math.max(defender.cool,.4):Math.max(.1,Math.min(defender.cool,.3));
      this.gainOverdrivePressure(defender);this.aerialCounters++;this.parries.dig++;this.hitStopSerial++;this.effect(contact.x,contact.y,contact.z,'parry',2,'dig');
      const fx=this.effects.at(-1);fx.yaw=Math.atan2(nz,nx);fx.side=defender.side;fx.aerial=true;
      for(const p of this.particles.slice(-14)){p.kind='metal';p.vy=5+this.fxRng()*7;p.vx=nx*(2+this.fxRng()*6);p.vz=nz*(2+this.fxRng()*6);p.life=p.max=.2+this.fxRng()*.25;p.size=.06;}
      this.quake=Math.min(1.7,this.quake+.3);
    }
  }
  breakRexChain(u,kind){if(u.team!=='rex')return;u.lastContact=null;if(kind==='ram'){u.ramLockedUntil=Math.max(u.ramLockedUntil||0,this.time+1.1);this.refreshRam(u);}if(kind==='tail'){u.opening=Math.max(u.opening,.9);u.cool=Math.max(u.cool,.8);}}
  gainOverdrivePressure(u){if(u.team==='dig'&&u.buffActive&&u.buffUntil>this.time)u.overdrivePressure=Math.min(3,(u.overdrivePressure||0)+1);}
  signalCounter(defender,enemy){this.gainOverdrivePressure(defender);if(defender.team!=='dig'||this.config.digSkill<3)return;let count=0;for(const ally of this.nearby(defender.x,defender.z,10)){if(ally===defender||ally.team!=='dig'||ally.hp<=0||ally.stun>0||ally.heldBy!==null||(ally.x-enemy.x)**2+(ally.z-enemy.z)**2>144)continue;ally.supportTarget=enemy.id;ally.supportUntil=this.time+.85;ally.decision=0;ally.targetLockUntil=0;if(++count>=3)break;}}
  trySupportParry(h,readiness){if(h.source.team==='rex'&&h.attackToken?.parryBypassTarget===h.target.id)return false;if(h.target.team!=='dig'||h.source.team!=='rex'||this.config.digSkill<3||h.parryable===false||!['bite','ram','tail','leap'].includes(h.kind))return false;const dx=h.target.x-h.source.x,dz=h.target.z-h.source.z,length=dx*dx+dz*dz;if(length<.01)return false;for(const ally of this.nearby(h.target.x,h.target.z,5)){if(ally===h.target||ally.team!=='dig'||ally.hp<=0||ally.stun>0||(ally.guardTarget!==h.source.id&&!(ally.guardCapacity>1&&ally.guardBlocks>0))||ally.guardUntil<this.time||(ally.x-h.target.x)**2+(ally.z-h.target.z)**2>25)continue;const point=bucketWorld(ally,0),t=clamp(((point.x-h.source.x)*dx+(point.z-h.source.z)*dz)/length,0,1);if((point.x-h.source.x-t*dx)**2+(point.z-h.source.z-t*dz)**2>2.25||Math.abs(point.y-2.8)>1.8)continue;if(this.tryParry({...h,target:ally},readiness))return true;}return false;}
  tryParry(h,readiness=null){
    // Tail strikes bypass bucket parry; the normal tail/body contact check still applies.
    if(h.source.team==='rex'&&h.target.team==='dig'&&(h.kind==='tail'||h.attackToken?.parryBypassTarget===h.target.id))return false;
    const attacker=h.source,defender=h.target,token=h.attackToken||attacker.action||h;if(defender.guardBlockedActions?.has(token))return true;const state=readiness?.get(defender.id),weapon=state?.action??defender.action;
    let tailClash=false;if(h.kind==='tail'&&defender.team==='dig'){
      const active=defender.guardUntil>this.time;if(!active&&(!weapon||!['sweep','spin'].includes(weapon.kind)))return false;const phase=weapon?weapon.age/weapon.duration:0;if(!active&&(phase<.18||phase>.9))return false;const point=bucketWorld(defender,phase),incoming=readiness?.get(attacker.id)?.action||attacker.action;tailClash=this.tailTouches(attacker,{x:point.x,y:point.y-2,z:point.z,yaw:0,scale:1,team:'dig',stats:{radius:.7}},incoming);if(!tailClash)return false;
    }
    const rotatingTail=defender.team==='rex'&&weapon?.kind==='tail'&&weapon.age/weapon.duration>.15&&weapon.age/weapon.duration<.9&&!!h.contactPoint&&this.tailTouches(defender,{x:h.contactPoint.x,y:h.contactPoint.y-2,z:h.contactPoint.z,yaw:0,scale:1,team:'dig',stats:{radius:.9}},weapon);
    if(rotatingTail)tailClash=true;const multiGuard=defender.team==='dig'&&defender.guardUntil>this.time&&defender.guardCapacity>1&&(defender.guardBlocks||0)<defender.guardCapacity,prepared=defender.guardUntil>this.time&&(defender.guardTarget===attacker.id||multiGuard);
    if(!tailClash&&!prepared)return false;const breakGuard=defender.team==='dig'&&defender.comboBreakUntil>this.time&&prepared;
    // Shock waves, explosions and already released throws cannot be parried.
    if((state?state.bucketCommitted:this.bucketCommitted(defender))&&!tailClash||h.parryable===false||!['bite','ram','tail','leap','smash','sweep','uppercut','spin','grip'].includes(h.kind)||defender.hp<=0||(state?state.stun:defender.stun)>(breakGuard?.18:0)||(state?state.heldBy:defender.heldBy)!==null||(state?state.y:defender.y)>.7||defender.parryCooldown>0&&!multiGuard||(state?state.captured:defender.action?.captured!=null))return false;
    const dx=attacker.x-defender.x,dz=attacker.z-defender.z,distance=Math.hypot(dx,dz),facing=angle(Math.atan2(dz,dx)-defender.yaw-(defender.team==='dig'?(defender.armPose?.slew??defender.guardSlew??0):0)-(rotatingTail?tailTurn(weapon.age/weapon.duration,weapon.side,weapon.defensive):0)-(defender.team==='rex'?Math.PI:0));
    const guard=guardStats(defender.team,this.config[defender.team+'Skill'],this.config.tuning[defender.team]);
    if(multiGuard){guard.arc+=20*Math.PI/180;guard.reach+=1;}if(rotatingTail){guard.reach=Math.max(guard.reach,7.4*(defender.scale||1));}
    if(distance>guard.reach&&!rotatingTail||!tailClash&&Math.abs(facing)>guard.arc||Math.abs(attacker.y-defender.y)>2.8)return false;
    this.parryAttempts[defender.team]++;
    if(guard.chance<=0)return false;if(prepared&&!tailClash){const p=bucketWorld(defender,0),headX=attacker.x+Math.cos(attacker.yaw)*3.5,headZ=attacker.z+Math.sin(attacker.yaw)*3.5;if(Math.hypot(p.x-headX,p.z-headZ)>2||Math.abs(p.y-(attacker.y+3.2*(attacker.scale||1)))>1.8)return false;}if(defender.team!=='dig')defender.parryCooldown=Math.max(defender.parryCooldown,guard.cooldown);defender.guardBlocks=(defender.guardBlocks||0)+1;if(defender.team==='dig'){(defender.guardBlockedActions??=new WeakSet()).add(token);defender.lastBucketParryAt=this.time;defender.lastBucketParrySource=attacker.id;if(defender.guardBlocks>=10){defender.guardFatigueUntil=this.time+guard.cooldown*1.5;defender.parryCooldown=Math.max(defender.parryCooldown,guard.cooldown*1.5);defender.stun=Math.max(defender.stun,.25);defender.opening=Math.max(defender.opening,.5);defender.cool=Math.max(defender.cool,.4);}}if(!multiGuard||defender.guardBlocks>=defender.guardCapacity)defender.guardUntil=0;
    const nx=distance>.001?dx/distance:Math.cos(defender.yaw),nz=distance>.001?dz/distance:Math.sin(defender.yaw),momentum=h.kind==='ram'&&defender.team==='dig'?clamp(h.momentum||0,0,1):0;
    this.cancelJump(defender,false);if(defender.team==='dig'){if(breakGuard&&defender.guardBlocks<10)defender.stun=0;defender.counterTarget=attacker.id;defender.counterUntil=defender.guardBlocks<9?this.time+.9:0;}defender.parry=.45;defender.parrySide=facing<0?-1:1;defender.action=rotatingTail?{...weapon,pulses:[],pulse:0,resolved:true,parryRecovery:true}:null;if(rotatingTail)defender.lastTailParryAt=this.time;defender.attack=0;defender.hit=0;defender.cool=defender.guardFatigueUntil>this.time?Math.max(defender.cool,.4):Math.max(.08,Math.min(defender.cool,.28));
    if(attacker.hp>0){this.breakRexChain(attacker,h.kind);const airborne=attacker.y>.02&&(!!attacker.aerialAttack||['leap','pounce'].includes(attacker.action?.kind));this.cancelJump(attacker);attacker.stun=Math.max(attacker.stun,.3);attacker.opening=Math.max(attacker.opening,.45);attacker.action=null;attacker.attack=0;attacker.cool=Math.max(attacker.cool,.55);attacker.vx+=nx*3.5*this.config.tuning[defender.team].parryPush;attacker.vz+=nz*3.5*this.config.tuning[defender.team].parryPush;if(airborne){attacker.vx=nx*10*this.config.tuning[defender.team].parryPush;attacker.vz=nz*10*this.config.tuning[defender.team].parryPush;attacker.vy=Math.max(attacker.vy,3.5);}attacker.pitchV-=1.4;attacker.runUp=0;attacker.charge=0;if(momentum>0){attacker.vx=nx*(3.5+15*momentum)*this.config.tuning[defender.team].parryPush;attacker.vz=nz*(3.5+15*momentum)*this.config.tuning[defender.team].parryPush;attacker.vy=Math.max(attacker.vy,2.5+6*momentum);attacker.stun=Math.max(attacker.stun,.3+.35*momentum);attacker.rollV+=h.side*4*momentum;attacker.pitchV-=4*momentum;}}
    if(defender.team==='rex'){defender.ramLockedUntil=Math.min(defender.ramLockedUntil||0,this.time);this.refreshRam(defender);defender.counterTarget=attacker.id;defender.counterUntil=this.time+.9;this.event(unitLabel(defender)+' · 패링');}this.signalCounter(defender,attacker);this.parries[defender.team]++;this.hitStopSerial++;const blockPoint=defender.team==='dig'?bucketWorld(defender,0):rotatingTail&&h.contactPoint?h.contactPoint:{x:defender.x+nx*3.8,y:defender.y+2.2,z:defender.z+nz*3.8};this.effect(blockPoint.x,blockPoint.y,blockPoint.z,'parry',rotatingTail?1.8:1.4,defender.team);const fx=this.effects.at(-1);fx.yaw=Math.atan2(nz,nx);fx.side=defender.parrySide;
    for(const p of this.particles.slice(-14)){const spread=(this.fxRng()-.5)*1.8,speed=3+this.fxRng()*7,theta=fx.yaw+spread;p.kind='metal';p.vx=Math.cos(theta)*speed;p.vz=Math.sin(theta)*speed;p.vy=1.5+this.fxRng()*5;p.size=.04+this.fxRng()*.06;p.life=p.max=.18+this.fxRng()*.28;}
    return true;
  }
  resolveWeaponClashes(hits){const stopped=new Set();for(const rex of this.units){const a=rex.action;if(rex.team!=='rex'||rex.hp<=0||rex.stun>0||a?.kind!=='tail'||!a.defensive||a.parryRecovery||a.age/a.duration<.15||a.age/a.duration>.9)continue;for(const dig of this.nearby(rex.x,rex.z,15)){const guarding=dig.team==='dig'&&dig.parry>0&&dig.guardUntil>this.time;if(dig.team!=='dig'||dig.hp<=0||stopped.has(dig.id)||!guarding&&(!dig.action||!['smash','sweep','uppercut','spin'].includes(dig.action.kind)))continue;const point=bucketWorld(dig,dig.action?dig.action.age/dig.action.duration:0);if(!this.tailTouches(rex,{x:point.x,y:point.y-2,z:point.z,yaw:0,scale:1,team:'dig',stats:{radius:.35}},a))continue;if(guarding)continue;if(this.tryParry({source:dig,target:rex,kind:dig.action.kind,contactPoint:point,side:dig.action.side,damage:0})){stopped.add(dig.id);stopped.add(rex.id);break;}}}if(stopped.size)for(let i=hits.length-1;i>=0;i--)if(stopped.has(hits[i].source.id))hits.splice(i,1);}
  applyStun(u,duration,reason){
    if(u.hp<=0||u.hardStunUntil!=null&&this.time<u.hardStunUntil+.65)return false;
    u.hardStunUntil=this.time+duration;u.hardStunReason=reason;u.stun=Math.max(u.stun,duration);this.cancelJump(u);u.action=null;u.attack=0;u.guardUntil=0;u.counterUntil=0;u.lastContact=null;return true;
  }
  crowdControlScale(source,target,kind){
    if(source.team!=='dig'||target.team!=='rex'||!['smash','sweep','uppercut','spin'].includes(kind))return 1;
    let window=target.bucketControl;
    if(!window||this.time>=window.until){target.bucketControl={until:this.time+.65,sources:[source.id]};return 1;}
    if(window.sources.includes(source.id))return 1;
    window.sources.push(source.id);return window.sources.length===2?.8:window.sources.length===3?.6:.4;
  }
  overdriveCover(source,target){
    if(target.team!=='dig'||!target.buffActive||source.team!=='rex')return 1;
    let w=target.overdriveHits;if(!w||this.time>=w.until)w=target.overdriveHits={until:this.time+.7,sources:[]};
    if(!w.sources.includes(source.id))w.sources.push(source.id);const index=w.sources.indexOf(source.id);return index===0?1:index===1?.7:.5;
  }
  chainControl(v){
    const chain=v.contactChain;if(!chain||this.time-chain.time>.85){v.contactChain={time:this.time,count:1};return 1;}
    if(chain.time===this.time)return 1;chain.time=this.time;chain.count++;return Math.max(.15,Math.pow(.6,chain.count-1));
  }
  applyHits(hits){
    if(!hits.length)return;
    // Special throw impacts also become critical while overdrive is active. Never multiply an already-critical hit twice.
    for(const h of hits)if(!h.critical&&h.source.team==='dig'&&attackCriticalChance(h.source,h.technique||h.kind,this.config,this.time)===1){h.critical=true;h.damage*=1.55;}
    // All guards in a committed hit batch use the same pre-impact readiness.
    const readiness=new Map();for(const {target:u} of hits)if(!readiness.has(u.id))readiness.set(u.id,{stun:u.stun,heldBy:u.heldBy,y:u.y,captured:u.action?.captured!=null,bucketCommitted:this.bucketCommitted(u),action:u.action?{...u.action}:null});
    for(const h of hits){if(!this.isRolling(h.target)&&(this.tryParry(h,readiness)||this.trySupportParry(h,readiness))){h.source.lastContact=null;continue;}const u=h.source,v=h.target,s=SPECS[v.team],dx=v.x-(h.impactOrigin?.x??u.x),dz=v.z-(h.impactOrigin?.z??u.z),d=Math.hypot(dx,dz)||1,wide=['sweep','tail','spin','pounce'].includes(h.kind)||h.landingShock;
      const airborneJump=v.team==='rex'&&['leap','pounce'].includes(v.action?.kind)&&v.action.landAt===null&&v.y>.7;
      if(h.kind==='sweep'&&airborneJump&&v.y>2)continue;
      let overlap=1;if(u.team==='dig'&&v.team==='rex'&&['sweep','spin'].includes(h.kind)){let window=v.areaHits;if(!window||this.time>=window.until)window=v.areaHits={until:this.time+.55,sources:[]};if(!window.sources.includes(u.id)){window.sources.push(u.id);overlap=window.sources.length===1?1:window.sources.length===2?1:window.sources.length===3?.8:.4;}}
      const impactAngle=v.team==='dig'?Math.abs(angle(Math.atan2(u.z-v.z,u.x-v.x)-v.yaw)):0,sideHit=v.team==='dig'&&impactAngle>Math.PI/3,rearHit=sideHit&&impactAngle>Math.PI*2/3,directionDamage=rearHit?1.2:sideHit?1.4:1,directionControl=rearHit?1.2:sideHit?1.35:1;const tuning=moveTuning(this.config,u.team,h.technique||h.kind);const preciseHead=v.team==='rex'&&['smash','uppercut'].includes(h.kind)&&h.contactPoint&&Math.hypot(v.x+Math.cos(v.yaw)*2.8*(v.scale||1)-h.contactPoint.x,v.z+Math.sin(v.yaw)*2.8*(v.scale||1)-h.contactPoint.z)<2.1&&Math.abs(h.contactPoint.y-(v.y+3.6*(v.scale||1)))<1.8;const rolling=this.isRolling(v);if(rolling)v.rollPushUntil=this.time+.25;const damage=(rolling?0:h.damage)*(preciseHead?1.25:1)*directionDamage*tuning.damage*overlap*this.overdriveCover(u,v)*(1-v.stats.armor)*(v.opening>0&&h.kind!=='ram'?1.25:1),actual=Math.min(Math.max(0,v.hp),damage);v.hp-=damage;v.hit=1;this.damage[u.team]+=actual;this.recordDamage(u,v,actual);this.impacts++;
      if(actual>0&&u.team==='dig'&&v.team==='rex'){v.tailBypassLink=null;v.lastContact=null;}
      if(actual>0&&u.team==='rex'&&v.team==='dig'&&h.kind==='tail'&&v.guardUntil>this.time){const attack=h.attackToken||u.action||h;if(u.tailBypassLink?.attack!==attack||v.id===attack.target)u.tailBypassLink={target:v.id,until:this.time+.8,attack};}
      if(actual>0&&v.hp>0&&u.team==='rex'&&v.team==='dig'&&v.guardUntil>this.time){v.guardBrokenUntil=this.time+.5;v.guardUntil=0;v.parry=0;v.parryCooldown=Math.max(v.parryCooldown,.5);v.stun=Math.max(v.stun,.15);v.opening=Math.max(v.opening,.3);v.cool=Math.max(v.cool,.2);v.counterUntil=0;}
      const previousContact=u.lastContact,chains=u.team==='rex'?{bite:['ram','leap','pounce'],tail:['bite','ram','leap','pounce'],ram:['tail']}:{uppercut:['sweep','smash','spin'],smash:['uppercut','throw'],sweep:['smash','spin'],spin:['sweep']},confirmedChain=previousContact?.target===v.id&&this.time-previousContact.time<3&&chains[h.kind]?.includes(previousContact.kind);
      if(actual>0&&(v.id===u.action?.target||!u.lastContact||u.lastContact.time!==this.time))u.lastContact={target:v.id,kind:h.kind,time:this.time,fromFlankRoll:!!h.attackToken?.fromFlankRoll};
      if(actual>0&&h.rollFinisher){u.rollFollowTarget=v.id;u.rollFollowUntil=this.time+1.2;u.cool=Math.min(u.cool,.18);}
      if(actual>0&&u.team==='dig'&&['smash','sweep','uppercut','spin'].includes(h.kind))u.repositionUntil=this.time+.65;
      const headX=v.x+Math.cos(v.yaw)*2.8*(v.scale||1),headZ=v.z+Math.sin(v.yaw)*2.8*(v.scale||1),bucketHeadContact=v.team==='rex'&&['smash','uppercut'].includes(h.kind)&&h.contactPoint&&Math.hypot(headX-h.contactPoint.x,headZ-h.contactPoint.z)<2.1&&Math.abs(h.contactPoint.y-(v.y+3.6*(v.scale||1)))<1.8;const dash=v.action,ramCounter=actual>0&&u.team==='dig'&&v.team==='rex'&&dash?.kind==='ram'&&!dash.dashInterrupted&&h.contactPoint&&['smash','sweep','uppercut','spin'].includes(h.kind)&&Math.hypot(v.vx,v.vz)>4&&v.vx*(u.x-v.x)+v.vz*(u.z-v.z)>Math.hypot(v.vx,v.vz)*d*.5,brace=!ramCounter&&!bucketHeadContact&&actual>0&&v.team==='rex'&&dash?.kind==='ram'&&dash.age<dash.impact&&!dash.dashInterrupted&&!dash.bracedHit&&!h.critical&&['smash','sweep'].includes(h.kind)&&actual<=v.maxHp*.22;
      if(brace)dash.bracedHit=true;
      const control=directionControl*(u.team==='rex'&&h.kind==='tail'&&h.secondary?.35:1)*(actual>0?this.crowdControlScale(u,v,h.kind)*(h.rollTick?1:this.chainControl(v)):1)*(brace?.08:ramCounter?1.35:1);
      if(actual>0&&(confirmedChain||u.team==='rex'||u.team==='dig'&&['smash','uppercut','sweep','spin'].includes(h.kind)&&v.id===u.action?.target)){const level=this.config[u.team+'Skill'];if(level>=2)u.cool=Math.min(u.cool,(u.team==='rex'?Math.max(.1,.55-.115*(level-1)):(confirmedChain?Math.max(.14,.58-.11*(level-1)):0.55))*tuning.cooldown);}
      const braced=h.kind==='sweep'?(airborneJump?.25:!ramCounter&&v.team==='rex'&&v.action?.kind==='ram'?.65:1):1;
      const interruptedJump=!rolling&&v.team==='rex'&&['leap','pounce'].includes(v.action?.kind)&&['smash','uppercut','spin','throw'].includes(h.kind)&&this.cancelJump(v);
      if(actual>0&&v.action?.kind==='ram'&&!brace)v.action.dashInterrupted=true;
      v.runUp=0;v.charge=0;
      const force=(h.attackToken?.pressureBoost||1)*(h.flightRelease?0:1)*(v.team==='dig'?.85:1)*tuning.knockback*control*(u.team==='dig'&&['smash','sweep','uppercut','spin'].includes(h.kind)?1.22:1)*(h.kind==='tail'?1.6:1)*(1+.25*(h.momentum||0))*braced*(.82+this.rng()*.42)*(h.critical?1.35:1)*(h.kind==='pounce'?14:h.kind==='spin'?12:h.kind==='throw'?1:h.kind==='grip'?0:h.kind==='ram'?13:h.kind==='uppercut'?14:h.kind==='leap'?11:h.kind==='sweep'?13:h.kind==='smash'?7.5:wide?9:5.5)*(h.impactScale||1)/Math.sqrt(s.mass);
      if(actual>0&&v.team==='rex'&&u.team==='dig'&&force>=8)v.lastKnockbackAt=this.time;
      if(ramCounter){v.vx*=.35;v.vz*=.35;}
      const nx=dx/d,nz=dz/d,tangent=wide?(h.kind==='tail'?1.1:.65)*h.side:0;v.vx+=(nx-nz*tangent)*force;v.vz+=(nz+nx*tangent)*force;
      const launch=h.kind==='tail'?6.5:h.kind==='pounce'?7:h.kind==='spin'?4.5:h.kind==='grip'?0:h.kind==='throw'?0:h.kind==='uppercut'?11:h.kind==='leap'?7.5:h.kind==='smash'?3:h.kind==='sweep'?2.4:wide?4:2.1;
      v.vy=h.flightRelease?v.vy:Math.max(v.vy,(h.launchOverride??(brace?0:launch))*(v.team==='dig'?.85:1)*tuning.knockback*control*(airborneJump&&h.kind==='sweep'?.2:1)*(h.impactScale||1)*(.85+this.rng()*.3)*(h.critical?1.25:1)/Math.sqrt(s.mass));v.stun=Math.max(v.stun,control*(brace?0:h.stagger??(airborneJump&&h.kind==='sweep'?.05:h.kind==='uppercut'?.8:h.kind==='sweep'?.45:h.kind==='spin'?.36:h.kind==='smash'?.35:.17)));
      if(ramCounter){this.breakRexChain(v,'ram');dash.dashInterrupted=true;v.action=null;v.attack=0;v.stun=Math.max(v.stun,.8*control);v.cool=Math.max(v.cool,.65*control);v.opening=Math.max(v.opening,.45*control);}
      if(actual>0&&bucketHeadContact){this.breakRexChain(v,dash?.kind);
        this.cancelJump(v);v.action=null;v.attack=0;v.cool=Math.max(v.cool,.55*control);v.opening=Math.max(v.opening,.35*control);
        if(h.kind==='smash'&&v.y<.6){v.vy=Math.min(0,v.vy);v.pitchV-=5*control;this.applyStun(v,1.8,'head-slam');v.headDownFor=Math.max(v.headDownFor||0,.6*Math.max(.6,control));v.vx*=.4;v.vz*=.4;}
        if(h.kind==='uppercut'){v.vy=Math.max(v.vy,15*Math.max(.65,control));v.pitchV+=2.5*control;v.counterFall=true;v.jawLaunched=true;}
      }
      if(actual>0&&u.team==='rex'&&v.team==='dig'&&sideHit&&!rearHit){if(h.kind==='ram'&&(h.momentum||0)>=.65)this.applyStun(v,1.2,'side-ram');else if(h.kind==='tail'&&h.critical)this.applyStun(v,1.2,'side-tail');}
      if(interruptedJump&&v.vy>0)v.counterFall=true;
      v.rollV+=control*h.side*(wide?4.5:2.3)/Math.sqrt(s.mass);v.pitchV+=control*(h.kind==='uppercut'?4.5:2.1)/Math.sqrt(s.mass);
      u.vx-=nx*1.2/SPECS[u.team].mass;u.vz-=nz*1.2/SPECS[u.team].mass;u.pitchV-=.7;
      this.effect(v.x,Math.max(.8,v.y+1.2),v.z,'impact',actual>0&&h.rollFinisher?1.9:actual>0&&h.kind==='tail'?1.7:h.kind==='uppercut'?1.6:h.kind==='sweep'?1.4:1.1,v.team);Object.assign(this.effects.at(-1),{critical:!!h.critical,technique:h.technique||h.kind});
      if(!rolling&&v.hp>0&&h.capture&&u.hp>0&&u.action===h.capture){this.cancelJump(v,false);v.heldBy=u.id;v.action=null;v.attack=0;v.stun=Math.max(v.stun,1.5);h.capture.captured=v.id;h.capture.throwAim=chooseThrowAim(this,u,{...v,x:u.x+Math.cos(h.capture.yaw)*3.3,z:u.z+Math.sin(h.capture.yaw)*3.3,y:u.y+5.5});}
      if(actual>0&&u.team==='rex'&&v.team==='dig'&&v.hp>0&&v.heldBy===null&&v.y<.5){const chain=v.rexPressure;if(!chain||chain.source!==u.id||this.time-chain.time>1.2)v.rexPressure={source:u.id,time:this.time,count:1};else if(chain.time!==this.time){chain.time=this.time;chain.count++;if(chain.count>=2&&this.time>=(v.nextComboBreakAt||0)){v.comboThreat=u.id;v.comboBreakUntil=this.time+1.1;v.nextComboBreakAt=this.time+3;v.parryCooldown=Math.max(Math.min(v.parryCooldown,.12),(v.guardFatigueUntil||0)-this.time,(v.guardBrokenUntil||0)-this.time);v.stun=Math.max(Math.min(v.stun,.18),(v.hardStunUntil||0)-this.time);v.vy=Math.min(v.vy,2);}}}
      if(v.hp<=0)this.destroy(v,u,h.side);

    }
  }
  recordDamage(source,target,actual){
    if(!source||source.team===target.team||actual<=0)return;
    source.damageDealt=(source.damageDealt||0)+actual;if(source.team==='rex'&&source.buffActive&&target.hp>0){source.rageTarget=target.id;source.rageUntil=this.time+2;}
    (target.recentDamagers??=new Map()).set(source.id,this.time);
  }
  destroy(v,source=null,side=1){
    if(v.deadAt!==null)return;v.hp=Math.min(0,v.hp);v.buffActive=false;v.buffUntil=0;v.deadAt=this.time;v.action=null;v.aerialAttack=null;v.deathSide=side;v.vy=Math.max(v.vy,v.team==='dig'?4.8:7.2);v.rollV+=side*(v.team==='dig'?3.4:5.5);v.pitchV+=v.team==='dig'?1.2:3.2;
    const helpers=[];if(source&&source.team!==v.team){source.kills++;for(const [id,time] of v.recentDamagers||[]){const helper=this.units[id];if(id!==source.id&&helper?.team===source.team&&this.time-time<=10)helper.assists=(helper.assists||0)+1,helpers.push(unitLabel(helper));}}
    v.recentDamagers?.clear();
    if(v.team==='dig')this.explosionQueue.push(v);else this.effect(v.x,v.y+1,v.z,'death',1.7,v.team);
    this.event((source?unitLabel(source)+' → ':'')+unitLabel(v)+(v.team==='rex'?' 전투 불능':' 파괴')+(helpers.length?' · 어시스트: '+helpers.join(', '):''));
  }
  resolveExplosions(){
    // Drain one queue after all committed direct hits. Each wreck explodes once;
    // blast deaths append to this queue before the victory check runs.
    while(this.explosionQueue.length){const wreck=this.explosionQueue.shift();if(wreck.exploded)continue;wreck.exploded=true;this.explosions++;
      const blast=this.config.tuning.explosion,radius=EXPLOSION.radius*blast.radius;const x=wreck.x,y=wreck.y+1,z=wreck.z;this.effect(x,y,z,'explosion',2.1*blast.radius,'dig');this.effects.at(-1).blastRadius=radius;this.scorches.push({x,z,radius:3.5*blast.radius});this.quake=Math.min(2.6,this.quake+.8);this.event(unitLabel(wreck)+' 폭발');
      for(const v of this.nearby(x,z,radius)){if(v===wreck||v.hp<=0)continue;const dx=v.x-x,dz=v.z-z,dy=v.y+1-y,distance=Math.hypot(dx,dz,dy);if(distance>=radius)continue;
        // Damage falls linearly with distance; the existing blast impulse is preserved.
        const blastDistance=1-distance/radius,damageFalloff=blastDistance*blastDistance,falloff=Math.pow(blastDistance,.8);let blastScale=1;if(v.team==='rex'){if(v.blastUntil>this.time)blastScale=.55;else v.blastUntil=this.time+.8;}const damage=(this.isRolling(v)?0:EXPLOSION.damage)*blast.damage*damageFalloff*(1-v.stats.armor)*(1-(v.stats.explosionResistance||0))*blastScale,actual=Math.min(v.hp,damage);v.hp-=damage;v.hit=1;this.impacts++;
        const interruptedJump=actual>40&&this.cancelJump(v);
        if(v.action?.kind==='ram')v.action.dashInterrupted=true;
        if(v.team==='dig')this.friendlyFire+=actual;else this.damage.dig+=actual;this.recordDamage(wreck,v,actual);
        const planar=Math.hypot(dx,dz),nx=planar>.001?dx/planar:Math.cos(v.id*2.399),nz=planar>.001?dz/planar:Math.sin(v.id*2.399),mass=Math.sqrt(SPECS[v.team].mass),force=EXPLOSION.impulse*falloff*(v.team==='dig'?.5:1)/mass;
        if(this.isRolling(v))v.rollPushUntil=this.time+.25;v.vx+=nx*force;v.vz+=nz*force;v.vy=Math.max(v.vy,(3+7*falloff)/mass);v.rollV+=v.side*force*.46;v.pitchV-=force*.3;v.stun=Math.max(v.stun,.2+.35*falloff);
        if(interruptedJump)v.counterFall=true;
        if(v.hp<=0)this.destroy(v,wreck,v.side);
      }
    }
  }
  movement(u,teams,hits){
    const s=u.stats,skill=crewProfile(this.config[u.team+'Skill']);u.moving=false;
    if(u.action){const a=u.action;a.age+=STEP*(a.parryRecovery&&u.team==='rex'?1.4:a.resolved&&a.age/a.duration>=.76?(a.buffRecovery||1):1);if(a.kind==='grapple'&&a.captured!=null&&a.throwAim&&a.age<a.duration*.72){const delta=angle(a.throwAim.yaw-a.yaw);a.yaw+=clamp(delta,-2*STEP,2*STEP);u.yaw=a.yaw;}if(u.team==='dig'&&a.kind!=='grapple'){const opponent=this.units[a.target];if(opponent?.hp>0){const reach=clamp((Math.hypot(opponent.x-u.x,opponent.z-u.z)-2.2)/(u.scale||1),.9,6.5);a.bucketReach=(a.bucketReach||reach)+clamp(reach-(a.bucketReach||reach),-(reach<(a.bucketReach||reach)?14:10)*STEP,10*STEP);}}updateBucketArm(u,STEP);u.attack=Math.max(0,1-a.age/a.duration);this.advanceRam(u);
      if(a.kind==='leap'){
        if(a.landAt===null&&a.age>.35&&u.y<=.2&&u.vy<2.5){this.strikeLeapLanding(u,hits);a.landAt=a.age;a.resolved=true;a.duration=Math.max(a.duration,a.age+.22);}
      }else if(a.kind==='pounce'){
        if(a.landAt===null&&a.age>(a.evadeFlank?.32:.6)&&u.y<=.2&&u.vy<2.5){this.strike(u,hits);a.landAt=a.age;a.rollPreTucked=true;a.rollYaw=a.evadeFlank?Math.atan2(a.rollGoalZ-u.z,a.rollGoalX-u.x):a.yaw;a.rollStartYaw=a.rollYaw;a.rollDuration=a.evadeFlank?clamp(.65+Math.hypot(a.rollGoalX-u.x,a.rollGoalZ-u.z)/20,1.1,1.6):a.evasion?ROLL.evasionDuration:clamp(1.65+Math.hypot((this.units[a.target]?.x??u.x)-u.x,(this.units[a.target]?.z??u.z)-u.z)*.045,1.8,ROLL.attackDuration);a.rollLastX=u.x;a.rollLastZ=u.z;a.rollDistance=0;a.pulse=1;a.duration=a.age+a.rollDuration+.04;}
        if(a.landAt!==null)this.advanceRoll(u,hits);
      }
      else while(a.pulse<a.pulses.length&&a.age>=a.pulses[a.pulse]){this.strike(u,hits);a.pulse++;a.resolved=a.pulse===a.pulses.length;}
      if((a.age>=a.duration||a.kind==='ram'&&!a.evasion&&a.resolved&&u.lastContact?.kind==='ram'&&this.time-u.lastContact.time<.3&&a.age>=a.impact+.1)&&(!['pounce','leap'].includes(a.kind)||a.resolved)){if(!a.evasion&&!a.parryRecovery&&u.attackCount>0&&u.attackCount%3===0)u.cool=Math.max(u.cool,.75);u.action=null;u.attack=0;}}
    if(u.heldBy!==null)return;
    const enemies=teams[u.team==='rex'?'dig':'rex'];u.decision-=STEP;
    let target=u.target===null?null:this.units[u.target];
    if(!target||target.hp<=0||target.heldBy!==null||u.decision<=0){
      const tactics=this.brain(u.team);u.decision=tactics.interval*(u.team==='dig'?.8:1)*(.85+this.rng()*.3)*(u.plan?.decisionPace||1);
      const committed=u.action?this.units[u.action.target]:null;
      const locked=target?.hp>0&&target.heldBy===null&&this.time<(u.targetLockUntil||0)&&Math.hypot(target.x-u.x,target.z-u.z)<14?target:null;
      let selected=committed?.hp>0&&committed.heldBy===null?committed:locked||this.selectTarget(u,enemies);if(u.team==='dig'&&!committed&&this.isRolling(selected)){const danger=this.guardThreat(u);if(danger&&danger!==selected&&!this.isRolling(danger)&&Math.hypot(danger.x-u.x,danger.z-u.z)<7)selected=danger;}
      if(selected&&u.target!==selected.id){this.setTarget(u,selected.id);u.targetLockUntil=this.time+.45+.45*tactics.awareness;u.reactionWait=skill.reaction;}
      target=selected;
      if(target){const distance=Math.hypot(target.x-u.x,target.z-u.z);if(distance>24)u.decision=Math.max(u.decision,Math.min(1.2,.5+distance*.005));}
      if(target)this.updateTactics(u,target);
      if(u.team==='dig'&&target)this.chooseEscapeSide(u,target);
      if(tactics.awareness===0&&u.team==='rex'&&this.rng()<.3)u.side*=-1;
    }
    const support=u.team==='dig'&&u.supportUntil>this.time?this.units[u.supportTarget]:null;if(!u.action&&support?.hp>0&&support.heldBy===null&&(support.x-u.x)**2+(support.z-u.z)**2<144){target=support;this.setTarget(u,target.id);}
    const dist=target?Math.hypot(target.x-u.x,target.z-u.z):Infinity;
    if(u.team==='rex'&&dist<=12)u.enteredCombat=true;
    u.engagementWait=!u.action&&u.stun<=0&&u.cool<=0&&dist<12?(u.engagementWait||0)+STEP:0;
    if(u.engagementWait>1.2&&target){u.side*=-1;u.targetLockUntil=0;u.decision=0;u.engagementWait=0;}
    if(target){this.prepareGuard(u,target);this.chooseRexDefense(u,target,dist);}this.steerJump(u);if(!target||u.stun>0||u.y>.9||u.counterFall&&u.y>0||!u.action&&u.y>.1)return;if(u.target!==target.id)u.reactionWait=skill.reaction;this.setTarget(u,target.id);const dx=target.x-u.x,dz=target.z-u.z,nx=dx/(dist||1),nz=dz/(dist||1),aimLead=u.team==='dig'&&u.action&&u.action.age/u.action.duration<(u.action.aimLead?.4:.28)?(u.action.aimLead||0):0,targetYaw=Math.atan2((this.commandRoute(u,target,dist)?.z??target.z)+clamp(target.vz,-9,9)*aimLead-u.z,(this.commandRoute(u,target,dist)?.x??target.x)+clamp(target.vx,-9,9)*aimLead-u.x),turn=angle(targetYaw-u.yaw);
    const navigation=this.commandRoute(u,target,dist);
    const a=u.action,phase=a?a.age/a.duration:0;
    const turning=(a?.kind==='pounce'&&a.landAt!==null?0:u.team==='rex'?.19:.105)*skill.turn*(u.team==='rex'&&u.buffActive&&u.rageUntil>this.time&&u.rageTarget===target?.id?1.25:1)*(u.team==='rex'&&navigation&&!u.action?1.65:u.team==='dig'&&aimLead?1.25:1);
    // Aim during preparation; commit through contact, then gradually recover.
    const aimPrep=a?.aimLead?.4:.28,turnScale=!a||a.kind==='pounce'&&a.landAt!==null?1:a.kind==='ram'&&a.dashYaw!==undefined&&phase<.68?0:phase<aimPrep?.65:phase<.68?0:.25;
    if(!a?.evasion&&(!a||a.kind!=='tail'||phase>=.85))u.yaw+=clamp(turn*(a?1:.7),-turning*turnScale,turning*turnScale);
    if(a&&(phase<aimPrep&&a.dashYaw===undefined||a.kind==='pounce'&&a.landAt!==null))a.yaw=u.yaw;

    if(!u.action){this.prepareGuard(u,target);
      const plan=this.approach(u,target,dist),vx=plan.vx,vz=plan.vz,steer=u.team==='rex'?4.2:3.1;u.intent=plan.intent;
      u.vx+=(vx-u.vx)*Math.min(1,steer*STEP);u.vz+=(vz-u.vz)*Math.min(1,steer*STEP);
      const closing=Math.max(0,-((target.vx-u.vx)*nx+(target.vz-u.vz)*nz));
      const jumpReach=u.team==='rex'?availableTechniques('rex',5,this.config.tuning.rex).reduce((reach,t)=>['ram','leap','pounce'].includes(t.kind)&&(u.nextTechniqueAt[t.kind]||0)<=this.time?Math.max(reach,t.kind==='pounce'?11.5:t.kind==='leap'?10.5:8.5):reach,s.range+1.3):0;
      const attackReach=u.team==='dig'?s.range+1.3+Math.min(.6,closing*.12):jumpReach;
      const guardTarget=this.units[u.guardTarget],guardAction=guardTarget?.action;const liveGuard=guardTarget?.hp>0&&!this.isRolling(guardTarget)&&guardAction&&!guardAction.resolved&&guardAction.parryBypassTarget!==u.id&&['bite','ram','leap','pounce'].includes(guardAction.kind);
      const holdGuard=liveGuard&&u.team==='dig'&&!(u.rushResponseUntil>this.time)&&u.guardUntil>this.time&&target.action&&u.parryCooldown<=0&&this.guardExposure(guardTarget,u)>0&&(this.config.tuning.dig.defense>=1||dist<6.5+this.config.tuning.dig.defense);
      if(holdGuard)u.intent='guard';
      if(!holdGuard&&!navigation&&dist<attackReach&&u.cool<=0&&u.reactionWait<=0&&(Math.abs(turn)<1.15||u.team==='dig'&&u.rushResponseUntil>this.time&&this.config.tuning.dig.moves.spin.enabled&&(u.nextTechniqueAt.spin||0)<=this.time))(u.team==='rex'||!this.probeAttack(u,target,dist))&&this.beginAttack(u,target,dist);
    }else if(u.team==='rex'&&a.kind==='tail'&&phase<.68){
      const ramLink=u.lastContact?.kind==='ram'&&this.time-u.lastContact.time<2,plant=phase<.18?0:phase<.38?Math.sin((phase-.18)/.2*Math.PI/2):phase<.62?Math.cos((phase-.38)/.24*Math.PI/2):0,drive=dist>2.8?u.stats.speed*(ramLink?.6:.42)*plant:0,nx=Math.cos(a.yaw),nz=Math.sin(a.yaw);u.vx+=(nx*drive-u.vx)*Math.min(1,6*STEP);u.vz+=(nz*drive-u.vz)*Math.min(1,6*STEP);u.intent='tail_step';
    }else if(u.team==='rex'&&(u.action.kind==='bite'&&u.action.age<Math.min(u.action.impact+.12,.42))){
      u.vx+=nx*18*STEP;u.vz+=nz*18*STEP;u.intent='pressure';
    }else if(u.team==='rex'&&['ram','tail'].includes(a.kind)&&phase>=.68&&u.y<=.7&&!a.dashInterrupted){
      // Recover on the feet: follow the retreat or circle a committed bucket, without another hit.
      const plan=this.approach(u,target,dist),drive=.55+.2*this.brain('rex').awareness;
      u.vx+=(plan.vx*drive-u.vx)*Math.min(1,4.2*STEP);u.vz+=(plan.vz*drive-u.vz)*Math.min(1,4.2*STEP);u.intent=plan.intent==='flank'?'recover_flank':'recover_pressure';
    }else if(u.team==='dig'&&a.counterDrive&&phase>.15&&phase<.55){const travelled=Math.hypot(u.x-a.driveX,u.z-a.driveZ),drive=travelled<.8&&dist>3.4?s.speed*.65:0;u.vx+=(Math.cos(a.yaw)*drive-u.vx)*Math.min(1,4*STEP);u.vz+=(Math.sin(a.yaw)*drive-u.vz)*Math.min(1,4*STEP);u.intent='step_counter';
    }else if(u.team==='dig'&&phase<.28&&dist<7&&!a.counterDrive&&target.action?.kind==='ram'){u.vx+=(-nx*s.speed*.55-u.vx)*Math.min(1,3.1*STEP);u.vz+=(-nz*s.speed*.55-u.vz)*Math.min(1,3.1*STEP);u.intent='intercept';
    }else if(u.team==='dig'&&u.action.kind!=='grapple'&&u.action.age/u.action.duration>=.65){
      const plan=this.approach(u,target,dist),withdraw=u.action.missed?.55:1;u.vx+=(plan.vx*withdraw-u.vx)*Math.min(1,3.1*STEP);u.vz+=(plan.vz*withdraw-u.vz)*Math.min(1,3.1*STEP);u.intent='step_out';
    }

  }
  physics(){
    const landingHits=[];
    for(const u of this.units){if(u.heldBy!==null){const holder=this.units[u.heldBy],a=holder?.action;if(holder?.hp>0&&a?.kind==='grapple'&&a.captured===u.id&&u.hp>0){const t=Math.max(0,Math.min(1,(a.age/a.duration-.28)/.44)),yaw=a.yaw;u.x=holder.x+Math.cos(yaw)*(4.7-t*1.4);u.z=holder.z+Math.sin(yaw)*(4.7-t*1.4);u.y=holder.y+1.1+t*4.5;u.roll=t*Math.PI*.6*a.side;u.pitch=-t*.8;u.vx=u.vz=u.vy=0;continue;}u.heldBy=null;u.vy=Math.max(u.vy,1);}
      if(u.aerialAttack&&(u.hp<=0||u.heldBy!==null||u.stun>.2))this.cancelJump(u);
      const stepX=u.x,stepZ=u.z,wasAir=u.y>.02,s=u.stats,g=this.flightGravity(u);u.x+=u.vx*STEP;u.z+=u.vz*STEP;u.y+=u.vy*STEP;u.vy-=g*STEP;
      if(u.y<=0){u.y=0;u.aerialAttack=null;if(u.counterFall){u.counterFall=false;if(u.hp>0){if(u.jawLaunched)this.applyStun(u,1.2,'jaw-landing');else u.stun=Math.max(u.stun,.7);u.jawLaunched=false;u.opening=Math.max(u.opening,.5);}}if(wasAir&&u.vy<-3.5){const impact=Math.abs(u.vy);this.landings++;if(u.hp<=0&&!u.deathLanded){u.deathLanded=true;this.effect(u.x,.12,u.z,'collapse',u.team==='rex'?2.3:1.8,u.team);}if(u.thrownBy!==null){const source=this.units[u.thrownBy],slam=u.throwImpact?.mode==='slam';if(source){if(u.throwImpact?.mode==='ground'){this.applyStun(u,1.5,'throw-landing');u.groundThrow={source:source.id,until:this.time+1.15,travel:0,hitIds:new Set([u.id])};u.vy=0;landingHits.push({source,target:u,damage:source.stats.damage*1.8,kind:'smash',technique:'grapple',side:source.side,critical:false,parryable:false,stagger:.8,impactScale:0,launchOverride:0});}else{this.applyStun(u,1.5,'throw-landing');for(const v of this.units){if(v.hp>0&&v.team!==source.team&&v.heldBy===null&&Math.abs(v.y-u.y)<2.2&&Math.hypot(v.x-u.x,v.z-u.z)<4.8){landingHits.push({source,target:v,damage:source.stats.damage*(v===u?(slam?1.8:1.2):(slam?.95:.6)),kind:'smash',technique:'grapple',side:source.side,critical:false,parryable:false,stagger:v===u?.8:slam?.6:.25,impactScale:slam?2:1,impactOrigin:{x:u.x,z:u.z},launchOverride:v===u?0:slam?5:3});}}}this.effect(u.x,.1,u.z,'impact',2.6,source.team);}u.thrownBy=null;u.throwImpact=null;}this.effect(u.x,.08,u.z,'dust',Math.min(2,impact/6));this.quake=Math.min(1.7,this.quake+impact*.012);u.vy=u.groundThrow?0:impact>5?impact*.16:0;u.vx*=.83;u.vz*=.83;if(u.hp>0)u.stun=Math.max(u.stun,.08);}else u.vy=0;}
      if(u.groundThrow)advanceGroundThrow(this,u,landingHits,stepX,stepZ);
      const drag=Math.exp(-(u.groundThrow?1.8:u.y>.05?.8:u.hp<=0?3.3:u.action?3.2:1.1)*STEP);u.vx*=drag;u.vz*=drag;u.speed=Math.hypot(u.vx,u.vz);u.moving=u.speed>.5;u.walk+=u.speed*STEP*1.3;
      u.roll+=u.rollV*STEP;u.pitch+=u.pitchV*STEP;const air=u.y>.2;
      if(u.hp>0){const lean=clamp(-angle(Math.atan2(u.vz,u.vx)-u.yaw)*u.speed*.025,-.22,.22);u.rollV+=((lean-u.roll)*(air?3:29)-u.rollV*(air?1.4:7))*STEP;u.pitchV+=((-u.pitch)*(air?2:28)-u.pitchV*(air?1.2:7))*STEP;}
      else if(!air){const target=u.team==='dig'?u.deathSide*1.65:u.deathSide*1.45;u.rollV+=((target-u.roll)*16-u.rollV*5)*STEP;u.pitchV+=(-u.pitch*8-u.pitchV*4)*STEP;}
      u.rollV*=Math.exp(-.3*STEP);u.pitchV*=Math.exp(-.3*STEP);
      const edge=this.radius-2;for(const k of ['x','z']){if(Math.abs(u[k])>edge){u[k]=clamp(u[k],-edge,edge);u[k==='x'?'vx':'vz']*=-.35;}}
      if(u.team==='rex'){
        const forward=(u.vx*Math.cos(u.yaw)+u.vz*Math.sin(u.yaw))/(u.speed||1);
        const running=u.hp>0&&u.y<.1&&u.stun<=0&&!u.action&&u.speed>s.speed*.72&&forward>.85&&Math.abs(angle(u.yaw-u.runYaw))<.08;
        u.runUp=running?Math.min(12,(u.runUp||0)+Math.hypot(u.x-stepX,u.z-stepZ)):0;u.runYaw=u.yaw;u.charge=u.runUp/12;
      }
      if(u.y>this.peakAir)this.peakAir=u.y;
      if(u.hp>0&&u.moving&&u.y<.1){u.distMoved+=u.speed*STEP;if(u.distMoved>.95){u.distMoved=0;this.effect(u.x,.1,u.z,'step',Math.min(1,u.speed/5),u.team);}}
    }
    // Contact impulses act on both bodies, including airborne units and wrecks.
    const indexed=!!this.spatial;if(indexed)this.buildSpatial();
    for(let i=0;i<this.units.length;i++){const a=this.units[i];if(a.heldBy!==null||a.hp<=0&&this.time-a.deadAt>4)continue;for(const b of this.nearby(a.x,a.z,8)){if(b.id<=i)continue;if(b.heldBy!==null||b.hp<=0&&this.time-b.deadAt>4||Math.abs(a.y-b.y)>2.2)continue;let dx=b.x-a.x,dz=b.z-a.z,min=(SPECS[a.team].radius+SPECS[b.team].radius)*.84;if(Math.abs(dx)>=min||Math.abs(dz)>=min||dx*dx+dz*dz>=min*min)continue;let d=Math.hypot(dx,dz);if(d<.001){dx=.01;dz=.007;d=Math.hypot(dx,dz);}const nx=dx/d,nz=dz/d,ia=1/SPECS[a.team].mass,ib=1/SPECS[b.team].mass,den=ia+ib,penetration=min-d,push=penetration*.38/den;a.x-=nx*push*ia;a.z-=nz*push*ia;b.x+=nx*push*ib;b.z+=nz*push*ib;
        const relative=(b.vx-a.vx)*nx+(b.vz-a.vz)*nz;if(relative<-.3){const impulse=-relative*.67/den;a.vx-=nx*impulse*ia;a.vz-=nz*impulse*ia;b.vx+=nx*impulse*ib;b.vz+=nz*impulse*ib;if(relative<-5){a.rollV-=nz*.9;b.rollV+=nz*.9;this.effect((a.x+b.x)/2,.4,(a.z+b.z)/2,'dust',1);}}
      }}
    this.spatial=null;
    if(!this.done&&landingHits.length){this.applyHits(landingHits);this.resolveExplosions();}
  }
  advanceFX(){this.quake*=.84;this.effects=this.effects.filter(e=>(e.life-=STEP)>0);for(const p of this.particles){p.life-=STEP;p.x+=p.vx*STEP;p.z+=p.vz*STEP;p.y+=p.vy*STEP;p.vy-=(p.kind==='smoke'?-1.5:p.kind==='fire'?5:p.kind==='dust'?1.4:18)*STEP;if(p.y<.04){p.y=.04;p.vy=Math.abs(p.vy)*.25;p.vx*=.72;p.vz*=.72;}p.spin+=STEP*5;}this.particles=this.particles.filter(p=>p.life>0);}
  step(){if(this.done)return;this.snapshot();this.tick++;this.time=this.tick*STEP;const alive=this.units.filter(u=>u.hp>0),teams={rex:alive.filter(u=>u.team==='rex'),dig:alive.filter(u=>u.team==='dig')},hits=[];this.updateSquads(alive);this.buildSpatial();this.clusters=new Map();this.isolationCache=new Map();this.assignments={rex:new Map(),dig:new Map()};for(const u of alive)if(u.target!==null){const m=this.assignments[u.team];m.set(u.target,(m.get(u.target)||0)+1);}for(const u of alive)this.tickReadiness(u);this.tryAerialCounters(alive);for(const u of alive)this.movement(u,teams,hits);this.resolveWeaponClashes(hits);this.applyHits(hits);this.resolveExplosions();this.physics();this.assignments=null;this.clusters=null;this.isolationCache=null;this.advanceFX();const left=this.alive;if(!left.rex||!left.dig||this.time>=240){this.done=true;this.combatTime=this.time;this.winner=!left.rex&&!left.dig?'draw':!left.rex?'dig':!left.dig?'rex':'draw';this.event(this.winner==='draw'?'전투 종료 — 무승부':this.winner==='rex'?'전투 종료 — 티라노 승':'전투 종료 — 포크레인 승');}}
  settleStep(){this.buildSpatial();this.snapshot();this.tick++;this.time=this.tick*STEP;for(const u of this.units){u.headDownFor=Math.max(0,(u.headDownFor||0)-STEP);updateBucketArm(u,STEP);u.vx*=.93;u.vz*=.93;u.parry=Math.max(0,u.parry-STEP);u.opening=Math.max(0,u.opening-STEP);u.hit=Math.max(0,u.hit-STEP*3);u.attack=Math.max(0,u.attack-STEP*3);if(u.action)u.action.age+=STEP;}this.physics();this.advanceFX();}
}





