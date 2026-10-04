import { Game, STEP } from './src/engine.js';
import { MOVES, STAGES, TUTORIAL } from './src/content.js';
import { Renderer } from './src/renderer.js';
import { Audio } from './src/audio.js';

const $ = id => document.getElementById(id);
const canvas = $('game');
const viewport = $('viewport');
const game = new Game(20260321);
const renderer = new Renderer(canvas);
const audio = new Audio();
const state = { mode: 'arcade', stage: 0, difficulty: localStorage.getItem('paper-fury-difficulty') || 'normal', sound: localStorage.getItem('paper-fury-sound') !== 'off', reducedMotion: localStorage.getItem('paper-fury-motion') === 'reduced', recordMode: 'arcade', bannerTimer: 0, messageTimer: 0, copiedTimer: 0 };
renderer.reducedMotion = state.reducedMotion;
audio.enabled = state.sound;

const views = { menu: $('menu-screen'), hud: $('game-hud'), dock: $('prompt-dock'), pause: $('pause-dialog'), settings: $('settings-dialog'), help: $('help-dialog'), results: $('results-dialog'), records: $('records-dialog'), training: $('training-note'), pauseButton: $('pause-button'), touch: $('touch-controls'), loading: $('loading-screen') };
const stageNames = ['HILLSIDE', 'DESKSPACE', 'AFTERHOURS'];
const keyToMove = { '1': 'jab', '2': 'heavy', '3': 'launch', '4': 'slam' };
let last = performance.now(), accumulator = 0, raf = 0;

function setSoundButton() { $('sound-button').classList.toggle('muted', !state.sound); $('sound-button').setAttribute('aria-label', state.sound ? 'Mute sound' : 'Enable sound'); }
function openDialog(dialog) { if (!dialog.open) dialog.showModal(); }
function closeDialog(dialog) { if (dialog.open) dialog.close(); }
function announce(text) { $('announcer').textContent = text; }
function setFooter(text) { $('footer-status').textContent = text; }
function formatScore(value) { return String(Math.max(0, value | 0)).padStart(6, '0'); }
function records() { try { return JSON.parse(localStorage.getItem('paper-fury-records') || '[]'); } catch { return []; } }
function saveRecord(result) {
  const list = records(); list.push({ ...result, at: Date.now() });
  list.sort((a, b) => b.score - a.score);
  localStorage.setItem('paper-fury-records', JSON.stringify(list.slice(0, 50)));
}
function topRecord(mode) { return records().filter(record => record.mode === mode).sort((a, b) => b.score - a.score)[0]; }

function showMenu() {
  game.status = 'menu';
  closeDialog(views.pause); closeDialog(views.results); closeDialog(views.help); closeDialog(views.settings);
  views.menu.classList.remove('hidden'); views.hud.classList.add('hidden'); views.dock.classList.add('hidden'); views.training.classList.add('hidden'); views.pauseButton.classList.add('hidden'); views.touch.classList.add('hidden');
  $('window-file').textContent = STAGES[state.stage].file; setFooter('READY WHEN YOU ARE'); renderer.reset();
  document.body.classList.remove('playing');
  renderer.render(game, state.stage);
}

function start(mode = 'arcade') {
  audio.unlock();
  state.mode = mode; game.start({ mode, difficulty: state.difficulty, stage: state.stage });
  views.menu.classList.add('hidden'); views.hud.classList.remove('hidden'); views.dock.classList.remove('hidden'); views.pauseButton.classList.remove('hidden');
  views.training.classList.toggle('hidden', mode !== 'training'); views.touch.classList.toggle('hidden', !('ontouchstart' in window || navigator.maxTouchPoints));
  $('window-file').textContent = STAGES[state.stage].file; document.body.classList.add('playing'); canvas.focus(); renderer.reset();
  setFooter(mode === 'training' ? 'THE DOJO IS OPEN' : mode === 'time' ? 'RUSH MODE · 90 SECONDS' : 'RUNNING · YOUR WORDS ARE YOUR WEAPONS');
  updateUI(); announce(mode === 'training' ? 'Training started. Type the displayed word to attack.' : 'Arcade run started. Type the displayed word to attack.');
}

