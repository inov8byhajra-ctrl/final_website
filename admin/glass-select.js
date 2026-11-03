/* Replaces every <select> with a glass dropdown (pink list, maroon text). The real <select> stays in the page
   (hidden), so .value / onchange / dataset in the existing code keep working. */
(function () {
  var L = null, BTN = null, SEL = null;
  var CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] }) };

  function label(sel, b) { var o = sel.options[sel.selectedIndex]; b.innerHTML = '<span>' + esc(o ? o.text : '') + '</span>' + CHEV }

  function close() {
    if (!L) return;
    L.remove(); L = null;
    if (BTN) { BTN.setAttribute('aria-expanded', 'false'); BTN = null }
    SEL = null;
  }

  function pick(i) {
    var sel = SEL, b = BTN; if (!sel) return;
    sel.selectedIndex = i; label(sel, b);
    sel.dispatchEvent(new Event('input', { bubbles: true }));
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    close(); b.focus();
  }

  function open(sel, b) {
    if (L && SEL === sel) return close();
    close();
    SEL = sel; BTN = b; label(sel, b);
    b.setAttribute('aria-expanded', 'true');
    L = document.createElement('ul'); L.className = 'gs-l'; L.setAttribute('role', 'listbox');
    L.innerHTML = Array.prototype.map.call(sel.options, function (o, i) {
      return '<li role="option" data-i="' + i + '"' + (i === sel.selectedIndex ? ' aria-selected="true"' : '') + '>' + esc(o.text) + '</li>';
    }).join('');
    document.body.appendChild(L);
    var r = b.getBoundingClientRect(), h = L.offsetHeight, below = window.innerHeight - r.bottom - 12;
    L.style.minWidth = r.width + 'px';
    L.style.left = Math.min(r.left, window.innerWidth - L.offsetWidth - 8) + 'px';
    L.style.top = (below >= Math.min(h, 200) || r.top < h ? r.bottom + 6 : r.top - h - 6) + 'px';
    var s = L.querySelector('[aria-selected=true]'); if (s) s.scrollIntoView({ block: 'nearest' });
    L.addEventListener('click', function (e) { var li = e.target.closest('li'); if (li) pick(+li.dataset.i) });
  }

  function move(d) {
    if (!L) return;
    var items = L.querySelectorAll('li'), cur = L.querySelector('li.hi') || L.querySelector('[aria-selected=true]'), i = Array.prototype.indexOf.call(items, cur);
    i = Math.max(0, Math.min(items.length - 1, i + d));
    Array.prototype.forEach.call(items, function (x) { x.classList.remove('hi') });
    items[i].classList.add('hi'); items[i].scrollIntoView({ block: 'nearest' });
  }

  function enhance(sel) {
    if (sel.dataset.gs || sel.multiple || sel.closest('.gs')) return;
    sel.dataset.gs = '1';
    var w = document.createElement('div'); w.className = 'gs';
    var b = document.createElement('button'); b.type = 'button'; b.className = 'gs-b';
    b.setAttribute('aria-haspopup', 'listbox'); b.setAttribute('aria-expanded', 'false');
    if (sel.getAttribute('aria-label')) b.setAttribute('aria-label', sel.getAttribute('aria-label'));
    sel.parentNode.insertBefore(w, sel); w.appendChild(sel); w.appendChild(b);
    sel.classList.add('gs-native'); sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    label(sel, b);
    b.addEventListener('click', function () { open(sel, b) });
    b.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!L) open(sel, b); else move(e.key === 'ArrowDown' ? 1 : -1) }
      else if ((e.key === 'Enter' || e.key === ' ') && L) { e.preventDefault(); var h = L.querySelector('li.hi'); h ? pick(+h.dataset.i) : close() }
    });
  }

  function scan() { Array.prototype.forEach.call(document.querySelectorAll('select'), enhance) }

  document.addEventListener('mousedown', function (e) { if (L && !L.contains(e.target) && !(BTN && BTN.contains(e.target))) close() }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && L) { e.stopImmediatePropagation(); var b = BTN; close(); if (b) b.focus() } }, true);
  window.addEventListener('resize', close);
  window.addEventListener('scroll', function (e) { if (L && !L.contains(e.target)) close() }, true);

  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
