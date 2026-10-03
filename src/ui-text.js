import { SKILLS, TAGS, CORES, METHODS, HYBRIDS, RELICS, STAT_CARDS, ROUTES, TAG_FINALS, ENEMIES } from './data.js';

// Display text only. Combat IDs, source tags, numbers, and save data stay in data.js.
const SKILL_NAMES = Object.freeze({ overcharge: '전도', bomb: '폭탄', hole: '블랙홀', cut: '절단', orbital: '포격', seed: '감염' });
const BRANCH_NAMES = Object.freeze({ fork: '갈래', needle: '관통', cluster: '분산', compression: '압축', twin: '쌍홀', anchor: '고정', lattice: '격자', razor: '칼날', watchtower: '망루', hunter: '추적', carrier: '운반', reservoir: '저장' });
const MODIFIER_NAMES = Object.freeze({ grounding: '접지', capacitor: '축전', remote_fuse: '수동 기폭', delayed_return: '잔류', mass_ledger: '질량 장부', tidal_pull: '경계 감속', afterimage: '잔상', rupture_edge: '파열', marked_target: '표적 예약', incendiary_fuel: '화염', manual_detonate: '직접 기폭', dormant_soil: '잠복 지대' });
const EVOLUTION_NAMES = Object.freeze({
  overcharge: ['확산 표식', '반환 전류', '살아있는 회로'],
  bomb: ['충격 고리', '연쇄 폭발', '기록 폭발'],
  hole: ['중력 붕괴', '중심 이동', '현실 접기'],
  cut: ['남은 균열', '교차 폭발', '회전 절단'],
  orbital: ['표적 추적', '구역 이동', '십자망'],
  seed: ['감염 흔적', '숙주 이식', '감염 확산'],
});
const RULE_NAMES = Object.freeze({
  conductive_scar: '전도 흉터', origin_echo: '원점 반향', spore_census: '포자 집계', patient_zero: '최초 숙주', orbit_shear: '궤도 전단', event_horizon: '사건의 지평', target_lease: '표적 지정', relay_beacon: '중계점', overkill: '초과 삭제', precision_window: '정밀 타격', after_cast: '시전 후속', alternating_circuit: '교대 회로',
  contagion_circuit: '감염 회로', orbit_relay: '궤도 중계', relay_hunt: '중계 사냥', railgun_scar: '관통 흉터', echo_order: '반향 명령', quarantine_collapse: '격리 붕괴', parasite_hive: '기생 군집', patient_zero_strike: '최초 타격', delayed_script: '지연 기폭', cross_gravity: '교차 중력',
  crossed_wires: '교차 배선', lens: '기억 렌즈', time_capsule: '시간 캡슐', anchor_heart: '고정점 심장', swarm_clock: '군집 시계', hollow_crown: '공허 왕관',
  chain_voltage: '전압', chain_recharge: '충전 회복', infection_potency: '독성', infection_space: '감염 공간', gravity_depth: '중력 깊이', gravity_reach: '중력 도달', swarm_payload: '포격 적재', swarm_support: '지원 펄스', impact_force: '타격력', impact_critical: '치명각', caster_payload: '시전 무게', caster_flow: '시전 흐름', integrity_buffer: '안정도 보강', emergency_patch: '긴급 복구',
  stable_supply: '안정 보급', elite_seal: '엘리트 봉합', forbidden_rift: '금지 균열', final_stroke: '최종 타격', rewrite_sequence: '시전 재작성', reserve_core: '진화 코어 보관',
});
const CORE_SUMMARIES = Object.freeze({
  overcharge: '전도 경로를 조준하고 직접 공격으로 방출합니다.',
  bomb: '범위를 조준하고 클릭해 0.8초 뒤 폭파합니다.',
  hole: '적을 끌어모으는 블랙홀을 만듭니다.',
  cut: '절단 경로를 조준하고 클릭해 공간을 가릅니다.',
  orbital: '조준 구역에 4발을 포격합니다.',
  seed: '한 적을 감염시켜 주변으로 퍼뜨립니다.',
});
const STAT_SUMMARIES = Object.freeze({
  chain_voltage: '공격력 +8%.', chain_recharge: '직접 공격 충전 회복 속도 +10%.', infection_potency: '공격력 +8%.', infection_space: '직접 공격 반경 +6px.', gravity_depth: '스킬 피해 +12%.', gravity_reach: '직접 공격 반경 +6px.', swarm_payload: '소환 피해 +15%.', swarm_support: '자동 펄스 속도 +12%.', impact_force: '직접 공격 피해 +15%.', impact_critical: '주대상 치명타 확률 +6%p. 최대 60%.', caster_payload: '스킬 피해 +12%. 소환 피해에는 적용되지 않습니다.', caster_flow: '스킬 재사용 감소 +6%p. 최대 40%.', integrity_buffer: '최대 안정도 +12, 즉시 안정도 12 회복.', emergency_patch: '즉시 안정도 24 회복, 위협 −5.',
});
const OPTION_SUMMARIES = Object.freeze({
  fork: '5갈래로 넓게 전도합니다. 갈래별 피해는 기본의 70%입니다.',
  needle: '후속 목표 1명에게 90 피해. 직접 공격 피해의 50%가 방패를 우회합니다.',
  cluster: '본 폭발은 170 피해. 생존 적 2곳에 90 피해의 작은 폭탄을 더합니다.',
  compression: '반경을 55px로 줄이고 중심 피해를 340으로 올립니다.',
  twin: '반경 85px의 두 홀로 나눕니다. 흡입·피해는 각각 70%, 겹친 적은 가까운 홀 하나만 적용됩니다.',
  anchor: '반경 145px의 한 홀로 넓게 흡입합니다. 고정점 앞 적들을 모으기 좋습니다.',
  lattice: '130 피해의 주선과 수직선 2개를 긋습니다. 교점의 한 적은 최대 220 피해를 받습니다.',
  razor: '길이 460px·폭 12px의 가는 선으로 285 피해를 줍니다.',
  watchtower: '가까운 고정점에 명령 구역을 설치하고 채널링 중인 적을 먼저 포격합니다.',
  hunter: '명령 구역이 우선 목표를 따라갑니다. 착탄 예고가 0.15초 길어집니다.',
  carrier: '서로 다른 두 적에게 65% 감염을 옮깁니다. 옮겨진 감염은 재전파하지 않습니다.',
  reservoir: '전파를 멈추고 처음 숙주의 초당 피해 +10, 기폭 피해 +70.',
  grounding: '전도가 보호자·채널러에 닿으면 보호와 채널을 2초 끊습니다. 한 전도에서 1회 적용됩니다.',
  capacitor: '마지막 생존 전도 대상에 4초 표식을 남깁니다. 표식 소비 피해 +20, 1진화부터 생존자 모두에 적용됩니다.',
  remote_fuse: '폭탄 안 직접 공격으로 최대 0.15초 후 기폭합니다. 본 폭발 피해는 15% 줄어듭니다.',
  delayed_return: '폭발 자리에 3초 잔류 구역을 남겨 초당 30 피해를 줍니다.',
  mass_ledger: '종료 붕괴의 추가 피해가 질량당 30으로 증가합니다. 최대 추가 피해 240.',
  tidal_pull: '홀 경계를 벗어난 적을 1.5초 동안 25% 감속합니다. 보스는 대신 2초 노출됩니다.',
  afterimage: '0.5초 뒤 같은 선으로 70 피해를 한 번 더 줍니다.',
  rupture_edge: '절단 생존자에 파열 5초. 다음 직접 공격 주대상 피해 +40% 후 소모됩니다.',
  marked_target: '구역 안 직접 공격으로 미잠금 포격 1발을 클릭 위치에 예약하고 피해 +30. 명령당 2회.',
  incendiary_fuel: '탄착점에 2.4초 화염을 남깁니다. 들어온 적에 초당 18 피해의 화상을 심습니다.',
  manual_detonate: '감염자 직접 공격으로 즉시 기폭합니다. 사망 기폭값에 20%를 더합니다.',
  dormant_soil: '감염 처치 자리에 3초 지대를 남깁니다. 첫 통과 적 1명에 65% 감염을 심습니다.',
});
const EVOLUTION_SUMMARIES = Object.freeze({
  overcharge: [
    '전도 생존자 모두에 4초 표식. 직접 공격으로 소비하면 새 목표에 60 전도.',
    '표식 대상 처치로 근처 적에게 55 전도. 한 전도에서 최대 2회.',
    '방출 뒤 2.5초 안에 다시 조준하고 클릭해 출발점을 지정합니다. 처음 위치로 돌아오면 주변 적이 노출됩니다.',
  ],
  bomb: [
    '생존자를 최대 90px 밀고 3초 노출시킵니다. 보스는 밀려나지 않습니다.',
    '폭발로 5명 처치하면 80 피해 미니 폭탄. 단일 보스에는 파열 2초.',
    '스킬 키를 0.5초 이상 눌러 기록을 조준하고 클릭해 재생합니다. 기록 폭발 재사용 대기 24초.',
  ],
  hole: [
    '종료 붕괴가 범위 안 보호 연결을 절단합니다.',
    '설치 뒤 3초 안에 다시 조준하고 클릭해 중심을 최대 180px, 1회 옮깁니다.',
    '설치 뒤 1.2초 안에 다시 조준하고 클릭해 80–360px 떨어진 두 번째 점을 지정합니다. 통로에 200 + 질량×20 피해.',
  ],
  cut: [
    '2초 균열을 남깁니다. 처음 건너는 적이 2초 노출됩니다.',
    '절단 교점에 반경 45px·100 피해 폭발. 칼날도 보조 균열로 교점을 만듭니다.',
    '3초 동안 두 번 회전하며 적마다 최대 2회 적중합니다. 다시 조준하고 클릭해 기점을 1회 옮깁니다.',
  ],
  orbital: [
    '착탄 0.3초 전까지 적을 추적합니다. 잠긴 탄의 위치는 바뀌지 않습니다.',
    '명령 중 다시 조준하고 클릭해 구역을 1회 옮깁니다. 잠긴 탄은 이전 위치에 떨어집니다.',
    '게이지 50으로 시작하며, 50 이상에서 네트워크 키로 5초 십자망을 펼칩니다. 교차점에서 피해가 더 큽니다.',
  ],
  seed: [
    '감염자의 이동 경로에 2초 흔적을 남깁니다. 건강한 적 최대 2명에 65% 감염.',
    '처음 숙주가 죽으면 남은 감염을 건강한 적 1명에게 이식합니다. 처음 감염당 1회.',
    '직접 기폭 뒤 0.5초 안에 스킬 키로 조준을 시작하고 클릭하세요. 부채꼴 안 최대 3명에 65% 감염을 심습니다.',
  ],
});
const HYBRID_SUMMARIES = Object.freeze({
  contagion_circuit: '감염자 전도 적중 → 다음 전도 대상에 남은 감염 시간의 65%를 복사합니다. 한 전도에서 최대 2회.',
  orbit_relay: '홀 안 전도 적중 → 질량 2를 쓰고 반대편 새 목표에 55 전도.',
  relay_hunt: '명령 구역 안 직접 처치 → 새 적 2명에 55 전도. 4초마다 1회.',
  railgun_scar: '강타가 치명타이거나 초과 피해 50 이상이면 100 피해 관통선을 만듭니다.',
  echo_order: '첫 스킬 → 5초 안 두 번째 스킬: 두 번째 스킬의 첫 적중 자리에서 50 전도. 순서당 1회.',
  quarantine_collapse: '홀 안 감염 전파를 저장합니다. 종료 때 바깥 최대 3명에 65% 감염, 붕괴 피해 +40.',
  parasite_hive: '액티브 포격 생존자 최대 2명에 65% 감염. 스카우트는 감염자 주변의 건강한 적을 먼저 조준합니다.',
  patient_zero_strike: '감염자 강타 → 즉시 기폭, 남은 감염 1초당 +30 피해. 추가 피해 최대 90.',
  delayed_script: '5초 안에 다른 스킬로 첫 감염을 기폭하면 두 번째 스킬 재사용 대기 −2초. 주기당 1회, 최소 남은 2초.',
  cross_gravity: '명령 구역이 가까운 홀을 초당 80px 끌어옵니다. 십자망은 120px, 자동 이동 중 수동 이동은 잠깁니다.',
});

