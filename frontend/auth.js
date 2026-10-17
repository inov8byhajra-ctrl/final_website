/* NOTE: login.html must load these scripts in this order:
   <script src="api.js"></script>
   <script src="validators.js"></script>
   <script src="auth.js"></script>                                           */
if (typeof V === 'undefined') console.error('validators.js is not loaded. Add <script src="validators.js"></script> before auth.js in login.html');

try { const _s = JSON.parse(localStorage.getItem('if_session')); if (_s && _s.k === 0 && !sessionStorage.getItem('if_tab')) localStorage.removeItem('if_session') } catch (e) { }
const $ = s => document.querySelector(s);
const q = new URLSearchParams(location.search), next = (q.get('next') || '').replace(/[^\w.\-]/g, '');

/* already signed in -> straight to the right page */
{ const s = IF.getSession(); if (s && s.token && !IF.tokenExpired(s.token)) location.replace(s.role === 'admin' ? 'admin.html' : (next || 'home.html')) }

function tab(t) { const l = t === 'login', r = t === 'register', f = t === 'forgot'; $('#tl').ariaSelected = l || f; $('#tr').ariaSelected = r; $('#lp').hidden = !l; $('#rp').hidden = !r; $('#fp').hidden = !f; $('#ind').style.transform = r ? 'translateX(100%)' : '' }
tab(q.get('tab') === 'register' ? 'register' : 'login');

/* shows a message right above the button and scrolls it into view (red = error, green = success) */
function say(el, text, ok) {
    el.style.color = ok ? '#2e7d32' : '';
    el.style.fontWeight = text ? '600' : '';
    el.textContent = text;
    if (text) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
}
function busy(btn, on, label) { if (on) { btn.dataset.l = btn.textContent; btn.textContent = label; btn.disabled = true } else { btn.textContent = btn.dataset.l || btn.textContent; btn.disabled = false } }

function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------- live input filters (stop bad characters while typing / pasting) ---------- */
V.lettersOnly($('#rn'));                 // full name: letters + spaces only
$('#rco').maxLength = 100;               // company name length limit
$('#re').maxLength = 120;                // emails
$('#le').maxLength = 120;
$('#fe').maxLength = 120;
$('#rl').maxLength = 40;                 // license number: letters, digits, - and / only (auto uppercase)

const LIC_EMAIL_MSG = 'License number cannot be an email address or contain "@". Enter the number printed on your trade license.';
$('#rl').addEventListener('input', e => {
    const raw = e.target.value;
    /* an "@" means the user typed an email by mistake: keep it visible and warn,
       instead of silently stripping it (that turned emails into e.g. CURSORUSER713GMAILCOM) */
    if (raw.includes('@')) {
        e.target.value = raw.toUpperCase().replace(/[^A-Z0-9\-\/@]/g, '');
        say($('#re2'), LIC_EMAIL_MSG);
        return;
    }
    e.target.value = raw.toUpperCase().replace(/[^A-Z0-9\-\/]/g, '');
});
$('#rw').maxLength = 72;                 // bcrypt limit
$('#rc').maxLength = 72;

/* ---------- create account (CFO) -> POST /cfo/signup ---------- */
$('#rf').onsubmit = async e => {
    e.preventDefault(); const g = x => $(x).value, er = $('#re2'), btn = e.target.querySelector('button.solid');
    say(er, '');

    const name = g('#rn').trim().replace(/\s+/g, ' '), company = g('#rco').trim().replace(/\s+/g, ' '),
        email = g('#re').trim().toLowerCase(), lic = g('#rl').trim().toUpperCase();
    const issue = g('#ri'), expiry = g('#rx'), today = todayStr();

    let p;
    if ((p = V.name(name, 'Full name'))) return say(er, p);
    if ((p = V.company(company))) return say(er, p);
    if ((p = V.email(email))) return say(er, p);
    if (lic.includes('@')) return say(er, LIC_EMAIL_MSG);
    if ((p = V.license(lic))) return say(er, p);
    if (!issue || !expiry) return say(er, 'Please select the license issue and expiry dates.');
    if (issue > today) return say(er, 'Issue date cannot be in the future.');
    if (expiry <= issue) return say(er, 'Expiry date must be after the issue date.');
    if (expiry <= today) return say(er, 'This license has expired. Please use a license that is still valid.');
    if (!LF) return say(er, 'Please upload your license document.');
    if ((p = V.password(g('#rw')))) return say(er, p);
    if (g('#rw') !== g('#rc')) return say(er, 'Passwords do not match.');

    const fd = new FormData();
    fd.append('name', name); fd.append('company_name', company); fd.append('email', email);
    fd.append('license_number', lic); fd.append('license_issue_date', issue); fd.append('license_expiry_date', expiry);
    fd.append('password', g('#rw')); fd.append('license_file', LF, LF.name);
    busy(btn, true, 'Creating account…');
    try {
        await IF.api('/cfo/signup', { method: 'POST', formData: fd });
        e.target.reset();
        LF = null;
        dz.classList.remove('ok');
        dt.innerHTML = DZ_HTML;
        say(er, 'Registration submitted. Your account is pending admin approval. You will get an email once it is approved. Until then you cannot sign in.', true);
    } catch (ex) {
        say(er, ex.message);
    } finally {
        busy(btn, false);
    }
}

