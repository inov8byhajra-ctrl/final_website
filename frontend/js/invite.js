/* =====================================================================
   invite.js – "Invite regional manager" page (invite.html)
   Needs: common.js loaded first.
   ===================================================================== */

if (!st.get('if_session', null)) location.replace('login.html?next=invite.html');

$('#inf').onsubmit = e => {
  e.preventDefault();
  const v = id => $(id).value.trim();
  const invites = st.get('if_invites', []);

  if (invites.some(x => x.e === v('#me').toLowerCase())) return $('#ie').textContent = 'That email has already been invited.';

  invites.push({ n: v('#mn'), e: v('#me').toLowerCase(), r: v('#mr'), t: Date.now() });
  st.set('if_invites', invites);
  location.href = 'home.html?invited=1';
};
