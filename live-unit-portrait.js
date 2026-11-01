import {Battle} from './engine.js';
import {CharacterRenderer} from './character-guide.js';
import {portraitPose} from './combat-motion.js';
let renderer,canvas,output,lastDraw=-Infinity,lastUnit=null,lastBattle=null,lastTick=-1,lastAlpha=-1;
export function updateUnitPortrait(host,u,battle,alpha,ms){
 const changed=lastUnit!==u||lastBattle!==battle;
 if(!changed&&(ms-lastDraw<1000/30||lastTick===battle.tick&&Math.abs(alpha-lastAlpha)<.02))return;
 if(!renderer){
  const stage=document.createElement('div');stage.style.cssText='position:fixed;left:-10000px;top:0;width:108px;height:72px;visibility:hidden;pointer-events:none';stage.setAttribute('aria-hidden','true');
  canvas=document.createElement('canvas');canvas.style.cssText='width:108px;height:72px;display:block';stage.append(canvas);document.body.append(stage);
  renderer=new CharacterRenderer(canvas,new Battle({...battle.config,rex:1,dig:1}),{transparent:true});renderer.portrait=true;renderer.follow=false;renderer.yaw=0;renderer.elev=.2;renderer.zoom=.98;
  output=document.createElement('canvas');output.className='tracked-portrait-canvas';output.setAttribute('aria-hidden','true');output.width=canvas.width;output.height=canvas.height;host.replaceChildren(output);
 }
 const unit=portraitPose(u,renderer,alpha);renderer.unit=unit;renderer.battle.units=[unit];renderer.battle.time=battle.time;renderer.focusX=u.team==='rex'?-1:1;renderer.focusZ=0;
 renderer.draw(battle.time);const c=output.getContext('2d');c.clearRect(0,0,output.width,output.height);if(renderer.gpuCanvas&&!renderer.gpuLost)c.drawImage(renderer.gpuCanvas,0,0,output.width,output.height);c.drawImage(canvas,0,0,output.width,output.height);
 host.dataset.pose=u.hp<=0?'defeated':u.hit>.05?'hit':u.action?.kind|| (u.moving?'moving':'idle');
 lastUnit=u;lastBattle=battle;lastTick=battle.tick;lastAlpha=alpha;lastDraw=ms;
}
