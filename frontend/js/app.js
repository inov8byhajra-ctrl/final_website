/* =====================================================================
   app.js – used by the logged-in pages (Home, Dashboard, Data, ...)
   Needs: common.js and GSAP loaded first.

   1. Sample data        3. Page layout (sidebar + page())
   2. Charts             4. 3D scenes (ball, shield, orb)
   ===================================================================== */


/* ---------- 1. Sample data ---------- */
const M   = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
const REV = [74, 82, 96, 91, 112, 124, 131, 128, 142];   // revenue ($K)
const COG = [41, 44, 52, 49, 58, 63, 66, 65, 71];        // cost of goods ($K)
const OPX = [18, 19, 21, 20, 24, 26, 27, 27, 29];        // operating costs ($K)

// One row per month: [month, revenue, cogs, gross profit, opex, net profit]
const pl = () => M.map((m, i) => [m, REV[i], COG[i], REV[i] - COG[i], OPX[i], REV[i] - COG[i] - OPX[i]]);


/* ---------- 2. Charts ---------- */

// Line chart as SVG text. d = values, proj = optional dashed forecast values
function line(d, proj = []) {
  const W = 640, H = 230, base = H - 24;
  const max = Math.max(...d, ...proj) * 1.1;
  const x = i => 40 + i * (W - 60) / (d.length + proj.length - 1);
  const y = v => base - v / max * (H - 44);
  const points = d.map((v, i) => `${x(i)},${y(v)}`).join(' ');

  let s = `<svg class="ch" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9A2C3E" stop-opacity=".25"/><stop offset="1" stop-color="#9A2C3E" stop-opacity="0"/></linearGradient></defs>`;

  // 3 grid lines
  [0, .5, 1].forEach(t => {
    s += `<line x1="40" x2="${W - 10}" y1="${base - t * (H - 44)}" y2="${base - t * (H - 44)}" stroke="rgba(154,44,62,.12)"/>`;
  });

  // filled area + main line
  s += `<polygon points="40,${base} ${points} ${x(d.length - 1)},${base}" fill="url(#gg)"/>`;
  s += `<polyline class="lp" points="${points}" fill="none" stroke="#4A0E17" stroke-width="3" stroke-linejoin="round"/>`;

  // dashed forecast line
  if (proj.length) {
    const pp = [d[d.length - 1], ...proj].map((v, i) => `${x(d.length - 1 + i)},${y(v)}`).join(' ');
    s += `<polyline class="lp" points="${pp}" fill="none" stroke="#9A2C3E" stroke-width="3" stroke-dasharray="7 6"/>`;
  }

  // dots + month labels
  d.forEach((v, i) => {
    s += `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="#fff" stroke="#4A0E17" stroke-width="2"><title>${M[i]}: $${v}K</title></circle>`;
    s += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle">${M[i]}</text>`;
  });
  return s + '</svg>';
}

