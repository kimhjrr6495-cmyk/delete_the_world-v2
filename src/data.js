// Content and progression share one source so every offered card has a live effect ID.
export const TAGS = Object.freeze({
  CHAIN: { name: 'CHAIN', ko: '전도', color: '#5EE3FF', icon: 'ϟ' },
  INFECTION: { name: 'INFECTION', ko: '감염', color: '#A6E857', icon: '◌' },
  SINGULARITY: { name: 'SINGULARITY', ko: '중력', color: '#A67CFF', icon: '◎' },
  SWARM: { name: 'SWARM', ko: '소환', color: '#F2C15A', icon: '⌖' },
  IMPACT: { name: 'IMPACT', ko: '직접 삭제', color: '#FF8C6B', icon: '◆' },
  CASTER: { name: 'CASTER', ko: '시전', color: '#E8F0FF', icon: '⌘' },
});

const option = (id, name, description) => ({ id, name, description });
export const SKILLS = [
  {
    id: 'overcharge', name: 'OVERCHARGE', ko: '과전도', tag: 'CHAIN', color: '#5EE3FF', icon: 'ϟ', cooldown: 10,
    description: '6초 동안 다음 직접 삭제를 무장한다. 적중한 적에서 3명에게 70 → 55 → 40 피해를 전도한다.',
    detail: '전도 거리 110px. 목표가 부족하면 남은 갈래마다 주대상에 15 피해를 돌려준다. 방출할 때 쿨다운과 직접 삭제 충전 1개를 쓴다.',
    branches: [option('fork', 'FORK · 갈래', '5갈래 · 거리 125px. 70/55/40/30/25 피해의 70%를 넓게 전도한다.'), option('needle', 'NEEDLE · 관통', '후속 대상 1명에게 90 피해. 직접 삭제의 50%가 방패를 우회한다. 단일 목표 반환 피해 60.')],
    modifiers: [option('grounding', 'GROUNDING · 접지', '전도가 보호자 또는 채널러에 닿으면 보호·채널을 2초 끊는다. 뿌리당 1회.'), option('capacitor', 'CAPACITOR · 축전', '마지막 생존 전도 대상에 4초 표식. 표식 소비 전도 +20 피해. 진화 I부터 생존자 모두에 적용.')],
    evolutionNames: ['AMPLIFIED TRACE', 'RETURN CURRENT', 'LIVING CIRCUIT'],
    evolutions: ['생존 전도 대상 모두에 4초 표식. 직접 삭제로 소비하면 새 목표에 60 전도.', '표식 대상 처치가 근처 적에게 55 전도. 한 뿌리에서 최대 2회.', '방출 뒤 2.5초 안에 스킬을 다시 눌러 전도 출발점을 지정한다. 최초 위치로 돌아오면 주변 적에 노출.'],
  },
  {
    id: 'bomb', name: 'VOID BOMB', ko: '공허 폭탄', tag: 'IMPACT', color: '#ED78BF', icon: '◉', cooldown: 12,
    description: '지정 위치에 0.8초 뒤 폭발. 반경 85px 안에 230 피해, 바깥 띠는 60% 피해.',
    detail: '퓨즈 원환으로 실제 폭발 범위를 읽고 적의 다음 위치에 예약한다. 직접 삭제 충전을 쓰지 않는다.',
    branches: [option('cluster', 'CLUSTER · 분산', '본 폭발 170 피해. 0.25초 뒤 생존 적 2곳에 반경 38px·90 피해의 작은 폭탄.'), option('compression', 'COMPRESSION · 압축', '반경 55px로 줄이고 중심 피해 340. 한 고가치 목표를 정밀하게 폭파한다.')],
    modifiers: [option('remote_fuse', 'REMOTE FUSE · 수동 퓨즈', '폭탄 안 직접 삭제로 최대 0.15초 후 조기 기폭. 본 폭발 피해 −15%. 원래 타격이 먼저 적용된다.'), option('delayed_return', 'DELAYED RETURN · 잔류', '폭발 뒤 반경 70%의 잔류 구역을 3초 생성. 초당 30 피해.')],
    evolutionNames: ['SHOCK RING', 'CHAIN REACTION', 'TOTAL VOID'],
    evolutions: ['생존자를 최대 90px 밀고 3초 노출. 보스는 이동 없이 노출을 받는다.', '폭발로 5명 처치하면 80 피해 미니 폭탄. 단일 보스에는 파열 2초.', '0.5초 이상 스킬 홀드 후 놓으면 최근 직접 삭제 기록을 유령 폭발로 재생. 일반 탭은 유지. RECORD 쿨다운 24초.'],
  },
  {
    id: 'hole', name: 'BLACK HOLE', ko: '블랙홀', tag: 'SINGULARITY', color: '#A67CFF', icon: '◎', cooldown: 16,
    description: '반경 125px, 3초 흡입. 0.5초마다 15 피해, 종료 때 반경 80px에 80 + 질량×20 피해.',
    detail: '안에서 일반 적 처치 +1 질량, 엘리트 +3, 최대 8. 보스는 이동 대신 중력 균열 4칸을 쌓아 노출된다.',
    branches: [option('twin', 'TWIN · 쌍성', '커서 좌우 70px에 반경 85px 두 홀. 흡입·피해 각각 70%, 겹친 적은 가까운 홀 하나의 영향만 받는다.'), option('anchor', 'ANCHOR · 정박', '단일 반경 145px. 최대 130px/s로 끌어당겨 고정점 앞 군집을 묶는다.')],
    modifiers: [option('mass_ledger', 'MASS LEDGER · 질량 장부', '종료 추가 피해를 질량당 20 → 30으로 올린다. 최대 추가 피해 240.'), option('tidal_pull', 'TIDAL PULL · 조석', '경계를 벗어난 적을 1.5초간 25% 감속. 보스에는 노출 2초.')],
    evolutionNames: ['GRAVITY CRUSH', 'REPOSITION', 'REALITY FOLD'],
    evolutions: ['종료 붕괴가 범위 내 보호 연결 1개를 절단한다.', '설치 뒤 3초 안에 버튼을 다시 눌러 중심을 최대 180px, 1회 이동.', '설치 뒤 1.2초 안에 버튼을 다시 눌러 두 번째 점 지정. 폭 32px 통로가 0.6초 후 200 + 질량×20 피해.'],
  },
  {
    id: 'cut', name: 'SCREEN CUT', ko: '화면 절단', tag: 'CASTER', color: '#E8F0FF', icon: '╳', cooldown: 11,
    description: '홀드로 방향을 그리고 놓아 길이 400px·폭 26px 절단선을 긋는다. 대상당 200 피해.',
    detail: '0.2초 미만 탭은 마지막 방향. 조준 최대 1.2초. 보호 연결과 흩어진 적을 같은 선으로 자른다.',
    branches: [option('lattice', 'LATTICE · 격자', '130 피해 주선과 수직선 2개. 교점의 한 대상은 총 최대 220 피해.'), option('razor', 'RAZOR · 면도날', '길이 460px·폭 12px·285 피해. 좁은 선 위 고가치 목표에 집중한다.')],
    modifiers: [option('afterimage', 'AFTERIMAGE · 잔상', '0.5초 뒤 같은 선을 70 피해로 다시 긋는다. 이미 맞은 적도 다시 적중.'), option('rupture_edge', 'RUPTURE EDGE · 파열날', '첫 적중 생존자에 파열 5초. 다음 직접 삭제 주대상 피해 +40% 후 소모.')],
    evolutionNames: ['LINGERING SEAM', 'RIFT CROSSING', 'LAST JUDGEMENT'],
    evolutions: ['2초 점선 균열을 남겨 처음 건너는 적에 노출 2초.', '유효 교점에 반경 45px·100 피해. RAZOR도 중앙 보조 균열로 교점을 만든다.', '3초 동안 두 번 완전 회전. 대상당 최대 2회 적중. 버튼을 다시 눌러 기점을 180px 이내 1회 이동. 쿨다운 22초.'],
  },
  {
    id: 'orbital', name: 'ORBITAL COMMAND', ko: '궤도 명령', tag: 'SWARM', color: '#F2C15A', icon: '⌖', cooldown: 14,
    description: '반경 90px 명령 구역에 5초간 총 4발 포격. 한 발 반경 44px·55 피해. 채널러를 우선 조준한다.',
    detail: '보유 중 스카우트가 커서 110px 안 적에게 2.1초마다 25 피해. 포격은 마지막 0.3초에 위치가 고정된다.',
    branches: [option('watchtower', 'WATCHTOWER · 망루', '명령 구역이 가까운 고정점을 방어하고 채널링 중인 적을 우선 포격한다.'), option('hunter', 'HUNTER · 추적', '명령 구역이 우선 목표·엘리트를 따라간다. 탄착 예고 +0.15초, 마지막 0.3초 잠금 유지.')],
    modifiers: [option('marked_target', 'MARKED TARGET · 표적 예약', '구역 안 적에 직접 삭제를 넣으면 미잠금 포격 1발을 그 위치에 예약, 피해 +30. 명령당 2회.'), option('incendiary_fuel', 'INCENDIARY FUEL · 화염', '탄착점에 반경 35px 바닥 화염 2.4초. 진입 적에 초당 18 피해의 화상 2.4초.')],
    evolutionNames: ['TARGET LOCK', 'FIELD COMMAND', 'CROSS NETWORK'],
    evolutions: ['탄착 0.3초 전까지 적 이동을 추적. 잠긴 탄은 위치가 바뀌지 않는다.', '명령 중 버튼을 다시 눌러 구역 1회 재지정. 이미 잠긴 탄은 이전 위치에 떨어진다.', 'NETWORK 50으로 시작. T로 5초 십자망. 폭 24px 각 선은 0.2초마다 14, 교차점은 합계 30 피해.'],
  },
  {
    id: 'seed', name: 'LATENCY SEED', ko: '잠복 씨앗', tag: 'INFECTION', color: '#A6E857', icon: '◌', cooldown: 10,
    description: '커서 45px 안 적에 3초 감염. 초당 25 피해, 만료 폭발 145·사망 폭발 110, 반경 65px.',
    detail: '1.5초 뒤 가까운 건강한 적 1명에 전파. 대상이 없으면 5초 바닥 씨앗을 놓아 첫 통과 적에 심는다.',
    branches: [option('carrier', 'CARRIER · 운반자', '1.1초·2.0초에 서로 다른 두 적에게 65% 감염. 자식은 재전파하지 않는다.'), option('reservoir', 'RESERVOIR · 저장소', '전파를 멈추고 최초 호스트 틱 +10/초, 기폭 +70 피해. 단일 목표와 보스에 집중.')],
    modifiers: [option('manual_detonate', 'MANUAL DETONATE · 기폭', '감염자 직접 삭제 적중으로 즉시 기폭. 사망 기폭값 +20%, 직접 피해는 먼저 적용.'), option('dormant_soil', 'DORMANT SOIL · 잠복 토양', '감염 처치 지점에 반경 35px 지대 3초. 첫 통과 적에 65% 감염. 뿌리당 1곳.')],
    evolutionNames: ['VIRAL TRACE', 'HOST TRANSFER', 'EPIDEMIC SCRIPT'],
    evolutions: ['감염자의 이동 경로에 2초 흔적. 건너는 건강한 적 최대 2명에 65% 감염.', '최초 호스트 처치 시 남은 감염을 건강한 적 1명으로 이식. 뿌리당 1회.', '직접 적중으로 기폭 후 0.5초 커서 방향 창. 반경 150px·90° 부채꼴 안 최대 3명에 65% 감염.'],
  },
];

