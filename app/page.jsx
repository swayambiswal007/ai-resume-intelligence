'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { evaluate, rank, RUBRICS, REF_DATE_LABEL } from '@/lib/engine';
import RoleView from '@/components/RoleView';
import AllView from '@/components/AllView';
import MethodView from '@/components/MethodView';
import Drawer from '@/components/Drawer';
import UploadModal from '@/components/UploadModal';

const STORE_KEY = 'gfi-ranker-uploads-v1';
const load = () => {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); } catch { return []; }
};
const save = (list) => {
  try {
    // Object URLs only live for this session, so they are not persisted.
    localStorage.setItem(STORE_KEY, JSON.stringify(list.map((p) => ({ ...p, source: {} }))));
  } catch { /* storage unavailable (private mode) — uploads stay for this session only */ }
};

export default function Page() {
  const [base, setBase] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [uploads, setUploads] = useState([]);
  const [tab, setTab] = useState('lca');
  const [lcaMode, setLcaMode] = useState('jd');
  const [sel, setSel] = useState(null); // {id, role}
  const [showUpload, setShowUpload] = useState(false);
  const [jdText, setJdText] = useState(null);
  const [toast, setToast] = useState('');

  useEffect(() => {
    fetch('/data/profiles.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((d) => setBase(d.profiles))
      .catch((e) => setLoadError(e.message));
    setUploads(load());
  }, []);

  const items = useMemo(() => {
    if (!base) return [];
    return [...base, ...uploads].map((p) => ({ profile: p, result: evaluate(p, { lcaMode }) }));
  }, [base, uploads, lcaMode]);

  const ranks = useMemo(() => ({
    lca: new Map(rank(items, 'lca').map((x, i) => [x.profile.id, i + 1])),
    uiux: new Map(rank(items, 'uiux').map((x, i) => [x.profile.id, i + 1]))
  }), [items]);

  const addUpload = (p) => setUploads((u) => { const n = [...u, p]; save(n); return n; });
  const removeUpload = (id) => {
    setUploads((u) => { const n = u.filter((p) => p.id !== id); save(n); return n; });
    if (sel?.id === id) setSel(null);
  };
  const openCandidate = useCallback((id, role) => { setShowUpload(false); setSel({ id, role }); }, []);
  const closeDrawer = useCallback(() => setSel(null), []);

  const showJD = async (role) => {
    const file = RUBRICS[role].jdFile;
    try { setJdText({ role, text: await (await fetch(`/data/${file}`)).text() }); } catch { setJdText({ role, text: 'Could not load JD.' }); }
  };

  const exportCsv = () => {
    const q = (s) => `"${String(s ?? '').replace(/"/g, '""')}"`;
    const head = ['id', 'headline', 'classification', 'classification_reason', 'lca_rank', 'lca_score', 'lca_fit', 'lca_must_haves_met', 'uiux_rank', 'uiux_score', 'uiux_fit', 'uiux_must_haves_met', 'total_experience_yrs', 'lca_relevant_yrs', 'design_relevant_yrs', 'warnings', 'reviewer_corrections', 'source_file'];
    const lines = [head.join(',')];
    for (const x of rank(items, tab === 'uiux' ? 'uiux' : 'lca')) {
      const p = x.profile, r = x.result;
      lines.push([p.id, q(p.headline), r.classification.label + (r.classification.weak ? ' (weak)' : ''), q(r.classification.reason), ranks.lca.get(p.id), r.lca.score, r.lca.band.label, r.lca.mustHavesMet ?? 0, ranks.uiux.get(p.id), r.uiux.score, r.uiux.band.label, r.uiux.mustHavesMet ?? 0, (p.totalMonths / 12).toFixed(1), (r.lca.relevantMonths / 12).toFixed(1), (r.uiux.relevantMonths / 12).toFixed(1), q(p.issues.filter((i) => i.level !== 'info').map((i) => i.message).join(' | ')), p.corrections?.length || 0, q(p.fileName)].join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `resume-rankings-${lcaMode}.csv`;
    a.click();
    setToast('CSV exported');
    setTimeout(() => setToast(''), 2200);
  };

  const selItem = sel && items.find((x) => x.profile.id === sel.id);
  const counts = useMemo(() => {
    const c = { lca: 0, uiux: 0 };
    for (const x of items) {
      const k = x.result.classification.key;
      if (k === 'lca' || k === 'both') c.lca++;
      if (k === 'uiux' || k === 'both') c.uiux++;
    }
    return c;
  }, [items]);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark" aria-hidden="true">G</div>
          <div>
            <h1>Resume Ranker</h1>
            <p>Growth For Impact · {base ? `${base.length} resumes` : 'loading'}{uploads.length ? ` + ${uploads.length} uploaded` : ''} · 2 job profiles · snapshot {REF_DATE_LABEL}</p>
          </div>
        </div>
        <div className="top-actions">
          <button className="btn" onClick={exportCsv} disabled={!items.length}>Export CSV</button>
          <button className="btn primary" onClick={() => setShowUpload(true)} disabled={!base}>＋ Upload a resume</button>
        </div>
      </header>

      <nav className="tabs" role="tablist" aria-label="Views">
        {[['lca', 'LCA Consultant', counts.lca], ['uiux', 'UI/UX Design Intern', counts.uiux], ['all', 'All resumes', items.length], ['method', 'Method', null]].map(([k, l, n]) => (
          <button key={k} role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>
            {l}{n != null && <span className="count">{n}</span>}
          </button>
        ))}
      </nav>

      {loadError && <div className="errorbox"><b>Could not load resume data.</b> {loadError}. Run <code>npm run data</code> before building.</div>}
      {!base && !loadError && <div className="loading">Loading resumes…</div>}

      {base && (tab === 'lca' || tab === 'uiux') && (
        <RoleView key={tab} role={tab} rubric={RUBRICS[tab]} items={items} ranks={ranks} onSelect={openCandidate} selectedId={sel?.id}
          lcaMode={lcaMode} setLcaMode={setLcaMode} onShowJD={() => showJD(tab)} />
      )}
      {base && tab === 'all' && <AllView items={items} onSelect={openCandidate} selectedId={sel?.id} />}
      {base && tab === 'method' && <MethodView items={items} />}

      {selItem && (
        <Drawer item={selItem} role={sel.role} setRole={(role) => setSel((s) => ({ ...s, role }))} ranks={ranks} total={items.length} onClose={closeDrawer} onRemove={removeUpload} />
      )}
      {showUpload && (
        <UploadModal items={items} uploads={uploads} lcaMode={lcaMode} onAdd={addUpload} onRemove={removeUpload} onClose={() => setShowUpload(false)} onOpen={openCandidate} />
      )}
      {jdText && (
        <>
          <div className="scrim" onClick={() => setJdText(null)} />
          <div className="modal" role="dialog" aria-modal="true" aria-label="Job description">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <h2>{RUBRICS[jdText.role].title} — job description</h2>
              <button className="btn small" onClick={() => setJdText(null)}>✕</button>
            </div>
            <pre className="raw" style={{ maxHeight: '70vh' }}>{jdText.text.replace(/^\s*Form logo\s*/m, '').replace(/\n?Apply\s*\nMade with Tally\s*$/m, '').trim()}</pre>
          </div>
        </>
      )}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
