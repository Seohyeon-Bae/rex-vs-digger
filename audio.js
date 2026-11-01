// CC0 Foley-based effects and original score. See assets/audio/CREDITS.txt.
const MUSIC='rockin-140-score';
const COUNTS={'rex-step':3,track:3,charge:3,bite:3,'tail-swing':3,'body-hit':3,'metal-hit':3,hydraulic:3,parry:3,explosion:3,land:3,engine:2,'engine-rev':2,'rex-pain':3,'rex-growl':2,'rex-roar':2};
const PRIORITY={explosion:6,parry:5,land:4,'metal-hit':4,'rex-pain':4,bite:3,'body-hit':3,charge:3,'rex-roar':3,'tail-swing':2,hydraulic:2,'engine-rev':2,'rex-growl':2,engine:1,'rex-step':1,track:1};
const LEVEL={explosion:.95,parry:.64,land:.7,'metal-hit':.62,bite:.45,'body-hit':.56,charge:.28,'tail-swing':.2,hydraulic:.18,engine:.21,'engine-rev':.21,'rex-pain':.47,'rex-growl':.3,'rex-roar':.38,'rex-step':.19,track:.1};
const GAP={explosion:85,parry:85,land:130,'metal-hit':80,bite:90,'body-hit':90,charge:260,'tail-swing':200,hydraulic:230,engine:3500,'engine-rev':2600,'rex-pain':550,'rex-growl':8500,'rex-roar':22000,'rex-step':160,track:280};
const clamp=(n,min,max,fallback)=>Number.isFinite(Number(n))?Math.max(min,Math.min(max,Number(n))):fallback;
const clock=()=>globalThis.performance?.now?.()??Date.now();
const ACTIVE=new Set(['running','finishing']);

