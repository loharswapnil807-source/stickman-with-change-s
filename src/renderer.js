import { ARENA } from './engine.js';
import { ENEMY_TYPES, MOVES } from './content.js';

export const WIDTH = 1440, HEIGHT = 810;
const TAU = Math.PI * 2;
const mix = (a, b, t) => a + (b - a) * t;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function rng(seed) { return () => { seed = Math.imul(seed, 1664525) + 1013904223 | 0; return (seed >>> 0) / 4294967296; }; }
function ellipse(c, x, y, w, h, color) { c.fillStyle = color; c.beginPath(); c.ellipse(x, y, w, h, 0, 0, TAU); c.fill(); }
function line(c, points, color, width = 1) { c.strokeStyle = color; c.lineWidth = width; c.beginPath(); points.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); }
function gradient(c, y1, y2, colors) { const g = c.createLinearGradient(0, y1, 0, y2); colors.forEach((v, i) => g.addColorStop(i / (colors.length - 1), v)); return g; }
function label(c, text, x, y, size = 18, color = '#fff') { c.fillStyle = color; c.font = `900 ${size}px "Arial Black", system-ui, sans-serif`; c.fillText(text, x, y); }

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.c = canvas.getContext('2d', { alpha: false });
    this.time = 0;
    this.particles = [];
    this.labels = [];
    this.rings = [];
    this.ghosts = [];
    this.shake = 0;
    this.flash = 0;
    this.reducedMotion = false;
    this.backgrounds = [0, 1, 2].map(id => this.makeBackground(id));
    this.resize();
  }

  resize() {
    const width = this.canvas.clientWidth || WIDTH;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.round(width * this.dpr);
    this.canvas.height = Math.round(width * HEIGHT / WIDTH * this.dpr);
  }

  makeBackground(id) {
    const canvas = document.createElement('canvas'); canvas.width = WIDTH; canvas.height = HEIGHT;
    const c = canvas.getContext('2d'); const r = rng(3821 + id * 73);
    if (id === 0) this.meadow(c, r);
    else if (id === 1) this.desk(c, r);
    else this.night(c, r);
    // Fine static grain ties vector scenery and paper together without a frame cost.
    for (let i = 0; i < 23000; i++) {
      c.fillStyle = r() > .5 ? 'rgba(255,255,255,.027)' : 'rgba(0,0,0,.025)';
      c.fillRect(r() * WIDTH, r() * HEIGHT, 1 + r() * 2, 1);
    }
    const vignette = c.createRadialGradient(720, 330, 180, 720, 405, 920);
    vignette.addColorStop(0, 'transparent'); vignette.addColorStop(1, 'rgba(11,24,22,.36)');
    c.fillStyle = vignette; c.fillRect(0, 0, WIDTH, HEIGHT);
    return canvas;
  }

  meadow(c, r) {
    c.fillStyle = gradient(c, 0, 530, ['#278bae', '#70bbc8', '#c0d8be']); c.fillRect(0, 0, WIDTH, HEIGHT);
    const sun = c.createRadialGradient(1040, 140, 10, 1040, 140, 440);
    sun.addColorStop(0, 'rgba(255,246,205,.5)'); sun.addColorStop(1, 'rgba(255,246,205,0)');
    c.fillStyle = sun; c.fillRect(0, 0, WIDTH, 550);
    // Hand-painted cloud banks, built from translucent irregular puffs.
    [[210, 170, 1], [700, 105, .6], [1190, 205, 1.1], [460, 315, .48]].forEach(([x, y, s]) => {
      for (let i = 0; i < 22; i++) ellipse(c, x + (r() - .5) * 310 * s, y + (r() - .5) * 36 * s, (32 + r() * 70) * s, (12 + r() * 23) * s, 'rgba(248,252,239,.12)');
    });
    c.fillStyle = '#678c64'; c.beginPath(); c.moveTo(0, 448); c.bezierCurveTo(340, 260, 1060, 470, 1440, 327); c.lineTo(1440, 810); c.lineTo(0, 810); c.fill();
    c.fillStyle = gradient(c, 370, 810, ['#8cac36', '#527d2a', '#234d28']);
    c.beginPath(); c.moveTo(0, 450); c.bezierCurveTo(310, 452, 525, 302, 850, 364); c.bezierCurveTo(1120, 406, 1210, 477, 1440, 460); c.lineTo(1440, 810); c.lineTo(0, 810); c.fill();
    for (let i = 0; i < 12500; i++) {
      const x = r() * WIDTH, y = 440 + r() * 370;
      const depth = (y - 380) / 430;
      c.strokeStyle = r() > .55 ? `rgba(211,225,110,${.05 + depth * .16})` : `rgba(18,64,27,${.03 + depth * .15})`;
      c.lineWidth = .5 + depth; c.beginPath(); c.moveTo(x, y); c.lineTo(x + (r() - .5) * 6, y - r() * 10 * depth); c.stroke();
    }
    // A distant original desktop motif, rather than a copied OS wallpaper.
    c.save(); c.translate(1170, 340); c.rotate(.06); c.globalAlpha = .65;
    c.fillStyle = '#f7eeb6'; c.fillRect(-55, -60, 53, 10); c.fillRect(-55, -50, 114, 72);
    c.fillStyle = '#e8ca72'; c.fillRect(-52, -44, 108, 63);
    c.fillStyle = '#fff1b5'; c.beginPath(); c.moveTo(-60, -30); c.lineTo(66, -30); c.lineTo(53, 25); c.lineTo(-52, 25); c.fill();
    c.restore();
    for (let i = 0; i < 110; i++) {
      const x = r() * WIDTH, y = 650 + r() * 160;
      line(c, [[x, y], [x + 2, y - 9]], 'rgba(126,169,74,.6)', 1);
      ellipse(c, x + 2, y - 10, 2 + r(), 1.8, r() > .4 ? '#d8dfa8' : '#ddbe6c');
    }
  }

  desk(c, r) {
    c.fillStyle = gradient(c, 0, 600, ['#7c9c96', '#b7b99d', '#8a836f']); c.fillRect(0, 0, WIDTH, HEIGHT);
    c.fillStyle = '#354a49'; c.fillRect(100, 30, 485, 385);
    c.fillStyle = gradient(c, 40, 400, ['#a8c6bb', '#e6ddb1']); c.fillRect(117, 45, 450, 352);
    c.fillStyle = 'rgba(84,116,89,.3)'; c.beginPath(); c.moveTo(117, 270); c.quadraticCurveTo(340, 160, 567, 280); c.lineTo(567, 397); c.lineTo(117, 397); c.fill();
    c.fillStyle = '#52625a'; c.fillRect(327, 40, 17, 368); c.fillRect(106, 210, 473, 15);
    c.fillStyle = '#374744'; c.fillRect(95, 406, 500, 20);
    c.save(); c.translate(740, 160); c.rotate(-.06); c.fillStyle = '#e2cb7e'; c.fillRect(0, 0, 155, 130);
    line(c, [[25, 28], [127, 28]], '#7e775d', 2); line(c, [[25, 44], [108, 44]], '#7e775d', 2);
    label(c, 'BRB.', 28, 91, 30, '#585846'); c.restore();
    c.fillStyle = gradient(c, 465, 810, ['#b88a53', '#805334', '#593b29']);
    c.beginPath(); c.moveTo(0, 475); c.lineTo(1440, 445); c.lineTo(1440, 810); c.lineTo(0, 810); c.fill();
    for (let i = 0; i < 1200; i++) {
      const y = 465 + r() * 345, x = r() * WIDTH;
      line(c, [[x, y], [x + 30 + r() * 230, y + r() * 3]], r() > .5 ? 'rgba(241,184,112,.07)' : 'rgba(46,26,17,.10)', 1);
    }
    // Oversized stationery gives the fighters a miniature sense of scale.
    ellipse(c, 1270, 596, 91, 19, 'rgba(30,31,26,.25)');
    c.fillStyle = '#a9c2b8'; c.fillRect(1200, 396, 124, 186); ellipse(c, 1262, 582, 62, 17, '#8aa59c');
    ellipse(c, 1262, 396, 62, 18, '#cee1c8'); ellipse(c, 1262, 396, 53, 12, '#57746b');
    c.save(); c.translate(1250, 398); c.rotate(-.2); c.fillStyle = '#e9b957'; c.fillRect(-6, -196, 12, 197); c.fillStyle = '#f0dcb3'; c.beginPath(); c.moveTo(-6, -196); c.lineTo(0, -221); c.lineTo(6, -196); c.fill(); c.restore();
    c.save(); c.translate(1272, 393); c.rotate(.12); c.fillStyle = '#425d5b'; c.fillRect(-8, -238, 16, 235); c.fillStyle = '#cedac2'; c.fillRect(-8, -244, 16, 29); c.restore();
    ellipse(c, 190, 594, 78, 16, 'rgba(35,31,24,.3)');
    line(c, [[180, 578], [211, 359], [135, 160]], '#34443e', 13);
    ellipse(c, 180, 579, 65, 13, '#43554b');
    c.fillStyle = '#435d51'; c.beginPath(); c.moveTo(84, 145); c.lineTo(172, 133); c.lineTo(203, 209); c.lineTo(76, 221); c.closePath(); c.fill();
    ellipse(c, 139, 214, 62, 12, '#ffe7a3');
    const light = c.createRadialGradient(300, 500, 30, 300, 500, 280); light.addColorStop(0, 'rgba(255,223,136,.14)'); light.addColorStop(1, 'transparent'); c.fillStyle = light; c.fillRect(0, 300, 650, 460);
    c.save(); c.translate(360, 720); c.rotate(-.12); c.fillStyle = '#d2cabc'; c.fillRect(-145, -12, 280, 20); c.fillStyle = '#dfb771'; c.fillRect(-145, -12, 280, 10); c.restore();
  }

  night(c, r) {
    c.fillStyle = gradient(c, 0, 810, ['#191c39', '#41416c', '#263c48']); c.fillRect(0, 0, WIDTH, HEIGHT);
    for (let i = 0; i < 180; i++) ellipse(c, r() * WIDTH, r() * 440, r() * 1.5, r() * 1.5, `rgba(220,215,255,${r() * .7})`);
    const glow = c.createRadialGradient(1050, 168, 10, 1050, 168, 160); glow.addColorStop(0, '#c7c2e55c'); glow.addColorStop(1, 'transparent'); c.fillStyle = glow; c.fillRect(870, 0, 360, 350);
    ellipse(c, 1050, 168, 48, 48, '#ddd5ee'); ellipse(c, 1068, 155, 45, 45, '#363656');
    for (let i = 0; i < 24; i++) {
      const x = i * 67, h = 80 + r() * 180;
      c.fillStyle = '#22243c'; c.fillRect(x, 488 - h, 50 + r() * 30, h);
      for (let y = 488 - h + 15; y < 465; y += 24) for (let xx = x + 10; xx < x + 50; xx += 17) if (r() > .4) { c.fillStyle = r() > .8 ? '#d9ad6f' : '#717799'; c.fillRect(xx, y, 5, 8); }
    }
    c.fillStyle = gradient(c, 485, 810, ['#293a4a', '#1b2935']); c.fillRect(0, 480, WIDTH, 330);
    for (let i = -12; i < 13; i++) line(c, [[720 + i * 35, 485], [720 + i * 180, 810]], 'rgba(142,159,172,.15)');
    [492, 506, 528, 562, 612, 686, 791].forEach(y => line(c, [[0, y], [1440, y]], 'rgba(142,159,172,.15)'));
    c.fillStyle = '#686286'; c.fillRect(175, 301, 196, 153); c.fillStyle = '#211d36'; c.fillRect(183, 327, 180, 119);
    label(c, 'OFFLINE CLUB', 194, 319, 13, '#e8d5f2');
    label(c, '> stay a little', 194, 363, 15, '#b4c697'); label(c, '> fight a little_', 194, 392, 15, '#b4c697');
    line(c, [[267, 454], [267, 535]], '#454058', 8);
    c.fillStyle = '#292637'; c.fillRect(217, 531, 100, 8);
    c.save(); c.translate(1230, 365); c.rotate(.1); c.strokeStyle = '#b89cdf'; c.shadowColor = '#b89cdf'; c.shadowBlur = 22; c.lineWidth = 4; c.strokeRect(-44, -35, 96, 68); c.shadowBlur = 0; label(c, '02:AM', -34, 7, 22, '#d6c2ef'); c.restore();
  }

  onEvent(event) {
    if (event.type === 'hit' || event.type === 'hurt' || event.type === 'kill' || event.type === 'block' || event.type === 'land') {
      const heavy = ['heavy', 'slam'].includes(event.move) || event.type === 'land';
      const count = this.reducedMotion ? 5 : heavy ? 24 : 14;
      const y = ARENA.floor - event.z;
      const colors = event.type === 'hurt' ? ['#ff7f70', '#fff4d4', '#263227'] : event.type === 'block' ? ['#b8acff', '#fff', '#d8f875'] : ['#f5f3df', '#daf574', '#fff9be', '#263327'];
      for (let i = 0; i < count; i++) {
        const a = Math.random() * TAU, speed = 90 + Math.random() * (heavy ? 510 : 330);
        this.particles.push({ x: event.x, y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 70, life: .25 + Math.random() * .5, max: .8, size: 2 + Math.random() * 8, rotation: Math.random() * TAU, color: colors[i % colors.length] });
      }
      this.rings.push({ x: event.x, y, life: .3, max: heavy ? 90 : 50, color: event.type === 'hurt' ? '#ff7f70' : '#fff5cb' });
      if (event.label) this.labels.push({ x: event.x, y: y - 65, text: event.label, life: .75, size: heavy ? 34 : 26 });
      if (!this.reducedMotion) this.shake = Math.max(this.shake, event.type === 'hurt' ? 9 : heavy ? 12 : 5);
      this.flash = Math.max(this.flash, event.type === 'hurt' ? .1 : heavy ? .08 : .045);
    }
    if (event.type === 'enemySwing') {
      this.rings.push({ x: event.x, y: ARENA.floor - 24, life: .22, max: 70, color: '#ff866d' });
      if (!this.reducedMotion) this.shake = Math.max(this.shake, 2.5);
    }
    if (event.type === 'dodge' && !this.reducedMotion) for (let i = 0; i < 4; i++) this.ghosts.push({ x: event.x + event.direction * i * 27, life: .25 + i * .035, face: -event.direction });
  }

  update(dt) {
    this.time += dt;
    this.shake *= Math.exp(-22 * dt);
    this.flash = Math.max(0, this.flash - dt);
    for (const p of this.particles) { p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 550 * dt; p.rotation += dt * 6; }
    this.particles = this.particles.filter(p => p.life > 0);
    for (const label of this.labels) { label.life -= dt; label.y -= dt * 42; }
    this.labels = this.labels.filter(l => l.life > 0);
    for (const ring of this.rings) ring.life -= dt;
    this.rings = this.rings.filter(r => r.life > 0);
    for (const ghost of this.ghosts) ghost.life -= dt;
    this.ghosts = this.ghosts.filter(g => g.life > 0);
  }

  reset() { this.particles = []; this.labels = []; this.rings = []; this.ghosts = []; this.shake = 0; this.flash = 0; }

  render(game, menuStage = 0) {
    const c = this.c, scale = this.canvas.width / WIDTH;
    c.setTransform(scale, 0, 0, scale, 0, 0);
    c.save();
    const shake = this.reducedMotion ? 0 : this.shake;
    c.translate((Math.random() - .5) * shake, (Math.random() - .5) * shake);
    c.drawImage(this.backgrounds[game.status === 'menu' ? menuStage : game.stage], -8, -8, WIDTH + 16, HEIGHT + 16);
    if (game.status === 'menu') this.preview(c);
    else {
      for (const e of game.enemies) this.shadow(c, e.x, e.z, e.kind === 'brute' ? 1.2 : .95);
      this.shadow(c, game.player.x, game.player.z, 1);
      for (const ghost of this.ghosts) {
        c.save(); c.globalAlpha = ghost.life * .4; this.fighter(c, { x: ghost.x, z: 0, face: ghost.face, pose: 'dodge', poseTime: .1, poseDuration: .23 }, true); c.restore();
      }
      for (const e of game.enemies) {
        const spec = ENEMY_TYPES[e.kind];
        const pose = e.state === 'telegraph' ? 'windup' : e.state === 'strike' ? 'heavy' : e.state === 'stunned' ? 'hurt' : e.state === 'dead' ? 'dead' : e.z > 0 ? 'air' : Math.abs(e.x - game.player.x) > spec.reach && game.mode !== 'training' ? 'run' : 'idle';
        const figure = { ...e, pose: e.z > 5 ? 'air' : pose, poseTime: e.age, poseDuration: .5 };
        c.save(); if (e.state === 'dead') c.globalAlpha = Math.max(0, e.timer / .65); this.fighter(c, figure, false); c.restore();
        if (e.hp > 0) this.enemyUI(c, e, e.id === game.targetId, game.mode === 'training');
      }
      const p = game.player;
      if (p.attack) this.attackTrail(c, p);
      c.save(); if (p.invulnerable > .3 && Math.sin(this.time * 45) > .4) c.globalAlpha = .55;
      this.fighter(c, p, true); c.restore();
      if (game.mode === 'training' && !this.reducedMotion) {
        c.textAlign = 'center'; label(c, 'TRAINING DUMMY', game.enemies[0]?.x ?? 800, ARENA.floor + 40, 12, '#fffde9b0');
      }
    }
    for (const ring of this.rings) {
      c.save(); c.globalAlpha = ring.life / .3; c.strokeStyle = ring.color; c.lineWidth = 4 * ring.life / .3;
      c.beginPath(); c.ellipse(ring.x, ring.y, ring.max * (1 - ring.life / .3), ring.max * .6 * (1 - ring.life / .3), -.2, 0, TAU); c.stroke(); c.restore();
    }
    for (const p of this.particles) {
      c.save(); c.translate(p.x, p.y); c.rotate(p.rotation); c.globalAlpha = Math.min(1, p.life * 3); c.fillStyle = p.color;
      c.fillRect(-p.size / 2, -p.size / 2, p.size * 1.5, p.size * .65); c.restore();
    }
    for (const l of this.labels) {
      c.save(); c.translate(l.x, l.y); c.rotate(-.08); c.globalAlpha = Math.min(1, l.life * 5); c.textAlign = 'center';
      c.font = `italic 900 ${l.size}px "Arial Black", sans-serif`; c.strokeStyle = '#263128'; c.lineWidth = 7; c.strokeText(l.text, 0, 0); c.fillStyle = '#f4f7ca'; c.fillText(l.text, 0, 0); c.restore();
    }
    if (this.flash > 0) { c.fillStyle = `rgba(255,248,207,${this.flash * 1.8})`; c.fillRect(-8, -8, WIDTH + 16, HEIGHT + 16); }
    c.restore();
  }

  preview(c) {
    const t = this.reducedMotion ? .3 : this.time;
    const cycle = t % 7;
    const attacking = cycle > 3 && cycle < 3.6;
    const launched = cycle >= 3.4 && cycle < 5;
    const z = launched ? Math.sin((cycle - 3.4) / 1.6 * Math.PI) * 170 : 0;
    this.shadow(c, 973, 0); this.shadow(c, 1164, z);
    this.fighter(c, { x: 985 + (attacking ? Math.sin((cycle - 3) / .6 * Math.PI) * 35 : 0), z: 0, face: 1, pose: attacking ? 'launch' : 'idle', poseTime: attacking ? cycle - 3 : t, poseDuration: .6 }, true);
    this.fighter(c, { x: 1163, z, face: -1, kind: 'doodle', pose: launched ? 'air' : 'idle', poseTime: t, poseDuration: .5 }, false);
    if (launched) {
      c.save(); c.translate(1210, 377 - z * .2); c.rotate(.08); c.textAlign = 'center';
      c.font = 'italic 900 37px "Arial Black", sans-serif'; c.strokeStyle = '#263128'; c.lineWidth = 7; c.strokeText('GOOD WORD.', 0, 0); c.fillStyle = '#e5f5a8'; c.fillText('GOOD WORD.', 0, 0); c.restore();
    }
    c.save(); c.translate(1090, 687); c.rotate(-.04); c.fillStyle = '#fff5cf'; c.fillRect(-96, -16, 192, 34); c.textAlign = 'center'; label(c, 'ALL KEYS. NO MERCY.', 0, 6, 14, '#354638'); c.restore();
  }

  attackTrail(c, player) {
    const spec = MOVES[player.attack.move];
    const progress = clamp(player.attack.t / spec.duration, 0, 1);
    if (progress < .16 || progress > .78) return;
    c.save();
    c.translate(player.x, ARENA.floor - player.z - 125);
    c.scale(player.face || 1, 1);
    c.globalAlpha = Math.sin(((progress - .16) / .62) * Math.PI) * .8;
    c.strokeStyle = player.attack.move === 'slam' ? '#ffe29a' : '#d7f578';
    c.shadowColor = c.strokeStyle; c.shadowBlur = 18; c.lineWidth = player.attack.move === 'heavy' || player.attack.move === 'slam' ? 10 : 6;
    c.beginPath(); c.arc(18, 0, player.attack.move === 'launch' ? 82 : 68, -.95, .55); c.stroke();
    c.globalAlpha *= .42; c.lineWidth *= .55;
    c.beginPath(); c.arc(26, 0, player.attack.move === 'launch' ? 104 : 88, -.85, .38); c.stroke();
    c.restore();
  }

  shadow(c, x, z, scale = 1) {
    ellipse(c, x + 7, ARENA.floor + 10, (65 - Math.min(z, 350) * .09) * scale, 9 - Math.min(z, 350) * .014, `rgba(10,26,22,${.24 - Math.min(z, 350) * .0004})`);
  }

  paper(c, color) {
    const path = () => {
      c.beginPath(); c.moveTo(-59, -222); c.lineTo(-15, -228); c.lineTo(5, -222); c.lineTo(60, -227); c.lineTo(57, -210); c.lineTo(84, -193); c.lineTo(77, -170); c.lineTo(85, -129); c.lineTo(72, -106); c.lineTo(91, -73); c.lineTo(78, -49); c.lineTo(85, 11); c.lineTo(44, 5); c.lineTo(17, 13); c.lineTo(-16, 4); c.lineTo(-55, 14); c.lineTo(-81, -4); c.lineTo(-72, -41); c.lineTo(-88, -57); c.lineTo(-78, -99); c.lineTo(-89, -125); c.lineTo(-72, -156); c.lineTo(-78, -198); c.closePath();
    };
    c.save(); c.shadowColor = 'rgba(15,24,25,.35)'; c.shadowOffsetX = 7; c.shadowOffsetY = 8; c.shadowBlur = 3;
    path(); c.fillStyle = gradient(c, -225, 20, ['#fcf9e9', '#e8e5d6', '#d5d5c7']); c.fill();
    c.shadowColor = 'transparent'; path(); c.clip();
    for (let y = -210; y < 20; y += 18) line(c, [[-100, y], [100, y]], '#7898a62c', 1);
    line(c, [[-51, -240], [-51, 30]], '#d78c873e', 1);
    c.fillStyle = '#ffffff24'; c.beginPath(); c.moveTo(-90, -70); c.lineTo(80, -222); c.lineTo(90, -188); c.lineTo(-80, -36); c.fill();
    line(c, [[-80, -36], [81, -190]], '#8e8f8729', 1);
    c.fillStyle = color; c.globalAlpha = .08; c.fillRect(-90, -240, 180, 260); c.restore();
  }

  fighter(c, figure, player) {
    const t = this.reducedMotion ? 0 : this.time;
    const brute = figure.kind === 'brute';
    const color = player ? '#df704e' : ENEMY_TYPES[figure.kind]?.color ?? '#a990cf';
    const pose = figure.pose;
    let phase = Math.min(1, (figure.poseTime || 0) / (figure.poseDuration || .5));
    if (!player && pose === 'heavy') phase = .5;
    let punch = 0, lean = 0, crouch = 0, upper = 0, kick = 0;
    const pulse = Math.sin(phase * Math.PI);
    if (pose === 'jab') { punch = Math.sin(phase * Math.PI) ** .45; lean = punch * 20; }
    if (pose === 'heavy') { punch = phase < .3 ? -phase * 2 : Math.sin((phase - .3) / .7 * Math.PI) ** .4; lean = punch * 32; kick = Math.max(0, punch) * .55; }
    if (pose === 'launch') { upper = pulse; lean = -pulse * 8; crouch = -pulse * 15; }
    if (pose === 'slam') { upper = phase < .35 ? phase * 2 : .7 * (1 - phase); lean = pulse * 30; crouch = pulse * 18; punch = phase > .35 ? .8 : 0; }
    if (pose === 'hurt') { lean = -27; crouch = 10; }
    if (pose === 'guard') { crouch = 12; lean = -8; }
    if (pose === 'windup') { lean = -16; punch = -.7; }
    if (pose === 'dodge') { crouch = 47; lean = 30; }
    const running = pose === 'run';
    const gait = running ? Math.sin(t * 17 + (figure.phase || 0)) : Math.sin(t * 2.6) * .06;
    const bob = running ? Math.abs(Math.sin(t * 17)) * 5 : Math.sin(t * 2.6) * 2;
    const air = pose === 'air' || pose === 'dead';
    c.save(); c.translate(figure.x, ARENA.floor - (figure.z || 0));
    if (air) c.rotate(figure.state === 'dead' ? figure.age * 8 : Math.sin(t * 5) * .25 + .55 * figure.face);
    if (brute) c.scale(1.14, 1.1);
    c.rotate(player ? -.018 : .025);
    this.paper(c, color);
    c.scale(figure.face || 1, 1);
    const hip = [lean * .38, -74 + crouch - bob];
    const shoulder = [lean, -137 + crouch - bob];
    const head = [lean + 3, -171 + crouch - bob];
    const ink = figure.flash > 0 ? '#b05436' : '#263330';
    c.lineCap = 'round'; c.lineJoin = 'round';
    const limb = points => { line(c, points, '#fdf9e9', brute ? 11 : 10); line(c, points, ink, brute ? 6 : 5); };
    limb([hip, [mix(hip[0], shoulder[0], .5) - 3, -110 + crouch - bob], shoulder]);
    if (air) {
      limb([hip, [-24, -68], [-57, -83]]); limb([hip, [24, -50], [54, -64]]);
      limb([shoulder, [-36, -141], [-50, -171]]); limb([shoulder, [36, -127], [64, -139]]);
    } else {
      const frontFoot = [42 + gait * 23 + kick * 42, kick > .1 ? -60 * kick : 0];
      const backFoot = [-37 - gait * 23, running ? -Math.max(0, -gait) * 25 : 0];
      limb([hip, [20 + gait * 19, -37 + crouch * .3 - kick * 12], frontFoot]);
      limb([hip, [-23 - gait * 20, -34 + crouch * .3], backFoot]);
      if (upper > .05) {
        limb([shoulder, [30, -148 - upper * 25], [23, -143 - upper * 94]]);
        limb([shoulder, [-27, -112], [-9, -100]]);
      } else if (punch !== 0) {
        limb([shoulder, [shoulder[0] + 29 + punch * 20, shoulder[1] + 4], [shoulder[0] + 38 + punch * 66, shoulder[1] - 7 + (pose === 'slam' ? 30 : 0)]]);
        limb([shoulder, [shoulder[0] - 24, shoulder[1] + 25], [shoulder[0] + 3, shoulder[1] + 17]]);
      } else if (pose === 'guard') {
        limb([shoulder, [25, -110], [33, -170]]); limb([shoulder, [13, -102], [15, -159]]);
      } else {
        limb([shoulder, [28 - gait * 15, -105], [40 - gait * 29, -132 + gait * 15]]);
        limb([shoulder, [-21 + gait * 20, -112], [6 + gait * 23, -104 - gait * 18]]);
      }
      // Tiny ink feet anchor the silhouette.
      line(c, [[backFoot[0] - 8, backFoot[1]], backFoot], ink, 5);
      line(c, [frontFoot, [frontFoot[0] + 9, frontFoot[1]]], ink, 5);
    }
    ellipse(c, head[0], head[1], brute ? 25 : 23, brute ? 22 : 24, figure.flash > 0 ? '#fff9bf' : '#f9f8eb');
    c.strokeStyle = ink; c.lineWidth = 4; c.beginPath(); c.ellipse(head[0], head[1], brute ? 25 : 23, brute ? 22 : 24, -.06, 0, TAU); c.stroke();
    if (player) {
      line(c, [[head[0] - 20, head[1] - 10], [head[0] + 22, head[1] - 8]], color, 8);
      line(c, [[head[0] - 20, head[1] - 9], [head[0] - 42, head[1] - 5 - Math.sin(t * 6) * 4]], color, 6);
      line(c, [[head[0] - 21, head[1] - 7], [head[0] - 37, head[1] + 6]], color, 4);
    } else if (brute) {
      c.fillStyle = '#444347'; c.fillRect(head[0] - 23, head[1] - 8, 48, 10);
      c.fillStyle = '#ffc16c'; c.fillRect(head[0] + 4, head[1] - 6, 12, 4);
    } else {
      line(c, [[head[0] - 11, head[1] - 26], [head[0] - 3, head[1] - 32], [head[0] + 6, head[1] - 23], [head[0] + 13, head[1] - 27]], color, 5);
    }
    if (!brute) {
      if (pose === 'hurt' || air) {
        line(c, [[head[0] + 3, head[1] - 3], [head[0] + 10, head[1] + 3]], ink, 2);
        line(c, [[head[0] + 10, head[1] - 3], [head[0] + 3, head[1] + 3]], ink, 2);
      } else { ellipse(c, head[0] + 7, head[1] - 2, 2, 3, ink); ellipse(c, head[0] + 16, head[1] - 1, 1.5, 2.5, ink); }
      line(c, [[head[0] + 5, head[1] + 11], [head[0] + 13, head[1] + 10]], ink, 2);
    }
    c.restore();
  }

  enemyUI(c, enemy, targeted, training) {
    const y = ARENA.floor - enemy.z - (enemy.kind === 'brute' ? 273 : 252);
    c.save(); c.textAlign = 'center';
    if (targeted) {
      c.fillStyle = '#e6f991'; c.beginPath(); c.moveTo(enemy.x - 7, y - 19); c.lineTo(enemy.x + 7, y - 19); c.lineTo(enemy.x, y - 9); c.fill();
      label(c, training ? 'YOUR TARGET' : ENEMY_TYPES[enemy.kind].name.toUpperCase(), enemy.x, y - 26, 12, '#f2f5dc');
    }
    if (!training) {
      c.fillStyle = '#253b31b0'; c.fillRect(enemy.x - 35, y, 70, 4);
      c.fillStyle = ENEMY_TYPES[enemy.kind].color; c.fillRect(enemy.x - 35, y, 70 * enemy.hp / enemy.maxHp, 4);
    }
    if (enemy.state === 'telegraph') {
      c.save(); c.translate(enemy.x + enemy.face * 51, y + 85);
      ellipse(c, 0, 0, 21, 25, '#ff866d'); label(c, '!', 0, 11, 31, '#302d27'); c.restore();
      c.strokeStyle = '#ff866d'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(enemy.x, ARENA.floor + 10, 68, 11, 0, 0, TAU); c.stroke();
    }
    c.restore();
  }
}
