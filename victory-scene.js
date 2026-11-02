import {CharacterRenderer} from './character-guide.js';
import {Battle} from './engine.js';

// Body-local joint targets for the b-boy set (x forward, y up, z outward per side), blended by phase weights.
function rexDanceJoints(weights,beat,spin){
 const side=s=>{const step=Math.sin(beat*.5)*s,up=Math.max(0,step),flare=Math.sin(spin*1.4+(s>0?0:Math.PI)),kick=Math.sin(spin*2+s);
  const poses={
   top:{knee:[-.1+.45*step,1.55+.35*up,1.1],ankle:[-.65+.75*step,.42+.55*up,1.2],elbow:[1.75,2.55+.25*Math.sin(beat),.85],claw:[2.35+.2*Math.sin(beat+s),2.9+.3*Math.sin(beat),.9]},
   mill:{knee:[.2+.5*flare,2.2,1.7],ankle:[.9+flare,2.5,2.6],elbow:[1.3,2.3,.9],claw:[1.7,2,.7]},
   back:{knee:[.9,2.6,1.2],ankle:[.4,3.2,1],elbow:[1.5,2.6,.7],claw:[1,3,.4]},
   head:{knee:[-1.9,2.3,1.3],ankle:[-3.1,2.4+.25*kick,2.3],elbow:[2.2,2.6,1],claw:[3,2.9,.9]},
   freeze:s<0?{knee:[.7,2.5,1],ankle:[.1,3.2,1.2],elbow:[1.9,2,.9],claw:[2.4,1.5,.9]}:{knee:[-1.9,2.4,1.4],ankle:[-3,2.6,1.9],elbow:[1.8,2.9,.9],claw:[2,3.2,1]}};
  const out={knee:[0,0,0],ankle:[0,0,0],elbow:[0,0,0],claw:[0,0,0]};let total=0;
  for(const [k,w] of Object.entries(weights)){if(w<=0)continue;total+=w;for(const j of Object.keys(out))for(let i=0;i<3;i++)out[j][i]+=poses[k][j][i]*(i===2?s:1)*w;}
  for(const j of Object.keys(out))for(let i=0;i<3;i++)out[j][i]/=total||1;return out;};
 const w=Object.values(weights).reduce((a,b)=>a+b,0),{top,mill,back,head,freeze}=weights;
 return{w:Math.min(1,w),l:side(-1),r:side(1),tail:(top*.4*Math.sin(beat*.5)+mill*1.5*Math.sin(spin))/(w||1),tailLift:(mill*.3+back*.8+freeze*1.4+top*.15*Math.sin(beat))/(w||1)};
}
export function animateVictoryUnit(u,time){
 time*=1.3;
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);},cycle=time%7.5,rex=u.team==='rex';
 Object.assign(u,{x:0,z:0,y:0,yaw:0,pitch:0,roll:0,hit:0,stun:0,parry:0,guardUntil:0,buffActive:false,speed:0,moving:false,walk:time*5});
 const a=u.victoryAction??={kind:'victory',duration:1,impact:.48,peakImpact:.48,side:1,yaw:0,pulses:[],target:1,resolved:false};a.kind='victory';a.age=0;u.action=a;u.attack=0;
 if(rex){
  // B-boy set: toprock on the beat, then spins on the body (windmill), the back (backspin) and the head (headspin),
  // a held freeze, and a pop up into a roar.
  const beat=time*4.4,top=smooth(cycle/.35)*(1-smooth((cycle-.9)/.3)),mill=smooth((cycle-.9)/.3)*(1-smooth((cycle-2.15)/.3)),back=smooth((cycle-2.15)/.3)*(1-smooth((cycle-3.25)/.3));
  const head=smooth((cycle-3.25)/.4)*(1-smooth((cycle-5)/.35)),freeze=smooth((cycle-5)/.3)*(1-smooth((cycle-5.9)/.4)),roar=smooth((cycle-6.25)/.25)*(1-smooth((cycle-7.1)/.3));
  // One continuous spin through all three moves (a whole number of turns, so the loop joins), and a roll that keeps
  // turning the same way: side, back, upside down, then a full roll back onto the feet.
  const spin=Math.PI*14*smooth((cycle-1)/4.1),stand=smooth((cycle-5.9)/.4),rock=Math.sin(spin*1.4),full=Math.PI*2;
  u.y=top*.16*Math.abs(Math.sin(beat))-mill*(.85+.1*rock)-back*.55+head*3.3+freeze*.18;
  u.yaw=top*.38*Math.sin(beat*.5)+spin-freeze*.45;
  u.roll=top*.1*Math.sin(beat*.5)+mill*(1.35+.38*rock)+back*2.95+head*(full+.12*Math.sin(spin*2))+freeze*(full-.62)+stand*full;u.roll%=full;
  u.pitch=top*.07*Math.sin(beat)+mill*.14*Math.cos(spin*1.4)+back*.12-head*1.42-freeze*.32;
  u.speed=top*1.2+(mill+back+head)*2.2;u.moving=top>.2||mill+back+head>.05;u.walk=time*(top>.5?8:back>.5?5:13);
  u.buffCastJaw=.18*top*(Math.sin(beat)>.6?1:0)+.2*mill+.3*back+.1*head+.35*freeze+.85*roar;u.victoryZoom=1-.34*head;u.dance=rexDanceJoints({top,mill,back,head,freeze},beat,spin);
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

// Draw: both sides went down together, tangled. They topple once, then lie still side by side.
export function animateFallenUnit(u,time){
 const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);},fall=smooth((time-.25)/(u.team==='rex'?.8:1)),settle=Math.sin(Math.min(1,Math.max(0,(time-1.05)/.35))*Math.PI)*.06;
 Object.assign(u,{y:0,pitch:0,hit:0,stun:0,parry:0,guardUntil:0,buffActive:false,speed:0,moving:false,walk:0,action:null,attack:0,hp:0});
 if(u.team==='rex'){u.roll=-(1.45+settle)*fall;u.y=-.1*fall;u.pitch=.08*fall;u.buffCastJaw=.45*fall;}
 // The digger stays on its tracks with a list so its arm and bucket still read; the bucket lies on the tyrannosaur.
 else{const idleX=5.6*1.08,idleY=2.2,drop=smooth((time-.1)/.7);u.buffCastJaw=0;u.roll=(.2-settle)*fall;u.pitch=.07*fall;
  u.armPose={x:idleX+(5.3-idleX)*drop,y:idleY+(.55-idleY)*drop,slew:.08*drop,vx:0,vy:0,vs:0};u.armPose.prevX=u.armPose.x;u.armPose.prevY=u.armPose.y;u.armPose.prevSlew=u.armPose.slew;}
}
export function createVictoryScene(host){
 let renderer=null,fallen=false,frame=0,last=0,epoch=0,shown=false;
 const overlay=host.closest('.result-overlay'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const stop=()=>{if(frame)cancelAnimationFrame(frame);frame=0;};
 const tick=ms=>{frame=0;if(!shown||overlay.hidden||document.hidden)return;if(ms-last>=33){const time=reduced.matches?1:(ms-epoch)/1000;if(fallen)for(const u of [renderer.unit,...renderer.extraUnits])animateFallenUnit(u,reduced.matches?3:time);else{animateVictoryUnit(renderer.unit,time);renderer.zoom=.92*(renderer.unit.victoryZoom??1);}renderer.draw(time);last=ms;}if(!reduced.matches)frame=requestAnimationFrame(tick);};
 const canvas=()=>{const c=document.createElement('canvas');c.className='victory-canvas';c.setAttribute('aria-hidden','true');return c;};
 const resume=()=>{if(shown&&!overlay.hidden&&!document.hidden&&!frame){last=0;frame=requestAnimationFrame(tick);}};
 document.addEventListener('visibilitychange',()=>document.hidden?stop():resume());
 new MutationObserver(()=>overlay.hidden?stop():resume()).observe(overlay,{attributes:true,attributeFilter:['hidden']});
 return{show(team,config){
  stop();shown=false;host.classList.add('victory-model');
  if(!renderer){const c=canvas();host.replaceChildren(c);renderer=new CharacterRenderer(c,new Battle({...config,rex:1,dig:1}),{transparent:true});renderer.portrait=true;}
  fallen=team!=='rex'&&team!=='dig';
  if(fallen){
   // One scene: both lie where they met, the tyrannosaur against the digger's arm.
   renderer.show('rex',config);const rex=renderer.unit,dig=new Battle({...config,rex:1,dig:1}).units.find(u=>u.team==='dig');
   Object.assign(rex,{x:.6,px:.6,z:-2.9,pz:-2.9,yaw:Math.PI/2-.35,prevYaw:Math.PI/2-.35});Object.assign(dig,{id:1,deadAt:-10,x:-.3,px:-.3,z:3.4,pz:3.4,y:0,py:0,yaw:-Math.PI/2+.15,prevYaw:-Math.PI/2+.15,scale:1,walk:0,speed:0,action:null});renderer.extraUnits=[dig];
   renderer.yaw=-Math.PI/2+.12;renderer.elev=.3;renderer.zoom=host.clientHeight<110?1.15:1.05;renderer.focusX=0;renderer.focusZ=-.9;renderer.resize();
  }else{renderer.extraUnits=null;renderer.show(team,config);renderer.yaw=-.4;renderer.elev=.24;renderer.zoom=.92;renderer.resize();}
  epoch=performance.now();shown=true;resume();
 },hide(){shown=false;stop();}};
}
