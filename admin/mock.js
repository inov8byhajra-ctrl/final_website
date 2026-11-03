/* DUMMY BACKEND — works only when the real server (127.0.0.1:8000) is not reachable.
   Data is kept in localStorage ('if_mock_v1'). To reset demo data: localStorage.removeItem('if_mock_v1') */
(function () {
  var KEY = 'if_mock_v1';
  var day = function (n) { var x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10) };
  function seed() {
    var co = [['Zeta Textiles', 'zetatextiles.com', 'Pakistan'], ['Nova Foods', 'novafoods.pk', 'Pakistan'], ['Apex Logistics', 'apexlog.com', 'UAE'], ['Bright Pharma', 'brightpharma.com', 'Pakistan'], ['Orbit Steel', 'orbitsteel.io', 'Turkey'], ['Lumen Energy', 'lumenenergy.com', 'UAE'], ['Cedar Retail', 'cedarretail.com', 'Pakistan'], ['Pioneer Agro', 'pioneeragro.pk', 'Pakistan'], ['Skyline Builders', 'skylinebuild.com', 'Saudi Arabia'], ['Falcon Motors', 'falconmotors.com', 'UAE'], ['Indigo Tech', 'indigotech.io', 'Pakistan'], ['Harbor Marine', 'harbormarine.com', 'Oman']];
    var nm = ['Ali Raza', 'Sara Khan', 'Usman Tariq', 'Hina Malik', 'Bilal Ahmed', 'Ayesha Noor', 'Hamza Sheikh', 'Maryam Iqbal', 'Daniyal Butt', 'Fatima Zahid', 'Omar Farooq', 'Zainab Ali'];
    var cfos = co.map(function (c, i) {
      var ap = i < 4;
      return { id: i + 1, name: nm[i], email: nm[i].toLowerCase().replace(' ', '.') + '@' + c[1], phone: '+92 300 55' + (10000 + i * 137), country: c[2], company_name: c[0], company_domain: c[1], license_number: 'LIC-' + (2400 + i * 17), license_issue_date: day(-300 - i * 20), license_expiry_date: day(i === 0 ? 15 : (i === 1 ? 22 : 200 + i * 40)), has_license_file: true, is_approved: ap, is_blocked: i === 2, account_expiry_date: ap ? day(i === 0 ? 15 : (i === 1 ? 22 : 200 + i * 40)) + 'T23:59:59' : null, created_at: day(-30 + i) };
    });
    var mn = [['Kamran Yousaf', 'Lahore', 1, 1], ['Nadia Hassan', 'Karachi', 1, 1], ['Imran Javed', 'Islamabad', 2, 1], ['Rabia Shah', 'Dubai', 3, 1], ['Taha Siddiqui', 'Multan', 4, 1], ['Sidra Anwar', 'Peshawar', 2, 0], ['Waqas Mirza', 'Faisalabad', 1, 0], ['Komal Rauf', 'Abu Dhabi', 3, 0], ['Haris Mehmood', 'Quetta', 4, 0], ['Laiba Nasir', 'Sialkot', 2, 0]];
    var mgrs = mn.map(function (m, i) {
      var c = cfos[m[2] - 1];
      return { id: 101 + i, name: m[0], email: m[0].toLowerCase().replace(' ', '.') + '@' + c.company_domain, phone: '+92 321 44' + (20000 + i * 91), region: m[1], cfo_id: c.id, cfo_name: c.name, cfo_company_name: c.company_name, company_name: c.company_name, is_blocked: false, is_verified: !!m[3], created_at: day(-10 + i) };
    });
    return { cfos: cfos, mgrs: mgrs, bl: [{ id: 490, company_name: 'Legacy Imports', company_domain: 'legacyimports.pk', email: 'admin@legacyimports.pk', license_number: 'LIC-8801', reason: 'Demo: invalid license documents' }, { id: 491, company_name: 'Northstar Trading', company_domain: 'northstartrading.com', email: 'compliance@northstartrading.com', license_number: 'LIC-8802', reason: 'Demo: duplicate registration' }], rn: [{ id: 1, cfo_id: 2, name: cfos[1].name, email: cfos[1].email, company_name: cfos[1].company_name, old_expiry: day(5), license_number: 'LIC-9001', license_issue_date: day(-2), license_expiry_date: day(365), has_license_file: true }], nid: 500 };
  }
  var S; try { S = JSON.parse(localStorage.getItem(KEY)) } catch (e) { }
  if (!S) S = seed();
  /* Upgrade existing demo data created by an earlier version without clearing the user's other demo changes. */
  if (S && Array.isArray(S.rn) && S.rn.length < 3 && Array.isArray(S.cfos)) {
    var demoRenewals = [
      { id: 2, cfo_id: 1, name: S.cfos[0] && S.cfos[0].name, email: S.cfos[0] && S.cfos[0].email, company_name: S.cfos[0] && S.cfos[0].company_name, old_expiry: day(12), license_number: 'LIC-9002', license_issue_date: day(-1), license_expiry_date: day(400), has_license_file: true, status: 'Pending' },
      { id: 3, cfo_id: 4, name: S.cfos[3] && S.cfos[3].name, email: S.cfos[3] && S.cfos[3].email, company_name: S.cfos[3] && S.cfos[3].company_name, old_expiry: day(20), license_number: 'LIC-9003', license_issue_date: day(-4), license_expiry_date: day(430), has_license_file: false, status: 'Pending' }
    ];
    demoRenewals.forEach(function (r) { if (r.name && !S.rn.some(function (old) { return old.id === r.id; })) S.rn.push(r); });
  }
  if (S && Array.isArray(S.bl) && S.bl.length < 2) { S.bl = [{ id: 490, company_name: 'Legacy Imports', company_domain: 'legacyimports.pk', email: 'admin@legacyimports.pk', license_number: 'LIC-8801', reason: 'Demo: invalid license documents' }, { id: 491, company_name: 'Northstar Trading', company_domain: 'northstartrading.com', email: 'compliance@northstartrading.com', license_number: 'LIC-8802', reason: 'Demo: duplicate registration' }]; }
  if (S && Array.isArray(S.cfos)) {
    var demoPending = [
      { id: 901, name: 'Demo CFO One', email: 'demo.cfo1@samplecompany.pk', phone: '+92 300 1110001', country: 'Pakistan', company_name: 'Sample Company One', company_domain: 'samplecompany.pk', license_number: 'DEMO-901', license_issue_date: day(-20), license_expiry_date: day(300), has_license_file: true, is_approved: false, is_blocked: false, account_expiry_date: null, created_at: day(-2) },
      { id: 902, name: 'Demo CFO Two', email: 'demo.cfo2@sampletraders.pk', phone: '+92 300 1110002', country: 'Pakistan', company_name: 'Sample Traders', company_domain: 'sampletraders.pk', license_number: 'DEMO-902', license_issue_date: day(-10), license_expiry_date: day(330), has_license_file: true, is_approved: false, is_blocked: false, account_expiry_date: null, created_at: day(-1) },
      { id: 903, name: 'Demo CFO Three', email: 'demo.cfo3@brightdemo.pk', phone: '+92 300 1110003', country: 'Pakistan', company_name: 'Bright Demo Ltd', company_domain: 'brightdemo.pk', license_number: 'DEMO-903', license_issue_date: day(-18), license_expiry_date: day(290), has_license_file: true, is_approved: false, is_blocked: false, account_expiry_date: null, created_at: day(-3) },
      { id: 904, name: 'Demo CFO Four', email: 'demo.cfo4@orbitdemo.pk', phone: '+92 300 1110004', country: 'UAE', company_name: 'Orbit Demo Trading', company_domain: 'orbitdemo.pk', license_number: 'DEMO-904', license_issue_date: day(-12), license_expiry_date: day(320), has_license_file: false, is_approved: false, is_blocked: false, account_expiry_date: null, created_at: day(-4) },
      { id: 905, name: 'Demo CFO Five', email: 'demo.cfo5@cedardemo.pk', phone: '+92 300 1110005', country: 'Pakistan', company_name: 'Cedar Demo Retail', company_domain: 'cedardemo.pk', license_number: 'DEMO-905', license_issue_date: day(-8), license_expiry_date: day(350), has_license_file: true, is_approved: false, is_blocked: false, account_expiry_date: null, created_at: day(-5) }
    ];
    demoPending.forEach(function(c){ if(S.cfos.filter(function(old){return !old.is_approved;}).length < 5 && !S.cfos.some(function(old){return old.id===c.id;})) S.cfos.push(c); });
  }
  if (S && Array.isArray(S.cfos)) { S.cfos.forEach(function(c){ if(c.id===2 && c.is_approved){ c.account_expiry_date = day(22) + 'T23:59:59'; c.license_expiry_date = day(22); } }); }
  var save = function () { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { } };
  var fail = function (m, s) { var e = new Error(m); e.status = s || 400; throw e };
  var find = function (id) { return S.cfos.find(function (x) { return x.id === id }) || S.mgrs.find(function (x) { return x.id === id }) };


  /* ---- demo activity (logins / logouts / uploads) for the Activity page ---- */
  function lcg(seed) { var s = seed % 2147483647; if (s <= 0) s += 2147483646; return function () { s = s * 16807 % 2147483647; return (s - 1) / 2147483646 } }
  function genActivity() {
    var ev = [], pres = {}, now = Date.now(), nid = 1, ONLINE = { 1: 1, 2: 1, 101: 1, 102: 1, 104: 1 };
    var FILES = ['Q3_Sales_Report.xlsx', 'Inventory_Oct.csv', 'Payroll_Sept.xlsx', 'Budget_2026.xlsx', 'Expenses_Oct.csv', 'Vendor_Ledger.xlsx', 'Regional_Targets.xlsx', 'Bank_Statement.pdf', 'GST_Returns.pdf', 'Cashflow_Forecast.xlsx'];
    var users = S.cfos.filter(function (c) { return c.is_approved }).map(function (c) { return { u: c, role: 'cfo' } }).concat(S.mgrs.filter(function (m) { return m.is_verified }).map(function (m) { return { u: m, role: 'regional_manager' } }));
    users.forEach(function (x) {
      var u = x.u, r = lcg(u.id * 97 + 13);
      for (var d = 29; d >= 0; d--) {
        if (d > 0 && r() < 0.3) continue;
        var cnt = r() < 0.25 ? 2 : 1;
        for (var k = 0; k < cnt; k++) {
          var b = new Date(); b.setDate(b.getDate() - d); b.setHours(8 + Math.floor(r() * 4) + k * 5, Math.floor(r() * 60), Math.floor(r() * 60), 0);
          var st = b.getTime(), len = (20 + Math.floor(r() * 200)) * 60000, open = false, end = st + len;
          if (d === 0 && end > now) {
            if (ONLINE[u.id] && k === 0) { st = now - (15 + Math.floor(r() * 70)) * 60000; open = true; end = now }
            else { end = now - 3 * 60000; if (end - st < 10 * 60000) continue }
          }
          if (st > now) continue;
          var base = { email: u.email, name: u.name, role: x.role };
          ev.push(Object.assign({ id: 'm' + (nid++), type: 'login', at: new Date(st).toISOString() }, base));
          var up = Math.floor(r() * 3.4);
          for (var q = 0; q < up; q++) {
            var t = st + Math.floor(r() * (end - st)), f = FILES[Math.floor(r() * FILES.length)];
            ev.push(Object.assign({ id: 'm' + (nid++), type: 'upload', at: new Date(t).toISOString(), file_name: f, file_size: 40000 + Math.floor(r() * 6e6) }, base));
          }
          if (open) pres[u.email] = new Date(now - 20000).toISOString();
          else if (r() < 0.92) ev.push(Object.assign({ id: 'm' + (nid++), type: 'logout', at: new Date(end).toISOString() }, base));
        }
      }
    });
    var live = [], lp = {}; try { live = JSON.parse(localStorage.getItem('if_activity_v1')) || []; lp = JSON.parse(localStorage.getItem('if_presence_v1')) || {} } catch (e) { }
    for (var e in lp) pres[e] = lp[e];
    return { events: ev.concat(live), presence: pres };
  }

  function handle(path, o) {
    var m = (o.method || 'GET').toUpperCase(), j = o.json || {}, p = path.split('?')[0], x;
    var R = function (v) { IF_MOCK.active = true; save(); return v };
    if (p === '/admin/cfos') return R({ test_tools: false, cfos: S.cfos, stats: { pending: S.cfos.filter(function (c) { return !c.is_approved }).length, approved: S.cfos.filter(function (c) { return c.is_approved }).length, managers: S.mgrs.filter(function (c) { return c.is_verified }).length } });
    if (p === '/admin/regional-managers') return R(S.mgrs);
    if (p === '/admin/notifications') return R([]);
    if (p === '/admin/activity') return R(genActivity());
    if (p === '/admin/renewals' && m === 'GET') return R({ renewals: S.rn });
    if (p === '/admin/expiring-soon') return R({ expiring: S.cfos.filter(function (c) { return c.is_approved && c.account_expiry_date }).map(function (c) { var d = Math.ceil((new Date(c.account_expiry_date) - Date.now()) / 864e5); return { id: c.id, name: c.name, email: c.email, company_name: c.company_name, expiry_date: c.account_expiry_date.slice(0, 10), days_left: d, expired: d < 0, is_blocked: c.is_blocked } }).filter(function (c) { return c.days_left <= 28 }) });
    if (p === '/admin/run-expiry-check') return R({ as_of: day(0), reminders_sent: 0, blocked: 0 });
    if (p === '/admin/blacklist' && m === 'GET') return R(S.bl);
    if (p === '/admin/blacklist' && m === 'POST') {
      var cf = j.cfo_id ? S.cfos.find(function (c) { return c.id === j.cfo_id }) : null, mg = j.manager_id ? S.mgrs.find(function (c) { return c.id === j.manager_id }) : null;
      if (!cf && !mg) fail('User not found', 404);
      var t = cf || mg, base = cf || S.cfos.find(function (c) { return c.id === mg.cfo_id }) || {};
      S.bl.push({ id: ++S.nid, company_name: base.company_name || t.company_name, company_domain: base.company_domain, email: t.email, license_number: base.license_number, reason: j.reason || 'Blacklisted by admin' });
      if (cf) { S.cfos = S.cfos.filter(function (c) { return c.id !== cf.id }); S.mgrs = S.mgrs.filter(function (c) { return c.cfo_id !== cf.id }) } else S.mgrs = S.mgrs.filter(function (c) { return c.id !== mg.id });
      return R({ message: 'Added to the blacklist (demo data).' });
    }
    if ((x = p.match(/^\/admin\/blacklist\/(\d+)$/)) && m === 'DELETE') { S.bl = S.bl.filter(function (b) { return b.id !== +x[1] }); return R({ message: 'Removed from the blacklist.' }) }
    if (p === '/admin/approve-license' && m === 'POST') {
      var c = S.cfos.find(function (c) { return c.id === j.cfo_id }); if (!c) fail('CFO not found', 404);
      if (j.is_valid) { c.is_approved = true; c.account_expiry_date = j.expiry_date || (c.license_expiry_date + 'T23:59:59'); return R({ message: c.name + ' approved.', email_sent: true }) }
      S.cfos = S.cfos.filter(function (z) { return z.id !== c.id }); S.mgrs = S.mgrs.filter(function (z) { return z.cfo_id !== c.id });
      return R({ message: c.name + ' rejected.', email_sent: true });
    }
    if (p === '/admin/approve-manager' && m === 'POST') {
      var g = S.mgrs.find(function (z) { return z.id === j.manager_id }); if (!g) fail('Manager not found', 404);
      if (j.approve === false) S.mgrs = S.mgrs.filter(function (z) { return z.id !== g.id }); else g.is_verified = true;
      return R({ message: g.name + (j.approve === false ? ' rejected.' : ' approved.') });
    }
    if ((x = p.match(/^\/admin\/users\/(\d+)\/toggle-block$/))) { var u = find(+x[1]); if (!u) fail('User not found', 404); u.is_blocked = !u.is_blocked; return R({ message: u.name + (u.is_blocked ? ' blocked.' : ' unblocked.'), is_blocked: u.is_blocked }) }
    if ((x = p.match(/^\/admin\/renewals\/(\d+)\/decision$/))) { S.rn = S.rn.filter(function (r) { return r.id !== +x[1] }); return R({ message: j.approve ? 'Renewal approved.' : 'Renewal rejected.', email_sent: true }) }
    return undefined;
  }
  function demoDoc() {
    var h = '<title>Demo license</title><body style="font-family:sans-serif;max-width:560px;margin:60px auto;padding:30px;border:3px double #7A1C2C;border-radius:12px"><h2 style="color:#4A0E17">Business License (demo document)</h2><p>This is a placeholder shown because the real backend is not running. With the backend running, the actual uploaded license file opens here.</p></body>';
    return URL.createObjectURL(new Blob([h], { type: 'text/html' }));
  }
  window.IF_MOCK = { active: false, handle: handle, demoDoc: demoDoc };
})();
