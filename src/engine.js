import { MOVES, DIFFICULTIES, ENEMY_TYPES, TUTORIAL } from './content.js';

export const STEP = 1 / 120;
export const ARENA = { left: 110, right: 1330, floor: 635 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const down = (v, dt) => Math.max(0, v - dt);

// The simulation owns all gameplay time. Rendering, browser timers and sound
// cannot change a combat outcome. Randomness is seeded for repeatable tests.
export class Game {
  constructor(seed = Date.now()) {
    this.seed = seed >>> 0 || 1;
    this.status = 'menu';
    this.events = [];
    this.enemies = [];
    this.input = { left: false, right: false, guard: false };
  }

  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  emit(type, data = {}) { this.events.push({ type, ...data }); }
  drainEvents() { return this.events.splice(0); }

  start({ mode = 'arcade', difficulty = 'normal', stage = 0 } = {}) {
    this.mode = ['arcade', 'training', 'time'].includes(mode) ? mode : 'arcade';
    this.difficulty = DIFFICULTIES[difficulty] ? difficulty : 'normal';
    this.startStage = clamp(stage | 0, 0, 2);
    this.stage = this.startStage;
    this.status = 'playing';
    this.input = { left: false, right: false, guard: false };
    this.events = [];
    this.player = { x: 560, z: 0, face: 1, hp: 100, stamina: 100, pose: 'idle', poseTime: 0, poseDuration: 0, invulnerable: 0, hurt: 0, dodge: 0, dodgeCooldown: 0, guard: false, attack: null };
    this.enemies = [];
    this.nextId = 0;
    this.targetId = null;
    this.score = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.comboTime = 0;
    this.style = 0;
    this.kills = 0;
    this.correct = 0;
    this.wrong = 0;
    this.elapsed = 0;
    this.wave = 0;
    this.remaining = 90;
    this.hitstop = 0;
    this.waveWait = 0;
    this.spawnTime = 0;
    this.toSpawn = 0;
    this.queue = [];
    this.lastMove = '';
    this.usedMoves = new Set();
    this.move = 'jab';
    this.word = '';
    this.progress = 0;
    this.error = 0;
    this.tip = '';
    this.tipTime = 0;
    this.lesson = 0;
    this.nextWord();
    this.beginWave();
  }

  nextWord() {
    const words = MOVES[this.move].words;
    const options = words.filter(word => word !== this.word);
    this.word = options[Math.floor(this.random() * options.length)];
    this.progress = 0;
  }

  selectMove(move) {
    if (this.status !== 'playing' || !MOVES[move] || move === this.move) return;
    this.move = move;
    this.nextWord();
    this.emit('select');
  }

  type(char) {
    if (this.status !== 'playing' || !/^[a-z]$/i.test(char)) return false;
    if (char.toLowerCase() !== this.word[this.progress]) {
      this.wrong++;
      this.error = .24;
      this.style = Math.max(0, this.style - 3);
      this.emit('typo');
      return false;
    }
    this.correct++;
    this.progress++;
    this.emit('letter', { progress: this.progress });
    if (this.progress === this.word.length) {
      if (this.queue.length < 2) this.queue.push({ move: this.move, targetId: this.targetId });
      else this.notify('BUFFER FULL · finish your current attacks');
      this.nextWord();
      this.tryAttack();
    }
    return true;
  }

  notify(text) { this.tip = text; this.tipTime = 2.1; }
  get target() { return this.enemies.find(e => e.id === this.targetId && e.hp > 0) || null; }
  get accuracy() { return this.correct + this.wrong ? Math.round(this.correct / (this.correct + this.wrong) * 100) : 100; }
  get wpm() { return this.elapsed > 2 ? Math.round(this.correct / 5 / (this.elapsed / 60)) : 0; }
  get rank() { return this.style >= 90 ? 'S' : this.style >= 65 ? 'A' : this.style >= 40 ? 'B' : this.style >= 20 ? 'C' : 'D'; }

  chooseTarget() {
    if (this.target) return;
    const living = this.enemies.filter(e => e.hp > 0);
    living.sort((a, b) => Math.abs(a.x - this.player.x) - Math.abs(b.x - this.player.x));
    this.targetId = living[0]?.id ?? null;
  }

  cycleTarget() {
    if (this.status !== 'playing') return;
    const living = this.enemies.filter(e => e.hp > 0).sort((a, b) => a.x - b.x);
    const idx = living.findIndex(e => e.id === this.targetId);
    this.targetId = living[(idx + 1) % living.length]?.id ?? null;
    this.emit('select');
  }

  dodge() {
    const p = this.player;
    if (this.status !== 'playing' || p.dodgeCooldown > 0 || p.stamina < 23 || p.hurt > 0) return false;
    p.stamina -= 23;
    p.attack = null;
    p.dodge = .23;
    p.dodgeCooldown = .48;
    p.invulnerable = .3;
    p.dodgeDirection = this.input.left ? -1 : this.input.right ? 1 : -(Math.sign((this.target?.x ?? p.x + 1) - p.x) || 1);
    p.pose = 'dodge'; p.poseTime = 0; p.poseDuration = .23;
    this.emit('dodge', { x: p.x, direction: p.dodgeDirection });
    this.advanceLesson('dodge');
    return true;
  }

  tryAttack() {
    const p = this.player;
    if (!this.queue.length || p.attack || p.dodge > 0 || p.hurt > 0 || p.guard) return;
    const command = this.queue.shift();
    const move = MOVES[command.move];
    const victim = this.enemies.find(e => e.id === command.targetId && e.hp > 0) || this.target;
    if (!victim) { this.notify('NEXT TARGET INCOMING'); return; }
    if (command.move === 'slam' && victim.z < 28) {
      this.notify('LAUNCH FIRST · 3 + type, then 4 + type');
      this.emit('invalid');
      return;
    }
    if (Math.abs(victim.x - p.x) > move.reach + 100) {
      this.notify('GET CLOSER · ← → to move');
      this.emit('invalid');
      return;
    }
    const face = Math.sign(victim.x - p.x) || p.face;
    p.face = face;
    p.attack = { move: command.move, targetId: victim.id, t: 0, hit: false, start: p.x, end: clamp(victim.x - face * 83, ARENA.left, ARENA.right), air: victim.z > 28 };
    p.pose = command.move; p.poseTime = 0; p.poseDuration = move.duration;
    p.invulnerable = Math.max(p.invulnerable, .12);
  }

  resolveHit(attack) {
    const victim = this.enemies.find(e => e.id === attack.targetId && e.hp > 0);
    if (!victim || Math.abs(victim.x - this.player.x) > 185) { this.emit('whiff'); return; }
    const move = MOVES[attack.move];
    const guarded = victim.kind === 'brute' && victim.z < 5 && attack.move === 'jab' && victim.state !== 'recover';
    const air = victim.z > 28;
    let damage = guarded ? 5 : move.damage;
    if (attack.move === 'jab' && air) damage += 7;
    victim.hp -= damage;
    victim.state = 'stunned';
    victim.timer = guarded ? .16 : move.stun;
    victim.flash = .13;
    victim.vx = this.player.face * move.knock * 4;
    if (attack.move === 'launch') { victim.vz = 580; victim.z = Math.max(6, victim.z); victim.timer = .65; }
    else if (attack.move === 'slam') { victim.vz = -1150; victim.slammed = true; }
    else if (air) victim.vz = Math.max(victim.vz, 245);
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    this.comboTime = 6;
    const varied = this.lastMove !== attack.move;
    this.style = clamp(this.style + (varied ? 10 : 4) + (air ? 5 : 0), 0, 100);
    this.score += Math.round((damage * 10 + (air ? 100 : 0) + (varied ? 80 : 0)) * (1 + Math.min(this.combo, 30) * .06));
    this.lastMove = attack.move;
    this.usedMoves.add(attack.move);
    this.hitstop = attack.move === 'heavy' || attack.move === 'slam' ? .055 : .025;
    const label = guarded ? 'GUARDED' : attack.move === 'slam' ? 'FULL STOP!' : attack.move === 'launch' ? 'SKYWARD!' : air ? 'AIR STRING' : attack.move === 'heavy' ? 'BREAKER!' : this.combo % 3 === 0 ? 'RUSH!' : '';
    this.emit('hit', { x: victim.x, z: victim.z + 90, move: attack.move, label, guarded, air });
    this.advanceLesson(attack.move);
    if (victim.hp <= 0) {
      victim.hp = 0; victim.state = 'dead'; victim.timer = .65;
      victim.vx = this.player.face * 340;
      victim.vz = Math.max(victim.vz, 230);
      this.kills++;
      this.score += 300;
      this.emit('kill', { x: victim.x, z: victim.z + 65, kind: victim.kind });
      this.targetId = null;
      this.chooseTarget();
    }
  }

  advanceLesson(action) {
    if (this.mode === 'training' && TUTORIAL[this.lesson]?.action === action) {
      this.lesson++;
      this.emit('lesson', { lesson: this.lesson });
    }
  }

  spawnEnemy(kind = 'doodle', forcedX) {
    const spec = ENEMY_TYPES[kind];
    const x = forcedX ?? (this.random() > .5 ? ARENA.right - 20 : ARENA.left + 20);
    const hp = this.mode === 'training' ? 9999 : spec.hp + Math.max(0, this.wave - 3) * 4;
    const enemy = { id: ++this.nextId, kind, x, z: 0, vx: 0, vz: 0, hp, maxHp: hp, face: x > this.player.x ? -1 : 1, state: 'approach', timer: 0, flash: 0, phase: this.random() * 6.28, age: 0, slammed: false };
    this.enemies.push(enemy);
    this.chooseTarget();
    this.emit('spawn', { x });
    return enemy;
  }

  beginWave() {
    if (this.mode === 'training') {
      this.spawnEnemy('doodle', 795);
      this.emit('wave', { title: 'THE DOJO', sub: 'No pressure. Just expression.' });
      return;
    }
    this.wave++;
    this.stage = (this.startStage + Math.floor((this.wave - 1) / 3)) % 3;
    this.toSpawn = 2 + Math.min(4, this.wave);
    this.spawnTime = .9;
    this.player.hp = Math.min(100, this.player.hp + (this.wave === 1 ? 0 : 15));
    this.player.stamina = 100;
    this.emit('wave', { title: `WAVE ${this.wave.toString().padStart(2, '0')}`, sub: this.wave % 3 === 0 ? 'Heavy company. Break their guard.' : 'Make every word count.' });
    this.spawnEnemy(this.wave % 3 === 0 ? 'brute' : 'doodle', clamp(this.player.x + 260, 180, 1240));
    this.toSpawn--;
  }

  damagePlayer(enemy) {
    const p = this.player;
    if (p.invulnerable > 0 || this.mode === 'training') return;
    const damage = ENEMY_TYPES[enemy.kind].damage * DIFFICULTIES[this.difficulty].damage;
    if (p.guard && p.stamina >= 16) {
      p.stamina = Math.max(0, p.stamina - 16);
      p.invulnerable = .12;
      this.style = Math.min(100, this.style + 2);
      this.emit('block', { x: p.x, z: 80 });
      return;
    }
    p.hp = Math.max(0, p.hp - damage);
    p.hurt = .32;
    p.invulnerable = .8;
    p.attack = null;
    p.pose = 'hurt'; p.poseTime = 0; p.poseDuration = .32;
    p.x = clamp(p.x + Math.sign(p.x - enemy.x) * 35, ARENA.left, ARENA.right);
    this.combo = 0;
    this.style = Math.max(0, this.style - 22);
    this.queue = [];
    this.emit('hurt', { x: p.x, z: 85 });
    if (p.hp <= 0) this.finish('defeat');
  }

  pause() {
    if (this.status !== 'playing') return;
    this.status = 'paused';
    this.input = { left: false, right: false, guard: false };
    this.player.guard = false;
  }
  resume() { if (this.status === 'paused') this.status = 'playing'; }
  finish(reason) {
    if (this.status !== 'playing') return;
    this.status = 'finished';
    this.input = { left: false, right: false, guard: false };
    this.emit('finish', { reason, score: this.score, combo: this.bestCombo, accuracy: this.accuracy, wpm: this.wpm, kills: this.kills, wave: this.wave, mode: this.mode, difficulty: this.difficulty, duration: this.elapsed });
  }

  step(dt) {
    if (this.status !== 'playing') return;
    // Session time continues through impact freezes; combat animation does not.
    this.elapsed += dt;
    if (this.mode === 'time') {
      this.remaining = down(this.remaining, dt);
      if (!this.remaining) { this.finish('time'); return; }
    }
    this.error = down(this.error, dt);
    this.tipTime = down(this.tipTime, dt);
    if (this.hitstop > 0) { this.hitstop = down(this.hitstop, dt); return; }
    this.comboTime = down(this.comboTime, dt);
    if (!this.comboTime) this.combo = 0;
    this.style = Math.max(0, this.style - dt * (this.comboTime ? 1.1 : 3));
    const p = this.player;
    p.invulnerable = down(p.invulnerable, dt);
    p.hurt = down(p.hurt, dt);
    p.dodgeCooldown = down(p.dodgeCooldown, dt);
    p.poseTime += dt;
    p.guard = this.input.guard && p.stamina > 1 && !p.attack && !p.dodge && !p.hurt;
    p.stamina = clamp(p.stamina + dt * (p.guard ? -6 : 22), 0, 100);
    if (p.dodge > 0) {
      p.x = clamp(p.x + p.dodgeDirection * dt * 690, ARENA.left, ARENA.right);
      p.dodge = down(p.dodge, dt);
    } else if (p.attack) {
      const attack = p.attack;
      attack.t += dt;
      const spec = MOVES[attack.move];
      const ratio = clamp(attack.t / (spec.duration * .4), 0, 1);
      p.x = attack.start + (attack.end - attack.start) * (1 - (1 - ratio) ** 3);
      const target = this.enemies.find(e => e.id === attack.targetId);
      p.z = attack.air && target ? Math.max(0, target.z * Math.sin(clamp(attack.t / spec.duration, 0, 1) * Math.PI)) : 0;
      if (!attack.hit && attack.t >= spec.duration * .38) { attack.hit = true; this.resolveHit(attack); }
      if (attack.t >= spec.duration) { p.attack = null; p.z = 0; }
    } else if (!p.hurt) {
      const dir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
      p.x = clamp(p.x + dir * dt * (p.guard ? 95 : 290), ARENA.left, ARENA.right);
      p.pose = p.guard ? 'guard' : dir ? 'run' : 'idle';
      if (dir) p.face = dir;
      else if (this.target) p.face = Math.sign(this.target.x - p.x) || p.face;
      p.z = 0;
    }
    this.tryAttack();
    const difficulty = DIFFICULTIES[this.difficulty];
    for (const e of this.enemies) {
      e.age += dt;
      e.flash = down(e.flash, dt);
      e.x = clamp(e.x + e.vx * dt, ARENA.left, ARENA.right);
      e.vx *= Math.exp(-8 * dt);
      if (e.z > 0 || e.vz > 0) {
        e.z = Math.max(0, e.z + e.vz * dt);
        // Generous hangtime lets a human select and type an air follow-up.
        e.vz -= (this.mode === 'training' ? 210 : 350) * dt;
        if (e.z === 0) {
          if (e.slammed) { this.emit('land', { x: e.x, z: 0 }); e.slammed = false; this.hitstop = .065; }
          e.vz = 0;
        }
      }
      if (e.state === 'dead') { e.timer -= dt; continue; }
      e.face = Math.sign(p.x - e.x) || e.face;
      if (e.z > 0) continue;
      if (e.state === 'stunned' || e.state === 'recover') {
        e.timer -= dt;
        if (e.timer <= 0) e.state = 'approach';
        continue;
      }
      if (this.mode === 'training') continue;
      const spec = ENEMY_TYPES[e.kind];
      const distance = Math.abs(e.x - p.x);
      if (e.state === 'telegraph') {
        e.timer -= dt;
        if (e.timer <= 0) {
          e.state = 'strike'; e.timer = .18;
          this.emit('enemySwing', { x: e.x });
          if (distance < spec.reach + 22) this.damagePlayer(e);
        }
      } else if (e.state === 'strike') {
        e.timer -= dt;
        if (e.timer <= 0) { e.state = 'recover'; e.timer = 1.0 + this.random() * .5; }
      } else if (distance < spec.reach) {
        // One windup at a time keeps attacks readable instead of dogpiling.
        if (!this.enemies.some(other => other !== e && ['telegraph', 'strike'].includes(other.state))) {
          e.state = 'telegraph'; e.timer = spec.tell * difficulty.tell;
          this.emit('warning', { x: e.x });
        }
      } else e.x += e.face * spec.speed * difficulty.speed * dt;
    }
    this.enemies = this.enemies.filter(e => e.state !== 'dead' || e.timer > 0);
    this.chooseTarget();
    if (this.mode === 'training') {
      const dummy = this.enemies[0];
      if (dummy) dummy.hp = dummy.maxHp;
      return;
    }
    if (this.toSpawn > 0) {
      this.spawnTime -= dt;
      if (this.spawnTime <= 0 && this.enemies.filter(e => e.hp > 0).length < 3) {
        this.spawnEnemy(this.wave >= 3 && this.toSpawn === 1 ? 'brute' : this.wave >= 2 && this.random() > .45 ? 'runner' : 'doodle');
        this.toSpawn--; this.spawnTime = 1.7;
      }
    }
    if (!this.toSpawn && !this.enemies.length) {
      if (!this.waveWait) { this.waveWait = 2.5; this.emit('clear', { wave: this.wave }); }
      else {
        this.waveWait -= dt;
        if (this.waveWait <= 0) {
          this.waveWait = 0;
          if (this.mode === 'arcade' && this.wave >= 9) this.finish('victory');
          else this.beginWave();
        }
      }
    }
  }
}