export const getSkill = id => SKILLS.find(skill => skill.id === id);

export const ENEMIES = {
  drifter: { name: 'Drifter', ko: '표류자', hp: 100, r: 11, speed: 22, xp: 8, color: '#71839F', shape: 'circle', role: '군집', damage: 4, weight: 1, description: '고정점을 향해 모인다. 연쇄의 시작점으로 사용하라.' },
  ward: { name: 'Ward', ko: '보호자', hp: 220, shield: 100, r: 18, speed: 16, xp: 24, color: '#62AFC8', shape: 'hexagon', role: '보호 연결', damage: 8, weight: 3, description: '주변 적을 보호한다. 보호선 끝을 직접 삭제하거나 절단하라.' },
  channeler: { name: 'Channeler', ko: '채널러', hp: 170, r: 14, speed: 32, xp: 22, color: '#FF657F', shape: 'diamond', role: '고정점 채널', damage: 10, weight: 3, description: '2초 채널 뒤 고정점을 손상한다. 예고 중 직접 삭제에 취약하다.' },
  splitter: { name: 'Splitter', ko: '분열체', hp: 140, r: 15, speed: 25, xp: 14, color: '#C998F2', shape: 'split', role: '사망 분열', damage: 5, weight: 3, description: '다른 출처로 죽으면 작은 표류자 둘로 나뉜다. 직접 삭제로 마무리하라.' },
  scrubber: { name: 'Scrubber', ko: '정화자', hp: 180, r: 16, speed: 19, xp: 22, color: '#D4E5A0', shape: 'triangle', role: '감염 정화', damage: 6, weight: 3, description: '감염을 정화할 때 멈춘다. 조기 기폭하거나 전도·포격으로 처리하라.' },
  jammer: { name: 'Jammer', ko: '교란자', hp: 160, r: 16, speed: 21, xp: 22, color: '#E6AB61', shape: 'square', role: '소환 교란', damage: 6, weight: 3, description: '주변 소환 신호를 약화한다. 직접 삭제가 교란을 뚫는다.' },
  anchor: { name: 'Anchor', ko: '정박체', hp: 280, r: 20, speed: 13, xp: 28, color: '#9B8EC4', shape: 'anchor', role: '중력 저항', damage: 9, weight: 3, description: '흡입에 저항하고 폭발에 취약하다. 이동보다 붕괴·폭탄으로 처리하라.' },
  mirror: { name: 'Mirror', ko: '반사체', hp: 200, r: 17, speed: 27, xp: 24, color: '#B3D8E9', shape: 'mirror', role: '반복 출처 대응', damage: 7, weight: 3, description: '같은 뿌리의 반복 피해를 줄인다. 새 직접 타격이나 다른 스킬로 전환하라.' },
};

