/* InsightFlow - shared API helper (session, requests, toast).
   Everything lives under one global, `IF`, so it never clashes with the page scripts. */
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
            if (!s || !s.token) { logout(true); throw new Error('Please sign in again.') }
            headers['Authorization'] = 'Bearer ' + s.token;
        }
        if (o.json) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(o.json) }
        else if (o.form) { body = new URLSearchParams(o.form) }
        else if (o.formData) { body = o.formData }

        var res;
        try { res = await fetch(API_BASE + path, { method: o.method || 'GET', headers: headers, body: body }) }
        catch (e) { throw new Error('Cannot reach the server. Please make sure the backend is running.') }

        var data = null; try { data = await res.json() } catch (e) { }
        if (!res.ok) {
            if (res.status === 401 && o.auth) { logout(true) }
            var err = new Error(errText(data, res.status)); err.status = res.status; throw err;
        }
        return data;
    }

    /* fetch a protected file with the token and open it in a new tab (used for license documents) */
    async function openProtectedFile(path) {
        var s = getSession(), w = window.open('', '_blank');
        try {
            var res = await fetch(API_BASE + path, { headers: { Authorization: 'Bearer ' + (s && s.token) } });
            if (!res.ok) throw new Error('Could not open the document.');
            var blob = await res.blob(), url = URL.createObjectURL(blob);
            if (w) w.location = url; else location.href = url;
        } catch (e) { if (w) w.close(); throw e }
    }

    /* called by every app page: drops the session if the server no longer accepts the token */
    async function verify() {
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

    window.IF = { API_BASE: API_BASE, api: api, getSession: getSession, setSession: setSession, clearSession: clearSession, saveLogin: saveLogin, homeFor: homeFor, tokenExpired: tokenExpired, logout: logout, verify: verify, toast: toast, wsUrl: wsUrl, openProtectedFile: openProtectedFile };
})();
