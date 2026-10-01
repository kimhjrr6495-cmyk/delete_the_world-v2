// Combat skills are deliberately independent of the DOM and renderer.
const TAU = Math.PI * 2;
const COLORS = { overcharge: '#5EE3FF', bomb: '#ED78BF', hole: '#A67CFF', cut: '#E8F0FF', orbital: '#F2C15A', seed: '#A6E857' };
const TAGS = { overcharge: 'CHAIN', bomb: 'IMPACT', hole: 'SINGULARITY', cut: 'CASTER', orbital: 'SWARM', seed: 'INFECTION' };
const CDS = { overcharge: 10, bomb: 12, hole: 16, cut: 11, orbital: 14, seed: 10 };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const alive = e => e && !e.dead && e.hp > 0;
const lineDistance = (p, a, b) => {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1), 0, 1);
  return Math.hypot(p.x - a.x - dx * t, p.y - a.y - dy * t);
};
const inLine = (e, line) => lineDistance(e, line, { x: line.x2, y: line.y2 }) <= line.width / 2 + e.r;

export class SkillSystem {
  constructor(game) {
    this.game = game;
    this.armed = null;
    this.held = null;
    this.route = null;
    this.routeUntil = 0;
    this.networkCooldown = 0;
    this.activeHoleGroup = null;
    this.activeCommand = null;
    this.history = [];
    this.rootState = new Map();
    this.validRoots = new Set();
    this.sequence = 0;
    this.lastCutAngle = 0;
    this.scoutTimer = 2.1;
    this.circuitTimer = 5;
    this.censusCooldown = 0;
    this.networkUnlocked = false;
  }

  slot(id) { return this.game.skillSlots.find(s => s?.id === id); }
  get recordPreview() {
    if (this.held?.id !== 'bomb' || this.held.heldSeconds < .5) return [];
    const limit = this.held.slot.branch === 'cluster' ? 7 : 5;
    return this.history.filter(p => this.game.time - p.time <= 10).slice(-limit);
  }
  hasMethod(id) { return this.game.methods?.has(id) || false; }
  hybrid(id) { return this.game.hybrid === id || this.game.hybrid?.id === id; }
  root(id) {
    if (!this.rootState.has(id)) this.rootState.set(id, { bursts: 0, transfers: 0, soil: 0, final: false, patient: false, returns: 0, miniBomb: false, infectedTargets: new Set(), markTargets: new Set(), created: this.game.time });
    return this.rootState.get(id);
  }
  valid(slot, rootId) {
    if (!slot) return;
    const key = `${slot.id}:${rootId}`;
    if (!this.validRoots.has(key)) { this.validRoots.add(key); slot.uses = (slot.uses || 0) + 1; }
    this.game.markCastValid?.(rootId);
  }
  cooldown(slot, seconds = CDS[slot.id]) { slot.cd = seconds * (1 - clamp(this.game.stats?.cdr || 0, 0, .4)); }
  field(type, props) {
    const duration = props.duration ?? 1;
    const field = { id: ++this.sequence, type, age: 0, duration, remaining: duration, color: COLORS[props.slot?.id] || props.color || '#E8F0FF', ...props };
    this.game.fields.push(field);
    return field;
  }
  fx(kind, props) { this.game.fx?.(kind, props); }
  cast(slot, rootId, seconds) {
    this.cooldown(slot, seconds); slot.delayedRefundUsed = false;
    this.game.onCast?.(slot, rootId);
    if (this.validRoots.has(`${slot.id}:${rootId}`)) this.game.markCastValid?.(rootId);
    this.game.sound?.(slot.id);
  }
  meta(slot, rootId, extra = {}) { return { rootId, slotId: slot?.id, tag: TAGS[slot?.id], effectId: slot?.id || 'status', ...extra }; }
  hit(enemy, amount, source, meta, slot) {
    if (!alive(enemy) || this.game.phase === 'ended' || !Number.isFinite(amount) || amount <= 0) return { killed: false, damage: 0 };
    // Commit the successful use before damage can finish the run and snapshot results.
    this.valid(slot, meta.rootId);
    const result = this.game.damage(enemy, amount, source, meta);
    return result;
  }
  near(x, y, r, filter = () => true) { return this.game.near(x, y, r, e => alive(e) && filter(e)); }
  nearest(x, y, r = Infinity, filter = () => true) { return this.game.nearest(x, y, r, e => alive(e) && filter(e)); }
  aim() { return { x: clamp(this.game.cursor.x, 0, this.game.width), y: clamp(this.game.cursor.y, 0, this.game.height) }; }

  press(index) {
    const slot = this.game.skillSlots[index];
    if (!slot) return false;
    const point = this.aim();
    if (slot.id === 'overcharge' && this.route && this.route.index === index) { this.routeCircuit(point, true); return true; }
    if (slot.id === 'hole' && this.moveHole(slot, point)) return true;
    if (slot.id === 'orbital' && this.redirectCommand(slot, point)) return true;
    if (slot.id === 'cut') {
      const sweep = this.game.fields.find(f => f.type === 'sweep' && f.slot === slot && !f.removed && !f.moved);
      if (sweep) { this.movePoint(sweep, point, 180); sweep.moved = true; return true; }
    }
    if (slot.cd > 0 || this.held) return false;
    if (slot.id === 'overcharge') {
      if (this.armed) return false;
      this.armed = { index, slot, remaining: 6, duration: 6 };
      this.game.sound?.('arm');
      return true;
    }
    if (slot.id === 'cut' || (slot.id === 'bomb' && slot.evolution >= 3)) {
      this.held = { index, id: slot.id, slot, startX: point.x, startY: point.y, heldSeconds: 0, remaining: slot.id === 'cut' ? 1.2 : 1.5 };
      return true;
    }
    const rootId = this.game.newRoot();
    if (slot.id === 'bomb') this.placeBomb(slot, point, rootId);
    else if (slot.id === 'hole') this.placeHole(slot, point, rootId);
    else if (slot.id === 'orbital') this.placeCommand(slot, point, rootId);
    else if (slot.id === 'seed') this.placeSeed(slot, point, rootId);
    else return false;
    this.cast(slot, rootId);
    return true;
  }

  release(index, heldSeconds) {
    if (!this.held || this.held.index !== index) return false;
    const held = this.held;
    this.held = null;
    const seconds = heldSeconds ?? held.heldSeconds;
    const point = this.aim(), rootId = this.game.newRoot();
    if (held.id === 'cut') {
      const dx = point.x - held.startX, dy = point.y - held.startY;
      const angle = seconds >= .2 && Math.hypot(dx, dy) > 4 ? Math.atan2(dy, dx) : this.lastCutAngle;
      this.lastCutAngle = angle;
      this.cast(held.slot, rootId, held.slot.evolution >= 3 ? 22 : 11);
      this.cut(held.slot, point, angle, rootId);
    } else {
      const limit = held.slot.branch === 'cluster' ? 7 : 5;
      const records = this.history.filter(h => this.game.time - h.time <= 10).slice(-limit);
      const record = seconds >= .5 && records.length > 0;
      this.placeBomb(held.slot, point, rootId, record ? records : null);
      this.cast(held.slot, rootId, record ? 24 : 12);
    }
    return true;
  }