/* ---------- sign in -> POST /login ---------- */
$('#lf').onsubmit = async e => {
    e.preventDefault(); const er = $('#le2'), btn = e.target.querySelector('button.solid'); say(er, '');

    const emailErr = V.email($('#le').value);
    if (emailErr) return say(er, emailErr);
    if (!$('#lw').value) return say(er, 'Please enter your password.');

    busy(btn, true, 'Signing in…');
    try {
        const d = await IF.api('/login', { method: 'POST', form: { username: $('#le').value.trim(), password: $('#lw').value } });
        IF.saveLogin(d, $('#lk').checked);
        location.href = d.role === 'admin' ? 'admin.html' : (next || 'home.html');
    } catch (ex) {
        say(er, ex.message); busy(btn, false);
        const m = ex.message.match(/^(.*?)\s*(https?:\/\/\S+)$/);
        if (m) { er.textContent = m[1] + ' '; const a = document.createElement('a'); a.href = 'renew.html'; a.textContent = 'Renew license'; er.appendChild(a); }
    }
};


/* ---------- forgot password ---------- */
$('#ff').onsubmit = async e => {
    e.preventDefault();
    const er = $('#fe2'), btn = e.target.querySelector('button.solid');
    say(er, '');

    // check the email format BEFORE calling the server
    const emailErr = V.email($('#fe').value);
    if (emailErr) return say(er, emailErr);

    busy(btn, true, 'Sending link…');
    try {
        const resp = await IF.api('/api/users/forgot-password', {
            method: 'POST',
            json: { email: $('#fe').value.trim().toLowerCase() }
        });
        say(er, resp.message, true);
        e.target.reset();
    } catch (ex) {
        say(er, ex.message);
        // email is not registered -> show a clear message + a shortcut to create an account
        if (ex.status === 404) {
            er.appendChild(document.createTextNode(' '));
            const a = document.createElement('a');
            a.href = '#'; a.textContent = 'Create an account';
            a.onclick = ev => { ev.preventDefault(); say(er, ''); tab('register'); };
            er.appendChild(a);
        }
    } finally {
        busy(btn, false);
    }
};

/* license document upload */
let LF = null; const dz = $('#dz'), fi = $('#rd'), dt = $('#dt'), DZ_HTML = dt.innerHTML;
function pick(f) {
    say($('#re2'), ''); if (!f) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return say($('#re2'), 'License must be a PDF, JPG or PNG.');
    if (f.size > 5 * 1024 * 1024) return say($('#re2'), 'License file must be 5 MB or smaller.');
    LF = f; dz.classList.add('ok'); dt.innerHTML = '<b></b><small>Click to replace</small>'; dt.firstChild.textContent = f.name
}
dz.onclick = () => fi.click(); dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click() } };
fi.onchange = () => pick(fi.files[0]);
['dragover', 'dragenter'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add('over') }));
['dragleave', 'drop'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove('over') }));
dz.addEventListener('drop', e => pick(e.dataTransfer.files[0]));
document.querySelectorAll('.sh').forEach(b => b.onclick = () => { const i = $('#' + b.dataset.t), s = i.type === 'password'; i.type = s ? 'text' : 'password'; b.textContent = s ? 'Hide' : 'Show' });