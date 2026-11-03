/* =====================================================================
   auth.js – login page (login.html): sign in, register, reset password
   Needs: common.js loaded first.
   ===================================================================== */

const params = new URLSearchParams(location.search);
const next = (params.get('next') || 'home.html').replace(/[^\w.\-]/g, '');   // page to open after login
let licenseFile = null;

if (st.get('if_session', null)) location.replace(next);   // already signed in


/* ---------- Tabs: login / register / forgot ---------- */
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


/* ---------- Register ---------- */
$('#rf').onsubmit = e => {
  e.preventDefault();
  const v = id => $(id).value;
  const users = st.get('if_users', []);
  const error = msg => $('#re2').textContent = msg;

  if (!licenseFile) return error('Please upload your license document.');
  if (v('#rw') !== v('#rc')) return error('Passwords do not match.');
  if (v('#rx') <= v('#ri')) return error('Expiry must be after issue date.');
  if (users.some(u => u.e === v('#re').toLowerCase())) return error('That email is already registered.');

  const user = { n: v('#rn').trim(), co: v('#rco').trim(), e: v('#re').toLowerCase(), p: v('#rw'), l: v('#rl'), d: licenseFile.name };
  users.push(user);
  st.set('if_users', users);
  st.set('if_session', { n: user.n, e: user.e });
  location.href = next;
};


/* ---------- Login ---------- */
$('#lf').onsubmit = e => {
  e.preventDefault();
  const user = st.get('if_users', []).find(u => u.e === $('#le').value.toLowerCase() && u.p === $('#lw').value);
  if (!user) return $('#le2').textContent = 'Incorrect email or password, or no account yet. Create one first.';

  st.set('if_session', { n: user.n, e: user.e, k: $('#lk').checked ? 1 : 0 });
  try { sessionStorage.setItem('if_tab', '1') } catch (e) {}
  location.href = next;
};


/* ---------- Forgot password ---------- */
$('#ff').onsubmit = e => {
  e.preventDefault();
  const users = st.get('if_users', []);
  const user = users.find(u => u.e === $('#fe').value.toLowerCase());
  if (!user) return $('#fe2').textContent = 'No account found with that email.';
  if ($('#fw').value !== $('#fc').value) return $('#fe2').textContent = 'Passwords do not match.';

  user.p = $('#fw').value;
  st.set('if_users', users);
  $('#fe2').textContent = '';
  $('#le').value = user.e;
  $('#lw').value = '';
  $('#ff').reset();
  $('#le2').textContent = 'Password updated. Please sign in.';
  tab('login');
};


/* ---------- License document upload (click or drag & drop) ---------- */
const dropBox = $('#dz'), fileInput = $('#rd'), dropText = $('#dt');

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


/* ---------- Show / Hide password buttons ---------- */
document.querySelectorAll('.sh').forEach(btn => btn.onclick = () => {
  const input = $('#' + btn.dataset.t);
  const hidden = input.type === 'password';
  input.type = hidden ? 'text' : 'password';
  btn.textContent = hidden ? 'Hide' : 'Show';
});
