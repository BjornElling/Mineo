import { buildRegulationDebugSections } from '../../../domain/debug/eoDebugRegulationViewModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);

describe('buildRegulationDebugSections', () => {
  it('bygger også beregnet reguleringstabel for ASL-årslønsmaksimum', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...eoValues.loenindkomstAnsaettelsesforhold[0],
        id: 'af-asl',
        navnPaaArbejdssted: 'ASL-sted',
        loenudviklingBeregningsgrundlag: 'Statistik',
        loenudviklingStatistikModel: 'ASL-årslønsmaksimum',
        feriePct: 15,
        fritvalgPct: 7,
        shSoPct: 0,
        pensionPct: 9,
      },
    ];
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      skadesdato: iso('2023-05-24'),
    };

    const sections = buildRegulationDebugSections({
      timeline: {
        tafBeregningsenhed: 'Måneder',
        ansaettelser: [
          {
            ansaettelsesforholdId: 'af-asl',
            navn: 'ASL-sted',
            kildeLabel: 'Statistikmodel',
            kildeVaerdi: 'ASL-årslønsmaksimum',
            referenceIso: iso('2023-05-24'),
            referenceLabel: 'Skadedato',
            referenceValue: 100,
            entries: [
              {
                effectiveFrom: iso('2023-05-24'),
                grundloen: 100,
                feriePct: 0.15,
                shSoPct: 0,
                fritvalgPct: 0.07,
                storeBededagPct: 0,
                pensionPct: 0.09,
                packageValue: 100,
                index: 100,
                arbejdsdage: null,
                maaneder: 0.26,
              },
            ],
          },
        ],
      },
      canonicalOutput: {
        totals: {
          svieSmerteOre: 0,
          tabtArbejdsfortjenesteFoerForligOre: 0,
          tabtArbejdsfortjenesteOre: 0,
          oevrigeKravFoerForligOre: 0,
          oevrigeKravOre: 0,
          samletTotalOre: 0,
        },
        svieSmerte: {
          maxApplied: false,
        },
        taf: {
          harTafPerioder: true,
          tafIndtaegterOre: 0,
          tidligereModtagetTafOre: 0,
        },
        periodiseringer: {
          tafPerioder: [],
        },
        regulering: {
          loenudviklingTotalFoerForligOre: 0,
          loenudviklingSegmenter: [],
          perAnsaettelse: [
            {
              ansaettelsesforholdId: 'af-asl',
              loenudviklingTotalFoerForligOre: 0,
              loenudviklingSegmenter: [
                {
                  kind: 'maaneder',
                  fra: iso('2023-07-01'),
                  til: iso('2023-12-31'),
                  maaneder: 6,
                  maanedsloenOre: 100_000,
                  deltaPct: 0,
                  amountOre: 100_000,
                },
                {
                  kind: 'maaneder',
                  fra: iso('2024-01-01'),
                  til: iso('2024-12-31'),
                  maaneder: 12,
                  maanedsloenOre: 110_000,
                  deltaPct: 10,
                  amountOre: 110_000,
                },
              ],
            },
          ],
        },
      },
      eoValues,
      stamdataValues,
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.tables).toHaveLength(2);
    expect(sections[0]?.tables?.[0]?.columns).toEqual([
      'Dato',
      'Månedsløn',
      'Feriepenge',
      'Fritvalg',
      'Pension',
    ]);
    expect(sections[0]?.tables?.[1]?.columns).toEqual(['Fra-dato', 'Til-dato', 'Indeksberegning', 'Indeks', 'Lønudvikling']);
    expect(sections[0]?.tables?.[1]?.rows.length).toBeGreaterThan(0);
  });

  it('falder tilbage til tidslinje/TAF-perioder når canonical per-ansættelse-segmenter mangler', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafPerioder = [
      {
        id: 'taf-1',
        fra: iso('2023-07-01'),
        til: iso('2025-12-21'),
        loseFeriedage: undefined,
      },
    ];
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...eoValues.loenindkomstAnsaettelsesforhold[0],
        id: 'af-asl-fallback',
        navnPaaArbejdssted: 'ASL fallback',
        loenudviklingBeregningsgrundlag: 'Statistik',
        loenudviklingStatistikModel: 'ASL-årslønsmaksimum',
        feriePct: 15,
        fritvalgPct: 7,
        shSoPct: 0,
        pensionPct: 9,
      },
    ];
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      skadesdato: iso('2023-05-24'),
    };

    const sections = buildRegulationDebugSections({
      timeline: {
        tafBeregningsenhed: 'Måneder',
        ansaettelser: [
          {
            ansaettelsesforholdId: 'af-asl-fallback',
            navn: 'ASL fallback',
            kildeLabel: 'Statistikmodel',
            kildeVaerdi: 'ASL-årslønsmaksimum',
            referenceIso: iso('2023-05-24'),
            referenceLabel: 'Skadedato',
            referenceValue: 100,
            entries: [
              {
                effectiveFrom: iso('2023-05-24'),
                grundloen: 588000,
                feriePct: 0.15,
                shSoPct: 0,
                fritvalgPct: 0.07,
                storeBededagPct: 0,
                pensionPct: 0.09,
                packageValue: 0,
                index: 100,
                arbejdsdage: null,
                maaneder: 7.26,
              },
              {
                effectiveFrom: iso('2024-01-01'),
                grundloen: 608000,
                feriePct: 0.15,
                shSoPct: 0,
                fritvalgPct: 0.07,
                storeBededagPct: 0,
                pensionPct: 0.09,
                packageValue: 0,
                index: 103.4,
                arbejdsdage: null,
                maaneder: 12,
              },
            ],
          },
        ],
      },
      canonicalOutput: undefined,
      eoValues,
      stamdataValues,
    });

    expect(sections).toHaveLength(1);
    expect(sections[0]?.tables).toHaveLength(2);
    expect(sections[0]?.tables?.[1]?.rows.length).toBeGreaterThan(0);
    expect(sections[0]?.tables?.[1]?.rows[0]?.cells[0]).toBe('01-07-2023');
  });

  it('udelader arbejdsdage-kolonnen og bruger Timeløn ved arbejdsdagsbaseret regulering', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      skadesdato: iso('2023-05-24'),
    };

    const sections = buildRegulationDebugSections({
      timeline: {
        tafBeregningsenhed: 'Arbejdsdage',
        ansaettelser: [
          {
            ansaettelsesforholdId: 'af-arbejdsdage',
            navn: 'Arbejdsdage A/S',
            kildeLabel: 'Overenskomst',
            kildeVaerdi: 'Eksempel',
            referenceIso: iso('2023-05-24'),
            referenceLabel: 'Skadedato',
            referenceValue: 100,
            entries: [
              {
                effectiveFrom: iso('2023-05-24'),
                grundloen: 24550,
                feriePct: 0.15,
                shSoPct: 0,
                fritvalgPct: 0.07,
                storeBededagPct: 0,
                pensionPct: 0.09,
                packageValue: 100,
                index: 100,
                arbejdsdage: 21,
                maaneder: null,
              },
            ],
          },
        ],
      },
      canonicalOutput: undefined,
      eoValues,
      stamdataValues,
    });

    expect(sections[0]?.tables?.[0]?.columns).toEqual([
      'Dato',
      'Timeløn',
      'Feriepenge',
      'Fritvalg',
      'Pension',
    ]);
  });
});
