'use client';
import { RUBRICS, CLASSIFY, SECTION_WEIGHTS, REF_DATE_LABEL, FIT_BANDS } from '@/lib/engine';
import { MUSTHAVE_PENALTY, SECTION_LABELS } from '@/lib/engine/config';

export default function MethodView({ items }) {
  const base = items.filter((x) => !x.profile.uploaded);
  const corrected = base.filter((x) => x.profile.corrections?.length).length;
  const corrections = base.reduce((a, x) => a + (x.profile.corrections?.length || 0), 0);
  const notes = base.reduce((a, x) => a + x.profile.issues.filter((i) => i.code === 'REVIEW_NOTE').length, 0);
  const warned = base.filter((x) => x.profile.issues.some((i) => i.level === 'warning')).length;
  const errors = base.filter((x) => x.profile.issues.some((i) => i.level === 'error')).length;

  return (
    <div className="method">
      <section className="section full">
        <h3>How it works</h3>
        <div className="pipeline">
          <div className="step"><b>1 · Ingest</b><span>47 .docx resumes → text with mammoth. Uploads: .docx, .pdf (pdf.js) or .txt, read in the browser.</span></div>
          <div className="step"><b>2 · Extract</b><span>Rule-based parser finds sections, roles, dates, education, skills and projects, and flags anything it can't read.</span></div>
          <div className="step"><b>3 · Clean</b><span>Every record was checked against its source. Parser bugs were fixed in code; record-level fixes are logged in <code>overrides.json</code>.</span></div>
          <div className="step"><b>4 · Score</b><span>Weighted rubric per JD (100 pts) with quoted evidence, must-haves, domain gate.</span></div>
          <div className="step"><b>5 · Classify & rank</b><span>LCA / UI/UX / Both / Neither / Uncertain from the two scores, then a separate rank per role.</span></div>
        </div>
        <p style={{ marginTop: 12 }}>No AI model runs at scoring time. Every point comes from a rule you can read below, so identical input always gives an identical rank, and HR can trace each score to quoted resume lines. The engine (<code>lib/engine</code>) is shared by the offline build and the browser, so a new upload is ranked exactly like the original pile.</p>
      </section>

      {Object.values(RUBRICS).map((rb) => (
        <section className="section" key={rb.id}>
          <h3>{rb.title} rubric</h3>
          <table>
            <thead><tr><th>Criterion</th><th>Pts</th><th>Source in JD</th></tr></thead>
            <tbody>
              {rb.criteria.map((c) => <tr key={c.key}><td>{c.label}</td><td className="mono">{c.weight}</td><td className="muted">{c.jd}</td></tr>)}
            </tbody>
          </table>
          <p><b>Must-haves:</b> {rb.mustHaves.map((m) => m.label).join(' · ')}. Each unmet one multiplies the score by {1 - MUSTHAVE_PENALTY} (−{MUSTHAVE_PENALTY * 100}%).</p>
          {rb.experienceModes && <p><b>Experience bar:</b> JD1 says 2–3 yrs but the brief says 4–6 yrs. Both are available as a toggle (default: JD text). LCA roles count fully; sustainability-adjacent roles (ESG, GHG, EHS…) count at half weight; overlapping months are counted once.</p>}
          {rb.id === 'uiux' && <p><b>Experience fit:</b> 0–15 months of design work scores highest (JD: 0–1 yr). More experience still scores well but is flagged as possibly over-qualified for an internship. Graphic-design or front-end roles count at half weight.</p>}
        </section>
      ))}

      <section className="section">
        <h3>Evidence weighting</h3>
        <p>A keyword counts more when it describes work actually done than when it only appears in a skills list:</p>
        <table><tbody>{Object.entries(SECTION_WEIGHTS).map(([k, w]) => <tr key={k}><td>{SECTION_LABELS[k]}</td><td className="mono">×{w}</td></tr>)}</tbody></table>
        <p><b>Domain gate:</b> if a resume never describes hands-on work in the role's discipline (no LCA study, or no UI/UX work, in experience or projects), the score is halved. This stops generic words like "stakeholder" or "data" from lifting off-profile resumes.</p>
      </section>

      <section className="section">
        <h3>Classification rules</h3>
        <ul>
          <li><b>Both</b>: both scores ≥ {CLASSIFY.bothMin}.</li>
          <li><b>Neither</b>: both scores &lt; {CLASSIFY.neitherMax}.</li>
          <li><b>LCA / UI/UX</b>: the higher score leads by ≥ {CLASSIFY.minLead} pts and ≥ {CLASSIFY.relLead * 100}% of itself. Marked <i>weak</i> when it is below {CLASSIFY.matchMin}.</li>
          <li><b>Uncertain</b>: scores too close to call, or the file is unreadable.</li>
        </ul>
        <p><b>Fit bands:</b> {FIT_BANDS.map((b) => `${b.label} ≥ ${b.min}`).join(' · ')}. Ties rank by relevant experience.</p>
      </section>

      <section className="section">
        <h3>Data clean-up in this dataset</h3>
        <ul>
          <li>{errors} unreadable file (empty .docx), shown as <i>Uncertain</i> with an explanation, never silently dropped.</li>
          <li>{warned} resumes with date warnings ("null", "Not specified", duration-only, future end dates, year-only).</li>
          <li>{corrections} reviewer corrections on {corrected} resumes, plus {notes} reviewer notes, each visible in the candidate panel.</li>
          <li>Anonymisation artefacts detected and flagged: stripped ISO numbers ("ISO /s" ≈ ISO 14040/14044) and truncated phrases ("over 2.s").</li>
          <li>"Present" is resolved against a fixed snapshot date ({REF_DATE_LABEL}) so rankings are reproducible.</li>
        </ul>
      </section>

      <section className="section full">
        <h3>Known limitations</h3>
        <ul>
          <li>Keyword rules can miss unusual wording or synonyms. That is why every score shows its quotes, so a reviewer can overrule it.</li>
          <li>"LCA studies evidenced" counts LCA work items and projects described in the resume. It approximates "≥ 3 LCA projects" and is not a verified count.</li>
          <li>Scanned PDFs with no text layer can't be read in the browser. They are reported as unreadable instead of getting a score of zero.</li>
          <li>Uploads are kept only in your browser (localStorage). Other reviewers won't see them.</li>
          <li>Portfolio quality, aesthetic sense and user-psychology depth (the JD2 mandatory items) can only be estimated from wording. Shortlisted designers still need a portfolio review.</li>
        </ul>
      </section>
    </div>
  );
}