function updateWord() {
  const word = $('word'); word.innerHTML = '';
  [...game.word].forEach((char, index) => { const span = document.createElement('span'); span.textContent = char; span.className = index < game.progress ? 'typed' : index === game.progress ? 'current' : ''; word.appendChild(span); });
  $('prompt-action').textContent = MOVES[game.move].name.toUpperCase(); $('target-name').textContent = game.target ? (game.target.kind === 'brute' ? 'BLOCKHEAD' : game.target.kind === 'runner' ? 'SKITTER' : 'DOODLE') : 'LOOKING';
  $('buffer-label').textContent = game.player.attack ? `${game.queue.length} BUFFERED` : game.player.guard ? 'GUARDING' : 'TYPE TO ATTACK';
  $('wpm').innerHTML = `${game.wpm} <small>WPM</small>`; $('accuracy').textContent = `${game.accuracy}% ACCURACY`;
  views.dock.classList.toggle('error', game.error > 0);
}
function updateUI() {
  if (!['playing', 'paused'].includes(game.status)) return;
  const p = game.player;
  $('health-fill').style.width = `${p.hp}%`; $('health-bar').setAttribute('aria-valuenow', String(Math.round(p.hp))); $('health-text').textContent = Math.ceil(p.hp);
  $('stamina-fill').style.width = `${p.stamina}%`; $('score').textContent = formatScore(game.score); $('style-fill').style.width = `${game.style}%`; $('style-rank').textContent = game.rank; $('style-rank').dataset.rank = game.rank;
  $('run-label').textContent = game.mode === 'training' ? `THE DOJO / ${String(game.lesson + 1).padStart(2, '0')}` : `${stageNames[game.stage]} / WAVE ${String(game.wave).padStart(2, '0')}`;
  $('run-value').textContent = game.mode === 'time' ? `${Math.ceil(game.remaining)} SECONDS` : game.mode === 'training' ? 'FREE PRACTICE' : game.wave >= 9 ? 'FINAL SCENE' : 'MAKE A SCENE';
  $('run-detail').textContent = game.mode === 'training' ? 'No damage. No timer. Find your flow.' : game.mode === 'time' ? 'How much style can you fit in?' : `${Math.max(0, 9 - game.wave)} waves remain. Keep moving.`;
  $('combo-label').textContent = game.combo > 1 ? `${game.combo} HIT FLOW · ${game.rank} STYLE` : game.style > 0 ? 'KEEP IT INTERESTING' : 'FIND YOUR FLOW';
  updateWord();
  if (game.mode === 'training') updateLesson();
}
function updateLesson() {
  const lesson = TUTORIAL[Math.min(game.lesson, TUTORIAL.length - 1)];
  $('lesson-count').textContent = `THE DOJO / ${String(Math.min(game.lesson + 1, TUTORIAL.length)).padStart(2, '0')}`; $('lesson-title').textContent = lesson.title; $('lesson-body').textContent = lesson.body; $('lesson-goal').textContent = game.lesson >= TUTORIAL.length - 1 ? 'FREE PLAY · TRY EVERYTHING' : `NEXT: ${lesson.goal.toUpperCase()}`;
}
function showBanner(title, subtitle) {
  $('banner-title').textContent = title; $('banner-subtitle').textContent = subtitle; $('wave-banner').classList.add('visible'); state.bannerTimer = 2.35;
}
function showMessage(text, duration = 1.6) { $('combat-message').textContent = text; $('combat-message').classList.add('visible'); state.messageTimer = duration; }

