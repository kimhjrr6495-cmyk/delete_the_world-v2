import { Game } from './engine.js';
import { Renderer } from './render.js';
import { AudioBus } from './audio.js';
import { TAGS, CORES, SKILLS, METHODS, HYBRIDS, RELICS, getSkill, skillDescription } from './data.js';
import { readSave, writeSave, settleRun } from './storage.js';
import { clamp, formatTime } from './util.js';

const $=id=>document.getElementById(id),escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storage;try{storage=localStorage;}catch{}
let save=readSave(storage),selected='overcharge',mode='standard',toastUntil=0,resumeAfterPanel=false,panelType=null,rebind=null,labConfig=null,bindingError='';
let cooldownTrack=[{id:null,last:0,total:0},{id:null,last:0,total:0}];
const defaults={skill0:'KeyE',skill1:'KeyQ',network:'KeyT',pause:'Escape'};let keys={...defaults,...save.settings.keys};
const game=new Game({settings:{...save.settings,reducedMotion:save.settings.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches},research:save.research,onEvent:event,onSound:name=>audio?.play(name)});
const audio=new AudioBus(game.settings),canvas=$('arena'),renderer=new Renderer(canvas);
window.__DTW__={game,version:'2.0.0'};

function applyUISettings(){document.body.classList.toggle('reduced-motion',!!game.settings.reducedMotion);document.body.classList.toggle('high-contrast',!!game.settings.highContrast);}
function persist(){save.settings={...game.settings,keys};save.research={...game.research};applyUISettings();const success=writeSave(storage,save);$('memory-chip').textContent=`${save.memory} M`;return success;}
function event(type,payload){
  if(type==='toast'){$('toast').textContent=payload;toastUntil=performance.now()+3500;$('toast').classList.add('visible');}
  if(type==='start'){document.body.classList.remove('menu-state');$('menu').classList.add('hidden');$('game-view').classList.remove('hidden');hideOverlay();cooldownTrack=[{id:null,last:0,total:0},{id:null,last:0,total:0}];$('run-seed').textContent=`SEED / ${game.seed}`;renderSkillCards();renderHUD();canvas.tabIndex=0;canvas.focus({preventScroll:true});}
  if(type==='training'){renderSkillCards();renderHUD();$('run-seed').textContent='RULE LAB / NO REWARDS';}
  if(type==='choices')renderChoices();
  if(type==='choice'){hideOverlay();renderSkillCards();}
  if(type==='pause')renderPause();
  if(type==='resume')hideOverlay();
  if(type==='end'){if(payload.mode==='training'){returnMenu();return;}const settled=settleRun(save,payload);save=settled.save;payload.memory=settled.awarded;payload.saved=persist();renderResult(payload);}
}
function renderMenu(){
  $('core-grid').innerHTML=CORES.map(c=>{const skill=getSkill(c.skillId);return `<button class="core-card ${selected===c.skillId?'selected':''}" style="--core-color:${c.color}" data-skill="${c.skillId}" aria-label="${skill.name} 선택 후 시작"><span class="core-tag">INITIAL ANOMALY · ${keyLabel(keys.skill0)}</span><h3>${skill.name}</h3><p>${escape(skill.description)}</p><small class="core-cooldown">BASE COOLDOWN · ${skill.cooldown}s</small><span class="core-bonus">${escape(c.ko)} · ${escape(c.description)}</span></button>`;}).join('');
  $('core-grid').querySelectorAll('button').forEach(b=>b.onclick=()=>{selected=b.dataset.skill;audio.unlock();audio.play('arm');start();});
  $('memory-chip').textContent=`${save.memory} M`;
}
function start(){audio.unlock();game.research=save.research;game.start(selected,mode,$('seed-input').value.trim()||Date.now());}
$('start-button').onclick=start;
$('begin-button').onclick=showSetup;
$('setup-back').onclick=returnMenu;
function showSetup(){game.phase='menu';game.cancelInputs();hideOverlay();document.body.classList.add('menu-state');$('menu').classList.remove('hidden');$('menu-title').classList.add('hidden');$('setup-menu').classList.remove('hidden');canvas.tabIndex=-1;renderMenu();$('core-grid').querySelector('[data-skill]')?.focus({preventScroll:true});if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}
document.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{mode=b.dataset.mode;document.querySelectorAll('[data-mode]').forEach(a=>a.classList.toggle('active',a===b));});
function hideOverlay(){$('overlay').classList.add('hidden');$('overlay').classList.remove('choice-mode','pause-mode','result-mode');$('overlay').innerHTML='';}
const KIND={skill:'NEW SKILL',branch:'BRANCH',modifier:'SPECIAL MODIFIER',evolution:'EVOLUTION',method:'BUILD METHOD',hybrid:'CROSS BUILD',relic:'RELIC',stat:'GROWTH',route:'CONTRACT',reserve:'RESERVE CORE','tag-final':'TAG FINAL'};
const CONTEXT={level:['CORE EVOLUTION','삭제의 기본 규칙을 확장하세요.'], 'second-skill':['A NEW METHOD OF DELETION EXISTS.','두 번째 스킬을 선택하세요. 새로운 삭제 경로가 연결됩니다.'],evolution:['ANOMALY EVOLUTION','현재 스킬을 진화시키세요.'],relic:['REALITY RELIC','유물은 최대 2개. 교체할 대상을 확인하세요.'],hybrid:['METHOD DISCOVERED','두 삭제 경로를 하나의 고유 규칙으로 연결합니다.'],route:['CHOOSE HOW REALITY ENDS.','다음 균열의 위험과 보상을 선택하세요.'],};
function cardStyle(card){if(['evolution','tag-final'].includes(card.kind))return 'VOID evolutionCard skillUpgradeDrop';if(card.kind==='skill')return 'SKILL';if(['hybrid','relic'].includes(card.kind))return 'EPIC';if(['branch','modifier','method'].includes(card.kind))return 'RARE';return 'COMMON';}
function renderChoices(){
  gamepadChoice=0;
  const context=CONTEXT[game.choiceContext]||CONTEXT.level;
  hideOverlay();$('overlay').classList.add('choice-mode');
  $('overlay').innerHTML=`<div class="overlay-shell"><h2 id="overlay-title">${context[0]}</h2><p class="subtitle">${context[1]}</p><div class="source-line">${game.choiceContext==='level'?`VOID LEVEL ${game.level}`:'NEW RULE AVAILABLE'}</div><div class="choice-grid" style="--choice-count:${Math.min(3,game.choices.length)}">${game.choices.map((c,i)=>`<button class="choice-card ${cardStyle(c)}" style="--card-color:${TAGS[c.tag]?.color||'#b08cff'}" data-choice="${escape(c.id)}"><span class="choice-number">${i+1}</span><span class="choice-type">${KIND[c.kind]||c.kind} / ${c.tag||'RULE'}</span><strong>${escape(c.title)}</strong><p>${escape(c.description)}</p><small>${escape(c.detail)}</small></button>`).join('')}</div><div class="choice-actions"><span>시간 정지 · 숫자 키로 선택</span>${game.choiceContext==='level'?`<button id="reroll" ${game.rewrite<1||game.choiceAdjusted?'disabled':''}>다시 쓰기 / ${game.rewrite} REWRITE</button><button id="ban-choice" ${game.rewrite<1||game.choiceAdjusted||game.bans.size>=2?'disabled':''}>선택 카드 제외</button>`:''}</div></div>`;
  $('overlay').classList.remove('hidden');$('overlay').querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>game.choose(b.dataset.choice));
  if($('reroll')){$('reroll').disabled ||= game.choices.every(c=>['branch','modifier'].includes(c.kind));$('reroll').onclick=()=>game.reroll();}
  const banButton=$('ban-choice');
  if(banButton){
    let banTarget=null;
    const focusBanTarget=id=>{const card=game.choices.find(c=>c.id===id);banTarget=card&&['stat','method'].includes(card.kind)?card.id:null;banButton.disabled=!banTarget||game.rewrite<1||game.choiceAdjusted||game.bans.size>=2;banButton.textContent=banTarget?`${card.title} 제외 / 1 REWRITE`:'이 카드는 제외 불가';};
    $('overlay').querySelectorAll('[data-choice]').forEach(b=>{b.onfocus=()=>focusBanTarget(b.dataset.choice);b.onpointerenter=()=>focusBanTarget(b.dataset.choice);});
    banButton.onclick=()=>{if(banTarget)game.ban(banTarget);};
  }
  $('overlay').querySelector('[data-choice]')?.focus({preventScroll:true});renderHUD();
}
function renderSkillCards(){
  for(let i=0;i<2;i++){
    const s=game.skillSlots[i],node=$(`skill-card-${i}`),key=keyLabel(keys[`skill${i}`]);node.style.setProperty('--skill-color','#b08cff');
    if(!s){node.classList.add('empty');node.classList.remove('ready');node.innerHTML=`<span class="command-key">${key}</span><div class="skill-info"><strong>EMPTY</strong><small>${game.mode==='training'?'실험실에서 보조 스킬 선택':`${formatTime(210/(game.pace||1))}에 새로운 스킬 코어 획득`}</small></div>`;continue;}
    const def=getSkill(s.id),branch=def.branches.find(b=>b.id===s.branch);node.classList.remove('empty');node.title=skillDescription(s);node.innerHTML=`<span class="command-key">${key}</span><div class="skill-info"><strong>${def.name} · ${s.evolution===3?'FINAL':`EVO ${s.evolution}`}</strong><small>${branch?.name||def.ko}${s.modifier?' · 변형':''}</small><div class="meter"><i id="skill-fill-${i}"></i></div></div><span id="skill-cd-${i}" class="cooldown-value hidden"></span>`;
  }
}
function renderHUD(){
  const integrity=clamp(game.integrity/game.maxIntegrity*100,0,100);
  $('integrity-value').textContent=`${Math.ceil(integrity)}%`;$('integrity-fill').style.width=`${integrity}%`;$('integrity-fill').style.background=game.integrity<30?'#ff526d':'#e8e8ff';
  $('stability-value').textContent=`${Math.ceil(integrity)}%`;$('stability-fill').style.width=`${integrity}%`;
  $('pressure-value').textContent=game.pressure.toFixed(1);$('time-value').textContent=formatTime(game.time);$('level-value').textContent=`LV. ${game.level}`;$('xp-fill').style.width=`${clamp(game.xp/game.nextLevel*100,0,100)}%`;$('xp-value').textContent=`${Math.floor(game.xp)} / ${Math.ceil(game.nextLevel)}`;
  const tier=[...game.eventsDone].filter(id=>/^adapt-\d+$/.test(id)).length;
  $('stage-tier').textContent=`월드 티어 ${tier}`;$('adaptation-value').textContent=`${game.adaptations.length} / 2`;$('adaptation-fill').style.width=`${game.adaptations.length*50}%`;
  $('stage-value').textContent=game.worldTime<210?'고정점을 지키며 첫 경로를 만드세요':game.worldTime<480?'서로 다른 두 삭제 경로를 연결하세요':game.worldTime<780?'세계의 봉합과 노출 균열':game.worldTime<1080?'최종 규칙을 완성하세요':'REALITY ENGINE / 최종 봉합';
  if(game.mode==='training'){$('stage-value').textContent='규칙 실험실 · ESC로 재설정하거나 종료하세요';$('level-value').textContent='RULE LAB';$('xp-value').textContent='보상과 기록을 정산하지 않습니다';}
  $('enemy-value').textContent=`${game.enemies.length} CELLS`;$('kills-value').textContent=game.kills.toLocaleString();$('rewrite-value').textContent=game.rewrite;$('heat-value').textContent=Math.floor(game.heat);$('heat-value').style.color=game.heat>=80?'#ffe66d':'#ff8094';$('heat-fill').style.width=`${clamp(game.heat,0,100)}%`;
  $('build-value').textContent=Object.entries(game.tags).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>`${k} ${v}`).join(' / ');
  const networkAvailable=game.skillSlots.some(s=>s.id==='orbital'&&s.evolution===3);
  const networkReady=game.network>=50&&(game.skills.networkCooldown||0)<=0&&!game.fields.some(f=>f.type==='network');
  $('network-label').classList.toggle('hidden',!networkAvailable);$('network-label').classList.toggle('ready',networkReady);$('network-value').textContent=`${Math.floor(game.network)}%${networkReady?` · ${keyLabel(keys.network)} READY`:game.skills.networkCooldown>0?` · ${Math.ceil(game.skills.networkCooldown)}s`:''}`;$('network-fill').style.width=`${clamp(game.network,0,100)}%`;
  for(let i=0;i<2;i++){
    $(`charge-${i}`).classList.toggle('empty',game.charges<=i);
    const s=game.skillSlots[i];if(!s||!$(`skill-cd-${i}`))continue;
    const cd=Math.max(0,s.cd),track=cooldownTrack[i];
    if(track.id!==s.id||cd>track.last+.05){track.id=s.id;track.total=cd;}
    track.last=cd;$(`skill-cd-${i}`).textContent=cd.toFixed(1);$(`skill-cd-${i}`).classList.toggle('hidden',cd<=.1);$(`skill-card-${i}`).classList.toggle('ready',cd<=.1);
    $(`skill-fill-${i}`).style.width=`${(1-clamp(cd/Math.max(.001,track.total),0,1))*100}%`;
    if(cd<=.1)track.total=0;
  }
  const recovery=game.chargeLock>0?`LOCK ${game.chargeLock.toFixed(1)}s`:`${Math.max(0,(2.8-game.chargeTimer)/game.stats.chargeRate).toFixed(1)}s`;
  $('charge-text').textContent=`${game.charges} / 2${game.charges<2?` · ${recovery}`:''}`;
  const preview=game.adaptationPreview;$('adaptation-text').textContent=preview?`관찰 ${preview.tag} → ${Math.ceil((preview.at-game.worldTime)/game.pace)}초 뒤 봉합 / ${preview.weakness} 균열`:game.adaptations.length?game.adaptations.map(a=>`${a.tag} −25% / ${a.weakness} +30%`).join(' · '):'삭제 경로를 관찰하고 있습니다.';
  $('boss-hud').classList.toggle('hidden',!game.boss);if(game.boss){$('boss-name').textContent=game.boss.name;$('boss-fill').style.width=`${game.boss.hp/game.boss.maxHp*100}%`;$('boss-state').textContent=game.boss.vulnerable>0?'공통 균열 OPEN · 직접 삭제로 공격 중단':`봉합 준비 · ${Math.ceil(game.boss.aiTimer)}s`;}
  const finalIn=(1080-game.worldTime)/(game.pace||1),approaching=game.mode!=='training'&&game.phase!=='ended'&&!game.eventsDone.has('final')&&finalIn>0&&finalIn<=30;
  $('boss-countdown').classList.toggle('hidden',!approaching);$('boss-countdown-time').textContent=Math.ceil(finalIn);
}
function runRow(label,value){return `<div class="run-item"><span>${escape(label)}</span><b>${escape(value)}</b></div>`;}
function signedPercent(value){return `${value>=0?'+':''}${Math.round(value*100)}%`;}
function buildMarkup(){
  const recent=game.damageLog.filter(hit=>game.time-hit.time<=30).reduce((totals,hit)=>{totals[hit.tag]=(totals[hit.tag]||0)+hit.damage;return totals;},{});
  const recentTotal=Object.values(recent).reduce((a,b)=>a+b,0)||1,total=Object.values(game.damageStats).reduce((a,b)=>a+b,0);
  const analysis=Object.entries(game.tags).map(([tag,points])=>`${runRow(tag,points)}<div class="damage-mini"><i style="width:${Math.min(100,points*10)}%;background:${TAGS[tag].color}"></i></div>`).join('');
  const damage=Object.entries(recent).sort((a,b)=>b[1]-a[1]).map(([tag,n])=>`${runRow(tag,`${Math.round(n/recentTotal*100)}%`)}<div class="damage-mini"><i style="width:${n/recentTotal*100}%;background:${TAGS[tag]?.color||'#b08cff'}"></i></div>`).join('');
  const skills=[0,1].map(i=>{const s=game.skillSlots[i];return s?`<div class="run-description"><b>[${keyLabel(keys[`skill${i}`])}] ${getSkill(s.id).name} · ${s.evolution===3?'FINAL':`EVO ${s.evolution}`}</b><p>${escape(skillDescription(s))}</p><small>유효 사용 ${s.uses}회 · 남은 쿨다운 ${Math.max(0,s.cd).toFixed(1)}s</small></div>`:`<div class="run-description">${keyLabel(keys[`skill${i}`])} · EMPTY</div>`;}).join('');
  const methods=[...game.methods].map(id=>{const method=METHODS.find(c=>c.id===id);return `<div class="run-description"><b>${escape(method?.name||id)}</b><p>${escape(method?.description||'태그 Final 규칙')}</p></div>`;}).join('')||'<div class="empty-note">NO ACTIVE METHODS</div>';
  const hybrid=HYBRIDS.find(c=>c.id===game.hybrid);
  const relics=game.relics.map(id=>{const relic=RELICS.find(c=>c.id===id);return `<div class="run-description"><b>${escape(relic?.name||id)}</b><p>${escape(relic?.description||'')}</p></div>`;}).join('');
  return `<div class="run-grid"><section class="run-box"><h3>CURRENT ANOMALIES</h3>${skills}<h3>ACTIVE METHODS</h3>${methods}${hybrid?`<h3>CROSS BUILD</h3><div class="run-description"><b>${hybrid.name}</b><p>${escape(hybrid.description)}</p></div>`:''}<h3>REALITY RELICS / ${game.relics.length} OF 2</h3>${relics||'<div class="empty-note">NO RELICS</div>'}</section><section class="run-box"><h3>BUILD ANALYSIS</h3>${analysis}<h3>RECENT DAMAGE · 30s</h3>${damage||'<div class="empty-note">NO RECENT DAMAGE</div>'}<h3>WORLD ADAPTATION</h3>${game.adaptations.map(a=>runRow(a.tag,`−25% / ${a.weakness} +30%`)).join('')||'<div class="empty-note">아직 봉합이 없습니다.</div>'}</section><section class="run-box"><h3>COMBAT DATA</h3>${runRow('DAMAGE',`×${game.stats.power.toFixed(2)}`)}${runRow('DIRECT BONUS',signedPercent(game.stats.directBonus))}${runRow('SKILL BONUS',signedPercent(game.stats.skillBonus))}${runRow('CRIT',`${Math.round(Math.min(.6,game.stats.critChance)*100)}%`)}${runRow('CRIT DMG',`${Math.round(game.stats.critDamage*100)}%`)}${runRow('CLICK RADIUS',`${36+game.stats.radiusBonus} / ${48+game.stats.radiusBonus}px`)}${runRow('COOLDOWN',`−${Math.round(clamp(game.stats.cdr,0,.4)*100)}%`)}${runRow('REWRITE',game.rewrite)}<h3>RUN STATISTICS</h3>${runRow('DELETED',game.kills.toLocaleString())}${runRow('TOTAL DAMAGE',Math.round(total).toLocaleString())}${runRow('DPS',Math.round(total/Math.max(1,game.time)).toLocaleString())}${runRow('INTERRUPTS',game.metrics.interrupts)}${runRow('WEAKNESS HITS',game.metrics.weaknessHits)}${runRow('RUN TIME',formatTime(game.time))}${runRow('SEED',game.seed)}</section></div>`;
}
function renderPause(){
  hideOverlay();$('overlay').classList.add('pause-mode');
  $('overlay').innerHTML=`<div class="overlay-shell run-data-panel"><div class="eyebrow">PAUSED · ESC TO RESUME</div><h2 id="overlay-title">RUN DATA</h2>${buildMarkup()}<div class="pause-top"><button id="resume-button">전투 재개 / ESC</button><button id="pause-settings">설정</button><button id="abandon-button">런 종료</button></div></div>`;$('overlay').classList.remove('hidden');$('resume-button').onclick=()=>game.pause();$('pause-settings').onclick=()=>openPanel('settings');$('abandon-button').onclick=()=>game.end(false,'삭제 설계자가 런을 종료했습니다.');$('resume-button').focus({preventScroll:true});
  if(game.mode==='training'){$('abandon-button').textContent='연습 종료';const button=document.createElement('button');button.textContent='대상·쿨다운 재설정';button.onclick=()=>game.startTraining({...game.practiceConfig});$('overlay').querySelector('.pause-top').append(button);}
}
function renderResult(result){
  const total=Object.values(result.damage).reduce((a,b)=>a+b,0)||1;
  hideOverlay();$('overlay').classList.add('result-mode');
  $('overlay').innerHTML=`<div class="overlay-shell result-panel"><h2 id="overlay-title">${result.won?'WORLD DELETED.':'REALITY STABILIZED.'}</h2><div class="eyebrow">${result.won?'REALITY ENGINE DESTROYED':'DELETE FAILED'}</div><p class="subtitle">${escape(result.cause)}</p><div class="result-lines"><p><small>삭제한 물체</small><b>${result.kills.toLocaleString()}개</b></p><p><small>현실 유지 시간</small><b>${formatTime(result.duration)}</b></p><p><small>삭제 점수</small><b>${result.score.toLocaleString()}</b></p><p><small>획득한 엔트로피 기록</small><b>+${result.memory} MEMORY</b></p></div><details class="result-analysis"><summary>삭제 경로 확인</summary><div class="result-detail"><div class="build-section"><h3>DELETION PATHS</h3>${Object.entries(result.damage).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([tag,n])=>`<div class="damage-row"><span style="color:${TAGS[tag].color}">${tag}</span><div class="meter"><i style="width:${n/total*100}%;background:${TAGS[tag].color}"></i></div><span>${Math.round(n/total*100)}%</span></div>`).join('')}</div><div class="build-section"><h3>CURRENT ANOMALIES</h3><p>채널·보스 중단 ${result.metrics.interrupts}회 · 노출 균열 적중 ${result.metrics.weaknessHits}회<br>최종 레벨 ${result.level} · 남은 무결성 ${result.integrity}</p><p>${result.skills.map(s=>`${getSkill(s.id).name} · ${s.evolution===3?'FINAL':`EVO ${s.evolution}`}`).join('<br>')}</p></div></div></details>${result.saved?'':'<p class="save-warning">브라우저 저장 공간을 사용할 수 없어 기록은 이번 화면에서만 유지됩니다.</p>'}<div class="result-buttons"><button id="retry-button">다시 삭제</button><button id="entropy-result">엔트로피</button><button id="same-seed-button">같은 시드</button><button id="return-menu">시작 화면</button></div></div>`;
  $('overlay').classList.remove('hidden');$('retry-button').onclick=showSetup;$('entropy-result').onclick=()=>openPanel('archive');$('same-seed-button').onclick=()=>game.start(selected,mode,result.seed);$('return-menu').onclick=returnMenu;$('retry-button').focus({preventScroll:true});renderHUD();
}
function returnMenu(){game.phase='menu';game.cancelInputs();hideOverlay();document.body.classList.add('menu-state');$('game-view').classList.remove('hidden');$('menu').classList.remove('hidden');$('menu-title').classList.remove('hidden');$('setup-menu').classList.add('hidden');canvas.tabIndex=-1;renderMenu();$('begin-button').focus({preventScroll:true});if(document.fullscreenElement)document.exitFullscreen().catch(()=>{});}
function keyLabel(code){return code.replace(/^Key/,'').replace(/^Digit/,'').replace('Escape','ESC').replace('Space','SPACE');}
function openPanel(type){panelType=type;bindingError='';resumeAfterPanel=game.phase==='playing';if(resumeAfterPanel)game.pause();renderPanel(type);$('panel').showModal();}
function closePanel(){const previousType=panelType;$('panel').close();panelType=null;if(resumeAfterPanel&&game.phase==='paused')game.pause();else if(previousType==='archive'&&game.phase==='ended')returnMenu();resumeAfterPanel=false;rebind=null;bindingError='';}
$('panel-close').onclick=closePanel;$('panel').addEventListener('cancel',e=>{e.preventDefault();closePanel();});
$('archive-button').onclick=()=>openPanel('archive');$('settings-button').onclick=()=>openPanel('settings');$('guide-button').onclick=()=>openPanel('guide');$('pause-button').onclick=()=>game.pause();
$('lab-button').onclick=()=>openPanel('lab');
function renderPanel(type){
  if(type==='lab')renderLab();
  if(type==='guide')$('panel-content').innerHTML=`<div class="eyebrow">FIELD MANUAL</div><h2>한 점을 고르고, 경로를 바꾸세요.</h2><p>세 개의 보라빛 고정점이 현실을 붙잡습니다. 채널러가 접근하면 <b>2초 경고</b> 뒤 무결성을 깎습니다. 적색 경고를 보고 직접 삭제나 스킬로 채널을 끊으세요.</p><table class="controls-table"><tr><td>마우스 이동</td><td>조준 위치와 자동 펄스의 관심 영역</td></tr><tr><td>좌클릭 / 홀드</td><td>2충전 직접 삭제. 0.8초부터 강타, 1.2초 완충. 충전당 2.8초 회복.</td></tr><tr><td>${keyLabel(keys.skill0)} / ${keyLabel(keys.skill1)}</td><td>액티브 스킬. 전도는 다음 클릭에 무장, 절단은 누른 채 방향을 그립니다.</td></tr><tr><td>${keyLabel(keys.network)}</td><td>ORBITAL 최종 진화의 CROSS NETWORK. 게이지 50부터.</td></tr><tr><td>1 / 2 / 3</td><td>성장 카드 선택. 선택 화면에서는 전투 시간이 멈춥니다.</td></tr><tr><td>${keyLabel(keys.pause)}</td><td>RUN DATA · 일시정지와 현재 빌드 확인</td></tr><tr><td>게임패드</td><td>오른쪽 스틱 조준 · A 직접 삭제 · X/Y 스킬 · B 네트워크 · START 계획</td></tr></table><h3>선택은 작동 방식부터 읽으세요.</h3><p>분기와 특수 변형을 고르고, 8·13분 보스와 16분 시련에서 진화 코어를 얻습니다. 같은 기술에 세 코어를 집중하면 Final에 도달합니다. 최종 조건은 태그 4점과 유효 사용 8회입니다.</p><h3>세계의 봉합에는 균열이 있습니다.</h3><p>세계는 자주 쓰는 경로를 30초 전에 예고합니다. 일부 적의 해당 피해가 25% 줄어드는 대신 표시된 다른 경로는 30% 강해집니다. 갑옷의 출처 아이콘을 읽고 스킬과 직접 삭제를 바꾸세요.</p><p class="colorblind-hint">청록 지그재그 / 연두 분할 원환 / 보라 동심원 / 황금 사각 / 주황 쐐기 / 백금 절단선으로 색 없이도 출처를 구분합니다.</p>`;
  if(type==='settings'){
    $('panel-content').innerHTML=`<div class="eyebrow">ACCESSIBILITY / AUDIO / INPUT</div><h2>전투 신호를 읽기 쉽게</h2>${[['sound','효과음','경고와 약점 소리를 포함합니다.'],['reducedMotion','저동작 모드','화면 흔들림·회전 잔상·반복 장식을 줄입니다.'],['lowEffects','효과량 줄이기','장식 파티클을 줄이고 판정과 경고는 유지합니다.'],['highContrast','고대비 윤곽','적과 중요한 상태의 윤곽을 강조합니다.']].map(([id,title,desc])=>`<label class="settings-row"><span>${title}<small>${desc}</small></span><input type="checkbox" data-setting="${id}" ${game.settings[id]?'checked':''}></label>`).join('')}<label class="settings-row"><span>효과음 크기</span><input id="volume" type="range" min="0" max="1" step=".05" value="${game.settings.volume??.5}" aria-label="효과음 크기"></label><h3>키 지정</h3><p class="save-warning" role="alert">${escape(bindingError)}</p>${[['skill0','첫 스킬'],['skill1','두 번째 스킬'],['network','네트워크'],['pause','계획 화면']].map(([id,title])=>`<div class="settings-row"><span>${title}</span><button data-rebind="${id}">${rebind===id?'새 키를 누르세요':keyLabel(keys[id])}</button></div>`).join('')}<p>같은 키를 두 행동에 지정할 수 없습니다. ESC는 일시정지와 키 지정 취소에 사용합니다.</p>`;
    $('panel-content').querySelectorAll('[data-setting]').forEach(input=>input.onchange=()=>{game.settings[input.dataset.setting]=input.checked;persist();if(input.dataset.setting==='sound'){audio.unlock();audio.play('arm');}});$('volume').oninput=e=>{game.settings.volume=Number(e.target.value);persist();};$('panel-content').querySelectorAll('[data-rebind]').forEach(b=>b.onclick=()=>{rebind=b.dataset.rebind;bindingError='';renderPanel('settings');});
  }
  if(type==='archive'){
    const discovered=new Set(save.discoveries);
    $('panel-content').innerHTML=`<div class="entropy-panel"><h2>ENTROPY</h2><p class="entropy-count">보유 엔트로피 기록: <b>${save.memory} MEMORY</b></p><div class="research-grid">${[['recovery','충전 분석','단계당 직접 삭제 충전 회복 +2%'],['insight','관찰 기록','단계당 시작 VOID +4']].map(([id,title,desc])=>{const lv=save.research[id]||0,price=5+lv*3;return `<button data-research="${id}" ${lv>=5||save.memory<price?'disabled':''}><strong>${title}</strong><small>${desc}</small><span>레벨 ${lv} / 5 · ${lv>=5?'연구 완료':`비용 ${price} MEMORY`}</span></button>`;}).join('')}</div><details class="archive-details"><summary>기록 보관소 · ${save.runs} RUNS / ${save.wins} ERASURES</summary><h3>BEST SCORE / ${save.best.toLocaleString()}</h3><h3>최근 삭제 기록</h3>${save.history.length?save.history.map(r=>`<div class="history-row"><span>${r.won?'완료':'재구성'}</span><span>SEED ${r.seed} · ${r.kills} 삭제</span><span>${formatTime(r.duration)}</span><span>+${r.memory} MEMORY</span></div>`).join(''):'<div class="empty-note">첫 런을 마치면 결과와 빌드 발견이 저장됩니다.</div>'}<h3>발견한 규칙 / ${discovered.size}</h3><div class="codex-grid">${[...METHODS,...HYBRIDS,...RELICS].map(c=>`<div class="codex-item ${discovered.has(c.id)?'':'locked'}"><strong>${escape(c.name)}</strong><small>${discovered.has(c.id)?escape(c.description):'이번 런의 조건을 채워 발견하세요.'}</small></div>`).join('')}</div></details><button id="entropy-back">뒤로</button></div>`;
    $('entropy-back').onclick=closePanel;
    $('panel-content').querySelectorAll('[data-research]').forEach(b=>b.onclick=()=>{const id=b.dataset.research,lv=save.research[id]||0,price=5+lv*3;if(lv>=5||save.memory<price)return;save.memory-=price;save.research[id]=lv+1;game.research={...save.research};persist();renderPanel('archive');});
  }
}
function renderLab(){
  if(!labConfig){const def=getSkill(selected);labConfig={skillId:selected,evolution:3,branch:def.branches[0].id,modifier:def.modifiers[0].id,secondSkillId:'none',target:'mixed'};}
  const def=getSkill(labConfig.skillId),activeRun=['playing','paused','choice'].includes(game.phase)&&game.mode!=='training';
  $('panel-content').innerHTML=`<div class="eyebrow">RULE LAB / PRACTICE THE INPUT</div><h2>삭제 규칙 실험실</h2><p>기본 스킬부터 Final까지 바로 연습하세요. 고정된 표적은 6초마다 보충되며, 무결성 손상·성장 선택·MEMORY 정산은 없습니다. 쿨다운과 피해 판정은 전투 규칙을 따릅니다.</p><div class="lab-skill-grid">${SKILLS.map(s=>`<button data-lab-skill="${s.id}" aria-pressed="${s.id===def.id}" style="border-color:${s.id===def.id?s.color:'#253145'}">${s.icon} ${s.name}</button>`).join('')}</div><div class="lab-select-grid"><label>진화 단계<select id="lab-evolution">${['BASE','EVOLUTION I','EVOLUTION II','FINAL'].map((label,i)=>`<option value="${i}" ${labConfig.evolution===i?'selected':''}>${label}</option>`).join('')}</select></label><label>분기<select id="lab-branch">${def.branches.map(b=>`<option value="${b.id}" ${labConfig.branch===b.id?'selected':''}>${b.name}</option>`).join('')}</select></label><label>특수 변형<select id="lab-modifier">${def.modifiers.map(b=>`<option value="${b.id}" ${labConfig.modifier===b.id?'selected':''}>${b.name}</option>`).join('')}</select></label><label>보조 스킬 / Q<select id="lab-second"><option value="none">없음</option>${SKILLS.filter(s=>s.id!==def.id).map(s=>`<option value="${s.id}" ${labConfig.secondSkillId===s.id?'selected':''}>${s.name} · EV II 이하</option>`).join('')}</select></label><label>표적 배치<select id="lab-target"><option value="mixed" ${labConfig.target==='mixed'?'selected':''}>8개 적 역할</option><option value="boss" ${labConfig.target==='boss'?'selected':''}>이동 저항 보스 + 소형 표적</option></select></label></div><div class="lab-description"><strong style="color:${def.color}">${def.name}${labConfig.evolution===3?` / ${def.evolutionNames[2]}`:''}</strong><p>${escape(skillDescription({id:def.id,...labConfig}))}</p><small>전도: E → 직접 삭제 → E로 경로 닫기<br>Final 폭탄: 직접 삭제 기록을 남긴 뒤 E 0.5초 홀드<br>Final 홀: E로 A 설치 → 1.2초 안 E로 B 지정<br>절단: E 홀드·커서 이동·놓기 / Final은 다시 E로 기점 이동<br>Final 포격: T로 십자망 / 감염: 호스트 직접 기폭 후 0.5초 안 커서 방향</small></div><button id="lab-launch" class="primary">${activeRun?'현재 런 정산 후 연습':'이 규칙으로 연습'} ↗</button>`;
  $('panel-content').querySelectorAll('[data-lab-skill]').forEach(button=>button.onclick=()=>{const d=getSkill(button.dataset.labSkill);labConfig={...labConfig,skillId:d.id,branch:d.branches[0].id,modifier:d.modifiers[0].id,secondSkillId:labConfig.secondSkillId===d.id?'none':labConfig.secondSkillId};renderLab();});
  for(const [id,key] of [['lab-evolution','evolution'],['lab-branch','branch'],['lab-modifier','modifier'],['lab-second','secondSkillId'],['lab-target','target']])$(id).onchange=e=>{labConfig[key]=key==='evolution'?Number(e.target.value):e.target.value;renderLab();};
  $('lab-launch').onclick=()=>{if(activeRun)game.end(false,'규칙 실험실로 이동하며 런을 정산했습니다.');$('panel').close();resumeAfterPanel=false;game.startTraining({...labConfig});};
}
let pointerHistory=[];
canvas.addEventListener('pointermove',e=>{const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)/rect.width*1280,y=(e.clientY-rect.top)/rect.height*760;const now=performance.now();pointerHistory.push({x,y,now});pointerHistory=pointerHistory.filter(p=>now-p.now<250);const first=pointerHistory[0]||{x,y};game.cursor.dx=x-first.x;game.cursor.dy=y-first.y;game.cursor.angle=Math.atan2(game.cursor.dy,game.cursor.dx);game.cursor.x=clamp(x,0,1280);game.cursor.y=clamp(y,0,760);});
canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;e.preventDefault();audio.unlock();canvas.setPointerCapture?.(e.pointerId);const rect=canvas.getBoundingClientRect();game.cursor.x=clamp((e.clientX-rect.left)/rect.width*1280,0,1280);game.cursor.y=clamp((e.clientY-rect.top)/rect.height*760,0,760);game.beginDirect();});
window.addEventListener('pointerup',()=>game.endDirect());canvas.addEventListener('contextmenu',e=>e.preventDefault());
for(let i=0;i<2;i++){$(`skill-card-${i}`).addEventListener('pointerdown',e=>{if(e.button!==0||game.phase!=='playing')return;e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);audio.unlock();game.skills.press(i);});$(`skill-card-${i}`).addEventListener('pointerup',()=>game.skills.release(i));$(`skill-card-${i}`).addEventListener('pointercancel',()=>game.skills.cancelInput());}
document.addEventListener('keydown',e=>{
  if(rebind){e.preventDefault();if(e.code==='Escape'){rebind=null;bindingError='';renderPanel('settings');return;}if(!/^(Key[A-Z]|Digit[0-9]|Numpad[0-9]|Space|Arrow(Up|Down|Left|Right)|F([1-9]|1[0-2]))$/.test(e.code)){bindingError='문자·숫자·방향키·SPACE·F1–F12 중에서 선택하세요.';renderPanel('settings');return;}if(Object.entries(keys).some(([id,key])=>id!==rebind&&key===e.code)){bindingError='이미 지정된 키입니다. 다른 키를 누르세요.';renderPanel('settings');return;}keys[rebind]=e.code;rebind=null;bindingError='';persist();renderPanel('settings');renderSkillCards();return;}
  if($('panel').open||['INPUT','TEXTAREA'].includes(e.target.tagName))return;
  if(e.repeat)return;
  if(e.code===keys.pause||e.code==='Escape'){if(['playing','paused'].includes(game.phase)){e.preventDefault();game.pause();}else if(game.phase==='menu'&&!$('setup-menu').classList.contains('hidden')){e.preventDefault();returnMenu();}return;}
  if(game.phase==='choice'&&/^(Digit|Numpad)[1-4]$/.test(e.code)){e.preventDefault();game.choose(game.choices[Number(e.code.at(-1))-1]?.id);return;}
  if(game.phase!=='playing')return;audio.unlock();const i=e.code===keys.skill0?0:e.code===keys.skill1?1:-1;if(i>=0){e.preventDefault();game.skills.press(i);}if(e.code===keys.network){e.preventDefault();game.skills.crossNetwork();}
});
document.addEventListener('keyup',e=>{if(game.phase!=='playing')return;const i=e.code===keys.skill0?0:e.code===keys.skill1?1:-1;if(i>=0)game.skills.release(i);});
window.addEventListener('blur',()=>{if(game.phase==='playing')game.pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.phase==='playing')game.pause();});
$('fullscreen-button').onclick=()=>{if(!document.fullscreenElement)$('game-view').requestFullscreen?.();else document.exitFullscreen?.();};
let previousButtons=[],gamepadChoice=0,gamepadCooldown=0;
function gamepadInput(dt){const pad=navigator.getGamepads?.()[0];if(!pad)return;const pressed=i=>pad.buttons[i]?.pressed&&!previousButtons[i];const released=i=>!pad.buttons[i]?.pressed&&previousButtons[i];if(pressed(9)&&!$('panel').open)game.pause();if(game.phase==='playing'&&!$('panel').open){const dx=pad.axes[2]||pad.axes[0]||0,dy=pad.axes[3]||pad.axes[1]||0;if(Math.hypot(dx,dy)>.18){game.cursor.dx=dx*100;game.cursor.dy=dy*100;game.cursor.x=clamp(game.cursor.x+dx*480*dt,0,1280);game.cursor.y=clamp(game.cursor.y+dy*480*dt,0,760);}if(pressed(0))game.beginDirect();if(released(0))game.endDirect();for(const [b,s] of [[2,0],[3,1]]){if(pressed(b))game.skills.press(s);if(released(b))game.skills.release(s);}if(pressed(1))game.skills.crossNetwork();}else if(game.phase==='choice'&&!$('panel').open){gamepadCooldown-=dt;const dx=pad.axes[0]||0;if(Math.abs(dx)>.5&&gamepadCooldown<=0){gamepadChoice=(gamepadChoice+(dx>0?1:-1)+game.choices.length)%game.choices.length;$('overlay').querySelectorAll('[data-choice]')[gamepadChoice]?.focus();gamepadCooldown=.22;}if(pressed(0))game.choose(game.choices[gamepadChoice]?.id);}previousButtons=pad.buttons.map(b=>b.pressed);}
function resizeCanvas(){const rect=canvas.getBoundingClientRect();if(!rect.width)return;const dpr=Math.min(2,devicePixelRatio||1);canvas.width=Math.round(rect.width*dpr);canvas.height=Math.round(rect.height*dpr);}
new ResizeObserver(resizeCanvas).observe(canvas);window.addEventListener('resize',resizeCanvas);
let previous=performance.now(),hudClock=0;
function frame(now){const dt=Math.min(.05,(now-previous)/1000);previous=now;gamepadInput(dt);game.update(dt);renderer.draw(game,dt);hudClock+=dt;if(hudClock>.08&&game.phase!=='menu'){renderHUD();hudClock=0;}if(now>toastUntil)$('toast').classList.remove('visible');requestAnimationFrame(frame);}
canvas.tabIndex=-1;applyUISettings();renderMenu();requestAnimationFrame(frame);
