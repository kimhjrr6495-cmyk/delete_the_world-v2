import { displayText, enemyName } from './ui-text.js';
import { arenaViewport } from './util.js';

const TAU = Math.PI * 2;
const C = {
  background: '#090F29', text: '#F7F2FF', muted: '#B3B4D7',
  chain: '#5EE3FF', infection: '#A6E857', singularity: '#A67CFF',
  swarm: '#F2C15A', impact: '#FF8C6B', bomb: '#ED78BF', danger: '#FF425B',
};
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const fraction = o => clamp(finite(o.remaining, finite(o.duration) - finite(o.age)) / Math.max(.001, finite(o.duration, finite(o.maxLife, 1))));
const enemyNames = Object.fromEntries(['drifter','ward','channeler','splitter','scrubber','jammer','anchor','mirror','archivist','conductor','reality','training_boss'].map(id=>[id,enemyName(id)]));
const labelCache = new Map();
const signalNames = { COMMAND:'포격', LOCK:'고정', TRACK:'추적', DORMANT:'잠복', FOLD:'접기', PURIFYING:'정화', 'WORLD CUT':'절단 경고' };
const enemyColors = { drifter: '#F4F6FF', ward: '#75BDFF', channeler: '#FF425B', splitter: '#B08CFF', scrubber: '#B8FF76', jammer: '#FF78C9', anchor: '#FFB454', mirror: '#C9EFFF', archivist: '#FF425B', conductor: '#FF425B', reality: '#FF425B', training_boss: '#FF425B' };

