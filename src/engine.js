import { SKILLS, CORES, ENEMIES, getSkill, makeChoices, applyChoice } from './data.js';
import { SkillSystem } from './skills.js';
import { clamp, dist, lineDistance, seededRandom, hashSeed, sourceTag, weightedPick } from './util.js';

const COLORS={CHAIN:'#5EE3FF',INFECTION:'#A6E857',SINGULARITY:'#A67CFF',SWARM:'#F2C15A',IMPACT:'#FF8C6B',CASTER:'#E8F0FF'};
const ALTERNATE={CHAIN:'IMPACT',INFECTION:'CHAIN',SINGULARITY:'IMPACT',SWARM:'IMPACT',IMPACT:'CASTER',CASTER:'CHAIN'};
const BOSS_NAMES={archivist:'THE ARCHIVIST · 기록 보관자',conductor:'THE CONDUCTOR · 봉합 지휘자',reality:'REALITY ENGINE · 현실 기관'};

export class Game {
  constructor(options={}) {
    this.width=1280; this.height=760;
    this.emit=options.onEvent||(()=>{}); this.audio=options.onSound||(()=>{});
    this.settings={sound:true,reducedMotion:false,lowEffects:false,highContrast:false,...options.settings};
    this.research=options.research||{}; this.runCounter=0; this.reset(1); this.phase='menu';
  }
  reset(seed) {
    this.seed=seed>>>0;this.rng=seededRandom(this.seed);this.time=0;this.elapsed=0;this.worldTime=0;
    this.integrity=100;this.maxIntegrity=100;this.pressure=0;this.xp=0;this.level=1;this.kills=0;
    this.cursor={x:640,y:350,down:false,hold:0,angle:0,dx:0,dy:0};
    this.enemies=[];this.fields=[];this.effects=[];this.dangers=[];this.jobs=[];this.roots=new Map();
    this.skillSlots=[];this.tags=Object.fromEntries(Object.keys(COLORS).map(t=>[t,0]));
    this.stats={power:1,directBonus:0,skillBonus:0,summonBonus:0,cdr:0,critChance:.05,critDamage:1.5,autoRate:1,chargeRate:1,radiusBonus:0};
    this.methods=new Set();this.owned=new Set();this.bans=new Set();this.relics=[];this.hybrid=null;this.tagFinal=null;this.hasFinal=false;this.cardRanks={};
    this.charges=2;this.chargeTimer=0;this.chargeLock=0;this.heat=0;this.network=0;this.heatIdle=0;
    this.metrics={chargedHits:0,casterPairs:0,weaknessHits:0,interrupts:0,skillsUsed:0};
    this.damageStats=Object.fromEntries(Object.keys(COLORS).map(t=>[t,0]));this.damageLog=[];this.adaptations=[];this.adaptationPreview=null;
    this.anchors=[{x:320,y:390,r:25,index:0,damageFlash:0},{x:640,y:545,r:25,index:1,damageFlash:0},{x:960,y:390,r:25,index:2,damageFlash:0}];
    this.choices=[];this.choiceContext=null;this.rewardQueue=[];this.pendingCore=false;this.pendingEvolution=null;this.rewrite=2;this.choiceAdjusted=false;
    this.nextLevel=70;this.autoTimer=0;this.spawnTimer=0;this.nextId=1;this.rootId=1;this.eventsDone=new Set();
    this.cooldowns={};this.castHistory=[];this.afterCastUntil=0;this.lastCast=null;this.record=[];this.beacon=null;this.echoRoot=null;this.rewriteWindow=null;this.relicState={};this.final=null;
    this.directSince=0;this.boss=null;this.pendingBosses=[];this.result=null;this.route=null;this.lastCause='';
    this.skills=new SkillSystem(this);
  }
  start(skillId='overcharge',mode='standard',seed=Date.now()) {
    const numeric=typeof seed==='number'?seed:/^\d{1,10}$/.test(String(seed))?Number(seed):hashSeed(seed);this.reset(numeric);
    this.mode=mode;this.pace=mode==='expedition'?3:1;this.runLength=1080/this.pace;
    this.runId=`${numeric}-${Date.now()}-${++this.runCounter}`;this.phase='playing';
    this.grantSkill(skillId);const core=CORES?.find(c=>c.skillId===skillId||c.id===skillId);
    if(core?.bonuses)for(const [key,value] of Object.entries(core.bonuses))if(key in this.stats)this.stats[key]+=value;
    this.tags[getSkill(skillId).tag]+=1;
    this.stats.chargeRate+=Math.min(.1,(this.research.recovery||0)*.02);this.xp+=Math.min(20,(this.research.insight||0)*4);
    for(let i=0;i<7;i++)this.spawnEnemy('drifter');
    this.toast('현실 고정점 3개를 지키세요. 클릭은 중요한 목표에, E는 선택한 스킬에.');this.emit('start',this);
  }
  grantSkill(id) { if(this.skillSlots.some(s=>s.id===id)||this.skillSlots.length>=2)return false;const def=getSkill(id);if(!def)return false;this.skillSlots.push({id,branch:null,modifier:null,evolution:0,cd:0,uses:0,key:this.skillSlots.length?'Q':'E',acquiredLevel:this.level});this.tags[def.tag]+=2;return true; }
  startTraining(config={}){
    const id=config.skillId||'overcharge';this.start(id,'training',64822);this.practiceConfig={...config,skillId:id};this.enemies=[];this.practiceTimer=0;
    if(config.secondSkillId&&config.secondSkillId!=='none')this.grantSkill(config.secondSkillId);
    for(const [index,slot] of this.skillSlots.entries()){const def=getSkill(slot.id);slot.branch=index?def.branches[0].id:config.branch||def.branches[0].id;slot.modifier=index?def.modifiers[0].id:config.modifier||def.modifiers[0].id;slot.evolution=Math.min(index?2:3,Math.max(0,Number(config.evolution)||0));this.tags[def.tag]=4;if(slot.evolution===3){this.hasFinal=true;this.final=slot.id;if(slot.id==='orbital')this.network=50;}}
    this.spawnPractice();this.emit('training',this);this.toast('규칙 실험실 · 기록과 보상은 정산하지 않습니다. 스킬 입력과 판정을 연습하세요.');
  }
  spawnPractice(){
    const alive=this.enemies.filter(e=>!e.dead),bossMode=this.practiceConfig?.target==='boss';
    if(bossMode&&!alive.some(e=>e.boss))this.spawnEnemy('training_boss',{x:640,y:280,r:42,hp:4800,shield:0,boss:true,name:'PRACTICE TARGET · 이동 저항',color:'#ED78BF',speed:0});
    const types=bossMode?['drifter','drifter','drifter','channeler']:['drifter','channeler','ward','splitter','scrubber','jammer','anchor','mirror'];
    for(let i=0;i<types.length;i++){if(alive.some(e=>e.practiceIndex===i))continue;const angle=i/types.length*Math.PI*2;this.spawnEnemy(types[i],{x:640+Math.cos(angle)*160,y:385+Math.sin(angle)*115,speed:0,practiceIndex:i,anchorIndex:i%3});}
    this.practiceTimer=6;
  }
  newRoot(){const id=this.rootId++;this.roots.set(id,{id,time:this.time,budget:16,seen:new Set(),hits:new Set(),chainTargets:new Set(),heatStarted:false});return id;}
  root(id){if(!this.roots.has(id))this.roots.set(id,{id,time:this.time,budget:16,seen:new Set(),hits:new Set(),chainTargets:new Set(),heatStarted:false});return this.roots.get(id);}
  proc(rootId,effect,targetId,fn){const r=this.root(rootId);const key=`${effect}:${targetId}`;if(r.budget<=0||r.seen.has(key))return false;r.budget--;r.seen.add(key);fn();return true;}
  near(x,y,r,filter=()=>true){return this.enemies.filter(e=>!e.dead&&dist(x,y,e.x,e.y)<=r+e.r&&filter(e));}
  nearest(x,y,r=Infinity,filter=()=>true){let best=null,d=r;for(const e of this.enemies){if(e.dead||!filter(e))continue;const n=dist(x,y,e.x,e.y);if(n<=d+e.r&&(!best||n<dist(x,y,best.x,best.y))){best=e;d=n;}}return best;}
  schedule(delay,fn){this.jobs.push({at:this.time+Math.max(0,delay),fn});}
  fx(kind,props={}){const life=props.life??(.25);if(this.effects.length>500&&!['text','line','ring'].includes(kind))return;this.effects.push({kind,age:0,life,maxLife:life,color:'#E8F0FF',...props});}
  sound(name){if(this.settings.sound)this.audio(name);}
  toast(text){this.emit('toast',text);}
  heal(n){this.integrity=clamp(this.integrity+n,0,this.maxIntegrity);this.fx('heal',{x:640,y:545,r:80,color:'#A6E857',life:.5});}
  status(enemy,type,options={}){if(!enemy||enemy.dead)return;this.skills.addStatus(enemy,type,options);}
  damage(enemy,base,source='SKILL',meta={}) {
    if(!enemy||enemy.dead||!Number.isFinite(base)||base<=0)return {killed:false,damage:0};
    const rootId=meta.rootId??this.newRoot(),root=this.root(rootId);meta={...meta,rootId};
    const tag=meta.tag||sourceTag[source]||'CASTER';const bonus=meta.snapshotBonus??(source==='DIRECT'?this.stats.directBonus:source==='SUMMON'?this.stats.summonBonus:source==='AUTO'?0:this.stats.skillBonus);
    let amount=base*(meta.snapshotPower??this.stats.power)*(1+bonus);
    if(source==='DIRECT'){let vulnerability=0;if(enemy.statuses.exposed)vulnerability+=.3;if(meta.rupture)vulnerability+=.4;amount*=1+Math.min(.7,vulnerability);}
    const jammed=source==='SUMMON'&&this.near(enemy.x,enemy.y,100,e=>e.type==='jammer').length>0;
    const protectedTarget=enemy.protectedBy&&source!=='DIRECT'&&this.enemies.some(e=>e.id===enemy.protectedBy&&!e.dead&&e.linkBroken<=0);
    if(enemy.adaptation===tag||enemy.type==='mirror'&&root.hits.has(enemy.id)||jammed||protectedTarget)amount*=.75;
    if(enemy.weakness===tag||enemy.type==='anchor'&&tag==='IMPACT'){amount*=1.3;this.metrics.weaknessHits++;}
    if(enemy.boss&&meta.chain)amount*=.6;
    if(source==='DIRECT'&&meta.crit)amount*=this.stats.critDamage;
    if(enemy.statuses.stroke&&!meta.tick&&['SKILL','SUMMON'].includes(source)){amount*=1.35;delete enemy.statuses.stroke;this.breakProtection(enemy);this.fx('slash',{x:enemy.x,y:enemy.y,length:55,width:3,angle:-.7,color:'#FF8C6B',life:.2});}
    amount=Math.max(1,amount);const before=enemy.hp,shieldBefore=enemy.shield||0;
    const bypass=clamp(meta.bypass||0,0,.75);const directBody=amount*bypass;
    const shieldDamage=Math.min(enemy.shield||0,amount*(1-bypass));enemy.shield=Math.max(0,(enemy.shield||0)-shieldDamage);enemy.hp-=amount-shieldDamage;
    const effective=Math.min(before+shieldBefore,amount);root.hits.add(enemy.id);enemy.hitFlash=.12;
    this.damageStats[tag]=(this.damageStats[tag]||0)+effective;this.damageLog.push({time:this.time,tag,damage:effective});
    this.markCastValid(rootId);
    if(source==='DIRECT'||enemy.boss||enemy.elite||enemy.weakness===tag)this.fx('text',{x:enemy.x,y:enemy.y-enemy.r-8,text:String(Math.round(amount)),color:COLORS[tag],life:.6,crit:meta.crit});
    if(enemy.boss&&source==='DIRECT'&&enemy.vulnerable>0){this.interruptBoss(enemy);}
    const overkill=Math.max(0,amount-shieldDamage-before);
    if(!enemy.dead&&enemy.hp<=0){enemy.dead=true;this.skills.onKill(enemy,source,meta);this.onKill(enemy,source,{...meta,overkill});}
    else if(source==='SKILL'&&!meta.tick&&!meta.noProc){this.skills.onSkillHit?.(enemy,meta);}
    if(!enemy.dead&&!meta.tick&&!meta.noProc&&source==='SUMMON'&&meta.effectId==='orbital_command'&&this.hybrid==='parasite_hive'){
      const command=this.fields.find(f=>f.type==='command'&&f.rootId===rootId);
      if(command&&(command.parasites||0)<2)this.proc(rootId,'parasite_hive',enemy.id,()=>{command.parasites=(command.parasites||0)+1;this.status(enemy,'infected',{rootId,damageScale:.65,child:true});});
    }
    const echo=this.echoRoot;
    if(!meta.noProc&&echo===rootId&&this.hybrid==='echo_order')this.proc(rootId,'echo_order',0,()=>{const point={x:enemy.x,y:enemy.y};this.schedule(.4,()=>this.arc(point.x,point.y,1,[50],{rootId,tag:'CHAIN',chain:true,effectId:'echo_order'},[enemy.id]));});
    return {killed:enemy.dead,damage:amount,effective,body:amount-shieldDamage,shield:shieldDamage,bypass:directBody,overkill};
  }
  arcTarget(x,y,range,excluded,root){return this.nearest(x,y,range,e=>!excluded.has(e.id)&&!root?.chainTargets?.has(e.id)&&!root?.hits?.has(e.id));}
  previewArc(x,y,count,meta={},excludedIds=[],root=null){const excluded=new Set(excludedIds),path=[];for(let i=0;i<count;i++){const target=this.arcTarget(x,y,meta.range||110,excluded,root);if(!target)break;path.push(target);excluded.add(target.id);x=target.x;y=target.y;}return path;}
  arc(x,y,count,damages,meta={},excludedIds=[]) {
    const rootId=meta.rootId??this.newRoot(),r=this.root(rootId),hits=[],excluded=new Set(excludedIds);let px=x,py=y,pendingInfection=null;
    for(let i=0;i<count;i++){
      const target=this.arcTarget(px,py,meta.range||110,excluded,r);if(!target)break;
      if(!r.heatStarted){this.heat+=16;r.heatStarted=true;}this.heat+=4;this.heatIdle=0;
      if(pendingInfection&&this.hybrid==='contagion_circuit'&&(r.contagionCopies||0)<2)this.proc(rootId,'contagion_circuit',target.id,()=>{r.contagionCopies=(r.contagionCopies||0)+1;this.status(target,'infected',{...pendingInfection,remaining:pendingInfection.remaining*.65,rootId:pendingInfection.rootId,child:true,noCopy:true});});
      const stored=target.statuses.infected;if(stored&&!stored.noCopy)pendingInfection={...stored};else pendingInfection=null;
      const delay=i*.065;this.fx('arc',{x:px,y:py,toX:target.x,toY:target.y,width:Math.max(1,3-i*.4),color:COLORS.CHAIN,life:.22+delay,delay,sequenceIndex:i,rootId});
      this.fx('hit',{x:target.x,y:target.y,r:target.r+5,color:COLORS.CHAIN,life:.16+delay,delay,sequenceIndex:i,rootId});
      r.chainTargets.add(target.id);excluded.add(target.id);this.damage(target,damages[Math.min(i,damages.length-1)]||0,'SKILL',{...meta,rootId,tag:'CHAIN',chain:true});hits.push(target);
      if(this.hybrid==='orbit_relay'){
        const hole=this.fields.find(f=>f.type==='hole'&&f.mass>=2&&dist(target.x,target.y,f.x,f.y)<f.r);
        if(hole)this.proc(rootId,'orbit_relay',0,()=>{hole.mass-=2;const angle=Math.atan2(target.y-hole.y,target.x-hole.x)+Math.PI;this.schedule(.1,()=>this.arc(hole.x+Math.cos(angle)*hole.r,hole.y+Math.sin(angle)*hole.r,1,[55],{rootId,tag:'CHAIN',chain:true,range:125,effectId:'orbit_relay'},[target.id]));});
      }
      px=target.x;py=target.y;
    }
    if(hits.length){const delay=(hits.length-1)*.065+.045;this.fx('discharge',{x:px,y:py,r:18,color:COLORS.CHAIN,life:.2+delay,delay,rootId});this.sound('chain');}return hits;
  }
  breakProtection(enemy){enemy.protectedBy=null;enemy.linkBroken=5;for(const e of this.enemies)if(e.protectedBy===enemy.id){e.protectedBy=null;e.linkBroken=5;break;}}
  onEnemyInterrupt(enemy){if(!(enemy.channel>0))return false;this.metrics.interrupts++;if(this.relics.includes('anchor_heart')&&(this.cooldowns.anchor_heart||0)<=0){this.heal(3);this.cooldowns.anchor_heart=8;}return true;}
  onKill(enemy,source,meta) {
    this.kills++;this.xp+=(enemy.xp||5)*(this.pace||1);this.pressure=Math.max(0,this.pressure-.3);this.fx('burst',{x:enemy.x,y:enemy.y,r:enemy.r+8,color:enemy.color||COLORS[meta.tag]||'#A6E857',life:.3});
    const rootId=meta.rootId;
    if(!meta.noProc){
    if(source==='DIRECT'&&this.methods.has('conductive_scar'))this.proc(rootId,'conductive_scar',0,()=>{if((this.cooldowns.conductive_scar||0)>0)return;const e=this.nearest(enemy.x,enemy.y,100);if(e){this.status(e,'mark',{remaining:4,duration:4,rootId,originPosition:{x:this.cursor.x,y:this.cursor.y}});this.cooldowns.conductive_scar=2;}});
    if(source==='DIRECT'&&meta.directInfo?.skillTargetId===enemy.id&&this.methods.has('overkill')&&meta.overkill>0)this.proc(rootId,'overkill',0,()=>{for(const e of this.near(enemy.x,enemy.y,55))this.damage(e,Math.min(100,meta.overkill*.7),'SKILL',{rootId,tag:'IMPACT',effectId:'overkill'});this.fx('ring',{x:enemy.x,y:enemy.y,r:55,color:COLORS.IMPACT,life:.25});});
    if(source==='SUMMON'&&this.methods.has('relay_beacon'))this.beacon={x:enemy.x,y:enemy.y,remaining:3};
    if(source==='DIRECT'&&this.hybrid==='relay_hunt'){
      const command=this.fields.find(f=>f.type==='command'&&dist(enemy.x,enemy.y,f.x,f.y)<(f.r||90));
      if(command&&(this.cooldowns.relay_hunt||0)<=0)this.proc(rootId,'relay_hunt',0,()=>{this.cooldowns.relay_hunt=4;this.arc(this.beacon?.x??command.x,this.beacon?.y??command.y,2,[55,55],{rootId,tag:'CHAIN',chain:true},[enemy.id]);});
    }
    }
    if(enemy.type==='splitter'&&source!=='DIRECT'&&!meta.tick){for(let i=0;i<2;i++)this.spawnEnemy('drifter',{x:enemy.x+(i?16:-16),y:enemy.y,hp:enemy.maxHp*.25,r:8,xp:1});}
    if(enemy.elite){this.toast(`${enemy.name||'우선 목표'} 삭제 · VOID 보너스`);this.xp+=30*(this.pace||1);if(this.relics.includes('time_capsule')&&(this.cooldowns.time_capsule||0)<=0){this.skillSlots.forEach(s=>s.cd=Math.max(0,s.cd-2));this.cooldowns.time_capsule=30;}if(enemy.reward)this.queueReward(enemy.reward);if(enemy.routeTarget){this.route.completed=true;this.rewrite=Math.min(4,this.rewrite+1);this.queueReward(this.route.id==='forbidden_rift'&&makeChoices(this,'hybrid').length?'hybrid':'relic');}}
    if(enemy.boss&&this.mode!=='training'){this.boss=null;this.dangers=this.dangers.filter(d=>d.bossId!==enemy.id);if(enemy.type==='reality'){this.end(true,'현실 기관의 마지막 봉합을 삭제했습니다.');}else{this.heal(15);this.queueReward('evolution');this.sound('evolve');this.toast('진화 코어 확보 · 한 스킬의 행동 규칙을 바꾸세요.');}}
  }
  onCast(slot,rootId) {
    const index=this.skillSlots.indexOf(slot),r=this.root(rootId);r.slotId=slot.id;r.slotIndex=index;r.castTime=this.time;
    const def=getSkill(slot.id);this.castHistory.push({rootId,index,time:this.time,valid:false,counted:false});this.castHistory=this.castHistory.slice(-24);
    this.metrics.skillsUsed++;
    if(this.methods.has('after_cast'))this.afterCastUntil=this.time+2;
    const last=this.lastCast;
    if(last&&last.index!==index&&this.time-last.time<=5){
      if(this.methods.has('alternating_circuit')&&!last.refunded){const s=this.skillSlots[last.index];s.cd=Math.max(2,s.cd-getSkill(s.id).cooldown*.2);last.refunded=true;}
      if(this.hybrid==='echo_order'&&last.index===0&&index===1)this.echoRoot=rootId;
      this.rewriteWindow={until:last.time+5,tag:def.tag};
    }
    this.lastCast={index,time:this.time,rootId,refunded:false};
  }
  markCastValid(rootId){const record=this.castHistory.find(c=>c.rootId===rootId);if(!record||record.valid)return;record.valid=true;for(const q of this.castHistory){if(q.index!==1||!q.valid||q.counted)continue;const e=[...this.castHistory].reverse().find(c=>c.index===0&&c.valid&&c.time<=q.time&&q.time-c.time<=5&&!c.counted);if(e){q.counted=true;e.counted=true;this.metrics.casterPairs++;}}}
  beginDirect(){if(this.phase!=='playing')return;this.cursor.down=true;this.cursor.hold=0;}
  endDirect(){if(!this.cursor.down)return;const held=this.cursor.hold;this.cursor.down=false;this.cursor.hold=0;if(this.phase==='playing')this.direct(held);}
  directTargets(held=0,x=this.cursor.x,y=this.cursor.y){const charged=held>=.8,r=(charged?48:36)+this.stats.radiusBonus,target=this.nearest(x,y,r);return {charged,r,target,splash:target?this.near(x,y,r).filter(e=>e.id!==target.id).slice(0,charged?4:3):[]};}
  direct(held=0,x=this.cursor.x,y=this.cursor.y){
    if(this.charges<1)return false;const {charged,r,target}=this.directTargets(held,x,y);if(!target){this.fx('ring',{x,y,r,color:'#617083',life:.2});return false;}
    this.charges--;const rootId=this.newRoot(),crit=this.rng()<Math.min(.6,this.stats.critChance),mark=target.statuses.mark;
    if(mark)delete target.statuses.mark;
    const info={x,y,held,rootId,mark,crit};const prepared=this.skills.prepareDirect?.(target,info)||{};
    if(charged)this.metrics.chargedHits++;
    let base=charged?165:110,bypass=prepared.bypass||0;
    const rupture=!!target.statuses.rupture;if(rupture)delete target.statuses.rupture;
    if((rupture||target.statuses.exposed)&&charged&&this.methods.has('precision_window')&&(this.cooldowns.precision_window||0)<=0){base+=60;bypass+=.25;this.cooldowns.precision_window=6;}
    const afterCast=this.afterCastUntil>this.time;if(afterCast){base*=1.3;this.afterCastUntil=0;}
    const result=this.damage(target,base,'DIRECT',{rootId,tag:'IMPACT',crit,bypass,rupture,directInfo:info});
    if(afterCast&&!target.dead)this.status(target,'exposed',{remaining:2});
    let hit=0;for(const e of this.near(x,y,r).filter(e=>e.id!==target.id)){if(hit++>=(charged?4:3))break;this.damage(e,charged?55:40,'DIRECT',{rootId,tag:'IMPACT',directInfo:info});}
    this.onEnemyInterrupt(target);target.channel=0;target.disrupted=Math.max(target.disrupted||0,1.5);
    if(mark){const hits=this.arc(target.x,target.y,1,[mark.damage||60],{rootId,tag:'CHAIN',chain:true},[target.id]);if(!hits.length&&!target.dead)this.damage(target,25,'SKILL',{rootId,tag:'CHAIN',noProc:true});if(this.methods.has('origin_echo'))this.proc(rootId,'origin_echo',0,()=>{const origin=mark.originPosition||{x,y};for(const e of this.near(origin.x,origin.y,50))this.damage(e,65,'SKILL',{rootId,tag:'CHAIN'});this.fx('ring',{...origin,r:50,color:COLORS.CHAIN,life:.3});});if(this.relics.includes('crossed_wires'))this.chargeTimer+=.3;}
    if(!target.dead&&this.methods.has('target_lease')&&(this.cooldowns.target_lease||0)<=0){this.status(target,'lease',{remaining:4});this.cooldowns.target_lease=5;}
    if(this.beacon&&dist(x,y,this.beacon.x,this.beacon.y)<60&&this.methods.has('relay_beacon')){const command=this.fields.find(f=>f.type==='command'&&!f.beaconUsed);if(command){command.beaconUsed=true;command.forceTarget={x,y};}}
    this.skills.onDirect(target,info);
    if(charged&&this.hybrid==='railgun_scar'&&(crit||result.killed&&result.overkill>=50)){const angle=Math.hypot(this.cursor.dx,this.cursor.dy)>=20?Math.atan2(this.cursor.dy,this.cursor.dx):0,x2=x+Math.cos(angle)*360,y2=y+Math.sin(angle)*360;for(const e of this.enemies.filter(e=>!e.dead&&lineDistance(e.x,e.y,x,y,x2,y2)<=7+e.r))this.damage(e,100,'SKILL',{rootId,tag:'CHAIN'});this.fx('line',{x,y,toX:x2,toY:y2,width:14,color:COLORS.CHAIN,life:.25});}
    if(charged&&held>=1.2&&this.tagFinal==='final_stroke'&&(this.cooldowns.final_stroke||0)<=0){const e=target.dead?this.nearest(x,y,110):target;if(e){this.status(e,'stroke',{remaining:4});this.cooldowns.final_stroke=6;}}
    if(this.tagFinal==='rewrite_sequence'&&this.rewriteWindow?.until>=this.time&&(this.cooldowns.rewrite_sequence||0)<=0){this.performRewrite(target.dead?this.nearest(x,y,110):target,this.rewriteWindow.tag,rootId);this.cooldowns.rewrite_sequence=12;this.rewriteWindow=null;}
    if(charged&&this.heat>=80)this.collapseHeat(x,y,true,rootId);
    this.record.push({x:target.x,y:target.y,time:this.time});this.record=this.record.filter(p=>this.time-p.time<=10).slice(-7);
    this.fx('ring',{x,y,r,color:charged?'#FF8C6B':'#E8F0FF',life:.28});this.sound(charged?'heavy':'direct');return true;
  }
  performRewrite(e,tag,rootId){if(!e)return;if(tag==='CHAIN')this.status(e,'mark',{remaining:4,rootId,originPosition:{...this.cursor}});if(tag==='IMPACT')this.status(e,'rupture',{remaining:5});if(tag==='CASTER')this.status(e,'exposed',{remaining:3});if(tag==='INFECTION')this.status(e,'infected',{rootId,damageScale:.65,child:true});if(tag==='SINGULARITY'){this.fx('ring',{x:e.x,y:e.y,r:80,color:COLORS.SINGULARITY,life:.15});this.schedule(.15,()=>{for(const n of this.near(e.x,e.y,80)){if(n.boss){this.status(n,'strain',{stacks:1,remaining:2});continue;}const d=dist(n.x,n.y,e.x,e.y)||1;n.x+=(e.x-n.x)*Math.min(1,60/d);n.y+=(e.y-n.y)*Math.min(1,60/d);}});}if(tag==='SWARM'){const x=e.x,y=e.y;this.fx('ring',{x,y,r:44,color:COLORS.SWARM,life:.3});this.schedule(.3,()=>this.near(x,y,44).forEach(n=>this.damage(n,35,'SUMMON',{rootId,tag:'SWARM'})));}this.toast('REWRITE SEQUENCE · 순서 재작성');}
  collapseHeat(x,y,controlled,rootId=this.newRoot()){for(const e of this.near(x,y,170)){const result=this.damage(e,180,'SKILL',{rootId,tag:'CHAIN'});if(result.killed&&controlled)this.xp+=(e.xp||5)*(this.pace||1)*.2;}this.heat=0;this.chargeLock=2;this.fx('ring',{x,y,r:170,color:COLORS.CHAIN,life:.55});this.toast(controlled?'제어 붕괴 · 연쇄를 직접 닫았습니다.':'연쇄 과열 · 충전 회복 2초 정지');this.sound('heavy');}
  queueReward(context){this.rewardQueue.push(context);if(this.phase==='playing')this.openNextReward();}
  openNextReward(){if(!this.rewardQueue.length||this.phase==='ended')return;const context=this.rewardQueue.shift();this.openChoices(context);}
  openChoices(context){const choices=makeChoices(this,context);if(!choices?.length){if(context==='hybrid'){this.queueReward('relic');return;}this.toast('유효한 선택이 없어 무결성을 회복합니다.');this.heal(8);return;}this.choiceContext=context;this.choices=choices;this.phase='choice';this.cancelInputs();this.emit('choices',this);}
  choose(id){if(this.phase!=='choice')return false;const choice=this.choices.find(c=>c.id===id);if(!choice)return false;const result=applyChoice(this,choice);if(result?.applied===false)return false;this.emit('choice',choice);this.choices=[];this.choiceContext=null;this.phase='playing';if(result?.nextContext)this.openChoices(result.nextContext);else if(this.rewardQueue.length)this.openNextReward();return true;}
  reroll(){if(this.phase!=='choice'||(this.rewrite||0)<1||this.choiceContext!=='level'||this.choiceAdjusted||this.choices.every(c=>['branch','modifier'].includes(c.kind)))return false;const old=new Set(this.choices.map(c=>c.id)),next=[];for(let i=0;i<12&&next.length<3;i++)for(const c of makeChoices(this,'level'))if(!old.has(c.id)&&!next.some(n=>n.id===c.id)&&next.length<3)next.push(c);if(!next.length)return false;this.rewrite--;this.choiceAdjusted=true;this.choices=next;this.emit('choices',this);return true;}
  ban(id){if(this.phase!=='choice'||(this.rewrite||0)<1||this.choiceAdjusted||(this.bans?.size||0)>=2)return false;const c=this.choices.find(c=>c.id===id);if(!c||!['stat','method'].includes(c.kind))return false;this.rewrite--;this.bans.add(id);this.choiceAdjusted=true;this.choices=makeChoices(this,'level');this.emit('choices',this);return true;}
  cancelInputs(){this.cursor.down=false;this.cursor.hold=0;this.skills.cancelInput();}
  pause(){if(this.phase==='playing'){this.phase='paused';this.cancelInputs();this.emit('pause',this);}else if(this.phase==='paused'){this.phase='playing';this.emit('resume',this);}}
  spawnEnemy(type='drifter',overrides={}){
    if(this.enemies.filter(e=>!e.dead).length>=180){if(overrides.boss||overrides.reward||overrides.routeTarget){const replace=this.enemies.find(e=>!e.dead&&!e.boss&&!e.elite);if(replace)replace.dead=true;else return null;}else return null;}const def=ENEMIES[type]||ENEMIES.drifter||{hp:100,r:12,speed:25,xp:5};
    let x,y;const edge=Math.floor(this.rng()*4);if(edge===0){x=20;y=40+this.rng()*650;}if(edge===1){x=1260;y=40+this.rng()*650;}if(edge===2){x=40+this.rng()*1200;y=25;}if(edge===3){x=40+this.rng()*1200;y=735;}
    const hp=(def.hp||100)*Math.pow(1.04,this.worldTime/60)*(this.route?.enemyHp||1);
    const e={id:this.nextId++,type,x,y,r:def.r||def.radius||12,hp,maxHp:hp,shield:type==='ward'?110:0,maxShield:type==='ward'?110:0,speed:def.speed||25,xp:def.xp||5,color:def.color||'#768998',name:def.name||type,dead:false,elite:false,boss:false,statuses:{},age:0,channel:0,anchorIndex:Math.floor(this.rng()*3),hitFlash:0,angle:this.rng()*Math.PI*2,...overrides};
    if(overrides.hp)e.maxHp=overrides.hp;
    if(!e.boss&&this.adaptations.length&&this.rng()<.3){const a=this.adaptations[Math.floor(this.rng()*this.adaptations.length)];e.adaptation=a.tag;e.weakness=a.weakness;}
    this.enemies.push(e);this.fx('spawn',{x:e.x,y:e.y,r:e.r+8,color:e.color,life:.6});return e;
  }
  spawnBoss(type){if(this.boss){this.pendingBosses.push(type);return;}const hp=({archivist:5800,conductor:8500,reality:24000}[type]||5000)*(this.mode==='expedition'?.55:1);const e=this.spawnEnemy(type,{x:640,y:220,r:type==='reality'?54:42,hp,maxHp:hp,speed:7,xp:120,boss:true,name:BOSS_NAMES[type],color:type==='reality'?'#FF425B':'#ED78BF',aiTimer:5,phaseIndex:0,vulnerable:4,shield:0});if(!e)return;this.boss=e;this.status(e,'exposed',{remaining:4});this.toast(`${e.name} · 고정점 공격의 균열을 직접 삭제하세요.`);this.sound('danger');if(type==='reality')this.finalStarted=this.time;}
  interruptBoss(boss){boss.vulnerable=0;if(this.dangers.some(d=>d.bossId===boss.id)){this.dangers=this.dangers.filter(d=>d.bossId!==boss.id);this.metrics.interrupts++;this.toast('공통 균열 적중 · 고정점 공격 중단');this.sound('interrupt');}}
  addDanger(props){this.dangers.push({id:this.nextId++,age:0,duration:2,remaining:2,color:'#FF425B',...props});this.sound('danger');}
  hitAnchor(index,damage,cause){if(this.mode==='training')return;this.integrity=clamp(this.integrity-damage,0,this.maxIntegrity);this.anchors[index].damageFlash=.35;this.lastCause=cause;this.fx('hit',{x:this.anchors[index].x,y:this.anchors[index].y,r:50,color:'#FF425B',life:.3});if(this.integrity<=0)this.end(false,`${cause}으로 현실 고정점이 붕괴했습니다.`);}
  enemyAI(e,dt){
    e.age+=dt;e.hitFlash=Math.max(0,e.hitFlash-dt);e.disrupted=Math.max(0,(e.disrupted||0)-dt);e.slowRemaining=Math.max(0,(e.slowRemaining||0)-dt);e.linkBroken=Math.max(0,(e.linkBroken||0)-dt);
    if(e.boss){this.bossAI(e,dt);return;}
    if(e.ttl){e.ttl-=dt;if(e.ttl<=0){e.dead=true;this.pressure+=e.routeTarget?12:8;if(e.routeTarget)this.route.completed=true;this.toast(e.routeTarget?'계약 실패 · 압력 +12':'우선 목표 이탈 · 압력 +8');return;}}
    const anchor=this.anchors[e.anchorIndex];let dx=anchor.x-e.x,dy=anchor.y-e.y,d=Math.hypot(dx,dy)||1;
    const channeler=e.type==='channeler'||e.type==='anchor'||e.elite;
    if(channeler&&d<anchor.r+e.r+15){if(e.disrupted<=0){e.channel+=dt;anchor.channeling=true;if(e.channel>2)this.hitAnchor(e.anchorIndex,dt*(e.elite?2:1),'채널링');}return;}
    if(e.type==='drifter'||e.type==='splitter'||e.type==='mirror'){
      e.angle+=dt*.1;dx=Math.cos(e.angle)*80+(anchor.x-e.x)*.22;dy=Math.sin(e.angle)*80+(anchor.y-e.y)*.22;d=Math.hypot(dx,dy)||1;
    }
    let speed=e.speed*(e.slowRemaining>0?(e.slowFactor||.75):1)*(e.disrupted>0?.3:1);
    e.purifying=e.type==='scrubber'&&e.age%7>5;
    if(e.purifying){speed=0;if(e.age%7>6.5&&e.purifyCycle!==Math.floor(e.age/7)){e.purifyCycle=Math.floor(e.age/7);for(const n of this.near(e.x,e.y,70).filter(n=>n.statuses.infected).slice(0,3))delete n.statuses.infected;this.fx('ring',{x:e.x,y:e.y,r:70,color:'#FF425B',life:.3});}}
    e.x=clamp(e.x+dx/d*speed*dt,16,1264);e.y=clamp(e.y+dy/d*speed*dt,16,744);
    if(e.type==='ward'&&e.linkBroken<=0){e.linkTargets=this.near(e.x,e.y,95,n=>n.id!==e.id).slice(0,3).map(n=>n.id);for(const id of e.linkTargets){const n=this.enemies.find(n=>n.id===id);if(n&&n.linkBroken<=0)n.protectedBy=e.id;}}
  }
  bossAI(e,dt){
    e.vulnerable=Math.max(0,(e.vulnerable||0)-dt);e.aiTimer-=dt;e.phaseIndex=e.hp/e.maxHp<.33?2:e.hp/e.maxHp<.66?1:0;
    e.x=640+Math.sin(this.time*.18)*120;e.y=220+Math.cos(this.time*.13)*45;
    if(e.aiTimer>0)return;e.aiTimer=e.type==='reality'?6-e.phaseIndex:8;
    const anchorIndex=Math.floor(this.rng()*3),anchor=this.anchors[anchorIndex];const damage=e.type==='reality'?8+e.phaseIndex*2:6;
    this.addDanger({type:'line',x:e.x,y:e.y,x2:anchor.x,y2:anchor.y,width:40,duration:2,remaining:2,anchorIndex,damage,bossId:e.id,adds:e.type==='reality'?2:e.type==='conductor'?1:0,label:e.type==='reality'?'최종 봉합':'기록 삭제'});
    e.vulnerable=4;this.status(e,'exposed',{remaining:4});
    if(e.type==='reality'&&e.phaseIndex>0){const second=(anchorIndex+1)%3,a=this.anchors[second];this.addDanger({type:'circle',x:a.x,y:a.y,r:70,anchorIndex:second,damage:6,duration:3,remaining:3,bossId:e.id,label:'교차 봉합'});}
  }
  update(dt){
    if(this.phase!=='playing')return;dt=Math.min(dt,.1);this.time+=dt;this.elapsed=this.time;this.worldTime=this.mode==='training'?0:this.time*(this.pace||1);
    if(this.cursor.down)this.cursor.hold=Math.min(1.2,this.cursor.hold+dt);
    for(const key of Object.keys(this.cooldowns))this.cooldowns[key]=Math.max(0,this.cooldowns[key]-dt);
    this.chargeLock=Math.max(0,this.chargeLock-dt);if(this.charges<2&&this.chargeLock<=0){this.chargeTimer+=dt*this.stats.chargeRate;if(this.chargeTimer>=2.8){this.chargeTimer-=2.8;this.charges++;}}else if(this.charges>=2)this.chargeTimer=0;
    this.heatIdle+=dt;if(this.heatIdle>8)this.heat=Math.max(0,this.heat-dt*4);if(this.heat>=100)this.collapseHeat(this.cursor.x,this.cursor.y,false);
    this.autoTimer-=dt;if(this.autoTimer<=0){this.autoTimer=.9/this.stats.autoRate;const target=this.nearest(this.cursor.x,this.cursor.y,110);if(target){const rootId=this.newRoot();this.damage(target,35,'AUTO',{rootId,tag:'CASTER'});this.fx('line',{x:this.cursor.x,y:this.cursor.y,toX:target.x,toY:target.y,width:1,color:'#6B899E',life:.1});}}
    const due=this.jobs.filter(j=>j.at<=this.time);this.jobs=this.jobs.filter(j=>j.at>this.time);for(const j of due)j.fn();
    if(this.phase==='ended')return;this.skills.update(dt);
    for(const a of this.anchors){a.channeling=false;a.damageFlash=Math.max(0,a.damageFlash-dt);}
    for(const e of this.enemies)if(!e.dead){if(this.mode!=='training')this.enemyAI(e,dt);else{if(!e.boss)this.enemyAI(e,0);e.hitFlash=Math.max(0,e.hitFlash-dt);}}
    for(const d of this.dangers){d.age+=dt;d.remaining-=dt;if(d.remaining<=0&&!d.resolved){d.resolved=true;this.hitAnchor(d.anchorIndex,d.damage,'보스 봉합');if(this.phase!=='ended'&&d.adds){const boss=this.enemies.find(e=>e.id===d.bossId&&!e.dead);if(boss)for(let i=0;i<d.adds;i++)this.spawnEnemy('channeler',{x:boss.x+(i?70:-70),y:boss.y+70,anchorIndex:d.anchorIndex,hp:220*Math.pow(1.04,this.worldTime/60)});}}}
    this.dangers=this.dangers.filter(d=>!d.resolved);
    if(this.hybrid==='cross_gravity')this.updateCrossGravity(dt);
    if(this.beacon){this.beacon.remaining-=dt;if(this.beacon.remaining<=0)this.beacon=null;}
    this.spawnTimer-=dt;if(this.mode!=='training'&&this.spawnTimer<=0&&this.worldTime<1080){const rate=1+Math.min(2.2,this.worldTime/360)+(this.pressure/80);this.spawnTimer=1/rate;const pool=[{type:'drifter',weight:50},{type:'channeler',weight:18},{type:'ward',weight:this.worldTime>60?10:0},{type:'splitter',weight:this.worldTime>150?7:0},{type:'scrubber',weight:this.worldTime>300?4:0},{type:'jammer',weight:this.worldTime>360?4:0},{type:'anchor',weight:this.worldTime>480?3:0},{type:'mirror',weight:this.worldTime>600?4:0}];const chosen=weightedPick(pool,this.rng);this.spawnEnemy(chosen.type);}
    this.enemies=this.enemies.filter(e=>!e.dead);this.effects.forEach(e=>{e.age+=dt;e.life-=dt;});this.effects=this.effects.filter(e=>e.life>0);
    this.damageLog=this.damageLog.filter(d=>this.time-d.time<=45);this.pressure=clamp(this.pressure+dt*(this.enemies.length>100?.1:-.025),0,100);
    if(this.pressure>=100)this.hitAnchor(0,dt*2,'초과 압력');
    if(this.mode==='training'){this.practiceTimer-=dt;if(this.practiceTimer<=0)this.spawnPractice();if(this.time%5<dt)for(const [id,r] of this.roots)if(this.time-r.time>65)this.roots.delete(id);this.emit('tick',this);return;}
    this.scheduleEvents();this.updateRoute();
    if(this.phase==='playing'&&this.xp>=this.nextLevel){this.xp-=this.nextLevel;this.level++;this.nextLevel=70+this.level*38+Math.pow(this.level,1.3)*12;this.choiceAdjusted=false;this.queueReward('level');this.sound('level');}
    if(this.boss?.type==='reality'&&this.time-this.finalStarted>120)this.end(false,'현실 기관의 최종 봉합 시간이 만료되었습니다.');
    if(!this.boss&&this.pendingBosses.length)this.spawnBoss(this.pendingBosses.shift());
    if(this.time%5<dt){for(const [id,r] of this.roots)if(this.time-r.time>65)this.roots.delete(id);if(this.pendingCore){const choices=makeChoices(this,'evolution');if(choices.some(c=>c.kind!=='reserve')){this.pendingCore=false;this.queueReward('evolution');}}}
    this.emit('tick',this);
  }
  updateCrossGravity(dt){const command=this.fields.find(f=>f.type==='network'&&!f.removed)||this.fields.find(f=>f.type==='command'&&!f.removed);if(!command)return;const holes=this.fields.filter(f=>f.type==='hole'&&!f.removed);let hole=holes.sort((a,b)=>dist(a.x,a.y,command.x,command.y)-dist(b.x,b.y,command.x,command.y))[0];if(!hole)return;const x=command.x,y=command.y,d=dist(hole.x,hole.y,x,y)||1,step=Math.min(d,dt*(command.type==='network'?120:80));hole.x+=(x-hole.x)/d*step;hole.y+=(y-hole.y)/d*step;hole.repositionLocked=true;}
  updateRoute(){const route=this.route;if(!route||route.completed||route.spawned||this.time<route.startsAt)return;if(route.id==='stable_supply'){route.spawned=true;route.completed=true;this.toast('안정 보급 완료 · 다음 성장을 준비하세요.');return;}const target=this.spawnEnemy(route.id==='elite_seal'?'ward':'mirror',{x:640,y:65,r:26,hp:700*this.stats.power,elite:true,name:route.id==='elite_seal'?'ELITE SEAL · 봉합 계약':'FORBIDDEN RIFT · 금지 균열',ttl:90,routeTarget:true,xp:80});if(!target)return;route.spawned=true;this.toast('계약 목표 출현 · 90초 안에 삭제하세요.');}
  once(id,time,fn){if(this.worldTime>=time&&!this.eventsDone.has(id)){this.eventsDone.add(id);fn();}}
  scheduleEvents(){
    this.once('first-threat',12,()=>this.spawnEnemy('channeler',{x:320,y:120}));
    this.once('skill2',210,()=>this.queueReward('second-skill'));
    this.once('boss1',480,()=>this.spawnBoss('archivist'));
    this.once('route',540,()=>this.queueReward('route'));
    this.once('relic1',570,()=>this.queueReward('relic'));
    this.once('hybrid',690,()=>this.queueReward('hybrid'));
    this.once('boss2',780,()=>this.spawnBoss('conductor'));
    this.once('relic2',840,()=>this.queueReward('relic'));
    this.once('rift',960,()=>{this.spawnEnemy('mirror',{x:640,y:80,hp:1500*(this.mode==='expedition'?.6:1),r:28,elite:true,name:'RIFT TRIAL · 균열 시련',reward:'evolution',ttl:90,xp:80});this.toast('균열 시련 · 우선 목표 삭제 시 마지막 진화 코어');});
    this.once('reserve-expiry',1050,()=>{if(this.pendingCore){this.pendingCore=false;this.queueReward(makeChoices(this,'evolution').some(c=>['evolution','tag-final'].includes(c.kind))?'evolution':'relic');}});
    this.once('final',1080,()=>{if(this.boss){this.boss.dead=true;this.dangers=this.dangers.filter(d=>d.bossId!==this.boss.id);this.boss=null;this.pressure=clamp(this.pressure+12,0,100);this.toast('미삭제 기록이 최종 봉합에 흡수되었습니다. 압력 +12');}this.pendingBosses=[];this.spawnBoss('reality');});
    for(const [i,time] of [360,660,960].entries()){
      this.once(`adapt-preview-${i}`,time-30,()=>{const totals=this.damageLog.reduce((o,d)=>(o[d.tag]=(o[d.tag]||0)+d.damage,o),{}),tag=Object.keys(totals).sort((a,b)=>totals[b]-totals[a])[0]||getSkill(this.skillSlots[0].id).tag;this.adaptationPreview={tag,weakness:ALTERNATE[tag],at:time};this.toast(`세계 관찰: ${tag} → 30초 뒤 국지 봉합 · ${ALTERNATE[tag]} 균열`);});
      this.once(`adapt-${i}`,time,()=>{const a=this.adaptationPreview;if(a){this.adaptations.push({tag:a.tag,weakness:a.weakness,since:this.time});this.adaptations=this.adaptations.slice(-2);this.toast(`봉합 발현 · ${a.tag} 피해 −25% / ${a.weakness} 피해 +30%`);this.adaptationPreview=null;}});
    }
    const wave=Math.floor(this.worldTime/70);if(wave>0&&!this.eventsDone.has(`wave-${wave}`)&&this.worldTime<1000){this.eventsDone.add(`wave-${wave}`);this.spawnEnemy(wave%3===0?'jammer':'ward',{hp:320*Math.pow(1.04,this.worldTime/60),elite:true,r:22,name:'PRIORITY · 우선 목표',xp:30,ttl:60});}
  }
  end(won,cause){if(this.result)return this.result;this.phase='ended';this.cancelInputs();this.result={runId:this.runId,seed:this.seed,mode:this.mode,won,cause,kills:this.kills,duration:this.time,score:Math.floor(this.kills*100+this.integrity*20+(won?5000:0)),integrity:Math.round(this.integrity),level:this.level,metrics:{...this.metrics},damage:{...this.damageStats},skills:this.skillSlots.map(s=>({...s})),methods:[...this.methods],hybrid:this.hybrid,relics:[...this.relics],discoveries:[...this.methods,...(this.hybrid?[this.hybrid]:[]),...this.relics]};this.emit('end',this.result);this.sound(won?'win':'lose');return this.result;}
}
