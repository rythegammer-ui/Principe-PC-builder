import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Bench } from './components/Bench';
import { BuildSheet } from './components/BuildSheet';
import { Studio } from './components/Studio';
import type { Build, Status } from './types';
import { createBuild } from './lib/builds';
import { emptyBrief } from './lib/extract';
import { chicagoToday, money } from './lib/format';
import { buildsFromImport, loadPersisted, reducer, savePersisted } from './store';

function readRoute(): { view: 'bench' | 'studio'; openId: string | null } {
  const hash = window.location.hash;
  if (hash === '#studio') return { view: 'studio', openId: null };
  if (hash.startsWith('#b/')) return { view: 'bench', openId: decodeURIComponent(hash.slice(3)) };
  return { view: 'bench', openId: null };
}

export function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadPersisted);
  const [route, setRoute] = useState(readRoute);
  const [query, setQuery] = useState('');
  const [showDelivered, setShowDelivered] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const today = chicagoToday();

  useEffect(() => { savePersisted(state); }, [state]);
  useEffect(() => {
    const sync = () => setRoute(readRoute());
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);
  useEffect(() => {
    document.body.classList.toggle('sheet-open', Boolean(route.openId && state.builds.some((build) => build.id === route.openId)));
  }, [route.openId, state.builds]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const open = state.builds.find((build) => build.id === route.openId) ?? null;
  const searching = query.trim().length > 0;
  const visible = useMemo(
    () => state.builds.filter((build) => {
      if (!matches(build, query)) return false;
      if (build.status === 'delivered' && !showDelivered && !searching) return false;
      return true;
    }),
    [state.builds, query, showDelivered, searching],
  );
  const metrics = useMemo(() => summarize(state.builds), [state.builds]);
  const samplesLeft = state.builds.some((build) => build.sample);

  function navigate(hash: string) {
    if (window.location.hash === hash) setRoute(readRoute());
    else window.location.hash = hash;
  }

  async function copy(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      setToast(label);
    } catch {
      setToast('Select the text and copy it from there.');
    }
  }

  function addBuild(build: Build) {
    dispatch({ type: 'add', build });
    navigate(`#b/${build.id}`);
    setToast(`${build.ticket} is on the bench`);
  }

  function exportBench() {
    const blob = new Blob([JSON.stringify({ version: 1, builds: state.builds }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'principe-bench.json';
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="app">
      <header className="top">
        <a className="brand" href="#bench">
          <Mark />
          <span>
            <strong>Principe</strong>
            <em>Computers</em>
          </span>
        </a>
        <nav>
          <a href="#bench" aria-current={route.view === 'bench' && !open ? 'page' : undefined}>The bench</a>
          <a href="#studio" aria-current={route.view === 'studio' ? 'page' : undefined}>From a thread</a>
        </nav>
        <div className="top-tools">
          {route.view === 'bench' && (
            <label className="search">
              <span className="sr">Search builds</span>
              <input
                value={query}
                placeholder="Customer, game, or part"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
          )}
          <button type="button" className="ghost" onClick={exportBench}>Export</button>
          <button type="button" className="ghost" onClick={() => fileRef.current?.click()}>Import</button>
          <input
            ref={fileRef}
            className="sr"
            type="file"
            accept="application/json"
            onChange={async (event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (!file) return;
              try {
                const builds = buildsFromImport(JSON.parse(await file.text()));
                if (!builds) {
                  setToast('That file is not a bench export.');
                  return;
                }
                dispatch({ type: 'replace', builds });
                setToast(`Imported ${builds.length} builds`);
              } catch {
                setToast('That file is not a bench export.');
              }
            }}
          />
        </div>
      </header>

      {state.banner && samplesLeft && route.view === 'bench' && (
        <div className="banner">
          <p>Five example builds are on the bench so you can see how a week looks. Clear them when your own jobs are in.</p>
          <div className="row-actions">
            <button type="button" className="ghost" onClick={() => dispatch({ type: 'clear-samples' })}>Clear examples</button>
            <button type="button" className="ghost" onClick={() => dispatch({ type: 'dismiss-banner' })}>Keep them</button>
          </div>
        </div>
      )}

      <main>
        {route.view === 'bench' ? (
          <>
            <section className="metrics" aria-label="Bench summary">
              <Metric value={String(metrics.onBench)} label="On the bench" />
              <Metric value={String(metrics.partsOut)} label="Parts still out" />
              <Metric value={String(metrics.ready)} label="Ready to go" />
              <Metric value={money(metrics.pipeline)} label="Quoted, not delivered" />
              {metrics.overdue > 0 && <Metric value={String(metrics.overdue)} label="Overdue" tone="clay" />}
            </section>
            <div className="bench-tools">
              <button
                type="button"
                className="primary"
                onClick={() => navigate('#studio')}
              >
                New from a thread
              </button>
              <button
                type="button"
                className="ghost"
                onClick={() => addBuild(createBuild(state.builds, { conversation: '', brief: emptyBrief() }))}
              >
                Blank ticket
              </button>
              <label className="check">
                <input
                  type="checkbox"
                  checked={showDelivered}
                  onChange={(event) => setShowDelivered(event.target.checked)}
                />
                Show delivered
              </label>
            </div>
            {visible.length === 0 ? (
              <div className="empty">
                <h1>{query ? 'Nothing matches' : 'The bench is clear'}</h1>
                <p>Paste a customer thread and turn it into a build prompt, or start a blank ticket.</p>
              </div>
            ) : (
              <Bench
                builds={visible}
                today={today}
                showDelivered={showDelivered || visible.some((build) => build.status === 'delivered')}
                onOpen={(id) => navigate(`#b/${id}`)}
                onMove={(id, status: Status) => dispatch({ type: 'patch', id, patch: { status } })}
              />
            )}
          </>
        ) : (
          <Studio existing={state.builds} onCreate={addBuild} onCopy={copy} />
        )}
      </main>

      {open && (
        <BuildSheet
          build={open}
          today={today}
          onClose={() => navigate('#bench')}
          onPatch={(patch) => dispatch({ type: 'patch', id: open.id, patch })}
          onRemove={() => {
            dispatch({ type: 'remove', id: open.id });
            navigate('#bench');
            setToast(`${open.ticket} deleted`);
          }}
          onCopy={copy}
        />
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

function Metric({ value, label, tone }: { value: string; label: string; tone?: 'clay' }) {
  return (
    <div className={tone ? `metric metric-${tone}` : 'metric'}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="1" y="1" width="30" height="30" rx="4" />
      <path d="M10 24V8h8.2c3.4 0 5.5 1.8 5.5 4.6 0 2-1.1 3.5-2.9 4.2L24.2 24h-3.4l-2.8-6.6H13.2V24H10zm3.2-9.1h4.4c1.6 0 2.6-.8 2.6-2.1s-1-2.1-2.6-2.1h-4.4v4.2z" />
    </svg>
  );
}

function matches(build: Build, query: string): boolean {
  const words = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const hay = [
    build.ticket,
    build.brief.customerName,
    build.brief.games,
    build.brief.software,
    build.brief.uses,
    build.brief.contact,
    build.notes,
    build.holdReason,
    build.parts.map((part) => `${part.category} ${part.name}`).join(' '),
  ].join(' ').toLowerCase();
  return words.every((word) => hay.includes(word));
}

function summarize(builds: Build[]) {
  const active = builds.filter((build) => build.status !== 'delivered');
  return {
    onBench: active.filter((build) => build.status === 'bench').length,
    partsOut: active.filter((build) => build.status === 'parts').length,
    ready: active.filter((build) => build.status === 'ready').length,
    pipeline: active.reduce((sum, build) => sum + (build.quotedTotal ?? 0), 0),
    overdue: active.filter((build) => build.dueDate && build.dueDate < chicagoToday()).length,
  };
}