const method = (id, name, tag, description, detail, prerequisite = 'direct') => ({ id, effectId: id, name, tag, description, detail, prerequisite, kind: 'method', maxRank: 1 });
export const METHODS = [
  method('conductive_scar', 'Conductive Scar · 전도 흉터', 'CHAIN', '직접 삭제 처치 → 100px 안 생존 적 1명에 전도 표식 4초.', '표식을 직접 삭제로 소비하면 새 목표에 60 전도. 내부 쿨다운 2초·뿌리당 1회.'),
  method('origin_echo', 'Origin Echo · 원점 반향', 'CHAIN', '직접 삭제로 전도 표식 소비 → 표식의 원점에 반경 50px·65 피해.', '뿌리당 1회. 이전 시작 위치를 다음 회귀 타격에 사용한다.', 'mark'),
  method('spore_census', 'Spore Census · 포자 집계', 'INFECTION', '90px 안 감염자 2명 이상일 때 직접 적중 → 최대 3명 감염을 0.3초로 단축.', '내부 쿨다운 6초. 두 감염자의 폭발 시각을 맞춰 군집을 처리한다.', 'plural-infection'),
  method('patient_zero', 'Patient Zero · 최초 호스트', 'INFECTION', '최초 감염 호스트를 직접 삭제로 조기 기폭 → 그 기폭 피해 +40.', '뿌리당 1회. 첫 호스트의 중앙 점을 노려라.', 'infection'),
  method('orbit_shear', 'Orbit Shear · 궤도 전단', 'SINGULARITY', '블랙홀 경계를 벗어난 생존 적에 파열 5초.', '홀당 최대 4명. 다음 직접 삭제 주대상 피해 +40% 후 소모.', 'hole'),
  method('event_horizon', 'Event Horizon · 사건의 지평', 'SINGULARITY', '질량 6 이상 홀의 중심 35px에 직접 삭제 → 즉시 붕괴.', '홀당 1회. 적이 빠져나가기 전에 축적한 종료 피해를 확정한다.', 'hole'),
  method('target_lease', 'Target Lease · 표적 임대', 'SWARM', '직접 적중한 적을 4초간 스카우트·다음 포격의 우선 목표로 지정.', '내부 쿨다운 5초. 채널러·보호자를 자동망의 목표로 바꾼다.', 'orbital'),
  method('relay_beacon', 'Relay Beacon · 중계 비컨', 'SWARM', '소환 처치 지점에 3초·반경 60px 비컨. 안에서 직접 삭제하면 다음 탄을 클릭 위치로 이동.', '명령당 1회·비컨 1개. 자동 처치 위치를 수동 포격 연결점으로 사용한다.', 'orbital'),
  method('overkill', 'Overkill · 초과 삭제', 'IMPACT', '직접 삭제 주대상 처치의 초과 피해 70%를 반경 55px 파열로 전환.', '파열 피해 최대 100·뿌리당 1회. 약한 적을 군집 폭발의 시작점으로 고른다.'),
  method('precision_window', 'Precision Window · 정밀 창', 'IMPACT', '노출·파열 대상에 홀드 직접 삭제 → 피해 +60, 방패 우회 25%.', '내부 쿨다운 6초. 스킬이 만든 약점에 충전 타격을 맞춘다.', 'weakness'),
  method('after_cast', 'After Cast · 시전 후속', 'CASTER', '스킬 확정 후 2초 안의 다음 별도 직접 삭제 피해 +30%, 생존자 노출 2초.', '시전당 1회. OVERCHARGE를 방출한 타격은 제외하고 다음 타격이 강화된다.', 'skill'),
  method('alternating_circuit', 'Alternating Circuit · 교대 회로', 'CASTER', '서로 다른 스킬을 5초 안에 시전 → 첫 스킬 남은 쿨다운을 기본값의 20% 환급.', '자연 쿨다운 주기당 1회·최소 남은 2초. E와 Q 순서를 계획한다.', 'two-skills'),
];

