const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function frontStrategy(config){return(config.seed>>>0)%3;}
export function pressureDelay(config,lane,span){
 if(config.formation!=='faction'||config.rex<100)return 0;
 const z=clamp(lane/Math.max(1,span),-1,1),plan=frontStrategy(config),side=(config.seed>>>2)%2?1:-1;
 return plan===0?Math.abs(z)*2.2:plan===1?(1-Math.abs(z))*2.4:(1-z*side)*1.2;
}
export function sectorPriority(config,group,enemy){
 if(config.formation!=='faction'||config.rex<100||group.team!=='rex'||group.mission!=='pressure')return 0;
 const plan=frontStrategy(config),side=(config.seed>>>2)%2?1:-1;
 return(plan===0?Math.abs(enemy.z):plan===1?-Math.abs(enemy.z):enemy.z*side)*.12;
}
export function routeBudget(group,entry,stage){
 const speed=group.members?.length?group.members.reduce((sum,u)=>sum+u.stats.speed,0)/group.members.length:8.8;
 return clamp(2+Math.hypot((stage==='outward'?entry.frontX:entry.rearX)-group.x,entry.flankZ-group.z)/speed*1.3,8,40);
}