const RULES = [...METHODS, ...HYBRIDS, ...RELICS, ...STAT_CARDS, ...ROUTES, ...TAG_FINALS];
const rulesById = new Map(RULES.map(rule => [rule.id, rule]));
const skillsById = new Map(SKILLS.map(skill => [skill.id, skill]));
const optionsById = new Map(SKILLS.flatMap(skill => [...skill.branches, ...skill.modifiers]).map(option => [option.id, option]));
const hasKorean = value => /[가-힣]/.test(value);
const rawName = value => String(value?.title ?? value?.name ?? value?.ko ?? value?.id ?? value ?? '').trim();
function koreanPart(value) {
  const text = rawName(value), parts = text.split(/\s*[·|]\s*/).filter(hasKorean);
  return parts.length ? parts.join(' · ') : text;
}
function skillId(value) {
  const id = typeof value === 'object' && value ? value.skillId ?? value.id : value;
  return CORES.find(core => core.id === id)?.skillId ?? id;
}
function knownId(card) {
  const id = typeof card === 'object' && card ? typeof card.selection === 'string' ? card.selection : String(card.id ?? '') : String(card ?? '');
  const option = id.match(/^(?:overcharge|bomb|hole|cut|orbital|seed)_(?:branch|modifier)_(.+)$/);
  return option?.[1] ?? id.replace(/_replace_\d+$/, '');
}
function evolutionCard(card) {
  const match = String(card?.id ?? card ?? '').match(/^(overcharge|bomb|hole|cut|orbital|seed)_evolution_([123])$/);
  if (match) return { id: match[1], stage: Number(match[2]) };
  if (card?.kind === 'evolution') return { id: card.skillId, stage: Number(card.selection ?? card.evolution) };
  return null;
}

