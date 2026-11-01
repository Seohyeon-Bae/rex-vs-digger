// Versioned, immutable-per-battle tuning. Defaults are the original game rules.
export const MOVE_KEYS={rex:['bite','ram','tail','leap','pounce','rage'],dig:['smash','sweep','uppercut','spin','grapple','overdrive']};
const finite=(v,d,min,max)=>v===null||v===undefined||v===''||!Number.isFinite(Number(v))?d:Math.max(min,Math.min(max,Number(v)));
export function normalizeTuning(raw={}){
 const out={};
 for(const team of ['rex','dig']){const s=raw?.[team]||{},moves={};for(const kind of MOVE_KEYS[team]){const m=s.moves?.[kind]||{};moves[kind]={enabled:m.enabled!==false,damage:finite(m.damage,1,.25,3),cooldown:finite(m.cooldown,1,.25,3),knockback:finite(m.knockback,1,0,2)};}
  out[team]={intelligence:finite(s.intelligence,1,0,1),hp:finite(s.hp,1,.25,3),speed:finite(s.speed,1,.5,2),armor:finite(s.armor,team==='rex'?.13:.23,0,.75),parryChance:s.parryChance===null||s.parryChance===undefined||s.parryChance===''?null:finite(s.parryChance,null,0,1),parryCooldown:finite(s.parryCooldown,1,.25,3),parryPush:finite(s.parryPush,1,0,2),flank:finite(s.flank,1,.5,1.5),breakthrough:finite(s.breakthrough,1,.5,1.5),distance:finite(s.distance,1,.5,1.5),defense:finite(s.defense,1,.5,1.5),moves};
 }
 out.explosion={damage:finite(raw?.explosion?.damage,1,0,3),radius:finite(raw?.explosion?.radius,1,.5,2)};return out;
}
export function moveTuning(config,team,kind){return config.tuning[team].moves[kind==='grip'||kind==='throw'?'grapple':kind]||{damage:1,cooldown:1,knockback:1};}
export function customBalance(config){return config.rexPower!==1||config.digPower!==1||config.formation!=='faction'||JSON.stringify(normalizeTuning(config.tuning))!==JSON.stringify(normalizeTuning());}
