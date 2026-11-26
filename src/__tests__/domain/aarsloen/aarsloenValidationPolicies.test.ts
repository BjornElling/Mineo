import type { StandardLoenTableRow } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import {
  beregnFejlmeddelelser,
  harTabelValideringsFejl,
  harTabelData,
  resolveAarsloenCanonicalRangeIssues,
  resolveAarsloenFeriedageOverskriderPeriodenIssue,
  harAarsloenIngenOmregningsdage,
} from '../../../domain/aarsloen/aarsloenValidationPolicies';
import type { AarsloenBeregningResultBeregnet } from '../../../types/calculation';
import { AARSLOEN_INITIAL_VALUES, createAarsloenInitialValues } from '../../../domain/aarsloen/aarsloenInitialValues';
import type { AarsloenValues } from '../../../schemas/formSchemas';

// ─── Helpers ──────────────────────────────────────────────────────────────

const emptyRow = (id: string): StandardLoenTableRow => ({
  id,
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: undefined,
  col1_dag: undefined,
  col2: undefined,
  col3: undefined,
  col4: undefined,
  col5: undefined,
});

const maanedRow = (id: string, month: string, year: string): StandardLoenTableRow => ({
  ...emptyRow(id),
  col0_maaned: month,
  col1_maaned: year,
});

const ugeRow = (id: string, fra: string, til: string): StandardLoenTableRow => ({
  ...emptyRow(id),
  col0_uge: fra,
  col1_uge: til,
});

const dagRow = (id: string, fra: string, til: string): StandardLoenTableRow => ({
  ...emptyRow(id),
  col0_dag: toISODateString(fra),
  col1_dag: toISODateString(til),
});

describe('resolveAarsloenCanonicalRangeIssues', () => {
  it.each([-1, 101])('afleder procent-rangefejl for canonical værdi %s', (feriePct) => {
    const issues = resolveAarsloenCanonicalRangeIssues({
      ...createAarsloenInitialValues(),
      feriePct,
    }, { omregningAktiveret: false });

    expect(issues).toContainEqual({
      field: 'feriePct',
      message: 'Procenten skal være mellem 0 og 100 %.',
    });
  });

  it('ignorerer procentfelter i beløbstilstand, hvor de ikke indgår i beregningen', () => {
    const issues = resolveAarsloenCanonicalRangeIssues({
      ...createAarsloenInitialValues(),
      tillaegAngivesSom: 'beloeb',
      feriePct: 101,
    }, { omregningAktiveret: false });

    expect(issues).toEqual([]);
  });

  it.each([-1, 100])('afleder feriedage-rangefejl for relevant canonical værdi %s', (antalFeriedage) => {
    const issues = resolveAarsloenCanonicalRangeIssues({
      ...createAarsloenInitialValues(),
      fuldLoenUnderFerie: false,
      antalFeriedage,
    }, { omregningAktiveret: true });

    expect(issues).toContainEqual({
      field: 'antalFeriedage',
      message: 'Antal feriedage skal være mellem 0 og 99.',
    });
  });
});

// ─── resolveAarsloenFeriedageOverskriderPeriodenIssue ─────────────────────

