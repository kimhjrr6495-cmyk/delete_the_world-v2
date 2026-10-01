import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';

function fixture(id, config = {}) {
  const game = new Game();
  game.start(id, 'standard', 123);
  game.enemies = [];
  Object.assign(game.stats, { power: 1, directBonus: 0, skillBonus: 0, summonBonus: 0, cdr: 0, critChance: 0, radiusBonus: 0 });
  game.cursor.x = 640; game.cursor.y = 350;
  Object.assign(game.skillSlots[0], config);
  game.skills.scoutTimer = 999; game.skills.circuitTimer = 999;
  return game;
}
function enemy(game, x = 640, y = 350, hp = 10000, extra = {}) {
  return game.spawnEnemy('drifter', { x, y, hp, maxHp: hp, r: 8, speed: 0, ...extra });
}
function step(game, seconds, dt = .01) {
  for (let elapsed = 0; elapsed < seconds - 1e-8; elapsed += dt) {
    const tick = Math.min(dt, seconds - elapsed);
    game.time += tick;
    const due = game.jobs.filter(j => j.at <= game.time + 1e-8);
    game.jobs = game.jobs.filter(j => j.at > game.time + 1e-8);
    for (const job of due) job.fn();
    game.skills.update(tick);
  }
}
const close = (actual, expected, epsilon = .01) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('OVERCHARGE arms without a cooldown, shares direct root, and returns missing arcs', () => {
  const g = fixture('overcharge'); const e = enemy(g, 640, 350, 1000, { boss: true });
  assert.equal(g.skills.press(0), true); assert.equal(g.skillSlots[0].cd, 0);
  assert.equal(g.direct(0), true);
  close(e.hp, 845); assert.equal(g.charges, 1); assert.equal(g.skillSlots[0].uses, 1);
  close(g.skillSlots[0].cd, 10); assert.equal(g.skills.armed, null);
});

test('NEEDLE bypasses half of the first direct hit and records its one actual chain target', () => {
  const g = fixture('overcharge', { branch: 'needle', evolution: 1 });
  const primary = enemy(g, 640, 350, 1000, { type: 'ward', shield: 110, maxShield: 110 });
  const next = enemy(g, 720, 350, 1000);
  g.skills.press(0); g.direct(0);
  close(primary.hp, 945); close(primary.shield, 55); close(next.hp, 910);
  assert.ok(next.statuses.mark); assert.equal(g.skillSlots[0].uses, 1);
});

test('VOID BOMB has a real fuse, outer attenuation, and one scaling pass', () => {
  const g = fixture('bomb'); g.stats.power = 2; g.stats.skillBonus = .5;
  const center = enemy(g); const outer = enemy(g, 712, 350);
  g.skills.press(0); step(g, .79);
  close(center.hp, 10000); step(g, .02);
  close(center.hp, 10000 - 230 * 3); close(outer.hp, 10000 - 230 * .6 * 3);
  assert.equal(g.skillSlots[0].uses, 1);
});

test('REMOTE FUSE fires after the direct hit and never delays the original fuse', () => {
  const g = fixture('bomb', { modifier: 'remote_fuse' }); const e = enemy(g);
  g.skills.press(0); step(g, .2); g.direct(0);
  close(e.hp, 9890); step(g, .14); close(e.hp, 9890);
  step(g, .02); close(e.hp, 9890 - 230 * .85);
  assert.equal(g.fields.filter(f => f.type === 'bomb').length, 0);
});

test('BLACK HOLE pulls mobs but exposes an unmoved boss after four ticks', () => {
  const g = fixture('hole'); const boss = enemy(g, 650, 350, 10000, { boss: true }); const mob = enemy(g, 740, 350);
  g.skills.press(0); step(g, 2.01);
  close(boss.x, 650); close(boss.y, 350); assert.ok(boss.statuses.exposed);
  assert.ok(mob.x < 740); close(boss.hp, 9940);
  step(g, 1); assert.equal(g.fields.length, 0); close(boss.hp, 9830);
});

test('Event Horizon consumes actual Mass and ends the hole without an extra cooldown', () => {
  const g = fixture('hole', { modifier: 'mass_ledger' }); g.methods.add('event_horizon');
  const survivor = enemy(g, 660, 350); g.skills.press(0); const hole = g.fields[0];
  for (let i = 0; i < 6; i++) { const e = enemy(g, 640 + i, 360, 10); g.damage(e, 20, 'AUTO', { rootId: g.newRoot() }); }
  assert.equal(hole.mass, 6); const cd = g.skillSlots[0].cd;
  g.direct(0, 660, 350); step(g, .01);
  assert.equal(g.fields.filter(f => f.type === 'hole').length, 0);
  close(survivor.hp, 10000 - 110 - 260); close(g.skillSlots[0].cd, cd - .01);
});