const hybrid = (id, name, tags, description, detail, prerequisites) => ({ id, effectId: id, name, tags, tag: tags.join('+'), description, detail, prerequisites, kind: 'hybrid' });
export const HYBRIDS = [
  hybrid('contagion_circuit', 'Contagion Circuit · 감염 회로', ['CHAIN', 'INFECTION'], '전도가 감염자를 맞히면 다음 전도 대상에 남은 감염 시간의 65%를 복사.', '뿌리당 2회. 복사된 감염은 다시 복사되지 않는다.', ['chain', 'infection']),
  hybrid('orbit_relay', 'Orbit Relay · 궤도 중계', ['CHAIN', 'SINGULARITY'], '홀 안 전도 적중 → 질량 2를 쓰고 반대편의 새 목표에 55 전도.', '뿌리당 1회. 홀의 반대 출구에 적을 배치해 연쇄를 잇는다.', ['chain', 'hole']),
  hybrid('relay_hunt', 'Relay Hunt · 중계 사냥', ['CHAIN', 'SWARM'], '명령 구역 안 직접 삭제 처치 → 구역 중심에서 새 목표 2명에 55 전도.', '내부 쿨다운 4초·뿌리당 1회. 표적 임대·비컨 위치를 우선 사용한다.', ['orbital']),
  hybrid('railgun_scar', 'Railgun Scar · 레일 흉터', ['CHAIN', 'IMPACT'], '홀드 직접 삭제가 치명타 또는 초과 피해 50 이상 → 길이 360px·폭 14px·100 피해 관통선.', '최근 커서 이동 방향. 이동이 짧으면 수평. 뿌리당 1회.', ['direct']),
  hybrid('echo_order', 'Echo Order · 반향 명령', ['CHAIN', 'CASTER'], 'E → 5초 안 Q → Q 첫 적중 위치에서 0.4초 뒤 새 목표에 50 전도.', '스킬 순서당 1회. Q가 전도 스킬일 필요는 없다.', ['two-skills']),
  hybrid('quarantine_collapse', 'Quarantine Collapse · 격리 붕괴', ['INFECTION', 'SINGULARITY'], '홀 안 감염 전파를 저장. 홀 종료 때 바깥 최대 3명에 65% 감염, 종료 피해 +40.', '홀당 1회. 새 자식은 전파하지 않는다.', ['infection', 'hole']),
  hybrid('parasite_hive', 'Parasite Hive · 기생 군집', ['INFECTION', 'SWARM'], '액티브 포격 적중 생존자에 65% 감염. 스카우트가 감염자 주변 건강한 적을 우선 조준.', '명령당 감염 최대 2명. 포격과 감염이 같은 집단을 차례로 처리한다.', ['orbital']),
  hybrid('patient_zero_strike', 'Patient Zero Strike · 최초 타격', ['INFECTION', 'IMPACT'], '감염자 홀드 직접 삭제 → 즉시 기폭, 남은 감염 1초당 +30 피해.', '추가 피해 최대 90·뿌리당 1회. 수동 기폭과 같은 1회 폭발에 합산한다.', ['infection']),
  hybrid('delayed_script', 'Delayed Script · 지연 스크립트', ['INFECTION', 'CASTER'], '첫 스킬의 감염을 5초 안에 다른 스킬이 기폭 → 두 번째 스킬 쿨다운 −2초.', '두 번째 스킬 쿨다운 주기당 1회·최소 남은 2초.', ['infection-skill', 'two-skills']),
  hybrid('cross_gravity', 'Cross Gravity · 교차 중력', ['SINGULARITY', 'SWARM'], '액티브 명령 중심이 가장 가까운 홀을 초당 80px 끌어온다.', 'CROSS NETWORK 교차점은 120px/s. 한 홀 연결·자동 이동 중 수동 재배치 잠금.', ['hole', 'orbital']),
];

export const RELICS = [
  { id: 'crossed_wires', effectId: 'crossed_wires', name: 'Crossed Wires · 교차 배선', tag: 'CHAIN', description: '전도 표식을 소비할 때 직접 삭제 충전 회복을 0.3초 진행한다.', detail: '전도 표식 생성 출처 필요. 표식 소비가 다음 수동 타격의 간격을 줄인다.', prerequisites: ['mark'] },
  { id: 'lens', effectId: 'lens', name: 'Memory Lens · 기억 렌즈', tag: 'IMPACT', description: '직접 삭제 반경 +8px. 탭 36 → 44px, 홀드 48 → 56px.', detail: '실제 커서 판정 원도 함께 넓어진다. 액티브 스킬의 범위는 바뀌지 않는다.' },
  { id: 'time_capsule', effectId: 'time_capsule', name: 'Time Capsule · 시간 캡슐', tag: 'CASTER', description: '엘리트 처치 시 두 스킬의 남은 쿨다운을 각각 2초 줄인다.', detail: '내부 쿨다운 30초. 엘리트 마무리 시점을 다음 시전 준비에 사용한다.', prerequisites: ['skill'] },
  { id: 'anchor_heart', effectId: 'anchor_heart', name: 'Anchor Heart · 고정점 심장', tag: 'SINGULARITY', description: '직접 삭제로 채널러의 채널을 중단하면 무결성 3 회복.', detail: '내부 쿨다운 8초. 위험 예고 중인 채널러를 골라 고정점을 방어한다.' },
  { id: 'swarm_clock', effectId: 'swarm_clock', name: 'Swarm Clock · 군집 시계', tag: 'SWARM', description: '스카우트 자동 포격 간격 −25%. 기본 2.1 → 1.575초.', detail: 'ORBITAL COMMAND 필요. 액티브 4발의 착탄 시각과 마지막 0.3초 잠금은 유지.', prerequisites: ['orbital'] },
  { id: 'hollow_crown', effectId: 'hollow_crown', name: 'Hollow Crown · 공허 왕관', tag: 'IMPACT', description: '공격력 +12%, 획득 시 최대 무결성을 90 이하로 낮춘다.', detail: '현재 무결성도 새 최대값으로 제한. 최대 무결성이 이미 90보다 낮으면 더 낮추지 않는다.' },
];

