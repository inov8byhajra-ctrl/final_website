/* auth.js – login page: sign in, register, forgot password (real backend)
   login.html must load: common.js, api.js, tracker.js, auth.js (in this order). */

const params = new URLSearchParams(location.search);
const next = (params.get('next') || 'home.html').replace(/[^\w.\-]/g, '');
let licenseFile = null;

/* Already signed in with a real, unexpired token -> skip the form. Old fake sessions are dropped. */
(function () {
  const s = IF.getSession();
  if (!s) return;
  if (!s.token || IF.tokenExpired(s.token)) { IF.clearSession(); return }
  location.replace(s.role === 'admin' ? IF.homeFor('admin') : next);
})();

/* One place for: disable button, show error, restore button */
async function submit(form, errEl, work) {
  const btn = form.querySelector('button.btn'), label = btn.textContent;
  errEl.textContent = '';
  btn.disabled = true; btn.textContent = 'Please wait…';
  try { await work() }
  catch (e) {
   errEl.innerHTML = esc(e.message).replace(/(https?:\/\/\S*renew\S*)/, '<a href="$1">Renew your license</a>');
  }
  finally { btn.disabled = false; btn.textContent = label }
}

/* ---------- Tabs ---------- */
function tab(name) {
  const login = name === 'login', register = name === 'register', forgot = name === 'forgot';
  $('#tl').ariaSelected = login || forgot;
  $('#tr').ariaSelected = register;
  $('#lp').hidden = !login;
  $('#rp').hidden = !register;
  $('#fp').hidden = !forgot;
  $('#ind').style.transform = register ? 'translateX(100%)' : '';
}
tab(params.get('tab') === 'register' ? 'register' : 'login');
const kicked = sessionStorage.getItem('if_kicked');
if (kicked) { sessionStorage.removeItem('if_kicked'); $('#le2').textContent = kicked; }

/* ---------- License upload (click or drag & drop) ---------- */
const dropBox = $('#dz'), fileInput = $('#rd'), dropText = $('#dt'), dropHtml = dropText.innerHTML;

function resetDrop() {
  licenseFile = null; fileInput.value = '';
  dropBox.classList.remove('ok'); dropText.innerHTML = dropHtml;
}
function pickFile(f) {
  $('#re2').textContent = '';
  if (!f) return;
  if (!/\.(pdf|jpe?g|png)$/i.test(f.name)) return $('#re2').textContent = 'License must be a PDF, JPG or PNG.';
  if (f.size > 5 * 1024 * 1024) return $('#re2').textContent = 'License file must be 5 MB or smaller.';
  licenseFile = f;
  dropBox.classList.add('ok');
  dropText.innerHTML = '<b></b><small>Click to replace</small>';
  dropText.firstChild.textContent = f.name;
}
dropBox.onclick = () => fileInput.click();
dropBox.onkeydown = e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click() } };
fileInput.onchange = () => pickFile(fileInput.files[0]);
['dragover', 'dragenter'].forEach(t => dropBox.addEventListener(t, e => { e.preventDefault(); dropBox.classList.add('over') }));
['dragleave', 'drop'].forEach(t => dropBox.addEventListener(t, e => { e.preventDefault(); dropBox.classList.remove('over') }));
dropBox.addEventListener('drop', e => pickFile(e.dataTransfer.files[0]));

/* ---------- Login ---------- */
$('#lf').onsubmit = e => {
  e.preventDefault();
  submit(e.target, $('#le2'), async () => {
    const data = await IF.api('/login', {
      method: 'POST',
      form: { username: $('#le').value.trim(), password: $('#lw').value }
    });
    IF.saveLogin(data, $('#lk').checked);
    location.href = data.role === 'admin' ? IF.homeFor('admin') : next;
  });
};

/* ---------- Register (CFO) ---------- */
$('#rf').onsubmit = e => {
  e.preventDefault();
  const v = id => $(id).value, err = $('#re2');
  if (!licenseFile) return err.textContent = 'Please upload your license document.';
  if (v('#rw') !== v('#rc')) return err.textContent = 'Passwords do not match.';
  if (v('#rx') <= v('#ri')) return err.textContent = 'Expiry must be after issue date.';

  const fd = new FormData();
  fd.append('name', v('#rn').trim());
  fd.append('phone', v('#rph').trim());
  fd.append('company_name', v('#rco').trim());
  fd.append('email', v('#re').trim());
  fd.append('license_number', v('#rl').trim());
  fd.append('license_issue_date', v('#ri'));
  fd.append('license_expiry_date', v('#rx'));
  fd.append('password', v('#rw'));
  fd.append('license_file', licenseFile);

  submit(e.target, err, async () => {
    const r = await IF.api('/cfo/signup', { method: 'POST', formData: fd });
    e.target.reset(); resetDrop();
    $('#le2').textContent = r.message;      // "Registration received... email on approval"
    tab('login');
  });
};

/* ---------- Forgot password: backend emails a reset link ---------- */
$('#ff').onsubmit = e => {
  e.preventDefault();
  submit(e.target, $('#fe2'), async () => {
    const r = await IF.api('/api/users/forgot-password', { method: 'POST', json: { email: $('#fe').value.trim() } });
    e.target.reset();
    $('#le2').textContent = r.message;
    tab('login');
  });
};

/* ---------- Show / Hide password ---------- */
document.querySelectorAll('.sh').forEach(btn => btn.onclick = () => {
  const input = $('#' + btn.dataset.t);
  const hidden = input.type === 'password';
  input.type = hidden ? 'text' : 'password';
  btn.textContent = hidden ? 'Hide' : 'Show';
});