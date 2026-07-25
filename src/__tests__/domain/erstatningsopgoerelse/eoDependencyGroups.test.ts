import {
  resolveEoBlockedDependencies,
  EO_CLASSIFIED_COLLECTIONS,
  EO_CLASSIFIED_FIELD_IDS,
} from '../../../domain/erstatningsopgoerelse/snapshot/eoDependencyGroups';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import type { FieldAddress } from '../../../inputCore/fieldAddress';
import {
  productionInputCollections,
  productionInputFields,
} from '../../../inputCore/catalog/productionCatalog';

// WI-004: enhedstests for selve afhængighedsopdelingen (§1.10). `eoEngineGate.test.ts` beviser opdelingens
// VIRKNING gennem snapshottet; her testes reglen isoleret, så en fejl i grupperne kan lokaliseres direkte.
//
// De to fejlretninger er lige alvorlige: en for smal gruppe giver falske tal bag en rød markering, og en for
// bred gruppe overblokerer og fjerner gyldige, uafhængige visninger (brugerbeslutning 2, 2026-07-25).
//
// ⚠️ AUTORITETEN er de STRUKTURELLE feltissues, ikke `eoErrors`-mappet (runde 4, fund S3). Den tidligere
// udgave matchede `eoErrors`-nøgler — et map med KUN 11 top-level feltnavne. Rækkecelle-fragmenterne
// (`svieSmertePerioder`, `tafPerioder`) kunne derfor aldrig matche en produktionsnøgle: de var død kode,
// og motorerne blev kaldt på readerens maskerede rækkedata.

const issueAt = (
  address: FieldAddress,
  descriptorId: string,
  reason: FieldIssue['reason'] = 'format'
): FieldIssue => ({
  kind: 'field',
  code: 'test_issue',
  severity: 'error',
  reason,
  message: 'Ugyldig værdi',
  // Kun `address` og `descriptor.id` læses af resolveren; resten af descriptoren er irrelevant her.
  field: { address, descriptor: { id: descriptorId } } as unknown as FieldIssue['field'],
});

/** Et top-level EO-felt: ingen entity-segmenter på stien. */
const topLevelIssue = (descriptorId: string, reason: FieldIssue['reason'] = 'format'): FieldIssue =>
  issueAt(
    { section: 'erstatningsopgoerelse', path: [], field: descriptorId.split('.').at(-1) ?? descriptorId },
    descriptorId,
    reason
  );

/** En rækkecelle i en collection — det tilfælde den gamle nøglebaserede gate var blind for. */
const rowCellIssue = (collection: string, field: string, entityId = 'row-1'): FieldIssue =>
  issueAt(
    {
      section: 'erstatningsopgoerelse',
      path: [{ kind: 'entity', collection, entityId }],
      field,
    },
    `eo.${collection}.${field}`
  );

const NOTHING_BLOCKED = {
  svieSmerte: false,
  forlig: false,
  taf: false,
  oevrigeKrav: false,
  aggregate: false,
} as const;

/** Grenene minus aggregatet: aggregatet er bevidst rødt ved ENHVER fejl og er derfor ikke "uafhængigt". */
type Branch = Exclude<keyof typeof NOTHING_BLOCKED, 'aggregate'>;
const BRANCHES: readonly Branch[] = ['svieSmerte', 'forlig', 'taf', 'oevrigeKrav'];

