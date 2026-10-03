import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { SKILLS, STAT_CARDS, applyChoice } from '../src/data.js';
import { SAVE_KEY, blankSave, readSave, writeSave, settleRun } from '../src/storage.js';

function gameFixture(skill = 'overcharge', mode = 'standard', onEvent = () => {}) {
  const game = new Game({ onEvent }); game.start(skill, mode, 87654);
  game.enemies = []; game.spawnTimer = 9999; game.autoTimer = 9999;
  game.skills.scoutTimer = 9999; game.skills.circuitTimer = 9999;
  return game;
}
function finishSkill(game, index = 0) {
  const slot = game.skillSlots[index], definition = SKILLS.find(skill => skill.id === slot.id);
  slot.branch = definition.branches[0].id; slot.modifier = definition.modifiers[0].id;
}
function chooseFirst(game, kind) {
  const choice = game.choices.find(card => !kind || card.kind === kind);
  assert.ok(choice, `Expected ${kind || 'a'} choice in ${game.choiceContext}`);
  assert.equal(game.choose(choice.id), true); return choice;
}
function mapStorage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)) };
}

test('core preparation choices pause time and complete without consuming the core early', () => {
  const game = gameFixture(); game.worldTime = 480;
  game.queueReward('evolution');
  assert.equal(game.phase, 'choice'); assert.ok(game.choices.every(card => card.kind === 'branch'));
  game.update(.1); assert.equal(game.time, 0);
  assert.equal(game.choose('missing-card'), false); assert.equal(game.phase, 'choice');
  chooseFirst(game, 'branch'); assert.equal(game.phase, 'choice'); assert.equal(game.choiceContext, 'evolution');
  assert.equal(game.skillSlots[0].evolution, 0); chooseFirst(game, 'modifier');
  assert.equal(game.phase, 'choice'); assert.equal(game.skillSlots[0].evolution, 0);
  chooseFirst(game, 'evolution');
  assert.equal(game.skillSlots[0].evolution, 1); assert.equal(game.phase, 'playing');
  assert.equal(game.pendingEvolution, null); assert.equal(game.rewardQueue.length, 0);
});

test('second skill scheduled at 3:30 gets its own branch deadline after late acquisition', () => {
  const game = gameFixture(); finishSkill(game); game.level = 19; game.worldTime = 210;
  game.scheduleEvents(); assert.equal(game.choiceContext, 'second-skill');
  chooseFirst(game, 'skill'); assert.equal(game.skillSlots.length, 2); assert.equal(game.skillSlots[1].key, 'Q');
  assert.equal(game.skillSlots[1].acquiredLevel, 19); game.level = 21;
  game.queueReward('level'); assert.ok(game.choices.every(card => card.kind === 'branch' && card.slotIndex === 1));
  chooseFirst(game, 'branch'); game.level = 23; game.queueReward('level');
  assert.ok(game.choices.every(card => card.kind === 'modifier' && card.slotIndex === 1));
});

test('earned excess VOID carries across level choices instead of being cleared', () => {
  const game = gameFixture(); game.xp = game.nextLevel + 125;
  game.update(.01); assert.equal(game.level, 2); assert.equal(game.xp, 125); assert.equal(game.phase, 'choice');
  chooseFirst(game); assert.equal(game.xp, 125);
});

test('reserved Final core reopens when real uses satisfy its condition', () => {
  const game = gameFixture(); finishSkill(game); game.skillSlots[0].evolution = 2;
  game.tags.CHAIN = 4; game.time = 965; game.worldTime = 965;
  // Isolate the reserved-core poll from unrelated scheduled rewards.
  game.scheduleEvents = () => {};
  game.queueReward('evolution'); chooseFirst(game, 'reserve'); assert.equal(game.pendingCore, true);
  const target = game.spawnEnemy('drifter', { x: game.cursor.x, y: game.cursor.y, hp: 50000, maxHp: 50000, speed: 0 });
  assert.ok(target);
  for (let i = 0; i < 8; i++) {
    // Advance a full natural cooldown between casts without unrelated world events.
    if (i) { game.time += 10; game.worldTime = game.time; }
    game.skillSlots[0].cd = 0; game.charges = 2;
    assert.equal(game.skills.press(0), true); assert.equal(game.direct(0), true);
  }
  assert.equal(game.skillSlots[0].uses, 8); game.update(.02);
  assert.equal(game.choiceContext, 'evolution'); assert.equal(game.pendingCore, false);
  const final = chooseFirst(game, 'evolution'); assert.equal(final.selection, 3); assert.equal(game.hasFinal, true);
});

