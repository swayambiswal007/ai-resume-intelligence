'use client';
import { useRef, useState } from 'react';
import { extractText } from '@/lib/client/extract';
import { parseResume, evaluate, rank } from '@/lib/engine';
import { ClassChip } from './ui';

export default function UploadModal({ items, uploads, lcaMode, onAdd, onRemove, onClose, onOpen }) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [last, setLast] = useState(null);
  const input = useRef(null);

  async function handle(files) {
    setError('');
    setLast(null);
    const file = files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return setError('File is larger than 10 MB.');
    setBusy(true);
    try {
      const { text, method } = await extractText(file);
      const slug = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9]+/g, '_').slice(0, 24);
      const id = `NEW_${slug}_${Date.now().toString(36).slice(-4)}`;
      const profile = parseResume(text, { id, fileName: file.name });
      profile.uploaded = true;
      profile.extractMethod = method;
      profile.source = { blob: URL.createObjectURL(file) };
      const result = evaluate(profile, { lcaMode });
      const all = [...items, { profile, result }];
      const lcaPos = rank(all, 'lca').findIndex((x) => x.profile.id === id) + 1;
      const uiPos = rank(all, 'uiux').findIndex((x) => x.profile.id === id) + 1;
      onAdd(profile);
      setLast({ profile, result, lcaPos, uiPos, total: all.length });
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="scrim" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="Upload a resume">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
          <div>
            <h2>Test with a new resume</h2>
            <div className="muted">It is extracted, scored and ranked within the existing pile using the same rules. Processing happens in your browser and the file is never uploaded to a server.</div>
          </div>
          <button className="btn small" onClick={onClose} aria-label="Close">✕</button>
        </div>

        <div
          className={`drop${over ? ' over' : ''}`}
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setOver(true); }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files); }}
          role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && input.current?.click()}
        >
          <b>{busy ? 'Reading resume…' : 'Drop a resume here or click to choose'}</b>
          <span className="muted">.docx, .pdf (with a text layer) or .txt · up to 10 MB</span>
          <input ref={input} type="file" accept=".docx,.pdf,.txt,.md" className="sr" onChange={(e) => handle(e.target.files)} />
        </div>

        {error && <div className="errorbox"><b>Upload failed.</b> {error}</div>}

        {last && (
          <div className="upl-result">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
              <div><b className="mono">{last.profile.id}</b> <ClassChip c={last.result.classification} /></div>
              <button className="btn primary small" onClick={() => onOpen(last.profile.id, last.result.classification.key === 'uiux' ? 'uiux' : 'lca')}>Open full explanation →</button>
            </div>
            {last.result.lca.error ? (
              <div className="errorbox" style={{ marginTop: 10 }}><b>Unreadable.</b> {last.profile.issues.find((i) => i.level === 'error')?.message}</div>
            ) : (
              <>
                <div className="rk">
                  <div><span className="muted">LCA Consultant</span><br /><b>#{last.lcaPos}</b> <span className="muted">of {last.total} · score {last.result.lca.score}</span></div>
                  <div><span className="muted">UI/UX Intern</span><br /><b>#{last.uiPos}</b> <span className="muted">of {last.total} · score {last.result.uiux.score}</span></div>
                </div>
                <div className="muted">{last.result.classification.reason}</div>
                {last.profile.issues.filter((i) => i.level !== 'info').map((i, k) => <div key={k} className="missing">⚠ {i.message}</div>)}
              </>
            )}
          </div>
        )}

        {uploads.length > 0 && (
          <ul className="uplist" style={{ listStyle: 'none', padding: 0 }}>
            <li style={{ fontWeight: 600 }}><span>Your uploads (kept in this browser)</span></li>
            {uploads.map((u) => (
              <li key={u.id}>
                <button className="btn ghost small" onClick={() => onOpen(u.id, 'lca')}>{u.fileName || u.id}</button>
                <button className="btn small" onClick={() => onRemove(u.id)}>Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
