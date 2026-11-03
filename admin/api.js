(function () {
    // When the website is served by the backend (http://127.0.0.1:8000) API calls are same-origin.
    // If you open the pages from somewhere else (Live Server, file://) they go to the backend below.
    var sameOrigin = location.protocol !== 'file:' && (location.port === '8000' || location.port === '');
    var API_BASE = window.IF_API_BASE || (sameOrigin ? '' : 'http://127.0.0.1:8000');

    function getSession() { try { return JSON.parse(localStorage.getItem('if_session')) } catch (e) { return null } }
    function setSession(s) { try { localStorage.setItem('if_session', JSON.stringify(s)) } catch (e) { } }
    function clearSession() { try { localStorage.removeItem('if_session') } catch (e) { } }
    function homeFor(role) { return role === 'admin' ? 'admin.html' : 'home.html' }

    /* session object saved after every successful login / manager verification */
    function saveLogin(data, keep) {
        setSession({ n: data.name || data.email, e: data.email, role: data.role, token: data.access_token, k: keep === false ? 0 : 1 });
        try { sessionStorage.setItem('if_tab', '1') } catch (e) { }
    }

    function tokenExpired(t) {
        try {
            var p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
            return !!p.exp && p.exp * 1000 < Date.now();
        } catch (e) { return true }
    }

    function errText(data, status) {
        if (data && typeof data.detail === 'string') return data.detail;
        if (data && Array.isArray(data.detail)) {
            return data.detail.map(function (d) { return String(d.msg || '').replace(/^Value error, /, '') }).join(' ') || 'Please check the form and try again.';
        }
        return 'Something went wrong (' + status + '). Please try again.';
    }

    function logout(toLogin) {
        clearSession();
        location.href = toLogin ? 'login.html?next=' + encodeURIComponent(location.pathname.split('/').pop() || 'home.html') : 'index.html';
    }

    /* api('/api/auth/login', { method:'POST', form:{...} })       -> application/x-www-form-urlencoded
       api('/api/auth/...',   { method:'POST', json:{...}, auth:true })
       api('/api/auth/...',   { method:'POST', formData: FormData })   */
    async function api(path, o) {
        o = o || {};
        var headers = {}, body;
        if (o.auth) {
            var s = getSession();
            if (s && s.token && !tokenExpired(s.token)) headers['Authorization'] = 'Bearer ' + s.token;   /* login optional now */
        }
        if (o.json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.json) }
        else if (o.form) { body = new URLSearchParams(o.form) }
        else if (o.formData) { body = o.formData }

        var res;
        try { res = await fetch(API_BASE + path, { method: o.method || 'GET', headers: headers, body: body }) }
        catch (e) {
            var mr = window.IF_MOCK && window.IF_MOCK.handle(path, o);   /* dummy backend when the real one is offline */
            if (mr !== undefined) return mr;
            throw new Error('Cannot reach the server. Please make sure the backend is running.')
        }

        var data = null; try { data = await res.json() } catch (e) { }
        if (!res.ok) {
            
            var err = new Error(errText(data, res.status)); err.status = res.status; throw err;
        }
        return data;
    }

    /* fetch a protected file with the token and show it in a small pop-up on the same screen (license documents) */
    /* compact page numbers: 1 ... 4 5 6 ... 37 */
    function pager(cur, total) {
        var set = {}, out = '', last = 0, i;
        [1, 2, cur - 1, cur, cur + 1, total - 1, total].forEach(function (n) { if (n >= 1 && n <= total) set[n] = 1 });
        Object.keys(set).map(Number).sort(function (a, b) { return a - b }).forEach(function (n) {
            if (last && n - last > 1) out += '<span class="pgd">\u2026</span>';
            out += '<button data-p="' + n + '" class="' + (n === cur ? 'on' : '') + '">' + n + '</button>'; last = n;
        });
        return out;
    }
    function blink(el) { if (!el) return; el.classList.remove('blink'); void el.offsetWidth; el.classList.add('blink'); setTimeout(function () { el.classList.remove('blink') }, 1300) }
    function closeDoc() { var o = document.getElementById('docov'); if (!o) return; if (o.dataset.u) URL.revokeObjectURL(o.dataset.u); o.remove(); document.removeEventListener('keydown', docEsc, true) }
    function docEsc(e) { if (e.key === 'Escape') { e.stopImmediatePropagation(); closeDoc() } }
    function showDoc(url, type) {
        closeDoc();
        var isImg = /^image\//.test(type || ''), o = document.createElement('div');
        o.id = 'docov'; o.className = 'docov'; o.dataset.u = url;
        o.innerHTML = '<div class="docbox" role="dialog" aria-modal="true" aria-label="License document"><div class="doch"><b>License document</b><button type="button" class="docx" aria-label="Close">\u2715</button></div><div class="docb">' + (isImg ? '<img alt="License document" src="' + url + '">' : '<iframe title="License document" src="' + url + '"></iframe>') + '</div></div>';
        o.addEventListener('click', function (e) { if (e.target === o || e.target.closest('.docx')) closeDoc() });
        document.body.appendChild(o); document.addEventListener('keydown', docEsc, true);
    }
    async function openProtectedFile(path) {
        var s = getSession(), res;
        try { res = await fetch(API_BASE + path, { headers: (s && s.token && !tokenExpired(s.token)) ? { Authorization: 'Bearer ' + s.token } : {} }) }
        catch (e) { if (window.IF_MOCK) return showDoc(window.IF_MOCK.demoDoc(), 'text/html'); throw e }
        if (!res.ok) throw new Error('Could not open the document.');
        var blob = await res.blob();
        showDoc(URL.createObjectURL(blob), blob.type);
    }

    /* called by every app page: drops the session if the server no longer accepts the token */
    async function verify() {
        return; /* login removed: no session check */
        var s = getSession(); if (!s) return;
        if (!s.token || tokenExpired(s.token)) return logout(true);
        try {
            var res = await fetch(API_BASE + '/api/users/me', { headers: { Authorization: 'Bearer ' + s.token } });
            if (res.status === 401 || res.status === 403) logout(true);
        } catch (e) { /* server offline: keep the page usable */ }
    }

    function wsUrl(path) {
        var base = API_BASE || location.origin;
        return base.replace(/^http/, 'ws') + path;
    }

    /* small pill message at the bottom of the screen */
    function toast(msg, isErr) {
        var t = document.createElement('div'); t.className = 'toast' + (isErr ? ' err' : ''); t.setAttribute('role', 'status'); t.textContent = msg;
        document.body.appendChild(t); setTimeout(function () { t.remove() }, 4500);
    }
    var css = document.createElement('style');
    css.textContent = '.toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:9999;max-width:min(92vw,520px);background:#4A0E17;color:#fff;padding:12px 22px;border-radius:999px;font:600 .9rem "Plus Jakarta Sans",system-ui,sans-serif;box-shadow:0 14px 35px -10px rgba(74,14,23,.45);text-align:center}.toast.err{background:#ba1a1a}';
    document.head.appendChild(css);
    var dcss = document.createElement('style');
    dcss.textContent = '.docov{position:fixed;inset:0;z-index:4000;display:grid;place-items:center;padding:16px;background:rgba(74,14,23,.38);-webkit-backdrop-filter:blur(4px);backdrop-filter:blur(4px);animation:docIn .18s ease-out}.docbox{width:min(760px,100%);height:min(78vh,620px);display:flex;flex-direction:column;background:#fff;border-radius:22px;overflow:hidden;box-shadow:0 40px 80px -24px rgba(74,14,23,.55),0 10px 24px -10px rgba(74,14,23,.25)}.doch{display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#FFE4EA;color:#7A1C2C;font:700 1rem \"Plus Jakarta Sans\",system-ui,sans-serif}.docx{width:34px;height:34px;border-radius:50%;border:1px solid #F6C3CF;background:#fff;color:#7A1C2C;font-size:1rem;cursor:pointer;line-height:1}.docb{flex:1;min-height:0;background:#faf7f2;display:grid}.docb iframe{width:100%;height:100%;border:0;background:#fff}.docb img{max-width:100%;max-height:100%;margin:auto;object-fit:contain}@keyframes docIn{from{opacity:0;transform:scale(.97)}to{opacity:1;transform:none}}';
    document.head.appendChild(dcss);

    window.IF = { API_BASE: API_BASE, api: api, getSession: getSession, setSession: setSession, clearSession: clearSession, saveLogin: saveLogin, homeFor: homeFor, tokenExpired: tokenExpired, logout: logout, verify: verify, toast: toast, wsUrl: wsUrl, openProtectedFile: openProtectedFile, blink: blink, pager: pager };
})();