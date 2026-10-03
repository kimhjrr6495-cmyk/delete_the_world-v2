// A deterministic input bot. It uses the same combat/progression APIs as the UI;
// no health, damage, charge, cooldown, or reward values are overridden.
import { Game } from '../src/engine.js';
import { SKILLS, STAT_CARDS, getSkill } from '../src/data.js';
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const option = name => process.argv.find(arg => arg.startsWith(`--${name}=`))?.split('=').slice(1).join('=');
const selectedMode = option('mode') || 'both';
const modes = selectedMode === 'both' ? ['expedition', 'standard'] : [selectedMode];
if (modes.some(mode => !['expedition', 'standard'].includes(mode))) throw new Error('--mode must be expedition, standard, or both');
const seeds = (option('seeds') || '211029').split(',').map(Number);
if (!seeds.every(Number.isFinite)) throw new Error('--seeds expects comma separated numbers');
const policy = option('policy') || 'power';
if (!['rules', 'power'].includes(policy)) throw new Error('--policy must be rules or power');
const dt = .05;
const sourceHash = createHash('sha256').update(['engine', 'skills', 'data'].map(name => readFileSync(new URL(`../src/${name}.js`, import.meta.url))).join('\n')).digest('hex').slice(0, 16);
const preferences = {
  overcharge: { branch: 'fork', modifier: 'capacitor', second: ['hole', 'seed', 'bomb', 'orbital', 'cut'] },
  bomb: { branch: 'compression', modifier: 'delayed_return', second: ['hole', 'seed', 'orbital', 'cut', 'overcharge'] },
  hole: { branch: 'anchor', modifier: 'mass_ledger', second: ['seed', 'bomb', 'overcharge', 'orbital', 'cut'] },
  cut: { branch: 'razor', modifier: 'rupture_edge', second: ['hole', 'seed', 'bomb', 'overcharge', 'orbital'] },
  orbital: { branch: 'hunter', modifier: 'incendiary_fuel', second: ['seed', 'hole', 'bomb', 'overcharge', 'cut'] },
  seed: { branch: 'carrier', modifier: 'dormant_soil', second: ['hole', 'bomb', 'orbital', 'overcharge', 'cut'] },
};
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function targetScore(game, enemy) {
  const anchor = game.anchors[enemy.anchorIndex] || game.anchors[0];
  const anchorDistance = distance(enemy, anchor);
  let score = 40 - enemy.hp / 200;
  if (enemy.type === 'channeler' || enemy.type === 'anchor' || enemy.elite) score += Math.max(0, 900 - anchorDistance * 1.3);
  if (enemy.channel > 0) score += 2000 + enemy.channel * 1000;
  if (enemy.routeTarget || enemy.reward === 'evolution') score += 800;
  if (enemy.boss) score += 1200;
  if (enemy.boss && game.dangers.some(danger => danger.bossId === enemy.id)) score += 100000;
  if (enemy.statuses?.mark) score += 50;
  if (enemy.statuses?.rupture || enemy.statuses?.exposed) score += 35;
  return score;
}
function priorityTarget(game) {
  return game.enemies.filter(enemy => !enemy.dead).sort((a, b) => targetScore(game, b) - targetScore(game, a) || a.id - b.id)[0];
}
function bestFieldTarget(game) {
  const priority = priorityTarget(game);
  if (!priority) return null;
  let best = priority, bestScore = -Infinity;
  for (const enemy of game.enemies.filter(enemy => !enemy.dead)) {
    const nearby = game.near(enemy.x, enemy.y, 85);
    // Direct input interrupts the boss; persistent fields defend crowded anchors.
    const score = nearby.length * 90 + (enemy.boss ? 150 : targetScore(game, enemy));
    if (score > bestScore) { best = enemy; bestScore = score; }
  }
  return best;
}
function aim(game, point) {
  if (!point) return;
  const dx = point.x - game.cursor.x, dy = point.y - game.cursor.y;
  game.cursor.dx = dx; game.cursor.dy = dy;
  if (Math.hypot(dx, dy) > 1) game.cursor.angle = Math.atan2(dy, dx);
  game.cursor.x = point.x; game.cursor.y = point.y;
}
function choiceScore(game, card, startingSkill) {
  if (card.kind === 'branch' || card.kind === 'modifier') return preferences[card.skillId]?.[card.kind] === card.selection ? 200 : 100;
  if (card.kind === 'skill') return 150 - preferences[startingSkill].second.indexOf(card.skillId) * 10;
  if (card.kind === 'evolution') return card.skillId === startingSkill ? 200 + card.selection : 100 + card.selection;
  if (card.kind === 'reserve') return 200;
  if (card.kind === 'tag-final') return 150;
  if (card.kind === 'route') return card.selection === (game.integrity < 65 ? 'stable_supply' : 'elite_seal') ? 200 : 20;
  if (card.kind === 'relic') return ({ lens: 40, hollow_crown: game.integrity > 65 ? 90 : 20, anchor_heart: 75, time_capsule: 45, crossed_wires: 65, swarm_clock: 85 })[card.selection] || 30;
  if (card.kind === 'hybrid') return 140;
  if (card.kind === 'method') return card.selection === 'after_cast' || card.selection === 'precision_window' ? 120 : 80 + (card.tag === getSkill(startingSkill).tag ? 10 : 0);
  if (card.kind === 'stat') {
    const changes = STAT_CARDS.find(stat => stat.id === card.selection)?.changes || {};
    if (changes.heal && game.integrity < 40) return 180;
    if (changes.power) return policy === 'power' ? 110 : 75;
    if (changes.skillBonus) return policy === 'power' ? 102 : 64;
    if (changes.summonBonus) return policy === 'power' && startingSkill === 'orbital' ? 108 : startingSkill === 'orbital' ? 72 : 55;
    if (changes.cdr) return policy === 'power' ? 96 : 68;
    if (changes.directBonus || changes.chargeRate) return policy === 'power' ? 98 : 60;
    if (changes.autoRate) return 40;
    return 25;
  }
  return 0;
}

