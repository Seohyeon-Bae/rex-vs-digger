import {CharacterRenderer} from './character-guide.js';
import {Battle} from './engine.js';

export function animateVictoryUnit(u,time){
 time*=1.3;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);},cycle=time%7.5,rex=u.team==='rex';
 Object.assign(u,{x:0,z:0,y:0,yaw:0,pitch:0,roll:0,hit:0,stun:0,parry:0,guardUntil:0,buffActive:false,speed:0,moving:false,walk:time*5});
 const a=u.victoryAction??={kind:'victory',duration:1,impact:.48,peakImpact:.48,side:1,yaw:0,pulses:[],target:1,resolved:false};a.kind='victory';a.age=0;u.action=a;u.attack=0;
 if(rex){
  const floor=smooth((cycle-.6)/.65)*(1-smooth((cycle-3.4)/.65)),turn=smooth((cycle-.8)/2.65),freeze=smooth((cycle-4.1)/.5)*(1-smooth((cycle-5.5)/.65));
  // Low windmill-style turns, followed by a held leaning freeze and a proud recovery.
  u.y=-.95*floor+.2*freeze;u.roll=1.52*floor-.55*freeze;u.pitch=.2*Math.sin(time*5)*floor-.22*freeze;
  u.yaw=Math.PI*4*turn;u.speed=1.6*floor;u.moving=floor>.05;u.walk=time*11;
  u.buffCastJaw=.25*floor+.85*smooth((cycle-6)/.3)*(1-smooth((cycle-7)/.4));
 }else{
  const brace=smooth((cycle-.5)/.7),lift=smooth((cycle-1.2)/1.1)*(1-smooth((cycle-4.8)/1.25));
  u.buffCastJaw=0;u.y=1.65*lift;u.yaw=Math.PI*2*smooth((cycle-2.2)/2.4);
  // Bucket's lower edge stays on the ground as fixed-length joints lift the chassis.
  const idleX=5.6*1.08,idleY=2.2;
  u.armPose={x:idleX+(4.4-idleX)*brace,y:idleY+(1-u.y-idleY)*brace,slew:-u.yaw,vx:0,vy:0,vs:0};
  if(cycle>6.2){const release=smooth((cycle-6.2)/1.1);u.armPose.x=4.4+(idleX-4.4)*release;u.armPose.y=1+(idleY-1)*release;}
  u.armPose.prevX=u.armPose.x;u.armPose.prevY=u.armPose.y;u.armPose.prevSlew=u.armPose.slew;
 }
}

export function createVictoryScene(host){
 let renderer=null,frame=0,last=0,epoch=0,shown=false;
 const overlay=host.closest('.result-overlay'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const stop=()=>{if(frame)cancelAnimationFrame(frame);frame=0;};
 const tick=ms=>{frame=0;if(!shown||overlay.hidden||document.hidden)return;if(ms-last>=33){const time=reduced.matches?1:(ms-epoch)/1000;animateVictoryUnit(renderer.unit,time);renderer.draw(time);last=ms;}if(!reduced.matches)frame=requestAnimationFrame(tick);};
 const resume=()=>{if(shown&&!overlay.hidden&&!document.hidden&&!frame){last=0;frame=requestAnimationFrame(tick);}};
 document.addEventListener('visibilitychange',()=>document.hidden?stop():resume());
 new MutationObserver(()=>overlay.hidden?stop():resume()).observe(overlay,{attributes:true,attributeFilter:['hidden']});
 return{show(team,config){
  stop();shown=false;host.classList.add('victory-model');
  if(team!=='rex'&&team!=='dig'){renderer?.dispose();renderer=null;host.replaceChildren(Object.assign(document.createElement('span'),{className:'draw-symbol',textContent:'='}));return;}
  if(!renderer){const canvas=document.createElement('canvas');canvas.className='victory-canvas';canvas.setAttribute('aria-hidden','true');host.replaceChildren(canvas);renderer=new CharacterRenderer(canvas,new Battle({...config,rex:1,dig:1}),{transparent:true});renderer.portrait=true;}
  renderer.show(team,config);renderer.yaw=-.4;renderer.elev=.24;renderer.zoom=.92;renderer.resize();epoch=performance.now();shown=true;resume();
 },hide(){shown=false;stop();}};
}

