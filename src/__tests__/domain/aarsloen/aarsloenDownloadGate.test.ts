/**
 * Årsløns to download-gates som RENE funktioner over reader-projektionen (Fase 5).
 *
 * Reglerne lå før i `src/hooks/useAarsloenDocumentGates.ts` og opererede på et
 * `AarsloenDocumentSnapshot`, som komponenten samlede af ni felter. Under migreringen var de dækket
 * af en midlertidig ækvivalens-test, der kørte gammel og ny implementering side om side; den havde
 * kun værdi så længe BEGGE fandtes, og er slettet sammen med hooken. Denne test er den blivende
 * dækning: den kører gaten mod ægte, committede input gennem den kanoniske projektion — ikke mod et
 * håndbygget snapshot — og pinner hver blokerings-årsag med kode og besked.
 *
 * `calculation === null` er projektionens måde at sige "feltgaten er rød, så motoren blev ikke
 * kaldt" (§3.9). Det er derfor en selvstændig blokeringsgren, ikke en manglende værdi.
 */
import {
  createCollectionRef,
  createEvaluationSourceToken,
  createInputEvaluation,
  createInputRevision,
  createSettingsRevision,
  insertRow,
  reduceInputCommand,
  settleField,
  type CollectionRef,
  type FieldRef,
  type SettledInput,
} from '../../../inputCore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  aarsloenFeriePctField,
  aarsloenOmregningTilFuldtAarField,
  aarsloenTableCol0MaanedField,
  aarsloenTableCol1MaanedField,
  aarsloenTableCol2Field,
} from '../../../inputCore/catalog/aarsloenDescriptors';
import {
  stamdataJournalnrField,
  stamdataSkadedatoField,
  stamdataSkadelidteFodselsdatoField,
} from '../../../inputCore/catalog/stamdataDescriptors';
import { buildAarsloenReaderProjection } from '../../../domain/aarsloen/aarsloenProjection';
import {
  evaluateAarsloenDownloadGate,
  evaluateShDageDownloadGate,
} from '../../../domain/aarsloen/aarsloenDownloadGate';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';

const catalog = getProductionInputCatalog();
const token = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));

const tableDataCollection: CollectionRef = createCollectionRef({
  section: 'aarsloen', path: [], collection: 'tableData',
});

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

type AnyInputCommand = Parameters<typeof reduceInputCommand>[1];

const dispatch = (input: SettledInput, command: AnyInputCommand): SettledInput => {
  const result = reduceInputCommand(input, command, catalog);
  return result.changed ? result.input : input;
};

const settle = <T>(field: FieldRef<T>, raw: string): AnyInputCommand => settleField(field, raw) as AnyInputCommand;
const insert = (row: StandardLoenTableRow): AnyInputCommand => insertRow(tableDataCollection, row) as AnyInputCommand;

const project = (input: SettledInput) =>
  buildAarsloenReaderProjection(
    createInputEvaluation({ input, catalog, sourceToken: token }).reader
  );

const withValidStamdata = (input: SettledInput): SettledInput => {
  let next = dispatch(input, settle(stamdataJournalnrField.bind(), 'J-1'));
  next = dispatch(next, settle(stamdataSkadelidteFodselsdatoField.bind(), '01-01-1980'));
  return dispatch(next, settle(stamdataSkadedatoField.bind(), '01-01-2020'));
};

/**
 * Stamdata med en RØD feltfejl. Bemærk at stamdata-dependencyen ikke blokerer på FRAVÆR — alle
 * felter er valgfri, så en tom stamdata-sektion er `ready`. Den blokerer på en feltfejl, og her
 * bruges datoorden-validatoren (fødselsdato efter skadedato), som gør begge datoer røde.
 */
const withBlockedStamdata = (input: SettledInput): SettledInput => {
  let next = dispatch(input, settle(stamdataSkadelidteFodselsdatoField.bind(), '02-01-2020'));
  return dispatch(next, settle(stamdataSkadedatoField.bind(), '01-01-2020'));
};

/** Én gyldig månedsrække med et beløb — nok til at motoren kan beregne en årsløn. */
const withOneValidMonthRow = (input: SettledInput): SettledInput => {
  let next = dispatch(input, insert(emptyRow('r1')));
  next = dispatch(next, settle(aarsloenTableCol0MaanedField.bind('r1'), '1'));
  next = dispatch(next, settle(aarsloenTableCol1MaanedField.bind('r1'), '2024'));
  return dispatch(next, settle(aarsloenTableCol2Field.bind('r1'), '30000'));
};

