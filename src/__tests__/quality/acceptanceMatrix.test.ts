/**
 * Acceptregistret for §5's 30 acceptkriterier — det maskinelt kontrollerede register.
 *
 * **Hvorfor dette register findes, og hvorfor det ikke er en manuel afkrydsning.**
 *
 * Planens Fase 7 beskrev en "manuel browsermatrix" over 15 punkter. Det afsnit blev skrevet FØR
 * fase 1-5 blev bygget, hvor inputtilstanden endnu var mount-afhængig og punkterne derfor kun KUNNE
 * observeres i en browser. Designet afskaffede netop den egenskab: §5-kriterium 22 kræver, at
 * "issues, beregninger og gates ikke afhænger af component mount", og kriterium 7, at et lukket felt
 * ingen værdibærende lokal kopi har. En manuel matrix ville måle arkitekturen med det instrument,
 * arkitekturen blev bygget for at fjerne — og et engangs-"OK" fra en menneskelig gennemgang rådner ved
 * næste commit uden at kunne fejle i CI.
 *
 * **Registret måler MÅLARKITEKTUREN, ikke rejsen dertil** (R8-F01, etape 10). Indtil da registrerede
 * filen den historiske 15-punkts Fase 7-liste. Den liste var en mellemtilstands acceptflade: dens
 * punkter grupperede interaktionsforløb ("blur, Enter, klik væk og navigation"), mens §5's kriterier
 * er de INVARIANTER, slutarkitekturen påstår at holde. Et register over den forkerte flade kan være
 * fuldstændigt grønt, mens et §5-kriterium slet ikke har en dækningskilde — hvilket det var: fem af
 * de 30 kriterier (1, 8, 22, 28, 29) havde ingen post nogen steder.
 *
 * **Registret skal selv kunne fejle.** Fase 6's dødt-værn-detektor viste, at et værn, hvis mål er
 * slettet, bliver grønt af tomhed. Et register, der kun kontrollerede at en FIL findes, har præcis den
 * svaghed: testfilen kan overleve, mens netop den `it(...)`, punktet hvilede på, er væk. Derfor
 * verificeres hvert punkt på TESTNAVN — og navnet skal tilhøre en AKTIV deklaration i den angivne fil.
 *
 * **En suite er ikke evidens i sig selv** (R8-F01). Den gamle udgave accepterede både `describe` og
 * `it` som dækningskilde. Et `describe`-navn kan bestå, efter at hver `it` under det er slettet — så
 * punktet ville stå grønt uden en eneste udførende assertion. Registret citerer derfor kun LEAF-tests
 * (`it`/`test`), og parseren kender forskellen strukturelt: en `describe`, der bærer et citeret navn,
 * afvises med en fejl, der siger hvorfor.
 *
 * Registret er et REGISTER, ikke en ny testkopi: det peger på de assertions, der allerede bor ved deres
 * egen grænse. At samle de 30 kriteriers adfærd her ville duplikere dækning frem for at ensarte
 * sporbarhed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { leafTestNames, suiteNames } from './testDeclarations';

type CoverageSource = Readonly<{
  /** Repo-relativ testfil. */
  file: string;
  /**
   * Navne på AKTIVE LEAF-tests (`it`/`test`) i filen, som bærer kriteriet. Matches som substring MOD DE
   * PARSEDE deklarationsnavne (ikke mod filens råtekst), så en omformulering af halen ikke er en falsk
   * fejl — men en slettet ELLER skippet test er. Et `describe`-navn er IKKE gyldig evidens: se filens
   * hoved og `leafTestNames` nedenfor.
   */
  tests: readonly string[];
}>;

type AcceptanceCriterion = Readonly<{
  /** Kriteriets nummer i designets §5 (1-30). */
  criterion: number;
  /** Kriteriet ORDRET fra §5, så registret ikke kan drifte fra sin egen kilde. */
  title: string;
  sources: readonly CoverageSource[];
  /**
   * En KENDT begrænsning i kriteriets dækning, med den WI der lukker den.
   *
   * Et kriterium må ikke fremstå fuldt dækket, når dets dækning beviseligt har et hul. Alternativet —
   * at lade kriteriet stå uden note — er netop den falske fuldstændighed, hele registret er bygget for
   * at udelukke. Feltet er derfor en del af registrets kontrakt, ikke en kommentar: testen nedenfor
   * kræver, at den nævnte WI-fil FINDES, så et hul ikke kan dokumenteres væk med en henvisning til en
   * opfølgning, ingen har oprettet.
   */
  knownLimitation?: Readonly<{ description: string; trackedIn: string }>;
}>;

/**
 * §5's 30 kriterier. Titlerne er kopieret ORDRET fra
 * `docs/architecture/input-architecture.md` §5 og efterprøves maskinelt nedenfor mod
 * netop den fil, så registret ikke kan komme til at beskrive en anden liste end designets.
 */
