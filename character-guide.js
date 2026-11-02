import {animateCharacterPreview} from './character-preview.js';
import {skillIcon} from './skill-icons.js';
import {skillFacts} from './skill-facts.js';
import {skillDescription,skillRules} from './skill-descriptions.js';
import {Battle,SKILLS as TECHNIQUES,CREW_LEVELS,unitStats,guardStats,crewProfile} from './engine.js';
import {GPURenderer} from './gpu-renderer.js';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const COPY={
 rex:{name:'티라노',intro:'빠르게 달려들어 들이받고, 맞히면 물기와 꼬리로 쉬지 않고 몰아칩니다.',strength:'빠른 발과 연계로 상대가 자세를 잡기 전에 피해를 쌓습니다. 꼬리는 패링에 막히지 않습니다.',weakness:'공격 거리가 짧아 버킷이 닿는 거리 안으로 들어가야 합니다. 체력이 포크레인보다 낮고, 여럿이 뭉치면 폭발과 횡베기에 함께 휘말립니다.',style:'돌진으로 거리를 좁힌 뒤 물기·꼬리로 이어 갑니다. 버킷 공격은 꼬리로 받아치거나 옆으로 비켜 피합니다.',crew:'기수'},
 dig:{name:'포크레인',intro:'긴 팔로 다가오는 상대를 끊고, 휘두른 뒤에는 다시 거리를 벌립니다.',strength:'체력이 높고 팔이 길어 여러 티라노를 한꺼번에 상대합니다. 패링으로 정면 공격을 연달아 막습니다.',weakness:'옆에서 맞으면 피해 40%, 뒤에서 맞으면 20%를 더 받고 더 크게 밀립니다. 느려서 돌아 들어오는 티라노를 쫓기 어렵고, 파괴되면 주변에 폭발을 일으켜 아군도 다칩니다.',style:'횡베기·회전으로 밀어내 공간을 만들고, 막아낸 직후 올려치기·내려치기로 반격합니다.',crew:'조종사'}
};
const MOVES={bite:'가까운 상대를 물어 공격합니다.',ram:'빠르게 돌진해 거리를 좁히고 상대를 들이받습니다.',tail:'체중을 실어 꼬리로 강하게 칩니다. 포크레인 대상 치명타 확률은 55%, 추가 대상 피해는 10%입니다.',leap:'상대에게 도약한 뒤 착지하며 공격합니다.',pounce:'도약해 내려찍은 뒤 몸을 말아 구르며 부딪힌 적을 공격합니다.',smash:'버킷을 내리쳐 강한 피해를 줍니다.',sweep:'팔을 옆으로 휘둘러 여러 상대를 밀쳐냅니다.',uppercut:'버킷을 올려쳐 상대를 띄웁니다.',spin:'차체 위의 팔을 회전시켜 주위 상대를 공격합니다.',grapple:'가까운 상대를 붙잡아 들어 올린 뒤 던집니다.'};

