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

/* same rules as the backend (is_strong_password): 8+ chars, 1 uppercase, 1 digit, 1 symbol from @$!%*?& */
function passwordProblem(p) {
    if (p.length < 8) return 'Password must be at least 8 characters long.';
    if (!/[A-Z]/.test(p)) return 'Password must contain at least one UPPERCASE letter (A-Z).';
    if (!/\d/.test(p)) return 'Password must contain at least one number (0-9).';
    if (!/[@$!%*?&]/.test(p)) return 'Password must contain at least one symbol: @ $ ! % * ? &';
    return '';
}

function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/* ---------- create account (CFO) -> POST /cfo/signup ---------- */
$('#rf').onsubmit = async e => {
    e.preventDefault(); const g = x => $(x).value, er = $('#re2'), btn = e.target.querySelector('button.solid');
    say(er, '');

    const name = g('#rn').trim(), company = g('#rco').trim(), email = g('#re').trim().toLowerCase(), lic = g('#rl').trim();
    const issue = g('#ri'), expiry = g('#rx'), today = todayStr();

    if (!name) return say(er, 'Please enter your full name.');
    if (!company) return say(er, 'Please enter your company name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return say(er, 'Please enter a valid email address.');
    if (!lic) return say(er, 'Please enter your license number.');
    if (!issue || !expiry) return say(er, 'Please select the license issue and expiry dates.');
    if (issue > today) return say(er, 'Issue date cannot be in the future.');
    if (expiry <= issue) return say(er, 'Expiry date must be after the issue date.');
    if (expiry <= today) return say(er, 'This license has expired. Please use a license that is still valid.');
    if (!LF) return say(er, 'Please upload your license document.');
    const pw = passwordProblem(g('#rw'));
    if (pw) return say(er, pw);
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
    busy(btn, true, 'Signing in…');
    try {
        const d = await IF.api('/login', { method: 'POST', form: { username: $('#le').value.trim(), password: $('#lw').value } });
        IF.saveLogin(d, $('#lk').checked);
        location.href = d.role === 'admin' ? 'admin.html' : (next || 'home.html');
    } catch (ex) { say(er, ex.message); busy(btn, false) }
};


/* ---------- forgot password ---------- */
$('#ff').onsubmit = async e => {
    e.preventDefault();
    const er = $('#fe2'), btn = e.target.querySelector('button.solid');
    say(er, '');
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