const ACCEPTANCE_CRITERIA: readonly AcceptanceCriterion[] = [
  {
    criterion: 1,
    title: 'Der findes ét autoritativt inputaggregate og én autoritativ write-grænse.',
    sources: [
      {
        // TYPEGRÆNSEN: kun manifest-nøgler kan skrives, og kun gennem den ene port.
        file: 'src/__tests__/quality/architecture/architectureRules.test.ts',
        tests: ['ingen arkitektur-overtrædelser i kilde-grafen'],
      },
      {
        file: 'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
        tests: ['ét gyldigt settle: canonical skrives, ét store-write, én monoton revision'],
      },
      {
        // Fraværet af en PARALLEL write-grænse. Uden dette ben kunne kriteriet være grønt, mens en
        // anden aggregate-vej levede ved siden af.
        file: 'src/__tests__/quality/deletionLedger.test.ts',
        tests: ['den forkastede parallelle inputmodel i src/input/ findes ikke'],
      },
    ],
  },
  {
    criterion: 2,
    title: 'Ugyldigt settle fjerner den tidligere canonical værdi fra current state; den findes kun i undo-history.',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: ['gyldig A → ugyldig X efterlader ikke A i current snapshot'],
      },
      {
        file: 'src/__tests__/inputCore/stateChains.test.ts',
        tests: ['hvert trin i kæden har den forventede tilstand i alle ni aspekter', 'matricen dækker præcis designets otte kæder'],
      },
    ],
  },
  {
    criterion: 3,
    title: 'Samme current felt kan ikke have både ikke-tom canonical værdi og rejected raw.',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: [
          'afviser en kandidat med både rejected råtekst og en ikke-tom canonical værdi',
          'ugyldig råtekst → tomt settle rydder rejected uden at genoplive en gammel canonical værdi',
        ],
      },
      {
        file: 'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
        tests: ['ugyldigt settle rydder canonical til tomværdi OG skriver rå fejlende tekst atomisk'],
      },
    ],
  },
  {
    criterion: 4,
    title: 'Åben draft ændrer aldrig afsluttet visning, fejl, beregning eller gate.',
    sources: [
      {
        file: 'src/__tests__/inputCore/editor/fieldEditor.test.ts',
        tests: ['åben draft ændrer intet afsluttet input eller revision'],
      },
      {
        file: 'src/__tests__/inputCore/react/fieldContract.surfaces.test.tsx',
        tests: ['åben draft ændrer intet afsluttet'],
      },
    ],
  },
  {
    criterion: 5,
    title: 'Eksisterende feltfejl forbliver synlig under redigering; nye fejl vises først efter settle.',
    sources: [
      {
        file: 'src/__tests__/inputCore/editor/fieldEditor.test.ts',
        tests: ['eksisterende rød fejl bliver stående uændret under redigering'],
      },
      {
        file: 'src/__tests__/inputCore/react/fieldContract.surfaces.test.tsx',
        tests: ['eksisterende rød fejl bliver stående under redigering'],
      },
      {
        file: 'src/__tests__/inputCore/react/fieldShells.test.tsx',
        tests: ['bevarer den røde feltmarkering, mens grid-cellen er åben'],
      },
    ],
  },
  {
    criterion: 6,
    title: 'Form og grid bruger samme editor og codec; deres adaptere ejer kun interaktion/rendering/navigation.',
    sources: [
      {
        // §7.1's FÆLLES kontrakt: ÉN invariantliste, kørt mod BEGGE adaptere for hver codecfamilie
        // (R8-F02). Uden en fælles suite ville kriteriet være målt af to uafhængige suiter, der
        // tilfældigvis hver dækkede sin halvdel.
        file: 'src/__tests__/inputCore/react/fieldContract.surfaces.test.tsx',
        tests: ['gyldigt settle skriver ny canonical', 'ugyldigt settle er XOR'],
      },
      {
        file: 'src/__tests__/quality/architecture/architectureRules.test.ts',
        tests: ['ingen arkitektur-overtrædelser i kilde-grafen'],
      },
    ],
  },
  {
    criterion: 7,
    title: 'Et lukket felt har ingen værdibærende lokal kopi, pending guard, fingerprint eller resync-effect.',
    sources: [
      {
        file: 'src/__tests__/inputCore/react/fieldContract.surfaces.test.tsx',
        tests: ['lukket felt viser canonical fra revisionen uden lokal kopi'],
      },
      {
        // Fraværet af MEKANISMERNE (pending guard/fingerprint/resync-effect) som struktur.
        file: 'src/__tests__/quality/architecture/deletedLegacyAbsence.test.ts',
        tests: ['hvert forbudt legacy-navn er dødt som identifier i produktionen'],
      },
    ],
  },
  {
    criterion: 8,
    title: 'Alle persisted feltadresser er strukturelle og uafhængige af DOM/kolonneindeks.',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: ['afviser dubleret felt-id', 'afviser et entity-felt uden registreret parentsamling'],
      },
      {
        // Adressen udledes af collectionens STI, ikke af kolonneindeks eller DOM (UT-F04).
        file: 'src/__tests__/inputCore/react/cellSpecBuilder.test.ts',
        tests: [
          'NESTED: adressen har BÅDE ansættelsesforholdets og rækkens entity-id',
          'eksisterende og placeholder for SAMME række-id giver identisk feltadresse',
        ],
      },
      {
        file: 'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
        tests: ['en placeholder-promoveret række med fejlende felt overlever reload'],
      },
    ],
  },
  {
    criterion: 9,
    title: 'Format- og bounds-feltfejl har identisk UI-, beregnings- og dokumentgate; kun beskeder varierer.',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: ['format og bounds giver begge en rød feltfejl, der skjuler værdien for consumers'],
      },
      {
        file: 'src/__tests__/document/documentGateMatrix.test.ts',
        tests: [
          'klasse INVALID (format): uparselig råtekst i årstallet blokerer',
          'klasse BOUNDS: et parseligt årstal uden for satshorisonten blokerer',
        ],
      },
    ],
  },
  {
    criterion: 10,
    title: 'Aktivt relevant rejected input blokerer `.eo` globalt; canonical feltissues blokerer ikke `.eo`.',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: [
          'format er rejected råtekst (canonical ryddet) og blokerer .eo strukturelt',
          'bounds bevarer den canonical værdi, blokerer IKKE .eo',
        ],
      },
      {
        file: 'src/__tests__/inputCore/stateChains.test.ts',
        tests: ['hvert trin i kæden har den forventede tilstand i alle ni aspekter'],
      },
    ],
  },
  {
    criterion: 11,
    title: 'Tomhed giver aldrig rød feltfejl og blokerer aldrig `.eo`.',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: ['et tomt felt giver ingen rød feltfejl og blokerer ikke .eo'],
      },
      {
        file: 'src/__tests__/inputCore/stateChains.test.ts',
        tests: ['hvert trin i kæden har den forventede tilstand i alle ni aspekter'],
      },
    ],
  },
  {
    criterion: 12,
    title: 'Missing kan blokere en afhængig beregning eller et dokument gennem contentboxen.',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: ['en consumer, der kræver et tomt felt, får en missing-consumerfejl'],
      },
      {
        file: 'src/__tests__/document/documentGateMatrix.test.ts',
        tests: ['klasse MISSING: intet årstal blokerer'],
      },
    ],
  },
  {
    criterion: 13,
    title: 'Warning blokerer aldrig beregning, dokument eller `.eo`.',
    sources: [
      {
        // ÆGTE warning-fixtures over alle fire konsekvenskanaler (R8-F05). Den tidligere kilde
        // (`documentGateMatrix`' "warnings blokerer intet") skabte slet ingen warning — den committede
        // en IRRELEVANT bounds-fejl, altså kriterium 15's dimension. Warnings dannes i domænerne, og
        // det er dér, invarianten nu er målt.
        file: 'src/__tests__/document/documentGateMatrix.test.ts',
        tests: [
          'en ÆGTE domæne-warning blokerer hverken beregning, dokumentgate eller .eo',
          'en blocked projektion kalder ALDRIG beregningsmotoren',
        ],
      },
      {
        file: 'src/__tests__/domain/erhvervsevnetab/erhvervsevnetabDownloadGate.test.ts',
        tests: ['tillader download trods en warning (warnings blokerer aldrig'],
      },
      {
        file: 'src/__tests__/domain/eoRowEvaluation/eoRowSeverity.test.ts',
        tests: ['returns max EO row status from integrity issues'],
      },
    ],
  },
  {
    criterion: 14,
    title: 'Gyldigt skjult brugerinput bevares; fejlende skjult input ryddes atomisk med det styrende valg.',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: [
          'rydder et felt, der bliver irrelevant OG havde en aktiv rød bounds-fejl',
          'bevarer en GYLDIG værdi, der bliver irrelevant',
        ],
      },
      {
        file: 'src/__tests__/inputCore/stateChains.test.ts',
        tests: ['hvert trin i kæden har den forventede tilstand i alle ni aspekter', 'matricen dækker præcis designets otte kæder'],
      },
      {
        file: 'src/__tests__/domain/erstatningsopgoerelse/eoHiddenFieldPersistence.test.ts',
        tests: ['bevarer ALLE skjulte felter gennem save→load-round-trip'],
      },
    ],
  },
  {
    criterion: 15,
    title: 'Uafhængige beregninger og dokumenter overblokeres ikke.',
    sources: [
      {
        file: 'src/__tests__/document/documentGateMatrix.test.ts',
        tests: [
          'klasse IKKE-RELEVANT: en fejl i en fremmed sektion blokerer IKKE',
          'klasse IKKE-RELEVANT: en fejl i satser-sektionen blokerer IKKE',
        ],
      },
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: ['en fejl i række 1 blokerer ikke projektionen af række 2'],
      },
    ],
  },
  {
    criterion: 16,
    title: 'En blokeret ny revision viser ikke et tidligere resultat som gyldigt.',
    sources: [
      {
        file: 'src/__tests__/domain/aarsloen/aarsloenProjection.test.ts',
        tests: [
          'blokeret gate → ingen beregning (motoren kaldes ikke)',
          'ugyldig celle i en medregnet række blokerer det samlede resultat',
        ],
      },
      {
        file: 'src/__tests__/document/documentLifecycleMatrix.test.ts',
        tests: ['case: revisionen flytter MELLEM settle og kildeoptagelse → afvist i capture-fasen'],
      },
    ],
  },
  {
    criterion: 17,
    title: 'Rækkeprojektioner isolerer andre rækker; aggregater inkluderer alle valgte rækker.',
    sources: [
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: [
          'en fejl i række 1 blokerer ikke projektionen af række 2',
          'en aggregatprojektion, der inkluderer den fejlende række, blokeres',
        ],
      },
    ],
  },
  {
    criterion: 18,
    title: 'Første fejlende settle i placeholder-række overlever F5.',
    sources: [
      {
        file: 'src/__tests__/inputCore/react/gridAdapter.test.tsx',
        tests: ['første ugyldige settle promoverer rækken med rejected råtekst'],
      },
      {
        file: 'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
        tests: ['en placeholder-promoveret række med fejlende felt overlever reload'],
      },
    ],
  },
  {
    criterion: 19,
    title: 'Row-delete fjerner alle descendants atomisk og kan undo\'es fuldstændigt.',
    sources: [
      {
        file: 'src/__tests__/inputCore/stateChains.test.ts',
        tests: ['hvert trin i kæden har den forventede tilstand i alle ni aspekter', 'matricen dækker præcis designets otte kæder'],
      },
      {
        file: 'src/__tests__/inputCore/react/gridAdapter.test.tsx',
        tests: ['row-delete fjerner rækkens rejected descendants atomisk'],
      },
      {
        // §7.4's artspecifikke row-delete-invariant. De generiske per-command-invarianter kører under
        // `describe.each` med dynamiske navne og kan derfor ikke citeres (se `stateChains`-noten);
        // denne leaf bærer netop descendant-/orphan-påstanden med sit eget faste navn.
        file: 'src/__tests__/inputCore/runtime/commandInvariants.test.ts',
        tests: ['row-delete efterlader hverken rejected descendants eller orphan-adresser'],
      },
    ],
  },
  {
    criterion: 20,
    title: 'Hver reel inputhandling giver én revision og højst ét history-trin.',
    sources: [
      {
        // EXHAUSTIVT over hver runtime-command-kind (R8-F04), ikke kun `settleField`.
        file: 'src/__tests__/inputCore/runtime/commandInvariants.test.ts',
        tests: [
          'giver ÉN monoton revision og HØJST ét history-trin',
          'semantisk no-op giver intet write, ingen revision og intet history-trin',
        ],
      },
      {
        file: 'src/__tests__/inputCore/inputCore.test.ts',
        tests: ['samler flere commands i én atomisk reducerændring og ét history-trin'],
      },
    ],
  },
  {
    criterion: 21,
    title: 'Undo/redo/load/reset skaber nye monotone revisioner.',
    sources: [
      {
        file: 'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
        tests: [
          'gyldig A → ugyldig X → undo → redo gendanner hele tilstandene, hver med en ny revision',
          'autoritativ replacement (replaceCase) skriver altid, rydder history og skaber ny revision',
        ],
      },
      {
        file: 'src/__tests__/inputCore/runtime/commandInvariants.test.ts',
        tests: ['giver ÉN monoton revision og HØJST ét history-trin'],
      },
    ],
  },
  {
    criterion: 22,
    title: 'Issues, beregninger og gates afhænger ikke af component mount.',
    sources: [
      {
        // Den DIREKTE måling: samme input evalueret UDEN noget React-træ giver samme issues, samme
        // projektionsstatus og samme dokumentgate som gennem den monterede side.
        file: 'src/__tests__/inputCore/mountIndependence.test.tsx',
        tests: [
          'issues, projektion og dokumentgate er identiske med og uden et monteret komponenttræ',
          'unmount af siden ændrer intet issue, ingen projektion og ingen dokumentgate',
        ],
      },
      {
        file: 'src/__tests__/quality/architecture/architectureRules.test.ts',
        tests: ['ingen arkitektur-overtrædelser i kilde-grafen'],
      },
    ],
  },
  {
    criterion: 23,
    title: '`.eo` indeholder kun schema-gyldigt canonical brugerinput og aldrig rejected raw.',
    sources: [
      {
        file: 'src/__tests__/utils/eoFileCodec.test.ts',
        tests: ['afkoder præcis det encode byggede'],
      },
      {
        file: 'src/__tests__/utils/fileRoundTrip.fullState.test.ts',
        tests: ['alle sektioner overlever ægte kryptering→fil→load uden datatab'],
      },
      {
        file: 'src/__tests__/inputCore/stateChains.test.ts',
        tests: ['hvert trin i kæden har den forventede tilstand i alle ni aspekter', 'matricen dækker præcis designets otte kæder'],
      },
    ],
  },
  {
    criterion: 24,
    title: '`.eo`-load er tolerant; browser-sessioner har ingen legacy-kompatibilitet.',
    sources: [
      {
        file: 'src/__tests__/utils/fileLoad.normalLoad.test.ts',
        tests: ['forward-tolerance'],
      },
      {
        file: 'src/__tests__/inputCore/runtime/dispatchInput.test.ts',
        tests: [
          'afviser en anden persisted dataversion som current-session-korruption',
          'fail-closer en envelope med anden persisted dataversion og bevarer de rå bytes',
        ],
      },
    ],
  },
  {
    criterion: 25,
    title: 'Navigation settler begge surfaces; load/reset/clear gennemføres uden settle og kasserer kun åben draft '
      + 'ved succes.',
    sources: [
      {
        // Form OG grid gennem de ÆGTE editorer for hver kritisk handling (R8-F06). De syntetiske
        // coordinator-tests nedenfor beviser mekanismen; denne beviser integrationen.
        file: 'src/__tests__/inputCore/react/criticalActionSurfaceParity.test.tsx',
        tests: [
          'navigation settler den åbne editor',
          'load kasserer draften ved succes og bevarer den ved fejl',
        ],
      },
      {
        file: 'src/__tests__/inputCore/runtime/criticalActionCoordinator.test.ts',
        tests: [
          'klargør load uden at settle eller kassere draften',
          'kasserer draften efter en vellykket replacement',
        ],
      },
    ],
  },
  {
    criterion: 26,
    title: 'Save/download settler og evaluerer friskt input-/settingssnapshot før fil-/generatorarbejde.',
    sources: [
      {
        file: 'src/__tests__/document/documentLifecycleMatrix.test.ts',
        tests: [
          'case: åben draft der settler GYLDIGT → hele kæden kører og leverer filen',
          'case: revisionen flytter MELLEM settle og kildeoptagelse → afvist i capture-fasen',
        ],
      },
      {
        file: 'src/__tests__/inputCore/react/criticalActionSurfaceParity.test.tsx',
        tests: ['save settler den åbne draft og ser den nye værdi'],
      },
      {
        file: 'src/__tests__/document/runtime/mineoDocumentEnvironment.test.ts',
        tests: [
          'læser settings på CAPTURE-tidspunktet, ikke ved konstruktionen',
          'optager evaluering og settings i samme kald, så de to halvdele ikke kan divergere',
        ],
      },
    ],
  },
  {
    criterion: 27,
    title: 'Alle 18 dokumentoutputs bruger samme definition til reaktiv gate og click-preflight.',
    // Kriteriets tidligere `knownLimitation` er FJERNET, fordi begrænsningen er lukket ved roden
    // (R6-F03/R0-F03): formatet er ikke længere synligt i projektionskonteksten, så spørgsmålet
    // "nåede fixturen ready-grenen?" er blevet irrelevant. En gate KAN ikke læse formatet — det er en
    // compilerfejl, bevist af en rigtig oversættelse af en virtuel definition mod det ægte program.
    sources: [
      {
        file: 'src/__tests__/document/documentCatalogCompleteness.test.ts',
        tests: [
          'ét id = ét output på tværs af begge apps',
          'alle 21 statiske outputs kan kun aktiveres gennem en lukket DocumentAction',
        ],
      },
      {
        // Gate = preflight for HVER af de 18 definitioner (R6-F04). Kontrakten lovede det for alle
        // atten; målingen dækkede fire.
        file: 'src/__tests__/document/documentGatePreflightParity.test.ts',
        tests: ['reaktiv gate og click-preflight giver samme udfald for alle 18 outputs'],
      },
      {
        // Formatblindheden er en TYPEGRÆNSE efter R6-F03 og måles med en rigtig oversættelse frem for
        // med 18 fixture-sammenligninger. Kontrolprøven citeres med, fordi den er det, der gør
        // TS2339-assertionen til evidens og ikke til tilfældighed.
        file: 'src/__tests__/document/documentGateFormatInvariance.test.ts',
        tests: [
          'en gate, der læser downloadformatet, kan ikke kompilere',
          'kontrolprøve: samme definition UDEN formatlæsning kompilerer rent',
          'gate-settings bærer KUN rækkepolitikken — hverken format eller brevhoved',
          'formatet når fortsat writer-valget gennem render-settings',
        ],
      },
      {
        file: 'src/__tests__/document/documentLifecycleMatrix.test.ts',
        tests: ['case: direkte programmatisk aktivering går gennem PRÆCIS samme kæde som et klik'],
      },
    ],
  },
  {
    criterion: 28,
    title: 'Ingen beregnings-, save- eller dokumentkode kan importere raw canonical sections.',
    sources: [
      {
        // Alle fire adgangsformer (element/property/reference-spread/destrukturering) som AST — R5-F02.
        file: 'src/__tests__/quality/architecture/architectureRules.test.ts',
        tests: ['ingen arkitektur-overtrædelser i kilde-grafen', 'anti-rot: hver allowlist-post udløser stadig sin regel'],
      },
    ],
  },
  {
    criterion: 29,
    title: 'Ingen permanent compatibility-facade, dual-read, dual-write eller fallback eksisterer.',
    sources: [
      {
        file: 'src/__tests__/quality/architecture/deletedLegacyAbsence.test.ts',
        tests: [
          'ingen produktionsfil er en compatibility-facade (@deprecated / Legacy-eksport / dual-read)',
          'ingen produktionsfil er en ren re-export-facade (struktur, ikke navn)',
        ],
      },
      {
        file: 'src/__tests__/quality/deletionLedger.test.ts',
        tests: ['ingen sti fra det kanoniske legacy-modulmanifest findes fysisk'],
      },
    ],
  },
  {
    criterion: 30,
    title: 'Kontrakter, kode, tests, ledger og arkitekturværn beskriver samme model.',
    sources: [
      {
        file: 'src/__tests__/quality/contractCoverageMatrix.test.ts',
        tests: [
          'har mindst én koblet test-suite pr. normativ kontraktfil',
          'holder kontrakttopologi og dækningsmatrix synkroniseret begge veje',
        ],
      },
      {
        file: 'src/__tests__/quality/architecture/architectureRules.test.ts',
        tests: [
          'dødt værn: hver forudsætningsregel har stadig en fil, den ville kontrollere',
          'liveness: ingen forudsætningsprobe kan opfyldes af ren kommentartekst',
        ],
      },
    ],
  },
];

