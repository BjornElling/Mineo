import {
  reduceInputCommand,
  settleField,
  setImmediateField,
  insertRow,
  createInputEvaluation,
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
  createCollectionRef,
  type SettledInput,
  type CollectionRef,
  type FieldRef,
} from '../../../inputCore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  aarsloenAntalFeriedageField,
  aarsloenFeriePctField,
  aarsloenFuldLoenUnderFerieField,
  aarsloenOmregningTilFuldtAarField,
  aarsloenTableCol0MaanedField,
  aarsloenTableCol1MaanedField,
  aarsloenTableCol2Field,
  aarsloenTillaegAngivesSomField,
} from '../../../inputCore/catalog/aarsloenDescriptors';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';
import {
  buildAarsloenReaderProjection,
  readAarsloenValues,
  resolveAarsloenFieldErrorGate,
} from '../../../domain/aarsloen/aarsloenProjection';

// Årsløn-projektionen (§3.4/§5.4). Beviser at `readAarsloenValues`
// rekonstruerer et komplet `AarsloenValues` fra readeren, og at `resolveAarsloenFieldErrorGate` spejler
// legacy `resolveAarsloenCanonicalRangeIssues`' betingelser (§1.6/§1.9): rød sats blokerer kun i procent-tilstand.

const catalog = getProductionInputCatalog();
const token = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));

const feriePctRef = aarsloenFeriePctField.bind();
const tillaegAngivesSomRef = aarsloenTillaegAngivesSomField.bind();
const tableDataCollection: CollectionRef = createCollectionRef({ section: 'aarsloen', path: [], collection: 'tableData' });
const col2Ref = (rowId: string): FieldRef<StandardLoenTableRow['col2']> => aarsloenTableCol2Field.bind(rowId);

const emptyRow = (id: string): StandardLoenTableRow => ({
  id,
  col0_maaned: '', col1_maaned: '', col0_uge: '', col1_uge: '',
  col0_dag: undefined, col1_dag: undefined,
  col2: undefined, col3: undefined, col4: undefined, col5: undefined,
  fpFvShSoBeloeb: undefined, pensionBeloeb: undefined,
});

const empty = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
    varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

// `settleField`/`insertRow` giver typed generiske commands; reduceren tager den type-udslettede union. Castet
// her er samme mønster som produktionsrunnerens ene write-grænse (typed callsite → union-reducer).
type AnyInputCommand = Parameters<typeof reduceInputCommand>[1];

const dispatch = (input: SettledInput, command: AnyInputCommand): SettledInput => {
  const result = reduceInputCommand(input, command, catalog);
  return result.changed ? result.input : input;
};

const settle = <T>(field: FieldRef<T>, raw: string): AnyInputCommand => settleField(field, raw) as AnyInputCommand;
const insert = (row: StandardLoenTableRow): AnyInputCommand =>
  insertRow(tableDataCollection, row) as AnyInputCommand;

const reader = (input: SettledInput) =>
  createInputEvaluation({ input, catalog, sourceToken: token }).reader;

describe('readAarsloenValues (reader-rekonstruktion)', () => {
  it('tom sag → schema-defaults (loenperiode maaned, tillaeg procent, toggles), tom tableData', () => {
    const values = readAarsloenValues(reader(empty()));
    expect(values.loenperiode).toBe('maaned');
    expect(values.tillaegAngivesSom).toBe('procent');
    expect(values.fuldLoenUnderFerie).toBe(true);
    expect(values.retTilSjetteFerieuge).toBe(true);
    expect(values.omregningTilFuldtAar).toBe(false);
    expect(values.feriePct).toBeUndefined();
    expect(values.antalFeriedage).toBeUndefined();
    expect(values.tableData).toEqual([]);
  });

  it('gyldig sats-commit reflekteres i values.feriePct', () => {
    const input = dispatch(empty(), settle(feriePctRef, '12,5'));
    expect(readAarsloenValues(reader(input)).feriePct).toBe(12.5);
  });

  it('rekonstruerer rækker med stabile id\'er og cellernes canonical værdier', () => {
    let input = dispatch(empty(), insert(emptyRow('r1')));
    input = dispatch(input, insert(emptyRow('r2')));
    input = dispatch(input, settle(col2Ref('r1'), '1000'));

    const { tableData } = readAarsloenValues(reader(input));
    expect(tableData.map((row) => row.id)).toEqual(['r1', 'r2']);
    expect(tableData[0]?.col2).toMatchObject({ value: 1000 });
    expect(tableData[1]?.col2).toBeUndefined();
  });

  it('en rød cellefejl blokerer IKKE rekonstruktionen (§1.10): cellen falder tilbage til tomværdi', () => {
    let input = dispatch(empty(), insert(emptyRow('r1')));
    input = dispatch(input, settle(col2Ref('r1'), 'abc')); // rejected råtekst
    const { tableData } = readAarsloenValues(reader(input));
    expect(tableData).toHaveLength(1);
    expect(tableData[0]?.col2).toBeUndefined();
  });
});

