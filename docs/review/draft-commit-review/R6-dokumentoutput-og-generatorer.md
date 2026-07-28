# R6 — Dokumentoutput og generatorer

**Status:** Delvist gennemgået  
**Dato:** 2026-07-28  
**Dækket:** De 18 hovedapp-definitioner; dokumentkatalog, action, lifecycle, source-context,
Mineo-miljø og React-hooks; PDF/Word-routing; dokumentgates og de dokumentrelevante
arkitekturværn; målrettede dokument-, gate-, lifecycle- og completeness-tests; download-callsites
for Satser, Rente, Årsløn, Varige mén, Forsørgertab, EO, EET og reguleringsdokumenterne.  
**Angreb udført:** Den stale token, gate-bypass, håndbygget `PreparedDocument`, den lydløse
blokering, formatafhængighed i en ready-gren, ikke-relevant dependency-overblokering, generator- og
fil-I/O ved blokering, parallel generator-/downloadvej samt grøn dækning af tomhed.  
**Evidens:** AST-audit af 792 produktionsfiler; to virtuelle strict-TypeScript-compile-prober; én
runtime-probe af settings-/tokenbindingen; målrettet Vitest-kørsel af fem filer med 158/158 grønne
tests. De konkrete kommandoer og udfald står nedenfor.  
**Fund:** 4 (R6-F01, R6-F02, R6-F03, R6-F04) — R6-F01 og R6-F02 rettet 2026-07-28 (etape 3)  
**Hypoteser:** Ingen  
**Handling:** R6-F01 og R6-F02 er rettet; R6-F03 (etape 11) og R6-F04 (etape 10) er parkeret til deres
etaper.  
**Næste skridt:** Ret R6-F03 og R6-F04, og tilføj katalogkomplette ready-/invalid-/bounds-fixtures.
Derefter gentages R6-kontrollerne og status kan vurderes til `Gennemgået`.

## Scope og kontrolresultat

| Kontrolpunkt | Resultat | Evidens |
|---|---|---|
| Én typed definition pr. hovedapp-output | Bestået | AST fandt 18 unikke definitioner med præcis de 18 id'er i `MINEO_DOCUMENT_OUTPUT_IDS`. |
| Samme definition til reaktiv gate og click-preflight | Bestået strukturelt | `closeDocumentAction` bruger samme nominale action til `evaluateGate` og `download`; lifecycle kalder samme actions `resolve`. |
| Tokenbundet, ikke-håndbyggeligt `PreparedDocument` | Bestået | Typen og begge interne funktioner er modulprivate; compile-proben gav tre forventede ikke-eksporteret-diagnostics. |
| Ingen entrypoint-/generator-/fil-I/O-bypass | Bestået | Kun kataloget importerer lifecycle; kun lifecycle kalder `triggerDocumentDownload`; ingen generatorimport uden for definitionsautoriteterne. |
| Stop før lazy-load, generator og fil-I/O ved blokering | Bestået for den centrale lifecycle | `documentLifecycleMatrix.test.ts` beviser den fælles blocked-sti. Katalogkomplet per-definition-dækning fejler R6-F04. |
| Dependency-præcis blokering | Ingen konkret produktionsfejl fundet | Definitioner og domænegates blev inspiceret; eksisterende tests dækker bl.a. EO-/EET-outputisolering. Katalogkomplet falsifikation mangler jf. R6-F04. |
| Synlig blokering/afvisning | Fejlet | R6-F02. |
| Formatneutral gate og fælles PDF/Word-definition | Delvist fejlet | Ingen aktuel generator forgrener på format, men capabilityen findes fortsat og compile-proben omgår invariansen; R6-F03. |
| Frisk token og settings efter settle | Fejlet | Inputevalueringen optages efter settle, men settingsobjektet er fanget fra render; R6-F01. |
| Ingen konkurrerende outputveje | Bestået | Ét katalog/lifecycle-entrypoint og én definition pr. id; ingen alternative produktionscallsites fundet. |

## Verifikation

### AST-audit

En TypeScript-AST-forespørgsel gik alle 792 `.ts`/`.tsx`-produktionsfiler igennem og målte
definitioner, exports, imports, generator-loads og den irreversible download-callsite.

Udfald:

