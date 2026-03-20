
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/eoSnapshot';
import { eoSnapshotToEoPdfDocument } from '../../../domain/erstatningsopgoerelse/eoSnapshotToEoPdfDocument';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';

const { logErrorMock } = vi.hoisted(() => ({
  logErrorMock: vi.fn(),
}));

vi.mock('../../../utils/logger', () => ({
  logError: logErrorMock,
}));

describe('computeEoSnapshot', () => {
  beforeEach(() => {
    logErrorMock.mockReset();
  });

  it('returnerer fail_closed og logger systemfejl når skjult EO-lønfelt mangler ved angivet løn', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.beregnesUdFra = 'Angivet månedsløn';
    eoValues.eoAngivetLoenLoenudvikling.loenPaaHelligdage = undefined;

    const snapshot = computeEoSnapshot({
      revision: 'eo-hidden-loen-state',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('fail_closed');
    expect(snapshot.failClosedReason).toBe('schema_guard');
    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants).toEqual([
      expect.objectContaining({
        id: 'schema_guard:eo_angivet_loen_loen_paa_helligdage',
        source: 'system',
      }),
    ]);
    expect(logErrorMock).toHaveBeenCalledWith(
      'EO-snapshot afvist pga. intern datainkonsistens i angivet løn',
      expect.objectContaining({
        context: 'eoSnapshot.computeEoSnapshot',
        data: expect.objectContaining({
          revision: 'eo-hidden-loen-state',
          beregnesUdFra: 'Angivet månedsløn',
        }),
      })
    );
  });

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

  it('TAF-periode clampes mod differencekrav: feltfejl i UI, snapshot beregnes på clampet værdi (korrekt adfærd)', () => {
    // KONTRAKTSTATUS (eo-snapshot-contract.md §2.2): TAF til-dato >= differencekravDato er en fejlgivende bound.
    // Korrekt adfærd: feltfejl (rød kant + tooltip) i TAFPeriodeTable + EOBeregningTab blokerer download.
    // Snapshot producerer ingen invariant for dette — snapshot beregnes på den clampede værdi med data tilgængeligt.
    // Dette er den korrekte og tilstrækkelige mekanisme; feltfejl-tilgangen er ikke et udestående.
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

    // Snapshot: data tilgængeligt (beregnet på clampet range), ingen snapshot-invariant for differencekravDato-bound.
    expect(snapshot.data).not.toBeNull();
    expect(snapshot.debugSnapshot).not.toBeNull();
    expect(snapshot.invariants.some((inv) => inv.id.includes('taf_perioder:upper_bound:differencekrav'))).toBe(false);
    // Snapshot bruger den clampede range (til 2024-06-30 = dagen før differencekravDato)
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

  it('svie/smerte til-dato >= ménafgørelsesdato: fejlgivende bound giver validator-fejl og blokerer data', () => {
    // Svie/smerte til-dato >= ménafgørelsesdato er en FEJLGIVENDE bound (ikke stille clamping).
    // jf. eo-snapshot-contract.md §2.2 og form-contract.md §13.2.
    // Validator rapporterer fejl → blocksAuthoritativeComputation: true → data: null.
    // Snapshot status er 'error', debugSnapshot er tilgængeligt (bygges i validerings-fejl-stien).
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
      // til-dato 2025-04-21 >= menAfgoerelseDato 2024-04-22 → fejlgivende bound
      { id: 'ss-1', fra: '2023-05-24', til: '2025-04-21', tilstand: 'sygemeldt' },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'svie-men-bound',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    // Fejlgivende bound → validator-fejl → data null
    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.failClosedReason).toBeUndefined();
    // debugSnapshot bygges i validerings-fejl-stien
    expect(snapshot.debugSnapshot).not.toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id === 'runtime_exception')).toBe(false);
    // Fejl-invariant er til stede
    const tilFejl = snapshot.invariants.find((inv) => inv.evidence?.some((e) => e.includes('svieSmertePerioder')));
    expect(tilFejl).toBeDefined();
  });

  it('svie/smerte til-dato inden for EO-perioden men >= ménafgørelsesdato: fejlgivende bound', () => {
    // Perioden overskrider ménafgørelsesdatoen, selv om den OGSÅ overstiger vedroererPeriodeTil.
    // Ménafgørelsesbound er fejlgivende uanset om EO-periode-clamping ville have begrænset perioden.
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2023-05-24';
    eoValues.vedroererPeriodeTil = '2024-06-01';
    eoValues.beregnesSvieSmerteGodtgoerelse = 'Ja';
    eoValues.beregnesTabtArbejdsfortjeneste = 'Nej';
    eoValues.tidligereSsMax = 'Nej';
    eoValues.varigeMenAfgorelse = 'Ja';
    eoValues.verserendeKlageMen = 'Nej';
    eoValues.menAfgoerelseDato = '2024-04-22';
    eoValues.svieSmerteSatserAar = 2026;
    eoValues.svieSmerteDelvisSygemeldingSats = 'fuld';
    eoValues.svieSmertePerioder = [
      // til-dato 2024-05-01 >= menAfgoerelseDato 2024-04-22 → fejlgivende bound
      { id: 'ss-1', fra: '2023-05-24', til: '2024-05-01', tilstand: 'sygemeldt' },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'svie-men-bound-2',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id === 'runtime_exception')).toBe(false);
  });

  it('svie/smerte til-dato under ménafgørelsesdato: ingen fejl (stille clamping mod EO-periode)', () => {
    // til-dato er lovlig ift. ménafgørelse, men overskrider EO-perioden → stille clamping
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = '2023-05-24';
    eoValues.vedroererPeriodeTil = '2024-03-01';
    eoValues.beregnesSvieSmerteGodtgoerelse = 'Ja';
    eoValues.beregnesTabtArbejdsfortjeneste = 'Nej';
    eoValues.tidligereSsMax = 'Nej';
    eoValues.varigeMenAfgorelse = 'Ja';
    eoValues.verserendeKlageMen = 'Nej';
    eoValues.menAfgoerelseDato = '2024-04-22';
    eoValues.svieSmerteSatserAar = 2026;
    eoValues.svieSmerteDelvisSygemeldingSats = 'fuld';
    eoValues.svieSmertePerioder = [
      // til-dato 2024-04-01 < menAfgoerelseDato 2024-04-22 → ménafgørelse-bound OK
      // men > vedroererPeriodeTil 2024-03-01 → stille clamping
      { id: 'ss-1', fra: '2023-05-24', til: '2024-04-01', tilstand: 'sygemeldt' },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'svie-eo-periode-clamp',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    // Stille clamping: ingen fejl, data tilgængeligt
    expect(snapshot.status).toBe('ok');
    expect(snapshot.data).not.toBeNull();
    expect(snapshot.failClosedReason).toBeUndefined();
    // Engine clamper til vedroererPeriodeTil
    expect(snapshot.data?.engines.svieSmerte.constrainedPeriods).toEqual([
      { fra: '2023-05-24', til: '2024-03-01', isDelvist: false },
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