describe('resolveAarsloenFieldErrorGate (spejler resolveAarsloenCanonicalRangeIssues)', () => {
  it('rød satsprocent i procent-tilstand → fatal gate', () => {
    // Procent-codec afviser >100 → rejected råtekst → rødt feltissue.
    const input = dispatch(empty(), settle(feriePctRef, '150'));
    const values = readAarsloenValues(reader(input));
    expect(values.tillaegAngivesSom).toBe('procent');
    const gate = resolveAarsloenFieldErrorGate(reader(input), values, { omregningAktiveret: false });
    expect(gate.length).toBeGreaterThan(0);
  });

  it('samme røde satsprocent i beløb-tilstand → IKKE fatal (§1.9 skjult felt overblokerer ikke)', () => {
    let input = dispatch(empty(), settle(feriePctRef, '150'));
    input = dispatch(input, setImmediateField(tillaegAngivesSomRef, 'beloeb') as AnyInputCommand);
    const values = readAarsloenValues(reader(input));
    expect(values.tillaegAngivesSom).toBe('beloeb');
    const gate = resolveAarsloenFieldErrorGate(reader(input), values, { omregningAktiveret: false });
    expect(gate).toHaveLength(0);
  });

  it('ingen røde felter → tom gate', () => {
    const input = dispatch(empty(), settle(feriePctRef, '12'));
    const values = readAarsloenValues(reader(input));
    expect(resolveAarsloenFieldErrorGate(reader(input), values, { omregningAktiveret: true })).toHaveLength(0);
  });

  it('rød feriedage-fejl blokerer, når omregning er aktiv og fuld løn under ferie er slået fra', () => {
    let input = dispatch(empty(), setImmediateField(aarsloenOmregningTilFuldtAarField.bind(), true) as AnyInputCommand);
    input = dispatch(input, setImmediateField(aarsloenFuldLoenUnderFerieField.bind(), false) as AnyInputCommand);
    input = dispatch(input, settle(aarsloenAntalFeriedageField.bind(), 'abc'));
    const values = readAarsloenValues(reader(input));
    const gate = resolveAarsloenFieldErrorGate(reader(input), values, { omregningAktiveret: true });

    expect(gate).toHaveLength(1);
    expect(gate[0]).toMatchObject({
      reason: 'format',
      message: expect.stringContaining('Antal feriedage'),
    });
  });
});

/**
 * M-37 (udviklerafgørelse 2026-10-30): en tom feriesats regnes ikke længere stille som 0 %. Reglen er den FÆLLES
 * med EO's BB-274 (`domain/loen/feriePctKrav.ts`): ingen rød ring, men en blokerende mangel med samme ordlyd.
 */