- 18 hovedapp-definitioner med 18 unikke katalog-id'er,
- `executeDocumentDownload` er eneste export fra `documentLifecycle.ts`,
- kun `documentCatalog.ts` importerer lifecycle,
- kun `documentLifecycle.ts` kalder `triggerDocumentDownload`,
- ingen generator-load uden for de ni autoriserede definitionsmoduler,
- ingen konkurrerende definition for samme hovedapp-id.

En særskilt AST-forespørgsel målte de syv berørte UI-filer i R6-F02:

- alle syv aktiverer dokumentdownload,
- Satser og de fire EET-filer læser ingen `errorMessage`,
- de to reguleringscallsites læser ikke `reguleringDocument.errorMessage`.

### Compile-prober

1. En virtuel strict-TypeScript-fil forsøgte at importere `PreparedDocument`,
   `prepareDocument` og `runPreparedDocument` fra lifecycle. Resultat:
   `PREPARED_BYPASS_DIAGNOSTICS=3`; alle tre blev afvist som lokalt deklarerede, men ikke
   eksporterede.
2. En virtuel strict-TypeScript-definition forgrenede sin `project` på
   `context.settings.documentDownloadFormat`, blokerede Word og tillod PDF. Resultat:
   `FORMAT_GATE_PROBE_COMPILES`.

### Runtime-probe

Et instrumenteret `createMineoDocumentEnvironment` blev givet et aktuelt
`EvaluationSourceToken` og et ældre render-fanget PDF-settingsobjekt. Lifecycle accepterede
tokenet og returnerede en gate-afvisning med `gate-saw-pdf`; renderer-load blev ikke nået. Proben
viser, at miljøets type og runtime ikke binder det konkrete settingsobjekt til tokenets
settingsrevision.

### Testkørsel

Kørt:

```text
npx vitest run \
  src/__tests__/document/documentCatalogCompleteness.test.ts \
  src/__tests__/document/documentGateMatrix.test.ts \
  src/__tests__/document/documentGateFormatInvariance.test.ts \
  src/__tests__/document/documentLifecycleMatrix.test.ts \
  src/__tests__/quality/architecture/architectureRules.test.ts
```

Udfald:

```text
Test Files  5 passed (5)
Tests       158 passed (158)
```

Fuld typecheck, lint og build blev ikke kørt: reviewpasset ændrede ingen kode, og de målrettede
kommandoer dækkede de undersøgte mekanismer. Grønne tests afviser ikke fundene; R6-F03 og R6-F04
forklarer de konkrete dækningshuller.

## Fund

### R6-F01 — Frisk token bindes til render-fangede settings

**Lokation:** `src/document/runtime/mineoDocumentEnvironment.ts:44-50`,
`src/document/runtime/react/useMineoDocumentEnvironment.ts:21-25`,
`src/document/definition/documentLifecycle.ts:134-163`,
`src/inputCore/react/productionInputRuntime.tsx:121-134`  
**Problem:** Click-preflight optager en frisk `InputEvaluation` efter settle, men
`captureSource()` returnerer settingsobjektet, som blev leveret til miljøet ved React-render.
Settingsværdien optages derfor ikke sammen med tokenet. Et nyere settingsrevision-token kan
kombineres med et ældre format-, brevhoved- eller EO-regelobjekt, hvorefter alle senere
friskhedschecks kan bestå. Produktionsruntime har allerede en parret capture, der returnerer
`evaluation` og `publishedSettings` sammen, men dokumentmiljøet bruger ikke den grænse.  
**Evidens:** `createMineoDocumentEnvironment(runtime, settings)` lukker over parameteren `settings`
og implementerer `captureSource` som
`{ evaluation: runtime.captureEvaluationSource(), settings }`. Runtime-proben accepterede et token
med settingsrevision 2 sammen med et ældre PDF-settingsobjekt og lod definitionens gate se
`gate-saw-pdf`.  
**Angrebet der fandt det:** Den stale token; specifikt et settingsskift mellem render og afsluttet
preflight.  
**Konsekvens:** En download kan blive gated eller renderet med tidligere
reguleringspolitik, dokumentformat eller brevhoved, selv om `PreparedDocument` bærer det aktuelle
settingsrevision-token. Det bryder den trust-kritiske kildebinding og kan give et dokument, der
ikke svarer til den aktuelle indstilling.  
**Alvor:** Kritisk  
**Strukturel vurdering:** Tegn på et bredere grænseproblem: input og settings har to forskellige
capture-veje, selv om tokenet påstår én samlet kilde.  
**Overvejelse:** Fejlen kan ikke lukkes med endnu et tokencheck; tokenet er allerede aktuelt.
Det konkrete settingssnapshot skal optages atomisk fra samme autoritative source-port som
evalueringen.  
**Anbefaling:** Lad dokumentmiljøets `captureSource` hente den allerede parrede
`evaluation + SourceSettings`-værdi fra runtimegrænsen. Fjern render-fangede settings som
capture-kilde.  
**Forslag til løsning:** Udvid den smalle dokument-read-port med én stabil, tokenbundet capture,
som returnerer både evaluering og `SourceSettings`; bind miljøet til denne funktion og tilføj en
test, hvor kun settingsrevisionen flytter under preparation.  
**Kræver godkendelse:** Nej — rettelsen genskaber den dokumenterede aktuelle indstilling og ændrer
ingen tilsigtet UI-, beregnings- eller dokumentregel.  
**Status:** **Rettet 2026-07-28** (etape 3).

