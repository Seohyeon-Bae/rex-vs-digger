import {BUFFS} from './buffs.js';
import {guardStats,crewProfile,attackCriticalChance} from './engine.js';
// Claude 문안 (1.9.0 제안). 줄 형식 '라벨 : 값'은 기존 전투 패널 표시 방식과 같다.
// 순서: 대상 → 피해 → 대기/충전 → 그 스킬만의 특수 효과. 공통 규칙은 skillRules()로 한 번만 보여 준다.
const n=value=>Math.round(value).toLocaleString('ko-KR'),pct=value=>(value*100).toLocaleString('ko-KR',{maximumFractionDigits:1})+'%',sec=value=>value.toFixed(1)+'초';
export function skillFacts(skill,unit,config){
 if(!unit)return'';const team=unit.team,level=config[team+'Skill'];
 if(skill.buff||skill.kind==='rage'||skill.kind==='overdrive'){const duration=BUFFS[team].duration,wait=15*config.tuning[team].moves[skill.kind].cooldown;return '대상 : 자신\n지속 : '+duration+'초\n대기 : 효과 종료 후 '+sec(wait)+'\n'+(team==='rex'?'공격 준비·마무리 시간 15% 단축 · 이동 속도 30% 증가\n광폭화 중 돌진 충전 무제한 · 종료 후 기존 충전 상태로 복귀\n돌진·도약 적중 후 다른 기술로 이으면 준비 시간 추가 10% 단축\n적중한 상대를 2초간 우선 추격 · 해당 상대를 향한 회전 속도 25% 증가':'팔 조작 속도 55% 증가 · 다음 공격부터 마무리 시간 약 29% 단축\n모든 공격이 치명타로 적중 · 피해 1.55배\n붙잡기·던지기·몸통 충돌에도 적용 · 파괴 폭발 제외\n패링 성공 시 압력 1 획득(최대 3)\n다음 횡베기·회전의 밀쳐내기 압력당 18% 증가(사용 시 소모)')+'\n'+(team==='rex'?'피해량·체력은 바뀌지 않음':'주변 적이 2명 이상일 때 시작한 횡베기·회전 피해 35% 증가 · 동작 시간 20% 단축 · 체력·충전 횟수는 바뀌지 않음');}
 if(skill.kind==='parry'){const guard=guardStats(team,level,config.tuning[team]);
  if(guard.chance<=0)return'패링 : 사용 안 함';
  return team==='rex'
   ?'사용 : 꼬리 휘두르기 충전 1회\n회복 : '+sec(guard.cooldown)+'\n막힌 포크레인 : 공격이 끊기고 밀려남\n반격 : 성공하면 남은 돌진 충전을 다시 사용 가능 · 성공 후 0.9초 안에 물기·돌진·도약을 빠르게 연결'
   :'횟수 : 방어 자세 한 번에 최대 10건\n막힌 티라노 : 0.3초 경직 · 뒤로 밀려남\n뚫렸을 때 : 0.5초 동안 다시 막지 못함 · 0.3초간 받는 피해 25% 증가(돌진 제외)\n횟수 회복 : 1초 동안 막지 않으면 10회로 회복\n10회 모두 사용 : 0.25초 경직 · 회복 '+sec(guard.cooldown*1.5);}
 const tuning=config.tuning[team].moves[skill.kind],factor=skill.damage*tuning.damage,base=unit.stats.damage,cooldown=skill.cooldown*tuning.cooldown,lines=[];
 const add=(label,value)=>lines.push(label+' : '+value),dmg=(f,label='피해')=>add(label,pct(f)+' ('+n(base*f)+')');
 const critArea=pct(Math.min(.5,crewProfile(level).critical+.34*level/5));
 switch(skill.kind){
  case'bite':add('대상','1명');dmg(factor);add('대기','없음 · 기본 공격');break;
  case'ram':add('대상','최대 2명');add('피해',pct(factor)+'~'+pct(factor*1.35)+' ('+n(base*factor)+'~'+n(base*factor*1.35)+')');add('충전','3회 · 1회 회복 '+sec(cooldown));lines.push('광폭화 중 충전 무제한 · 공통 공격 대기와 피격·패링 제약 유지');
   lines.push('곧게 12m 이상 달려오면 최대 피해 · 빈틈 추가 피해 없음','옆으로 비켜 피할 때도 충전 1회 사용','치명타 피해 1.3배','충분히 달려와(65% 이상) 포크레인 옆구리에 맞으면 1.2초 스턴');break;
  case'tail':add('대상','최대 5명');dmg(factor);add('충전','2회 · 1회 회복 '+sec(cooldown)+' · 패링과 공용');
   lines.push('포크레인 상대 치명타 55% · 한 번 휘두를 때 맞은 포크레인 모두 같은 판정','패링으로 막을 수 없음 · 몸에 닿아야 피해','포크레인 옆구리에 치명타가 나면 1.2초 스턴','방어 자세의 포크레인을 맞히면 0.8초 안에 그 상대에게 쓰는 다음 기술 1개도 막히지 않음 · 반격에 맞으면 해제');break;
  case'leap':add('대상','착지 지점 주변 최대 4명');dmg(factor);add('대기',sec(cooldown));lines.push('내려오는 중 버킷에 걸리면 공격이 끊기고 떨어짐','헛치면 0.8초간 빈틈');break;
  case'pounce':add('대상','착지 최대 5명 · 구르기 최대 5명');lines.push('구르기 최대: 공격 2.3초 / 회피 2.4초 · 자체 이동 한도: 공격 18m / 회피 26m · 접촉 시 감속 · 적중 후 물기·꼬리 연계 · 구르는 동안 피해 무시, 밀쳐내기는 적용 · 도약 중에는 피해를 받음');dmg(factor,'착지 피해');add('구르기 접촉 피해',pct(.2*tuning.damage)+' · 0.25초 간격, 대상당 최대 3회');add('구르기 마무리',pct(.6*tuning.damage)+' ('+n(base*.6*tuning.damage)+') · 접촉한 적에게 1회 피해와 강한 밀쳐내기');lines.push('접촉 3회와 마무리 합계 최대 '+pct(1.2*tuning.damage)+' · 실제 몸에 닿은 적만 피해 · 이동 중 4m, 마무리 6m 안의 적 최대 12명 추가 밀쳐내기(피해 없음)');lines.push('구르기 추가 대상 피해 10% · 실제 몸에 닿은 적만 공격 · 추가 대상의 밀쳐내기와 경직은 약하게 적용');add('대기',sec(cooldown));lines.push('내려오는 중 버킷에 걸리면 공격이 끊기고 떨어짐','헛치면 1.2초간 빈틈');break;
  case'smash':add('대상','버킷에 닿은 최대 2명');dmg(factor);add('대기','없음 · 기본 공격');lines.push('머리 정타 피해 25% 증가 · 땅에 눌러 1.8초 스턴');break;
  case'sweep':add('대상','최대 4명 · 티라노 2마리 이상 가까우면 6명');dmg(factor);add('대기',sec(cooldown));add('치명타',critArea+' · 한 번 휘두를 때 맞은 상대 모두 같은 판정');lines.push('도약 공격으로 높이 뜬 티라노는 맞지 않음');break;
  case'uppercut':add('대상','버킷에 닿은 최대 2명');dmg(factor);add('대기',sec(cooldown));lines.push('턱 정타 피해 25% 증가 · 높이 띄운 뒤 착지할 때 1.2초 스턴');break;
  case'spin':add('대상','최대 4명 · 티라노 2마리 이상 가까우면 6명');dmg(factor);add('대기',sec(cooldown));add('치명타',critArea+' · 한 번 돌 때 맞은 상대 모두 같은 판정');lines.push('도는 버킷이 꼬리에 부딪히면 막힐 수 있음');break;
  case'grapple':add('대상','붙잡은 1명 · 굴러가는 몸에 닿은 적 최대 4명');add('붙잡기 피해',pct(.8*tuning.damage));add('던지기 피해',pct(1.4*tuning.damage));add('바닥 충돌 피해',pct(1.8*tuning.damage));add('몸통 충돌 피해',pct(.95*tuning.damage));add('대기',sec(cooldown));lines.push('바닥으로 강하게 던진 뒤 최대 1.15초·16m 굴러감','주변 적의 이동과 아군 위치를 보고 던질 방향 선택','실제 이동 경로에서 몸에 닿은 적만 공격 · 같은 적은 한 번','던져진 대상은 착지하면 1.5초 스턴');break;
  default:dmg(factor);add('대기',cooldown?sec(cooldown):'없음');
 }
 if(team==='dig'&&['smash','uppercut','sweep','spin','grapple'].includes(skill.kind))lines.push('오버드라이브 중 치명타 '+pct(attackCriticalChance({...unit,buffActive:true,buffUntil:1},skill.kind,config,0)));if(team==='rex'&&skill.targets>1)lines.push('두 번째 대상부터 피해 10%'+(skill.kind==='tail'?' · 밀쳐내기·경직 35%':''));return lines.join('\n');
}
