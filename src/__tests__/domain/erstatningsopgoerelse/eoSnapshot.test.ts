
import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToEoDocument } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoDocument';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

const { reportSystemIssueMock } = vi.hoisted(() => ({
  reportSystemIssueMock: vi.fn(),
}));

vi.mock('../../../utils/systemIssueReporter', () => ({
  reportSystemIssue: reportSystemIssueMock,
}));

const createEmployment = (
  patch: Partial<ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number]> = {}
): ErstatningsopgoerelseValues['loenindkomstAnsaettelsesforhold'][number] => ({
  id: patch.id ?? 'af-1',
  navnPaaArbejdssted: patch.navnPaaArbejdssted,
  harOverenskomst: patch.harOverenskomst ?? true,
  overenskomstId: patch.overenskomstId,
  ansatPaaSkadestidspunktet: patch.ansatPaaSkadestidspunktet ?? true,
  ansaettelsesforholdOphoert: patch.ansaettelsesforholdOphoert ?? false,
  sidsteArbejdsdag: patch.sidsteArbejdsdag,
  feriePct: patch.feriePct,
  fritvalgPct: patch.fritvalgPct,
  shSoPct: patch.shSoPct,
  storeBededagPct: patch.storeBededagPct,
  pensionPct: patch.pensionPct,
  loenperiode: patch.loenperiode ?? 'maaned',
  tillaegAngivesSom: patch.tillaegAngivesSom ?? 'procent',
  fuldLoenUnderFerie: patch.fuldLoenUnderFerie ?? 'Nej',
  harAnciennitetstillaegEfterSkadedatoen: patch.harAnciennitetstillaegEfterSkadedatoen ?? false,
  anciennitetstillaegDato: patch.anciennitetstillaegDato,
  anciennitetstillaegSatsAngivesPer: patch.anciennitetstillaegSatsAngivesPer ?? 'Måned',
  anciennitetstillaegSats: patch.anciennitetstillaegSats,
  loenPaaHelligdage: patch.loenPaaHelligdage ?? 'Almindelig løn',
  saerligFraDatoRegulering: patch.saerligFraDatoRegulering,
  loenudviklingBeregningsgrundlag: patch.loenudviklingBeregningsgrundlag,
  loenudviklingStatistikModel: patch.loenudviklingStatistikModel,
  loenudviklingKRLSatstabel: patch.loenudviklingKRLSatstabel,
  loenudviklingManuelNavn: patch.loenudviklingManuelNavn ?? '',
  loenudviklingManuelTableData: patch.loenudviklingManuelTableData ?? [],
  offentligLoenType: patch.offentligLoenType ?? 'Månedsløn',
  offentligLoenTrin: patch.offentligLoenTrin,
  offentligLoenGruppe: patch.offentligLoenGruppe,
  offentligLoenEkstraGrundloen: patch.offentligLoenEkstraGrundloen,
  overenskomstFilter: patch.overenskomstFilter ?? {
    loenmodtager: undefined,
    arbejdsgiver: undefined,
  },
  indtaegtsoplysningerTableData: patch.indtaegtsoplysningerTableData ?? [],
  ...patch,
});