function play(skillId, mode, seed) {
  const game = new Game();
  game.start(skillId, mode, seed);
  const knownBosses = new Map(), chosen = [], bossDamage = {};
  let ticks = 0, lowestIntegrity = 100, pendingDirect = null;
  const maxTime = mode === 'expedition' ? 720 : 1440;
  while (!game.result && game.time < maxTime && ticks++ < maxTime / dt + 1000) {
    if (game.boss) knownBosses.set(game.boss.id, game.boss);
    if (game.phase === 'choice') {
      const choice = [...game.choices].sort((a, b) => choiceScore(game, b, skillId) - choiceScore(game, a, skillId))[0];
      if (!choice || !game.choose(choice.id)) throw new Error(`Bot cannot choose valid ${game.choiceContext} card`);
      chosen.push(choice.id); pendingDirect = null; continue;
    }
    if (game.phase !== 'playing') break;
    let directTarget = pendingDirect?.target;
    if (!directTarget || directTarget.dead) {
      if (game.cursor.down) game.endDirect();
      pendingDirect = null; directTarget = priorityTarget(game);
    }
    const fieldTarget = bestFieldTarget(game) || directTarget;
    // Press E then Q in order. The same cursor is temporarily moved for each input.
    for (let index = 0; index < game.skillSlots.length; index++) {
      const slot = game.skillSlots[index];
      if (slot.cd > 0 || game.skills.held || !fieldTarget) continue;
      const point = slot.id === 'hole' || slot.id === 'orbital' ? fieldTarget : directTarget || fieldTarget;
      aim(game, point);
      game.skills.press(index);
      // A cut tap is a real zero-duration key tap using its default horizontal direction.
      // Final RECORD is intentionally not used: the bot has no manual record strategy.
      if (game.skills.held?.index === index) game.skills.release(index);
    }
    if (game.skills.route && fieldTarget) { aim(game, fieldTarget); game.skills.press(game.skills.route.index); }
    if (game.network >= 50 && fieldTarget) { aim(game, fieldTarget); game.skills.crossNetwork(); }
    aim(game, directTarget || fieldTarget);
    const reserveInterrupt = game.boss && game.boss.aiTimer < 2.2 && game.charges === 1 && !game.dangers.some(danger => danger.bossId === game.boss.id);
    if (directTarget && game.charges > 0 && !game.cursor.down && !reserveInterrupt) {
      const directEstimate = 110 * game.stats.power * (1 + game.stats.directBonus);
      const urgent = directTarget.channel > 1.3 || directTarget.boss && game.dangers.some(danger => danger.bossId === directTarget.id && danger.remaining < 1);
      const hold = urgent || directTarget.hp + (directTarget.shield || 0) <= directEstimate ? 0 : game.tagFinal === 'final_stroke' ? 1.2 : .8;
      pendingDirect = { target: directTarget, hold }; game.beginDirect();
      if (hold === 0) { game.endDirect(); pendingDirect = null; }
    }
    game.update(dt);
    if (game.cursor.down && pendingDirect && game.cursor.hold + 1e-8 >= pendingDirect.hold) {
      aim(game, pendingDirect.target); game.endDirect(); pendingDirect = null;
    }
    if (game.boss) knownBosses.set(game.boss.id, game.boss);
    lowestIntegrity = Math.min(lowestIntegrity, game.integrity);
  }
  for (const boss of knownBosses.values()) bossDamage[boss.type] = { killed: boss.dead, hp: Math.round(Math.max(0, boss.hp)), maxHp: boss.maxHp };
  return {
    core: skillId, mode, seed, policy, won: Boolean(game.result?.won), seconds: Number(game.time.toFixed(1)),
    integrity: Number(game.integrity.toFixed(1)), minimumIntegrity: Number(lowestIntegrity.toFixed(1)), level: game.level, kills: game.kills,
    bossKills: Object.entries(bossDamage).filter(([, boss]) => boss.killed).map(([id]) => id), bosses: bossDamage,
    evolution: game.skillSlots.map(slot => `${slot.id}:${slot.evolution}`), final: game.tagFinal || game.skillSlots.find(slot => slot.evolution >= 3)?.id || null,
    skillsUsed: game.skillSlots.map(slot => `${slot.id}:${slot.uses}`), hybrid: game.hybrid, methods: [...game.methods], relics: [...game.relics],
    cause: game.result?.cause || 'Bot time budget expired', damage: game.damageStats, chosen,
  };
}