// Animates every chart line (class "lp") drawing itself
function draw() {
  document.querySelectorAll('.lp').forEach(p => {
    const len = p.getTotalLength ? p.getTotalLength() : 0;
    if (len && !p.getAttribute('stroke-dasharray')) {
      gsap.fromTo(p,
        { strokeDasharray: len, strokeDashoffset: len },
        { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out', onComplete: () => p.style.strokeDasharray = 'none' });
    }
  });
}

// Row of stat cards: kp([[label, value, note], ...])
const kp = items => `<div class="kp">${items.map(([label, value, note]) =>
  `<div class="k"><small>${label}</small><strong>${value}</strong><em>${note}</em></div>`).join('')}</div>`;

// Button group where one button is "on" (6/12 months, 3/6 months). Calls onPick(data-n)
function segmented(sel, onPick) {
  $(sel).onclick = e => {
    const b = e.target.closest('button');
    if (!b) return;
    document.querySelectorAll(sel + ' button').forEach(x => x.classList.toggle('on', x === b));
    onPick(+b.dataset.n);
  };
}


/* ---------- 3. Page layout ---------- */

// Sidebar links: [icon key, file]
const PAGES = [
  ['Home', 'home.html'], ['Dashboard', 'dashboard.html'], ['Data', 'data.html'], ['Doctor', 'datadoctor.html'],
  ['PL', 'pnl.html'], ['Ask', 'ask.html'], ['Forecast', 'forecast.html'], ['Unify', 'unify.html'],
  ['Advisory', 'advisory.html'], ['Security', 'security.html']
];
const NAMES = { PL: 'Profit & Loss', Doctor: 'Data Doctor' };   // names that differ from the icon key

function signOut() {
  localStorage.removeItem('if_session');
  try { sessionStorage.removeItem('if_tab') } catch (e) {}
  location.href = 'index.html';
}

// Every app page calls: page(key, render(user) -> html, init(user))
// Small screens: a top bar with the three-lines button opens the sidebar
function mobileNav() {
  const nav = $('#sn');
  if (!$('.app-top')) {
    document.body.insertAdjacentHTML('afterbegin',
      `<header class="app-top"><a class="brand" href="index.html"><img class="logo" src="images/logo.png" alt=""><span>Insight<b>Flow</b></span></a>` +
      `<button class="nav-burger" id="appBurger" type="button" aria-label="Open menu" aria-expanded="false" aria-controls="sn"><span></span><span></span><span></span></button></header>` +
      `<div class="app-scrim" id="appScrim"></div>`);
  }
  const burger = $('#appBurger'), scrim = $('#appScrim');
  const set = open => {
    nav.classList.toggle('open', open);
    scrim.classList.toggle('on', open);
    burger.classList.toggle('on', open);
    burger.setAttribute('aria-expanded', open);
    burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    document.body.classList.toggle('nav-lock', open);
  };
  burger.onclick = () => set(!nav.classList.contains('open'));
  scrim.onclick = () => set(false);
  addEventListener('keydown', e => { if (e.key === 'Escape') set(false); });
  addEventListener('resize', () => { if (innerWidth > 900) set(false); });
}
// page() function se PEHLE (top level par)
const ROLE_LABEL = { cfo: 'CFO', manager: 'Regional Manager', admin: 'Admin' };

function page(key, render, init) {
  const user = st.get('if_session', null);
  if (!user) {                                   // not signed in -> go to login
    location.replace('login.html?next=' + location.pathname.split('/').pop());
    return;
  }

  const links = PAGES.map(([k, file]) =>
    `<a href="${file}" class="${k === key ? 'on' : ''}" ${k === key ? 'aria-current="page"' : ''}>${ic(k)}${NAMES[k] || k}</a>`).join('');

  const roleTxt = (ROLE_LABEL[user.role] || '') + (user.role === 'manager' && user.region ? ' · ' + user.region : '');

  $('#sn').innerHTML =
    `<a class="brand" href="index.html"><img class="logo" src="images/logo.png" alt=""><span>Insight<b>Flow</b></span></a>` + links +
    `<div class="me"><b>${esc(user.n)}</b>${esc(roleTxt)}<br><a onclick="signOut()" tabindex="0" role="button">Sign out</a></div>`;

  mobileNav();

  $('#pg').dataset.k = key;
  $('#pg').innerHTML = render(user);

  gsap.from('#pg > *,#pg .k,#pg .pn', { opacity: 0, y: 18, duration: .5, stagger: .06, ease: 'back.out(1.4)', clearProps: 'all' });
  if (init) init(user);
  startSessionGuard();
  ballFx();
  fx3d();
}
function startSessionGuard() {
  if (startSessionGuard.on) return;
  startSessionGuard.on = true;
  const check = async () => {
    const s = st.get('if_session', null);
    if (!s || !s.token) return;
    try {
      const res = await fetch(((window.IF && IF.API_BASE) || '') + '/api/users/me', { headers: { Authorization: 'Bearer ' + s.token } });
      if (res.status === 401 || res.status === 403) {
        let msg = 'Your session has ended. Please sign in again.';
        try { msg = (await res.json()).detail || msg } catch (e) {}
        sessionStorage.setItem('if_kicked', msg);
        localStorage.removeItem('if_session');
        location.replace('login.html');
      }
    } catch (e) { /* server offline: ignore */ }
  };
  check();
  setInterval(check, 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
}

/* ---------- 4. 3D scenes ---------- */

// Ball (Data page)
const BALL = (inner = '') => `<div class="ball3d" aria-hidden="true"><i class="gs"></i><div class="fl3"><div class="bt"><div class="rg rb"><i></i></div><div class="sph">${inner}</div><div class="rg rf"><i></i></div></div></div></div>`;

// Ball follows the mouse
function ballFx() {
  const ball = $('.ball3d');
  if (!ball || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const tilt = ball.querySelector('.bt'), sphere = ball.querySelector('.sph');
  addEventListener('mousemove', e => {
    const r = ball.getBoundingClientRect();
    const x = (e.clientX - r.left - r.width / 2) / innerWidth;
    const y = (e.clientY - r.top - r.height / 2) / innerHeight;
    sphere.style.setProperty('--hx', (32 + x * 45) + '%');
    sphere.style.setProperty('--hy', (26 + y * 45) + '%');
    tilt.style.setProperty('--rx', (-y * 22) + 'deg');
    tilt.style.setProperty('--ry', (x * 26) + 'deg');
  }, { passive: true });
}

// Security shield (Security page)
const SHIELD = () => {
  const OUTER = 'M100 12 L176 40 V112 C176 170 141 210 100 228 C59 210 24 170 24 112 V40 Z';
  const INNER = 'M100 26 L164 50 V112 C164 162 134 196 100 213 C66 196 36 162 36 112 V50 Z';
  return `<div class="sc3d sh3d" data-lift="46" aria-hidden="true"><span class="sh-vert">Secure · Verified · Protected</span>
<div class="x-float"><div class="x-tilt">
<svg class="ly l-halo" viewBox="0 0 300 300"><defs><radialGradient id="shGlow"><stop offset="0" stop-color="#D9777F" stop-opacity=".28"/><stop offset="1" stop-color="#D9777F" stop-opacity="0"/></radialGradient></defs><circle cx="150" cy="150" r="148" fill="url(#shGlow)"/><circle class="halo-r" cx="150" cy="150" r="128" fill="none" stroke="rgba(154,44,62,.35)" stroke-width="1.5"/><circle cx="150" cy="150" r="118" fill="none" stroke="rgba(154,44,62,.16)" stroke-width="1" stroke-dasharray="2 7"/></svg>
<svg class="ly l-shield" viewBox="0 0 200 240"><defs>
<linearGradient id="shBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8E2434"/><stop offset=".55" stop-color="#4A0E17"/><stop offset="1" stop-color="#220609"/></linearGradient>
<linearGradient id="shEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4CDB0"/><stop offset=".5" stop-color="#D9777F"/><stop offset="1" stop-color="#9A2C3E"/></linearGradient>
<linearGradient id="shSweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="shClip"><path d="${OUTER}"/></clipPath></defs>
<path d="${OUTER}" fill="url(#shBody)" stroke="url(#shEdge)" stroke-width="3.5" stroke-linejoin="round"/>
<path d="${INNER}" fill="none" stroke="rgba(244,205,176,.32)" stroke-width="1"/>
<path d="M100 26 L164 50 V112 C164 122 163 131 161 139 C130 120 70 120 39 139 C37 131 36 122 36 112 V50 Z" fill="rgba(255,255,255,.07)"/>
<g clip-path="url(#shClip)"><g transform="skewX(-18)"><rect class="sweep" x="-110" y="0" width="54" height="240" fill="url(#shSweep)"/></g></g></svg>
<div class="ly l-core"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="28" fill="none" stroke="rgba(244,205,176,.55)" stroke-width="1.2"/><path class="chk" d="M18 31 L27 40 L43 21" fill="none" stroke="#F4CDB0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
<svg class="ly l-orbit" viewBox="0 0 300 300"><g class="orb-a"><ellipse cx="150" cy="150" rx="146" ry="46" fill="none" stroke="rgba(217,119,127,.55)" stroke-width="1.2" transform="rotate(-24 150 150)"/><circle r="4.5" fill="#F4CDB0"><animateMotion dur="7s" repeatCount="indefinite" path="M4 150 a146 46 0 1 0 292 0 a146 46 0 1 0 -292 0" rotate="auto"/></circle></g>
<g class="orb-b"><ellipse cx="150" cy="150" rx="132" ry="38" fill="none" stroke="rgba(154,44,62,.45)" stroke-width="1" transform="rotate(38 150 150)"/><circle r="3.5" fill="#D9777F"><animateMotion dur="9s" repeatCount="indefinite" path="M18 150 a132 38 0 1 1 264 0 a132 38 0 1 1 -264 0"/></circle></g></svg>
<i class="pt" style="--x:8%;--y:22%;--d:0s;--z:70px"></i><i class="pt" style="--x:90%;--y:30%;--d:1.2s;--z:40px"></i><i class="pt" style="--x:80%;--y:78%;--d:2.1s;--z:80px"></i><i class="pt" style="--x:16%;--y:74%;--d:.7s;--z:30px"></i><i class="pt" style="--x:50%;--y:2%;--d:1.7s;--z:60px"></i>
</div></div><div class="x-floor"></div><p class="x-cap">Move your cursor up to lift the shield, move it down to bring it back</p></div>`;
};

// Profit orb (P&L page). chips = small floating labels
const ORB = (chips = [], label = 'Net profit', value = '') => `<div class="sc3d orb3d" aria-hidden="true"><div class="x-float"><div class="x-tilt">
<div class="o-gyro"><div class="pl p1"><i class="ring"></i></div><div class="pl p2"><i class="ring"></i></div><div class="pl p3"><i class="ring"></i></div></div>
<div class="o-glow"></div><div class="o-sph"><small>${label}</small><b>${value}</b></div>
${chips.map((c, i) => `<span class="o-chip c${i}"><em>${c}</em></span>`).join('')}
<i class="pt" style="--x:6%;--y:30%;--d:0s;--z:50px"></i><i class="pt" style="--x:92%;--y:60%;--d:1.4s;--z:60px"></i><i class="pt" style="--x:30%;--y:94%;--d:.8s;--z:30px"></i>
</div></div><div class="x-floor"></div><p class="x-cap">Live financial computation</p></div>`;

// Shield / orb follow the mouse: tilt, lift and highlight move smoothly
function fx3d() {
  const scene = $('.sc3d');
  if (!scene || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const lift = +(scene.dataset.lift || 0);
  let tx = 0, ty = 0, tl = 0;      // target values (where the mouse wants it)
  let cx = 0, cy = 0, cl = 0;      // current values (eased towards the target)
  let frame = 0;

  const tick = () => {
    cx += (tx - cx) * .09;
    cy += (ty - cy) * .09;
    cl += (tl - cl) * .09;
    scene.style.setProperty('--rx', (-cy * 30).toFixed(2) + 'deg');
    scene.style.setProperty('--ry', (cx * 40).toFixed(2) + 'deg');
    scene.style.setProperty('--lift', (cl * lift).toFixed(1) + 'px');
    scene.style.setProperty('--fs', (1 - cl * .28).toFixed(3));
    scene.style.setProperty('--hx', (34 + cx * 70).toFixed(1) + '%');
    scene.style.setProperty('--hy', (28 + cy * 70).toFixed(1) + '%');
    const moving = Math.abs(tx - cx) + Math.abs(ty - cy) + Math.abs(tl - cl) > .0015;
    frame = moving ? requestAnimationFrame(tick) : 0;
  };

  addEventListener('mousemove', e => {
    const r = scene.getBoundingClientRect();
    tx = (e.clientX - r.left - r.width / 2) / innerWidth;
    ty = (e.clientY - r.top - r.height / 2) / innerHeight;
    tl = 1 - e.clientY / innerHeight;
    if (!frame) frame = requestAnimationFrame(tick);
  }, { passive: true });
}