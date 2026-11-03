/* =====================================================================
   landing.js – home page (index.html)
   Needs: common.js, GSAP and ScrollTrigger loaded first.
   ===================================================================== */

// "What is inside" steps: [title, text]
const STAGES = [
  ['Home', 'Your starting point. Search your business data, see what is connected, and open the AI assistant.'],
  ['Dashboard', 'Revenue, profit and your key numbers in one view, with charts you can hover and explore.'],
  ['Data', 'Upload your monthly and quarterly files. Each one is checked as it arrives.'],
  ['Unify', 'Files with different layouts are matched and merged into one annual dataset, then checked against a schema before it goes to PostgreSQL.'],
  ['Ask', 'Type a question in plain English and get an answer, along with the query that produced it.'],
  ['Profit and Loss', 'Revenue, costs and profit worked out for you, month by month.'],
  ['Forecast', 'See where your numbers are heading, and get a warning when the data starts to drift.'],
  ['Advisory agent', 'A 24/7 AI business consultant that gives real-time recommendations based on your live performance data.']
];

// Feature cards: [icon key, title, text]
const FEATURES = [
  ['Data', 'Data Ingestion', 'Drag and drop CSV, XLS or XLSX files. Every upload is validated with Great Expectations and stored in PostgreSQL.'],
  ['Unify', 'Annual Unification', 'Merge monthly and quarterly files into one annual dataset. Schema differences are detected and mapped.'],
  ['PL', 'P&L Engine', 'Revenue, COGS, gross and net profit, cached in Redis for instant re-queries.'],
  ['Ask', 'Conversational BI', 'Ask in plain English. Text-to-SQL answers in under a second, with the SQL shown.'],
  ['Advisory', 'Strategic Advisory', 'Detect anomalies and drift the moment new data lands, then get written advice on what to do next.'],
  ['Home', 'Enterprise Security', 'JWT and bcrypt authentication, role-based access control and a real-time audit log.']
];

$('.stages').insertAdjacentHTML('beforeend', STAGES.map(([title, text], i) =>
  `<li class="stage"><span class="n">${i + 1}</span><div><h3>${title}</h3><p>${text}</p></div></li>`).join(''));

$('#fg').innerHTML = FEATURES.map(([icon, title, text]) =>
  `<article class="fc rv"><div class="ico">${ic(icon)}</div><h3>${title}</h3><p>${text}</p></article>`).join('');

// Animations
gsap.registerPlugin(ScrollTrigger);
// Hero entrance + number count-up run after the loader has gone
const heroIn = () => {
  gsap.from('.hc > *', { opacity: 0, y: 26, scale: .97, duration: .7, stagger: .09, ease: 'back.out(1.4)' });
  gsap.from('.dp', { opacity: 0, y: 40, scale: .94, duration: .9, delay: .25, ease: 'back.out(1.3)' });
  gsap.from('.dp .mc', { opacity: 0, y: 18, scale: .94, duration: .55, stagger: .08, delay: .7, ease: 'back.out(1.5)' });
  document.querySelectorAll('.proof b').forEach(b => {
    const m = b.textContent.match(/^(.*?)([\d.]+)(.*)$/);
    if (!m) return;
    const end = parseFloat(m[2]), dec = (m[2].split('.')[1] || '').length, o = { v: 0 };
    gsap.to(o, { v: end, duration: 1.6, delay: .5, ease: 'power2.out', onUpdate: () => { b.textContent = m[1] + o.v.toFixed(dec) + m[3]; } });
  });
};
window.IF_LOADER ? IF_LOADER.ready(heroIn) : heroIn();

// Scroll progress line at the very top
document.body.insertAdjacentHTML('afterbegin', '<div class="sp" aria-hidden="true"></div>');
gsap.to('.sp', { scaleX: 1, ease: 'none', scrollTrigger: { start: 0, end: 'max', scrub: .2 } });

// "What is inside" 3D stack: one plate per tool, the active one lifts as you scroll the list
const PLATE_ICONS = ['Home', 'Dashboard', 'Data', 'Unify', 'Ask', 'PL', 'Forecast', 'Advisory'];
$('#stk3d').innerHTML = STAGES.map((s, i) =>
  `<span class="stk-p" style="--z:${(3.5 - i) * 34}px">${ic(PLATE_ICONS[i])}</span>`).join('');
const plates = [...document.querySelectorAll('.stk-p')];
const setPlate = i => {
  plates.forEach((p, k) => { p.classList.toggle('on', k === i); p.classList.toggle('done', k < i); });
  $('#stkName').textContent = STAGES[i][0];
  $('#stkNo').textContent = (i + 1) + ' of ' + STAGES.length;
};
setPlate(0);
document.querySelectorAll('.stage').forEach((el, i) =>
  ScrollTrigger.create({ trigger: el, start: 'top 60%', end: 'bottom 60%', onToggle: s => s.isActive && setPlate(i) }));

gsap.to('.stages .line', { scaleY: 1, ease: 'none', scrollTrigger: { trigger: '.stages', start: 'top 70%', end: 'bottom 70%', scrub: true } });
gsap.utils.toArray('.stage,.fc,.rv,.what .side').forEach(el =>
  gsap.from(el, { opacity: 0, y: 30, scale: .96, duration: .6, ease: 'back.out(1.3)', scrollTrigger: { trigger: el, start: 'top 88%', once: true } }));

// Contact form -------------------------------------------------------
// To receive messages by email / on your server, put your API URL here.
// Leave it empty and messages are only saved in this browser (demo mode).
const CONTACT_ENDPOINT = '';

const cf = $('#contactForm');
const cfShow = (id, msg) => {
  const input = $(id), err = $(id + 'Err');
  err.textContent = msg;
  input.setAttribute('aria-invalid', msg ? 'true' : 'false');
  return !msg;
};

cf.addEventListener('submit', async e => {
  e.preventDefault();
  const name = $('#cfName').value.trim();
  const email = $('#cfEmail').value.trim();
  const message = $('#cfMsg').value.trim();
  const status = $('#cfStatus');
  status.className = 'ct-status';

  const ok = [
    cfShow('#cfName', name.length < 2 ? 'Please enter your name.' : ''),
    cfShow('#cfEmail', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Please enter a valid email.'),
    cfShow('#cfMsg', message.length < 10 ? 'Please write at least 10 characters.' : '')
  ].every(Boolean);
  if (!ok) { status.textContent = ''; cf.querySelector('[aria-invalid=true]').focus(); return; }

  const btn = cf.querySelector('button[type=submit]');
  btn.disabled = true; btn.textContent = 'Sending...';
  try {
    const entry = { name, email, message, at: new Date().toISOString() };
    if (CONTACT_ENDPOINT) {
      const r = await fetch(CONTACT_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(entry) });
      if (!r.ok) throw new Error('bad response');
    } else {
      st.set('if_contacts', [...st.get('if_contacts', []), entry]);
    }
    cf.reset();
    status.classList.add('ok');
    status.textContent = 'Thank you! Your message has been sent. We will reply soon.';
  } catch (err) {
    status.classList.add('bad');
    status.textContent = 'Sorry, something went wrong. Please try again.';
  }
  btn.disabled = false; btn.textContent = 'Send message';
});
['#cfName', '#cfEmail', '#cfMsg'].forEach(id => $(id).addEventListener('input', () => cfShow(id, '')));
