/* Admin "Activity tracking" page: CFO + regional manager overview, login/logout times, session length, file uploads. */
(function () {
    const PER = 8, ONLINE_MS = 10 * 60000;
    let CFOS = [], MGRS = [], DATA = { events: [], presence: {} }, U = {}, LIST = [];
    let view = 'overview', role = 'all', days = 7, q = '', pageNo = 1, OPEN = null;

    const rl = r => /manager/i.test(r || '') ? 'mgr' : 'cfo';
    const RN = { cfo: 'CFO', mgr: 'Regional manager' };
    const fdt = i => i ? new Date(i).toLocaleString(undefined, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';
    const fday = i => new Date(i).toLocaleDateString(undefined, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    const ftm = i => new Date(i).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
    const dur = ms => { if (!(ms > 0)) return '—'; const m = Math.round(ms / 60000); if (m < 1) return '<1 min'; const h = Math.floor(m / 60); return h ? `${h}h ${m % 60}m` : `${m}m` };
    const fsz = b => !b ? '' : b >= 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB';
    const cutoff = () => { if (days === 1) { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime() } return Date.now() - days * 864e5 };
    const RNG = { 1: 'Today', 7: 'Last 7 days', 30: 'Last 30 days' };

    async function fetchActivity() {
        try { return await IF.api('/admin/activity?days=30', { auth: true }) }
        catch (e) { const m = window.IF_MOCK && IF_MOCK.handle('/admin/activity', {}); if (m) return m; throw e }
    }

    /* ---- turn raw events into per-user sessions & stats ---- */
    function build() {
        const now = Date.now(), co = cutoff(); U = {};
        const add = (email, o) => { U[email] = Object.assign({ email, name: email, company: '', region: '', cfo: '', ev: [], sessions: [], uploads: [] }, o) };
        CFOS.filter(c => c.is_approved).forEach(c => add(c.email, { name: c.name, role: 'cfo', company: c.company_name, blocked: c.is_blocked, id: c.id }));
        MGRS.filter(m => m.is_verified !== false).forEach(m => add(m.email, { name: m.name, role: 'mgr', company: m.cfo_company_name || m.company_name, region: m.region, blocked: m.is_blocked, id: m.id, cfo: (CFOS.find(c => c.id === m.cfo_id) || {}).email }));
        DATA.events.forEach(e => { if (!U[e.email]) add(e.email, { name: e.name, role: rl(e.role) }) });
        DATA.events.slice().sort((a, b) => new Date(a.at) - new Date(b.at)).forEach(e => U[e.email].ev.push(e));
        Object.values(U).forEach(u => {
            const pres = DATA.presence[u.email] ? new Date(DATA.presence[u.email]).getTime() : 0; let cur = null;
            const close = (end, flag) => { cur.end = end; cur.noLogout = flag; cur.dur = end - cur.start; u.sessions.push(cur); cur = null };
            u.ev.forEach(e => {
                const t = new Date(e.at).getTime();
                if (e.type === 'login') { if (cur) close(cur.last, true); cur = { start: t, last: t, uploads: [] } }
                else if (e.type === 'upload') { const f = { at: t, name: e.file_name, size: e.file_size }; u.uploads.push(f); if (cur) { cur.uploads.push(f); cur.last = t } }
                else if (e.type === 'logout' && cur) close(t, false);
            });
            u.lastSeen = Math.max(pres, cur ? cur.last : 0);
            if (cur) { if (now - u.lastSeen < ONLINE_MS) { u.online = true; cur.end = null; cur.online = true; cur.dur = now - cur.start; u.sessions.push(cur) } else close(Math.max(cur.last, pres), true) }
            const lo = u.ev.filter(e => e.type === 'login'), lg = u.ev.filter(e => e.type === 'logout');
            u.lastLogin = lo.length ? lo[lo.length - 1].at : null; u.lastLogout = lg.length ? lg[lg.length - 1].at : null;
            u.rs = u.sessions.filter(s => s.start >= co); u.ru = u.uploads.filter(f => f.at >= co);
            u.time = u.rs.reduce((a, s) => a + (s.dur || 0), 0);
            u.last = u.ev.length ? new Date(u.ev[u.ev.length - 1].at).getTime() : 0;
        });
    }

    const users = () => Object.values(U).filter(u => (role === 'all' || u.role === role) && match(u));
    const match = u => !q || [u.name, u.email, u.company, u.region].join(' ').toLowerCase().includes(q);
    const ustr = u => `<b>${esc(u.name)}</b><span class="sub">${esc(u.email)}</span>`;
    const where = u => u.role === 'cfo' ? `<b>${esc(u.company || '—')}</b>` : `<b>${esc(u.region || '—')}</b><span class="sub">${esc(u.company || '')}</span>`;

    function stats() {
        const all = Object.values(U), rs = all.flatMap(u => u.rs);
        $('#s1').textContent = all.filter(u => u.online).length;
        $('#s2').textContent = rs.length;
        $('#s3').textContent = all.reduce((a, u) => a + u.ru.length, 0);
        const d = rs.filter(s => s.dur > 0); $('#s4').textContent = d.length ? dur(d.reduce((a, s) => a + s.dur, 0) / d.length) : '—';
        $('#s2n').textContent = RNG[days]; $('#s3n').textContent = RNG[days];
    }

    /* ---- the four views; each returns { head, rows, title } ---- */
    function vOverview() {
        const l = users().sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || b.last - a.last);
        return { title: 'CFOs & regional managers', head: ['User', 'Company / Region', 'Status', 'Last login', 'Last logout', 'Sessions', 'Time online', 'Files'], empty: 'No users match.',
            rows: l.map(u => `<tr data-u="${esc(u.email)}"><td>${ustr(u)}<span class="ap ${u.role}" style="margin-top:4px">${RN[u.role]}</span></td><td>${where(u)}</td>
<td>${u.blocked ? '<span class="tag">Blocked</span>' : u.online ? '<span class="dot on"></span><b>Online</b>' : '<span class="dot"></span>Offline'}</td>
<td>${fdt(u.lastLogin)}</td><td>${u.online ? '<em class="sub">Still signed in</em>' : fdt(u.lastLogout)}</td><td>${u.rs.length}</td><td>${dur(u.time)}</td><td>${u.ru.length}</td></tr>`) };
    }
    function vCompany() {
        const l = Object.values(U).filter(u => u.role === 'cfo' && match(u) || u.role === 'cfo' && Object.values(U).some(m => m.cfo === u.email && match(m)));
        return { title: 'Company overview (CFO + their managers)', head: ['Company', 'CFO', 'CFO status', 'Managers', 'Managers online', 'Total logins', 'Total files', 'Last activity'], empty: 'No companies match.',
            rows: l.map(c => { const t = Object.values(U).filter(m => m.cfo === c.email), g = [c, ...t], la = Math.max(...g.map(x => x.last));
                return `<tr data-u="${esc(c.email)}"><td><b>${esc(c.company || '—')}</b></td><td>${ustr(c)}</td><td>${c.online ? '<span class="dot on"></span><b>Online</b>' : '<span class="dot"></span>Offline'}</td><td>${t.length}</td><td>${t.filter(m => m.online).length}</td>
<td>${g.reduce((a, x) => a + x.rs.length, 0)}</td><td>${g.reduce((a, x) => a + x.ru.length, 0)}</td><td>${la ? fdt(new Date(la).toISOString()) : '—'}</td></tr>` }) };
    }
    function logEvents() {
        const co = cutoff();
        return DATA.events.filter(e => new Date(e.at) >= co && U[e.email] && (role === 'all' || U[e.email].role === role) && match(U[e.email])).sort((a, b) => new Date(b.at) - new Date(a.at));
    }
    const ACT = { login: '<span class="ap in">Login</span>', logout: '<span class="ap out">Logout</span>', upload: '<span class="ap up">Upload</span>' };
    function vLog() {
        return { title: 'Activity log', head: ['Time', 'User', 'Role', 'Action', 'Details'], empty: 'No activity in this period.',
            rows: logEvents().map(e => { const u = U[e.email]; return `<tr data-u="${esc(e.email)}"><td style="white-space:nowrap">${fdt(e.at)}</td><td>${ustr(u)}</td><td><span class="ap ${u.role}">${RN[u.role]}</span></td><td>${ACT[e.type] || esc(e.type)}</td><td>${e.type === 'upload' ? `${esc(e.file_name || '')} <span class="sub" style="display:inline">${fsz(e.file_size)}</span>` : '—'}</td></tr>` }) };
    }
    function vUploads() {
        const l = logEvents().filter(e => e.type === 'upload');
        return { title: 'Uploaded files', head: ['Uploaded at', 'File', 'Size', 'Uploaded by', 'Company / Region'], empty: 'No files uploaded in this period.',
            rows: l.map(e => { const u = U[e.email]; return `<tr data-u="${esc(e.email)}"><td style="white-space:nowrap">${fdt(e.at)}</td><td><b>${esc(e.file_name || '—')}</b></td><td>${fsz(e.file_size) || '—'}</td><td>${ustr(u)}</td><td>${where(u)}</td></tr>` }) };
    }

    function render() {
        stats();
        const v = { overview: vOverview, company: vCompany, log: vLog, uploads: vUploads }[view]();
        const pages = Math.max(1, Math.ceil(v.rows.length / PER)); if (pageNo > pages) pageNo = pages;
        const from = (pageNo - 1) * PER, rows = v.rows.slice(from, from + PER);
        $('#ptitle').textContent = v.title;
        $('#tbl').innerHTML = rows.length ? `<table><tr>${v.head.map(h => `<th>${h}</th>`).join('')}</tr>${rows.join('')}</table>` : `<p style="color:var(--mut)">${v.empty}</p>`;
        $('#pgb').innerHTML = v.rows.length > PER ? `<small>Showing ${from + 1}–${from + rows.length} of ${v.rows.length}</small><div><button data-p="prev" ${pageNo === 1 ? 'disabled' : ''}>‹ Prev</button>${IF.pager(pageNo, pages)}<button data-p="next" ${pageNo === pages ? 'disabled' : ''}>Next ›</button></div>` : '';
        document.querySelectorAll('.tb').forEach(b => b.classList.toggle('on', b.dataset.v === view));
        $('#roleSel').style.display = view === 'company' ? 'none' : '';
        if (OPEN) renderPanel();
    }

    /* ---- side panel: full timeline for one person ---- */
    function renderPanel() {
        const u = U[OPEN]; if (!u) return;
        const r = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
        const ss = u.sessions.slice().sort((a, b) => b.start - a.start).slice(0, 40);
        $('#dw').innerHTML = `<div class="dw-h"><button class="dw-x" data-x="close" aria-label="Close">✕</button><span class="eye">${RN[u.role]} activity</span><h2>${esc(u.name)}</h2>
        <div style="margin-top:12px"><button class="btn" data-block="${u.id}" style="padding:7px 16px;font-size:.85rem;color:#fff;border:none;background:${u.blocked ? '#2e7d32' : '#4A0E17'}">${u.blocked ? 'Unblock' : 'Block'} ${u.role === 'cfo' ? 'CFO + managers' : 'manager'}</button></div>
<div>${u.online ? '<span class="dot on"></span><b>Online now</b>' : '<span class="dot"></span>Offline'} · <small style="color:var(--mut)">${esc(u.email)}</small></div></div>
<div class="dw-b"><dl class="pf">${r('Company', esc(u.company || '—'))}${r(u.role === 'cfo' ? 'Role' : 'Region', u.role === 'cfo' ? 'CFO' : esc(u.region || '—'))}${r('Last login', fdt(u.lastLogin))}${r('Last logout', u.online ? 'Still signed in' : fdt(u.lastLogout))}</dl>
<div class="tiles"><div><small>Sessions · ${RNG[days]}</small><b>${u.rs.length}</b></div><div><small>Time online</small><b>${dur(u.time)}</b></div><div><small>Files uploaded</small><b>${u.ru.length}</b></div><div><small>Avg session</small><b>${u.rs.length ? dur(u.time / u.rs.length) : '—'}</b></div></div>
${u.role === 'cfo' ? teamHtml(u) : ''}
<h4>Session timeline</h4>${ss.length ? ss.map(sessHtml).join('') : '<div class="dw-empty">No sessions recorded yet.</div>'}</div>`;
    }
    function teamHtml(c) {
        const t = Object.values(U).filter(m => m.cfo === c.email); if (!t.length) return '';
        return `<h4>Managers (${t.length})</h4>` + t.map(m => `<div class="ss" data-open="${esc(m.email)}" style="cursor:pointer"><div class="ss-h"><span><b>${esc(m.name)}</b> <span class="sub" style="display:inline">· ${esc(m.region || '')}</span></span><span>${m.online ? '<span class="dot on"></span>Online' : '<span class="dot"></span>' + (m.lastLogin ? 'Last login ' + fdt(m.lastLogin) : 'No activity')}</span></div><div class="sub">${m.rs.length} sessions · ${dur(m.time)} online · ${m.ru.length} files</div></div>`).join('');
    }
    function sessHtml(s) {
        return `<div class="ss"><div class="ss-h"><b>${fday(s.start)}</b><span class="du">${s.online ? 'Online · ' : ''}${dur(s.dur)}</span></div>
<div class="ss-r"><span class="ap in">Login</span><b>${ftm(s.start)}</b></div>
${s.uploads.map(f => `<div class="ss-r"><span class="ap up">Upload</span><b>${ftm(f.at)}</b><span>${esc(f.name || 'file')}</span><em>${fsz(f.size)}</em></div>`).join('')}
${s.online ? '<div class="ss-r"><span class="ap in" style="background:#e6f3ea">Active</span><em>Still signed in</em></div>' : s.noLogout ? `<div class="ss-note">No logout recorded (session timed out · last seen ${ftm(s.end)})</div>` : `<div class="ss-r"><span class="ap out">Logout</span><b>${ftm(s.end)}</b></div>`}</div>`;
    }
    const open = e => { OPEN = e; IF.blink(document.querySelector('tr[data-u="' + e + '"]')); renderPanel(); $('#dwo').classList.add('open'); $('#dw').classList.add('open'); $('#dw').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden' };
    const close = () => { OPEN = null; $('#dwo').classList.remove('open'); $('#dw').classList.remove('open'); $('#dw').setAttribute('aria-hidden', 'true'); document.body.style.overflow = '' };

    function exportCsv() {
        const rows = [['Time', 'Name', 'Email', 'Role', 'Company', 'Region', 'Action', 'File', 'Size (bytes)']].concat(logEvents().map(e => { const u = U[e.email]; return [e.at, u.name, u.email, RN[u.role], u.company, u.region, e.type, e.file_name || '', e.file_size || ''] }));
        const safe = c => { c = String(c ?? ''); return /^[=+\-@\t\r]/.test(c) ? "'" + c : c };   // stop Excel formula injection
        const csv = rows.map(r => r.map(c => `"${safe(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'insightflow-activity.csv'; a.click();
    }

    async function load() {
        try {
            const d = await IF.api('/admin/cfos', { auth: true }); CFOS = d.cfos;
            MGRS = await IF.api('/admin/regional-managers', { auth: true }).catch(() => []);
            DATA = await fetchActivity();
        } catch (e) { $('#tbl').innerHTML = `<p class="err">${esc(e.message)}</p>`; return }
        build(); render();
    }

    page('Activity', () => `<div class="home-top"></div>
<div><span class="eye">Admin console</span><h1 class="ht" style="font-size:2.3rem">Activity tracking</h1><p class="lead">See every CFO and regional manager in one place: when they signed in, when they signed out, how long they stayed, and which files they uploaded. Click any row for the full timeline.</p></div>
<div class="mini" style="margin-top:18px">
<div class="sc"><small>Online now</small><b id="s1">–</b><span>Signed in right now</span></div>
<div class="sc"><small>Logins</small><b id="s2">–</b><span id="s2n"></span></div>
<div class="sc"><small>Files uploaded</small><b id="s3">–</b><span id="s3n"></span></div>
<div class="sc"><small>Avg session</small><b id="s4">–</b><span>Time per login</span></div></div>
<div class="tool"><div class="tabs" style="margin:0">
<button class="tb on" data-v="overview">Overview</button><button class="tb" data-v="company">By company</button><button class="tb" data-v="log">Activity log</button><button class="tb" data-v="uploads">Uploaded files</button></div>
<span class="sp"></span>
<select id="roleSel" aria-label="Role"><option value="all">All roles</option><option value="cfo">CFOs</option><option value="mgr">Regional managers</option></select>
<select id="daysSel" aria-label="Period"><option value="1">Today</option><option value="7" selected>Last 7 days</option><option value="30">Last 30 days</option></select>
<input id="qIn" type="search" placeholder="Search name, email, company, region" aria-label="Search">
<button class="btn" style="padding:9px 16px;font-size:.85rem" id="exp">Export CSV</button></div>
<div class="pn"><h3 id="ptitle">Loading…</h3><div class="tw" id="tbl"><p style="color:var(--mut)">Loading…</p></div><div class="pgb" id="pgb"></div></div>
<div class="dwo" id="dwo"></div><aside class="dw" id="dw" role="dialog" aria-modal="true" aria-hidden="true"></aside>`,
        () => {
            const re = () => { pageNo = 1; build(); render() };
            $('#pg').addEventListener('click', e => {
                const t = e.target.closest('.tb'); if (t) { view = t.dataset.v; pageNo = 1; return render() }
                const p = e.target.closest('[data-p]'); if (p) { const v = p.dataset.p; pageNo = v === 'prev' ? pageNo - 1 : v === 'next' ? pageNo + 1 : +v; return render() }
                if (e.target.closest('#exp')) return exportCsv();
                const r = e.target.closest('tr[data-u]'); if (r) open(r.dataset.u);
            });
            $('#roleSel').onchange = e => { role = e.target.value; pageNo = 1; render() };
            $('#daysSel').onchange = e => { days = +e.target.value; re() };
            $('#qIn').oninput = e => { q = e.target.value.trim().toLowerCase(); pageNo = 1; render() };
            $('#dwo').onclick = close;
            document.addEventListener('keydown', e => { if (e.key === 'Escape' && OPEN) close() });
            $('#dw').addEventListener('click', async e => {
                const bk = e.target.closest('[data-block]');
                if (bk) {
                    const u = U[OPEN];
                    const msg = (u.blocked ? 'Unblock ' : 'Block ') + u.name + '?' + (u.role === 'cfo' && !u.blocked ? ' All their managers will be blocked too.' : '');
                    if (!confirm(msg)) return;
                    bk.disabled = true;
                    try { const r = await IF.api('/admin/users/' + +bk.dataset.block + '/toggle-block', { method: 'PATCH', auth: true }); IF.toast(r.message); await load(); }
                    catch (ex) { IF.toast(ex.message, true); bk.disabled = false }
                    return;
                }
                if (e.target.closest('[data-x]')) return close();
                const m = e.target.closest('[data-open]'); if (m) { OPEN = m.dataset.open; renderPanel(); $('.dw-b').scrollTop = 0 }
            });
            load(); setInterval(load, 30000);   // auto-refresh so "Online now" stays live
        });
})();