export function skillName(id) {
  const resolved = skillId(id);
  return SKILL_NAMES[resolved] ?? koreanPart(skillsById.get(resolved)?.ko ?? skillsById.get(resolved) ?? id);
}
export function tagName(id) {
  return String(id ?? '').split('+').map(tag => tag.trim() === 'IMPACT' ? '충격' : TAGS[tag.trim()]?.ko ?? koreanPart(tag.trim())).join(' + ');
}
export function branchName(id) {
  const resolved = knownId(id);
  return BRANCH_NAMES[resolved] ?? koreanPart(optionsById.get(resolved) ?? id);
}
export function modifierName(id) {
  const resolved = knownId(id);
  return MODIFIER_NAMES[resolved] ?? koreanPart(optionsById.get(resolved) ?? id);
}
export function evolutionName(stage) {
  return ['기본', '1진화', '2진화', '최종'][Number(stage)] ?? `${stage ?? ''}진화`;
}
export function ruleName(id) {
  const resolved = knownId(id), evolution = evolutionCard(id);
  if (evolution) return EVOLUTION_NAMES[evolution.id]?.[evolution.stage - 1] ?? evolutionName(evolution.stage);
  if (RULE_NAMES[resolved]) return RULE_NAMES[resolved];
  if (SKILL_NAMES[resolved]) return skillName(resolved);
  if (CORES.some(core => core.id === resolved)) return `${skillName(resolved)} 코어`;
  if (BRANCH_NAMES[resolved]) return branchName(resolved);
  if (MODIFIER_NAMES[resolved]) return modifierName(resolved);
  for (const skill of SKILLS) {
    const index = skill.evolutionNames.indexOf(resolved);
    if (index !== -1) return EVOLUTION_NAMES[skill.id][index];
  }
  return koreanPart(rulesById.get(resolved) ?? id);
}
export function cardName(card) {
  if (card?.kind === 'skill') return skillName(card.skillId ?? card.selection ?? card.id);
  if (card?.kind === 'branch') return branchName(card.selection ?? card.id);
  if (card?.kind === 'modifier') return modifierName(card.selection ?? card.id);
  return ruleName(card);
}
export function enemyName(id) {
  const resolved = typeof id === 'object' && id ? id.type ?? id.id : id;
  return ({ archivist: '기록 보관자', conductor: '봉합 지휘자', reality: '현실 기관', training_boss: '이동 저항 표적' })[resolved] ?? ENEMIES[resolved]?.ko ?? koreanPart(id);
}

