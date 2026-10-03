import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, ENEMIES, METHODS, HYBRIDS, RELICS, CORES, ROUTES, makeChoices, applyChoice, canSelectMethod, canSelectHybrid, hasPrerequisite } from '../src/data.js';

function fixture(ids = ['overcharge']) {
  let seed = 12345;
  return {
    skillSlots: ids.map((id, index) => ({ id, key: index ? 'Q' : 'E', branch: null, modifier: null, evolution: 0, uses: 0, acquiredLevel: 1 })),
    tags: { CHAIN: 4, INFECTION: 4, SINGULARITY: 4, SWARM: 4, IMPACT: 4, CASTER: 4 },
    methods: new Set(), owned: new Set(), bans: new Set(), relics: [], hybrid: null,
    level: 2, time: 0, stats: { power: 1, cdr: 0, critChance: .05, radiusBonus: 0 },
    integrity: 70, maxIntegrity: 100, pressure: 20, rewrite: 2, metrics: { chargedHits: 0, casterPairs: 0 },
    rng: () => ((seed = Math.imul(seed, 1664525) + 1013904223 >>> 0) / 4294967296),
  };
}
const finish = (game, index = 0) => {
  const skill = SKILLS.find(card => card.id === game.skillSlots[index].id);
  game.skillSlots[index].branch = skill.branches[0].id;
  game.skillSlots[index].modifier = skill.modifiers[0].id;
};

test('every content family has complete unique effect IDs', () => {
  assert.equal(SKILLS.length, 6); assert.equal(Object.keys(ENEMIES).length, 8);
  assert.equal(METHODS.length, 12); assert.equal(HYBRIDS.length, 10);
  assert.equal(RELICS.length, 6); assert.equal(CORES.length, 6); assert.equal(ROUTES.length, 3);
  for (const family of [SKILLS, METHODS, HYBRIDS, RELICS, CORES]) {
    assert.equal(new Set(family.map(card => card.id)).size, family.length);
    assert.ok(family.every(card => card.description));
  }
  assert.ok(METHODS.concat(HYBRIDS, RELICS).every(card => card.effectId === card.id));
  assert.ok(SKILLS.every(card => card.branches.length === 2 && card.modifiers.length === 2 && card.evolutionNames.length === 3));
});

test('same game seed produces same second-skill offer; current skill is excluded', () => {
  const first = makeChoices(fixture(), 'second-skill');
  assert.deepEqual(first, makeChoices(fixture(), 'second-skill'));
  assert.equal(first.length, 3);
  assert.ok(first.every(choice => choice.skillId !== 'overcharge'));
});

test('late skill receives branch then modifier within its next two growth levels', () => {
  const game = fixture(); finish(game); game.level = 20;
  const choice = makeChoices(game, 'second-skill')[0];
  assert.equal(applyChoice(game, choice).applied, true);
  assert.equal(game.skillSlots[1].branchDueLevel, 22);
  game.level = 22;
  const branches = makeChoices(game);
  assert.equal(branches.length, 2); assert.ok(branches.every(card => card.kind === 'branch' && card.slotIndex === 1));
  applyChoice(game, branches[0]);
  game.level = 24;
  const modifiers = makeChoices(game);
  assert.equal(modifiers.length, 2); assert.ok(modifiers.every(card => card.kind === 'modifier' && card.slotIndex === 1));
  assert.equal(applyChoice(game, modifiers[0]).applied, true);
});

test('an evolution core supplies missing branch and modifier before spending evolution', () => {
  const game = fixture(); game.time = 480;
  const branch = makeChoices(game, 'evolution')[0];
  assert.equal(branch.freePrerequisite, true);
  assert.equal(applyChoice(game, branch).nextContext, 'evolution');
  assert.equal(game.skillSlots[0].evolution, 0);
  const modifier = makeChoices(game, 'evolution')[0];
  assert.equal(modifier.kind, 'modifier'); applyChoice(game, modifier);
  const evolution = makeChoices(game, 'evolution')[0];
  assert.equal(evolution.kind, 'evolution'); assert.equal(evolution.selection, 1);
  assert.equal(applyChoice(game, evolution).applied, true);
  assert.equal(game.skillSlots[0].evolution, 1); assert.equal(game.pendingEvolution, null);
});

test('Final checks tags and eight actual uses; rejected core remains reservable', () => {
  const game = fixture(); finish(game); game.time = 960; game.skillSlots[0].evolution = 2;
  const reserve = makeChoices(game, 'evolution')[0];
  assert.equal(reserve.kind, 'reserve'); assert.equal(applyChoice(game, reserve).reserved, true);
  game.skillSlots[0].uses = 8;
  const final = makeChoices(game, 'evolution')[0];
  assert.equal(final.selection, 3); applyChoice(game, final);
  assert.equal(game.hasFinal, true); assert.equal(game.pendingCore, false);
});

