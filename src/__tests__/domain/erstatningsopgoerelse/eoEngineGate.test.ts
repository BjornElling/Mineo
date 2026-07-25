import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import * as svieSmerteEngine from '../../../domain/erstatningsopgoerelse/engines/svieSmerteEngine';
import * as tafNettoBeregning from '../../../domain/erstatningsopgoerelse/engines/tafNettoBeregning';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { EoInputIssues } from '../../../domain/erstatningsopgoerelse/eoInputIssues';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';

// INVARIANT (F2 — `form-contract.md` §2.3, `error-contract.md` §5): EO's beregningsmotorer må ikke kaldes,
// når en rød reader-feltfejl gør deres EGET input uanvendeligt.
//
// Før rettelsen gik `eoErrors` KUN til inspektionsvisningen, mens motorerne blev kaldt bagefter på readerens
// MASKEREDE værdier. En rød værdi er `undefined` for motoren, så fx en forligsprocent på 150 blev regnet som
// "intet forlig" (= 100 %), og "Beregnet svie/smerte" kunne vises som om tidligere udbetalt var 0.
//
// Brugerbeslutning 2026-07-25: et EO-output, hvis afhængighed er rød, skal vise `-`/ikke beregnet — og
// uafhængige dele skal BEVARES (ingen overblokering).
//
// ⚠️ Baseline SKAL være beregningsklar (`data !== null`). En tom EO-sag har i forvejen validatorfejl, så en
// test bygget på den ville være selvopfyldende: `data` var `null` uanset gaten.

const EMPLOYMENT_ID = 'af-1';