// Longest names first: replacing a skill name must happen before a generic term.
const words = new Map();
for (const [id, skill] of skillsById) {
  words.set(skill.name, skillName(id));
  skill.evolutionNames.forEach((name, index) => words.set(name, EVOLUTION_NAMES[id][index]));
  for (const option of [...skill.branches, ...skill.modifiers]) {
    const name = BRANCH_NAMES[option.id] ?? MODIFIER_NAMES[option.id];
    words.set(option.name, name); words.set(option.name.split(' · ')[0], name);
  }
}
for (const rule of RULES) { words.set(rule.name, RULE_NAMES[rule.id] ?? koreanPart(rule.name)); words.set(rule.name.split(' · ')[0], RULE_NAMES[rule.id] ?? koreanPart(rule.name)); }
for (const tag of Object.keys(TAGS)) words.set(tag, tagName(tag));
for (const [id, enemy] of Object.entries(ENEMIES)) { words.set(enemy.name, enemyName(id)); words.set(enemy.name.toUpperCase(), enemyName(id)); }
for (const [term, name] of Object.entries({
  'DIRECT DELETE': '직접 공격', 'CROSS NETWORK': '십자망', 'INITIAL ANOMALY': '시작 스킬', 'REALITY ENGINE': '현실 기관', 'THE ARCHIVIST': '기록 보관자', 'THE CONDUCTOR': '봉합 지휘자', 'PRIORITY TARGET': '우선 목표', 'WORLD CORE': '세계 핵', 'INTEGRITY LEAK': '안정도 손상', 'CHANNEL INCOMING': '채널 준비', 'SET POINT B': '두 번째 점 지정', 'WEAKNESS OPEN': '약점 열림', 'ANCHOR BREACH': '고정점 공격', 'INTEGRITY THREAT': '안정도 위험', 'CONTROLLED COLLAPSE': '제어 붕괴', 'RELAY BEACON': '중계점', 'RECORD': '기록 폭발', 'NETWORK': '십자망', 'MEMORY': '기억', 'VOID': '경험치', 'REWRITE': '다시 쓰기', 'Final': '최종', 'FINAL': '최종', 'EVOLUTION I': '1진화', 'EVOLUTION II': '2진화', 'EVOLUTION III': '최종', 'SKILL': '스킬', 'SUMMON': '소환', 'DIRECT': '직접 공격', 'AUTO': '자동 펄스', 'STATUS': '상태 효과', 'EMPTY': '없음', 'READY': '준비', 'BASE': '기본', 'EVO': '진화', 'ECHO': '잔향', 'ARMED': '설치', 'MASS': '질량', 'ROUTE': '출발점', 'RELOCATE': '다시 배치', 'PHASE': '단계', 'PRIORITY': '우선 목표', 'FULL': '완충', 'CHARGED': '강타', 'TAP': '탭', 'HOLD': '누르기',
})) words.set(term, name);
for (const [word, replacement] of [...words]) if (/[A-Za-z]/.test(word)) words.set(word.toUpperCase(), replacement);
const wordPatterns = [...words].sort(([a], [b]) => b.length - a.length).map(([word, replacement]) => [new RegExp(`(^|[^A-Za-z0-9_])${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![A-Za-z0-9_])`, 'g'), replacement]);
export function displayText(value) {
  let text = String(value ?? '');
  for (const [pattern, replacement] of wordPatterns) text = text.replace(pattern, (_, prefix) => prefix + replacement);
  return text.replaceAll('무결성', '안정도').replaceAll('호스트', '숙주').replaceAll('쿨다운', '재사용 대기').replaceAll('재사용 대기과', '재사용 대기와').replaceAll('태그', '속성').replaceAll('하이브리드', '조합').replaceAll('메서드', '특성').replaceAll('스킬 홀드', '스킬 키를 누른 채').replaceAll('내부 재사용 대기', '효과 재사용 대기').replaceAll('직접 삭제', '직접 공격').replaceAll('압력', '위협').replaceAll('직접 공격가', '직접 공격이').replaceAll('직접 공격를', '직접 공격을').replaceAll('직접 공격로', '직접 공격으로').replaceAll('속성가', '속성이').replaceAll('속성를', '속성을');
}
export function coreSummary(id) {
  const resolved = skillId(id);
  return CORE_SUMMARIES[resolved] ?? displayText(skillsById.get(resolved)?.description ?? rawName(id));
}
export function skillHelp(slot) {
  const def=skillsById.get(slot.id);if(!def)return '';
  let base=displayText(def.description),detail=displayText(def.detail);
  if(slot.id==='overcharge')base=base.replace('6초 동안 다음 직접 공격을 무장한다.', '경로를 조준한 뒤 직접 공격으로 전도를 확정합니다.');
  if(slot.id==='cut'){
    base=base.replace('홀드로 방향을 그리고 놓아', '조준을 시작한 위치에서 방향을 정하고 클릭해');
    detail='마우스를 움직여 경로를 정합니다. 보호 연결과 흩어진 적을 같은 선으로 자릅니다.';
  }
  const parts=[base,detail,def.branches.find(b=>b.id===slot.branch)?.description,def.modifiers.find(m=>m.id===slot.modifier)?.description];
  for(let i=0;i<(slot.evolution||0);i++)parts.push(EVOLUTION_SUMMARIES[slot.id]?.[i]);
  return parts.filter(Boolean).map(displayText).join(' ').replaceAll('커서 좌우', '조준점 좌우').replaceAll('커서 110px', '조준점 110px').replaceAll('커서 45px', '조준점 45px');
}
export function coreBonus(id) {
  const resolved = skillId(id), core = CORES.find(item => item.skillId === resolved);
  if (!core) return '';
  const labels = { power: '공격력', directBonus: '직접 피해', skillBonus: '스킬 피해', summonBonus: '소환 피해', autoRate: '자동 펄스 속도', chargeRate: '충전 회복 속도', radiusBonus: '직접 반경', cdr: '재사용 감소' };
  return Object.entries(core.bonuses ?? {}).map(([key, value]) => {
    const sign = value < 0 ? '−' : '+', amount = Math.round(Math.abs(value) * (key === 'radiusBonus' ? 1 : 100));
    return `${labels[key] ?? key} ${sign}${amount}${key === 'radiusBonus' ? 'px' : key === 'cdr' ? '%p' : '%'}`;
  }).join(' · ');
}
export function choiceSummary(card) {
  const id = knownId(card), evolution = evolutionCard(card);
  if (STAT_SUMMARIES[id]) return STAT_SUMMARIES[id];
  if (OPTION_SUMMARIES[id]) return OPTION_SUMMARIES[id];
  if (HYBRID_SUMMARIES[id]) return HYBRID_SUMMARIES[id];
  if (CORES.some(core => core.id === id)) return coreSummary(id);
  if (id === 'spore_census') return '감염자 직접 적중 → 90px 안 감염자 2명 이상이면 최대 3명의 남은 감염 시간을 0.3초로 단축.';
  if (evolution) return EVOLUTION_SUMMARIES[evolution.id]?.[evolution.stage - 1] ?? displayText(card?.description ?? '');
  const source = rulesById.get(id) ?? optionsById.get(id) ?? skillsById.get(card?.skillId ?? id);
  // Preserve the source for unrecognized choices; truncation would hide conditions or numbers.
  return displayText(card?.description ?? source?.description ?? rawName(card));
}

