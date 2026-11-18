// Builds the profile-card SVGs in ./assets from live GitHub data. Zero dependencies, Node 20+.
// Usage (repo root): GITHUB_TOKEN=... node scripts/build-cards.mjs [login]
import { mkdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// ---------- pure helpers (unit-tested) ----------

// days: [{date:'YYYY-MM-DD', count}] ascending, last = today. A streak survives a zero *today*.
export function streaks(days) {
  const none = { len: 0 };
  let run = none, best = none;
  const at = [];
  for (const d of days) {
    run = d.count ? { len: run.len + 1, start: run.len ? run.start : d.date, end: d.date } : none;
    if (run.len > best.len) best = run;
    at.push(run);
  }
  const last = days.length - 1;
  return { best, current: (days[last]?.count ? at[last] : at[last - 1]) ?? none };
}

const THIS_YEAR = new Date().getUTCFullYear();
const fmtDate = (iso) =>
  new Date(iso + 'T00:00:00Z').toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', timeZone: 'UTC',
    ...(+iso.slice(0, 4) !== THIS_YEAR && { year: 'numeric' }),
  });
export const fmtRange = (s, e) => (s === e ? fmtDate(s) : `${fmtDate(s)} - ${fmtDate(e)}`);
export const fmtNum = (n) => (n >= 10000 ? `${Math.round(n / 1000)}K` : n.toLocaleString('en-US'));
const plural = (n, w) => `${fmtNum(n)} ${w}${n === 1 ? '' : 's'}`;

// Dark language colours (e.g. C's grey) vanish on the dark card, so lift them.
export function lift(hex) {
  hex ||= '#8b949e'; // GitHub returns colour: null for languages without one
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  if (0.299 * r + 0.587 * g + 0.114 * b >= 90) return hex;
  return '#' + [r, g, b].map((c) => Math.round(c + (255 - c) * 0.4).toString(16).padStart(2, '0')).join('');
}

// ---------- SVG building blocks ----------

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const text = (x, y, size, weight, fill, s, extra = '') =>
  `<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(s)}</text>`;

const STYLE = `
.orb-a{animation:fa 9s ease-in-out infinite}.orb-b{animation:fb 11s ease-in-out infinite 1.1s}.orb-c{animation:fc 13s ease-in-out infinite .6s}
.ring{animation:ring 8s ease-in-out infinite}.ring-b{animation:ring 10s ease-in-out infinite 1.6s}
.chip{animation:chip .65s ease-out both}.cursor{animation:cur 1.1s step-end infinite}
.bar{animation:bar 1.15s ease-out both;transform-box:fill-box;transform-origin:left}
.cell{opacity:0;transform-box:fill-box;transform-origin:center;animation:pop .5s cubic-bezier(.2,.8,.2,1) both}
@keyframes fa{0%,100%{transform:translate(0,0);opacity:.58}50%{transform:translate(28px,-20px);opacity:.86}}
@keyframes fb{0%,100%{transform:translate(0,0);opacity:.42}50%{transform:translate(-24px,18px);opacity:.72}}
@keyframes fc{0%,100%{transform:translate(0,0) scale(1);opacity:.34}50%{transform:translate(18px,-12px) scale(1.18);opacity:.62}}
@keyframes ring{0%,100%{opacity:.06}50%{opacity:.22}}
@keyframes chip{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
@keyframes cur{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes pop{0%{opacity:0;transform:scale(.15)}55%{opacity:1;transform:scale(1.12)}100%{opacity:1;transform:scale(1)}}`;

// [cx, cy as fraction of H, rx, ry as fraction of H, colour, opacity, animation class]
const ORBS = [
  [138, 0.18, 206, 0.46, '#58a6ff', 0.72, 'a'],
  [654, 0.22, 241, 0.42, '#39d353', 0.5, 'b'],
  [499, 0.88, 310, 0.34, '#a371f7', 0.72, 'c'],
  [826, 0.78, 172, 0.42, '#22d3ee', 0.5, 'b'],
];

// panelH omitted -> no inner glass panel (highlights card)
function frame(label, H, body, panelH) {
  const grads = ORBS.map(([, , , , c, o], i) =>
    `<radialGradient id="o${i}"><stop offset="0" stop-color="${c}" stop-opacity="${o}"/><stop offset=".58" stop-color="${c}" stop-opacity=".18"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`).join('');
  const orbs = ORBS.map(([cx, fy, rx, fry, , , k], i) =>
    `<ellipse class="orb-${k}" cx="${cx}" cy="${Math.round(H * fy)}" rx="${rx}" ry="${Math.round(H * fry)}" fill="url(#o${i})"/>`).join('');
  const panel = panelH ? `<rect x="28" y="26" width="804" height="${panelH}" rx="20" fill="rgba(8,8,12,.5)" stroke="#58a6ff" stroke-opacity=".48"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="860" height="${H}" viewBox="0 0 860 ${H}" role="img" aria-label="${esc(label)}">
<defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d1117"/><stop offset=".54" stop-color="#161b22"/><stop offset="1" stop-color="#0d1117"/></linearGradient>${grads}</defs>
<style>${STYLE}</style>
<rect width="860" height="${H}" rx="20" fill="url(#bg)"/>${orbs}${panel}
${body}
<rect x=".5" y=".5" width="859" height="${H - 1}" rx="19.5" fill="none" stroke="#58a6ff" stroke-opacity=".62"/>
</svg>
`;
}

