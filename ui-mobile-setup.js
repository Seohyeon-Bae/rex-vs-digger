// Claude 1.9.x 제안: 모바일(760px 이하)에서 매치 설정을 한 줄 요약으로 접어 전장을 첫 화면에 보여 준다.
// 앱 내부 상태를 건드리지 않고 화면 요소(#matchSetup, #rexCount, #digCount)만 읽는다. 접힘 상태는 이 기기에만 기억한다.
const setup=document.getElementById('matchSetup'),query=matchMedia('(max-width: 760px)'),KEY='ui-setup-collapsed';
if(setup){
 document.head.append(Object.assign(document.createElement('link'),{rel:'stylesheet',href:'ui-mobile-setup.css'}));
 let collapsed=true;try{collapsed=localStorage.getItem(KEY)!=='0';}catch{}
 const bar=document.createElement('button');bar.type='button';bar.className='setup-summary';bar.setAttribute('aria-controls','matchSetup');setup.prepend(bar);
 const team=(cls,name,id,unit)=>{const s=document.createElement('span');s.className='setup-summary-team '+cls;const b=document.createElement('b');b.textContent=document.getElementById(id)?.value||'?';s.append(name+' ',b,unit);return s;};
 const render=()=>{const on=query.matches&&collapsed;setup.classList.toggle('is-collapsed',on);bar.hidden=!query.matches;bar.setAttribute('aria-expanded',String(!on));
  const vs=document.createElement('span');vs.className='setup-summary-vs';vs.textContent='vs';const action=document.createElement('span');action.className='setup-summary-action';action.textContent=on?'⚙️ 설정 열기 ▾':'설정 접기 ▴';bar.setAttribute('aria-label',on?'매치 설정 열기':'매치 설정 접기');
  const text=document.createElement('span');text.className='setup-summary-text';text.append(team('team-rex','티라노','rexCount',''),vs,team('team-dig','포크레인','digCount',''));bar.replaceChildren(text,action);};
 const save=()=>{try{localStorage.setItem(KEY,collapsed?'1':'0');}catch{}};
 bar.onclick=()=>{collapsed=!collapsed;save();render();if(!collapsed)setup.scrollIntoView({behavior:'smooth',block:'start'});};
 // 전장 위 ⚙(매치 설정으로 이동)을 누르면 펼친다.
 for(const id of ['matchSettingsBtn','fsSettings'])document.getElementById(id)?.addEventListener('click',()=>{if(collapsed){collapsed=false;save();render();}},true);
 // 수량·빠른 설정이 바뀌면 요약을 다시 그린다(앱이 값을 반영한 뒤).
 for(const type of ['input','change','click'])setup.addEventListener(type,e=>{if(e.target!==bar&&!bar.contains(e.target))setTimeout(render,0);},true);
 query.addEventListener('change',render);render();
}