// Cards retain their full combat numbers while describing the world targeting input.
export function choiceDetails(card) {
  let description=displayText(card?.description),detail=displayText(card?.detail);
  const id=card?.skillId??skillId(card?.selection??card?.id),evolution=evolutionCard(card);
  if(card?.kind==='skill'){
    if(id==='overcharge')description=description.replace('6초 동안 다음 직접 공격을 무장한다.', '스킬 키로 경로를 조준한 뒤 클릭으로 전도를 방출한다.');
    if(id==='bomb')description=description.replace('지정 위치에', '스킬 키로 조준하고 클릭한 위치에');
    if(id==='hole')description=`스킬 키로 범위를 조준하고 클릭한 위치에 블랙홀을 설치한다. ${description}`;
    if(id==='cut'){
      description=description.replace('홀드로 방향을 그리고 놓아', '스킬 키로 중심을 정하고 마우스로 각도를 조절한 뒤 클릭해');
      detail=detail.replace('0.2초 미만 탭은 마지막 방향. 조준 최대 1.2초.', '커서 이동이 4px 이하이면 마지막 방향을 사용한다. 조준은 클릭할 때까지 유지된다.');
    }
    if(id==='orbital')description=`스킬 키로 공격 지역을 조준하고 클릭해 명령을 설치한다. ${description}`;
    if(id==='seed')description=description.replace('커서 45px 안 적에', '스킬 키로 조준한 45px 안 적을 클릭해');
  }else if(evolution){
    if(evolution.id==='overcharge'&&evolution.stage===3)description=description.replace('스킬을 다시 눌러 전도 출발점을 지정한다.', '스킬 키로 다시 조준한 뒤 클릭해 전도 출발점을 지정한다.');
    if(evolution.id==='bomb'&&evolution.stage===3)description=description.replace('0.5초 이상 스킬 키를 누른 채 후 놓으면', '스킬 키를 0.5초 이상 눌러 기록을 선택한 뒤 클릭하면').replace('일반 탭은 유지.', '짧게 누른 뒤 클릭하면 일반 폭탄을 설치한다.');
    if(evolution.id==='hole'&&evolution.stage===2)description=description.replace('버튼을 다시 눌러 중심을', '스킬 키로 다시 조준한 뒤 클릭해 중심을');
    if(evolution.id==='hole'&&evolution.stage===3)description=description.replace('버튼을 다시 눌러 두 번째 점 지정.', '스킬 키로 다시 조준한 뒤 클릭해 80–360px 떨어진 두 번째 점을 지정.');
    if(evolution.id==='cut'&&evolution.stage===3)description=description.replace('버튼을 다시 눌러 기점을', '스킬 키로 다시 조준한 뒤 클릭해 기점을');
    if(evolution.id==='orbital'&&evolution.stage===2)description=description.replace('버튼을 다시 눌러 구역 1회 재지정.', '스킬 키로 다시 조준한 뒤 클릭해 구역을 1회 재지정.');
    if(evolution.id==='orbital'&&evolution.stage===3)description=description.replace('T로', '네트워크 키로');
    if(evolution.id==='seed'&&evolution.stage===3)description=description.replace('직접 적중으로 기폭 후 0.5초 커서 방향 창.', '직접 적중으로 기폭한 뒤 0.5초 안에 스킬 키로 조준을 시작하고 클릭해 확산 방향을 확정.');
  }
  return {description:description.replaceAll('커서 좌우', '조준점 좌우'),detail:detail.replaceAll('커서 110px', '조준점 110px')};
}

