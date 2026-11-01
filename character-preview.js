import{updateBucketArm}from'./weapon-geometry.js';
const durations={bite:1.3,ram:1.3,tail:1.7,leap:1.4,pounce:2.1,smash:1.5,sweep:1.5,uppercut:1.5,spin:1.8,grapple:2};
// Detached showroom animation: never steps a battle or changes the viewer camera.
export function animateCharacterPreview(renderer,time){
 const u=renderer.unit;if(!u||renderer.portrait)return;
 renderer.previewEpoch??=time;const moves=renderer.previewMoves||[],program=[{kind:'idle',duration:2},{kind:'walk',duration:1.6}];
 for(const move of moves)program.push({kind:move.kind,duration:move.buff?move.duration:durations[move.kind]||1.5,buff:move.buff},{kind:'idle',duration:.8});
 const total=program.reduce((sum,s)=>sum+s.duration,0),cycle=Math.floor((time-renderer.previewEpoch)/total);let age=(time-renderer.previewEpoch)%total,start=renderer.previewEpoch+cycle*total,index=0;
 while(age>=program[index].duration){age-=program[index].duration;start+=program[index].duration;index++;}
 const s=program[index],key=cycle+':'+index,phase=age/s.duration;
 Object.assign(u,{x:0,z:0,y:0,yaw:0,roll:0,pitch:0,vx:0,vz:0,vy:0,speed:0,walk:time*5,attack:0,parry:0,guardUntil:0,hit:0,stun:0,counterFall:false,buffActive:false,buffUntil:0,aerialAttack:null});
 if(s.kind==='idle'||s.kind==='walk'||s.buff){u.action=null;if(s.kind==='walk')u.speed=2.8*Math.sin(phase*Math.PI);if(s.buff){u.buffActive=true;u.buffUntil=start+s.duration;}}
 else{
  if(renderer.previewActionKey!==key){renderer.previewActionKey=key;renderer.previewAction={kind:s.kind,age:0,duration:s.duration,impact:s.duration*.48,peakImpact:s.duration*.48,side:1,yaw:0,pulses:[s.duration*.48],landAt:null,captured:null,target:1,resolved:false,bucketReach:4.8};}
  u.action=renderer.previewAction;u.action.age=age;u.attack=Math.sin(phase*Math.PI);
  if(s.kind==='ram')u.speed=5*Math.sin(phase*Math.PI);
  if(s.kind==='leap'||s.kind==='pounce'){
   const hop=s.kind==='leap'?.8:.65;
   if(age<hop){const q=age/hop;u.y=2.1*4*q*(1-q);u.vy=2.1*4/hop*(1-2*q);u.aerialAttack={kind:s.kind,startedAt:start};u.action.landAt=null;}
   else{u.action.landAt=hop;u.action.rollDuration=s.duration-hop;u.action.rollPreTucked=true;u.action.resolved=s.kind==='leap';}
  }
 }
 u.moving=u.speed>.1;if(u.team==='dig')updateBucketArm(u,1/30);
}
