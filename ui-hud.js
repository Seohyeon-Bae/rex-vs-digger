// Claude 1.9.x 제안: 추적 패널 스킬 설명 정리(ui-hud.css). 내용·동작은 battle-panels.js 그대로.
// 제목 앞에 스킬 아이콘, 수치 이름 끝 " : " 제거, 설명 속 핵심 용어(스턴·경직·패링 등)에 캐릭터 소개와 같은 뜻 풀이를 단다.
import {skillIcon} from './skill-icons.js';
import {kindByName,markTerms} from './ui-guide-skills.js';
for(const href of ['ui-guide-skills.css','ui-hud-extras.css'])if(!document.querySelector(`link[href="${href}"]`))document.head.append(Object.assign(document.createElement('link'),{rel:'stylesheet',href}));
const decorate=box=>{
 for(const s of box.querySelectorAll('.skill-facts span'))s.textContent=s.textContent.replace(/\s*:\s*$/,'');
 for(const el of box.querySelectorAll('p,.skill-facts>div:not(:has(b))'))if(!el.dataset.uiEnhanced){el.dataset.uiEnhanced='1';markTerms(el);}
 const h=box.querySelector('h3'),kind=kindByName.get(h?.textContent.trim());
 if(h&&kind&&!h.querySelector('.skill-picture'))h.insertAdjacentHTML('afterbegin',skillIcon(kind).replace(/<svg class="skill-clock"[\s\S]*$/,''));};
const watch=()=>{const box=document.getElementById('trackedSkillHint');if(!box)return false;new MutationObserver(()=>decorate(box)).observe(box,{childList:true});return true;};
if(!watch())addEventListener('load',watch,{once:true});