test('17:30 exchanges unmet reserved core for a real relic offer', () => {
  const game = gameFixture(); finishSkill(game); game.skillSlots[0].evolution = 2;
  game.tags.CHAIN = 4; game.time = 1049; game.worldTime = 1049; game.queueReward('evolution');
  chooseFirst(game, 'reserve'); assert.equal(game.pendingCore, true);
  // Only the expiry reward remains relevant in this targeted scenario.
  for (const id of ['first-threat', 'skill2', 'boss1', 'route', 'relic1', 'hybrid', 'boss2', 'relic2', 'rift', 'adapt-preview-0', 'adapt-0', 'adapt-preview-1', 'adapt-1', 'adapt-preview-2', 'adapt-2']) game.eventsDone.add(id);
  game.worldTime = 1050; game.scheduleEvents();
  assert.equal(game.pendingCore, false); assert.equal(game.choiceContext, 'relic');
  assert.ok(game.choices.some(card => card.kind === 'relic'));
});

test('a reserved core eligible just before expiry retains its Final choice', () => {
  const game = gameFixture(); finishSkill(game); game.skillSlots[0].evolution = 2;
  game.tags.CHAIN = 4; game.time = 1049; game.worldTime = 1049; game.queueReward('evolution');
  chooseFirst(game, 'reserve');
  game.skillSlots[0].uses = 8;
  for (const id of ['first-threat', 'skill2', 'boss1', 'route', 'relic1', 'hybrid', 'boss2', 'relic2', 'rift', 'adapt-preview-0', 'adapt-0', 'adapt-preview-1', 'adapt-1', 'adapt-preview-2', 'adapt-2']) game.eventsDone.add(id);
  game.worldTime = 1050; game.scheduleEvents();
  assert.equal(game.choiceContext, 'evolution');
  assert.ok(game.choices.some(card => card.kind === 'evolution' && card.selection === 3));
});

test('mid boss defeat awards one evolution while final boss defeat ends once', () => {
  let endings = 0;
  const game = gameFixture('bomb', 'standard', type => { if (type === 'end') endings++; });
  finishSkill(game); game.spawnBoss('archivist');
  const first = game.boss; game.damage(first, first.hp + 100, 'AUTO', { rootId: game.newRoot() });
  assert.equal(game.choiceContext, 'evolution'); chooseFirst(game, 'evolution');
  assert.equal(game.skillSlots[0].evolution, 1); game.spawnBoss('reality');
  const final = game.boss; game.damage(final, final.hp + 100, 'AUTO', { rootId: game.newRoot() });
  const result = game.result; assert.equal(result.won, true); assert.equal(game.phase, 'ended');
  assert.equal(game.end(false, 'later callback'), result); assert.equal(endings, 1);
});

test('elite contract waits fifteen seconds then rewards success exactly once', () => {
  const game = gameFixture(); game.queueReward('route');
  const routeChoice = game.choices.find(card => card.selection === 'elite_seal');
  game.choose(routeChoice.id); game.time = 14.9; game.updateRoute();
  assert.ok(!game.enemies.some(enemy => enemy.routeTarget));
  game.time = 15; game.updateRoute();
  const target = game.enemies.find(enemy => enemy.routeTarget); assert.ok(target); assert.equal(target.ttl, 90);
  game.damage(target, target.hp + 1000, 'AUTO', { rootId: game.newRoot() });
  assert.equal(game.route.completed, true); assert.equal(game.rewrite, 3); assert.equal(game.choiceContext, 'relic');
  game.damage(target, 10000, 'AUTO', { rootId: game.newRoot() }); assert.equal(game.rewrite, 3);
});

test('contract timeout grants no relic and records the pressure penalty', () => {
  const game = gameFixture(); applyChoice(game, { kind: 'route', selection: 'elite_seal', title: '봉합' });
  game.time = 15; game.updateRoute(); const target = game.enemies.find(enemy => enemy.routeTarget);
  target.ttl = .01; game.enemyAI(target, .02);
  assert.equal(game.route.completed, true); assert.equal(game.pressure, 12);
  assert.equal(game.rewardQueue.length, 0); assert.equal(game.phase, 'playing'); assert.equal(game.rewrite, 2);
});

