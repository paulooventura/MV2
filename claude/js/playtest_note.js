// ============================================================
//  playtest_note.js — F9 while playing: stamp a short note
//  Local-first (localStorage JSONL mirror) + POST to Studio HQ
//  when http://127.0.0.1:7791 is up. Paulo 2026-11-27.
// ============================================================
(function () {
  'use strict';
  if (window.MV_PLAYTEST) return;

  const HQ = 'http://127.0.0.1:7791/api/playtest-note';
  const LS_KEY = 'mv2.playtest.notes';
  const MAX_NOTE = 400;
  const MAX_LOCAL = 80;

  let open = false;
  let root = null;
  let input = null;
  let metaEl = null;
  let snap = null;

  function clip(s, n) {
    return String(s == null ? '' : s).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, n);
  }

  function zoneName() {
    try {
      if (typeof ZONES !== 'undefined' && typeof _zoneIdx === 'number' && ZONES[_zoneIdx]) {
        return String(ZONES[_zoneIdx].name || ZONES[_zoneIdx].sub || _zoneIdx);
      }
      const B = window.MV_BETA;
      if (B && B.stageName) return String(B.stageName);
    } catch (e) {}
    return '';
  }

  function capture() {
    const B = window.MV_BETA || {};
    let x = null, y = null;
    try {
      if (typeof p !== 'undefined' && p) {
        x = Math.round(p.x || 0);
        y = Math.round(p.y || 0);
      }
    } catch (e) {}
    return {
      at: new Date().toISOString(),
      build: String(window.MV_BUILD || '?'),
      stageId: String(B.stageId || ''),
      zone: zoneName(),
      x: x,
      y: y,
      href: String(location.href || '').slice(0, 240)
    };
  }

  function loadLocal() {
    try {
      const a = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      return Array.isArray(a) ? a : [];
    } catch (e) {
      return [];
    }
  }

  function saveLocal(row) {
    const a = loadLocal();
    a.push(row);
    while (a.length > MAX_LOCAL) a.shift();
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(a));
    } catch (e) {}
    return a.length;
  }

  function toast(msg) {
    try {
      if (typeof uiShowToast === 'function') uiShowToast(msg);
    } catch (e) {}
  }

  function ensureUi() {
    if (root) return;
    const css = document.createElement('style');
    css.textContent =
      '#mvPlayNote{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center;' +
      'background:rgba(12,8,18,.55);font-family:Georgia,"Times New Roman",serif}' +
      '#mvPlayNote.on{display:flex}' +
      '#mvPlayNote .box{width:min(440px,92vw);background:#1a1422;border:2px solid #c9a24a;color:#f3e9da;' +
      'padding:16px 18px 14px;box-shadow:0 12px 40px rgba(0,0,0,.45)}' +
      '#mvPlayNote h3{margin:0 0 6px;font-size:15px;letter-spacing:.04em;color:#c9a24a;font-weight:700}' +
      '#mvPlayNote .meta{font-size:11px;color:#a8977f;margin:0 0 10px;line-height:1.35}' +
      '#mvPlayNote textarea{width:100%;min-height:72px;resize:vertical;box-sizing:border-box;' +
      'background:#0f0b14;border:1px solid #5a4a38;color:#f3e9da;padding:8px 10px;font:13px/1.35 Georgia,serif}' +
      '#mvPlayNote textarea:focus{outline:none;border-color:#c9a24a}' +
      '#mvPlayNote .row{display:flex;gap:8px;justify-content:flex-end;margin-top:10px}' +
      '#mvPlayNote button{font:12px Georgia,serif;padding:6px 12px;border:1px solid #5a4a38;' +
      'background:#2a221a;color:#f3e9da;cursor:pointer}' +
      '#mvPlayNote button.ok{border-color:#c9a24a;color:#c9a24a;font-weight:700}' +
      '#mvPlayNote button:hover{background:#3a3026}';
    document.head.appendChild(css);
    root = document.createElement('div');
    root.id = 'mvPlayNote';
    root.innerHTML =
      '<div class="box" role="dialog" aria-label="Playtest note">' +
      '<h3>PLAYTEST NOTE · F9</h3>' +
      '<p class="meta"></p>' +
      '<textarea maxlength="400" placeholder="What feels off? (Enter to send · Esc to cancel)"></textarea>' +
      '<div class="row"><button type="button" class="cancel">Cancel</button>' +
      '<button type="button" class="ok">Queue for Lucy</button></div></div>';
    document.body.appendChild(root);
    metaEl = root.querySelector('.meta');
    input = root.querySelector('textarea');
    root.querySelector('.cancel').onclick = close;
    root.querySelector('.ok').onclick = submit;
    root.addEventListener('mousedown', function (e) {
      if (e.target === root) close();
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        close();
      } else if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        submit();
      }
      e.stopPropagation();
    });
  }

  function openNote() {
    if (open) return;
    if (typeof _gameState !== 'undefined' && _gameState !== 'game') {
      toast('PLAY FIRST — THEN F9');
      return;
    }
    ensureUi();
    snap = capture();
    metaEl.textContent =
      'build ' + snap.build +
      (snap.stageId ? ' · stage ' + snap.stageId : '') +
      (snap.zone ? ' · ' + snap.zone : '') +
      (snap.x != null ? ' · x' + snap.x + ' y' + snap.y : '');
    input.value = '';
    root.classList.add('on');
    open = true;
    try {
      input.focus();
    } catch (e) {}
  }

  function close() {
    if (!open) return;
    open = false;
    if (root) root.classList.remove('on');
    snap = null;
  }

  function submit() {
    if (!open || !snap) return;
    const text = clip(input.value, MAX_NOTE);
    if (!text) {
      toast('TYPE A SHORT NOTE');
      return;
    }
    const row = Object.assign({}, snap, { note: text, queued: true });
    saveLocal(row);
    const build = row.build || '?';
    toast('NOTE QUEUED FOR LUCY · BUILD ' + build);
    close();

    const body = JSON.stringify(row);
    try {
      fetch(HQ, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        mode: 'cors',
        keepalive: true
      })
        .then(function (r) {
          return r.json().catch(function () {
            return { ok: false };
          });
        })
        .then(function (j) {
          if (j && j.ok) {
            toast('NOTE QUEUED FOR LUCY · BUILD ' + build + (j.tid ? ' · ' + j.tid : ''));
          }
          // silent if HQ is down — local copy already kept
        })
        .catch(function () {});
    } catch (e) {}
  }

  window.addEventListener(
    'keydown',
    function (e) {
      if (e.code !== 'F9' && e.key !== 'F9') return;
      if (e.repeat) return;
      e.preventDefault();
      e.stopPropagation();
      if (open) close();
      else openNote();
    },
    true
  );

  window.MV_PLAYTEST = {
    open: openNote,
    close: close,
    local: loadLocal,
    capture: capture
  };
})();