export const CORES = [
  { id: 'overcharge_spark', skillId: 'overcharge', name: 'SPARK', ko: '전도 코어', tag: 'CHAIN', icon: 'ϟ', color: '#5EE3FF', description: 'OVERCHARGE로 시작. 직접 삭제 피해 +10%, 자동 펄스 속도 −10%.', bonuses: { directBonus: .1, autoRate: -.1 } },
  { id: 'bomb_crater', skillId: 'bomb', name: 'CRATER', ko: '폭발 코어', tag: 'IMPACT', icon: '◉', color: '#ED78BF', description: 'VOID BOMB로 시작. 스킬 피해 +10%, 직접 삭제 충전 회복 속도 −5%.', bonuses: { skillBonus: .1, chargeRate: -.05 } },
  { id: 'hole_gravity', skillId: 'hole', name: 'GRAVITY', ko: '중력 코어', tag: 'SINGULARITY', icon: '◎', color: '#A67CFF', description: 'BLACK HOLE로 시작. 직접 삭제 반경 +8px, 직접 삭제 피해 −5%.', bonuses: { radiusBonus: 8, directBonus: -.05 } },
  { id: 'cut_edge', skillId: 'cut', name: 'EDGE', ko: '절단 코어', tag: 'CASTER', icon: '╳', color: '#E8F0FF', description: 'SCREEN CUT으로 시작. 쿨다운 감소 +8%p, 자동 펄스 속도 −5%.', bonuses: { cdr: .08, autoRate: -.05 } },
  { id: 'orbital_relay', skillId: 'orbital', name: 'RELAY', ko: '소환 코어', tag: 'SWARM', icon: '⌖', color: '#F2C15A', description: 'ORBITAL COMMAND로 시작. 소환 피해 +12%, 직접 삭제 피해 −5%.', bonuses: { summonBonus: .12, directBonus: -.05 } },
  { id: 'seed_spore', skillId: 'seed', name: 'SPORE', ko: '감염 코어', tag: 'INFECTION', icon: '◌', color: '#A6E857', description: 'LATENCY SEED로 시작. 공격력 +6%, 직접 삭제 반경 −5px.', bonuses: { power: .06, radiusBonus: -5 } },
];

const stat = (id, name, tag, description, changes, maxRank = 5) => ({ id, name, tag, description, changes, maxRank, kind: 'stat' });
export const STAT_CARDS = [
  stat('chain_voltage', 'Voltage · 전압', 'CHAIN', '공격력 +8%. 전도 피해와 반환 피해를 함께 강화한다.', { power: .08 }),
  stat('chain_recharge', 'Charge Recovery · 충전 회복', 'CHAIN', '직접 삭제 충전 회복 속도 +10%.', { chargeRate: .1 }),
  stat('infection_potency', 'Potency · 독성', 'INFECTION', '공격력 +8%. 감염의 틱과 기폭을 함께 강화한다.', { power: .08 }),
  stat('infection_space', 'Contagion Space · 감염 공간', 'INFECTION', '직접 삭제 반경 +6px. 주변 감염자에 후속 타격을 넣기 쉽게 한다.', { radiusBonus: 6 }),
  stat('gravity_depth', 'Gravity Depth · 중력 깊이', 'SINGULARITY', '스킬 피해 +12%. 홀의 틱·종료 붕괴를 강화한다.', { skillBonus: .12 }),
  stat('gravity_reach', 'Gravity Reach · 중력 도달', 'SINGULARITY', '직접 삭제 반경 +6px. 홀로 모은 군집을 넓게 마무리한다.', { radiusBonus: 6 }),
  stat('swarm_payload', 'Payload · 포격 적재', 'SWARM', '소환 피해 +15%. 스카우트와 액티브 포격을 강화한다.', { summonBonus: .15 }),
  stat('swarm_support', 'Support Pulse · 지원 펄스', 'SWARM', '자동 펄스 속도 +12%. 수동 명령 사이 잔몹 처리를 강화한다.', { autoRate: .12 }),
  stat('impact_force', 'Impact Force · 타격력', 'IMPACT', '직접 삭제 피해 +15%. 충전 타격과 우선 목표 처리를 강화한다.', { directBonus: .15 }),
  stat('impact_critical', 'Critical Angle · 치명각', 'IMPACT', '직접 삭제 주대상 치명타 확률 +6%p. 확률 상한 60%.', { critChance: .06 }),
  stat('caster_payload', 'Spell Weight · 시전 무게', 'CASTER', '스킬 피해 +12%. 소환 포격에는 중복 적용되지 않는다.', { skillBonus: .12 }),
  stat('caster_flow', 'Cast Flow · 시전 흐름', 'CASTER', '스킬 쿨다운 감소 +6%p. 총 감소 상한 40%.', { cdr: .06 }),
  stat('integrity_buffer', 'Integrity Buffer · 무결성 버퍼', 'IMPACT', '최대 무결성 +12, 즉시 무결성 12 회복.', { maxIntegrity: 12, heal: 12 }, 4),
  stat('emergency_patch', 'Emergency Patch · 긴급 복구', 'CASTER', '즉시 무결성 24 회복, 압력 −5.', { heal: 24, pressure: -5 }, Infinity),
];

export const ROUTES = [
  { id: 'stable_supply', name: '안정 보급', tag: 'CASTER', description: '무결성 15 회복, REWRITE +1, 압력 −8.', detail: '15초 준비 후 낮은 위협의 보급 사건. 고정점 수리와 다음 성장을 준비한다.', risk: '낮음', reward: '복구 + 선택 조정' },
  { id: 'elite_seal', name: '엘리트 봉합', tag: 'SWARM', description: '15초 뒤 보호자·채널러 엘리트가 출현. 처치하면 유물 선택과 REWRITE +1.', detail: '90초 안에 처치 실패 시 압력 +12. 무결성을 선지불하지 않는다.', risk: '높음', reward: '유물 + 선택 조정' },
  { id: 'forbidden_rift', name: '금지 균열', tag: 'IMPACT', description: '무결성 10 지불, 압력 +8. 15초 뒤 균열 목표를 처리하면 희귀 보상.', detail: '무결성이 10 이하이면 지불 대신 압력 +10 추가. 성공 보상은 유물 또는 하이브리드 선택.', risk: '매우 높음', reward: '희귀 규칙' },
];

export const TAG_FINALS = [
  { id: 'final_stroke', name: 'FINAL STROKE · 최종 타격', tag: 'IMPACT', metric: 'chargedHits', description: '1.2초 완충 타격 → 4초 흉터. 다음 스킬·소환 직접 적중 피해 +35%, 보호 연결 1개 절단.', detail: 'IMPACT 4점·홀드 직접 유효 적중 8회 필요. 내부 쿨다운 6초. 틱은 흉터를 소비하지 않는다.' },
  { id: 'rewrite_sequence', name: 'REWRITE SEQUENCE · 시전 재작성', tag: 'CASTER', metric: 'casterPairs', description: 'E → Q → 직접 삭제를 첫 E부터 5초 안에 완성하면 Q 태그의 특수 효과를 추가.', detail: 'CASTER 4점·E→Q 유효 쌍 8회 필요. 내부 쿨다운 12초. 한 런 Final은 1개.' },
];

