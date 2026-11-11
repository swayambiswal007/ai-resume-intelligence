// node scripts/explain.mjs <ID> [lca|uiux] [--mode=brief]
import fs from 'node:fs';
import { evaluate } from '../lib/engine/score.js';
const [id, role = 'lca'] = process.argv.slice(2);
const mode = process.argv.includes('--mode=brief') ? 'brief' : 'jd';
const { profiles } = JSON.parse(fs.readFileSync('public/data/profiles.json', 'utf8'));
const p = profiles.find((x) => x.id.startsWith(id));
const r = evaluate(p, { lcaMode: mode });
const s = r[role];
console.log(`${p.id} ${role} score=${s.score} raw=${s.rawScore} unmet=${s.unmet} ${s.band.label} | ${r.classification.label}: ${r.classification.reason}`);
if (s.gate) console.log('GATE', s.gate);
for (const c of s.criteria) {
  console.log(` - ${c.label} ${Math.round(c.score*100)}% → ${c.points}/${c.weight}  ${c.note}`);
  for (const e of c.evidence.slice(0, 4)) console.log(`      · ${e.label} [${e.where}] ${e.quote.slice(0, 90)}`);
}
console.log(' must:', s.mustHaves.map((m) => `${m.met ? '✓' : '✗'} ${m.label} (${m.detail})`).join(' | '));
console.log(' highlights:', s.highlights.join(', '));
