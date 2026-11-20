// ============================================================
//  Mind & Venture — beta_map.js   (CAPTAIN: Paulo)
//  Read-only world map screen for the known MV2 realm.
//
//  Paulo's work dump, line 117: "We need to create a map for the world."
//  Shows Awdjoo Town's three stages (1.1 Suburb -> 1.2 Main District ->
//  1.3 High-Tech) in the washi / sumi / coloured-pencil print palette,
//  plus a 67-level vertical scale (ground 0 -> +/-33) with mood bands.
//
//  Self-contained: defines window.MV_MAP and nothing else global. No
//  external images, no gameplay edits, bounded per-frame cost. It is a
//  no-op until main.js / ui.js find window.MV_MAP (script registration is
//  handled by the caller; this module does not touch index.html).
// ============================================================
(function () {
  'use strict';
  var VW = 1024, VH = 768;

  // Washi paper, sumi ink and coloured-pencil hues, matched to the live
  // print palette in claude/js/ink_vinyl.js (PAPER #E9D8C3 / SUMI #0B0D0F).
  var P = {
    paper: '#E9D8C3', paperLite: '#F4E9D8', paperDark: '#DCC6A9',
    sumi: '#0B0D0F', sumiSoft: '#3A3732', subInk: 'rgba(11,13,15,0.45)',
    green: '#7C9B6B', greenD: '#55734F',
    indigo: '#6C638C', rose: '#B97C6A',
    cyan: '#4FB8C8', gold: '#D8A828', red: '#B2403A'
  };

  var STAGES = [
    { id: '1.1', name: 'SUBURB',        mood: 'BUCOLIC / INK WASH', note: 'KNOWL TREE / HOME / STREET' },
    { id: '1.2', name: 'MAIN DISTRICT', mood: 'INK & VINYL',        note: 'CANAL / STEPS / ROOF ARCH' },
    { id: '1.3', name: 'HIGH-TECH',     mood: 'NEON / EMBER DUSK',  note: 'TOWERS / LIFTS / HEPTAGON' }
  ];

  // Deterministic hash -> [0,1). Keeps the paper texture stable frame to frame.
  function rnd(i) { var x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); }

  function hasCtx() {
    return typeof ctx !== 'undefined' && !!ctx &&
           typeof W !== 'undefined' && typeof H !== 'undefined';
  }
  function available() { return hasCtx(); }

  // Text helpers fall back to the raw 2D context if the game's font isn't up.
  function T(s, x, y, col, scl) {
    s = String(s); x = x | 0; y = y | 0; scl = scl || 2;
    if (typeof drawText === 'function') { drawText(s, x, y, col || P.sumi, scl); return; }
    ctx.fillStyle = col || P.sumi; ctx.font = (scl * 8) + 'px monospace'; ctx.fillText(s, x, y + scl * 8);
  }
  function TW(s, scl) {
    if (typeof textW === 'function') return textW(String(s), scl || 2);
    return String(s).length * 8 * (scl || 2);
  }
  function TC(s, cx, y, col, scl) { T(s, Math.round(cx - TW(s, scl) / 2), y, col, scl); }

  function fill(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x, y, w, h); }
  function frame(x, y, w, h, col, lw) {
    ctx.lineWidth = lw || 2; ctx.strokeStyle = col;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  function line(x0, y0, x1, y1, col, lw) {
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.lineWidth = lw || 1; ctx.strokeStyle = col; ctx.stroke();
  }
  function dashed(x0, y0, x1, y1, col, lw) {
    ctx.save(); ctx.setLineDash([8, 8]); line(x0, y0, x1, y1, col, lw); ctx.restore();
  }
  function poly(pts, fillCol, strokeCol, lw) {
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
    for (var i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.closePath();
    if (fillCol) { ctx.fillStyle = fillCol; ctx.fill(); }
    if (strokeCol) { ctx.lineWidth = lw || 1.5; ctx.strokeStyle = strokeCol; ctx.stroke(); }
  }
  function dot(x, y, r, fillCol, strokeCol, dashedRing) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    if (fillCol) { ctx.fillStyle = fillCol; ctx.fill(); }
    if (strokeCol) {
      if (dashedRing) ctx.setLineDash([4, 4]);
      ctx.lineWidth = 3; ctx.strokeStyle = strokeCol; ctx.stroke();
      if (dashedRing) ctx.setLineDash([]);
    }
  }

  function stageInfo() {
    var cur = '1.1', prog = 0;
    try {
      var B = window.MV_BETA;
      if (B) {
        if (B.stageId) cur = B.stageId;
        prog = Math.max(0, Math.min(STAGES.length - 1, B.progress || 0));
      }
    } catch (e) {}
    return { cur: cur, prog: prog };
  }
  function statusOf(idx, info) {
    if (STAGES[idx].id === info.cur) return 2;          // current stage
    return idx <= info.prog ? 1 : 0;                    // discovered / uncharted
  }
  function inkFor(st) {
    return st === 2 ? P.gold : st === 1 ? P.sumi : 'rgba(58,55,50,0.4)';
  }

  // ── Paper, border and header ──────────────────────────────────
  function drawPaper() {
    fill(0, 0, VW, VH, P.paper);
    for (var i = 0; i < 150; i++) {
      var fx = rnd(i * 3) * VW, fy = rnd(i * 3 + 1) * VH, fl = 8 + rnd(i * 3 + 2) * 38;
      ctx.globalAlpha = 0.04 + rnd(i * 7) * 0.07;
      ctx.fillStyle = (i % 4 === 0) ? P.rose : P.sumiSoft;
      ctx.fillRect(fx, fy, fl, 1);
    }
    ctx.globalAlpha = 1;
    var g = ctx.createRadialGradient(VW / 2, VH / 2, 170, VW / 2, VH / 2, 730);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(70,45,20,0.18)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    frame(10, 10, VW - 20, VH - 20, P.sumi, 3);
    frame(15, 15, VW - 30, VH - 30, 'rgba(11,13,15,0.28)', 1);
  }
  function drawHeader() {
    fill(16, 16, VW - 32, 86, P.sumi);
    poly([[16, 102], [VW - 16, 102], [VW - 16, 107], [16, 107]], P.sumi);
    T('AWDJOO TOWN', 42, 31, P.paperLite, 4);
    T('WORLD MAP  /  THE KNOWN REALM', 44, 74, P.gold, 2);
    TC('MV2 / FIELD ATLAS', VW - 158, 36, '#D2C2AB', 2);
    TC('STAGES 1.1 - 1.3', VW - 158, 66, '#A29683', 2);
  }

  // ── Shared stage badge ────────────────────────────────────────
  function badge(cx, cy, info, idx) {
    var st = statusOf(idx, info), ink = inkFor(st), s = STAGES[idx];
    dot(cx, cy, 22, st === 2 ? P.gold : (st === 1 ? P.paperLite : 'rgba(244,233,216,0.4)'), ink, st === 0);
    TC(s.id, cx, cy - 9, st === 0 ? 'rgba(58,55,50,0.55)' : P.sumi, 2);
    TC(s.name, cx, cy + 30, st === 0 ? 'rgba(58,55,50,0.45)' : P.sumi, 2);
    TC(s.mood, cx, cy + 48, st === 0 ? 'rgba(58,55,50,0.32)' : ink, 2);
    if (st === 2) TC('* CURRENT *', cx, cy + 66, P.red, 2);
    else if (st === 0) TC('UNCHARTED', cx, cy + 66, 'rgba(58,55,50,0.35)', 2);
  }

  // ── District 1.1: the suburban street ────────────────────────
  function drawSuburb(info) {
    poly([[62, 512], [130, 452], [200, 478], [268, 430], [268, 548], [62, 548]],
      P.green, P.greenD, 2);
    for (var i = 0; i < 5; i++) {
      var hx = 78 + i * 39, hy = 470 - (i % 2) * 26, hw = 26, hh = 20;
      fill(hx, hy, hw, hh, P.paperLite);
      poly([[hx - 3, hy], [hx + hw / 2, hy - 14], [hx + hw + 3, hy]], P.rose, P.sumi, 1.5);
      fill(hx + 10, hy + 8, 6, 7, P.sumiSoft);
      frame(hx, hy, hw, hh, P.sumiSoft, 1);
    }
    ctx.save(); ctx.globalAlpha = 0.85;
    fill(210, 500, 52, 30, P.cyan);
    ctx.beginPath(); ctx.ellipse(236, 515, 30, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = P.cyan; ctx.fill(); ctx.restore();
    dashed(165, 548, 165, 250, P.sumiSoft, 2);
    badge(165, 178, info, 0);
  }

  // ── District 1.2: main district / canal ──────────────────────
  function drawMain(info) {
    for (var r = 0; r < 3; r++) for (var c = 0; c < 3; c++) {
      var bx = 306 + c * 72, by = 272 + r * 68;
      fill(bx, by, 54, 48, (r + c) % 2 ? P.indigo : P.rose);
      frame(bx, by, 54, 48, P.sumiSoft, 1.5);
      ctx.globalAlpha = 0.5; fill(bx + 6, by + 8, 42, 3, P.paperLite);
      fill(bx + 6, by + 20, 42, 3, P.paperLite); ctx.globalAlpha = 1;
    }
    ctx.save(); ctx.globalAlpha = 0.9;
    fill(300, 496, 224, 38, P.indigo);
    for (var w = 0; w < 4; w++) fill(306 + w * 54, 500 + (w % 2) * 4, 30, 26, P.cyan);
    ctx.restore();
    poly([[392, 302], [410, 286], [428, 302], [428, 318], [392, 318]], null, P.sumi, 2);
    fill(410, 304, 8, 14, P.gold);
    dashed(410, 548, 410, 318, P.sumiSoft, 2);
    badge(410, 178, info, 1);
  }

  // ── District 1.3: high-tech towers ───────────────────────────
  function drawHighTech(info) {
    var towers = [[562, 356, 56, 192], [626, 326, 58, 222], [692, 296, 56, 252]];
    for (var t = 0; t < towers.length; t++) {
      var q = towers[t];
      fill(q[0], q[1], q[2], q[3], t === 2 ? P.sumiSoft : P.indigo);
      frame(q[0], q[1], q[2], q[3], P.sumi, 2);
      for (var fy = q[1] + 14; fy < q[1] + q[3] - 8; fy += 22) {
        ctx.globalAlpha = 0.45 + (t === 2 ? 0.2 : 0);
        fill(q[0] + 7, fy, q[2] - 14, 6, t === 2 ? P.cyan : P.paperLite);
      }
      ctx.globalAlpha = 1;
      line(q[0] + q[2] / 2, q[1], q[0] + q[2] / 2, q[1] - 18, P.sumi, 2);
    }
    // circuit traces
    for (var i = 0; i < 6; i++) {
      var cy = 364 + i * 30;
      line(556, cy, 574, cy, P.cyan, 1); dot(576, cy, 2, P.cyan);
      line(748, cy, 730, cy, P.cyan, 1); dot(728, cy, 2, P.cyan);
    }
    // the Heptagon's crown, down in the arena
    var hp = [], hx = 722, hy = 524;
    for (var a = 0; a < 7; a++) hp.push([hx + Math.cos(a * Math.PI * 2 / 7 - Math.PI / 2) * 18,
                                         hy + Math.sin(a * Math.PI * 2 / 7 - Math.PI / 2) * 18]);
    poly(hp, P.gold, P.sumi, 2); dot(hx, hy, 5, P.sumi);
    badge(645, 178, info, 2);
  }

  function drawMapPanel(info) {
    var x0 = 36, y0 = 120, w = 736, h = 516;
    fill(x0, y0, w, h, P.paperLite);
    frame(x0, y0, w, h, P.subInk, 2);
    // faint survey grid
    ctx.globalAlpha = 0.07; ctx.strokeStyle = P.sumiSoft; ctx.lineWidth = 1;
    for (var gx = x0 + 40; gx < x0 + w; gx += 40) { ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 + h); ctx.stroke(); }
    for (var gy = y0 + 40; gy < y0 + h; gy += 40) { ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0 + w, gy); ctx.stroke(); }
    ctx.globalAlpha = 1;

    drawSuburb(info); drawMain(info); drawHighTech(info);

    // progression route
    dashed(192, 178, 382, 178, P.gold, 3);
    dashed(438, 178, 617, 178, P.gold, 3);
    poly([[384, 178], [374, 172], [374, 184]], P.gold);
    poly([[616, 178], [606, 172], [606, 184]], P.gold);
    T('AWDJOO TOWN', x0 + 12, y0 + 8, P.subInk, 2);
    T('PLAN', x0 + w - 70, y0 + 8, P.subInk, 2);
  }

  // ── 67-level vertical scale with mood bands ──────────────────
  function drawScalePanel(info) {
    var x0 = 790, y0 = 120, w = 198, h = 516;
    fill(x0, y0, w, h, P.paperLite);
    frame(x0, y0, w, h, P.subInk, 2);
    TC('VERTICAL SCALE', x0 + w / 2, y0 + 10, P.sumi, 2);
    TC('67 LEVELS / -33 TO +33', x0 + w / 2, y0 + 34, P.subInk, 2);

    var top = 200, bot = 560, per = (bot - top) / 66;
    function yAt(lv) { return top + (33 - lv) * per; }
    // Mood bands: cyan skyline, indigo towers, gold ground, rose canal, red deep.
    var bands = [[33, 12, P.cyan], [12, 1, P.indigo], [1, -1, P.gold],
                 [-1, -16, P.rose], [-16, -33, P.red]];
    for (var b = 0; b < bands.length; b++) {
      var yA = yAt(bands[b][0]), yB = yAt(bands[b][1]);
      ctx.globalAlpha = 0.22; fill(814, yA, 104, yB - yA, bands[b][2]); ctx.globalAlpha = 1;
      line(814, yA, 918, yA, 'rgba(11,13,15,0.22)', 1);
    }
    // ruler spine + level numbers
    line(808, top, 808, bot, P.sumi, 3);
    for (var lv = -20; lv <= 20; lv += 10) {
      var ty = yAt(lv);
      line(808, ty, 824, ty, P.sumi, 2);
      T((lv > 0 ? '+' : '') + lv, 830, ty - 8, P.sumiSoft, 2);
    }
    T('+33', 830, yAt(33) - 8, P.sumi, 2);
    T('-33', 830, yAt(-33) - 10, P.sumi, 2);
    line(804, yAt(0), 918, yAt(0), P.gold, 2);
    // stage markers sit on the spine (colour = discovered / current)
    var marks = [0, -7, 20];
    for (var m = 0; m < marks.length; m++) dot(808, yAt(marks[m]), 5, inkFor(statusOf(m, info)), P.sumi);
    // compact mood legend
    var legend = [[P.cyan, 'SKY'], [P.gold, 'GROUND'], [P.red, 'DEEP']];
    for (var i = 0; i < legend.length; i++) {
      fill(806, y0 + h - 68 + i * 22, 12, 10, legend[i][0]);
      T(legend[i][1], 824, y0 + h - 67 + i * 22, P.sumiSoft, 2);
    }
  }

  function drawFooter() {
    fill(16, 650, VW - 32, 102, P.sumi);
    T('LEGEND', 40, 664, P.paperLite, 2);
    dot(52, 692, 9, P.gold, P.sumi); T('CURRENT STAGE', 70, 684, P.paperLite, 2);
    dot(52, 718, 9, P.paperLite, P.sumi); T('DISCOVERED', 70, 710, P.paperLite, 2);
    dot(52, 744, 9, 'rgba(244,233,216,0.35)', 'rgba(244,233,216,0.6)', true);
    T('UNCHARTED', 70, 736, P.paperLite, 2);
    TC('M  OPEN MAP      ESC / B  CLOSE', 712, 680, P.gold, 2);
    TC('READ-ONLY / NO GAMEPLAY CHANGES', 712, 708, '#A29683', 2);
    TC('SUBURB  >  MAIN DISTRICT  >  HIGH-TECH', 712, 732, '#A29683', 2);
  }

  function draw() {
    if (!available()) return;
    ctx.save();
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.setLineDash([]);
    var s = Math.min(W / VW, H / VH);
    ctx.translate(Math.round((W - VW * s) / 2), Math.round((H - VH * s) / 2));
    ctx.scale(s, s);
    var info = stageInfo();
    drawPaper(); drawHeader(); drawMapPanel(info); drawScalePanel(info); drawFooter();
    ctx.restore();
  }

  // Hooks used by ui.js and by headless screenshot probes.
  function open() { try { _gameState = 'map'; } catch (e) {} }
  function close() { try { if (_gameState === 'map') _gameState = 'game'; } catch (e) {} }

  window.MV_MAP = {
    available: available,
    draw: draw,
    open: open,
    close: close,
    info: stageInfo,
    stages: STAGES,
    KEY: 'KeyM'
  };
})();
