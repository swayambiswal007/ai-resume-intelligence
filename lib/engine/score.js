// Scoring, classification and ranking. Pure functions over a parsed profile.
import { SECTION_WEIGHTS, SECTION_LABELS, CLASSIFY, FIT_BANDS, MUSTHAVE_PENALTY } from './config.js';
import { segmentsOf } from './parse.js';
import { weightedMonths } from './dates.js';
import { snippet } from './text.js';
import { RUBRICS, LCA_CORE, DESIGN_CORE } from './rubrics.js';

const WORKISH = new Set(['work', 'project']);
const round1 = (x) => Math.round(x * 10) / 10;
const pct = (x) => Math.round(x * 100);

function match(re, text) {
  const m = re.exec(text);
  return m ? { index: m.index, text: m[0] } : null;
}

// Best place a term was found: highest section weight wins.
function bestHit(re, segs, filter) {
  let best = null;
  for (const s of segs) {
    if (filter && !filter(s)) continue;
    const m = match(re, s.text);
    if (!m) continue;
    const w = SECTION_WEIGHTS[s.kind] ?? 0.5;
    if (!best || w > best.sw) best = { sw: w, seg: s, m };
  }
  return best;
}

const evidence = (label, hit, contribution) => ({
  label,
  where: SECTION_LABELS[hit.seg.kind] || hit.seg.kind,
  kind: hit.seg.kind,
  ref: hit.seg.ref,
  quote: snippet(hit.seg.text, hit.m.index),
  contribution: contribution != null ? round1(contribution) : undefined
});

function coverage(terms, segs, target, filter) {
  let sum = 0;
  const ev = [];
  const missing = [];
  for (const term of terms) {
    const h = bestHit(term.re, segs, filter);
    if (!h) {
      missing.push(term.label);
      continue;
    }
    const c = term.w * h.sw;
    sum += c;
    ev.push(evidence(term.label, h, c));
  }
  ev.sort((a, b) => b.contribution - a.contribution);
  return { score: Math.min(1, sum / target), raw: sum, evidence: ev, missing };
}

// Relevance of each experience entry to the role → weighted months.
export function classifyEntries(profile, rubric) {
  return profile.experience.map((e) => {
    if (e.isProject) return { e, weight: 0, relevance: 'project (not employment)' };
    const title = `${e.role} ${e.company}`;
    const coreBul = e.bullets.filter((b) => rubric.coreRe.test(b)).length;
    const n = Math.max(1, e.bullets.length);
    let weight = 0;
    let relevance = 'not relevant';
    const titleCapped = rubric.adjTitleCaps && !rubric.coreRe.test(e.role) && rubric.adjRe.test(e.role);
    if (!titleCapped && (rubric.coreRe.test(e.role) || coreBul >= 2 || (coreBul >= 1 && coreBul / n >= 0.3))) {
      weight = 1;
      relevance = 'core';
    } else if (coreBul >= 1 || rubric.adjRe.test(title) || e.bullets.some((b) => rubric.adjRe.test(b))) {
      weight = 0.5;
      relevance = 'adjacent';
    }
    return { e, weight, relevance };
  });
}