**Gennemført løsning.** Rettelsen er en SIGNATURÆNDRING, ikke et ekstra tokencheck — tokenet var
allerede aktuelt, så et check mere kunne ikke fange fejlen:

1. `createMineoDocumentEnvironment` tager nu `readSourceSettings: () => SourceSettings` i stedet for en
   færdig `SourceSettings`-værdi. Der findes dermed ikke længere en værdi at holde fast på: begge halvdele
   af kildesnapshottet læses ved HVERT `captureSource()`.
2. `readPublishedSourceSettings()` er eksporteret fra `productionInputRuntime.tsx` og returnerer
   `publishedSettings` — den værdi, `useSettingsRevisionBridge` sætter i SAMME `useLayoutEffect`, som
   hæver settingsrevisionen. En læsning på capture-tidspunktet er derfor atomisk med tokenet.
3. `useMineoDocumentEnvironment` læser ikke længere `useAppSettings`. Bivirkning: miljøet afhænger nu kun
   af runtime-bindingen, så et settingsskift ikke længere invaliderer hele gate-memoiseringen nedstrøms.

**Dækning (mutationstestet):** `src/__tests__/document/runtime/mineoDocumentEnvironment.test.ts` — 5 tests.
Filen fandtes ikke før; den kritiske sti var helt udækket. Testene ændrer settings MELLEM miljøets
konstruktion og capturen og måler hvilken VÆRDI capturen leverer for format, brevhoved og EO-regeltogglen,
samt at evaluering og settings læses i samme kald. Mutationsbevis: genindføres den render-fangede closure,
fejler ALLE 5 tests med et forældet `'pdf'` mod det aktuelle `'word'` — altså på selve mekanismen.

### R6-F02 — Otte outputs kasserer brugerbeskeden efter en afbrudt download

