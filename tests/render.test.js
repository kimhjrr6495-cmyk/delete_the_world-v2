import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { Renderer } from '../src/render.js';
import { SKILLS, ENEMIES } from '../src/data.js';

function fakeCanvas(scale = 2) {
  const trace = { texts: [], strokes: [], arcs: [], operations: [] };
  const state = { globalAlpha: 1, lineWidth: 1, strokeStyle: '#000', fillStyle: '#000', dash: [] };
  const stack = [];
  let path = [];
  const numeric = (name, args) => {
    for (const value of args) if (typeof value === 'number') assert.ok(Number.isFinite(value), `${name} received ${value}`);
  };
  const methods = {
    save() { stack.push({ ...state, dash: [...state.dash] }); },
    restore() { assert.ok(stack.length, 'Unbalanced Canvas restore'); Object.assign(state, stack.pop()); },
    beginPath() { path = []; },
    setLineDash(dash) { numeric('setLineDash', dash); state.dash = [...dash]; },
    moveTo(...args) { numeric('moveTo', args); path.push(['moveTo', ...args]); },
    lineTo(...args) { numeric('lineTo', args); path.push(['lineTo', ...args]); },
    arc(...args) {
      numeric('arc', args); assert.ok(args[2] >= 0, 'Negative arc radius');
      path.push(['arc', ...args]); trace.arcs.push({ args, style: state.strokeStyle, alpha: state.globalAlpha });
    },
    stroke() { trace.strokes.push({ path: path.map(p => [...p]), style: state.strokeStyle, width: state.lineWidth, dash: [...state.dash], alpha: state.globalAlpha }); },
    fillText(text, x, y) { numeric('fillText', [x, y]); trace.texts.push({ text: String(text), x, y, style: state.fillStyle, alpha: state.globalAlpha }); },
    createRadialGradient(...args) { numeric('createRadialGradient', args); return { addColorStop(position) { assert.ok(Number.isFinite(position) && position >= 0 && position <= 1); } }; },
  };
  const ctx = new Proxy(state, {
    get(target, key) {
      if (methods[key]) return methods[key];
      if (key in target) return target[key];
      return (...args) => { numeric(key, args); trace.operations.push([key, ...args]); };
    },
    set(target, key, value) {
      if (key === 'globalAlpha') assert.ok(Number.isFinite(value) && value >= 0 && value <= 1, `Invalid opacity ${value}`);
      if (key === 'lineWidth') assert.ok(Number.isFinite(value) && value > 0, `Invalid line width ${value}`);
      target[key] = value; return true;
    },
  });
  return { width: 1280 * scale, height: 760 * scale, getContext: () => ctx, trace, stack };
}

function snapshot(value) {
  const seen = new WeakSet();
  return JSON.stringify(value, (key, item) => {
    if (typeof item === 'function') return `[function:${item.name}]`;
    if (item instanceof Set) return { set: [...item] };
    if (item instanceof Map) return { map: [...item] };
    if (item && typeof item === 'object') {
      if (seen.has(item)) return '[circular]';
      seen.add(item);
    }
    return item;
  });
}

function deepFreeze(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  if (value instanceof Map || value instanceof Set) for (const item of value.values()) deepFreeze(item, seen);
  else for (const item of Object.values(value)) deepFreeze(item, seen);
  Object.freeze(value);
}

function fixture(id = 'overcharge', settings = {}) {
  const game = new Game({ settings });
  game.start(id, 'standard', 12345);
  game.enemies = []; game.effects = [];
  game.cursor.x = 640; game.cursor.y = 350;
  game.skills.scoutTimer = 999; game.skills.circuitTimer = 999;
  game.stats.critChance = 0;
  for (let i = 0; i < 6; i++) game.spawnEnemy('drifter', { x: 640 + i * 28, y: 350 + i * 13, hp: 10000, maxHp: 10000, speed: 0 });
  return game;
}

function stableDraw(game, scale = 2) {
  const before = snapshot(game);
  deepFreeze(game);
  const canvas = fakeCanvas(scale), renderer = new Renderer(canvas);
  renderer.draw(game, 1 / 60); renderer.draw(game, 1 / 60);
  assert.equal(snapshot(game), before, 'Rendering changed combat state');
  assert.equal(canvas.stack.length, 0, 'Canvas save/restore did not balance');
  assert.ok(canvas.trace.strokes.length, 'Arena produced no geometry');
  return canvas.trace;
}