const TITLE = '#e6edf3', MUTED = '#8b949e';
const heading = (title, sub, size = 27, ls = 1.1) =>
  text(46, 61, size, 850, TITLE, title, 'letter-spacing="-0.4"') + text(48, 84, 13, 650, MUTED, sub, `letter-spacing="${ls}"`);

// ---------- cards ----------

function statsCard({ stars, contributions, repos, followers }) {
  const goal = [100, 1000, 50, 100]; // bar is full at these values; shortcut: fixed goals, tune to taste
  const items = [
    ['Stars', stars, '#58a6ff'], ['Contributions', contributions, '#2ad5ef'],
    ['Repos', repos, '#a371f7'], ['Followers', followers, '#43d55c'],
  ];
  const chips = items.map(([label, v, c], i) => {
    const x = 34 + 204 * i, w = Math.max(11, Math.round(136 * Math.min(1, v / goal[i])));
    return `<g class="chip" style="animation-delay:${i * 100}ms">
<rect x="${x}" y="92" width="180" height="122" rx="18" fill="rgba(8,8,12,.5)" stroke="#58a6ff" stroke-opacity=".72"/>
${text(x + 22, 126, 12, 800, MUTED, label, 'letter-spacing="1.4"')}${text(x + 22, 166, 35, 900, c, fmtNum(v), 'letter-spacing="-0.8"')}
<rect x="${x + 22}" y="186" width="136" height="7" rx="3.5" fill="rgba(255,255,255,.1)"/><rect class="bar" x="${x + 22}" y="186" width="${w}" height="7" rx="3.5" fill="${c}" opacity=".9"/></g>`;
  }).join('');
  const deco = `<circle class="ring" cx="735" cy="82" r="20.88" fill="none" stroke="${TITLE}" stroke-opacity=".36"/><circle class="ring-b" cx="735" cy="82" r="35.96" fill="none" stroke="${TITLE}" stroke-opacity=".22"/><circle class="ring" cx="735" cy="82" r="58" fill="none" stroke="${TITLE}" stroke-opacity=".14"/>
<circle cx="758" cy="63" r="4" fill="#58a6ff"><animate attributeName="r" values="3.4;4.8;3.4" dur="1.6s" repeatCount="indefinite"/></circle>`;
  return frame('GitHub profile signal', 260, deco + heading('Profile Signal', 'Live GitHub stats, rebuilt every few hours', 28, 1.2) + chips, 206);
}

function stackCard(langs) { // langs: [{name,color,pct}] top 5, pct 0..1
  const rows = langs.map((l, i) => {
    const y = 98 + 32 * i, c = lift(l.color), w = Math.max(19, Math.round(466 * l.pct));
    return `<g class="chip" style="animation-delay:${i * 95}ms"><circle cx="54" cy="${y + 9}" r="5" fill="${c}"/>${text(72, y + 14, 14, 800, TITLE, l.name)}
${text(306, y + 14, 13, 850, c, Math.round(l.pct * 100) + '%', 'text-anchor="end"')}
<rect x="330" y="${y}" width="466" height="9" rx="4.5" fill="rgba(255,255,255,.12)"/><rect class="bar" x="330" y="${y}" width="${w}" height="9" rx="4.5" fill="${c}" opacity=".95"/></g>`;
  }).join('');
  const H = 120 + 32 * langs.length;
  return frame('Language stack', H,
    heading('Language Stack', 'Repository-weighted technologies') +
    text(685, 62, 14, 750, '#58a6ff', '> stack.scan') + text(786, 62, 14, 850, '#58a6ff', '_', 'class="cursor"') + rows, H - 54);
}