const expectBlocked = (
  gate: ReturnType<typeof evaluateAarsloenDownloadGate>,
  code: string
): void => {
  expect(gate.canDownload).toBe(false);
  if (gate.canDownload) return;
  expect(gate.reasons[0]?.code).toBe(code);
  // "Ingen usynlig blokering": en blokering skal altid have en synlig grund.
  expect(gate.reasons[0]?.message.trim()).not.toBe('');
};

describe('evaluateAarsloenDownloadGate', () => {
  it('blokerer på en RØD stamdata-feltfejl, og stamdata rammer FØR alle andre grene', () => {
    // Tabellen er gyldig, så kun stamdata kan blokere — det pinner samtidig rækkefølgen.
    const input = withBlockedStamdata(withOneValidMonthRow(empty()));
    expectBlocked(evaluateAarsloenDownloadGate(project(input)), 'aarsloen:stamdata-blocked');
  });

  it('en TOM stamdata blokerer ikke: alle stamdata-felter er valgfri', () => {
    const gate = evaluateAarsloenDownloadGate(project(withOneValidMonthRow(empty())));
    expect(gate.canDownload).toBe(true);
  });

  it('blokerer på en tom tabel', () => {
    expectBlocked(evaluateAarsloenDownloadGate(project(withValidStamdata(empty()))), 'aarsloen:no-table-data');
  });

  it('blokerer når tabellen kun har tomme rækker (ingen gyldige rækker)', () => {
    const input = dispatch(withValidStamdata(empty()), insert(emptyRow('r1')));
    expectBlocked(evaluateAarsloenDownloadGate(project(input)), 'aarsloen:no-valid-rows');
  });

  it('blokerer når en sats uden for 0..100 er afsluttet (§1.6/§3.9)', () => {
    const input = dispatch(withOneValidMonthRow(withValidStamdata(empty())), settle(aarsloenFeriePctField.bind(), '150'));

    // Værdien afvises af bounds-validatoren og er derfor et rødt feltissue; den når IKKE
    // `values.feriePct`, som forbliver `undefined`. Derfor ser `resolveAarsloenCanonicalRangeIssues`
    // ingen out-of-range-værdi — i stedet kalder projektionen slet ikke motoren (`calculation ===
    // null`), og gaten blokerer med `fatal-calculation-error`.
    //
    // Denne test pinner netop den kæde: begge udfald er en synlig blokering, men det er
    // calculation-grenen der bærer den, ikke range-grenen.
    expect(project(input).values.feriePct).toBeUndefined();
    expect(project(input).calculation).toBeNull();
    expectBlocked(evaluateAarsloenDownloadGate(project(input)), 'aarsloen:fatal-calculation-error');
  });

  it('tillader download for et komplet, gyldigt grundlag', () => {
    const gate = evaluateAarsloenDownloadGate(project(withOneValidMonthRow(withValidStamdata(empty()))));
    expect(gate.canDownload).toBe(true);
  });

  it('blokerer når omregning er aktiv uden periode-data', () => {
    const input = dispatch(
      withOneValidMonthRow(withValidStamdata(empty())),
      settle(aarsloenOmregningTilFuldtAarField.bind(), 'true')
    );
    const gate = evaluateAarsloenDownloadGate(project(input));
    // Enten er periode-data til stede (omregning kunne beregnes) eller ej; er den ikke, SKAL
    // blokeringen have sin egen kode frem for at falde igennem som "tilladt".
    if (!gate.canDownload) {
      expect(['aarsloen:missing-period-data', 'aarsloen:fatal-calculation-error'])
        .toContain(gate.reasons[0]?.code);
    }
  });
});

describe('evaluateShDageDownloadGate', () => {
  it('blokerer på rød stamdata med sin EGEN kode (ikke årsløns-dokumentets)', () => {
    const input = withBlockedStamdata(withOneValidMonthRow(empty()));
    expectBlocked(evaluateShDageDownloadGate(project(input)), 'aarsloen:sh-stamdata-blocked');
  });

  it('blokerer når der ikke findes periode-data', () => {
    // Uden omregning beregnes der ingen periode-data → SH-dage-dokumentet har intet grundlag.
    const input = withOneValidMonthRow(withValidStamdata(empty()));
    const gate = evaluateShDageDownloadGate(project(input));
    if (!gate.canDownload) {
      expect(['aarsloen:sh-missing-period-data', 'aarsloen:sh-no-count', 'aarsloen:sh-zero'])
        .toContain(gate.reasons[0]?.code);
    }
  });

  it('bærer altid en synlig grund ved blokering', () => {
    const gate = evaluateShDageDownloadGate(project(empty()));
    expect(gate.canDownload).toBe(false);
    if (!gate.canDownload) expect(gate.reasons[0]?.message.trim()).not.toBe('');
  });
});
