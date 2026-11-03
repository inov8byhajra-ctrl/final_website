/* =====================================================================
   loader.js – logo loader shown while a page loads.
   Loaded in <head> of every page (right after css/style.css).
   Shows on EVERY page load / reload (first visit of the session stays
   a little longer, 1.5s; every other load shows for at least 0.9s).
   The page behind the loader is blurred (see loader.css).
   Other scripts can wait for it:  IF_LOADER.ready(() => { ... })
   ===================================================================== */
(function () {
  var d = document, root = d.documentElement, first = true, el = null, done = false, loaded = d.readyState === 'complete';
  var cbs = [], t0 = Date.now(), MIN = 900;
  try { first = !sessionStorage.getItem('if_loaded'); sessionStorage.setItem('if_loaded', '1'); } catch (e) {}
  if (first) MIN = 1500;

  window.IF_LOADER = { ready: function (cb) { done ? cb() : cbs.push(cb); } };

  function build() {
    if (el || done) return;
    el = d.createElement('div');
    el.id = 'loader';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Loading InsightFlow');
    el.innerHTML =
      '<div class="ld-mark"><span class="ld-glow"></span><span class="ld-track"></span><span class="ld-ring"></span>' +
      '<span class="ld-orbit"><i></i></span><img class="ld-logo" src="images/logo.png" alt=""></div>' +
      '<div class="ld-name">Insight<b>Flow</b></div><div class="ld-bar"><span></span></div>';
    root.appendChild(el);
    root.classList.add('ld-lock');
  }

  function finish() {
    if (done) return;
    done = true;
    cbs.forEach(function (f) { try { f(); } catch (e) {} });
    if (!el) return;
    el.classList.add('out');
    setTimeout(function () { el.remove(); root.classList.remove('ld-lock'); }, 750);
  }

  function onLoad() {
    loaded = true;
    var wait = el ? Math.max(0, MIN - (Date.now() - t0)) : 0;
    setTimeout(finish, wait);
  }

  build(); // always show the loader, on every page load / reload
  loaded ? onLoad() : window.addEventListener('load', onLoad);
  setTimeout(finish, 10000); // safety: never block the site
})();
