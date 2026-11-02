// Play guide. Each tile shows the real control's icon. Pressing a tile closes the guide and plays the example on the
// real screen: a clean demo stage is set up, a pointer clicks or gestures on the real controls step by step (with an
// indicator for the input in use), the real result appears, and every loop starts again from the same stage.
// Closing the example puts the player's own setup back.
import {icon} from './icons.js';

const plain=body=>`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`;
const frame='<path d="M3 8V4.5A1.5 1.5 0 0 1 4.5 3H8M16 3h3.5A1.5 1.5 0 0 1 21 4.5V8M21 16v3.5a1.5 1.5 0 0 1-1.5 1.5H16M8 21H4.5A1.5 1.5 0 0 1 3 19.5V16"/>';
// Line icons in the icons.js stroke style, for guide items whose control has no icon of its own.
const GUIDE_ICONS={
 auto:plain(frame+'<circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>'),
 dynamic:plain(frame+'<path d="M12 6.2l1.6 4.2 4.2 1.6-4.2 1.6L12 17.8l-1.6-4.2L6.2 12l4.2-1.6z" fill="currentColor" stroke-width="1.2"/>'),
 'g-hp':plain('<rect x="3" y="9" width="18" height="6" rx="3"/><rect x="3" y="9" width="11" height="6" rx="3" fill="currentColor" stroke="none"/><path d="M12 3.5v3M10.5 5h3"/>'),
 'g-log':plain('<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="12" r="1.2" fill="currentColor" stroke="none"/><circle cx="4.5" cy="18" r="1.2" fill="currentColor" stroke="none"/>'),
 'g-shake':plain('<rect x="7" y="6" width="10" height="12" rx="2"/><path d="M4 9v6M20 9v6M2 11v2M22 11v2"/>'),
 'g-recent':plain('<path d="M3.5 12a8.5 8.5 0 1 0 2.5-6"/><path d="M3 4v4h4"/><path d="M12 8v4.5l3 2"/>'),
 'g-info':plain('<circle cx="12" cy="12" r="9"/><path d="M12 11v6"/><circle cx="12" cy="7.6" r="1.2" fill="currentColor" stroke="none"/>')
};
const dialog=document.getElementById('helpDialog');
for(const el of dialog?.querySelectorAll('[data-gi]')||[])el.innerHTML=GUIDE_ICONS[el.dataset.gi]||icon(el.dataset.gi);

const coarse=matchMedia('(pointer:coarse)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const $=id=>document.getElementById(id);
const shown=el=>{if(!el)return false;const r=el.getBoundingClientRect();return r.width>2&&r.height>2&&getComputedStyle(el).visibility!=='hidden';};
const first=list=>{for(const s of list){const el=typeof s==='function'?s():document.querySelector(s);if(shown(el))return el;}return null;};
const labelWith=text=>()=>[...document.querySelectorAll('label')].find(l=>l.textContent.includes(text)&&shown(l));
const game=()=>globalThis.matchup?.renderer,state=()=>globalThis.matchup?.state;
// Clicks carry the target's own position: the game closes a window on clicks outside it, and a bare click() reports 0,0.
const tap=selector=>{const el=typeof selector==='function'?selector():document.querySelector(selector);if(!el||el.disabled)return;const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,view:window,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));};
const wait=ms=>new Promise(done=>setTimeout(done,ms));
const closeOtherDialogs=()=>document.querySelectorAll('dialog[open]').forEach(d=>{if(d!==dialog)d.close();});
const setCounts=(rex,dig)=>{for(const [id,v] of [['rexCount',rex],['digCount',dig]]){const el=$(id);if(el&&v!=null&&el.value!==String(v)){el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));}}};
const ARENA=['#arena','#battlefield'];
const STEP=1700,DEMO_SIZE=5;

