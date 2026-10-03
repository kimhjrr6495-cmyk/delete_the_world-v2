import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';

function game(id = 'bomb') {
  const g = new Game(); g.start(id, 'standard', 763); g.enemies = [];
  Object.assign(g.stats, { power: 1, directBonus: 0, skillBonus: 0, summonBonus: 0, critChance: 0, cdr: 0, radiusBonus: 0 });
  g.autoTimer = g.spawnTimer = 999;
  g.skills.scoutTimer = g.skills.circuitTimer = 999;
  g.cursor.x = 640; g.cursor.y = 350;
  return g;
}
const enemy = (g, x = 640, y = 350, hp = 1000, extra = {}) => g.spawnEnemy('drifter', { x, y, hp, r: 8, speed: 0, ...extra });
const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < .001, `${actual} != ${expected}`);
function step(g, seconds) { for (let i = 0; i < Math.ceil(seconds * 100); i++) g.update(.01); }

test('After Cast adds 30% once, then exposes the surviving target after damage', () => {
  const g = game(); g.methods.add('after_cast'); const target = enemy(g);
  g.skills.press(0); g.direct(0);
  close(target.hp, 857); assert.equal(target.statuses.exposed.remaining, 2);
  assert.equal(g.afterCastUntil, 0);
  g.direct(0); close(target.hp, 714);
});

test('OVERCHARGE discharge does not receive the After Cast buff that it creates', () => {
  const g = game('overcharge'); g.methods.add('after_cast'); const target = enemy(g);
  g.skills.press(0); g.direct(0);
  close(target.hp, 845); assert.equal(target.statuses.exposed, undefined);
  assert.ok(g.afterCastUntil > g.time);
  g.direct(0); close(target.hp, 702); assert.ok(target.statuses.exposed);
});

test('Overkill uses only a direct primary kill, never a splash casualty', () => {
  const g = game(); g.methods.add('overkill'); const main = enemy(g);
  const splash = enemy(g, 672, 350, 10); const witness = enemy(g, 720, 350);
  g.direct(0);
  assert.equal(splash.dead, true); assert.equal(main.dead, false); close(witness.hp, 1000);
  assert.equal(g.effects.filter(f => f.kind === 'ring' && f.r === 55).length, 0);
});

test('Overkill converts actual primary excess damage into exactly one bounded burst', () => {
  const g = game(); g.methods.add('overkill'); const main = enemy(g, 640, 350, 20);
  const witness = enemy(g, 700, 350);
  g.direct(0); assert.equal(main.dead, true); close(witness.hp, 937);
  assert.equal(g.effects.filter(f => f.kind === 'ring' && f.r === 55).length, 1);
});

test('Anchor Heart heals only when a real channel is interrupted and respects its eight-second gate', () => {
  const g = game(); g.relics.push('anchor_heart'); g.integrity = 50;
  const target = enemy(g, 640, 350, 1000, { type: 'channeler', channel: 0 });
  g.direct(0); close(g.integrity, 50); assert.equal(g.metrics.interrupts, 0);
  target.channel = 1.4; g.direct(0); close(g.integrity, 53); assert.equal(g.metrics.interrupts, 1);
  g.charges = 1; target.channel = 1.4; g.direct(0); close(g.integrity, 53); assert.equal(g.metrics.interrupts, 2);
});

test('Parasite Hive rejects the passive scout and infects only two active-command survivors', () => {
  const g = game('orbital'); g.hybrid = 'parasite_hive'; g.skills.press(0);
  const command = g.fields.find(f => f.type === 'command');
  const first = enemy(g), second = enemy(g, 660, 350), third = enemy(g, 680, 350);
  g.damage(first, 25, 'SUMMON', { rootId: g.newRoot(), effectId: 'orbital_scout', tag: 'SWARM' });
  assert.equal(first.statuses.infected, undefined);
  for (const e of [first, second, third]) g.damage(e, 55, 'SUMMON', { rootId: command.rootId, effectId: 'orbital_command', tag: 'SWARM' });
  assert.ok(first.statuses.infected && second.statuses.infected); assert.equal(third.statuses.infected, undefined);
  assert.equal(first.statuses.infected.originalHost, false);
  close(first.statuses.infected.damage, 25 * .65);
  assert.equal(command.parasites, 2);
});

test('Echo Order accepts a first hole tick once and launches from that hit position snapshot', () => {
  const g = game('orbital'); g.grantSkill('hole'); g.hybrid = 'echo_order';
  g.cursor.x = 480; g.skills.press(0); g.skills.press(1);
  const hole = g.fields.find(f => f.type === 'hole');
  const first = enemy(g, 600, 350); const witness = enemy(g, 640, 350);
  step(g, .51);
  assert.equal(g.echoRoot, hole.rootId); assert.equal(g.jobs.length, 1);
  g.damage(first, 15, 'SKILL', { rootId: hole.rootId, tag: 'SINGULARITY', tick: true });
  assert.equal(g.jobs.length, 1);
  first.x = 950; step(g, .41);
  close(witness.hp, 950);
  assert.equal(g.jobs.length, 0);
});

test('Contagion Circuit cannot exceed two copies across multiple arcs of one root', () => {
  const g = game('overcharge'); g.hybrid = 'contagion_circuit';
  const pairs = [100, 500, 900].map(x => [enemy(g, x, 350, 10000), enemy(g, x + 80, 350, 10000)]);
  for (const [host] of pairs) g.skills.addStatus(host, 'infected', { rootId: g.newRoot(), originalHost: true });
  const rootId = g.newRoot();
  for (const [host] of pairs) g.arc(host.x, host.y, 2, [1, 1], { rootId, tag: 'CHAIN', chain: true });
  assert.ok(pairs[0][1].statuses.infected && pairs[1][1].statuses.infected);
  assert.equal(pairs[2][1].statuses.infected, undefined);
  assert.equal(g.root(rootId).contagionCopies, 2);
  assert.equal(pairs[0][1].statuses.infected.noCopy, true);
});
