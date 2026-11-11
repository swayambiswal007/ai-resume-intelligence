'use client';
import { useEffect, useRef } from 'react';
import { ClassChip, Band, ROLE_LABEL, yrs } from './ui';
import { MUSTHAVE_PENALTY } from '@/lib/engine/config';

function Criterion({ c }) {
  const pct = Math.round(c.score * 100);
  const key = pct >= 70 ? 'strong' : pct >= 50 ? 'good' : pct >= 30 ? 'moderate' : 'weak';
  return (
    <details className="crit">
      <summary>
        <span className="lbl">{c.label}<small>JD: {c.jd}</small></span>
        <span className="bar" title={`${pct}%`}><i className={`fill-${key}`} style={{ width: `${Math.max(2, pct)}%` }} /></span>
        <span className="pts">{c.points}/{c.weight}</span>
      </summary>
      <div className="body">
        {c.note && <div className="note">{c.note}</div>}
        {c.evidence.length === 0 && <div className="faint">No evidence found.</div>}
        {c.evidence.slice(0, 10).map((e, i) => (
          <div className="quote" key={i}>
            <div><b>{e.label}</b>{e.contribution != null && <span className="faint mono"> +{e.contribution}</span>}</div>
            <div className="q">“{e.quote}”</div>
            <div className="src">{e.where}{e.ref && e.ref !== e.where ? ` · ${e.ref}` : ''}</div>
          </div>
        ))}
        {c.missing?.length > 0 && <div className="missing">Not found: {c.missing.join(', ')}</div>}
      </div>
    </details>
  );
}