function highlightsCard({ repos, stars, followers }) {
  const items = [['Open Source', `${fmtNum(repos)} public ${repos === 1 ? 'repository' : 'repositories'}`, '#58a6ff'],
    ['Impact', `${plural(stars, 'star')} earned`, '#43d55c'], ['Community', plural(followers, 'follower'), '#a371f7']];
  const chips = items.map(([title, sub, c], i) => {
    const x = 28 + 273 * i;
    return `<g class="chip" style="animation-delay:${i * 90}ms"><rect x="${x}" y="60" width="257" height="96" rx="16" fill="rgba(8,8,12,.5)" stroke="#58a6ff" stroke-opacity=".7"/>
<rect x="${x}" y="82" width="4" height="52" rx="2" fill="${c}"/>${text(x + 24, 98, 16, 850, TITLE, title)}${text(x + 24, 122, 12.5, 400, MUTED, sub)}</g>`;
  }).join('');
  return frame('Highlights', 180, text(30, 44, 11, 800, MUTED, 'HIGHLIGHTS', 'letter-spacing="4"') + chips);
}

function heatmapCard(weeks, total) { // weeks: GitHub contributionCalendar.weeks
  const LV = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  const OP = [0.07, 0.34, 0.55, 0.78, 1], col = (l) => (l ? '#58a6ff' : TITLE);
  const legend = OP.map((o, k) => `<rect x="${656 + 15 * k}" y="63" width="11" height="11" rx="2.5" fill="${col(k)}" fill-opacity="${o}"/>`).join('');
  let i = 0;
  const cells = weeks.map((w, wi) => w.contributionDays.map((d, di) => {
    const l = LV[d.contributionLevel] ?? 0;
    return `<rect class="cell" x="${46 + 14 * wi}" y="${100 + 14 * di}" width="11" height="11" rx="2.5" fill="${col(l)}" fill-opacity="${OP[l]}" style="animation-delay:${(0.2 + 0.01 * i++).toFixed(2)}s"/>`;
  }).join('')).join('');
  const sweep = `<rect x="46" y="98" width="2.5" height="99" fill="#58a6ff" opacity="0"><animate attributeName="x" from="46" to="785" begin=".2s" dur="2.2s" fill="freeze"/><set attributeName="opacity" to=".55" begin=".2s"/><set attributeName="opacity" to="0" begin="2.4s" fill="freeze"/></rect>`;
  return frame('Contribution activity', 230,
    text(46, 60, 24, 850, TITLE, 'Contribution Activity', 'letter-spacing="-0.4"') + text(48, 84, 13, 650, MUTED, `${fmtNum(total)} contributions in the last year`, 'letter-spacing="0.6"') +
    text(648, 72, 11, 400, MUTED, 'Less', 'text-anchor="end"') + legend + text(737, 72, 11, 400, MUTED, 'More') + cells + sweep, 178);
}

