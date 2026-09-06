// Phone landscape play shell — CSS classes + orientation.
// Desktop stays unchanged unless this tags <html> as phone-play.
(function () {
  const root = document.documentElement;
  const ua = navigator.userAgent || '';
  const ios = /iP(hone|ad|od)/.test(ua);

  function forced() {
    try { return /(?:^|[?&])phone=1(?:&|$)/i.test(location.search); }
    catch (e) { return false; }
  }
  function coarsePtr() {
    try { return window.matchMedia('(hover: none) and (pointer: coarse)').matches; }
    catch (e) { return false; }
  }
  function looksPhone() {
    if (forced()) return true;
    const mobileUa = /iPhone|iPod|Android.+Mobile|webOS|BlackBerry|IEMobile/i.test(ua);
    const tabletUa = /iPad|Android(?!.*Mobile)/i.test(ua)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const shortScreen = Math.min(screen.width || 9999, screen.height || 9999) <= 1024;
    const shortView = Math.min(window.innerWidth || 9999, window.innerHeight || 9999) <= 540;
    return mobileUa || tabletUa || (coarsePtr() && (shortScreen || shortView)) || shortView;
  }
  function isLand() {
    try {
      if (window.matchMedia('(orientation: landscape)').matches) return true;
    } catch (e) {}
    return window.innerWidth > window.innerHeight;
  }

  function apply() {
    const phone = looksPhone();
    const land = isLand();
    window._phonePlay = phone;
    root.classList.toggle('phone-play', phone);
    root.classList.toggle('land', phone && land);
    root.classList.toggle('port', phone && !land);
    const hud = document.getElementById('touchHud');
    if (hud) hud.classList.add('in-game');
  }

  apply();
  addEventListener('orientationchange', apply);
  addEventListener('resize', apply);
  if (window.visualViewport) visualViewport.addEventListener('resize', apply);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', apply);

  let entered = false;
  window._phoneEnterPlay = function () {
    if (entered || !window._phonePlay) return;
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
    apply();
    if (typeof _gameState !== 'undefined' && _gameState === 'game') window._phoneEnterPlay();
  };
})();