/** En beregningsklar EO-sag: uden reader-fejl giver den `data !== null`. */
const createComputableEoValues = (): ErstatningsopgoerelseValues => {
  const eoValues = createErstatningsopgoerelseInitialValues();
  eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
  eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
  eoValues.tafBeregningsperiodeFra = toISODateString('2023-01-01');
  eoValues.tafBeregningsperiodeTil = toISODateString('2023-12-31');
  eoValues.tafPerioder = [
    { id: 'r1', fra: toISODateString('2024-01-01'), til: toISODateString('2024-06-30'), loseFeriedage: 0 },
  ];
  // Baseline-ansættelsesforholdet fra `createErstatningsopgoerelseInitialValues` mangler enkelte felter, som
  // schemaet kræver (de udfyldes normalt af formularen). Vi kompletterer dem her, så baseline er BEREGNINGSKLAR
  // og testene dermed ikke bliver selvopfyldende.
  eoValues.loenindkomstAnsaettelsesforhold = [{
    ...eoValues.loenindkomstAnsaettelsesforhold[0],
    id: EMPLOYMENT_ID,
    loenudviklingBeregningsgrundlag: 'Ingen',
    loenudviklingManuelNavn: '',
    loenPaaHelligdage: 'Almindelig løn',
    offentligLoenType: 'Månedsløn',
  }];
  eoValues.sfggAnsaettelsesforhold = [{
    ansaettelsesforholdId: EMPLOYMENT_ID,
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
  return eoValues;
};

const readerIssue = (message: string, reason: 'format' | 'bounds'): NonNullable<EoInputIssues[string]> => ({
  input: { message, severity: 'error', source: 'input', reason },
});

describe('EO: motorerne kaldes ikke, når en rød reader-feltfejl blokerer', () => {
  let svieSmerteSpy: ReturnType<typeof vi.spyOn>;
  let tafNettoSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    svieSmerteSpy = vi.spyOn(svieSmerteEngine, 'computeSvieSmerteEngine');
    tafNettoSpy = vi.spyOn(tafNettoBeregning, 'computeTafNettoBeregning');
  });

  afterEach(() => {
    svieSmerteSpy.mockRestore();
    tafNettoSpy.mockRestore();
  });

  const compute = (eoErrors: EoInputIssues = {}) => computeEoSnapshot({
    revision: 'r1',
    stamdataValues: STAMDATA_INITIAL_VALUES,
    eoValues: createComputableEoValues(),
    eoErrors,
  });

  it('BASELINE: bygger autoritative data og kalder motorerne, når intet er rødt', () => {
    // Uden denne kontrol ville alle testene nedenfor være selvopfyldende.
    const snapshot = compute();

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id.startsWith('reader_field:'))).toBe(false);
    expect(tafNettoSpy).toHaveBeenCalled();
    expect(svieSmerteSpy).toHaveBeenCalled();
  });

  it('en rød FORMAT-feltfejl blokerer den autoritative beregning', () => {
    const snapshot = compute({
      forligAnsvarsgradProcent: readerIssue('Der er udfyldt en ugyldig værdi i feltet Ansvarsgrad', 'format'),
    });

    expect(snapshot.data).toBeNull();
    expect(tafNettoSpy).not.toHaveBeenCalled();
    expect(snapshot.invariants.some((invariant) => invariant.id === 'reader_field:eo.forligAnsvarsgradProcent'))
      .toBe(true);
  });

  it('en rød BOUNDS-feltfejl blokerer også — en gembar værdi er ikke dermed beregnbar', () => {
    // `error-contract.md` §1.1: range/bounds blokerer IKKE `.eo`-save, men blokerer JA afhængig beregning.
    // Uden dette ville forligsprocenten 150 blive maskeret til tomværdi og regnet som 100 %.
    const snapshot = compute({
      forligAnsvarsgradProcent: readerIssue('Ansvarsgrad skal være mellem 0 og 100', 'bounds'),
    });

    expect(snapshot.data).toBeNull();
    expect(tafNettoSpy).not.toHaveBeenCalled();
  });

  it('en rød S/S-afhængighed stopper S/S-motoren — intet falsk "Beregnet svie/smerte"', () => {
    // Kernen i brugerbeslutningen: uden gaten kørte S/S-motoren videre på den maskerede tomværdi og viste et
    // beløb regnet som om "tidligere udbetalt svie/smerte" var 0.
    compute({
      svieSmerteTidligereTotal: readerIssue('Beløbet er ugyldigt', 'format'),
    });

    expect(svieSmerteSpy).not.toHaveBeenCalled();
  });

  it('S/S-gaten er DEPENDENCY-SPECIFIK: en TAF-fejl stopper ikke S/S-motoren', () => {
    // §1.10 / brugerbeslutning 2: rettelsen må ikke overblokere. `tidligereModtagetTaf` er ikke en
    // S/S-afhængighed, så S/S-visningen skal bestå (selv om de autoritative totaler er blokeret).
    compute({
      tidligereModtagetTaf: readerIssue('Beløbet er ugyldigt', 'format'),
    });

    expect(tafNettoSpy).not.toHaveBeenCalled();
    expect(svieSmerteSpy).toHaveBeenCalled();
  });

  it('en rød svieSmertePerioder-rækkecelle stopper også S/S-motoren', () => {
    compute({
      'ss-row-1:svieSmertePerioder': readerIssue('Ugyldig periode', 'format'),
    });

    expect(svieSmerteSpy).not.toHaveBeenCalled();
  });

  it('bevarer inspektionssnapshottet, så brugeren kan se fejlen og sit input', () => {
    // Download-gate-invarianten: EO blokeres aldrig uden en synlig fejl.
    const snapshot = compute({
      forligAnsvarsgradProcent: readerIssue('Ansvarsgrad skal være mellem 0 og 100', 'bounds'),
    });

    expect(snapshot.inspektionSnapshot).not.toBeNull();
    expect(snapshot.status).toBe('error');
  });

  it('en warning bliver ikke en blokerende invariant', () => {
    // `error-contract.md` §1.1: en warning blokerer aldrig — hverken save, beregning eller dokument.
    const snapshot = compute({
      forligAnsvarsgradProcent: {
        input: { message: 'En advarsel', severity: 'warning', source: 'input', reason: 'rule' },
      },
    });

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id.startsWith('reader_field:'))).toBe(false);
  });
});