describe('resolveEoBlockedDependencies', () => {
  it('blokerer ingen gren for et tomt issue-sæt', () => {
    expect(resolveEoBlockedDependencies([])).toEqual(NOTHING_BLOCKED);
  });

  it('blokerer også på bounds — en gembar værdi er ikke dermed beregnbar', () => {
    // `error-contract.md` §1.1: en bounds-fejl blokerer ikke `.eo`-save, men JA den afhængige beregning.
    const blocked = resolveEoBlockedDependencies([topLevelIssue('eo.svieSmerteSatserAar', 'bounds')]);

    expect(blocked.svieSmerte).toBe(true);
  });

  describe('grenene er indbyrdes uafhængige', () => {
    // Hver case hævder BEGGE retninger: den ramte gren blokeres, og ALLE andre grene gør ikke. En test der
    // kun hævdede den første retning, ville også bestå med en global gate og bevise intet om §1.10.
    const cases: ReadonlyArray<Readonly<{ navn: string; issue: FieldIssue; gren: Branch }>> = [
      { navn: 'svie/smerte-satsår', issue: topLevelIssue('eo.svieSmerteSatserAar'), gren: 'svieSmerte' },
      { navn: 'svie/smerte tidligere total', issue: topLevelIssue('eo.svieSmerteTidligereTotal'), gren: 'svieSmerte' },
      { navn: 'svie/smerte-periodens fra-dato', issue: rowCellIssue('svieSmertePerioder', 'fra'), gren: 'svieSmerte' },
      { navn: 'svie/smerte-periodens tilstand', issue: rowCellIssue('svieSmertePerioder', 'tilstand'), gren: 'svieSmerte' },
      { navn: 'tidligere modtaget TAF', issue: topLevelIssue('eo.tidligereModtagetTaf'), gren: 'taf' },
      { navn: 'uspecificerede ferie-/fridage', issue: topLevelIssue('eo.uspecificeredeFerieFridage'), gren: 'taf' },
      { navn: 'angivet månedsløn', issue: topLevelIssue('eo.maanedsloenenUdgoer'), gren: 'taf' },
      { navn: 'TAF-periodens til-dato', issue: rowCellIssue('tafPerioder', 'til'), gren: 'taf' },
      { navn: 'TAF-periodens løse feriedage', issue: rowCellIssue('tafPerioder', 'loseFeriedage'), gren: 'taf' },
      { navn: 'ferieperiodens fra-dato', issue: rowCellIssue('ferieperioder', 'fra'), gren: 'taf' },
      { navn: 'fraværsperiodens til-dato', issue: rowCellIssue('fravaerPerioder', 'til'), gren: 'taf' },
      { navn: 'offentlig ydelses beløb', issue: rowCellIssue('offentligeYdelserRows', 'fraDato'), gren: 'taf' },
      { navn: 'en manuel reguleringscelle', issue: rowCellIssue('loenudviklingManuelTableData', 'dato'), gren: 'taf' },
      { navn: 'forligs-ansvarsgrad i procent', issue: topLevelIssue('eo.forligAnsvarsgradProcent'), gren: 'forlig' },
      { navn: 'forligs-ansvarsgrad som brøk', issue: topLevelIssue('eo.forligAnsvarsgradBroek'), gren: 'forlig' },
      { navn: 'en øvrige krav-celle', issue: rowCellIssue('oevrigeKravPerioder', 'beloeb'), gren: 'oevrigeKrav' },
    ];

    for (const { navn, issue, gren } of cases) {
      it(`en rød ${navn} blokerer kun ${gren}`, () => {
        const blocked = resolveEoBlockedDependencies([issue]);

        expect(blocked[gren]).toBe(true);
        for (const anden of BRANCHES) {
          if (anden === gren) continue;
          expect(blocked[anden]).toBe(false);
        }
        // Aggregatet er ALTID rødt, når bare én gren er: en sum kan ikke være autoritativ uden alle led.
        expect(blocked.aggregate).toBe(true);
      });
    }
  });

  // Re-review-fund (P1): CLAMPING-grænserne manglede i begge grupper. En rød `vedroererPeriodeTil` maskeres til
  // `undefined`, hvorved klipningen forsvinder — og periodiseringen/dagantallet bliver vist som gyldigt, mens
  // det i virkeligheden er uklampet. En scalar-grænse er lige så meget en afhængighed som et beløbsfelt.
  describe('clamping-grænserne er afhængigheder, ikke kun beløbsfelterne', () => {
    // `buildTafRanges` → `resolveTafFejlgivendeBounds` + `resolveTafEoPeriodeBounds`.
    const tafClampFields: readonly string[] = [
      'eo.vedroererPeriodeFra',
      'eo.vedroererPeriodeTil',
      'eo.differencekravDato',
      'eo.midlertidigtEETAfgorelse',
      'eo.midlertidigEETAfgoerelseDato',
      'eo.midlertidigEETVirkningsdato',
      'eo.endeligtEETAfgorelse',
      'eo.endeligEETAfgoerelseDato',
      'eo.endeligEETVirkningsdato',
      'eo.verserendeKlageEet',
      'eo.tafBeregningsperiodeFra',
      'eo.tafBeregningsperiodeTil',
    ];

    it.each(tafClampFields)('%s blokerer TAF-grenen', (fieldId) => {
      expect(resolveEoBlockedDependencies([topLevelIssue(fieldId)]).taf).toBe(true);
    });

    // `computeSvieSmerteEngine` klipper perioderne mod EO-perioden og læser sine to toggles.
    const svieSmerteScalarFields: readonly string[] = [
      'eo.vedroererPeriodeFra',
      'eo.vedroererPeriodeTil',
      'eo.kravPaaSvieSmerteGodtgoerelse',
      'eo.tidligereSsMax',
    ];

    it.each(svieSmerteScalarFields)('%s blokerer S/S-grenen', (fieldId) => {
      expect(resolveEoBlockedDependencies([topLevelIssue(fieldId)]).svieSmerte).toBe(true);
    });

    // Re-review T1: `resolveSvieSmerteFejlgivendeBounds` klipper også mod mén-afgørelsesdatoen.
    const menCutoffFields: readonly string[] = [
      'eo.menAfgoerelseDato',
      'eo.varigeMenAfgorelse',
      'eo.verserendeKlageMen',
    ];

    it.each(menCutoffFields)('%s blokerer S/S-grenen (mén-klipningen)', (fieldId) => {
      const blocked = resolveEoBlockedDependencies([topLevelIssue(fieldId)]);

      expect(blocked.svieSmerte).toBe(true);
      // Mén-datoen klipper IKKE TAF — gruppen forbliver specifik.
      expect(blocked.taf).toBe(false);
    });

    // Re-review T2: skadedatoen bor i STAMDATA, men klipper begge EO-grene. En gate udledt af EO-issues alene
    // kunne ikke se den, og en rød skadedato gav derfor en uklampet gren i `readyBranches`.
    it('en rød STAMDATA-skadedato blokerer både TAF og S/S på tværs af sektionsgrænsen', () => {
      const skadedatoIssue = issueAt(
        { section: 'stamdata', path: [], field: 'skadedato' },
        'stamdata.skadedato'
      );

      const blocked = resolveEoBlockedDependencies([], [skadedatoIssue]);

      expect(blocked.taf).toBe(true);
      expect(blocked.svieSmerte).toBe(true);
      expect(blocked.aggregate).toBe(true);
      // Forliget læser ikke skadedatoen.
      expect(blocked.forlig).toBe(false);
    });

    it('et andet stamdata-felt blokerer ingen gren, men fail-closer aggregatet', () => {
      // Modstykket: gaten må ikke blive "enhver stamdata-fejl blokerer alt" — det ville være overblokering.
      const journalnrIssue = issueAt(
        { section: 'stamdata', path: [], field: 'journalnr' },
        'stamdata.journalnr'
      );

      const blocked = resolveEoBlockedDependencies([], [journalnrIssue]);

      expect(blocked.taf).toBe(false);
      expect(blocked.svieSmerte).toBe(false);
      expect(blocked.aggregate).toBe(true);
    });

    it('EO-perioden er en DELT afhængighed — den blokerer begge grene, ikke kun én', () => {
      // Begge motorer klipper mod den. At lade den blokere kun én gren ville efterlade den anden med et
      // maskeret input; det er ikke overblokering, men en reelt delt afhængighed.
      const blocked = resolveEoBlockedDependencies([topLevelIssue('eo.vedroererPeriodeTil')]);

      expect(blocked.svieSmerte).toBe(true);
      expect(blocked.taf).toBe(true);
      // Forliget klipper ikke mod perioden og forbliver urørt — gruppen er stadig ikke global.
      expect(blocked.forlig).toBe(false);
    });
  });

  it('holder forlig og svie/smerte adskilt, så før-forlig-grundlaget består', () => {
    // Fund S2: motoren læser SELV forligsgraden og skalerer satser + total med faktoren. Forlig er derfor en
    // reel S/S-afhængighed — men KUN for efter-forlig-resultatet. Brugerbeslutning 1 kræver, at
    // før-forlig-resultater består, så forligsfelterne må IKKE ligge i S/S-gruppen.
    const blocked = resolveEoBlockedDependencies([topLevelIssue('eo.forligAnsvarsgradProcent')]);

    expect(blocked.forlig).toBe(true);
    expect(blocked.svieSmerte).toBe(false);
  });

  it('blokerer flere grene samtidigt, når flere felter er røde', () => {
    const blocked = resolveEoBlockedDependencies([
      topLevelIssue('eo.svieSmerteSatserAar'),
      rowCellIssue('tafPerioder', 'fra'),
    ]);

    expect(blocked.svieSmerte).toBe(true);
    expect(blocked.taf).toBe(true);
    expect(blocked.forlig).toBe(false);
  });

  it('lader en ukendt feltnøgle stå uden for grenene, men blokerer aggregatet fail-closed', () => {
    // En ukendt nøgle må ikke gætte sig til en gren — men den må heller ikke lydløst forsvinde ud af
    // gatingen. Aggregatet (samlet total, canonicalOutput, pdfModel) er derfor rødt.
    const blocked = resolveEoBlockedDependencies([topLevelIssue('eo.etHeltUkendtFelt')]);

    for (const gren of BRANCHES) expect(blocked[gren]).toBe(false);
    expect(blocked.aggregate).toBe(true);
  });
});