function scoreCriterion(c, ctx) {
  const { segs, profile, rubric, opts, entries, relMonths } = ctx;
  switch (c.type) {
    case 'coverage': {
      const r = coverage(c.terms, segs, c.target);
      return { score: r.score, evidence: r.evidence, missing: r.missing, meta: { matched: r.evidence.length, of: c.terms.length } };
    }
    case 'lcaPractice': {
      const units = [];
      const seenProjects = new Set();
      for (const s of segs) {
        if (!WORKISH.has(s.kind)) continue;
        const m = match(LCA_CORE, s.text);
        if (!m) continue;
        if (s.kind === 'project') {
          if (seenProjects.has(s.ref)) continue;
          seenProjects.add(s.ref);
        } else if (s.text === s.ref) continue; // role header line, not a work item
        units.push({ seg: s, m, sw: SECTION_WEIGHTS[s.kind] });
      }
      const mention = bestHit(LCA_CORE, segs, (s) => !WORKISH.has(s.kind));
      let score = Math.min(1, units.length / c.target);
      if (!units.length && mention) score = 0.2;
      const ev = units.slice(0, 8).map((u) => evidence('LCA work item', u, null));
      if (!units.length && mention) ev.push(evidence('LCA only listed (no hands-on description)', mention, null));
      return { score, evidence: ev, meta: { units: units.length }, note: `${units.length} LCA work item(s)/project(s) described in experience or projects (target ${c.target}).` };
    }
    case 'software': {
      const work = (s) => WORKISH.has(s.kind);
      let req = 0, reqEv = [], trans = 0, transEv = [], db = 0, dbEv = [];
      for (const term of c.required) {
        const h = bestHit(term.re, segs);
        if (!h) continue;
        const v = work(h.seg) ? 1 : h.seg.kind === 'skill' ? 0.85 : 0.7;
        req = Math.max(req, v);
        reqEv.push(evidence(term.label, h, null));
      }
      for (const term of c.transferable) {
        const h = bestHit(term.re, segs);
        if (!h) continue;
        trans = Math.max(trans, work(h.seg) ? 0.4 : 0.3);
        transEv.push(evidence(`${term.label} (transferable)`, h, null));
      }
      for (const term of c.databases) {
        const h = bestHit(term.re, segs);
        if (!h) continue;
        db += 0.05;
        dbEv.push(evidence(`${term.label} (database/method)`, h, null));
      }
      const score = Math.min(1, Math.max(req, trans) + Math.min(0.1, db));
      const note = req
        ? 'Has a JD-required tool (GaBi/SimaPro).'
        : trans
          ? 'No GaBi/SimaPro — only other LCA tools (partially transferable).'
          : 'No LCA software found.';
      return { score, evidence: [...reqEv, ...transEv, ...dbEv], note, meta: { hasRequired: req > 0 } };
    }
    case 'experience': {
      const mode = rubric.experienceModes[opts.lcaMode || 'jd'];
      let years = relMonths / 12;
      let fromClaim = false;
      if (!relMonths && profile.claimed && !profile.experience.some((e) => e.dates.months)) {
        years = profile.claimed.years * 0.5;
        fromClaim = true;
      }
      const score = Math.min(1, years / mode.full);
      const ev = entries
        .filter((x) => x.weight > 0)
        .map((x) => ({
          label: `${x.relevance === 'core' ? 'LCA role' : 'Sustainability-adjacent role (×0.5)'} · ${x.e.dates.months || 0} mo`,
          where: 'Experience', kind: 'work', ref: `${x.e.role}${x.e.company ? ' — ' + x.e.company : ''}`,
          quote: x.e.dateRaw || 'no dates'
        }));
      return {
        score, evidence: ev, meta: { years: round1(years), fromClaim, min: mode.min, full: mode.full },
        note: `${round1(years)} relevant years (LCA roles count fully, sustainability-adjacent roles count half; overlaps not double-counted). Full marks at ${mode.full}+ yrs (${mode.label}).${fromClaim ? ' Estimated from the summary claim — no dated roles.' : ''}`
      };
    }
    case 'education': {
      const degs = profile.education.filter((e) => ['phd', 'master', 'bachelor'].includes(e.level));
      let best = null;
      for (const d of degs) {
        const v = c.fieldScores[d.field] ?? 0.3;
        if (!best || v > best.v) best = { v, d };
      }
      const score = best ? best.v : profile.education.length ? 0.1 : 0;
      return {
        score,
        evidence: best ? [{ label: `${best.d.field} degree`, where: 'Education', kind: 'edu', ref: best.d.institution || 'Education', quote: best.d.degree }] : [],
        note: best ? `Best degree field: ${best.d.field}.` : 'No bachelor/master degree detected.'
      };
    }
    case 'designTools': {
      const f = bestHit(c.figma.re, segs);
      const ev = [];
      let score = 0;
      const extras = [];
      for (const term of c.extras) {
        const h = bestHit(term.re, segs);
        if (h) extras.push(evidence(term.label, h, null));
      }
      if (f) {
        score = (WORKISH.has(f.seg.kind) ? 0.75 : 0.7) + Math.min(0.3, extras.length * 0.08);
        ev.push(evidence('Figma', f, null));
      } else score = Math.min(0.35, extras.length * 0.12);
      return { score: Math.min(1, score), evidence: [...ev, ...extras], note: f ? 'Figma found.' : 'Figma not found (JD requires it).', meta: { figma: !!f } };
    }
    case 'portfolio': {
      const designSegs = segs.filter((s) => WORKISH.has(s.kind) && (DESIGN_CORE.test(s.text) || /\b(app|website|landing page|dashboard|screens?|case study|platform|redesign)\b/i.test(s.text)));
      const refs = new Set(designSegs.map((s) => s.ref));
      const items = refs.size;
      const rel = coverage(c.relevance, designSegs, 3);
      const score = 0.55 * Math.min(1, items / 5) + 0.45 * rel.score;
      return { score, evidence: rel.evidence, meta: { items }, note: `${items} design role(s)/project(s); relevance to website + job board goals scored from those items.` };
    }
    case 'designFit': {
      const m = relMonths;
      const items = ctx.designItems;
      let exp, expNote;
      if (m <= 0) {
        exp = items >= 2 ? 0.7 : items >= 1 ? 0.5 : 0.2;
        expNote = 'No dated design roles (fresher)';
      } else if (m <= 15) { exp = 1; expNote = `${m} mo design experience — matches 0–1 yr`; }
      else if (m <= 36) { exp = 0.9; expNote = `${m} mo design experience — above the 0–1 yr band`; }
      else if (m <= 60) { exp = 0.8; expNote = `${m} mo design experience — well above internship level`; }
      else { exp = 0.7; expNote = `${m} mo design experience — may be over-qualified for an internship`; }
      const degs = profile.education.filter((e) => ['phd', 'master', 'bachelor', 'certificate'].includes(e.level));
      let edu = 0.3, eduD = null;
      for (const d of degs) {
        const v = c.eduScores[d.field] ?? 0.5;
        if (v > edu) { edu = v; eduD = d; }
      }
      return {
        score: 0.7 * exp + 0.3 * edu,
        evidence: [
          { label: expNote, where: 'Experience', kind: 'work', ref: 'Design experience', quote: `${round1(m / 12)} weighted years` },
          ...(eduD ? [{ label: `${eduD.field} education`, where: 'Education', kind: 'edu', ref: eduD.institution || 'Education', quote: eduD.degree }] : [])
        ],
        note: `${expNote}; education field weight ${edu}.`,
        meta: { months: m }
      };
    }
    default:
      return { score: 0, evidence: [] };
  }
}

