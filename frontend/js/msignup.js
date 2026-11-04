const q = new URLSearchParams(location.search); if (q.get('email')) $('#me').value = q.get('email');
$('#mf').onsubmit = async e => {
  e.preventDefault(); const err = $('#er'); err.textContent = '';
  if ($('#m1').value !== $('#m2').value) return err.textContent = 'Passwords do not match.';
  const b = e.target.querySelector('button'); b.disabled = true;
  try {
    const d = await IF.api('/manager/signup', { method: 'POST', json: { email: $('#me').value.trim(),phone: $('#rph').value.trim(), otp_code: $('#mo').value.trim(), password: $('#m1').value } });
    IF.saveLogin(d, true); location.href = IF.homeFor(d.role);
  } catch (x) { err.textContent = x.message; b.disabled = false }
};