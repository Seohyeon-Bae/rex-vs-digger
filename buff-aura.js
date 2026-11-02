import {buffMotion} from './combat-motion.js';
// Bounded, deterministic visual geometry. It never changes model materials or simulation RNG.
export function drawBuffAura(r,u,time){
 const {strength,age}=buffMotion(u,time);if(strength<.01)return;
 r.buffFXCount??=0;r.buffFXTeams??={rex:0,dig:0};if((r.buffFXCount>=40||r.buffFXTeams[u.team]>=20)&&r.selectedId!==u.id)return;
 r.buffFXCount++;r.buffFXTeams[u.team]++;
 const rex=u.team==='rex',low=r.detail===0,radius=(u.stats?.radius||1.7)+.5;
 const color=(rgb,a)=>'rgba('+rgb+','+Math.round(a*strength*24)/24+')';
 const base=rex?'255,151,63':'101,211,255',core=rex?'255,220,132':'212,247,255';
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
 // Small airborne accents; no ground ring or model tint. Far views keep the simpler effect.
 if(!low)for(let i=0;i<3;i++){
  const p=(time*(rex?.65:1.4)+i/3+u.id*.173)%1,a=u.id*.7+i*2.4+time*(rex?.3:-.6),ca=Math.cos(a),sa=Math.sin(a);
  const d=radius+(rex?.15:.08)*Math.sin(p*Math.PI),x=u.x+ca*d,z=u.z+sa*d,y=u.y+.7+p*(rex?3.2:2.5),fade=Math.sin(p*Math.PI);
  if(rex){
   const w=.045+.025*fade,drift=.18*Math.sin(time*3+i);
   r.poly([[x-sa*w,y,z+ca*w],[x+sa*w,y,z-ca*w],[x+drift,y+.16,z]],color(core,.6*fade));
   r.poly([[x-sa*w*.5,y,z+ca*w*.5],[x+sa*w*.5,y,z-ca*w*.5],[x-drift*.5,y-.32,z]],color(base,.22*fade));
  }else{
   const flash=Math.max(0,Math.sin(time*8+i*2.1+u.id));if(flash<.65)continue;
   const w=.035,reach=.25+.16*flash,tip=[x+ca*reach,y+.12,z+sa*reach];
   r.poly([[x-sa*w,y-.08,z+ca*w],[x+sa*w,y+.08,z-ca*w],tip],color(core,.65*fade));
   r.poly([[tip[0]-sa*w,tip[1],tip[2]+ca*w],[tip[0]+sa*w,tip[1],tip[2]-ca*w],[x+ca*(reach+.12),y-.12,z+sa*(reach+.12)]],color(base,.42*fade));
  }
 }
 // One activation burst above the torso, distinct from the sustained effect.
 if(age>.18&&age<1.05){
  const p=(age-.18)/.87,fade=Math.sin(Math.PI*p),count=low?4:8;
  for(let i=0;i<count;i++){
   const a=i/count*Math.PI*2+u.id*.31,ca=Math.cos(a),sa=Math.sin(a),d=radius*(.45+p*.95),x=u.x+ca*d,z=u.z+sa*d,y=u.y+(rex?2.7:3.3)+p*(rex?1.9:.65),w=(rex?.12:.065)*fade;
   if(rex){
    r.poly([[x-sa*w,y,z+ca*w],[x+sa*w,y,z-ca*w],[x-ca*.45,y+.65+fade*.4,z-sa*.45]],color(base,.65*fade));
    if(!low)r.poly([[x-sa*w*.35,y+.1,z+ca*w*.35],[x+sa*w*.35,y+.1,z-ca*w*.35],[x-ca*.2,y+.5,z-sa*.2]],color(core,.7*fade));
   }else{
    const tip=[x+ca*.55,y+.35*(i%2?1:-1),z+sa*.55];
    r.poly([[x-sa*w,y-.04,z+ca*w],[x+sa*w,y+.04,z-ca*w],tip],color(core,.8*fade));
    if(!low)r.poly([[tip[0]-sa*w,tip[1],tip[2]+ca*w],[tip[0]+sa*w,tip[1],tip[2]-ca*w],[x+ca*.95,y-.15,z+sa*.95]],color(base,.6*fade));
   }
  }
 }

}