export function scoreForRole(profile, rubricId, opts = {}) {
  const rubric = RUBRICS[rubricId];
  if (profile.issues.some((i) => i.level === 'error')) {
    return { role: rubricId, score: 0, band: { label: 'Not scored', key: 'none' }, criteria: [], mustHaves: [], error: true, relevantMonths: 0, highlights: [], gaps: ['Resume could not be read'] };
  }
  const segs = segmentsOf(profile);
  const entries = classifyEntries(profile, rubric);
  const relMonths = Math.round(weightedMonths(entries.map((x) => ({ dates: x.e.dates, weight: x.weight }))));
  const designItems = new Set(segs.filter((s) => WORKISH.has(s.kind) && DESIGN_CORE.test(s.text)).map((s) => s.ref)).size;
  const ctx = { segs, profile, rubric, opts, entries, relMonths, designItems };

  const criteria = rubric.criteria.map((c) => {
    const r = scoreCriterion(c, ctx);
    return { key: c.key, label: c.label, weight: c.weight, jd: c.jd, score: r.score, points: round1(r.score * c.weight), evidence: r.evidence, missing: r.missing || [], note: r.note || '', meta: r.meta || {} };
  });
  let total = criteria.reduce((a, c) => a + c.score * c.weight, 0);

  // Domain gate: without any hands-on evidence of the core discipline in
  // experience/projects, generic matches (e.g. "stakeholder", "data") should not
  // carry a candidate up the list.
  const coreHands = segs.some((s) => WORKISH.has(s.kind) && rubric.coreRe.test(s.text));
  let gate = null;
  if (!coreHands) {
    gate = `No hands-on ${rubricId === 'lca' ? 'LCA' : 'UI/UX'} work described in experience or projects — score halved.`;
    total *= 0.5;
  }
  const byKey = Object.fromEntries(criteria.map((c) => [c.key, c]));

  let mustHaves;
  if (rubricId === 'lca') {
    const ex = byKey.experience.meta;
    const iso = byKey.standards.evidence.some((e) => e.label.startsWith('ISO'));
    mustHaves = [
      { key: 'exp', label: `≥ ${ex.min} yrs relevant experience`, met: ex.years >= ex.min, detail: `${ex.years} yrs` },
      { key: 'software', label: 'GaBi or SimaPro', met: !!byKey.software.meta.hasRequired, detail: byKey.software.meta.hasRequired ? 'found' : 'not found' },
      { key: 'projects', label: '≥ 3 LCA studies evidenced', met: byKey.lca_practice.meta.units >= 3, detail: `${byKey.lca_practice.meta.units} found` },
      { key: 'iso', label: 'ISO 14040/44 evidence', met: iso, detail: iso ? 'found' : 'not found' }
    ];
  } else {
    const rs = byKey.research.evidence.length;
    const vis = byKey.visual.evidence.length;
    const proto = byKey.ux_practice.evidence.some((e) => e.label === 'Prototyping');
    mustHaves = [
      { key: 'figma', label: 'Figma', met: !!byKey.tools.meta.figma, detail: byKey.tools.meta.figma ? 'found' : 'not found' },
      { key: 'research', label: 'User research / psychology', met: rs >= 2, detail: `${rs} research signals` },
      { key: 'prototype', label: 'Prototyping', met: proto, detail: proto ? 'found' : 'not found' },
      { key: 'visual', label: 'Visual craft evidence', met: vis >= 2, detail: `${vis} visual signals` }
    ];
  }

  // Each unmet JD must-have costs MUSTHAVE_PENALTY of the score (knock-out light).
  const unmet = mustHaves.filter((m) => !m.met).length;
  const rawScore = round1(total);
  total *= 1 - MUSTHAVE_PENALTY * unmet;
  const score = round1(total);
  const band = FIT_BANDS.find((b) => score >= b.min);

  const highlights = criteria
    .filter((c) => !['experience', 'education', 'fit', 'lca_practice'].includes(c.key))
    .flatMap((c) => c.evidence.filter((e) => WORKISH.has(e.kind) || e.kind === 'skill').map((e) => e.label.replace(/ \((transferable|database\/method)\)$/, '')))
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 6);
  const gaps = [
    ...mustHaves.filter((m) => !m.met).map((m) => `Missing: ${m.label}`),
    ...criteria.filter((c) => c.score < 0.35).map((c) => `Weak: ${c.label} (${pct(c.score)}%)`)
  ];

  return {
    role: rubricId, score, rawScore, unmet, band, criteria, mustHaves, gate,
    mustHavesMet: mustHaves.filter((m) => m.met).length,
    relevantMonths: relMonths,
    relevantEntries: entries.map((x) => ({ role: x.e.role, company: x.e.company, months: x.e.dates.months, relevance: x.relevance, weight: x.weight })),
    highlights, gaps
  };
}

