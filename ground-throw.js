const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const angle=x=>Math.atan2(Math.sin(x),Math.cos(x));
// Identical flight paths are shared within a battle, never between different settings.
function throwPath(b,height,speed){
 const cache=b.throwPathCache??=new Map(),key=height+':'+speed;
 if(cache.has(key))return cache.get(key);
 const path=[];let y=Math.max(.1,height),vy=-19,v=speed,distance=0,travel=0,landed=false,rollAge=0;
 const dt=1/30,airDrag=Math.exp(-.8*dt),groundDrag=Math.exp(-1.8*dt);
 for(let step=1;step<=50;step++){
  const move=v*dt;distance+=move;y+=vy*dt;vy-=18*dt;
  if(y<=0){y=0;if(!landed){landed=true;v*=.83;}vy=0;travel+=move;rollAge+=dt;}
  if(landed&&step%2===0)path.push({time:step*dt,distance});
  v*=landed?groundDrag:airDrag;if(rollAge>1.15||travel>16||v<2)break;
 }
 if(cache.size>=64)cache.delete(cache.keys().next().value);cache.set(key,path);return path;
}
// Predict the real downward flight, landing loss and rolling drag before aiming.
export function groundThrowAim(b,holder,victim){
 const heading=holder.action?.yaw??holder.yaw,push=b.config.tuning.dig.moves.grapple.knockback,baseSpeed=28*push;
 const preparing=holder.action?.age/holder.action?.duration<.7,cone=preparing?2.5:.72;
 const candidates=b.nearby(holder.x,holder.z,28).filter(v=>v.id!==victim.id&&v.team!==holder.team&&v.hp>0&&v.heldBy===null&&v.y<1.5).sort((a,c)=>Math.hypot(a.x-victim.x,a.z-victim.z)-Math.hypot(c.x-victim.x,c.z-victim.z)||a.id-c.id).slice(0,16);
 const allies=b.nearby(holder.x,holder.z,22).filter(v=>v!==holder&&v.team===holder.team&&v.hp>0);
 let best=null;
 for(const speed of [baseSpeed*.7,baseSpeed]){
  const path=throwPath(b,victim.y,speed);
  const predictions=candidates.map(target=>path.map(p=>{const lead=Math.min(1,p.time),x=target.x+clamp(target.vx||0,-24,24)*lead,z=target.z+clamp(target.vz||0,-24,24)*lead;return{x,z,dx:x-victim.x,dz:z-victim.z};}));
  for(let ci=0;ci<candidates.length;ci++){const target=candidates[ci];
   let aim=null,error=Infinity;
   for(let pi=0;pi<path.length;pi++){const p=path[pi],{x,z}=predictions[ci][pi],dist=Math.hypot(x-victim.x,z-victim.z),yaw=Math.atan2(z-victim.z,x-victim.x),miss=Math.abs(dist-p.distance);
    if(Math.abs(angle(yaw-heading))>cone||Math.abs(x)>b.radius-3||Math.abs(z)>b.radius-3||miss>=error)continue;
    aim={x,z,yaw,time:p.time};error=miss;
   }
   if(!aim||error>(victim.stats.radius+target.stats.radius)*.85)continue;
   const nx=Math.cos(aim.yaw),nz=Math.sin(aim.yaw);let score=3-error*.5;
   for(let oi=0;oi<candidates.length;oi++){const other=candidates[oi];let miss=Infinity;for(let pi=0;pi<path.length;pi++){const p=path[pi],pred=predictions[oi][pi],dx=pred.dx-nx*p.distance,dz=pred.dz-nz*p.distance;miss=Math.min(miss,Math.hypot(dx,dz));}if(miss<(victim.stats.radius+other.stats.radius)*.85)score+=1.5-miss*.2;}
   for(const ally of allies){const dx=ally.x-victim.x,dz=ally.z-victim.z,along=dx*nx+dz*nz;if(along>0&&along<Math.hypot(aim.x-victim.x,aim.z-victim.z)&&Math.abs(-dx*nz+dz*nx)<ally.stats.radius+1)score-=2;}
   score-=Math.abs(angle(aim.yaw-heading))*.35+aim.time*.25;
   if(!best||score>best.score)best={...aim,target:target.id,score,speed};
  }
 }
 const yaw=best?.yaw??heading,speed=best?.speed??baseSpeed;
 return{...best,mode:'ground',yaw,x:best?.x??clamp(victim.x+Math.cos(yaw)*8,-b.radius+3,b.radius-3),z:best?.z??clamp(victim.z+Math.sin(yaw)*8,-b.radius+3,b.radius-3),vx:Math.cos(yaw)*speed,vz:Math.sin(yaw)*speed,vy:-19,time:best?.time??Math.max(.1,victim.y)/19};
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
