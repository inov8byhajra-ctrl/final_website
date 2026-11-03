const token = new URLSearchParams(location.search).get('token') || '';
const who = $('#who'), form = $('#rf'), err = $('#er');
(async () => {
  try {
    const r = await IF.api('/api/users/verify-reset-token?token=' + encodeURIComponent(token));
    who.textContent = 'Resetting password for ' + r.email; form.hidden = false;
  } catch (e) { who.textContent = e.message; who.style.color = '#ba1a1a' }
})();
form.onsubmit = async e => {
  e.preventDefault(); err.textContent = '';
  if ($('#p1').value !== $('#p2').value) return err.textContent = 'Passwords do not match.';
  const b = form.querySelector('button'); b.disabled = true;
  try {
    const r = await IF.api('/api/users/reset-password', { method: 'POST', json: { token, new_password: $('#p1').value } });
    IF.toast(r.message); setTimeout(() => location.href = 'login.html', 1500);
  } catch (x) { err.textContent = x.message; b.disabled = false }
};