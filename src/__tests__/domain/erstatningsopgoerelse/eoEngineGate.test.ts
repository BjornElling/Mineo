import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { eoSnapshotToBeregningView } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshotToBeregningView';
import * as svieSmerteEngine from '../../../domain/erstatningsopgoerelse/engines/svieSmerteEngine';
import * as tafNettoBeregning from '../../../domain/erstatningsopgoerelse/engines/tafNettoBeregning';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { EMPTY_FIELD_ISSUE_SET, type FieldIssue, type FieldIssueSet } from '../../../inputCore/inputIssue';
import type { FieldAddress } from '../../../inputCore/fieldAddress';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { toISODateString } from '../../../types/branded';
import type { EoDependencyProjection } from '../../../domain/erstatningsopgoerelse/snapshot/eoDependencyProjection';

// INVARIANT (F2 – `form-contract.md` §2.3, `error-contract.md` §5): EO's beregningsmotorer må ikke kaldes,
// når en rød reader-feltfejl gør deres EGET input uanvendeligt.
//
// Før rettelsen gik reader-fejlene KUN til inspektionsvisningen, mens motorerne blev kaldt bagefter på
// readerens MASKEREDE værdier. En rød værdi er `undefined` for motoren, så fx en forligsprocent på 150 blev
// regnet som "intet forlig" (= 100 %), og "Beregnet svie/smerte" kunne vises som om tidligere udbetalt var 0.
//
// Brugerbeslutning 2026-07-25: et EO-output, hvis afhængighed er rød, skal vise `-`/ikke beregnet – og
// uafhængige dele skal BEVARES (ingen overblokering).
//
// ⚠️ Baseline SKAL være beregningsklar (`data !== null`). En tom EO-sag har i forvejen validatorfejl, så en
// test bygget på den ville være selvopfyldende: `data` var `null` uanset gaten.
//
// ⚠️ GATENS AUTORITET er `eoFieldIssues` – de STRUKTURELLE feltissues – ikke `eoErrors`-mappet (
// fund S3). Testene driver derfor gaten gennem strukturelle adresser. `eoErrors` bruges kun dér, hvor det
// er `buildReaderFieldIssueInvariants`' egen vej, der testes.

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

const fieldIssue = (
  address: FieldAddress,
  descriptorId: string,
  reason: FieldIssue['reason'] = 'format'
): FieldIssue => ({
  kind: 'field',
  code: 'test_issue',
  severity: 'error',
  reason,
  message: 'Ugyldig værdi',
  field: { address, descriptor: { id: descriptorId } } as unknown as FieldIssue['field'],
});

/** Rødt top-level EO-felt, adresseret strukturelt. */
const redField = (fieldName: string, reason: FieldIssue['reason'] = 'format'): FieldIssue =>
  fieldIssue({ section: 'erstatningsopgoerelse', path: [], field: fieldName }, `eo.${fieldName}`, reason);

/** Rød celle i en collection – den vej den gamle nøglebaserede gate var fuldstændig blind for. */
const redRowCell = (collection: string, field: string, entityId = 'r1'): FieldIssue =>
  fieldIssue(
    { section: 'erstatningsopgoerelse', path: [{ kind: 'entity', collection, entityId }], field },
    `eo.${collection}.${field}`
  );

const dependencyProjectionFor = (
  issues: readonly FieldIssue[],
  branch?: 'svieSmerte' | 'forlig' | 'taf' | 'oevrigeKrav'
): EoDependencyProjection => ({
  svieSmerteIssues: branch === 'svieSmerte' ? issues : [],
  forligIssues: branch === 'forlig' ? issues : [],
  tafIssues: branch === 'taf' ? issues : [],
  oevrigeKravIssues: branch === 'oevrigeKrav' ? issues : [],
  aggregateIssues: issues,
});