// COMPLETENESS mod det FAKTISKE produktionskatalog.
//
// Denne test findes, fordi begge tidligere udgaver af grupperne var skrevet mod et nøglesæt, der ikke
// matchede produktionen: først SCHEMA-feltnavne, dernæst `eoErrors`-nøgler uden rækkeceller. En håndskrevet
// liste i testen ville have gentaget samme fejl. Vi itererer derfor descriptor-kataloget selv, så en
// omdøbt collection eller et omdøbt felt gør testen rød i stedet for lydløst at gøre en gren til død kode.
describe('afhængighedsopdelingen er skrevet mod det faktiske produktionskatalog', () => {
  const productionCollectionNames = new Set(
    productionInputCollections.map((collection) => collection.template.collection)
  );
  const productionFieldIds = new Set(productionInputFields.map((field) => field.id));

  it('katalogerne er faktisk indlæst (værn mod en tom it.each)', () => {
    expect(productionCollectionNames.size).toBeGreaterThan(10);
    expect(productionFieldIds.size).toBeGreaterThan(100);
    expect(EO_CLASSIFIED_COLLECTIONS.length).toBeGreaterThan(5);
    expect(EO_CLASSIFIED_FIELD_IDS.length).toBeGreaterThan(5);
  });

  it.each(EO_CLASSIFIED_COLLECTIONS)('den klassificerede collection %s findes i produktionen', (collection) => {
    expect(productionCollectionNames.has(collection)).toBe(true);
  });

  it.each(EO_CLASSIFIED_FIELD_IDS)('det klassificerede felt-id %s findes i produktionen', (fieldId) => {
    expect(productionFieldIds.has(fieldId)).toBe(true);
  });

  // Hver klassificeret collection: ALLE dens faktiske child-felter skal ramme en gren. Det er dette led,
  // der gør en senere tilføjet celle automatisk dækket — der findes ingen cellenavns-liste i testen.
  const eoCollections = EO_CLASSIFIED_COLLECTIONS.filter((collection) =>
    productionCollectionNames.has(collection));

  it.each(eoCollections)('alle produktionsfelter i %s blokerer en gren', (collection) => {
    const childFields = productionInputFields.filter((field) =>
      // Descriptor-templaten bærer collection-navnet uden entity-id (id'et bindes pr. række).
      field.template.path.some((segment) => segment.kind === 'entity' && segment.collection === collection));

    expect(childFields.length).toBeGreaterThan(0);
    for (const field of childFields) {
      const blocked = resolveEoBlockedDependencies([rowCellIssue(collection, field.template.field)]);
      expect(
        BRANCHES.some((gren) => blocked[gren]),
        `${field.id} rammer ingen gren`
      ).toBe(true);
    }
  });
});