export default function Drawer({ item, role, setRole, ranks, total, onClose, onRemove }) {
  const ref = useRef(null);
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', k);
    ref.current?.focus();
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  if (!item) return null;
  const p = item.profile;
  const r = item.result[role];
  const cls = item.result.classification;
  const sumPts = Math.round(r.criteria.reduce((a, c) => a + c.score * c.weight, 0) * 10) / 10;
  const err = p.issues.find((i) => i.level === 'error');
  const src = p.source || {};

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={`Candidate ${p.id}`} tabIndex={-1} ref={ref}>
        <div className="drawer-head">
          <div className="row1">
            <div>
              <div className="id">{p.id}{p.fileName ? ` · ${p.fileName}` : ''}</div>
              <h2>{p.headline || 'No headline extracted'}</h2>
            </div>
            <button className="btn small" onClick={onClose} aria-label="Close">✕ Close</button>
          </div>
          <div className="rolecards">
            {['lca', 'uiux'].map((k) => (
              <button key={k} className="rolecard" aria-pressed={role === k} onClick={() => setRole(k)}>
                <div className="t">{ROLE_LABEL[k]} · rank {ranks[k].get(p.id)} of {total}</div>
                <div className="s">{item.result[k].score}</div>
                <Band band={item.result[k].band} />
              </button>
            ))}
          </div>
          <div className="classline"><ClassChip c={cls} /> <span>{cls.reason}</span></div>
        </div>

        <div className="drawer-body">
          {err && (
            <div className="errorbox"><b>Could not score this resume.</b> {err.message}</div>
          )}

          <div className="section">
            <h3>
              <span>Source resume</span>
            </h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {src.html && <a className="btn small" href={src.html} target="_blank" rel="noreferrer">Open rendered resume ↗</a>}
              {src.file && <a className="btn small" href={src.file} download>Download original</a>}
              {src.blob && <a className="btn small" href={src.blob} target="_blank" rel="noreferrer">Open uploaded file ↗</a>}
              {p.uploaded && !src.blob && <span className="faint">Uploaded in an earlier session. The original file is not stored, only the extracted text below.</span>}
              {p.uploaded && <button className="btn small" onClick={() => onRemove(p.id)}>Remove upload</button>}
            </div>
            {p.extractMethod && <div className="faint" style={{ marginTop: 6 }}>Extracted with {p.extractMethod}.</div>}
          </div>

          {!err && (
            <div className="section">
              <h3><span>Why this score · {ROLE_LABEL[role]}</span></h3>
              <div className="formula">
                Sum of criteria <b>{sumPts}</b>
                {r.gate && <> × 0.5 <span className="muted">(domain gate)</span></>}
                {r.unmet > 0 && <> × {(1 - MUSTHAVE_PENALTY * r.unmet).toFixed(2)} <span className="muted">({r.unmet} must-have{r.unmet > 1 ? 's' : ''} unmet, −{Math.round(MUSTHAVE_PENALTY * 100)}% each)</span></>}
                {' '}= <b>{r.score}</b>
                {r.gate && <div className="muted" style={{ marginTop: 4 }}>{r.gate}</div>}
              </div>
              {r.criteria.map((c) => <Criterion key={c.key} c={c} />)}
            </div>
          )}

          {!err && (
            <div className="section">
              <h3><span>JD must-haves</span><span className="faint mono">{r.mustHavesMet}/4 met</span></h3>
              <div className="musts">
                {r.mustHaves.map((m) => (
                  <div key={m.key} className={`must ${m.met ? 'met' : 'unmet'}`}><span className="ic">{m.met ? '✓' : '✗'}</span><span>{m.label} <span className="faint">({m.detail})</span></span></div>
                ))}
              </div>
              {r.gaps?.length > 0 && <div className="missing" style={{ marginTop: 10 }}>Gaps: {r.gaps.join(' · ')}</div>}
            </div>
          )}

          <div className="section">
            <h3><span>Extracted profile</span></h3>
            <dl className="kv">
              <dt>Headline</dt><dd>{p.headline || '—'}</dd>
              <dt>Total experience</dt><dd>{yrs(p.totalMonths)} <span className="faint">(dated roles, overlaps merged)</span></dd>
              <dt>Claimed in summary</dt><dd>{p.claimed ? `“${p.claimed.text}”` : '—'}</dd>
              <dt>Relevant to role</dt><dd>{yrs(r.relevantMonths)} <span className="faint">(core roles ×1, adjacent ×0.5)</span></dd>
              {p.summary && <><dt>Summary</dt><dd>{p.summary}</dd></>}
            </dl>
          </div>

          {p.experience.length > 0 && (
            <div className="section">
              <h3><span>Experience</span></h3>
              <div className="timeline">
                {p.experience.map((e, i) => {
                  const rel = r.relevantEntries?.[i];
                  const relKey = rel ? (rel.relevance === 'core' ? 'core' : rel.relevance === 'adjacent' ? 'adjacent' : 'none') : 'none';
                  return (
                    <div className="tl-item" key={i}>
                      <div><span className="r">{e.role}</span>{rel && <span className={`rel ${relKey}`}>{rel.relevance}</span>}<div className="c">{e.company}</div></div>
                      <div className="d">{e.dateRaw || 'no dates'}<br />{e.dates?.months ? `${e.dates.months} mo` : '0 mo'}</div>
                      {e.bullets.length > 0 && <ul>{e.bullets.map((b, j) => <li key={j}>{b}</li>)}</ul>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="section">
            <h3><span>Education, skills & projects</span></h3>
            <dl className="kv">
              <dt>Education</dt>
              <dd>{p.education.length ? p.education.map((e, i) => <div key={i}>{e.degree}{e.institution ? ` — ${e.institution}` : ''}{e.years ? `, ${e.years}` : ''} <span className="faint">[{e.level}/{e.field}]</span></div>) : '—'}</dd>
              {Object.entries(p.skills || {}).map(([g, list]) => (
                <span key={g} style={{ display: 'contents' }}><dt>{g}</dt><dd style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{list.map((s) => <span className="chip" key={s}>{s}</span>)}</dd></span>
              ))}
              <dt>Projects</dt>
              <dd>{p.projects.length ? p.projects.map((pr, i) => <div key={i} style={{ marginBottom: 4 }}><b>{pr.title}</b>{pr.description ? <span className="muted"> {pr.description}</span> : null}</div>) : '—'}</dd>
              {p.certifications.length > 0 && <><dt>Certifications</dt><dd>{p.certifications.map((c, i) => <div key={i}>{c}</div>)}</dd></>}
              {p.languages.length > 0 && <><dt>Languages</dt><dd>{p.languages.join(', ')}</dd></>}
              {p.awards.length > 0 && <><dt>Awards</dt><dd>{p.awards.map((c, i) => <div key={i}>{c}</div>)}</dd></>}
            </dl>
          </div>

          <div className="section">
            <h3><span>Data quality</span><span className="faint mono">{p.issues.length} note(s) · {p.corrections?.length || 0} correction(s)</span></h3>
            {p.issues.length === 0 && <div className="faint">No extraction issues detected.</div>}
            {p.issues.map((i, k) => (
              <div className="issue" key={k}><span className={`lv ${i.level}`}>{i.level === 'info' && i.code === 'REVIEW_NOTE' ? 'review' : i.level}</span><span>{i.message}</span></div>
            ))}
            {p.corrections?.length > 0 && (
              <>
                <h3 style={{ marginTop: 14 }}><span>Reviewer corrections</span></h3>
                {p.corrections.map((c, k) => (
                  <div className="fixrow" key={k}>
                    <div className="ba"><span className="faint">{c.field}:</span> <del>{String(c.before ?? '—')}</del> → <ins>{String(c.after ?? '—')}</ins></div>
                    <div className="muted">{c.reason}</div>
                  </div>
                ))}
              </>
            )}
          </div>

          <details className="section">
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Raw extracted text ({p.textLength} chars)</summary>
            <pre className="raw" style={{ marginTop: 10 }}>{p.rawText || '(empty)'}</pre>
          </details>
        </div>
      </aside>
    </>
  );
}