const readFile = (relativePath: string): string =>
  fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');

const DESIGN_DOC = 'docs/architecture/input-architecture.md';

/**
 * Læser §5's nummererede kriterier ud af arkitekturdokumentet.
 *
 * Registrets titler er ikke dekoration: de er den påstand, hvert kriterium dækker. Uden denne kobling
 * kunne §5 omformuleres eller udvides, mens registret uforstyrret blev ved med at måle en anden liste
 * — samme fejlklasse som det 15-punkts-register, R8-F01 afløste, blot et niveau højere.
 */
const parseDesignCriteria = (): ReadonlyMap<number, string> => {
  const lines = readFile(DESIGN_DOC).split(/\r?\n/);
  const start = lines.findIndex((line) => /^##\s+5\.\s/.test(line));
  if (start < 0) throw new Error(`${DESIGN_DOC}: §5-overskriften findes ikke`);
  const end = lines.findIndex((line, index) => index > start && /^##\s/.test(line));
  const body = lines.slice(start + 1, end < 0 ? lines.length : end);

  const parsed = new Map<number, string>();
  let current: number | null = null;
  for (const line of body) {
    const numbered = /^(\d+)\.\s+(.*)$/.exec(line);
    if (numbered !== null) {
      current = Number(numbered[1]);
      parsed.set(current, numbered[2].trim());
      continue;
    }
    // Fortsættelseslinje i et ombrudt kriterium (fx kriterium 25).
    const continuation = /^\s{2,}(\S.*)$/.exec(line);
    if (continuation !== null && current !== null) {
      parsed.set(current, `${parsed.get(current)!} ${continuation[1].trim()}`);
      continue;
    }
    if (line.trim() === '') continue;
    current = null;
  }
  return parsed;
};

describe('§5-acceptregister (målarkitekturens 30 kriterier)', () => {
  it('dækker præcis kriterium 1-30 uden huller eller dubletter', () => {
    expect(ACCEPTANCE_CRITERIA.map((entry) => entry.criterion))
      .toEqual(Array.from({ length: 30 }, (_, index) => index + 1));
  });

  /**
   * Registret er bundet til designets §5 ORDRET. Det er den kontrol, der gør registret til et register
   * over MÅLARKITEKTUREN og ikke over sin egen liste: udvides §5 til 31 kriterier, eller omformuleres
   * et kriterium, bliver denne test rød med nummeret.
   */
  it('hvert kriterium citerer designets §5 ordret — registret kan ikke drifte fra sin kilde', () => {
    const design = parseDesignCriteria();
    expect(
      [...design.keys()].sort((left, right) => left - right),
      `${DESIGN_DOC} §5 indeholder ikke præcis 30 nummererede kriterier`
    ).toEqual(Array.from({ length: 30 }, (_, index) => index + 1));

    for (const entry of ACCEPTANCE_CRITERIA) {
      expect(
        entry.title,
        `kriterium ${entry.criterion}: registrets titel afviger fra ${DESIGN_DOC} §5`
      ).toBe(design.get(entry.criterion));
    }
  });

  it('hvert kriterium har mindst én dækningskilde', () => {
    for (const entry of ACCEPTANCE_CRITERIA) {
      expect(
        entry.sources.length,
        `kriterium ${entry.criterion} (${entry.title}) mangler kilde`
      ).toBeGreaterThan(0);
      for (const source of entry.sources) {
        expect(
          source.tests.length,
          `kriterium ${entry.criterion}: ${source.file} uden testnavne`
        ).toBeGreaterThan(0);
      }
    }
  });

  /**
   * En kendt begrænsning skal spores i en WI, der FINDES. Ellers kunne et dækningshul erklæres
   * "håndteret" med en henvisning til en opfølgning, ingen har oprettet — en påstand uden dækning,
   * hvilket er samme fejlklasse som resten af registret værner mod.
   */
  it('hver kendt begrænsning peger på en WI-fil, der findes', () => {
    const withLimitation = ACCEPTANCE_CRITERIA.filter((entry) => entry.knownLimitation !== undefined);
    for (const entry of withLimitation) {
      const limitation = entry.knownLimitation!;
      expect(limitation.description.trim(), `kriterium ${entry.criterion}: tom begrænsningsbeskrivelse`).not.toBe('');
      expect(
        fs.existsSync(path.resolve(process.cwd(), limitation.trackedIn)),
        `kriterium ${entry.criterion}: begrænsningen henviser til ${limitation.trackedIn}, som ikke findes`
      ).toBe(true);
    }
    // **Der er INGEN kendte begrænsninger tilbage.** Kriterium 27's var den sidste, og den blev
    // lukket ved roden 2026-07-29 (R6-F03/R0-F03): formatet er fjernet fra projektionskonteksten, så
    // hullet i dens dækning ikke længere findes at måle.
    //
    // Assertionen er bevidst BEVARET frem for slettet med noten. Feltet `knownLimitation` findes
    // stadig i registrets kontrakt, og en tom liste er en påstand, der kan brydes: skrives en ny
    // begrænsning ind, bliver netop denne linje rød, så tilføjelsen skal ses og begrundes frem for at
    // kunne glide ind som en note. Var assertionen fjernet, ville registret være tilbage ved den
    // falske fuldstændighed, hele filen er bygget for at udelukke.
    expect(
      withLimitation.map((entry) => entry.criterion),
      'en ny kendt begrænsning skal begrundes her, ikke blot skrives ind'
    ).toEqual([]);
  });
});

// AST-parseren for aktive testdeklarationer bor i `./testDeclarations`, fordi `testNamingConvention.test.ts`
// har brug for PRÆCIS samme sondringer (arvet skip, leaf vs. suite, dynamiske navne). En kopi pr. konsument
// ville være to udgaver af den samme svære sondring.
describe('§5-acceptregister — kilde-verifikation', () => {
  /**
   * Kernekontrollen. En ren fil-eksistens-check ville bestå, selv om netop den test, kriteriet hviler
   * på, var slettet — filen kan sagtens overleve sin relevante `it(...)`. Derfor kontrolleres, at
   * navnet hører til en AKTIV LEAF-test.
   */
  it('hver angivet test findes som en aktiv LEAF-test (registret kan ikke blive grønt af tomhed)', () => {
    for (const entry of ACCEPTANCE_CRITERIA) {
      for (const source of entry.sources) {
        const absolute = path.resolve(process.cwd(), source.file);
        expect(fs.existsSync(absolute), `kriterium ${entry.criterion}: mangler fil ${source.file}`).toBe(true);
        const content = readFile(source.file);
        const leaves = leafTestNames(content, source.file);
        expect(
          leaves.length,
          `kriterium ${entry.criterion}: ${source.file} har ingen aktive leaf-tests`
        ).toBeGreaterThan(0);
        for (const testName of source.tests) {
          if (leaves.some((name) => name.includes(testName))) continue;
          // Særskilt, sigende fejl for den ene form, den gamle udgave accepterede: et suitenavn.
          const asSuite = suiteNames(content, source.file).some((name) => name.includes(testName));
          expect(
            false,
            asSuite
              ? `kriterium ${entry.criterion} (${entry.title}): "${testName}" i ${source.file} er en SUITE, `
                + 'ikke en leaf-test. Et suitenavn overlever sletningen af hver test under det og er '
                + 'derfor ikke evidens — citér den konkrete it(...).'
              : `kriterium ${entry.criterion} (${entry.title}): ingen AKTIV leaf-test i ${source.file} hedder `
                + `noget, der indeholder "${testName}". Er testen omdøbt, opdatér registret; er den slettet `
                + 'eller skippet, er kriteriet UDÆKKET.'
          ).toBe(true);
        }
      }
    }
  });

  /**
   * Modsat retning: kontrollen skal kunne FEJLE. Et prædikat, der ikke kan afvise et navn, som
   * beviseligt IKKE er deklareret, ville bestå alt (jf. Fase 6's `verifyAbsent`-lære).
   */
  it('kontrollen afviser et navn, der ikke er en aktiv deklaration — prædikatet er ikke vakuøst', () => {
    const file = 'src/__tests__/inputCore/editor/fieldEditor.test.ts';
    const leaves = leafTestNames(readFile(file), file);
    // Et navn, der IKKE findes, afvises.
    expect(leaves.some((name) => name.includes('dette testnavn findes bevisligt ikke'))).toBe(false);
    // Et navn, der findes, genkendes — ellers var prædikatet blot altid falsk.
    expect(leaves.some((name) => name.includes('Escape lukker uden command'))).toBe(true);
    // Og en SUITE i samme fil er ikke en leaf: det er præcis den form, R8-F01 afviste som evidens.
    expect(leaves.some((name) => name.includes('felt-editor-state-machine'))).toBe(false);
    expect(suiteNames(readFile(file), file).some((name) => name.includes('felt-editor-state-machine'))).toBe(true);
  });

  it('parseren skelner leaf fra suite og medtager ikke skippede tests, arvet skip eller kommentarer', () => {
    // Syntetisk kilde, så parseren prøves i BEGGE retninger uden at afhænge af, at produktionen
    // tilfældigvis indeholder de svære former. De to arvede-skip-cases er præcis dem, den tidligere
    // regex-baserede version FALDT på (verificeret ved probe før rettelsen).
    const synthetic = [
      "it('aktiv test', () => {});",
      "it.skip('skippet test', () => {});",
      "describe.todo('todo-suite');",
      "it.each([1])('parametriseret test', () => {});",
      "it.only('only-test', () => {});",
      "it.skipIf(true)('skipIf-test', () => {});",
      "it.runIf(true)('runIf-test', () => {});",
      // ARVET skip: den indlejrede `it` består sit eget linjefilter, men suiten er skippet.
      "describe.skip('skippet suite', () => {",
      "  it('indlejret i skippet suite', () => {});",
      '});',
      // En aktiv suite skal derimod IKKE smitte sine børn med skip.
      "describe('aktiv suite', () => {",
      "  it('indlejret i aktiv suite', () => {});",
      '});',
      // Kommentar og strengliteral er ikke deklarationer.
      "// it('navn i linjekommentar', () => {});",
      "const s = \"it('navn i strengliteral', () => {})\";",
      // Dynamisk navn: de statiske dele er evidens, interpolationen kan ingen registerpost kende.
      'it(`${x}: dynamisk navn med statisk hale`, () => {});',
      'it.skip(`${x}: skippet dynamisk navn`, () => {});',
      // En TØMT suite: navnet lever, men der er ingen udførende assertion under det. Det er præcis den
      // form, R8-F01 fandt — og som registret nu ikke kan citere.
      "describe('tømt suite uden tests', () => {});",
    ].join('\n');

    const leaves = leafTestNames(synthetic, 'synthetic.ts');
    const suites = suiteNames(synthetic, 'synthetic.ts');

    expect(leaves).toContain('aktiv test');
    expect(leaves).toContain('parametriseret test');
    expect(leaves).toContain('only-test');
    expect(leaves).toContain('runIf-test');
    expect(leaves).toContain('indlejret i aktiv suite');

    expect(leaves).not.toContain('skippet test');
    expect(leaves).not.toContain('todo-suite');
    expect(leaves).not.toContain('skipIf-test');
    expect(leaves).not.toContain('indlejret i skippet suite');
    expect(leaves).not.toContain('navn i linjekommentar');
    expect(leaves).not.toContain('navn i strengliteral');

    // Suitenavne er IKKE leaf-evidens — hverken den aktive eller den tømte.
    expect(leaves).not.toContain('aktiv suite');
    expect(leaves).not.toContain('tømt suite uden tests');
    expect(suites).toContain('aktiv suite');
    expect(suites).toContain('tømt suite uden tests');
    expect(suites).not.toContain('skippet suite');

    // Dynamiske navne: statisk hale medtages, men ikke hvis deklarationen er skippet.
    expect(leaves.some((name) => name.includes('dynamisk navn med statisk hale'))).toBe(true);
    expect(leaves.some((name) => name.includes('skippet dynamisk navn'))).toBe(false);
  });
});
