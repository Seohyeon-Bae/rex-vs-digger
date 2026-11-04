const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const smoothGuideProgress=k=>{k=clamp(k,0,1);return k*k*(3-2*k);};
export function guideExplanationLayout(rect,width,height,viewport,previousSide,avoid=[]){
 const m=12,gap=14,W=Math.min(width,viewport.width-m*2),H=height;
 const x=clamp((rect.left+rect.right-W)/2,m,viewport.width-W-m),y=clamp(rect.top,m,viewport.height-H-m);
 const choices={below:{left:x,top:rect.bottom+gap},above:{left:x,top:rect.top-H-gap},right:{left:rect.right+gap,top:y},left:{left:rect.left-W-gap,top:y}};
 const order=viewport.width>=900?['right','left','below','above']:['below','above','right','left'];
 if(previousSide&&choices[previousSide])order.unshift(previousSide);
 for(const side of order){const p=choices[side];if(p.left>=m&&p.top>=m&&p.left+W<=viewport.width-m&&p.top+H<=viewport.height-m)return{...p,width:W,side,fits:true};}
 const corners=[{left:m,top:m},{left:viewport.width-W-m,top:m},{left:m,top:Math.max(m,viewport.height-H-m)},{left:viewport.width-W-m,top:Math.max(m,viewport.height-H-m)}];
 const cost=p=>avoid.reduce((sum,a)=>sum+Math.max(0,Math.min(p.left+W,a.right)-Math.max(p.left,a.left))*Math.max(0,Math.min(p.top+H,a.bottom)-Math.max(p.top,a.top)),0);
 const best=corners.reduce((a,b)=>cost(a)<=cost(b)?a:b);
 return{...best,width:W,side:'inset',fits:H<=viewport.height-m*2};
}