  cancelInput() { this.armed = null; this.held = null; this.route = null; this.routeUntil = 0; }

  prepareDirect(target, info) {
    info.skillTargetId = target?.id;
    const status = target?.statuses?.infected;
    if (status) {
      info.infectedBefore = status;
      info.infectionRemaining = status.remaining;
      info.earlyDetonate = status.modifier === 'manual_detonate' || status.evolution >= 3 ||
        (this.hasMethod('patient_zero') && status.originalHost) || (this.hybrid('patient_zero_strike') && info.held >= .8);
    }
    return { bypass: this.armed?.slot.branch === 'needle' ? .5 : 0 };
  }

  onDirect(target, info) {
    const point = { x: info.x, y: info.y };
    if (target) this.history.push({ ...point, time: this.game.time });
    this.history = this.history.filter(h => this.game.time - h.time <= 10).slice(-7);
    if (this.armed) this.discharge(target, info);
    for (const f of [...this.game.fields]) {
      if (f.removed) continue;
      if (f.type === 'bomb' && !f.ghost && !f.mini && f.slot?.modifier === 'remote_fuse' && !f.remote && distance(f, point) <= f.r) {
        f.remaining = Math.min(f.remaining, .15); f.duration = f.age + f.remaining;
        f.remote = true; f.damage *= .85;
      }
      if (f.type === 'hole' && this.hasMethod('event_horizon') && f.mass >= 6 && distance(f, point) <= 35 && !f.forcedCollapse) {
        f.forcedCollapse = true; f.remaining = 0;
      }
      if (f.type === 'command' && f.slot?.modifier === 'marked_target' && f.markedUses < 2 && distance(f, point) <= f.r) {
        const shot = f.shots.find(s => !s.fired && !s.locked && f.age < s.at - .3);
        if (shot) { shot.x = point.x; shot.y = point.y; shot.manual = true; shot.damage = 85; f.markedUses++; }
      }
    }
    if (info.infectedBefore && this.hasMethod('spore_census') && this.censusCooldown <= 0) {
      const infected = this.near(point.x, point.y, 90, e => e.statuses.infected);
      const count = infected.length + (target?.dead && info.infectedBefore ? 1 : 0);
      if (count >= 2) {
        for (const e of infected.slice(0, 3)) e.statuses.infected.remaining = Math.min(e.statuses.infected.remaining, .3);
        this.censusCooldown = 6;
        this.fx('ring', { ...point, r: 90, color: COLORS.seed, life: .3 });
      }
    }
    if (alive(target) && target.statuses.infected && info.earlyDetonate) this.detonate(target, target.statuses.infected, 'manual', info.rootId, info);
  }

  discharge(target, info) {
    const armed = this.armed;
    this.armed = null;
    const slot = armed.slot, rootId = info.rootId;
    const origin = target ? { x: target.x, y: target.y } : { x: info.x, y: info.y };
    const count = slot.branch === 'fork' ? 5 : slot.branch === 'needle' ? 1 : 3;
    const damages = slot.branch === 'fork' ? [49, 38.5, 28, 21, 17.5] : slot.branch === 'needle' ? [90] : [70, 55, 40];
    this.cast(slot, rootId);
    const hits = this.game.arc(origin.x, origin.y, count, damages, this.meta(slot, rootId, { chain: true, range: slot.branch === 'fork' ? 125 : 110 }), target ? [target.id] : []);
    if (hits.length || target) this.valid(slot, rootId);
    const excluded = new Set([target?.id, ...hits.map(e => e.id)]);
    let grounded = false;
    for (const e of hits) {
      if (!grounded && slot.modifier === 'grounding' && (e.type === 'channeler' || e.type === 'ward' || e.channel > 0 || e.protectedBy != null)) {
        this.game.onEnemyInterrupt?.(e);
        e.disrupted = Math.max(e.disrupted || 0, 2); e.channel = 0; this.breakProtection(e); grounded = true;
      }
      if (alive(e) && (slot.evolution >= 1 || (slot.modifier === 'capacitor' && e === hits.at(-1)))) {
        this.addStatus(e, 'mark', { rootId, originPosition: origin, damage: slot.modifier === 'capacitor' ? 80 : 60, returnCurrent: slot.evolution >= 2 });
      }
    }
    if (alive(target) && hits.length < count) {
      const returned = slot.branch === 'needle' ? 60 : (count - hits.length) * 15;
      this.hit(target, returned, 'SKILL', this.meta(slot, rootId, { effectId: 'overcharge_return', noProc: true }), slot);
    }
    if (slot.evolution >= 3) {
      this.route = { index: armed.index, slot, rootId, x: origin.x, y: origin.y, origin, targetId: target?.id, excluded, duration: 2.5, remaining: 2.5 };
      this.routeUntil = this.game.time + 2.5;
    }
  }

  routeCircuit(point, manual) {
    const route = this.route;
    if (!route) return;
    this.route = null; this.routeUntil = 0;
    const slot = route.slot;
    let hits;
    if (manual) hits = this.game.arc(point.x, point.y, slot.branch === 'needle' ? 1 : 3, slot.branch === 'needle' ? [120] : [50, 40, 30], this.meta(slot, route.rootId, { chain: true, range: 150, effectId: 'living_circuit' }), [...route.excluded]);
    else hits = this.game.arc(route.x, route.y, 1, [50], this.meta(slot, route.rootId, { chain: true, range: 150, effectId: 'living_circuit_auto' }), [...route.excluded]);
    if (!hits.length) {
      const original = this.game.enemies.find(e => e.id === route.targetId);
      this.hit(original, 40, 'SKILL', this.meta(slot, route.rootId, { noProc: true }), slot);
    }
    if (manual && distance(point, route.origin) <= 40) for (const e of this.near(point.x, point.y, 40).slice(0, 3)) this.addStatus(e, 'exposed', { duration: 3, rootId: route.rootId });
    this.fx('marker', { ...point, r: manual ? 18 : 10, color: COLORS.overcharge, life: .35 });
  }

