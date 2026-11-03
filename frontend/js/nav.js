/* =====================================================================
   nav.js – mobile menu (three lines -> sidebar) for the public pages
   (index.html, about.html). Needs common.js loaded first.
   ===================================================================== */
(function () {
  const burger = $('#navBurger'), drawer = $('#navDrawer'), scrim = $('#navScrim');
  if (!burger || !drawer || !scrim) return;

  function setOpen(open, returnFocus) {
    drawer.classList.toggle('open', open);
    scrim.classList.toggle('on', open);
    burger.classList.toggle('on', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    drawer.setAttribute('aria-hidden', !open);
    document.body.classList.toggle('nav-lock', open);
    if (open) $('#navClose').focus();
    else if (returnFocus) burger.focus();
  }

  burger.addEventListener('click', () => setOpen(!drawer.classList.contains('open')));
  $('#navClose').addEventListener('click', () => setOpen(false, true));
  scrim.addEventListener('click', () => setOpen(false));
  drawer.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
  addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('open')) setOpen(false, true); });
  addEventListener('resize', () => { if (innerWidth > 900 && drawer.classList.contains('open')) setOpen(false); });

  // Already signed in? Change the Login / Sign up buttons (header + sidebar)
  if (st.get('if_session', null)) {
    ['#nl', '#dnl'].forEach(s => { const a = $(s); if (a) { a.textContent = 'Open app'; a.href = 'home.html'; } });
    ['#ns', '#dns'].forEach(s => { const a = $(s); if (a) a.style.display = 'none'; });
  }
})();
