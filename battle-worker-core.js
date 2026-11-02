import {Battle} from './engine.js';
import {createWireState,packBattle} from './battle-wire.js';
export class BattleWorkerCore{
 init(config){this.battle=new Battle(config);this.battle.event('전투 시작');this.wire=createWireState();return this.snapshot(0,0);}
 advance(steps,budget=20){const b=this.battle,start=performance.now();let advanced=0;
  while(advanced<steps&&(advanced===0||performance.now()-start<budget)){
   if(b.done){if(b.time-b.combatTime>2)break;b.settleStep();}else b.step();advanced++;
  }
  return this.snapshot(advanced,performance.now()-start);
 }
 snapshot(advanced,ms){return{...packBattle(this.battle,this.wire),advanced,workerMs:ms};}
}