const started = performance.now(), results = [];
for (const mode of modes) for (const seed of seeds) for (const skill of SKILLS) {
  const result = play(skill.id, mode, seed); results.push(result);
  process.stdout.write(`${mode.padEnd(10)} ${skill.id.padEnd(10)} seed${seed} ${result.won ? 'WIN ' : 'FAIL'} ${String(result.seconds).padStart(6)}s · LV${result.level} · ${result.kills} kills · INTEGRITY ${result.integrity} · bosses ${result.bossKills.join(',') || 'none'} · ${result.cause}\n`);
}
console.table(results.map(({ core, mode, seed, won, seconds, level, kills, integrity, final, bossKills }) => ({ core, mode, seed, won, seconds, level, kills, integrity, final, bossKills: bossKills.join(',') })));
const report = { generatedAt: new Date().toISOString(), bot: 'priority-input-v2', sourceHash, policy, dt, elapsedSeconds: Number(((performance.now() - started) / 1000).toFixed(2)), limitations: ['Perfect target knowledge and instantaneous cursor movement.', 'No manual Final RECORD; SCREEN CUT taps default horizontal.', 'One fixed branch/modifier policy and greedy growth decisions.', 'No runtime combat parameter overrides.'], results };
const output = option('json');
if (output) { writeFileSync(output, JSON.stringify(report, null, 2)); process.stdout.write(`Wrote ${output}\n`); }
process.stdout.write(`Simulation completed in ${report.elapsedSeconds}s. These are bot outcomes, not human balance measurements.\n`);