function handleEvents() {
  for (const event of game.drainEvents()) {
    audio.play(event); renderer.onEvent(event);
    if (event.type === 'wave') showBanner(event.title, event.sub);
    if (event.type === 'hit' && event.label) showMessage(event.label, .72);
    if (event.type === 'invalid' || event.type === 'whiff') showMessage(game.tip || 'MOVE CLOSER', 1.2);
    if (event.type === 'typo') { showMessage('WRONG WORD · STAY SHARP', .55); announce('Wrong letter.'); }
    if (event.type === 'warning') showMessage('INCOMING · DODGE OR GUARD', .75);
    if (event.type === 'clear') showMessage(`WAVE ${event.wave} CLEARED · KEEP GOING`, 2);
    if (event.type === 'lesson') { showMessage(game.lesson >= TUTORIAL.length - 1 ? 'FREE PLAY UNLOCKED' : 'LESSON COMPLETE', 1.4); updateLesson(); }
    if (event.type === 'finish') finishRun(event);
  }
}
function finishRun(result) {
  if (result.reason !== 'defeat') audio.play({ type: 'finish' });
  saveRecord(result); $('result-eyebrow').textContent = result.reason === 'defeat' ? 'THE PAPER FOUGHT BACK.' : result.reason === 'time' ? 'TIME. WELL SPENT.' : 'THAT’S A WRAP.'; $('result-title').innerHTML = result.reason === 'defeat' ? 'TRY<br><em>AGAIN.</em>' : result.reason === 'victory' ? 'WORLD<br><em>CONQUERED.</em>' : 'WELL<br><em>PLAYED.</em>';
  $('result-score').textContent = formatScore(result.score); $('result-combo').textContent = result.combo; $('result-accuracy').textContent = `${result.accuracy}%`; $('result-kills').textContent = result.kills;
  const best = topRecord(result.mode); $('result-best').textContent = best?.score === result.score ? 'NEW PERSONAL BEST · saved locally' : `BEST HERE: ${formatScore(best?.score || 0)}`;
  openDialog(views.results); views.hud.classList.add('hidden'); views.dock.classList.add('hidden'); views.pauseButton.classList.add('hidden'); views.training.classList.add('hidden'); views.touch.classList.add('hidden'); setFooter('RUN COMPLETE · THE RECEIPTS ARE IN'); announce(`Run complete. Score ${result.score}.`);
}

function stepFrame(now) {
  const dt = Math.min(.1, (now - last) / 1000); last = now;
  if (game.status === 'playing') { accumulator += dt; while (accumulator >= STEP) { game.step(STEP); accumulator -= STEP; } }
  renderer.update(dt); handleEvents();
  if (state.bannerTimer > 0) { state.bannerTimer -= dt; if (state.bannerTimer <= 0) $('wave-banner').classList.remove('visible'); }
  if (state.messageTimer > 0) { state.messageTimer -= dt; if (state.messageTimer <= 0) $('combat-message').classList.remove('visible'); }
  updateUI(); renderer.render(game, state.stage); raf = requestAnimationFrame(stepFrame);
}

function setStage(stage) { state.stage = stage; document.querySelectorAll('.stage-option').forEach(button => { const selected = Number(button.dataset.stage) === stage; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); }); $('window-file').textContent = STAGES[stage].file; renderer.render(game, state.stage); }
function setMove(move) { game.selectMove(move); document.querySelectorAll('.move').forEach(button => { const selected = button.dataset.move === game.move; button.classList.toggle('selected', selected); button.setAttribute('aria-pressed', String(selected)); }); updateUI(); }
function pause() { if (game.status === 'playing') { game.pause(); openDialog(views.pause); setFooter('PAUSED · THE PAPER CAN WAIT'); } }
function resume() { game.resume(); closeDialog(views.pause); canvas.focus(); setFooter(game.mode === 'training' ? 'THE DOJO IS OPEN' : 'RUNNING · YOUR WORDS ARE YOUR WEAPONS'); }
function populateRecords() { const list = $('record-list'); const rows = records().filter(record => record.mode === state.recordMode).sort((a, b) => b.score - a.score).slice(0, 10); list.innerHTML = rows.length ? rows.map((row, i) => `<li><span><strong>${String(i + 1).padStart(2, '0')}</strong><small>${new Date(row.at).toLocaleDateString()} · ${row.difficulty} · ${row.accuracy}% accuracy</small></span><strong>${formatScore(row.score)}</strong></li>`).join('') : '<li class="empty-record">No receipts yet.<br>Make a scene and put your name on the wall.</li>'; }
function toggleSound() { state.sound = !state.sound; audio.enabled = state.sound; localStorage.setItem('paper-fury-sound', state.sound ? 'on' : 'off'); if (state.sound) audio.unlock(); setSoundButton(); }

