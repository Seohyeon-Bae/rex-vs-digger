export const BUFFS=Object.freeze({
 rex:Object.freeze({kind:'rage',name:'광폭화',moveSpeed:1.3,unlimitedRam:true,buff:true,level:6,duration:7.5,cooldown:15,damage:0,targets:0}),
 dig:Object.freeze({kind:'overdrive',name:'오버드라이브',guaranteedCritical:true,buff:true,level:6,duration:7.5,cooldown:15,damage:0,targets:0})
});
export function buffReady(unit,time,tuning){const b=BUFFS[unit.team];return unit.hp>0&&unit.heldBy===null&&unit.stun<=0&&!unit.action&&!unit.buffActive&&tuning.moves[b.kind]?.enabled!==false&&(unit.nextTechniqueAt[b.kind]||0)<=time;}

export const rageUnlimited=(u,time)=>u.team==='rex'&&u.hp>0&&u.buffActive&&u.buffUntil>time;