test('LATTICE caps overlap and adds two real intersection bursts', () => {
  const g = fixture('cut', { branch: 'lattice', evolution: 2 }); const e = enemy(g, 730, 350);
  g.skills.press(0); g.skills.release(0, .1); close(e.hp, 9780);
  step(g, .26); close(e.hp, 9680); assert.equal(g.skillSlots[0].uses, 1);
  assert.equal(g.fields.filter(f => f.type === 'seam').length, 3);
});

test('LAST JUDGEMENT is two full sweeps with at most two damage hits', () => {
  const g = fixture('cut', { branch: 'razor', evolution: 3 }); const e = enemy(g, 680, 350);
  g.skills.press(0); g.skills.release(0, .1); step(g, .39); close(e.hp, 10000);
  step(g, 3.1); close(e.hp, 9750); close(g.skillSlots[0].cd, 18.51);
});

test('ORBITAL fires four SUMMON shots and does not multiply skill bonus into summons', () => {
  const g = fixture('orbital'); const e = enemy(g); g.stats.summonBonus = .5; g.stats.skillBonus = 2;
  g.skills.press(0); step(g, 4);
  close(e.hp, 10000 - 55 * 4 * 1.5); assert.equal(g.fields[0].shots.filter(s => s.fired).length, 4);
  assert.equal(g.skillSlots[0].uses, 1);
});

test('orbital targeting has a fixed last 0.3s and FIELD COMMAND preserves that lock', () => {
  const g = fixture('orbital', { evolution: 2, branch: 'hunter' }); const e = enemy(g);
  g.skills.press(0); step(g, .31); const shot = g.fields[0].shots[0];
  const lockedX = shot.x; assert.equal(shot.locked, true);
  e.x = 800; g.cursor.x = 900; assert.equal(g.skills.press(0), true); step(g, .1);
  close(shot.x, lockedX); close(g.fields[0].x, 900);
});

test('LATENCY SEED ticks and expires once with saved power, even after stats change', () => {
  const g = fixture('seed'); g.stats.power = 2; g.stats.skillBonus = .5; const e = enemy(g);
  g.skills.press(0); g.stats.power = 10; g.stats.skillBonus = 5; step(g, 3.01);
  close(e.hp, 10000 - (75 + 145) * 3); assert.equal(e.statuses.infected, undefined);
  assert.equal(g.skillSlots[0].uses, 1);
});

test('manual lethal direct, Patient Zero and Patient Zero Strike produce one combined burst', () => {
  const g = fixture('seed', { modifier: 'manual_detonate' }); g.methods.add('patient_zero'); g.hybrid = 'patient_zero_strike';
  const host = enemy(g, 640, 350, 160); const neighbor = enemy(g, 700, 350);
  g.skills.press(0); step(g, .2); const remaining = host.statuses.infected.remaining;
  g.direct(.8);
  close(neighbor.hp, 10000 - (110 * 1.2 + 40 + Math.min(90, remaining * 30)));
  assert.equal(host.statuses.infected, undefined); const state = [...g.skills.rootState.values()].find(r => r.bursts);
  assert.equal(state.bursts, 1);
});

test('CARRIER children never recursively spread, and overlapping same-root traces cannot reinfect', () => {
  const g = fixture('seed', { branch: 'carrier' }); const host = enemy(g); const child = enemy(g, 690, 350); const distant = enemy(g, 755, 350);
  g.skills.press(0); step(g, 1.11); assert.ok(child.statuses.infected);
  assert.equal(child.statuses.infected.originalHost, false); assert.deepEqual(child.statuses.infected.spreadTimes, []);
  step(g, 1.55); assert.equal(distant.statuses.infected, undefined);
  const rootId = host.statuses.infected.rootId; delete child.statuses.infected;
  assert.equal(g.skills.addStatus(child, 'infected', { rootId, child: true }), null);
});

test('Final bomb hold can cancel freely and RECORD replays saved hit positions', () => {
  const g = fixture('bomb', { branch: 'compression', evolution: 3 });
  const e = enemy(g, 600, 350); g.direct(0, 600, 350); g.cursor.x = 800;
  g.skills.press(0); step(g, .6); assert.equal(g.skills.recordPreview.length, 1);
  g.skills.cancelInput(); close(g.skillSlots[0].cd, 0);
  g.skills.press(0); step(g, .6); g.skills.release(0, .6); close(g.skillSlots[0].cd, 24);
  step(g, .93); close(e.hp, 10000 - 110 - 100);
});