const slots = game => (game.skillSlots || []).filter(Boolean);
const hasSkill = (game, id) => slots(game).some(slot => slot.id === id);
const hasMethod = (game, id) => game.methods?.has?.(id) || false;
const owned = (game, id) => game.owned?.has?.(id) || false;
const tagPoints = (game, tag) => Number(game.tags?.[tag] || 0);
const progressionTime = game => game.worldTime ?? game.time ?? 0;
const hybridId = game => typeof game.hybrid === 'string' ? game.hybrid : game.hybrid?.id;
const hasFinal = game => Boolean(game.hasFinal || game.tagFinal || slots(game).some(slot => slot.evolution >= 3) || TAG_FINALS.some(card => hasMethod(game, card.id) || owned(game, card.id)));

export function hasPrerequisite(game, requirement) {
  switch (requirement) {
    case 'direct': return true;
    case 'skill': return slots(game).length > 0;
    case 'two-skills': return new Set(slots(game).map(slot => slot.id)).size >= 2;
    case 'hole': return hasSkill(game, 'hole');
    case 'orbital': return hasSkill(game, 'orbital');
    case 'chain': return hasSkill(game, 'overcharge') || hasMethod(game, 'conductive_scar') || ['relay_hunt', 'railgun_scar', 'echo_order'].includes(hybridId(game));
    case 'mark': return hasMethod(game, 'conductive_scar') || slots(game).some(slot => slot.id === 'overcharge' && (slot.modifier === 'capacitor' || slot.evolution >= 1));
    case 'infection': return hasSkill(game, 'seed') || ['parasite_hive', 'quarantine_collapse'].includes(hybridId(game)) || game.tagFinal === 'rewrite_sequence';
    case 'plural-infection': return slots(game).some(slot => slot.id === 'seed' && (slot.branch !== 'reservoir' || slot.evolution >= 1)) || ['parasite_hive', 'quarantine_collapse'].includes(hybridId(game));
    case 'infection-skill': return hasSkill(game, 'seed');
    case 'manual-infection': return hasSkill(game, 'seed') && slots(game).some(slot => slot.id === 'seed' && (slot.modifier === 'manual_detonate' || slot.evolution >= 3)) || hybridId(game) === 'patient_zero_strike';
    case 'weakness': return slots(game).some(slot => slot.id === 'hole' || slot.id === 'cut' && (slot.modifier === 'rupture_edge' || slot.evolution >= 1) || slot.id === 'bomb' && slot.evolution >= 1 || slot.id === 'overcharge' && slot.evolution >= 3 || slot.id === 'orbital' && slot.evolution >= 3) || hasMethod(game, 'after_cast') || hasMethod(game, 'orbit_shear');
    default: return false;
  }
}

export function canSelectMethod(game, card) {
  return !hasMethod(game, card.id) && !owned(game, card.id) && tagPoints(game, card.tag) >= 4 && hasPrerequisite(game, card.prerequisite);
}
export function canSelectHybrid(game, card) {
  return !game.hybrid && card.tags.every(tag => tagPoints(game, tag) >= 4) && card.prerequisites.every(condition => hasPrerequisite(game, condition));
}
export function canSelectRelic(game, card) {
  return !(game.relics || []).some(relic => (typeof relic === 'string' ? relic : relic.id) === card.id) && (card.prerequisites || []).every(condition => hasPrerequisite(game, condition));
}

function cardChoice(card, kind = card.kind, extra = {}) {
  return { id: card.id, kind, title: card.name, tag: card.tag, description: card.description, detail: card.detail || '', selection: card.id, ...extra };
}
function branchChoices(slot, index, kind) {
  const skill = getSkill(slot.id);
  return skill[kind === 'branch' ? 'branches' : 'modifiers'].map(card => ({
    id: `${slot.id}_${kind}_${card.id}`, kind, title: card.name, tag: skill.tag,
    description: card.description, detail: `${skill.name} · ${kind === 'branch' ? '분기' : '특수 변형'} · ${skill.tag} +1`, slotIndex: index, selection: card.id, skillId: slot.id,
  }));
}
function shuffled(game, array) {
  const result = [...array];
  const rng = typeof game.rng === 'function' ? game.rng : () => .5;
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(rng() * (i + 1))));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function allowed(game, card) { return !game.bans?.has?.(card.id); }
function statCandidates(game) {
  return STAT_CARDS.filter(card => allowed(game, card) && (game.cardRanks?.[card.id] || 0) < card.maxRank &&
    (card.id !== 'emergency_patch' || game.integrity < game.maxIntegrity || game.pressure > 0) &&
    (!card.changes.summonBonus || hasSkill(game, 'orbital')) &&
    (card.id !== 'caster_flow' || (game.stats?.cdr || 0) < .4) &&
    (card.id !== 'impact_critical' || (game.stats?.critChance || 0) < .6));
}

