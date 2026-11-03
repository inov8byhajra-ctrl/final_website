/* =====================================================================
   about.js – About us page (about.html)
   >>> EDIT THE TEXT BELOW to show your own information <<<
   Needs: common.js, GSAP and ScrollTrigger loaded first.
   ===================================================================== */

// Mission / vision / values cards: [icon key, title, text]
const VALUES = [
  ['Dashboard', 'Our mission', 'Make business intelligence simple, fast and affordable for every team, not only for data experts.'],
  ['Forecast', 'Our vision', 'A world where every decision is backed by clear, trustworthy and up-to-date data.'],
  ['Security', 'Our values', 'Honest numbers, privacy by design, and software that is easy to use from the very first minute.']
];

// Numbers: [big number, label]
const STATS = [
  ['98.7%', 'Validation pass rate'],
  ['< 900ms', 'Average query response'],
  ['3.2x', 'Faster data review'],
  ['8', 'Tools in one platform']
];

// Our story (two paragraphs)
const STORY = [
  'InsightFlow started with a simple problem: teams were spending more time cleaning spreadsheets than learning from them. Monthly files, quarterly files and different layouts made even basic reporting slow.',
  'So we built one place where you upload your files, everything is checked and merged for you, and you can simply ask questions in plain English. Today InsightFlow gives you dashboards, P&L, forecasts and proactive advice from your own data.'
];

// Team: [name, role, short bio]   (add or remove rows as you like)
const TEAM = [
  ['Your Name', 'Founder & CEO', 'Write one or two lines about this person here.'],
  ['Team Member', 'Head of Engineering', 'Write one or two lines about this person here.'],
  ['Team Member', 'Data & AI Lead', 'Write one or two lines about this person here.'],
  ['Team Member', 'Product Designer', 'Write one or two lines about this person here.']
];

// Contact details: [label, text, optional link]
const INFO = [
  ['Email', 'hello@yourcompany.com', 'mailto:hello@yourcompany.com'],
  ['Phone', '+92 300 0000000', 'tel:+923000000000'],
  ['Address', 'Your office address, City, Country', ''],
  ['Hours', 'Monday – Friday, 9:00 – 18:00', '']
];

// ---------- build the page ----------
$('#abValues').innerHTML = VALUES.map(([icon, title, text]) =>
  `<article class="fc rv"><div class="ico">${ic(icon)}</div><h3>${esc(title)}</h3><p>${esc(text)}</p></article>`).join('');

$('#abStats').innerHTML = STATS.map(([n, l]) => `<div><b>${esc(n)}</b><small>${esc(l)}</small></div>`).join('');

$('#abStory1').textContent = STORY[0];
$('#abStory2').textContent = STORY[1];

const initials = n => n.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
$('#abTeam').innerHTML = TEAM.map(([name, role, bio]) =>
  `<article class="ab-card rv"><div class="ab-av" aria-hidden="true">${esc(initials(name))}</div><h3>${esc(name)}</h3><span>${esc(role)}</span><p>${esc(bio)}</p></article>`).join('');

$('#abInfo').innerHTML = INFO.map(([label, text, href]) =>
  `<li><small>${esc(label)}</small>${href ? `<a href="${esc(href)}">${esc(text)}</a>` : `<span>${esc(text)}</span>`}</li>`).join('');

// ---------- animations ----------
gsap.registerPlugin(ScrollTrigger);
gsap.from('.ab-hero .wrap > *', { opacity: 0, y: 26, duration: .7, stagger: .1, ease: 'back.out(1.4)' });
gsap.utils.toArray('.rv').forEach(el =>
  gsap.from(el, { opacity: 0, y: 30, scale: .96, duration: .6, ease: 'back.out(1.3)', scrollTrigger: { trigger: el, start: 'top 90%', once: true } }));
