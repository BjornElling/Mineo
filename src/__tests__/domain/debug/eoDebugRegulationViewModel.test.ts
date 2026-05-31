import { buildRegulationDebugSections } from '../../../domain/debug/eoDebugRegulationViewModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';

const iso = (value: string) => toISODateString(value);
const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

describe('buildRegulationDebugSections', () => {
  it('bygger også beregnet reguleringstabel for ASL-årslønsmaksimum', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeTil = iso('2023-05-24');
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
      skadedato: iso('2023-05-24'),
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
      'År',
      'Maksimum årsløn',
    ]);
    expect(sections[0]?.tables?.[1]?.columns).toEqual(['Fra-dato', 'Til-dato', 'Indeksberegning', 'Indeks', 'Lønudvikling']);
    expect(sections[0]?.tables?.[1]?.rows.length).toBeGreaterThan(0);
  });

  it('bygger reguleringstabeller fra canonical segmenter selv når timeline kun har placeholder uden entries', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.vedroererPeriodeFra = iso('2020-04-01');
    eoValues.vedroererPeriodeTil = iso('2026-02-26');
    eoValues.tafBeregningsperiodeTil = iso('2020-01-01');
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...eoValues.loenindkomstAnsaettelsesforhold[0],
        id: 'af-placeholder',
        navnPaaArbejdssted: 'Låsesmed',
        loenudviklingBeregningsgrundlag: 'Overenskomst',
        overenskomstId: 'laasesmedeoverenskomsten',
        loenPaaHelligdage: 'Almindelig løn',
      },
    ];
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      skadedato: iso('2020-01-01'),
    };

    const sections = buildRegulationDebugSections({
      timeline: {
        tafBeregningsenhed: 'Måneder',
        ansaettelser: [
          {
            ansaettelsesforholdId: 'af-placeholder',
            navn: 'Låsesmed',
            kildeLabel: 'Overenskomst',
            kildeVaerdi: 'Låsesmedeoverenskomsten',
            overenskomstId: 'laasesmedeoverenskomsten',
            referenceIso: iso('2020-01-01'),
            referenceLabel: 'Skadedato',
            referenceValue: 0,
            entries: [],
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
              til: iso('2026-02-26'),
              loseFeriedage: undefined,
            },
          ],
        },
        regulering: {
          loenudviklingTotalFoerForligOre: 0,
          loenudviklingSegmenter: [],
          perAnsaettelse: [
            {
              ansaettelsesforholdId: 'af-placeholder',
              loenudviklingTotalFoerForligOre: 0,
              loenudviklingSegmenter: [
                {
                  kind: 'maaneder',
                  fra: iso('2024-03-01'),
                  til: iso('2024-12-31'),
                  maaneder: 10,
                  maanedsloenOre: 100000,
                  deltaPct: 0,
                  amountOre: 100000,
                },
                {
                  kind: 'maaneder',
                  fra: iso('2025-01-01'),
                  til: iso('2026-02-26'),
                  maaneder: 14,
                  maanedsloenOre: 110000,
                  deltaPct: 10,
                  amountOre: 110000,
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
    expect(sections[0]?.tables?.[0]?.rows.length).toBeGreaterThan(0);
    expect(sections[0]?.tables?.[0]?.rows[0]?.cells).toEqual(['01-01-2020', '-', '-', '-', '0 %', '-']);
    expect(sections[0]?.tables?.[1]?.rows.length).toBeGreaterThan(0);
  });

  it('viser label uden parentes når referenceLabel ikke findes', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      skadedato: iso('2024-01-01'),
    };

    const sections = buildRegulationDebugSections({
      timeline: {
        tafBeregningsenhed: 'Måneder',
        ansaettelser: [
          {
            ansaettelsesforholdId: 'af-1',
            navn: 'Test',
            kildeLabel: 'Statistikmodel',
            kildeVaerdi: 'ASL-årslønsmaksimum',
            referenceIso: iso('2024-03-15'),
            referenceLabel: undefined,
            referenceValue: 100,
            entries: [
              {
                effectiveFrom: iso('2024-03-15'),
                grundloen: 100,
                feriePct: 0.15,
                shSoPct: 0,
                fritvalgPct: 0.07,
                storeBededagPct: 0,
                pensionPct: 0.09,
                packageValue: 100,
                index: 100,
                arbejdsdage: null,
                maaneder: 1,
              },
            ],
          },
        ],
      },
      canonicalOutput: undefined,
      eoValues,
      stamdataValues,
    });

    expect(sections[0]?.rows[1]?.label).toBe('Anvendt reguleringsdato');
  });

  it('falder tilbage til tidslinje/TAF-perioder når canonical per-ansættelse-segmenter mangler', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeTil = iso('2023-05-24');
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
      skadedato: iso('2023-05-24'),
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
      skadedato: iso('2023-05-24'),
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
    eoValues.tafBeregningsperiodeTil = iso('2020-01-01');
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
            feriepenge: undefined,
            shSoSats: undefined,
            fritvalg: undefined,
            agPension: undefined,
          },
          {
            dato: toISODateString('2020-04-01'),
            grundloen: asAmountValue(141.7798),
            feriepenge: undefined,
            shSoSats: undefined,
            fritvalg: undefined,
            agPension: undefined,
          },
          {
            dato: toISODateString('2020-10-01'),
            grundloen: asAmountValue(142.8511),
            feriepenge: undefined,
            shSoSats: undefined,
            fritvalg: undefined,
            agPension: undefined,
          },
          {
            dato: toISODateString('2021-04-01'),
            grundloen: asAmountValue(144.2796),
            feriepenge: undefined,
            shSoSats: undefined,
            fritvalg: undefined,
            agPension: undefined,
          },
          {
            dato: toISODateString('2021-10-01'),
            grundloen: asAmountValue(145.6933),
            feriepenge: undefined,
            shSoSats: undefined,
            fritvalg: undefined,
            agPension: undefined,
          },
          {
            dato: toISODateString('2022-04-01'),
            grundloen: asAmountValue(145.6933),
            feriepenge: undefined,
            shSoSats: undefined,
            fritvalg: undefined,
            agPension: undefined,
          },
        ],
      },
    ];
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      skadedato: iso('2020-01-01'),
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

  it('afgrænser første debug-tabel til den konkrete ansættelses segmentdækning', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeTil = iso('2024-01-26');
    eoValues.vedroererPeriodeFra = iso('2024-01-26');
    eoValues.vedroererPeriodeTil = iso('2025-05-31');
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...eoValues.loenindkomstAnsaettelsesforhold[0],
        id: 'af-bounds',
        navnPaaArbejdssted: 'Bounds',
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        feriePct: 16.95,
        loenudviklingManuelTableData: [
          {
            dato: '',
            grundloen: asAmountValue(115.2),
            feriepenge: undefined,
            shSoSats: 1.00,
            fritvalg: undefined,
            agPension: 8.15,
          },
          {
            dato: toISODateString('2024-03-01'),
            grundloen: asAmountValue(142.65),
            feriepenge: undefined,
            shSoSats: 8.80,
            fritvalg: undefined,
            agPension: 10.15,
          },
          {
            dato: toISODateString('2025-05-01'),
            grundloen: asAmountValue(146.4),
            feriepenge: undefined,
            shSoSats: 8.80,
            fritvalg: undefined,
            agPension: 11.15,
          },
        ],
      },
    ];
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      skadedato: iso('2024-01-26'),
    };

    const sections = buildRegulationDebugSections({
      timeline: {
        tafBeregningsenhed: 'Arbejdsdage',
        ansaettelser: [
          {
            ansaettelsesforholdId: 'af-bounds',
            navn: 'Bounds',
            kildeLabel: 'Manuelt angivet',
            kildeVaerdi: 'Manuelt angivet',
            referenceIso: iso('2024-01-26'),
            referenceLabel: 'Skadedato',
            referenceValue: 138.15,
            entries: [
              {
                effectiveFrom: iso('2024-01-26'),
                grundloen: 115.2,
                feriePct: 0.1695,
                shSoPct: 0.01,
                fritvalgPct: 0,
                storeBededagPct: 0,
                pensionPct: 0.0815,
                packageValue: 138.15,
                index: 100,
                arbejdsdage: 1,
                maaneder: null,
              },
              {
                effectiveFrom: iso('2024-03-01'),
                grundloen: 142.65,
                feriePct: 0.1695,
                shSoPct: 0.088,
                fritvalgPct: 0,
                storeBededagPct: 0.0045,
                pensionPct: 0.1015,
                packageValue: 177.32,
                index: 128.35,
                arbejdsdage: 0,
                maaneder: null,
              },
              {
                effectiveFrom: iso('2025-05-01'),
                grundloen: 146.4,
                feriePct: 0.1695,
                shSoPct: 0.088,
                fritvalgPct: 0,
                storeBededagPct: 0.0045,
                pensionPct: 0.1115,
                packageValue: 184.11,
                index: 133.26,
                arbejdsdage: 0,
                maaneder: null,
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
              fra: iso('2024-01-26'),
              til: iso('2025-05-31'),
              loseFeriedage: undefined,
            },
          ],
        },
        regulering: {
          loenudviklingTotalFoerForligOre: 0,
          loenudviklingSegmenter: [],
          perAnsaettelse: [
            {
              ansaettelsesforholdId: 'af-bounds',
              loenudviklingTotalFoerForligOre: 0,
              loenudviklingSegmenter: [
                {
                  kind: 'arbejdsdage',
                  fra: iso('2024-01-26'),
                  til: iso('2024-02-29'),
                  arbejdsdage: 1,
                  dagsloenOre: 0,
                  deltaPct: 28.35,
                  amountOre: 0,
                },
                {
                  kind: 'arbejdsdage',
                  fra: iso('2024-03-01'),
                  til: iso('2025-02-01'),
                  arbejdsdage: 1,
                  dagsloenOre: 0,
                  deltaPct: 34.46,
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

    const firstTableRows = sections[0]?.tables?.[0]?.rows ?? [];
    const firstColumnValues = firstTableRows.map((row) => typeof row.cells[0] === 'string' ? row.cells[0] : row.cells[0].displayValue);

    expect(firstColumnValues).toEqual(['26-01-2024', '01-03-2024']);
    expect(firstColumnValues).not.toContain('01-05-2025');
  });

  it('viser en særskilt række på manuel reguleringsdato i første debug-tabel selv når TAF starter senere', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeTil = iso('2024-01-26');
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...eoValues.loenindkomstAnsaettelsesforhold[0],
        id: 'af-manuel-regdato',
        navnPaaArbejdssted: 'Manuel reg.dato',
        loenudviklingBeregningsgrundlag: 'Manuelt angivet',
        feriePct: 16.95,
        saerligFraDatoRegulering: iso('2024-01-26'),
        loenudviklingManuelTableData: [
          {
            dato: '',
            grundloen: asAmountValue(138.15),
            feriepenge: undefined,
            shSoSats: 12.90,
            fritvalg: undefined,
            agPension: 10.15,
          },
          {
            dato: toISODateString('2024-03-01'),
            grundloen: asAmountValue(142.65),
            feriepenge: undefined,
            shSoSats: 14.70,
            fritvalg: undefined,
            agPension: 10.15,
          },
        ],
      },
    ];
    const stamdataValues = {
      ...STAMDATA_INITIAL_VALUES,
      skadedato: iso('2024-01-01'),
    };

    const sections = buildRegulationDebugSections({
      timeline: {
        tafBeregningsenhed: 'Arbejdsdage',
        ansaettelser: [
          {
            ansaettelsesforholdId: 'af-manuel-regdato',
            navn: 'Manuel reg.dato',
            kildeLabel: 'Manuelt angivet',
            kildeVaerdi: 'Manuelt angivet',
            referenceIso: iso('2024-01-26'),
            referenceLabel: 'Manuelt angivet',
            referenceValue: 0,
            entries: [
              {
                effectiveFrom: iso('2024-01-26'),
                grundloen: 138.15,
                feriePct: 0.1695,
                shSoPct: 0.129,
                fritvalgPct: 0,
                storeBededagPct: 0,
                pensionPct: 0.1015,
                packageValue: 0,
                index: 100,
                arbejdsdage: 0,
                maaneder: null,
              },
              {
                effectiveFrom: iso('2024-03-01'),
                grundloen: 142.65,
                feriePct: 0.1695,
                shSoPct: 0.147,
                fritvalgPct: 0,
                storeBededagPct: 0,
                pensionPct: 0.1015,
                packageValue: 0,
                index: 100,
                arbejdsdage: 0,
                maaneder: null,
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
              fra: iso('2024-02-01'),
              til: iso('2025-02-01'),
              loseFeriedage: undefined,
            },
          ],
        },
        regulering: {
          loenudviklingTotalFoerForligOre: 0,
          loenudviklingSegmenter: [],
          perAnsaettelse: [
            {
              ansaettelsesforholdId: 'af-manuel-regdato',
              loenudviklingTotalFoerForligOre: 0,
              loenudviklingSegmenter: [
                {
                  kind: 'arbejdsdage',
                  fra: iso('2024-02-01'),
                  til: iso('2024-02-29'),
                  arbejdsdage: 0,
                  dagsloenOre: 0,
                  deltaPct: 0,
                  amountOre: 0,
                },
                {
                  kind: 'arbejdsdage',
                  fra: iso('2024-03-01'),
                  til: iso('2025-02-01'),
                  arbejdsdage: 0,
                  dagsloenOre: 0,
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

    const firstTableRows = sections[0]?.tables?.[0]?.rows ?? [];
    const firstColumnValues = firstTableRows.map((row) => typeof row.cells[0] === 'string' ? row.cells[0] : row.cells[0].displayValue);

    expect(firstColumnValues).toEqual(['26-01-2024', '01-03-2024']);
  });
});
