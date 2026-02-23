/**
 * Tests for Loen View Model - Phase 5.3 (rettet)
 */

import { buildLoenDebugSections } from '../../../domain/debug/eoDebugLoenViewModel';
import type { LoenTimeline } from '../../../domain/debug/eoDebugLoenTypes';
import { toISODateString } from '../../../types/branded';

const iso = (s: string) => toISODateString(s);

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
          iso: iso('2024-01-01'),
          components: [
            { type: 'grundloen', amount: 1000, source: 'overenskomst' },
            { type: 'feriegodtgorelse', amount: 125, source: 'manuel' },
          ],
          dailyTotal: 1125,
        },
      ],
      svieSmerteDays: [
        { iso: iso('2024-01-02'), niveau: 'Fuld', amount: 230 },
      ],
    };

    const sections = buildLoenDebugSections(timeline);
    expect(sections.length).toBe(4);

    const loenDaily = sections.find((s) => s.id === 'loen.daily');
    const svieDaily = sections.find((s) => s.id === 'svieSmerte.daily');

    expect(loenDaily?.table.rows.length).toBe(1);
    expect(svieDaily?.table.rows.length).toBe(1);
  });

  it('kun loenDays → 2 sektioner (daily + summary), ingen svie/smerte-sektioner', () => {
    const timeline: LoenTimeline = {
      loenDays: [
        {
          iso: iso('2024-01-01'),
          components: [{ type: 'grundloen', amount: 500, source: 'overenskomst' }],
          dailyTotal: 500,
        },
      ],
      svieSmerteDays: [],
    };
    const sections = buildLoenDebugSections(timeline);
    expect(sections.length).toBe(2);
    expect(sections.map((s) => s.id)).toEqual(['loen.daily', 'loen.summary']);
  });

  it('kun svieSmerteDays → 2 sektioner (svie daily + summary), ingen loen-sektioner', () => {
    const timeline: LoenTimeline = {
      loenDays: [],
      svieSmerteDays: [{ iso: iso('2024-03-15'), niveau: 'Delvis', amount: 115 }],
    };
    const sections = buildLoenDebugSections(timeline);
    expect(sections.length).toBe(2);
    expect(sections.map((s) => s.id)).toEqual(['svieSmerte.daily', 'svieSmerte.summary']);
  });

  it('loen.daily tabel har korrekte kolonner (Dato + 6 komponenter + Daglig total)', () => {
    const timeline: LoenTimeline = {
      loenDays: [
        {
          iso: iso('2024-01-01'),
          components: [{ type: 'grundloen', amount: 300, source: 'overenskomst' }],
          dailyTotal: 300,
        },
      ],
      svieSmerteDays: [],
    };
    const sections = buildLoenDebugSections(timeline);
    const loenDaily = sections.find((s) => s.id === 'loen.daily')!;
    // Dato + 6 loenkomponenter + Daglig total = 8 kolonner
    expect(loenDaily.table.columns).toHaveLength(8);
    expect(loenDaily.table.columns[0]).toBe('Dato');
    expect(loenDaily.table.columns[loenDaily.table.columns.length - 1]).toBe('Daglig total');
  });

  it('manglende loenkomponent → "-" i den tilsvarende celle', () => {
    const timeline: LoenTimeline = {
      loenDays: [
        {
          iso: iso('2024-01-01'),
          components: [{ type: 'grundloen', amount: 500, source: 'overenskomst' }],
          dailyTotal: 500,
        },
      ],
      svieSmerteDays: [],
    };
    const sections = buildLoenDebugSections(timeline);
    const loenDaily = sections.find((s) => s.id === 'loen.daily')!;
    const row = loenDaily.table.rows[0];
    // cells[0] = dato, cells[1] = grundloen (CellValue), cells[2] = feriegodtgorelse (-)
    expect(row.cells[2]).toBe('-'); // feriegodtgorelse mangler
    expect(row.cells[3]).toBe('-'); // fritvalg mangler
  });

  it('loen.summary aggregerer komponenter korrekt over flere dage', () => {
    const timeline: LoenTimeline = {
      loenDays: [
        {
          iso: iso('2024-01-01'),
          components: [{ type: 'grundloen', amount: 400, source: 'overenskomst' }],
          dailyTotal: 400,
        },
        {
          iso: iso('2024-01-02'),
          components: [
            { type: 'grundloen', amount: 400, source: 'overenskomst' },
            { type: 'pension', amount: 50, source: 'regel' },
          ],
          dailyTotal: 450,
        },
      ],
      svieSmerteDays: [],
    };
    const sections = buildLoenDebugSections(timeline);
    const summary = sections.find((s) => s.id === 'loen.summary')!;
    // Kun grundloen (800) og pension (50) i summary (feriegodtgorelse=0 → udelades)
    expect(summary.table.rows.length).toBe(2);
    const grundloenRow = summary.table.rows.find((r) => r.id === 'loen.summary:grundloen')!;
    expect((grundloenRow.cells[1] as any).rawValue).toBe(800);
    const pensionRow = summary.table.rows.find((r) => r.id === 'loen.summary:pension')!;
    expect((pensionRow.cells[1] as any).rawValue).toBe(50);
  });

  it('svieSmerte.summary viser korrekt samlet beloeb', () => {
    const timeline: LoenTimeline = {
      loenDays: [],
      svieSmerteDays: [
        { iso: iso('2024-01-01'), niveau: 'Fuld', amount: 230 },
        { iso: iso('2024-01-02'), niveau: 'Delvis', amount: 115 },
      ],
    };
    const sections = buildLoenDebugSections(timeline);
    const summary = sections.find((s) => s.id === 'svieSmerte.summary')!;
    expect(summary.table.rows.length).toBe(1);
    expect((summary.table.rows[0].cells[1] as any).rawValue).toBe(345);
  });

  it('svieSmerte.daily har korrekte kolonner og niveau-felt', () => {
    const timeline: LoenTimeline = {
      loenDays: [],
      svieSmerteDays: [
        { iso: iso('2024-06-01'), niveau: 'Fuld', amount: 230 },
      ],
    };
    const sections = buildLoenDebugSections(timeline);
    const daily = sections.find((s) => s.id === 'svieSmerte.daily')!;
    expect(daily.table.columns).toEqual(['Dato', 'Niveau', 'Beloeb pr. dag']);
    const row = daily.table.rows[0];
    expect(row.cells[1]).toBe('Fuld');
  });

  it('sektionsrækkefølge er: loen.daily → loen.summary → svieSmerte.daily → svieSmerte.summary', () => {
    const timeline: LoenTimeline = {
      loenDays: [
        {
          iso: iso('2024-01-01'),
          components: [{ type: 'grundloen', amount: 100, source: 'overenskomst' }],
          dailyTotal: 100,
        },
      ],
      svieSmerteDays: [{ iso: iso('2024-01-01'), niveau: 'Fuld', amount: 230 }],
    };
    const sections = buildLoenDebugSections(timeline);
    expect(sections.map((s) => s.id)).toEqual([
      'loen.daily',
      'loen.summary',
      'svieSmerte.daily',
      'svieSmerte.summary',
    ]);
  });
});