const settingsCases = [
  ['normal', {}],
  ['reduced motion and effects', { reducedMotion: true, lowEffects: true }],
  ['high contrast', { highContrast: true }],
];

for (const skill of SKILLS) for (const evolution of [0, 3]) for (const [mode, settings] of settingsCases) {
  test(`${skill.name} ${evolution ? 'Final' : 'Base'} renders real skill state with ${mode} and no combat mutation`, () => {
    const game = fixture(skill.id, settings), slot = game.skillSlots[0];
    slot.evolution = evolution;
    if (evolution) slot.branch = skill.branches[0].id;
    if (skill.id === 'bomb' && evolution) game.skills.history = [{ x: 480, y: 290, time: 0 }, { x: 760, y: 440, time: 0 }];
    assert.equal(game.skills.press(0), true);
    if (skill.id === 'cut') {
      game.cursor.x += 30; game.cursor.y += 20;
      game.skills.release(0, .4);
    } else if (skill.id === 'bomb' && evolution) game.skills.release(0, .7);
    else if (skill.id === 'overcharge') game.direct(0);
    else if (skill.id === 'orbital' && evolution) { game.network = 100; assert.equal(game.skills.crossNetwork(), true); }
    else if (skill.id === 'seed' && evolution) game.direct(.8);
    game.cursor.down = true; game.cursor.hold = 1.2;
    stableDraw(game);
  });
}

test('all eight enemy roles, three bosses, statuses, effects and fields render finite geometry', () => {
  const game = fixture('hole', { reducedMotion: true, lowEffects: true, highContrast: true });
  game.enemies = []; game.effects = [];
  const types = [...Object.keys(ENEMIES), 'archivist', 'conductor', 'reality'];
  types.forEach((type, i) => {
    const enemy = game.spawnEnemy(type, { x: 90 + i * 95, y: 240, hp: 600, maxHp: 1000, boss: i >= 8, r: i >= 8 ? 42 : 14, elite: i === 1, phaseIndex: 2, purifying: type === 'scrubber', age: 6, shield: 20, maxShield: 40, adaptation: 'CHAIN', weakness: 'IMPACT' });
    for (const status of ['mark', 'infected', 'exposed', 'rupture', 'burn', 'strain', 'stroke', 'lease']) game.status(enemy, status, { remaining: 2, duration: 3, stacks: 3 });
  });
  game.fields = ['bomb', 'hole', 'residue', 'fire', 'command', 'seed', 'soil', 'seam', 'sweep', 'fold', 'trail', 'cone', 'network', 'future-field'].map((type, i) => ({
    id: i, type, x: 160 + i * 70, y: 500, r: 50, age: .2, duration: .8, remaining: .6, color: '#A67CFF', rootId: 1,
    width: 24, x2: 800, y2: 580, angle: .4, mass: 3, length: 400, lattice: true, startDelay: .4,
    shots: [{ x: 400, y: 480, at: .4, r: 44, locked: true }], slot: game.skillSlots[0], records: type === 'bomb' ? [{ x: 400, y: 410 }] : null,
  }));
  for (const kind of ['ring', 'line', 'arc', 'burst', 'text', 'slash', 'spawn', 'heal', 'hit', 'marker', 'future-effect']) game.fx(kind, { x: 640, y: 400, toX: 800, toY: 580, r: 40, angle: .4, width: 26, life: .3, text: 'TEST' });
  game.addDanger({ type: 'circle', x: 500, y: 500, r: 65, age: .4, duration: 1.2, remaining: .8, label: 'DANGER CIRCLE' });
  game.addDanger({ type: 'line', x: 100, y: 100, x2: 1100, y2: 600, width: 32, duration: 1.2, remaining: .5, label: 'DANGER LINE' });
  stableDraw(game, 1);
});