export function makeChoices(game, context = 'level') {
  const equipped = game.skillSlots || [];
  if (context === 'second-skill' || context === 'skill') {
    return shuffled(game, SKILLS.filter(skill => !hasSkill(game, skill.id) && allowed(game, skill))).slice(0, 3).map(skill => cardChoice(skill, 'skill', { skillId: skill.id, detail: `${skill.detail} · ${skill.tag} +2` }));
  }
  if (context === 'route') return ROUTES.map(card => cardChoice(card, 'route'));
  if (context === 'relic') {
    const relics = shuffled(game, RELICS.filter(card => allowed(game, card) && canSelectRelic(game, card))).slice(0, 3).map(card => cardChoice(card, 'relic'));
    // Two slots: the UI explicitly offers each occupied relic as a replacement choice.
    if ((game.relics || []).length >= 2) return relics.flatMap(choice => game.relics.map((relic, replaceIndex) => ({ ...choice, id: `${choice.id}_replace_${replaceIndex}`, replaceIndex, detail: `${choice.detail} · ${RELICS.find(card => card.id === (typeof relic === 'string' ? relic : relic.id))?.name || '기존 유물'} 교체` }))).slice(0, 4);
    return relics.length ? relics : [cardChoice(STAT_CARDS.find(card => card.id === 'integrity_buffer'), 'stat')];
  }
  if (context === 'hybrid') return shuffled(game, HYBRIDS.filter(card => allowed(game, card) && canSelectHybrid(game, card))).slice(0, 3).map(card => cardChoice(card, 'hybrid'));
  if (context === 'evolution') {
    const pending = Number.isInteger(game.pendingEvolution) ? game.pendingEvolution : null;
    const candidates = pending === null ? equipped.map((slot, index) => ({ slot, index })).filter(({ slot }) => slot && slot.evolution < 3) : [{ slot: equipped[pending], index: pending }].filter(({ slot }) => slot);
    // A core supplies any missing choices for free before it advances a skill.
    const unfinished = candidates.find(({ slot }) => !slot.branch || !slot.modifier);
    if (unfinished) return branchChoices(unfinished.slot, unfinished.index, !unfinished.slot.branch ? 'branch' : 'modifier').map(choice => ({ ...choice, freePrerequisite: true }));
    const choices = candidates.filter(({ slot }) => (slot.evolution || 0) < 2 || !hasFinal(game) && tagPoints(game, getSkill(slot.id).tag) >= 4 && (slot.uses || 0) >= 8).map(({ slot, index }) => {
      const skill = getSkill(slot.id), stage = (slot.evolution || 0) + 1;
      return { id: `${slot.id}_evolution_${stage}`, kind: 'evolution', title: skill.evolutionNames[stage - 1], tag: skill.tag, description: skill.evolutions[stage - 1], detail: `${skill.name} · ${stage === 3 ? 'FINAL · 런당 1개' : `EVOLUTION ${stage === 1 ? 'I' : 'II'}`} · ${skill.tag} +1`, slotIndex: index, skillId: slot.id, selection: stage };
    });
    if (progressionTime(game) >= 960 && !hasFinal(game)) {
      choices.push(...TAG_FINALS.filter(card => tagPoints(game, card.tag) >= 4 && (game.metrics?.[card.metric] || 0) >= 8).map(card => cardChoice(card, 'tag-final')));
    }
    if (choices.length) return choices;
    if (progressionTime(game) >= 1050) return makeChoices(game, 'relic');
    return [{ id: 'reserve_core', kind: 'reserve', title: '진화 코어 보관', tag: 'CASTER', description: '유효 시전 8회와 주 태그 4점을 채우면 Final 선택이 다시 열린다.', detail: '17:30까지 보관. 미충족 시 다른 진화 또는 유물로 교환. 보상은 소멸하지 않는다.' }];
  }

  const level = game.level || 1;
  // Progression deadlines use acquisition level, so a late second skill keeps both choices.
  const unbranched = equipped.map((slot, index) => ({ slot, index })).find(({ slot }) => slot && !slot.branch);
  if (unbranched) {
    const { slot, index } = unbranched;
    const branch = branchChoices(slot, index, 'branch');
    if (level >= (slot.branchDueLevel ?? (slot.acquiredLevel ?? 1) + 2)) return branch;
    const filler = shuffled(game, statCandidates(game)).find(card => card.tag === getSkill(slot.id).tag) || statCandidates(game)[0];
    return filler ? [...branch, cardChoice(filler)] : branch;
  }
  const unmodified = equipped.map((slot, index) => ({ slot, index })).find(({ slot }) => slot && slot.branch && !slot.modifier);
  if (unmodified) {
    const { slot, index } = unmodified;
    const modifiers = branchChoices(slot, index, 'modifier');
    if (level >= (slot.modifierDueLevel ?? (slot.branchLevel ?? slot.acquiredLevel ?? 1) + 2)) return modifiers;
    const filler = shuffled(game, statCandidates(game)).find(card => card.tag === getSkill(slot.id).tag) || statCandidates(game)[0];
    return filler ? [...modifiers, cardChoice(filler)] : modifiers;
  }
  const stats = shuffled(game, statCandidates(game));
  const methods = shuffled(game, METHODS.filter(card => allowed(game, card) && canSelectMethod(game, card)));
  const hybrids = shuffled(game, HYBRIDS.filter(card => allowed(game, card) && canSelectHybrid(game, card)));
  const choices = [];
  if (hybrids.length) choices.push(cardChoice(hybrids[0]));
  if (methods.length) choices.push(cardChoice(methods[0]));
  // A matching growth card, one rule, and one alternate direction keep the offer readable.
  const leadTag = Object.keys(TAGS).sort((a, b) => tagPoints(game, b) - tagPoints(game, a))[0];
  const matching = stats.find(card => card.tag === leadTag);
  if (matching) choices.push(cardChoice(matching));
  for (const card of stats) {
    if (choices.length >= 3) break;
    if (!choices.some(choice => choice.id === card.id)) choices.push(cardChoice(card));
  }
  return choices.slice(0, 3);
}

function addTag(game, tag, amount = 1) {
  game.tags ||= {};
  game.tags[tag] = (game.tags[tag] || 0) + amount;
}
function modifyStats(game, changes) {
  game.stats ||= {};
  for (const [key, amount] of Object.entries(changes || {})) {
    if (key === 'heal') { if (typeof game.heal === 'function') game.heal(amount); else game.integrity = Math.min(game.maxIntegrity || 100, (game.integrity || 0) + amount); }
    else if (key === 'maxIntegrity') game.maxIntegrity = Math.max(1, (game.maxIntegrity || 100) + amount);
    else if (key === 'pressure') game.pressure = Math.max(0, Math.min(100, (game.pressure || 0) + amount));
    else game.stats[key] = (game.stats[key] || 0) + amount;
  }
  game.stats.cdr = Math.min(.4, game.stats.cdr || 0);
  game.stats.critChance = Math.min(.6, game.stats.critChance || 0);
}

