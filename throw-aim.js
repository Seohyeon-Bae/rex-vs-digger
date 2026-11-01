import {groundThrowAim} from './ground-throw.js';
// Local experiment. Uses the engine's discrete gravity and airborne drag;
// the victim receives one release velocity and is never steered in flight.
const DT=1/30,DRAG=Math.exp(-.8*DT);
export function throwFlight(height,vy){
 let y=height,gain=0,decay=1,steps=0;
 do{y+=vy*DT;vy-=18*DT;gain+=decay*DT;decay*=DRAG;steps++;}while(y>0&&steps<120);
 return{time:steps*DT,gain};
}
export function chooseThrowAim(b,holder,victim){return groundThrowAim(b,holder,victim);}