describe('resolveAarsloenFeriedageOverskriderPeriodenIssue', () => {
  const values = (overrides: Partial<AarsloenValues> = {}): AarsloenValues => ({
    ...AARSLOEN_INITIAL_VALUES,
    fuldLoenUnderFerie: false,
    ...overrides,
  });
  /** Motorens resultat for en periode uden fuld løn under ferie, som `beregnOmregnetAarsloen` danner det. */
  const data = (
    metode: 'A' | 'B',
    args: Readonly<{ hverdage: number; shDage?: number; feriedage: number }>
  ): AarsloenBeregningResultBeregnet => ({
    metode, erEtAar: false, hverdageIPeriode: args.hverdage, feriedageFraInput: args.feriedage,
    arbejdsdageIPeriode: args.hverdage - args.feriedage - (metode === 'A' ? args.shDage ?? 0 : 0),
    feriedagePaaAar: 25, arbejdsdagePaaAar: 0, hverdagePaaAar: 0, omregnetAarsloen: 0,
    antalEnheder: 1, antalHeleKalendermaaneder: null,
  });
  const issueFor = (
    antalFeriedage: number | undefined,
    beregningsData: AarsloenBeregningResultBeregnet,
    overrides: Partial<AarsloenValues> = {},
    omregningAktiveret = true
  ) => resolveAarsloenFeriedageOverskriderPeriodenIssue(
    values({ antalFeriedage, ...overrides }),
    { omregningAktiveret, beregningsData }
  );

  it('feriedage over periodens hverdage → issue med den KONKRETE grænse', () => {
    expect(issueFor(99, data('B', { hverdage: 23, feriedage: 99 }))).toEqual({
      field: 'antalFeriedage',
      message: 'Antal feriedage kan højst være 22, så der er mindst én hverdag tilbage (23 hverdage i de indtastede perioder).',
    });
  });

  it('feriedage lig periodens hverdage efterlader 0 dage → issue', () => {
    expect(issueFor(23, data('B', { hverdage: 23, feriedage: 23 }))?.message)
      .toBe('Antal feriedage kan højst være 22, så der er mindst én hverdag tilbage (23 hverdage i de indtastede perioder).');
  });

  it('metode A trækker SH-dagene fra grænsen og navngiver dem', () => {
    // Januar 2024, 23 hverdage og nytårsdag, «Ingen» løn på helligdage: 22 feriedage ville give 0 dage.
    for (const feriedage of [22, 23]) {
      expect(issueFor(feriedage, data('A', { hverdage: 23, shDage: 1, feriedage }))).toEqual({
        field: 'antalFeriedage',
        message: 'Antal feriedage kan højst være 21, så der er mindst én arbejdsdag tilbage (23 hverdage - 1 SH-dag i de indtastede perioder).',
      });
    }
  });

  it('feriedage, der efterlader én dag → intet issue', () => {
    expect(issueFor(21, data('A', { hverdage: 23, shDage: 1, feriedage: 21 }))).toBeNull();
    expect(issueFor(22, data('B', { hverdage: 23, feriedage: 22 }))).toBeNull();
  });

  it('uden omregning → intet issue (feltet er irrelevant)', () => {
    expect(issueFor(99, data('B', { hverdage: 23, feriedage: 99 }), {}, false)).toBeNull();
  });

  it('med fuld løn under ferie → intet issue (feltet er irrelevant)', () => {
    expect(issueFor(99, data('B', { hverdage: 23, feriedage: 0 }), { fuldLoenUnderFerie: true })).toBeNull();
  });

  it('tomt felt → intet issue', () => {
    expect(issueFor(undefined, data('B', { hverdage: 23, feriedage: 0 }))).toBeNull();
  });

  it('værdi uden for 0–99 → intet issue (den statiske bounds-fejl svarer først)', () => {
    expect(issueFor(150, data('B', { hverdage: 23, feriedage: 150 }))).toBeNull();
  });

  it('periode uden dage at omregne efter → intet feltissue (perioden er problemet, ikke feriedagene)', () => {
    expect(issueFor(5, data('B', { hverdage: 0, feriedage: 5 }))).toBeNull();
    expect(issueFor(0, data('A', { hverdage: 1, shDage: 1, feriedage: 0 }))).toBeNull();
  });
});