const branchForTestIssue = (issue: FieldIssue): 'svieSmerte' | 'forlig' | 'taf' | undefined => {
  const id = issue.field.descriptor.id;
  const collection = issue.field.address.path.find((segment) => segment.kind === 'entity')?.collection;
  if (id.includes('forligAnsvarsgrad')) return 'forlig';
  if (collection === 'svieSmertePerioder'
    || id.includes('svieSmerte')
    || id.endsWith('kravPaaSvieSmerteGodtgoerelse')
    || id.endsWith('tidligereSsMax')) return 'svieSmerte';
  if (collection === 'tafPerioder'
    || collection === 'loenudviklingManuelTableData'
    || id.endsWith('tidligereModtagetTaf')
    || id.endsWith('uspecificeredeFerieFridage')) return 'taf';
  return undefined;
};

const dependencyProjectionForIssues = (issues: readonly FieldIssue[]): EoDependencyProjection => ({
  svieSmerteIssues: issues.filter((issue) => branchForTestIssue(issue) === 'svieSmerte'),
  forligIssues: issues.filter((issue) => branchForTestIssue(issue) === 'forlig'),
  tafIssues: issues.filter((issue) => branchForTestIssue(issue) === 'taf'),
  oevrigeKravIssues: [],
  aggregateIssues: issues,
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

  const compute = (eoFieldIssues: readonly FieldIssue[] = [], eoErrors: FieldIssueSet = EMPTY_FIELD_ISSUE_SET) => computeEoSnapshot({
    revision: 'r1',
    stamdataValues: STAMDATA_INITIAL_VALUES,
    eoValues: createComputableEoValues(),
    eoErrors,
    dependencyProjection: dependencyProjectionForIssues(eoFieldIssues),
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
    const snapshot = compute([redField('forligAnsvarsgradProcent')]);

    expect(snapshot.data).toBeNull();
    expect(tafNettoSpy).not.toHaveBeenCalled();
    expect(snapshot.invariants.some((invariant) => invariant.id === 'reader_field:eo.forligAnsvarsgradProcent'))
      .toBe(true);
  });

  it('en rød BOUNDS-feltfejl blokerer også – en gembar værdi er ikke dermed beregnbar', () => {
    // `error-contract.md` §1.1: range/bounds blokerer IKKE `.eo`-save, men blokerer JA afhængig beregning.
    // Uden dette ville forligsprocenten 150 blive maskeret til tomværdi og regnet som 100 %.
    const snapshot = compute([redField('forligAnsvarsgradProcent', 'bounds')]);

    expect(snapshot.data).toBeNull();
    expect(tafNettoSpy).not.toHaveBeenCalled();
  });

  it('en rød RÆKKECELLE giver sin egen invariant pr. række, ikke én samlet', () => {
    // Fund S3's kerne: rækkeceller havde slet ingen invariant. Id'et bærer entity-id'et, så to røde celler i
    // samme collection ikke kollapser til én invariant.
    const snapshot = compute([
      redRowCell('svieSmertePerioder', 'fra', 'ss-1'),
      redRowCell('svieSmertePerioder', 'fra', 'ss-2'),
    ]);

    const readerInvariants = snapshot.invariants.filter((invariant) => invariant.id.startsWith('reader_field:'));
    expect(readerInvariants).toHaveLength(2);
    expect(snapshot.data).toBeNull();
  });

  it('en rød S/S-afhængighed stopper S/S-motoren – intet falsk "Beregnet svie/smerte"', () => {
    // Kernen i brugerbeslutningen: uden gaten kørte S/S-motoren videre på den maskerede tomværdi og viste et
    // beløb regnet som om "tidligere udbetalt svie/smerte" var 0.
    compute([redField('svieSmerteTidligereTotal')]);

    expect(svieSmerteSpy).not.toHaveBeenCalled();
  });

  it('S/S-gaten er DEPENDENCY-SPECIFIK: en TAF-fejl stopper ikke S/S-motoren', () => {
    // §1.10 / brugerbeslutning 2: rettelsen må ikke overblokere. `tidligereModtagetTaf` er ikke en
    // S/S-afhængighed, så S/S-visningen skal bestå (selv om de autoritative totaler er blokeret).
    compute([redField('tidligereModtagetTaf')]);

    expect(tafNettoSpy).not.toHaveBeenCalled();
    expect(svieSmerteSpy).toHaveBeenCalled();
  });

  it('en rød svieSmertePerioder-RÆKKECELLE stopper også S/S-motoren', () => {
    // Fund S3: præcis denne vej var død. Rækkeceller når aldrig `eoErrors`, så en nøglebaseret gate kunne
    // ikke se dem, og motoren regnede på readerens maskerede periode.
    compute([redRowCell('svieSmertePerioder', 'fra')]);

    expect(svieSmerteSpy).not.toHaveBeenCalled();
  });

  it('en rød tafPerioder-RÆKKECELLE stopper også TAF-motoren', () => {
    compute([redRowCell('tafPerioder', 'til')]);

    expect(tafNettoSpy).not.toHaveBeenCalled();
  });

  it('bevarer inspektionssnapshottet, så brugeren kan se fejlen og sit input', () => {
    // Download-gate-invarianten: EO blokeres aldrig uden en synlig fejl.
    const snapshot = compute([redField('forligAnsvarsgradProcent', 'bounds')]);

    expect(snapshot.inspektionSnapshot).not.toBeNull();
    expect(snapshot.status).toBe('error');
  });

});

