// Phone landscape play shell — CSS classes + orientation + HUD vis.
// Desktop layout is unchanged unless this script tags <html> as phone-play.
(function () {
  const root = document.documentElement;
  const ua = navigator.userAgent || '';
  const ios = /iP(hone|ad|od)/.test(ua);
  const mobileUa = /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile/i.test(ua)
    || (/Android/i.test(ua) && /Mobile/i.test(ua));
  const tabletUa = /iPad|Android(?!.*Mobile)/i.test(ua)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const coarse = (function () {
    try { return window.matchMedia('(hover: none) and (pointer: coarse)').matches; }
    catch (e) { return false; }
  })();
  const shortSide = Math.min(screen.width || 9999, screen.height || 9999);
  const phone = mobileUa || (coarse && shortSide <= 920) || (tabletUa && coarse);

  window._phonePlay = phone;
  if (!phone) return;

  root.classList.add('phone-play');

  function isLand() {
    try {
      if (window.matchMedia('(orientation: landscape)').matches) return true;
    } catch (e) {}
    return window.innerWidth > window.innerHeight;
  }

  function syncOri() {
    const land = isLand();
    root.classList.toggle('land', land);
    root.classList.toggle('port', !land);
  }

  syncOri();
  addEventListener('orientationchange', syncOri);
  addEventListener('resize', syncOri);
  if (window.visualViewport) visualViewport.addEventListener('resize', syncOri);

  let entered = false;
  window._phoneEnterPlay = function () {
    if (entered) return;
    entered = true;
    try {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(function () {});
      }
    } catch (e) {}
    if (!ios && document.documentElement.requestFullscreen && !document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    }
  };

  window._syncPhoneHud = function () {
    const hud = document.getElementById('touchHud');
    if (!hud) return;
    const play = typeof _gameState !== 'undefined' && _gameState === 'game';
    hud.classList.toggle('in-game', play);
    if (play) window._phoneEnterPlay();
  };
})();
