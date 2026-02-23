/**
 * Tests for Regulation View Model (Index)
 */

import { buildRegulationDebugSections } from '../../../domain/debug/eoDebugRegulationViewModel';
import type { RegulationIndexTimeline, IndeksEntry } from '../../../domain/debug/eoDebugRegulationTypes';
import { toISODateString } from '../../../types/branded';

const iso = (s: string) => toISODateString(s);

const buildEntry = (overrides: Partial<IndeksEntry> = {}): IndeksEntry => ({
  effectiveFrom: iso('2024-01-01'),
  grundloen: 100,
  feriePct: 0.125,
  shSoPct: 0.07,
  fritvalgPct: 0,
  storeBededagPct: 0.0045,
  pensionPct: 0.1,
  packageValue: 120,
  index: 100,
  arbejdsdage: 250,
  maaneder: 12,
  ...overrides,
});

describe('buildRegulationDebugSections - Index model', () => {
  it('returnerer tomt array naar ingen ansaettelser', () => {
    const timeline: RegulationIndexTimeline = { ansaettelser: [] };
    const sections = buildRegulationDebugSections(timeline);
    expect(sections.length).toBe(0);
  });

  it('bygger sektion pr. ansaettelsesforhold', () => {
    const timeline: RegulationIndexTimeline = {
      ansaettelser: [
        {
          ansaettelsesforholdId: 'af-1',
          navn: 'Test',
          overenskomstId: 'bygge-anlaeg',
          referenceIso: iso('2024-01-01'),
          referenceValue: 100,
          entries: [buildEntry()],
        },
      ],
    };

    const sections = buildRegulationDebugSections(timeline);
    expect(sections.length).toBe(1);
    expect(sections[0]?.table?.rows.length).toBe(1);
  });

  it('to ansaettelsesforhold → to sektioner', () => {
    const timeline: RegulationIndexTimeline = {
      ansaettelser: [
        {
          ansaettelsesforholdId: 'af-1',
          navn: 'Første',
          overenskomstId: 'kl',
          referenceIso: iso('2024-01-01'),
          referenceValue: 200,
          entries: [buildEntry()],
        },
        {
          ansaettelsesforholdId: 'af-2',
          navn: 'Anden',
          overenskomstId: 'rltn',
          referenceIso: iso('2024-06-01'),
          referenceValue: 300,
          entries: [buildEntry({ effectiveFrom: iso('2024-06-01') })],
        },
      ],
    };
    const sections = buildRegulationDebugSections(timeline);
    expect(sections.length).toBe(2);
    expect(sections[0].id).toBe('regulation.af-1');
    expect(sections[1].id).toBe('regulation.af-2');
  });

  it('header inkluderer "Ansættelsesforhold 1 - navn"', () => {
    const timeline: RegulationIndexTimeline = {
      ansaettelser: [
        {
          ansaettelsesforholdId: 'af-1',
          navn: 'Kommunal',
          overenskomstId: 'kl',
          referenceIso: iso('2024-01-01'),
          referenceValue: 100,
          entries: [buildEntry()],
        },
      ],
    };
    const sections = buildRegulationDebugSections(timeline);
    expect(sections[0].header).toBe('Ansættelsesforhold 1 - Kommunal');
  });

  it('header uden navn (undefined) → ingen suffix', () => {
    const timeline: RegulationIndexTimeline = {
      ansaettelser: [
        {
          ansaettelsesforholdId: 'af-1',
          navn: undefined,
          overenskomstId: 'kl',
          referenceIso: iso('2024-01-01'),
          referenceValue: 100,
          entries: [buildEntry()],
        },
      ],
    };
    const sections = buildRegulationDebugSections(timeline);
    expect(sections[0].header).toBe('Ansættelsesforhold 1');
  });

  it('tabel har 11 kolonner (Dato, Arbejdsdag, Måneder, Grundløn, ...)', () => {
    const timeline: RegulationIndexTimeline = {
      ansaettelser: [
        {
          ansaettelsesforholdId: 'af-1',
          navn: undefined,
          overenskomstId: 'kl',
          referenceIso: iso('2024-01-01'),
          referenceValue: 100,
          entries: [buildEntry()],
        },
      ],
    };
    const sections = buildRegulationDebugSections(timeline);
    expect(sections[0].table?.columns).toHaveLength(11);
    expect(sections[0].table?.columns[0]).toBe('Dato');
    expect(sections[0].table?.columns[10]).toBe('Indeks');
  });

  it('table row-id inkluderer ansaettelsesforholdId og effectiveFrom', () => {
    const timeline: RegulationIndexTimeline = {
      ansaettelser: [
        {
          ansaettelsesforholdId: 'af-abc',
          navn: undefined,
          overenskomstId: 'kl',
          referenceIso: iso('2024-01-01'),
          referenceValue: 100,
          entries: [buildEntry({ effectiveFrom: iso('2024-03-01') })],
        },
      ],
    };
    const sections = buildRegulationDebugSections(timeline);
    expect(sections[0].table?.rows[0].id).toBe('regulation.table:af-abc:2024-03-01');
  });

  it('arbejdsdage=null → "-" i cellen', () => {
    const timeline: RegulationIndexTimeline = {
      ansaettelser: [
        {
          ansaettelsesforholdId: 'af-1',
          navn: undefined,
          overenskomstId: 'kl',
          referenceIso: iso('2024-01-01'),
          referenceValue: 100,
          entries: [buildEntry({ arbejdsdage: null })],
        },
      ],
    };
    const sections = buildRegulationDebugSections(timeline);
    const row = sections[0].table!.rows[0];
    // cells[1] = arbejdsdage
    expect((row.cells[1] as any).displayValue).toBe('-');
  });

  it('maaneder=null → "-" i cellen', () => {
    const timeline: RegulationIndexTimeline = {
      ansaettelser: [
        {
          ansaettelsesforholdId: 'af-1',
          navn: undefined,
          overenskomstId: 'kl',
          referenceIso: iso('2024-01-01'),
          referenceValue: 100,
          entries: [buildEntry({ maaneder: null })],
        },
      ],
    };
    const sections = buildRegulationDebugSections(timeline);
    const row = sections[0].table!.rows[0];
    // cells[2] = maaneder
    expect((row.cells[2] as any).displayValue).toBe('-');
  });

  it('sektionsrows indeholder 4 nøgle-informationsrækker', () => {
    const timeline: RegulationIndexTimeline = {
      ansaettelser: [
        {
          ansaettelsesforholdId: 'af-1',
          navn: 'Test',
          overenskomstId: 'kl',
          referenceIso: iso('2024-01-01'),
          referenceValue: 500,
          entries: [buildEntry()],
        },
      ],
    };
    const sections = buildRegulationDebugSections(timeline);
    const rows = sections[0].rows;
    expect(rows).toHaveLength(4);
    expect(rows.map((r) => r.label)).toEqual([
      'Overenskomst',
      'Skadesdato (basis)',
      'Basisværdi (indeks 100)',
      'Seneste indeks',
    ]);
    // Basisværdi er en CellValue med rawValue=500
    expect((rows[2].value as any).rawValue).toBe(500);
  });

  it('tom entries → seneste_indeks = "-"', () => {
    const timeline: RegulationIndexTimeline = {
      ansaettelser: [
        {
          ansaettelsesforholdId: 'af-1',
          navn: undefined,
          overenskomstId: 'kl',
          referenceIso: iso('2024-01-01'),
          referenceValue: 100,
          entries: [],
        },
      ],
    };
    const sections = buildRegulationDebugSections(timeline);
    const latestRow = sections[0].rows.find((r) => r.id.includes('seneste_indeks'))!;
    expect(latestRow.value).toBe('-');
  });
});
