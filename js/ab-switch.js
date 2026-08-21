/* MV2 A/B switcher — never overwrite A with an experiment.
   A = live Awdjoo game. B = clean-collision lab.
   Bookmark: index.html?ab=a  |  clean-collision-core.html?ab=b
*/
(function () {
  var page = (document.documentElement.getAttribute('data-ab') || 'a').toLowerCase();
  var want = '';
  try { want = (new URLSearchParams(location.search).get('ab') || '').toLowerCase(); } catch (e) {}
  if (want === 'a' && page !== 'a') { location.replace('index.html?ab=a'); return; }
  if (want === 'b' && page !== 'b') { location.replace('clean-collision-core.html?ab=b'); return; }
  try { localStorage.setItem('mv_ab', want === 'a' || want === 'b' ? want : page); } catch (e) {}

  var css = document.createElement('style');
  css.textContent =
    '#mvAbBar{position:sticky;top:0;z-index:99999;display:flex;gap:8px;align-items:stretch;' +
    'padding:8px 10px;background:#12081c;border-bottom:3px solid #8ab4ff;' +
    'font:700 16px/1.2 ui-monospace,Menlo,Consolas,monospace;box-sizing:border-box;width:100%}' +
    '#mvAbBar .lab{color:#8ab4ff;padding:10px 6px;white-space:nowrap}' +
    '#mvAbBar a{flex:1;text-align:center;padding:14px 8px;border:2px solid #556;' +
    'color:#eee;text-decoration:none;background:#1a1a28;border-radius:6px}' +
    '#mvAbBar a.on{background:#8ab4ff;color:#111;border-color:#fff}' +
    '#mvAbBar a:not(.on):hover{border-color:#8ab4ff;color:#fff}' +
    'body{padding-top:0}';
  document.head.appendChild(css);

  var bar = document.createElement('div');
  bar.id = 'mvAbBar';
  bar.innerHTML =
    '<span class="lab">A/B</span>' +
    '<a class="' + (page === 'a' ? 'on' : '') + '" href="index.html?ab=a">A · Awdjoo (live)</a>' +
    '<a class="' + (page === 'b' ? 'on' : '') + '" href="clean-collision-core.html?ab=b">B · Clean collision</a>';

  function mount() {
    if (!document.body || document.getElementById('mvAbBar')) return;
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
