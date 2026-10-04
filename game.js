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
const state = { mode: 'arcade', stage: 0, difficulty: localStorage.getItem('paper-fury-difficulty') || 'normal', sound: localStorage.getItem('paper-fury-sound') !== 'off', reducedMotion: localStorage.getItem('paper-fury-motion') === 'reduced', theme: localStorage.getItem('paper-fury-theme') || 'dark', recordMode: 'arcade', bannerTimer: 0, messageTimer: 0, copiedTimer: 0 };
renderer.reducedMotion = state.reducedMotion;
audio.enabled = state.sound;

const views = { menu: $('menu-screen'), hud: $('game-hud'), dock: $('prompt-dock'), pause: $('pause-dialog'), settings: $('settings-dialog'), help: $('help-dialog'), results: $('results-dialog'), records: $('records-dialog'), contest: $('contest-dialog'), pass: $('pass-dialog'), online: $('online-dialog'), training: $('training-note'), pauseButton: $('pause-button'), touch: $('touch-controls'), loading: $('loading-screen') };
const stageNames = ['HILLSIDE', 'DESKSPACE', 'AFTERHOURS'];
const keyToMove = { '1': 'jab', '2': 'heavy', '3': 'launch', '4': 'slam' };
const competition = { kind: null, players: [], turn: 0, results: [], duration: 45, seed: 20260321 };
const net = { peer: null, conn: null, role: null, code: '', timer: null, waitTimer: null, startTimer: null, rival: null, done: null };
let last = performance.now(), accumulator = 0, raf = 0;

function setSoundButton() { $('sound-button').classList.toggle('muted', !state.sound); $('sound-button').setAttribute('aria-label', state.sound ? 'Mute sound' : 'Enable sound'); }
function setThemeButton() { const light = state.theme === 'light'; document.documentElement.dataset.theme = state.theme; document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#edf2e7' : '#202b28'); $('theme-button').textContent = light ? '☾' : '☼'; $('theme-button').setAttribute('aria-label', light ? 'Switch to dark theme' : 'Switch to light theme'); $('theme-button').title = light ? 'Switch to dark theme' : 'Switch to light theme'; }
function toggleTheme() { state.theme = state.theme === 'light' ? 'dark' : 'light'; localStorage.setItem('paper-fury-theme', state.theme); setThemeButton(); }
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
  stopOnline();
  competition.kind = null; competition.players = []; competition.results = []; competition.turn = 0;
  game.status = 'menu';
  closeDialog(views.pause); closeDialog(views.results); closeDialog(views.help); closeDialog(views.settings); closeDialog(views.contest); closeDialog(views.pass); closeDialog(views.online);
  views.menu.classList.remove('hidden'); views.hud.classList.add('hidden'); views.dock.classList.add('hidden'); views.training.classList.add('hidden'); views.pauseButton.classList.add('hidden'); views.touch.classList.add('hidden');
  $('window-file').textContent = STAGES[state.stage].file; setFooter('READY WHEN YOU ARE'); renderer.reset();
  document.body.classList.remove('playing');
  renderer.render(game, state.stage);
}