**Lokation:** `src/document/definition/documentMessages.ts:49-52`,
`src/document/definition/react/useDocumentDownload.ts:77-82,120`,
`src/components/pages/Satser.tsx:183-193`,
`src/components/pages/Erhvervsevnetab.tsx:40-46`,
`src/components/pages/erhvervsevnetab/EetLoebendeYdelserTab.tsx:107-117`,
`src/components/pages/erhvervsevnetab/EetKapitaliseringTab.tsx:93-103`,
`src/components/pages/erhvervsevnetab/EetEfterEalTab.tsx:52-62`,
`src/components/pages/erhvervsevnetab/EetDifferencekravTab.tsx:418-428`,
`src/domain/erstatningsopgoerelse/react/useReguleringDocumentAction.ts:37-48`,
`src/components/pages/erstatningsopgoerelse/loenindkomst/AnsaettelsesforholdCard.tsx:854-875`,
`src/components/pages/erstatningsopgoerelse/eoOplysninger/sections/IndtaegtFoerSkadenSection.tsx:617-641`  
**Problem:** Lifecycle og beskedlaget producerer korrekt brugerbesked for bl.a.
`stale-source` og DEV-servernedetid, og `useDocumentDownload` gemmer den i `errorMessage`.
Satser, de fire EET-outputs samt de dynamiske regulering/KRL/KL-outputs aktiverer download, men
renderer aldrig beskeden. Reguleringshooken udleder endda `errorMessage`, som begge callsites
ignorerer.  
**Evidens:** AST viste én downloadaktivering og nul relevante beskedlæsninger i hver berørt
callsite. Repo-søgning finder ingen `reguleringDocument.errorMessage`-consumer. De samme
udfald vises korrekt på bl.a. Forsørgertab og Varige mén, hvilket efterprøver at beskeden er
beregnet til sidefladen og ikke til den centrale systemfejlkanal.  
**Angrebet der fandt det:** Den lydløse blokering.  
**Konsekvens:** Brugeren klikker på en aktiv downloadknap, ingen fil kommer, og siden forklarer
ikke, at sagen ændrede sig undervejs eller at udviklingsserveren er utilgængelig. De tre
reguleringsoutputs rammes fra to forskellige UI-steder.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Tegn på et bredere UI-kontraktproblem: `DocumentDownloadHandle`
eksponerer korrekt outcome, men håndhæver ikke at callsiten faktisk renderer det.  
**Overvejelse:** Gate-tooltipen løser kun den reaktive disabled-tilstand. Den kan ikke forklare et
stale-afbrud eller en DEV-fejl efter et klik, og systemfejlfladen modtager bevidst ikke disse
forventelige udfald.  
**Anbefaling:** Giv alle dokumentførende contentboxes samme kanoniske outcome-visning, så en
callsite ikke kan aktivere download uden også at vise brugerrettelige afvisninger.  
**Forslag til løsning:** Genbrug den eksisterende fejlboksplacering og
`visibleDocumentFailureMessage`-politik på Satser og EET; før reguleringshookens `errorMessage` ind i
begge contentboxes. Tilføj UI-tests, der injicerer `stale-source` og beviser synlig dansk tekst.  
**Kræver godkendelse:** Godkendt 2026-07-28. Brugeren har godkendt, at den eksisterende danske
fejlbesked vises i dokumentets contentbox i de otte berørte flows, uden anden ændring af downloadflowet.  
**Status:** **Rettet 2026-07-28** (etape 3, sammen med GM-F11 — samme fund fra to vinkler).

**Gennemført løsning.** Kortlægningen viste, at problemet var STØRRE end otte glemte visninger: de flader,
der huskede beskeden, havde fem forskellige udgaver af samme fejlrække, og reguleringshooket udledte en
besked, ingen af dets to callsites læste. Rettelsen er derfor både en visning og en grænse:

1. `src/components/inputs/DocumentOutcomeMessage.tsx` er den ene kanoniske udfaldsrække. Den tager en
   FÆRDIG besked og vælger ikke selv politik, så valget mellem `visibleDocumentFailureMessage(handle)` og
   `handle.errorMessage` fortsat ligger hos fladen — hvor det hører, fordi det afhænger af, om gate-årsagen
   allerede står synligt ved knappen.
2. Alle otte flader viser nu udfaldet: Satser, de fire EET-faner samt de to regulerings-callsites
   (`AnsaettelsesforholdCard`, `IndtaegtFoerSkadenSection`).
3. `useReguleringDocumentAction.errorMessage` er ændret fra `visibleDocumentFailureMessage(output)` til
   `output.errorMessage` RÅT. Begge dens callsites har gate-årsagen KUN i knappens tooltip, så et
   bortfiltreret gate-udfald ville netop give den usynlige blokering, filtreringen findes for at undgå.
4. AST-reglen `document/activation-shows-outcome` lukker den grænse, fundet peger på: aktiverer en
   sidefil et dokumenthandle, skal samme fil også rendere en udfaldsvisning. Filer, der kun VIDEREGIVER et
   handle som prop (`Erhvervsevnetab.tsx`), aktiverer ikke selv og rammes ikke.

**Dækning (mutationstestet):** `DocumentOutcomeMessage.test.tsx` — 5 tests, som henter de faktiske danske
tekster fra produktionens beskedlag (`stale-source`, DEV-server) frem for at hardkode dem. Plus AST-reglen.
Mutationsbevis: fjernes visningen fra Satser, bliver reglen rød med fil:linje:kolonne.

