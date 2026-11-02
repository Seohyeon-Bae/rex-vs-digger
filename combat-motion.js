import {BUFFS} from './buffs.js';
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{n=clamp(n);return n*n*n*(n*(n*6-15)+10);};
// Read-only visual envelopes use simulation time, so pausing freezes the animation.
export function buffMotion(u,time){
 const off={strength:0};
 if(!u.buffActive||u.hp<=0||!(u.buffUntil>time))return off;
 const duration=BUFFS[u.team].duration,age=time-(u.buffUntil-duration),strength=ease(age/.22)*ease((u.buffUntil-time)/.3);
 return{strength,age};
}
// Fold first, rotate while tucked, then plant the feet before unfolding.
export function rollFrame(action){
 if(action?.kind!=='pounce'||action.landAt==null)return{progress:0,curl:0,pitch:0,lift:0};
 const progress=clamp((action.age-action.landAt-.06)/((action.rollDuration??1.6)-.1));
 const curl=(action.rollPreTucked?1:ease(progress/.08))*(1-ease((progress-.92)/.08)),t=clamp((progress-.08)/.84),ramp=.12;
 const integrate=x=>{const q=x/ramp;return ramp*(q*q*q-.5*q*q*q*q)/(1-ramp);};
 const turn=t<ramp?integrate(t):t>1-ramp?1-integrate(1-t):(t-ramp/2)/(1-ramp),turns=action.evasion?Math.max(2,Math.round((action.rollDuration??1.6)/.8)):Math.max(1,Math.round((action.rollDuration??1.6)/1.1)),pitch=-Math.PI*2*turns*turn;
 // Support the curled body at its centre, rather than swinging it around the hips.
 const extent=Math.hypot((2.55-.15*curl)*Math.sin(pitch),(2.2-.55*curl)*Math.cos(pitch));
 return{progress,curl,pitch,lift:Math.max(0,extent-2.2)*curl};
}
export function tailTurn(phase,side=1,defensive=false){phase=clamp(phase);if(defensive)return side*(phase<.3?-.5*ease(phase/.3):phase<.55?-.5+(Math.PI+.75)*ease((phase-.3)/.25):Math.PI+.25+(Math.PI-.25)*ease((phase-.55)/.45));return side*(phase<.36?-.9*ease(phase/.36):phase<.61?-.9+(Math.PI+1.2)*ease((phase-.36)/.25):phase<.95?Math.PI+.3+(Math.PI-.3)*ease((phase-.61)/.34):Math.PI*2);}
// Preparation, contact and recovery share the simulation's original contact time.
export function motionEnvelope(action){
 if(!action?.duration)return{load:0,drive:0,phase:0};
 const phase=clamp(action.age/action.duration),contact=clamp((action.peakImpact??action.impact??action.duration*.48)/action.duration);
 const preparation=Math.max(.06,contact*.56),load=ease(phase/preparation)*(1-ease((phase-preparation)/Math.max(.04,contact-preparation)));
 const drive=ease((phase-contact*.48)/Math.max(.04,contact*.52))*(1-ease((phase-contact)/Math.max(.04,1-contact)));
 return{load,drive,phase};
}
// Additional posing never changes position, facing or hit timing in the battle.
export function visualBody(u){
 if(u.hp<=0||u.heldBy!==null||u.y>.7||u.counterFall)return u;
 if(u.groundThrow)return{...u,pitch:u.pitch-(u.groundThrow.travel||0)/1.8};
 const {load,drive,phase}=motionEnvelope(u.action),kind=u.action?.kind,side=u.action?.side||u.side||1;
 const headDown=u.headDownFor>0?ease(clamp(u.headDownFor/.18))*.6:0;
 const recoil=Math.sin(Math.PI*ease(1-clamp(u.hit||0)))*(u.hit||0),free=u.stun<=.2;
 let pitch=0,roll=0,yaw=0;if(u.action?.evasion){roll=-(u.action.evadeSide||1)*.15*Math.sin(phase*Math.PI);pitch=-.05*Math.sin(phase*Math.PI);}
 if(free&&u.team==='rex'){
  if(kind==='bite'){pitch=.21*load-.27*drive;yaw=side*(.1*load-.06*drive);}
  if(kind==='tail'){const weight=phase<.36?ease(phase/.28):1-ease((phase-.36)/.22),swing=ease((phase-.34)/.22)*(1-ease((phase-.61)/.34));pitch=u.action.defensive?-.25*load+.14*drive:-.25*weight+.2*swing;roll=side*(u.action.defensive?-.18*load+.23*drive:-.28*weight+.34*swing);}
 }else if(free&&u.team==='dig'&&kind!=='grapple'){
  if(['smash','uppercut'].includes(kind))pitch=(kind==='uppercut'?-1:1)*(.15*drive-.08*load);
  if(['sweep','spin'].includes(kind)){roll=side*(kind==='spin'?.15:.12)*Math.sin(phase*Math.PI*2);if(kind==='spin')pitch=-.035*load+.055*drive;}if(u.action?.counterDrive)pitch+=.055*drive-.025*load;
 }
 return{...u,y:u.y-headDown*.55,pitch:u.pitch+pitch-recoil*.23-headDown,roll:u.roll+roll+side*recoil*.14,yaw:u.yaw+yaw};
}
export function interpolateMotion(u,alpha){
 const lag=(1-clamp(alpha))*(u.remoteMotionSpan??1/30);
 return{walk:u.walk-(u.hp>0?u.speed*lag*1.3:0),action:u.action?{...u.action,age:Math.max(0,u.action.age-lag)}:null};
}
// Portraits use a detached copy of the real unit, including its current action.
export function portraitPose(u,renderer,alpha=1){
 const pose=renderer.pose(u,alpha),dead=u.hp<=0;
 return{...pose,id:0,x:0,px:0,z:0,pz:0,y:dead?Math.min(.8,pose.y):Math.min(1.4,pose.y*.18),yaw:0,prevYaw:0,scale:1,
  heldBy:u.heldBy===null?null:0,action:pose.action?{...pose.action}:null,aerialAttack:u.aerialAttack?{...u.aerialAttack}:null};
}

// Brief visual-only activation pose; attacks, parries and physics retain priority.
export function buffCastPose(u,time){
 if(!u.buffActive||u.hp<=0||u.heldBy!=null||u.stun>0||u.y>.3||u.counterFall)return u;
 const age=time-(u.buffUntil-BUFFS[u.team].duration);
 if(age<0||age>=1.3)return u;
 const load=ease(age/.3)*(1-ease((age-.35)/.28)),release=ease((age-.28)/.2)*(1-ease((age-.85)/.45));
 const busy=!!u.action||u.parry>0||u.guardUntil>time,weight=busy?.22:1;
 if(u.team==='rex')return {...u,y:u.y-.38*load*weight,pitch:u.pitch+(.16*load-.2*release)*weight,buffCastJaw:release*(busy?.65:1.15),buffCastHead:release*(busy?.18:.5)};
 const pose={...u,pitch:u.pitch+(.035*load-.025*release)*weight};
 if(!busy&&u.armPose)pose.armPose={...u.armPose,x:u.armPose.x-1.8*load-.65*release,y:u.armPose.y+.65*load+1.45*release};
 return pose;
}