test('CROSS NETWORK grants starting gauge and hits intersections once per tick', () => {
  const g = fixture('orbital', { evolution: 3 }); const e = enemy(g);
  step(g, .01); assert.equal(g.network, 50); g.network = 100;
  assert.equal(g.skills.crossNetwork(), true); assert.equal(g.network, 0); step(g, .2);
  close(e.hp, 9970); assert.ok(e.statuses.exposed); assert.equal(g.skills.crossNetwork(), false);
});

test('LIVING CIRCUIT accepts one chosen route and closes a real exposed origin', () => {
  const g = fixture('overcharge', { branch: 'fork', evolution: 3 }); const origin = enemy(g); enemy(g, 720, 350);
  g.skills.press(0); g.direct(0); assert.ok(g.skills.route);
  assert.equal(g.skills.press(0), true); assert.equal(g.skills.route, null);
  assert.ok(origin.statuses.exposed); assert.equal(g.skills.press(0), false);
});

test('REALITY FOLD validates B distance, telegraphs its 32px corridor, and then damages once', () => {
  const g = fixture('hole', { evolution: 3 }); const e = enemy(g, 810, 350);
  g.skills.press(0); g.cursor.x = 670; assert.equal(g.skills.press(0), true);
  assert.equal(g.fields.some(f => f.type === 'fold'), false);
  g.cursor.x = 850; assert.equal(g.skills.press(0), true);
  const fold = g.fields.find(f => f.type === 'fold'); assert.equal(fold.width, 32);
  step(g, .59); close(e.hp, 10000); step(g, .02); close(e.hp, 9800);
});

test('EPIDEMIC SCRIPT chooses recipients from the final 0.5s direction and does not recur in children', () => {
  const g = fixture('seed', { evolution: 3, branch: 'reservoir' }); const host = enemy(g);
  const north = enemy(g, 640, 240); const east = enemy(g, 760, 350);
  g.skills.press(0); g.direct(0); assert.ok(g.fields.find(f => f.type === 'cone'));
  g.cursor.y = 250; step(g, .51);
  assert.ok(north.statuses.infected); assert.equal(north.statuses.infected.originalHost, false);
  assert.equal(east.statuses.infected, undefined);
  assert.equal(host.statuses.infected, undefined);
});

test('Delayed Script detonates from the other slot once and refunds that cooldown by two seconds', () => {
  const g = fixture('seed'); const host = enemy(g);
  g.grantSkill('cut'); g.hybrid = 'delayed_script'; g.skills.press(0);
  g.skills.press(1); g.skills.release(1, .1);
  assert.equal(host.statuses.infected, undefined); close(g.skillSlots[1].cd, 9);
  assert.equal(g.skillSlots[1].delayedRefundUsed, true);
});

test('Quarantine Collapse holds outward spread and releases it at the hole boundary', () => {
  const g = fixture('seed'); g.grantSkill('hole'); g.hybrid = 'quarantine_collapse';
  enemy(g, 640, 350); const outside = enemy(g, 790, 350);
  g.skills.press(0); g.skills.press(1); step(g, 1.51);
  assert.equal(outside.statuses.infected, undefined); assert.equal(g.fields.find(f => f.type === 'hole').quarantine, 1);
  step(g, 1.5); assert.ok(outside.statuses.infected); assert.equal(outside.statuses.infected.originalHost, false);
});

test('noProc kills retain native infection burst damage while suppressing new chains, soil and transfers', () => {
  const g = fixture('seed', { evolution: 2, modifier: 'dormant_soil' });
  const host = enemy(g, 640, 350, 10), neighbor = enemy(g, 700, 350);
  const rootId = g.newRoot();
  g.skills.infect(host, g.skillSlots[0], rootId, { originalHost: true });
  g.skills.addStatus(host, 'mark', { rootId, returnCurrent: true });
  g.damage(host, 20, 'SKILL', { rootId, noProc: true });
  close(neighbor.hp, 9890);
  assert.equal(neighbor.statuses.infected, undefined);
  assert.equal(g.fields.some(f => f.type === 'soil'), false);
  assert.equal(g.skills.root(rootId).bursts, 1);
});

test('Anchor resists black-hole pull while still receiving its tick damage', () => {
  const g = fixture('hole'); const anchor = enemy(g, 740, 350, 10000, { type: 'anchor' });
  g.skills.press(0); step(g, .1);
  close(anchor.x, 740 - 140 * .35 * .1);
  step(g, .4); close(anchor.hp, 9985);
});
