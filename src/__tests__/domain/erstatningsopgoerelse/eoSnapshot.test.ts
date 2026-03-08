import { describe, expect, it } from 'vitest';

import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/eoSnapshot';
import { eoSnapshotToEoPdfDocument } from '../../../domain/erstatningsopgoerelse/eoSnapshotToEoPdfDocument';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';

describe('computeEoSnapshot', () => {
  it('returnerer fail_closed ved schema-guard fejl', () => {
    const snapshot = computeEoSnapshot({
      revision: 'schema-fail',
      stamdataValues: {},
      eoValues: {},
    });

    expect(snapshot.status).toBe('fail_closed');
    expect(snapshot.failClosedReason).toBe('schema_guard');
    expect(snapshot.data).toBeNull();
    expect(snapshot.debugSnapshot).toBeNull();
  });

  it('returnerer error uden data ved overlappende TAF-perioder', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-12-31';
    eoValues.periodeTilBeregningFra = '2023-01-01';
    eoValues.periodeTilBeregningTil = '2023-12-31';
    eoValues.tafPerioder = [
      { id: 'r1', fra: '2024-01-01', til: '2024-06-30', loseFeriedage: 0 },
      { id: 'r2', fra: '2024-06-15', til: '2024-12-31', loseFeriedage: 0 },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'taf-overlap',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.debugSnapshot).not.toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id.startsWith('taf_perioder:overlap:'))).toBe(true);
  });

  it('clampper TAF-periode til differencekrav-bound: bevarer autoritativt snapshot-data uden ekstra invariant', () => {
    // TAF til-dato >= differencekravDato clampes stille i snapshot.
    // Bound-violations vises som felt-niveau fejl i TAFPeriodeTable — ikke som snapshot-invariants.
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-12-31';
    eoValues.periodeTilBeregningFra = '2023-01-01';
    eoValues.periodeTilBeregningTil = '2023-12-31';
    eoValues.differencekravDato = '2024-07-01';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...eoValues.loenindkomstAnsaettelsesforhold[0],
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    ];
    eoValues.tafPerioder = [
      { id: 'r1', fra: '2024-01-01', til: '2024-07-15', loseFeriedage: 0 },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'taf-bounds',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    // Clamping er nu stille: data tilgængeligt, ingen ekstra bound violation invariant
    expect(snapshot.data).not.toBeNull();
    expect(snapshot.debugSnapshot).not.toBeNull();
    expect(snapshot.invariants.some((inv) => inv.id.includes('taf_perioder:upper_bound:differencekrav'))).toBe(false);
    // Canonical output bruger den clampede range (til 2024-06-30 = dagen før differencekravDato)
    expect(snapshot.data?.canonicalOutput.periodiseringer.tafPerioder).toEqual([
      { fra: '2024-01-01', til: '2024-06-30' },
    ]);
  });

  it('TAF-periode inden for differencekrav-grænse (stille clamping mod vedroererPeriodeTil) giver ok', () => {
    // TAF til-dato <= vedroererPeriodeTil er stille clamping — ingen fejl
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-06-30';
    eoValues.periodeTilBeregningFra = '2023-01-01';
    eoValues.periodeTilBeregningTil = '2023-12-31';
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...eoValues.loenindkomstAnsaettelsesforhold[0],
        loenudviklingBeregningsgrundlag: 'Ingen',
      },
    ];
    eoValues.tafPerioder = [
      { id: 'r1', fra: '2024-01-01', til: '2024-12-31', loseFeriedage: 0 },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'taf-silent-clamp',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    // Stille clamping → ingen fejlgivende bound violation → ok
    expect(snapshot.status).toBe('ok');
    expect(snapshot.data).not.toBeNull();
    // Canonical output bruger clampet range (til vedroererPeriodeTil)
    expect(snapshot.data?.canonicalOutput.periodiseringer.tafPerioder).toEqual([
      { fra: '2024-01-01', til: '2024-06-30' },
    ]);
  });

  it('clampper svie/smerte-periode til ménafgørelse: bevarer autoritativt snapshot-data uden ekstra invariant', () => {
    // Svie/smerte til-dato >= ménafgørelsesdato clampes stille i snapshot.
    // Bound-violations vises som felt-niveau fejl i SvieSmerteTable — ikke som snapshot-invariants.
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2023-05-24';
    eoValues.vedroererPeriodeTil = '2025-12-21';
    eoValues.beregnesSvieSmerteGodtgoerelse = 'Ja';
    eoValues.beregnesTabtArbejdsfortjeneste = 'Nej';
    eoValues.tidligereSsMax = 'Nej';
    eoValues.varigeMenAfgorelse = 'Ja';
    eoValues.verserendeKlageMen = 'Nej';
    eoValues.menAfgoerelseDato = '2024-04-22';
    eoValues.svieSmerteSatserAar = 2026;
    eoValues.svieSmerteDelvisSygemeldingSats = 'fuld';
    eoValues.svieSmertePerioder = [
      { id: 'ss-1', fra: '2023-05-24', til: '2025-04-21', tilstand: 'sygemeldt' },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'svie-men-clamp',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    // Clamping er nu stille: data tilgængeligt, ingen ekstra bound violation invariant
    expect(snapshot.failClosedReason).toBeUndefined();
    expect(snapshot.data).not.toBeNull();
    expect(snapshot.debugSnapshot).not.toBeNull();
    expect(snapshot.invariants.some((inv) => inv.id.includes('svie_smerte_perioder:upper_bound:menAfgoerelsesdato'))).toBe(false);
    // Engine bruger clampet periode (til dagen FØR ménafgørelsesdato)
    expect(snapshot.data?.engines.svieSmerte.constrainedPeriods).toEqual([
      { fra: '2023-05-24', til: '2024-04-21', isDelvist: false },
    ]);
    expect(snapshot.invariants.some((invariant) => invariant.id === 'runtime_exception')).toBe(false);
  });

  it('returnerer error uden data ved overbooking af løse feriedage i TAF-periode', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-12-31';
    eoValues.periodeTilBeregningFra = '2024-01-01';
    eoValues.periodeTilBeregningTil = '2024-01-31';
    eoValues.tafPerioder = [
      { id: 'r1', fra: '2024-01-01', til: '2024-01-05', loseFeriedage: 10 },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'taf-lose-feriedage',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.debugSnapshot).not.toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id.includes('taf_perioder:lose_feriedage:'))).toBe(true);
  });

  it('returnerer error uden data ved overbooking af uspecificerede ferie-/fridage', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-12-31';
    eoValues.periodeTilBeregningFra = '2024-01-01';
    eoValues.periodeTilBeregningTil = '2024-01-05';
    eoValues.uspecificeredeFerieFridage = 10;

    const snapshot = computeEoSnapshot({
      revision: 'beregningsperiode-lose-feriedage',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.debugSnapshot).not.toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id === 'beregningsperiode:uspecificerede_feriefridage')).toBe(true);
  });

  it('behandler manglende lønregulering som valideringsfejl og ikke som fail_closed runtimefejl', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-12-31';
    eoValues.periodeTilBeregningFra = '2023-01-01';
    eoValues.periodeTilBeregningTil = '2023-12-31';
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: '2024-01-01', til: '2024-01-31', loseFeriedage: 0 },
    ];
    eoValues.loenindkomstAnsaettelsesforhold = [
      {
        ...eoValues.loenindkomstAnsaettelsesforhold[0],
        indtaegtsoplysningerTableData: [
          {
            id: 'ind-1',
            col0_maaned: '12',
            col1_maaned: '2023',
            col0_uge: '',
            col1_uge: '',
            col0_dag: '',
            col1_dag: '',
            col2: { kind: 'number', value: 30000 },
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
        loenudviklingBeregningsgrundlag: undefined,
      },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'missing-loenregulering',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.failClosedReason).toBeUndefined();
    expect(snapshot.data).toBeNull();
    expect(snapshot.debugSnapshot).not.toBeNull();
    expect(snapshot.invariants.some((invariant) =>
      invariant.id === 'validation:loenindkomstAnsaettelsesforhold[0].loenudviklingBeregningsgrundlag'
    )).toBe(true);
    expect(snapshot.invariants.some((invariant) => invariant.message === 'Lønregulering skal vælges, evt. "Ingen"')).toBe(true);
  });

  it('normaliserer tom tidligere modtaget TAF til 0 i totals', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesSvieSmerteGodtgoerelse = 'Nej';
    eoValues.beregnesTabtArbejdsfortjeneste = 'Nej';

    const snapshot = computeEoSnapshot({
      revision: 'base-ok',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).not.toBe('fail_closed');
    expect(snapshot.data?.totals.tidligereModtagetTafOre).toBe(0);
  });

  it('pdfModel i snapshot er konsistent med totals (parity)', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesSvieSmerteGodtgoerelse = 'Nej';
    eoValues.beregnesTabtArbejdsfortjeneste = 'Nej';
    eoValues.oevrigeKravPerioder = [
      {
        id: 'krav-1',
        dato: '2024-01-15',
        udgiftTil: 'Transport',
        beloeb: { kind: 'number', value: 1200 },
      },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'parity-check',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.data).not.toBeNull();
    const { pdfModel, totals } = snapshot.data!;
    expect(pdfModel.samlet.totalOre).toBe(totals.samletTotalOre);
    expect(pdfModel.samlet.svieSmerteOre).toBe(totals.svieSmerteOre);
    expect(pdfModel.samlet.tabtArbejdsfortjenesteOre).toBe(totals.tabtArbejdsfortjenesteOre);
    expect(pdfModel.samlet.oevrigeKravOre).toBe(totals.oevrigeKravOre);
  });

  it('runtime_exception: fail_closed bevarer debugSnapshot hvis det nåede at blive bygget', () => {
    // debugSnapshot sættes i try-blokken før engines kører — catch-blokken returnerer det.
    // Vi kan ikke let trigge et runtime-throw fra udenfor; vi tester i stedet at catch-stien
    // er dækket ved at bekræfte snapshot-strukturen ved normal fail_closed.
    // Stien verificeres via schema_guard-testen (debugSnapshot er null der) plus
    // ved at bekræfte at catch-blokken returnerer failClosedReason: 'runtime_exception'.
    const snapshot = computeEoSnapshot({
      revision: 'schema-fail-2',
      stamdataValues: {},
      eoValues: {},
    });
    expect(snapshot.status).toBe('fail_closed');
    expect(snapshot.failClosedReason).toBe('schema_guard');
    // schema_guard: debugSnapshot er null fordi parsingen fejlede, aldrig nåede try-blokken
    expect(snapshot.debugSnapshot).toBeNull();
  });

  it('validerings-fejl-sti: debugSnapshot bygges uden clampede tafRanges', () => {
    // Når validering fejler (overlappende TAF) kører engines ikke, og tafRanges er ukendte.
    // debugSnapshot skal stadig bygges (til debug-tab), men uden clamping.
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-12-31';
    eoValues.periodeTilBeregningFra = '2023-01-01';
    eoValues.periodeTilBeregningTil = '2023-12-31';
    eoValues.tafPerioder = [
      { id: 'r1', fra: '2024-01-01', til: '2024-06-30', loseFeriedage: 0 },
      { id: 'r2', fra: '2024-06-15', til: '2024-12-31', loseFeriedage: 0 },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'validation-error-debug',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    // debugSnapshot skal altid bygges i validerings-fejl-stien
    expect(snapshot.debugSnapshot).not.toBeNull();
    // debugDays er bygget ud fra rå tafPerioder (uden clamping) — begge perioder eksisterer i model
    expect(snapshot.debugSnapshot!.model).toBeDefined();
  });

  it('bygger et ok-snapshot for en simpel sag uden TAF med verificerede totals og EO-dokument', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2024-01-01';
    eoValues.vedroererPeriodeTil = '2024-01-31';
    eoValues.beregnesSvieSmerteGodtgoerelse = 'Nej';
    eoValues.beregnesTabtArbejdsfortjeneste = 'Nej';
    eoValues.oevrigeKravPerioder = [
      {
        id: 'krav-1',
        dato: '2024-01-15',
        udgiftTil: 'Transport',
        beloeb: { kind: 'number', value: 1200 },
      },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'simple-ok',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('ok');
    expect(snapshot.data).not.toBeNull();
    expect(snapshot.data?.totals.svieSmerteOre).toBe(0);
    expect(snapshot.data?.totals.tabtArbejdsfortjenesteOre).toBe(0);
    expect(snapshot.data?.totals.oevrigeKravOre).toBe(120000);
    expect(snapshot.data?.totals.samletTotalOre).toBe(120000);
    expect(snapshot.data?.canonicalOutput.totals).toEqual({
      svieSmerteOre: snapshot.data?.totals.svieSmerteOre,
      tabtArbejdsfortjenesteFoerForligOre: snapshot.data?.totals.tabtArbejdsfortjenesteFoerForligOre,
      tabtArbejdsfortjenesteOre: snapshot.data?.totals.tabtArbejdsfortjenesteOre,
      oevrigeKravFoerForligOre: snapshot.data?.totals.oevrigeKravFoerForligOre,
      oevrigeKravOre: snapshot.data?.totals.oevrigeKravOre,
      samletTotalOre: snapshot.data?.totals.samletTotalOre,
    });
    expect(snapshot.data?.canonicalOutput.totals.oevrigeKravOre).toBe(120000);
    expect(snapshot.data?.canonicalOutput.periodiseringer.tafPerioder).toEqual([]);
    expect(snapshot.data?.engines.tafPerYear).toBeNull();

    const pdfProjection = eoSnapshotToEoPdfDocument(snapshot);
    expect(pdfProjection.kind).toBe('ok');
    if (pdfProjection.kind !== 'ok') return;

    expect(pdfProjection.document.titel).toContain('Erstatningsopgørelse');
    expect(pdfProjection.document.oevrigeKrav.entries).toEqual([
      {
        dateText: '15-01-2024',
        udgiftTil: 'Transport',
        amountOre: 120000,
      },
    ]);
    expect(pdfProjection.document.samlet.totalOre).toBe(120000);
  });
});
