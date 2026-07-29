# R4 — Persistence, session, `.eo` og undo/redo

**Status:** Delvist gennemgået  
**Dato:** 2026-07-28  
**Dækket:** `.eo`-save/load og preflight; current-session-envelope og korruptionshåndtering;
inputrollback; critical-action replacement; reset/`Slet alt`; undo/redo og revisioner; storage-manifest;
persistence-porte og stabil source-capture  
**Angreb udført:** stale source under save; rejected/canonical-læk; apply- og metadatafejl under load;
storage-/store-uoverensstemmelse; korrupt current-session; asynkron editorudskiftning under load;
ufuldstændig reset; legacy-/sentinel-/rå store-adgang; manglende revision og rollback  
**Evidens:** 12 målrettede testfiler/253 tests grønne; AST-/tekstforespørgsler efter envelope-, storage-,
legacy- og rå store-bypass; statisk call-chain-analyse af load/replacement og `Slet alt`; working tree
kontrolleret før rapportering  
**Fund:** 2 (R4-F01, R4-F02)  
**Hypoteser:** Ingen  
**Handling:** Begge fund **rettet 2026-07-29 (etape 8)** — se den enkelte fundnote  
**Næste skridt:** luk de udestående end-to-end- og browsercheckpoints (de to integritetsbrud er lukket)

### R4-F01 — Load kan kassere en ny draft efter replacement

**Lokation:** `src/hooks/useFileSaveLoad.ts:198-206`;
`src/utils/persistenceLoadApply.ts:47-76`;
`src/inputCore/runtime/criticalActionCoordinator.ts:86-99`  
**Problem:** `applyReplacement` omslutter hele den asynkrone load-operation. Sagsinput erstattes synkront,
men filhåndtags- og PWA-metadata afventes bagefter. Først når disse awaits er afsluttet, henter
coordinatoren den aktuelt registrerede editor og kalder `discard()`. Den fastholder ikke identiteten på
editoren, der var åben før replacement. En bruger kan derfor nå at åbne og redigere et felt i den netop
indlæste sag, hvorefter denne nye draft kasseres.  
**Evidens:** `executePersistenceLoadApply` kalder `applySnapshot(fullSnapshot)` ved linje 52 og afventer
derefter IndexedDB/PWA ved linje 64-75. `CriticalActionCoordinator.applyReplacement` afventer hele
callbacken ved linje 91 og kalder derefter `this.registry.getEditing()?.discard()` ved linje 95.
Coordinator-testene dækker succes og fejl med samme registrerede editor, men ikke et editorskifte under
et asynkront apply.  
**Angrebet der fandt det:** Editoridentitet blev udskiftet logisk mellem autoritativ replacement og
afslutningen af den efterfølgende metadatafase.  
**Konsekvens:** Brugerens åbne, nye input i den indlæste sag kan forsvinde lydløst.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Tegn på et bredere transaktionsproblem: input-replacement og efterfølgende
metadata-synkronisering behandles som én critical action, selv om kun den første del ejer draft-discard.  
**Overvejelse:** `discard` skal målrettes den draft, handlingen faktisk erstatter; et senere registry-opslag
er ikke en stabil identitet.  
**Anbefaling:** Adskil den synkrone inputtransaktion fra den asynkrone metadatafase, eller fasthold og
valider den oprindelige editoridentitet før discard.  
**Forslag til løsning:** Gennemfør autoritativ replacement og discard af præcis den før-handlingen-aktive
editor atomisk. Kør derefter filnavns-, filhåndtags- og PWA-synkronisering uden adgang til editorregistry.
Tilføj en regressionstest, som registrerer en ny editor, mens metadata-promise er pending.  
**Kræver godkendelse:** Nej — rettelsen forhindrer utilsigtet datatab uden at ændre tilsigtet UI/UX eller
beregningslogik.  
**Status:** **Rettet 2026-07-29 (etape 8)**