// Where the pointer goes: a selector, a function, the unit nearest the battlefield centre, or the centre itself.
const unitPoint=()=>{const r=game();if(!r)return null;const W=r.width/2,H=r.height/2;let best=null,d=Infinity;for(const u of r.battle.units){if(u.hp<=0)continue;const p=r.project(u.x,u.y+2,u.z),e=Math.hypot(p.x-W,p.y-H);if(e<d){d=e;best=p;}}return best;};
const ease=(ms,step)=>new Promise(done=>{const t0=performance.now(),me=tour;const tick=now=>{if(tour!==me)return done();const k=Math.min(1,(now-t0)/ms);step(k);k<1?requestAnimationFrame(tick):done();};requestAnimationFrame(tick);});
// Real pointer and wheel input on a control (the character model canvas): a drag across, or a few wheel notches.
const dragOn=(selector,dx,ms,shift)=>{const el=document.querySelector(selector);if(!el)return;const r=el.getBoundingClientRect(),x0=r.left+r.width/2-dx/2,y=r.top+r.height/2,id=77;
 const fire=(type,x)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'mouse',isPrimary:true,button:0,buttons:type==='pointerup'?0:1,clientX:x,clientY:y,shiftKey:shift}));
 // A demo pointer is not a real one, so the canvas must not try to capture it.
 el.setPointerCapture=()=>{};el.releasePointerCapture=()=>{};
 fire('pointerdown',x0);return ease(ms,k=>fire('pointermove',x0+dx*k)).then(()=>{fire('pointerup',x0+dx);delete el.setPointerCapture;delete el.releasePointerCapture;});};
const wheelOn=(selector,dir,ms)=>{const el=document.querySelector(selector);if(!el)return;const r=el.getBoundingClientRect();let n=0;
 return ease(ms,k=>{while(n<Math.floor(k*4)){n++;el.dispatchEvent(new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:dir*120,clientX:r.left+r.width/2,clientY:r.top+r.height/2}));}});};
const clickUnit=()=>{const r=game(),p=unitPoint();if(r&&p)r.selectClick(p.x,p.y);};
const click=s=>()=>tap(s);

// Every example: what to light up, whether it runs on the demo battle, and its steps (target, input, action).
const DEMOS={
 count:{spot:['#matchSetup','.setup-summary'],arena:true,icon:'[data-preset="20,20"]',steps:[{at:'[data-preset="20,20"]',input:'click',act:click('[data-preset="20,20"]')},{at:'#randomSetup',input:'click',act:click('#randomSetup')}]},
 settings:{spot:['#settingsBtn','#matchSettingsBtn'],window:true,icon:'#settingsBtn',release:closeOtherDialogs,steps:[{at:'#settingsBtn',input:'click',act:click('#settingsBtn')}]},
 // The intro window itself is used: open it, switch its tabs, rotate and zoom the model, then reset the view.
 info:{spot:['#characterDialog','.character-info-button[data-character-info="rex"]'],window:true,release:closeOtherDialogs,steps:[
  {at:'.character-info-button[data-character-info="rex"]',input:'click',act:click('.character-info-button[data-character-info="rex"]')},
  ...['#characterTabSkills','#characterTabStats','#characterTabTraits'].map(s=>({at:s,input:'click',act:click(s)})),
  {at:'#characterCanvas',input:'rotate',act:()=>dragOn('#characterCanvas',140,STEP*.45,true)},
  {at:'#characterCanvas',input:'wheel',act:()=>wheelOn('#characterCanvas',-1,STEP*.45)},
  {at:'#modelReset',input:'click',act:click('#modelReset')}]},
 start:{spot:['#startBtn','#fsPlay'],arena:true,stage:'ready',steps:[{at:'#startBtn',input:'click',act:click('#startBtn')}]},
 control:{spot:['.playback-left','#pauseBtn'],arena:true,stage:'battle',icon:'#pauseBtn',steps:[{at:'#pauseBtn',input:'click',act:click('#pauseBtn')},{at:'#pauseBtn',input:'click',act:click('#pauseBtn')},{at:'#resetBtn',input:'click',act:click('#resetBtn')},{at:'#stopBtn',input:'click',act:click('#stopBtn')}]},
 log:{spot:['#eventFeed'],stage:'battle',steps:[{at:'#eventFeed',input:'none'},{at:'#eventFeed',input:'none'}]},
 recent:{spot:['#historyBtn'],window:true,release:closeOtherDialogs,steps:[{at:'#historyBtn',input:'click',act:click('#historyBtn')}]},
 camera:{spot:['.camera-controls'],arena:true,stage:'battle',icon:'#viewNext',
  steps:['#viewNext','#viewNext','#viewHome','#autoFollow','#autoFollow','#directorBtn'].map(s=>({at:s,input:'click',act:click(s)}))},
 // Real fullscreen needs the player's own click, so the game's expanded battlefield mode stands in for it.
 expand:{spot:['#fullscreenBtn','#fsExit'],arena:true,full:true,stage:'battle',icon:'#fullscreenBtn',steps:[{at:'#fullscreenBtn',input:'click',act:()=>$('battlefield')?.classList.add('expanded')}]},
 look:{spot:ARENA,stage:'battle',steps:[
  {at:'center',input:'drag',act:()=>ease(STEP*.45,()=>game()?.panBy(-1.6,0))},
  {at:'center',input:'rotate',act:()=>{const r=game(),y=r.yaw;return ease(STEP*.45,k=>{r.yaw=y+k*.8;});}},
  {at:'center',input:'wheel',act:()=>{const r=game(),z=r.zoom;return ease(STEP*.45,k=>r.changeZoom(z*(1+k*.55)));}},
  {at:'center',input:'dbl',act:()=>{const r=game();r?.toggleFocusZoom(r.width/2,r.height/2);}}]},
 select:{spot:ARENA,stage:'battle',steps:[{at:'unit',input:'click',act:clickUnit},{at:'#trackedUnit',input:'none'}]},
 speed:{spot:['.speed-options','#fsSpeed'],arena:true,stage:'battle',icon:'[data-speed="4"]',steps:['0.5','2','4'].map(v=>({at:`[data-speed="${v}"]`,input:'click',act:click(`[data-speed="${v}"]`)}))},
 sound:{spot:['#soundBtn','#fsSound'],icon:'#soundBtn',steps:[{at:'#soundBtn',input:'click',act:click('#soundBtn')},{at:'#soundBtn',input:'click',act:click('#soundBtn')}]},
 // Toggles are shown switching on: turned off first, then pressed.
 hp:{spot:[labelWith('체력바')],arena:true,stage:'battle',before:r=>{if(r.showHealth)tap(labelWith('체력바'));},steps:[{at:labelWith('체력바'),input:'click',act:click(labelWith('체력바'))}]},
 // Shake is shown as a difference: a strong hit with it off (still), switch it on, the same hit (the view shakes),
 // seen close to the fighting so the movement is obvious.
 shake:{spot:[labelWith('화면 흔들림')],arena:true,stage:'battle',before:r=>{if(r.shakeEnabled)tap(labelWith('화면 흔들림'));r.changeZoom(r.zoom*1.7);},steps:[
  {at:'center',input:'none',act:()=>{const r=game();if(!r)return;r.shake=2.2;setTimeout(()=>{if(!r.shakeEnabled)r.shake=0;},350);}},
  {at:labelWith('화면 흔들림'),input:'click',act:click(labelWith('화면 흔들림'))},
  {at:'center',input:'none',act:()=>{const r=game();if(r)r.shake=2.2;}}]}
};

