'use client';
import { useMemo, useState } from 'react';
import { ScoreBar, Band, Dots, ClassChip, Flags, yrs } from './ui';
import { FIT_BANDS } from '@/lib/engine';

const REQS = {
  lca: ['2–3 yrs running LCA independently', 'GaBi or SimaPro', '≥ 3 LCA projects', 'ISO 14040 / 14044', 'LCI data collection & validation', 'Plant, energy & logistics data', 'Public benchmarking', 'Environmental degree (desired)', 'EPD experience (preferred)', 'Onsite Chennai + travel'],
  uiux: ['0–1 yr experience', 'Figma hi-fi prototypes', 'User research & user psychology (mandatory)', 'Aesthetic sense & eye for detail (mandatory)', 'Website revamp (90 days)', 'Job board (90 days)', 'Cross-functional, fully remote']
};

const SORTS = {
  score: { label: 'Score', fn: (r) => r.score },
  rel: { label: 'Relevant experience', fn: (r) => r.relevantMonths },
  must: { label: 'Must-haves met', fn: (r) => r.mustHavesMet ?? 0 },
  total: { label: 'Total experience', fn: (r, p) => p.totalMonths }
};

export default function RoleView({ role, rubric, items, ranks, onSelect, selectedId, lcaMode, setLcaMode, onShowJD }) {
  const [scope, setScope] = useState('role');
  const [q, setQ] = useState('');
  const [bands, setBands] = useState([]);
  const [minExp, setMinExp] = useState(0);
  const [minMust, setMinMust] = useState(0);
  const [sort, setSort] = useState('score');
  const [dir, setDir] = useState('desc');

  const inRole = (x) => x.result.classification.key === role || x.result.classification.key === 'both';
  const pileCount = items.filter(inRole).length;
  const strong = items.filter((x) => inRole(x) && x.result[role].score >= 55).length;
  const mustAll = items.filter((x) => inRole(x) && x.result[role].mustHavesMet === 4).length;

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const s = SORTS[sort];
    return items
      .filter((x) => (scope === 'all' ? true : inRole(x) || x.profile.uploaded))
      .filter((x) => !bands.length || bands.includes(x.result[role].band.key))
      .filter((x) => x.result[role].relevantMonths >= minExp * 12)
      .filter((x) => (x.result[role].mustHavesMet ?? 0) >= minMust)
      .filter((x) => {
        if (!needle) return true;
        const p = x.profile;
        const hay = [p.id, p.headline, p.fileName, ...Object.values(p.skills || {}).flat(), ...(x.result[role].highlights || [])].join(' ').toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => {
        const d = s.fn(b.result[role], b.profile) - s.fn(a.result[role], a.profile);
        const v = d || ranks[role].get(a.profile.id) - ranks[role].get(b.profile.id);
        return dir === 'desc' ? v : -v;
      });
  }, [items, scope, bands, minExp, minMust, q, sort, dir, role, ranks]);

  const toggleBand = (k) => setBands((b) => (b.includes(k) ? b.filter((x) => x !== k) : [...b, k]));
  const headSort = (k) => {
    if (sort === k) setDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    else { setSort(k); setDir('desc'); }
  };
  const arrow = (k) => (sort === k ? (dir === 'desc' ? ' ↓' : ' ↑') : '');
  const modes = rubric.experienceModes;

  return (
    <>
      <section className="card jd" aria-label="Job profile">
        <div>
          <h2>{rubric.title}</h2>
          <div className="sub">{rubric.subtitle} · <button className="btn ghost small" onClick={onShowJD}>Read full JD</button></div>
        </div>
        <div className="stats">
          <div className="stat"><b>{pileCount}</b><span>classified for this role</span></div>
          <div className="stat"><b>{strong}</b><span>good or strong fit</span></div>
          <div className="stat"><b>{mustAll}</b><span>meet all 4 must-haves</span></div>
        </div>
        <div className="reqs">{REQS[role].map((r) => <span key={r} className="chip req">{r}</span>)}</div>
        {modes && (
          <div className="notice">
            <span><b>Experience bar:</b> {modes[lcaMode].note} The JD and the brief disagree (2–3 vs 4–6 yrs), so you can switch which one the ranking uses.</span>
            <span className="seg" role="group" aria-label="Experience bar">
              {Object.entries(modes).map(([k, m]) => (
                <button key={k} aria-pressed={lcaMode === k} onClick={() => setLcaMode(k)}>{m.label}</button>
              ))}
            </span>
          </div>
        )}
      </section>

      <div className="filters">
        <input type="search" placeholder="Search ID, headline, skill or evidence…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search candidates" />
        <span className="seg" role="group" aria-label="Which resumes">
          <button aria-pressed={scope === 'role'} onClick={() => setScope('role')}>Classified for this role</button>
          <button aria-pressed={scope === 'all'} onClick={() => setScope('all')}>All {items.length} resumes</button>
        </span>
        <span className="band-filter" role="group" aria-label="Fit band">
          {FIT_BANDS.map((b) => <button key={b.key} aria-pressed={bands.includes(b.key)} onClick={() => toggleBand(b.key)}>{b.label}</button>)}
        </span>
        <label>Relevant exp
          <select value={minExp} onChange={(e) => setMinExp(+e.target.value)}>
            <option value={0}>Any</option><option value={0.5}>≥ 6 months</option><option value={1}>≥ 1 yr</option><option value={2}>≥ 2 yrs</option><option value={3}>≥ 3 yrs</option><option value={4}>≥ 4 yrs</option>
          </select>
        </label>
        <label>Must-haves
          <select value={minMust} onChange={(e) => setMinMust(+e.target.value)}>
            <option value={0}>Any</option><option value={2}>≥ 2 of 4</option><option value={3}>≥ 3 of 4</option><option value={4}>All 4</option>
          </select>
        </label>
        <label>Sort
          <select value={sort} onChange={(e) => { setSort(e.target.value); setDir('desc'); }}>
            {Object.entries(SORTS).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
        </label>
        <span className="result-note">{rows.length} shown · rank = position among all {items.length} resumes</span>
      </div>

      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Candidate</th>
              <th><button onClick={() => headSort('score')}>Score{arrow('score')}</button></th>
              <th className="col-must"><button onClick={() => headSort('must')}>Must-haves{arrow('must')}</button></th>
              <th><button onClick={() => headSort('rel')}>Relevant exp{arrow('rel')}</button></th>
              <th className="col-ev">Key evidence</th>
              <th className="col-flags">Data</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const r = x.result[role];
              const p = x.profile;
              return (
                <tr key={p.id} className={`row${selectedId === p.id ? ' selected' : ''}${p.uploaded ? ' new-row' : ''}`} tabIndex={0}
                  onClick={() => onSelect(p.id, role)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onSelect(p.id, role))}>
                  <td className="rank">{ranks[role].get(p.id)}</td>
                  <td className="cand">
                    <div><b>{p.id}</b> {p.uploaded && <span className="chip new">NEW</span>} <ClassChip c={x.result.classification} /></div>
                    <div className="hl" title={p.headline}>{p.headline || p.fileName || <span className="faint">no headline</span>}</div>
                  </td>
                  <td className="scorecell"><ScoreBar score={r.score} band={r.band} /><Band band={r.band} /></td>
                  <td className="col-must"><Dots mustHaves={r.mustHaves} /></td>
                  <td className="mono">{yrs(r.relevantMonths)}</td>
                  <td className="col-ev"><div className="evcell">{(r.highlights || []).slice(0, 3).map((h) => <span key={h} className="chip ev">{h}</span>)}{r.error && <span className="chip uncertain">unreadable file</span>}</div></td>
                  <td className="col-flags"><Flags profile={p} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!rows.length && <div className="empty-state">No resumes match these filters.</div>}
      </div>
    </>
  );
}
