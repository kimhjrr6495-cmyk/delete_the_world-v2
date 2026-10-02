import { Game } from './engine.js';
import { Renderer } from './render.js';
import { AudioBus } from './audio.js';
import { TAGS, CORES, SKILLS, METHODS, HYBRIDS, RELICS, getSkill, skillDescription } from './data.js';
import { readSave, writeSave, settleRun } from './storage.js';
import { clamp, formatTime } from './util.js';
import { skillName, tagName, cardName, ruleName, branchName, modifierName, coreSummary, coreBonus, choiceSummary, evolutionName, guidePages, displayText, enemyName } from './ui-text.js';

const $=id=>document.getElementById(id),escape=text=>String(text??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let storage;try{storage=localStorage;}catch{}
let save=readSave(storage),selected='overcharge',mode='standard',toastUntil=0,resumeAfterPanel=false,panelType=null,rebind=null,labConfig=null,bindingError='';
let cooldownTrack=[{id:null,last:0,total:0},{id:null,last:0,total:0}];
let guidePage='basics';
const defaults={skill0:'KeyE',skill1:'KeyQ',network:'KeyT',pause:'Escape'};let keys={...defaults,...save.settings.keys};
const game=new Game({settings:{...save.settings,reducedMotion:save.settings.reducedMotion||matchMedia('(prefers-reduced-motion: reduce)').matches},research:save.research,onEvent:event,onSound:name=>audio?.play(name)});
const audio=new AudioBus(game.settings),canvas=$('arena'),renderer=new Renderer(canvas);
window.__DTW__={game,version:'2.0.0'};

function applyUISettings(){document.body.classList.toggle('reduced-motion',!!game.settings.reducedMotion);document.body.classList.toggle('high-contrast',!!game.settings.highContrast);}
function persist(){save.settings={...game.settings,keys};save.research={...game.research};applyUISettings();const success=writeSave(storage,save);$('memory-chip').textContent=`${save.memory} M`;return success;}
function event(type,payload){
  if(type==='toast'){$('toast').textContent=noticeText(payload);toastUntil=performance.now()+3000;$('toast').classList.add('visible');}
  if(type==='start'){document.body.classList.remove('menu-state');$('menu').classList.add('hidden');$('game-view').classList.remove('hidden');hideOverlay();cooldownTrack=[{id:null,last:0,total:0},{id:null,last:0,total:0}];$('run-seed').textContent=`SEED / ${game.seed}`;renderSkillCards();renderHUD();canvas.tabIndex=0;canvas.focus({preventScroll:true});}
  if(type==='training'){renderSkillCards();renderHUD();$('run-seed').textContent='RULE LAB / NO REWARDS';}
  if(type==='choices')renderChoices();
  if(type==='choice'){hideOverlay();renderSkillCards();}
  if(type==='pause')renderPause();
  if(type==='resume')hideOverlay();
  if(type==='end'){if(payload.mode==='training'){returnMenu();return;}const settled=settleRun(save,payload);save=settled.save;payload.memory=settled.awarded;payload.saved=persist();renderResult(payload);}
}
function renderMenu(){
  $('core-grid').innerHTML=CORES.map(c=>{const skill=getSkill(c.skillId);return `<button class="core-card ${selected===c.skillId?'selected':''}" style="--core-color:${c.color}" data-skill="${c.skillId}" aria-label="${skillName(c.skillId)} 선택 후 시작"><span class="core-tag">${keyLabel(keys.skill0)} · ${tagName(skill.tag)}</span><h3>${skillName(c.skillId)}</h3><p>${escape(coreSummary(c.skillId))}</p><small class="core-cooldown">재사용 ${skill.cooldown}초</small><span class="core-bonus">${escape(coreBonus(c.skillId))}</span></button>`;}).join('');
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
const KIND={skill:'새 스킬',branch:'분기',modifier:'변형',evolution:'진화',method:'특성',hybrid:'조합',relic:'유물',stat:'강화',route:'도전',reserve:'보관','tag-final':'최종 특성'};
const CONTEXT={level:['성장 선택','한 장을 고르세요.'], 'second-skill':['두 번째 스킬','추가할 스킬을 고르세요.'],evolution:['스킬 진화','강화할 스킬을 고르세요.'],relic:['유물 선택','최대 2개까지 장착합니다.'],hybrid:['조합 선택','두 공격을 연결합니다.'],route:['도전 선택','위험과 보상을 고르세요.']};
function cardStyle(card){if(['evolution','tag-final'].includes(card.kind))return 'VOID evolutionCard skillUpgradeDrop';if(card.kind==='skill')return 'SKILL';if(['hybrid','relic'].includes(card.kind))return 'EPIC';if(['branch','modifier','method'].includes(card.kind))return 'RARE';return 'COMMON';}
function renderChoices(){
  gamepadChoice=0;
  const context=CONTEXT[game.choiceContext]||CONTEXT.level;
  hideOverlay();$('overlay').classList.add('choice-mode');
  $('overlay').innerHTML=`<div class="overlay-shell"><h2 id="overlay-title">${context[0]}</h2><p class="subtitle">${context[1]} <span class="card-badge">전투 정지</span></p><div class="source-line">${game.choiceContext==='level'?`레벨 ${game.level}`:''}</div><div class="choice-grid" style="--choice-count:${Math.min(3,game.choices.length)}">${game.choices.map((c,i)=>`<article class="choice-option"><button class="choice-card ${cardStyle(c)}" style="--card-color:${TAGS[c.tag]?.color||'#b08cff'}" data-choice="${escape(c.id)}"><span class="choice-number">${i+1}</span><span class="choice-type">${KIND[c.kind]||'강화'}</span><strong>${escape(cardName(c))}</strong><p>${escape(choiceSummary(c))}</p>${Number.isInteger(c.replaceIndex)?`<p class="replacement-target">교체: ${escape(ruleName(game.relics[c.replaceIndex]))}</p>`:''}<span class="choice-badges"><span class="card-badge">${tagName(c.tag)}</span>${c.freePrerequisite?'<span class="card-badge">코어 무료 준비</span>':''}</span></button><details class="card-details"><summary>상세 보기</summary><p>${escape(displayText(c.description))}</p><small>${escape(displayText(c.detail))}</small></details></article>`).join('')}</div><div class="choice-actions"><span>1 / 2 / 3 선택</span>${game.choiceContext==='level'?`<button id="reroll" ${game.rewrite<1||game.choiceAdjusted?'disabled':''}>새로 뽑기 · ${game.rewrite}회</button><button id="ban-choice" ${game.rewrite<1||game.choiceAdjusted||game.bans.size>=2?'disabled':''}>카드 제외</button>`:''}</div></div>`;
  $('overlay').classList.remove('hidden');$('overlay').querySelectorAll('[data-choice]').forEach(b=>b.onclick=()=>game.choose(b.dataset.choice));
  if($('reroll')){$('reroll').disabled ||= game.choices.every(c=>['branch','modifier'].includes(c.kind));$('reroll').onclick=()=>game.reroll();}
  const banButton=$('ban-choice');
  if(banButton){
    let banTarget=null;
    const focusBanTarget=id=>{const card=game.choices.find(c=>c.id===id);banTarget=card&&['stat','method'].includes(card.kind)?card.id:null;banButton.disabled=!banTarget||game.rewrite<1||game.choiceAdjusted||game.bans.size>=2;banButton.textContent=banTarget?`${cardName(card)} 제외 · 1회`:'제외 불가';};
    $('overlay').querySelectorAll('[data-choice]').forEach(b=>{b.onfocus=()=>focusBanTarget(b.dataset.choice);b.onpointerenter=()=>focusBanTarget(b.dataset.choice);});
    banButton.onclick=()=>{if(banTarget)game.ban(banTarget);};
  }
  $('overlay').querySelector('[data-choice]')?.focus({preventScroll:true});renderHUD();
}
function renderSkillCards(){
  for(let i=0;i<2;i++){
    const s=game.skillSlots[i],node=$(`skill-card-${i}`),key=keyLabel(keys[`skill${i}`]);node.style.setProperty('--skill-color','#b08cff');
    if(!s){node.classList.add('empty');node.classList.remove('ready');node.removeAttribute('title');node.innerHTML=`<span class="command-key">${key}</span><div class="skill-info"><strong>미획득</strong><small>${game.mode==='training'?'연습에서 선택':`${formatTime(210/(game.pace||1))} 해금`}</small></div>`;continue;}
    node.classList.remove('empty');node.title=displayText(skillDescription(s));node.innerHTML=`<span class="command-key">${key}</span><div class="skill-info"><strong>${skillName(s.id)}</strong><small>${evolutionName(s.evolution)}</small><div class="meter"><i id="skill-fill-${i}"></i></div></div><span id="skill-cd-${i}" class="cooldown-value hidden"></span>`;
  }
}
function renderHUD(){
  const integrity=clamp(game.integrity/game.maxIntegrity*100,0,100);
  $('integrity-value').textContent=`${Math.ceil(integrity)}%`;$('integrity-fill').style.width=`${integrity}%`;$('integrity-fill').style.background=game.integrity<30?'#ff526d':'#e8e8ff';
  $('stability-value').textContent=`${Math.ceil(integrity)}%`;$('stability-fill').style.width=`${integrity}%`;
  $('pressure-value').textContent=game.pressure.toFixed(1);$('time-value').textContent=formatTime(game.time);$('level-value').textContent=`LV. ${game.level}`;$('xp-fill').style.width=`${clamp(game.xp/game.nextLevel*100,0,100)}%`;$('xp-value').textContent=`${Math.floor(game.xp)} / ${Math.ceil(game.nextLevel)}`;
  const tier=[...game.eventsDone].filter(id=>/^adapt-\d+$/.test(id)).length;
  $('stage-tier').textContent=`단계 ${tier}`;$('adaptation-value').textContent=`${game.adaptations.length} / 2`;$('adaptation-fill').style.width=`${game.adaptations.length*50}%`;
  $('stage-value').textContent=game.worldTime<210?'고정점을 지키며 첫 경로를 만드세요':game.worldTime<480?'서로 다른 두 삭제 경로를 연결하세요':game.worldTime<780?'세계의 봉합과 노출 균열':game.worldTime<1080?'최종 규칙을 완성하세요':'REALITY ENGINE / 최종 봉합';
  if(game.mode==='training'){$('stage-value').textContent='연습';$('level-value').textContent='연습';$('xp-value').textContent='보상 없음';}
  $('enemy-value').textContent=`${game.enemies.length} CELLS`;$('kills-value').textContent=game.kills.toLocaleString();$('rewrite-value').textContent=game.rewrite;$('heat-value').textContent=Math.floor(game.heat);$('heat-value').style.color=game.heat>=80?'#ffe66d':'#ff8094';$('heat-fill').style.width=`${clamp(game.heat,0,100)}%`;
  $('build-value').textContent=Object.entries(game.tags).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,2).map(([k,v])=>`${tagName(k)} ${v}`).join(' / ');
  const networkAvailable=game.skillSlots.some(s=>s.id==='orbital'&&s.evolution===3);
  const networkReady=game.network>=50&&(game.skills.networkCooldown||0)<=0&&!game.fields.some(f=>f.type==='network');
  $('network-label').classList.toggle('hidden',!networkAvailable);$('network-label').classList.toggle('ready',networkReady);$('network-value').textContent=`${Math.floor(game.network)}%${networkReady?` · ${keyLabel(keys.network)} 사용 가능`:game.skills.networkCooldown>0?` · ${Math.ceil(game.skills.networkCooldown)}초`:''}`;$('network-fill').style.width=`${clamp(game.network,0,100)}%`;
  for(let i=0;i<2;i++){
    $(`charge-${i}`).classList.toggle('empty',game.charges<=i);
    const s=game.skillSlots[i];if(!s||!$(`skill-cd-${i}`))continue;
    const cd=Math.max(0,s.cd),track=cooldownTrack[i];
    if(track.id!==s.id||cd>track.last+.05){track.id=s.id;track.total=cd;}
    track.last=cd;$(`skill-cd-${i}`).textContent=cd.toFixed(1);$(`skill-cd-${i}`).classList.toggle('hidden',cd<=.1);$(`skill-card-${i}`).classList.toggle('ready',cd<=.1);
    $(`skill-fill-${i}`).style.width=`${(1-clamp(cd/Math.max(.001,track.total),0,1))*100}%`;
    if(cd<=.1)track.total=0;
  }
  const recovery=game.chargeLock>0?`정지 ${game.chargeLock.toFixed(1)}초`:`${Math.max(0,(2.8-game.chargeTimer)/game.stats.chargeRate).toFixed(1)}초`;
  $('charge-text').textContent=`${game.charges} / 2${game.charges<2?` · ${recovery}`:''}`;
  const preview=game.adaptationPreview;$('adaptation-rail').classList.toggle('hidden',!preview&&!game.adaptations.length);$('adaptation-text').textContent=preview?`${Math.ceil((preview.at-game.worldTime)/game.pace)}초 뒤 ${tagName(preview.tag)} 저항 · ${tagName(preview.weakness)} 약점`:game.adaptations.map(a=>`${tagName(a.tag)} −25% / ${tagName(a.weakness)} +30%`).join(' · ');
  $('boss-hud').classList.toggle('hidden',!game.boss);if(game.boss){$('boss-name').textContent=enemyName(game.boss.type);$('boss-fill').style.width=`${game.boss.hp/game.boss.maxHp*100}%`;$('boss-state').textContent=game.boss.vulnerable>0?'약점 열림 · 클릭으로 중단':`다음 공격 ${Math.ceil(game.boss.aiTimer)}초`;}
  const finalIn=(1080-game.worldTime)/(game.pace||1),approaching=game.mode!=='training'&&game.phase!=='ended'&&!game.eventsDone.has('final')&&finalIn>0&&finalIn<=30;
  $('boss-countdown').classList.toggle('hidden',!approaching);$('boss-countdown-time').textContent=Math.ceil(finalIn);
}
function runRow(label,value){return `<div class="run-item"><span>${escape(label)}</span><b>${escape(value)}</b></div>`;}
function signedPercent(value){return `${value>=0?'+':''}${Math.round(value*100)}%`;}
function noticeText(text){
  if(text.startsWith('현실 고정점 3개'))return '고정점 3개를 지키세요.';
  if(text.startsWith('규칙 실험실'))return '연습 중 · 기록과 보상 없음';
  if(text.startsWith('진화 코어 확보'))return '진화 코어 획득';
  if(text.startsWith('세계 관찰:'))return '곧 저항이 생깁니다. 세계 구역을 확인하세요.';
  return displayText(text);
}
function buildMarkup(){
  const recent=game.damageLog.filter(hit=>game.time-hit.time<=30).reduce((totals,hit)=>{totals[hit.tag]=(totals[hit.tag]||0)+hit.damage;return totals;},{});
  const recentTotal=Object.values(recent).reduce((a,b)=>a+b,0)||1,total=Object.values(game.damageStats).reduce((a,b)=>a+b,0);
  const analysis=Object.entries(game.tags).map(([tag,points])=>`${runRow(tagName(tag),`${points}점`)}<div class="damage-mini"><i style="width:${Math.min(100,points*10)}%;background:${TAGS[tag].color}"></i></div>`).join('');
  const damage=Object.entries(recent).sort((a,b)=>b[1]-a[1]).map(([tag,n])=>`${runRow(tagName(tag),`${Math.round(n/recentTotal*100)}%`)}<div class="damage-mini"><i style="width:${n/recentTotal*100}%;background:${TAGS[tag]?.color||'#b08cff'}"></i></div>`).join('');
  const skills=[0,1].map(i=>{const s=game.skillSlots[i];return s?`<div class="run-description"><b>[${keyLabel(keys[`skill${i}`])}] ${skillName(s.id)} · ${evolutionName(s.evolution)}</b><p>${escape(coreSummary(s.id))}</p><div class="choice-badges">${s.branch?`<span class="card-badge">${branchName(s.branch)}</span>`:''}${s.modifier?`<span class="card-badge">${modifierName(s.modifier)}</span>`:''}</div><small>적중 시전 ${s.uses}회 · 재사용 ${Math.max(0,s.cd).toFixed(1)}초</small><details class="run-details"><summary>스킬 상세</summary><p>${escape(displayText(skillDescription(s)))}</p></details></div>`:`<div class="empty-note">${keyLabel(keys[`skill${i}`])} · 미획득</div>`;}).join('');
  const methods=[...game.methods].map(id=>{const method=METHODS.find(c=>c.id===id);return `<details class="run-details"><summary>${escape(ruleName(id))}</summary><p>${escape(displayText(method?.description||'최종 특성'))}</p></details>`;}).join('')||'<div class="empty-note">아직 없습니다.</div>';
  const hybrid=HYBRIDS.find(c=>c.id===game.hybrid);
  const relics=game.relics.map(id=>{const relic=RELICS.find(c=>c.id===id);return `<details class="run-details"><summary>${escape(ruleName(id))}</summary><p>${escape(displayText(relic?.description||''))}</p></details>`;}).join('');
  return `<div class="run-grid"><section class="run-box"><h3>스킬</h3>${skills}<details class="run-details"><summary>속성과 최근 피해</summary><h3>속성 점수</h3>${analysis}<h3>피해 비중 · 최근 30초</h3>${damage||'<p>피해 기록 없음</p>'}</details></section><section class="run-box"><h3>특성</h3>${methods}<h3>조합</h3>${hybrid?`<details class="run-details"><summary>${escape(ruleName(hybrid.id))}</summary><p>${escape(displayText(hybrid.description))}</p></details>`:'<div class="empty-note">아직 없습니다.</div>'}<h3>유물 · ${game.relics.length} / 2</h3>${relics||'<div class="empty-note">아직 없습니다.</div>'}</section><section class="run-box"><h3>현재 상태</h3>${runRow('안정도',`${Math.ceil(game.integrity/game.maxIntegrity*100)}%`)}${runRow('공격력',`×${game.stats.power.toFixed(2)}`)}${runRow('치명타',`${Math.round(Math.min(.6,game.stats.critChance)*100)}%`)}${runRow('재사용 감소',`${Math.round(clamp(game.stats.cdr,0,.4)*100)}%`)}${runRow('다시 뽑기',`${game.rewrite}회`)}<h3>세계 저항</h3>${game.adaptations.map(a=>runRow(tagName(a.tag),`−25% / ${tagName(a.weakness)} +30%`)).join('')||'<div class="empty-note">저항 없음</div>'}<details class="run-details"><summary>세부 능력과 기록</summary>${runRow('클릭 보너스',signedPercent(game.stats.directBonus))}${runRow('스킬 보너스',signedPercent(game.stats.skillBonus))}${runRow('치명타 피해',`${Math.round(game.stats.critDamage*100)}%`)}${runRow('클릭 범위',`${36+game.stats.radiusBonus} / ${48+game.stats.radiusBonus}px`)}${runRow('삭제 수',game.kills.toLocaleString())}${runRow('총 피해',Math.round(total).toLocaleString())}${runRow('초당 피해',Math.round(total/Math.max(1,game.time)).toLocaleString())}${runRow('공격 중단',`${game.metrics.interrupts}회`)}${runRow('약점 적중',`${game.metrics.weaknessHits}회`)}${runRow('시간',formatTime(game.time))}${runRow('시드',game.seed)}</details></section></div>`;
}
function renderPause(){
  hideOverlay();$('overlay').classList.add('pause-mode');
  $('overlay').innerHTML=`<div class="overlay-shell run-data-panel"><div class="eyebrow">전투 정지</div><h2 id="overlay-title">일시정지</h2>${buildMarkup()}<div class="pause-top"><button id="resume-button">계속 · ${keyLabel(keys.pause)}</button><button id="pause-guide">게임 가이드</button><button id="pause-settings">설정</button><button id="abandon-button">이번 판 종료</button></div></div>`;$('overlay').classList.remove('hidden');$('resume-button').onclick=()=>game.pause();$('pause-guide').onclick=()=>openPanel('guide');$('pause-settings').onclick=()=>openPanel('settings');$('abandon-button').onclick=()=>game.end(false,'이번 판을 종료했습니다.');$('resume-button').focus({preventScroll:true});
  if(game.mode==='training'){$('abandon-button').textContent='연습 종료';const button=document.createElement('button');button.textContent='대상·쿨다운 재설정';button.onclick=()=>game.startTraining({...game.practiceConfig});$('overlay').querySelector('.pause-top').append(button);}
}
function renderResult(result){
  const total=Object.values(result.damage).reduce((a,b)=>a+b,0)||1;
  hideOverlay();$('overlay').classList.add('result-mode');
  $('overlay').innerHTML=`<div class="overlay-shell result-panel"><h2 id="overlay-title">${result.won?'삭제 완료':'삭제 실패'}</h2><p class="subtitle">${escape(displayText(result.cause))}</p><div class="result-stats"><div class="result-stat"><small>삭제 수</small><strong>${result.kills.toLocaleString()}</strong></div><div class="result-stat"><small>플레이 시간</small><strong>${formatTime(result.duration)}</strong></div><div class="result-stat"><small>점수</small><strong>${result.score.toLocaleString()}</strong></div><div class="result-stat"><small>획득 기억</small><strong>+${result.memory}</strong></div></div><details class="result-analysis"><summary>이번 판 상세</summary><div class="result-detail"><div class="build-section"><h3>피해 비중</h3>${Object.entries(result.damage).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([tag,n])=>`<div class="damage-row"><span style="color:${TAGS[tag].color}">${tagName(tag)}</span><div class="meter"><i style="width:${n/total*100}%;background:${TAGS[tag].color}"></i></div><span>${Math.round(n/total*100)}%</span></div>`).join('')}</div><div class="build-section"><h3>스킬과 기록</h3><p>공격 중단 ${result.metrics.interrupts}회 · 약점 적중 ${result.metrics.weaknessHits}회<br>레벨 ${result.level} · 남은 안정도 ${result.integrity}</p><p>${result.skills.map(s=>`${skillName(s.id)} · ${evolutionName(s.evolution)}`).join('<br>')}</p></div></div></details>${result.saved?'':'<p class="save-warning">저장 공간을 사용할 수 없어 이번 기록이 저장되지 않았습니다.</p>'}<div class="result-buttons"><button id="retry-button">다시 시작</button><button id="entropy-result">연구</button><button id="same-seed-button">같은 시드</button><button id="return-menu">메인 화면</button></div></div>`;
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
  if(type==='guide')renderGuide();
  if(type==='settings'){
    $('panel-content').innerHTML=`<h2>설정</h2>${[['sound','효과음','공격과 경고 소리'],['reducedMotion','움직임 줄이기','흔들림과 반복 장식 감소'],['lowEffects','효과 줄이기','장식 감소 · 공격 경고 유지'],['highContrast','고대비','중요한 윤곽 강조']].map(([id,title,desc])=>`<label class="settings-row"><span>${title}<small>${desc}</small></span><input type="checkbox" data-setting="${id}" ${game.settings[id]?'checked':''}></label>`).join('')}<label class="settings-row"><span>효과음 크기</span><input id="volume" type="range" min="0" max="1" step=".05" value="${game.settings.volume??.5}" aria-label="효과음 크기"></label><h3>조작 키</h3><p class="save-warning" role="alert">${escape(bindingError)}</p>${[['skill0','첫 스킬'],['skill1','두 번째 스킬'],['network','십자망'],['pause','일시정지']].map(([id,title])=>`<div class="settings-row"><span>${title}</span><button data-rebind="${id}">${rebind===id?'새 키 입력':keyLabel(keys[id])}</button></div>`).join('')}<p>ESC: 일시정지 / 키 변경 취소. 같은 키는 중복 지정할 수 없습니다.</p>`;
    $('panel-content').querySelectorAll('[data-setting]').forEach(input=>input.onchange=()=>{game.settings[input.dataset.setting]=input.checked;persist();if(input.dataset.setting==='sound'){audio.unlock();audio.play('arm');}});$('volume').oninput=e=>{game.settings.volume=Number(e.target.value);persist();};$('panel-content').querySelectorAll('[data-rebind]').forEach(b=>b.onclick=()=>{rebind=b.dataset.rebind;bindingError='';renderPanel('settings');});
  }
  if(type==='archive'){
    const discovered=new Set(save.discoveries);
    $('panel-content').innerHTML=`<div class="entropy-panel"><h2>연구</h2><p class="entropy-count">보유 기억 <b>${save.memory}</b></p><div class="research-grid">${[['recovery','충전 회복','연구 단계당 클릭 회복 +2%'],['insight','시작 경험치','연구 단계당 경험치 +4']].map(([id,title,desc])=>{const lv=save.research[id]||0,price=5+lv*3;return `<button data-research="${id}" ${lv>=5||save.memory<price?'disabled':''}><strong>${title}</strong><small>${desc}</small><span>${lv} / 5 · ${lv>=5?'완료':`기억 ${price} 필요`}</span></button>`;}).join('')}</div><details class="archive-details"><summary>지난 기록 · ${save.runs}판 / ${save.wins}승</summary><h3>최고 점수 · ${save.best.toLocaleString()}</h3>${save.history.length?save.history.map(r=>`<div class="history-row"><span>${r.won?'성공':'실패'}</span><span>시드 ${r.seed} · ${r.kills} 삭제</span><span>${formatTime(r.duration)}</span><span>기억 +${r.memory}</span></div>`).join(''):'<div class="empty-note">첫 플레이 후 기록됩니다.</div>'}<h3>발견 목록 · ${discovered.size}</h3><div class="codex-grid">${[...METHODS,...HYBRIDS,...RELICS].map(c=>`<details class="codex-item ${discovered.has(c.id)?'':'locked'}"><summary>${escape(ruleName(c.id))}</summary><p>${discovered.has(c.id)?escape(displayText(c.description)):'조건을 채우면 발견합니다.'}</p></details>`).join('')}</div></details><button id="entropy-back">뒤로</button></div>`;
    $('entropy-back').onclick=closePanel;
    $('panel-content').querySelectorAll('[data-research]').forEach(b=>b.onclick=()=>{const id=b.dataset.research,lv=save.research[id]||0,price=5+lv*3;if(lv>=5||save.memory<price)return;save.memory-=price;save.research[id]=lv+1;game.research={...save.research};persist();renderPanel('archive');});
  }
}
function renderGuide(){
  const pages=guidePages({skill0:keyLabel(keys.skill0),skill1:keyLabel(keys.skill1),network:keyLabel(keys.network),pause:keyLabel(keys.pause),quick:mode==='expedition'});
  const page=pages.find(p=>p.id===guidePage)||pages[0],index=pages.indexOf(page);guidePage=page.id;
  $('panel-content').innerHTML=`<div class="guide-panel"><h2>게임 가이드</h2><nav class="guide-tabs" role="tablist" aria-label="가이드 분류">${pages.map(p=>`<button id="guide-tab-${p.id}" role="tab" aria-selected="${p.id===page.id}" aria-controls="guide-page" tabindex="${p.id===page.id?0:-1}" data-guide="${p.id}">${p.title}</button>`).join('')}</nav><section id="guide-page" class="guide-page" role="tabpanel" aria-labelledby="guide-tab-${page.id}" tabindex="0"><p class="guide-lead">${escape(page.lead)}</p>${page.id==='basics'?`<details class="guide-map-details"><summary>화면 구역 보기</summary><div class="guide-map" aria-label="화면 배치: 위 상태, 왼쪽 세계, 가운데 전장, 아래 공격"><div class="map-status">상태 · 시간 / 레벨 / 안정도</div><div class="map-world">세계<br><small>위협·저항</small></div><div class="map-field">전장<br><small>고정점 3개 보호</small></div><div class="map-attack">공격 · 클릭 / ${keyLabel(keys.skill0)} / ${keyLabel(keys.skill1)}</div></div></details>`:''}${page.steps?.length?`<ol class="guide-steps">${page.steps.map(s=>`<li><strong>${escape(s.title)}</strong><p>${escape(s.text)}</p></li>`).join('')}</ol>`:''}<div class="guide-cards">${(page.cards||[]).map(c=>`<article class="guide-card"><h3>${escape(c.title)}</h3><p>${escape(c.text)}</p></article>`).join('')}</div>${page.note?`<p class="guide-note">${escape(page.note)}</p>`:''}${(page.details||[]).map(d=>`<details class="run-details"><summary>${escape(d.title)}</summary><p>${escape(d.text)}</p></details>`).join('')}</section><div class="guide-nav"><button id="guide-prev" ${index===0?'disabled':''}>이전</button><span>${index+1} / ${pages.length}</span><button id="guide-next" ${index===pages.length-1?'disabled':''}>다음</button><button id="guide-practice">연습해 보기</button></div></div>`;
  const selectPage=id=>{guidePage=id;renderGuide();$(`guide-tab-${id}`).focus({preventScroll:true});};
  $('panel-content').querySelectorAll('[data-guide]').forEach(button=>{button.onclick=()=>selectPage(button.dataset.guide);button.onkeydown=e=>{let target=index;if(e.key==='ArrowRight')target=(index+1)%pages.length;else if(e.key==='ArrowLeft')target=(index+pages.length-1)%pages.length;else if(e.key==='Home')target=0;else if(e.key==='End')target=pages.length-1;else return;e.preventDefault();selectPage(pages[target].id);};});
  $('guide-prev').onclick=()=>selectPage(pages[index-1].id);$('guide-next').onclick=()=>selectPage(pages[index+1].id);$('guide-practice').onclick=()=>{panelType='lab';renderPanel('lab');};
}
function renderLab(){
  if(!labConfig){const def=getSkill(selected);labConfig={skillId:selected,evolution:0,branch:def.branches[0].id,modifier:def.modifiers[0].id,secondSkillId:'none',target:'mixed'};}
  const def=getSkill(labConfig.skillId),activeRun=['playing','paused','choice'].includes(game.phase)&&game.mode!=='training';
  const inputTips={overcharge:`${keyLabel(keys.skill0)}로 준비 → 클릭으로 전도. 최종은 다시 스킬 키로 경로 지정.`,bomb:'탭하면 폭탄 설치. 최종은 직접 공격 기록 후 0.5초 홀드.',hole:'원하는 위치에 설치. 최종은 1.2초 안에 다시 눌러 두 번째 위치 지정.',cut:'누른 채 마우스로 방향을 그리고 놓으세요. 최종은 다시 눌러 이동.',orbital:`원하는 위치에 포격. 최종의 십자망은 ${keyLabel(keys.network)}.`,seed:'적을 가리켜 감염. 최종은 직접 기폭 후 0.5초 안에 방향 지정.'};
  $('panel-content').innerHTML=`<h2>스킬 연습</h2><p>표적을 공격하며 조작을 익히세요. 기록과 보상은 없습니다.</p><div class="lab-skill-grid">${SKILLS.map(s=>`<button data-lab-skill="${s.id}" aria-pressed="${s.id===def.id}" style="border-color:${s.id===def.id?s.color:'#44304f'}">${s.icon} ${skillName(s.id)}</button>`).join('')}</div><div class="lab-select-grid"><label>단계<select id="lab-evolution">${[0,1,2,3].map(i=>`<option value="${i}" ${labConfig.evolution===i?'selected':''}>${evolutionName(i)}</option>`).join('')}</select></label><label>분기<select id="lab-branch">${def.branches.map(b=>`<option value="${b.id}" ${labConfig.branch===b.id?'selected':''}>${branchName(b.id)}</option>`).join('')}</select></label><label>변형<select id="lab-modifier">${def.modifiers.map(b=>`<option value="${b.id}" ${labConfig.modifier===b.id?'selected':''}>${modifierName(b.id)}</option>`).join('')}</select></label><label>두 번째 스킬<select id="lab-second"><option value="none">없음</option>${SKILLS.filter(s=>s.id!==def.id).map(s=>`<option value="${s.id}" ${labConfig.secondSkillId===s.id?'selected':''}>${skillName(s.id)} · 최대 2진화</option>`).join('')}</select></label><label>표적<select id="lab-target"><option value="mixed" ${labConfig.target==='mixed'?'selected':''}>일반 적</option><option value="boss" ${labConfig.target==='boss'?'selected':''}>보스</option></select></label></div><div class="lab-description"><strong style="color:${def.color}">${skillName(def.id)} · ${evolutionName(labConfig.evolution)}</strong><p>${escape(inputTips[def.id])}</p><details class="run-details"><summary>스킬 상세</summary><p>${escape(displayText(skillDescription({id:def.id,...labConfig})))}</p></details></div><button id="lab-launch" class="primary">${activeRun?'이번 판 정산 후 연습':'연습 시작'}</button>`;
  $('panel-content').querySelectorAll('[data-lab-skill]').forEach(button=>button.onclick=()=>{const d=getSkill(button.dataset.labSkill);labConfig={...labConfig,skillId:d.id,branch:d.branches[0].id,modifier:d.modifiers[0].id,secondSkillId:labConfig.secondSkillId===d.id?'none':labConfig.secondSkillId};renderLab();});
  for(const [id,key] of [['lab-evolution','evolution'],['lab-branch','branch'],['lab-modifier','modifier'],['lab-second','secondSkillId'],['lab-target','target']])$(id).onchange=e=>{labConfig[key]=key==='evolution'?Number(e.target.value):e.target.value;renderLab();};
  $('lab-launch').onclick=()=>{if(activeRun)game.end(false,'연습으로 이동했습니다.');$('panel').close();panelType=null;resumeAfterPanel=false;game.startTraining({...labConfig});};
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
