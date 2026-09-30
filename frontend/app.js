try { const _s = JSON.parse(localStorage.getItem('if_session')); if (_s && _s.k === 0 && !sessionStorage.getItem('if_tab')) localStorage.removeItem('if_session') } catch (e) { }
const $ = s => document.querySelector(s);
const st = { get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d } catch (e) { return d } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } } };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = { Home: '<path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>', Dashboard: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>', Data: '<path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v3h16v-3"/>', Unify: '<path d="M4 6h6v4H4zM4 14h6v4H4zM14 10h6v4h-6zM10 8h2v8h-2"/>', Ask: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>', PL: '<circle cx="12" cy="12" r="9"/><path d="M12 3v9h9"/>', Forecast: '<path d="M3 17l6-6 4 4 8-9M15 6h6v6"/>', Advisory: '<path d="M12 3a6 6 0 0 0-3 11.2V17h6v-2.8A6 6 0 0 0 12 3zM9 21h6"/>', Doctor: '<path d="M12 21s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9zM8 12h2l1-2 2 4 1-2h2"/>', Security: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4"/>', Admin: '<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4"/>' };
const ic = k => `<svg viewBox="0 0 24 24">${I[k]}</svg>`;
const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'], REV = [74, 82, 96, 91, 112, 124, 131, 128, 142], COG = [41, 44, 52, 49, 58, 63, 66, 65, 71], OPX = [18, 19, 21, 20, 24, 26, 27, 27, 29];
function line(d, proj) {
  const W = 640, H = 230, mx = Math.max(...d, ...(proj || [])) * 1.1, x = i => 40 + i * (W - 60) / (d.length + (proj ? proj.length : 0) - 1), y = v => H - 24 - v / mx * (H - 44);
  const pts = d.map((v, i) => `${x(i)},${y(v)}`).join(' '); let s = `<svg class="ch" viewBox="0 0 ${W} ${H}"><defs><linearGradient id="gg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9A2C3E" stop-opacity=".25"/><stop offset="1" stop-color="#9A2C3E" stop-opacity="0"/></linearGradient></defs>`;
  [0, .5, 1].forEach(t => s += `<line x1="40" x2="${W - 10}" y1="${H - 24 - t * (H - 44)}" y2="${H - 24 - t * (H - 44)}" stroke="rgba(154,44,62,.12)"/>`);
  s += `<polygon points="40,${H - 24} ${pts} ${x(d.length - 1)},${H - 24}" fill="url(#gg)"/><polyline class="lp" points="${pts}" fill="none" stroke="#4A0E17" stroke-width="3" stroke-linejoin="round"/>`;
  if (proj) { const pp = [d[d.length - 1], ...proj].map((v, i) => `${x(d.length - 1 + i)},${y(v)}`).join(' '); s += `<polyline class="lp" points="${pp}" fill="none" stroke="#9A2C3E" stroke-width="3" stroke-dasharray="7 6"/>` }
  d.forEach((v, i) => s += `<circle cx="${x(i)}" cy="${y(v)}" r="4.5" fill="#fff" stroke="#4A0E17" stroke-width="2"><title>${M[i]}: $${v}K</title></circle><text x="${x(i)}" y="${H - 6}" text-anchor="middle">${M[i]}</text>`); return s + '</svg>'
}
const kp = a => `<div class="kp">${a.map(k => `<div class="k"><small>${k[0]}</small><strong>${k[1]}</strong><em>${k[2]}</em></div>`).join('')}</div>`;
const pl = () => M.map((m, i) => [m, REV[i], COG[i], REV[i] - COG[i], OPX[i], REV[i] - COG[i] - OPX[i]]);
function draw() { document.querySelectorAll('.lp').forEach(p => { const l = p.getTotalLength ? p.getTotalLength() : 0; if (l && !p.getAttribute('stroke-dasharray')) { gsap.fromTo(p, { strokeDasharray: l, strokeDashoffset: l }, { strokeDashoffset: 0, duration: 1.4, ease: 'power2.out', onComplete: () => p.style.strokeDasharray = 'none' }) } }) }

const V = [['Home', 'home.html'], ['Dashboard', 'dashboard.html'], ['Data', 'data.html'], ['Doctor', 'datadoctor.html'], ['PL', 'pnl.html'], ['Ask', 'ask.html'], ['Forecast', 'forecast.html'], ['Unify', 'unify.html'], ['Advisory', 'advisory.html'], ['Security', 'security.html']], L = { PL: 'Profit & Loss', Doctor: 'Data Doctor', Admin: 'CFO approvals' };
function signOut() { localStorage.removeItem('if_session'); location.href = 'index.html' }
function page(key, render, init) {
  const u = st.get('if_session', null);
  if (!u || !u.token || (window.IF && IF.tokenExpired(u.token))) { localStorage.removeItem('if_session'); location.replace('login.html?next=' + location.pathname.split('/').pop()); return }
  if (u.role === 'admin' && key !== 'Admin') { location.replace('admin.html'); return }
  if (u.role !== 'admin' && key === 'Admin') { location.replace('home.html'); return }
  const NAV = u.role === 'admin' ? [['Admin', 'admin.html']] : V;
  $('#sn').innerHTML = '<a class="brand" href="index.html">Insight<b>Flow</b></a>' + NAV.map(v => `<a href="${v[1]}" class="${v[0] === key ? 'on' : ''}" ${v[0] === key ? 'aria-current="page"' : ''}>${ic(v[0])}${L[v[0]] || v[0]}</a>`).join('') + `<div class="me"><b>${esc(u.n)}</b>${esc(u.e)}<br><a onclick="signOut()" tabindex="0" role="button">Sign out</a></div>`;
  $('#pg').dataset.k = key; $('#pg').innerHTML = render(u);
  gsap.from('#pg > *,#pg .k,#pg .pn', { opacity: 0, y: 18, duration: .5, stagger: .06, ease: 'back.out(1.4)', clearProps: 'all' }); init && init(u); ballFx(); fx3d(); window.IF && IF.verify()
}

const BALL = (c = '') => `<div class="ball3d" aria-hidden="true"><i class="gs"></i><div class="fl3"><div class="bt"><div class="rg rb"><i></i></div><div class="sph">${c}</div><div class="rg rf"><i></i></div></div></div></div>`;
function ballFx() {
  const b = $('.ball3d'); if (!b || matchMedia('(prefers-reduced-motion: reduce)').matches) return; const t = b.querySelector('.bt'), s = b.querySelector('.sph');
  addEventListener('mousemove', e => {
    const r = b.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / innerWidth, y = (e.clientY - r.top - r.height / 2) / innerHeight;
    s.style.setProperty('--hx', (32 + x * 45) + '%'); s.style.setProperty('--hy', (26 + y * 45) + '%'); t.style.setProperty('--rx', (-y * 22) + 'deg'); t.style.setProperty('--ry', (x * 26) + 'deg')
  }, { passive: true })
}


/* ---------- Security shield (3D layers) ---------- */
const SHIELD = () => {
  const OUT = 'M100 12 L176 40 V112 C176 170 141 210 100 228 C59 210 24 170 24 112 V40 Z', IN = 'M100 26 L164 50 V112 C164 162 134 196 100 213 C66 196 36 162 36 112 V50 Z';
  return `<div class="sc3d sh3d" data-lift="46" aria-hidden="true"><span class="sh-vert">Secure · Verified · Protected</span>
<div class="x-float"><div class="x-tilt">
<svg class="ly l-halo" viewBox="0 0 300 300"><defs><radialGradient id="shGlow"><stop offset="0" stop-color="#D9777F" stop-opacity=".28"/><stop offset="1" stop-color="#D9777F" stop-opacity="0"/></radialGradient></defs><circle cx="150" cy="150" r="148" fill="url(#shGlow)"/><circle class="halo-r" cx="150" cy="150" r="128" fill="none" stroke="rgba(154,44,62,.35)" stroke-width="1.5"/><circle cx="150" cy="150" r="118" fill="none" stroke="rgba(154,44,62,.16)" stroke-width="1" stroke-dasharray="2 7"/></svg>
<svg class="ly l-shield" viewBox="0 0 200 240"><defs>
<linearGradient id="shBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8E2434"/><stop offset=".55" stop-color="#4A0E17"/><stop offset="1" stop-color="#220609"/></linearGradient>
<linearGradient id="shEdge" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F4CDB0"/><stop offset=".5" stop-color="#D9777F"/><stop offset="1" stop-color="#9A2C3E"/></linearGradient>
<linearGradient id="shSweep" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".38"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<clipPath id="shClip"><path d="${OUT}"/></clipPath></defs>
<path d="${OUT}" fill="url(#shBody)" stroke="url(#shEdge)" stroke-width="3.5" stroke-linejoin="round"/>
<path d="${IN}" fill="none" stroke="rgba(244,205,176,.32)" stroke-width="1"/>
<path d="M100 26 L164 50 V112 C164 122 163 131 161 139 C130 120 70 120 39 139 C37 131 36 122 36 112 V50 Z" fill="rgba(255,255,255,.07)"/>
<g clip-path="url(#shClip)"><g transform="skewX(-18)"><rect class="sweep" x="-110" y="0" width="54" height="240" fill="url(#shSweep)"/></g></g></svg>
<div class="ly l-core"><svg viewBox="0 0 60 60"><circle cx="30" cy="30" r="28" fill="none" stroke="rgba(244,205,176,.55)" stroke-width="1.2"/><path class="chk" d="M18 31 L27 40 L43 21" fill="none" stroke="#F4CDB0" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>
<svg class="ly l-orbit" viewBox="0 0 300 300"><g class="orb-a"><ellipse cx="150" cy="150" rx="146" ry="46" fill="none" stroke="rgba(217,119,127,.55)" stroke-width="1.2" transform="rotate(-24 150 150)"/><circle r="4.5" fill="#F4CDB0"><animateMotion dur="7s" repeatCount="indefinite" path="M4 150 a146 46 0 1 0 292 0 a146 46 0 1 0 -292 0" rotate="auto"/></circle></g>
<g class="orb-b"><ellipse cx="150" cy="150" rx="132" ry="38" fill="none" stroke="rgba(154,44,62,.45)" stroke-width="1" transform="rotate(38 150 150)"/><circle r="3.5" fill="#D9777F"><animateMotion dur="9s" repeatCount="indefinite" path="M18 150 a132 38 0 1 1 264 0 a132 38 0 1 1 -264 0"/></circle></g></svg>
<i class="pt" style="--x:8%;--y:22%;--d:0s;--z:70px"></i><i class="pt" style="--x:90%;--y:30%;--d:1.2s;--z:40px"></i><i class="pt" style="--x:80%;--y:78%;--d:2.1s;--z:80px"></i><i class="pt" style="--x:16%;--y:74%;--d:.7s;--z:30px"></i><i class="pt" style="--x:50%;--y:2%;--d:1.7s;--z:60px"></i>
</div></div><div class="x-floor"></div><p class="x-cap">Move your cursor up to lift the shield, move it down to bring it back</p></div>`};

/* ---------- P&L profit orb (real 3D gyroscope) ---------- */
const ORB = (chips = [], label = 'Net profit', val = '') => `<div class="sc3d orb3d" aria-hidden="true"><div class="x-float"><div class="x-tilt">
<div class="o-gyro"><div class="pl p1"><i class="ring"></i></div><div class="pl p2"><i class="ring"></i></div><div class="pl p3"><i class="ring"></i></div></div>
<div class="o-glow"></div><div class="o-sph"><small>${label}</small><b>${val}</b></div>
${chips.map((c, i) => `<span class="o-chip c${i}"><em>${c}</em></span>`).join('')}
<i class="pt" style="--x:6%;--y:30%;--d:0s;--z:50px"></i><i class="pt" style="--x:92%;--y:60%;--d:1.4s;--z:60px"></i><i class="pt" style="--x:30%;--y:94%;--d:.8s;--z:30px"></i>
</div></div><div class="x-floor"></div><p class="x-cap">Live financial computation</p></div>`;

/* shared cursor interaction: tilt, lift and highlight follow the mouse smoothly */
function fx3d() {
  const s = $('.sc3d'); if (!s || matchMedia('(prefers-reduced-motion: reduce)').matches) return; const lift = +(s.dataset.lift || 0);
  let tx = 0, ty = 0, tl = 0, cx = 0, cy = 0, cl = 0, raf = 0;
  const tick = () => {
    cx += (tx - cx) * .09; cy += (ty - cy) * .09; cl += (tl - cl) * .09;
    s.style.setProperty('--rx', (-cy * 30).toFixed(2) + 'deg'); s.style.setProperty('--ry', (cx * 40).toFixed(2) + 'deg');
    s.style.setProperty('--lift', (cl * lift).toFixed(1) + 'px'); s.style.setProperty('--fs', (1 - cl * .28).toFixed(3));
    s.style.setProperty('--hx', (34 + cx * 70).toFixed(1) + '%'); s.style.setProperty('--hy', (28 + cy * 70).toFixed(1) + '%');
    raf = (Math.abs(tx - cx) + Math.abs(ty - cy) + Math.abs(tl - cl) > .0015) ? requestAnimationFrame(tick) : 0
  };
  addEventListener('mousemove', e => { const r = s.getBoundingClientRect(); tx = (e.clientX - r.left - r.width / 2) / innerWidth; ty = (e.clientY - r.top - r.height / 2) / innerHeight; tl = 1 - e.clientY / innerHeight; if (!raf) raf = requestAnimationFrame(tick) }, { passive: true })
}
