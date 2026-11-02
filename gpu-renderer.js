import {visualBody} from './combat-motion.js';
import {Renderer,rexMotion} from './renderer.js';
import {constructionSite,cityExtent,SITE_GROUND} from './site-terrain.js';
import {identity,multiply,boxMatrix,localMatrix,poseMatrix,point,segmentMatrix} from './gpu-math.js';
const I=identity(),STRIDE=30,clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const colors=new Map();
function rgba(color){if(colors.has(color))return colors.get(color);let out;if(color[0]==='#'){const s=color.slice(1);out=[parseInt(s.slice(0,2),16)/255,parseInt(s.slice(2,4),16)/255,parseInt(s.slice(4,6),16)/255,s.length===8?parseInt(s.slice(6,8),16)/255:1];}else{const a=color.match(/[\d.]+/g).map(Number);out=[a[0]/255,a[1]/255,a[2]/255,a[3]??1];}colors.set(color,out);return out;}
const VERTEX=`#version 300 es
precision highp float;
precision highp int;
layout(location=0) in vec3 aPosition;
layout(location=1) in float aShade;
layout(location=2) in mat4 aModel;
layout(location=6) in vec4 aColor;
layout(location=7) in vec3 aRingA;
layout(location=8) in vec3 aRingB;
layout(location=9) in vec4 aRadii;
uniform vec2 uViewport;
uniform vec3 uRight,uUp,uDepth,uFocus;
uniform float uScale,uFar,uTime;uniform vec2 uPerspective;
uniform vec2 uShake;
uniform int uKind;
out vec4 vColor;
out vec2 vUV;
out vec3 vWorld;out float vCityObject;
void main(){
 vCityObject=(uKind==0? aRingA.x:0.0);vec3 p=aPosition;vUV=aPosition.xy;vColor=aColor;vec3 world;
 if(uKind==1){vec3 center=mix(aRingA,aRingB,p.x);vec2 radius=mix(aRadii.xy,aRadii.zw,p.x);p=center+vec3(0.0,p.y*radius.x,p.z*radius.y);}
 if(uKind==4||uKind==5){vec3 center=aModel[3].xyz;vec2 size=vec2(length(aModel[0].xyz),length(aModel[1].xyz));
  if(uKind==5){float age=max(0.0,uTime-aRingA.x),t=fract(age*.22+aRingA.z+aRingA.y*.137),wind=aRingB.x;center+=vec3(t*t*wind*2.0+sin(age*.8+aRingB.y)*t*.35,t*7.5,t*.9);size=vec2(.35+t*1.65)*vec2(1.0,1.2);vColor.rgb=mix(vec3(.14,.14,.13),vec3(.35,.34,.32),t);vColor.a*=sin(t*3.14159265)*min(1.0,age*2.0);}
  world=center+uRight*p.x*size.x+uUp*p.y*size.y;
 }else{world=(aModel*vec4(p,1.0)).xyz;if(uKind==0||uKind==1)world.y=max(.025,world.y);}
 if(uKind==3||uKind==7)vUV=aPosition.xz;
 vWorld=world;vec3 relative=world-uFocus;float x=dot(relative,uRight)*uScale+uViewport.x*.5+uShake.x,y=-dot(relative,uUp)*uScale+uViewport.y*.56+uShake.y;
 if(uPerspective.x>0.0){float eyeDepth=uPerspective.x-dot(relative,uDepth),near=1.2;gl_Position=vec4(dot(relative,uRight)*uPerspective.y*2.0/uViewport.x+uShake.x*2.0/uViewport.x*eyeDepth,dot(relative,uUp)*uPerspective.y*2.0/uViewport.y-.12*eyeDepth-uShake.y*2.0/uViewport.y*eyeDepth,(uFar+near)/(uFar-near)*eyeDepth-2.0*uFar*near/(uFar-near),eyeDepth);}else gl_Position=vec4(x/uViewport.x*2.0-1.0,1.0-y/uViewport.y*2.0,-dot(relative,uDepth)/uFar,1.0);vColor.rgb*=aShade;
}`;
const FRAGMENT=`#version 300 es
precision highp float;
precision highp int;
in vec4 vColor;in vec2 vUV;in vec3 vWorld;in float vCityObject;uniform vec3 uRight,uUp,uDepth,uFocus;uniform float uScale;uniform vec2 uViewport;uniform vec2 uPerspective;uniform int uKind;uniform vec2 uCity;out vec4 outColor;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
void main(){vec4 color=vColor;
 if(uKind==2){float grain=hash(floor(vWorld.xz*5.0));color.rgb*=.97+grain*.06;float rut=abs(sin(vWorld.x*.23+sin(vWorld.z*.11)*.4));color.rgb*=1.0-smoothstep(.95,.995,rut)*.055;}
 if(uKind==3){float r=length(vUV);if(r>1.0)discard;color.a*=1.0-smoothstep(.75,1.0,r);}
 if(uKind==4||uKind==5){float r=length(vUV);if(r>1.0)discard;color.a*=pow(max(0.0,1.0-r*r),uKind==5?1.7:1.1);}
 if(uKind==7){float r=length(vUV);float mask=1.0-smoothstep(.018,.05,abs(r-.92));if(mask<.01)discard;color.a*=mask;}
 float cityDepth=max(abs(vWorld.x),abs(vWorld.z));float haze=smoothstep(uCity.x+35.0,uCity.y,cityDepth)*.52;color.rgb=mix(color.rgb,vec3(.40,.47,.44),haze);
 if(color.a<.005)discard;outColor=color;
}`;
function meshData(name){const data=[],tri=(a,b,c,shade=1)=>{for(const p of [a,b,c])data.push(...p,shade);};
 if(name==='cube'){const v=[[-.5,-.5,-.5],[.5,-.5,-.5],[.5,.5,-.5],[-.5,.5,-.5],[-.5,-.5,.5],[.5,-.5,.5],[.5,.5,.5],[-.5,.5,.5]],faces=[[0,1,2,3],[4,7,6,5],[0,4,5,1],[3,2,6,7],[0,3,7,4],[1,5,6,2]],shades=[.65,1.12,.78,1.25,.85,.98];faces.forEach((f,i)=>{tri(v[f[0]],v[f[1]],v[f[2]],shades[i]);tri(v[f[0]],v[f[2]],v[f[3]],shades[i]);});
 }else if(name==='triangle')tri([0,0,0],[1,0,0],[0,1,0]);
 else if(name==='billboard'||name==='smoke'){tri([-1,-1,0],[1,-1,0],[1,1,0]);tri([-1,-1,0],[1,1,0],[-1,1,0]);}
 else if(['ground','shadow','ring'].includes(name)){tri([-1,0,-1],[1,0,-1],[1,0,1]);tri([-1,0,-1],[1,0,1],[-1,0,1]);}
 else if(name.startsWith('tube')){const sides=Number(name.slice(4));for(let i=0;i<sides;i++){const p=i/sides*Math.PI*2,q=(i+1)/sides*Math.PI*2,a=[0,Math.cos(p),Math.sin(p)],b=[1,Math.cos(p),Math.sin(p)],c=[1,Math.cos(q),Math.sin(q)],d=[0,Math.cos(q),Math.sin(q)],shade=.78+.28*Math.cos((p+q)/2)+.12*Math.sin((p+q)/2);tri(a,b,c,shade);tri(a,c,d,shade);}}
 else if(name.startsWith('sphere')){const rings=Number(name.slice(6)),sides=6;for(let i=0;i<rings;i++)for(let j=0;j<sides;j++){const at=(k,l)=>{const t=k/rings*Math.PI,p=l/sides*Math.PI*2;return[-Math.cos(t),Math.sin(t)*Math.cos(p),Math.sin(t)*Math.sin(p)];},shade=.78+.28*Math.cos((j+.5)/sides*Math.PI*2)+.12*Math.sin((j+.5)/sides*Math.PI*2);tri(at(i,j),at(i+1,j),at(i+1,j+1),shade);tri(at(i,j),at(i+1,j+1),at(i,j+1),shade);}}
 return new Float32Array(data);
}
function kindFor(name){return name.startsWith('tube')?1:name==='ground'?2:name==='shadow'?3:name==='billboard'?4:name==='smoke'?5:name==='ring'?7:0;}
class Batch{
 constructor(gl,name){this.gl=gl;this.name=name;this.kind=kindFor(name);this.data=new Float32Array(STRIDE*128);this.count=0;this.capacity=0;this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();const vertex=gl.createBuffer(),mesh=meshData(name);this.vertexBuffer=vertex;this.vertices=mesh.length/4;gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,vertex);gl.bufferData(gl.ARRAY_BUFFER,mesh,gl.STATIC_DRAW);gl.enableVertexAttribArray(0);gl.vertexAttribPointer(0,3,gl.FLOAT,false,16,0);gl.enableVertexAttribArray(1);gl.vertexAttribPointer(1,1,gl.FLOAT,false,16,12);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
  for(let i=0;i<4;i++){gl.enableVertexAttribArray(2+i);gl.vertexAttribPointer(2+i,4,gl.FLOAT,false,STRIDE*4,i*16);gl.vertexAttribDivisor(2+i,1);}for(const [index,size,offset] of [[6,4,16],[7,3,20],[8,3,23],[9,4,26]]){gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,size,gl.FLOAT,false,STRIDE*4,offset*4);gl.vertexAttribDivisor(index,1);}gl.bindVertexArray(null);
 }
 append(matrix,color,params){const offset=this.count*STRIDE;if(offset+STRIDE>this.data.length){const next=new Float32Array(this.data.length*2);next.set(this.data);this.data=next;}this.data.set(matrix,offset);this.data.set(color,offset+16);if(params)this.data.set(params,offset+20);else this.data.fill(0,offset+20,offset+STRIDE);this.count++;return offset;}
 appendRaw(raw){const offset=this.count*STRIDE;if(offset+STRIDE>this.data.length){const next=new Float32Array(this.data.length*2);next.set(this.data);this.data=next;}this.data.set(raw,offset);this.count++;}
 dispose(){this.gl.deleteBuffer(this.vertexBuffer);this.gl.deleteBuffer(this.buffer);this.gl.deleteVertexArray(this.vao);}
 render(program,upload=true){if(!this.count)return;const gl=this.gl;gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);if(upload){if(this.capacity<this.data.byteLength){this.capacity=this.data.byteLength;gl.bufferData(gl.ARRAY_BUFFER,this.capacity,gl.DYNAMIC_DRAW);}gl.bufferSubData(gl.ARRAY_BUFFER,0,this.data.subarray(0,this.count*STRIDE));}gl.uniform1i(program.kind,this.kind);gl.drawArraysInstanced(gl.TRIANGLES,0,this.vertices,this.count);}
}
export class GPURenderer extends Renderer{
 constructor(canvas,battle,{transparent=false}={}){super(canvas,battle);this.batchMap=new Map();this.terrainMap=new Map();this.deadCache=new Map();this.cacheEpoch=0;this.cpuTotal=0;this.cpuFrames=0;this.stats={drawCalls:0,instances:0};this.backend='canvas2d';
  const layer=document.createElement('canvas');layer.className='gpu-world';layer.setAttribute('aria-hidden','true');canvas.before(layer);this.gpuCanvas=layer;
  try{this.gl=layer.getContext('webgl2',{alpha:transparent,antialias:true,depth:true,powerPreference:'high-performance'})||layer.getContext('webgl2',{alpha:transparent,antialias:false,depth:true});if(!this.gl)throw Error('WebGL2 unavailable');this.initializeGPU();canvas.dataset.renderer=this.backend='webgl2';this.resize();}
  catch(error){canvas.dataset.rendererError=String(error.message);this.gl=null;layer.remove();this.gpuCanvas=null;canvas.dataset.renderer='canvas2d';}
  layer.addEventListener('webglcontextlost',event=>{event.preventDefault();this.gpuLost=true;layer.hidden=true;canvas.dataset.renderer='canvas2d';});
  layer.addEventListener('webglcontextrestored',()=>{try{this.batchMap.clear();this.terrainMap.clear();this.deadCache.clear();this.initializeGPU();this.gpuLost=false;layer.hidden=false;canvas.dataset.renderer='webgl2';}catch{this.gpuLost=true;}});
 }
 dispose(){super.dispose();for(const map of [this.batchMap,this.terrainMap]){for(const batch of map?.values()||[])batch.dispose();map?.clear();}if(this.gl&&this.program?.id)this.gl.deleteProgram(this.program.id);this.gl?.getExtension('WEBGL_lose_context')?.loseContext();this.gpuCanvas?.remove();}
 initializeGPU(){const gl=this.gl,compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;},program=gl.createProgram();gl.attachShader(program,compile(gl.VERTEX_SHADER,VERTEX));gl.attachShader(program,compile(gl.FRAGMENT_SHADER,FRAGMENT));gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));
  this.program={id:program};for(const name of ['Viewport','Right','Up','Depth','Focus','Scale','Far','Time','Kind','Shake','City','Perspective'])this.program[name[0].toLowerCase()+name.slice(1)]=gl.getUniformLocation(program,'u'+name);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);this.terrainReady=this.terrainUploaded=false;
 }
 setBattle(b){super.setBattle(b);this.deadCache?.clear();if(this.terrainMap){for(const batch of this.terrainMap.values())batch.dispose();this.terrainMap.clear();}this.terrainReady=this.terrainUploaded=false;this.cacheEpoch=(this.cacheEpoch||0)+1;if(this.gpuCanvas)this.resize();}
 resize(){super.resize();if(this.gpuCanvas){this.gpuCanvas.width=this.canvas.width;this.gpuCanvas.height=this.canvas.height;this.gl?.viewport(0,0,this.canvas.width,this.canvas.height);}}
 transform(u,pitch=0,yaw=0){if(!this.gl||this.gpuLost)return super.transform(u,pitch,yaw);const matrix=poseMatrix(visualBody(u),pitch,yaw),fn=(x,y,z)=>{const p=point(matrix,x,y,z);p[1]=Math.max(.025,p[1]);return p;};fn.matrix=matrix;return fn;}
 affine(fn,parent,options){if(!this.gl||this.gpuLost)return fn;fn.matrix=multiply(parent.matrix,localMatrix(options));if(options.worldY)fn.matrix[13]+=options.worldY;return fn;}
 submit(name,matrix,color,params){let batch=this.currentMap.get(name);if(!batch){batch=new Batch(this.gl,name);this.currentMap.set(name,batch);}const offset=batch.append(matrix,typeof color==='string'?rgba(color):color,params||(this.cityGeometry?[1,0,0,0,0,0,0,0,0,0]:null));if(this.recording)this.recording.push([name,batch.data.slice(offset,offset+STRIDE)]);}
 box(x,y,z,w,h,d,color,T=null,rz=0){if(!this.gl||this.gpuLost)return super.box(x,y,z,w,h,d,color,T,rz);this.submit('cube',boxMatrix(this.boxScratch ||= new Float32Array(16),T?.matrix||I,x,y,z,w,h,d,rz),color);}
 tube(rings,color,T,sides=7){if(!this.gl||this.gpuLost)return super.tube(rings,color,T,sides);if(this.detail===0)sides=Math.min(6,sides);for(let i=0;i<rings.length-1;i++){const a=rings[i],b=rings[i+1];this.submit('tube'+sides,T?.matrix||I,color,[...a.slice(0,3),...b.slice(0,3),a[3],a[4],b[3],b[4]]);}}
 oval(x,y,z,rx,ry,rz,color,T){if(!this.gl||this.gpuLost)return super.oval(x,y,z,rx,ry,rz,color,T);this.submit('sphere'+(this.detail===0?3:4),multiply(T?.matrix||I,localMatrix({tx:x,ty:y,tz:z,sx:rx,sy:ry,sz:rz})),color);}
 limb(a,b,ra,rb,color,T){if(!this.gl||this.gpuLost)return super.limb(a,b,ra,rb,color,T);this.submit('tube6',multiply(T?.matrix||I,segmentMatrix(a,b)),color,[0,0,0,1,0,0,ra,ra,rb,rb]);}
 poly(points,color){if(!this.gl||this.gpuLost)return super.poly(points,color);for(let i=1;i<points.length-1;i++){const a=points[0],b=points[i],c=points[i+1],m=identity();for(let j=0;j<3;j++){m[j]=b[j]-a[j];m[4+j]=c[j]-a[j];m[12+j]=a[j];}this.submit('triangle',m,color);}}
 project(x,y,z){return super.project(x,y,z);}

 setupCamera(time){const gl=this.gl,p=this.program,ca=Math.cos(this.yaw),sa=Math.sin(this.yaw),se=Math.sin(this.elev),ce=Math.cos(this.elev);gl.useProgram(p.id);gl.viewport(0,0,this.gpuCanvas.width,this.gpuCanvas.height);gl.uniform2f(p.viewport,this.width,this.height);gl.uniform3f(p.right,ca,0,-sa);gl.uniform3f(p.up,-sa*se,ce,-ca*se);gl.uniform3f(p.depth,sa*ce,se,ca*ce);if(this.cameraMode==='field'){const v=this.fieldView();gl.uniform3f(p.right,...v.right);gl.uniform3f(p.up,...v.up);gl.uniform3f(p.depth,...v.depth);gl.uniform3f(p.focus,...v.target);gl.uniform2f(p.perspective,v.distance,v.focal);}else{gl.uniform3f(p.focus,this.focusX,0,this.focusZ);gl.uniform2f(p.perspective,0,0);}gl.uniform1f(p.scale,this.scale);gl.uniform1f(p.far,cityExtent(this.battle)*16);gl.uniform2f(p.city,this.battle.radius,cityExtent(this.battle));gl.uniform1f(p.time,time);gl.uniform2f(p.shake,this.shakeX||0,this.shakeY||0);}
 makeTerrain(){this.currentMap=this.terrainMap;const R=this.battle.radius;this.submit('ground',localMatrix({ty:-.04,sx:cityExtent(this.battle)*8,sz:cityExtent(this.battle)*8}),SITE_GROUND);constructionSite(this);this.terrainReady=true;this.currentMap=this.batchMap;}
 drawMap(map,upload=true,transparent=false){const gl=this.gl;gl.depthMask(!transparent);for(const batch of map.values())if(batch.count){batch.render(this.program,upload);this.stats.drawCalls++;this.stats.instances+=batch.count;}gl.depthMask(true);}
 billboard(x,y,z,rx,ry,color){this.submit('billboard',localMatrix({tx:x,ty:y,tz:z,sx:rx,sy:ry}),color);}
 ring(x,y,z,radius,color){this.submit('ring',localMatrix({tx:x,ty:y,tz:z,sx:radius/.92,sz:radius/.92}),color);}
 gpuRiders(time){for(const u of this.drawUnits){if(u.hp>0||u.deadAt===null)continue;const age=time-u.deadAt;if(age>4)continue;const t=Math.min(1,age/1.4),direction=u.yaw+Math.PI,matrix=localMatrix({tx:u.x+Math.cos(direction)*t*7,ty:Math.max(.1,Math.sin(t*Math.PI)*5+1),tz:u.z+Math.sin(direction)*t*7,rz:t*Math.PI*3,yaw:u.yaw}),T=(x,y,z)=>point(matrix,x,y,z);T.matrix=matrix;this.box(0,.3,0,.4,.6,.3,'#46504a',T);this.oval(0,.8,0,.23,.23,.23,'#d1c6a2',T);}}
 // Smoke and embers over destroyed diggers; also used by the draw result scene.
 gpuWreckSmoke(time){const b=this.battle;for(const u of this.drawUnits){if(u.hp>0||u.team!=='dig'||u.deadAt===null||time-u.deadAt<.15)continue;const origin=this.transform(u)(-1.05,2.3,.3),count=b.units.length>100?4:7,wind=.9+Math.sin(u.id*2.4)*.35;this.billboard(origin[0],Math.max(.35,origin[1]-.3),origin[2],.5,.22,[.87,.45,.19,.35]);for(let i=0;i<count;i++)this.submit('smoke',localMatrix({tx:origin[0],ty:Math.max(.5,origin[1]),tz:origin[2]}),[.2,.2,.19,.42],[u.deadAt,u.id,i/count,wind,i,0,0,0,0,0]);}}
 gpuEffects(time){const b=this.battle;this.armyWake(time);
  for(const s of [...this.ruins,...this.fires]){const burning=!!s.intensity;for(let i=0;i<4;i++){const t=(time*.14+s.phase+i/4)%1,size=(burning?.65:.45)+t*(burning?2.9:1.5);this.billboard(s.x+t*t*2.4,.5+t*(burning?11:5),s.z+t*.8,size,size*1.2,[.16,.19,.15,Math.sin(t*Math.PI)*(burning?.3:.14)]);}if(burning){for(let i=0;i<3;i++){const f=.9+Math.sin(time*(5+i)+s.phase*9+i)*.2;this.billboard(s.x+(i-1)*.36,1.5+i*.15,s.z,(.55-i*.08)*f,(2.1-i*.32)*f,[1,i===2?.75:.42,.13,.8]);}}else this.billboard(s.x,.14,s.z,.25,.11,[.74,.44,.2,.65]);}
  this.gpuWreckSmoke(time);
  for(const u of this.drawUnits){if(u.team!=='rex'||u.hp<=0)continue;const m=rexMotion(u,time);if(!m.dash||m.dashDrive<.1||u.speed<3)continue;const ca=Math.cos(u.yaw),sa=Math.sin(u.yaw);for(let i=0;i<5;i++){const back=1.6+i*.65,side=(i%2?1:-1)*(.6+i*.1);this.billboard(u.x-ca*back-sa*side,.12,u.z-sa*back+ca*side,.55+i*.13,.16+i*.045,[.74,.66,.55,m.dashDrive*(.13-i*.018)]);}}
  for(let particleIndex=0;particleIndex<b.particles.length;particleIndex++){if(particleIndex%Math.ceil(1/Math.max(.25,this.effectAmount??1)))continue;const particle=b.particles[particleIndex];const alpha=clamp(particle.life/particle.max,0,1);if(particle.kind==='dust'){const r=particle.size*(1+(1-alpha)*2);this.billboard(particle.x,particle.y,particle.z,r,r*.7,[.75,.67,.53,alpha*.18]);}
   else if(particle.kind==='smoke'||particle.kind==='fire'){const smoke=particle.kind==='smoke',r=particle.size*(1+(1-alpha)*1.8);this.billboard(particle.x,particle.y,particle.z,r,r*1.2,smoke?[.19,.17,.15,alpha*.3]:[1,alpha>.65?.85:.48,.12,alpha*.8]);}
   else if(particle.kind==='spark'||particle.kind==='metal')this.billboard(particle.x,particle.y,particle.z,particle.size*.5,particle.size*1.6,[1,.84,.5,alpha]);
   else this.box(particle.x,particle.y,particle.z,particle.size*2,particle.size*1.2,particle.size,particle.team==='dig'?'#a68a50':'#6b6650',null,particle.spin);
  }
  for(const e of b.effects){const t=1-e.life/e.max,alpha=1-t;if(e.kind==='explosion'){this.billboard(e.x,e.y+.6,e.z,1.1+Math.min(1,t*3)*3.5,1.3+Math.min(1,t*3)*3.5,[1,.64,.18,Math.max(0,1-t*2.7)*.9]);this.ring(e.x,.07,e.z,Math.min(e.blastRadius||8,t*(e.blastRadius||8)*2),[.9,.78,.6,alpha*.65]);}
   else if(!['step','dust','collapse','death','parry'].includes(e.kind))this.ring(e.x,.08,e.z,(.4+t*2.6)*e.strength,[.95,.88,.72,alpha*.55]);
  }
 }
 draw(time,alpha=1,aftermathDelta=0){if(!this.gl||this.gpuLost)return super.draw(time,alpha,aftermathDelta);const start=performance.now();this.aftermathTime+=Math.max(0,aftermathDelta);this.camera(time);this.clampZoom();const b=this.battle,gl=this.gl;this.updateScale();const compact=b.units.length>300&&this.scale<(this.quality==='low'?6:3.3);if(this.compact!==compact){this.compact=compact;this.deadCache.clear();}const detail=this.quality==='low'||this.scale<(this.quality==='medium'?7:5)?0:1;if(this.detail!==detail){this.detail=detail;this.deadCache.clear();}this.drawUnits=[];for(const u of b.units){const p=this.project(u.x,u.y,u.z),margin=this.scale*17;if(p.x< -margin||p.x>this.width+margin||p.y< -margin||p.y>this.height+margin)continue;this.drawUnits.push(this.pose(u,alpha));}
  this.motionTips=[];this.buffFXCount=0;this.buffFXTeams={rex:0,dig:0};this.stats.drawCalls=this.stats.instances=0;this.currentMap=this.batchMap;for(const batch of this.batchMap.values())batch.count=0;this.ctx.clearRect(0,0,this.width,this.height);gl.clearColor(.41,.40,.34,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);const shake=this.shakeEnabled?Math.min(4,b.quake*2.6):0;this.shakeX=Math.sin(time*83)*shake;this.shakeY=Math.cos(time*97)*shake*.65;this.setupCamera(time+this.aftermathTime);this.ctx.save();this.ctx.translate(this.shakeX,this.shakeY);
  if(!this.terrainReady)this.makeTerrain();this.drawMap(this.terrainMap,!this.terrainUploaded);this.terrainUploaded=true;
  // Cheap instanced contact shadows precede the opaque bodies.
  for(const mark of b.scorches)this.submit('shadow',localMatrix({tx:mark.x,ty:.008,tz:mark.z,sx:mark.radius,sz:mark.radius}),[.16,.14,.11,.3]);
  for(const u of this.drawUnits)this.submit('shadow',localMatrix({tx:u.x,ty:.02,tz:u.z,sx:u.team==='rex'?3.6:2.7,sz:1.05,yaw:u.yaw}),[.12,.14,.1,Math.max(.08,.28-u.y*.025)]);
  const shadow=this.batchMap.get('shadow');if(shadow?.count){gl.depthMask(false);shadow.render(this.program);this.stats.drawCalls++;this.stats.instances+=shadow.count;gl.depthMask(true);shadow.count=0;}
  for(const u of this.drawUnits){const dead=u.hp<=0,settled=dead&&time-u.deadAt>5&&u.y<.05&&u.speed<.2,cached=settled?this.deadCache.get(u.id):null;if(cached){for(const [name,raw] of cached){let batch=this.batchMap.get(name);if(!batch){batch=new Batch(gl,name);this.batchMap.set(name,batch);}batch.appendRaw(raw);}continue;}
   this.recording=settled?[]:null;if(u.team==='rex')this.rex(u,time,dead);else this.digger(u,time,dead);if(this.recording)this.deadCache.set(u.id,this.recording);this.recording=null;
  }
  // Opaque instancing batches share one depth buffer; no per-face CPU sorting.
  this.gpuRiders(time);this.drawMap(this.batchMap);for(const batch of this.batchMap.values())batch.count=0;
  this.gpuEffects(time+this.aftermathTime);this.drawMap(this.batchMap,true,true);
  for(const e of b.effects)if(e.kind==='parry')this.parryEffect(e);
  this.effectsTrails(time);this.contactBursts();this.stunMarks(time);this.trackingMark();this.disasterAtmosphere(time);
  for(const u of this.drawUnits){if(!this.showHealth||u.hp<=0||u.hp>=u.maxHp)continue;const p=this.project(u.x,u.y+(u.team==='rex'?5.8:6.5),u.z),w=Math.max(12,this.scale*2.8);this.ctx.fillStyle='#1d281abb';this.ctx.fillRect(p.x-w/2,p.y,w,3);this.ctx.fillStyle=u.team==='rex'?'#a2b47e':'#d5b277';this.ctx.fillRect(p.x-w/2,p.y,w*Math.max(0,u.hp/u.maxHp),3);}
  this.ctx.restore();this.cpuTotal+=performance.now()-start;this.cpuFrames++;if(this.cpuFrames>=20){this.canvas.dataset.renderCpuMs=(this.cpuTotal/this.cpuFrames).toFixed(2);this.canvas.dataset.drawCalls=String(this.stats.drawCalls);this.canvas.dataset.instances=String(this.stats.instances);this.cpuTotal=this.cpuFrames=0;}
 }
 effectsTrails(time){const c=this.ctx;for(const tip of (this.effectAmount??1)>=.6?this.motionTips:[]){const prev=this.tipHistory.get(tip.id);if(prev&&time-prev.time<.15){const p=this.project(tip.x,tip.y,tip.z),q=this.project(prev.x,prev.y,prev.z);if(Math.hypot(tip.x-prev.x,tip.z-prev.z)<10){c.strokeStyle=tip.team==='dig'?'#f2c78299':'#c9d99c88';c.lineWidth=Math.max(1,this.scale*.22);c.beginPath();c.moveTo(q.x,q.y);c.lineTo(p.x,p.y);c.stroke();}}this.tipHistory.set(tip.id,{...tip,time});}}
}
