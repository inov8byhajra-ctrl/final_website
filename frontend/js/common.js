/* =====================================================================
   common.js – small helpers shared by EVERY page
   ===================================================================== */

// Short for document.querySelector
const $ = s => document.querySelector(s);

// localStorage helper:  st.get('key', defaultValue)  /  st.set('key', value)
const st = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch (e) { return d } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) {} }
};

// If "Keep me signed in" was OFF and the browser was closed, sign the user out
try {
  const session = st.get('if_session', null);
  if (session && session.k === 0 && !sessionStorage.getItem('if_tab')) localStorage.removeItem('if_session');
} catch (e) {}

// Makes user text safe before it is put inside HTML
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Icons (SVG paths) – ic('Home') gives the full <svg> for that icon
const ICONS = {
  Home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  Dashboard: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
  Data: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3"/>',
  Unify: '<path d="M4 6h6v4H4zM4 14h6v4H4zM14 10h6v4h-6zM10 8h2v8h-2"/>',
  Ask: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  PL: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>',
  Forecast: '<path d="M3 17l6-6 4 4 8-9M15 6h6v6"/>',
  Advisory: '<path d="M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3zM9 21h6"/>',
  Doctor: '<path d="M12 21s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9zM8 12h2l1-2 2 4 1-2h2"/>',
  Security: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4"/>'
};
const ic = name => `<svg viewBox="0 0 24 24">${ICONS[name]}</svg>`;
