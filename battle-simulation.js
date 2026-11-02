import {STEP} from './engine.js';
import {applyBattle} from './battle-wire.js';
export function createBattleSimulation({onState=()=>{},onError=()=>{}}={}){
 let worker=null,battle=null,generation=0,ready=false,pending=false,active=false,accumulator=0,received=0,interval=50;
 const diagnostics={mode:'main',snapshots:0,workerMs:0,inFlight:false};
 const blend=(now=performance.now())=>ready?Math.max(0,Math.min(1,(now-received)/Math.max(16,interval))):1;
 function detach(){generation++;worker?.terminate();worker=null;battle=null;ready=pending=active=false;accumulator=0;diagnostics.mode='main';diagnostics.inFlight=false;}
 function start(next){detach();battle=next;if(typeof Worker==='undefined')return false;
  try{worker=new Worker(new URL('./battle-worker.js',import.meta.url),{type:'module'});}catch(error){onError(error);return false;}
  diagnostics.mode='worker';diagnostics.snapshots=0;const ticket=generation;
  const fail=error=>{if(ticket!==generation)return;worker?.terminate();worker=null;pending=false;diagnostics.mode='error';onError(error);};
  worker.onerror=e=>{e.preventDefault();fail(new Error(e.message||'전투 계산 작업 오류'));};
  worker.onmessage=({data})=>{
   if(data.generation!==generation||ticket!==generation)return;
   if(data.type==='error'){fail(new Error(data.message));return;}
   const now=performance.now(),packet=data.packet,alpha=blend(now);pending=false;diagnostics.inFlight=false;
   accumulator=Math.max(0,accumulator-packet.advanced*STEP);
   if(ready)interval=Math.max(16,Math.min(250,now-received));
   const settled=applyBattle(battle,packet,alpha);received=now;ready=true;
   diagnostics.snapshots++;diagnostics.workerMs=packet.workerMs;onState(battle,settled);
  };
  worker.postMessage({type:'init',generation:ticket,config:next.config});return true;
 }
 function update(delta,speed,running){active=running;
  if(!worker)return false;
  if(!active){accumulator=0;return true;}
  accumulator=Math.min(STEP*240,accumulator+delta*speed);
  if(ready&&!pending&&accumulator>=STEP){pending=true;diagnostics.inFlight=true;
   worker.postMessage({type:'advance',generation,steps:Math.min(8,Math.floor(accumulator/STEP)),budget:battle.units.length>=500?16:20});
  }
  return true;
 }
 return{start,detach,update,blend,get enabled(){return !!worker;},get diagnostics(){return {...diagnostics};},time(now=performance.now()){return battle?.remoteSnapshot?battle.remotePreviousTime+(battle.time-battle.remotePreviousTime)*blend(now):battle?.time||0;}};
}