test('run end and storage settlement award memory and discoveries once', () => {
  let profile = blankSave(); const storage = mapStorage(); let settlements = 0;
  const game = gameFixture('cut', 'standard', (type, result) => {
    if (type !== 'end') return;
    const settled = settleRun(profile, result); profile = settled.save; settlements++;
    assert.equal(writeSave(storage, profile), true);
  });
  game.kills = 105; game.time = 180; game.methods.add('after_cast'); game.relics.push('lens');
  const result = game.end(true, 'integration completion'); game.end(false, 'duplicate');
  assert.equal(settlements, 1); assert.equal(profile.memory, 17); assert.equal(profile.runs, 1); assert.equal(profile.wins, 1);
  assert.deepEqual(new Set(profile.discoveries), new Set(['after_cast', 'lens']));
  const duplicate = settleRun(readSave(storage), result); assert.equal(duplicate.duplicate, true); assert.equal(duplicate.awarded, 0);
  assert.equal(duplicate.save.memory, 17); assert.equal(duplicate.save.history.length, 1);
});

test('new run clears temporary card ranks instead of retaining last run caps', () => {
  const game = gameFixture(); finishSkill(game);
  const stat = STAT_CARDS.find(card => card.id === 'chain_voltage');
  for (let i = 0; i < stat.maxRank; i++) applyChoice(game, { kind: 'stat', selection: stat.id, title: stat.name });
  game.end(false, 'retry'); game.start('overcharge', 'standard', 99);
  assert.equal(game.cardRanks?.chain_voltage || 0, 0);
});

test('contract spawning survives a full arena and retries after a vacancy', () => {
  const game = gameFixture(); applyChoice(game, { kind: 'route', selection: 'elite_seal', title: '봉합' });
  for (let i = 0; i < 180; i++) game.spawnEnemy('drifter', { x: 50, y: 50, elite: true });
  game.time = 15; game.updateRoute(); assert.equal(game.enemies.some(enemy => enemy.routeTarget), false);
  game.enemies[0].dead = true; game.updateRoute();
  assert.ok(game.enemies.some(enemy => enemy.routeTarget && !enemy.dead));
});

test('boss and final evolution trial reserve a slot in a crowded ordinary arena', () => {
  const game = gameFixture();
  for (let i = 0; i < 180; i++) game.spawnEnemy('drifter', { x: 50, y: 50 });
  game.spawnBoss('archivist'); assert.ok(game.boss); assert.equal(game.enemies.filter(enemy => !enemy.dead).length, 180);
  for (const id of ['first-threat', 'skill2', 'boss1', 'route', 'relic1', 'hybrid', 'boss2', 'relic2', 'adapt-preview-0', 'adapt-0', 'adapt-preview-1', 'adapt-1', 'adapt-preview-2']) game.eventsDone.add(id);
  game.worldTime = 960; game.scheduleEvents();
  assert.ok(game.enemies.some(enemy => !enemy.dead && enemy.reward === 'evolution'));
  assert.equal(game.enemies.filter(enemy => !enemy.dead).length, 180);
});

test('mandatory two-option branching cannot waste a rewrite on identical cards', () => {
  const game = gameFixture(); game.level = 3; game.queueReward('level');
  assert.ok(game.choices.every(card => card.kind === 'branch'));
  const ids = game.choices.map(card => card.id), rewrites = game.rewrite;
  assert.equal(game.reroll(), false); assert.equal(game.rewrite, rewrites);
  assert.deepEqual(game.choices.map(card => card.id), ids);
});

test('corrupt optional save fields do not destroy valid memory or prevent settlement', () => {
  const storage = mapStorage(); storage.setItem(SAVE_KEY, JSON.stringify({ version: 2, memory: 41, settled: null, history: {}, discoveries: 'broken', settings: null }));
  const saved = readSave(storage); assert.equal(saved.memory, 41);
  assert.ok(Array.isArray(saved.settled)); assert.ok(Array.isArray(saved.history)); assert.ok(Array.isArray(saved.discoveries));
  const result = gameFixture().end(false, 'save recovery');
  assert.doesNotThrow(() => settleRun(saved, result));
});

test('storage failure is reported when unavailable or denied', () => {
  assert.equal(writeSave(undefined, blankSave()), false);
  assert.equal(writeSave({ setItem() { throw new Error('denied'); } }, blankSave()), false);
  assert.equal(readSave({ getItem() { throw new Error('denied'); } }).memory, 0);
});