// EO's afhængighedsopdeling. §1.10 kræver flere små dependency-specifikke
// gates – ikke én global. Modellen er A (Codex sol/high): de UAFHÆNGIGE grene overlever hinandens fejl, mens
// det krydsgående aggregat (samlet total + canonicalOutput + pdfModel) blokeres, hvis bare ét led er blokeret.
//
// Testene her hævder BEGGE retninger pr. gren, OG at den gyldige grens FAKTISKE OUTPUT bevares – ikke kun at
// en boolean er `false`. En boolean-only-test ville bestå med en global gate:
// `blockedDependencies.taf === false` sagde intet om, hvorvidt TAF-periodiseringen nåede Beregning-fanen.
describe('EO: afhængighedsopdelingen er specifik pr. gren (§1.10)', () => {
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

  const compute = (eoFieldIssues: readonly FieldIssue[] = []) => computeEoSnapshot({
    revision: 'r1',
    stamdataValues: STAMDATA_INITIAL_VALUES,
    eoValues: createComputableEoValues(),
    dependencyProjection: dependencyProjectionForIssues(eoFieldIssues),
  });

  it('BASELINE: ingen gren er blokeret, når intet er rødt', () => {
    const snapshot = compute();

    expect(snapshot.blockedDependencies).toEqual({
      svieSmerte: false,
      forlig: false,
      taf: false,
      oevrigeKrav: false,
      aggregate: false,
    });
  });

  it('en rød S/S-afhængighed blokerer KUN S/S-grenen – TAF forbliver ubrudt', () => {
    // Brugerbeslutning 2: et ugyldigt svie/smerte-felt må ikke fjerne den gyldige TAF-visning.
    const snapshot = compute([redField('svieSmerteSatserAar')]);

    expect(snapshot.blockedDependencies?.svieSmerte).toBe(true);
    expect(snapshot.blockedDependencies?.taf).toBe(false);
    expect(svieSmerteSpy).not.toHaveBeenCalled();
  });

  it('BRUGERBESLUTNING 2: den gyldige TAF-periodisering NÅR Beregning-fanen ved en S/S-fejl', () => {
    // Dette er fund S1's egentlige krav. `data` er `null` (aggregatet er ikke autoritativt), men fanen
    // læser `beregningView.tafPerioder` – og den skal fortsat vise det GYLDIGE forløb.
    //
    // En test der kun hævdede `blockedDependencies.taf === false` ville bestå med den globale gate, hvor
    // periodiseringen forsvandt fra fanen. Derfor asserteres det faktiske output.
    const blocked = compute([redField('svieSmerteSatserAar')]);
    const green = compute();

    expect(blocked.data).toBeNull();
    expect(blocked.readyBranches?.tafPerioder).toBeDefined();

    const blockedView = eoSnapshotToBeregningView(blocked);
    const greenView = eoSnapshotToBeregningView(green);

    expect(blockedView.tafPerioder.length).toBeGreaterThan(0);
    // Byte-identisk med den grønne vejs periodisering: grenen er ikke "en anden beregning", men den samme.
    expect(blockedView.tafPerioder).toEqual(greenView.tafPerioder);
    // Aggregatet forbliver ikke-autoritativt: summer og totaler vises som `-`.
    expect(blockedView.canonicalOutput).toBeUndefined();
  });

  it('en rød TAF-afhængighed FJERNER periodiseringen fra fanen – den er ikke gyldig', () => {
    // Den modsatte retning af testen ovenfor: fald-tilbagets grænse. En rød TAF-dato må IKKE give en
    // periodisering udledt af readerens maskerede tomværdi.
    const snapshot = compute([redRowCell('tafPerioder', 'fra')]);

    expect(snapshot.readyBranches?.tafPerioder).toBeUndefined();
    expect(eoSnapshotToBeregningView(snapshot).tafPerioder).toEqual([]);
  });

  it('en rød TAF-afhængighed blokerer KUN TAF-grenen – S/S beregnes fortsat', () => {
    const snapshot = compute([redField('tidligereModtagetTaf')]);

    expect(snapshot.blockedDependencies?.taf).toBe(true);
    expect(snapshot.blockedDependencies?.svieSmerte).toBe(false);
    // Den modsatte retning: S/S-motoren kører, fordi dens egne felter er grønne, OG dens output bevares.
    expect(svieSmerteSpy).toHaveBeenCalled();
    // S/S-grenens output bæres gennem `inspektionSnapshot` (Kontrol-fanens kilde), ikke gennem
    // `readyBranches` – dér ligger kun de grene, en consumer faktisk læser.
    expect(snapshot.readyBranches?.svieSmerte).toBeDefined();
  });

  it('en rød forligs-afhængighed blokerer KUN forligsgrenen', () => {
    const snapshot = compute([redField('forligAnsvarsgradProcent', 'bounds')]);

    expect(snapshot.blockedDependencies?.forlig).toBe(true);
    expect(snapshot.blockedDependencies?.svieSmerte).toBe(false);
    expect(snapshot.blockedDependencies?.taf).toBe(false);
  });

  it('S2: en rød forligsgrad neutraliserer EFTER-forlig-satserne, men bevarer før-forlig-grundlaget', () => {
    // Fund S2: motoren læser SELV forligsgraden (`svieSmerteEngine.ts:234`) og skalerer satser + total med
    // faktoren. En maskeret ugyldig forligsprocent blev derfor regnet som 100 %.
    //
    // Brugerbeslutning 1 kræver samtidig, at før-forlig-resultater BESTÅR – derfor må forligsfelterne ikke
    // ligge i S/S-gruppen, og grundlaget skal være uændret.
    const eoValues = createComputableEoValues();
    eoValues.svieSmerteSatserAar = 2024;
    eoValues.svieSmertePerioder = [
      { id: 'ss1', fra: toISODateString('2024-02-01'), til: toISODateString('2024-03-01'), tilstand: 'sygemeldt' },
    ];
    const snapshotArgs = {
      revision: 'r1',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    } as const;

    const blocked = computeEoSnapshot({
      ...snapshotArgs,
      dependencyProjection: dependencyProjectionFor(
        [redField('forligAnsvarsgradProcent', 'bounds')],
        'forlig'
      ),
    });
    const green = computeEoSnapshot(snapshotArgs);

    const blockedSs = blocked.readyBranches?.svieSmerte;
    expect(blockedSs).toBeDefined();
    if (blockedSs === undefined) throw new Error('S/S-grundlaget skal bestå');

    // Efter-forlig-felterne er neutraliseret: ingen skaleret sats, intet skaleret beløb, ingen faktor.
    expect(blockedSs.satserPerDagOre).toBeNull();
    expect(blockedSs.satserMaxOre).toBeNull();
    expect(blockedSs.forligFactor).toBeNull();
    expect(blockedSs.forligLabel).toBeNull();

    // FØR-forlig-grundlaget består og er identisk med den grønne vejs: dagene, satserne og de indtastede
    // beløb er de samme – kun skaleringen mangler.
    expect(green.data).not.toBeNull();
    const greenSs = green.data?.engines.svieSmerte;
    expect(blockedSs.satserPerDagFoerForligOre).toEqual(greenSs?.satserPerDagFoerForligOre);
    expect(blockedSs.satserMaxFoerForligOre).toEqual(greenSs?.satserMaxFoerForligOre);
    expect(blockedSs.sygedage).toEqual(greenSs?.sygedage);
    expect(blockedSs.delviseSygedage).toEqual(greenSs?.delviseSygedage);
    expect(blockedSs.tidligereOre).toEqual(greenSs?.tidligereOre);
    expect(blockedSs.satserAar).toEqual(greenSs?.satserAar);
  });

  it('en rød TAF-afhængighed stopper også TAF-periodiseringen, ikke kun beløbsmotoren', () => {
    // Ellers ville periodiseringen blive udledt af readerens MASKEREDE tomværdi og vise et forkert forløb.
    // `uspecificeredeFerieFridage` justerer TAF-dagene og er dermed en ægte TAF-afhængighed.
    const snapshot = compute([redField('uspecificeredeFerieFridage')]);

    expect(snapshot.blockedDependencies?.taf).toBe(true);
    expect(snapshot.readyBranches?.tafPerioder).toBeUndefined();
    expect(tafNettoSpy).not.toHaveBeenCalled();
  });

  it('en rød lønindkomst-celle blokerer TAF-grenen', () => {
    // Lønudviklingen er en del af TAF-beregningen. Cellen bor i en nestet collection, så den fanges af
    // collection-klassifikationen – ikke af et syntetisk nøglefragment.
    const snapshot = compute([redRowCell('loenudviklingManuelTableData', 'dato')]);

    expect(snapshot.blockedDependencies?.taf).toBe(true);
    expect(snapshot.blockedDependencies?.svieSmerte).toBe(false);
  });

  it('en ukendt rød feltnøgle blokerer aggregatet fail-closed uden at gætte en gren', () => {
    const snapshot = compute([redField('etHeltUkendtFelt')]);

    expect(snapshot.blockedDependencies?.aggregate).toBe(true);
    expect(snapshot.blockedDependencies?.svieSmerte).toBe(false);
    expect(snapshot.blockedDependencies?.taf).toBe(false);
    expect(snapshot.data).toBeNull();
  });

  it('AGGREGATET blokeres samlet ved ÉN blokeret gren – en sum af et ukendt led er ukendt', () => {
    // Model A's bevidste konsekvens: `data` (samlet total + canonicalOutput + pdfModel) er `null`, selv om
    // kun S/S er blokeret. Download forbliver blokeret med synlig fejl (download-gate-invarianten).
    const snapshot = compute([redField('svieSmerteSatserAar')]);

    expect(snapshot.data).toBeNull();
    expect(snapshot.inspektionSnapshot).not.toBeNull();
    expect(snapshot.status).toBe('error');
  });
});

