/* Stickman Typing Fighter — minimal publish build.
   Video motion: jab/cross/kick/LAUNCHER/air juggle/SLAM. Solo rounds + contest + local board. */
(function () {
"use strict";
var W = 960, H = 540, GROUND_Y = 452, SPAWN_Y = -30;
var BOARD_KEY = "kw_stickman_board_v1";
var canvas = document.getElementById("game"), ctx = canvas.getContext("2d");
var reduceMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
function $(id) { return document.getElementById(id); }
var views = { setup: $("view-setup"), game: $("view-game"), board: $("view-board"), how: $("view-how") };
var el = {
  soloName: $("solo-name"), p1: $("p1-name"), p2: $("p2-name"), diff: $("difficulty"),
  hudName: $("hud-name"), hudMode: $("hud-mode"), timer: $("hud-timer"),
  score: $("hud-score"), combo: $("hud-combo"), hp: $("hp-fill"), rival: $("hud-rival"), meta: $("hud-meta"),
  toast: $("toast"), overlay: $("overlay"), ovTitle: $("ov-title"), ovText: $("ov-text"),
  ovMain: $("ov-main"), ovQuit: $("ov-quit"), ovShare: $("ov-share"),
  boardList: $("board-list"), preview: $("board-preview"), footHi: $("foot-hi"), appVer: $("app-ver"),
  mobile: $("mobile-keys"), muteBtn: $("btn-mute")
};
function show(name) {
  Object.keys(views).forEach(function (k) { views[k].classList.toggle("hidden", k !== name); });
  window.scrollTo(0, 0);
}
document.querySelectorAll("[data-nav]").forEach(function (b) {
  b.addEventListener("click", function () { if (state.status !== "playing") { var v = b.dataset.nav === "contest" ? "setup" : b.dataset.nav; if (v !== "setup" && !views[v]) v = "setup"; show(v === "solo" ? "setup" : v); if (b.dataset.nav === "board") renderBoard(); } });
});

var state = fresh();
function fresh() {
  return {
    status: "setup", mode: "solo", playerName: "YOU", contest: null, seed: 0,
    round: 1, dur: 45, left: 45, endAt: 0, score: 0, health: 5, combo: 0, best: 0,
    typed: 0, wrong: 0, t0: 0,
    total: 0, good: 0, miss: 0, letters: [], fall: 120, spawnDelay: 1600,
    spawnBase: 1600, spawnMult: 1,
    meA: "idle", meT: 0, opA: "idle", opT: 0,
    opp: { ox: 0, oy: 0, vy: 0, air: false, rot: 0, vr: 0 },
    me: { dx: 0, dy: 0, air: false },
    ghosts: [], fx: null, shake: 0, hitstop: 0
  };
}
var last = 0, spawnAcc = 0, seq = 0, lastCh = "", run = 0;
var parts = [], dust = [], toastT = 0, muted = false, audio = null, boardTab = "solo";

function sfx(f, d, type, v) {
  if (muted) return;
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    var o = audio.createOscillator(), g = audio.createGain();
    o.type = type || "square"; o.frequency.value = f; g.gain.value = v || 0.05;
    o.connect(g); g.connect(audio.destination); o.start();
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + (d || 0.08));
    o.stop(audio.currentTime + (d || 0.08));
  } catch (e) {}
}
function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ","); }
function fmtT(s) { s = Math.max(0, Math.ceil(s)); return Math.floor(s / 60) + ":" + (s % 60 < 10 ? "0" : "") + s % 60; }
function clean(v, fb) { v = (v || "").trim().toUpperCase().slice(0, 12); return v || fb; }
function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
function toast(t, ms) { el.toast.textContent = t; el.toast.style.opacity = 1; toastT = ms || 900; }
var lastShare = null;
function setShare(obj) {
  lastShare = obj || null;
  el.ovShare.classList.toggle("hidden", !lastShare);
}
function shareUrl() {
  if (!lastShare) return location.href;
  var s = btoa(unescape(encodeURIComponent(JSON.stringify(lastShare))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return location.href.split("?")[0].split("#")[0] + "?r=" + s;
}
el.ovShare.addEventListener("click", function () {
  var url = shareUrl();
  function done(msg) { el.ovShare.textContent = msg; setTimeout(function () { el.ovShare.textContent = "🔗 Share"; }, 1500); }
  if (navigator.share) { navigator.share({ title: "Stickman Typing Fighter", text: "Beat my score!", url: url }).catch(function () {}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () { done("✓ Copied!"); }, function () { prompt("Copy your result link:", url); });
  } else prompt("Copy your result link:", url);
});
function checkShared() {
  try {
    var j = location.search.match(/[?&]join=([A-Za-z0-9]{4})/);
    if (j) {
      show("setup");
      var jc = $("join-code");
      if (jc) jc.value = j[1].toUpperCase();
      netStatus("Invite for room " + j[1].toUpperCase() + " — enter your name, press Join room.");
      try { history.replaceState({}, "", location.pathname); } catch (e) {}
    }
    var m = location.search.match(/[?&]r=([A-Za-z0-9\-_]+)/);
    if (!m) return;
    var s = m[1].replace(/-/g, "+").replace(/_/g, "/");
    while (s.length % 4) s += "=";
    var o = JSON.parse(decodeURIComponent(escape(atob(s))));
    if (!o || !o.n) return;
    show("game");
    state = fresh(); state.status = "shared"; resetFight(); hud();
    overlay("⚔ " + String(o.n).slice(0, 12) + " challenges you!",
      "Score to beat: <b>" + fmt(o.s | 0) + "</b> · " + (o.a | 0) + "% · best x" + (o.c | 0) +
      (o.w ? "<br>" + esc(String(o.w)) : "") + "<br>Press play and beat it.",
      "▶ Play", startSolo);
    setShare(null);
  } catch (e) {}
}
function overlay(title, text, main, fn) {
  try { if (document.activeElement === el.mobile) el.mobile.blur(); } catch (e) {}
  el.ovTitle.textContent = title; el.ovText.innerHTML = text || "";
  el.ovMain.textContent = main || "Resume"; el.overlay.classList.remove("hidden");
  el.ovMain.onclick = fn;
}
function hideOverlay() { el.overlay.classList.add("hidden"); }

/* board */
function loadB() { try { return JSON.parse(localStorage.getItem(BOARD_KEY) || "[]"); } catch (e) { return []; } }
function saveB(b) { try { localStorage.setItem(BOARD_KEY, JSON.stringify(b.slice(0, 40))); } catch (e) {} }
function addEntry(e) { var b = loadB(); b.push(e); b.sort(function (a, c) { return c.score - a.score; }); saveB(b); renderBoard(); }
function renderBoard() {
  if (boardTab === "matches") {
    var mm = loadM();
    el.boardList.innerHTML = mm.length ? mm.map(function (m2) {
      var d = new Date(m2.when || Date.now());
      var t = d.toLocaleDateString() + " " + d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      var res = m2.w ? ("🏆 <b>" + esc(m2.w) + "</b> won") : "🤝 Draw";
      return "<li>" + res + " — <b>" + esc(m2.a.name) + "</b> " + fmt(m2.a.score) + " vs <b>" + esc(m2.b.name) + "</b> " + fmt(m2.b.score) + " <span class='muted'>" + t + "</span></li>";
    }).join("") : "<li class='muted'>No matches yet — play online or contest!</li>";
    return;
  }
  var b = loadB().filter(function (e) { return (e.mode || "solo") === boardTab; }).slice(0, 10);
  var html = b.length ? b.map(function (e, i) {
    var m = ["🥇", "🥈", "🥉"][i] || ((i + 1) + ".");
    return "<li>" + m + " <b>" + esc(e.name) + "</b> — " + fmt(e.score) + " · " + e.acc + "% · x" + e.combo + "</li>";
  }).join("") : "<li class='muted'>No scores yet.</li>";
  el.boardList.innerHTML = html;
  var top = loadB().slice(0, 3);
  el.preview.innerHTML = top.length ? top.map(function (e) { return "<li><b>" + esc(e.name) + "</b> — " + fmt(e.score) + "</li>"; }).join("") : "<li class='muted'>No scores yet.</li>";
  var hi = loadB()[0];
  el.footHi.textContent = hi ? ("Best: " + hi.name + " " + fmt(hi.score)) : "No high score yet";
}

/* spawner */
var ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
var WORDS = "CAT DOG RUN JUMP PLAY TYPE FAST GAME CODE KEY PUNCH KICK FIGHT WIN STAR MOON FIRE ROCK PAPER POWER SPEED LIGHT QUICK FOX LAZY HAPPY MUSIC DANCE SLAM COMBO RIVAL BLAZE STORM NINJA ROBOT PIXEL ARCADE LEVEL SCORE".split(" ");
function pick() {
  var c, g = 0;
  do { c = ALPHA[(R() * 26) | 0]; g++; } while (c === lastCh && run >= 2 && g < 20);
  if (c === lastCh) run++; else { lastCh = c; run = 1; }
  return c;
}
function spawn() {
  var max = (state.mode === "contest" || state.mode === "online") ? 2 : state.round >= 4 ? 4 : state.round === 3 ? 3 : 2;
  if (state.letters.length >= max) return;
  if (state.mode === "solo" && state.round >= 2 && R() < (state.round >= 3 ? 0.4 : 0.25)) {
    var pool = WORDS.filter(function (w) { return w.length <= (state.round >= 3 ? 5 : 4); });
    var word = pool[(R() * pool.length) | 0];
    state.letters.push({ id: "L" + (++seq), ch: word, word: word, prog: 0, x: 120 + R() * (W - 240), y: SPAWN_Y, sp: state.fall * 0.82 * (0.92 + R() * 0.16), wob: R() * 6.28 });
    state.total++;
    return;
  }
  state.letters.push({ id: "L" + (++seq), ch: pick(), x: 90 + R() * (W - 180), y: SPAWN_Y, sp: state.fall * (0.92 + R() * 0.16), wob: R() * 6.28 });
  state.total++;
}
function target() {
  if (!state.letters.length) return null;
  var b = state.letters[0];
  for (var i = 1; i < state.letters.length; i++) if (state.letters[i].y > b.y) b = state.letters[i];
  return b;
}

/* combat — same motion as trailer */
function burst(x, y, ch) {
  var n = reduceMotion ? 4 : 14;
  for (var i = 0; i < n; i++) parts.push({ x: x, y: y, vx: (Math.random() - 0.5) * 460, vy: -Math.random() * 340 - 60, life: 0, max: 0.5 + Math.random() * 0.4, txt: Math.random() < 0.35 ? ch : (Math.random() < 0.5 ? "★" : "▮"), col: ["#ffd23f", "#fff", "#e5484d", "#111"][(Math.random() * 4) | 0], s: 12 + Math.random() * 16 });
}
function recover(ms) {
  setTimeout(function () {
    if (state.status !== "playing") return;
    if (!state.opp.air && !state.me.air) {
      if (state.meA !== "idle") { state.meA = "recover"; }
      if (["recoil", "attack", "hit"].indexOf(state.opA) >= 0) state.opA = "recover";
    }
  }, ms);
}
function hit(letter) {
  state.letters = state.letters.filter(function (l) { return l.id !== letter.id; });
  state.combo++; if (state.combo > state.best) state.best = state.combo;
  state.good++; state.score += 100 + (state.combo - 1) * 10;
  state.ghosts.push({ dx: state.me.dx, dy: state.me.dy, pose: state.meA, t: 0 });
  if (state.ghosts.length > 6) state.ghosts.shift();
  var o = state.opp, m = state.me, cyc = state.combo % 7;
  var ix = (letter.x + 480) / 2, iy = Math.min(Math.max(letter.y, 60), 380);
  var label = "JAB", pa = "attack", oa = "recoil";
  if (cyc === 1) { label = "JAB"; o.ox -= 16; m.dx = 26; }
  else if (cyc === 2) { label = "CROSS"; o.ox -= 22; m.dx = 40; }
  else if (cyc === 3) { label = "KICK"; pa = "kick"; o.ox -= 34; m.dx = 46; }
  else if (cyc === 4) { label = "LAUNCHER"; pa = "launch"; oa = "launched"; o.air = true; o.vy = -640; o.vr = -4.5; m.dy = -60; m.dx = 30; iy = 300; toast("LAUNCHER!", 600); }
  else if (cyc === 5 || cyc === 6) {
    label = cyc === 5 ? "AIR x1" : "AIR x2"; pa = "air"; oa = "airhit";
    if (!o.air) { o.air = true; o.vy = -420; o.vr = -3; } else o.vy = Math.min(o.vy, -260);
    m.air = true; m.dy = o.oy - 40; m.dx = 20; iy = 380 + o.oy;
  } else { label = "SLAM"; pa = "slam"; oa = "slammed"; o.vy = 980; o.vr = 5; m.dy = -30; m.dx = 36; iy = 380; toast("SLAM!", 600); }
  state.meA = pa; state.opA = oa;
  state.fx = { x: ix, y: iy, text: label, t: 0, dur: 0.35, ch: letter.ch };
  state.shake = reduceMotion ? 0 : Math.max(state.shake, cyc === 0 ? 10 : 7);
  state.hitstop = reduceMotion ? 0 : 0.055;
  burst(letter.x, Math.max(letter.y, 40), letter.ch);
  sfx(480 + Math.min(state.combo, 24) * 24, 0.09, "square", 0.06);
  recover(cyc === 4 || cyc === 0 ? 560 : 420);
  hud();
}
function miss(letter) {
  state.letters = state.letters.filter(function (l) { return l.id !== letter.id; });
  state.opA = "attack"; state.meA = "hit"; state.me.dx = -18;
  state.fx = { x: 320, y: 300, text: "OUCH", t: 0, dur: 0.4, ch: "✕" };
  state.shake = reduceMotion ? 0 : 9;
  burst(320, 300, "✕");
  state.miss++; state.combo = 0; state.health = Math.max(0, state.health - 1);
  sfx(140, 0.25, "sawtooth", 0.08);
  recover(500); hud();
  if (state.health <= 0) gameOver();
}

/* flow */
function diffV() { var d = el.diff.value; return d === "easy" ? { m: 0.8, s: 1900 } : d === "hard" ? { m: 1.25, s: 1300 } : { m: 1, s: 1600 }; }
function resetFight() {
  state.letters = []; parts = []; dust = []; state.ghosts = [];
  state.opp = { ox: 0, oy: 0, vy: 0, air: false, rot: 0, vr: 0 };
  state.me = { dx: 0, dy: 0, air: false };
  state.fx = null; spawnAcc = 0; lastCh = ""; run = 0; seq = 0;
  state.typed = 0; state.t0 = performance.now();
}
/* Seeded rand: online races share a seed so both sides get identical letters */
function R() {
  if (state.seed) { state.seed = (state.seed * 1664525 + 1013904223) >>> 0; return state.seed / 4294967296; }
  return Math.random();
}
function startSolo() {
  var d = diffV(), keep = state;
  state = fresh();
  state.mode = "solo"; state.playerName = clean(el.soloName.value, "YOU");
  try { localStorage.setItem("kw_last_name", state.playerName); } catch (e) {}
  state.status = "playing"; state.round = 1;
  state.dur = 45; state.left = 45;
  state.fall = 120 * d.m; state.spawnDelay = Math.max(500, d.s);
  state.spawnBase = d.s; state.spawnMult = d.m;
  stopNet(); resetFight(); show("game"); hideOverlay(); setShare(null); hud();
  state.endAt = performance.now() + state.left * 1000;
  tapType();
  toast(state.playerName + " — FIGHT!", 1000);
}
function startContest() {
  var p1 = clean(el.p1.value, "PLAYER 1"), p2 = clean(el.p2.value, "PLAYER 2");
  if (p1 === p2) p2 += " 2";
  state = fresh(); state.mode = "contest"; state.contest = { p1: p1, p2: p2, turn: 1, a: null, b: null };
  stopNet(); setShare(null);
  blitz(p1, 1);
}
function blitz(name, turn) {
  state.playerName = name; state.score = 0; state.health = 5;
  state.combo = 0; state.best = 0; state.total = 0; state.good = 0; state.miss = 0;
  state.round = 1; state.dur = 45; state.left = 45; state.fall = 135; state.spawnDelay = 1400;
  state.status = "playing"; if (state.contest) state.contest.turn = turn;
  resetFight(); show("game"); hideOverlay(); setShare(null); hud();
  state.endAt = performance.now() + state.left * 1000;
  tapType();
  toast(name + " — 45s BLITZ!", 1200);
}
function snap(name) {
  var acc = state.total ? Math.round(100 * state.good / state.total) : 100;
  return { name: name, score: state.score, acc: acc, combo: state.best, round: state.round };
}
function timeUp() {
  if (state.mode === "contest" && state.contest) {
    var s = snap(state.playerName);
    if (state.contest.turn === 1) {
      state.contest.a = s; state.status = "swap";
      overlay("🔄 Pass the keyboard", "<b>" + esc(s.name) + "</b>: <b>" + fmt(s.score) + "</b> (" + s.acc + "%)<br>Next: <b>" + esc(state.contest.p2) + "</b>", "Start " + state.contest.p2, function () { blitz(state.contest.p2, 2); });
    } else {
      state.contest.b = s; finishContest();
    }
  } else if (state.mode === "online") onlineDone(false);
  else roundDone();
}
function roundDone() {
  if (state.status !== "playing") return;
  state.status = "roundComplete"; state.letters = [];
  var acc = state.total ? Math.round(100 * state.good / state.total) : 100;
  var bonus = state.health * 500 + acc * 5;
  state.score += bonus;
  overlay("Level complete", esc(state.playerName) + " · <b>" + fmt(state.score) + "</b> (+ " + fmt(bonus) + ")<br>" + acc + "% · best x" + state.best + "<br>Next: " + fmtT(45 + state.round * 30) + ", faster", "Next level →", nextRound);
  setShare({ n: state.playerName, s: state.score, a: acc, c: state.best, m: "solo" });
  hud();
}
function nextRound() {
  state.round++; state.dur = 45 + (state.round - 1) * 30; state.left = state.dur;
  state.fall = (120 + (state.round - 1) * 25) * (state.spawnMult || 1);
  state.spawnDelay = Math.max(500, (state.spawnBase || 1600) - (state.round - 1) * 200);
  state.combo = 0; resetFight();
  if (state.round % 3 === 1 && state.health < 5) state.health++;
  state.status = "playing"; hideOverlay(); hud();
  state.endAt = performance.now() + state.left * 1000;
  tapType();
  toast("ROUND " + state.round + " — FIGHT!", 1000);
}
function gameOver() {
  if (state.status === "gameOver") return;
  if (state.mode === "contest") { timeUp(); return; }
  if (state.mode === "online") { onlineDone(false); return; }
  state.status = "gameOver"; state.letters = []; state.left = 0;
  var acc = state.total ? Math.round(100 * state.good / state.total) : 0;
  addEntry({ name: state.playerName, score: state.score, acc: acc, combo: state.best, round: state.round, mode: "solo", date: Date.now() });
  overlay("Game over", esc(state.playerName) + " · <b>" + fmt(state.score) + "</b><br>Round " + state.round + " · " + acc + "% · best x" + state.best, "↻ Play again", startSolo);
  setShare({ n: state.playerName, s: state.score, a: acc, c: state.best, m: "solo" });
  hud();
}
function finishContest() {
  var a = state.contest.a, b = state.contest.b;
  addEntry({ name: a.name, score: a.score, acc: a.acc, combo: a.combo, round: 1, mode: "contest", date: Date.now() });
  addEntry({ name: b.name, score: b.score, acc: b.acc, combo: b.combo, round: 1, mode: "contest", date: Date.now() });
  var w = a.score === b.score ? null : (b.score > a.score ? b : a);
  state.status = "winner";
  saveMatch({ a: { name: a.name, score: a.score }, b: { name: b.name, score: b.score }, w: w ? w.name : null, when: Date.now() });
  overlay(w ? "🏆 " + w.name + " wins!" : "🤝 Draw!",
    esc(a.name) + ": <b>" + fmt(a.score) + "</b> · " + a.acc + "%<br>" + esc(b.name) + ": <b>" + fmt(b.score) + "</b> · " + b.acc + "%",
    "⚔ Rematch", startContest);
  setShare(w ? { n: w.name, s: w.score, a: w.acc, c: w.combo, m: "contest", w: a.name + " " + fmt(a.score) + " vs " + b.name + " " + fmt(b.score) } : { n: a.name + " & " + b.name, s: Math.max(a.score, b.score), a: Math.max(a.acc, b.acc), c: Math.max(a.combo, b.combo), m: "contest" });
}
function quit() { stopNet(); state.status = "setup"; hideOverlay(); setShare(null); show("setup"); renderBoard(); }

/* ---------- match records (saved every online/contest match) ---------- */
var MATCH_KEY = "kw_matches_v1";
function loadM() { try { return JSON.parse(localStorage.getItem(MATCH_KEY) || "[]"); } catch (e) { return []; } }
function saveMatch(m) {
  try { var a = loadM(); a.unshift(m); localStorage.setItem(MATCH_KEY, JSON.stringify(a.slice(0, 30))); } catch (e) {}
  renderBoard();
}

function tapType() { try { el.mobile.focus({ preventScroll: true }); } catch (e) {} }
/* ---------- online versus: free relay rooms, no account ---------- */
var net = { peer: null, conn: null, role: null, code: null, myName: "YOU", rivalName: "RIVAL",
  rival: { s: 0, c: 0, h: 5, g: 0, n: 0 }, rivalDone: null, mine: null, timer: null, waitT: null,
  matchSeed: 0, waitHello: null, helloTimer: null, helloN: 0 };
var PEER_URL = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
var PEER_PRE = "kw-tf-v1-";
function netStatus(t) { var s = $("net-status"); if (s) s.textContent = t; }
function needPeer(cb) {
  if (window.Peer) return cb();
  netStatus("Loading relay…");
  var sc = document.createElement("script");
  sc.src = PEER_URL; sc.async = true;
  sc.onload = function () { cb(); };
  sc.onerror = function () { netStatus("No connection to relay (offline?) — solo & same-device still work."); };
  document.head.appendChild(sc);
}
function roomCode() { var A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789", s = ""; for (var i = 0; i < 4; i++) s += A[(Math.random() * A.length) | 0]; return s; }
function inviteLink(code) { return location.href.split("?")[0].split("#")[0] + "?join=" + code; }
function send(o) { try { if (net.conn && net.conn.open) net.conn.send(o); } catch (e) {} }
function stopNet() {
  if (!net) return;
  if (net.timer) clearInterval(net.timer);
  if (net.waitT) clearTimeout(net.waitT);
  if (net.waitHello) clearTimeout(net.waitHello);
  if (net.helloTimer) clearInterval(net.helloTimer);
  net.timer = net.waitT = net.waitHello = net.helloTimer = null;
  try { if (net.conn) net.conn.close(); } catch (e) {}
  try { if (net.peer) net.peer.destroy(); } catch (e) {}
  net.peer = net.conn = null; net.role = net.code = null; net.rivalDone = net.mine = null;
  try { $("invite-row").classList.add("hidden"); } catch (e) {}
}
function wireConn(c) {
  net.conn = c;
  c.on("data", onNetData);
  c.on("close", onNetDrop);
  c.on("error", onNetDrop);
}
function onNetData(m) {
  if (!m || !m.t) return;
  if (m.t === "hello" && net.role === "host") {
    if (state.mode === "online" && (state.status === "playing" || state.status === "await")) {
      if (net.matchSeed) send({ t: "welcome", name: net.myName, seed: net.matchSeed, at: 0 });
      return;
    }
    if (net.waitHello) { clearTimeout(net.waitHello); net.waitHello = null; }
    net.rivalName = clean(m.name, "RIVAL");
    var seed = (Math.random() * 2147483647) | 0;
    net.matchSeed = seed;
    var at = Date.now() + 2500;
    send({ t: "welcome", name: net.myName, seed: seed, at: at });
    netStatus("Rival found — starting…");
    toast("Rival found — get ready!", 2000);
    setTimeout(function () { startOnline(net.myName, net.rivalName, seed, "host"); }, Math.max(0, at - Date.now()));
  } else if (m.t === "welcome" && net.role === "guest") {
    if (net.helloTimer) { clearInterval(net.helloTimer); net.helloTimer = null; }
    net.rivalName = clean(m.name, "RIVAL");
    net.matchSeed = m.seed | 0;
    netStatus("Connected — starting…");
    var delay = m.at ? Math.max(0, m.at - Date.now()) : 500;
    setTimeout(function () { startOnline(net.myName, net.rivalName, net.matchSeed, "guest"); }, delay);
  } else if (m.t === "tick") {
    net.rival = { s: m.s | 0, c: m.c | 0, h: m.h | 0, g: m.g | 0, n: m.n | 0 };
    hud();
  } else if (m.t === "done") {
    net.rivalDone = m.snap;
    if (state.status === "await") finishOnline(false);
    else toast(net.rivalName + " finished!", 1200);
  } else if (m.t === "go2" && net.role === "guest") {
    startOnline(net.myName, net.rivalName, m.seed | 0, "guest");
  } else if (m.t === "want-rematch" && net.role === "host" && state.status === "winner") {
    toast(net.rivalName + " wants a rematch!", 1500);
  }
}
function onNetDrop() {
  if (state.mode === "online" && (state.status === "playing" || state.status === "await")) {
    toast("Rival disconnected", 1500);
    if (state.status === "playing") onlineDone(true);
    else finishOnline(true);
  }
}
function startOnline(name, rival, seed, role) {
  state = fresh();
  state.mode = "online"; state.playerName = name; state.seed = seed;
  state.round = 1; state.dur = 45; state.left = 45; state.fall = 135; state.spawnDelay = 1400;
  state.status = "playing";
  net.role = role; net.rivalName = rival;
  net.rival = { s: 0, c: 0, h: 5, g: 0, n: 0 }; net.rivalDone = net.mine = null;
  if (net.timer) clearInterval(net.timer);
  if (net.waitT) clearTimeout(net.waitT);
  net.timer = setInterval(function () {
    send({ t: "tick", s: state.score, c: state.combo, h: state.health, g: state.good, n: state.total });
  }, 500);
  resetFight(); show("game"); hideOverlay(); setShare(null); hud();
  state.endAt = performance.now() + state.left * 1000;
  tapType();
  toast("FIGHT vs " + rival + "!", 1200);
}
function onlineDone(dropped) {
  if (state.status !== "playing") return;
  var s = snap(state.playerName);
  net.mine = s;
  send({ t: "done", snap: s });
  state.status = "await"; state.letters = []; state.left = 0;
  if (net.rivalDone) { finishOnline(false); return; }
  if (dropped) { finishOnline(true); return; }
  overlay("Waiting for rival…", "You: <b>" + fmt(s.score) + "</b> · " + s.acc + "%<br>" + esc(net.rivalName) + " is finishing…", "Menu", quit);
  setShare(null);
  net.waitT = setTimeout(function () { finishOnline(true); }, 8000);
  hud();
}
function finishOnline(timeout) {
  if (net.waitT) clearTimeout(net.waitT);
  if (net.timer) clearInterval(net.timer);
  net.timer = net.waitT = null;
  var a = net.mine || snap(state.playerName);
  var b = net.rivalDone || { name: net.rivalName, score: net.rival.s,
    acc: net.rival.n ? Math.round(100 * net.rival.g / net.rival.n) : 100, combo: net.rival.c, round: 1 };
  var w = a.score === b.score ? null : (b.score > a.score ? b : a);
  saveMatch({ a: { name: a.name, score: a.score }, b: { name: b.name, score: b.score }, w: w ? w.name : null, when: Date.now() });
  addEntry({ name: a.name, score: a.score, acc: a.acc, combo: a.combo, round: 1, mode: "online", date: Date.now() });
  state.status = "winner";
  overlay(w ? ("🏆 " + w.name + " wins!") : "🤝 Draw!",
    esc(a.name) + ": <b>" + fmt(a.score) + "</b> · " + a.acc + "% · x" + a.combo + "<br>" +
    esc(b.name) + ": <b>" + fmt(b.score) + "</b> · " + b.acc + "% · x" + b.combo +
    (timeout && !net.rivalDone ? "<br><span class='muted'>Rival timed out.</span>" : ""),
    "⚔ Rematch", onlineRematch);
  setShare({ n: (w ? w.name : a.name + " & " + b.name), s: Math.max(a.score, b.score), a: Math.max(a.acc, b.acc),
    c: Math.max(a.combo, b.combo), m: "online", w: a.name + " " + fmt(a.score) + " vs " + b.name + " " + fmt(b.score) });
  hud();
}
function onlineRematch() {
  if (net.role === "host") {
    var seed = (Math.random() * 2147483647) | 0;
    send({ t: "go2", seed: seed });
    startOnline(net.myName, net.rivalName, seed, "host");
  } else {
    send({ t: "want-rematch" });
    toast("Rematch requested — host starts it", 1500);
  }
}

/* hud */
function hud() {
  var acc = state.total ? Math.round(100 * state.good / state.total) : 100;
  el.hudName.textContent = state.playerName;
  el.hudMode.textContent = state.mode === "contest" ? (" · contest P" + (state.contest ? state.contest.turn : 1)) : (" · R" + state.round);
  el.timer.textContent = fmtT(state.left);
  el.timer.classList.toggle("urgent", state.status === "playing" && state.left <= 10);
  el.score.textContent = fmt(state.score);
  el.combo.textContent = "x" + state.combo;
  el.hp.style.width = (100 * state.health / 5) + "%";
  if (state.mode === "online") {
    var lead = state.score >= net.rival.s ? " · ▲ ahead" : " · ▼ behind";
    el.rival.textContent = "⚔ " + net.rivalName + ": " + fmt(net.rival.s) + " · x" + net.rival.c + " · ♥" + net.rival.h + (net.rivalDone ? " · DONE" : "") + lead;
  } else el.rival.textContent = "";
  var mins = (performance.now() - state.t0) / 60000;
  var wpm = mins > 0.02 ? Math.round((state.typed / 5) / mins) : 0;
  var att = state.good + state.miss + state.wrong;
  var acc = att ? Math.round(100 * state.good / att) : 100;
  el.meta.textContent = (state.status === "playing" || state.status === "paused") ? ("💨 " + wpm + " WPM · 🎯 " + acc + "%") : "";
}

/* ---- canvas art (paper fighters + light stages) ---- */
function rng(seed) { var s = seed; return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
var pc = {};
function torn(c, cx, cy, w, h, seed) {
  var k = w + "x" + h + ":" + seed;
  if (!pc[k]) { var r = rng(seed), p = [], i; for (i = 0; i < 12; i++) { var a = i / 12 * 6.283, rad = 0.5 + r() * 0.18; p.push([Math.cos(a) * rad, Math.sin(a) * rad]); } pc[k] = p; }
  var pts = pc[k];
  c.beginPath();
  for (var j = 0; j < pts.length; j++) { var x = cx + pts[j][0] * w, y = cy + pts[j][1] * h; if (!j) c.moveTo(x, y); else c.lineTo(x, y); }
  c.closePath();
}
function paper(c, cx, cy, w, h, seed) {
  c.save();
  c.shadowColor = "rgba(0,0,0,.8)"; c.shadowOffsetX = 5; c.shadowOffsetY = 6;
  torn(c, cx, cy, w, h, seed);
  var g = c.createLinearGradient(cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2);
  g.addColorStop(0, "#f2efe6"); g.addColorStop(0.5, "#dcd8cf"); g.addColorStop(1, "#c9c5b9");
  c.fillStyle = g; c.fill();
  c.shadowColor = "transparent";
  c.save(); torn(c, cx, cy, w, h, seed); c.clip();
  c.strokeStyle = "rgba(90,140,200,.35)"; c.lineWidth = 1;
  for (var y = cy - h / 2; y < cy + h / 2; y += 13) { c.beginPath(); c.moveTo(cx - w / 2, y); c.lineTo(cx + w / 2, y); c.stroke(); }
  c.restore();
  torn(c, cx, cy, w, h, seed); c.strokeStyle = "#0a0a0a"; c.lineWidth = 4; c.stroke();
  c.restore();
}
function stage() {
  var r = state.mode === "contest" ? state.contest.turn + 1 : state.round;
  if (r % 3 === 1) {
    var wall = ctx.createLinearGradient(0, 0, 0, H * 0.55);
    wall.addColorStop(0, "#f6e7cd"); wall.addColorStop(1, "#e2bf8f");
    ctx.fillStyle = wall; ctx.fillRect(0, 0, W, H * 0.55);
    ctx.fillStyle = "#8a5a33"; ctx.fillRect(56, 26, 224, 196);
    var glass = ctx.createLinearGradient(0, 30, 0, 222);
    glass.addColorStop(0, "#aed6ff"); glass.addColorStop(1, "#e9f7ff");
    ctx.fillStyle = glass; ctx.fillRect(68, 38, 200, 172);
    ctx.fillStyle = "rgba(255,242,190,.95)"; ctx.beginPath(); ctx.arc(222, 86, 26, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.beginPath(); ctx.ellipse(140, 92, 46, 14, 0, 0, 7); ctx.ellipse(182, 108, 34, 11, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = "#8a5a33"; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(168, 38); ctx.lineTo(168, 210); ctx.moveTo(68, 124); ctx.lineTo(268, 124); ctx.stroke();
    ctx.fillStyle = "#33415c"; ctx.fillRect(700, 36, 184, 134);
    ctx.fillStyle = "#f4f1e6"; ctx.fillRect(710, 46, 164, 114);
    ctx.fillStyle = "#e5484d"; ctx.font = "900 46px system-ui, Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("A", 792, 102);
    ctx.fillStyle = "#33415c"; ctx.font = "bold 15px Tahoma, Arial";
    ctx.fillText("TYPE TO FIGHT", 792, 140);
    var wood = ctx.createLinearGradient(0, H * 0.5, 0, H);
    wood.addColorStop(0, "#96683c"); wood.addColorStop(0.4, "#7a4f27"); wood.addColorStop(1, "#4a2c15");
    ctx.fillStyle = wood; ctx.fillRect(0, H * 0.5, W, H * 0.5);
    ctx.strokeStyle = "rgba(0,0,0,.22)"; ctx.lineWidth = 2;
    for (var pi = 0; pi < 5; pi++) { ctx.beginPath(); ctx.moveTo(0, H * 0.56 + pi * 34); ctx.lineTo(W, H * 0.53 + pi * 36); ctx.stroke(); }
    ctx.fillStyle = "rgba(255,255,255,.28)"; ctx.fillRect(0, H * 0.5, W, 3);
    ctx.save(); ctx.translate(430, 336); ctx.rotate(-0.06);
    ctx.fillStyle = "rgba(0,0,0,.2)"; ctx.fillRect(-71, -34, 150, 86);
    ctx.fillStyle = "#f7f4ec"; ctx.fillRect(-75, -40, 150, 86);
    ctx.strokeStyle = "rgba(90,140,200,.5)"; ctx.lineWidth = 1;
    for (var li = -26; li < 40; li += 11) { ctx.beginPath(); ctx.moveTo(-70, li); ctx.lineTo(70, li); ctx.stroke(); }
    ctx.strokeStyle = "rgba(229,72,77,.6)";
    ctx.beginPath(); ctx.moveTo(-52, -40); ctx.lineTo(-52, 46); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(110, 448, 52, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#2e2e32"; ctx.fillRect(96, 400, 30, 14);
    ctx.save(); ctx.translate(111, 400); ctx.rotate(0.18); ctx.fillStyle = "#3a3a40"; ctx.fillRect(-5, -190, 10, 190); ctx.restore();
    ctx.save(); ctx.translate(143, 218); ctx.rotate(0.18);
    ctx.fillStyle = "#1f5c46"; ctx.beginPath(); ctx.moveTo(-34, 0); ctx.lineTo(34, 0); ctx.lineTo(22, -64); ctx.lineTo(-22, -64); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "#ffd98a"; ctx.beginPath(); ctx.ellipse(0, 4, 26, 8, 0, 0, 7); ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255,214,130,.20)";
    ctx.beginPath(); ctx.moveTo(120, 226); ctx.lineTo(166, 226); ctx.lineTo(230, 452); ctx.lineTo(40, 452); ctx.closePath(); ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.25)"; ctx.beginPath(); ctx.ellipse(846, 452, 56, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#3f7d8c"; ctx.fillRect(806, 356, 82, 92);
    ctx.fillStyle = "#356a77"; ctx.fillRect(806, 356, 82, 14);
    ctx.strokeStyle = "#3f7d8c"; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.arc(892, 402, 20, -1.2, 1.2); ctx.stroke();
    var pens = [["#e5484d", 818], ["#f5b301", 836], ["#3f7d8c", 854]];
    pens.forEach(function (pn, idx) {
      var px = pn[1], lean2 = (idx - 1) * 5;
      ctx.save(); ctx.translate(px, 330); ctx.rotate(lean2 * 0.02);
      ctx.fillStyle = pn[0]; ctx.fillRect(-5, 0, 10, 62);
      ctx.fillStyle = "#f2d8a7"; ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.lineTo(0, -12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = "#222"; ctx.beginPath(); ctx.moveTo(-2, -7); ctx.lineTo(2, -7); ctx.lineTo(0, -12); ctx.closePath(); ctx.fill();
      ctx.restore();
    });
    ctx.save(); ctx.translate(620, 300); ctx.rotate(0.1);
    ctx.fillStyle = "#ffe45e"; ctx.fillRect(-26, -26, 52, 52);
    ctx.fillStyle = "#111"; ctx.font = "900 30px system-ui, Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText("!", 0, 2);
    ctx.restore();
  } else if (r % 3 === 2) {
    ctx.fillStyle = "#bcc7b8"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#8f8a7c"; ctx.fillRect(120, 40, 420, 200); ctx.fillRect(90, 260, 560, 130);
    ctx.fillStyle = "#3a4a2a"; ctx.fillRect(150, 60, 360, 130);
    var w2 = ctx.createLinearGradient(0, 400, 0, H);
    w2.addColorStop(0, "#8a5a33"); w2.addColorStop(1, "#4a2c15");
    ctx.fillStyle = w2; ctx.fillRect(0, 400, W, 140);
  } else {
    var s2 = ctx.createLinearGradient(0, 0, 0, H * 0.45);
    s2.addColorStop(0, "#3d8bff"); s2.addColorStop(1, "#bcd9ff");
    ctx.fillStyle = s2; ctx.fillRect(0, 0, W, H * 0.48);
    ctx.fillStyle = "rgba(255,255,255,.92)";
    [[150, 70, 90], [420, 50, 120], [700, 90, 100]].forEach(function (cl) {
      ctx.beginPath(); ctx.ellipse(cl[0], cl[1], cl[2], 26, 0, 0, 7); ctx.fill();
    });
    var hill = ctx.createLinearGradient(0, H * 0.3, 0, H);
    hill.addColorStop(0, "#5dbb2f"); hill.addColorStop(1, "#174d0c");
    ctx.fillStyle = hill;
    ctx.beginPath(); ctx.moveTo(0, H * 0.42);
    ctx.quadraticCurveTo(W * 0.4, H * 0.2, W, H * 0.45);
    ctx.lineTo(W, H); ctx.lineTo(0, H); ctx.closePath(); ctx.fill();
  }
}
function fighter(px, py, face, pose, t, isP, flash, rot) {
  var s = 1.35, bob = Math.sin(t * 4) * 3, lunge = 0, lean = 0, punch = 0, kick = 0, crouch = 0, upper = 0, spread = 0;
  if (pose === "idle" || pose === "recover") bob = Math.sin(t * 3) * 4;
  else if (pose === "attack") { lean = 0.35; lunge = 46; punch = 1; }
  else if (pose === "kick") { lean = 0.3; lunge = 40; kick = 1; }
  else if (pose === "launch") { lean = -0.4; lunge = 10; upper = 1; }
  else if (pose === "air") { lean = 0.2; lunge = 30; punch = 1; }
  else if (pose === "slam") { lean = 0.5; lunge = 40; punch = 1; crouch = 6; }
  else if (pose === "recoil" || pose === "hit") { lean = -0.45; lunge = -30; crouch = 10; }
  else if (pose === "attack_opp" || pose === "attack") { lean = 0.4; lunge = 52; punch = 1; }
  else if (pose === "launched" || pose === "airhit") spread = 1;
  var cx = px + lunge * face, cy = py + bob + crouch;
  paper(ctx, px, py - 70, isP ? 130 : 140, isP ? 120 : 125, isP ? 11 : 77);
  ctx.save(); ctx.translate(cx, cy); if (rot) ctx.rotate(rot); ctx.scale(face * s, s);
  ctx.lineCap = "round"; ctx.strokeStyle = flash ? "#e5484d" : "#111"; ctx.lineWidth = 6;
  function limb(a, b, c2, d) { ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.stroke(); }
  ctx.save(); ctx.strokeStyle = "rgba(0,0,0,.3)"; ctx.lineWidth = 8;
  ctx.beginPath(); ctx.ellipse(-8, 106, 42, 8, 0, 0, 7); ctx.stroke(); ctx.restore();
  if (spread) {
    limb(-30, -70, 30, -80); limb(30, -80, 52, -66); limb(30, -80, 52, -92);
    limb(-30, -70, -52, -50); limb(-30, -70, -50, -92);
    ctx.fillStyle = "#fff"; ctx.beginPath(); ctx.arc(44, -82, 19, 0, 7); ctx.fill(); ctx.stroke();
    ctx.restore(); return;
  }
  var hip = [0, -46], sho = [lean * 30, -88];
  limb(hip[0], hip[1], sho[0], sho[1]);
  var hx = sho[0] + lean * 14, hy = sho[1] - 30;
  ctx.fillStyle = flash ? "#ffd7d7" : "#fff";
  ctx.beginPath(); ctx.arc(hx, hy, 20, 0, 7); ctx.fill(); ctx.stroke();
  ctx.lineWidth = 3.5;
  if (pose === "hit" || pose === "recoil") {
    ctx.beginPath();
    ctx.moveTo(hx - 9, hy - 5); ctx.lineTo(hx - 1, hy + 3); ctx.moveTo(hx - 1, hy - 5); ctx.lineTo(hx - 9, hy + 3);
    ctx.moveTo(hx + 2, hy - 5); ctx.lineTo(hx + 10, hy + 3); ctx.moveTo(hx + 10, hy - 5); ctx.lineTo(hx + 2, hy + 3);
    ctx.stroke();
  } else {
    // face elements: two eyes + smile (no more T mark)
    ctx.fillStyle = flash ? "#e5484d" : "#111";
    ctx.beginPath(); ctx.arc(hx - 6, hy - 4, 2.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx + 6, hy - 4, 2.6, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(hx, hy + 1, 8, 0.4, Math.PI - 0.4); ctx.stroke();
  }
  if (isP) {
    ctx.fillStyle = "#fff"; ctx.strokeStyle = "#111"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(hx + 2, hy - 14, 20, 9, 0.1, Math.PI, 0); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = flash ? "#e5484d" : "#111";
  } else {
    ctx.strokeStyle = "#111"; ctx.lineWidth = 3;
    ctx.strokeRect(hx - 12, hy - 8, 13, 12); ctx.strokeRect(hx + 2, hy - 8, 13, 12);
    ctx.strokeStyle = flash ? "#e5484d" : "#111"; ctx.lineWidth = 6;
  }
  if (upper) { limb(sho[0], sho[1], sho[0] + 20, sho[1] - 44); limb(sho[0], sho[1], sho[0] - 14, sho[1] + 16); }
  else if (punch) { limb(sho[0], sho[1], sho[0] + 52, sho[1] - 6); limb(sho[0], sho[1], sho[0] - 12, sho[1] + 18); }
  else { var g = Math.sin(t * 4) * 3; limb(sho[0], sho[1], sho[0] + 24, sho[1] + 14 + g); limb(sho[0], sho[1], sho[0] + 18, sho[1] + 4 - g); }
  if (kick) { limb(hip[0], hip[1], hip[0] + 62, hip[1] - 6); limb(hip[0], hip[1], hip[0] - 20, hip[1] + 52); }
  else { limb(hip[0], hip[1], hip[0] - 24, hip[1] + 52); limb(hip[0], hip[1], hip[0] + 24, hip[1] + 52); }
  ctx.restore();
}
function tile(l, isT, t) {
  ctx.save();
  ctx.translate(l.x + Math.sin(t * 3 + l.wob) * 4, l.y);
  var w = l.word ? (30 + l.word.length * 24) : 58, h = 66;
  ctx.shadowColor = "rgba(0,0,0,.6)"; ctx.shadowOffsetX = 4; ctx.shadowOffsetY = 5;
  ctx.fillStyle = isT ? "#141412" : "#f4f1e6";
  ctx.strokeStyle = "#000"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.rect(-w / 2, -h / 2, w, h); ctx.fill(); ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  if (l.word) {
    ctx.font = "900 26px system-ui, Arial";
    ctx.fillStyle = isT ? "#fff" : "#141412";
    ctx.fillText(l.word, 0, -2);
    if (l.prog > 0) {
      var tw = ctx.measureText(l.word).width;
      var done = l.word.slice(0, l.prog);
      ctx.textAlign = "left";
      ctx.fillStyle = "#4ade80";
      ctx.fillText(done, -tw / 2, -2);
      ctx.textAlign = "center";
    }
  } else {
    ctx.font = "900 36px system-ui, Arial";
    ctx.fillStyle = isT ? "#fff" : "#141412";
    ctx.fillText(l.ch, 0, -2);
  }
  if (isT) { ctx.fillStyle = "#e5484d"; ctx.fillRect(-w / 2 + 4, h / 2 - 10, w - 8, 6); }
  ctx.restore();
}
function impact(fx) {
  var k = fx.t / fx.dur;
  ctx.save(); ctx.translate(fx.x, fx.y); ctx.globalAlpha = 1 - k;
  ctx.fillStyle = "#ffd23f"; ctx.strokeStyle = "#111"; ctx.lineWidth = 5;
  ctx.beginPath();
  for (var i = 0; i < 12; i++) { var a = i / 12 * 6.283, r = i % 2 ? 38 : 70, x = Math.cos(a) * r, y = Math.sin(a) * r; if (!i) ctx.moveTo(x, y); else ctx.lineTo(x, y); }
  ctx.closePath(); ctx.fill(); ctx.stroke();
  ctx.fillStyle = "#111"; ctx.font = "900 24px system-ui, Arial"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(fx.text, 0, 0);
  ctx.restore();
}

/* loop */
function frame(now) {
  requestAnimationFrame(frame);
  if (!last) last = now;
  var dt = Math.min(0.05, (now - last) / 1000); last = now;
  var t = now / 1000;
  if (state.hitstop > 0) { state.hitstop -= dt; dt *= 0.05; }
  if (state.status === "playing") {
    state.left = Math.max(0, (state.endAt - performance.now()) / 1000);
    if (state.left <= 0) { hud(); timeUp(); }
    else {
      spawnAcc += dt * 1000;
      if (spawnAcc >= state.spawnDelay) { spawnAcc = 0; spawn(); }
      for (var i = state.letters.length - 1; i >= 0; i--) {
        var l = state.letters[i]; l.y += l.sp * dt;
        if (l.y >= GROUND_Y) miss(l);
      }
      var o = state.opp, m = state.me;
      if (o.air) {
        o.oy += o.vy * dt; o.vy += 1800 * dt; o.rot += o.vr * dt;
        if (o.vy > 0 && o.oy >= 0 && state.opA === "slammed") {
          o.oy = 0; o.air = false; o.vy = 0; o.rot = 0;
          for (var d = 0; d < 8; d++) dust.push({ x: 660 + o.ox, y: 430, vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 160, life: 0, max: 0.6 });
          state.shake = reduceMotion ? 0 : 12; state.opA = "recoil"; recover(450);
        } else if (o.oy >= 0 && o.vy > 0) { o.oy = 0; o.vy = -180; }
        if (o.oy < -260) { o.oy = -260; o.vy = 0; }
      }
      o.ox += (0 - o.ox) * Math.min(1, dt * 5);
      if (!o.air) o.rot += (0 - o.rot) * Math.min(1, dt * 8);
      if (m.air) { m.dy += (o.oy - 40 - m.dy) * Math.min(1, dt * 8); if (!o.air) m.air = false; }
      else m.dy += (0 - m.dy) * Math.min(1, dt * 8);
      m.dx += (0 - m.dx) * Math.min(1, dt * 7);
      if (state.fx) { state.fx.t += dt; if (state.fx.t >= state.fx.dur) state.fx = null; }
      for (var gi = state.ghosts.length - 1; gi >= 0; gi--) { state.ghosts[gi].t += dt; if (state.ghosts[gi].t > 0.3) state.ghosts.splice(gi, 1); }
      if (Math.floor(t * 2) !== Math.floor((t - dt) * 2)) hud();
    }
  }
  for (var p = parts.length - 1; p >= 0; p--) { var pt = parts[p]; pt.life += dt; pt.x += pt.vx * dt; pt.y += pt.vy * dt; pt.vy += 900 * dt; if (pt.life >= pt.max) parts.splice(p, 1); }
  for (var di = dust.length - 1; di >= 0; di--) { var du = dust[di]; du.life += dt; du.x += du.vx * dt; du.y += du.vy * dt; if (du.life >= du.max) dust.splice(di, 1); }
  if (toastT > 0) { toastT -= dt * 1000; if (toastT <= 0) el.toast.style.opacity = 0; }
  if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);
  // render
  ctx.save();
  if (state.shake > 0 && !reduceMotion) ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  stage();
  ctx.save(); ctx.strokeStyle = "rgba(229,72,77,.9)"; ctx.lineWidth = 3; ctx.setLineDash([14, 10]); ctx.lineDashOffset = -t * 40;
  ctx.beginPath(); ctx.moveTo(20, GROUND_Y); ctx.lineTo(W - 20, GROUND_Y); ctx.stroke(); ctx.restore();
  var tg = target();
  state.letters.forEach(function (ll) { tile(ll, tg && ll.id === tg.id, t); });
  state.ghosts.forEach(function (gh) { ctx.save(); ctx.globalAlpha = 0.22 * (1 - gh.t / 0.3); fighter(300 + gh.dx, 420 + gh.dy, 1, gh.pose, t, true, false, 0); ctx.restore(); });
  var pf = state.meA === "hit" && Math.floor(t * 14) % 2 === 0;
  var of = (state.opA === "recoil") && Math.floor(t * 14) % 2 === 0;
  fighter(300 + state.me.dx, 420 + state.me.dy, 1, state.meA, t, true, pf, 0);
  var op = state.opA;
  if (state.opp.air && (op === "idle" || op === "recover")) op = "launched";
  fighter(660 + state.opp.ox, 420 + state.opp.oy, -1, op, t, false, of, state.opp.rot);
  if (state.fx) impact(state.fx);
  parts.forEach(function (q) {
    ctx.save(); ctx.globalAlpha = 1 - q.life / q.max; ctx.fillStyle = q.col;
    ctx.font = "900 " + q.s + "px system-ui, Arial"; ctx.textAlign = "center"; ctx.fillText(q.txt, q.x, q.y); ctx.restore();
  });
  dust.forEach(function (d2) {
    ctx.save(); ctx.globalAlpha = 0.6 * (1 - d2.life / d2.max); ctx.fillStyle = "#cbb98f";
    ctx.beginPath(); ctx.arc(d2.x, d2.y, 8 + d2.life * 30, 0, 7); ctx.fill(); ctx.restore();
  });
  ctx.restore();
}

/* input */
function press(ch) {
  if (state.status !== "playing") return;
  var tg = target();
  if (!tg) return;
  if (tg.word) {
    if (ch === tg.word[tg.prog]) {
      tg.prog++; state.typed++;
      sfx(600 + tg.prog * 40, 0.05, "square", 0.04);
      if (tg.prog >= tg.word.length) hit(tg); else hud();
    } else { state.wrong++; state.combo = 0; sfx(180, 0.07, "square", 0.04); hud(); }
    return;
  }
  var c = state.letters.filter(function (l) { return !l.word && l.ch === ch; });
  if (c.length) { c.sort(function (a, b) { return b.y - a.y; }); state.typed++; hit(c[0]); }
  else { state.wrong++; state.combo = 0; sfx(180, 0.07, "square", 0.04); hud(); }
}
function pauseGame() {
  if (state.mode === "online") { toast("No pausing a live race!"); return; }
  if (state.status !== "playing") return;
  state.status = "paused";
  overlay("Paused", esc(state.playerName) + " · take a breath", "Resume", resumeGame);
  setShare(null);
}
function resumeGame() {
  if (state.status !== "paused") return;
  state.status = "playing";
  state.endAt = performance.now() + state.left * 1000;
  hideOverlay();
}
document.addEventListener("keydown", function (e) {
  if (e.key === " " || e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
  if (document.activeElement === el.mobile) return; // mobile input handles itself
  var k = e.key;
  if (k === "Escape" || (e.shiftKey && (k === "P" || k === "p"))) {
    if (state.status === "playing") pauseGame();
    else if (state.status === "paused") resumeGame();
    e.preventDefault();
    return;
  }
  if (k === "Enter") {
    if (state.status === "setup") startSolo();
    else if (["roundComplete", "gameOver", "paused", "swap", "winner", "await"].indexOf(state.status) >= 0) el.ovMain.click();
    return;
  }
  if ((k === "r" || k === "R") && ["gameOver", "winner"].indexOf(state.status) >= 0) { el.ovMain.click(); return; }
  if (/^[a-zA-Z]$/.test(k)) press(k.toUpperCase());
});
el.mobile.addEventListener("input", function () {
  var v = el.mobile.value.toUpperCase().replace(/[^A-Z]/g, "");
  if (v.length) press(v[v.length - 1]);
  el.mobile.value = "";
});
canvas.addEventListener("pointerdown", function () { try { el.mobile.focus({ preventScroll: true }); } catch (e) {} });

$("btn-start").addEventListener("click", startSolo);
$("btn-contest").addEventListener("click", startContest);
$("btn-board").addEventListener("click", function () { show("board"); renderBoard(); });
function setTab(t) {
  boardTab = t;
  ["solo", "contest", "online", "matches"].forEach(function (x) { $("tab-" + x).classList.toggle("on", x === t); });
  renderBoard();
}
$("tab-solo").addEventListener("click", function () { setTab("solo"); });
$("tab-contest").addEventListener("click", function () { setTab("contest"); });
$("tab-matches").addEventListener("click", function () { setTab("matches"); });
$("tab-online").addEventListener("click", function () { setTab("online"); });
$("btn-clear").addEventListener("click", function () {
  if (boardTab === "matches") { try { localStorage.setItem(MATCH_KEY, "[]"); } catch (e) {} }
  else saveB(loadB().filter(function (e) { return (e.mode || "solo") !== boardTab; }));
  renderBoard();
});
$("btn-create").addEventListener("click", function () {
  net.myName = clean($("net-name").value || el.soloName.value, "YOU");
  try { localStorage.setItem("kw_last_name", net.myName); } catch (e) {}
  needPeer(function () {
    stopNet();
    var code = roomCode();
    net.role = "host"; net.code = code; net.myName = clean($("net-name").value || el.soloName.value, "YOU");
    netStatus("Creating room " + code + "…");
    try { net.peer = new Peer(PEER_PRE + code); } catch (e) { netStatus("Relay error — try again."); return; }
    net.peer.on("open", function () {
      netStatus("Room " + code + " live — send the invite, then wait here.");
      $("invite-row").classList.remove("hidden");
      $("room-code").textContent = code;
    });
    net.peer.on("connection", function (c) {
      netStatus("Rival knocking — shaking hands…");
      wireConn(c);
      if (net.waitHello) clearTimeout(net.waitHello);
      net.waitHello = setTimeout(function () {
        net.waitHello = null;
        try { c.close(); } catch (e) {}
        netStatus("Knocked but no handshake — ask your rival to rejoin.");
      }, 12000);
    });
    net.peer.on("disconnected", function () {
      netStatus("Lost relay — reconnecting…");
      try { net.peer.reconnect(); } catch (e) {}
    });
    net.peer.on("error", function (e) {
      if (e && e.type === "unavailable-id") { netStatus("Code clash — retrying…"); setTimeout(function () { $("btn-create").click(); }, 800); }
      else netStatus("Relay hiccup — try again.");
    });
  });
});
$("btn-join").addEventListener("click", function () {
  var code = clean($("join-code").value, "");
  if (code.length !== 4) { netStatus("Enter the 4-letter room code."); return; }
  net.myName = clean($("net-name").value || el.soloName.value, "YOU");
  try { localStorage.setItem("kw_last_name", net.myName); } catch (e) {}
  needPeer(function () {
    stopNet();
    net.role = "guest"; net.code = code; net.myName = clean($("net-name").value || el.soloName.value, "YOU");
    netStatus("Joining " + code + "…");
    var peer;
    try { peer = new Peer(); net.peer = peer; } catch (e) { netStatus("Relay error — try again."); return; }
    peer.on("open", function () {
      var c = peer.connect(PEER_PRE + code, { reliable: true });
      wireConn(c);
      net.helloN = 0;
      c.on("open", function () {
        netStatus("Connected — shaking hands…");
        send({ t: "hello", name: net.myName });
        if (net.helloTimer) clearInterval(net.helloTimer);
        net.helloTimer = setInterval(function () {
          if (state.mode === "online") { clearInterval(net.helloTimer); net.helloTimer = null; return; }
          net.helloN++;
          if (net.helloN > 8) {
            clearInterval(net.helloTimer); net.helloTimer = null;
            netStatus("Couldn't connect — is the host still on this page? Check the code.");
            stopNet();
            return;
          }
          send({ t: "hello", name: net.myName });
        }, 1500);
      });
    });
    peer.on("disconnected", function () {
      netStatus("Lost relay — reconnecting…");
      try { peer.reconnect(); } catch (e) {}
    });
    peer.on("error", function (e) {
      if (e && e.type === "peer-unavailable") netStatus("Room not found — check the code.");
      else netStatus("Relay hiccup — try again.");
    });
  });
});
$("btn-invite").addEventListener("click", function () {
  if (!net.code) return;
  var url = inviteLink(net.code);
  if (navigator.share) { navigator.share({ title: "Join my fight", text: "Race me in Stickman Typing Fighter!", url: url }).catch(function () {}); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(function () { netStatus("Invite copied — send it to your friend!"); }, function () { prompt("Copy invite:", url); });
  } else prompt("Copy invite:", url);
});
$("btn-leave").addEventListener("click", function () {
  stopNet();
  netStatus("Room closed.");
});
$("btn-pause").addEventListener("click", function () {
  pauseGame();
});
var quitArm = null;
el.ovQuit.addEventListener("click", quit);
$("btn-quit").addEventListener("click", function () {
  if (state.status !== "playing") { quit(); return; }
  if (quitArm) { clearTimeout(quitArm); quitArm = null; $("btn-quit").textContent = "✕ Quit"; quit(); return; }
  $("btn-quit").textContent = "Sure?";
  quitArm = setTimeout(function () { quitArm = null; $("btn-quit").textContent = "✕ Quit"; }, 3000);
});
el.muteBtn.addEventListener("click", function () { muted = !muted; el.muteBtn.textContent = muted ? "🔇 Muted" : "🔊 Sound"; });

/* theme: dark / light, remembered */
(function theme() {
  var btn = $("btn-theme");
  function paint(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("kw_theme", t); } catch (e) {}
    btn.textContent = t === "dark" ? "☀️ Light" : "🌙 Dark";
  }
  var init = "light";
  try { init = localStorage.getItem("kw_theme") || (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"); } catch (e) {}
  paint(init);
  btn.addEventListener("click", function () {
    paint(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
  });
})();

try { var ln = localStorage.getItem("kw_last_name"); if (ln) { el.soloName.value = ln; $("net-name").value = ln; } } catch (e) {}
renderBoard(); hud(); checkShared();

/* offline + installable (GitHub Pages / https only; file:// keeps working without it) */
var APP_VER = "v1.5";
try { el.appVer.textContent = APP_VER; } catch (e) {}
try {
  if (location.protocol.indexOf("http") === 0 && "serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").then(function (reg) {
        function useWaiting() {
          try { if (reg.waiting) reg.waiting.postMessage({ type: "SKIP_WAITING" }); } catch (e) {}
        }
        function poke() { try { reg.update(); } catch (e) {} }
        poke();
        setInterval(poke, 60000);
        if (reg.waiting && navigator.serviceWorker.controller) useWaiting();
        reg.addEventListener("updatefound", function () {
          var sw = reg.installing;
          if (!sw) return;
          sw.addEventListener("statechange", function () {
            if (sw.state === "installed" && navigator.serviceWorker.controller) useWaiting();
          });
        });
      }).catch(function () {});
    });
    (function () {
      var reloaded = false;
      navigator.serviceWorker.addEventListener("controllerchange", function () {
        if (reloaded) return; reloaded = true;
        if (state.status === "playing") toast("Update ready — applies after this match");
        else window.location.reload();
      });
    })();
  }
} catch (e) {}
requestAnimationFrame(frame);
})();
