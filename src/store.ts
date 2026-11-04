import { sampleBuilds } from './data/samples';
import { normalizeBuild } from './lib/builds';
import { chicagoToday } from './lib/format';
import type { Build, Persisted } from './types';

const KEY = 'principe.bench.v1';

export type Action =
  | { type: 'add'; build: Build }
  | { type: 'patch'; id: string; patch: Partial<Build> }
  | { type: 'remove'; id: string }
  | { type: 'dismiss-banner' }
  | { type: 'clear-samples' }
  | { type: 'replace'; builds: Build[] };

export function reducer(state: Persisted, action: Action): Persisted {
  switch (action.type) {
    case 'add':
      return { ...state, builds: [action.build, ...state.builds] };
    case 'patch':
      return {
        ...state,
        builds: state.builds.map((build) => (
          build.id === action.id
            ? { ...build, ...action.patch, id: build.id, sample: false, updatedAt: new Date().toISOString() }
            : build
        )),
      };
    case 'remove':
      return { ...state, builds: state.builds.filter((build) => build.id !== action.id) };
    case 'dismiss-banner':
      return { ...state, banner: false };
    case 'clear-samples':
      return { ...state, banner: false, builds: state.builds.filter((build) => !build.sample) };
    case 'replace':
      return { ...state, banner: false, builds: action.builds };
    default:
      return state;
  }
}

export function loadPersisted(): Persisted {
  if (typeof localStorage === 'undefined') return fresh();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fresh();
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    if (!parsed || !Array.isArray(parsed.builds)) return fresh();
    return {
      version: 1,
      banner: Boolean(parsed.banner),
      builds: parsed.builds.map(normalizeBuild).filter((build): build is Build => build !== null),
    };
  } catch {
    return fresh();
  }
}

export function savePersisted(state: Persisted) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // The bench still works for this visit if storage is blocked.
  }
}

export function buildsFromImport(input: unknown): Build[] | null {
  const list = Array.isArray(input)
    ? input
    : input && typeof input === 'object' && Array.isArray((input as { builds?: unknown }).builds)
      ? (input as { builds: unknown[] }).builds
      : null;
  if (!list) return null;
  const builds = list.map(normalizeBuild).filter((build): build is Build => build !== null);
  return builds.length ? builds : null;
}

function fresh(): Persisted {
  return { version: 1, banner: true, builds: sampleBuilds(chicagoToday()) };
}
