import { describe, expect, it } from 'vitest';
import { sampleBuilds } from '../data/samples';
import { nextTicket, normalizeBuild } from './builds';

describe('sample bench', () => {
  it('puts five distinct jobs on the bench', () => {
    const builds = sampleBuilds('2026-11-03');
    expect(builds.map((build) => build.ticket)).toEqual(['PC-104', 'PC-105', 'PC-106', 'PC-107', 'PC-108']);
    expect(new Set(builds.map((build) => build.status)).size).toBe(5);
    expect(builds.every((build) => build.prompt.includes('Do not invent a preference'))).toBe(true);
    expect(nextTicket(builds)).toBe('PC-109');
  });

  it('round-trips a build through import', () => {
    const [first] = sampleBuilds('2026-11-03');
    const restored = normalizeBuild(JSON.parse(JSON.stringify(first)));
    expect(restored?.ticket).toBe('PC-104');
    expect(restored?.brief.customerName).toBe(first.brief.customerName);
    expect(restored?.parts).toHaveLength(first.parts.length);
  });
});