  placeBomb(slot, point, rootId, records = null, options = {}) {
    const compression = slot.branch === 'compression';
    const r = records ? 110 : compression ? 55 : 85;
    const damage = records ? 180 : compression ? 340 : slot.branch === 'cluster' ? 170 : 230;
    return this.field('bomb', { ...point, r, damage, rootId, slot, duration: options.delay ?? .8, fuse: options.delay ?? .8, record: !!records, records, ...options });
  }

  explodeBomb(f) {
    const slot = f.slot;
    let kills = 0;
    const hits = this.near(f.x, f.y, f.r);
    for (const e of hits) {
      const amount = f.damage * (distance(e, f) > f.r * .8 ? .6 : 1);
      const result = this.hit(e, amount, 'SKILL', this.meta(slot, f.rootId, { effectId: f.ghost ? 'void_ghost' : 'void_bomb' }), slot);
      if (result.killed) kills++;
      if (!f.ghost && !f.mini && alive(e) && slot.evolution >= 1) {
        if (!e.boss) this.push(e, f, 90);
        this.addStatus(e, 'exposed', { rootId: f.rootId, duration: 3 });
      }
    }
    this.fx('burst', { x: f.x, y: f.y, r: f.r, color: COLORS.bomb, life: .25 });
    if (f.ghost || f.mini) return;
    if (slot.modifier === 'delayed_return') this.field('residue', { x: f.x, y: f.y, r: f.r * .7, rootId: f.rootId, slot, duration: 3, damage: 30, tickEvery: .5, tickTimer: .5 });
    if (f.records) {
      const amount = slot.branch === 'compression' ? 100 : slot.branch === 'cluster' ? 50 : 70;
      const radius = slot.branch === 'compression' ? 22 : 30;
      f.records.forEach((p, i) => this.field('bomb', { x: p.x, y: p.y, r: radius, damage: amount, rootId: f.rootId, slot, duration: .12 * (i + 1), fuse: .12 * (i + 1), ghost: true, ghostIndex: i + 1 }));
    } else if (slot.branch === 'cluster') {
      const candidates = this.near(f.x, f.y, f.r + 100).sort((a, b) => distance(a, f) - distance(b, f)).slice(0, 2);
      for (const e of candidates) this.field('bomb', { x: e.x, y: e.y, r: 38, damage: 90, rootId: f.rootId, slot, duration: .25, fuse: .25, mini: true });
    }
    const state = this.root(f.rootId);
    if (slot.evolution >= 2 && !state.miniBomb) {
      if (kills >= 5) {
        const e = this.near(f.x, f.y, 500).sort((a, b) => distance(b, f) - distance(a, f))[0];
        if (e) { state.miniBomb = true; this.field('bomb', { x: e.x, y: e.y, r: 45, damage: 80, rootId: f.rootId, slot, duration: .5, fuse: .5, mini: true }); }
      } else if (hits.length === 1 && hits[0].boss && alive(hits[0])) this.addStatus(hits[0], 'rupture', { duration: 2, rootId: f.rootId });
    }
  }

  placeHole(slot, point, rootId) {
    const groupId = ++this.sequence;
    const twin = slot.branch === 'twin';
    const points = twin ? [{ x: point.x - 70, y: point.y }, { x: point.x + 70, y: point.y }] : [point];
    for (const p of points) this.field('hole', { ...p, r: twin ? 85 : slot.branch === 'anchor' ? 145 : 125, slot, rootId, groupId, duration: 3, mass: 0, maxMass: 8, endRadius: 80, pull: slot.branch === 'anchor' ? 130 : 140, damageScale: twin ? .7 : 1, tickTimer: .5, tickEvery: .5, inside: new Set(), sheared: new Set(), strainTriggered: new Set(), foldUntil: slot.evolution >= 3 ? this.game.time + 1.2 : 0 });
    this.activeHoleGroup = { id: groupId, slot, rootId, x: point.x, y: point.y, created: this.game.time, repositioned: false, folded: false };
  }

  movePoint(field, point, maximum) {
    const d = distance(field, point), t = d > maximum ? maximum / d : 1;
    field.x += (point.x - field.x) * t; field.y += (point.y - field.y) * t;
  }

  moveHole(slot, point) {
    const group = this.activeHoleGroup;
    if (!group || group.slot !== slot) return false;
    const holes = this.game.fields.filter(f => f.type === 'hole' && f.groupId === group.id && !f.removed && f.remaining > 0);
    if (!holes.length) return false;
    const age = this.game.time - group.created;
    if (slot.evolution >= 3 && age <= 1.2 && !group.folded) {
      const d = distance(group, point);
      if (d < 80 || d > 360) { this.game.toast?.('접힘 고정점: 80–360px 안을 지정하세요.'); return true; }
      group.folded = true;
      const mass = Math.min(8, holes.reduce((total, h) => total + h.mass, 0));
      this.field('fold', { x: group.x, y: group.y, x2: point.x, y2: point.y, width: 32, r: 0, slot, rootId: group.rootId, duration: .6, damage: 200 + mass * 20 });
      return true;
    }
    if (slot.evolution >= 2 && age < 3 && !group.repositioned && !(slot.evolution >= 3 && age <= 1.2) && !holes.some(h => h.autoMoving || h.repositionLocked)) {
      const before = { x: group.x, y: group.y };
      this.movePoint(group, point, 180);
      for (const h of holes) { h.x += group.x - before.x; h.y += group.y - before.y; h.repositioned = true; }
      group.repositioned = true;
      this.fx('line', { ...before, toX: group.x, toY: group.y, color: COLORS.hole, life: .2 });
      return true;
    }
    return false;
  }

  holeOwns(f, e) {
    if (distance(f, e) > f.r + e.r) return false;
    const sibling = this.game.fields.find(h => h.type === 'hole' && h.groupId === f.groupId && h !== f && !h.removed && distance(h, e) < distance(f, e));
    return !sibling;
  }

  endHole(f) {
    const extra = f.mass * (f.slot.modifier === 'mass_ledger' ? 30 : 20);
    const quarantine = this.hybrid('quarantine_collapse') && (f.quarantine || 0) > 0;
    for (const e of this.near(f.x, f.y, f.endRadius)) {
      this.hit(e, (80 + extra + (quarantine ? 40 : 0)) * f.damageScale, 'SKILL', this.meta(f.slot, f.rootId, { effectId: 'gravity_crush' }), f.slot);
      if (f.slot.evolution >= 1) this.breakProtection(e);
    }
    if (quarantine) {
      const targets = this.near(f.x, f.y, f.r + 100, e => !e.statuses.infected && distance(f, e) > f.r).slice(0, Math.min(3, f.quarantine));
      for (const e of targets) this.infect(e, f.slot, f.rootId, { damageScale: .65, originalHost: false, spread: false });
    }
    this.game.onHoleEnd?.(f);
    this.fx('burst', { x: f.x, y: f.y, r: f.endRadius, color: COLORS.hole, life: .25 });
  }