function streakCard({ total, since, current, best }) {
  const fade = (d) => `text-anchor="middle" style="opacity:0;animation:fade .5s linear forwards ${d}s"`;
  // One column: big number, label, date range. Streak labels differ in y/weight from the total column.
  const col = (cx, big, bigFill, label, labelFill, labelW, ly, range, d) =>
    text(cx, 80, 28, 700, bigFill, big, fade(d)) + text(cx, ly, 14, labelW, labelFill, label, fade(d + 0.1)) + text(cx, ly + 27, 12, 400, '#7FDBCA', range, fade(d + 0.2));
  const range = (s) => (s.len ? fmtRange(s.start, s.end) : '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 495 195" width="495" height="195" role="img" aria-label="GitHub streak">
<style>@keyframes fade{to{opacity:1}}</style>
<defs><clipPath id="r"><rect width="495" height="195" rx="4.5"/></clipPath><mask id="m"><rect width="495" height="195" fill="#fff"/><ellipse cx="247.5" cy="32" rx="13" ry="18"/></mask></defs>
<g clip-path="url(#r)"><rect width="495" height="195" fill="#011627"/>
<line x1="165" y1="28" x2="165" y2="170" stroke="#E4E2E2"/><line x1="330" y1="28" x2="330" y2="170" stroke="#E4E2E2"/>
${col(82.5, fmtNum(total), '#C792EA', 'Total Contributions', '#C792EA', 400, 116, `${fmtDate(since)} - Present`, 0.6)}
<g mask="url(#m)"><circle cx="247.5" cy="71" r="40" fill="none" stroke="#C792EA" stroke-width="5" style="opacity:0;animation:fade .5s linear forwards .4s"/></g>
<path transform="translate(247.5,19.5)" style="opacity:0;animation:fade .5s linear forwards .6s" fill="#C792EA" d="M 1.5 0.67 C 1.5 0.67 2.24 3.32 2.24 5.47 C 2.24 7.53 0.89 9.2 -1.17 9.2 C -3.23 9.2 -4.79 7.53 -4.79 5.47 L -4.76 5.11 C -6.78 7.51 -8 10.62 -8 13.99 C -8 18.41 -4.42 22 0 22 C 4.42 22 8 18.41 8 13.99 C 8 8.6 5.41 3.79 1.5 0.67 Z M -0.29 19 C -2.07 19 -3.51 17.6 -3.51 15.86 C -3.51 14.24 -2.46 13.1 -0.7 12.74 C 1.07 12.38 2.9 11.53 3.92 10.16 C 4.31 11.45 4.51 12.81 4.51 14.2 C 4.51 16.85 2.36 19 -0.29 19 Z"/>
${col(247.5, String(current.len), '#FFEB95', 'Current Streak', '#FFEB95', 700, 140, range(current), 0.6)}
${col(412.5, String(best.len), '#C792EA', 'Longest Streak', '#C792EA', 400, 116, range(best), 0.8)}
</g></svg>
`;
}

// ---------- GitHub data ----------

const gql = async (token, query, variables) => {
  const r = await fetch('https://api.github.com/graphql', {
    method: 'POST', headers: { Authorization: `bearer ${token}`, 'User-Agent': 'profile-cards' }, body: JSON.stringify({ query, variables }),
  });
  const j = await r.json();
  if (!r.ok || j.errors) throw new Error(`GitHub API: ${JSON.stringify(j.errors ?? j.message ?? r.status)}`);
  return j.data;
};

const CAL = 'contributionCalendar{totalContributions weeks{contributionDays{date contributionCount contributionLevel}}}';
const PROFILE = `query($l:String!){user(login:$l){createdAt followers{totalCount}
 repositories(ownerAffiliations:OWNER,isFork:false,privacy:PUBLIC,first:100){totalCount nodes{stargazerCount languages(first:10,orderBy:{field:SIZE,direction:DESC}){edges{size node{name color}}}}}
 contributionsCollection{${CAL}}}}`; // shortcut: first 100 repos only, paginate if you ever exceed that
const YEAR = `query($l:String!,$f:DateTime!,$t:DateTime!){user(login:$l){contributionsCollection(from:$f,to:$t){${CAL}}}}`;

async function main() {
  const login = process.argv[2] || process.env.GITHUB_REPOSITORY_OWNER;
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (!login || !token) throw new Error('Need a login (arg or GITHUB_REPOSITORY_OWNER) and GITHUB_TOKEN');

  const { user } = await gql(token, PROFILE, { l: login });
  const repos = user.repositories.nodes;
  const stars = repos.reduce((n, r) => n + r.stargazerCount, 0);
  const followers = user.followers.totalCount;
  const lastYear = user.contributionsCollection.contributionCalendar;

  const byLang = new Map();
  for (const r of repos) for (const e of r.languages.edges) {
    const cur = byLang.get(e.node.name) ?? { name: e.node.name, color: e.node.color, size: 0 };
    cur.size += e.size; byLang.set(e.node.name, cur);
  }
  const all = [...byLang.values()].sort((a, b) => b.size - a.size);
  const sum = all.reduce((n, l) => n + l.size, 0) || 1;
  const langs = all.slice(0, 5).map((l) => ({ ...l, pct: l.size / sum }));

  // The API caps a contributions window at one year, so walk year by year since signup for the streaks.
  const now = new Date(), start = +user.createdAt.slice(0, 4);
  const years = await Promise.all(Array.from({ length: now.getUTCFullYear() - start + 1 }, (_, k) => {
    const y = start + k;
    return gql(token, YEAR, { l: login, f: `${y}-01-01T00:00:00Z`, t: y === now.getUTCFullYear() ? now.toISOString() : `${y}-12-31T23:59:59Z` });
  }));
  const today = now.toISOString().slice(0, 10);
  const days = years.flatMap((d) => d.user.contributionsCollection.contributionCalendar.weeks.flatMap((w) => w.contributionDays))
    .filter((d) => d.date <= today).sort((a, b) => (a.date < b.date ? -1 : 1))
    .map((d) => ({ date: d.date, count: d.contributionCount }));
  const total = days.reduce((n, d) => n + d.count, 0);
  const { current, best } = streaks(days);

  const out = render({ stars, followers, repos: user.repositories.totalCount, lastYear, langs, total, since: user.createdAt.slice(0, 10), current, best });
  mkdirSync('assets', { recursive: true });
  for (const [f, svg] of Object.entries(out)) writeFileSync(`assets/${f}`, svg);
  console.log(`wrote ${Object.keys(out).join(', ')} for ${login}`);
}

export const render = (d) => ({
  'stats.svg': statsCard({ stars: d.stars, contributions: d.lastYear.totalContributions, repos: d.repos, followers: d.followers }),
  'stack.svg': stackCard(d.langs),
  'highlights.svg': highlightsCard({ repos: d.repos, stars: d.stars, followers: d.followers }),
  'heatmap.svg': heatmapCard(d.lastYear.weeks, d.lastYear.totalContributions),
  'streak.svg': streakCard({ total: d.total, since: d.since, current: d.current, best: d.best }),
});

if (import.meta.url === pathToFileURL(process.argv[1]).href) main().catch((e) => { console.error(e.message); process.exit(1); });
