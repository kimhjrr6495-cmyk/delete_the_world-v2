import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';

function chooseAll(game, contexts = []) {
  let guard = 0;
  while (game.phase === 'choice') {
    assert.ok(++guard < 20, 'A reward must not recursively reopen forever.');
    contexts.push(game.choiceContext);
    const rank = c => c.kind === 'branch' || c.kind === 'modifier' ? 100 : c.kind === 'evolution' && c.slotIndex === 0 ? 90 : c.kind === 'skill' && c.skillId === 'orbital' ? 80 : c.selection === 'stable_supply' ? 75 : c.kind === 'stat' ? 60 : 0;
    const choice = [...game.choices].sort((a, b) => rank(b) - rank(a))[0];
    assert.ok(choice, 'Choice screens always contain an applicable reward.');
    assert.equal(game.choose(choice.id), true);
  }
}

for (const mode of ['standard', 'expedition']) {
  test(`${mode}: the entire world schedule delivers two skills, three cores, and the final win exactly once`, () => {
    let ends = 0;
    const game = new Game({ onEvent: name => { if (name === 'end') ends++; } });
    game.start('overcharge', mode, 4876);
    const contexts = [], bosses = [], bossIds = new Set();
    const at = {};
    // This is a scheduling harness, not a balance bot: actual skills are used,
    // then the remaining enemies are removed through the real damage/reward API.
    for (let frames = 0; frames < 13000 && game.phase !== 'ended'; frames++) {
      chooseAll(game, contexts);
      const before = new Set(game.eventsDone);
      game.update(.1);
      for (const id of game.eventsDone) if (!before.has(id)) at[id] = game.time;
      if (game.boss && !bossIds.has(game.boss.id)) { bosses.push(game.boss.type); bossIds.add(game.boss.id); }
      if (game.phase === 'playing') {
        const target = game.enemies.find(e => !e.dead && e.boss) || game.enemies.find(e => !e.dead);
        if (target) {
          game.cursor.x = target.x; game.cursor.y = target.y;
          game.skills.press(0);
          if (game.charges) game.direct(.8);
        }
        for (const enemy of [...game.enemies]) if (!enemy.dead) game.damage(enemy, 1e6, 'AUTO', { rootId: game.newRoot(), tag: 'CASTER' });
      }
      assert.ok(Number.isFinite(game.integrity) && Number.isFinite(game.xp) && Number.isFinite(game.pressure));
    }
    assert.equal(game.result?.won, true);
    assert.equal(ends, 1);
    assert.deepEqual(bosses, ['archivist', 'conductor', 'reality']);
    assert.equal(game.skillSlots.length, 2);
    assert.equal(game.skillSlots[0].evolution, 3);
    assert.equal(contexts.filter(c => c === 'second-skill').length, 1);
    assert.equal(contexts.filter(c => c === 'evolution').length, 3);
    for (const [id, worldAt] of Object.entries({ skill2: 210, boss1: 480, route: 540, relic1: 570, hybrid: 690, boss2: 780, relic2: 840, rift: 960, final: 1080 })) {
      assert.ok(Math.abs(at[id] * game.pace - worldAt) <= .31, `${id} at world ${at[id] * game.pace}, expected ${worldAt}`);
    }
    assert.ok(game.result.duration >= 1080 / game.pace && game.result.duration < 1080 / game.pace + .2);
    const result = game.result;
    game.end(false, 'duplicate'); game.update(1);
    assert.equal(game.result, result); assert.equal(ends, 1);
  });
}

test('Railgun Scar uses actual remaining-HP overkill rather than max HP', () => {
  const game = new Game(); game.start('cut', 'standard', 86); game.enemies = [];
  game.hybrid = 'railgun_scar'; game.stats.critChance = 0;
  game.stats.power = 1; game.stats.directBonus = 0; game.stats.skillBonus = 0;
  const target = game.spawnEnemy('drifter', { x: 640, y: 350, hp: 20 }); target.maxHp = 220;
  const next = game.spawnEnemy('drifter', { x: 760, y: 350, hp: 1000 });
  game.cursor.x = 640; game.cursor.y = 350; game.cursor.dx = 100; game.cursor.dy = 0;
  game.direct(.8);
  assert.equal(target.dead, true);
  assert.equal(next.hp, 900, 'A 165 hit against 20 remaining HP has 145 overkill and must create the rail.');
});