  cutLines(point, angle, length, width, lattice = false) {
    const segment = (center, a, len, w) => ({ x: center.x - Math.cos(a) * len / 2, y: center.y - Math.sin(a) * len / 2, x2: center.x + Math.cos(a) * len / 2, y2: center.y + Math.sin(a) * len / 2, width: w });
    const lines = [segment(point, angle, length, width)];
    if (lattice) for (const offset of [-90, 90]) lines.push(segment({ x: point.x + Math.cos(angle) * offset, y: point.y + Math.sin(angle) * offset }, angle + Math.PI / 2, 240, width));
    return lines;
  }

  cut(slot, point, angle, rootId) {
    if (slot.evolution >= 3) {
      this.field('sweep', { ...point, r: slot.branch === 'razor' ? 230 : 200, slot, rootId, angle, startAngle: angle, length: slot.branch === 'razor' ? 460 : 400, width: slot.branch === 'razor' ? 12 : 26, lattice: slot.branch === 'lattice', duration: 3.4, startDelay: .4, tickTimer: .1, hits: new Map(), afterimageDone: false, moved: false, previewAngle: .4 * TAU / 1.5 });
      return;
    }
    const lattice = slot.branch === 'lattice', razor = slot.branch === 'razor';
    const lines = this.cutLines(point, angle, razor ? 460 : 400, razor ? 12 : 26, lattice);
    this.strikeLines(slot, lines, rootId, lattice ? 130 : razor ? 285 : 200, lattice ? 220 : Infinity, true);
    if (slot.modifier === 'afterimage') this.game.schedule(.5, () => this.strikeLines(slot, lines, rootId, 70, Infinity, false));
    if (slot.evolution >= 1) for (const line of lines) this.field('seam', { ...line, r: 0, slot, rootId, duration: 2, seen: new Set() });
    if (slot.evolution >= 2) {
      const offsets = lattice ? [-90, 90] : [0];
      if (razor) {
        const auxiliary = this.cutLines(point, angle + Math.PI / 2, 90, 10)[0];
        this.game.schedule(.25, () => this.field('seam', { ...auxiliary, r: 0, slot, rootId, duration: 1, seen: new Set(), auxiliary: true }));
      }
      for (const offset of offsets) {
        const center = { x: point.x + Math.cos(angle) * offset, y: point.y + Math.sin(angle) * offset };
        this.game.schedule(.25, () => { for (const e of this.near(center.x, center.y, 45)) this.hit(e, 100, 'SKILL', this.meta(slot, rootId, { effectId: 'rift_crossing' }), slot); this.fx('burst', { ...center, r: 45, color: COLORS.cut, life: .2 }); });
      }
    }
  }

  strikeLines(slot, lines, rootId, damage, cap, primary) {
    for (const e of this.game.enemies.filter(alive)) {
      const count = lines.filter(line => inLine(e, line)).length;
      if (!count) continue;
      this.hit(e, Math.min(cap, damage * count), 'SKILL', this.meta(slot, rootId, { effectId: primary ? 'screen_cut' : 'cut_afterimage' }), slot);
      if (alive(e) && primary && slot.modifier === 'rupture_edge') this.addStatus(e, 'rupture', { duration: 5, rootId });
      this.breakProtection(e);
    }
    for (const line of lines) this.fx('slash', { ...line, toX: line.x2, toY: line.y2, color: COLORS.cut, life: .22 });
  }

  placeCommand(slot, point, rootId) {
    let host = null, anchor = null;
    if (slot.branch === 'watchtower' && this.game.anchors?.length) {
      anchor = [...this.game.anchors].sort((a, b) => distance(a, point) - distance(b, point))[0];
      point = { x: anchor.x, y: anchor.y };
    } else if (slot.branch === 'hunter') host = this.selectOrbital(point, 250, e => e.elite || e.boss || e.type === 'channeler') || this.selectOrbital(point, 150);
    const field = this.field('command', { ...point, r: 90, radius: 90, slot, rootId, duration: 5, anchorIndex: anchor?.id ?? anchor?.index, hostId: host?.id, redirected: false, markedUses: 0, parasiteHits: 0, warning: slot.branch === 'hunter' ? .5 : .35, shots: [.6, 1.7, 2.8, 3.9].map(at => ({ x: point.x, y: point.y, at, locked: false, fired: false, visible: false, r: 44, damage: 55 })) });
    this.activeCommand = field;
  }

  selectOrbital(point, r, filter = () => true) {
    return this.near(point.x, point.y, r, filter).sort((a, b) => {
      const priority = e => e.statuses.lease ? 100000 : e.type === 'channeler' || e.boss ? 10000 : e.type === 'ward' ? 5000 : e.hp;
      return priority(b) - priority(a) || a.id - b.id;
    })[0];
  }

  redirectCommand(slot, point) {
    const f = this.activeCommand;
    if (slot.evolution < 2 || !f || f.slot !== slot || f.removed || f.redirected) return false;
    f.x = point.x; f.y = point.y; f.redirected = true; f.hostId = null;
    for (const shot of f.shots) if (!shot.locked && !shot.fired) { shot.visible = false; shot.targetId = null; if (!shot.manual) { shot.x = point.x; shot.y = point.y; } }
    return true;
  }

  fireShot(f, shot) {
    shot.fired = true;
    const hits = this.near(shot.x, shot.y, 44);
    for (const e of hits) this.hit(e, shot.damage, 'SUMMON', this.meta(f.slot, f.rootId, { effectId: 'orbital_command', hitIndex: f.shots.indexOf(shot) }), f.slot);
    if (hits.length && f.slot.evolution >= 3) this.game.network = Math.min(100, (this.game.network || 0) + 2);
    if (f.slot.modifier === 'incendiary_fuel') this.field('fire', { x: shot.x, y: shot.y, r: 35, rootId: f.rootId, slot: f.slot, duration: 2.4, seen: new Set() });
    this.fx('burst', { x: shot.x, y: shot.y, r: 44, color: COLORS.orbital, life: .2 });
  }

  crossNetwork() {
    const slot = this.slot('orbital');
    if (!slot || slot.evolution < 3 || this.networkCooldown > 0 || (this.game.network || 0) < 50) return false;
    const perfect = this.game.network >= 100;
    this.game.network = 0;
    this.networkCooldown = 18 * (1 - clamp(this.game.stats.cdr || 0, 0, .4));
    this.field('network', { ...this.aim(), r: 0, width: 24, duration: 5, rootId: this.game.newRoot(), slot, tickTimer: .2, tickEvery: .2, perfect });
    this.game.sound?.('network');
    return true;
  }

