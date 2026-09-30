try { const _s = JSON.parse(localStorage.getItem('if_session')); if (_s && _s.k === 0 && !sessionStorage.getItem('if_tab')) localStorage.removeItem('if_session') } catch (e) { }
const $ = s => document.querySelector(s);
const q = new URLSearchParams(location.search), next = (q.get('next') || '').replace(/[^\w.\-]/g, '');

/* already signed in -> straight to the right page (admin console or dashboard) */
{ const s = IF.getSession(); if (s && s.token && !IF.tokenExpired(s.token)) location.replace(s.role === 'admin' ? 'admin.html' : (next || 'home.html')) }

function tab(t) { const l = t === 'login', r = t === 'register', f = t === 'forgot'; $('#tl').ariaSelected = l || f; $('#tr').ariaSelected = r; $('#lp').hidden = !l; $('#rp').hidden = !r; $('#fp').hidden = !f; $('#ind').style.transform = r ? 'translateX(100%)' : '' }
tab(q.get('tab') === 'register' ? 'register' : 'login');

/* message helper: red for errors, green for good news */
function say(el, text, ok) { el.style.color = ok ? '#2e7d32' : ''; el.textContent = text }
function busy(btn, on, label) { if (on) { btn.dataset.l = btn.textContent; btn.textContent = label; btn.disabled = true } else { btn.textContent = btn.dataset.l || btn.textContent; btn.disabled = false } }

/* ---------- create account (CFO) -> POST /api/auth/cfo/signup ---------- */
$('#rf').onsubmit = async e => {
    e.preventDefault(); const g = x => $(x).value, er = $('#re2'), btn = e.target.querySelector('button.solid');
    say(er, '');
    if (!LF) return say(er, 'Please upload your license document.');
    if (g('#rw') !== g('#rc')) return say(er, 'Passwords do not match.');
    if (g('#rx') <= g('#ri')) return say(er, 'Expiry must be after issue date.');
    const email = g('#re').trim().toLowerCase(), fd = new FormData();
    fd.append('name', g('#rn').trim()); fd.append('company_name', g('#rco').trim()); fd.append('email', email);
    fd.append('license_number', g('#rl').trim()); fd.append('license_issue_date', g('#ri')); fd.append('license_expiry_date', g('#rx'));
    fd.append('password', g('#rw')); fd.append('license_file', LF, LF.name);
    busy(btn, true, 'Creating account…');
    try {
        await IF.api('/api/auth/cfo/signup', { method: 'POST', formData: fd });
        e.target.reset(); LF = null; dz.classList.remove('ok'); dt.innerHTML = DZ_HTML;
        $('#le').value = email; $('#lw').value = ''; tab('login');
        say($('#le2'), 'Account created. An admin will verify your license and email you once you are approved.', true);
    } catch (ex) { say(er, ex.message) } finally { busy(btn, false) }
};

/* ---------- sign in -> POST /api/auth/login ---------- */
$('#lf').onsubmit = async e => {
    e.preventDefault(); const er = $('#le2'), btn = e.target.querySelector('button.solid'); say(er, '');
    busy(btn, true, 'Signing in…');
    try {
        const d = await IF.api('/api/auth/login', { method: 'POST', form: { username: $('#le').value.trim(), password: $('#lw').value } });
        IF.saveLogin(d, $('#lk').checked);
        location.href = d.role === 'admin' ? 'admin.html' : (next || 'home.html');
    } catch (ex) { say(er, ex.message); busy(btn, false) }
};

/* ---------- forgot password: not part of the backend yet ---------- */
$('#ff').onsubmit = e => {
    e.preventDefault();
    say($('#fe2'), 'Password reset by email is not available yet. Please contact your administrator.');
};

/* license document upload */
let LF = null; const dz = $('#dz'), fi = $('#rd'), dt = $('#dt'), DZ_HTML = dt.innerHTML;
function pick(f) {
    $('#re2').textContent = ''; if (!f) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return $('#re2').textContent = 'License must be a PDF, JPG or PNG.';
    if (f.size > 5 * 1024 * 1024) return $('#re2').textContent = 'License file must be 5 MB or smaller.';
    LF = f; dz.classList.add('ok'); dt.innerHTML = '<b></b><small>Click to replace</small>'; dt.firstChild.textContent = f.name
}
dz.onclick = () => fi.click(); dz.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fi.click() } };
fi.onchange = () => pick(fi.files[0]);
['dragover', 'dragenter'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.add('over') }));
['dragleave', 'drop'].forEach(t => dz.addEventListener(t, e => { e.preventDefault(); dz.classList.remove('over') }));
dz.addEventListener('drop', e => pick(e.dataTransfer.files[0]));
document.querySelectorAll('.sh').forEach(b => b.onclick = () => { const i = $('#' + b.dataset.t), s = i.type === 'password'; i.type = s ? 'text' : 'password'; b.textContent = s ? 'Hide' : 'Show' });
