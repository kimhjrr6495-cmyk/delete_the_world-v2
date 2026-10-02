import { displayText, enemyName } from './ui-text.js';

const TAU = Math.PI * 2;
const C = {
  background: '#020204', text: '#FFFFFF', muted: '#91869E',
  chain: '#5EE3FF', infection: '#A6E857', singularity: '#A67CFF',
  swarm: '#F2C15A', impact: '#FF8C6B', bomb: '#ED78BF', danger: '#FF425B',
};
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const finite = (n, fallback = 0) => Number.isFinite(n) ? n : fallback;
const fraction = o => clamp(finite(o.remaining, finite(o.duration) - finite(o.age)) / Math.max(.001, finite(o.duration, finite(o.maxLife, 1))));
const enemyNames = Object.fromEntries(['drifter','ward','channeler','splitter','scrubber','jammer','anchor','mirror','archivist','conductor','reality','training_boss'].map(id=>[id,enemyName(id)]));
const labelCache = new Map();
const signalNames = { COMMAND:'포격', LOCK:'고정', TRACK:'추적', DORMANT:'잠복', FOLD:'접기', PURIFYING:'정화', 'WORLD CUT':'절단 경고' };
const enemyColors = { drifter: '#D8CCFF', ward: '#75BDFF', channeler: '#FF687E', splitter: '#B08CFF', scrubber: '#B8FF76', jammer: '#CE94E0', anchor: '#FFB454', mirror: '#E6D3FF', archivist: '#D6B6FD', conductor: '#F2C15A', reality: '#FF748C' };