test('reward screens freeze real time and drain queued rewards without losing a core', () => {
  const game = new Game(); game.start('seed', 'standard', 45);
  game.queueReward('level'); game.queueReward('relic'); game.queueReward('evolution');
  const t = game.time, contexts = [];
  game.update(10); assert.equal(game.time, t);
  chooseAll(game, contexts);
  assert.ok(contexts.includes('level') && contexts.includes('relic') && contexts.includes('evolution'));
  assert.equal(game.phase, 'playing'); assert.equal(game.rewardQueue.length, 0);
  assert.equal(game.skillSlots[0].evolution, 1);
});

test('the final boss survives the normal-enemy cap and cannot be lost by the one-shot schedule', () => {
  const game = new Game(); game.start('seed', 'standard', 8); game.enemies = [];
  game.time = 1079.99; game.worldTime = game.time;
  // Prevent an unrelated historical reward from interrupting this exact event.
  for (const id of ['first-threat', 'skill2', 'boss1', 'route', 'relic1', 'hybrid', 'boss2', 'relic2', 'rift', 'reserve-expiry', 'adapt-preview-0', 'adapt-0', 'adapt-preview-1', 'adapt-1', 'adapt-preview-2', 'adapt-2']) game.eventsDone.add(id);
  for (let i = 0; i < 180; i++) game.spawnEnemy('drifter', { x: 20, y: 20, hp: 10000, speed: 0 });
  game.autoTimer = 999; game.cursor.x = 1250; game.cursor.y = 730;
  game.update(.1);
  assert.ok(game.eventsDone.has('final'));
  assert.equal(game.boss?.type, 'reality', 'Crowd saturation must not permanently skip the mandatory final boss.');
});

test('interrupting a final-boss volley cancels every warning in that volley', () => {
  const game = new Game(); game.start('cut', 'standard', 6); game.enemies = [];
  game.spawnBoss('reality'); const boss = game.boss;
  boss.hp = boss.maxHp * .2; boss.aiTimer = 0; game.update(.1);
  assert.equal(game.dangers.filter(d => d.bossId === boss.id).length, 2);
  game.cursor.x = boss.x; game.cursor.y = boss.y; game.direct(0);
  assert.equal(game.dangers.filter(d => d.bossId === boss.id).length, 0, 'The stated interruption must not leave an uninterruptible secondary warning.');
});

for (const mode of ['standard', 'expedition']) {
  test(`${mode}: the final boss has a real 120-second combat deadline`, () => {
    const game = new Game(); game.start('seed', mode, 213); game.enemies = [];
    game.time = 1080 / game.pace; game.worldTime = 1080;
    game.integrity = game.maxIntegrity = 100000;
    game.cursor.x = 20; game.cursor.y = 730;
    for (const id of ['first-threat', 'skill2', 'boss1', 'route', 'relic1', 'hybrid', 'boss2', 'relic2', 'rift', 'reserve-expiry', 'final', 'adapt-preview-0', 'adapt-0', 'adapt-preview-1', 'adapt-1', 'adapt-preview-2', 'adapt-2']) game.eventsDone.add(id);
    game.spawnBoss('reality');
    const started = game.time;
    for (let i = 0; i < 1199; i++) game.update(.1);
    assert.equal(game.phase, 'playing');
    for (let i = 0; i < 3; i++) game.update(.1);
    assert.equal(game.phase, 'ended'); assert.equal(game.result.won, false);
    assert.ok(game.result.duration - started >= 120 && game.result.duration - started < 120.21);
    assert.match(game.result.cause, /최종 봉합 시간/);
  });
}