describe('harAarsloenIngenOmregningsdage', () => {
  const beregnet = (overrides: Partial<AarsloenBeregningResultBeregnet>): AarsloenBeregningResultBeregnet => ({
    metode: 'B', erEtAar: false, hverdageIPeriode: 0, feriedageFraInput: 0, arbejdsdageIPeriode: 0,
    feriedagePaaAar: 25, arbejdsdagePaaAar: 0, hverdagePaaAar: 0, omregnetAarsloen: 0,
    antalEnheder: 1, antalHeleKalendermaaneder: null,
    ...overrides,
  });

  it('melder en periode uden dage at dele med i metode A, B og dag-fallbacken', () => {
    expect(harAarsloenIngenOmregningsdage(beregnet({ metode: 'B' }), 'dag')).toBe(true);
    expect(harAarsloenIngenOmregningsdage(beregnet({ metode: 'A', hverdageIPeriode: 1 }), 'dag')).toBe(true);
    expect(harAarsloenIngenOmregningsdage(beregnet({ metode: 'C' }), 'dag')).toBe(true);
  });

  it('melder ikke feriedagenes fradrag – det er feltets egen grænse', () => {
    expect(harAarsloenIngenOmregningsdage(
      beregnet({ hverdageIPeriode: 23, feriedageFraInput: 23, arbejdsdageIPeriode: 0 }), 'maaned'
    )).toBe(false);
  });

  it('melder ikke måneds-, uge- og kalendermånedsomregning, som deler med enheder', () => {
    expect(harAarsloenIngenOmregningsdage(beregnet({ metode: 'C' }), 'maaned')).toBe(false);
    expect(harAarsloenIngenOmregningsdage(beregnet({ metode: 'C' }), 'uge')).toBe(false);
    expect(harAarsloenIngenOmregningsdage(beregnet({ metode: 'C', antalHeleKalendermaaneder: 1 }), 'dag')).toBe(false);
    expect(harAarsloenIngenOmregningsdage({ metode: 'ingen', erEtAar: false }, 'dag')).toBe(false);
  });
});

// ─── beregnFejlmeddelelser ────────────────────────────────────────────────

