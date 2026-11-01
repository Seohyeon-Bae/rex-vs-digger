const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2];
// A physical camera inside the arena. Its perspective is shared by both renderers.
export function fieldView(r){
 const target=[r.focusX,2.5,r.focusZ],side=r.fieldSide||1,edge=Math.max(12,r.battle.radius-5),origin=r.fieldOrigins?.[side]||[side===1?-edge:edge,12,side===1?-10:10];
 // Keep both existing starting positions, then use the previous spherical orbit/dolly controls.
 const originHeight=origin[1]-2.5,originDistance=Math.hypot(origin[0],originHeight,origin[2]),yaw=r.yaw-(side===1?.8+Math.PI:.8)+Math.atan2(origin[0],origin[2]),elev=clamp(r.elev-.48+Math.asin(originHeight/originDistance),.12,1.48),distance=originDistance/clamp(r.zoom,.55,4),horizontal=distance*Math.cos(elev);
 const eye=[clamp(target[0]+Math.sin(yaw)*horizontal,-edge,edge),target[1]+Math.max(8,distance*Math.sin(elev)),clamp(target[2]+Math.cos(yaw)*horizontal,-edge,edge)];
 const delta=eye.map((n,i)=>n-target[i]),length=Math.hypot(...delta),depth=delta.map(n=>n/length),flat=Math.hypot(depth[0],depth[2]),right=flat>.00001?[depth[2]/flat,0,-depth[0]/flat]:[Math.cos(r.yaw),0,-Math.sin(r.yaw)],up=[depth[1]*right[2],depth[2]*right[0]-depth[0]*right[2],-depth[1]*right[0]];
 return{eye,target,right,up,depth,distance:length,focal:Math.min(r.height*.96,r.width*1.15),width:r.width,height:r.height,near:1.2};
}
export function projectField(view,x,y,z){
 const relative=[x-view.target[0],y-view.target[1],z-view.target[2]],d=dot(relative,view.depth),depth=view.distance-d,scale=view.focal/Math.max(view.near,depth);
 return{x:view.width*.5+dot(relative,view.right)*scale,y:view.height*.56-dot(relative,view.up)*scale,d,depth,visible:depth>=view.near-.00001,scale};
}
export function fieldGround(view,x,y){
 const sx=(x-view.width*.5)/view.focal,sy=(view.height*.56-y)/view.focal,ray=view.right.map((n,i)=>n*sx+view.up[i]*sy-view.depth[i]);
 if(ray[1]>=-.025)return null;const t=-view.eye[1]/ray[1];return{x:view.eye[0]+ray[0]*t,z:view.eye[2]+ray[2]*t};
}
export function clipFieldPolygon(points,view){
 const depth=p=>view.distance-dot(p.map((n,i)=>n-view.target[i]),view.depth),out=[];
 for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length],da=depth(a),db=depth(b),inside=da>=view.near;if(inside)out.push(a);if(inside!==(db>=view.near)){const t=(view.near-da)/(db-da);out.push(a.map((n,k)=>n+(b[k]-n)*t));}}
 return out;
}