// Stamdata-afhængigheder er klassificeret, ikke globale.
//
// Stamdata er en FREMMED sektion for EO, men EO læser den på tværs af sektionsgrænsen. Tidligere gjorde
// ETHVERT rødt stamdataissue hele EO's autoritative output ikke-autoritativt. Det var en overblokering:
// et bounds-fejlende felt, EO's motorer og dokumentindhold aldrig læser, fjernede totaler, canonical output
// og alle fire EO-dokumenter. §1.10: overblokering er lige så forkert som falske tal.
//
// Testene hævder BEGGE retninger, så en for smal klassifikation er lige så rød som en for bred.
describe('EO: stamdata blokerer efter faktisk afhængighed, ikke efter sektion', () => {
  const stamdataIssue = (field: string, descriptorId: string, reason: FieldIssue['reason'] = 'bounds'): FieldIssue =>
    fieldIssue({ section: 'stamdata', path: [], field }, descriptorId, reason);

  const compute = (stamdataFieldIssues: readonly FieldIssue[]) => computeEoSnapshot({
    revision: 'r1',
    stamdataValues: STAMDATA_INITIAL_VALUES,
    eoValues: createComputableEoValues(),
    dependencyProjection: {
      svieSmerteIssues: stamdataFieldIssues.filter((issue) => issue.field.descriptor.id === 'stamdata.skadedato'),
      forligIssues: [],
      tafIssues: stamdataFieldIssues.filter((issue) => issue.field.descriptor.id === 'stamdata.skadedato'),
      oevrigeKravIssues: [],
      aggregateIssues: stamdataFieldIssues.filter((issue) =>
        issue.field.descriptor.id !== 'stamdata.skadelidteFodselsdato'),
    },
  });

  it('en rød FØDSELSDATO blokerer intet – EO læser den kun til en advarsel', () => {
    // Kernen i fundet. Den eneste EO-læsning er folkepensionsadvarslen (`eoRowTaftRows.ts`, `status:
    // 'warning'`). Brugeren skal derfor fortsat se sine totaler og kunne hente dokumenterne.
    const snapshot = compute([stamdataIssue('skadelidteFodselsdato', 'stamdata.skadelidteFodselsdato')]);

    expect(snapshot.data).not.toBeNull();
    expect(snapshot.blockedDependencies).toEqual({
      svieSmerte: false,
      forlig: false,
      taf: false,
      oevrigeKrav: false,
      aggregate: false,
    });
    // Og den må ikke efterlade en blokerende invariant, som gaten kunne bruge i stedet.
    expect(snapshot.invariants.some((invariant) =>
      invariant.id === 'reader_field:stamdata.skadelidteFodselsdato')).toBe(false);
  });

  it('en rød SKADEDATO blokerer fortsat begge periodegrene – grænsen forsvinder ellers lydløst', () => {
    // Modretningen: klassifikationen må ikke være blevet en generel afvisning af stamdata. Skadedatoen
    // klipper BÅDE TAF-periodiseringen og svie/smerte-perioderne.
    const snapshot = compute([stamdataIssue('skadedato', 'stamdata.skadedato')]);

    expect(snapshot.data).toBeNull();
    expect(snapshot.blockedDependencies?.taf).toBe(true);
    expect(snapshot.blockedDependencies?.svieSmerte).toBe(true);
    expect(snapshot.invariants.some((invariant) =>
      invariant.id === 'reader_field:stamdata.skadedato')).toBe(true);
  });

  it('et rødt BREVHOVED-felt blokerer aggregatet – dokumentet må ikke udgives med tom linje', () => {
    // Journalnr bærer ingen validator og kan kun blive rødt ved format-afvist råtekst, men bliver det det,
    // er det EO-dokumentets egen identifikation der mangler.
    const snapshot = compute([stamdataIssue('journalnr', 'stamdata.journalnr', 'format')]);

    expect(snapshot.data).toBeNull();
    expect(snapshot.blockedDependencies?.aggregate).toBe(true);
    // …men ingen af motorgrenene: brevhovedet fodrer ingen beregning.
    expect(snapshot.blockedDependencies?.taf).toBe(false);
    expect(snapshot.blockedDependencies?.svieSmerte).toBe(false);
  });
});
