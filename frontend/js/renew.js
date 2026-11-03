$('#nf').onsubmit = async e => {
  e.preventDefault(); const err = $('#er'); err.textContent = '';
  const v = id => $(id).value, f = $('#nd').files[0];
  if (v('#nx') <= v('#ni')) return err.textContent = 'Expiry must be after issue date.';
  const fd = new FormData();
  fd.append('email', v('#ne').trim()); fd.append('password', v('#np')); fd.append('license_number', v('#nl').trim());
  fd.append('license_issue_date', v('#ni')); fd.append('license_expiry_date', v('#nx')); fd.append('license_file', f);
  const b = e.target.querySelector('button'); b.disabled = true;
  try { const r = await IF.api('/cfo/renew', { method: 'POST', formData: fd }); e.target.reset(); IF.toast(r.message); setTimeout(() => location.href = 'login.html', 2500) }
  catch (x) { err.textContent = x.message } finally { b.disabled = false }
};