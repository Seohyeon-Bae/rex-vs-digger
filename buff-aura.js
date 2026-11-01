import {buffMotion} from './combat-motion.js';
// Bounded, deterministic visual geometry. It never changes model materials or simulation RNG.
export function drawBuffAura(r,u,time){
 const strength=buffMotion(u,time).strength;if(strength<.01)return;
 r.buffFXCount??=0;r.buffFXTeams??={rex:0,dig:0};if((r.buffFXCount>=40||r.buffFXTeams[u.team]>=20)&&r.selectedId!==u.id)return;
 r.buffFXCount++;r.buffFXTeams[u.team]++;
 const rex=u.team==='rex',low=r.detail===0,radius=(u.stats?.radius||1.7)+.5,pulse=.5+.5*Math.sin(time*5+u.id),n=low?6:10;
 const color=(rgb,a)=>'rgba('+rgb+','+Math.round(a*strength*24)/24+')';
 const base=rex?'255,151,63':'101,211,255',core=rex?'255,220,132':'212,247,255';
 for(let i=0;i<n;i++){
  const a=i/n*Math.PI*2+time*(rex?.35:-.8),b=a+(rex?.7:.58)/n*Math.PI*2,inner=radius-.18,outer=radius+.2+pulse*.12,y=u.y+.08;
  r.poly([[u.x+Math.cos(a)*inner,y,u.z+Math.sin(a)*inner],[u.x+Math.cos(a)*outer,y,u.z+Math.sin(a)*outer],[u.x+Math.cos(b)*outer,y,u.z+Math.sin(b)*outer],[u.x+Math.cos(b)*inner,y,u.z+Math.sin(b)*inner]],color(i%3===0?core:base,.3+.13*pulse));
 }
 const streams=low?1:rex?5:3;
 for(let i=0;i<streams;i++){
  const phase=(time*(rex?.8:1.1)+i/streams+u.id*.13)%1,a=time*(rex?.45:-.7)+i*Math.PI*2/streams,ca=Math.cos(a),sa=Math.sin(a),x=u.x+ca*radius,z=u.z+sa*radius,y=u.y+.25+phase*1.8,w=rex?.22:.08,h=(rex?1.6:2.2)*(1-phase)+.5;
  if(rex){
   const lean=.2*Math.sin(time*7+i),tip=[x+ca*(.2+lean),y+h,z+sa*(.2+lean)];
   r.poly([[x-sa*w,y,z+ca*w],[x+sa*w,y,z-ca*w],tip],color(base,.4*Math.sin(Math.PI*phase)));
   if(!low)r.poly([[x-sa*w*.45,y+.1,z+ca*w*.45],[x+sa*w*.45,y+.1,z-ca*w*.45],[tip[0],y+h*.65,tip[2]]],color(core,.35*Math.sin(Math.PI*phase)));
  }else{
   for(let k=0;k<(low?2:3);k++){
    const bend=(k%2?1:-1)*.22*Math.sin(time*6+i),px=x+sa*bend,pz=z-ca*bend,qx=x-sa*bend,qz=z+ca*bend,py=y+h*k/3,qy=y+h*(k+1)/3;
    r.poly([[px-sa*w,py,pz+ca*w],[px+sa*w,py,pz-ca*w],[qx+sa*w,qy,qz-ca*w],[qx-sa*w,qy,qz+ca*w]],color(k===1?core:base,.38*(1-phase*.65)));
   }
  }
 }
}
