// Claude 1.9.x 제안: 캐릭터 소개 스킬 탭. character-guide.js가 만든 카드에 모양만 덧붙인다.
// 1) 스킬 이름 앞에 기존 스킬 아이콘(skill-icons.js) 2) 설명 속 핵심 용어 강조 + 마우스 올림/누름 시 뜻 표시.
import {TECHNIQUES} from './engine.js';
import {skillIcon} from './skill-icons.js';
const TERMS=[
 ['추가 대상','한 번의 공격에 첫 상대 말고 함께 맞은 상대입니다.'],
 ['밀쳐내기','맞은 상대를 뒤로 밀어내는 효과입니다.'],
 ['치명타','더 큰 피해(기본 1.55배)가 들어가는 적중입니다.'],
 ['옆구리','상대가 바라보는 방향의 옆쪽입니다. 포크레인은 옆에서 맞으면 피해를 40% 더 받습니다.'],
 ['스턴','1.2~1.8초 동안 행동할 수 없습니다. 시간이 중첩되지 않고, 해제 후 0.65초 동안 다시 스턴에 걸리지 않습니다. 피해와 짧은 경직은 받습니다.'],
 ['경직','맞은 직후 아주 짧게 동작이 끊기는 상태입니다. 스턴보다 훨씬 짧습니다.'],
 ['빈틈','공격을 헛치거나 패링당하는 등 자세가 무너진 뒤 생깁니다. 이때 받는 피해가 25% 늘어납니다(돌진 제외). 모든 경직에 적용되지는 않습니다.'],
 ['충전','모아 둘 수 있는 사용 횟수입니다. 쓰면 하나씩 시간이 지나 다시 찹니다.'],
 ['패링','무기가 실제로 맞닿았을 때 상대 공격을 막아 끊는 것입니다.'],
];
const pattern=new RegExp(TERMS.map(([t])=>t).join('|'),'g'),tip=Object.fromEntries(TERMS),kindByName=new Map();
for(const team of ['rex','dig'])for(const t of TECHNIQUES[team])kindByName.set(t.name,t.kind);
const firstSvg=html=>html.slice(0,html.indexOf('</svg>')+6);
// 말풍선이 화면 밖으로 나가지 않게: 용어가 오른쪽 끝 가까이면 왼쪽으로, 왼쪽 끝이면 오른쪽으로 펼친다.
function placeTip(e){const el=e.currentTarget,r=el.getBoundingClientRect(),room=Math.min(260,innerWidth*.7)/2;el.classList.toggle('tip-left',r.left+r.width/2+room>innerWidth-8);el.classList.toggle('tip-right',r.left+r.width/2-room<8);}
export {kindByName};
export function markTerms(el){
 const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())if(!walker.currentNode.parentElement.closest('.kw'))nodes.push(walker.currentNode);
 for(const node of nodes){const text=node.nodeValue;pattern.lastIndex=0;if(!pattern.test(text))continue;pattern.lastIndex=0;const frag=document.createDocumentFragment();let last=0,m;
  while((m=pattern.exec(text))){frag.append(text.slice(last,m.index));const span=document.createElement('span');span.className='kw';span.tabIndex=0;span.setAttribute('aria-label',m[0]+' : '+tip[m[0]]);span.addEventListener('keydown',e=>{if(e.key==='Escape')span.blur();});span.dataset.tip=tip[m[0]];span.textContent=m[0];span.addEventListener('pointerenter',placeTip);span.addEventListener('focus',placeTip);frag.append(span);last=m.index+m[0].length;}
  frag.append(text.slice(last));node.replaceWith(frag);}
}
function enhance(root){
 for(const card of root.querySelectorAll('.character-skill:not([data-ui-enhanced])')){card.dataset.uiEnhanced='1';const h=card.querySelector('h3'),kind=card.dataset.skillKind||kindByName.get(h?.textContent.trim());
  if(h&&kind&&!h.querySelector('.skill-picture')){const icon=document.createElement('span');icon.className='skill-icon-mini';icon.innerHTML=firstSvg(skillIcon(kind));h.prepend(icon);}
  for(const p of card.querySelectorAll('p'))markTerms(p);}
 for(const el of root.querySelectorAll('.skill-rules li:not([data-ui-enhanced]), :scope>p:not([data-ui-enhanced])')){el.dataset.uiEnhanced='1';markTerms(el);}
}
const skills=document.getElementById('characterSkills');
if(skills){
 document.head.append(Object.assign(document.createElement('link'),{rel:'stylesheet',href:'ui-guide-skills.css'}));
 enhance(skills);new MutationObserver(()=>enhance(skills)).observe(skills,{childList:true});
}