export function classify(profile, lca, uiux) {
  if (profile.issues.some((i) => i.level === 'error'))
    return { key: 'uncertain', label: 'Uncertain', reason: 'Resume could not be read — needs manual review.' };
  const a = lca.score, b = uiux.score;
  const hi = Math.max(a, b);
  const leader = a >= b ? 'lca' : 'uiux';
  const leaderLabel = leader === 'lca' ? 'LCA' : 'UI/UX';
  const lo = Math.min(a, b);
  if (a >= CLASSIFY.bothMin && b >= CLASSIFY.bothMin)
    return { key: 'both', label: 'Both', reason: `Credible on both roles (LCA ${a}, UI/UX ${b}).` };
  if (hi < CLASSIFY.neitherMax)
    return { key: 'neither', label: 'Neither', reason: `Very low on both roles (LCA ${a}, UI/UX ${b}); profile is outside both JDs.` };
  if (hi - lo >= Math.max(CLASSIFY.minLead, CLASSIFY.relLead * hi)) {
    const weak = hi < CLASSIFY.matchMin;
    return {
      key: leader, label: leaderLabel, weak,
      reason: weak
        ? `Leans ${leaderLabel} (${hi} vs ${lo}) but is below the ${CLASSIFY.matchMin}-point match threshold — weak match, review before shortlisting.`
        : `Clear ${leaderLabel} match (${hi} vs ${lo}).`
    };
  }
  return { key: 'uncertain', label: 'Uncertain', reason: `Scores too close to call (LCA ${a}, UI/UX ${b}) — review manually.` };
}

export function evaluate(profile, opts = {}) {
  const lca = scoreForRole(profile, 'lca', opts);
  const uiux = scoreForRole(profile, 'uiux', opts);
  return { lca, uiux, classification: classify(profile, lca, uiux) };
}

// Rank a list of {profile, result} for a role. Ties → relevant experience → id.
export function rank(items, role) {
  return [...items].sort((x, y) => {
    const d = y.result[role].score - x.result[role].score;
    if (d) return d;
    const e = y.result[role].relevantMonths - x.result[role].relevantMonths;
    if (e) return e;
    return x.profile.id.localeCompare(y.profile.id);
  });
}
