import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';

function fixture() {
  const g = new Game(); g.start('cut', 'standard', 546); g.enemies = [];
  Object.assign(g.stats, { power: 1, directBonus: 0, skillBonus: 0, summonBonus: 0, critChance: 0, radiusBonus: 0 });
  g.spawnTimer = g.autoTimer = 999;
  g.cursor.x = 640; g.cursor.y = 350;
  return g;
}
const enemy = (g, x, y, hp = 1000, xp = 10) => g.spawnEnemy('drifter', { x, y, hp, xp, r: 8, speed: 0 });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .001, `${actual} != ${expected}`);
function step(g, seconds) { for (let i = 0; i < Math.ceil(seconds * 100); i++) g.update(.01); }

for (const mode of ['standard', 'expedition']) {
  test(`${mode}: an unfinished middle boss cannot delay the mandatory final at world 18:00`, () => {
    const g = fixture(); g.mode = mode; g.pace = mode === 'expedition' ? 3 : 1;
    g.time = 1079.95 / g.pace; g.worldTime = 1079.95;
    for (const id of ['first-threat', 'skill2', 'boss1', 'route', 'relic1', 'hybrid', 'boss2', 'relic2', 'rift', 'reserve-expiry', 'adapt-preview-0', 'adapt-0', 'adapt-preview-1', 'adapt-1', 'adapt-preview-2', 'adapt-2']) g.eventsDone.add(id);
    g.spawnBoss('archivist'); const middle = g.boss; middle.aiTimer = 999;
    g.pendingBosses.push('conductor');
    g.addDanger({ bossId: middle.id, anchorIndex: 0, damage: 6, x: 640, y: 220, x2: 320, y2: 390, type: 'line', duration: 10, remaining: 10 });
    g.update(.1);
    assert.equal(g.boss.type, 'reality'); assert.equal(middle.dead, true);
    assert.equal(g.pendingBosses.length, 0); assert.equal(g.dangers.some(d => d.bossId === middle.id), false);
    assert.equal(g.kills, 0); assert.equal(g.xp, 0); assert.equal(g.choiceContext, null);
    close(g.pressure, 12); close(g.integrity, 100);
    close(g.finalStarted, g.time); assert.ok(g.eventsDone.has('final'));
  });
}

for (const [type, adds] of [['conductor', 1], ['reality', 2]]) {
  test(`${type}: interrupting the warning cancels its deferred channeler reinforcements`, () => {
    const g = fixture(); g.spawnBoss(type); const boss = g.boss; boss.aiTimer = 0;
    g.update(.01);
    assert.equal(g.dangers[0].adds, adds);
    assert.equal(g.enemies.filter(e => e.type === 'channeler').length, 0);
    g.cursor.x = boss.x; g.cursor.y = boss.y; g.direct(0);
    assert.equal(g.dangers.length, 0); step(g, 2.1);
    assert.equal(g.enemies.filter(e => e.type === 'channeler' && !e.dead).length, 0);
    close(g.integrity, 100); assert.equal(g.metrics.interrupts, 1);
  });

  test(`${type}: a warning that lands deals its damage and then spawns its channelers once`, () => {
    const g = fixture(); g.spawnBoss(type); g.boss.aiTimer = 0;
    g.update(.01); const warning = g.dangers[0];
    assert.equal(g.enemies.filter(e => e.type === 'channeler').length, 0);
    step(g, 2.1);
    const spawned = g.enemies.filter(e => e.type === 'channeler' && !e.dead);
    assert.equal(spawned.length, adds);
    assert.ok(spawned.every(e => e.anchorIndex === warning.anchorIndex));
    close(g.integrity, 100 - warning.damage);
    step(g, .3); assert.equal(g.enemies.filter(e => e.type === 'channeler' && !e.dead).length, adds);
  });
}

test('direct radius upgrades alter main-target acquisition, charge spending, and the drawn radius together', () => {
  const g = fixture(); const target = enemy(g, 702, 350);
  assert.equal(g.direct(0), false); assert.equal(g.charges, 2); close(target.hp, 1000);
  g.stats.radiusBonus = 20;
  assert.equal(g.direct(0), true); assert.equal(g.charges, 1); close(target.hp, 890);
  assert.ok(g.effects.some(f => f.kind === 'ring' && f.r === 56));
});

test('charged acquisition uses its larger radius plus the same additive upgrade', () => {
  const g = fixture(); const target = enemy(g, 704, 350);
  assert.equal(g.direct(.8), false); assert.equal(g.charges, 2);
  g.stats.radiusBonus = 10;
  assert.equal(g.direct(.8), true); close(target.hp, 835);
  assert.ok(g.effects.some(f => f.kind === 'ring' && f.r === 58));
});

test('controlled heat collapse adds exactly 20% VOID to its own kills and clears the risk once', () => {
  const g = fixture(); enemy(g, 640, 350, 100, 10); enemy(g, 750, 350, 100, 25);
  const outside = enemy(g, 1000, 350, 100, 50); g.heat = 90;
  const rootId = g.newRoot(); g.collapseHeat(640, 350, true, rootId);
  close(g.xp, 42); assert.equal(g.kills, 2); assert.equal(g.heat, 0); assert.equal(g.chargeLock, 2);
  close(outside.hp, 100);
  g.collapseHeat(640, 350, true, rootId);
  close(g.xp, 42); assert.equal(g.kills, 2);
});

test('automatic heat collapse grants normal VOID with no controlled bonus', () => {
  const g = fixture(); enemy(g, 640, 350, 100, 10); enemy(g, 750, 350, 100, 25); g.heat = 100;
  g.collapseHeat(640, 350, false);
  close(g.xp, 35); assert.equal(g.kills, 2); assert.equal(g.heat, 0);
});

test('noProc retains one normal kill reward while suppressing bonus attack triggers', () => {
  for (const noProc of [false, true]) {
    const g = fixture(); g.methods.add('overkill');
    const target = enemy(g, 640, 350, 10, 25), witness = enemy(g, 690, 350, 1000, 10);
    const rootId = g.newRoot();
    g.damage(target, 180, 'DIRECT', { rootId, tag: 'IMPACT', noProc, directInfo: { skillTargetId: target.id } });
    close(g.xp, 25); assert.equal(g.kills, 1);
    close(witness.hp, noProc ? 1000 : 900);
    g.damage(target, 180, 'DIRECT', { rootId, noProc });
    close(g.xp, 25); assert.equal(g.kills, 1);
  }
});
