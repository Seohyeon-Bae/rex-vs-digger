const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v)),smooth=t=>{t=clamp(t);return t*t*(3-2*t);};
function bucketGoal(u,phase){
 const a=u.action,kind=a?.kind,dead=u.hp<=0,contact=kind==='uppercut'?.52:.48;
 const wind=phase<.3?smooth(phase/.3):1-smooth((phase-.3)/.3),stroke=phase<.3?0:phase<contact?Math.sin((phase-.3)/(contact-.3)*Math.PI/2):Math.cos(clamp((phase-contact)/(1-contact))*Math.PI/2);
 const lift=kind==='grapple'?clamp((phase-.28)/.44):0,throwing=kind==='grapple'&&phase>.72?Math.sin((phase-.72)/.28*Math.PI):0;
 const q=dead?[2.1,2.3,.55]:u.parry>0?[2.05,4.4,.55]:kind==='grapple'?[2.5-lift*.6+throwing*.4,3.6+lift*2.2,.55]:kind==='uppercut'?[2.3-stroke*.8,4.1+stroke*2,.55]:[2.5-wind*.8,5.1+wind*.9-stroke*1.1,.55];
 const r=dead?[3.9,.75,.55]:u.parry>0?[u.guardReach||3.7,u.guardHeight||3.1,.55]:kind==='grapple'?[4.7-lift*1.4+throwing*2,2.3+lift*4.5-throwing*1.5,.55]:kind==='uppercut'?[5.3-stroke*1.4,.9+stroke*4.5,.55]:kind==='smash'?[4.6+stroke,3.3+wind*2-stroke*3,.55]:[5.6-wind*.6,2.2+wind*.7,.55];
 q[0]*=1.04;r[0]*=1.08;
 if(!dead&&a?.bucketReach&&kind!=='grapple'){if(kind==='spin'||kind==='sweep'){const extend=smooth((phase-(kind==='spin'?.18:.24))/(kind==='spin'?.42:.28)),folded=Math.min(a.bucketReach,Math.max(1.8,a.bucketReach*.65));r[0]=folded+(a.bucketReach-folded)*extend;}else r[0]=a.bucketReach*(1-wind*.12);q[0]=Math.min(q[0],r[0]*.62);}
 const slew=dead?u.deathSide*.35:u.guardUntil>0?(u.guardSlew||0):u.parry>0?Math.sin(u.parry/.45*Math.PI)*u.parrySide*.65:kind==='spin'?Math.PI*2*smooth(phase)*(a.side||1):kind==='sweep'?(phase<.3?-1.2*smooth(phase/.3):phase<.7?-1.2+2.6*smooth((phase-.3)/.4):1.4*(1-smooth((phase-.7)/.3)))*(a.side||1):0;
 return{q,r,wind,stroke,slew};
}
// Fixed-length boom and stick: reach changes by bending joints, never telescoping.
export function bucketPose(u,phase){
 const goal=bucketGoal(u,phase),p=[.65,2.1,.55],r=u.armPose?[u.armPose.x,u.armPose.y,.55]:goal.r;
 const dx=r[0]-p[0],dy=r[1]-p[1],d=clamp(Math.hypot(dx,dy),.3,6.75),nx=dx/(Math.hypot(dx,dy)||1),ny=dy/(Math.hypot(dx,dy)||1),l1=3.35,l2=3.45;
 r[0]=p[0]+nx*d;r[1]=p[1]+ny*d;const mid=(l1*l1-l2*l2+d*d)/(2*d),height=Math.sqrt(Math.max(0,l1*l1-mid*mid));
 return{...goal,r,q:[p[0]+nx*mid-ny*height,p[1]+ny*mid+nx*height,.55],slew:u.armPose?.slew??goal.slew};
}
// Rotation is quicker when the fixed-length arm folds toward the upper body.
export function bucketTurnSpeed(u){const arm=u.armPose;if(!arm)return 4.8*(u.buffActive?1.55:1);const dx=arm.x-.65,dy=arm.y-2.1,cosine=clamp((dx*dx+dy*dy-3.35**2-3.45**2)/(2*3.35*3.45),-1,1),fold=Math.acos(cosine)/Math.PI;return 4.8*(1+fold)*(u.buffActive?1.55:1);}
export function updateBucketArm(u,dt){
 if(u.team!=='dig'||u.hp<=0)return;const goal=bucketGoal(u,u.action?u.action.age/u.action.duration:0);
 if(!u.armPose){u.armPose={x:goal.r[0],y:goal.r[1],slew:goal.slew,vx:0,vy:0,vs:0};return;}
 const arm=u.armPose;arm.prevX=arm.x;arm.prevY=arm.y;arm.prevSlew=arm.slew;const omega=(u.action||u.guardUntil>0?44:24)*(u.buffActive?1.55:1),e=Math.exp(-omega*dt);
 for(const [key,velocity,target]of [['x','vx',goal.r[0]],['y','vy',goal.r[1]],['slew','vs',arm.slew+Math.atan2(Math.sin(goal.slew-arm.slew),Math.cos(goal.slew-arm.slew))]]){const difference=arm[key]-target,c=arm[velocity]+omega*difference;arm[key]=target+(difference+c*dt)*e;arm[velocity]=(arm[velocity]-omega*c*dt)*e;if(key==='slew'&&!u.action&&u.parry>0){const previous=arm.prevSlew;const maximumTurn=bucketTurnSpeed(u)*dt;arm.slew=previous+clamp(arm.slew-previous,-maximumTurn,maximumTurn);}}
}
export function bucketWorld(u,phase,arm=u.armPose){let r,slew;if(arm){const a=arm,dx=a.x-.65,dy=a.y-2.1,length=Math.hypot(dx,dy),reach=clamp(length,.3,6.75),den=length||1;r=[.65+dx/den*reach,2.1+dy/den*reach,.55];slew=a.slew;}else({r,slew}=bucketPose(u,phase));const yaw=u.yaw+slew,scale=u.scale||1;return{x:u.x+(r[0]*Math.cos(yaw)-r[2]*Math.sin(yaw))*scale,y:u.y+(r[1]-.35)*scale,z:u.z+(r[0]*Math.sin(yaw)+r[2]*Math.cos(yaw))*scale};}
export function bucketContact(u,v){
 const a=u.action,arm=u.armPose,moving=arm&&arm.prevX!==undefined&&(Math.abs(arm.x-arm.prevX)+Math.abs(arm.y-arm.prevY)+Math.abs(arm.slew-arm.prevSlew)>.02),samples=arm?(moving?5:1):5;for(let i=0;i<samples;i++){const t=i/4,pose=moving?{x:arm.x+(arm.prevX-arm.x)*t,y:arm.y+(arm.prevY-arm.y)*t,slew:arm.slew+(arm.prevSlew-arm.slew)*t}:arm,p=bucketWorld(u,clamp((a.age-i*1/120)/a.duration),pose);
  // Body and head capsules are shared by all bucket strokes, including close ones.
  for(const [offset,height,radius]of (a.kind==='uppercut'?[[1.5,3,1],[3.1,3.6,1.2]]:[[-1,2.3,1.25],[.8,2.8,1.15],[3.1,3.6,1.2]])){
   const scale=v.scale||1,x=v.x+Math.cos(v.yaw)*offset*scale,z=v.z+Math.sin(v.yaw)*offset*scale,y=v.y+height*scale;
   if(Math.hypot(p.x-x,p.z-z)<=radius*scale+.7&&Math.abs(p.y-y)<=radius*scale+.7)return p;
  }
 }return null;
}
