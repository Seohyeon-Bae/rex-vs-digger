const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const smoothGuideProgress=k=>{k=clamp(k,0,1);return k*k*(3-2*k);};
export function guideExplanationLayout(rect,width,height,viewport,previousSide){
 const m=12,gap=14,W=Math.min(width,viewport.width-m*2),H=height;
 const x=clamp((rect.left+rect.right-W)/2,m,viewport.width-W-m),y=clamp(rect.top,m,viewport.height-H-m);
 const choices={below:{left:x,top:rect.bottom+gap},above:{left:x,top:rect.top-H-gap},right:{left:rect.right+gap,top:y},left:{left:rect.left-W-gap,top:y}};
 const order=viewport.width>=900?['right','left','below','above']:['below','above','right','left'];
 if(previousSide&&choices[previousSide])order.unshift(previousSide);
 for(const side of order){const p=choices[side];if(p.left>=m&&p.top>=m&&p.left+W<=viewport.width-m&&p.top+H<=viewport.height-m)return{...p,width:W,side,fits:true};}
 // Keep the target intact even if a very short viewport cannot hold both at once.
 return{...choices.below,width:W,side:'below',fits:false};
}