export class BattleAudio {
 constructor({onError=()=>{},AudioContext:Context}={}){
  this.onError=onError;this.Context=Context;this.settings={master:.8,sfx:1,music:.28,muted:true};
  this.context=null;this.buffers=new Map();this.encoded=new Map();this.voices=[];this.seenEffects=new WeakSet();this.seenActions=new WeakSet();this.height=new Map();this.lastHp=new Map();this.lastPain=new Map();this.lastRev=new Map();this.lastKinds=new Map();this.groups=new Map();this.lastVariants=new Map();
  this.state='ready';this.battle=null;this.renderer=null;this.musicSource=null;this.musicStarts=0;this.scanAt=0;this.ambienceAt=0;this.tokens=18;this.tokenAt=clock();this.errors=[];this.played=0;this.dropped=0;this.peakVoices=0;this.lastCandidates=[];this.disposed=false;
  this.preloadPromise=this.preload();
 }
 fail(error){const message=error instanceof Error?error.message:String(error);if(!this.errors.includes(message)){this.errors.push(message);console.error('[BattleAudio]',message);this.onError(message);}return error;}
 async preload(){
  this.musicReadyPromise=fetch(new URL('./assets/audio/'+MUSIC+'.wav',import.meta.url)).then(async response=>{if(!response.ok)throw new Error('배경음악 불러오기 실패');this.encoded.set(MUSIC,await response.arrayBuffer());});
  const files=Object.entries(COUNTS).flatMap(([name,count])=>Array.from({length:count},(_,i)=>`${name}-${i+1}`));
  const results=await Promise.allSettled([this.musicReadyPromise,...files.map(async key=>{const response=await fetch(new URL(`./assets/audio/${key}.wav${key.startsWith('engine-')?'?v=heavy-engine-182':''}`,import.meta.url));if(!response.ok)throw new Error(`소리 파일 불러오기 실패: ${key} (${response.status})`);this.encoded.set(key,await response.arrayBuffer());})]);
  for(const r of results)if(r.status==='rejected')this.fail(r.reason);return this.encoded.size;
 }
 async unlock(){
  if(this.disposed)return false;
  try{
   if(!this.context){const Context=this.Context||globalThis.AudioContext||globalThis.webkitAudioContext;if(!Context)throw new Error('이 브라우저는 Web Audio를 지원하지 않습니다.');const c=this.context=new Context();
    this.master=c.createGain();this.sfx=c.createGain();this.music=c.createGain();this.musicFade=c.createGain();this.limiter=c.createDynamicsCompressor();this.output=c.createGain();
    this.master.gain.value=this.settings.muted||this.background?0:this.settings.master;this.sfx.gain.value=this.settings.sfx*1.7;this.music.gain.value=this.settings.music;this.musicFade.gain.value=0;this.output.gain.value=.72;
    this.limiter.threshold.value=-12;this.limiter.knee.value=8;this.limiter.ratio.value=10;this.limiter.attack.value=.003;this.limiter.release.value=.18;
    this.musicFade.connect(this.music).connect(this.master);const bass=c.createBiquadFilter(),presence=c.createBiquadFilter(),space=c.createDelay(.2),wet=c.createGain();bass.type='lowshelf';bass.frequency.value=140;bass.gain.value=4.5;presence.type='peaking';presence.frequency.value=2200;presence.Q.value=.7;presence.gain.value=1.6;space.delayTime.value=.085;wet.gain.value=.1;this.sfx.connect(bass).connect(presence).connect(this.master);presence.connect(space).connect(wet).connect(this.master);this.master.connect(this.limiter).connect(this.output).connect(c.destination);
   }
   // Resume synchronously in the gesture call stack, before any asset await.
   await this.context.resume();await this.musicReadyPromise;
   if(!this.musicDecodePromise)this.musicDecodePromise=this.context.decodeAudioData(this.encoded.get(MUSIC).slice(0)).then(buffer=>{this.buffers.set(MUSIC,buffer);this.encoded.delete(MUSIC);});await this.musicDecodePromise;
   if(!this.decodePromise)this.decodePromise=this.preloadPromise.then(()=>this.decode()).catch(error=>this.fail(error));
   this.syncMusic();return this.context.state==='running';
  }catch(error){this.fail(error);return false;}
 }
 async decode(){
  const results=await Promise.allSettled([...this.encoded].map(async([key,bytes])=>{try{this.buffers.set(key,await this.context.decodeAudioData(bytes.slice(0)));}catch{throw new Error(`소리 파일 해독 실패: ${key}`);}}));
  for(const r of results)if(r.status==='rejected')this.fail(r.reason);this.encoded.clear();
  if(!this.buffers.has(MUSIC))this.fail(new Error('배경음악을 준비하지 못했습니다.'));return this.buffers.size;
 }
 setSettings(settings={}){
  const wasMuted=this.settings.muted;
  for(const key of ['master','sfx','music'])if(settings[key]!==undefined)this.settings[key]=clamp(settings[key],0,1,this.settings[key]);
  if(settings.muted!==undefined)this.settings.muted=!!settings.muted;
  if(wasMuted&&!this.settings.muted&&this.battle)this.lastHp=new Map(this.battle.units.map(u=>[u.id,u.hp]));
  if(this.context){const t=this.context.currentTime;for(const [bus,value] of [[this.master,this.settings.muted||this.background?0:this.settings.master],[this.sfx,this.settings.sfx*1.7],[this.music,this.settings.music]]){bus.gain.cancelScheduledValues(t);bus.gain.setTargetAtTime(value,t,.035);}this.syncMusic();}
 }
 resetBattle(battle){this.battle=battle;this.seenEffects=new WeakSet();this.seenActions=new WeakSet();this.height.clear();this.lastHp=new Map(battle.units.map(u=>[u.id,u.hp]));this.lastPain.clear();this.lastRev.clear();this.scanAt=0;this.ambienceAt=clock()+1200;this.vocalAt=clock()+6500;this.roarAt=clock()+12000;this.lastCandidates=[];this.groups.clear();this.stopVoices(true);}
 stopVoices(immediate=false){for(const voice of [...this.voices])this.stopVoice(voice,immediate);}
 stopVoice(voice,immediate=false){if(voice.stopping&&!immediate)return;voice.stopping=true;const t=this.context.currentTime;voice.gain.gain.cancelScheduledValues(t);if(immediate){voice.gain.gain.value=0;try{voice.source.stop();}catch{}voice.source.disconnect();voice.gain.disconnect();voice.pan?.disconnect();this.voices=this.voices.filter(v=>v!==voice);}else{voice.gain.gain.setTargetAtTime(0,t,.008);try{voice.source.stop(t+.04);}catch{}}}
 setBackground(hidden){
  this.background=!!hidden;const c=this.context;if(!c)return;
  if(hidden&&this.musicSource){this.musicOffset=((this.musicOffset||0)+c.currentTime-(this.musicStartedAt||0))%(this.musicSource.buffer.duration||1);try{this.musicSource.stop();}catch{}this.musicSource.disconnect();this.musicSource=null;}
  this.syncMusic();if(hidden){this.stopVoices(true);if(this.master){this.master.gain.cancelScheduledValues(c.currentTime);this.master.gain.value=0;}}
  else if(this.master){this.master.gain.cancelScheduledValues(c.currentTime);this.master.gain.setTargetAtTime(this.settings.muted?0:this.settings.master,c.currentTime,.035);}
 }
 syncMusic(){
  const c=this.context;if(!c)return;const active=ACTIVE.has(this.state)&&!this.settings.muted&&!this.background;
  if(active&&!this.musicSource&&this.buffers.has(MUSIC)){const source=c.createBufferSource();source.buffer=this.buffers.get(MUSIC);source.loop=true;source.connect(this.musicFade);source.start(0,this.musicOffset||0);this.musicStartedAt=c.currentTime;this.musicSource=source;this.musicStarts++;}
  if(this.background){this.musicFade.gain.cancelScheduledValues(c.currentTime);this.musicFade.gain.value=0;}if(this.musicActive!==active){this.musicActive=active;this.musicFade.gain.cancelScheduledValues(c.currentTime);this.musicFade.gain.setTargetAtTime(active?.64:0,c.currentTime,active?.025:this.background?.001:.22);if(!active)this.stopVoices();}
 }
 distance(x,z){const r=this.renderer,dx=(x??r?.focusX??0)-(r?.focusX||0),dz=(z??r?.focusZ??0)-(r?.focusZ||0),distance=Math.hypot(dx,dz),reach=Math.max(22,Math.min(75,(this.battle?.radius||36)*.55/(Math.max(.7,r?.zoom||1))));return {distance,gain:1/(1+(distance/reach)**2),pan:Math.max(-.85,Math.min(.85,(dx*Math.cos(r?.yaw||0)-dz*Math.sin(r?.yaw||0))/reach*.65))};}
 play(kind,{x,z,strength=1,volume=1,rate=1,priority=PRIORITY[kind]||2}={}){
  if(kind==='start'||kind==='end')return false;
  const c=this.context;if(!c||c.state!=='running'||this.settings.muted||this.background||!ACTIVE.has(this.state)||this.disposed)return false;
  const now=clock(),spatial=this.distance(x,z),gap=GAP[kind]||100;
  if(spatial.gain<.045){this.dropped++;return false;}
  const last=this.lastKinds.get(kind)??-Infinity,cell=`${kind}:${Math.round((x||0)/12)}:${Math.round((z||0)/12)}`;
  if(now-last<gap||now-(this.groups.get(cell)??-Infinity)<gap*2){this.dropped++;return false;}
  this.tokens=Math.min(22,this.tokens+(now-this.tokenAt)*.024);this.tokenAt=now;
  if(this.tokens<1&&priority<5){this.dropped++;return false;}
  // Important contacts may replace a quieter, lower-priority active sound.
  if(this.voices.length>=18){const victim=[...this.voices].sort((a,b)=>a.priority-b.priority||a.level-b.level)[0];if(victim.priority>=priority){this.dropped++;return false;}this.stopVoice(victim,true);}
  const count=COUNTS[kind];if(!count)return false;let variant=1+Math.floor(Math.random()*count);if(count>1&&variant===this.lastVariants.get(kind))variant=variant%count+1;const buffer=this.buffers.get(`${kind}-${variant}`);if(!buffer)return false;
  this.lastVariants.set(kind,variant);this.lastKinds.set(kind,now);this.groups.set(cell,now);if(this.groups.size>256)for(const [key,t]of this.groups)if(now-t>2000)this.groups.delete(key);this.tokens=Math.max(-3,this.tokens-1);
  const source=c.createBufferSource(),gain=c.createGain(),pan=c.createStereoPanner?.(),level=(LEVEL[kind]||.3)*spatial.gain*clamp(strength,.4,1.5,1)*volume;
  source.buffer=buffer;source.playbackRate.value=(kind==='explosion'?.82:kind==='body-hit'?.9:kind==='metal-hit'?.94:kind==='parry'?1.08:1)*clamp(rate,.8,1.2,1);gain.gain.value=level;source.connect(gain);if(pan){pan.pan.value=spatial.pan;gain.connect(pan).connect(this.sfx);}else gain.connect(this.sfx);
  const voice={source,gain,pan,priority,level};this.voices.push(voice);this.peakVoices=Math.max(this.peakVoices,this.voices.length);source.onended=()=>{this.voices=this.voices.filter(v=>v!==voice);source.disconnect();gain.disconnect();pan?.disconnect();};source.start();this.played++;return true;
 }
 update(battle,renderer,state){
  if(this.disposed)return;if(battle!==this.battle)this.resetBattle(battle);this.renderer=renderer;this.state=state;this.syncMusic();
  if(!ACTIVE.has(state)||this.settings.muted||!this.context||this.context.state!=='running')return;
  const now=clock(),cues=[];
  // Effects carry stable object identity until they expire. Never replay them
  // when one render frame consumes several simulation ticks or at 4x speed.
  for(const e of battle.effects){if(this.seenEffects.has(e))continue;this.seenEffects.add(e);let kind;
   if(e.kind==='explosion')kind='explosion';else if(e.kind==='parry')kind='parry';else if(e.kind==='step')kind=e.team==='rex'?'rex-step':'track';else if(e.kind==='collapse')kind='land';else if(e.kind==='impact'){kind=e.y<.3&&e.strength>=1.7?'land':e.team==='dig'?'metal-hit':'body-hit';if(kind==='metal-hit'){const attacker=this.lastCandidates.find(u=>u.team==='rex'&&u.action?.kind==='bite'&&Math.hypot(u.x-e.x,u.z-e.z)<9);if(attacker)kind='bite';}}else continue;
   const d=this.distance(e.x,e.z);cues.push({kind,x:e.x,z:e.z,rate:e.critical?.94:1,volume:e.critical?1.1:1,strength:Math.min(1.4,.7+e.strength*.22),priority:PRIORITY[kind],rank:(PRIORITY[kind]||1)*10+d.gain});
  }
  // Only the nearest dozen units are examined for preparation and ambience;
  // this stays bounded even for a 1,000 vs 1,000 battle.
  if(now>=this.scanAt){this.scanAt=now+90;const nearby=[],pain=[];for(const u of battle.units){const d=this.distance(u.x,u.z),oldHp=this.lastHp.get(u.id)??u.hp;this.lastHp.set(u.id,u.hp);if(u.team==='rex'&&oldHp>u.hp&&oldHp>0&&now-(this.lastPain.get(u.id)??-Infinity)>1800&&d.gain>.18){pain.push({u,distance:d.distance,loss:oldHp-u.hp});pain.sort((a,b)=>a.distance-b.distance);if(pain.length>3)pain.pop();}if(u.hp<=0)continue;if(nearby.length<12||d.distance<nearby.at(-1).distance){nearby.push({u,distance:d.distance});nearby.sort((a,b)=>a.distance-b.distance);if(nearby.length>12)nearby.pop();}}
   // HP loss is authoritative: misses, parries and landing FX cannot trigger pain.
   for(const {u,loss}of pain)cues.push({kind:'rex-pain',x:u.x,z:u.z,strength:.78+Math.min(.5,loss/u.maxHp*2.2),volume:.88+Math.random()*.2,priority:4,rank:42-this.distance(u.x,u.z).distance*.01,painId:u.id});
   this.lastCandidates=nearby.map(p=>p.u);for(const {u}of nearby){const a=u.action;if(a&&!this.seenActions.has(a)){this.seenActions.add(a);let kind=u.team==='dig'?'hydraulic':a.kind==='ram'?'charge':['tail','leap','pounce'].includes(a.kind)?'tail-swing':null;if(kind)cues.push({kind,x:u.x,z:u.z,rate:u.team==='dig'?({spin:.86,sweep:1.15,uppercut:1.06,grapple:.9}[a.kind]||1):1,strength:1,priority:PRIORITY[kind],rank:20});if(u.team==='dig'&&now-(this.lastRev.get(u.id)??-Infinity)>6500){this.lastRev.set(u.id,now);cues.push({kind:'engine-rev',x:u.x,z:u.z,strength:.9,priority:2,rank:21});}}const old=this.height.get(u.id);if(old>1&&u.y<.1)cues.push({kind:'land',x:u.x,z:u.z,strength:1.1,priority:4,rank:40});this.height.set(u.id,u.y);}
   if(now>=this.ambienceAt&&nearby.length){this.ambienceAt=now+4400+Math.random()*2200;const u=nearby.find(p=>p.u.team==='dig')?.u;if(u)cues.push({kind:'engine',x:u.x,z:u.z,strength:1,priority:1,rank:10});}
   if(now>=this.vocalAt){this.vocalAt=now+10000+Math.random()*7000;const u=nearby.find(p=>p.u.team==='rex')?.u;if(u){const roar=now>=this.roarAt;if(roar)this.roarAt=now+25000+Math.random()*14000;cues.push({kind:roar?'rex-roar':'rex-growl',x:u.x,z:u.z,strength:.9+Math.random()*.15,priority:roar?3:2,rank:roar?31:22});}}
  }
  cues.sort((a,b)=>b.rank-a.rank);let emitted=0;for(const cue of cues){if(emitted>=5){this.dropped++;continue;}if(this.play(cue.kind,cue)){emitted++;if(cue.painId!==undefined)this.lastPain.set(cue.painId,now);}}
 }
 get diagnostics(){return {soundSet:'licensed-rock-predator-1.8.0',contextState:this.context?.state||'locked',assets:this.buffers.size,loading:this.encoded.size,voices:this.voices.length,voiceLimit:18,peakVoices:this.peakVoices,musicPlaying:!!this.musicSource&&this.musicActive,musicSources:this.musicSource?1:0,musicStarts:this.musicStarts,played:this.played,dropped:this.dropped,errors:[...this.errors]};}
 dispose(){this.disposed=true;this.stopVoices();try{this.musicSource?.stop();}catch{}this.musicSource?.disconnect();this.musicSource=null;this.context?.close();}
}