// The actual game models are drawn in an isolated stage; no combat simulation runs here.
export class CharacterRenderer extends GPURenderer{
 interactions(){}
 show(team,config){const b=new Battle({...config,rex:1,dig:1}),u=b.units.find(u=>u.team===team);Object.assign(u,{id:0,x:0,px:0,z:0,pz:0,y:0,py:0,yaw:0,prevYaw:0,scale:1,walk:0,speed:0,action:null});b.units=[u];this.setBattle(b);this.unit=u;this.previewEpoch=null;this.previewActionKey=null;this.previewMoves=TECHNIQUES[team].filter(m=>config.tuning[team].moves[m.kind].enabled);this.follow=false;this.showHealth=false;this.resetView();}
 resetView(){this.yaw=-.55;this.elev=.4;this.zoom=1;this.focusX=this.unit?.team==='rex'?-1:1;this.focusZ=0;}
 guideStage(rex){const G=-.23,I=this.transform({x:0,y:0,z:0,yaw:0,pitch:0,roll:0,hp:0,team:'dig',scale:1}),B=(x,y,z,w,h,d,c,yaw=0)=>{let T=null;if(yaw){const ca=Math.cos(yaw),sa=Math.sin(yaw);T=(px,py,pz)=>{const dx=px-x,dz=pz-z;return[x+dx*ca-dz*sa,py,z+dx*sa+dz*ca];};this.affine(T,I,{yaw,tx:x-x*ca+z*sa,tz:z-x*sa-z*ca});}this.box(x,G+y+h/2,z,w,h,d,c,T);};
  this.box(0,-.38,0,260,.3,260,rex?'#5a5040':'#74756e');
  if(rex){
   for(const [x,z,w,d,r] of [[-6,-4,7,4,.3],[5,3,6,5,-.2],[-2,6.5,9,3,.1],[9,-6,5,4,.5],[-11,2,5,6,-.4],[13,4,6,3,.2],[0,-9,10,4,-.1],[-16,6,6,5,.6]])B(x,0,z,w,.012,d,'#504737',r);
   for(const [x,z,w,d,r] of [[-3,1,3,2,.7],[7,-2,2.4,1.6,-.3],[-8,-6,3,2,.2],[11,7,3,2,.9]])B(x,.003,z,w,.012,d,'#685d48',r);
   for(const [x,z,r,l] of [[-4,3,.8,4],[-2.2,3.6,-.4,2.5],[6,-4,1.3,3.5],[7.4,-3,.3,2],[-10,-1,2.1,3]])B(x,.006,z,l,.014,.07,'#3b3428',r);
   B(4.5,.004,6.2,3.4,.012,2,'#3e4a4b',.2);B(4.2,.008,5.9,1.2,.012,.25,'#6f8486',.2);
   for(const [x,z,s] of [[-7,4.5,1],[9.5,2.6,.8],[-12,-4,1.1],[2,-5.5,.9],[14,-1,1],[-4,8,.8],[12,-8,1.2]])for(let k=0;k<5;k++)B(x+(k-2)*.12*s,0,z+(k%2)*.1,.07,(.5+(k%3)*.25)*s,.07,k%2?'#56653a':'#4a5831',(k-2)*.35);
   B(-3.5,0,-3,.7,.45,.55,'#d6cdb4',.4);B(-3.1,.05,-2.75,.5,.18,.4,'#cfc5aa',.4);for(let k=0;k<5;k++)B(-1.8+k*.45,0,-2.2+k*.15,.09,.35-.03*k,1.4-.12*k,'#d9d0b6',.4);B(-1,.03,-1.6,2.6,.12,.12,'#cbc1a5',.4);
   B(13,0,-9,.18,2.6,3.2,'#86827a',.25);for(let k=0;k<3;k++)B(12.9,.9+k*.45,-9.2+k*.35,.2,.14,1.6,'#3a352d',.25);
   for(let k=0;k<26;k++){const a=k*2.4,rr=3.5+(k*7%13);B(Math.cos(a)*rr,0,Math.sin(a)*rr*.8,.18+(k%3)*.08,.1+(k%2)*.06,.15+(k%4)*.05,k%3?'#7d7564':'#948c78',a);}
   B(-6,.02,-8.5,5,.06,.08,'#7b7f80',.15);B(-6,1.1,-8.4,5,.06,.08,'#7b7f80',.15);for(let k=0;k<4;k++)B(-8.2+k*1.5,0,-8.5+k*.22,.08,1.2,.08,'#6c7071',.15);for(let k=0;k<9;k++)B(-8+k*.55,.55,-8.45+k*.08,.03,1.05,.03,'#8d9192',.95);
   B(9,0,9,1.2,.7,1.2,'#5b4a38');B(9,.7,9,1,.12,1,'#7d6a52');for(let k=0;k<3;k++)B(9.2+k*.3,.4,9.6,.12,.12,1.5,'#4b3d2f',.6+k*.4);
   for(const [x,z] of [[-14,-3],[15,5]]){B(x,0,z,1.4,.25,1,'#2d2a26',.3);B(x,.25,z,.6,.12,.5,'#e0723a',.3);B(x+.2,.3,z+.1,.25,.08,.2,'#f4b45a',.3);}
   for(let i=0;i<5;i++){const x=-12+i*3.4,z=6-i*.7+(i%2?.9:-.9),s=i%2?1:-1;B(x-.35,.006,z,.55,.016,.5,'#4c4737');B(x+.35,.006,z-.42*s,1.1,.016,.2,'#4c4737',-.45*s);B(x+.45,.006,z,1.2,.016,.2,'#4c4737');B(x+.35,.006,z+.42*s,1.1,.016,.2,'#4c4737',.45*s);}
   for(let k=0;k<3;k++)B(-5.5+k*.25,.008,-6.5+k*.55,3.6,.016,.13,'#45402f',.35);
   for(const [x,z,r] of [[-9,-2.5,.4],[8,1.8,-.6],[3,-7,.9],[-13,-7,.2],[12,-3,1.2]]){B(x,0,z,1.8,.55,1.2,'#8a8676',r);B(x+.3,.55,z+.1,.9,.32,.7,'#77736a',r+.3);B(x-.2,.45,z,.06,.06,1.8,'#5c4636',r+.8);}
   this.box(11,-.23+1.3,-13,6,.5,2.6,'#8a8676',null,.42);this.box(11.4,-.23+.25,-12.2,5,.5,1.4,'#77736a');for(let k=0;k<4;k++)this.box(9.2+k*1.2,-.23+2.4,-13,.06,1.2,.06,'#5c4636',null,.3+k*.12);for(const [x,z,r] of [[-14,-12,.3],[16,-6,.6]]){B(x,0,z,2.2,.7,1.6,'#7a7564',r);B(x+.5,.7,z,1.2,.45,1,'#857f6c',r+.4);B(x-.6,0,z+.9,1,.35,.8,'#6f6a5a',r-.3);}
  }else{
   const I=(x,y,z)=>[x,y,z];
   for(let i=0;i<40;i++)B(((i*37)%41-20)*.9,.002,((i*53)%33-16)*.8,1.5+i%5,.01,1+i%3,['#625f51','#716b58','#605e50','#79715e'][i%4],i*.7);
   B(-9,.004,4,6,.012,4,'#8e8b7b',.2);B(-8.6,.008,4,3.8,.012,2.2,'#989585',.2);
   for(let i=0;i<80;i++){const s=.06+(i%4)*.05;B(((i*29)%47-23)*.7,0,((i*61)%37-18)*.6,s*1.5,.08,s,['#9a9583','#6e6c5e','#aea58e'][i%3],i);}
   for(const z of [-1.15,1.15]){B(-10,.006,z,16,.012,.7,'#756b58');for(let i=0;i<18;i++)B(-17.6+i*.9,.012,z,.13,.012,.64,'#655e4e');}
   {const ya=-.519,ca=Math.cos(ya),sa=Math.sin(ya);for(const o of [-1.15,1.15]){const cx=9-sa*o,cz=3+ca*o;B(cx,.006,cz,16,.012,.7,'#756b58',ya);for(let i=0;i<18;i++){const t=-7.6+i*.9;B(cx+ca*t,.012,cz+sa*t,.13,.012,.64,'#655e4e',ya);}}}
   for(const s of [-1,1]){B(-6,.01,6+s*4,8,.012,.09,'#c2b9a0');B(-6+s*4,.01,6,.09,.012,8,'#c2b9a0');}
   B(6,.004,-3,3.6,.012,1.8,'#625f50',.4);B(5.9,.008,-3.1,1.4,.012,.9,'#55574c',.4);
   for(let i=0;i<17;i++){const x=-19.2+i*2.4,z=-10;B(x,.5,z,2.35,2.5,.12,['#b8bfb7','#aeb8b1','#bdc3ba','#a6b2ae'][i%4]);B(x,.33,z+.08,2.35,.58,.07,'#526e72');for(const y of [.33,2.93])B(x,y,z+.13,2.4,.1,.13,'#697b78');for(let j=0;j<6;j++)B(x-1.03+j*.41,.56,z+.09,.055,2.38,.055,j%2?'#c6cbc0':'#99a8a2');B(x-1.2,0,z+.08,.14,3.26,.18,'#556865');if(i%7===3){B(x,1.3,z+.1,1,.58,.04,'#c0a35b');for(let j=0;j<3;j++)B(x-.3+j*.3,1.34,z+.13,.12,.5,.025,'#414940');}}
   {const x=11,z=-6.5;B(x,0,z,10.5,.28,4.6,'#535a51',.1);B(x,.28,z,10.2,3,4.35,'#4c554a',.1);B(x,3.28,z,10.5,.16,4.6,'#5e6556',.1);for(let i=0;i<17;i++){const t=-4.8+i*.6;B(x+Math.cos(.1)*t-Math.sin(.1)*2.2,.38,z+Math.sin(.1)*t+Math.cos(.1)*2.2,.1,2.8,.08,'#5b6758',.1);}B(x-2-.22,.95,z+2.03,2.2,1.4,.05,'#303b32',.1);}
   for(let row=0;row<3;row++)for(let i=0;i<4-row;i++)B(-12+i*1.7+row*.5,row*.62,-6.5,1.5,.57,2.2,'#a4a392');
   for(let layer=0;layer<3;layer++)for(let i=0;i<5;i++)B(12+(-1.3+i*.65),layer*.3,4.5,.46,.2,5.4,layer%2?'#8f7c5b':'#a18b64');
   for(let i=0;i<4;i++)this.limb([15+i*.85,-.23+.39,1.8],[15+i*.85,-.23+.39,7.2],.39,.39,'#767d73',I);
   B(-12,.004,7,5,.012,3.5,'#343b31',.3);for(const [x,z] of [[-12.6,7],[-11.5,7.3]]){B(x,0,z,.8,1.1,.8,'#514a36');for(const y of [.15,.85])B(x,y-.04,z,.86,.08,.86,'#30392e');B(x,1.1,z,.64,.05,.64,'#d0813e');B(x,1.15,z,.3,.35,.3,'#f4b45a',.4);}
   this.beam([-14.5,-.23+.3,5.6],[-12.8,-.23+1.1,5.6],.32,.48,'#635541',I);
   for(const [x,z] of [[6.5,5.6],[8.2,6.4],[-3,8.4]]){B(x,0,z,.6,.06,.6,'#2f3236');B(x,.06,z,.42,.7,.42,'#d9772f');B(x,.36,z,.45,.12,.45,'#ece8de');}
   {const x=-5,z=-24,h=16;for(const dx of [-.8,.8])for(const dz of [-.8,.8])B(x+dx,0,z+dz,.16,h,.16,'#aa8b48');for(let y=1;y<h;y+=3)for(const s of [-1,1])B(x,y,z+s*.8,1.8,.11,.1,'#c4a258');B(x+4,h,z,24,.65,1.5,'#b6954e');B(x-6,h-.3,z,3.8,2.2,2.1,'#7f8172');B(x+1,h+.1,z-.9,1.9,1.6,1.5,'#536c66');B(x+12,h-9,z,.045,9,.045,'#4c574e');B(x+12,h-9.5,z,.5,.65,.4,'#796b40');}
  }}
 draw(time){
  if(!this.unit||this.width<1||this.height<1)return;if(!this.portrait)animateCharacterPreview(this,time);const c=this.ctx;this.scale=Math.min(this.width/15,this.height/9)*this.zoom;this.detail=1;this.compact=false;this.drawUnits=[this.unit,...(this.extraUnits||[])];this.motionTips=[];this.buffFXCount=0;this.buffFXTeams={rex:0,dig:0};this.polys=[];
  c.clearRect(0,0,this.width,this.height);
  if(this.gl&&!this.gpuLost){const gl=this.gl;this.currentMap=this.batchMap;for(const b of this.batchMap.values())b.count=0;this.stats.drawCalls=this.stats.instances=0;gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);this.shakeX=this.shakeY=0;this.setupCamera(time);}
  else c.clearRect(0,0,this.width,this.height);
  if(this.portrait){if(this.gl&&!this.gpuLost){this.gl.clearColor(0,0,0,0);this.gl.clear(this.gl.COLOR_BUFFER_BIT|this.gl.DEPTH_BUFFER_BIT);}else{c.clearRect(0,0,this.width,this.height);}}
  if(!this.portrait)this.guideStage(this.unit.team==='rex');for(const u of this.drawUnits)u.team==='rex'?this.rex(u,time,u.hp<=0):this.digger(u,time,u.hp<=0);
  if(this.gl&&!this.gpuLost){this.gpuRiders(time);if(this.extraUnits)this.gpuWreckSmoke(time);this.drawMap(this.batchMap);}else this.flush();
 }
}
export function installCharacterGuide({getConfig,onOpen}){
 const dialog=document.createElement('dialog');dialog.id='characterDialog';dialog.className='character-dialog';dialog.setAttribute('aria-labelledby','characterTitle');
 dialog.innerHTML='<button class="dialog-close" type="button" aria-label="캐릭터 소개 닫기">×</button><header><h2 id="characterTitle"></h2><p id="characterDescription"></p></header><div class="character-layout"><section class="character-model"><div class="character-stage"><canvas id="characterCanvas" aria-label="회전하고 확대할 수 있는 캐릭터 3D 모델" tabindex="0"></canvas></div><div class="character-view-tools"><button type="button" id="modelZoomOut" aria-label="모델 축소">−</button><span id="modelZoomValue">100%</span><button type="button" id="modelZoomIn" aria-label="모델 확대">+</button><button type="button" id="modelReset">시점 초기화</button></div><p class="character-view-hint">드래그로 회전 · 휠 또는 벌리기로 확대/축소<br>방향키로 회전 · + / −로 확대/축소</p></section><section class="character-info-panel"><div class="character-tabs" role="tablist" aria-label="캐릭터 정보"><button type="button" role="tab" id="characterTabTraits" aria-controls="characterTraits" data-character-tab="characterTraits">특징</button><button type="button" role="tab" id="characterTabSkills" aria-controls="characterSkills" data-character-tab="characterSkills">스킬</button><button type="button" role="tab" id="characterTabStats" aria-controls="characterStats" data-character-tab="characterStats">능력치</button></div><div id="characterTraits" role="tabpanel" aria-labelledby="characterTabTraits"></div><div id="characterSkills" role="tabpanel" aria-labelledby="characterTabSkills" hidden></div><div id="characterStats" role="tabpanel" aria-labelledby="characterTabStats" hidden></div></section></div>';
 if(!document.querySelector('link[href="ui-guide-stage.css"]'))document.head.append(Object.assign(document.createElement('link'),{rel:'stylesheet',href:'ui-guide-stage.css'}));document.body.append(dialog);const $=id=>dialog.querySelector('#'+id),canvas=$('characterCanvas');let renderer=null,frame=0,last=0;
 const resize=()=>{renderer?.resize();renderer?.draw(performance.now()/1000);};
 const tick=ms=>{if(!dialog.open||document.hidden){frame=0;return;}if(ms-last>=33){renderer.draw(ms/1000);last=ms;}$('modelZoomValue').textContent=Math.round(renderer.zoom*100)+'%';frame=requestAnimationFrame(tick);};
 const run=()=>{if(!frame&&dialog.open&&!document.hidden)frame=requestAnimationFrame(tick);};
 const selectTab=id=>{for(const b of dialog.querySelectorAll('[data-character-tab]')){const selected=b.dataset.characterTab===id;b.setAttribute('aria-selected',String(selected));b.tabIndex=selected?0:-1;$(b.dataset.characterTab).hidden=!selected;}};
 dialog.querySelectorAll('[data-character-tab]').forEach((b,index,list)=>{b.onclick=()=>selectTab(b.dataset.characterTab);b.onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?list.length-1:(index+(e.key==='ArrowRight'?1:list.length-1))%list.length;list[next].click();list[next].focus();};});
 function skillHeading(h,kind,name){const mini=document.createElement('span');mini.className='skill-icon-mini';mini.innerHTML=skillIcon(kind).split('<svg class="skill-clock"')[0];h.append(mini,document.createTextNode(name));}
 function section(parent,title,text){const h=document.createElement('h3'),p=document.createElement('p');p.textContent=text;if(parent.id==='characterSkills'){const card=document.createElement('article');card.className='character-skill';card.dataset.skillKind='parry';skillHeading(h,'parry',title);card.append(h,p);parent.append(card);return card;}h.textContent=title;parent.append(h,p);return parent;}
 function open(team){
  onOpen?.();dialog.dataset.team=team;const config=getConfig(),copy=COPY[team],level=config[team+'Skill'],stats=unitStats(team,level,config[team+'Power'],config.tuning[team]);
  dialog.querySelector('.character-view-hint').textContent=matchMedia('(pointer: coarse)').matches?'밀어서 이동 · 두 점 터치로 회전\n두 점 사이를 벌리거나 좁혀 확대/축소':'드래그로 이동 · 휠 버튼 또는 Shift+드래그로 회전\n휠로 확대/축소 · 방향키 회전 · Shift+방향키 이동';
  $('characterTitle').textContent=copy.name;$('characterDescription').textContent=copy.intro;const traits=$('characterTraits');traits.replaceChildren();
  for(const [title,key]of [['전투 방식','style'],['강점','strength'],['약점','weakness']])section(traits,title,copy[key]);
  
  const skills=$('characterSkills');skills.replaceChildren();{const rules=document.createElement('details'),summary=document.createElement('summary'),list=document.createElement('ul');rules.className='skill-rules';summary.textContent='스킬 읽는 법 (모든 스킬 공통)';for(const rule of skillRules(team)){const li=document.createElement('li');li.textContent=rule;list.append(li);}rules.append(summary,list);skills.append(rules);}for(const move of TECHNIQUES[team]){const card=document.createElement('article');card.dataset.skillKind=move.kind;card.className='character-skill'+(config.tuning[team].moves[move.kind].enabled?'':' locked');const h=document.createElement('h3'),p=document.createElement('p'),meta=document.createElement('small');skillHeading(h,move.kind,move.name);p.textContent=skillDescription(move.kind,team);const cooldown=move.cooldown*config.tuning[team].moves[move.kind].cooldown;meta.textContent=config.tuning[team].moves[move.kind].enabled?'사용':'사용 안 함';const facts=document.createElement('p');facts.className='character-skill-facts';facts.textContent=skillFacts(move,{team,stats},config);h.append(meta);card.append(h,p,facts);skills.append(card);}const guard=guardStats(team,level,config.tuning[team]);const parryCard=section(skills,'패링',skillDescription('parry',team));{const facts=document.createElement('p');facts.className='character-skill-facts';facts.textContent=skillFacts({kind:'parry'},{team,stats},config);parryCard.append(facts);}
  const statPanel=$('characterStats');statPanel.replaceChildren();const note=document.createElement('p');note.className='character-stat-note';note.textContent='현재 설정 기준 · 다음 전투에 적용';statPanel.append(note);const dl=document.createElement('dl');for(const [label,value]of [['체력',Math.round(stats.hp).toLocaleString('ko-KR')],['공격력',Math.round(stats.damage).toLocaleString('ko-KR')],['받는 피해 감소',Math.round(stats.armor*100)+'%'],...(team==='dig'?[['밀쳐내기 저항','15%'],['폭발 밀쳐내기 저항','50%'],['폭발 피해 감소','50%']]:[]),['이동 속도',stats.speed.toFixed(1)+' m/s'],['기본 공격 간격',stats.period.toFixed(2)+'초'],['명중률',Math.round(crewProfile(level).accuracy*100)+'%'],['패링',guard.chance>0?'사용':'사용 안 함'],['패링 후 회복 시간',guard.cooldown.toFixed(2)+'초']]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;dl.append(dt,dd);}statPanel.append(dl);selectTab('characterTraits');dialog.showModal();dialog.scrollTop=0;if(!renderer)renderer=new CharacterRenderer(canvas,new Battle({rex:1,dig:1}),{transparent:true});renderer.show(team,config);resize();run();
 }
 dialog.querySelector('.dialog-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{cancelAnimationFrame(frame);frame=0;});document.addEventListener('visibilitychange',()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else run();});
 const pan=(dx,dy)=>{renderer.panBy(dx,dy);renderer.focusX=clamp(renderer.focusX,-5,5);renderer.focusZ=clamp(renderer.focusZ,-5,5);};
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 const pointers=new Map();let pinch=null;const distance=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
 const zoom=n=>{if(renderer){renderer.zoom=clamp(n,.6,2);resize();}};
 canvas.addEventListener('pointerdown',e=>{if(!renderer)return;e.preventDefault();canvas.focus();pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,rotate:e.button===1||e.shiftKey});canvas.setPointerCapture(e.pointerId);if(pointers.size===2)pinch=distance();});
 canvas.addEventListener('pointermove',e=>{const old=pointers.get(e.pointerId);if(!old)return;pointers.set(e.pointerId,{...old,x:e.clientX,y:e.clientY});if(pointers.size===1){if(!old.rotate&&!e.shiftKey)pan(e.clientX-old.x,e.clientY-old.y);else{renderer.yaw+=(e.clientX-old.x)*.008;renderer.elev=clamp(renderer.elev+(e.clientY-old.y)*.006,.16,1.4);}}else if(pointers.size===2){const next=distance();renderer.yaw+=(e.clientX-old.x)*.004;renderer.elev=clamp(renderer.elev+(e.clientY-old.y)*.003,.16,1.4);if(pinch>0)zoom(renderer.zoom*next/pinch);pinch=next;}});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(name,e=>{pointers.delete(e.pointerId);pinch=null;});
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom(renderer.zoom*Math.exp(-e.deltaY*.0015));},{passive:false});
 canvas.onkeydown=e=>{if(!renderer)return;if(e.shiftKey&&e.key.startsWith('Arrow')){e.preventDefault();pan(e.key==='ArrowLeft'?-16:e.key==='ArrowRight'?16:0,e.key==='ArrowUp'?-16:e.key==='ArrowDown'?16:0);return;}const actions={ArrowLeft:()=>renderer.yaw-=.15,ArrowRight:()=>renderer.yaw+=.15,ArrowUp:()=>renderer.elev=clamp(renderer.elev+.1,.16,1.4),ArrowDown:()=>renderer.elev=clamp(renderer.elev-.1,.16,1.4),'+':()=>zoom(renderer.zoom+.1),'=':()=>zoom(renderer.zoom+.1),'-':()=>zoom(renderer.zoom-.1)};if(actions[e.key]){e.preventDefault();actions[e.key]();}};
 $('modelZoomOut').onclick=()=>zoom(renderer.zoom-.1);$('modelZoomIn').onclick=()=>zoom(renderer.zoom+.1);$('modelReset').onclick=()=>{renderer.resetView();resize();};
 document.querySelectorAll('[data-character-info]').forEach(b=>b.onclick=()=>open(b.dataset.characterInfo));return{dialog};
}