describe('computeEoSnapshot', () => {
  beforeEach(() => {
    reportSystemIssueMock.mockReset();
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
    expect(snapshot.failClosedReason).toBe('invariant_guard');
    expect(snapshot.data).toBeNull();
    expect(snapshot.invariants).toEqual([
      expect.objectContaining({
        id: 'invariant_guard:eo_angivet_loen_loen_paa_helligdage',
        source: 'system',
      }),
    ]);
    expect(reportSystemIssueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'eo_snapshot:hidden_angivet_loen_state_invalid',
        context: 'eoSnapshot.computeEoSnapshot',
        revision: 'eo-hidden-loen-state',
        diagnostics: expect.objectContaining({
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
    eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
    eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    eoValues.tafBeregningsperiodeFra = toISODateString('2023-01-01');
    eoValues.tafBeregningsperiodeTil = toISODateString('2023-12-31');
    eoValues.tafPerioder = [
      { id: 'r1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-06-30'), loseFeriedage: 0 },
      { id: 'r2', fra: toISODateString('2024-06-15'), til: toISODateString('2024-12-31'), loseFeriedage: 0 },
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
    eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
    eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    eoValues.tafBeregningsperiodeFra = toISODateString('2023-01-01');
    eoValues.tafBeregningsperiodeTil = toISODateString('2023-12-31');
    eoValues.differencekravDato = toISODateString('2024-07-01');
    eoValues.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        loenudviklingBeregningsgrundlag: 'Ingen',
      }),
    ];
    eoValues.tafPerioder = [
      { id: 'r1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-07-15'), loseFeriedage: 0 },
    ];
    // SFGG-beregningskilde vælges ('Ingen'), så en incidentel SFGG-"ikke valgt"-fejl ikke blokerer
    // download (SFGG-fejl er nu fail-closed/blokerende). Testen handler om TAF-clamping, ikke SFGG.
    eoValues.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: eoValues.loenindkomstAnsaettelsesforhold[0].id,
      sfggBeregningskilde: 'Ingen',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

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
      { fra: toISODateString('2024-01-01'), til: toISODateString('2024-06-30') },
    ]);
  });

  it('TAF-periode inden for differencekrav-grænse (stille clamping mod vedroererPeriodeTil) giver ok', () => {
    // TAF til-dato <= vedroererPeriodeTil er stille clamping — ingen fejl
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
    eoValues.vedroererPeriodeTil = toISODateString('2024-06-30');
    eoValues.tafBeregningsperiodeFra = toISODateString('2023-01-01');
    eoValues.tafBeregningsperiodeTil = toISODateString('2023-12-31');
    eoValues.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        loenudviklingBeregningsgrundlag: 'Ingen',
      }),
    ];
    eoValues.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: eoValues.loenindkomstAnsaettelsesforhold[0].id,
      sfggBeregningskilde: 'Ingen',
      sfggManuelDagssats: undefined,
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];
    eoValues.tafPerioder = [
      { id: 'r1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-12-31'), loseFeriedage: 0 },
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
      { fra: toISODateString('2024-01-01'), til: toISODateString('2024-06-30') },
    ]);
  });

  it('svie/smerte til-dato >= ménafgørelsesdato: fejlgivende bound giver validator-fejl og blokerer data', () => {
    // Svie/smerte til-dato >= ménafgørelsesdato er en FEJLGIVENDE bound (ikke stille clamping).
    // jf. eo-snapshot-contract.md §2.2 og form-contract.md §13.2.
    // Validator rapporterer fejl → blocksAuthoritativeComputation: true → data: null.
    // Snapshot status er 'error', debugSnapshot er tilgængeligt (bygges i validerings-fejl-stien).
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = toISODateString('2023-05-24');
    eoValues.vedroererPeriodeTil = toISODateString('2025-12-21');
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Ja';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Nej';
    eoValues.tidligereSsMax = 'Nej';
    eoValues.varigeMenAfgorelse = 'Ja';
    eoValues.verserendeKlageMen = 'Nej';
    eoValues.menAfgoerelseDato = toISODateString('2024-04-22');
    eoValues.svieSmerteSatserAar = 2026;
    eoValues.svieSmerteDelvisSygemeldingSats = 'fuld';
    eoValues.svieSmertePerioder = [
      // til-dato 2025-04-21 >= menAfgoerelseDato 2024-04-22 → fejlgivende bound
      { id: 'ss-1', fra: toISODateString('2023-05-24'), til: toISODateString('2025-04-21'), tilstand: 'sygemeldt' },
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
    eoValues.vedroererPeriodeFra = toISODateString('2023-05-24');
    eoValues.vedroererPeriodeTil = toISODateString('2024-06-01');
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Ja';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Nej';
    eoValues.tidligereSsMax = 'Nej';
    eoValues.varigeMenAfgorelse = 'Ja';
    eoValues.verserendeKlageMen = 'Nej';
    eoValues.menAfgoerelseDato = toISODateString('2024-04-22');
    eoValues.svieSmerteSatserAar = 2026;
    eoValues.svieSmerteDelvisSygemeldingSats = 'fuld';
    eoValues.svieSmertePerioder = [
      // til-dato 2024-05-01 >= menAfgoerelseDato 2024-04-22 → fejlgivende bound
      { id: 'ss-1', fra: toISODateString('2023-05-24'), til: toISODateString('2024-05-01'), tilstand: 'sygemeldt' },
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
    eoValues.vedroererPeriodeFra = toISODateString('2023-05-24');
    eoValues.vedroererPeriodeTil = toISODateString('2024-03-01');
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Ja';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Nej';
    eoValues.tidligereSsMax = 'Nej';
    eoValues.varigeMenAfgorelse = 'Ja';
    eoValues.verserendeKlageMen = 'Nej';
    eoValues.menAfgoerelseDato = toISODateString('2024-04-22');
    eoValues.svieSmerteSatserAar = 2026;
    eoValues.svieSmerteDelvisSygemeldingSats = 'fuld';
    eoValues.svieSmertePerioder = [
      // til-dato 2024-04-01 < menAfgoerelseDato 2024-04-22 → ménafgørelse-bound OK
      // men > vedroererPeriodeTil 2024-03-01 → stille clamping
      { id: 'ss-1', fra: toISODateString('2023-05-24'), til: toISODateString('2024-04-01'), tilstand: 'sygemeldt' },
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
      { fra: toISODateString('2023-05-24'), til: toISODateString('2024-03-01'), isDelvist: false },
    ]);
    expect(snapshot.invariants.some((invariant) => invariant.id === 'runtime_exception')).toBe(false);
  });

  it('returnerer error uden data ved overbooking af løse feriedage i TAF-periode', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
    eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    eoValues.tafBeregningsperiodeFra = toISODateString('2024-01-01');
    eoValues.tafBeregningsperiodeTil = toISODateString('2024-01-31');
    eoValues.tafPerioder = [
      { id: 'r1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-05'), loseFeriedage: 10 },
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
    eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
    eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    eoValues.tafBeregningsperiodeFra = toISODateString('2024-01-01');
    eoValues.tafBeregningsperiodeTil = toISODateString('2024-01-05');
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
    eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
    eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    eoValues.tafBeregningsperiodeFra = toISODateString('2023-01-01');
    eoValues.tafBeregningsperiodeTil = toISODateString('2023-12-31');
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-01-31'), loseFeriedage: 0 },
    ];
    eoValues.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        indtaegtsoplysningerTableData: [
          {
            id: 'ind-1',
            col0_maaned: '12',
            col1_maaned: '2023',
            col0_uge: '',
            col1_uge: '',
            col0_dag: undefined,
            col1_dag: undefined,
            col2: { kind: 'number', value: 30000 },
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
        loenudviklingBeregningsgrundlag: undefined,
      }),
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
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Nej';

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
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Nej';
    // Øvrige krav defaulter til 'Skjul' for nye sager; aktivér eksplicit her.
    eoValues.kravPaaOevrigeErstatningskrav = 'Ja';
    eoValues.oevrigeKravPerioder = [
      {
        id: 'krav-1',
        dato: toISODateString('2024-01-15'),
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

  it('schema_guard: fail_closed har debugSnapshot null (parsing nåede aldrig try-blokken)', () => {
    // Bekræfter fail_closed-strukturen for schema_guard-stien: parsingen fejler, try-blokken
    // (hvor debugSnapshot ellers bygges) nås aldrig, så debugSnapshot er null.
    // runtime_exception-stien (debugSnapshot bygges delvist, men nulstilles fail-closed) er
    // dækket i eoSnapshot.runtimeException.test.ts, hvor en engine tvinges til at kaste.
    const snapshot = computeEoSnapshot({
      revision: 'schema-fail-2',
      stamdataValues: {},
      eoValues: {},
    });
    expect(snapshot.status).toBe('fail_closed');
    expect(snapshot.failClosedReason).toBe('schema_guard');
    expect(snapshot.debugSnapshot).toBeNull();
  });

  it('validerings-fejl-sti: debugSnapshot bygges med clampede tafRanges for gyldige TAF-rækker', () => {
    // Når validering fejler, kører autoritative totaler ikke. Debug må dog stadig vise
    // clampede TAF-ranges for de rækker der kan parses sikkert.
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
    eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    eoValues.tafBeregningsperiodeFra = toISODateString('2023-01-01');
    eoValues.tafBeregningsperiodeTil = toISODateString('2023-12-31');
    eoValues.tafPerioder = [
      { id: 'r1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-06-30'), loseFeriedage: 0 },
      { id: 'r2', fra: toISODateString('2024-06-15'), til: toISODateString('2024-12-31'), loseFeriedage: 0 },
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
    expect(snapshot.debugSnapshot!.model).toBeDefined();
  });

  it('validerings-fejl-sti: urelateret svie/smerte-fejl undertrykker ikke TAF-sammentælling', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = toISODateString('2023-05-24');
    eoValues.vedroererPeriodeTil = toISODateString('2025-12-21');
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Ja';
    eoValues.beregnesUdFra = 'Beregningsperiode';
    eoValues.tafBeregningsperiodeFra = toISODateString('2023-01-01');
    eoValues.tafBeregningsperiodeTil = toISODateString('2023-12-31');
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-03-31'), loseFeriedage: 0 },
    ];
    eoValues.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        navnPaaArbejdssted: 'Testarbejde',
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [
          {
            id: 'ind-1',
            col0_maaned: '01',
            col1_maaned: '2024',
            col0_uge: '',
            col1_uge: '',
            col0_dag: undefined,
            col1_dag: undefined,
            col2: { kind: 'number', value: 30000 },
            col3: undefined,
            col4: undefined,
            col5: undefined,
          },
        ],
      }),
    ];
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Ja';
    eoValues.tidligereSsMax = 'Nej';
    eoValues.varigeMenAfgorelse = 'Ja';
    eoValues.verserendeKlageMen = 'Nej';
    eoValues.menAfgoerelseDato = toISODateString('2024-04-22');
    eoValues.svieSmerteSatserAar = 2025;
    eoValues.svieSmerteDelvisSygemeldingSats = 'fuld';
    eoValues.svieSmertePerioder = [
      { id: 'ss-1', fra: toISODateString('2023-05-24'), til: toISODateString('2025-04-21'), tilstand: 'sygemeldt' },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'validation-error-preserves-taf-debug',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.debugSnapshot).not.toBeNull();
    expect(snapshot.debugSnapshot!.sammentaelling.taf.beregnetValue).not.toBeNull();
    expect(snapshot.debugSnapshot!.sammentaelling.taf.tabelValue).not.toBeNull();
    expect(snapshot.debugSnapshot!.sammentaelling.tafIndtaegter).toHaveLength(1);
  });

  it('validerings-fejl-sti: urelateret TAF-fejl undertrykker ikke svie/smerte i debug-sammentælling', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = toISODateString('2024-01-26');
    eoValues.vedroererPeriodeTil = toISODateString('2025-11-02');
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Ja';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Ja';
    eoValues.tidligereSsMax = 'Nej';
    eoValues.svieSmerteHelbredsstatus = 'Raskmeldt';
    eoValues.svieSmerteSatserAar = 2025;
    eoValues.svieSmerteDelvisSygemeldingSats = 'fuld';
    eoValues.svieSmertePerioder = [
      { id: 'ss-1', fra: toISODateString('2024-01-26'), til: toISODateString('2024-10-20'), tilstand: 'sygemeldt' },
      { id: 'ss-2', fra: toISODateString('2025-08-12'), til: toISODateString('2025-09-22'), tilstand: 'sygemeldt' },
      { id: 'ss-3', fra: toISODateString('2025-09-23'), til: toISODateString('2025-11-02'), tilstand: 'delvist-sygemeldt' },
    ];
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: toISODateString('2024-02-01'), til: toISODateString('2024-06-30'), loseFeriedage: 0 },
      { id: 'taf-2', fra: toISODateString('2024-06-15'), til: toISODateString('2024-08-01'), loseFeriedage: 0 },
    ];

    const snapshot = computeEoSnapshot({
      revision: 'validation-error-preserves-ss-debug',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.debugSnapshot).not.toBeNull();
    expect(snapshot.debugSnapshot!.sammentaelling.svieSmerteSygedage.beregnetValue).toBe(311);
    expect(snapshot.debugSnapshot!.sammentaelling.svieSmerteSygedage.tabelValue).toBe(311);
    expect(snapshot.debugSnapshot!.sammentaelling.svieSmerteDelvise.beregnetValue).toBe(41);
    expect(snapshot.debugSnapshot!.sammentaelling.svieSmerteDelvise.tabelValue).toBe(41);
  });

  it('SFGG-valideringsfejl blokerer autoritativ snapshot-data som andre obligatoriske felter', () => {
    // SFGG-inputfejl behandles fail-closed på linje med øvrige validator-fejl (severity 'error'):
    // blocksAuthoritativeComputation: true → data: null, og download af EO/TAF-PDF blokeres.
    // debugSnapshot er fortsat tilgængeligt (bygges i validerings-fejl-stien).
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
    eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
    eoValues.tafBeregningsperiodeFra = toISODateString('2023-01-01');
    eoValues.tafBeregningsperiodeTil = toISODateString('2023-12-31');
    eoValues.tafPerioder = [
      { id: 'taf-1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-06-30'), loseFeriedage: 0 },
    ];
    eoValues.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        loenudviklingBeregningsgrundlag: 'Ingen',
      }),
    ];
    eoValues.sfggAnsaettelsesforhold = [];

    const snapshot = computeEoSnapshot({
      revision: 'sfgg-blocking-validation',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    });

    expect(snapshot.status).toBe('error');
    expect(snapshot.data).toBeNull();
    expect(snapshot.debugSnapshot).not.toBeNull();
    const sfggInvariant = snapshot.invariants.find((invariant) => invariant.message === 'Beregningsgrundlag for SFGG ikke valgt');
    expect(sfggInvariant).toEqual(expect.objectContaining({
      source: 'validation',
      blocksAuthoritativeComputation: true,
      blocksOutputs: ['beregning', 'debug', 'eo_pdf', 'taf_per_year_pdf', 'taf_per_year_opreguleret_pdf'],
    }));
  });

  it('tre-tilstands-valg: Nej og Skjul giver identiske beregnede totaler (kun præsentation adskiller)', () => {
    // Verificerer eo-snapshot-kontraktens beregningsadfærd: 'Nej' og 'Skjul' beregner begge INTET.
    // Forskellen er rent præsentationsmæssig (Skjul udelader emnet fra PDF). Samme rækker er til stede
    // i begge varianter; kun det tre-tilstands felt skifter mellem Nej og Skjul.
    const buildValues = (valg: 'Nej' | 'Skjul') => {
      const eoValues = createErstatningsopgoerelseInitialValues();
      eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
      eoValues.vedroererPeriodeTil = toISODateString('2024-01-31');
      eoValues.kravPaaSvieSmerteGodtgoerelse = valg;
      eoValues.kravPaaTabtArbejdsfortjeneste = valg;
      eoValues.kravPaaOevrigeErstatningskrav = valg;
      eoValues.oevrigeKravPerioder = [
        {
          id: 'krav-1',
          dato: toISODateString('2024-01-15'),
          udgiftTil: 'Transport',
          beloeb: { kind: 'number', value: 1200 },
        },
      ];
      return eoValues;
    };

    const nejSnapshot = computeEoSnapshot({
      revision: 'tre-tilstand-nej',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues: buildValues('Nej'),
    });
    const skjulSnapshot = computeEoSnapshot({
      revision: 'tre-tilstand-skjul',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues: buildValues('Skjul'),
    });

    expect(nejSnapshot.status).toBe('ok');
    expect(skjulSnapshot.status).toBe('ok');
    // Beregnede totaler er identiske mellem Nej og Skjul — ingen beregningsforskel.
    expect(skjulSnapshot.data?.totals).toEqual(nejSnapshot.data?.totals);
    expect(skjulSnapshot.data?.canonicalOutput.totals).toEqual(nejSnapshot.data?.canonicalOutput.totals);
    // Begge ekskluderer øvrige-krav-rækken fra summen (kravPaa... ≠ 'Ja' ⇒ intet beregnes).
    expect(nejSnapshot.data?.totals.oevrigeKravOre).toBe(0);
    expect(nejSnapshot.data?.totals.samletTotalOre).toBe(0);
  });

  it('bygger et ok-snapshot for en simpel sag uden TAF med verificerede totals og EO-dokument', () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
    eoValues.vedroererPeriodeTil = toISODateString('2024-01-31');
    eoValues.kravPaaSvieSmerteGodtgoerelse = 'Nej';
    eoValues.kravPaaTabtArbejdsfortjeneste = 'Nej';
    // Øvrige krav defaulter til 'Skjul' for nye sager; aktivér eksplicit her.
    eoValues.kravPaaOevrigeErstatningskrav = 'Ja';
    eoValues.oevrigeKravPerioder = [
      {
        id: 'krav-1',
        dato: toISODateString('2024-01-15'),
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

    const pdfProjection = eoSnapshotToEoDocument(snapshot);
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

  it('eksponerer sfggSixMonthWarningEmploymentIds når SFGG løber >6 mdr. efter sidste indkomst', () => {
    // Sidste indkomst er januar 2024. TAF-perioden (og dermed SFGG-segmenterne) løber i august 2024,
    // dvs. mere end 6 måneder efter sidste indkomst → ansættelsesforholdet skal markeres.
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.tafBeregningsperiodeFra = toISODateString('2024-01-01');
    eoValues.tafBeregningsperiodeTil = toISODateString('2024-01-31');
    eoValues.loenindkomstAnsaettelsesforhold = [
      createEmployment({
        loenudviklingBeregningsgrundlag: 'Ingen',
        indtaegtsoplysningerTableData: [{
          id: 'loen-jan-2024',
          col0_maaned: '1',
          col1_maaned: '2024',
          col0_uge: '',
          col1_uge: '',
          col0_dag: undefined,
          col1_dag: undefined,
          col2: { kind: 'number', value: 10000 },
          col3: undefined,
          col4: undefined,
          col5: undefined,
        }],
      }),
    ];
    eoValues.tafPerioder = [
      { id: 'r1', fra: toISODateString('2024-08-01'), til: toISODateString('2024-08-31'), loseFeriedage: 0 },
    ];
    eoValues.sfggAnsaettelsesforhold = [{
      ansaettelsesforholdId: eoValues.loenindkomstAnsaettelsesforhold[0].id,
      sfggBeregningskilde: 'Manuelt angivet',
      sfggManuelDagssats: { kind: 'number', value: 100 },
      sfggManuelBeloebIHenholdTil: undefined,
      sfggManuelFoerstEfterSygeloen: 'Nej',
      sfggReferenceperiodeFra: undefined,
      sfggReferenceperiodeTil: undefined,
      sfggReferenceperiodeFravaersdageUdenLoen: 0,
      sfggSatsvalg: undefined,
      sfggAlleredeBetaltBeloeb: undefined,
    }];

    const snapshot = computeEoSnapshot({
      revision: 'sfgg-six-month-warning',
      stamdataValues: { ...STAMDATA_INITIAL_VALUES, skadedato: toISODateString('2024-01-01') },
      eoValues,
    });

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.data?.sfggSixMonthWarningEmploymentIds).toEqual([
      eoValues.loenindkomstAnsaettelsesforhold[0].id,
    ]);
  });
});