// Tile pictures: the real control's icon (or its short label) in the guide's icon square; the health bar tile uses
// the scoreboard bar's colours.
function copyLiveControls(){
 for(const b of dialog.querySelectorAll('button[data-demo]')){const demo=DEMOS[b.dataset.demo],pic=b.querySelector('.gi');if(!demo||!pic)continue;
  if(b.dataset.demo==='hp'){const track=document.querySelector('.score-rex .health-track'),fill=$('rexHealth');if(!track||!fill)continue;
   const t=getComputedStyle(track),f=getComputedStyle(fill),bar=document.createElement('span');bar.className='gi-bar';bar.style.background=t.backgroundColor==='rgba(0, 0, 0, 0)'?'#d9dccf':t.backgroundColor;bar.style.borderRadius=t.borderRadius;
   const inner=document.createElement('i');inner.style.background=f.backgroundImage!=='none'?f.backgroundImage:f.backgroundColor;bar.append(inner);pic.className='gi gi-hp';pic.removeAttribute('data-gi');pic.replaceChildren(bar);continue;}
  const live=demo.icon&&document.querySelector(demo.icon);if(!live)continue;
  const glyph=live.querySelector('svg');
  if(glyph){const copy=glyph.cloneNode(true);copy.removeAttribute('id');copy.setAttribute('aria-hidden','true');pic.className='gi';pic.removeAttribute('data-gi');pic.replaceChildren(copy);}
  else if(live.textContent.trim().length<=9){pic.className='gi gi-label';pic.removeAttribute('data-gi');pic.textContent=live.textContent.trim();}
 }
}

