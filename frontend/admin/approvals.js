/* Shared approvals page: one script, used by approvals.html (CFOs) and manager-approvals.html (regional managers).
   ApprPage('cfo') or ApprPage('mgr') builds the whole page: list (3 per page) + Approve / Blacklist + profile side panel. */
function ApprPage(kind) {
    if (kind !== 'cfo') { location.replace('approvals.html'); return }   // managers need no approval (CFO invite + OTP)
    const CFO = true;
    const PER = 3;                                   // 3 people per page
    const BTN = 'padding:8px 18px;font-size:.85rem';
    let ITEMS = [], ALLCFO = [], pageNo = 1, OPEN = null, BLN = 0;
    const FOCUS = +(new URLSearchParams(location.search).get('focus') || 0);   // coming from dashboard "View"
    const fd = d => d ? new Date(String(d).slice(0, 10) + 'T00:00:00').toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
    const word = CFO ? 'CFO' : 'regional manager';

    page(CFO ? 'Approvals' : 'MgrApprovals', () => `<div class="home-top"></div>
<div><span class="eye">Admin console</span><h1 class="ht" style="font-size:2.3rem">${CFO ? 'CFO approvals' : 'Regional manager approvals'}</h1><p class="lead">${CFO ? 'Review new CFO sign-ups.' : 'Review regional managers added by CFOs.'} Click Approve to open the full profile and confirm, or blacklist fake registrations.</p></div>
<div class="mini" style="margin-top:18px;grid-template-columns:repeat(auto-fit,minmax(190px,1fr))">
<div class="sc"><small>Pending ${CFO ? 'CFOs' : 'managers'}</small><b id="a1">–</b><span>Waiting for your decision</span></div>
<div class="sc"><small>Approvals</small><b id="a2">–</b><span>${CFO ? 'CFO registrations awaiting review' : 'Regional manager registrations awaiting review'}</span></div>
<div class="sc"><small>Blacklisted</small><b id="a3">–</b><span>Cannot sign up again</span></div></div>
<div class="pn"><h3>${CFO ? 'Pending CFOs' : 'Pending regional managers'}</h3><input type="search" id="q" class="srch" placeholder="Search by name, email, company or license…" autocomplete="off" aria-label="Search"><div id="list"><p style="color:var(--mut)">Loading…</p></div><div class="pgb" id="pgb"></div></div>
<div class="dwo" id="dwo"></div><aside class="dw" id="dw" role="dialog" aria-modal="true" aria-hidden="true"></aside>`,
    () => {
        async function load() {
            try {
                const d = await IF.api('/admin/cfos', { auth: true });
                ALLCFO = d.cfos;
                if (CFO) ITEMS = d.cfos.filter(c => !c.is_approved);
                else ITEMS = (await IF.api('/admin/regional-managers', { auth: true }).catch(() => [])).filter(x => x.is_verified === false);
                BLN = (await IF.api('/admin/blacklist', { auth: true }).catch(() => [])).length;
            } catch (e) { $('#list').innerHTML = `<p class="err">${esc(e.message)}</p>`; return }
            $('#a1').textContent = ITEMS.length; $('#a2').textContent = ITEMS.length; $('#a3').textContent = BLN;
            if (FOCUS && !load.done) { const i = ITEMS.findIndex(x => x.id === FOCUS); if (i >= 0) pageNo = Math.floor(i / PER) + 1 }
            load.done = true;
            draw();
        }

let Q = '';
const shown = () => {
    const q = Q.trim().toLowerCase();
    return q ? ITEMS.filter(x => [x.name, x.email, x.company_name, x.cfo_company_name, x.license_number, x.region]
        .some(v => String(v || '').toLowerCase().includes(q))) : ITEMS;
};

function draw() {
    const LIST = shown();
    const pages = Math.max(1, Math.ceil(LIST.length / PER));
    if (pageNo > pages) pageNo = pages;
    const from = (pageNo - 1) * PER, items = LIST.slice(from, from + PER);
    $('#list').innerHTML = items.length ? items.map(x => `<div class="ac${x.id === FOCUS ? ' hl' : ''}" id="ac-${x.id}">
<div class="av">${esc((x.name || x.email || '?').trim().charAt(0))}</div>
<div class="in"><b>${esc(x.name || '—')}</b><small>${esc(x.email)}</small><div class="meta">${CFO
        ? `<span>${esc(x.company_name || '—')}</span><span>License ${esc(x.license_number || '—')}</span><span>Expires ${fd(x.license_expiry_date)}</span>`
        : `<span>${esc(x.region || 'No region')}</span><span>${esc(x.cfo_company_name || x.company_name || '—')}</span>`}</div></div>
<div class="acts">
${CFO && x.has_license_file ? `<button class="btn" style="${BTN}" data-a="doc" data-id="${x.id}">View document</button>` : ''}
<button class="btn solid" style="${BTN}" data-a="open" data-id="${x.id}">Approve</button>
${CFO ? `<button class="btn" style="${BTN};color:#ba1a1a" data-a="rej" data-id="${x.id}">Reject</button>` : ''}
<button class="btn" style="${BTN};color:#ba1a1a" data-a="bl" data-id="${x.id}">Blacklist</button>
</div>
</div>`).join('')
        : `<p style="color:var(--mut)">${ITEMS.length ? 'No ' + word + 's match your search.' : 'No ' + word + 's are waiting for approval. You are all caught up.'}</p>`;
    $('#pgb').innerHTML = LIST.length > PER ? `<small>Showing ${from + 1}–${from + items.length} of ${LIST.length}</small><div><button data-p="prev" ${pageNo === 1 ? 'disabled' : ''}>‹ Prev</button>${IF.pager(pageNo, pages)}<button data-p="next" ${pageNo === pages ? 'disabled' : ''}>Next ›</button></div>` : '';
    const h = $('.ac.hl'); if (h && !draw.scrolled) { draw.scrolled = true; h.scrollIntoView({ block: 'center', behavior: 'smooth' }) }
}

        /* ---- profile side panel (opens only from the Approve button) ---- */
        function openProfile(id) {
            const x = ITEMS.find(v => v.id === id); if (!x) return;
            OPEN = id; IF.blink($('#ac-' + id));
            const r = (k, v) => `<div><dt>${k}</dt><dd>${v}</dd></div>`;
            const boss = CFO ? null : ALLCFO.find(c => c.id === x.cfo_id);
            $('#dw').innerHTML = `<div class="dw-h"><button class="dw-x" data-x="close" aria-label="Close">✕</button><span class="eye">${CFO ? 'CFO' : 'Regional manager'} profile</span><h2>${esc(x.name || '—')}</h2><span class="tag">Pending approval</span><br><small style="color:var(--mut)">${esc(x.email)}</small></div>
<div class="dw-b"><dl class="pf">${CFO
                ? r('Company', esc(x.company_name || '—')) + r('Domain', '@' + esc(x.company_domain || '')) + r('Phone', esc(x.phone || '—')) + r('Country', esc(x.country || '—')) + r('License no.', esc(x.license_number || '—')) + r('Issued', fd(x.license_issue_date)) + r('Expires', fd(x.license_expiry_date)) + r('Registered', fd(x.created_at))
                : r('Region', esc(x.region || '—')) + r('Phone', esc(x.phone || '—')) + r('Company', esc(x.cfo_company_name || x.company_name || '—')) + r('Reports to CFO', esc(boss ? boss.name : x.cfo_name || '—')) + r('Registered', fd(x.created_at))}</dl>
${CFO && x.has_license_file ? `<button class="btn lic-btn" style="${BTN}" data-x="doc">View license document</button>` : ''}</div>
<div class="dw-f">${CFO ? `<select id="exp" data-license="${x.license_expiry_date || ''}"><option value="license">Access until license expires</option><option value="6">Access for 6 months</option><option value="12">Access for 1 year</option><option value="24">Access for 2 years</option></select>` : ''}
<button class="btn solid" style="${BTN}" data-x="confirm">Approve</button><button class="btn" style="${BTN};color:#ba1a1a" data-x="rej">Reject</button><button class="btn" style="${BTN};color:#ba1a1a" data-x="bl">Blacklist</button></div>`;
            $('#dwo').classList.add('open'); $('#dw').classList.add('open'); $('#dw').setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
        }
        function closeProfile() { OPEN = null; $('#dwo').classList.remove('open'); $('#dw').classList.remove('open'); $('#dw').setAttribute('aria-hidden', 'true'); document.body.style.overflow = '' }

        async function approve(id) {
            {
                let expiry = null; const sel = $('#exp');
                if (sel.value === 'license' && sel.dataset.license) expiry = sel.dataset.license + 'T23:59:59';
                else if (sel.value !== 'license') { const d = new Date(); d.setMonth(d.getMonth() + +sel.value); expiry = d.toISOString() }
                return IF.api('/admin/approve-license', { method: 'POST', auth: true, json: { cfo_id: id, is_valid: true, expiry_date: expiry } });
            }
        }
        async function blacklist(id) {
            if (!confirm('Blacklist this ' + (CFO ? 'company' : 'manager') + '? The registration is deleted and they cannot sign up again.')) return false;
            const j = { reason: 'Fraudulent registration', cfo_id: id };
            await IF.api('/admin/blacklist', { method: 'POST', auth: true, json: j }); return true;
        }
        async function reject(id) {
    if (!confirm('Reject this CFO? Registration will be deleted and they will get a rejection email. They can sign up again.')) return false;
    return IF.api('/admin/approve-license', { method: 'POST', auth: true, json: { cfo_id: id, is_valid: false } });
}
        async function run(fn, id, btn) {
            try {
                if (btn) btn.disabled = true;
                const r = await fn(id);
                if (r === false) { if (btn) btn.disabled = false; return }
                if (r && r.message) IF.toast(r.message + (r.email_sent === false ? ' (email could not be sent)' : ''), r.email_sent === false); else IF.toast('Blacklisted.');
                closeProfile(); await load();
            } catch (ex) { IF.toast(ex.message, true); if (btn) btn.disabled = false }
        }

        $('#pg').addEventListener('click', e => {
            const p = e.target.closest('[data-p]'); if (p) { const pages = Math.ceil(shown().length/ PER), v = p.dataset.p; pageNo = v === 'prev' ? Math.max(1, pageNo - 1) : v === 'next' ? Math.min(pages, pageNo + 1) : +v; return draw() }
            const b = e.target.closest('button[data-a]'); if (!b) return;
            const id = +b.dataset.id;
            if (b.dataset.a === 'open') openProfile(id);
            if (b.dataset.a === 'bl') run(blacklist, id, b);
            if (b.dataset.a === 'doc') IF.openProtectedFile('/admin/download-license/' + id).catch(ex => IF.toast(ex.message, true));
if (b.dataset.a === 'rej') run(reject, id, b);
        });
        $('#dwo').addEventListener('click', closeProfile);
        document.addEventListener('keydown', e => { if (e.key === 'Escape' && OPEN !== null) closeProfile() });
        $('#dw').addEventListener('click', e => {
            const x = e.target.closest('[data-x]'); if (!x || OPEN === null) return;
            const a = x.dataset.x, id = OPEN;
            if (a === 'close') return closeProfile();
            if (a === 'doc') return IF.openProtectedFile('/admin/download-license/' + id).catch(ex => IF.toast(ex.message, true));
            if (a === 'confirm') run(approve, id, x);
            if (a === 'rej') run(reject, id, x);
            if (a === 'bl') run(blacklist, id, x);

        });
        $('#q').addEventListener('input', e => { Q = e.target.value; pageNo = 1; draw(); });
        load();
    });
}