  placeSeed(slot, point, rootId) {
    const target = this.nearest(point.x, point.y, 45);
    if (target) { this.infect(target, slot, rootId, { originalHost: true }); this.valid(slot, rootId); }
    else this.field('seed', { ...point, r: 45, rootId, slot, duration: 5 });
  }

  infect(enemy, slot, rootId, options = {}) {
    const actualSlot = slot?.id === 'seed' ? slot : this.slot('seed');
    const config = actualSlot || { id: 'seed', branch: null, modifier: null, evolution: 0 };
    return this.addStatus(enemy, 'infected', { rootId, slot: config, originalHost: true, ...options });
  }

  addStatus(enemy, type, options = {}) {
    if (!alive(enemy)) return null;
    enemy.statuses ||= {};
    const old = enemy.statuses[type];
    const defaults = { mark: 4, infected: 3, exposed: 3, rupture: 5, burn: 2.4, strain: 2, stroke: 4, lease: 4 };
    const duration = options.duration ?? options.remaining ?? defaults[type] ?? 3;
    const rootId = options.rootId ?? this.game.newRoot();
    if (type === 'mark') {
      const owner = this.root(rootId);
      if (owner.markTargets.has(enemy.id)) return old || null;
      owner.markTargets.add(enemy.id);
    }
    if (type === 'infected') {
      if (old) {
        if (!old.appliedRoots.has(rootId)) { old.stacks = Math.min(3, old.stacks + 1); old.appliedRoots.add(rootId); }
        old.remaining = Math.min(5, Math.max(old.remaining, options.remaining ?? duration));
        old.duration = Math.max(old.duration, old.remaining);
        return old;
      }
      const owner = this.root(rootId);
      // A root cannot repeatedly reinfect the same target through overlapping trails.
      if (owner.infectedTargets.has(enemy.id)) return null;
      owner.infectedTargets.add(enemy.id);
      const slot = options.slot || (options.child ? { id: 'seed', branch: options.branch ?? null, modifier: options.modifier ?? null, evolution: options.evolution || 0 } : this.slot('seed')) || { id: 'seed', branch: null, modifier: null, evolution: 0 };
      const scale = options.damageScale ?? 1;
      const reservoir = slot.branch === 'reservoir';
      const originalHost = options.originalHost !== false && !options.child;
      const spread = options.spread !== false && originalHost && !reservoir;
      const status = {
        ...options,
        remaining: options.remaining ?? duration, duration: Math.max(duration, options.remaining ?? duration), stacks: 1, rootId, statusOwnerRoot: rootId, slotId: slot.id,
        branch: slot.branch, modifier: slot.modifier, evolution: slot.evolution || 0, originalHost, damageScale: scale,
        damage: (reservoir ? 35 : 25) * scale, deathDamage: (110 + (reservoir ? 70 : 0)) * scale,
        expiryDamage: (145 + (reservoir ? 70 : 0)) * scale, age: 0, tickTimer: .25,
        spreadTimes: spread ? (slot.branch === 'carrier' ? [1.1, 2] : [1.5]) : [], spreadIndex: 0, spreadTargets: new Set(), appliedRoots: new Set([rootId]),
        snapshotPower: options.snapshotPower ?? this.game.stats.power ?? 1, snapshotBonus: options.snapshotBonus ?? this.game.stats.skillBonus ?? 0,
        lastX: enemy.x, lastY: enemy.y, trailTimer: 0, trailTargets: new Set(), transferred: !!options.transferred, copied: !!(options.copied || options.noCopy),
      };
      enemy.statuses.infected = status;
      this.root(rootId);
      return status;
    }
    if (old && type !== 'mark') {
      old.remaining = Math.max(old.remaining, options.remaining ?? duration);
      old.duration = Math.max(old.duration, old.remaining);
      if (type === 'strain') old.stacks = Math.min(4, (old.stacks || 0) + (options.stacks || 1));
      if (type === 'burn' && (options.damage || 18) > old.damage) { old.damage = options.damage; old.snapshotPower = this.game.stats.power ?? 1; old.snapshotBonus = this.game.stats.skillBonus ?? 0; }
      return old;
    }
    const status = { remaining: options.remaining ?? duration, duration, stacks: 1, rootId, ...options };
    if (type === 'mark') status.returnCurrent = options.returnCurrent ?? ((this.slot('overcharge')?.evolution || 0) >= 2);
    if (type === 'burn') { status.damage = options.damage ?? 18; status.tickTimer = .3; status.snapshotPower = this.game.stats.power ?? 1; status.snapshotBonus = this.game.stats.skillBonus ?? 0; }
    enemy.statuses[type] = status;
    return status;
  }

  detonate(enemy, status, reason, triggerRoot = status.rootId, directInfo = null, canProc = true) {
    if (enemy.statuses.infected !== status) return false;
    delete enemy.statuses.infected;
    const state = this.root(status.rootId);
    let damage = reason === 'expiry' ? status.expiryDamage : status.deathDamage;
    if (reason === 'manual' && status.modifier === 'manual_detonate') damage *= 1.2;
    if (directInfo && status.originalHost && this.hasMethod('patient_zero') && !state.patient) { damage += 40; state.patient = true; }
    if (directInfo?.held >= .8 && this.hybrid('patient_zero_strike') && !state.patientStrike) { damage += Math.min(90, (directInfo.infectionRemaining ?? status.remaining) * 30); state.patientStrike = true; }
    const allowProc = state.bursts++ < 4 && canProc;
    const meta = { rootId: status.rootId, triggerRoot, statusOwnerRoot: status.rootId, tag: 'INFECTION', effectId: 'infection_burst', infectionBurst: true, hostId: enemy.id, originalHost: status.originalHost, remainingInfection: status.remaining, noProc: !allowProc, snapshotPower: status.snapshotPower, snapshotBonus: status.snapshotBonus };
    for (const target of this.near(enemy.x, enemy.y, 65)) this.hit(target, damage, 'STATUS', meta, null);
    this.fx('burst', { x: enemy.x, y: enemy.y, r: 65, color: COLORS.seed, life: .22 });
    this.game.onInfectionBurst?.(enemy, status, { reason, triggerRoot, damage, allowProc });
    if (allowProc && reason === 'manual' && status.evolution >= 3 && status.originalHost && !state.final) {
      state.final = true;
      this.field('cone', { x: enemy.x, y: enemy.y, r: 150, angle: this.game.cursor.angle || 0, angleWidth: Math.PI / 2, rootId: status.rootId, slot: this.slot('seed'), duration: .5, originCursorX: this.game.cursor.x, originCursorY: this.game.cursor.y, infection: status });
    }
    return true;
  }