// --- Demo stage: the same clean battle every loop, and the player's own setup back afterwards. ---
let tour=null;
const raise=()=>{const root=tour?.root;if(root?.showPopover&&root.matches(':popover-open')){root.hidePopover();root.showPopover();}};
function capture(){const r=game(),m=globalThis.matchup;return{rex:$('rexCount')?.value,dig:$('digCount')?.value,camera:r?.captureCamera?.(),showHealth:r?.showHealth,shake:r?.shakeEnabled,speed:m?.speed??1,follow:r?.follow,director:r?.director,state:m?.state,sound:$('soundBtn')?.getAttribute('aria-pressed'),expanded:$('battlefield')?.classList.contains('expanded')};}
function setView(v){const r=game();if(!r)return;closeOtherDialogs();
 if(v.camera)r.restoreCamera?.(v.camera);
 if(r.follow!==v.follow)tap('#autoFollow');if(r.director!==v.director)tap('#directorBtn');
 if(globalThis.matchup?.speed!==v.speed)tap(`[data-speed="${v.speed}"]`);
 if(r.showHealth!==v.showHealth)tap(labelWith('체력바'));if(r.shakeEnabled!==v.shake)tap(labelWith('화면 흔들림'));
 r.showHealth=v.showHealth;r.shakeEnabled=v.shake;
 if($('soundBtn')?.getAttribute('aria-pressed')!==v.sound)tap('#soundBtn');
 $('battlefield')?.classList.toggle('expanded',!!v.expanded);}
async function beginStage(demo){
 const saved=capture(),own=saved.state&&!['ready','ended'].includes(saved.state);
 // A battle the player is in the middle of is never replaced; the example then uses it as it is.
 if(own||!demo.stage)return{saved,staged:false};
 if(saved.state==='ended')tap('#stopBtn');
 setCounts(DEMO_SIZE,DEMO_SIZE);await wait(260);
 const r=game();if(r?.cameraMode==='field')tap('#viewHome');
 const base={...capture(),follow:true,director:false,speed:1,showHealth:true,shake:true,expanded:false};setView(base);base.camera=game()?.captureCamera?.();
 return{saved,staged:true,base};
}
async function loopStage(demo,stage){
 if(stage.staged){
  if(demo.stage==='ready'){if(state()!=='ready')tap('#stopBtn');}
  else if(state()==='ready')tap('#startBtn');else tap('#resetBtn');
  await wait(120);setView(stage.base);
 }else{closeOtherDialogs();if(demo===DEMOS.count)setCounts(stage.saved.rex,stage.saved.dig);if(demo===DEMOS.sound&&$('soundBtn')?.getAttribute('aria-pressed')!==stage.saved.sound)tap('#soundBtn');}
 demo.before?.(game());
}
function endStage(stage){const s=stage.saved;if(stage.staged&&state()!=='ready')tap('#stopBtn');closeOtherDialogs();setCounts(s.rex,s.dig);setView(s);}