test('tag Final requires real charged hits or skill pairs and shares one Final limit', () => {
  const game = fixture(['bomb', 'cut']); finish(game); finish(game, 1); game.time = 960;
  assert.ok(!makeChoices(game, 'evolution').some(card => card.kind === 'tag-final'));
  game.metrics.chargedHits = 8;
  const choice = makeChoices(game, 'evolution').find(card => card.kind === 'tag-final');
  assert.equal(choice.selection, 'final_stroke'); assert.equal(applyChoice(game, choice).applied, true);
  assert.equal(game.tagFinal, 'final_stroke');
  game.metrics.casterPairs = 8;
  assert.ok(!makeChoices(game, 'evolution').some(card => card.kind === 'tag-final'));
});

test('method cards require an actual trigger source', () => {
  const game = fixture(); finish(game);
  const origin = METHODS.find(card => card.id === 'origin_echo');
  assert.equal(canSelectMethod(game, origin), false);
  game.methods.add('conductive_scar'); assert.equal(canSelectMethod(game, origin), true);
  assert.equal(canSelectMethod(game, METHODS.find(card => card.id === 'spore_census')), false);
  assert.equal(canSelectMethod(game, METHODS.find(card => card.id === 'alternating_circuit')), false);
  const seedGame = fixture(['seed']); finish(seedGame); seedGame.skillSlots[0].branch = 'reservoir';
  assert.equal(hasPrerequisite(seedGame, 'plural-infection'), false);
  seedGame.skillSlots[0].evolution = 1; assert.equal(hasPrerequisite(seedGame, 'plural-infection'), true);
});

test('hybrids require both tag gates, real sources and a vacant hybrid slot', () => {
  const game = fixture(['hole', 'orbital']);
  const cross = HYBRIDS.find(card => card.id === 'cross_gravity');
  assert.equal(canSelectHybrid(game, cross), true);
  game.tags.SWARM = 3; assert.equal(canSelectHybrid(game, cross), false);
  game.tags.SWARM = 4; game.hybrid = 'railgun_scar'; assert.equal(canSelectHybrid(game, cross), false);
  assert.equal(canSelectHybrid(fixture(), cross), false);
  const parasite = HYBRIDS.find(card => card.id === 'parasite_hive');
  assert.equal(canSelectHybrid(fixture(['orbital']), parasite), true);
});

test('stat ranks and global cooldown/critical limits hold after card application', () => {
  const game = fixture();
  const cooldown = { kind: 'stat', selection: 'caster_flow', title: 'Cast Flow' };
  for (let n = 0; n < 5; n++) assert.equal(applyChoice(game, cooldown).applied, true);
  assert.equal(applyChoice(game, cooldown).applied, false);
  assert.equal(game.stats.cdr, .3);
  game.stats.cdr = .39; game.cardRanks.caster_flow = 0; applyChoice(game, cooldown);
  assert.equal(game.stats.cdr, .4);
  assert.ok(!makeChoices(game).some(card => card.selection === 'caster_flow'));
});

test('growth offers exclude summon-only stat with no summon source', () => {
  const game = fixture(); finish(game); game.tags.SWARM = 50;
  for (let i = 0; i < 20; i++) assert.ok(!makeChoices(game).some(choice => choice.id === 'swarm_payload'));
});

test('full relic slots demand explicit replacement and remove old persistent bonuses', () => {
  const game = fixture();
  applyChoice(game, { kind: 'relic', selection: 'hollow_crown', title: 'Hollow Crown' });
  applyChoice(game, { kind: 'relic', selection: 'anchor_heart', title: 'Anchor Heart' });
  assert.equal(game.maxIntegrity, 90); assert.equal(game.stats.power, 1.12);
  assert.equal(applyChoice(game, { kind: 'relic', selection: 'lens', title: 'Lens' }).applied, false);
  applyChoice(game, { kind: 'relic', selection: 'lens', title: 'Lens', replaceIndex: 0 });
  assert.equal(game.maxIntegrity, 100); assert.equal(game.stats.power, 1);
  assert.equal(game.stats.radiusBonus, 8); assert.equal(game.relics.length, 2);
});

test('expedition mode uses world time for Final gating but actual time for route preparation', () => {
  const game = fixture(); finish(game); game.time = 320; game.worldTime = 960; game.metrics.chargedHits = 8;
  const final = makeChoices(game, 'evolution').find(card => card.kind === 'tag-final');
  assert.ok(final); assert.equal(applyChoice(game, final).applied, true);
  applyChoice(game, { kind: 'route', selection: 'stable_supply', title: '안정 보급' });
  assert.equal(game.route.startsAt, 335);
});

test('invalid selection never mutates a skill and forbidden route cannot kill by payment', () => {
  const game = fixture();
  assert.equal(applyChoice(game, { kind: 'branch', slotIndex: 0, selection: 'unknown' }).applied, false);
  assert.equal(game.skillSlots[0].branch, null);
  game.integrity = 9; game.pressure = 0;
  applyChoice(game, { kind: 'route', selection: 'forbidden_rift', title: '금지 균열' });
  assert.equal(game.integrity, 9); assert.equal(game.pressure, 18); assert.equal(game.route.startsAt, 15);
});
