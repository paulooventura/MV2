/* MV2 A/B switcher — never overwrite A with an experiment.
   A = live Awdjoo game. B = clean-collision lab. C = item sprite lab.
   Bookmark: index.html?ab=a  |  clean-collision-core.html?ab=b  |  item-lab.html?ab=c
*/
(function () {
  var page = (document.documentElement.getAttribute('data-ab') || 'a').toLowerCase();
  var want = '';
  try { want = (new URLSearchParams(location.search).get('ab') || '').toLowerCase(); } catch (e) {}
  if (want === 'a' && page !== 'a') { location.replace('index.html?ab=a'); return; }
  if (want === 'b' && page !== 'b') { location.replace('clean-collision-core.html?ab=b'); return; }
  if (want === 'c' && page !== 'c') { location.replace('item-lab.html?ab=c'); return; }
  try { localStorage.setItem('mv_ab', want === 'a' || want === 'b' || want === 'c' ? want : page); } catch (e) {}

  var css = document.createElement('style');
  css.textContent =
    '#mvAbBar{position:sticky;top:0;z-index:99999;display:flex;gap:8px;align-items:stretch;' +
    'padding:8px 10px;background:#0a0618;border-bottom:2px solid #7868c0;' +
    'font:700 13px/1.2 ui-monospace,Menlo,Consolas,monospace;box-sizing:border-box;width:100%}' +
    '#mvAbBar .lab{color:#c8a0e8;padding:10px 6px;white-space:nowrap}' +
    '#mvAbBar a{flex:1;text-align:center;padding:12px 8px;border:2px solid #3a2878;' +
    'color:#e0c8ff;text-decoration:none;background:#120828;border-radius:0}' +
    '#mvAbBar a.on{background:#24104a;color:#fff4c0;border-color:#f0d070}' +
    '#mvAbBar a:not(.on):hover{border-color:#c8a0e8;color:#fff}' +
    'body{padding-top:0}' +
    'html.phone-play #mvAbBar{display:none!important}';
  document.head.appendChild(css);

  var bar = document.createElement('div');
  bar.id = 'mvAbBar';
  bar.innerHTML =
    '<span class="lab">A/B</span>' +
    '<a class="' + (page === 'a' ? 'on' : '') + '" href="index.html?ab=a">A · Awdjoo (live)</a>' +
    '<a class="' + (page === 'b' ? 'on' : '') + '" href="clean-collision-core.html?ab=b">B · Clean collision</a>' +
    '<a class="' + (page === 'c' ? 'on' : '') + '" href="item-lab.html?ab=c">C · Item lab</a>';

  function mount() {
    if (!document.body || document.getElementById('mvAbBar')) return;
    document.body.insertBefore(bar, document.body.firstChild);
  }
  if (document.body) mount();
  else document.addEventListener('DOMContentLoaded', mount);
})();
