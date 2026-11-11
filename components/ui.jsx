'use client';

export const ROLE_LABEL = { lca: 'LCA Consultant', uiux: 'UI/UX Design Intern' };
export const yrs = (months) => (months ? `${(months / 12).toFixed(1)} yrs` : '—');

export function ScoreBar({ score, band }) {
  const key = band?.key || 'none';
  return (
    <div className="scorebar">
      <span className="num">{score}</span>
      <div className="bar" aria-hidden="true">
        <i className={`fill-${key}`} style={{ width: `${Math.max(2, score)}%` }} />
      </div>
    </div>
  );
}

export function Band({ band }) {
  return <span className={`band ${band?.key || 'none'}`}>{band?.label || '—'}</span>;
}

export function Dots({ mustHaves }) {
  if (!mustHaves?.length) return <span className="faint">—</span>;
  const met = mustHaves.filter((m) => m.met).length;
  return (
    <span className="dots" title={mustHaves.map((m) => `${m.met ? '✓' : '✗'} ${m.label}`).join('\n')} aria-label={`${met} of ${mustHaves.length} must-haves met`}>
      {mustHaves.map((m) => <i key={m.key} className={m.met ? 'on' : ''} />)}
    </span>
  );
}

export function ClassChip({ c }) {
  if (!c) return null;
  return (
    <span className={`chip ${c.key}${c.weak ? ' weak-tag' : ''}`} title={c.reason}>
      {c.label}{c.weak ? ' · weak' : ''}
    </span>
  );
}

export function Flags({ profile }) {
  const err = profile.issues.filter((i) => i.level === 'error').length;
  const warn = profile.issues.filter((i) => i.level === 'warning').length;
  const fix = profile.corrections?.length || 0;
  return (
    <span className="flags">
      {err > 0 && <span className="flag error" title="Extraction error">Error</span>}
      {warn > 0 && <span className="flag warning" title={`${warn} extraction warning(s)`}>⚠ {warn}</span>}
      {fix > 0 && <span className="flag fix" title={`${fix} reviewer correction(s)`}>✎ {fix}</span>}
    </span>
  );
}
