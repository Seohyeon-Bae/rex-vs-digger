import {Battle} from './engine.js';
import {CharacterRenderer} from './character-guide.js';
const cache=new Map();let renderer,canvas;
export function unitPortrait(team,config,dead=false){
 const key=team+config[team+'Skill']+(dead?'dead':'alive');if(cache.has(key))return cache.get(key);
 if(!renderer){const host=document.createElement('div');host.style.cssText='position:fixed;left:-10000px;top:0;width:108px;height:72px;visibility:hidden;pointer-events:none';host.setAttribute('aria-hidden','true');canvas=document.createElement('canvas');canvas.style.cssText='width:108px;height:72px;display:block';host.append(canvas);document.body.append(host);renderer=new CharacterRenderer(canvas,new Battle({...config,rex:1,dig:1}),{transparent:true});renderer.portrait=true;}
 renderer.show(team,config);renderer.yaw=0;renderer.elev=.18;renderer.zoom=1.08;
 if(dead)Object.assign(renderer.unit,{hp:0,deadAt:-10,roll:team==='rex'?1.45:1.65,prevRoll:team==='rex'?1.45:1.65,deathSide:1,exploded:team==='dig'});
 renderer.resize();const image=document.createElement('canvas');image.width=canvas.width;image.height=canvas.height;const context=image.getContext('2d');
 const draw=time=>{renderer.draw(time);context.clearRect(0,0,image.width,image.height);if(renderer.gpuCanvas)context.drawImage(renderer.gpuCanvas,0,0);context.drawImage(canvas,0,0);};draw(0);
 const pixels=context.getImageData(0,0,image.width,image.height).data;let left=image.width,top=image.height,right=-1,bottom=-1;
 for(let y=0;y<image.height;y++)for(let x=0;x<image.width;x++)if(pixels[(y*image.width+x)*4+3]>8){left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);}
 if(right<left){left=0;top=0;right=image.width-1;bottom=image.height-1;}
 left=Math.max(0,left-5);top=Math.max(0,top-5);right=Math.min(image.width-1,right+5);bottom=Math.min(image.height-1,bottom+5);
 const frames=dead?1:12,sheet=document.createElement('canvas');sheet.width=64*frames;sheet.height=48;const out=sheet.getContext('2d'),w=right-left+1,h=bottom-top+1,scale=Math.min(60/w,44/h),dw=w*scale,dh=h*scale;
 for(let i=0;i<frames;i++){const phase=i/11*Math.PI*2;if(!dead)renderer.unit.yaw=Math.sin(phase)*.1;draw(dead?0:phase/3);out.drawImage(image,left,top,w,h,i*64+(64-dw)/2,(48-dh)/2,dw,dh);}
 const data=sheet.toDataURL('image/png');cache.set(key,data);return data;
}