describe('Feriegodtgørelse/-tillæg er påkrævet uden fuld løn under ferie (M-37)', () => {
  const medLoenraekke = (input: SettledInput): SettledInput => {
    let next = dispatch(input, insert(emptyRow('r1')));
    next = dispatch(next, settle(aarsloenTableCol0MaanedField.bind('r1'), '1'));
    next = dispatch(next, settle(aarsloenTableCol1MaanedField.bind('r1'), '2025'));
    return dispatch(next, settle(col2Ref('r1'), '30000'));
  };
  const udenFuldLoen = (input: SettledInput): SettledInput => {
    const next = dispatch(input, setImmediateField(aarsloenOmregningTilFuldtAarField.bind(), true) as AnyInputCommand);
    return dispatch(next, setImmediateField(aarsloenFuldLoenUnderFerieField.bind(), false) as AnyInputCommand);
  };

  it('tom sats uden fuld løn under ferie → blokerende mangel med EO\'s ordlyd og intet resultat', () => {
    const projection = buildAarsloenReaderProjection(reader(udenFuldLoen(medLoenraekke(empty()))));

    expect(projection.fieldIssues).toEqual([
      expect.objectContaining({ kind: 'consumer', reason: 'missing', message: 'Feriegodtgørelse/-tillæg er ikke udfyldt' }),
    ]);
    expect(projection.calculation).toBeNull();
  });

  it('udfyldt sats uden fuld løn under ferie → ingen mangel', () => {
    const projection = buildAarsloenReaderProjection(reader(dispatch(udenFuldLoen(medLoenraekke(empty())), settle(feriePctRef, '12,5'))));
    expect(projection.fieldIssues).toHaveLength(0);
  });

  it('bevidst 0 % uden fuld løn under ferie er en udfyldt værdi, ikke en mangel', () => {
    const projection = buildAarsloenReaderProjection(reader(dispatch(udenFuldLoen(medLoenraekke(empty())), settle(feriePctRef, '0'))));
    expect(projection.fieldIssues).toHaveLength(0);
  });

  it('fuld løn under ferie → feltet må stå tomt (satsen er ferietillægget)', () => {
    const projection = buildAarsloenReaderProjection(reader(medLoenraekke(empty())));
    expect(projection.values.fuldLoenUnderFerie).toBe(true);
    expect(projection.fieldIssues).toHaveLength(0);
  });

  it('skjult «Fuld løn under ferie» tæller som sin tomværdi, også hvis den er gemt som fra (M-32)', () => {
    // Omregningen slås fra igen: i Procent er valget nu skjult (BB-353), så det gemte «fra» må ikke kræve feltet.
    let input = udenFuldLoen(medLoenraekke(empty()));
    input = dispatch(input, setImmediateField(aarsloenOmregningTilFuldtAarField.bind(), false) as AnyInputCommand);
    const projection = buildAarsloenReaderProjection(reader(input));
    expect(projection.values.fuldLoenUnderFerie).toBe(false);
    expect(projection.fieldIssues).toHaveLength(0);
  });

  it('beløb-tilstand → satsen læses ikke og kræves ikke', () => {
    let input = udenFuldLoen(medLoenraekke(empty()));
    input = dispatch(input, setImmediateField(tillaegAngivesSomRef, 'beloeb') as AnyInputCommand);
    expect(buildAarsloenReaderProjection(reader(input)).fieldIssues).toHaveLength(0);
  });

  it('ingen lønoplysninger → ingen mangel', () => {
    const projection = buildAarsloenReaderProjection(reader(udenFuldLoen(empty())));
    expect(projection.fieldIssues).toHaveLength(0);
  });
});

