import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { blankSave, settleRun } from '../src/storage.js';

function training(skillId, extra = {}) {
  const g = new Game();
  g.startTraining({ skillId, evolution: 3, secondSkillId: 'none', target: 'boss', ...extra });
  g.autoTimer = 999; g.skills.scoutTimer = g.skills.circuitTimer = 999;
  const boss = g.enemies.find(e => e.boss);
  g.cursor.x = boss.x; g.cursor.y = boss.y;
  return { g, boss };
}
function step(g, seconds) { for (let i = 0; i < Math.ceil(seconds * 100); i++) g.update(.01); }

test('training preserves LIVING CIRCUIT routing and the Closed Circuit exposed origin', () => {
  const { g, boss } = training('overcharge');
  g.skills.press(0); g.direct(0); assert.ok(g.skills.route);
  assert.equal(g.skills.press(0), true); assert.equal(g.skills.route, null);
  assert.ok(boss.statuses.exposed); assert.ok(boss.hp < 4800);
});

test('training preserves TOTAL VOID hold, RECORD fuse, and real record ghost damage', () => {
  const { g, boss } = training('bomb', { branch: 'compression' });
  g.direct(0); const hp = boss.hp;
  g.skills.press(0); step(g, .6); assert.equal(g.skills.recordPreview.length, 1);
  g.skills.release(0, .6); assert.equal(g.fields.find(f => f.type === 'bomb').record, true);
  step(g, .8); assert.ok(boss.hp < hp); assert.ok(g.fields.some(f => f.ghost));
  const afterMain = boss.hp; step(g, .13); assert.ok(boss.hp < afterMain);
});

test('training preserves REALITY FOLD B selection and delayed corridor damage', () => {
  const { g, boss } = training('hole', { branch: 'anchor' });
  g.skills.press(0); g.cursor.x += 200; assert.equal(g.skills.press(0), true);
  const fold = g.fields.find(f => f.type === 'fold'); assert.equal(fold.width, 32);
  step(g, .61); assert.ok(boss.hp < 4800 - 190); assert.equal(g.fields.some(f => f.type === 'fold'), false);
});

test('training preserves LAST JUDGEMENT and its target hit limit', () => {
  const { g, boss } = training('cut', { branch: 'razor', modifier: 'rupture_edge' });
  const power = g.stats.power * (1 + g.stats.skillBonus);
  g.skills.press(0); g.skills.release(0, .1); assert.ok(g.fields.some(f => f.type === 'sweep'));
  step(g, 3.41);
  assert.ok(Math.abs(boss.hp - (4800 - 250 * power)) < .01);
  assert.equal(g.fields.some(f => f.type === 'sweep'), false);
});

test('training preserves CROSS NETWORK starting resource and actual intersection damage', () => {
  const { g, boss } = training('orbital');
  assert.equal(g.network, 50); assert.equal(g.skills.crossNetwork(), true);
  assert.equal(g.network, 0); assert.ok(g.fields.some(f => f.type === 'network'));
  step(g, .2); assert.ok(boss.hp < 4800);
});

test('training preserves EPIDEMIC SCRIPT direction selection and weak child infection', () => {
  const { g } = training('seed');
  const receiver = g.spawnEnemy('drifter', { x: 760, y: 280, hp: 1000, speed: 0 });
  g.skills.press(0); g.direct(0); assert.ok(g.fields.some(f => f.type === 'cone'));
  g.cursor.x += 80; step(g, .51);
  assert.ok(receiver.statuses.infected); assert.equal(receiver.statuses.infected.originalHost, false);
});

test('the experiment has one Final, caps its second active at evolution II, and respects no-secondary choice', () => {
  const { g } = training('orbital', { secondSkillId: 'hole' });
  assert.equal(g.skillSlots.length, 2);
  assert.equal(g.skillSlots.filter(s => s.evolution === 3).length, 1);
  assert.equal(g.skillSlots[1].evolution, 2); assert.equal(g.hasFinal, true);
  assert.equal(training('orbital').g.skillSlots.length, 1);
});

test('the 4800 HP training boss resists forced movement but receives hole damage and Strain exposure', () => {
  const { g, boss } = training('hole', { branch: 'anchor' });
  assert.equal(boss.maxHp, 4800); const position = { x: boss.x, y: boss.y };
  g.cursor.x += 80; g.skills.press(0); step(g, 2.01);
  assert.deepEqual({ x: boss.x, y: boss.y }, position);
  assert.ok(boss.hp < 4800); assert.ok(boss.statuses.exposed);
});

test('training never opens growth or boss schedules and replenishes a defeated practice boss', () => {
  const { g, boss } = training('seed');
  g.damage(boss, 1e6, 'SKILL', { rootId: g.newRoot() });
  assert.equal(g.phase, 'playing'); assert.equal(g.rewardQueue.length, 0);
  g.time = 2000; g.xp = 1e6; g.practiceTimer = 0;
  g.update(.1);
  assert.equal(g.worldTime, 0); assert.equal(g.level, 1); assert.equal(g.phase, 'playing');
  assert.equal(g.choiceContext, null); assert.equal(g.eventsDone.size, 0); assert.equal(g.dangers.length, 0);
  assert.equal(g.enemies.find(e => e.boss && !e.dead).maxHp, 4800);
});

test('training integrity is protected even under a crowded maximum-pressure experiment', () => {
  const { g } = training('bomb');
  for (let i = 0; i < 105; i++) g.spawnEnemy('drifter', { x: 20, y: 20, hp: 1000, speed: 0 });
  g.pressure = 100; g.update(.1);
  assert.equal(g.integrity, 100); assert.equal(g.phase, 'playing');
});

test('training settlement awards zero MEMORY and preserves archive, research, and ranked history', () => {
  const { g } = training('orbital');
  const save = { ...blankSave(), memory: 33, runs: 7, wins: 2, best: 4400, discoveries: ['conductive_scar'], settled: ['ranked-1'] };
  const before = structuredClone(save);
  const result = g.end(false, '실험 종료');
  const settled = settleRun(save, result);
  assert.equal(settled.awarded, 0); assert.equal(settled.skipped, true);
  assert.equal(settled.save, save); assert.deepEqual(save, before);
});

test('starting a normal run after training clears practice combat, Final skills, and experiment resources', () => {
  const { g } = training('orbital', { secondSkillId: 'hole' });
  g.skills.crossNetwork(); g.methods.add('event_horizon'); g.relics.push('lens'); g.stats.power = 5;
  g.start('seed', 'standard', 53);
  assert.equal(g.mode, 'standard'); assert.equal(g.time, 0); assert.equal(g.worldTime, 0);
  assert.equal(g.skillSlots.length, 1); assert.equal(g.skillSlots[0].id, 'seed'); assert.equal(g.skillSlots[0].evolution, 0);
  assert.equal(g.skillSlots[0].branch, null); assert.equal(g.skillSlots[0].modifier, null);
  assert.equal(g.hasFinal, false); assert.equal(g.tagFinal, null); assert.equal(g.network, 0);
  assert.equal(g.fields.length, 0); assert.equal(g.methods.size, 0); assert.equal(g.relics.length, 0);
  assert.equal(g.enemies.some(e => e.boss || e.practiceIndex !== undefined), false);
  const fresh = new Game(); fresh.start('seed', 'standard', 53);
  assert.equal(g.enemies.length, 7); assert.deepEqual(g.stats, fresh.stats);
});
