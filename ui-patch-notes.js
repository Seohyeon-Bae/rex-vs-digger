// Claude 1.9.x 제안: 업데이트 내역 읽기 쉽게. patch-notes.js의 기록 내용은 바꾸지 않고, 만들어진 창에 모양만 덧붙인다.
// 1) 버전마다 맨 위 "한눈에 보기"(분류별 첫 항목, 최대 3개) 2) 접힌 버전 제목에 "변경 n개" 3) 분류 제목을 색 태그로.
const dialog=document.getElementById('patchNotesDialog');
const kind=title=>/티라노/.test(title)?'rex':/포크레인/.test(title)?'dig':/소리|음악|사운드|효과음/.test(title)?'sound':/카메라|화면|관전|표시|전장|소개|기록|조작|정보|도시/.test(title)?'view':/설정|숙련도|편의/.test(title)?'settings':'combat';
if(dialog&&!dialog.dataset.enhanced){
 dialog.dataset.enhanced='1';
 document.head.append(Object.assign(document.createElement('link'),{rel:'stylesheet',href:'ui-patch-notes.css'}));
 const intro=dialog.querySelector('.patch-intro');if(intro)intro.textContent='최신 업데이트가 맨 위에 있습니다. 버전을 누르면 펼쳐지고, 각 버전 맨 위 "한눈에 보기"에 핵심만 모았습니다.';
 for(const section of dialog.querySelectorAll('details.patch-release')){
  const body=section.querySelector('.patch-body'),summary=section.querySelector('summary');if(!body||!summary)continue;
  const picks=[];let total=0;
  for(const h of body.querySelectorAll('h3')){const k=kind(h.textContent);h.classList.add('patch-tag','tag-'+k);const list=h.nextElementSibling?.tagName==='UL'?h.nextElementSibling:null;if(list&&picks.length<3&&list.firstElementChild)picks.push([k,h.textContent,list.firstElementChild.textContent]);}
  total=body.querySelectorAll('li').length;
  if(total){const count=document.createElement('span');count.className='patch-count';count.textContent='변경 '+total+'개';summary.append(count);}
  if(picks.length>1){const box=document.createElement('div');box.className='patch-highlights';const head=document.createElement('strong');head.textContent='한눈에 보기';const ul=document.createElement('ul');
   for(const [k,cat,text] of picks){const li=document.createElement('li'),tag=document.createElement('span');tag.className='patch-tag-mini tag-'+k;tag.textContent=cat;li.append(tag,text);ul.append(li);}
   box.append(head,ul);body.prepend(box);}
 }
}
