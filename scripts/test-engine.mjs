// Sanity tests for the engine: date formats + non-template resumes (simulating uploads).
import assert from 'node:assert/strict';
import { parseDateRange } from '../lib/engine/dates.js';
import { parseResume } from '../lib/engine/parse.js';
import { evaluate } from '../lib/engine/score.js';

const cases = [
  ['July 2025 – Present', 17], ['11/2025 – 01/2026', 3], ["Sep '25 – Dec '25", 4], ['Jan 26 - April 26', 4],
  ['Jan – April 2026', 4], ['2016 - 2019', 37], ['8 Months', 8], ['null', 0], ['Jun 2025 - Dec 2026', 18]
];
for (const [s, m] of cases) assert.equal(parseDateRange(s).months, m, s);

const lcaText = `PRIYA SHARMA
LCA Specialist | Pune
PROFESSIONAL EXPERIENCE
Senior LCA Consultant, EcoMetrics Pvt Ltd, Jan 2021 - Present
- Led 12 cradle-to-grave life cycle assessments for automotive and construction clients using GaBi and SimaPro.
- Built LCI datasets from plant-level energy, BOM and logistics data; documented assumptions per ISO 14040/14044.
- Authored 5 EPDs and benchmarked results against published industry studies.
EDUCATION
M.Tech Environmental Engineering, IIT Bombay, 2018 - 2020
SKILLS
GaBi, SimaPro, ecoinvent, Excel`;
const r1 = evaluate(parseResume(lcaText, { id: 'test-lca' }));
assert.equal(r1.classification.key, 'lca');
assert.ok(r1.lca.score > 75, `LCA score ${r1.lca.score}`);

const uxText = `Rahul Verma — Product Designer
Summary: Fresh graduate passionate about user psychology.
Work Experience
UX Intern at Hiresphere (job board startup)   Jun 2025 – Nov 2025
• Conducted user interviews and usability tests; built personas and journey maps.
• Designed high-fidelity Figma prototypes for the job search and filters experience.
Projects
Careers website redesign
Redesigned a responsive careers website with a new design system, typography and visual hierarchy.
Education
B.Des Interaction Design, NID, 2021 - 2025`;
const r2 = evaluate(parseResume(uxText, { id: 'test-ux' }));
assert.equal(r2.classification.key, 'uiux');
assert.ok(r2.uiux.score > 70, `UX score ${r2.uiux.score}`);

const empty = evaluate(parseResume('   ', { id: 'empty' }));
assert.equal(empty.classification.key, 'uncertain');

console.log('engine tests passed', { lca: r1.lca.score, ux: r2.uiux.score });