**Rettelsen.** Begge halvdele af anbefalingen er gennemført, og den ene er en TYPEÆNDRING frem for et ekstra
check:

1. *Fasen er flyttet ud af barrieren.* `executePersistenceLoadApply` er delt i
   `applyAuthoritativeLoadSnapshot` (SYNKRON, den autoritative apply) og `synchronizeLoadMetadata` (asynkron,
   filnavn/filhåndtag/PWA). `CriticalActionCoordinator.applyReplacement`/`applyDestructive` tager nu
   `() => T` frem for `() => T | Promise<T>`, så en asynkron apply inde i barrieren er en **compilerfejl**.
   Metadatafasen kan derfor ikke længere holde draft-discard åben, mens brugeren redigerer den indlæste sag.
2. *Identiteten er fastholdt.* `discardReplacedDraft` kasserer PRÆCIS den editor, der var registreret, da
   handlingen begyndte, og kun hvis den stadig er den registrerede. Var ingen editor åben, findes der ingen
   draft at kassere; er en ny åbnet undervejs, tilhører den den nye sag.

**Dækning:** 2 nye coordinator-tests (editor udskiftet under replacement; ingen editor ved start), 2 nye
`useFileSaveLoad`-tests (replacement ER gennemført mens metadatafasen stadig venter; metadata-advarsel efter
gennemført apply) og den omskrevne `persistenceLoadApply.test.ts`, hvor rækkefølge-invarianten "metadata kører
aldrig for en sag, der ikke blev indlæst" nu er en konsekvens af opdelingen frem for af en intern try/catch.

### R4-F02 — `Slet alt` accepterer ufuldstændig oprydning som succes

**Lokation:** `src/hooks/useFileSaveLoad.ts:473-505`;
`src/utils/fileHandleStorage.ts:160-193`;
`src/config/storageManifest.ts:45-52`;
`src/components/pages/erstatningsopgoerelse/OffentligeYdelserTab.tsx:94-126`;
`src/contracts/persistence-contract.md:85-87`  
**Problem:** `Slet alt` rydder først input og historik, men ignorerer derefter boolean-resultaterne fra
sessionStorage- og IndexedDB-oprydning. `deleteFileHandleFromIndexedDB` omsætter selv fejl til `false`,
så flowet fortsætter til “Alt data slettet”. Samtidig fjernes kun filnavnsnøglerne; den manifest-ejede,
sagsnære hjælpetilstand `eoOffentligeYdelserHelpers` bliver liggende og hydreres igen i en ny tom sag.  
**Evidens:** `ops.reset.clearAll()` kaldes ved linje 487, mens resultaterne fra
`removeOptionalSessionStorageValue` og `deleteFileHandleFromIndexedDB` ved linje 488-490 ikke kontrolleres.
IndexedDB-helperen returnerer `false` ved manglende storage eller fejl. Manifestet ejer
`ui_eoOffentligeYdelserHelpers`, og fanen læser nøglen ved mount. Persistence-kontrakten kræver, at
`Slet alt` rydder inputenvelopen og Mineo-ejet UI-sessionstate efter reset-policyen.  
**Angrebet der fandt det:** Storage-fejl og sagsnær sessionstate blev efterladt under en ellers
succesrapporteret hel-sags-clear.  
**Konsekvens:** Appen kan fortælle brugeren, at alt er slettet, selv om et tidligere filhåndtag eller
brugerindtastede hjælpedatoer består og kan påvirke den næste sag.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Tegn på uklart transaktionsejerskab: reset af autoritativt input og oprydning af
tilknyttet metadata/sessionstate har ingen samlet, verificerbar resultatmodel.  
**Overvejelse:** Ikke al uafhængig UI-præference skal nødvendigvis ryddes, men sagsnær brugerinputlignende
hjælpetilstand og direkte-save-håndtag må ikke overleve en bekræftet hel-sags-clear.  
**Anbefaling:** Definér reset-policyens præcise manifestnøgler og kræv verificeret oprydning eller en
eksplicit advarsel om delvis oprydning.  
**Forslag til løsning:** Lad reset-porten eje en typed reset-transaktion/resultatmodel for inputenvelope,
historik, sagsnær UI-sessionstate og filhåndtag. Kontrollér alle storage-resultater, og rapportér ikke
ubetinget fuld succes ved rester. Tilføj tests for `false`/fejl fra hver storagegrænse og for en ny sag efter
reset.  
**Kræver godkendelse:** Nej — rettelsen håndhæver den dokumenterede betydning af “Slet alt”.  
**Status:** **Rettet 2026-07-29 (etape 8)**