const timeLabel = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
export function guidePages({ skill0 = 'E', skill1 = 'Q', network = 'T', pause = 'ESC', quick = false } = {}) {
  const pace = quick ? 3 : 1, at = seconds => timeLabel(seconds / pace);
  return [
    {
      id: 'basics', title: '시작', lead: '세 고정점을 지키며 적을 지우세요. 안정도가 0이 되면 끝납니다.',
      steps: [
        { title: '스킬 하나 선택', text: `시작 카드를 고르면 바로 전투가 시작됩니다. 첫 스킬은 ${skill0}입니다.` },
        { title: '능력 펼치기', text: `${skill0}로 조준을 시작하세요. 필드의 경로와 범위를 보고 클릭하면 능력이 펼쳐집니다.` },
        { title: '고정점 방어', text: '적색 경고가 뜨면 채널러를 직접 공격하거나 스킬로 끊으세요.' },
      ],
      cards: [
        { title: '직접 공격', text: '조준 중이 아니면 클릭으로 공격합니다. 0.8초 홀드는 강타. 충전 2개, 기본 회복은 충전당 2.8초입니다.' },
        { title: `${skill0} / ${skill1}`, text: `첫 스킬과 두 번째 스킬입니다. ${skill1}는 ${at(210)}에 선택합니다.` },
        { title: `${pause} · 기록`, text: '조준 중에는 취소, 평소에는 시간을 멈춥니다. 세계 저항·안정도·위협·빌드 분석을 확인하세요.' },
      ],
      note: '우클릭 또는 ESC로 조준을 취소할 수 있습니다. 취소하면 충전과 재사용 대기를 쓰지 않습니다.',
      details: [
        { title: '직접 공격의 정확한 수치', text: '기본 주대상 피해 110·반경 36px. 0.8초 강타는 165·48px입니다. 1.2초부터 완충이며, 최종 타격 같은 추가 조건에 사용됩니다. 반경 안 주변 적에는 약한 피해가 함께 들어갑니다. 시작 코어와 성장은 이 수치를 바꿉니다.' },
        { title: '필드의 미리보기', text: '전도는 연결될 대상 순서, 폭탄은 폭발 범위, 블랙홀은 흡입 영역, 절단은 시작점에서 그린 경로, 포격은 착탄 지역, 감염은 숙주와 확산 범위를 보여줍니다. 조준은 피해를 주지 않습니다.' },
        { title: '열이 높아지면', text: '전도로 열이 쌓입니다. 열 80 이상에서 강타를 적중하면 제어 붕괴가 일어나고 그 붕괴 처치 경험치가 20% 늘어납니다. 열 100은 자동 붕괴입니다. 두 경우 모두 직접 공격 충전 회복이 2초 멈춥니다.' },
      ],
    },
    {
      id: 'growth', title: '성장', lead: '적을 처치해 레벨을 올리고 스킬을 강화하세요.',
      steps: [
        { title: '경험치 채우기', text: '적을 지우면 경험치를 얻습니다. 경험치 막대가 차면 시간 정지 상태에서 성장 카드를 고릅니다.' },
        { title: '분기와 변형', text: '분기로 스킬의 형태를 정하고, 특수 변형으로 작동 방식을 더합니다. 이어 1진화 → 2진화 → 최종으로 성장합니다.' },
        { title: '진화 코어 얻기', text: '중간 보스와 균열 시련의 목표를 처치하면 코어를 얻습니다. 등장만으로 코어가 지급되지는 않습니다.' },
      ],
      cards: [
        { title: '특성', text: '해당 속성 4점과 실제 발동 수단이 필요합니다. 직접 공격과 스킬을 잇는 새 효과입니다.' },
        { title: '조합', text: '두 속성이 각각 4점이고 필요한 스킬·효과를 갖추면 열립니다. 한 판에 하나를 고릅니다.' },
        { title: '최종 · 판당 하나', text: '스킬 최종은 분기·변형·2진화, 해당 속성 4점, 실제 적중한 시전 8회가 필요합니다.' },
      ],
      note: '카드에서는 이름과 핵심 효과를 확인하세요. 속성 점수와 자세한 발동 조건은 상세 보기에서 읽을 수 있습니다.',
      details: [
        { title: '진화 코어와 보관', text: `첫 보스 ${at(480)}, 둘째 보스 ${at(780)}, 균열 시련 ${at(960)}에 등장합니다. 처치한 코어는 누락된 분기·변형부터 채운 뒤 진화합니다. 최종 조건이 모자라면 ${at(1050)}까지 보관하며, 이후 가능한 진화나 유물로 바뀝니다.` },
        { title: '다시 쓰기와 제외', text: '일반 성장에서 다시 쓰기 1개로 카드를 다시 뽑거나 성장·특성 카드 하나를 이후 제안에서 제외합니다. 한 선택에서 조정은 1회, 제외는 판당 2개입니다. 분기·변형만 있는 필수 선택은 다시 뽑을 수 없습니다.' },
        { title: '최종의 입력', text: `추가 지정도 자기 스킬 키 → 조준 → 클릭입니다. 전도는 방출 뒤 2.5초 안에 추가 출발점, 블랙홀은 1.2초 안에 80–360px 떨어진 두 번째 점, 절단은 회전 기점을 한 번 이동합니다. 폭탄은 직접 공격 기록을 남기고 스킬 키를 0.5초 이상 눌러 기록을 선택한 뒤 클릭합니다. 포격은 게이지 50 이상에서 ${network}로 현재 위치에 십자망을 고정합니다. 감염은 직접 기폭 뒤 0.5초 안에 스킬 키로 조준을 시작하고 클릭해 확산 방향을 정합니다.` },
        { title: '스킬 대신 속성 최종', text: `시련 이후 충격 또는 시전 속성이 4점이고 관련 유효 행동이 8회면 속성 최종도 고를 수 있습니다. 최종 타격은 완충 타격 뒤 다음 스킬·소환 적중을 강화합니다. 시전 재작성은 ${skill0} → ${skill1} → 직접 공격 순서에 추가 효과를 줍니다. 스킬 최종과 합쳐 판당 하나입니다.` },
      ],
    },
    {
      id: 'world', title: '세계', lead: '일부 적에게 저항이 생깁니다. 표시된 약점으로 공격하세요.',
      steps: [
        { title: '채널을 끊기', text: '채널러는 고정점 앞에서 2초 준비한 뒤 안정도를 깎습니다. 준비 중 직접 공격으로 방해하세요.' },
        { title: '약점으로 전환', text: '일부 적의 저항 속성 피해는 25% 줄고, 표시된 약점 속성 피해는 30% 늘어납니다.' },
        { title: '마지막 보스 삭제', text: `${at(1080)}에 현실 기관이 등장합니다. 등장 뒤 120초 안에 처치하면 승리합니다.` },
      ],
      cards: [
        { title: '보호 연결', text: '보호자는 주변 적을 지킵니다. 보호자를 직접 공격으로 처치하거나 절단으로 연결을 끊으세요.' },
        { title: '위협', text: '처치하면 위협이 줄어듭니다. 위협 100에서는 고정점이 지속적으로 손상됩니다.' },
        { title: '보스의 공통 균열', text: '적색 공격 예고 중 열린 보스를 직접 공격하면 예고된 공격과 그 증원을 중단합니다.' },
      ],
      note: `세계 저항은 ${quick ? '10' : '30'}초 전에 예고됩니다. 적의 빛과 입자로 변화를 보고, ESC에서 저항과 약점의 정확한 수치를 확인하세요.`,
      details: [
        { title: '주요 사건 시간', text: `두 번째 스킬 ${at(210)} · 세계 저항 ${at(360)} / ${at(660)} / ${at(960)} · 중간 보스 ${at(480)} / ${at(780)} · 계약 ${at(540)} · 유물 ${at(570)} / ${at(840)} · 조합 ${at(690)} · 균열 시련 ${at(960)} · 최종 보스 ${at(1080)}. 시간은 성장 선택과 일시정지 동안 멈춥니다.` },
        { title: '중간 보스를 못 잡았다면', text: '최종 보스 시각에 남은 중간 보스는 최종 봉합에 흡수되고 위협이 12 오릅니다. 최종 보스의 등장 시간은 늦춰지지 않습니다.' },
        { title: '계약과 유물', text: '계약은 보급 또는 우선 목표의 위험·보상을 고르는 선택입니다. 유물은 최대 2개이며, 슬롯이 차면 교체할 유물을 고릅니다. 교체되는 효과도 확인하세요.' },
      ],
    },
    {
      id: 'records', title: '기록', lead: '한 판을 마치면 기억을 얻습니다. 연구와 발견 기록은 다음 판으로 이어집니다.',
      steps: [
        { title: '결과 확인', text: '삭제 수·지속 시간·점수·획득한 기억을 확인합니다. 펼친 분석에서는 피해 경로와 마지막 빌드를 볼 수 있습니다.' },
        { title: '연구하기', text: '연구 화면에서 기억을 써 충전 회복 속도와 시작 경험치를 올립니다.' },
        { title: '새 세계 시작', text: '다시 시작에서 새 스킬을 고르거나, 같은 시드로 다시 도전할 수 있습니다.' },
      ],
      cards: [
        { title: '충전 회복', text: '단계당 직접 공격 충전 회복 속도 +2%. 최대 5단계입니다.' },
        { title: '시작 경험치', text: '단계당 시작 경험치 +4. 최대 5단계입니다.' },
        { title: '연습', text: '기본부터 최종까지 바로 연습합니다. 안정도 손상·성장 선택·기억 정산은 없습니다.' },
      ],
      note: '기억·연구·설정은 현재 브라우저와 사이트 주소에 저장됩니다.',
      details: [
        { title: '연구 비용', text: '각 연구는 현재 단계 0부터 5까지 성장합니다. 다음 단계 비용은 5 + 현재 단계×3 기억입니다. 연구 보너스는 다음 판 시작에 적용됩니다.' },
        { title: '기억 획득', text: '기본 획득량은 삭제 35개당 1 + 지속 90초당 1 + 승리 보너스 12입니다. 승리·삭제 5개·지속 20초 중 하나를 충족하면 최소 1을 받습니다. 아주 짧은 무처치 판은 0입니다.' },
        { title: '시드와 저장', text: '같은 시드는 난수 출발점을 재현합니다. 같은 결과에는 같은 입력과 타이밍도 필요합니다. 브라우저·사이트 주소·포트가 바뀌면 기록은 공유되지 않습니다. 저장 실패는 결과 화면에서 알립니다.' },
        { title: '실험실과 접근성', text: '실험실 표적은 6초마다 보충되며 이동 저항 보스는 체력 4800입니다. 보조 스킬은 2진화 이하라 최종은 하나입니다. 설정에서 키·효과음·저동작·저효과·고대비를 바꿀 수 있습니다.' },
      ],
    },
  ];
}