export function applyChoice(game, choice) {
  if (!choice || !choice.kind) return { applied: false };
  game.methods ||= new Set(); game.owned ||= new Set(); game.cardRanks ||= {};
  let nextContext;
  const slot = game.skillSlots?.[choice.slotIndex];
  if (choice.kind === 'skill') {
    const skill = getSkill(choice.skillId || choice.selection);
    if (!skill || hasSkill(game, skill.id) || slots(game).length >= 2) return { applied: false };
    if (typeof game.grantSkill === 'function') game.grantSkill(skill.id);
    else { game.skillSlots ||= []; game.skillSlots.push({ id: skill.id, branch: null, modifier: null, evolution: 0, cd: 0, uses: 0, key: game.skillSlots.length ? 'Q' : 'E' }); addTag(game, skill.tag, 2); }
    const acquired = slots(game).find(item => item.id === skill.id);
    if (acquired) { acquired.acquiredLevel = game.level || 1; acquired.branchDueLevel = (game.level || 1) + 2; }
  } else if (choice.kind === 'branch' || choice.kind === 'modifier') {
    if (!slot || slot[choice.kind] || choice.kind === 'modifier' && !slot.branch) return { applied: false };
    const skill = getSkill(slot.id), options = skill[choice.kind === 'branch' ? 'branches' : 'modifiers'];
    if (!options.some(card => card.id === choice.selection)) return { applied: false };
    slot[choice.kind] = choice.selection; addTag(game, skill.tag);
    if (choice.kind === 'branch') { slot.branchLevel = game.level || 1; slot.modifierDueLevel = (game.level || 1) + 2; }
    if (choice.freePrerequisite) { game.pendingEvolution = choice.slotIndex; nextContext = 'evolution'; }
  } else if (choice.kind === 'evolution') {
    if (!slot || !slot.branch || !slot.modifier || choice.selection !== (slot.evolution || 0) + 1 || choice.selection > 3) return { applied: false };
    const skill = getSkill(slot.id);
    if (choice.selection === 3 && (hasFinal(game) || tagPoints(game, skill.tag) < 4 || (slot.uses || 0) < 8)) return { applied: false };
    slot.evolution = choice.selection; addTag(game, skill.tag); game.pendingEvolution = null; game.pendingCore = false;
    if (slot.evolution === 3) { game.final = skill.id; game.hasFinal = true; if (slot.id === 'orbital') game.network = Math.max(50, game.network || 0); }
  } else if (choice.kind === 'method') {
    const card = METHODS.find(item => item.id === choice.selection);
    if (!card || !canSelectMethod(game, card)) return { applied: false };
    game.methods.add(card.id); addTag(game, card.tag);
  } else if (choice.kind === 'hybrid') {
    const card = HYBRIDS.find(item => item.id === choice.selection);
    if (!card || !canSelectHybrid(game, card)) return { applied: false };
    game.hybrid = card.id;
  } else if (choice.kind === 'relic') {
    const card = RELICS.find(item => item.id === choice.selection);
    if (!card || !canSelectRelic(game, card)) return { applied: false };
    game.relics ||= [];
    if (game.relics.length >= 2) {
      if (!Number.isInteger(choice.replaceIndex) || choice.replaceIndex < 0 || choice.replaceIndex >= game.relics.length) return { applied: false };
      const removed = game.relics[choice.replaceIndex];
      // Undo persistent health changes before applying a replacement.
      if ((typeof removed === 'string' ? removed : removed.id) === 'hollow_crown') { game.maxIntegrity += game.relicState?.crownMaxDelta || 0; game.stats.power -= .12; }
      if ((typeof removed === 'string' ? removed : removed.id) === 'lens') game.stats.radiusBonus -= 8;
      game.relics[choice.replaceIndex] = card.id;
    } else game.relics.push(card.id);
    if (card.id === 'hollow_crown') {
      game.relicState ||= {}; game.relicState.crownMaxDelta = Math.max(0, game.maxIntegrity - 90);
      modifyStats(game, { power: .12, maxIntegrity: -game.relicState.crownMaxDelta });
    }
    if (card.id === 'lens') modifyStats(game, { radiusBonus: 8 });
    game.integrity = Math.min(game.integrity, game.maxIntegrity); addTag(game, card.tag);
  } else if (choice.kind === 'stat') {
    const card = STAT_CARDS.find(item => item.id === choice.selection);
    if (!card || (game.cardRanks[card.id] || 0) >= card.maxRank) return { applied: false };
    modifyStats(game, card.changes); game.cardRanks[card.id] = (game.cardRanks[card.id] || 0) + 1; addTag(game, card.tag);
  } else if (choice.kind === 'route') {
    const route = ROUTES.find(item => item.id === choice.selection);
    if (!route) return { applied: false };
    game.route = { ...route, selectedAt: game.time || 0, startsAt: (game.time || 0) + 15, completed: false };
    if (route.id === 'stable_supply') { modifyStats(game, { heal: 15, pressure: -8 }); game.rewrite = Math.min(4, (game.rewrite || 0) + 1); }
    if (route.id === 'forbidden_rift') { if (game.integrity > 10) game.integrity -= 10; else game.pressure = Math.min(100, (game.pressure || 0) + 10); game.pressure = Math.min(100, (game.pressure || 0) + 8); }
  } else if (choice.kind === 'tag-final') {
    const card = TAG_FINALS.find(item => item.id === choice.selection);
    if (!card || hasFinal(game) || progressionTime(game) < 960 || tagPoints(game, card.tag) < 4 || (game.metrics?.[card.metric] || 0) < 8) return { applied: false };
    game.tagFinal = card.id; game.final = card.id; game.hasFinal = true; game.methods.add(card.id); game.pendingCore = false; game.pendingEvolution = null;
  } else if (choice.kind === 'reserve') {
    game.pendingCore = true;
    return { applied: true, reserved: true };
  } else return { applied: false };
  // Repeatable statistics remain rank-tracked; one-off choices stay discoverable.
  game.owned.add(choice.selection ?? choice.id);
  if (typeof game.toast === 'function') game.toast(`${choice.title} 획득`);
  return { applied: true, nextContext };
}

export function skillDescription(slot) {
  if (!slot) return '두 번째 스킬은 3:30에 선택한다.';
  const skill = getSkill(slot.id);
  if (!skill) return '';
  const branch = skill.branches.find(card => card.id === slot.branch);
  const modifier = skill.modifiers.find(card => card.id === slot.modifier);
  return [skill.description, branch && branch.description, modifier && modifier.description, slot.evolution > 0 && `${skill.evolutionNames[slot.evolution - 1]} · ${skill.evolutions[slot.evolution - 1]}`].filter(Boolean).join('\n');
}
