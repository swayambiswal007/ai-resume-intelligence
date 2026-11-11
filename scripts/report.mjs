// Scores the cleaned profiles and writes data/output/rankings.csv + summary.md.
// Usage: node scripts/report.mjs [--mode=jd|brief] [--quiet]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, rank } from '../lib/engine/score.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mode = (process.argv.find((a) => a.startsWith('--mode=')) || '--mode=jd').split('=')[1];
const quiet = process.argv.includes('--quiet');
const { profiles } = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/data/profiles.json'), 'utf8'));
const items = profiles.map((p) => ({ profile: p, result: evaluate(p, { lcaMode: mode }) }));

const lcaRank = new Map(rank(items, 'lca').map((x, i) => [x.profile.id, i + 1]));
const uiRank = new Map(rank(items, 'uiux').map((x, i) => [x.profile.id, i + 1]));
const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
const rows = [['id', 'headline', 'classification', 'lca_score', 'lca_rank', 'lca_fit', 'lca_must_haves', 'uiux_score', 'uiux_rank', 'uiux_fit', 'uiux_must_haves', 'total_exp_years', 'lca_relevant_years', 'design_relevant_years', 'issues', 'reviewer_corrections', 'source_file'].join(',')];
for (const { profile: p, result: r } of rank(items, 'lca')) {
  rows.push([
    p.id, q(p.headline), r.classification.label + (r.classification.weak ? ' (weak)' : ''),
    r.lca.score, lcaRank.get(p.id), r.lca.band.label, `${r.lca.mustHavesMet ?? 0}/4`,
    r.uiux.score, uiRank.get(p.id), r.uiux.band.label, `${r.uiux.mustHavesMet ?? 0}/4`,
    (p.totalMonths / 12).toFixed(1), (r.lca.relevantMonths / 12).toFixed(1), (r.uiux.relevantMonths / 12).toFixed(1),
    q(p.issues.filter((i) => i.level !== 'info').map((i) => i.message).join(' | ')), p.corrections.length, q(p.fileName)
  ].join(','));
}
fs.mkdirSync(path.join(ROOT, 'data/output'), { recursive: true });
fs.writeFileSync(path.join(ROOT, `data/output/rankings${mode === 'jd' ? '' : '_' + mode}.csv`), rows.join('\n') + '\n');

const counts = {};
for (const x of items) counts[x.result.classification.label] = (counts[x.result.classification.label] || 0) + 1;
const top = (role, n) => rank(items, role).slice(0, n).map((x, i) => `| ${i + 1} | ${x.profile.id} | ${x.profile.headline} | ${x.result[role].score} | ${x.result[role].band.label} | ${x.result[role].mustHavesMet}/4 |`).join('\n');
const md = `# Ranking summary (experience mode: ${mode})\n\nClassification: ${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(' · ')}\n\n## LCA Consultant — top 10\n\n| # | ID | Headline | Score | Fit | Must-haves |\n|---|---|---|---|---|---|\n${top('lca', 10)}\n\n## UI/UX Design Intern — top 10\n\n| # | ID | Headline | Score | Fit | Must-haves |\n|---|---|---|---|---|---|\n${top('uiux', 10)}\n`;
fs.writeFileSync(path.join(ROOT, `data/output/summary${mode === 'jd' ? '' : '_' + mode}.md`), md);

if (!quiet) {
  for (const { profile: p, result: r } of [...items].sort((a, b) => a.result.classification.key.localeCompare(b.result.classification.key) || b.result.lca.score - a.result.lca.score)) {
    console.log(`${p.id.padEnd(20)} ${r.classification.label.padEnd(9)}${r.classification.weak ? 'w' : ' '} LCA ${String(r.lca.score).padStart(5)} UX ${String(r.uiux.score).padStart(5)}  relL ${(r.lca.relevantMonths / 12).toFixed(1)} relD ${(r.uiux.relevantMonths / 12).toFixed(1)}  ${p.headline.slice(0, 40)}`);
  }
  console.log(counts);
}