  onSkillHit(enemy, meta) {
    const status = enemy.statuses?.infected;
    if (!status || meta.noProc || !this.hybrid('delayed_script') || !meta.slotId || meta.slotId === status.slotId || status.age > 5 || meta.tick || meta.infectionBurst) return;
    const slot = this.slot(meta.slotId);
    if (!slot) return;
    this.detonate(enemy, status, 'skill', meta.rootId);
    if (!slot.delayedRefundUsed) { slot.cd = Math.max(2, slot.cd - 2); slot.delayedRefundUsed = true; }
  }

  onKill(enemy, source, meta = {}) {
    for (const f of this.game.fields) {
      if (f.removed) continue;
      if (f.type === 'hole' && !enemy.boss && this.holeOwns(f, enemy)) f.mass = Math.min(8, f.mass + (enemy.elite ? 3 : 1));
      if (f.type === 'command' && f.slot.evolution >= 3 && source === 'DIRECT' && distance(f, enemy) <= f.r) this.game.network = Math.min(100, (this.game.network || 0) + 5);
    }
    const mark = enemy.statuses?.mark;
    if (mark?.returnCurrent) {
      delete enemy.statuses.mark;
      const state = this.root(meta.rootId);
      if (!meta.noProc && state.returns++ < 2) this.game.arc(enemy.x, enemy.y, 1, [55], { rootId: meta.rootId, tag: 'CHAIN', effectId: 'return_current', chain: true }, [enemy.id]);
    }
    const infection = enemy.statuses?.infected;
    if (!infection) return;
    const direct = source === 'DIRECT' && meta.directInfo?.skillTargetId === enemy.id ? meta.directInfo : null;
    const state = this.root(infection.rootId);
    // Remove before recursively damaging neighbors; one status can burst only once.
    this.detonate(enemy, infection, direct?.earlyDetonate ? 'manual' : 'death', meta.rootId ?? infection.rootId, direct, !meta.noProc);
    if (!meta.noProc && infection.modifier === 'dormant_soil' && state.soil++ === 0) this.field('soil', { x: enemy.x, y: enemy.y, r: 35, rootId: infection.rootId, slot: this.slot('seed'), duration: 3, infection });
    if (!meta.noProc && infection.evolution >= 2 && infection.originalHost && !infection.transferred && state.transfers++ === 0) {
      const target = this.nearest(enemy.x, enemy.y, 100, e => !e.statuses.infected);
      if (target) this.infect(target, this.slot('seed'), infection.rootId, { remaining: Math.max(.3, infection.remaining), damageScale: infection.damageScale, originalHost: false, spread: false, transferred: true, snapshotPower: infection.snapshotPower, snapshotBonus: infection.snapshotBonus });
    }
    if (!meta.noProc && source === 'SKILL' && this.hybrid('delayed_script') && meta.slotId && meta.slotId !== infection.slotId && infection.age <= 5) {
      const slot = this.slot(meta.slotId);
      if (slot && !slot.delayedRefundUsed) { slot.cd = Math.max(2, slot.cd - 2); slot.delayedRefundUsed = true; }
    }
  }

  breakProtection(enemy) {
    if (this.game.breakProtection) this.game.breakProtection(enemy);
    else if (enemy.protectedBy != null) enemy.protectedBy = null;
    if (enemy.type === 'ward') enemy.disrupted = Math.max(enemy.disrupted || 0, 2);
  }
  push(enemy, center, amount) {
    const dx = enemy.x - center.x, dy = enemy.y - center.y, d = Math.hypot(dx, dy) || 1;
    enemy.x = clamp(enemy.x + dx / d * amount, enemy.r, this.game.width - enemy.r);
    enemy.y = clamp(enemy.y + dy / d * amount, enemy.r, this.game.height - enemy.r);
  }

  update(dt) {
    if (this.game.phase === 'ended') return;
    for (const slot of this.game.skillSlots) if (slot) slot.cd = Math.max(0, (slot.cd || 0) - dt);
    this.networkCooldown = Math.max(0, this.networkCooldown - dt);
    this.censusCooldown = Math.max(0, this.censusCooldown - dt);
    if (this.armed) { this.armed.remaining -= dt; if (this.armed.remaining <= 0) { this.cooldown(this.armed.slot, 5); this.armed = null; } }
    if (this.held) { this.held.heldSeconds += dt; this.held.remaining -= dt; if (this.held.remaining <= 0) this.release(this.held.index, this.held.heldSeconds); }
    if (this.route) { this.route.remaining -= dt; if (this.route.remaining <= 0) this.routeCircuit({ x: this.route.x, y: this.route.y }, false); }
    this.updatePassives(dt);
    for (const enemy of [...this.game.enemies]) { if (this.game.phase === 'ended') break; if (alive(enemy)) this.updateStatuses(enemy, dt); }
    for (const field of [...this.game.fields]) { if (this.game.phase === 'ended') break; if (!field.removed) this.updateField(field, dt); }
    this.game.fields = this.game.fields.filter(f => !f.removed);
    if (this.game.time % 30 < dt) {
      for (const [id, state] of this.rootState) if (this.game.time - state.created > 60) this.rootState.delete(id);
      if (this.validRoots.size > 4096) this.validRoots.clear();
    }
  }

  updatePassives(dt) {
    const orbital = this.slot('orbital');
    if (orbital) {
      if (orbital.evolution >= 3 && !this.networkUnlocked) { this.networkUnlocked = true; this.game.network = Math.max(50, this.game.network || 0); }
      this.scoutTimer -= dt;
      if (this.scoutTimer <= 0) {
        const host = this.hybrid('parasite_hive') ? this.nearest(this.game.cursor.x, this.game.cursor.y, 110, e => e.statuses.infected) : null;
        const target = (host && this.selectOrbital(host, 70, e => !e.statuses.infected)) || this.selectOrbital(this.game.cursor, 110);
        if (target) { const rootId = this.game.newRoot(); this.hit(target, 25, 'SUMMON', this.meta(orbital, rootId, { effectId: 'orbital_scout', passive: true }), null); this.fx('line', { x: this.game.cursor.x, y: this.game.cursor.y, toX: target.x, toY: target.y, color: COLORS.orbital, life: .15 }); }
        this.scoutTimer += 2.1 * (this.game.relics?.includes('swarm_clock') ? .75 : 1);
      }
    }
    const overcharge = this.slot('overcharge');
    if (overcharge?.evolution >= 3) {
      this.circuitTimer -= dt;
      if (this.circuitTimer <= 0) { this.game.arc(this.game.cursor.x, this.game.cursor.y, 1, [35], this.meta(overcharge, this.game.newRoot(), { chain: true, effectId: 'living_circuit_passive', passive: true })); this.circuitTimer += 5; }
    }
  }

