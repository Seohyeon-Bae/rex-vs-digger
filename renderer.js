import {drawBuffAura} from './buff-aura.js';
import {updateDynamicDirector,applyDynamicMotion,directorZoom,updateDynamicView} from './dynamic-camera.js';
import {bucketPose} from './weapon-geometry.js';
import {fieldView,projectField,fieldGround,clipFieldPolygon} from './field-camera.js';
import {motionEnvelope,visualBody,interpolateMotion,tailTurn,rollFrame,buffMotion,buffCastPose} from './combat-motion.js';
import {SPECS,seededRandom} from './engine.js';
import {constructionSite,ruinSites,fireSites,outerFireSites,cityExtent,SITE_GROUND} from './site-terrain.js';
const hex=(s)=>s.match(/\w\w/g).map(n=>parseInt(n,16));
const tones=new Map();
const tone=(color,f)=>{const k=color+f;if(tones.has(k))return tones.get(k);const c=hex(color.slice(1)),v=`rgb(${c.map(n=>Math.max(0,Math.min(255,Math.round(n*f)))).join(',')})`;tones.set(k,v);return v;};
const FACES=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]];
const SHADE=[.65,1.12,.78,1.25,.85,.98];
const clamp01=n=>Math.max(0,Math.min(1,n));
const smooth=n=>{n=clamp01(n);return n*n*(3-2*n);};
// The bucket winds up, sweeps across, and settles without snapping at either end.
export function bucketSweep(phase,side=1){phase=clamp01(phase);return (phase<.3?-1.2*smooth(phase/.3):phase<.7?-1.2+2.6*smooth((phase-.3)/.4):1.4*(1-smooth((phase-.7)/.3)))*side;}
// Speed up gestures around contact without moving any combat event.
export function actionPosePhase(a){
 if(!a||!a.duration)return 0;
 const age=Math.max(0,Math.min(a.duration,a.age));
 if(a.kind==='pounce')return age/a.duration;
 const contacts=(a.pulses?.length?a.pulses:[a.impact??a.duration*.48]).filter(t=>t>0&&t<a.duration);
 const knots=[0,...contacts,a.duration].sort((x,y)=>x-y);
 for(let i=1;i<knots.length;i++){const start=knots[i-1],end=knots[i];if(age>end||end<=start)continue;
  // Keep the bucket and its held victim on the same lifting path.
  if(a.kind==='grapple'&&start>0&&end<a.duration)return age/a.duration;
  const t=(age-start)/(end-start),gesture=t+.04*Math.sin(t*Math.PI*2);
  return (start+(end-start)*gesture)/a.duration;
 }return 1;
}
// Attack poses are driven by the launch and contact times, not by free-flight spin.
export function rexMotion(u,time){
 const dead=u.hp<=0,a=u.action,kind=a?.kind,phase=actionPosePhase(a);
 const flight=!dead&&!u.counterFall&&u.y>.02&&u.heldBy===null&&u.stun<=.2?u.aerialAttack:null;
 const dash=!dead&&!a?.evasion&&kind==='ram'&&!a.dashInterrupted&&!flight&&u.y<=.7&&u.heldBy===null&&u.stun<=.2;
 const dashLoad=dash&&phase<.16?Math.sin(Math.PI*smooth(phase/.16)):0;
 const contactPhase=a?clamp01((a.impact??a.duration*.48)/a.duration):.48;
 const dashDrive=dash?(a.dashStart===undefined?smooth((phase-.1)/.09):smooth((a.age-a.dashStart)/.08))*(1-smooth((phase-contactPhase)/.24)):0;
 const dashLower=dashLoad*.3+dashDrive*.16,dashOffset=-dashLoad*.3+dashDrive*.42;
 const pin=!dead&&u.headDownFor>0?smooth((.4-u.headDownFor)/.06)*smooth(u.headDownFor/.18):0;const gesture=motionEnvelope(a);let bite=kind==='bite'?gesture.drive:0;
 if(kind==='leap'&&a.landAt!=null)bite=Math.max(0,1-(a.age-a.landAt)/.22);
 const rolling=!dead&&kind==='pounce'&&a.landAt!=null,roll=rollFrame(rolling?a:null),rollProgress=roll.progress,curl=rolling?roll.curl:kind==='pounce'&&a.landAt==null&&a.age>.25&&u.vy<=0&&u.stun<.3&&!u.counterFall?smooth((3-u.y)/2.8)*smooth(-u.vy/3+.35):0;
 const dive=flight?clamp01(-u.vy/7):0,age=flight?Math.max(0,time-flight.startedAt):0;
 const contact=flight&&kind==='leap'?dive*clamp01((1-u.y)/.8):0;
 const airBlend=flight&&u.vy<0?smooth((u.y-.02)/1):flight?1:0;
 const landed=!dead&&['leap','pounce'].includes(kind)&&a.landAt!=null,landAge=landed?Math.max(0,a.age-a.landAt):1;
 const landingDrop=landAge<.18?Math.sin(smooth(landAge/.18)*Math.PI)*.26:0;
 const pitch=rolling?roll.pitch+(a.rollImpactAt!=null?Math.sin(Math.max(0,a.age-a.rollImpactAt)*32)*Math.exp(-Math.max(0,a.age-a.rollImpactAt)*12)*.18:0):flight?(flight.kind==='pounce'?.18*Math.sin(Math.PI*smooth(age/.6)):0)+(.28*(1-dive)-.98*dive)*airBlend:-landingDrop*.3+dashLoad*.08-dashDrive*.18;
 const tailPlant=kind==='tail'&&!a.defensive?smooth((phase-.18)/.16)*(1-smooth((phase-.65)/.2)):0;
 const pose={tailPlant,flight:!!flight,rolling,curl,airBlend,landingDrop,dash,dashLoad,dashDrive,dashLower,dashOffset,pitch,tuck:flight?1-dive:0,rake:dive,bite,
  jaw:dead?.65:dash?.12*dashLoad+.22*dashDrive:flight?((.85-.35*dive+.12*Math.sin(age*24))*(1-contact*.85))*airBlend+(kind==='leap'?.85:.15)*(1-airBlend):kind==='bite'?gesture.load*.95+bite*.16:bite*.85,
  reach:dead?.3:rolling?-1.1*curl:dash?-.25*dashLoad+1.15*dashDrive:flight?(.2+dive*1.05+contact*.6)*airBlend+(kind==='leap'?1.1:.15)*(1-airBlend):kind==='bite'?bite*1.3-gesture.load*.3:bite*1.1,
  drop:pin*2.1+(dead?1.1:rolling?1.25*curl:dash?.3*dashLoad+.45*dashDrive:flight?(.05+dive*.65+contact*.35)*airBlend+(kind==='leap'?.8:.1)*(1-airBlend):kind==='bite'?bite*.72-gesture.load*.14:bite*.8),
  sag:dead?smooth((time-u.deadAt)/.9):0};return pose;
}
export class Renderer{
 constructor(canvas,battle){this.directorListener=e=>{this.director=!!e.detail;this.directorShot=null;this.directorZoomState=null;};addEventListener('ui-director',this.directorListener);this.canvas=canvas;this.ctx=canvas.getContext('2d');this.battle=battle;this.yaw=-.5;this.elev=.65;this.zoom=1;this.showHealth=false;this.follow=true;this.followId=null;this.selectedId=null;this.focusX=0;this.focusZ=0;this.groundCache=null;this.groundKey=null;this.pan=0;this.shake=0;this.shakeEnabled=true;this.drawUnits=null;this.polys=[];this.width=1;this.height=1;this.dpr=Math.min(devicePixelRatio||1,2);this.decor=[];this.setBattle(battle);this.resize();this.observer=new ResizeObserver(()=>this.resize());this.observer.observe(canvas);this.interactions();}
 dispose(){this.observer?.disconnect();if(this.directorListener)removeEventListener('ui-director',this.directorListener);}
 setBattle(b){this.rexPoseCache=new Map();this.fieldSide=1;this.fieldOffsets={1:{x:0,z:0},2:{x:0,z:0}};this.zoomAdjusted=false;this.cameraMode='overview';this.cameraViews={};this.lastFollowId=null;this.fieldAnchorId=null;this.fieldPickAt=0;this.yaw=-.5;this.elev=.65;this.follow=true;this.followZoom=1;this.fitZoom=null;this.lastCameraTime=null;this.battle=b;this.fieldOrigins={};for(const [side,team]of [[1,'rex'],[2,'dig']]){const units=b.units.filter(u=>u.team===team),edge=b.radius-5,back=units.length?(team==='rex'?Math.min(...units.map(u=>u.x))-4:Math.max(...units.map(u=>u.x))+4):(team==='rex'?-edge:edge),z=units.reduce((sum,u)=>sum+u.z,0)/(units.length||1)+(team==='rex'?-1:1)*Math.min(12,b.radius*.28);this.fieldOrigins[side]=[Math.max(-edge,Math.min(edge,back)),11+Math.min(5,b.radius*.015),Math.max(-edge,Math.min(edge,z))];}this.followId=null;this.selectedId=null;this.focusZoom=null;this.ruins=ruinSites(b);this.fires=[...fireSites(b),...outerFireSites(b)];this.focusX=0;this.focusZ=0;this.tipHistory=new Map();this.aftermathTime=0;let r=seededRandom(b.config.seed+177);this.groundCache=null;this.zoom=1;this.decor=Array.from({length:180},()=>({x:(r()-.5)*b.radius*2.5,z:(r()-.5)*b.radius*2.5,size:.2+r()*.6,angle:r()*6.28}));}
 setQuality(level){this.quality=['low','medium','high'].includes(level)?level:'high';this.groundCache=null;this.resize();}
 resize(){const cap=this.quality==='low'?1:this.quality==='medium'?1.5:2;this.dpr=Math.min(typeof devicePixelRatio==='number'?devicePixelRatio:1,cap,this.backend==='webgl2'&&this.battle.units.length>100?1.5:2);const r=this.canvas.getBoundingClientRect();if(r.width>=1&&r.height>=1){this.width=r.width;this.height=r.height;}this.canvas.width=Math.max(1,Math.round(this.width*this.dpr));this.canvas.height=Math.max(1,Math.round(this.height*this.dpr));this.ctx.setTransform(this.dpr,0,0,this.dpr,0,0);}
 minZoom(){if(this.cameraMode==='field')return .55;const b=this.battle,R=b.radius,base=Math.min(this.width/(R*2.55),this.height/(R*1.6)),extent=cityExtent(b)*.84,ca=Math.abs(Math.cos(this.yaw)),sa=Math.abs(Math.sin(this.yaw)),depth=this.height*.56/Math.max(.1,Math.sin(this.elev)),half=this.width*.5,roomX=Math.max(R,extent-Math.abs(this.focusX)),roomZ=Math.max(R,extent-Math.abs(this.focusZ));return Math.max(.48,(ca*half+sa*depth)/(base*roomX),(sa*half+ca*depth)/(base*roomZ));}
 maxZoom(){if(this.cameraMode==='field')return 4;return Math.max(2.5,this.battle.radius/10);}
 clampZoom(){if(!Number.isFinite(this.zoom))this.zoom=1;if(!Number.isFinite(this.followZoom))this.followZoom=1;if(this.fitZoom!==null&&!Number.isFinite(this.fitZoom))this.fitZoom=null;const min=this.minZoom();if(Number.isFinite(min))this.zoom=Math.max(min,this.zoom);}
 distantCanvasUnits(time){
  const c=this.ctx,scale=this.scale,units=this.drawUnits.map(u=>({u,d:this.project(u.x,u.y,u.z).d})).sort((a,b)=>a.d-b.d);
  for(const {u} of units){const dead=u.hp<=0,a=u.action,phase=actionPosePhase(a),m=u.team==='rex'?rexMotion(u,time):null,T=this.transform(u,m?.flight?m.pitch-u.pitch:m?.dash||m?.rolling?m.pitch:0,u.team==='rex'&&a?.kind==='tail'?tailTurn(phase,a.side,a.defensive):0);
   const pt=(x,y,z)=>{const v=T(x,y,z);return this.project(...v);},poly=(points,color)=>{c.fillStyle=color;c.beginPath();for(let i=0;i<points.length;i++){const p=pt(...points[i]);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}c.closePath();c.fill();},line=(a,b,color,w)=>{const p=pt(...a),q=pt(...b);c.strokeStyle=color;c.lineWidth=Math.max(.6,scale*w);c.beginPath();c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();};
   if(u.team==='rex'){
    if(u.buffCastJaw)m.jaw=Math.max(m.jaw,u.buffCastJaw);if(u.buffCastHead){m.drop-=u.buffCastHead;m.reach-=u.buffCastHead*.35;}
 const skin=dead?'#625e4e':'#737258',gait=dead?0:Math.sin(u.walk)*.7*smooth(u.speed/2),tail=a?.kind==='tail'?Math.sin(phase*Math.PI)*2:Math.sin(time*3+u.id)*.3;
    for(const side of [-1,1])line([-1,2.5,side*.6],[-.4+gait*side,m.flight?1:.1,side*1.2],'#575a43',.55);
    poly([[-1.5,2.4,-.45],[-7,2,tail],[-1.5,2.4,.45]],skin);
    poly([[-2,2,-.65],[-2,3,-.65],[1.3,3.2,-.5],[1.3,2.3,-.5]],'#5b6048');
    poly([[-2,3,-.65],[-2,3,.65],[1.3,3.2,.5],[1.3,3.2,-.5]],skin);
    line([1,2.9,0],[2.3+m.reach,3.5-m.drop,0],skin,.9);
    poly([[2+m.reach,3.9-m.drop,-.6],[4+m.reach,3.8-m.drop,-.6],[4+m.reach,3.1-m.drop,.6],[2+m.reach,3.1-m.drop,.6]],skin);
    line([2.4+m.reach,3.1-m.drop-m.jaw*.4,0],[4+m.reach,3.1-m.drop-m.jaw*.4,0],'#4a4030',.2);
    if(!dead)line([0,3.3,0],[0,4.7,0],'#46504a',.5);
   }else{
    const yellow=dead?'#504437':u.hit>.7?'#dcb56e':'#c69743',slew=a?.kind==='spin'?smooth(phase)*Math.PI*2*a.side:a?.kind==='sweep'?bucketSweep(phase,a.side):0,rot=v=>[v[0]*Math.cos(slew)-v[2]*Math.sin(slew),v[1],v[0]*Math.sin(slew)+v[2]*Math.cos(slew)],stroke=Math.sin(Math.min(1,phase/.55)*Math.PI/2);
    for(const side of [-1,1])line([-1.8,.55,side*1.2],[1.8,.55,side*1.2],'#2c332e',.95);
    poly([[-2,1.8,-1.3],[-2,1.8,1.3],[1.3,1.8,1.3],[1.3,1.8,-1.3]],yellow);
    poly([[-1.1,1.8,-1.3],[-1.1,3.5,-1.3],[.6,3.5,-1.3],[.6,1.8,-1.3]],dead?'#33352e':'#7f9a8a');
    const lift=a?.kind==='grapple'?Math.max(0,Math.min(1,(phase-.28)/.44)):0,q=[2.3,dead?2.3:a?.kind==='uppercut'?4+stroke*2:4.8+lift,.55],r=[dead?4:5.8,dead?.75:u.parry>0?3.5:a?.kind==='grapple'?2.3+lift*4.5:a?.kind==='uppercut'?1+stroke*4.5:a?.kind==='smash'?3.5-stroke*3:2.2,.55];
    line(rot([.65,2.1,.55]),rot(q),yellow,.6);line(rot(q),rot(r),yellow,.5);line(rot([r[0],r[1]-.45,-.2]),rot([r[0]+.8,r[1]-.45,1.2]),'#926a2e',1);
   }
  }
 }
 compactUnit(u,time,dead){
  const a=u.action,kind=a?.kind,phase=actionPosePhase(a),color=dead?'#625e4e':'#737258';
  if(u.team==='rex'){
   const m=rexMotion(u,time),T=this.transform(u,m.flight?m.pitch-u.pitch:m.dash||m.landingDrop||m.rolling?m.pitch:0,kind==='tail'?tailTurn(phase,a.side,a.defensive):0),gait=dead?0:Math.sin(u.walk*2)*.65*smooth(u.speed/2)*(1-m.dashDrive),sway=(kind==='tail'?Math.sin(phase*Math.PI)*2.2:Math.sin(time*3+u.id)*.3)+(u.parry>0?Math.sin(u.parry/.45*Math.PI)*u.parrySide*3:0);
   this.tube([[-2.1,2.5,0,.45,.5],[-.7,2.6,0,1,.85],[1.4,2.95,0,.5,.5]],color,T,4);
   this.tube([[-7,2,sway,.03,.03],[-3.4,2.2,sway*.3,.35,.35],[-1.6,2.6,0,.6,.6]],color,T,4);
   this.beam([1,2.9,0],[2.1+m.reach,3.65-m.drop,0],.9,.9,color,T);
   this.box(3+m.reach,3.6-m.drop,0,2,.85,1.2,color,T);this.box(3+m.reach,3.05-m.drop-m.jaw*.5,0,1.8,.25,1.05,'#514838',T);
   for(const side of [-1,1]){const knee=[-.3+gait*side,1.4+(m.flight?m.tuck*.5:0),side],foot=[-.5-gait*side+(m.flight?m.rake:0),m.flight?1.1:.18,side*1.15];this.beam([-1,2.5,side*.7],knee,.7,.65,color,T);this.beam(knee,foot,.32,.3,'#8f876c',T);}
   if(!dead){this.box(0,3.95,0,.55,.85,.55,'#46504a',T);this.box(.05,4.55,0,.42,.4,.42,'#b6b5a0',T);}
  }else{
   const T=this.transform(u),stroke=Math.sin(Math.min(1,phase/.55)*Math.PI/2),slew=dead?u.deathSide*.35:u.parry>0?Math.sin(u.parry/.45*Math.PI)*u.parrySide*.65:kind==='spin'?Math.PI*2*(phase*phase*(3-2*phase))*a.side:kind==='sweep'?bucketSweep(phase,a.side):0,U=(x,y,z)=>T(x*Math.cos(slew)-z*Math.sin(slew),y,x*Math.sin(slew)+z*Math.cos(slew));this.affine(U,T,{yaw:slew});
   const yellow=dead?'#504437':u.hit>.7?'#dcb56e':'#c69743';for(const side of [-1,1])this.box(0,.6,side*1.25,4,1,.85,'#2c332e',T);
   this.box(-.3,1.6,0,3.6,.8,2.6,yellow,U);this.box(-.3,2.65,-.65,1.7,1.8,1.3,dead?'#33352e':'#7f9a8a',U);this.box(-.3,3.65,-.65,1.9,.2,1.5,yellow,U);
   const lift=kind==='grapple'?Math.max(0,Math.min(1,(phase-.28)/.44)):0,q=dead?[2,2.3,.55]:[2.3,kind==='uppercut'?4+stroke*2:4.8+lift,.55],r=dead?[4,.75,.55]:u.parry>0?[3.7,3.3,.55]:kind==='grapple'?[4.7-lift*1.4,2.3+lift*4.5,.55]:kind==='uppercut'?[5.3-stroke,1+stroke*4.5,.55]:[5.8,kind==='smash'?3.5-stroke*3:2.2,.55];
   this.beam([.65,2.1,.55],q,.57,.58,yellow,U);this.beam(q,r,.44,.48,yellow,U);this.box(r[0]+.25,r[1]-.4,.55,1.3,1.1,1.55,dead?'#352f28':'#926a2e',U,-.4);
   if(!dead)this.box(-.1,3,-1.36,.35,.5,.08,'#d6b691',U);
  }
 }
 setCameraMode(mode){
  if(!['overview','field'].includes(mode)||this.cameraMode===mode)return;
  this.cameraViews??={};this.cameraViews[this.cameraMode==='field'?'field'+(this.fieldSide||1):'overview']={yaw:this.yaw,elev:this.elev,zoom:this.zoom,focusX:this.focusX,focusZ:this.focusZ,followZoom:this.followZoom};
  const next=this.cameraViews[mode==='field'?'field'+(this.fieldSide||1):mode]||(mode==='field'?{yaw:(this.fieldSide||1)===1?.8+Math.PI:.8,elev:.48,zoom:1,followZoom:1}:{yaw:-.5,elev:.65,zoom:1,followZoom:1});
  this.cameraMode=mode;this.yaw=next.yaw;this.elev=next.elev;this.zoom=next.zoom;this.followZoom=next.followZoom||1;
  if(!this.follow&&next.focusX!==undefined){this.focusX=next.focusX;this.focusZ=next.focusZ;}
  this.focusZoom=null;this.groundCache=null;this.lastCameraTime=null;this.fieldProjection=null;
 }
 selectFieldCamera(){
  if(this.cameraMode!=='field'){this.setCameraMode('field');return;}
  this.cameraViews??={};this.cameraViews['field'+(this.fieldSide||1)]={yaw:this.yaw,elev:this.elev,zoom:this.zoom,focusX:this.focusX,focusZ:this.focusZ,followZoom:this.followZoom};
  this.fieldSide=(this.fieldSide||1)===1?2:1;const next=this.cameraViews['field'+this.fieldSide]||{yaw:this.fieldSide===1?.8+Math.PI:.8,elev:.48,zoom:1};
  this.yaw=next.yaw;this.elev=next.elev;this.zoom=next.zoom;this.followZoom=next.followZoom||1;if(!this.follow&&next.focusX!==undefined){this.focusX=next.focusX;this.focusZ=next.focusZ;}this.fieldProjection=null;this.focusZoom=null;this.groundCache=null;
 }
 captureCamera(){const saved={};for(const key of ['cameraMode','fieldSide','fieldOffsets','cameraViews','yaw','elev','zoom','zoomAdjusted','follow','followId','lastFollowId','selectedId','focusX','focusZ','focusZoom','followZoom','fitZoom'])saved[key]=this[key];for(const key of ['followId','lastFollowId','selectedId']){const unit=this.battle.units[this[key]];saved[key+'Ref']=unit?{team:unit.team,index:this.battle.units.filter(u=>u.team===unit.team).indexOf(unit)}:null;}return saved;}
 restoreCamera(saved){if(!saved)return;for(const key of ['cameraMode','fieldSide','cameraViews','yaw','elev','zoom','zoomAdjusted','follow','focusX','focusZ','focusZoom','followZoom','fitZoom'])this[key]=saved[key];for(const key of ['followId','lastFollowId','selectedId']){const ref=saved[key+'Ref'];this[key]=ref?this.battle.units.filter(u=>u.team===ref.team)[ref.index]?.id??null:null;}
  if(this.zoomAdjusted&&this.follow&&this.followId===null&&this.cameraMode==='overview'){
   const units=this.battle.units.filter(u=>u.hp>0);if(units.length){let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const u of units){minX=Math.min(minX,u.x);maxX=Math.max(maxX,u.x);minZ=Math.min(minZ,u.z);maxZ=Math.max(maxZ,u.z);}const ca=Math.abs(Math.cos(this.yaw)),sa=Math.abs(Math.sin(this.yaw)),spanX=(maxX-minX)*ca+(maxZ-minZ)*sa+18,spanZ=((maxX-minX)*sa+(maxZ-minZ)*ca)*Math.sin(this.elev)+18,base=Math.min(this.width/(this.battle.radius*2.55),this.height/(this.battle.radius*1.6));this.fitZoom=Math.max(.85,Math.min(2.15,Math.min(this.width*.85/spanX,this.height*.72/spanZ)/base));this.followZoom=this.zoom/this.fitZoom;}
  }this.groundCache=null;this.fieldProjection=null;this.lastCameraTime=null;
 }
 stopFollowing(){if(this.followId!==null&&this.battle.units[this.followId])this.lastFollowId=this.followId;this.follow=false;}
 toggleFollow(){if(this.follow){this.stopFollowing();return;}this.follow=true;this.followId=this.battle.units[this.lastFollowId]?this.lastFollowId:null;this.focusZoom=null;this.lastCameraTime=null;}
 fieldView(){const key=[this.width,this.height,this.fieldSide,this.fieldOffsets?.[this.fieldSide]?.x,this.fieldOffsets?.[this.fieldSide]?.z,this.yaw,this.elev,this.zoom,this.focusX,this.focusZ,this.battle.radius].join(',');if(this.fieldProjection?.key!==key)this.fieldProjection={key,...fieldView(this)};return this.fieldProjection;}
 updateScale(){this.scale=this.cameraMode==='field'?this.fieldView().focal/this.fieldView().distance:Math.min(this.width/(this.battle.radius*2.55),this.height/(this.battle.radius*1.6))*this.zoom;}
 followField(){
  let anchor=this.battle.units[this.fieldAnchorId];const time=this.battle.time;
  if(!anchor||anchor.hp<=0||time>=(this.fieldPickAt||0)){
   let best=Infinity;for(const u of this.battle.units){if(u.hp<=0)continue;const target=this.battle.units[u.action?.target??u.target],distance=target?.hp>0?Math.hypot(u.x-target.x,u.z-target.z):Math.hypot(u.x-this.focusX,u.z-this.focusZ)+20,score=distance+(u.action?-18:0)+(u.id===this.fieldAnchorId?-5:0);if(score<best){best=score;anchor=u;}}
   this.fieldAnchorId=anchor?.id;this.fieldPickAt=time+3;
  }
  if(!anchor)return;const opponent=this.battle.units[anchor.action?.target??anchor.target],close=opponent?.hp>0&&Math.hypot(anchor.x-opponent.x,anchor.z-opponent.z)<30;
  const x=close?(anchor.x+opponent.x)/2:anchor.x,z=close?(anchor.z+opponent.z)/2:anchor.z;
  this.focusX+=(x-this.focusX)*.12;this.focusZ+=(z-this.focusZ)*.12;
 }
 enableArmyFollow(){this.follow=true;this.followId=null;this.focusZoom=null;this.followZoom=1;this.lastCameraTime=null;}
 changeZoom(value){this.zoomAdjusted=true;const previous=this.zoom;this.zoom=Math.max(this.minZoom(),Math.min(this.maxZoom(),value));if(this.cameraMode!=='field'&&this.follow&&this.followId===null)this.followZoom=Math.max(.3,Math.min(6,(this.followZoom||1)*this.zoom/previous));}
 cycleView(){this.yaw+=Math.PI/2;this.elev=Math.max(.6,this.elev);this.lastCameraTime=null;this.groundCache=null;}
 restoreView(){this.yaw=-.5;this.elev=.65;this.lastCameraTime=null;this.groundCache=null;}
 resetCamera(){this.focusZoom=null;this.followId=null;this.yaw=-.5;this.focusX=0;this.focusZ=0;this.follow=true;this.zoom=this.battle.config.rex+this.battle.config.dig<=4?2.2:1.1;this.elev=.65;}
 panBy(dx,dy){
  if(this.cameraMode==='field'){const view=this.fieldView(),from=fieldGround(view,this.width*.5,this.height*.56),to=fieldGround(view,this.width*.5-dx,this.height*.56-dy);if(from&&to){const edge=this.battle.radius-5;const dx=to.x-from.x,dz=to.z-from.z;this.focusX=Math.max(-edge,Math.min(edge,this.focusX+dx));this.focusZ=Math.max(-edge,Math.min(edge,this.focusZ+dz));this.fieldOffsets??={};const offset=this.fieldOffsets[this.fieldSide||1]??={x:0,z:0};offset.x+=dx;offset.z+=dz;}if(!this.followPeek)this.stopFollowing();this.focusZoom=null;return;}const scale=this.scale||Math.min(this.width/(this.battle.radius*2.55),this.height/(this.battle.radius*1.6))*this.zoom,ca=Math.cos(this.yaw),sa=Math.sin(this.yaw),groundY=dy/Math.max(.15,Math.sin(this.elev));
  this.focusX-=(dx*ca+groundY*sa)/scale;this.focusZ-=(-dx*sa+groundY*ca)/scale;
  const edge=this.battle.radius*3;this.focusX=Math.max(-edge,Math.min(edge,this.focusX));this.focusZ=Math.max(-edge,Math.min(edge,this.focusZ));if(!this.followPeek)this.follow=false;
 }
 focusClick(x,y){

  let selected=null,best=Infinity;const threshold=Math.max(12,Math.min(30,this.scale*3));
  for(const u of this.battle.units){const p=this.project(u.x,u.y+(u.hp>0?2:.6),u.z),d=Math.hypot(x-p.x,y-p.y);if(d<threshold&&d<best){selected=u;best=d;}}
  const base=Math.min(this.width/(this.battle.radius*2.55),this.height/(this.battle.radius*1.6));
  if(selected){this.selectedId=selected.id;this.lastFollowId=selected.id;if(!this.follow){this.followId=selected.id;return;}this.focusZoom=null;this.followId=selected.id;this.lastFollowId=selected.id;this.follow=true;this.focusX=selected.x;this.focusZ=selected.z;this.zoom=this.cameraMode==='field'?Math.max(1.15,this.zoom):Math.min(this.maxZoom(),Math.max(this.zoom,2.8,this.width*.18/(base*12)));}
  else{if(this.cameraMode==='field'){const p=fieldGround(this.fieldView(),x,y);if(p){const edge=this.battle.radius-5;this.focusX=Math.max(-edge,Math.min(edge,p.x));this.focusZ=Math.max(-edge,Math.min(edge,p.z));}this.stopFollowing();this.followId=null;this.zoom=Math.min(this.maxZoom(),this.zoom*1.3);return;}const horizontal=(x-this.width/2)/this.scale,depth=(y-this.height*.56)/(this.scale*Math.max(.12,Math.sin(this.elev))),ca=Math.cos(this.yaw),sa=Math.sin(this.yaw);this.focusX+=horizontal*ca+depth*sa;this.focusZ+=-horizontal*sa+depth*ca;const edge=this.battle.radius*3;this.focusX=Math.max(-edge,Math.min(edge,this.focusX));this.focusZ=Math.max(-edge,Math.min(edge,this.focusZ));this.followId=null;this.follow=false;this.zoom=Math.min(this.maxZoom(),Math.max(this.zoom*1.6,this.width*.15/(base*30)));}
 }
 pickUnit(x,y){let selected=null,best=Infinity;const threshold=Math.max(12,Math.min(30,this.scale*3));for(const u of this.battle.units){const p=this.project(u.x,u.y+(u.hp>0?2:.6),u.z),d=Math.hypot(x-p.x,y-p.y);if(d<threshold&&d<best){selected=u;best=d;}}return selected;}
 selectClick(x,y){const selected=this.pickUnit(x,y);if(selected){this.focusClick(x,y);}else if(this.selectedId!==null){this.selectedId=null;this.followId=null;this.lastFollowId=null;if(this.follow)this.enableArmyFollow();}return selected;}
 toggleFocusZoom(x,y){if(this.pickUnit(x,y)){this.focusClick(x,y);return;}if(this.focusZoom){const old=this.focusZoom;this.focusZoom=null;this.zoom=old.zoom;this.focusX=old.focusX;this.focusZ=old.focusZ;this.follow=false;this.followId=null;return;}this.focusZoom={zoom:this.zoom,focusX:this.focusX,focusZ:this.focusZ,follow:this.follow,followId:this.followId};this.focusClick(x,y);}
 interactions(){const c=this.canvas,pointers=new Map();let pinch=null,lastTap=null;
 const pair=()=>{const [a,b]=[...pointers.values()];return{x:(a.x+b.x)/2,y:(a.y+b.y)/2,dist:Math.hypot(a.x-b.x,a.y-b.y)};};
 const rotate=(dx,dy)=>{this.yaw+=dx*.006;this.elev=Math.max(this.cameraMode==='field'?.38:.12,Math.min(this.cameraMode==='field'?1.2:1.48,this.elev+dy*.003));this.zoom=Math.max(this.minZoom(),this.zoom);};
 c.addEventListener('pointerdown',e=>{e.preventDefault();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,multi:false,rotate:e.pointerType!=='touch'&&(e.shiftKey||e.button===1),touch:e.pointerType==='touch',button:e.button});c.setPointerCapture(e.pointerId);if(pointers.size===2){for(const p of pointers.values())p.multi=true;pinch=pair();}});
 c.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId))return;const prev=pointers.get(e.pointerId),moved=prev.moved||Math.hypot(e.clientX-prev.startX,e.clientY-prev.startY)>(prev.touch?16:10);pointers.set(e.pointerId,{...prev,x:e.clientX,y:e.clientY,moved});
  if(pointers.size===1&&moved){lastTap=null;const dx=e.clientX-prev.x,dy=e.clientY-prev.y;if(prev.rotate||!prev.touch&&e.shiftKey)rotate(dx,dy);else if(this.follow){this.followPeek=true;this.followHoldUntil=performance.now()+120;this.panBy(dx,dy);this.followPeek=false;}else{this.followId=null;this.panBy(dx,dy);}}
  else if(pointers.size===2){lastTap=null;const now=pair();if(pinch){rotate(now.x-pinch.x,now.y-pinch.y);if(pinch.dist>0)this.changeZoom(this.zoom*Math.pow(now.dist/pinch.dist,1.4));}pinch=now;}
 });
 c.addEventListener('pointerup',e=>{const p=pointers.get(e.pointerId);if(p&&!p.moved&&!p.multi&&!p.rotate&&(p.touch||p.button===0)){const rect=c.getBoundingClientRect();const x=e.clientX-rect.left,y=e.clientY-rect.top,now=performance.now();if(lastTap&&now-lastTap.time<360&&Math.hypot(x-lastTap.x,y-lastTap.y)<24){this.toggleFocusZoom(x,y);lastTap=null;}else{this.selectClick(x,y);lastTap={x,y,time:now};}}pointers.delete(e.pointerId);pinch=null;});
 for(const event of ['pointercancel','lostpointercapture'])c.addEventListener(event,e=>{pointers.delete(e.pointerId);pinch=null;});
 c.addEventListener('contextmenu',e=>e.preventDefault());c.addEventListener('wheel',e=>{e.preventDefault();this.changeZoom(this.zoom*Math.exp(-e.deltaY*.0018));},{passive:false});}

 project(x,y,z){if(this.cameraMode==='field'){const p=projectField(this.fieldView(),x,y,z);if(!p.visible){p.x=-100000;p.y=-100000;}return p;}x-=this.focusX;z-=this.focusZ;let c=this.projection;if(!c||c.yaw!==this.yaw||c.elev!==this.elev)c=this.projection={yaw:this.yaw,elev:this.elev,ca:Math.cos(this.yaw),sa:Math.sin(this.yaw),se:Math.sin(this.elev),ce:Math.cos(this.elev)};const depth=x*c.sa+z*c.ca;return{x:this.width/2+(x*c.ca-z*c.sa)*this.scale,y:this.height*.56+(depth*c.se-y*c.ce)*this.scale,d:depth*c.ce+y*c.se};}
 poly(points,color,edge=false,cull=false){if(this.cameraMode==='field'){points=clipFieldPolygon(points,this.fieldView());if(points.length<3)return;}const p=points.map(v=>this.project(...v));if(cull){let area=0;for(let i=0;i<p.length;i++){const j=(i+1)%p.length;area+=p[i].x*p[j].y-p[j].x*p[i].y;}if(area<=0)return;}this.polys.push({p,color,city:!!this.cityGeometry&&points.some(v=>v[1]>.4),d:p.reduce((s,v)=>s+v.d,0)/p.length,edge});}
 box(x,y,z,w,h,d,color,transform=null,rz=0){let pts=[[-w/2,-h/2,-d/2],[w/2,-h/2,-d/2],[w/2,h/2,-d/2],[-w/2,h/2,-d/2],[-w/2,-h/2,d/2],[w/2,-h/2,d/2],[w/2,h/2,d/2],[-w/2,h/2,d/2]].map(([a,b,c])=>{let ax=a*Math.cos(rz)-b*Math.sin(rz)+x,by=a*Math.sin(rz)+b*Math.cos(rz)+y;return transform?transform(ax,by,c+z):[ax,by,c+z];});for(let i=0;i<6;i++)this.poly(FACES[i].map(j=>pts[j]),tone(color,SHADE[i]),false,true);}
 beam(a,b,width,depth,color,T){const dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);this.box((a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2,len,width,depth,color,T,Math.atan2(dy,dx));}
 tube(rings,color,T,sides=7){if(this.detail===0)sides=Math.min(sides,4);for(let i=0;i<rings.length-1;i++){const a=rings[i],b=rings[i+1];for(let j=0;j<sides;j++){const p=j/sides*Math.PI*2,q=(j+1)/sides*Math.PI*2;const point=(r,t)=>T(r[0],r[1]+Math.cos(t)*r[3],r[2]+Math.sin(t)*r[4]);const shade=.78+.28*Math.cos((p+q)/2)+.12*Math.sin((p+q)/2);this.poly([point(a,p),point(b,p),point(b,q),point(a,q)],tone(color,Math.round(shade*20)/20),false,true);}}}
 oval(x,y,z,rx,ry,rz,color,T){const rings=[],n=this.detail===0?2:this.battle.units.length>70?3:4;for(let i=0;i<=n;i++){const t=i/n*Math.PI;rings.push([x-Math.cos(t)*rx,y,z,Math.max(.01,Math.sin(t)*ry),Math.max(.01,Math.sin(t)*rz)]);}this.tube(rings,color,T,this.detail===0?4:6);}
 limb(a,b,ra,rb,color,T){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz),ux=dx/len,uy=dy/len,uz=dz/len;let v=[-uy,ux,0],vl=Math.hypot(...v);if(vl<.01){v=[0,1,0];vl=1;}v=v.map(n=>n/vl);const w=[uy*v[2]-uz*v[1],uz*v[0]-ux*v[2],ux*v[1]-uy*v[0]],sides=this.detail===0?4:6;for(let i=0;i<sides;i++){const p=i/sides*Math.PI*2,q=(i+1)/sides*Math.PI*2,pt=(c,r,t)=>T(c[0]+r*(v[0]*Math.cos(t)+w[0]*Math.sin(t)),c[1]+r*(v[1]*Math.cos(t)+w[1]*Math.sin(t)),c[2]+r*(v[2]*Math.cos(t)+w[2]*Math.sin(t)));this.poly([pt(a,ra,p),pt(b,rb,p),pt(b,rb,q),pt(a,ra,q)],tone(color,.77+.07*i),false,true);}}
 pose(u,alpha){const mix=(a,b)=>a+(b-a)*alpha;const d=Math.atan2(Math.sin(u.yaw-u.prevYaw),Math.cos(u.yaw-u.prevYaw));return {...u,...interpolateMotion(u,alpha),hit:mix(u.prevHit??u.hit,u.hit),speed:mix(u.prevSpeed??u.speed,u.speed),parry:mix(u.prevParry??u.parry,u.parry),headDownFor:mix(u.prevHeadDown??0,u.headDownFor||0),armPose:u.armPose?{...u.armPose,x:mix(u.prevArmX??u.armPose.x,u.armPose.x),y:mix(u.prevArmY??u.armPose.y,u.armPose.y),slew:mix(u.prevArmSlew??u.armPose.slew,u.armPose.slew)}:null,x:mix(u.px,u.x),z:mix(u.pz,u.z),y:mix(u.py,u.y),yaw:u.prevYaw+d*alpha,roll:mix(u.prevRoll,u.roll),pitch:mix(u.prevPitch,u.pitch)};}
 affine(fn){return fn;}
 transform(u,extraPitch=0,extraYaw=0){u=visualBody(u);const scale=u.scale||1,pivot=u.team==='rex'?(u.action?.kind==='pounce'&&u.action.landAt!=null?2.2:1.4):1.1,pitch=u.pitch+extraPitch,roll=u.roll,cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll),ca=Math.cos(u.yaw+extraYaw),sa=Math.sin(u.yaw+extraYaw),lift=Math.abs(sr)*.55+(u.team==='rex'&&u.action?.kind==='pounce'&&u.action.landAt!=null?rollFrame(u.action).lift:Math.abs(sp)*.4);return(x,y,z)=>{x*=scale;y*=scale;z*=scale;const yy=y-pivot,px=x*cp-yy*sp,py=x*sp+yy*cp,ry=py*cr-z*sr,rz=py*sr+z*cr;return[u.x+px*ca-rz*sa,Math.max(.025,u.y+ry+pivot+lift),u.z+px*sa+rz*ca];};}

 blendedRexMotion(u,time){
  const target=rexMotion(u,time),key=u.action?u.action.kind+Math.round((time-u.action.age)*1000)+(target.rolling?':roll':target.flight?':air':':ground'):'idle',cache=this.rexPoseCache??=new Map();let item=cache.get(u.id);
  if(!item){cache.set(u.id,{key,pose:target,from:target,since:time});return target;}
  if(item.key!==key){item.key=key;item.from=item.pose.rolling&&!target.rolling?{...item.pose,pitch:Math.atan2(Math.sin(item.pose.pitch),Math.cos(item.pose.pitch))}:item.pose;item.since=time;}
  const t=smooth((time-item.since)/.12),pose={...target};for(const name of Object.keys(target))if(typeof target[name]==='number')pose[name]=(item.from[name]??target[name])+(target[name]-(item.from[name]??target[name]))*t;item.pose=pose;return pose;
 }
 rex(u,time,dead){if(u.buffActive)this.buffAura(u,time);u=buffCastPose(u,time);if(this.compact)return this.compactUnit(u,time,dead);const a=u.action,phase=actionPosePhase(a),kind=a?.kind,m={...this.blendedRexMotion(u,time)},moveBlend=smooth(u.speed/2),bounce=dead?0:m.flight||m.dash||m.rolling?0:Math.sin(u.walk*1.1)*(a?.evasion?.03:.13)*moveBlend+Math.sin(time*2+u.id)*.025*(1-moveBlend),bite=m.bite,step=Math.sin(u.walk*.55)*moveBlend,spin=kind==='tail'?tailTurn(phase,a.side,a.defensive):0,posed=m.flight?{...u,roll:u.roll+(Math.sin((time-u.aerialAttack.startedAt)*7)*.12-u.roll)*m.airBlend}:u,base=this.transform(posed,m.flight?m.pitch-u.pitch:m.dash||m.landingDrop||m.rolling?m.pitch:0,spin),T=(x,y,z)=>{const p=base(x*(1+.035*m.dashDrive)*(1-.08*m.curl)+m.dashOffset,y*(1-.04*m.curl)+.088*m.curl+bounce-m.dashLower-m.landingDrop,z);if(dead)p[1]=Math.max(.025,p[1]-m.sag*.8*clamp01(1-u.y));return p;};
 this.affine(T,base,{sx:(1+.035*m.dashDrive)*(1-.08*m.curl),sy:1-.04*m.curl,tx:m.dashOffset,ty:.088*m.curl+bounce-m.dashLower-m.landingDrop,worldY:dead?-m.sag*.8*clamp01(1-u.y):0});

 const skin=dead?'#625e4e':u.id%3===0?'#756f52':u.id%3===1?'#79715c':'#6c7057',dark=dead?'#514c40':'#575a43',belly=dead?'#7b7360':'#a19877';
 // A tapered torso, muscular hips and articulated tail replace block geometry.
 this.tube([[-2.3,2.5,0,.15,.13],[-1.6,2.65,0,.7,.77],[-.4,2.6,0,1.04,.91],[.8,2.8,0,.8,.71],[1.45,3,0,.45,.5]],skin,T,8);
 this.oval(.15,2.23,0,1.3,.52,.7,belly,T);
 const tailGuard=!dead?Math.sin(clamp01(u.parry/.45)*Math.PI)*u.parrySide*(kind==='tail'?1:3.8):0;
 const sway=dead?u.deathSide*.6:tailGuard+(a?.evasion?-(a.evadeSide||1)*Math.sin(phase*Math.PI)*.8:0)+Math.sin(time*3+u.id)*(.35+u.speed*.045)*(1-.8*m.dashDrive)+(kind==='tail'?Math.sin(phase*Math.PI)*1.4:0);
 if(!dead&&(u.parry>0||kind==='tail'&&phase>.2&&phase<.8)){const tip=T(-5.6,1.95,sway*.8);this.motionTips.push({id:u.id,x:tip[0],y:tip[1],z:tip[2],team:'rex',power:1});}
 const tailPoints=[[-7.2,2.13,sway,.025,.025],[-5.6,1.95,sway*.8,.15,.18],[-4,2.05,sway*.4,.3,.34],[-2.8,2.42,0,.53,.57],[-1.65,2.65,0,.65,.7]],wrapped=[[-.25,1.75,1.35],[-1.8,1.35,1.2],[-2.8,2.1,.55]];if(m.curl>0)for(let i=0;i<3;i++)for(let j=0;j<3;j++)tailPoints[i][j]+=(wrapped[i][j]-tailPoints[i][j])*m.curl;this.tube(tailPoints,skin,T,7);
 this.tube([[.8,2.9,0,.6,.6],[1.65+m.reach*.5,3.35-m.drop*.45,0,.7,.55],[2.05+m.reach,3.75-m.drop,0,.5,.45]],skin,T,7);
 const headAngle=-1.15*m.curl,hc=Math.cos(headAngle),hs=Math.sin(headAngle),head=(x,y,z)=>T(1.8+(x-1.8)*hc-(y-3.7)*hs+m.reach,3.7+(x-1.8)*hs+(y-3.7)*hc-m.drop,z+(dead?u.deathSide*.18:0));this.affine(head,T,{rz:headAngle,tx:1.8-1.8*hc+3.7*hs+m.reach,ty:3.7-1.8*hs-3.7*hc-m.drop,tz:dead?u.deathSide*.18:0});
 this.tube([[1.8,3.7,0,.43,.43],[2.25,3.9,0,.62,.66],[3.3,3.72,0,.5,.72],[4.05,3.65,0,.27,.51]],skin,head,6);
 // Dark mouth cavity, lower jaw and individual teeth.
 this.box(3.15,3.18-m.jaw*.6,0,1.9,.25+m.jaw*.38,.99,'#30251f',head,-m.jaw*.18);
 this.tube([[2.15,3.16-m.jaw*.2,0,.17,.44],[3.2,3.12-m.jaw*.7,0,.18,.59],[4.02,3.23-m.jaw*.95,0,.1,.43]],belly,head,6);
 for(const side of [-1,1]){
 this.oval(2.52,4.12,.62*side,.25,.14,.055,'#464638',head);if(dead){this.box(2.59,4.08,.67*side,.24,.035,.04,'#292c24',head);}else{this.box(2.59,4.1,.67*side,.14,.1,.03,'#d1ad63',head);this.box(2.62,4.1,.69*side,.045,.09,.02,'#151b15',head);}this.oval(3.79,3.86,.46*side,.09,.06,.03,'#34372e',head);
 if(this.detail!==0&&this.scale>5){for(let k=0;k<5;k++)this.poly([head(2.8+k*.22,3.32,.54*side),head(2.9+k*.22,3.32,.54*side),head(2.85+k*.22,3.05,.54*side)],'#d4c9aa');}
 const gait=dead?0:u.y>.7?side*.72:(step*.8*(1-m.dashDrive)+1.3*m.dashDrive)*side,hip=[-1.05,2.48,side*.76],knee=dead?[.2,1.55,side*1.35]:m.flight?[.35+m.tuck*.8,1.65+m.tuck*.35,side*1.15]:[-.1+gait,1.48,side*1.06],ankle=dead?[-.9,.65,side*1.6]:m.flight?[-.6+m.rake*1.7,1.2+m.tuck*.8,side*1.25]:[-.65-gait,.42+m.dashLower+m.landingDrop,side*1.14];if(m.flight){const groundKnee=[-.1+gait,1.48,side*1.06],groundAnkle=[-.65-gait,.42+m.landingDrop,side*1.14];for(let j=0;j<3;j++){knee[j]=groundKnee[j]+(knee[j]-groundKnee[j])*m.airBlend;ankle[j]=groundAnkle[j]+(ankle[j]-groundAnkle[j])*m.airBlend;}}if(m.tailPlant>0&&side===(a?.side??u.side??1)){const ca=Math.cos(spin),sa=Math.sin(spin),x=-.65,z=side*1.14;ankle[0]+=(x*ca+z*sa-ankle[0])*m.tailPlant;ankle[2]+=(-x*sa+z*ca-ankle[2])*m.tailPlant;knee[1]-=.15*m.tailPlant;}if(m.curl>0){for(let j=0;j<3;j++){knee[j]+=([.25,2.05,side*.9][j]-knee[j])*m.curl;ankle[j]+=([-.65,1.85,side*.95][j]-ankle[j])*m.curl;}}this.oval(-.9,2,side*.8,.68,.98,.53,skin,T);this.limb(hip,knee,.48,.3,skin,T);this.limb(knee,ankle,.27,.14,belly,T);this.oval(...ankle,.2,.23,.2,dark,T);
 for(let k=-1;k<=1;k++){if(this.detail===0&&k!==0)continue;const toe=dead?[-.2,.4,side*1.65+k*.22]:m.flight?[ankle[0]+.95,ankle[1]-.28,side*1.25+k*.22]:[.4-gait,.1+m.dashLower+m.landingDrop,side*1.14+k*.22];if(m.flight){const ground=[.4-gait,.1,side*1.14+k*.22];for(let j=0;j<3;j++)toe[j]=ground[j]+(toe[j]-ground[j])*m.airBlend;}if(m.tailPlant>0&&side===(a?.side??u.side??1)){const ca=Math.cos(spin),sa=Math.sin(spin),x=.4,z=side*1.14+k*.22;toe[0]+=(x*ca+z*sa-toe[0])*m.tailPlant;toe[2]+=(-x*sa+z*ca-toe[2])*m.tailPlant;}if(m.curl>0)for(let j=0;j<3;j++)toe[j]+=([ankle[0]+.65,ankle[1]-.12,side*.95+k*.18][j]-toe[j])*m.curl;this.limb(ankle,toe,.09,.065,dark,T);this.beam(toe,[toe[0]+.25,toe[1]-.08,toe[2]],.06,.07,'#2d3028',T);}
 const elbow=[1.6+(m.flight?.35:0)-m.dashDrive*.2,2.37+(m.flight?.25:0)+m.dashDrive*.12,side*.76],claw=[2.03+(m.flight?.65:0)-m.dashDrive*.35,2.43+m.dashDrive*.2-(m.rake*.4)-(dead?.4:0),side*.8];if(m.curl>0)for(let j=0;j<3;j++){elbow[j]+=([.7,2.3,side*.65][j]-elbow[j])*m.curl;claw[j]+=([.25,2.15,side*.65][j]-claw[j])*m.curl;}this.limb([1.1,2.78,side*.61],elbow,.13,.095,skin,T);this.limb(elbow,claw,.08,.055,belly,T);
 // Skin markings on the flank, without large flat toy-like panels.
 if(this.detail!==0)for(let k=0;k<4;k++)this.oval(-1.1+k*.55,2.85,side*(.79-k*.035),.12,.2,.035,dark,T);
 }
 if(!dead){const rider=(x,y,z)=>T(x+.35*m.curl*(y-3.7),3.7+(y-3.7)*(1-.6*m.curl),z);this.affine(rider,T,{shearXY:.35*m.curl,sy:1-.6*m.curl,tx:-1.295*m.curl,ty:2.22*m.curl});this.box(-.1,3.7,0,1.1,.16,1.5,'#443c30',rider);this.box(-.1,4.1,0,.45,.7,.52,'#46504a',rider);this.oval(.02,4.64,0,.22,.25,.22,'#b39b7e',rider);this.oval(.02,4.81,0,.29,.16,.28,'#b6b5a0',rider);for(const side of [-1,1]){this.limb([-.2,3.95,side*.3],[.2,3.45,side*.78],.13,.11,'#343b35',rider);this.limb([.1,4.3,side*.2],[.65,4.03,side*.32],.085,.07,'#a18e75',rider);this.beam([.65,4.03,side*.32],[2,3.49,side*.61],.035,.035,'#4b3d2b',rider);}}
 }
 digger(u,time,dead){if(u.buffActive)this.buffAura(u,time);u=buffCastPose(u,time);if(this.compact)return this.compactUnit(u,time,dead);const action=u.action,phase=action?clamp01(action.age/action.duration):0,kind=action?.kind,a=u.attack,base=this.transform(u),T=(x,y,z)=>{const p=base(x,y+(!dead&&u.moving?Math.sin(u.walk*4)*.055:0),z);if(dead)p[1]=Math.max(.025,p[1]-.4*clamp01(1-u.y));return p;},strikeAt=kind==='uppercut'?.52:.48,wind=phase<.3?smooth(phase/.3):1-smooth((phase-.3)/.3),stroke=phase<.3?0:phase<strikeAt?Math.sin((phase-.3)/(strikeAt-.3)*Math.PI/2):Math.cos(Math.min(1,(phase-strikeAt)/(1-strikeAt))*Math.PI/2),slew=bucketPose(u,phase).slew;

 this.affine(T,base,{ty:!dead&&u.moving?Math.sin(u.walk*4)*.055:0,worldY:dead?-.4*clamp01(1-u.y):0});
 const U=(x,y,z)=>T(x*Math.cos(slew)-z*Math.sin(slew),y,x*Math.sin(slew)+z*Math.cos(slew));const yellow=dead?'#504437':u.hit>.7?'#dcb56e':'#c69743',dark=dead?'#352f28':'#926a2e';this.affine(U,T,{yaw:slew});
 for(const side of [-1,1]){this.box(0,.55,side*1.23,4,.9,.8,'#2c332e',T);this.box(0,.72,side*1.65,3.25,.38,.06,'#586050',T);for(let j=0;j<(this.detail===0?3:5);j++)this.oval(-1.4+j*(this.detail===0?1.4:.7),.51,side*1.66,.31,.32,.06,'#52534b',T);if(this.detail!==0&&this.scale>6)for(let j=0;j<11;j++)this.box(-1.8+j*.35+(u.moving?(u.walk*.13)%.35:0),.98,side*1.23,.07,.05,.86,'#737166',T);}
 this.box(0,1.1,0,3.3,.5,2.3,dark,T);this.box(-.3,1.65,0,3.6,.65,2.6,yellow,U);this.box(-1.25,2.2,0,1.1,.55,2.5,yellow,U);this.box(-1.25,2.53,0,.8,.1,1.7,'#3d493e',U);for(let j=0;j<5;j++)this.box(-1.58+j*.15,2.59,0,.05,.035,1.6,'#232a25',U);this.box(-1.65,2.9,.83,.14,.85,.14,'#313932',U);
 const C=dead?(x,y,z)=>U(x+.25*(y-2),y-.3,z+.18*(y-2)):U;if(dead)this.affine(C,U,{shearXY:.25,shearZY:.18,tx:-.5,ty:-.3,tz:-.36});
 this.box(-.25,2.7,-.7,1.7,1.8,1.25,dead?'#33352e':'#465750',C);this.box(-.25,3.65,-.7,1.9,.2,1.5,yellow,C);this.box(.6,2.85,-.7,.08,1.24,1.04,dead?'#252a25':'#91a99a',U);this.box(-.25,2.85,-1.34,1.3,1.22,.05,dead?'#292c26':'#7f9a8a',C);this.box(-.85,2.85,-1.38,.1,1.4,.1,yellow,U);this.box(.38,2.85,-1.38,.1,1.4,.1,yellow,U);
 if(!dead){this.box(-.1,2.7,-1.4,.4,.62,.08,'#344d4a',U);this.box(-.04,3.16,-1.42,.32,.3,.07,'#d6b691',U);this.box(-.04,3.35,-1.43,.44,.14,.09,'#e5d8a9',U);}
 const p=[.65,2.1,.55],{q,r}=bucketPose(u,phase);
 this.beam(p,q,.57,.58,yellow,U);this.beam(q,r,.44,.48,yellow,U);
 // Hydraulic cylinder ends follow the same articulated pivots as the arm.
 this.limb([.7,2.4,.17],[q[0]-.3,q[1]-.7,.17],.12,.11,'#414a42',U);this.limb([1.2,3.2,.17],[q[0]-.12,q[1]-.15,.17],.075,.075,'#b8beb1',U);this.limb([q[0]+.15,q[1]-.15,.92],[r[0]-.4,r[1]+.5,.92],.1,.08,'#b8b9a7',U);
 this.box(r[0]+.2,r[1]-.45,.55,1.2,1.1,1.55,dark,U,kind==='uppercut'?-1.2+stroke*.8:-.35-stroke*.6);this.box(r[0]+.77,r[1]-.83,.55,.2,.25,1.8,'#7b7a66',U);for(let j=0;j<5;j++)this.box(r[0]+.94,r[1]-.91,-.13+j*.34,.32,.14,.13,'#969381',U,-.25);
 if(!dead&&action&&phase>.3&&phase<.8){const ca=Math.cos(slew),sa=Math.sin(slew);const tip=T(r[0]*ca-r[2]*sa,r[1],r[0]*sa+r[2]*ca);this.motionTips.push({id:u.id,x:tip[0],y:tip[1],z:tip[2],team:'dig',power:stroke});}
 }

 buffAura(u,time){drawBuffAura(this,u,time);}

 flush(sort=true){if(sort)this.polys.sort((a,b)=>a.d-b.d);const ctx=this.ctx;for(const face of this.polys){ctx.beginPath();face.p.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=face.color;ctx.fill();ctx.globalAlpha=1;}this.polys=[];}
 ground(){const ctx=this.ctx,W=this.width,H=this.height,b=this.battle,R=b.radius,key=[W,H,this.yaw,this.elev,R,this.followId,this.cameraMode,this.cameraMode==='field'?this.focusX:0,this.cameraMode==='field'?this.focusZ:0,this.cameraMode==='field'?this.zoom:0].join(',');const gc=this.groundCamera,ratio=gc?this.scale/gc.scale:1;if(this.groundKey===key&&this.groundCache&&ratio>.8&&ratio<1.3&&Math.hypot(this.focusX-gc.x,this.focusZ-gc.z)<4){const dx=gc.x-this.focusX,dz=gc.z-this.focusZ,ca=Math.cos(this.yaw),sa=Math.sin(this.yaw),sx=(dx*ca-dz*sa)*this.scale,sy=(dx*sa+dz*ca)*Math.sin(this.elev)*this.scale;ctx.fillStyle=SITE_GROUND;ctx.fillRect(0,0,W,H);ctx.drawImage(this.groundCache,(1-ratio)*W/2+sx,(1-ratio)*H*.56+sy,W*ratio,H*ratio);return;}
 const grad=ctx.createLinearGradient(0,0,0,H);grad.addColorStop(0,'#647772');grad.addColorStop(1,'#746e59');ctx.fillStyle=grad;ctx.fillRect(0,0,W,H);
 this.polys=[];this.poly([[-cityExtent(b)*8,-.02,-cityExtent(b)*8],[cityExtent(b)*8,-.02,-cityExtent(b)*8],[cityExtent(b)*8,-.02,cityExtent(b)*8],[-cityExtent(b)*8,-.02,cityExtent(b)*8]],SITE_GROUND);this.flush(false);
 const rng=seededRandom(b.config.seed+99);for(let i=0;i<1800;i++){const x=(rng()-.5)*R*5,z=(rng()-.5)*R*5,p=this.project(x,0,z),size=(.1+rng()*.45)*this.scale;ctx.fillStyle=['#746954','#94836a','#7b705b','#a08f73'][i%4];ctx.globalAlpha=.45;ctx.fillRect(p.x,p.y,size,size*.35);}ctx.globalAlpha=1;
 constructionSite(this);
 this.flush();this.groundCache=document.createElement('canvas');this.groundCache.width=this.canvas.width;this.groundCache.height=this.canvas.height;this.groundCache.getContext('2d').drawImage(this.canvas,0,0);this.groundKey=key;this.groundCamera={x:this.focusX,z:this.focusZ,scale:this.scale};
 }
 explosion(e){const c=this.ctx,t=1-e.life/e.max,alpha=Math.max(0,1-t),p=this.project(e.x,e.y,e.z),ground=this.project(e.x,0,e.z),radius=this.scale*(1.1+Math.min(1,t*3)*3.5);c.save();
 c.globalAlpha=Math.max(0,1-t*2.7)*.9;const glow=c.createRadialGradient(p.x,p.y,0,p.x,p.y,radius*1.8);glow.addColorStop(0,'#fff6c7');glow.addColorStop(.27,'#ffd276');glow.addColorStop(.6,'#e77b28aa');glow.addColorStop(1,'#d4651800');c.fillStyle=glow;c.fillRect(p.x-radius*1.8,p.y-radius*1.8,radius*3.6,radius*3.6);
 // This expanding ground ring uses the same radius as the damage model.
 const r=Math.min(e.blastRadius||8,t*(e.blastRadius||8)*2);c.globalAlpha=alpha*.7;c.lineWidth=Math.max(1,this.scale*.1);c.strokeStyle='#e6c798';c.beginPath();for(let i=0;i<=40;i++){const a=i/40*Math.PI*2,q=this.project(e.x+Math.cos(a)*r,.07,e.z+Math.sin(a)*r);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);}c.stroke();c.restore();}
 ambientRuins(time){
  const c=this.ctx;for(const s of [...this.ruins,...this.fires]){const burning=!!s.intensity;
   for(let i=0;i<4;i++){const t=(time*.14+s.phase+i/4)%1,p=this.project(s.x+t*t*2.4,.5+t*(burning?11:5),s.z+t*.8),size=this.scale*((burning?.65:.45)+t*(burning?2.9:1.5));c.fillStyle=burning?'#272f26':'#353d32';c.globalAlpha=Math.sin(t*Math.PI)*(burning?.3:.14);c.beginPath();c.ellipse(p.x,p.y,size,size*1.2,0,0,Math.PI*2);c.fill();}
   if(burning){for(let i=0;i<3;i++){const f=.9+Math.sin(time*(5+i)+s.phase*9+i)*.2,p=this.project(s.x+(i-1)*.36,1.3+i*.15,s.z),w=this.scale*(.55-i*.08)*f,h=this.scale*(2.1-i*.32)*f;c.globalAlpha=.85;c.fillStyle=i===2?'#edbc65':i?'#df8b3a':'#ae4e27';c.beginPath();c.moveTo(p.x-w,p.y+h*.4);c.quadraticCurveTo(p.x-w,p.y-h*.5,p.x+w*.1,p.y-h);c.quadraticCurveTo(p.x+w*1.5,p.y,p.x+w,p.y+h*.4);c.fill();}}
   else{const p=this.project(s.x,.12,s.z);c.globalAlpha=.65;c.fillStyle='#bc6f32';c.fillRect(p.x-this.scale*.2,p.y,this.scale*.4,this.scale*.12);}
  }c.globalAlpha=1;
 }
 disasterAtmosphere(time){
  const c=this.ctx,W=this.width,H=this.height,key=W+':'+H;if(this.atmosphereKey!==key){this.atmosphereKey=key;const g=c.createRadialGradient(W*.5,H*.5,Math.min(W,H)*.2,W*.5,H*.5,Math.hypot(W,H)*.57);g.addColorStop(0,'#18272200');g.addColorStop(.65,'#33463f08');g.addColorStop(1,'#24362f50');this.atmosphereGradient=g;}
  c.save();c.fillStyle=this.atmosphereGradient;c.fillRect(0,0,W,H);c.globalAlpha=.23;c.fillStyle='#c6b28b';for(let i=0;i<Math.round(28*(this.effectAmount??1));i++){const x=((i*137.31+time*(8+i%4))%(W+30))-15,y=((i*83.7+time*(5+i%5))%(H+20))-10;c.fillRect(x,y,i%4===0?2:1,1);}c.restore();
 }
 wreckSmoke(u,time){
 const c=this.ctx,age=Math.max(0,time-u.deadAt);if(age<.15)return;
 const origin=this.transform(u)(-1.05,2.3,.3),count=this.scale<4?4:7,wind=.9+Math.sin(u.id*2.4)*.35;
 c.save();
 const ember=this.project(origin[0],Math.max(.35,origin[1]-.3),origin[2]);
 c.globalAlpha=.34+Math.sin(time*11+u.id)*.08;c.fillStyle='#dd7431';c.beginPath();c.ellipse(ember.x,ember.y,this.scale*.5,this.scale*.22,0,0,Math.PI*2);c.fill();
 for(let i=0;i<count;i++){
  const t=(age*.22+i/count+u.id*.137)%1,fade=Math.sin(t*Math.PI),x=origin[0]+t*t*wind*2+Math.sin(age*.8+i)*t*.35,z=origin[2]+t*.9,y=Math.max(.5,origin[1])+t*7.5;
  const p=this.project(x,y,z),r=this.scale*(.35+t*1.65);
  if(typeof c.drawImage==='function'&&typeof document!=='undefined'){this.smokeTiles ||= new Map();const key=t<.4?'#242422':'#4d4b46';let tile=this.smokeTiles.get(key);if(!tile){tile=document.createElement('canvas');tile.width=tile.height=64;const tc=tile.getContext('2d'),g=tc.createRadialGradient(28,26,0,32,32,32);g.addColorStop(0,key);g.addColorStop(.5,'#55534eaa');g.addColorStop(1,'#77736b00');tc.fillStyle=g;tc.fillRect(0,0,64,64);this.smokeTiles.set(key,tile);}c.globalAlpha=fade*.46*Math.min(1,age*2);c.drawImage(tile,p.x-r,p.y-r*1.2,r*2,r*2.4);continue;}
  const g=c.createRadialGradient(p.x-r*.12,p.y-r*.2,0,p.x,p.y,r);
  g.addColorStop(0,t<.4?'#242422':'#4d4b46');g.addColorStop(.5,'#55534eaa');g.addColorStop(1,'#77736b00');
  c.globalAlpha=fade*.46*Math.min(1,age*2);c.fillStyle=g;c.beginPath();c.ellipse(p.x,p.y,r,r*1.2,0,0,Math.PI*2);c.fill();
 }
 c.restore();
 }
 parryEffect(e){const c=this.ctx,p=this.project(e.x,e.y,e.z),tip=this.project(e.x+Math.cos(e.yaw||0),e.y,e.z+Math.sin(e.yaw||0)),t=1-e.life/e.max,scale=this.scale*(e.aerial?1.5:1),angle=Math.atan2(tip.y-p.y,tip.x-p.x),fade=Math.pow(Math.max(0,1-t),1.6),flash=Math.max(0,1-t/.24);c.save();c.translate(p.x,p.y);c.rotate(angle);c.scale(scale,scale);c.globalCompositeOperation='lighter';
 if(flash>0){c.globalAlpha=flash*.9;const glow=c.createRadialGradient(0,0,0,0,0,1.8);glow.addColorStop(0,'#f5fdff');glow.addColorStop(.18,'#b4f2ff');glow.addColorStop(.5,'#52d1f555');glow.addColorStop(1,'#28b6ef00');c.fillStyle=glow;c.fillRect(-1.8,-1.8,3.6,3.6);c.fillStyle='#ecfcff';c.beginPath();c.moveTo(-1.6,0);c.lineTo(-.17,-.12);c.lineTo(0,-1);c.lineTo(.14,-.1);c.lineTo(2.3,0);c.lineTo(.14,.1);c.lineTo(0,1);c.lineTo(-.17,.12);c.closePath();c.fill();}
 c.globalAlpha=fade;c.strokeStyle='#9beeff';c.lineWidth=.07;c.beginPath();c.arc(0,0,.35+t*1.5,0,Math.PI*2);c.stroke();const side=e.side||1;for(let i=0;i<3;i++){const offset=i*.2,stretch=.8+t*2;c.beginPath();c.moveTo(-.55+offset,.28*side);c.bezierCurveTo(.1+offset,-.62*side,stretch*.7,-1.05*side,stretch,-.55*side);c.strokeStyle=i===1?'#e9fbff':i===0?'#89e9ff99':'#5bc7ed55';c.lineWidth=i===1?.09:.045;c.lineCap='round';c.stroke();}c.restore();}
 stunMarks(time){const c=this.ctx;let count=0;for(const u of this.drawUnits||this.battle.units){if(u.hp<=0||!(u.hardStunUntil>this.battle.time)||++count>64)continue;const p=this.project(u.x,u.y+(u.team==='rex'?6.7:7.1),u.z);if(p.x<-20||p.y<-20||p.x>this.width+20||p.y>this.height+20)continue;const r=Math.max(3.5,Math.min(8,this.scale*.65));c.save();c.globalAlpha=.48*Math.min(1,(u.hardStunUntil-this.battle.time)/.18);c.strokeStyle='#bfb18c';c.fillStyle='#d8cba6';c.lineWidth=1;c.beginPath();c.ellipse(p.x,p.y,r,r*.32,0,0,Math.PI*2);c.stroke();for(let i=0;i<2;i++){const a=time*2.2+i*Math.PI,x=p.x+Math.cos(a)*r,y=p.y+Math.sin(a)*r*.32;c.beginPath();for(let k=0;k<8;k++){const t=k*Math.PI/4,rad=k%2?.75:2.1;k?c.lineTo(x+Math.cos(t)*rad,y+Math.sin(t)*rad):c.moveTo(x+rad,y);}c.closePath();c.fill();}c.restore();}}
 trackingMark(){if(this.selectedId==null)return;const unit=this.battle.units[this.selectedId];if(!unit)return;const u=this.drawUnits?.find(v=>v.id===unit.id)||unit,p=this.project(u.x,u.y+(u.hp>0?2.4:.8),u.z),c=this.ctx,w=Math.max(13,Math.min(27,this.scale*3.4)),h=Math.max(11,Math.min(22,this.scale*2.6)),n=5;c.save();c.strokeStyle='rgba(226,235,215,.72)';c.lineWidth=1.35;c.lineCap='round';c.shadowColor='#16221a99';c.shadowBlur=2;c.beginPath();for(const sx of [-1,1])for(const sy of [-1,1]){const x=p.x+sx*w,y=p.y+sy*h;c.moveTo(x-sx*n,y);c.lineTo(x,y);c.lineTo(x,y-sy*n);}c.stroke();c.restore();}
 effects(time){const c=this.ctx,b=this.battle;
 // Small dust trails, fragments and landing plumes share the world camera.
 const stride=Math.ceil(1/Math.max(.25,this.effectAmount??1)),sorted=b.particles.filter((e,i)=>i%stride===0).map(e=>({e,p:this.project(e.x,e.y,e.z)})).sort((a,b)=>a.p.d-b.p.d);
 for(const {e,p} of sorted){const alpha=Math.max(0,Math.min(1,e.life/e.max)),r=Math.max(.7,e.size*this.scale*(e.kind==='dust'?1+(1-alpha)*2:1));c.globalAlpha=alpha*(e.kind==='dust'?.18:.85);if(e.kind==='metal'){const tail=this.project(e.x-e.vx*.027,e.y-e.vy*.027,e.z-e.vz*.027);c.strokeStyle=alpha>.65?'#fff7d4':'#e8b86c';c.lineWidth=Math.max(.7,this.scale*.06);c.beginPath();c.moveTo(tail.x,tail.y);c.lineTo(p.x,p.y);c.stroke();}else if(e.kind==='fire'||e.kind==='smoke'){c.globalAlpha=alpha*(e.kind==='smoke'?.28:.8);c.fillStyle=e.kind==='smoke'?'#302c27':alpha>.65?'#ffe5a0':alpha>.3?'#ef9938':'#9f4926';c.beginPath();c.ellipse(p.x,p.y,r*(1+(1-alpha)*1.8),r*(1.25+(1-alpha)),0,0,Math.PI*2);c.fill();}else if(e.kind==='dust'){c.fillStyle='#c0ab87';c.beginPath();c.ellipse(p.x,p.y,r,r*.7,0,0,Math.PI*2);c.fill();}else{c.save();c.translate(p.x,p.y);c.rotate(e.spin);c.fillStyle=e.kind==='spark'?'#ffd58a':e.team==='dig'?'#a68a50':'#6b6650';c.fillRect(-r,-r,r*2,r*(e.kind==='spark'?.45:1.4));c.restore();}}c.globalAlpha=1;
 for(const e of b.effects){if(e.kind==='roll-wave'){const t=1-e.life/e.max,R=e.radius*smooth(t);c.save();c.globalAlpha=(1-t)*.35;c.strokeStyle='#d5bb8b';c.lineWidth=Math.max(1,this.scale*.07);c.beginPath();for(let i=0;i<=20;i++){const a=i/20*Math.PI*2,p=this.project(e.x+Math.cos(a)*R,e.y,e.z+Math.sin(a)*R);i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y);}c.stroke();c.restore();continue;}if(e.kind==='step'||e.kind==='dust'||e.kind==='collapse'||e.kind==='death')continue;if(e.kind==='explosion'){this.explosion(e);continue;}if(e.kind==='parry'){this.parryEffect(e);continue;}const alpha=e.life/e.max,p=this.project(e.x,e.y,e.z),t=1-alpha;
 c.globalAlpha=alpha*.75;c.lineWidth=1.5;c.strokeStyle=e.kind==='death'?'#f0c087':'#f3e4bc';c.beginPath();c.ellipse(p.x,p.y,(.4+t*2.6)*this.scale*e.strength,(.2+t*.9)*this.scale*e.strength,0,0,Math.PI*2);c.stroke();
 if(t<.22){c.globalAlpha=(.22-t)*2;c.fillStyle='#fff0c9';c.beginPath();c.arc(p.x,p.y,(.4+t*2)*this.scale,0,Math.PI*2);c.fill();}c.globalAlpha=1;
 }
 // A curved trail records the bucket sweep; it is an effect only.
 for(const tip of (this.effectAmount??1)>=.6?this.motionTips:[]){const prev=this.tipHistory.get(tip.id),p=this.project(tip.x,tip.y,tip.z);if(prev&&time-prev.time<.15&&Math.hypot(tip.x-prev.x,tip.z-prev.z)<10){const q=this.project(prev.x,prev.y,prev.z);c.strokeStyle=tip.team==='dig'?'#f2c78299':'#c9d99c88';c.lineWidth=Math.max(1,this.scale*.22);c.beginPath();c.moveTo(q.x,q.y);c.lineTo(p.x,p.y);c.stroke();}this.tipHistory.set(tip.id,{...tip,time});}
 }
 dashWake(u,time){
 const m=rexMotion(u,time);if(!m.dash||m.dashDrive<.1||u.speed<3)return;
 const c=this.ctx,ca=Math.cos(u.yaw),sa=Math.sin(u.yaw);c.save();c.fillStyle='#bca98b';
 for(let i=0;i<5;i++){const back=1.6+i*.65,side=(i%2?1:-1)*(.6+i*.1),p=this.project(u.x-ca*back-sa*side,.12,u.z-sa*back+ca*side);
 c.globalAlpha=m.dashDrive*(.13-i*.018);c.beginPath();c.ellipse(p.x,p.y,this.scale*(.55+i*.13),this.scale*(.16+i*.045),u.yaw+this.yaw,0,Math.PI*2);c.fill();}c.restore();
 }
 armyWake(time){
  const amount=this.effectAmount??1;if(this.battle.units.length<200||amount<.25)return;
  let count=0;for(const group of this.battle.squadState.values()){
   if(group.members.length<12||count++>32)continue;let vx=0,vz=0,moving=0;
   for(const u of group.members)if(u.hp>0&&u.y<.5&&u.speed>1){vx+=u.vx;vz+=u.vz;moving++;}
   if(moving<group.members.length*.35)continue;const length=Math.hypot(vx,vz)||1,nx=vx/length,nz=vz/length,size=Math.min(3.3,1+Math.sqrt(moving)*.2);
   for(let i=0;i<3;i++){const phase=(time*.55+group.id*.137+i/3)%1,back=2+phase*8,x=group.x-nx*back,z=group.z-nz*back,r=size*(.7+phase),alpha=Math.sin(phase*Math.PI)*.13*amount;
    if(this.gl&&!this.gpuLost){this.billboard(x,.3+phase*.6,z,r,r*.45,[.68,.59,.45,alpha]);continue;}
    const p=this.project(x,.3,z),c=this.ctx;c.save();c.globalAlpha=alpha;c.fillStyle='#b09a73';c.beginPath();c.ellipse(p.x,p.y,r*this.scale,r*this.scale*.35,0,0,Math.PI*2);c.fill();c.restore();
   }
  }
 }
 contactBursts(){
  const amount=this.effectAmount??1;if(amount<=0)return;const c=this.ctx,limit=this.battle.units.length>300?10:24;let count=0;c.save();c.lineCap='round';
  for(const e of this.battle.effects){const age=e.max-e.life;if(e.kind!=='impact'||age<0||age>.2||count++>=limit)continue;
   const t=age/.2,p=this.project(e.x,e.y,e.z),power=Math.min(2.1,e.strength*(e.critical?1.35:1)),size=this.scale*power,fade=(1-t)*(1-t)*amount;
   if(p.x<0||p.x>this.width||p.y<0||p.y>this.height)continue;
   c.globalAlpha=fade*.8;c.strokeStyle=e.team==='dig'?'#ffe2a3':'#ddd0ac';c.lineWidth=Math.max(.7,size*.075);c.beginPath();
   const rays=e.critical?10:e.team==='dig'?7:5;for(let i=0;i<rays;i++){const a=i/rays*Math.PI*2+e.x*.17,r=(.2+t*1.7)*size,l=(.45+.18*Math.sin(i*2.1))*size*(1-t);c.moveTo(p.x+Math.cos(a)*r,p.y+Math.sin(a)*r*.65);c.lineTo(p.x+Math.cos(a)*(r+l),p.y+Math.sin(a)*(r+l)*.65);}c.stroke();
   if(t<.4){c.globalAlpha=fade*.65*(1-t/.4);c.fillStyle='#fff1cf';c.beginPath();c.ellipse(p.x,p.y,size*.34,size*.2,0,0,Math.PI*2);c.fill();}
  }c.restore();
 }
 cameraBounds(){const b=this.battle;if(this.boundsBattle===b&&this.boundsTick===b.tick)return this.boundsValue;let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity,count=0;for(const u of b.units)if(u.hp>0){count++;minX=Math.min(minX,u.x);maxX=Math.max(maxX,u.x);minZ=Math.min(minZ,u.z);maxZ=Math.max(maxZ,u.z);}this.boundsBattle=b;this.boundsTick=b.tick;return this.boundsValue={minX,maxX,minZ,maxZ,count};}
 directorTarget(){return updateDynamicDirector(this);} camera(time){if(!this.follow||this.followHoldUntil>performance.now())return;const back=Math.min(1,.12+.88*Math.max(0,(performance.now()-(this.followHoldUntil||0))/700)**2);const selected=this.followId===null?null:this.battle.units[this.followId];if(selected){this.focusX+=(selected.x-this.focusX)*.25*back;this.focusZ+=(selected.z-this.focusZ)*.25*back;return;}if(this.followId!==null){this.followId=null;this.lastFollowId=null;this.followZoom=1;}if(!this.battle.tick)return;updateDynamicView(this);if(this.cameraMode==='field'){this.followField();const shot=this.director?this.directorTarget():null;applyDynamicMotion(this,shot);if(shot){this.focusX+=(shot.x-this.focusX)*.13;this.focusZ+=(shot.z-this.focusZ)*.13;const goal=Math.min(this.maxZoom(),Math.max(this.minZoom(),1.05+shot.zoomFactor*.18));this.zoom=this.director?directorZoom(this,goal):this.zoom+(goal-this.zoom)*.06;}return;}const {minX,maxX,minZ,maxZ,count}=this.cameraBounds();if(!count)return;const targetX=(minX+maxX)/2,targetZ=(minZ+maxZ)/2,ca=Math.abs(Math.cos(this.yaw)),sa=Math.abs(Math.sin(this.yaw)),spanX=(maxX-minX)*ca+(maxZ-minZ)*sa+18,spanZ=((maxX-minX)*sa+(maxZ-minZ)*ca)*Math.sin(this.elev)+18,base=Math.min(this.width/(this.battle.radius*2.55),this.height/(this.battle.radius*1.6));this.fitZoom=Math.max(.85,Math.min(2.15,Math.min(this.width*.85/spanX,this.height*.72/spanZ)/base));const targetZoom=Math.max(this.minZoom(),Math.min(this.maxZoom(),this.fitZoom*(this.followZoom||1)));const shot=this.director?this.directorTarget():null,ease=shot?.05:this.directorReturnUntil>this.battle.time?.06:.18*back,goalX=shot?shot.x:targetX,goalZ=shot?shot.z:targetZ,goalZoom=shot?Math.max(this.minZoom(),Math.min(this.maxZoom(),this.fitZoom*shot.zoomFactor)):targetZoom;applyDynamicMotion(this,shot);this.focusX+=(goalX-this.focusX)*ease;this.focusZ+=(goalZ-this.focusZ)*ease;if(Number.isFinite(goalZoom))this.zoom=this.director?directorZoom(this,goalZoom):this.zoom+(goalZoom-this.zoom)*Math.min(.15,ease);}
 draw(time,alpha=1,aftermathDelta=0){this.aftermathTime+=Math.max(0,aftermathDelta);this.camera(time);this.clampZoom();const ctx=this.ctx,W=this.width,H=this.height,b=this.battle;this.updateScale();this.detail=this.quality==='low'||(b.units.length>70&&this.zoom<1.8)||this.scale<(this.quality==='medium'?7:5)?0:1;this.compact=b.units.length>300&&this.scale<(this.quality==='low'?6:3.3);this.drawUnits=b.units.filter(u=>{const p=this.project(u.x,u.y,u.z),m=this.scale*17;return p.x>=-m&&p.x<=W+m&&p.y>=-m&&p.y<=H+m;}).map(u=>this.pose(u,alpha));this.motionTips=[];this.buffFXCount=0;this.buffFXTeams={rex:0,dig:0};this.tipHistory ||= new Map();ctx.clearRect(0,0,W,H);this.ground();ctx.save();if(this.shakeEnabled){const strength=Math.min(4,b.quake*2.6);ctx.translate(Math.sin(time*83)*strength,Math.cos(time*97)*strength*.65);}this.polys=[];
 for(const mark of b.scorches){ctx.fillStyle='#29231c55';ctx.beginPath();for(let i=0;i<=18;i++){const a=i/18*Math.PI*2,r=mark.radius*(.88+.12*Math.sin(i*5)),p=this.project(mark.x+Math.cos(a)*r,.025,mark.z+Math.sin(a)*r);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y);}ctx.closePath();ctx.fill();}
 // Shadows stay on the ground while bodies rise and turn above them.
 for(const u of this.drawUnits){const p=this.project(u.x,0,u.z);ctx.save();ctx.translate(p.x,p.y);ctx.globalAlpha=Math.max(.1,.3-u.y*.025);ctx.fillStyle='#292b23';ctx.beginPath();ctx.ellipse(0,0,this.scale*(u.team==='rex'?3.6:2.7),this.scale*1.05,u.yaw+this.yaw,0,Math.PI*2);ctx.fill();ctx.restore();}
 for(const u of this.drawUnits)if(u.team==='rex')this.dashWake(u,time);
 if(this.compact)this.distantCanvasUnits(time);else for(const u of this.drawUnits){const dead=u.hp<=0;if(u.team==='rex')this.rex(u,time,dead);else this.digger(u,time,dead);}
 this.flush();
 for(const u of this.drawUnits){if(u.hp>0||u.deadAt===null)continue;const t=time-u.deadAt;if(t>4)continue;const escape=Math.min(1,t/1.4),dist=escape*7,h=Math.max(0,Math.sin(escape*Math.PI)*5),a=u.yaw+Math.PI,p=this.project(u.x+Math.cos(a)*dist,h+1,u.z+Math.sin(a)*dist);ctx.save();ctx.translate(p.x,p.y);ctx.rotate(escape*Math.PI*3);ctx.fillStyle='#46504a';ctx.fillRect(-this.scale*.2,-this.scale*.6,this.scale*.4,this.scale*.6);ctx.fillStyle='#d1c6a2';ctx.beginPath();ctx.arc(0,-this.scale*.8,this.scale*.23,0,Math.PI*2);ctx.fill();ctx.restore();}
 for(const u of this.drawUnits)if(u.hp<=0&&u.team==='dig')this.wreckSmoke(u,time+this.aftermathTime);
 this.armyWake(time);this.ambientRuins(time+this.aftermathTime);this.effects(time);this.contactBursts();this.stunMarks(time);this.trackingMark();this.disasterAtmosphere(time);
 for(const u of this.drawUnits){if(!this.showHealth||u.hp<=0||u.hp>=u.maxHp)continue;const p=this.project(u.x,u.y+(u.team==='rex'?5.8:6.5),u.z),w=Math.max(12,this.scale*2.8);ctx.fillStyle='#1d281abb';ctx.fillRect(p.x-w/2,p.y,w,3);ctx.fillStyle=u.team==='rex'?'#a2b47e':'#d5b277';ctx.fillRect(p.x-w/2,p.y,w*Math.max(0,u.hp/u.maxHp),3);}
 ctx.restore();
 }
}