**Rettelsen.** Reset-policyen findes nu — den manglede helt, hvilket var den egentlige rod: kontraktens §3.8
henviste til "den særskilte reset-policy", som ingen steder var skrevet ned, så `Slet alt` gentog en
håndskrevet liste på tre nøgler.

1. *Policyen bor i manifestet.* `SESSION_RESET_POLICY` klassificerer HVER manifest-nøgle som `caseScoped`
   eller `deviceScoped`, håndhævet af `satisfies` — en ny nøgle **kan ikke** undlade at vælge side.
   `getCaseScopedSessionStorageKeys()` er den ene enumeration. Klassifikationen afslørede, at fundet nævnte
   én for få: `loentrinFinderOverlay` er også sagsnær (den er keyet på ansættelsesforhold-id).
2. *Porten ejer transaktionen.* `CaseResetOperations.clearAll` rydder input, de sagsnære sessionnøgler OG
   filhåndtaget, og returnerer `ClearAllResult` med `status: 'cleared' | 'cleared-with-residue'` +
   `residue`. Kalderen kan derfor ikke rapportere fuld succes uden at have set resterne; `useFileSaveLoad`
   viser en konkret advarsel i stedet for “Alt data slettet”.
3. *Boolean-kontrakten var selv forkert.* `deleteFileHandleFromIndexedDB` returnerede `false`, når
   IndexedDB slet ikke findes — altså "ingen rest" rapporteret som "kunne ikke verificeres". Nu `true`:
   findes lageret ikke, kan der ikke ligge et håndtag.

**Værn:** `storage/case-reset-policy-single-owner` (AST) forbyder, at nogen anden end porten enumererer
policyen — en parallel reset-vej ville pr. konstruktion ikke bære rest-rapporteringen. Mutationsbevist:
et kald i `useFileSaveLoad` gør reglen rød med fil:linje:kolonne.

**Dækning:** 4 nye porttests (hver sagsnær nøgle ryddet / device-scopede bevaret; rest ved filhåndtag; rest
pr. sessionnøgle ved utilgængeligt lager; en kastende grænse er en fejl, ikke en rest), 3 nye
`handleSletAlt`-tests og 3 nye manifest-tests (policyen deler manifestet i to ikke-tomme, disjunkte sider og
følger namespace).

## Efterprøvet uden fund

- Save følger prepare/evaluate/gate/encode/write/readback/metadata-rækkefølgen og blokerer relevant
  rejected input før fil-I/O.
- Saveprojektionen accepterer kun schema-gyldigt canonical input; rejected råtekst skrives ikke til `.eo`.
- Tolerant `.eo`-load, ukendte felter og preflightens loaded/dropped/stripped-optælling er dækket af kode og
  målrettede tests.
- Current-session bruger én current-only envelope uden `fieldAddressVersion`, sentineladresser eller
  legacy-migrator. Korrupt payload bevares fail-closed med blokerede writes.
- Inputcommit skriver session først, verificerer byte-readback og ruller storage/store tilbage ved fejl.
- Undo/redo bærer kun settled input og origin, har monotone revisioner og bruger route/tab-metadata ved
  fokusrestore.
- Persistence-portene bruger den injicerede `captureStableSource`; produktions-singletons og rå
  `StoreApi` eksponeres ikke.
- Stabil source-capture bruger token-data-token med begrænset retry.

## Udestående checkpoints