describe('beregnFejlmeddelelser', () => {
  describe('ingen fejl (typisk valide kombinationer)', () => {
    it('0% ferie, ingen fuld løn, ingen SH-udbetaling → ingen fejl', () => {
      const errors = beregnFejlmeddelelser(0, 0, false, false, 'Ingen');
      expect(errors).toHaveLength(0);
    });

    it('undefined pct, fuld løn under ferie → ingen fejl', () => {
      const errors = beregnFejlmeddelelser(undefined, undefined, true, false, 'Almindelig løn');
      expect(errors).toHaveLength(0);
    });
  });

  // Feriegodtgørelse med fuld løn under ferie er ikke en advarsel her, men en rød feltfejl i projektionen
  // (`resolveAarsloenFeriegodtgoerelseVedFuldLoenIssue`).
  describe('feriegodtgørelse med fuld løn er ikke en advarsel', () => {
    it.each([11.9, 12, 12.5])('feriePct = %s med fuld løn → ingen advarsel om ferien', (feriePct) => {
      const errors = beregnFejlmeddelelser(feriePct, 0, true, false, 'Almindelig løn');
      expect(errors).toHaveLength(0);
    });
  });

  describe('FEJL 2: lav feriepct uden fuld løn', () => {
    it('feriePct > 0 og < 12 uden fuld løn → fejl, der navngiver ydelsen som ferietillæg', () => {
      const errors = beregnFejlmeddelelser(5, 0, false, false, 'Almindelig løn');
      expect(errors).toContain('Ferietillæg på 5 % gør det usandsynligt, at der ikke er ret til fuld løn under ferie.');
    });

    it('feriePct = 0 uden fuld løn → ingen FEJL 2', () => {
      const errors = beregnFejlmeddelelser(0, 0, false, false, 'Almindelig løn');
      expect(errors).toHaveLength(0);
    });

    it('feriePct = 12 uden fuld løn → ingen FEJL 2 (grænseværdi)', () => {
      const errors = beregnFejlmeddelelser(12, 0, false, false, 'Almindelig løn');
      // FEJL 2 kræver > 0 og < 12.0 – 12.0 er præcis grænsen
      const fejl2 = errors.filter(e => e.includes('fuld løn under ferie'));
      expect(fejl2).toHaveLength(0);
    });
  });

  describe('FEJL 3: høj SH-sats', () => {
    it('shSoPct > 2.5 med Almindelig løn → fejl', () => {
      const errors = beregnFejlmeddelelser(0, 3, false, false, 'Almindelig løn');
      expect(errors.some(e => e.includes('SH/SO-sats'))).toBe(true);
    });

    it('shSoPct > 2.5 med Ingen → fejl', () => {
      const errors = beregnFejlmeddelelser(0, 3, false, false, 'Ingen');
      expect(errors.some(e => e.includes('SH/SO-sats'))).toBe(true);
    });

    it('shSoPct = 2.5 → ingen FEJL 3', () => {
      const errors = beregnFejlmeddelelser(0, 2.5, false, false, 'Ingen');
      expect(errors.filter(e => e.includes('SH/SO-sats'))).toHaveLength(0);
    });
  });

  describe('FEJL 4: lav SH-sats med SH-udbetaling', () => {
    it('shSoPct > 0 og < 2.5 med SH-udbetaling → fejl', () => {
      const errors = beregnFejlmeddelelser(0, 1, false, false, 'SH-udbetaling');
      expect(errors.some(e => e.includes('SH/SO-sats'))).toBe(true);
    });

    it('shSoPct = 0 med SH-udbetaling → ingen FEJL 4', () => {
      const errors = beregnFejlmeddelelser(0, 0, false, false, 'SH-udbetaling');
      expect(errors.filter(e => e.includes('SH/SO-sats'))).toHaveLength(0);
    });
  });

  describe('FEJL 5: 6. ferieuge med lav feriepct', () => {
    it('6. ferieuge + feriePct 12% uden fuld løn → fejl', () => {
      const errors = beregnFejlmeddelelser(12, 0, false, true, 'Almindelig løn');
      expect(errors.some(e => e.includes('6. ferieuge'))).toBe(true);
    });

    it('6. ferieuge + feriePct = 15 → ingen FEJL 5', () => {
      const errors = beregnFejlmeddelelser(15, 0, false, true, 'Almindelig løn');
      expect(errors.filter(e => e.includes('6. ferieuge'))).toHaveLength(0);
    });

    it('6. ferieuge + feriePct = 0 → ingen FEJL 5 (0 er ikke > 0)', () => {
      const errors = beregnFejlmeddelelser(0, 0, false, true, 'Almindelig løn');
      expect(errors.filter(e => e.includes('6. ferieuge'))).toHaveLength(0);
    });

    it('6. ferieuge + fuld løn → ingen FEJL 5', () => {
      const errors = beregnFejlmeddelelser(12, 0, true, true, 'Almindelig løn');
      expect(errors.filter(e => e.includes('6. ferieuge'))).toHaveLength(0);
    });
  });

  // Teksten ejes af valideringspolitikken, så den er dækket her og omfattet af relevans-gatingen.
  describe('FEJL 6: høj feriesats uden ret til 6. ferieuge', () => {
    it('feriePct >= 15 uden fuld løn og uden 6. ferieuge → fejl', () => {
      const errors = beregnFejlmeddelelser(15, 0, false, false, 'Almindelig løn');
      expect(errors.some((e) => e.includes('klar formodning for, at der er ret til 6. ferieuge'))).toBe(true);
    });

    it('navngiver satsen som feriegodtgørelse med den kanoniske procentformattering', () => {
      const errors = beregnFejlmeddelelser(16, 0, false, false, 'Almindelig løn');
      expect(errors).toContain(
        'Feriegodtgørelse på 16 % skaber en klar formodning for, at der er ret til 6. ferieuge.'
      );
    });

    it('feriePct = 14 → ingen FEJL 6 (grænseværdi)', () => {
      const errors = beregnFejlmeddelelser(14, 0, false, false, 'Almindelig løn');
      expect(errors.filter((e) => e.includes('klar formodning'))).toHaveLength(0);
    });

    it('fuld løn under ferie → ingen FEJL 6', () => {
      const errors = beregnFejlmeddelelser(15, 0, true, false, 'Almindelig løn');
      expect(errors.filter((e) => e.includes('klar formodning'))).toHaveLength(0);
    });

    it('ret til 6. ferieuge → ingen FEJL 6', () => {
      const errors = beregnFejlmeddelelser(15, 0, false, true, 'Almindelig løn');
      expect(errors.filter((e) => e.includes('klar formodning'))).toHaveLength(0);
    });
  });

  describe('multiple fejl kan forekomme', () => {
    it('kombinationen høj SH + lav ferie giver 2 fejl', () => {
      // shSoPct = 3 > 2.5 → FEJL 3
      // feriePct = 5, ikke fuld løn → FEJL 2
      const errors = beregnFejlmeddelelser(5, 3, false, false, 'Almindelig løn');
      expect(errors.length).toBeGreaterThanOrEqual(2);
    });
  });
});