**Fund i mit eget værn undervejs (INC-F03).** Reglens FØRSTE udgave brugte `entry.text.includes(...)`, og
mutationen forblev derfor GRØN: den efterladte forklarende kommentar indeholdt ordet `errorMessage`, og en
tekstsøgning kan ikke skelne kode fra kommentar (review-planens grundregel 5). Reglen er omskrevet til at
måle rigtige AST-noder (JSX-tags og identifiers), og en violating fixture pinner netop det hul: en
kommentar, der nævner visningen, bærer ikke reglen.

**Bevidst ikke gjort:** de fem eksisterende udgaver af fejlrækken er IKKE ensrettet til komponenten.
Forsørgertab/Varigt mén bruger en bar `<Box />` som filler, hvor komponenten bruger
`row--label-right-hover__content` (`flex: 1; min-width: 220px`) — i en `space-between`-række giver det en
synlig forskel i tekstens placering. Aarsloen og EOberegningTab har hver deres egen ramme (egen ContentBox
med overskrift henholdsvis en delt "Fejl og advarsler"-boks med ikon i stedet for rød tekst). At ensrette
dem er en synlig UI-ændring ud over den godkendte scope ("uden anden ændring af downloadflowet") og hører
til en særskilt forelæggelse. Komponenten følger den udgave, der bruges flest steder (Renteberegning ×3).

### R6-F03 — Dokumentformat er fortsat en lovlig gate-dependency

**Lokation:** `src/settings/sourceSettings.ts:8-13,74-85`,
`src/document/definition/documentSourceContext.ts:34-41`,
`src/document/definition/documentDefinition.ts:92`,
`src/__tests__/document/documentGateFormatInvariance.test.ts:10-25,173-184`  
**Problem:** Hovedappens definitioner modtager hele `SourceSettings`, som indeholder
`documentDownloadFormat`. En definition kan derfor lovligt gøre PDF ready og Word blocked.
R6 kræver, at en sådan afhængighed er en typefejl. Den aktuelle invarians-test er sekundær og når
kun ready-grenen for 2 af 18 outputs; en formatafhængighed i de øvrige 16 ready-grene kan være grøn.  
**Evidens:** Den virtuelle strict-TypeScript-probe, der forgrenede `project` på
`context.settings.documentDownloadFormat`, kompilerede uden diagnostics:
`FORMAT_GATE_PROBE_COMPILES`. Den eksisterende test dokumenterer selv ready-dækningen som 2/18.
Repo-søgning fandt ingen aktuel produktionsdefinition eller generator, der forgrener på formatet;
fundet er en åben capability, ikke en påstand om en nuværende skæv gate.  
**Angrebet der fandt det:** En formatafhængighed gemt i en ready-gren samt den brede capability.  
**Konsekvens:** En senere lokal ændring kan gøre et dokument tilgængeligt i kun ét format uden
compilerfejl. Den nuværende test vil ikke nødvendigvis opdage det for 16 outputs.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Bred capability i kernetypen; værnet forsøger at overvåge en afhængighed,
som typegrænsen burde gøre urepræsenterbar.  
**Overvejelse:** Gate-relevante EO-regelsettings og render-relevante format-/brevhovedsettings har
forskellige consumers og bør ikke flyde gennem samme projektionskontekst.  
**Anbefaling:** Split gate-settings fra render-settings. Definitionernes `project` skal kun se den
gate-relevante policy; format og brevhoved skal først anvendes efter ready-resultatet i lifecycle.  
**Forslag til løsning:** Indfør den mindst mulige nominale gate-settings-type, bind EO-policyen
dertil, og behold format/brevhoved i det tokenbundne prepared render-snapshot uden at eksponere dem
for `project`. Behold invarians-testen som regressionsnet, men gør compile-proben negativ.  
**Kræver godkendelse:** Nej — den tilsigtede adfærd er allerede, at format aldrig ændrer gaten.  
**Status:** Parkeret

### R6-F04 — Gatekontrakten er kun målt på fire af atten definitioner