- Samlet regressionstest af en gammel `.eo`, hvis canonical værdi nu ligger uden for aktive bounds:
  load → synlig feltissue → uændret resave → blokering af præcis de afhængige consumers.
- ~~Adversariel test af en ny editor/draft under den asynkrone metadatafase i load.~~ **Dækket 2026-07-29**
  (R4-F01): `criticalActionCoordinator.test.ts` udskifter editoren INDE i replacement-callbacken, og
  `useFileSaveLoad.test.tsx` holder metadatafasen pending og hævder, at replacement allerede ER gennemført.
  Bemærk afgrænsningen: begge kører mod runtime, ikke i en browser — det er en logisk editorudskiftning, ikke
  en reel brugerinteraktion under en ægte IndexedDB-await.
- ~~Test af fuldstændig reset af alle reset-relevante manifestnøgler og hvert storage-fejlresultat.~~
  **Dækket 2026-07-29** (R4-F02): `caseResetOperations.test.ts` itererer over
  `getCaseScopedSessionStorageKeys()` (så en ny nøgle dækkes automatisk) og hævder både `false`-benet fra
  filhåndtaget og et fejlende `removeItem` pr. nøgle. `storageManifest.test.ts` pinner, at klassifikationen
  deler manifestet i to ikke-tomme, disjunkte sider.
- Reel browsertest af File System Access-write/readback og fejl/rollback; de nuværende tests bruger mocks.
- Mutationstest af arkitekturværn blev ikke udført under det read-only review.

## Tilfældighedsfund

- ~~`src/utils/inboundPersistedSection.ts:33-38` beskriver fortsat session-hydrering gennem den slettede
  `persistenceSessionHydration.ts` og hævder en delt tolerant transform mellem `.eo` og current-session.~~
  **Rettet 2026-07-29 (etape 9).** Teksten nævner nu `initializeInputRuntime.ts` som den faktiske
  current-session-kilde. Samme tekst henviste desuden til `buildPersistedSection` som "outbound-modstykket";
  det modul er slettet med GM-F09, og kommentaren siger nu eksplicit, at der INTET outbound-modstykke findes,
  fordi sektionsvis persistering ikke længere er en skrivegrænse.

## Evidens og kommandoer

Følgende målrettede kørsel var grøn:

```text
npx vitest run \
  src/__tests__/inputCore/runtime/dispatchInput.test.ts \
  src/__tests__/inputCore/runtime/criticalActionCoordinator.test.ts \
  src/__tests__/persistence/caseFileOperations.test.ts \
  src/__tests__/persistence/caseResetOperations.test.ts \
  src/__tests__/persistence/eoSaveProjection.test.ts \
  src/__tests__/utils/fileLoad.normalLoad.test.ts \
  src/__tests__/utils/fileSave.test.ts \
  src/__tests__/utils/fileRoundTrip.fullState.test.ts \
  src/__tests__/utils/persistenceLoadApply.test.ts \
  src/__tests__/hooks/useFileSaveLoad.test.tsx \
  src/__tests__/quality/architecture/architectureRules.test.ts \
  src/__tests__/quality/architecture/deletedLegacyAbsence.test.ts \
  --maxWorkers=50%
```

Udfald: 12 testfiler, 253 tests, alle grønne. Derudover blev `rg` brugt til at kontrollere storagekeys,
legacy-/sentinelfragmenter, `captureStableSource`, rå `StoreApi` og relevante testcases. Fuld suite,
typecheck, lint og build blev ikke kørt, fordi reviewet ikke ændrede produktionskode; de målrettede
test- og AST-suites dækkede den undersøgte risikoflade.

## Fasekonklusion

Save, current-session, rollback, tolerant load, revisioner og persistence-grænser er overvejende
efterprøvet. Fasen kan ikke lukkes: load har et verificeret draft-datatabsvindue, `Slet alt` har en
verificeret ufuldstændig oprydningsvej, og de anførte end-to-end-/browsercheckpoints udestår.