// ─── harTabelValideringsFejl ──────────────────────────────────────────────
// NB: harTabelValideringsFejl bruger getStandardLoenTableValidation uden cellErrorsByCellKey.
// Fejl opstår kun ved "delvis periode" (nogen felter udfyldt, men ikke alle).
// Individuelle felt-format-fejl kræver at cellErrorsByCellKey sendes (hvilket sker i UI).

describe('harTabelValideringsFejl', () => {
  it('tom liste → false', () => {
    expect(harTabelValideringsFejl([], 'maaned')).toBe(false);
  });

  it('kun tomme rækker → false', () => {
    expect(harTabelValideringsFejl([emptyRow('r1')], 'maaned')).toBe(false);
  });

  it('komplet månedsrække uden beløb → true', () => {
    expect(harTabelValideringsFejl([maanedRow('r1', '6', '2024')], 'maaned')).toBe(true);
  });

  it('komplet dagrække uden beløb → true', () => {
    expect(harTabelValideringsFejl([dagRow('r1', '2024-01-01', '2024-01-31')], 'dag')).toBe(true);
  });

  it('delvis månedsrække (kun startdato) → true (partial period error)', () => {
    // Kun col0_maaned er udfyldt, col1_maaned mangler → partial period error
    const partialRow: StandardLoenTableRow = { ...emptyRow('r1'), col0_maaned: '6' };
    expect(harTabelValideringsFejl([partialRow], 'maaned')).toBe(true);
  });

  it('delvis dagrække (kun fra) → true', () => {
    const partialRow: StandardLoenTableRow = { ...emptyRow('r1'), col0_dag: toISODateString('2024-01-01') };
    expect(harTabelValideringsFejl([partialRow], 'dag')).toBe(true);
  });

  it('delvis ugerække (kun fra) → true', () => {
    const partialRow: StandardLoenTableRow = { ...emptyRow('r1'), col0_uge: '1/2024' };
    expect(harTabelValideringsFejl([partialRow], 'uge')).toBe(true);
  });
});

// ─── harTabelData ─────────────────────────────────────────────────────────

describe('harTabelData', () => {
  it('tom liste → false', () => {
    expect(harTabelData([], 'maaned')).toBe(false);
  });

  it('kun tomme rækker → false', () => {
    expect(harTabelData([emptyRow('r1')], 'maaned')).toBe(false);
  });

  it('komplet månedsrække → true', () => {
    expect(harTabelData([maanedRow('r1', '6', '2024')], 'maaned')).toBe(true);
  });

  it('komplet ugerække → true', () => {
    expect(harTabelData([ugeRow('r1', '1/2024', '4/2024')], 'uge')).toBe(true);
  });

  it('komplet dagrække → true', () => {
    expect(harTabelData([dagRow('r1', '2024-01-01', '2024-01-31')], 'dag')).toBe(true);
  });

  it('lønperiode mismatch: månedsdata med dag-lønperiode → false', () => {
    // Månedsdata (col0_maaned/col1_maaned) men lønperiode = dag
    expect(harTabelData([maanedRow('r1', '6', '2024')], 'dag')).toBe(false);
  });
});
