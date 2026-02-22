/**
 * Tests for Regulation View Model (Index)
 */

import { buildRegulationDebugSections } from '../../../domain/debug/eoDebugRegulationViewModel';
import type { RegulationIndexTimeline } from '../../../domain/debug/eoDebugRegulationTypes';

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
          referenceIso: '2024-01-01' as any,
          referenceValue: 100,
          entries: [
            {
              effectiveFrom: '2024-01-01' as any,
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
            },
          ],
        },
      ],
    };

    const sections = buildRegulationDebugSections(timeline);
    expect(sections.length).toBe(1);
    expect(sections[0]?.table?.rows.length).toBe(1);
  });
});