/** All geometry is in logical arena pixels. Drawing never changes combat state. */
export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.clock = 0;
    this.width = 1280;
    this.height = 760;
  }

  draw(game, dt = 0) {
    const ctx = this.ctx;
    if (!ctx) return;
    this.clock += finite(dt);
    this.width = finite(game.width, 1280);
    this.height = finite(game.height, 760);
    this.game = game;
    this.settings = game.settings || {};
    this.reduced = !!this.settings.reducedMotion;
    this.low = !!this.settings.lowEffects;
    this.high = !!this.settings.highContrast;
    this.time = finite(game.time);
    ctx.save();
    ctx.setTransform(this.canvas.width / this.width, 0, 0, this.canvas.height / this.height, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    this.background();
    if (game.phase === 'menu') { ctx.restore(); return; }
    this.anchors(false);
    const fields = game.fields || [];
    for (const field of fields) this.field(field);
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
    if (!this.low && width >= 1.7 && alpha >= .65) { c.shadowColor = color; c.shadowBlur = this.high ? 4 : 9; }
    if (dash) c.setLineDash(dash);
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke(); c.restore();
  }

  circle(x, y, r, color, width = 1, alpha = 1, start = 0, end = TAU, dash = null) {
    if (!(r > 0)) return;
    const c = this.ctx;
    c.save(); c.globalAlpha = alpha; c.strokeStyle = color; c.lineWidth = width;
    if (!this.low && width >= 1.7 && alpha >= .65) { c.shadowColor = color; c.shadowBlur = this.high ? 4 : 10; }
    if (dash) c.setLineDash(dash);
    c.beginPath(); c.arc(x, y, r, start, end); c.stroke(); c.restore();
  }

  fillCircle(x, y, r, color, alpha = 1) {
    if (!(r > 0)) return;
    const c = this.ctx;
    c.save(); c.globalAlpha = alpha; c.fillStyle = color;
    if (!this.low && r <= 6 && alpha >= .65) { c.shadowColor = color; c.shadowBlur = 8; }
    c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill(); c.restore();
  }

  polygon(x, y, radius, sides, color, fill = null, angle = -Math.PI / 2, width = 1.5, alpha = 1) {
    const c = this.ctx;
    c.save(); c.globalAlpha = alpha; c.lineWidth = width; c.strokeStyle = color;
    if (!this.low && width >= 1.4 && alpha >= .65) { c.shadowColor = color; c.shadowBlur = this.high ? 4 : 8; }
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
    c.font = `600 ${size}px "Consolas", monospace`;
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
    // Match the original's open black field: no frame, ruler, dashboard grid or labels.
    const worldTime = this.game.phase === 'menu' ? 0 : finite(this.game.worldTime, this.time), bloom = clamp((worldTime - 420) / 480);
    if (bloom > 0) {
      const glow = c.createRadialGradient(w * .5, h * .5, 0, w * .5, h * .5, Math.max(w, h) * .7);
      glow.addColorStop(0, '#160B28'); glow.addColorStop(1, C.background);
      c.save(); c.globalAlpha = bloom * (this.high ? .5 : .9); c.fillStyle = glow; c.fillRect(0, 0, w, h); c.restore();
    }
    const count = this.low ? 24 : Math.min(120, 24 + Math.floor(worldTime / 10));
    const drift = this.reduced ? 0 : this.clock * 3;
    c.save(); c.fillStyle = '#9D7CFF';
    c.globalAlpha = this.high ? .13 : .12 + clamp((50 - finite(this.game.integrity, 100)) / 150, 0, .25);
    for (let i = 0; i < count; i++) c.fillRect((i * 997 + drift) % w, (i * 571 + 37) % h, 1, 1);
    c.restore();
  }

  anchors(warnings) {
    const enemies = this.game.enemies || [];
    for (const [i, a] of (this.game.anchors || []).entries()) {
      const threats = enemies.filter(e => !e.dead && e.anchorIndex === i && finite(e.channel) > 0);
      const active = threats.some(e => finite(e.channel) >= 2), busy = threats.length || a.channeling;
      const x = a.x, y = a.y, r = finite(a.r, 24), color = active ? C.danger : busy ? '#FF9C78' : '#B08CFF';
      if (!warnings) {
        this.circle(x, y, r + 24, '#9D7CFF', .7, this.high ? .3 : .18, 0, TAU, [2, 9]);
        this.polygon(x, y, r + 4, 6, color, '#06060B', Math.PI / 6, 1.5, .7);
        this.polygon(x, y, r * .62, 6, busy ? color : '#E6D3FF', '#0D0817', Math.PI / 6, 1.3, .85);
        this.line(x - 7, y, x + 7, y, busy ? color : '#FFFFFF', 1.7, .9);
        this.line(x, y - 7, x, y + 7, busy ? color : '#FFFFFF', 1.7, .9);
        this.fillCircle(x, y, 2.3, busy ? color : '#E6D3FF', .9);
        for (let k = 0; k < 3; k++) {
          const angle = k * TAU / 3 - Math.PI / 2;
          this.line(x + Math.cos(angle) * (r + 7), y + Math.sin(angle) * (r + 7), x + Math.cos(angle) * (r + 13), y + Math.sin(angle) * (r + 13), color, 1.5, .55);
        }
        if(busy)this.label(`고정점 ${i + 1}`, x, y + r + 33, active ? '#FF899B' : '#998AAA', 11, 'center', .9);
        if (finite(a.damageFlash) > 0) this.circle(x, y, r + 10, C.danger, 3, clamp(a.damageFlash * 4));
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

  wardLinks() {
    const enemies = this.game.enemies || [];
    for (const e of enemies) {
      if (e.dead || e.type !== 'ward' || e.grounded || e.protectionDisabled > 0 || e.linkBroken > 0) continue;
      const protectedEnemies = enemies.filter(n => !n.dead && n.id !== e.id && finite(n.linkBroken) <= 0 && n.protectedBy === e.id).slice(0, 3);
      for (const n of protectedEnemies) {
        this.line(e.x, e.y, n.x, n.y, '#659CD4', this.low ? 1 : .8, this.high ? .65 : .4, [3, 4]);
        if (!this.low) this.polygon(n.x, n.y, n.r + 5, 4, '#659CD4', null, 0, .8, .3);
      }
    }
  }

  field(f) {
    if (f.removed) return;
    const x = finite(f.x), y = finite(f.y), r = finite(f.r, finite(f.radius, 40));
    const age = finite(f.age), p = fraction(f), color = f.color || ({ bomb: C.bomb, hole: C.singularity, fire: C.impact, command: C.swarm, seed: C.infection, soil: C.infection, cone: C.infection, network: C.swarm }[f.type] || C.text);
    const c = this.ctx;
    switch (f.type) {
      case 'bomb': {
        this.fillCircle(x, y, r, color, .025);
        this.clockRing(x, y, r, color, p, 8, 1, p < .2 ? 1.1 : 1.8);
        this.polygon(x, y, 7, 4, color, '#101019', Math.PI / 4, 1.5);
        this.line(x - 3, y, x + 3, y, color, 1.3);
        this.label(f.ghost || f.ghostIndex != null ? `ECHO ${finite(f.ghostIndex, f.order || 1)}` : f.record ? 'RECORD' : 'ARMED', x, y + 17, color, 9, 'center', .8);
        this.label(`${Math.max(0, finite(f.remaining, f.duration - age)).toFixed(1)}`, x, y - 19, color, 9, 'center');
        if (f.records) for (const [i, point] of f.records.entries()) {
          const radius = f.slot?.branch === 'compression' ? 22 : 30;
          this.clockRing(point.x, point.y, radius, color, p, 8, .55, 1);
          this.label(String(i + 1), point.x, point.y, color, 9, 'center', .7);
          this.line(x, y, point.x, point.y, color, .7, .18, [2, 8]);
        }
        break;
      }
      case 'hole': {
        this.fillCircle(x, y, r, '#583995', .08);
        this.circle(x, y, r, color, 1, .7);
        const movement = this.reduced ? .5 : (age * .42 % 1);
        for (let i = 0; i < (this.low ? 2 : 3); i++) {
          const k = ((movement + i / 3) % 1);
          this.circle(x, y, 12 + (r - 12) * (1 - k), color, .9, .15 + .4 * k);
        }
        this.fillCircle(x, y, 11, '#03030C');
        this.circle(x, y, 12, color, 1.8, .9);
        for (let i = 0; i < 4; i++) {
          const a = i * Math.PI / 2;
          this.arrow(x + Math.cos(a) * (r - 18), y + Math.sin(a) * (r - 18), a + Math.PI, color, 8, .6);
        }
        this.clockRing(x, y, 19, color, finite(f.mass) / 8, 8, .9, 2.5);
        this.label(`M${finite(f.mass)}`, x, y + 32, color, 9, 'center', .8);
        const sibling = (this.game.fields || []).find(other => other.type === 'hole' && !other.removed && other.groupId != null && other.groupId === f.groupId && other.id > f.id);
        if (sibling) this.line(x, y, sibling.x, sibling.y, color, .8, .45, [3, 6]);
        if (finite(f.foldUntil) > this.time) {
          this.clockRing(x, y, 27, color, clamp((f.foldUntil - this.time) / 1.2), 8, .9);
          this.label('SET POINT B', x, y - 36, color, 8, 'center');
        }
        if (finite(f.remaining, f.duration - age) <= finite(f.collapsePreview, .35)) this.clockRing(x, y, finite(f.endRadius, finite(f.collapseRadius, 80)), C.text, 1 - clamp(finite(f.remaining, f.duration - age) / finite(f.collapsePreview, .35)), 12, .9, 1.7);
        if (f.bx !== undefined) { this.line(x, y, f.bx, f.by, color, 1, .55, [5, 5]); this.polygon(f.bx, f.by, 10, 4, color, null, 0, 1.5); }
        break;
      }
      case 'residue':
        this.circle(x, y, r, color, 1, .55 * p, 0, TAU, [3, 7]);
        this.circle(x, y, r * .7, color, .7, .2 * p); break;
      case 'fire':
        this.circle(x, y, r, color, 1, .55, 0, TAU, [2, 5]);
        for (let i = 0; i < (this.low ? 2 : 5); i++) {
          const a = i * 2.4, d = r * .6 * ((i + 1) / 5);
          this.glyph('burn', x + Math.cos(a) * d, y + Math.sin(a) * d, color, 5, .6);
        }
        break;
      case 'command': {
        this.circle(x, y, r, color, .8, .3, 0, TAU, [4, 8]);
        this.brackets(x, y, r, color, .7);
        this.label('COMMAND', x, y - r - 12, color, 9, 'center', .7);
        for (const s of f.shots || []) {
          if (s.fired) continue;
          const left = finite(s.at) - age, window = finite(f.warning, f.branch === 'hunter' || f.hunter ? .5 : .35);
          if (left > window || left < -.05) continue;
          const sx = finite(s.x, x), sy = finite(s.y, y), sr = finite(s.r, finite(s.radius, 44));
          this.circle(sx, sy, sr, color, s.locked || left <= .3 ? 1.4 : 1, .9, 0, TAU, s.locked || left <= .3 ? null : [5, 5]);
          this.clockRing(sx, sy, sr + 4, color, 1 - clamp(left / window), 8, .85, 1.4);
          this.brackets(sx, sy, 8, color, 1);
          this.label(left <= .3 || s.locked ? 'LOCK' : 'TRACK', sx, sy - sr - 10, color, 8, 'center');
        }
        if (!this.low) {
          this.turret(x - 24, y - 19, color, .7); this.turret(x + 24, y + 19, color, .7);
        }
        break;
      }
      case 'seed':
      case 'soil':
        this.circle(x, y, r, color, 1, .6, 0, TAU, [2, 5]);
        this.clockRing(x, y, 11, color, p, 3, .8, 1.4);
        this.fillCircle(x, y, 2.4, color, .9);
        if (f.type === 'soil') this.label('DORMANT', x, y + 22, color, 8, 'center', .6);
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
        this.polygon(x, y, 9, 4, color, f.moved ? color : '#080D19', 0, 1.8);
        if (!f.moved) this.label('RELOCATE', x, y + 24, color, 8, 'center', .8);
        break;
      }
      case 'fold': {
        const x2 = finite(f.x2, x), y2 = finite(f.y2, y);
        this.lineHitbox(x, y, x2, y2, finite(f.width, 32), color, .9, [5, 4]);
        this.polygon(x, y, 7, 4, color, null, 0); this.polygon(x2, y2, 7, 4, color, null, 0);
        this.label('FOLD', (x + x2) / 2, (y + y2) / 2 - 17, color, 9, 'center');
        break;
      }
      case 'cone': {
        const a = finite(f.angle, finite(this.game.cursor?.angle)), half = finite(f.halfAngle, finite(f.angleWidth, Math.PI * 2 / 3) / 2);
        const left = a - half, right = a + half;
        this.circle(x, y, r, color, 1, .7, left, right, [3, 5]);
        this.line(x, y, x + Math.cos(left) * r, y + Math.sin(left) * r, color, 1, .7, [3, 5]);
        this.line(x, y, x + Math.cos(right) * r, y + Math.sin(right) * r, color, 1, .7, [3, 5]);
        this.clockRing(x, y, 15, color, 1 - p, 6, .9);
        this.label('ROUTE', x, y + 28, color, 9, 'center'); break;
      }
      case 'network': {
        const nx = f.followCursor === false ? x : finite(this.game.cursor?.x, x), ny = f.followCursor === false ? y : finite(this.game.cursor?.y, y);
        const half = finite(f.width, 24) / 2;
        this.lineHitbox(30, ny, this.width - 30, ny, half * 2, color, .65);
        this.lineHitbox(nx, 30, nx, this.height - 30, half * 2, color, .65);
        this.line(30, ny, this.width - 30, ny, color, .8, .2);
        this.line(nx, 30, nx, this.height - 30, color, .8, .2);
        this.polygon(nx, ny, 13, 4, color, null, 0, 2);
        this.clockRing(nx, ny, 20, color, p, 8, .9);
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
    this.brackets(x, y, 7, color, alpha, 1.4);
    this.polygon(x, y, 4, 4, color, '#071322', Math.PI / 4, 1.2, alpha);
  }

  enemy(e) {
    const c = this.ctx, x = finite(e.x), y = finite(e.y), r = finite(e.r, e.boss ? 48 : 12);
    const color = finite(e.hitFlash) > 0 ? C.text : (enemyColors[e.type] || '#93ABC8');
    const fill = finite(e.hitFlash) > 0 ? '#4B345F' : '#09090F';
    const tilt = this.reduced ? 0 : Math.sin(finite(e.age) * 1.3 + finite(e.id)) * .1;
    if (e.boss) { this.boss(e, color); return; }
    c.save(); c.translate(x, y); c.rotate(tilt);
    if (!this.low) { c.shadowColor = color; c.shadowBlur = this.high ? 4 : e.elite ? 14 : 6; }
    if (this.high) this.circle(0, 0, r + 2, '#F1F6FF', .9, .8);
    switch (e.type) {
      case 'ward':
        this.polygon(0, 0, r, 6, color, fill, Math.PI / 6, 1.6);
        this.polygon(0, 0, r * .55, 6, color, null, Math.PI / 6, .9, .7);
        this.line(-r * .36, 0, r * .36, 0, color, 2);
        this.line(0, -r * .36, 0, r * .36, color, 2); break;
      case 'channeler':
        this.polygon(0, 0, r + 1, 3, color, fill, -Math.PI / 2, 1.7);
        this.polygon(0, 1, r * .37, 3, color, null, Math.PI / 2, 1.1);
        this.line(-r * .7, r * .9, r * .7, r * .9, color, 1.2, .65); break;
      case 'splitter':
        this.polygon(-r * .35, 0, r * .66, 4, color, fill, 0, 1.4);
        this.polygon(r * .35, 0, r * .66, 4, color, fill, 0, 1.4);
        this.line(0, -r, 0, r, color, .9, .6, [2, 3]); break;
      case 'scrubber':
        this.polygon(0, 0, r, 8, color, fill, Math.PI / 8, 1.4);
        this.line(-r * .45, -r * .45, r * .45, r * .45, color, 1.4);
        this.line(r * .45, -r * .45, -r * .45, r * .45, color, 1.4);
        this.circle(0, 0, r * .3, color, 1.2); break;
      case 'jammer':
        this.polygon(0, 0, r, 4, color, fill, Math.PI / 4, 1.5);
        this.circle(0, 0, r * .45, color, 1.1, .8, -.8, .8);
        this.circle(0, 0, r * .7, color, 1, .65, 2.4, 3.9);
        this.line(-4, -4, 4, 4, color, 1.4); break;
      case 'anchor':
        this.polygon(0, 0, r, 5, color, fill, -Math.PI / 2, 1.6);
        this.line(-r * .5, r * .15, r * .5, r * .15, color, 1.6);
        this.line(0, -r * .6, 0, r * .5, color, 1.6);
        this.circle(0, -r * .38, r * .15, color, 1); break;
      case 'mirror':
        this.polygon(0, 0, r, 4, color, fill, 0, 1.7);
        this.line(-r * .55, -r * .2, r * .2, -r * .55, color, 1.1, .7);
        this.line(-r * .2, r * .55, r * .55, r * .2, color, 1.1, .7);
        this.line(0, -r * .8, 0, r * .8, color, .8, .45); break;
      default:
        c.beginPath(); c.moveTo(0, -r); c.lineTo(r * .78, -r * .12); c.lineTo(r * .3, r * .72);
        c.lineTo(-r * .72, r * .4); c.lineTo(-r * .58, -r * .4); c.closePath();
        c.fillStyle = finite(e.hitFlash) > 0 ? '#F2E9FF' : finite(this.game.worldTime) < 480 ? '#D8CCFF' : '#9D87C4'; c.fill(); c.strokeStyle = color; c.lineWidth = 1.3; c.stroke();
        this.line(-r * .26, -r * .22, r * .28, r * .22, color, 1, .6); break;
    }
    if (e.elite) {
      this.polygon(0, 0, r + 5, 4, C.swarm, null, Math.PI / 4, 1, .8);
      this.polygon(0, -r - 9, 3.5, 3, C.swarm, C.swarm, -Math.PI / 2, .8);
    }
    c.restore();
    if (finite(e.shield) > 0) {
      const p = clamp(e.shield / Math.max(1, finite(e.maxShield, e.shield)));
      this.circle(x, y, r + 5, '#74B9EF', 2.2, .7, -Math.PI / 2, -Math.PI / 2 + TAU * p);
    }
    const cursor = this.game.cursor || { x: 0, y: 0 };
    const near = Math.hypot(cursor.x - x, cursor.y - y) < 70;
    if (near || e.elite || e.type === 'channeler' || (e.hp < e.maxHp && !this.low && (this.game.enemies?.length || 0) < 80)) this.health(e, color);
    if (near || e.elite) this.label(enemyNames[e.type] || '우선 목표', x, y - r - 18, e.elite ? C.swarm : color, 11, 'center', .9);
  }

  health(e, color) {
    const c = this.ctx, width = e.boss ? Math.min(136, e.r * 2.5) : Math.max(22, e.r * 2), y = e.y + e.r + (e.boss ? 20 : 9);
    c.fillStyle = '#181821'; c.fillRect(e.x - width / 2, y, width, e.boss ? 4 : 2);
    c.fillStyle = color; c.fillRect(e.x - width / 2, y, width * clamp(e.hp / Math.max(1, e.maxHp)), e.boss ? 4 : 2);
    if (e.boss) this.label(`${Math.ceil(e.hp).toLocaleString()} / ${Math.ceil(e.maxHp).toLocaleString()}`, e.x, y + 17, color, 9, 'center');
  }

  boss(e, color) {
    const x = e.x, y = e.y, r = finite(e.r, 48), age = finite(e.age);
    this.fillCircle(x, y, r + 12, '#120818', .8);
    this.circle(x, y, r + 12, color, 1, .3, 0, TAU, [3, 8]);
    if (e.type === 'archivist') {
      for (let i = 2; i >= 0; i--) {
        const off = i * 6, c = this.ctx;
        c.save(); c.strokeStyle = color; c.fillStyle = i === 0 ? '#1E182D' : '#100E1C'; c.lineWidth = i === 0 ? 2 : 1;
        c.beginPath(); c.moveTo(x - r + off, y - r * .55 - off); c.lineTo(x - r * .3 + off, y - r * .55 - off);
        c.lineTo(x - r * .12 + off, y - r * .8 - off); c.lineTo(x + r + off, y - r * .8 - off);
        c.lineTo(x + r + off, y + r * .65 - off); c.lineTo(x - r + off, y + r * .65 - off); c.closePath(); c.fill(); c.stroke(); c.restore();
      }
      for (let k = -1; k <= 1; k++) this.line(x - r * .5, y + k * 8, x + r * .5, y + k * 8, color, 1, .6);
    } else if (e.type === 'conductor') {
      this.polygon(x, y, r, 8, color, '#201D18', Math.PI / 8, 2);
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8 + (this.reduced ? 0 : age * .08);
        this.line(x + Math.cos(a) * r * .48, y + Math.sin(a) * r * .48, x + Math.cos(a) * r * .82, y + Math.sin(a) * r * .82, color, 2, .85);
        this.polygon(x + Math.cos(a) * (r + 14), y + Math.sin(a) * (r + 14), 4.5, 4, color, null, 0, 1.2);
      }
      this.polygon(x, y, r * .38, 4, color, '#15120C', Math.PI / 4, 2);
      this.circle(x, y, r * .14, color, 1.5);
    } else {
      this.polygon(x, y, r, 6, color, '#22131F', Math.PI / 6, 2.1);
      this.polygon(x, y, r * .72, 6, color, '#100E1B', 0, 1.4);
      this.polygon(x, y, r * .4, 3, C.text, '#251424', -Math.PI / 2, 1.8);
      for (let i = 0; i < 6; i++) {
        const a = i * TAU / 6 + Math.PI / 6;
        this.line(x + Math.cos(a) * r * .78, y + Math.sin(a) * r * .78, x + Math.cos(a) * (r + 10), y + Math.sin(a) * (r + 10), color, 4, .9);
      }
    }
    if (this.high) this.circle(x, y, r + 2, C.text, 1, .7);
    this.label(enemyNames[e.type] || 'WORLD CORE', x, y - r - 29, color, 11, 'center');
    this.label(`${finite(e.phaseIndex, finite(e.phase, 1) - 1) + 1}단계`, x, y - r - 15, '#9B7F91', 10, 'center');
    this.health(e, color);
  }

  statusPass() {
    const game = this.game, cursor = game.cursor || { x: 0, y: 0 }, crowded = (game.enemies || []).filter(e => !e.dead).length > 80;
    const clusters = new Map();
    for (const e of game.enemies || []) {
      if (e.dead) continue;
      const statuses = e.statuses || {}, important = e.boss || e.elite || e.type === 'channeler' || e.adaptation || e.weakness || Math.hypot(cursor.x - e.x, cursor.y - e.y) < 160;
      if (crowded && !important) {
        const primary = statuses.infected ? 'infected' : statuses.mark ? 'mark' : null;
        if (primary) {
          const key = `${primary}:${Math.floor(e.x / 120)}:${Math.floor(e.y / 120)}`;
          const cluster = clusters.get(key) || { x: 0, y: 0, count: 0, type: primary };
          cluster.x += e.x; cluster.y += e.y; cluster.count++; clusters.set(key, cluster);
        }
        continue;
      }
      let secondary = 0;
      if (statuses.infected) {
        const s = statuses.infected, r = e.r + 9;
        this.clockRing(e.x, e.y, r, C.infection, clamp(s.remaining / Math.max(.1, finite(s.duration, 3))), 3, .95, 1.8);
        for (let i = 0; i < finite(s.stacks, 1); i++) this.fillCircle(e.x + (i - (finite(s.stacks, 1) - 1) / 2) * 5, e.y - e.r - 15, 1.4, C.infection);
        if (finite(s.duration, 3) > 3) this.label(`${Math.ceil(s.remaining)}s`, e.x, e.y + e.r + 20, C.infection, 8, 'center');
      } else if (statuses.mark) {
        const s = statuses.mark;
        this.glyph('mark', e.x + e.r + 6, e.y - e.r - 2, C.chain, 6);
        this.circle(e.x, e.y, e.r + 7, C.chain, 1.1, .6, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(s.remaining / Math.max(.1, finite(s.duration, 4))));
      }
      if (statuses.infected && statuses.mark) { this.glyph('mark', e.x - e.r - 5, e.y, C.chain, 5); secondary++; }
      for (const [type, color] of [['exposed', C.text], ['rupture', C.text], ['stroke', C.impact], ['burn', C.impact], ['lease', C.swarm]]) {
        if (!statuses[type] || secondary >= 2) continue;
        this.glyph(type, e.x + (secondary ? -1 : 1) * (e.r + 8), e.y + e.r * .35, color, 5.5);
        secondary++;
      }
      const strain = statuses.strain;
      if (strain && e.boss) {
        for (let i = 0; i < 4; i++) {
          const a = -Math.PI * .8 + i * Math.PI * .2;
          this.line(e.x + Math.cos(a) * (e.r + 19), e.y + Math.sin(a) * (e.r + 19), e.x + Math.cos(a) * (e.r + 26), e.y + Math.sin(a) * (e.r + 26), C.singularity, i < finite(strain.stacks, finite(strain.count)) ? 2.5 : 1, i < finite(strain.stacks, finite(strain.count)) ? 1 : .3);
        }
      }
      if (e.adaptation || e.weakness) {
        const color = C.swarm;
        this.circle(e.x, e.y, e.r + 13, color, 1, .65, -.3, .65);
        this.circle(e.x, e.y, e.r + 13, color, 1, .65, 1.5, 2.4);
        this.circle(e.x, e.y, e.r + 13, color, 1, .65, 3.2, 4.1);
        const weak = typeof e.weakness === 'string' ? e.weakness : e.weakness?.source || e.adaptation?.weakness || 'DIRECT';
        this.sourceGlyph(weak, e.x + e.r + 17, e.y - e.r - 7, color);
        if (important) this.label(String(weak).replace('_', ' '), e.x + e.r + 25, e.y - e.r - 7, color, 8);
      }
    }
    for (const cluster of clusters.values()) {
      if (cluster.count < 2) continue;
      const x = cluster.x / cluster.count, y = cluster.y / cluster.count - 20;
      const color = cluster.type === 'infected' ? C.infection : C.chain;
      this.glyph(cluster.type, x - 10, y, color, 5, .7);
      this.label(`×${cluster.count}`, x, y, color, 9, 'left', .75);
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
      this.brackets(beacon.x, beacon.y, 10, C.swarm, 1, 1.8);
      this.clockRing(beacon.x, beacon.y, 16, C.swarm, beacon.remaining / 3, 8, .9, 1.5);
      this.circle(beacon.x, beacon.y, 60, C.swarm, .8, .4, 0, TAU, [2, 7]);
      this.label('RELAY BEACON', beacon.x, beacon.y - 28, C.swarm, 8, 'center');
    }
    for (const e of this.game.enemies || []) {
      if (e.dead) continue;
      if (e.type === 'scrubber' && e.purifying) {
        this.circle(e.x, e.y, 70, C.infection, 1, .55, 0, TAU, [3, 7]);
        this.clockRing(e.x, e.y, e.r + 18, C.infection, clamp((e.age % 7 - 5) / 1.5), 6, .75);
        this.label('PURIFYING', e.x, e.y - e.r - 30, C.infection, 8, 'center');
      }
      if (e.type === 'jammer') {
        this.circle(e.x, e.y, 100, '#CE94E0', .8, this.high ? .55 : .23, 0, TAU, [2, 9]);
        this.brackets(e.x, e.y, e.r + 7, '#CE94E0', .65, 1);
      }
    }
  }

  effect(f) {
    const age = finite(f.age), life = Math.max(.001, finite(f.maxLife, finite(f.life, .4))), p = clamp(age / life);
    if (p >= 1) return;
    const x = finite(f.x), y = finite(f.y), color = f.color || C.text, r = finite(f.r, 22), alpha = Math.pow(1 - p, .8);
    const x2 = finite(f.toX, finite(f.x2, x)), y2 = finite(f.toY, finite(f.y2, y));
    switch (f.kind) {
      case 'line':
        if (f.width >= 12) this.lineHitbox(x, y, x2, y2, f.width, color, alpha * .45);
        this.line(x, y, x2, y2, color, Math.min(3, finite(f.width, 1.5)), alpha); break;
      case 'arc': this.zigzag(x, y, x2, y2, color, finite(f.width, 2), alpha, finite(f.seed, finite(f.rootId))); break;
      case 'ring':
        this.circle(x, y, r, color, Math.max(.7, 2 - p), alpha);
        if (f.segments) this.clockRing(x, y, r, color, 1 - p, f.segments, alpha); break;
      case 'burst': {
        const scale = this.reduced ? 1 : .65 + p * .45;
        this.circle(x, y, r * scale, color, 2.5 - p * 2, alpha);
        if (age < .08) this.fillCircle(x, y, r * .85, '#030611', .85 * alpha);
        const count = this.low ? 4 : 8;
        for (let i = 0; i < count; i++) {
          const a = i * TAU / count + .15;
          const inner = r * (this.reduced ? .8 : .5 + p * .45), outer = inner + (1 - p) * 14;
          this.line(x + Math.cos(a) * inner, y + Math.sin(a) * inner, x + Math.cos(a) * outer, y + Math.sin(a) * outer, color, 1, alpha * .7);
        }
        break;
      }
      case 'text':
        this.label(f.text || '', x, y - (this.reduced ? 0 : p * 14), color, finite(f.size, f.crit ? 15 : 11), 'center', alpha); break;
      case 'slash': {
        const angle = finite(f.angle), length = finite(f.length, 400);
        const tx = f.toX !== undefined || f.x2 !== undefined ? x2 : x + Math.cos(angle) * length;
        const ty = f.toY !== undefined || f.y2 !== undefined ? y2 : y + Math.sin(angle) * length;
        if (f.width) this.lineHitbox(x, y, tx, ty, f.width, color, alpha * .35);
        this.line(x, y, tx, ty, color, Math.max(1, 3 * (1 - p)), alpha);
        break;
      }
      case 'spawn': this.polygon(x, y, r * (this.reduced ? 1 : 1.4 - p * .4), 4, color, null, Math.PI / 4, 1, alpha * .65); break;
      case 'heal': this.glyph('exposed', x, y, color, 10, alpha); this.circle(x, y, r, color, 1, alpha); break;
      case 'hit':
        this.line(x - 5, y - 5, x + 5, y + 5, color, 1.6, alpha);
        this.line(x - 5, y + 5, x + 5, y - 5, color, 1.6, alpha); break;
      case 'marker':
        this.polygon(x, y, r, 4, color, f.filled ? color : null, 0, 1.8, alpha);
        if (f.text) this.label(f.text, x, y + r + 10, color, 9, 'center', alpha); break;
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
        this.label('WEAKNESS OPEN', e.x, e.y + e.r + 50, C.text, 10, 'center');
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
      this.label(d.label || 'WORLD CUT', (x + x2) / 2, (y + y2) / 2 - width / 2 - 13, color, 10, 'center');
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
      this.label(d.label || (d.type === 'anchor' ? 'ANCHOR BREACH' : 'INTEGRITY THREAT'), x, y - r - 17, color, 10, 'center');
    }
    const remaining = finite(d.remaining, finite(d.duration) - finite(d.age));
    this.label(`${Math.max(0, remaining).toFixed(1)}s`, x, y, '#FFD0D7', 11, 'center');
  }

  cursor() {
    const game = this.game, cur = game.cursor;
    if (!cur || cur.hidden || !Number.isFinite(cur.x) || !Number.isFinite(cur.y)) return;
    if (['menu', 'results', 'ended'].includes(game.phase)) return;
    const x = cur.x, y = cur.y, hold = finite(cur.hold), charged = !!cur.down && hold >= .8;
    const r = (charged ? 48 : 36) + finite(game.stats?.radiusBonus), available = finite(game.charges, 2) > 0;
    const color = available ? charged ? C.impact : finite(game.worldTime) >= 480 ? '#B08CFF' : C.text : '#706282';
    this.circle(x, y, r, color, .9, available ? .5 : .45, 0, TAU, available ? null : [3, 5]);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2;
      this.line(x + Math.cos(a) * 7, y + Math.sin(a) * 7, x + Math.cos(a) * 13, y + Math.sin(a) * 13, color, 1.5, .9);
    }
    this.circle(x, y, 5, color, 1, .9);
    this.fillCircle(x, y, 1.6, color);
    for (let i = 0; i < 2; i++) {
      const start = Math.PI * .31 + i * Math.PI * .29, end = start + Math.PI * .22;
      this.circle(x, y, 20, i < finite(game.charges) ? '#B08CFF' : '#30253F', i < finite(game.charges) ? 2.7 : 1.5, 1, start, end);
    }
    if (cur.down && available) {
      this.circle(x, y, r + 5, charged ? C.impact : C.chain, 2, 1, -Math.PI / 2, -Math.PI / 2 + TAU * clamp(hold / .8));
      if (hold >= 1.2) this.glyph('stroke', x + r + 9, y, C.impact, 7);
      this.label(hold >= 1.2 ? 'FULL' : charged ? 'CHARGED' : 'HOLD', x, y - r - 13, charged ? C.impact : C.chain, 9, 'center');
    }
    if (game.heat >= 80) {
      this.circle(x, y, 170, C.impact, 1, .65, 0, TAU, [7, 5]);
      this.label('CONTROLLED COLLAPSE / HOLD', x, y - 183, C.impact, 10, 'center');
    }
    const skills = game.skills || {};
    const armed = skills.armed;
    if (armed) {
      const remaining = typeof armed === 'number' ? armed : finite(armed.remaining, finite(armed.until) - this.time);
      this.clockRing(x, y, r + 12, C.chain, clamp(remaining / 6), 12, .9, 1.5);
      this.label('OVERCHARGE', x, y + r + 22, C.chain, 9, 'center');
      const candidates = (game.enemies || []).filter(e => !e.dead && Math.hypot(e.x - x, e.y - y) < 180).sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y)).slice(0, 3);
      for (const e of candidates) this.zigzag(x, y, e.x, e.y, C.chain, 1, .4, e.id, [4, 6]);
    }
    if (finite(skills.routeUntil) > this.time) {
      this.polygon(x, y, 15, 4, C.chain, null, 0, 1.7);
      this.clockRing(x, y, 24, C.chain, (skills.routeUntil - this.time) / 2.5, 8, .9);
      this.label(`ROUTE / ${skills.route?.slot?.key || (skills.route?.index === 1 ? 'Q' : 'E')}`, x, y + 54, C.chain, 9, 'center');
    }
    const held = skills.held;
    if (held) {
      const slot = typeof held === 'number' ? game.skillSlots?.[held] : held.slot || game.skillSlots?.[held.index];
      if (slot?.id === 'cut' || held.id === 'cut') {
        const dx = x - finite(held.startX, x), dy = y - finite(held.startY, y);
        const angle = held.heldSeconds >= .2 && Math.hypot(dx, dy) > 4 ? Math.atan2(dy, dx) : finite(skills.lastCutAngle);
        const length = slot?.branch === 'razor' ? 460 : 400, width = slot?.branch === 'razor' ? 12 : 26;
        const drawAim = (cx, cy, a, len) => {
          const x1 = cx - Math.cos(a) * len / 2, y1 = cy - Math.sin(a) * len / 2, x2 = cx + Math.cos(a) * len / 2, y2 = cy + Math.sin(a) * len / 2;
          this.lineHitbox(x1, y1, x2, y2, width, C.text, .45, [3, 6]);
          this.line(x1, y1, x2, y2, C.text, .9, .7, [7, 5]); this.arrow(x2, y2, a, C.text, 10);
        };
        drawAim(x, y, angle, length);
        if (slot?.branch === 'lattice') {
          if (slot.evolution >= 3) drawAim(x, y, angle + Math.PI / 2, length);
          else for (const offset of [-90, 90]) drawAim(x + Math.cos(angle) * offset, y + Math.sin(angle) * offset, angle + Math.PI / 2, 240);
        }
      } else if (slot?.id === 'bomb' || held.id === 'bomb') {
        const duration = finite(held.heldSeconds, finite(held.duration, finite(held.age, hold)));
        this.clockRing(x, y, 52, C.bomb, clamp(duration / .5), 8, .9);
        this.label(duration >= .5 ? 'RECORD' : 'TAP / HOLD', x, y + 68, C.bomb, 9, 'center');
        if (duration >= .5) {
          this.circle(x, y, 110, C.bomb, 1.1, .65, 0, TAU, [5, 5]);
          const history = skills.recordPreview || game.directHistory || [];
          const points = history.slice(-(slot?.branch === 'cluster' ? 7 : 5)), ghostRadius = slot?.branch === 'compression' ? 22 : 30;
          for (const [i, point] of points.entries()) {
            this.clockRing(point.x, point.y, ghostRadius, C.bomb, 1, 8, .6, 1);
            this.label(String(i + 1), point.x, point.y, C.bomb, 9, 'center', .8);
          }
        }
      }
    }
    const target = (game.enemies || []).find(e => !e.dead && Math.hypot(e.x - x, e.y - y) < e.r + 9);
    if (target) this.brackets(target.x, target.y, target.r + 5, target.type === 'channeler' ? C.danger : color, .95, 1.5);
  }

  edgeIndicators() {
    const cursor = this.game.cursor || { x: this.width / 2, y: this.height / 2 };
    for (const e of this.game.enemies || []) {
      if (e.dead || !(e.boss || e.elite || e.type === 'channeler')) continue;
      if (e.x >= 20 && e.x <= this.width - 20 && e.y >= 20 && e.y <= this.height - 20) continue;
      const x = clamp(e.x, 29, this.width - 29), y = clamp(e.y, 52, this.height - 52);
      this.arrow(x, y, Math.atan2(e.y - cursor.y, e.x - cursor.x), e.type === 'channeler' ? C.danger : C.swarm, 12);
      if (e.type === 'channeler') this.label(`A${finite(e.anchorIndex) + 1}`, x, y + 14, C.danger, 8, 'center');
    }
  }
}
