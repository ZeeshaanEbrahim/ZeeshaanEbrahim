// Run: node --test scripts
import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { streaks, lift, fmtNum, render } from './build-cards.mjs';

// Fake 53-week calendar so every card can be rendered without a token.
const levels = ['NONE', 'FIRST_QUARTILE', 'SECOND_QUARTILE', 'THIRD_QUARTILE', 'FOURTH_QUARTILE'];
const weeks = Array.from({ length: 53 }, (_, w) => ({
  contributionDays: Array.from({ length: 7 }, (_, d) => ({ contributionLevel: levels[(w * 7 + d) % 5] })),
}));
const sample = {
  stars: 12, followers: 3, repos: 5, total: 1234, since: '2023-09-18',
  lastYear: { totalContributions: 96, weeks },
  langs: [{ name: 'C', color: '#555555', pct: 0.7 }, { name: 'Python', color: '#3572A5', pct: 0.2 }, { name: 'Assembly', color: null, pct: 0.01 }],
  current: { len: 4, start: '2024-01-01', end: '2024-01-04' }, best: { len: 9, start: '2023-10-01', end: '2023-10-09' },
};

test('cards render from API-shaped data (incl. null language colour)', () => {
  const out = render(sample);
  assert.deepEqual(Object.keys(out), ['stats.svg', 'stack.svg', 'highlights.svg', 'heatmap.svg', 'streak.svg']);
  assert.match(out['stats.svg'], />12</);
  assert.match(out['highlights.svg'], /5 public repositories/);
  assert.equal((out['heatmap.svg'].match(/class="cell"/g) ?? []).length, 53 * 7);
  assert.match(out['streak.svg'], />9</);
  if (process.env.CARDS_OUT) for (const [f, svg] of Object.entries(out)) writeFileSync(join(process.env.CARDS_OUT, f), svg);
});

const days = (counts) => counts.map((count, i) => ({ date: `2024-01-${String(i + 1).padStart(2, '0')}`, count }));

test('current + longest streak', () => {
  const r = streaks(days([1, 1, 0, 1, 1, 1]));
  assert.equal(r.best.len, 3);
  assert.equal(r.current.len, 3);
  assert.equal(r.current.start, '2024-01-04');
});

test('a zero today does not break yesterday\'s streak', () => {
  assert.equal(streaks(days([1, 1, 1, 0])).current.len, 3);
});

test('two empty days end the current streak', () => {
  const r = streaks(days([1, 1, 0, 0]));
  assert.equal(r.current.len, 0);
  assert.equal(r.best.len, 2);
});

test('empty history', () => assert.deepEqual(streaks([]), { best: { len: 0 }, current: { len: 0 } }));

test('lift only brightens dark colours; fmtNum abbreviates >=10k', () => {
  assert.notEqual(lift('#555555'), '#555555');
  assert.equal(lift('#f34b7d'), '#f34b7d');
  assert.equal(fmtNum(67123), '67K');
  assert.equal(fmtNum(3991), '3,991');
});
