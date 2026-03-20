import { buildRegulationDebugSections } from '../../../domain/debug/eoDebugRegulationViewModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

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

  it('sammenklapper uændrede reguleringsværdier og indeksperioder i debug-tabellerne', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafPerioder = [
      {
        id: 'taf-1',
        fra: iso('2020-04-01'),
        til: iso('2022-09-30'),
        loseFeriedage: undefined,
      },
    ];
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...eoValues.loenindkomstAnsaettelsesforhold[0],
        id: 'af-manuel',
        navnPaaArbejdssted: 'Manuel regulering',
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        loenudviklingManuelTableData: [
          {
            dato: '',
            grundloen: asAmountValue(141.2411),
            feriepenge: '',
            shSoSats: '',
            fritvalg: '',
            agPension: '',
          },
          {
            dato: '01-04-2020',
            grundloen: asAmountValue(141.7798),
            feriepenge: '',
            shSoSats: '',
            fritvalg: '',
            agPension: '',
          },
          {
            dato: '01-10-2020',
            grundloen: asAmountValue(142.8511),
            feriepenge: '',
            shSoSats: '',
            fritvalg: '',
            agPension: '',
          },
          {
            dato: '01-04-2021',
            grundloen: asAmountValue(144.2796),
            feriepenge: '',
            shSoSats: '',
            fritvalg: '',
            agPension: '',
          },
          {
            dato: '01-10-2021',
            grundloen: asAmountValue(145.6933),
            feriepenge: '',
            shSoSats: '',
            fritvalg: '',
            agPension: '',
          },
          {
            dato: '01-04-2022',
            grundloen: asAmountValue(145.6933),
            feriepenge: '',
            shSoSats: '',
            fritvalg: '',
            agPension: '',
          },
        ],
      },
    ];
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      skadesdato: iso('2020-01-01'),
    };

    const sections = buildRegulationDebugSections({
      timeline: {
        tafBeregningsenhed: 'Måneder',
        ansaettelser: [
          {
            ansaettelsesforholdId: 'af-manuel',
            navn: 'Manuel regulering',
            kildeLabel: 'Manuelt angivet',
            kildeVaerdi: 'Manuelt angivet',
            referenceIso: iso('2020-01-01'),
            referenceLabel: 'Skadedato',
            referenceValue: 141.2411,
            entries: [
              {
                effectiveFrom: iso('2020-01-01'),
                grundloen: 141.2411,
                feriePct: 0,
                shSoPct: 0,
                fritvalgPct: 0,
                storeBededagPct: 0,
                pensionPct: 0,
                packageValue: 141.2411,
                index: 100,
                arbejdsdage: null,
                maaneder: 0,
              },
              {
                effectiveFrom: iso('2020-04-01'),
                grundloen: 141.7798,
                feriePct: 0,
                shSoPct: 0,
                fritvalgPct: 0,
                storeBededagPct: 0,
                pensionPct: 0,
                packageValue: 141.7798,
                index: 100.38,
                arbejdsdage: null,
                maaneder: 0,
              },
              {
                effectiveFrom: iso('2020-10-01'),
                grundloen: 142.8511,
                feriePct: 0,
                shSoPct: 0,
                fritvalgPct: 0,
                storeBededagPct: 0,
                pensionPct: 0,
                packageValue: 142.8511,
                index: 101.14,
                arbejdsdage: null,
                maaneder: 0,
              },
              {
                effectiveFrom: iso('2021-04-01'),
                grundloen: 144.2796,
                feriePct: 0,
                shSoPct: 0,
                fritvalgPct: 0,
                storeBededagPct: 0,
                pensionPct: 0,
                packageValue: 144.2796,
                index: 102.15,
                arbejdsdage: null,
                maaneder: 0,
              },
              {
                effectiveFrom: iso('2021-10-01'),
                grundloen: 145.6933,
                feriePct: 0,
                shSoPct: 0,
                fritvalgPct: 0,
                storeBededagPct: 0,
                pensionPct: 0,
                packageValue: 145.6933,
                index: 103.15,
                arbejdsdage: null,
                maaneder: 0,
              },
              {
                effectiveFrom: iso('2022-04-01'),
                grundloen: 145.6933,
                feriePct: 0,
                shSoPct: 0,
                fritvalgPct: 0,
                storeBededagPct: 0,
                pensionPct: 0,
                packageValue: 145.6933,
                index: 103.15,
                arbejdsdage: null,
                maaneder: 0,
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
        svieSmerte: { maxApplied: false },
        taf: {
          harTafPerioder: true,
          tafIndtaegterOre: 0,
          tidligereModtagetTafOre: 0,
        },
        periodiseringer: {
          tafPerioder: [
            {
              id: 'taf-1',
              fra: iso('2020-04-01'),
              til: iso('2022-09-30'),
              loseFeriedage: undefined,
            },
          ],
        },
        regulering: {
          loenudviklingTotalFoerForligOre: 0,
          loenudviklingSegmenter: [],
          perAnsaettelse: [
            {
              ansaettelsesforholdId: 'af-manuel',
              loenudviklingTotalFoerForligOre: 0,
              loenudviklingSegmenter: [
                {
                  kind: 'maaneder',
                  fra: iso('2020-04-01'),
                  til: iso('2020-09-30'),
                  maaneder: 6,
                  maanedsloenOre: 0,
                  deltaPct: 0,
                  amountOre: 0,
                },
                {
                  kind: 'maaneder',
                  fra: iso('2020-10-01'),
                  til: iso('2021-03-31'),
                  maaneder: 6,
                  maanedsloenOre: 0,
                  deltaPct: 0,
                  amountOre: 0,
                },
                {
                  kind: 'maaneder',
                  fra: iso('2021-04-01'),
                  til: iso('2021-09-30'),
                  maaneder: 6,
                  maanedsloenOre: 0,
                  deltaPct: 0,
                  amountOre: 0,
                },
                {
                  kind: 'maaneder',
                  fra: iso('2021-10-01'),
                  til: iso('2022-03-31'),
                  maaneder: 6,
                  maanedsloenOre: 0,
                  deltaPct: 0,
                  amountOre: 0,
                },
                {
                  kind: 'maaneder',
                  fra: iso('2022-04-01'),
                  til: iso('2022-09-30'),
                  maaneder: 6,
                  maanedsloenOre: 0,
                  deltaPct: 0,
                  amountOre: 0,
                },
              ],
            },
          ],
        },
      },
      eoValues,
      stamdataValues,
    });

    expect(sections[0]?.tables?.[0]?.rows.map((row) => typeof row.cells[0] === 'string' ? row.cells[0] : row.cells[0].displayValue)).toEqual([
      '01-01-2020',
      '01-04-2020',
      '01-10-2020',
      '01-04-2021',
      '01-10-2021',
    ]);
    expect(sections[0]?.tables?.[1]?.rows.map((row) => [row.cells[0], row.cells[1]])).toEqual([
      ['01-04-2020', '30-09-2020'],
      ['01-10-2020', '31-03-2021'],
      ['01-04-2021', '30-09-2021'],
      ['01-10-2021', '30-09-2022'],
    ]);
  });
});
