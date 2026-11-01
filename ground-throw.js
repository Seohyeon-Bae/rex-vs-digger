const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
export function groundThrowAim(b,holder,victim){
 const heading=holder.action?.yaw??holder.yaw,push=b.config.tuning.dig.moves.grapple.knockback,speed=28*push;
 const candidates=b.nearby(holder.x,holder.z,27).filter(v=>v!==victim&&v.team!==holder.team&&v.hp>0&&v.heldBy===null&&v.y<1.5).sort((a,c)=>(a.x-victim.x)**2+(a.z-victim.z)**2-((c.x-victim.x)**2+(c.z-victim.z)**2)||a.id-c.id).slice(0,16);
 let best=null;
 for(const v of candidates){const distance=Math.hypot(v.x-victim.x,v.z-victim.z),lead=clamp(.3+distance/Math.max(8,speed),.3,.85),x=v.x+clamp(v.vx,-6,6)*lead,z=v.z+clamp(v.vz,-6,6)*lead,yaw=Math.atan2(z-victim.z,x-victim.x);
  if(distance>7+speed*.6||Math.abs(angle(yaw-heading))>1.15||Math.abs(x)>b.radius-3||Math.abs(z)>b.radius-3)continue;
  const nx=Math.cos(yaw),nz=Math.sin(yaw);let score=0;
  for(const target of candidates){const dx=target.x+clamp(target.vx,-6,6)*lead-victim.x,dz=target.z+clamp(target.vz,-6,6)*lead-victim.z,along=dx*nx+dz*nz,cross=Math.abs(-dx*nz+dz*nx);if(along>0&&along<20&&cross<3)score+=Math.exp(-cross*cross/8)/(1+along*.025);}
  for(const ally of b.nearby(holder.x,holder.z,18)){if(ally===holder||ally.team!==holder.team||ally.hp<=0)continue;const dx=ally.x-victim.x,dz=ally.z-victim.z;if(dx*nx+dz*nz>0&&Math.abs(-dx*nz+dz*nx)<2.5)score-=1.5;}
  score-=distance*.012;if(!best||score>best.score)best={target:v.id,x,z,yaw,score};
 }
 const yaw=best?.yaw??heading;
 return{...best,mode:'ground',yaw,x:best?.x??clamp(victim.x+Math.cos(yaw)*8,-b.radius+3,b.radius-3),z:best?.z??clamp(victim.z+Math.sin(yaw)*8,-b.radius+3,b.radius-3),vx:Math.cos(yaw)*speed,vz:Math.sin(yaw)*speed,vy:-19,time:Math.max(.1,victim.y)/19};
}
export function advanceGroundThrow(b,u,hits,fromX,fromZ){
 const g=u.groundThrow;if(!g)return;
 const distance=Math.hypot(u.x-fromX,u.z-fromZ);g.travel+=distance;
 if(b.time>=g.until||g.travel>16||Math.hypot(u.vx,u.vz)<2||u.heldBy!==null){u.groundThrow=null;return;}
 const source=b.units[g.source];if(!source){u.groundThrow=null;return;}
 const dx=u.x-fromX,dz=u.z-fromZ,length=dx*dx+dz*dz;
 for(const v of b.nearby((fromX+u.x)/2,(fromZ+u.z)/2,4+distance*.5)){
  if(v===u||v.team===source.team||v.hp<=0||v.heldBy!==null||Math.abs(v.y-u.y)>2||g.hitIds.has(v.id)||g.hitIds.size>=5)continue;
  const t=length?clamp(((v.x-fromX)*dx+(v.z-fromZ)*dz)/length,0,1):0,radius=(u.stats.radius+v.stats.radius)*.85;
  if((v.x-fromX-dx*t)**2+(v.z-fromZ-dz*t)**2>radius*radius)continue;
  g.hitIds.add(v.id);hits.push({source,target:v,damage:source.stats.damage*.95,kind:'smash',technique:'grapple',side:source.side,critical:false,parryable:false,stagger:.5,impactScale:1.4,impactOrigin:{x:fromX,z:fromZ},launchOverride:3});u.vx*=.78;u.vz*=.78;
 }
}
