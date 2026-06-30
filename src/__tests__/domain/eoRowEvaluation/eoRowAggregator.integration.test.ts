import { collectAllEoRows } from '../../../domain/eoRowEvaluation/eoRowAggregator';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { toISODateString } from '../../../types/branded';

describe('collectAllEoRows integration', () => {
  it('materialises svie/smerte sats-aar warning with summary message', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.opgørelseLavetDen = toISODateString('2025-12-15');
    eoValues.svieSmerteSatserAar = 2025;
    eoValues.revideretOpgoerelse = 'Nej';

    const result = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      {},
      eoValues,
      {}
    );

    const row = result.warnings.find((entry) => entry.id === 'sviesmerte.satserAar');
    expect(row).toBeDefined();
    expect(row?.message).toBe('Svie/smerte-satsen for 2026 kan anvendes.');
    expect(row?.summaryDisplay).toBe('messageOnly');
  });

  it('materialises TAF warning when valid periods are fully clamped outside EO-perioden', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = toISODateString('2024-02-01');
    eoValues.vedroererPeriodeTil = toISODateString('2024-02-29');
    eoValues.tafBeregningsperiodeFra = toISODateString('2023-01-01');
    eoValues.tafBeregningsperiodeTil = toISODateString('2023-12-31');
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-31'), loseFeriedage: 0 },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'taf-clamped-away',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.data?.canonicalOutput.periodiseringer.tafPerioder).toEqual([]);
    const result = collectAllEoRows(
      STAMDATA_INITIAL_VALUES,
      {},
      eoValues,
      {},
      {},
      undefined,
      snapshot.data?.canonicalOutput
    );

    const row = result.warnings.find((entry) => entry.id === 'taf.perioder.clampedAway');
    expect(row).toBeDefined();
    expect(row?.message ?? row?.displayValue).toContain('TAF beregnes derfor til 0 kr.');
  });

  it('gater resultat-afhængig SFGG-dagssats-fejl KUN når pdfModel sendes med (G1: ingen fail-open)', () => {
    // Scenarie: direkte overenskomstsats kan ikke fastsættes i TAF-perioden. Fejlrækken
    // `sfgg.dagssats.*` produceres kun, når SFGG-resultatet (pdfModel) er tilgængeligt — snapshot
    // er IKKE fail_closed her, så det eneste der kan blokere download er række-evaluerings-gaten.
    // Uden pdfModel var gaten blind for fejlen (fail-open). Med pdfModel skal den blokere.
    const stamdataValues = {
      ...structuredClone(STAMDATA_INITIAL_VALUES),
      journalnr: undefined,
      skadestype: 'Arbejdsulykke' as const,
      skadedato: toISODateString('2010-01-01'),
    };
    const employment = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      navnPaaArbejdssted: 'Arbejdssted 1',
      harOverenskomst: true,
      overenskomstId: 'transportoverenskomsten-atl',
      feriePct: 12.5,
      loenudviklingBeregningsgrundlag: 'Overenskomst' as const,
    };
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.eoNummer = '2';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Ja';
    eoValues.beregnesUdFra = 'Angivet dagsløn';
    eoValues.dagsloenenUdgoer = { kind: 'number', value: 100 };
    eoValues.eoAngivetLoenLoenudvikling.loenudviklingBeregningsgrundlag = 'Ingen';
    eoValues.loenindkomstAnsaettelsesforhold = [employment];
    eoValues.vedroererPeriodeFra = toISODateString('2010-01-04');
    eoValues.vedroererPeriodeTil = toISODateString('2010-01-05');
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: toISODateString('2010-01-04'), til: toISODateString('2010-01-05'), loseFeriedage: undefined },
    ];
    eoValues.sfggAnsaettelsesforhold = [
      {
        ansaettelsesforholdId: employment.id,
        sfggManuelFoerstEfterSygeloen: 'Nej',
        sfggBeregningskilde: 'Overenskomst',
        sfggReferenceperiodeFra: undefined,
        sfggReferenceperiodeTil: undefined,
        sfggReferenceperiodeFravaersdageUdenLoen: 0,
        sfggSatsvalg: undefined,
        sfggAlleredeBetaltBeloeb: { kind: 'number', value: 0 },
      },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'sfgg-dagssats-not-calculable',
      stamdataValues,
      eoValues,
    });
    // Snapshot må ikke være fail_closed — ellers ville en anden gate-lag fange fejlen, og denne
    // test ville ikke bevise at række-gaten er load-bearing.
    expect(snapshot.data).not.toBeNull();
    const dagssatsRowId = `sfgg.dagssats.${employment.id}`;

    const withPdfModel = collectAllEoRows(
      stamdataValues,
      {},
      eoValues,
      {},
      {},
      undefined,
      snapshot.data?.canonicalOutput,
      snapshot.data?.pdfModel
    );
    const blockingRow = withPdfModel.errors.find((entry) => entry.id === dagssatsRowId);
    expect(blockingRow).toBeDefined();
    expect(blockingRow?.message).toBe(
      'Dagssats kunne ikke fastsættes for den valgte overenskomst i TAF-perioden'
    );

    // Non-vacuous: uden pdfModel er fejlen fraværende (det var den fail-open-tilstand G1 rettede).
    const withoutPdfModel = collectAllEoRows(
      stamdataValues,
      {},
      eoValues,
      {},
      {},
      undefined,
      snapshot.data?.canonicalOutput
    );
    expect(withoutPdfModel.errors.find((entry) => entry.id === dagssatsRowId)).toBeUndefined();
  });
});
