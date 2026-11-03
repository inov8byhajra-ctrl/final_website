/* invite.js – CFO invites a regional manager (real backend). invite.html must load: common.js, api.js, invite.js */
(function () {
  const s = IF.getSession();
  if (!s || !s.token || IF.tokenExpired(s.token)) return IF.logout(true);
  if (s.role !== 'cfo') location.replace('home.html');
})();
$('#inf').onsubmit = async e => {
  e.preventDefault(); const err = $('#ie'); err.textContent = '';
  const v = id => $(id).value.trim(), b = e.target.querySelector('button'); b.disabled = true;
  try {
    const r = await IF.api('/cfo/invite-manager', { method: 'POST', auth: true, json: { name: v('#mn'), email: v('#me'), region: v('#mr') } });
    IF.toast(r.message + (r.dev_otp ? ' (dev OTP: ' + r.dev_otp + ')' : ''));
    e.target.reset();
    setTimeout(() => location.href = 'home.html?invited=1', r.dev_otp ? 6000 : 1800);
  } catch (x) { err.textContent = x.message } finally { b.disabled = false }
};