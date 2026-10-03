import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';

function fixture(id, config = {}) {
  const game = new Game();
  game.start(id, 'standard', 123);
  game.enemies = [];
  Object.assign(game.stats, { power: 1, directBonus: 0, skillBonus: 0, summonBonus: 0, cdr: 0, critChance: 0, radiusBonus: 0 });
  Object.assign(game.skillSlots[0], config);
  game.cursor.x = 640; game.cursor.y = 350;
  game.skills.scoutTimer = 999; game.skills.circuitTimer = 999;
  return game;
}
function enemy(game, x = 640, y = 350, extra = {}) {
  return game.spawnEnemy('drifter', { x, y, hp: 10000, maxHp: 10000, r: 8, speed: 0, ...extra });
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
const close = (actual, expected, epsilon = .001) => assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

for (const id of ['overcharge', 'bomb', 'hole', 'cut', 'orbital', 'seed']) {
  test(`${id}: selecting, key release and cancellation never cast or spend resources`, () => {
    const game = fixture(id), target = enemy(game);
    const before = { roots: game.rootId, charges: game.charges, casts: game.metrics.skillsUsed, hp: target.hp };
    assert.equal(game.skills.beginTarget(0), true);
    const first = game.skills.targetingPreview;
    assert.equal(first.id, id); assert.ok(first.targets.includes(target.id));
    // The caller cannot move a world object by editing the returned geometry.
    first.x = -999; first.targets.length = 0;
    assert.notEqual(game.skills.targetingPreview.x, -999);
    assert.equal(game.skills.releaseTargetKey(0), true);
    step(game, 3);
    assert.ok(game.skills.targeting); assert.equal(game.skillSlots[0].cd, 0);
    assert.equal(game.fields.length, 0); assert.equal(game.skills.armed, null); assert.equal(game.skills.held, null);
    assert.equal(game.rootId, before.roots); assert.equal(game.charges, before.charges);
    assert.equal(game.metrics.skillsUsed, before.casts); assert.equal(target.hp, before.hp);
    assert.equal(game.skills.cancelTarget(), true); assert.equal(game.skills.cancelTarget(), false);
    assert.equal(game.skills.targetingPreview, null);
  });
}

test('cooldown gating and input cleanup preserve the current usable selection', () => {
  const game = fixture('bomb'); game.grantSkill('hole'); game.skillSlots[1].cd = 8;
  assert.equal(game.skills.beginTarget(0), true);
  assert.equal(game.skills.beginTarget(1), false);
  assert.equal(game.skills.targeting.id, 'bomb');
  game.cancelInputs(); assert.equal(game.skills.targeting, null);
  game.phase = 'paused'; assert.equal(game.skills.beginTarget(0), false);
});

test('bomb projection shares the compression radius and world position of the actual explosion', () => {
  const game = fixture('bomb', { branch: 'compression' });
  const center = enemy(game), outer = enemy(game, 690), outside = enemy(game, 706);
  game.skills.beginTarget(0);
  const preview = game.skills.targetingPreview;
  assert.equal(preview.r, 55); assert.deepEqual(preview.targets, [center.id, outer.id]);
  assert.equal(game.skills.confirmTarget(), true);
  const bomb = game.fields[0]; assert.deepEqual([bomb.x, bomb.y, bomb.r], [preview.x, preview.y, preview.r]);
  game.cursor.x = 120; game.cursor.y = 50;
  step(game, .81);
  close(center.hp, 9660); close(outer.hp, 9796); close(outside.hp, 10000);
  close(game.skillSlots[0].cd, 11.19); assert.equal(game.charges, 2);
});

test('twin hole projection matches both actual pull volumes and neither follows cursor movement', () => {
  const game = fixture('hole', { branch: 'twin' });
  const left = enemy(game, 570), right = enemy(game, 710);
  game.skills.beginTarget(0); const preview = game.skills.targetingPreview;
  assert.deepEqual(preview.circles.map(c => [c.x, c.y, c.r]), [[570, 350, 85], [710, 350, 85]]);
  assert.deepEqual(preview.targets, [left.id, right.id]);
  game.skills.confirmTarget(); game.cursor.x = 120; game.cursor.y = 50;
  step(game, .51);
  assert.deepEqual(game.fields.map(f => [f.x, f.y, f.r]), preview.circles.map(c => [c.x, c.y, c.r]));
  close(left.hp, 9989.5); close(right.hp, 9989.5);
});

test('cut mouse displacement changes the actual lattice path, without needing a key hold', () => {
  const game = fixture('cut', { branch: 'lattice' });
  const onPath = enemy(game, 640, 490), horizontal = enemy(game, 800, 350);
  game.skills.beginTarget(0); game.skills.releaseTargetKey(0);
  game.cursor.y = 460;
  const preview = game.skills.targetingPreview;
  close(preview.angle, Math.PI / 2); assert.equal(preview.x, 640); assert.equal(preview.y, 350);
  assert.equal(preview.lines.length, 3); assert.ok(preview.targets.includes(onPath.id));
  assert.equal(preview.targets.includes(horizontal.id), false);
  game.skills.confirmTarget(); close(onPath.hp, 9870); close(horizontal.hp, 10000);
  const drawn = game.effects.filter(f => f.kind === 'slash');
  assert.deepEqual(drawn.map(f => [f.x, f.y, f.toX, f.toY, f.width]), preview.lines.map(l => [l.x, l.y, l.x2, l.y2, l.width]));
});

test('orbital previews snap to the actual watchtower or hunter world location', () => {
  for (const branch of ['watchtower', 'hunter']) {
    const game = fixture('orbital', { branch });
    const target = enemy(game, branch === 'watchtower' ? 320 : 700, branch === 'watchtower' ? 390 : 350, { type: 'channeler', channel: 1, anchorIndex: 0 });
    game.cursor.x = branch === 'watchtower' ? 330 : 650;
    game.skills.beginTarget(0); const preview = game.skills.targetingPreview;
    assert.equal(preview.x, target.x); assert.equal(preview.y, target.y); assert.equal(preview.r, 90);
    assert.deepEqual(preview.targets, [target.id]);
    game.skills.confirmTarget(); const command = game.fields[0];
    assert.deepEqual([command.x, command.y, command.r], [preview.x, preview.y, preview.r]);
    assert.ok(command.shots.every(shot => shot.sourceY < 0));
    game.cursor.x = 50; game.cursor.y = 50; step(game, .61);
    assert.deepEqual([command.x, command.y], [preview.x, preview.y]);
    close(target.hp, 9945);
  }
});

test('seed selects the actual nearest host or creates a fixed world seed when empty', () => {
  const game = fixture('seed'), host = enemy(game, 670), farther = enemy(game, 681);
  game.skills.beginTarget(0); assert.deepEqual(game.skills.targetingPreview.targets, [host.id]);
  game.skills.confirmTarget(); assert.ok(host.statuses.infected); assert.equal(farther.statuses.infected, undefined);
  const empty = fixture('seed'); empty.skills.beginTarget(0); const preview = empty.skills.targetingPreview;
  empty.skills.confirmTarget(); empty.cursor.x = 10; empty.cursor.y = 10; step(empty, 1);
  assert.deepEqual([empty.fields[0].x, empty.fields[0].y], [preview.x, preview.y]);
});

test('overcharge shows the same greedy sequence as discharge, excluding direct splash targets', () => {
  const game = fixture('overcharge', { branch: 'fork' });
  const primary = enemy(game), splash = enemy(game, 660), first = enemy(game, 725), second = enemy(game, 820), distant = enemy(game, 1100);
  game.skills.beginTarget(0);
  assert.deepEqual(game.skills.targetingPreview.chain.map(e => e.id), [primary.id, first.id, second.id]);
  assert.equal(game.skills.confirmTarget(), true); assert.equal(game.charges, 1);
  close(primary.hp, 9845); close(splash.hp, 9960); close(first.hp, 9951); close(second.hp, 9961.5); close(distant.hp, 10000);
  const arcs = game.effects.filter(f => f.kind === 'arc');
  assert.deepEqual(arcs.map(f => [f.toX, f.toY]), [[first.x, first.y], [second.x, second.y]]);
  assert.ok(arcs[1].delay > arcs[0].delay); assert.ok(game.effects.some(f => f.kind === 'discharge' && f.x === second.x));
});

test('overcharge invalid clicks remain in preview and charged confirmation uses the actual wider radius', () => {
  const game = fixture('overcharge'); enemy(game, 690);
  game.skills.beginTarget(0); assert.equal(game.skills.targetingPreview.valid, false);
  assert.equal(game.skills.confirmTarget(), false); assert.equal(game.charges, 2); assert.equal(game.skillSlots[0].cd, 0);
  assert.ok(game.skills.targeting);
  assert.equal(game.skills.confirmTarget(.8), true); assert.equal(game.charges, 1);
  const empty = fixture('overcharge'); enemy(empty); empty.charges = 0;
  empty.skills.beginTarget(0); assert.equal(empty.skills.confirmTarget(), false);
  assert.equal(empty.metrics.skillsUsed, 0); assert.equal(empty.skillSlots[0].cd, 0);
});

test('marked direct target previews its earlier mark arc and excludes that hit from the new discharge', () => {
  const game = fixture('overcharge', { evolution: 1 });
  const primary = enemy(game), markedArc = enemy(game, 715, 350), newArc = enemy(game, 640, 430);
  game.skills.addStatus(primary, 'mark', { rootId: game.newRoot(), originPosition: { x: 400, y: 350 }, returnCurrent: false });
  const priorRootId = game.rootId;
  game.skills.beginTarget(0); const preview = game.skills.targetingPreview;
  assert.deepEqual(preview.preChain.map(e => e.id), [primary.id, markedArc.id]);
  assert.deepEqual(preview.chain.map(e => e.id), [primary.id, newArc.id]);
  assert.equal(preview.conditional, false); assert.equal(game.rootId, priorRootId);
  game.skills.confirmTarget();
  close(markedArc.hp, 9940); close(newArc.hp, 9930);
  const arcs = game.effects.filter(f => f.kind === 'arc');
  assert.deepEqual(arcs.map(f => [f.x, f.y, f.toX, f.toY]), [[primary.x, primary.y, markedArc.x, markedArc.y], [primary.x, primary.y, newArc.x, newArc.y]]);
  assert.deepEqual(preview.targets, [primary.id, newArc.id, markedArc.id]);
});

test('marked origin echo damage geometry is excluded before previewing the new discharge', () => {
  const game = fixture('overcharge'); game.methods.add('origin_echo');
  const primary = enemy(game), markHit = enemy(game, 715, 350), echoHit = enemy(game, 640, 425), next = enemy(game, 555, 350);
  game.skills.addStatus(primary, 'mark', { rootId: game.newRoot(), originPosition: { x: 640, y: 440 }, returnCurrent: false });
  game.skills.beginTarget(0); const preview = game.skills.targetingPreview;
  assert.deepEqual(preview.preChain.map(e => e.id), [primary.id, markHit.id]);
  assert.deepEqual(preview.preCircles, [{ x: 640, y: 440, r: 50, kind: 'origin-echo' }]);
  assert.deepEqual(preview.chain.map(e => e.id), [primary.id, next.id]);
  assert.ok(preview.targets.includes(echoHit.id));
  game.skills.confirmTarget(); close(markHit.hp, 9940); close(echoHit.hp, 9935); close(next.hp, 9930);
  assert.deepEqual(game.effects.filter(f => f.kind === 'arc').map(f => [f.toX, f.toY]), [[markHit.x, markHit.y], [next.x, next.y]]);
});

test('an additional death-triggered burst is explicitly a conditional arc forecast', () => {
  const game = fixture('overcharge'); const primary = enemy(game);
  game.skills.addStatus(primary, 'infected', { rootId: game.newRoot(), child: true });
  game.skills.beginTarget(0); assert.equal(game.skills.targetingPreview.conditional, true);
  assert.equal(game.charges, 2); assert.equal(primary.hp, 10000);
});

test('Final bomb records persist after keyup until explicit confirmation and replay the saved positions', () => {
  const game = fixture('bomb', { evolution: 3, branch: 'compression' });
  const target = enemy(game, 600); game.direct(0, 600, 350); game.cursor.x = 850;
  game.skills.beginTarget(0); step(game, .6); game.skills.releaseTargetKey(0);
  step(game, 2); const preview = game.skills.targetingPreview;
  close(game.skills.targeting.heldSeconds, .6); assert.equal(game.fields.length, 0);
  assert.equal(preview.r, 110); assert.equal(preview.records.length, 1);
  assert.deepEqual(preview.circles[1], { x: 600, y: 350, r: 22, kind: 'record' });
  game.skills.confirmTarget(); close(game.skillSlots[0].cd, 24); step(game, .93);
  close(target.hp, 9790);
});

test('Final circuit recast previews root exclusions and waits for a chosen world point', () => {
  const game = fixture('overcharge', { evolution: 3 });
  enemy(game); enemy(game, 725); const next = enemy(game, 930);
  game.skills.beginTarget(0); game.skills.confirmTarget(); assert.ok(game.skills.route);
  const castCount = game.metrics.skillsUsed, cd = game.skillSlots[0].cd;
  game.cursor.x = 900; game.skills.beginTarget(0);
  assert.equal(game.skills.targeting.mode, 'circuit'); assert.deepEqual(game.skills.targetingPreview.targets, [next.id]);
  step(game, 3); close(next.hp, 10000); assert.ok(game.skills.route);
  game.skills.confirmTarget(); close(next.hp, 9950); assert.equal(game.skills.route, null);
  assert.equal(game.metrics.skillsUsed, castCount); close(game.skillSlots[0].cd, cd - 3);
});

test('Final hole fold rejects an invalid endpoint without mutation, then confirms its actual corridor', () => {
  const game = fixture('hole', { evolution: 3 }); enemy(game, 800);
  game.skills.beginTarget(0); game.skills.confirmTarget(); const castCount = game.metrics.skillsUsed;
  game.cursor.x = 670; game.skills.beginTarget(0);
  assert.equal(game.skills.targeting.mode, 'hole-fold'); assert.equal(game.skills.targetingPreview.valid, false);
  assert.equal(game.skills.confirmTarget(), false); assert.equal(game.skills.activeHoleGroup.folded, false);
  assert.equal(game.fields.some(f => f.type === 'fold'), false);
  game.cursor.x = 850; const preview = game.skills.targetingPreview;
  assert.equal(preview.valid, true); game.skills.confirmTarget();
  const fold = game.fields.find(f => f.type === 'fold'), line = preview.lines[0];
  assert.deepEqual([fold.x, fold.y, fold.x2, fold.y2, fold.width], [line.x, line.y, line.x2, line.y2, line.width]);
  assert.equal(game.metrics.skillsUsed, castCount);
});

test('evolved twin hole movement is capped at the preview endpoint and moves both holes equally', () => {
  const game = fixture('hole', { branch: 'twin', evolution: 2 });
  game.skills.beginTarget(0); game.skills.confirmTarget(); const before = game.fields.map(f => ({ x: f.x, y: f.y }));
  game.cursor.x = 1040; game.skills.beginTarget(0); const preview = game.skills.targetingPreview;
  assert.equal(preview.mode, 'hole-move'); assert.equal(preview.x, 820);
  assert.deepEqual(game.fields.map(f => ({ x: f.x, y: f.y })), before);
  game.skills.confirmTarget(); assert.deepEqual(game.fields.map(f => [f.x, f.y, f.r]), preview.circles.map(c => [c.x, c.y, c.r]));
  assert.equal(game.metrics.skillsUsed, 1);
});

test('Final sweep movement and orbital redirect require confirmation and keep one cast accounting', () => {
  const cut = fixture('cut', { evolution: 3 });
  cut.skills.beginTarget(0); cut.skills.confirmTarget(); const sweep = cut.fields[0];
  cut.cursor.x = 1000; cut.skills.beginTarget(0); const preview = cut.skills.targetingPreview;
  assert.equal(preview.mode, 'sweep-move'); assert.equal(sweep.x, 640);
  cut.skills.confirmTarget(); assert.equal(sweep.x, preview.x); assert.equal(sweep.moved, true); assert.equal(cut.metrics.skillsUsed, 1);
  const orbital = fixture('orbital', { evolution: 2 }); enemy(orbital);
  orbital.skills.beginTarget(0); orbital.skills.confirmTarget(); step(orbital, .31);
  const command = orbital.fields[0], shot = command.shots[0], locked = [shot.x, shot.y];
  assert.equal(shot.locked, true); orbital.cursor.x = 900; orbital.skills.beginTarget(0);
  assert.equal(orbital.skills.targeting.mode, 'command-redirect'); assert.equal(command.x, 640);
  orbital.skills.confirmTarget(); assert.equal(command.x, 900); assert.deepEqual([shot.x, shot.y], locked);
  orbital.cursor.x = 20; step(orbital, .1); assert.equal(command.x, 900); assert.equal(orbital.metrics.skillsUsed, 1);
});

test('Final seed propagation is independent of cursor until an explicit directional recast', () => {
  const game = fixture('seed', { evolution: 3, branch: 'reservoir' });
  enemy(game); const north = enemy(game, 640, 240), east = enemy(game, 760, 350);
  game.skills.beginTarget(0); game.skills.confirmTarget(); game.direct(0);
  const cone = game.fields.find(f => f.type === 'cone'); assert.ok(cone); assert.equal(cone.explicitSteering, true);
  game.cursor.y = 240; step(game, .1); close(cone.angle, 0);
  game.skills.beginTarget(0); assert.equal(game.skills.targeting.mode, 'seed-steer');
  assert.deepEqual(game.skills.targetingPreview.targets, [north.id]);
  step(game, 1); assert.equal(north.statuses.infected, undefined); assert.equal(cone.removed, undefined);
  game.skills.confirmTarget(); game.cursor.x = 760; game.cursor.y = 350; step(game, .41);
  assert.ok(north.statuses.infected); assert.equal(east.statuses.infected, undefined); assert.equal(game.metrics.skillsUsed, 1);
});

test('network and cross gravity remain at the cast coordinates after the cursor leaves', () => {
  const game = fixture('orbital', { evolution: 3 }); game.grantSkill('hole');
  const intersection = enemy(game), cursorEnemy = enemy(game, 100, 100);
  game.network = 100; assert.equal(game.skills.crossNetwork(), true); const network = game.fields[0];
  game.skills.placeHole(game.skillSlots[1], { x: 300, y: 350 }, game.newRoot());
  const hole = game.fields.find(f => f.type === 'hole'); game.cursor.x = 100; game.cursor.y = 100;
  game.updateCrossGravity(.5); close(hole.x, 360); close(hole.y, 350);
  step(game, .2); assert.deepEqual([network.x, network.y], [640, 350]);
  close(intersection.hp, 9970); close(cursorEnemy.hp, 10000);
});