// --- Pointer and input indicator ---
const mouse=part=>plain('<rect x="6" y="2.5" width="12" height="19" rx="6"/><path d="M12 2.5v7.5M6 10h12"/>'+(part==='left'?'<path d="M12 2.5a6 6 0 0 0-6 6V10h6Z" fill="currentColor" stroke="none"/>':'<rect x="10.8" y="4.6" width="2.4" height="4.2" rx="1.2" fill="currentColor" stroke="none"/>'));
const INPUTS={
 click:{pc:[mouse('left'),'클릭'],touch:['tapGesture','탭']},
 dbl:{pc:[mouse('left'),'더블클릭'],touch:['doubleTapGesture','두 번 탭']},
 drag:{pc:[mouse('left'),'드래그'],touch:['moveGesture','밀기']},
 wheel:{pc:[mouse('wheel'),'휠 굴리기'],touch:['zoomGesture','두 손가락 벌리기']},
 rotate:{pc:[mouse('left'),'<kbd>Shift</kbd> + 드래그'],touch:['rotateGesture','두 손가락 돌리기']}
};
function showInput(badge,input){const set=INPUTS[input];if(!set){badge.hidden=true;return;}const [pic,text]=coarse.matches?set.touch:set.pc;badge.hidden=false;badge.innerHTML=`${pic.startsWith('<svg')?pic:icon(pic)}<span>${text}</span>`;}
function animatePointer(cursor,ripples,input){
 if(reduced.matches)return;const T=STEP,at=(x,y,s=1)=>`translate(${x}px,${y}px) scale(${s})`,o={duration:T,easing:'ease-in-out',fill:'forwards'};
 const path=points=>cursor.animate(points.map(([k,x,y,s=1,a=1])=>({offset:k,transform:at(x,y,s),opacity:a})),o);
 const ring=(el,k)=>el.animate([{offset:0,opacity:0,transform:'scale(.3)'},{offset:k,opacity:0,transform:'scale(.3)'},{offset:k+.02,opacity:.95,transform:'scale(.3)'},{offset:Math.min(.99,k+.3),opacity:0,transform:'scale(2.4)'},{offset:1,opacity:0,transform:'scale(2.4)'}],{duration:T});
 cursor.style.opacity=input==='none'?'0':'1';
 if(input==='drag')return path([[0,60,30],[.3,60,30,.85],[.75,-60,30,.85],[.85,-60,30],[1,-60,30]]);
 if(input==='rotate')return path([[0,-45,35],[.3,-45,35,.85],[.5,0,50,.85],[.75,45,35,.85],[.85,45,35],[1,45,35]]);
 if(input==='wheel')return path([[0,0,0],[.35,0,-5],[.5,0,4],[.65,0,-5],[.8,0,4],[1,0,0]]);
 if(input==='dbl'){path([[0,0,0],[.45,0,0],[.5,0,0,.8],[.55,0,0],[.6,0,0,.8],[.66,0,0],[1,0,0]]);ring(ripples[0],.48);ring(ripples[1],.58);return;}
 if(input==='click'){path([[0,0,0],[.45,0,0],[.52,0,0,.8],[.6,0,0],[1,0,0]]);ring(ripples[0],.5);}
}

// Leaving an example fades it out while the guide fades back in (or the screen simply returns), at any moment.
function endTour(back){if(!tour)return;const t=tour;tour=null;t.timers.forEach(clearTimeout);cancelAnimationFrame(t.raf);removeEventListener('keydown',t.key,true);removeEventListener('resize',t.resize);
 document.documentElement.classList.remove('coach-room');t.root?.classList.add('is-leaving');setTimeout(()=>t.root?.remove(),reduced.matches?0:220);
 if(t.stage)endStage(t.stage);
 if(back&&dialog){dialog.showModal();t.button.focus();t.button.classList.add('is-active');setTimeout(()=>t.button.classList.remove('is-active'),900);}}