**Lokation:** `src/contracts/document-output-contract.md:71-87`,
`src/__tests__/document/documentGateMatrix.test.ts:43-46,116-249`,
`src/__tests__/document/documentLifecycleMatrix.test.ts:18,47,127-143,244-256`,
`src/__tests__/document/documentCatalogCompleteness.test.ts:50-83`  
**Problem:** Kontrakt A2a kræver, at hver definition særskilt beviser relevant rejected
`invalid`, canonical `bounds/range`, reaktiv disabled-state og direkte stop før lazy-load,
generator og fil-I/O. Den navngivne gate-matrix importerer og tester kun fire reelle definitioner.
Lifecycle-matrixens blocked-case bruger én syntetisk definition og kan derfor ikke bevise, at de
øvrige definitioner klassificerer deres egne invalid-/bounds-dependencies korrekt. Completeness
beviser kun, at definitionerne findes.  
**Evidens:** AST af `documentGateMatrix.test.ts` fandt fire konkrete definitionsimports:
`satserDocumentDefinition`, `varigeMenDocumentDefinition`,
`forsoergertabDocumentDefinition` og `renteOversigtDocumentDefinition`. De øvrige 14 katalog-id'er
har ingen case i matrixen. Lifecycle-filen beskriver og konstruerer eksplicit sin definition som
syntetisk. Alle nuværende tests var grønne, hvilket demonstrerer, at hullet kan fremstå grønt.  
**Angrebet der fandt det:** Grøn dækning af tomhed og dependency-præcis blokering.  
**Konsekvens:** En definition kan glemme en invalid- eller bounds-dependency, overblokere på en
fremmed dependency eller starte dokumentarbejde efter en forkert klassificering uden at den
kontraktbundne katalogmatrix bliver rød.  
**Alvor:** Væsentlig  
**Strukturel vurdering:** Kataloget er komplet, men testdataregistreringen er ikke bundet til
katalogets 18 poster. Dækningen kan derfor drive fra inventaret.  
**Overvejelse:** Domæneunit-tests er værdifulde, men de erstatter ikke definitionens faktiske
`project` plus katalog/lifecycle-grænse. Samtidig bør fælles lifecycle-adfærd fortsat testes én gang;
duplikering af hele runneren 18 gange er ikke målet.  
**Anbefaling:** Registrér en typed gate-fixture pr. output-id med ready, relevante invalid/bounds,
warning og ikke-relevant blocker, og completeness-bind fixturelisten til
`MINEO_DOCUMENT_OUTPUT_IDS`. Kør den reelle definition gennem `DocumentOutput.evaluateGate` og den
fælles lifecycle-harness.  
**Forslag til løsning:** Del matrixen i katalogkomplette per-definition projektionsfixtures og en
fælles lifecycle-kontraktsrunner. Hver fixture erklærer kun de fejlklasser, som kan forekomme blandt
definitionens faktiske dependencies; testen håndhæver non-empty synlig grund og nul
renderer/session/fil-I/O ved direkte aktivering.  
**Kræver godkendelse:** Nej  
**Status:** Parkeret

## Resterende kontrolpunkter

R6 kan ikke afsluttes, før følgende er efterprøvet efter rettelserne:

1. Settings-only drift under og efter settle afvises eller recaptures med et settingssnapshot, der
   bevisligt svarer til tokenet.
2. De otte berørte outputs viser `stale-source` og DEV-serverbeskeder i deres faktiske contentbox.
3. En compile-probe, der læser `documentDownloadFormat` i `project`, fejler af den tilsigtede
   typegrund.
4. Alle 18 output-id'er har katalogbundne ready-/invalid-/bounds-/warning-/ikke-relevant-fixtures,
   hvor fejlklasserne findes i deres dependencies.
5. Dependency-præcision falsificeres med en fremmed fejl for hvert output, ikke kun gennem delte
   domænehjælpere.
6. Arkitekturværnenes load-bearing adfærd mutationsprøves. Det blev ikke gjort i dette read-only
   pass, fordi opdraget forbød ændringer i arbejdstræet.

## Tilfældighedsfund

- Produktionskoden i dokumentkernen beskriver fortsat migrationens forløb med formuleringer som
  `Fase 5`, `pass 0`, `før Fase 5` og `greenfield`, bl.a. i
  `src/document/definition/documentDefinition.ts:1-15`,
  `documentLifecycle.ts:1-31`, `documentCatalog.ts:1-13` og
  `documentOutcome.ts:1-15`. Det er sluttilstandssprogsdrift og hører til R1.
- `src/contracts/app-settings.md:33` siger, at evaluering, revisionsfingerprint og dokumentcapture
  garanteret læser samme værdi. R6-F01 falsificerer denne påstand for dokumentmiljøets nuværende
  capture, så kontraktteksten er også ude af sync med den faktiske mekanisme.