describe('buildAarsloenReaderProjection', () => {
  it('samler tabelvalidering fra samme reader-revision', () => {
    const input = dispatch(empty(), settle(feriePctRef, '12'));
    const inputReader = reader(input);

    const projection = buildAarsloenReaderProjection(inputReader);

    expect(projection.sourceToken).toBe(inputReader.sourceToken);
    expect(projection.tableValidation.errors).toEqual([]);
  });

  // §3.9: motoren kaldes KUN i ready-grenen. En rød feltfejl på et beregningskritisk input skjuler værdien i
  // readeren; et resultat beregnet på den skjulte tomværdi ville være misvisende – derfor findes der INTET.
  it('blokeret gate → ingen beregning (motoren kaldes ikke)', () => {
    const input = dispatch(empty(), settle(feriePctRef, '150'));
    const projection = buildAarsloenReaderProjection(reader(input));

    expect(projection.values.feriePct).toBeUndefined();
    expect(projection.fieldIssues).toHaveLength(1);
    expect(projection.calculation).toBeNull();
  });

  it('ready gate → beregning foreligger', () => {
    const input = dispatch(empty(), settle(feriePctRef, '12'));
    const projection = buildAarsloenReaderProjection(reader(input));

    expect(projection.fieldIssues).toHaveLength(0);
    expect(projection.calculation).not.toBeNull();
    expect(projection.calculation?.harFatalBeregningsFejl).toBe(false);
  });

  // §1.9: et SKJULT felt må ikke overblokere. Samme røde procentværdi i beløb-tilstand er irrelevant, så
  // projektionen er ready og motoren kører.
  it('rød værdi på skjult felt blokerer ikke beregningen', () => {
    let input = dispatch(empty(), settle(feriePctRef, '150'));
    input = dispatch(input, setImmediateField(tillaegAngivesSomRef, 'beloeb') as AnyInputCommand);
    const projection = buildAarsloenReaderProjection(reader(input));

    expect(projection.fieldIssues).toHaveLength(0);
    expect(projection.calculation).not.toBeNull();
  });

  it('afleder konkret feriedagsgrænse fra periodens hverdage', () => {
    let input = dispatch(empty(), setImmediateField(aarsloenOmregningTilFuldtAarField.bind(), true) as AnyInputCommand);
    input = dispatch(input, setImmediateField(aarsloenFuldLoenUnderFerieField.bind(), false) as AnyInputCommand);
    input = dispatch(input, insert(emptyRow('r1')));
    input = dispatch(input, settle(aarsloenTableCol0MaanedField.bind('r1'), '1'));
    input = dispatch(input, settle(aarsloenTableCol1MaanedField.bind('r1'), '2024'));
    input = dispatch(input, settle(col2Ref('r1'), '1000'));
    input = dispatch(input, settle(aarsloenAntalFeriedageField.bind(), '24'));
    // Uden fuld løn under ferie er satsen påkrævet (M-37); uden den findes der intet resultat at afgrænse.
    input = dispatch(input, settle(feriePctRef, '12,5'));

    const projection = buildAarsloenReaderProjection(reader(input));

    expect(projection.calculation).not.toBeNull();
    expect(projection.feriedageFieldIssues).toHaveLength(1);
    expect(projection.feriedageFieldIssues[0]?.message).toContain('23');
  });

  /**
   * Aggregatet må ikke fremstilles som gyldigt, når en medregnet række har en ukendt værdi.
   *
   * Scenariet er fundets egen runtime-probe: to rækker, hvor kun den anden har en ugyldig `col2`. Readeren
   * skjuler den røde celle bag sin tomværdi, så motoren fik tidligere KUN række 1's 1.000 og siden viste
   * "1.000 kr." som Beregnet årsløn – en deltotal, der stille udelod række 2.
   */
  it('ugyldig celle i en medregnet række blokerer det samlede resultat', () => {
    let input = dispatch(empty(), settle(feriePctRef, '12'));
    input = dispatch(input, insert(emptyRow('r1')));
    input = dispatch(input, insert(emptyRow('r2')));
    input = dispatch(input, settle(col2Ref('r1'), '1000'));
    input = dispatch(input, settle(col2Ref('r2'), 'abc'));

    const projection = buildAarsloenReaderProjection(reader(input));

    // Cellen er afvist som råtekst, og tabelvalideringen klassificerer den som `invalid`.
    expect(projection.values.tableData.find((row) => row.id === 'r2')?.col2).toBeUndefined();
    expect(projection.tableValidation.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'cell', issue: 'invalid', rowId: 'r2' })])
    );
    // De beregningskritiske SKALARER er fejlfrie – gaten må derfor ikke hvile på `fieldIssues` alene.
    expect(projection.fieldIssues).toHaveLength(0);
    expect(projection.calculation).toBeNull();
  });

  it('gyldige rækker giver fortsat et resultat, når ingen celle er ugyldig', () => {
    // Ankeret der viser, at testen ovenfor ikke er tom: samme opsætning uden den ugyldige celle beregner.
    let input = dispatch(empty(), settle(feriePctRef, '12'));
    input = dispatch(input, insert(emptyRow('r1')));
    input = dispatch(input, settle(col2Ref('r1'), '1000'));

    const projection = buildAarsloenReaderProjection(reader(input));

    expect(projection.tableValidation.errors.filter((e) => e.kind === 'cell' && e.issue === 'invalid')).toEqual([]);
    expect(projection.calculation).not.toBeNull();
  });

  /**
   * En UFULDSTÆNDIG periode er bevidst IKKE en blokering af totalen.
   *
   * `tableValidation` klassificerer en række med beløb men uden komplet periode som `partial_period` – en helt
   * almindelig mellemtilstand, mens brugeren skriver rækken færdig. At skjule totalen der ville være en langt
   * bredere adfærdsændring end den godkendte, som handler om en RØD celle med ukendt værdi.
   */
  it('ufuldstændig periode blokerer ikke det samlede resultat', () => {
    let input = dispatch(empty(), settle(feriePctRef, '12'));
    input = dispatch(input, insert(emptyRow('r1')));
    input = dispatch(input, settle(col2Ref('r1'), '1000'));

    const projection = buildAarsloenReaderProjection(reader(input));

    expect(projection.tableValidation.errors).toEqual(
      expect.arrayContaining([expect.objectContaining({ issue: 'partial_period' })])
    );
    expect(projection.calculation).not.toBeNull();
  });
});
