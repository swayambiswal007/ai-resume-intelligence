'use client';
import { useMemo, useState } from 'react';
import { ClassChip, Flags, yrs } from './ui';

const CLASSES = [
  ['all', 'All'], ['lca', 'LCA'], ['uiux', 'UI/UX'], ['both', 'Both'], ['neither', 'Neither'], ['uncertain', 'Uncertain']
];

export default function AllView({ items, onSelect, selectedId }) {
  const [cls, setCls] = useState('all');
  const [weakOnly, setWeakOnly] = useState(false);
  const [issuesOnly, setIssuesOnly] = useState(false);
  const [sort, setSort] = useState({ k: 'lca', d: -1 });

  const count = (k) => (k === 'all' ? items.length : items.filter((x) => x.result.classification.key === k).length);
  const val = {
    id: (x) => x.profile.id,
    lca: (x) => x.result.lca.score,
    uiux: (x) => x.result.uiux.score,
    total: (x) => x.profile.totalMonths,
    issues: (x) => x.profile.issues.filter((i) => i.level !== 'info').length + (x.profile.corrections?.length || 0)
  };
  const rows = useMemo(() => items
    .filter((x) => cls === 'all' || x.result.classification.key === cls)
    .filter((x) => !weakOnly || x.result.classification.weak)
    .filter((x) => !issuesOnly || x.profile.issues.some((i) => i.level !== 'info') || x.profile.corrections?.length)
    .sort((a, b) => {
      const A = val[sort.k](a), B = val[sort.k](b);
      return (typeof A === 'string' ? A.localeCompare(B) : A - B) * sort.d;
    }), [items, cls, weakOnly, issuesOnly, sort]);
  const th = (k, label) => (
    <th><button onClick={() => setSort((s) => ({ k, d: s.k === k ? -s.d : -1 }))}>{label}{sort.k === k ? (sort.d < 0 ? ' ↓' : ' ↑') : ''}</button></th>
  );

  return (
    <>
      <div className="filters">
        <span className="seg" role="group" aria-label="Classification">
          {CLASSES.map(([k, l]) => <button key={k} aria-pressed={cls === k} onClick={() => setCls(k)}>{l} ({count(k)})</button>)}
        </span>
        <label><input type="checkbox" checked={weakOnly} onChange={(e) => setWeakOnly(e.target.checked)} /> Weak matches only</label>
        <label><input type="checkbox" checked={issuesOnly} onChange={(e) => setIssuesOnly(e.target.checked)} /> With warnings / corrections</label>
        <span className="result-note">{rows.length} shown</span>
      </div>
      <div className="card table-wrap">
        <table className="table">
          <thead>
            <tr>
              {th('id', 'Candidate')}
              <th>Classification</th>
              {th('lca', 'LCA score')}
              {th('uiux', 'UI/UX score')}
              <th className="col-total"><button onClick={() => setSort((s) => ({ k: 'total', d: s.k === 'total' ? -s.d : -1 }))}>Total exp{sort.k === 'total' ? (sort.d < 0 ? ' ↓' : ' ↑') : ''}</button></th>
              <th className="col-ev">Why</th>
              {th('issues', 'Data')}
            </tr>
          </thead>
          <tbody>
            {rows.map((x) => {
              const p = x.profile;
              const c = x.result.classification;
              return (
                <tr key={p.id} tabIndex={0} className={`row${selectedId === p.id ? ' selected' : ''}${p.uploaded ? ' new-row' : ''}`}
                  onClick={() => onSelect(p.id, c.key === 'uiux' ? 'uiux' : 'lca')}
                  onKeyDown={(e) => e.key === 'Enter' && onSelect(p.id, c.key === 'uiux' ? 'uiux' : 'lca')}>
                  <td className="cand"><div><b>{p.id}</b> {p.uploaded && <span className="chip new">NEW</span>}</div><div className="hl">{p.headline || <span className="faint">no headline</span>}</div></td>
                  <td><ClassChip c={c} /></td>
                  <td className="mono" style={{ fontSize: 14 }}>{x.result.lca.score}</td>
                  <td className="mono" style={{ fontSize: 14 }}>{x.result.uiux.score}</td>
                  <td className="mono col-total">{yrs(p.totalMonths)}</td>
                  <td className="col-ev muted" style={{ fontSize: 12.5, maxWidth: 380 }}>{c.reason}</td>
                  <td><Flags profile={p} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
