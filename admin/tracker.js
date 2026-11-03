/* InsightFlow activity tracker.
   Include this ONE line on every CFO / regional-manager page, right after api.js:
       <script src="tracker.js"></script>
   It automatically records: login, logout, file uploads (any IF.api call that sends a FormData with a File),
   and a "still online" ping every minute. Events are kept in localStorage (demo mode) and also POSTed to
   POST /api/activity/log and POST /api/activity/ping when the real backend is running.
   Admin accounts are never tracked. */
(function () {
  if (!window.IF) return;
  var AK = 'if_activity_v1', PK = 'if_presence_v1', n = 0;
  function rd(k, d) { try { return JSON.parse(localStorage.getItem(k)) || d } catch (e) { return d } }
  function wr(k, v) { try { localStorage.setItem(k, JSON.stringify(v)) } catch (e) { } }
  function me() { var s = IF.getSession(); return (s && s.e && s.role !== 'admin') ? { email: s.e, name: s.n || s.e, role: s.role } : null }
  function post(path, body) {
    try {
      var s = IF.getSession(), h = { 'Content-Type': 'application/json' };
      if (s && s.token) h.Authorization = 'Bearer ' + s.token;
      fetch((IF.API_BASE || '') + path, { method: 'POST', headers: h, body: JSON.stringify(body), keepalive: true }).catch(function () { });
    } catch (e) { }
  }
  function ping(u) { u = u || me(); if (!u) return; var p = rd(PK, {}); p[u.email] = new Date().toISOString(); wr(PK, p); post('/api/activity/ping', { email: u.email }) }
  function log(type, meta, u) {
    u = u || me(); if (!u) return;
    var ev = { id: 'l' + Date.now() + '_' + (++n), email: u.email, name: u.name, role: u.role, type: type, at: new Date().toISOString() };
    for (var k in (meta || {})) ev[k] = meta[k];
    var a = rd(AK, []); a.push(ev); if (a.length > 3000) a = a.slice(-3000); wr(AK, a);
    post('/api/activity/log', ev); ping(u);
  }

  /* login */
  var saveLogin = IF.saveLogin;
  IF.saveLogin = function (data, keep) {
    var r = saveLogin.apply(this, arguments);
    if (data && data.role && data.role !== 'admin') log('login', {}, { email: data.email, name: data.name || data.email, role: data.role });
    return r;
  };
  /* logout */
  var logout = IF.logout;
  IF.logout = function () { log('logout'); return logout.apply(this, arguments) };
  /* file uploads */
  var api = IF.api;
  IF.api = async function (path, o) {
    var files = [];
    try { if (o && o.formData && o.formData.entries) for (var p of o.formData.entries()) if (p[1] && typeof p[1] === 'object' && 'size' in p[1] && p[1].name) files.push(p[1]) } catch (e) { }
    var res = await api.apply(this, arguments);
    files.forEach(function (f) { log('upload', { file_name: f.name, file_size: f.size }) });
    return res;
  };

  window.IFTrack = { log: log, ping: ping, login: function () { log('login') }, logout: function () { log('logout') }, upload: function (f) { log('upload', { file_name: f.name, file_size: f.size }) } };
  ping(); setInterval(ping, 60000);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) ping() });
})();
