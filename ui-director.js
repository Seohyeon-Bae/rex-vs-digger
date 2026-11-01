// Claude 1.9.x 제안: 감독 카메라 켜기/끄기 버튼. 자동 추적 버튼 옆에 같은 모양으로 둔다(기본 꺼짐, 이 기기에 기억).
// 렌더러에는 'ui-director' 이벤트로만 알린다(renderer.js의 camera-follow 기능이 받음). 그 기능이 없으면 아무 일도 하지 않는다.
// 두 버튼은 글자 없이 같은 "뷰파인더 모서리" 모양을 공유한다: 자동 추적 = 가운데 조준점, 하이라이트 = 가운데 반짝임.
const auto=document.getElementById('autoFollow'),KEY='ui-director';
const frame='<path d="M3 8V4.5A1.5 1.5 0 0 1 4.5 3H8M16 3h3.5A1.5 1.5 0 0 1 21 4.5V8M21 16v3.5a1.5 1.5 0 0 1-1.5 1.5H16M8 21H4.5A1.5 1.5 0 0 1 3 19.5V16"/>';
const svg=body=>`<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${frame}${body}</svg>`;
const AUTO_ICON=svg('<circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>');
const DIRECTOR_ICON=svg('<path d="M12 6.2l1.6 4.2 4.2 1.6-4.2 1.6L12 17.8l-1.6-4.2L6.2 12l4.2-1.6z" fill="currentColor" stroke-width="1.2"/>');
if(auto){
 document.head.append(Object.assign(document.createElement('link'),{rel:'stylesheet',href:'ui-camera-buttons.css'}));
 auto.querySelector('svg')?.replaceWith(document.createRange().createContextualFragment(AUTO_ICON));
 let on=false;try{on=localStorage.getItem(KEY)==='1';}catch{}
 const btn=document.createElement('button');btn.type='button';btn.id='directorBtn';btn.className='auto-follow director-toggle';
 btn.innerHTML=DIRECTOR_ICON+'<span class="director-state" aria-hidden="true">OFF</span>';
 const sync=()=>{btn.querySelector('.director-state').textContent=on?'ON':'OFF';btn.setAttribute('aria-pressed',String(on));btn.setAttribute('aria-label','다이나믹 카메라 '+(on?'ON':'OFF'));btn.title='다이나믹 카메라 · '+(on?'ON':'OFF')+' — 주요 공격·패링·접전을 따라 확대하고 각도를 바꿉니다. 개체를 직접 선택하면 선택한 개체를 우선합니다.';dispatchEvent(new CustomEvent('ui-director',{detail:on}));};
 btn.onclick=()=>{on=!on;try{localStorage.setItem(KEY,on?'1':'0');}catch{}sync();};
 auto.after(btn);sync();
}