/** All geometry is in logical arena pixels. Drawing never changes combat state. */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.clock = 0;
    this.width = 1280;
    this.height = 760;
    this.healthTrails = new Map();
  }

  draw(game, dt = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.clock += finite(dt);
    this.frameDt = finite(dt);
    if (this.healthTrails.size > 600) this.healthTrails.clear();
    this.width = finite(game.width, 1280);
    this.height = finite(game.height, 760);
    this.game = game;
    this.settings = game.settings || {};
    this.reduced = !!this.settings.reducedMotion;
    this.low = !!this.settings.lowEffects;
    this.high = !!this.settings.highContrast;
    this.time = finite(game.time);
    this.preview = game.skills?.targetingPreview || null;
    this.previewTargets = new Set(this.preview?.targets || []);
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = C.background;
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const viewport = arenaViewport(this.canvas.width, this.canvas.height, this.width, this.height);
    ctx.setTransform(viewport.scale, 0, 0, viewport.scale, viewport.offsetX, viewport.offsetY);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.background();
    if (game.phase === 'menu') { ctx.restore(); return; }
    this.anchors(false);
    const fields = game.fields || [];
    for (const field of fields) this.field(field);
    this.targetingPreview();
    this.wardLinks();
    for (const enemy of game.enemies || []) if (!enemy.dead) this.enemy(enemy);
    const effects = game.effects || [];
    const cap = this.low ? 80 : 180;
    let drawn = 0;
    for (let i = effects.length - 1; i >= 0 && drawn < cap; i--) {
      const fx = effects[i];
      if (fx.danger || fx.priority === 'danger') continue;
      if (this.low && ['hit', 'spawn', 'heal'].includes(fx.kind) && drawn > 24) continue;
      this.effect(fx);
      drawn++;
    }
    this.statusPass();
    this.controlSignals();
    this.dangerPass();
    this.anchors(true);
    for (const fx of effects) if (fx.danger || fx.priority === 'danger') this.effect(fx);
    this.cursor();
    this.edgeIndicators();
    ctx.restore();
  }

  line(x1, y1, x2, y2, color, width = 1, alpha = 1, dash = null) {
    const c = this.ctx;
    c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width;
    if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore();
  }

  circle(x, y, r, color, width = 1, alpha = 1, start = 0, end = TAU, dash = null) {
    if (!(r > 0)) return;
    const c = this.ctx;
    c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width;
    if (dash) c.setLineDash(dash);
    c.beginPath(); c.arc(x, y, r, start, end); c.stroke(); c.restore();
  }

  fillCircle(x, y, r, color, alpha = 1) {
    if (!(r > 0)) return;
    const c = this.ctx;
    c.save(); c.globalAlpha = alpha; c.fillStyle = color;
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }

  polygon(x, y, radius, sides, color, fill = null, angle = -Math.PI / 2, width = 1.5, alpha = 1) {
    const c = this.ctx;
    c.save(); c.globalAlpha = alpha; c.lineWidth = width; c.strokeStyle = color;
    c.beginPath();
    for (let i = 0; i < sides; i++) {
      const a = angle + i * TAU / sides;
      const px = x + Math.cos(a) * radius, py = y + Math.sin(a) * radius;
      if (i) c.lineTo(px, py); else c.moveTo(px, py);
    }
    c.closePath(); if (fill) { c.fillStyle = fill; c.fill(); } c.stroke(); c.restore();
  }

  label(text, x, y, color = C.muted, size = 10, align = 'left', alpha = 1) {
    const c = this.ctx;
    let content=String(text);
    if(/[A-Za-z]/.test(content)){
      if(!labelCache.has(content)){if(labelCache.size>256)labelCache.clear();labelCache.set(content,signalNames[content]||(/^M\d+$/.test(content)?`질량 ${content.slice(1)}`:displayText(content)));}
      content=labelCache.get(content);
    }
    c.save(); c.globalAlpha = alpha; c.fillStyle = color;
    c.font = `500 ${size}px "Segoe UI", "Malgun Gothic", sans-serif`;
    c.textAlign = align; c.textBaseline = 'middle'; c.fillText(content, x, y); c.restore();
  }

  brackets(x, y, r, color, alpha = 1, lineWidth = 1.5) {
    const s = Math.max(5, r * .28), c = this.ctx;
    c.save(); c.strokeStyle = color; c.globalAlpha = alpha; c.lineWidth = lineWidth;
    for (const [dx, dy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      c.beginPath(); c.moveTo(x + dx * (r - s), y + dy * r); c.lineTo(x + dx * r, y + dy * r);
      c.lineTo(x + dx * r, y + dy * (r - s)); c.stroke();
    }
    c.restore();
  }

  clockRing(x, y, r, color, progress, segments = 8, alpha = 1, width = 1.7) {
    const p = clamp(progress), gap = .055;
    for (let i = 0; i < segments; i++) {
      const start = -Math.PI / 2 + i * TAU / segments + gap;
      const end = -Math.PI / 2 + (i + 1) * TAU / segments - gap;
      this.circle(x, y, r, color, .8, alpha * .25, start, end);
      const local = clamp(p * segments - i);
      if (local) this.circle(x, y, r, color, width, alpha, start, start + (end - start) * local);
    }
  }

  arrow(x, y, angle, color, length = 7, alpha = 1) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.rotate(angle); c.globalAlpha = alpha;
    c.strokeStyle = color; c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-length * .5, -length * .55); c.lineTo(length * .5, 0);
    c.lineTo(-length * .5, length * .55); c.stroke(); c.restore();
  }

  background() {
    const c = this.ctx, w = this.width, h = this.height;
    c.fillStyle = C.background; c.fillRect(0, 0, w, h);
    const worldTime = this.game.phase === 'menu' ? 0 : finite(this.game.worldTime, this.time);
    const ruin = clamp((100 - finite(this.game.integrity, 100)) / 100), bloom = clamp(worldTime / 1080);
    // Soft, irregular nebulae establish a place. Their light never competes with danger.
    this.glow(w * .27, h * .35, w * .58, '#323B83', this.high ? .16 : .44);
    if (!this.low) {
      this.glow(w * .76, h * .62, w * .48, ruin > .55 ? '#552D60' : '#513578', .28 + bloom * .1);
      this.glow(w * .52, h * .79, w * .36, '#19596C', .2);
      this.glow(w * .5, h * .46, w * .35, '#384871', .12);
      for (let i = 0; i < 5; i++) {
        const x = w * (.12 + i * .19), y = h * (.42 + Math.sin(i * 1.6) * .14);
        this.glow(x, y, w * .19, i % 2 ? '#534070' : '#254B6F', this.high ? .05 : .1);
      }
    }
    const count = this.low ? 34 : 150, drift = this.reduced ? 0 : this.clock * .55;
    for (let i = 0; i < count; i++) {
      const x = ((i * 997.31 + drift * (i % 3 + 1)) % (w + 20)) - 10, y = ((i * 571.71 + 37) % h);
      const twinkle = this.reduced ? 1 : .76 + Math.sin(this.clock * .35 + i * 1.4) * .24;
      this.fillCircle(x, y, i % 17 ? .65 : 1.25, i % 4 ? '#C9D7FF' : '#C5B1EF', (i % 17 ? .3 : .56) * twinkle);
      if (!this.low && i % 37 === 0) this.glow(x, y, 7, '#A9BCFF', .13 * twinkle);
    }
    if (!this.low && !this.reduced) {
      // Deterministic, rare starlight: no random calls or combat state changes.
      const passage = this.clock % 23;
      if (passage > 20 && passage < 21.6) {
        const t = (passage - 20) / 1.6, x = w * (.68 + t * .18), y = h * (.12 + t * .14);
        this.line(x - 38, y - 20, x, y, '#B9CAFF', 1, Math.sin(t * Math.PI) * .25);
        this.glow(x, y, 8, '#CEDAFF', Math.sin(t * Math.PI) * .18);
      }
      for (let i = 0; i < 18; i++) {
        const x = (i * 179.7 + this.clock * (1 + i % 3)) % w;
        const y = (i * 93.3 + Math.sin(this.clock * .08 + i) * 14 + h) % h;
        this.glow(x, y, 2.5, '#B7B1EF', .09);
      }
    }
    if (ruin > .4) {
      c.save(); c.globalAlpha = (ruin - .4) * .14; c.strokeStyle = '#AA7780'; c.lineWidth = 1;
      for (let i = 0; i < 4; i++) {
        const x = w * (.08 + i * .27), y = i % 2 ? h : 0, direction = i % 2 ? -1 : 1;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + 21, y + direction * h * .08); c.lineTo(x - 13, y + direction * h * .17);
        c.lineTo(x + 17, y + direction * h * .27 * ruin); c.stroke();
      }
      c.restore();
    }
  }

  glow(x, y, r, color, alpha = .2) {
    if (!(r > 0) || !(alpha > 0)) return;
    const c = this.ctx, gradient = c.createRadialGradient(x, y, 0, x, y, r);
    gradient.addColorStop(0, color); gradient.addColorStop(1, 'transparent');
    c.save(); c.globalAlpha = clamp(alpha); c.fillStyle = gradient; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }

  organic(x, y, r, color, fill, seed = 0, lobes = 5, alpha = 1, width = 1) {
    const c = this.ctx, points = [];
    for (let i = 0; i < 12; i++) {
      const a = i * TAU / 12, d = r * (1 + .12 * Math.sin(a * lobes + seed) + .06 * Math.cos(a * 3 - seed));
      points.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d });
    }
    c.save(); c.globalAlpha = alpha; c.fillStyle = fill; c.strokeStyle = color; c.lineWidth = width;
    c.beginPath(); c.moveTo((points[0].x + points[11].x) / 2, (points[0].y + points[11].y) / 2);
    for (let i = 0; i < 12; i++) {
      const p = points[i], next = points[(i + 1) % 12];
      c.quadraticCurveTo(p.x, p.y, (p.x + next.x) / 2, (p.y + next.y) / 2);
    }
    c.closePath(); c.fill(); c.stroke(); c.restore();
  }

  inwardDust(x, y, r, color, age = this.clock, alpha = .6, spiral = false) {
    const count = this.low ? 4 : 11;
    for (let i = 0; i < count; i++) {
      const t = this.reduced ? (i + .5) / count : (age * .65 + i * .618) % 1;
      const a = i * 2.399 + (spiral && !this.reduced ? age * .3 + t * .9 : 0), d = r * (1 - t);
      const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
      this.fillCircle(px, py, 1 + (i % 3) * .3, color, alpha * (.3 + t * .6));
      if (!this.low) this.line(px, py, x + Math.cos(a - .04) * (d + 5), y + Math.sin(a - .04) * (d + 5), color, .7, alpha * .24);
    }
  }

  targetingPreview() {
    const p = this.preview;
    if (!p) return;
    const color = p.valid === false ? '#848493' : ({ overcharge: C.chain, bomb: C.bomb, hole: C.singularity, cut: C.text, orbital: C.swarm, seed: C.infection }[p.id] || C.text);
    const x = finite(p.x), y = finite(p.y), circles = p.circles?.length ? p.circles : p.id !== 'cut' && p.mode !== 'seed-steer' && finite(p.r) > 0 ? [{ x, y, r: p.r }] : [];
    if (p.mode === 'seed-steer') {
      const a = finite(p.angle), r = finite(p.r), half = Math.PI / 4;
      this.circle(x, y, r, color, 1, .65, a - half, a + half, [4, 6]);
      for (const side of [-half, half]) this.line(x, y, x + Math.cos(a + side) * r, y + Math.sin(a + side) * r, color, 1, .55, [4, 6]);
    }
    for (const circle of circles) {
      const cx = finite(circle.x, x), cy = finite(circle.y, y), r = finite(circle.r);
      this.fillCircle(cx, cy, r, color, this.high ? .1 : .035);
      this.circle(cx, cy, r, color, this.high ? 1.5 : 1, .64, 0, TAU, [3, 7]);
      if (p.id === 'hole') { this.inwardDust(cx, cy, r, color, this.clock, .5, true); this.fillCircle(cx, cy, 8, '#080711', .75); }
      if (p.id === 'bomb') { this.glow(cx, cy, 23, color, .28); this.fillCircle(cx, cy, 6, color, .34); this.circle(cx, cy, 8, color, 1, .7); }
      if (p.id === 'orbital' && circle.kind === 'impact') this.incomingShot(cx, cy, r, color, .25, .34, this.width * .3, -48);
    }
    for (const line of p.lines || []) {
      this.lineHitbox(line.x, line.y, line.x2, line.y2, line.width, color, .2, [3, 7]);
      this.line(line.x, line.y, line.x2, line.y2, color, .9, .8, [9, 6]);
    }
    const preChain = p.preChain || [], previousColor = '#D8CEAE';
    for (const circle of p.preCircles || []) {
      this.fillCircle(circle.x, circle.y, circle.r, previousColor, .02);
      this.circle(circle.x, circle.y, circle.r, previousColor, .8, .35, 0, TAU, [3, 9]);
    }
    for (let i = 1; i < preChain.length; i++)
      this.zigzag(preChain[i - 1].x, preChain[i - 1].y, preChain[i].x, preChain[i].y, previousColor, .8, .5, i + finite(preChain[i].id), [3, 8]);
    const chain = p.mode === 'circuit' ? [{ x, y }, ...(p.chain || [])] : p.chain || [];
    for (let i = 1; i < chain.length; i++) {
      this.zigzag(chain[i - 1].x, chain[i - 1].y, chain[i].x, chain[i].y, color, .8, .45, i + finite(chain[i].id), [3, 8]);
      this.fillCircle(chain[i].x, chain[i].y, 2, color, .75);
    }
    if (p.origin && (p.mode !== 'cast') && Math.hypot(p.origin.x - x, p.origin.y - y) > 3)
      this.line(p.origin.x, p.origin.y, x, y, color, .8, .35, [4, 7]);
    for (const [i, point] of (p.records || []).entries()) {
      this.fillCircle(point.x, point.y, 2, color, .7);
      this.label(i + 1, point.x, point.y - 10, color, 10, 'center', .65);
    }
  }

  anchors(warnings) {
    const enemies = this.game.enemies || [];
    for (const [i, a] of (this.game.anchors || []).entries()) {
      const threats = enemies.filter(e => !e.dead && e.anchorIndex === i && finite(e.channel) > 0);
      const active = threats.some(e => finite(e.channel) >= 2), busy = threats.length || a.channeling;
      const x = a.x, y = a.y, r = finite(a.r, 24), color = active ? C.danger : '#FFAD70';
      if (!warnings) {
        const hurt = finite(a.damageFlash) > 0;
        // Only an actual engine hit can redden the planet. Channel warnings stay outside it.
        const shudder = hurt && !this.reduced ? Math.sin(this.clock * 65 + i) * 1.2 : 0;
        this.earth(x + shudder, y, r, i);
        if (hurt) {
          const blink = this.reduced ? .48 : .24 + .42 * (.5 + .5 * Math.sin(this.clock * 34));
          const fade = clamp(a.damageFlash / .12);
          this.fillCircle(x + shudder, y, r, C.danger, blink * fade);
          this.circle(x + shudder, y, r + 2, C.danger, 2.2, (.5 + blink * .5) * fade);
          this.glow(x, y, r * 2.1, C.danger, blink * fade * .36);
        }
        for (const fx of (this.game.effects || []).slice(-32)) {
          if (fx.kind !== 'arc' || finite(fx.age) < finite(fx.delay)) continue;
          const ax = finite(fx.toX, fx.x), ay = finite(fx.toY, fx.y), distance = Math.hypot(ax - x, ay - y);
          if (distance < 220) this.glow(x, y, r * 2.5, C.chain, (1 - distance / 220) * clamp(1 - (fx.age - finite(fx.delay)) / .18) * .38);
        }
        if (busy) this.label(`행성 ${i + 1}`, x, y + r + 33, active ? '#FF899B' : '#E7B787', 11, 'center', .9);
      } else if (busy) {
        this.clockRing(x, y, r + 12, color, active ? 1 : Math.max(0, ...threats.map(e => clamp(e.channel / 2))), 12, 1, 2.2);
        this.brackets(x, y, r + 20, color, 1, 1.7);
        this.label(active ? '안정도 손상' : '공격 준비', x, y - r - 26, color, 12, 'center');
        for (const e of threats.slice(0, 4)) {
          this.line(e.x, e.y, x, y, color, active ? 1.7 : 1.1, active ? .7 : .5, active ? null : [5, 5]);
          const p = this.reduced ? .5 : ((this.time * .8) % 1);
          this.arrow(e.x + (x - e.x) * p, e.y + (y - e.y) * p, Math.atan2(y - e.y, x - e.x), color, 10);
        }
      }
    }
  }

  earth(x, y, r, index = 0) {
    const c = this.ctx;
    this.glow(x, y, r * 2.8, '#69BAF2', .24);
    if (!this.low) this.celestialDust(x, y, r * 1.45, '#B2E7FF', index, .35);
    const ocean = c.createRadialGradient(x - r * .4, y - r * .45, r * .08, x, y, r);
    ocean.addColorStop(0, '#66BDFA'); ocean.addColorStop(.5, '#2784CC'); ocean.addColorStop(1, '#10395F');
    this.fillCircle(x, y, r, ocean);
    c.save(); c.beginPath(); c.arc(x, y, r, 0, TAU); c.clip();
    c.translate(x, y); c.rotate((index - 1) * .16);
    const continents = [
      [[-.95,-.28],[-.74,-.67],[-.33,-.63],[-.1,-.43],[-.22,-.16],[-.38,-.13],[-.32,.1],[-.56,.19],[-.65,-.02],[-.87,.01]],
      [[-.46,.27],[-.2,.19],[.02,.39],[-.1,.61],[-.35,.93],[-.43,.63],[-.59,.38]],
      [[.04,-.62],[.35,-.87],[.78,-.61],[1,-.3],[.78,-.13],[.45,-.25],[.24,-.13],[.08,-.34]],
      [[.04,-.13],[.34,-.07],[.47,.22],[.28,.61],[.03,.48],[-.08,.17]],
      [[.62,.5],[.84,.38],[1,.61],[.75,.8],[.57,.71]],
    ];
    for (const [i, points] of continents.entries()) {
      c.beginPath(); c.moveTo(points[0][0] * r, points[0][1] * r);
      for (let k = 1; k < points.length; k++) c.lineTo(points[k][0] * r, points[k][1] * r);
      c.closePath(); c.fillStyle = i % 2 ? '#80BA70' : '#58A76A'; c.fill();
    }
    // Wisps remain clipped inside the circular ocean and do not become extra HUD rings.
    for (const [cx, cy, size, start, end] of [[-.28,-.47,.53,.05,1.05],[.24,.08,.61,3.1,4.08],[-.11,.56,.57,3.46,4.3]])
      this.circle(cx * r, cy * r, r * size, '#FFFFFF', 1.5, .7, start, end);
    const night = c.createRadialGradient(-r * .4, -r * .45, r * .25, r * .3, r * .15, r * 1.4);
    night.addColorStop(0, 'transparent'); night.addColorStop(.55, '#06192B00'); night.addColorStop(1, '#06192BBF');
    this.fillCircle(0, 0, r, night);
    c.restore();
    this.circle(x, y, r, '#A1D5FF', 1.1, .82);
    this.circle(x, y, r + 1.8, '#83BDF4', .8, .3);
  }

  wardLinks() {
    const enemies = this.game.enemies || [];
    for (const e of enemies) {
      if (e.dead || e.type !== 'ward' || e.grounded || e.protectionDisabled > 0 || e.linkBroken > 0) continue;
      const protectedEnemies = enemies.filter(n => !n.dead && n.id !== e.id && finite(n.linkBroken) <= 0 && n.protectedBy === e.id).slice(0, 3);
      for (const n of protectedEnemies) {
        this.line(e.x, e.y, n.x, n.y, '#659CD4', this.low ? 1 : .8, this.high ? .65 : .4, [3, 4]);
      }
    }
  }

  field(f) {
    if (f.removed) return;
    const x = finite(f.x), y = finite(f.y), r = finite(f.r, finite(f.radius, 40));
    const age = finite(f.age), p = fraction(f), color = f.color || ({ bomb: C.bomb, hole: C.singularity, fire: C.impact, command: C.swarm, seed: C.infection, soil: C.infection, cone: C.infection, network: C.swarm }[f.type] || C.text);
    const c = this.ctx;
    if (f.slot?.evolution >= 3 && age < .32 && !f.ghost && !f.mini && !['soil', 'trail', 'fire', 'residue'].includes(f.type)) {
      const opening = 1 - age / .32, radius = Math.max(70, r);
      this.glow(x, y, radius * 1.5, color, opening * .24);
      if (!this.low) for (let i = 0; i < 6; i++) {
        const angle = i * TAU / 6 + .4, distance = radius * (this.reduced ? .7 : .3 + (1 - opening) * .55);
        this.line(x + Math.cos(angle) * distance, y + Math.sin(angle) * distance, x + Math.cos(angle) * (distance + 16 * opening), y + Math.sin(angle) * (distance + 16 * opening), color, 1.2, opening * .45);
      }
    }
    switch (f.type) {
      case 'bomb': {
        const pulse = this.reduced ? 1 : 1 + Math.sin(age * (12 + (1 - p) * 16)) * .018;
        this.fillCircle(x, y, r, color, .022);
        this.circle(x, y, r, color, 1, .4 + (1 - p) * .35);
        if (!this.low && !this.reduced) this.circle(x, y, r * pulse, color, .8, .18);
        this.glow(x, y, 25 - (1 - p) * 10, color, .5);
        this.organic(x, y, 5 + p * 6, color, '#13101B', age, 4, 1, 1.3);
        this.fillCircle(x, y, 2 + p * 1.5, '#F4DDD9', .7 + (1 - p) * .3);
        this.inwardDust(x, y, r * .86, color, age * 2, .8);
        if (f.records) for (const [i, point] of f.records.entries()) {
          const radius = f.slot?.branch === 'compression' ? 22 : 30;
          this.circle(point.x, point.y, radius, color, .8, .45, 0, TAU, [3, 7]);
          this.fillCircle(point.x, point.y, 3, color, .55);
          this.line(x, y, point.x, point.y, color, .7, .18, [2, 8]);
        }
        break;
      }
      case 'hole': {
        const core = 12 + Math.min(6, finite(f.mass)) * 1.5;
        this.glow(x, y, r * 1.15, '#68627E', .22);
        this.circle(x, y, r, color, .9, .25);
        const movement = this.reduced ? .5 : (age * .42 % 1);
        for (let i = 0; i < (this.low ? 2 : 3); i++) {
          const k = ((movement + i / 3) % 1);
          this.circle(x, y, core + (r - core) * (1 - k), color, .9, .07 + .2 * k, i * 2, i * 2 + Math.PI * 1.3);
        }
        this.inwardDust(x, y, r, '#CDC3E3', age, .7, true);
        this.fillCircle(x, y, core, '#010208');
        this.circle(x, y, core + 1.5, '#D6CAE1', 1.5, .8, -.25, Math.PI * 1.7);
        this.circle(x, y, core + 7, color, .7, .5, age, age + Math.PI * .9);
        const sibling = (this.game.fields || []).find(other => other.type === 'hole' && !other.removed && other.groupId != null && other.groupId === f.groupId && other.id > f.id);
        if (sibling) this.line(x, y, sibling.x, sibling.y, color, .8, .24, [3, 8]);
        if (finite(f.foldUntil) > this.time) {
          this.circle(x, y, 27, color, 1, .65, 0, TAU, [3, 5]);
        }
        if (finite(f.remaining, f.duration - age) <= finite(f.collapsePreview, .35)) this.clockRing(x, y, finite(f.endRadius, finite(f.collapseRadius, 80)), C.text, 1 - clamp(finite(f.remaining, f.duration - age) / finite(f.collapsePreview, .35)), 12, .9, 1.7);
        if (f.bx !== undefined) { this.line(x, y, f.bx, f.by, color, 1, .55, [5, 5]); this.polygon(f.bx, f.by, 10, 4, color, null, 0, 1.5); }
        break;
      }
      case 'residue':
        this.glow(x, y, r, color, .1 * p);
        this.inwardDust(x, y, r, color, age, .3 * p); break;
      case 'fire':
        this.glow(x, y, r, color, .16);
        for (let i = 0; i < (this.low ? 2 : 5); i++) {
          const a = i * 2.4, d = r * .6 * ((i + 1) / 5);
          const lift = this.reduced ? 0 : age * 7 % 13;
          this.fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d - lift, 2, color, .5);
        }
        break;
      case 'command': {
        this.glow(x, y, r, color, .07);
        this.circle(x, y, r, color, .7, .14, 0, TAU, [2, 12]);
        for (const s of f.shots || []) {
          if (s.fired) continue;
          const left = finite(s.at) - age, window = finite(f.warning, f.branch === 'hunter' || f.hunter ? .5 : .35);
          if (left > window || left < -.05) continue;
          const sx = finite(s.x, x), sy = finite(s.y, y), sr = finite(s.r, finite(s.radius, 44));
          const arrival = 1 - clamp(left / window);
          this.fillCircle(sx, sy, sr, color, .04 + arrival * .055);
          this.circle(sx, sy, sr, color, s.locked || left <= .3 ? 1.4 : 1, .85, 0, TAU, s.locked || left <= .3 ? null : [5, 5]);
          this.circle(sx, sy, sr + 4, color, 1, .4, -Math.PI / 2, -Math.PI / 2 + TAU * arrival);
          this.incomingShot(sx, sy, sr, color, arrival, .9, s.sourceX, s.sourceY);
        }
        if (!this.low) {
          this.turret(x - 24, y - 19, color, .7); this.turret(x + 24, y + 19, color, .7);
        }
        break;
      }
      case 'seed':
      case 'soil':
        this.glow(x, y, r, color, .11 * p);
        this.organic(x, y, f.type === 'soil' ? 5 : 9, '#A2B590', '#233025', age * .4, 3, .7, 1);
        this.fillCircle(x, y, 2.4, color, .9);
        break;
      case 'seam':
      case 'trail': {
        const x2 = finite(f.x2, x + Math.cos(finite(f.angle)) * finite(f.length, 100));
        const y2 = finite(f.y2, y + Math.sin(finite(f.angle)) * finite(f.length, 100));
        this.line(x, y, x2, y2, color, 1, .55 * Math.max(.3, p), f.type === 'trail' ? [2, 6] : [7, 5]);
        if (f.type === 'seam') this.lineHitbox(x, y, x2, y2, finite(f.width, 14), color, .12, [3, 8]);
        break;
      }
      case 'sweep': {
        const angle = finite(f.angle), length = finite(f.length, 400), width = finite(f.width, 26);
        const displayAngle = this.reduced ? Math.round(angle * 10) / 10 : angle;
        const end = displayAngle + finite(f.previewAngle, finite(f.angularSpeed, TAU / 1.5) * .4);
        const waiting = age < finite(f.startDelay);
        const radius = length / 2, lineAngles = f.lattice ? [displayAngle, displayAngle + Math.PI / 2] : [displayAngle];
        for (const a of lineAngles) {
          for (const opposite of [0, Math.PI]) {
            c.save(); c.strokeStyle = color; c.fillStyle = color; c.globalAlpha = .028; c.beginPath();
            c.moveTo(x, y); c.arc(x, y, radius, a + opposite, a + opposite + end - displayAngle); c.closePath(); c.fill(); c.restore();
            this.circle(x, y, radius, color, .9, .4, a + opposite, a + opposite + end - displayAngle, [4, 7]);
          }
          const x1 = x - Math.cos(a) * radius, y1 = y - Math.sin(a) * radius, x2 = x + Math.cos(a) * radius, y2 = y + Math.sin(a) * radius;
          this.lineHitbox(x1, y1, x2, y2, width, color, .55, waiting ? [4, 5] : null);
          this.line(x1, y1, x2, y2, color, waiting ? 1 : 1.4, .9, waiting ? [5, 5] : null);
          const next = a + end - displayAngle;
          this.line(x - Math.cos(next) * radius, y - Math.sin(next) * radius, x + Math.cos(next) * radius, y + Math.sin(next) * radius, color, 1, .35, [3, 7]);
        }
        this.fillCircle(x, y, 3.5, color, .9);
        break;
      }
      case 'fold': {
        const x2 = finite(f.x2, x), y2 = finite(f.y2, y);
        this.lineHitbox(x, y, x2, y2, finite(f.width, 32), color, .9, [5, 4]);
        this.polygon(x, y, 7, 4, color, null, 0); this.polygon(x2, y2, 7, 4, color, null, 0);
        break;
      }
      case 'cone': {
        const a = finite(f.angle, finite(this.game.cursor?.angle)), half = finite(f.halfAngle, finite(f.angleWidth, Math.PI * 2 / 3) / 2);
        const left = a - half, right = a + half;
        this.circle(x, y, r, color, 1, .7, left, right, [3, 5]);
        this.line(x, y, x + Math.cos(left) * r, y + Math.sin(left) * r, color, 1, .7, [3, 5]);
        this.line(x, y, x + Math.cos(right) * r, y + Math.sin(right) * r, color, 1, .7, [3, 5]);
        this.inwardDust(x, y, r * .6, color, age, .4); break;
      }
      case 'network': {
        const nx = x, ny = y;
        const half = finite(f.width, 24) / 2;
        this.lineHitbox(30, ny, this.width - 30, ny, half * 2, color, .65);
        this.lineHitbox(nx, 30, nx, this.height - 30, half * 2, color, .65);
        this.line(30, ny, this.width - 30, ny, color, .8, .2);
        this.line(nx, 30, nx, this.height - 30, color, .8, .2);
        this.glow(nx, ny, 100, color, .14 * p);
        this.organic(nx, ny, 10, color, '#131512', age, 4, .9, 1.4);
        for (const [tx, ty] of [[30, ny], [this.width - 30, ny], [nx, 30], [nx, this.height - 30]]) this.turret(tx, ty, color);
        break;
      }
      default: break;
    }
  }

  lineHitbox(x, y, x2, y2, width, color, alpha = 1, dash = null) {
    const a = Math.atan2(y2 - y, x2 - x), ox = -Math.sin(a) * width / 2, oy = Math.cos(a) * width / 2;
    this.line(x + ox, y + oy, x2 + ox, y2 + oy, color, 1, alpha, dash);
    this.line(x - ox, y - oy, x2 - ox, y2 - oy, color, 1, alpha, dash);
    this.line(x + ox, y + oy, x - ox, y - oy, color, .8, alpha, dash);
    this.line(x2 + ox, y2 + oy, x2 - ox, y2 - oy, color, .8, alpha, dash);
  }

  turret(x, y, color, alpha = 1) {
    this.glow(x, y, 22, color, .15 * alpha);
    this.organic(x, y, 7, color, '#24261C', x * .1 + y * .03, 3, alpha, 1.2);
    this.fillCircle(x, y - 1, 2.2, '#F3E9CD', alpha);
    this.line(x - 9, y + 7, x - 3, y + 4, color, 1.2, alpha * .6);
    this.line(x + 9, y + 7, x + 3, y + 4, color, 1.2, alpha * .6);
  }

  incomingShot(x, y, r, color, arrival, alpha = .8, fromX, fromY) {
    const sourceX = finite(fromX, x < this.width / 2 ? -24 : this.width + 24), sourceY = finite(fromY, -42);
    const t = this.reduced ? .83 : clamp(arrival) * .92;
    const px = sourceX + (x - sourceX) * t, py = sourceY + (y - sourceY) * t;
    this.line(sourceX, sourceY, x, y, color, .7, alpha * .1, [2, 10]);
    this.line(px - (x - sourceX) * .04, py - (y - sourceY) * .04, px, py, color, 1.5, alpha * .7);
    this.glow(px, py, 10, color, alpha * .4);
    this.fillCircle(px, py, 2.5, '#FFF2D1', alpha);
  }

  planetOrbit(x, y, r, color, angle = -.35, front = false, alpha = .65) {
    const c = this.ctx;
    c.save(); c.translate(x, y); c.rotate(angle); c.strokeStyle = color;
    c.globalAlpha = alpha; c.lineWidth = 1.3;
    c.beginPath(); c.ellipse(0, 0, r * 1.7, r * .43, 0, front ? 0 : Math.PI, front ? Math.PI : TAU);
    c.stroke(); c.restore();
  }

  rainbowRing(x, y, r, alpha = .92) {
    const spin = this.reduced ? 0 : this.clock * .45;
    for (let i = 0; i < 6; i++) {
      const start = spin + i * TAU / 6;
      this.circle(x, y, r, `hsl(${i * 60} 100% 72%)`, 2.5, alpha, start, start + TAU / 6 + .015);
    }
  }

  enemy(e) {
    const c = this.ctx, r = finite(e.r, e.boss ? 48 : 12), selected = this.previewTargets.has(e.id);
    const statuses = e.statuses || {}, hit = finite(e.hitFlash) > 0;
    const hue = this.reduced ? 0 : (this.clock * 12 + finite(e.id) * 29) % 360;
    const color = e.boss ? C.danger : e.elite ? `hsl(${hue} 100% 72%)` : (enemyColors[e.type] || '#F4F6FF');
    let x = finite(e.x), y = finite(e.y);
    // Preview displacement is optical only: no collision, damage or enemy coordinate changes.
    if (selected && this.preview?.id === 'hole' && !this.reduced) {
      const dx = this.preview.x - x, dy = this.preview.y - y, d = Math.hypot(dx, dy) || 1;
      const shift = 1.8 + Math.sin(this.clock * 3 + finite(e.id)) * .7;
      x += dx / d * shift; y += dy / d * shift;
    }
    if (selected) { this.fillCircle(x, y, r + 5, color, this.high ? .24 : .12); this.circle(x, y, r + 3, color, 1, .45); }
    if (e.boss) { this.boss(e, color); return; }
    const stage = finite(this.game.worldTime) >= 420 ? 2 : finite(this.game.worldTime) >= 180 ? 1 : 0;
    const special = e.type !== 'drifter';
    if (special || stage > 0 || hit || selected) {
      const atmosphere = e.type === 'scrubber' ? '#65DDB3' : e.type === 'anchor' ? '#F7BC73' : color;
      this.glow(x, y, r * 2.3, atmosphere, hit || selected ? .38 : .14);
      if (!this.low && (special || stage >= 2)) this.celestialDust(x, y, r * 1.65, atmosphere, finite(e.id), .38);
    }
    const orbit = stage > 0 || ['splitter', 'anchor', 'mirror'].includes(e.type);
    const angle = -.35 + (finite(e.id) % 5) * .19 + (this.reduced ? 0 : finite(e.age) * .08);
    if (stage >= 2 || e.elite || e.type === 'channeler' || e.type === 'jammer')
      this.glow(x, y, r * (e.elite ? 3.2 : 2.7), color, e.elite ? .3 : .13);
    if (orbit) this.planetOrbit(x, y, r, color, angle, false, e.elite ? .8 : .5);
    if (e.elite) this.rainbowRing(x, y, r + 7);
    // Every combat body is one exact circle; only its rings and atmosphere evolve.
    this.fillCircle(x, y, r, hit ? '#FFFFFF' : color);
    if (special || stage > 0 || e.elite) {
      const shade = c.createRadialGradient(x - r * .35, y - r * .4, r * .06, x, y, r);
      shade.addColorStop(0, '#FFFFFF45'); shade.addColorStop(.42, 'transparent'); shade.addColorStop(1, '#03071690');
      this.fillCircle(x, y, r, shade);
      this.circle(x, y, r, color, this.high ? 1.5 : .9, .9);
    }
    const statusColor = statuses.infected ? '#A6E857' : statuses.mark ? C.chain : statuses.burn || statuses.stroke ? C.impact : null;
    if (statusColor) this.fillCircle(x, y, r * .94, statusColor, .22);
    if (orbit) this.planetOrbit(x, y, r, color, angle, true, e.elite ? .8 : .5);
    if (e.type === 'ward') this.circle(x, y, r + 5, '#75BDFF', 1.4, .6);
    if (e.type === 'channeler') this.circle(x, y, r + 5, C.danger, 1.3, .68);
    if (e.type === 'scrubber') this.circle(x, y, r * .65, '#E0FFC2', 1.1, .6);
    if (e.type === 'jammer') this.circle(x, y, r + 6, '#FF78C9', 2, .45);
    if (e.type === 'mirror') {
      this.planetOrbit(x, y, r, color, -angle - .8, false, .38);
      this.planetOrbit(x, y, r, color, -angle - .8, true, .38);
    }
    if (stage >= 2 && !e.elite) this.circle(x, y, r + 9, color, .8, .27);
    if (e.elite) {
      const spin = this.reduced ? 0 : this.clock * .7;
      for (let i = 0; i < 3; i++) {
        const a = spin + i * TAU / 3;
        this.fillCircle(x + Math.cos(a) * (r + 11), y + Math.sin(a) * (r + 11), 1.8, `hsl(${i * 120} 100% 72%)`, .9);
      }
    }
    if (finite(e.shield) > 0) {
      const p = clamp(e.shield / Math.max(1, finite(e.maxShield, e.shield)));
      this.circle(x, y, r + 3, '#74B9EF', 1.6, .65, -.8, -.8 + Math.PI * 1.6 * p);
    }
    if (this.high) this.circle(x, y, r + 1, '#F1F6FF', .9, .65);
    this.health(e, color);
    if (e.elite) this.label('강적', x, y - r - 18, '#F4F6FF', 11, 'center', .85);
  }

  health(e, color) {
    const c = this.ctx, radius = finite(e.r, e.boss ? 48 : 12);
    const width = e.boss ? Math.min(136, radius * 2.5) : Math.max(22, radius * 2), y = e.y + radius + (e.boss ? 20 : 9);
    const height = e.boss ? 4 : this.high ? 3 : 2.5;
    const ratio = clamp(finite(e.hp) / Math.max(1, finite(e.maxHp, e.hp)));
    const previous = this.healthTrails.get(e.id) ?? ratio;
    const trail = this.reduced ? ratio : previous + (ratio - previous) * (1 - Math.exp(-finite(this.frameDt, 1 / 60) * 9));
    this.healthTrails.set(e.id, trail);
    c.fillStyle = '#253252'; c.fillRect(e.x - width / 2, y, width, height);
    if (Math.abs(trail - ratio) > .001) { c.save(); c.globalAlpha = .25; c.fillStyle = '#E3C8FF'; c.fillRect(e.x - width / 2, y, width * trail, height); c.restore(); }
    c.fillStyle = color; c.fillRect(e.x - width / 2, y, width * clamp(finite(e.hp) / Math.max(1, finite(e.maxHp, e.hp))), height);
    if (!this.low && ratio > 0 && (e.type !== 'drifter' || finite(this.game.worldTime) >= 180)) {
      const flow = this.reduced ? .5 : (this.clock * .18 + finite(e.id) * .13) % 1;
      this.glow(e.x - width / 2 + width * ratio * flow, y + height / 2, 5, color, .2);
    }
  }

  celestialDust(x, y, r, color, seed = 0, alpha = .4) {
    const spin = this.reduced ? 0 : this.clock * .12;
    for (let i = 0; i < 3; i++) {
      const a = spin + seed * .7 + i * TAU / 3;
      this.fillCircle(x + Math.cos(a) * r, y + Math.sin(a) * r * .72, .8, color, alpha);
    }
  }

  boss(e, color = C.danger) {
    const c = this.ctx, x = e.x, y = e.y, r = finite(e.r, 48);
    const motion = this.reduced ? 0 : finite(e.age) * .12;
    this.glow(x, y, r * 2.8, C.danger, .24);
    for (let i = 0; i < 2; i++) this.planetOrbit(x, y, r * (1.13 + i * .16), C.danger, motion + i * .8, false, .72 - i * .2);
    const surface = c.createRadialGradient(x - r * .35, y - r * .4, r * .05, x, y, r);
    surface.addColorStop(0, '#E66477'); surface.addColorStop(.35, '#A62645'); surface.addColorStop(1, '#270913');
    this.fillCircle(x, y, r, surface);
    this.circle(x, y, r, C.danger, 2.3, 1);
    this.circle(x, y, r * .78, '#FF8C9C', 1.1, .4, motion, motion + Math.PI * 1.4);
    for (let i = 0; i < 2; i++) this.planetOrbit(x, y, r * (1.13 + i * .16), C.danger, motion + i * .8, true, .72 - i * .2);
    this.circle(x, y, r + 13, C.danger, 1, .32);
    if (e.type === 'reality') this.circle(x, y, r + 21, '#FF7A8F', 1.5, .55);
    if (finite(e.hitFlash) > 0) this.fillCircle(x, y, r, '#FFFFFF', .35);
    if (e.statuses?.infected) this.fillCircle(x, y, r * .94, C.infection, .16);
    if (finite(e.shield) > 0) this.circle(x, y, r + 5, '#83A4B5', 2, .6, 0, TAU * clamp(e.shield / Math.max(1, finite(e.maxShield, e.shield))));
    if (this.high) this.circle(x, y, r + 2, C.text, 1, .7);
    this.label(enemyNames[e.type] || '보스 행성', x, y - r - 31, color, 12, 'center');
    this.health(e, color);
  }

  statusPass() {
    for (const e of this.game.enemies || []) {
      if (e.dead) continue;
      const s = e.statuses || {}, r = finite(e.r, 12), age = this.reduced ? 0 : this.time;
      // The creature carries its status; there are no stacked UI rings or counters.
      if (s.infected) {
        const count = this.low ? 1 : Math.min(3, Math.max(1, finite(s.infected.stacks, 1)));
        for (let i = 0; i < count; i++) {
          const a = e.id * 2.399 + i * 2.1 + age * .4, drift = this.reduced ? 0 : age * 5 % 9;
          this.fillCircle(e.x + Math.cos(a) * (r + 2), e.y + Math.sin(a) * (r + 2) - drift, 1.6, '#AEC58E', .7);
        }
      } else if (s.mark) {
        this.zigzag(e.x - r * .4, e.y - r * .3, e.x + r * .35, e.y + r * .3, C.chain, 1, .7, e.id);
      } else if (s.burn || s.stroke) {
        this.fillCircle(e.x + r * .4, e.y - r * .2, 2, '#E2B08F', .7);
      }
      if (s.exposed || s.rupture) {
        this.line(e.x - r * .3, e.y - r * .5, e.x + r * .1, e.y, '#F2E2D3', 1.2, .75);
        this.line(e.x + r * .1, e.y, e.x - r * .1, e.y + r * .45, '#F2E2D3', 1, .7);
      }
      if (s.strain && e.boss) {
        const count = Math.min(4, finite(s.strain.stacks, finite(s.strain.count)));
        for (let i = 0; i < count; i++) {
          const a = i * TAU / 4 + .4;
          this.line(e.x + Math.cos(a) * r * .55, e.y + Math.sin(a) * r * .55, e.x + Math.cos(a + .18) * r * .9, e.y + Math.sin(a + .18) * r * .9, C.singularity, 2, .7);
        }
      }
      if (e.adaptation || e.weakness) {
        const weak = typeof e.weakness === 'string' ? e.weakness : e.weakness?.source || e.adaptation?.weakness || 'IMPACT';
        const color = ({ CHAIN:C.chain, INFECTION:C.infection, SINGULARITY:C.singularity, SWARM:C.swarm, IMPACT:C.impact, CASTER:C.text }[weak] || C.impact);
        // One bright body seam shows the weakness while leaving the silhouette clear.
        this.line(e.x + r * .5, e.y - r * .45, e.x + r * .8, e.y + r * .18, color, 2.2, .9);
        if (e.elite || e.boss) this.label(String(weak).replace('_', ' '), e.x, e.y + r + 22, color, 11, 'center', .85);
      }
    }
  }

  glyph(type, x, y, color, r = 6, alpha = 1) {
    const c = this.ctx; c.save(); c.translate(x, y); c.strokeStyle = color; c.lineWidth = 1.5; c.globalAlpha = alpha;
    c.beginPath();
    switch (type) {
      case 'mark': c.moveTo(r * .5, -r); c.lineTo(-r * .5, 0); c.lineTo(r * .35, 0); c.lineTo(-r * .45, r); break;
      case 'exposed': c.moveTo(-r, -r * .7); c.lineTo(0, r * .4); c.lineTo(r, -r * .7); break;
      case 'rupture': c.moveTo(0, -r); c.lineTo(-r * .4, -r * .3); c.lineTo(r * .3, r * .15); c.lineTo(-r * .1, r); break;
      case 'stroke': c.moveTo(-r * .6, -r); c.lineTo(r * .65, 0); c.lineTo(-r * .6, r); c.closePath(); break;
      case 'burn': c.moveTo(0, -r); c.bezierCurveTo(r * 1.4, r * .1, r * .6, r, 0, r); c.bezierCurveTo(-r, r, -r, 0, -r * .3, -r * .35); c.lineTo(0, 0); c.closePath(); break;
      case 'lease': c.rect(-r, -r, r * 2, r * 2); c.moveTo(-r * .4, 0); c.lineTo(r * .4, 0); break;
      case 'infected': this.clockRing(0, 0, r, color, 1, 3, alpha, 1.3); break;
      default: c.moveTo(-r, 0); c.lineTo(r, 0); c.moveTo(0, -r); c.lineTo(0, r); break;
    }
    c.stroke(); c.restore();
  }

  sourceGlyph(source, x, y, color) {
    const value = String(source).toUpperCase();
    if (value.includes('CHAIN')) this.glyph('mark', x, y, color, 5);
    else if (value.includes('INFECTION')) this.glyph('infected', x, y, color, 6);
    else if (value.includes('SUMMON') || value.includes('SWARM')) this.brackets(x, y, 5, color);
    else if (value.includes('EXPLOS') || value.includes('IMPACT')) this.clockRing(x, y, 6, color, 1, 8);
    else if (value.includes('SKILL') || value.includes('CASTER')) { this.line(x - 6, y + 4, x + 6, y - 4, color, 1.5); this.line(x - 6, y - 4, x + 6, y + 4, color, 1); }
    else if (value.includes('SINGULAR')) this.circle(x, y, 6, color, 1.5);
    else this.glyph('stroke', x, y, color, 5);
  }

  controlSignals() {
    const beacon = this.game.beacon;
    if (beacon && finite(beacon.remaining) > 0) {
      this.glow(beacon.x, beacon.y, 28, C.swarm, .2);
      this.organic(beacon.x, beacon.y, 7, C.swarm, '#2A2C21', this.time * .3, 3, .9, 1.2);
      this.circle(beacon.x, beacon.y, 60, C.swarm, .8, .4, 0, TAU, [2, 7]);
    }
    for (const e of this.game.enemies || []) {
      if (e.dead) continue;
      if (e.type === 'scrubber' && e.purifying) {
        this.circle(e.x, e.y, 70, C.infection, 1, .55, 0, TAU, [3, 7]);
        this.inwardDust(e.x, e.y, 70, C.infection, e.age, .55);
      }
      if (e.type === 'jammer') {
        this.circle(e.x, e.y, 100, '#CE94E0', .8, this.high ? .55 : .23, 0, TAU, [2, 9]);
      }
    }
  }

  effect(f) {
    const delay = finite(f.delay), age = finite(f.age) - delay;
    if (age < 0) return;
    const life = Math.max(.001, finite(f.maxLife, finite(f.life, .4)) - delay), p = clamp(age / life);
    if (p >= 1) return;
    const x = finite(f.x), y = finite(f.y), color = f.color || C.text, r = finite(f.r, 22), alpha = Math.pow(1 - p, .8);
    const x2 = finite(f.toX, finite(f.x2, x)), y2 = finite(f.toY, finite(f.y2, y));
    switch (f.kind) {
      case 'line':
        if (f.width >= 12) this.lineHitbox(x, y, x2, y2, f.width, color, alpha * .25);
        this.line(x, y, x2, y2, color, Math.min(2.5, finite(f.width, 1)), alpha * .65); break;
      case 'arc': {
        const travel = this.reduced ? 1 : clamp(age / .07), tx = x + (x2 - x) * travel, ty = y + (y2 - y) * travel;
        this.zigzag(x, y, tx, ty, color, finite(f.width, 2), alpha, finite(f.seed, finite(f.rootId)));
        if (travel >= 1) { this.glow(x2, y2, 17, color, alpha * .32); this.fillCircle(x2, y2, 3.5, '#F3F7EF', alpha * .8); }
        break;
      }
      case 'ring':
        // Range indicators remain exact; expanding ripples belong to impact effects.
        this.circle(x, y, r, color, Math.max(.7, 1.8 - p), alpha * .7);
        if (f.segments) this.clockRing(x, y, r, color, 1 - p, f.segments, alpha); break;
      case 'burst': {
        // A small death is a quiet fleck. Large phenomena compress, hang, then expand.
        if (r <= 35) {
          this.glow(x, y, r * (1 + p), color, alpha * .38);
          this.fillCircle(x, y, Math.max(.5, 5 * (1 - p)), '#F4EDFF', alpha * .85);
          const count = this.low ? 3 : 6;
          for (let i = 0; i < count; i++) {
            const a = i * TAU / count + x * .03, d = r * (this.reduced ? .45 : .2 + p * .85);
            this.fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, Math.max(.6, 1.8 - p), color, alpha * .6);
          }
          break;
        }
        const compress = p < .16, pause = p >= .16 && p < .27;
        const outward = this.reduced ? .85 : clamp((p - .27) / .73), scale = compress ? 1 - p / .16 * .65 : pause ? .35 : .35 + outward * .7;
        this.glow(x, y, r * (pause ? .4 : scale), color, (compress || pause ? .32 : .16) * alpha);
        this.fillCircle(x, y, Math.max(2, (compress ? 9 - p * 25 : pause ? 5 : 5 * (1 - outward))), '#F6EBDA', alpha * .7);
        if (!compress && !pause) {
          this.circle(x, y, r * scale, color, 2.5 - outward * 1.8, alpha);
          if (!this.low) this.circle(x, y, r * Math.max(.1, scale - .12), color, .8, alpha * .3);
          for (let i = 0; i < (this.low ? 4 : 10); i++) {
            const a = i * TAU / (this.low ? 4 : 10) + .15, d = r * scale;
            this.line(x + Math.cos(a) * d, y + Math.sin(a) * d, x + Math.cos(a) * (d + (1 - outward) * 12), y + Math.sin(a) * (d + (1 - outward) * 12), color, 1, alpha * .5);
          }
        }
        break;
      }
      case 'discharge':
        this.glow(x, y, r * 1.5, color, alpha * .4);
        for (let i = 0; i < (this.low ? 3 : 5); i++) {
          const a = i * TAU / (this.low ? 3 : 5) + .3, d = r * (this.reduced ? .7 : .3 + p * .65);
          this.zigzag(x, y, x + Math.cos(a) * d, y + Math.sin(a) * d, color, 1, alpha * .7, i);
        }
        break;
      case 'text': {
        if (!f.crit && /^\d+$/.test(String(f.text))) {
          const important = (this.game.enemies || []).some(e => (e.boss || e.elite || !['drifter', 'splitter'].includes(e.type)) && Math.hypot(e.x - x, e.y - y) <= finite(e.r, 12) + 15);
          if (!important) break;
        }
        this.label(f.text || '', x, y - (this.reduced ? 0 : p * 9), color, finite(f.size, f.crit ? 15 : 11), 'center', alpha * (f.crit ? 1 : .8)); break;
      }
      case 'slash': {
        const angle = finite(f.angle), length = finite(f.length, 400);
        const tx = f.toX !== undefined || f.x2 !== undefined ? x2 : x + Math.cos(angle) * length;
        const ty = f.toY !== undefined || f.y2 !== undefined ? y2 : y + Math.sin(angle) * length;
        const split = this.reduced ? 1 : clamp((age - .025) / .055), width = finite(f.width, 4), dx = tx - x, dy = ty - y, distance = Math.hypot(dx, dy) || 1;
        this.line(x, y, tx, ty, '#E7E3DA', .8, alpha);
        if (split > 0) {
          this.line(x, y, tx, ty, '#08080F', Math.max(.8, width * .58 * split), alpha * .85);
          const offset = Math.min(width * .3, 10) * split, ox = -dy / distance * offset, oy = dx / distance * offset;
          this.zigzag(x + ox, y + oy, tx + ox, ty + oy, color, 1.4, alpha * .8, 1);
          this.zigzag(x - ox, y - oy, tx - ox, ty - oy, '#B2A6BF', .8, alpha * .6, 3);
          const head = this.reduced ? .5 : clamp((age - .025) / .12);
          this.glow(x + dx * head, y + dy * head, 15, color, alpha * .24);
        }
        break;
      }
      case 'spawn':
        this.fillCircle(x, y, r * (this.reduced ? 1 : .6 + p * .4), color, alpha * .1);
        this.circle(x, y, r * (this.reduced ? 1 : .6 + p * .4), color, .8, alpha * .2); break;
      case 'heal': this.glow(x, y, r, color, alpha * .12); this.inwardDust(x, y, r * .7, color, age, alpha * .6); break;
      case 'hit':
        this.glow(x, y, r * 1.5, color, alpha * .3);
        this.circle(x, y, r * (this.reduced ? .8 : .35 + p * .65), color, 1, alpha * .45);
        this.fillCircle(x, y, 3.5, '#F7EEE1', alpha * .8);
        if (!this.low) for (let i = 0; i < 5; i++) {
          const a = i * TAU / 5 + x * .03, d = 3 + p * r;
          this.fillCircle(x + Math.cos(a) * d, y + Math.sin(a) * d, 1.3 - p * .6, color, alpha * .7);
        }
        break;
      case 'marker':
        this.glow(x, y, r * 1.2, color, alpha * .14);
        this.organic(x, y, Math.min(r, 8), color, '#131923', x, 3, alpha * .65, 1);
        if (f.text) this.label(f.text, x, y + r + 10, color, 11, 'center', alpha); break;
      default: break;
    }
  }

  zigzag(x, y, x2, y2, color, width = 2, alpha = 1, seed = 0, dash = null) {
    const c = this.ctx, dx = x2 - x, dy = y2 - y, len = Math.hypot(dx, dy);
    if (!len) return;
    const nx = -dy / len, ny = dx / len, steps = Math.max(3, Math.min(12, Math.ceil(len / 19)));
    c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width;
    if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(x, y);
    for (let i = 1; i < steps; i++) {
      const n = Math.sin(seed * 2.31 + i * 7.17) * Math.min(8, len * .1);
      c.lineTo(x + dx * i / steps + nx * n, y + dy * i / steps + ny * n);
    }
    c.lineTo(x2, y2); c.stroke(); c.restore();
    this.fillCircle(x2, y2, 2.3, color, alpha);
  }

  dangerPass() {
    for (const d of this.game.dangers || []) this.danger(d);
    for (const e of this.game.enemies || []) {
      if (e.dead || !e.boss) continue;
      if (e.telegraph) this.danger(e.telegraph);
      if (Array.isArray(e.telegraphs)) for (const d of e.telegraphs) this.danger(d);
      if (e.statuses?.exposed || e.weaknessWindow > 0) {
        this.brackets(e.x, e.y, e.r + 20, C.text, 1, 2);
        this.glyph('exposed', e.x, e.y - e.r - 44, C.text, 8);
        this.label('WEAKNESS OPEN', e.x, e.y + e.r + 50, C.text, 11, 'center');
      }
    }
  }

  danger(d) {
    if (!d || d.resolved) return;
    const x = finite(d.x), y = finite(d.y), color = d.color || C.danger, r = finite(d.r, 50), p = fraction(d);
    const c = this.ctx;
    if (d.type === 'line') {
      const x2 = finite(d.x2, x), y2 = finite(d.y2, y), width = finite(d.width, 32);
      this.lineHitbox(x, y, x2, y2, width, color, 1, [8, 3]);
      this.line(x, y, x2, y2, color, 1, .6, [5, 6]);
      const a = Math.atan2(y2 - y, x2 - x), count = Math.max(1, Math.floor(Math.hypot(x2 - x, y2 - y) / 50));
      for (let i = 0; i < count; i++) this.arrow(x + (x2 - x) * (i + .5) / count, y + (y2 - y) * (i + .5) / count, a, color, 8, .8);
      this.label(d.label || 'WORLD CUT', (x + x2) / 2, (y + y2) / 2 - width / 2 - 13, color, 11, 'center');
    } else {
      this.fillCircle(x, y, r, color, .055);
      this.circle(x, y, r, color, 1.8, 1, 0, TAU, [8, 4]);
      this.clockRing(x, y, r + 5, color, 1 - p, 16, 1, 2.4);
      // The stripes sit inside the exact hit circle; no opaque warning sheet.
      c.save(); c.beginPath(); c.arc(x, y, r - 2, 0, TAU); c.clip();
      c.strokeStyle = color; c.globalAlpha = .16; c.lineWidth = 1;
      for (let k = -r * 2; k < r * 2; k += 14) {
        c.beginPath(); c.moveTo(x - r, y + k); c.lineTo(x + r, y + k - r * 2); c.stroke();
      }
      c.restore();
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2;
        this.arrow(x + Math.cos(a) * (r - 9), y + Math.sin(a) * (r - 9), a + Math.PI, color, 9);
      }
      this.label(d.label || (d.type === 'anchor' ? 'ANCHOR BREACH' : 'INTEGRITY THREAT'), x, y - r - 17, color, 11, 'center');
    }
    const remaining = finite(d.remaining, finite(d.duration) - finite(d.age));
    this.label(`${Math.max(0, remaining).toFixed(1)}s`, x, y, '#FFD0D7', 11, 'center');
  }

  cursor() {
    const game = this.game, cur = game.cursor;
    if (!cur || cur.hidden || !Number.isFinite(cur.x) || !Number.isFinite(cur.y)) return;
    if (['menu', 'results', 'ended'].includes(game.phase)) return;
    const x = cur.x, y = cur.y, hold = finite(cur.hold), charged = !!cur.down && hold >= .8;
    const available = finite(game.charges, 2) > 0, color = available ? C.text : '#7C7785';
    // The input pointer remains small. Geometry appears only during a deliberate aim.
    this.fillCircle(x, y, 1.8, color, .95);
    this.line(x - 6, y - 4, x - 4, y - 4, color, .8, .7);
    this.line(x + 4, y + 4, x + 6, y + 4, color, .8, .7);
    if (cur.down && available && !this.preview) {
      const r = (charged ? 48 : 36) + finite(game.stats?.radiusBonus), chargeColor = charged ? C.impact : C.text;
      this.fillCircle(x, y, r, chargeColor, .025);
      this.circle(x, y, r, chargeColor, 1, .6);
      this.circle(x, y, 7, chargeColor, 1.4, .9, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(hold / .8));
      if (charged) this.label(hold >= 1.2 ? 'FULL' : 'CHARGED', x, y - r - 11, C.impact, 11, 'center', .9);
      if (game.heat >= 80 && charged) this.circle(x, y, 170, C.impact, 1, .4, 0, TAU, [5, 9]);
    }
  }

  edgeIndicators() {
    const cursor = this.game.cursor || { x: this.width / 2, y: this.height / 2 };
    for (const e of this.game.enemies || []) {
      if (e.dead || !(e.boss || e.elite || e.type === 'channeler')) continue;
      if (e.x >= 20 && e.x <= this.width - 20 && e.y >= 20 && e.y <= this.height - 20) continue;
      const x = clamp(e.x, 29, this.width - 29), y = clamp(e.y, 52, this.height - 52);
      this.arrow(x, y, Math.atan2(e.y - cursor.y, e.x - cursor.x), e.type === 'channeler' ? C.danger : C.swarm, 12);
      if (e.type === 'channeler') this.label(`고정점 ${finite(e.anchorIndex) + 1}`, x, y + 14, C.danger, 11, 'center');
    }
  }
}