document.querySelectorAll('.stage-option').forEach(button => button.addEventListener('click', () => setStage(Number(button.dataset.stage))));
document.querySelectorAll('.move').forEach(button => button.addEventListener('click', () => { audio.unlock(); setMove(button.dataset.move); }));
$('play-button').addEventListener('click', () => start('arcade')); $('training-button').addEventListener('click', () => start('training')); $('time-button').addEventListener('click', () => start('time'));
$('sound-button').addEventListener('click', toggleSound); $('pause-button').addEventListener('click', pause); $('resume-button').addEventListener('click', resume); $('restart-button').addEventListener('click', () => { closeDialog(views.pause); start(game.mode); }); $('menu-button').addEventListener('click', showMenu);
$('help-button').addEventListener('click', () => openDialog(views.help)); $('settings-button').addEventListener('click', () => openDialog(views.settings)); $('records-button').addEventListener('click', () => { populateRecords(); openDialog(views.records); });
$('fullscreen-button').addEventListener('click', () => { const windowEl = document.querySelector('.game-window'); if (!document.fullscreenElement) windowEl.requestFullscreen?.(); else document.exitFullscreen?.(); });
$('volume').addEventListener('input', event => { audio.setVolume(Number(event.target.value) / 100); }); $('difficulty').value = state.difficulty; $('difficulty').addEventListener('change', event => { state.difficulty = event.target.value; localStorage.setItem('paper-fury-difficulty', state.difficulty); }); $('reduced-motion').checked = state.reducedMotion; $('reduced-motion').addEventListener('change', event => { state.reducedMotion = event.target.checked; renderer.reducedMotion = state.reducedMotion; localStorage.setItem('paper-fury-motion', state.reducedMotion ? 'reduced' : 'full'); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => closeDialog($(button.dataset.close))));
$('help-training').addEventListener('click', () => { closeDialog(views.help); start('training'); }); $('again-button').addEventListener('click', () => { closeDialog(views.results); start(game.mode); }); $('result-menu-button').addEventListener('click', showMenu);
$('share-button').addEventListener('click', async () => { const text = `I scored ${formatScore(game.score)} in Paper Fury. ${game.bestCombo} hit combo, ${game.accuracy}% accuracy.`; try { await navigator.clipboard.writeText(text); $('share-button').textContent = 'Copied to clipboard'; setTimeout(() => $('share-button').textContent = 'Copy result', 1300); } catch { window.prompt('Copy your result:', text); } });
document.querySelectorAll('[data-record-mode]').forEach(button => button.addEventListener('click', () => { state.recordMode = button.dataset.recordMode; document.querySelectorAll('[data-record-mode]').forEach(other => { const selected = other === button; other.classList.toggle('selected', selected); other.setAttribute('aria-pressed', String(selected)); }); populateRecords(); }));
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && game.status === 'menu' && !views.help.open && !views.settings.open && !views.records.open) { event.preventDefault(); start('arcade'); return; }
  if (event.key === 'Escape') { if (game.status === 'playing') { event.preventDefault(); pause(); } else if (game.status === 'paused') { resume(); } return; }
  if (game.status !== 'playing' || views.settings.open || views.help.open || views.records.open || views.results.open) return;
  if (event.key === 'Tab') { event.preventDefault(); game.cycleTarget(); return; }
  if (event.key === ' ') { event.preventDefault(); game.dodge(); return; }
  if (event.key === 'Shift') { event.preventDefault(); game.input.guard = true; return; }
  if (keyToMove[event.key]) { event.preventDefault(); setMove(keyToMove[event.key]); return; }
  if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); game.input[event.key === 'ArrowLeft' ? 'left' : 'right'] = true; return; }
  if (/^[a-z]$/i.test(event.key)) { event.preventDefault(); game.type(event.key); }
});
document.addEventListener('keyup', event => { if (event.key === 'Shift') game.input.guard = false; if (event.key === 'ArrowLeft') game.input.left = false; if (event.key === 'ArrowRight') game.input.right = false; });
document.querySelectorAll('[data-hold]').forEach(button => { const key = button.dataset.hold; const down = event => { event.preventDefault(); game.input[key] = true; }; const up = event => { event.preventDefault(); game.input[key] = false; }; button.addEventListener('pointerdown', down); button.addEventListener('pointerup', up); button.addEventListener('pointercancel', up); button.addEventListener('pointerleave', up); });
$('touch-dodge').addEventListener('pointerdown', event => { event.preventDefault(); game.dodge(); }); $('touch-target').addEventListener('pointerdown', event => { event.preventDefault(); game.cycleTarget(); }); $('touch-type').addEventListener('input', event => { const input = event.target; const latest = input.value.slice(-1); if (/^[a-z]$/i.test(latest)) game.type(latest); input.value = ''; });
window.addEventListener('resize', () => renderer.resize()); window.addEventListener('blur', () => { game.input.left = false; game.input.right = false; game.input.guard = false; if (game.status === 'playing') pause(); });
setSoundButton(); $('volume').value = String(Math.round(audio.volume * 100)); setStage(0); showMenu();
setTimeout(() => { views.loading.classList.add('hidden'); canvas.focus(); }, 450);
raf = requestAnimationFrame(stepFrame);