test('danger and cursor signals survive effect overload and render after cosmetic damage', () => {
  const game = fixture('overcharge', { lowEffects: true, reducedMotion: true });
  game.effects = [];
  for (let i = 0; i < 300; i++) game.fx('burst', { x: 640, y: 350, r: 36 });
  game.fx('text', { x: 640, y: 350, text: 'COSMETIC DAMAGE' });
  game.addDanger({ type: 'circle', x: 640, y: 350, r: 70, label: 'CRITICAL THREAT' });
  game.cursor.down = true; game.cursor.hold = 1.2;
  const trace = stableDraw(game), labels = trace.texts.map(t => t.text);
  assert.ok(labels.includes('CRITICAL THREAT'));
  assert.ok(labels.includes('완충'));
  assert.ok(labels.indexOf('COSMETIC DAMAGE') < labels.indexOf('CRITICAL THREAT'));
  assert.ok(labels.indexOf('CRITICAL THREAT') < labels.indexOf('완충'));
  assert.ok(trace.arcs.some(a => a.args[0] === 640 && a.args[1] === 350 && a.args[2] === 70 && a.style === '#FF425B'));
});

test('crowded low-effects preserves distant adaptation weakness and priority infection timer', () => {
  const game = fixture('seed', { lowEffects: true }); game.enemies = [];
  for (let i = 0; i < 180; i++) game.spawnEnemy('drifter', { x: 35 + i % 30 * 40, y: 120 + Math.floor(i / 30) * 80, hp: 500 });
  const adaptive = game.enemies[0]; adaptive.adaptation = 'CHAIN'; adaptive.weakness = 'IMPACT';
  const priority = game.enemies[1]; priority.type = 'channeler';
  game.status(priority, 'infected', { duration: 5, remaining: 4, stacks: 2 });
  for (const enemy of game.enemies.slice(2)) game.status(enemy, 'infected', { duration: 3, remaining: 2 });
  const trace = stableDraw(game);
  assert.ok(trace.texts.some(t => t.text === '충격' && t.x > adaptive.x));
  assert.ok(trace.texts.some(t => t.text === '4s'));
  assert.ok(trace.texts.some(t => t.text.startsWith('×')));
});

test('channel warning is incoming for the full two-second grace period', () => {
  const game = fixture(); game.enemies = [];
  const a = game.anchors[0]; a.channeling = true;
  game.spawnEnemy('channeler', { x: a.x - 40, y: a.y, anchorIndex: 0, channel: 1.9 });
  const trace = stableDraw(game);
  assert.ok(trace.texts.some(t => t.text === '공격 준비'));
  assert.ok(!trace.texts.some(t => t.text === '안정도 손상'));
});

test('low-effects shows live protection links, relay selection radius and exact direct splash radius', () => {
  const game = fixture('orbital', { lowEffects: true }); game.enemies = [];
  const ward = game.spawnEnemy('ward', { x: 480, y: 300, linkBroken: 0 });
  game.spawnEnemy('drifter', { x: 520, y: 330, protectedBy: ward.id, linkBroken: 0 });
  game.spawnEnemy('drifter', { x: 550, y: 310, protectedBy: ward.id, linkBroken: 5 });
  game.beacon = { x: 740, y: 400, remaining: 2 };
  game.stats.radiusBonus = 8; game.cursor.down = true; game.cursor.hold = .9;
  const trace = stableDraw(game);
  const links = trace.strokes.filter(s => s.style === '#659CD4');
  assert.ok(links.some(s => s.path.some(p => p[0] === 'lineTo' && p[1] === 520 && p[2] === 330)));
  assert.ok(!links.some(s => s.path.some(p => p[0] === 'lineTo' && p[1] === 550 && p[2] === 310)));
  assert.ok(trace.arcs.some(a => a.args[0] === 740 && a.args[1] === 400 && a.args[2] === 60));
  assert.ok(trace.arcs.some(a => a.args[0] === 640 && a.args[1] === 350 && a.args[2] === 56));
});

test('ring telegraphs keep their actual future hit radius in both motion modes', () => {
  for (const reducedMotion of [false, true]) {
    const game = fixture('orbital', { reducedMotion }); game.effects = [];
    game.fx('ring', { x: 770, y: 470, r: 44, life: .3, age: .15, color: '#F2C15A' });
    const trace = stableDraw(game);
    const circles = trace.arcs.filter(a => a.args[0] === 770 && a.args[1] === 470);
    assert.ok(circles.length);
    assert.ok(circles.every(a => a.args[2] === 44));
  }
});
