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
**Handling:** Begge fund er parkeret til implementering; ingen produktionsfiler ændret  
**Næste skridt:** luk de udestående end-to-end- og browsercheckpoints, og ret de to verificerede
integritetsbrud

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
**Status:** Parkeret

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
**Status:** Parkeret

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
- Adversariel test af en ny editor/draft under den asynkrone metadatafase i load.
- Test af fuldstændig reset af alle reset-relevante manifestnøgler og hvert storage-fejlresultat.
- Reel browsertest af File System Access-write/readback og fejl/rollback; de nuværende tests bruger mocks.
- Mutationstest af arkitekturværn blev ikke udført under det read-only review.

## Tilfældighedsfund

- `src/utils/inboundPersistedSection.ts:33-38` beskriver fortsat session-hydrering gennem den slettede
  `persistenceSessionHydration.ts` og hævder en delt tolerant transform mellem `.eo` og current-session.
  Current-session hydreres nu direkte og current-only gennem `initializeInputRuntime.ts`. Kommentaren er
  forældet og bør rettes, så den ikke antyder en fjernet runtimevej.

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
