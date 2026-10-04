import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, STEP } from '../src/engine.js';

function typeCurrentWord(game) {
  for (const character of game.word) game.type(character);
}
function advance(game, seconds) {
  for (let time = 0; time < seconds; time += STEP) game.step(Math.min(STEP, seconds - time));
}

test('a completed word becomes an attack and damages a target', () => {
  const game = new Game(10); game.start({ mode: 'training' });
  typeCurrentWord(game); advance(game, .5);
  assert.equal(game.combo, 1);
  assert.ok(game.correct > 0);
  const hit = game.drainEvents().find(event => event.type === 'hit');
  assert.ok(hit, 'the completed word should produce a hit event');
  assert.equal(hit.move, 'jab');
});

test('wrong letters do not advance the word and reduce style', () => {
  const game = new Game(11); game.start({ mode: 'training' });
  const word = game.word; game.style = 20;
  game.type(word[0] === 'a' ? 'z' : 'a');
  assert.equal(game.progress, 0);
  assert.equal(game.wrong, 1);
  assert.equal(game.style, 17);
});

test('launch creates an aerial target and full stop requires air', () => {
  const game = new Game(12); game.start({ mode: 'training' });
  game.selectMove('launch'); typeCurrentWord(game); advance(game, .25);
  assert.ok(game.target.z > 28, `expected target to be airborne, got ${game.target.z}`);
  game.selectMove('slam'); typeCurrentWord(game); advance(game, .75);
  assert.ok(game.combo >= 2);
  assert.ok(game.drainEvents().some(event => event.type === 'hit' && event.move === 'slam'));
});

test('dodge spends stamina and grants a short invulnerability window', () => {
  const game = new Game(13); game.start({ mode: 'training' });
  const before = game.player.stamina; game.input.right = true;
  assert.equal(game.dodge(), true);
  assert.ok(game.player.stamina < before);
  assert.ok(game.player.invulnerable > 0);
  assert.equal(game.player.pose, 'dodge');
});

test('guard blocks a nearby enemy attack without damaging the player', () => {
  const game = new Game(14); game.start({ mode: 'arcade', difficulty: 'normal' });
  const enemy = game.target; enemy.x = game.player.x + 60; enemy.state = 'telegraph'; enemy.timer = .01;
  const before = game.player.hp; game.input.guard = true; advance(game, .03);
  assert.equal(game.player.hp, before);
  assert.ok(game.drainEvents().some(event => event.type === 'block'));
});

test('the timed mode ends at zero seconds', () => {
  const game = new Game(15); game.start({ mode: 'time' });
  advance(game, 90.1);
  assert.equal(game.status, 'finished');
  assert.equal(game.drainEvents().at(-1).type, 'finish');
});

test('custom timed matches use their requested duration', () => {
  const game = new Game(16); game.start({ mode: 'time', duration: 15 });
  advance(game, 15.1);
  const finish = game.drainEvents().find(event => event.type === 'finish');
  assert.equal(game.status, 'finished');
  assert.equal(finish.reason, 'time');
  assert.ok(finish.duration >= 15);
});

test('word bags avoid repeats until the move vocabulary is exhausted', () => {
  const game = new Game(17); game.start({ mode: 'training' });
  const words = [game.word];
  for (let i = 1; i < 18; i++) { game.nextWord(); words.push(game.word); }
  assert.equal(new Set(words).size, words.length);
});

test('arcade intensity increases by level every three waves', () => {
  const game = new Game(18); game.start({ mode: 'arcade' });
  assert.equal(game.level, 1);
  game.enemies = []; game.toSpawn = 0; game.waveWait = 0; game.wave = 3;
  game.beginWave();
  assert.equal(game.level, 2);
  assert.ok(game.toSpawn > 5);
});