  updateStatuses(enemy, dt) {
    for (const [type, status] of Object.entries(enemy.statuses)) {
      if (!alive(enemy) || enemy.statuses[type] !== status) continue;
      status.remaining -= dt;
      if (type === 'infected') {
        status.age += dt; status.tickTimer -= dt;
        while (status.tickTimer <= 0 && alive(enemy) && enemy.statuses.infected === status) {
          this.hit(enemy, (status.damage + (status.stacks - 1) * 8 * status.damageScale) * .25, 'STATUS', { rootId: status.rootId, tag: 'INFECTION', tick: true, effectId: 'infection_tick', snapshotPower: status.snapshotPower, snapshotBonus: status.snapshotBonus }, null);
          status.tickTimer += .25;
        }
        if (enemy.statuses.infected !== status) continue;
        while (status.spreadIndex < status.spreadTimes.length && status.age >= status.spreadTimes[status.spreadIndex]) {
          status.spreadIndex++;
          const hole = this.game.fields.find(f => f.type === 'hole' && !f.removed && this.holeOwns(f, enemy));
          const quarantine = hole && this.hybrid('quarantine_collapse');
          const target = this.nearest(enemy.x, enemy.y, 70, e => !e.statuses.infected && !status.spreadTargets.has(e.id) && (!quarantine || distance(e, hole) <= hole.r));
          if (target) {
            status.spreadTargets.add(target.id);
            this.infect(target, this.slot('seed'), status.rootId, { damageScale: status.branch === 'carrier' ? .65 : status.damageScale, originalHost: false, spread: false, snapshotPower: status.snapshotPower, snapshotBonus: status.snapshotBonus });
            this.fx('line', { x: enemy.x, y: enemy.y, toX: target.x, toY: target.y, color: COLORS.seed, life: .2 });
          } else if (quarantine) hole.quarantine = Math.min(3, (hole.quarantine || 0) + 1);
        }
        if (status.evolution >= 1) {
          status.trailTimer -= dt;
          const length = Math.hypot(enemy.x - status.lastX, enemy.y - status.lastY);
          if (status.trailTimer <= 0 && length >= 8) {
            const t = length > 90 ? 90 / length : 1;
            this.field('trail', { x: enemy.x, y: enemy.y, x2: enemy.x + (status.lastX - enemy.x) * t, y2: enemy.y + (status.lastY - enemy.y) * t, width: 8, r: 0, rootId: status.rootId, slot: this.slot('seed'), duration: 2, infection: status, seen: status.trailTargets, maxTargets: 2 });
            status.lastX = enemy.x; status.lastY = enemy.y; status.trailTimer = .35;
          }
        }
        if (status.remaining <= 0) this.detonate(enemy, status, 'expiry');
      } else if (type === 'burn') {
        status.tickTimer -= dt;
        while (status.tickTimer <= 0 && alive(enemy)) { this.hit(enemy, status.damage * .3, 'STATUS', { rootId: status.rootId, tag: 'SWARM', tick: true, effectId: 'burn_tick', snapshotPower: status.snapshotPower, snapshotBonus: status.snapshotBonus }, null); status.tickTimer += .3; }
        if (status.remaining <= 0) delete enemy.statuses[type];
      } else if (status.remaining <= 0) delete enemy.statuses[type];
    }
  }

  updateField(f, dt) {
    f.age += dt; f.remaining -= dt;
    if (f.type === 'bomb') { if (f.remaining <= 0) { f.removed = true; this.explodeBomb(f); } return; }
    if (f.type === 'hole') this.updateHole(f, dt);
    else if (f.type === 'command') this.updateCommand(f);
    else if (f.type === 'sweep') this.updateSweep(f, dt);
    else if (f.type === 'network') {
      f.x = this.game.cursor.x; f.y = this.game.cursor.y; f.tickTimer -= dt;
      while (f.tickTimer <= 0 && f.remaining >= -dt) {
        for (const e of this.game.enemies.filter(alive)) {
          const horizontal = Math.abs(e.y - f.y) <= 12 + e.r, vertical = Math.abs(e.x - f.x) <= 12 + e.r;
          if (horizontal || vertical) this.hit(e, horizontal && vertical ? 30 : 14, 'SKILL', this.meta(f.slot, f.rootId, { tick: true, effectId: 'cross_network' }), f.slot);
          if (horizontal && vertical && f.perfect) this.addStatus(e, 'exposed', { duration: 2, rootId: f.rootId });
        }
        f.tickTimer += .2;
      }
    } else if (f.type === 'residue') {
      f.tickTimer -= dt;
      while (f.tickTimer <= 0) { for (const e of this.near(f.x, f.y, f.r)) this.hit(e, f.damage * f.tickEvery, 'SKILL', this.meta(f.slot, f.rootId, { tick: true, effectId: 'void_residue' }), f.slot); f.tickTimer += f.tickEvery; }
    } else if (f.type === 'fire') {
      for (const e of this.near(f.x, f.y, f.r)) if (!f.seen.has(e.id)) { f.seen.add(e.id); this.addStatus(e, 'burn', { rootId: f.rootId, duration: 2.4, damage: 18 }); }
    } else if (f.type === 'seed' || f.type === 'soil') {
      const e = this.nearest(f.x, f.y, f.r, e => f.type === 'seed' || !e.statuses.infected);
      if (e) { this.infect(e, f.slot, f.rootId, { damageScale: f.type === 'soil' ? f.infection.damageScale * .65 : 1, originalHost: f.type === 'seed', spread: f.type === 'seed', ...(f.infection ? { snapshotPower: f.infection.snapshotPower, snapshotBonus: f.infection.snapshotBonus } : {}) }); this.valid(f.slot, f.rootId); f.removed = true; }
    } else if (f.type === 'seam') {
      for (const e of this.game.enemies.filter(alive)) if (inLine(e, f)) { this.addStatus(e, 'exposed', { duration: 2, rootId: f.rootId }); f.seen.add(e.id); this.valid(f.slot, f.rootId); }
    } else if (f.type === 'trail') {
      for (const e of this.game.enemies.filter(alive)) if (f.seen.size < f.maxTargets && !e.statuses.infected && !f.seen.has(e.id) && inLine(e, f)) { f.seen.add(e.id); this.infect(e, f.slot, f.rootId, { damageScale: f.infection.damageScale * .65, originalHost: false, spread: false, snapshotPower: f.infection.snapshotPower, snapshotBonus: f.infection.snapshotBonus }); }
    } else if (f.type === 'cone') {
      const dx = this.game.cursor.x - f.originCursorX, dy = this.game.cursor.y - f.originCursorY;
      if (Math.hypot(dx, dy) >= 20) f.angle = Math.atan2(dy, dx);
      if (f.remaining <= 0) {
        const moved = Math.hypot(dx, dy) >= 20;
        const targets = this.near(f.x, f.y, 150, e => {
          if (e.statuses.infected) return false;
          const a = Math.atan2(e.y - f.y, e.x - f.x), delta = Math.atan2(Math.sin(a - f.angle), Math.cos(a - f.angle));
          return !moved || Math.abs(delta) <= Math.PI / 4;
        }).sort((a, b) => distance(a, f) - distance(b, f) || a.id - b.id).slice(0, moved ? 3 : 2);
        for (const e of targets) this.infect(e, f.slot, f.rootId, { damageScale: f.infection.damageScale * .65, originalHost: false, spread: false, snapshotPower: f.infection.snapshotPower, snapshotBonus: f.infection.snapshotBonus });
      }
    } else if (f.type === 'fold' && f.remaining <= 0) {
      for (const e of this.game.enemies.filter(alive)) if (inLine(e, f)) { this.hit(e, f.damage, 'SKILL', this.meta(f.slot, f.rootId, { effectId: 'reality_fold' }), f.slot); this.breakProtection(e); }
      this.fx('slash', { x: f.x, y: f.y, toX: f.x2, toY: f.y2, width: 32, color: COLORS.hole, life: .22 });
    }
    if (f.remaining <= 0) { f.removed = true; if (f.type === 'hole') this.endHole(f); }
  }

