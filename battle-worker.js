import {BattleWorkerCore} from './battle-worker-core.js';
const core=new BattleWorkerCore();
self.onmessage=({data})=>{try{
 const packet=data.type==='init'?core.init(data.config):core.advance(data.steps,data.budget);
 self.postMessage({type:'state',generation:data.generation,packet},[packet.numbers.buffer]);
}catch(error){self.postMessage({type:'error',generation:data.generation,message:String(error?.message||error),stack:String(error?.stack||'')});}};
