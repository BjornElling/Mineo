/**
 * Tests for Loen View Model - Phase 5.3 (rettet)
 */

import { buildLoenDebugSections } from '../eoDebugLoenViewModel';
import type { LoenTimeline } from '../eoDebugLoenTypes';

describe('eoDebugLoenViewModel - Phase 5.3', () => {
  it('returnerer tomt array ved tom timeline', () => {
    const timeline: LoenTimeline = { loenDays: [], svieSmerteDays: [] };
    const sections = buildLoenDebugSections(timeline);
    expect(sections.length).toBe(0);
  });

  it('bygger sektioner for loen og svie/smerte', () => {
    const timeline: LoenTimeline = {
      loenDays: [
        {
          iso: '2024-01-01' as any,
          components: [
            { type: 'grundloen', amount: 1000, source: 'overenskomst' },
            { type: 'feriegodtgorelse', amount: 125, source: 'manuel' },
          ],
          dailyTotal: 1125,
        },
      ],
      svieSmerteDays: [
        { iso: '2024-01-02' as any, niveau: 'Fuld', amount: 230 },
      ],
    };

    const sections = buildLoenDebugSections(timeline);
    expect(sections.length).toBe(4);

    const loenDaily = sections.find((s) => s.id === 'loen.daily');
    const svieDaily = sections.find((s) => s.id === 'svieSmerte.daily');

    expect(loenDaily?.table.rows.length).toBe(1);
    expect(svieDaily?.table.rows.length).toBe(1);
  });
});
