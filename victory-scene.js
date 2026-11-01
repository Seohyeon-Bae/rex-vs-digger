import {CharacterRenderer} from './character-guide.js';
import {Battle} from './engine.js';
import {updateBucketArm} from './weapon-geometry.js';

export function animateVictoryUnit(u,time){
 const beat=Math.sin(time*3.4),rex=u.team==='rex';
 Object.assign(u,{x:0,z:0,y:rex?.08+.2*Math.max(0,beat):0,yaw:Math.sin(time*1.5)*(rex?.13:.07),pitch:rex?-.07-.04*Math.sin(time*2):.018*beat,roll:rex?0:.025*Math.sin(time*2),hit:0,stun:0,parry:0,guardUntil:0,buffActive:false,speed:rex?1.2:0,moving:rex,walk:time*5});
 const a=u.victoryAction??={kind:rex?'bite':'uppercut',duration:1,impact:.48,peakImpact:.48,side:1,yaw:0,pulses:[],target:1,resolved:false,bucketReach:4.5};
 a.age=rex?.32+.24*(.5+.5*Math.sin(time*2.4)):.35+.25*(.5+.5*Math.sin(time*2));u.action=a;u.attack=Math.sin(a.age*Math.PI);
 if(!rex){updateBucketArm(u,1/30);u.armPose.prevSlew=u.armPose.slew;u.armPose.slew=.28*Math.sin(time*1.6);u.armPose.vs=.448*Math.cos(time*1.6);}
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