function start(mode = 'arcade', options = {}) {
  audio.unlock();
  const engineMode = ['contest', 'online'].includes(mode) ? 'time' : mode;
  const duration = options.duration ?? (['contest', 'online'].includes(mode) ? competition.duration : 90);
  const seed = options.seed ?? (mode === 'contest' ? (competition.seed + competition.turn) >>> 0 : null);
  state.mode = mode; game.start({ mode: engineMode, difficulty: state.difficulty, stage: state.stage, duration, seed });
  views.menu.classList.add('hidden'); views.hud.classList.remove('hidden'); views.dock.classList.remove('hidden'); views.pauseButton.classList.remove('hidden');
  views.training.classList.toggle('hidden', mode !== 'training'); views.touch.classList.toggle('hidden', !('ontouchstart' in window || navigator.maxTouchPoints));
  $('window-file').textContent = STAGES[state.stage].file; document.body.classList.add('playing'); canvas.focus(); renderer.reset();
  setFooter(mode === 'training' ? 'THE DOJO IS OPEN' : mode === 'time' ? 'RUSH MODE · 90 SECONDS' : mode === 'contest' ? `LOCAL DUEL · ${competition.players[competition.turn]}` : mode === 'online' ? 'ONLINE ROOM · LIVE RACE' : 'RUNNING · YOUR WORDS ARE YOUR WEAPONS');
  updateUI(); announce(mode === 'training' ? 'Training started. Type the displayed word to attack.' : mode === 'contest' ? `${competition.players[competition.turn]} turn started.` : mode === 'online' ? 'Online race started. Type the displayed word to attack.' : 'Arcade run started. Type the displayed word to attack.');
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
  $('run-label').textContent = game.mode === 'training' ? `THE DOJO / ${String(game.lesson + 1).padStart(2, '0')}` : `LEVEL ${String(game.level).padStart(2, '0')} · ${stageNames[game.stage]} / WAVE ${String(game.wave).padStart(2, '0')}`;
  $('run-value').textContent = state.mode === 'contest' ? `${competition.players[competition.turn] || 'PLAYER'} · ${Math.ceil(game.remaining)} SEC` : state.mode === 'online' ? `${Math.ceil(game.remaining)} SECONDS` : game.mode === 'time' ? `${Math.ceil(game.remaining)} SECONDS` : game.mode === 'training' ? 'FREE PRACTICE' : game.wave >= 9 ? 'FINAL SCENE' : 'MAKE A SCENE';
  $('run-detail').textContent = game.mode === 'training' ? 'No damage. No timer. Find your flow.' : state.mode === 'contest' ? 'Pass the keyboard when the timer ends.' : state.mode === 'online' ? `Racing ${net.rival?.name || 'an opponent'} · peer match` : game.mode === 'time' ? 'How much style can you fit in?' : `${Math.max(0, 9 - game.wave)} waves remain. Keep moving.`;
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

function hideCombatViews() { views.hud.classList.add('hidden'); views.dock.classList.add('hidden'); views.pauseButton.classList.add('hidden'); views.training.classList.add('hidden'); views.touch.classList.add('hidden'); }
function showLocalPass() {
  $('pass-player').textContent = `${competition.players[1]} · YOUR TURN`;
  closeDialog(views.pause); hideCombatViews(); setFooter('LOCAL DUEL · SWAP SEATS'); openDialog(views.pass);
}
function finishLocalCompetition(result) {
  const player = competition.players[competition.turn];
  competition.results.push({ ...result, mode: 'contest', name: player, turn: competition.turn });
  if (competition.turn === 0) { competition.turn = 1; showLocalPass(); return; }
  const [first, second] = competition.results;
  const winner = first.score === second.score ? null : first.score > second.score ? first : second;
  competition.results.forEach(entry => saveRecord(entry));
  state.recordMode = 'contest';
  const display = winner || second;
  $('result-eyebrow').textContent = winner ? `WINNER · ${winner.name.toUpperCase()}` : 'A PERFECT DRAW.';
  $('result-title').innerHTML = 'MATCH<br><em>COMPLETE.</em>';
  $('result-score').textContent = formatScore(display.score);
  $('result-combo').textContent = display.combo; $('result-accuracy').textContent = `${display.accuracy}%`; $('result-kills').textContent = display.kills;
  $('result-best').textContent = winner ? `${winner.name}: ${formatScore(winner.score)} · ${first.name} ${formatScore(first.score)} / ${second.name} ${formatScore(second.score)}` : `Both players scored ${formatScore(first.score)}`;
  competition.kind = null;
  openDialog(views.results); setFooter('LOCAL MATCH COMPLETE · THE RECEIPTS ARE IN'); announce(winner ? `${winner.name} wins the local match.` : 'The local match is a draw.');
}
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
  if (competition.kind === 'local') { finishLocalCompetition(result); return; }
  if (competition.kind === 'online') { finishOnlineRun(result); return; }
  if (result.reason !== 'defeat') audio.play({ type: 'finish' });
  saveRecord(result); $('result-eyebrow').textContent = result.reason === 'defeat' ? 'THE PAPER FOUGHT BACK.' : result.reason === 'time' ? 'TIME. WELL SPENT.' : 'THAT’S A WRAP.'; $('result-title').innerHTML = result.reason === 'defeat' ? 'TRY<br><em>AGAIN.</em>' : result.reason === 'victory' ? 'WORLD<br><em>CONQUERED.</em>' : 'WELL<br><em>PLAYED.</em>';
  $('result-score').textContent = formatScore(result.score); $('result-combo').textContent = result.combo; $('result-accuracy').textContent = `${result.accuracy}%`; $('result-kills').textContent = result.kills;
  const best = topRecord(result.mode); $('result-best').textContent = best?.score === result.score ? 'NEW PERSONAL BEST · saved locally' : `BEST HERE: ${formatScore(best?.score || 0)}`;
  openDialog(views.results); hideCombatViews(); setFooter('RUN COMPLETE · THE RECEIPTS ARE IN'); announce(`Run complete. Score ${result.score}.`);
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
function pause() { if (game.status === 'playing') { if (state.mode === 'online') { showMessage('ONLINE MATCHES CANNOT PAUSE', 1.4); return; } game.pause(); openDialog(views.pause); setFooter('PAUSED · THE PAPER CAN WAIT'); } }
function resume() { game.resume(); closeDialog(views.pause); canvas.focus(); setFooter(state.mode === 'training' ? 'THE DOJO IS OPEN' : state.mode === 'contest' ? `LOCAL DUEL · ${competition.players[competition.turn]}` : state.mode === 'online' ? 'ONLINE ROOM · LIVE RACE' : 'RUNNING · YOUR WORDS ARE YOUR WEAPONS'); }
function populateRecords() { const list = $('record-list'); const rows = records().filter(record => record.mode === state.recordMode).sort((a, b) => b.score - a.score).slice(0, 10); list.innerHTML = rows.length ? rows.map((row, i) => `<li><span><strong>${String(i + 1).padStart(2, '0')}</strong><small>${row.name ? `${escapeHTML(row.name)} · ` : ''}${new Date(row.at).toLocaleDateString()} · ${escapeHTML(row.difficulty || 'normal')} · ${Number(row.accuracy) || 0}% accuracy</small></span><strong>${formatScore(row.score)}</strong></li>`).join('') : '<li class="empty-record">No receipts yet.<br>Make a scene and put your name on the wall.</li>'; }
function toggleSound() { state.sound = !state.sound; audio.enabled = state.sound; localStorage.setItem('paper-fury-sound', state.sound ? 'on' : 'off'); if (state.sound) audio.unlock(); setSoundButton(); }
function cleanName(value, fallback) { return String(value || '').trim().replace(/[^\w .'-]/g, '').slice(0, 18) || fallback; }
function startLocalMatch() {
  competition.kind = 'local'; competition.players = [cleanName($('contest-p1').value, 'PLAYER ONE'), cleanName($('contest-p2').value, 'PLAYER TWO')]; competition.turn = 0; competition.results = []; competition.duration = 45; competition.seed = (Date.now() ^ 0x50465259) >>> 0;
  closeDialog(views.contest); start('contest', { duration: competition.duration, seed: competition.seed });
}
function continueLocalTurn() { closeDialog(views.pass); start('contest', { duration: competition.duration }); }
function cancelLocalMatch() { closeDialog(views.contest); closeDialog(views.pass); competition.kind = null; showMenu(); }
function escapeHTML(value) { return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[character])); }
let peerLoader;
function onlineStatus(text) { $('online-status').textContent = text; }
function loadPeer() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (peerLoader) return peerLoader;
  peerLoader = new Promise((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'; script.async = true;
    script.onload = () => window.Peer ? resolve(window.Peer) : reject(new Error('PeerJS did not load'));
    script.onerror = () => reject(new Error('PeerJS could not load')); document.head.appendChild(script);
  });
  return peerLoader;
}
function roomCode() { const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({ length: 5 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join(''); }
function sendOnline(message) { try { net.conn?.send({ version: 2, ...message }); } catch { onlineStatus('Connection interrupted. Try the room again.'); } }
function stopOnline() {
  clearInterval(net.timer); clearTimeout(net.waitTimer); clearTimeout(net.startTimer);
  try { net.conn?.close(); net.peer?.destroy(); } catch {}
  net.peer = null; net.conn = null; net.role = null; net.code = ''; net.rival = null; net.done = null;
}
function onlineSnapshot(result) { return { name: net.myName, score: Number(result.score) || 0, combo: Number(result.combo) || 0, accuracy: Number(result.accuracy) || 0, kills: Number(result.kills) || 0, duration: Number(result.duration) || 0 }; }
function validateOnlineSnapshot(snapshot) { return snapshot && typeof snapshot.name === 'string' && Number.isFinite(snapshot.score) && Number.isFinite(snapshot.combo) && Number.isFinite(snapshot.accuracy) && snapshot.score >= 0 && snapshot.score <= 99999999 && snapshot.combo >= 0 && snapshot.accuracy >= 0 && snapshot.accuracy <= 100; }
function scheduleOnlineStart(startAt, seed = competition.seed) {
  clearTimeout(net.startTimer); competition.kind = 'online'; competition.players = [net.myName]; competition.turn = 0; competition.results = []; competition.duration = 45; competition.seed = Number(seed) >>> 0 || 1;
  const delay = Math.max(0, Number(startAt) - Date.now());
  onlineStatus(`Match starts in ${Math.max(1, Math.ceil(delay / 1000))}…`);
  net.startTimer = setTimeout(() => { closeDialog(views.online); start('online', { duration: competition.duration, seed: competition.seed }); net.timer = setInterval(() => sendOnline({ type: 'tick', snapshot: onlineSnapshot({ score: game.score, combo: game.bestCombo, accuracy: game.accuracy, kills: game.kills, duration: game.elapsed }) }), 500); }, delay);
}
function finishOnlineMatch(timeout = false) {
  clearInterval(net.timer); clearTimeout(net.waitTimer);
  const local = net.done || onlineSnapshot({ score: game.score, combo: game.bestCombo, accuracy: game.accuracy, kills: game.kills, duration: game.elapsed });
  const rival = net.rival;
  saveRecord({ ...local, mode: 'online', difficulty: state.difficulty, at: Date.now() });
  state.recordMode = 'online';
  const rivalScore = rival?.score ?? -1;
  const winner = !timeout && rival ? (local.score === rivalScore ? 'DRAW' : local.score > rivalScore ? net.myName : rival.name) : null;
  $('result-eyebrow').textContent = timeout ? 'OPPONENT DISCONNECTED.' : winner === 'DRAW' ? 'A PERFECT DRAW.' : `WINNER · ${winner.toUpperCase()}`;
  $('result-title').innerHTML = timeout ? 'MATCH<br><em>ENDED.</em>' : 'ONLINE<br><em>COMPLETE.</em>';
  $('result-score').textContent = formatScore(local.score); $('result-combo').textContent = local.combo; $('result-accuracy').textContent = `${local.accuracy}%`; $('result-kills').textContent = local.kills;
  $('result-best').textContent = rival ? `${net.myName} ${formatScore(local.score)} · ${rival.name} ${formatScore(rival.score)}` : 'Your result was saved locally.';
  competition.kind = null; hideCombatViews(); openDialog(views.results); setFooter('ONLINE MATCH COMPLETE · THE RECEIPTS ARE IN'); announce(timeout ? 'Online match ended because the opponent disconnected.' : `Online match complete. ${winner === 'DRAW' ? 'It is a draw.' : `${winner} wins.`}`);
}
function finishOnlineRun(result) {
  if (net.done) return;
  clearInterval(net.timer); net.done = onlineSnapshot(result); sendOnline({ type: 'done', snapshot: net.done }); hideCombatViews(); setFooter('ONLINE MATCH · WAITING FOR OPPONENT'); showMessage('RESULT SENT · WAITING FOR OPPONENT', 8);
  if (net.rival) finishOnlineMatch(false); else { clearTimeout(net.waitTimer); net.waitTimer = setTimeout(() => finishOnlineMatch(true), 8000); }
}
function onOnlineData(message) {
  if (!message || message.version !== 2) return;
  if (message.type === 'hello' && net.role === 'host') {
    net.rival = { name: cleanName(message.name, 'RIVAL') }; const startAt = Date.now() + 2400;
    competition.seed = (Date.now() ^ 0x50465552) >>> 0; net.myName = cleanName($('online-name').value, 'YOU'); sendOnline({ type: 'welcome', name: net.myName, rival: net.rival.name, startAt, seed: competition.seed }); scheduleOnlineStart(startAt, competition.seed); onlineStatus('Opponent connected. Get ready…'); return;
  }
  if (message.type === 'welcome' && net.role === 'guest') { net.rival = { name: cleanName(message.name, 'HOST') }; scheduleOnlineStart(message.startAt, Number(message.seed) >>> 0 || 1); return; }
  if (message.type === 'tick' && validateOnlineSnapshot(message.snapshot)) { net.rival = { ...message.snapshot, name: cleanName(message.snapshot.name, 'RIVAL') }; return; }
  if (message.type === 'done' && validateOnlineSnapshot(message.snapshot)) { net.rival = { ...message.snapshot, name: cleanName(message.snapshot.name, 'RIVAL') }; if (net.done) finishOnlineMatch(false); else onlineStatus(`${net.rival.name} finished. Keep going!`); }
}
function wireOnlineConnection(connection) {
  if (net.conn && net.conn !== connection) { connection.close(); return; }
  net.conn = connection; connection.on('open', () => { if (net.role === 'guest') sendOnline({ type: 'hello', name: cleanName($('online-name').value, 'YOU') }); }); connection.on('data', onOnlineData); connection.on('close', () => { if (!net.done && competition.kind === 'online') { onlineStatus('Opponent disconnected.'); game.status = 'finished'; net.done = onlineSnapshot({ score: game.score, combo: game.bestCombo, accuracy: game.accuracy, kills: game.kills, duration: game.elapsed }); finishOnlineMatch(true); } }); connection.on('error', () => onlineStatus('Connection error. Try another room.'));
}
async function createOnlineRoom() {
  try {
    await loadPeer(); stopOnline(); net.role = 'host'; net.code = roomCode(); net.myName = cleanName($('online-name').value, 'YOU'); onlineStatus('Creating room…');
    net.peer = new window.Peer(`paper-fury-v2-${net.code}`); net.peer.on('open', () => { const invite = `${location.origin}${location.pathname}?join=${net.code}`; $('online-code').value = net.code; $('online-copy').classList.remove('hidden'); $('online-copy').onclick = async () => { try { await navigator.clipboard.writeText(invite); onlineStatus('Invite copied. Send it to your opponent.'); } catch { window.prompt('Copy invite link:', invite); } }; onlineStatus(`Room ${net.code} is live. Send the invite and wait.`); }); net.peer.on('connection', wireOnlineConnection); net.peer.on('error', error => onlineStatus(error.type === 'unavailable-id' ? 'Room collision. Create again.' : 'Peer connection error.'));
  } catch { onlineStatus('Online service could not load. Check your connection and try again.'); stopOnline(); }
}
async function joinOnlineRoom() {
  const code = $('online-code').value.trim().toUpperCase(); if (!code) { onlineStatus('Enter a room code first.'); return; }
  try { await loadPeer(); stopOnline(); net.role = 'guest'; net.code = code; net.myName = cleanName($('online-name').value, 'YOU'); onlineStatus('Joining room…'); net.peer = new window.Peer(); net.peer.on('open', () => { wireOnlineConnection(net.peer.connect(`paper-fury-v2-${code}`, { reliable: true })); }); net.peer.on('error', error => onlineStatus(error.type === 'peer-unavailable' ? 'Room not found.' : 'Peer connection error.')); } catch { onlineStatus('Online service could not load. Check your connection and try again.'); stopOnline(); }
}

document.querySelectorAll('.stage-option').forEach(button => button.addEventListener('click', () => setStage(Number(button.dataset.stage))));
document.querySelectorAll('.move').forEach(button => button.addEventListener('click', () => { audio.unlock(); setMove(button.dataset.move); }));
$('play-button').addEventListener('click', () => start('arcade')); $('training-button').addEventListener('click', () => start('training')); $('time-button').addEventListener('click', () => start('time')); $('local-button').addEventListener('click', () => openDialog(views.contest)); $('contest-start').addEventListener('click', startLocalMatch); $('pass-button').addEventListener('click', continueLocalTurn); $('pass-cancel').addEventListener('click', cancelLocalMatch); $('online-button').addEventListener('click', () => openDialog(views.online)); $('online-create').addEventListener('click', createOnlineRoom); $('online-join').addEventListener('click', joinOnlineRoom);
$('sound-button').addEventListener('click', toggleSound); $('theme-button').addEventListener('click', toggleTheme); $('pause-button').addEventListener('click', pause); $('resume-button').addEventListener('click', resume); $('restart-button').addEventListener('click', () => { closeDialog(views.pause); start(state.mode === 'contest' ? 'contest' : game.mode); }); $('menu-button').addEventListener('click', showMenu);
$('help-button').addEventListener('click', () => openDialog(views.help)); $('settings-button').addEventListener('click', () => openDialog(views.settings)); $('records-button').addEventListener('click', () => { populateRecords(); openDialog(views.records); });
$('fullscreen-button').addEventListener('click', () => { const windowEl = document.querySelector('.game-window'); if (!document.fullscreenElement) windowEl.requestFullscreen?.(); else document.exitFullscreen?.(); });
$('volume').addEventListener('input', event => { audio.setVolume(Number(event.target.value) / 100); }); $('difficulty').value = state.difficulty; $('difficulty').addEventListener('change', event => { state.difficulty = event.target.value; localStorage.setItem('paper-fury-difficulty', state.difficulty); }); $('reduced-motion').checked = state.reducedMotion; $('reduced-motion').addEventListener('change', event => { state.reducedMotion = event.target.checked; renderer.reducedMotion = state.reducedMotion; localStorage.setItem('paper-fury-motion', state.reducedMotion ? 'reduced' : 'full'); });
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => { const dialog = $(button.dataset.close); closeDialog(dialog); if (dialog === views.online) stopOnline(); if (dialog === views.contest) competition.kind = null; }));
$('help-training').addEventListener('click', () => { closeDialog(views.help); start('training'); }); $('again-button').addEventListener('click', () => { closeDialog(views.results); if (state.mode === 'contest') openDialog(views.contest); else start(game.mode); }); $('result-menu-button').addEventListener('click', showMenu);
$('share-button').addEventListener('click', async () => { const text = `I scored ${formatScore(game.score)} in Paper Fury. ${game.bestCombo} hit combo, ${game.accuracy}% accuracy.`; try { await navigator.clipboard.writeText(text); $('share-button').textContent = 'Copied to clipboard'; setTimeout(() => $('share-button').textContent = 'Copy result', 1300); } catch { window.prompt('Copy your result:', text); } });
document.querySelectorAll('[data-record-mode]').forEach(button => button.addEventListener('click', () => { state.recordMode = button.dataset.recordMode; document.querySelectorAll('[data-record-mode]').forEach(other => { const selected = other === button; other.classList.toggle('selected', selected); other.setAttribute('aria-pressed', String(selected)); }); populateRecords(); }));
document.addEventListener('keydown', event => {
  if (event.key === 'Enter' && game.status === 'menu' && !views.help.open && !views.settings.open && !views.records.open && !views.contest.open && !views.online.open) { event.preventDefault(); start('arcade'); return; }
  if (event.key === 'Escape') { if (game.status === 'playing') { event.preventDefault(); pause(); } else if (game.status === 'paused') { resume(); } return; }
  if (game.status !== 'playing' || views.settings.open || views.help.open || views.records.open || views.results.open || views.contest.open || views.pass.open || views.online.open) return;
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
window.addEventListener('resize', () => renderer.resize()); window.addEventListener('blur', () => { game.input.left = false; game.input.right = false; game.input.guard = false; if (game.status === 'playing' && state.mode !== 'online') pause(); });
setSoundButton(); setThemeButton(); $('volume').value = String(Math.round(audio.volume * 100)); setStage(0); showMenu();
const inviteCode = new URLSearchParams(location.search).get('join');
if (inviteCode) { $('online-code').value = inviteCode.toUpperCase().slice(0, 8); setTimeout(() => openDialog(views.online), 500); }
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
setTimeout(() => { views.loading.classList.add('hidden'); canvas.focus(); }, 450);
raf = requestAnimationFrame(stepFrame);