  updateHole(f, dt) {
    const now = new Set();
    for (const e of this.game.enemies.filter(alive)) if (this.holeOwns(f, e)) {
      now.add(e.id);
      if (!e.boss) {
        const d = distance(e, f), pullResistance = e.type === 'anchor' ? .35 : 1;
        const amount = Math.min(f.pull * pullResistance * dt, Math.max(0, d - 8));
        if (d > 0) { e.x += (f.x - e.x) / d * amount; e.y += (f.y - e.y) / d * amount; if (amount > 0) this.valid(f.slot, f.rootId); }
      }
    }
    for (const id of f.inside) if (!now.has(id)) {
      const e = this.game.enemies.find(e => e.id === id);
      if (!alive(e)) continue;
      if (f.slot.modifier === 'tidal_pull') {
        if (e.boss) this.addStatus(e, 'exposed', { duration: 2, rootId: f.rootId });
        else { e.slowRemaining = 1.5; e.slowFactor = .75; }
      }
      if (this.hasMethod('orbit_shear') && f.sheared.size < 4 && !f.sheared.has(id)) { f.sheared.add(id); this.addStatus(e, 'rupture', { duration: 5, rootId: f.rootId }); }
    }
    f.inside = now; f.tickTimer -= dt;
    while (f.tickTimer <= 0 && f.remaining >= -dt) {
      for (const e of this.near(f.x, f.y, f.r)) if (this.holeOwns(f, e)) {
        this.hit(e, 15 * f.damageScale, 'SKILL', this.meta(f.slot, f.rootId, { tick: true, effectId: 'hole_tick' }), f.slot);
        if (alive(e) && e.boss && !f.strainTriggered.has(e.id)) {
          const strain = this.addStatus(e, 'strain', { rootId: f.rootId, duration: 2, stacks: 1 });
          if (strain.stacks >= 4) { delete e.statuses.strain; this.addStatus(e, 'exposed', { rootId: f.rootId, duration: 4 }); f.strainTriggered.add(e.id); }
        }
      }
      f.tickTimer += .5;
    }
  }

  updateCommand(f) {
    if (f.hostId != null && !f.redirected) {
      const host = this.game.enemies.find(e => e.id === f.hostId);
      if (alive(host)) { f.x = host.x; f.y = host.y; }
    }
    for (const shot of f.shots) {
      if (shot.fired) continue;
      if (f.forceTarget && !shot.locked && f.age < shot.at - .3) { shot.x = f.forceTarget.x; shot.y = f.forceTarget.y; shot.manual = true; f.forceTarget = null; }
      if (f.age >= shot.at - f.warning && !shot.visible) {
        shot.visible = true;
        const target = (f.slot.branch === 'watchtower' && this.selectOrbital(f, f.r, e => e.anchorIndex === f.anchorIndex && e.channel > 0)) || this.selectOrbital(f, f.r);
        shot.targetId = target?.id;
        if (!shot.manual) { shot.x = target?.x ?? f.x; shot.y = target?.y ?? f.y; }
      }
      if (shot.visible && !shot.locked && !shot.manual && f.slot.evolution >= 1 && f.age < shot.at - .3) {
        const target = this.game.enemies.find(e => e.id === shot.targetId);
        if (alive(target)) { shot.x = target.x; shot.y = target.y; }
      }
      if (f.age >= shot.at - .3) shot.locked = true;
      if (f.age >= shot.at) this.fireShot(f, shot);
    }
  }

  updateSweep(f, dt) {
    if (f.age < f.startDelay) return;
    const elapsed = Math.min(3, f.age - f.startDelay);
    f.angle = f.startAngle + elapsed / 1.5 * TAU;
    f.tickTimer -= dt;
    while (f.tickTimer <= 0 && f.age <= f.duration + dt) {
      const revolution = Math.min(1, Math.floor(elapsed / 1.5));
      const angles = f.lattice ? [f.angle, f.angle + Math.PI / 2] : [f.angle];
      for (const e of this.game.enemies.filter(alive)) {
        const hit = angles.some(a => inLine(e, this.cutLines(f, a, f.length, f.width)[0]));
        const record = f.hits.get(e.id) || { total: 0, turns: new Set() };
        if (hit && record.total < 2 && !record.turns.has(revolution)) {
          record.total++; record.turns.add(revolution); f.hits.set(e.id, record);
          this.hit(e, f.slot.branch === 'razor' ? 125 : 100, 'SKILL', this.meta(f.slot, f.rootId, { effectId: 'last_judgement', hitIndex: revolution }), f.slot);
          if (alive(e) && f.slot.modifier === 'rupture_edge') this.addStatus(e, 'rupture', { duration: 5, rootId: f.rootId });
          this.breakProtection(e);
        }
      }
      f.tickTimer += .1;
    }
    if (f.slot.modifier === 'afterimage' && !f.afterimageDone && f.age >= .5) {
      f.afterimageDone = true;
      const lines = this.cutLines(f, f.startAngle, f.length, f.width, f.lattice);
      for (const e of this.game.enemies.filter(alive)) if (lines.some(line => inLine(e, line))) {
        const record = f.hits.get(e.id) || { total: 0, turns: new Set() };
        if (record.total < 2) { record.total++; f.hits.set(e.id, record); this.hit(e, 70, 'SKILL', this.meta(f.slot, f.rootId, { effectId: 'judgement_afterimage' }), f.slot); }
      }
    }
  }
}
