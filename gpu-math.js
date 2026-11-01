import {rollFrame} from './combat-motion.js';
export const identity=()=>new Float32Array([1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]);
export function multiply(a,b){const out=new Float32Array(16);for(let c=0;c<4;c++)for(let r=0;r<4;r++)out[c*4+r]=a[r]*b[c*4]+a[4+r]*b[c*4+1]+a[8+r]*b[c*4+2]+a[12+r]*b[c*4+3];return out;}
// Reuse one scratch matrix for the many boxes submitted per frame.
export function boxMatrix(out,a,x,y,z,w,h,d,rz=0){const c=Math.cos(rz),s=Math.sin(rz),xx=Math.fround(c*w),xy=Math.fround(s*w),yx=Math.fround(-s*h),yy=Math.fround(c*h),zz=Math.fround(d),tx=Math.fround(x),ty=Math.fround(y),tz=Math.fround(z);for(let r=0;r<4;r++){out[r]=a[r]*xx+a[4+r]*xy;out[4+r]=a[r]*yx+a[4+r]*yy;out[8+r]=a[8+r]*zz;out[12+r]=a[r]*tx+a[4+r]*ty+a[8+r]*tz+a[12+r];}return out;}
export function localMatrix({tx=0,ty=0,tz=0,sx=1,sy=1,sz=1,yaw=0,rz=0,shearXY=0,shearZY=0}={}){
 const cy=Math.cos(yaw),syaw=Math.sin(yaw),cz=Math.cos(rz),sr=Math.sin(rz);
 return new Float32Array([cy*cz*sx,sr*sx,syaw*cz*sx,0,(-cy*sr+shearXY)*sy,cz*sy,(-syaw*sr+shearZY)*sy,0,-syaw*sz,0,cy*sz,0,tx,ty,tz,1]);
}
export function poseMatrix(u,extraPitch=0,extraYaw=0){
 const p=u.pitch+extraPitch,r=u.roll,y=u.yaw+extraYaw,cp=Math.cos(p),sp=Math.sin(p),cr=Math.cos(r),sr=Math.sin(r),cy=Math.cos(y),sy=Math.sin(y),pivot=u.team==='rex'?(u.action?.kind==='pounce'&&u.action.landAt!=null?2.2:1.4):1.1,scale=u.scale||1;
 const rotation=new Float32Array([cy*cp-sy*sr*sp,cr*sp,sy*cp+cy*sr*sp,0,-cy*sp-sy*sr*cp,cr*cp,-sy*sp+cy*sr*cp,0,-sy*cr,-sr,cy*cr,0,u.x,u.y+pivot+Math.abs(sr)*.55+(u.team==='rex'&&u.action?.kind==='pounce'&&u.action.landAt!=null?rollFrame(u.action).lift:Math.abs(sp)*.4),u.z,1]);
 return multiply(rotation,localMatrix({ty:-pivot,sx:scale,sy:scale,sz:scale}));
}
export function point(m,x,y,z){return [m[0]*x+m[4]*y+m[8]*z+m[12],m[1]*x+m[5]*y+m[9]*z+m[13],m[2]*x+m[6]*y+m[10]*z+m[14]];}
export function segmentMatrix(a,b){const dx=b[0]-a[0],dy=b[1]-a[1],dz=b[2]-a[2],len=Math.hypot(dx,dy,dz)||1,ux=dx/len,uy=dy/len,uz=dz/len;let vx=-uy,vy=ux,vz=0,vl=Math.hypot(vx,vy);if(vl<.01){vx=0;vy=1;vl=1;}vx/=vl;vy/=vl;return new Float32Array([dx,dy,dz,0,vx,vy,vz,0,-uz*vy,uz*vx,ux*vy-uy*vx,0,...a,1]);}