async function startTour(button){
 if(tour)endTour(false);
 const id=button.dataset.demo,demo=DEMOS[id];if(!demo)return;
 dialog.close();
 const me={button,timers:[],started:performance.now(),bubbleSet:false,pointEl:null};tour=me;
 // While an example runs, windows it opens leave a strip free at the bottom so the bubble never covers them.
 document.documentElement.classList.add('coach-room');
 me.stage=await beginStage(demo);if(tour!==me)return;
 const text=(coarse.matches?button.dataset.dm:button.dataset.dp)||button.dataset.d||'',title=button.querySelector('b')?.textContent||'';
 const root=document.createElement('div');root.className='coach';
 root.innerHTML=`<div class="coach-dim"></div><div class="coach-dim"></div><div class="coach-dim"></div><div class="coach-dim"></div><div class="coach-spot"></div><div class="coach-anchor"><span class="coach-ripple"></span><span class="coach-ripple"></span><div class="coach-cursor">${coarse.matches?'<span class="coach-finger"></span>':'<svg class="coach-arrow" viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path d="M4 2l15 11-6.5 1.2L16 21l-3 1.4-3.4-6.8L4 20Z" fill="#fff" stroke="#111" stroke-width="1.5" stroke-linejoin="round"/></svg>'}</div><div class="coach-input" hidden></div></div><div class="coach-bubble" role="dialog"><b></b><p></p><div class="coach-actions"><button type="button" class="coach-back">← 가이드</button><button type="button" class="coach-close">닫기</button></div></div>`;
 root.querySelector('.coach-bubble').setAttribute('aria-label',title+' 안내');root.querySelector('.coach-bubble b').textContent=title;root.querySelector('.coach-bubble p').textContent=text;
 document.body.append(root);if(root.showPopover){root.popover='manual';root.showPopover();}me.root=root;
 const anchor=root.querySelector('.coach-anchor'),cursor=root.querySelector('.coach-cursor'),ripples=[...root.querySelectorAll('.coach-ripple')],badge=root.querySelector('.coach-input');
 const spotEl=root.querySelector('.coach-spot'),bubble=root.querySelector('.coach-bubble'),dims=[...root.querySelectorAll('.coach-dim')];
 me.key=e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();endTour(true);}};addEventListener('keydown',me.key,true);
 me.resize=()=>{me.bubbleSet=false;};addEventListener('resize',me.resize);
 root.querySelector('.coach-back').onclick=()=>endTour(true);root.querySelector('.coach-close').onclick=()=>endTour(false);
 root.addEventListener('pointerdown',e=>{if(!e.target.closest('.coach-bubble')){e.preventDefault();endTour(true);}});
 const resolve=at=>at==='unit'||at==='center'?at:typeof at==='function'?at():document.querySelector(at);
 // Bring the highlighted area into the device's viewport as the demonstration moves.
 // Scroll once per step, not every animation frame, so the spotlight can settle smoothly.
 const reveal=target=>{if(tour!==me)return;const focus=target instanceof Element&&shown(target)?target:first(demo.spot)||first(ARENA);if(!focus)return;
  const area=demo.follow?focus:first(demo.spot)||focus,r=area.getBoundingClientRect(),view=window.visualViewport,h=view?.height||innerHeight,top=view?.offsetTop||0;
  const el=r.height>h-24?focus:area,q=el.getBoundingClientRect();
  if(q.top<top+12||q.bottom>top+h-12||q.left<0||q.right>innerWidth)el.scrollIntoView({block:'center',inline:'nearest',behavior:reduced.matches?'auto':'smooth'});};
 const place=()=>{if(tour!==me)return;
  const base=demo.follow&&me.pointEl instanceof Element&&shown(me.pointEl)?me.pointEl:first(demo.spot)||first(ARENA);if(!base){me.raf=requestAnimationFrame(place);return;}
  const s=base.getBoundingClientRect(),a=demo.arena?first(ARENA)?.getBoundingClientRect():null,pad=6;
  // The battlefield joins the lit area only when both fit on screen together (fullscreen lights the whole view).
  const u=a&&{left:Math.min(s.left,a.left),top:Math.min(s.top,a.top),right:Math.max(s.right,a.right),bottom:Math.max(s.bottom,a.bottom)};
  let r=demo.full&&u?{left:Math.max(0,u.left),top:Math.max(0,u.top),right:Math.min(innerWidth,u.right),bottom:Math.min(innerHeight,u.bottom)}:u&&u.bottom-u.top<=innerHeight-24?u:{left:s.left,top:s.top,right:s.right,bottom:s.bottom};
  // Leave enough room for the explanation; on phones highlight the control rather than a tall combined area.
  const margin=10,gap=12; bubble.style.width=Math.min(340,innerWidth-margin*2)+'px';
  const bubbleHeight=bubble.offsetHeight,maxArea=Math.max(50,innerHeight-bubbleHeight-gap-margin*2);
  if(r.bottom-r.top>maxArea&&s.height<=maxArea)r={left:s.left,top:s.top,right:s.right,bottom:s.bottom};
  if(r.bottom-r.top>maxArea){const focus=me.pointEl instanceof Element?me.pointEl.getBoundingClientRect():s,center=(focus.top+focus.bottom)/2;
   const top=Math.max(margin,Math.min(innerHeight-margin-maxArea,center-maxArea/2));r={...r,top,bottom:top+maxArea};}
  // The lit frame and the dark panels move together on a critically damped spring: a soft start, no overshoot.
  const goal=[r.left-pad,r.top-pad,r.right+pad,r.bottom+pad],now=performance.now(),dt=Math.min(.05,(now-(me.at??now))/1000),w=8.5;me.at=now;
  if(!me.rect||reduced.matches){me.rect=goal.slice();me.vel=[0,0,0,0];}else for(let i=0;i<4;i++){me.vel[i]+=(w*w*(goal[i]-me.rect[i])-2*w*me.vel[i])*dt;me.rect[i]+=me.vel[i]*dt;}
  const [L,T,R,B]=me.rect;Object.assign(spotEl.style,{left:L+'px',top:T+'px',width:R-L+'px',height:B-T+'px'});
  [[0,0,innerWidth,Math.max(0,T)],[0,B,innerWidth,Math.max(0,innerHeight-B)],[0,T,Math.max(0,L),B-T],[R,T,Math.max(0,innerWidth-R),B-T]].forEach(([x,y,w,h],i)=>Object.assign(dims[i].style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'}));
  let px=null,py=null;const cv=first(ARENA)?.getBoundingClientRect();
  if(me.pointEl==='unit'){const p=unitPoint(),c=game()?.canvas.getBoundingClientRect();if(p&&c){px=c.left+p.x;py=c.top+p.y;}}
  else if(me.pointEl==='center'&&cv){px=cv.left+cv.width/2;py=cv.top+cv.height/2;}
  else if(me.pointEl instanceof Element){const q=me.pointEl.getBoundingClientRect();px=q.left+q.width/2;py=q.top+q.height/2;}
  if(px!=null)Object.assign(anchor.style,{left:px+'px',top:py+'px'});
  // Follow directly below the yellow frame, switching above when the bottom has no room.
  // If neither band fits, shorten only the visible spotlight, never place text inside it.
  const rect=spotEl.getBoundingClientRect(),W=bubble.offsetWidth,H=bubble.offsetHeight,m=10,gapY=12;
  let top=rect.bottom+gapY;
  if(top+H>innerHeight-m){if(rect.top-gapY-H>=m)top=rect.top-gapY-H;
   else{const bottom=Math.max(m+30,innerHeight-H-gapY-m),newTop=Math.max(m,Math.min(rect.top,bottom-30));
    Object.assign(spotEl.style,{top:newTop+'px',height:bottom-newTop+'px'});top=bottom+gapY;
    [[0,0,innerWidth,newTop],[0,bottom,innerWidth,innerHeight-bottom],[0,newTop,Math.max(0,L),bottom-newTop],[R,newTop,Math.max(0,innerWidth-R),bottom-newTop]].forEach(([x,y,w,h],i)=>Object.assign(dims[i].style,{left:x+'px',top:y+'px',width:w+'px',height:h+'px'}));}}
  Object.assign(bubble.style,{left:Math.max(m,Math.min(innerWidth-W-m,(L+R-W)/2))+'px',top:Math.max(m,top)+'px'});
  bubble.classList.add('is-ready');
  me.raf=requestAnimationFrame(place);};
 // Examples that change the battle view are scrolled so the battlefield itself is centred.
 (demo.arena||demo.spot===ARENA?document.querySelector('.arena-panel'):first(demo.spot))?.scrollIntoView({block:'center',inline:'nearest',behavior:reduced.matches?'auto':'smooth'});
 // One loop: reset the stage, rest on the first target, then each step moves there, shows its input and acts.
 const loop=async()=>{if(tour!==me)return;await loopStage(demo,me.stage);if(tour!==me)return;
  me.pointEl=resolve(demo.steps[0].at);reveal(me.pointEl);showInput(badge,null);cursor.style.opacity='1';
  demo.steps.forEach((s,i)=>{const t0=STEP*(i+1);
   me.timers.push(setTimeout(()=>{if(tour!==me)return;me.pointEl=resolve(s.at);reveal(me.pointEl);showInput(badge,s.input);animatePointer(cursor,ripples,s.input);},t0-STEP*.45));
   if(s.act)me.timers.push(setTimeout(()=>{if(tour!==me)return;s.act();setTimeout(raise,80);},t0-STEP*.45+STEP*(['drag','rotate','wheel'].includes(s.input)?.3:s.input==='dbl'?.58:.5)));});
  const total=STEP*(demo.steps.length+1);
  if(demo.release)me.timers.push(setTimeout(()=>tour===me&&demo.release(),total-STEP*.3));
  me.timers.push(setTimeout(loop,total));};
 place();loop();root.querySelector('.coach-back').focus({preventScroll:true});
}
dialog?.addEventListener('click',e=>{const b=e.target.closest('.guide-tiles button');if(b&&DEMOS[b.dataset.demo])startTour(b);});
if(dialog)new MutationObserver(()=>{if(dialog.open)copyLiveControls();}).observe(dialog,{attributes:true,attributeFilter:['open']});

// The one launcher: always visible in the corner of the screen (the header ? button is hidden, still used to open the dialog).
{const fab=document.createElement('button');fab.type='button';fab.className='guide-fab';fab.setAttribute('aria-label','플레이 가이드');fab.innerHTML='<span aria-hidden="true">?</span><b>플레이 가이드</b>';
 fab.onclick=()=>$('helpBtn')?.click();document.body.append(fab);}
