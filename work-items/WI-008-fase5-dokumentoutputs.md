# WI-008: Fase 5 — alle 18 dokumentoutputs bag én typed dokumentdefinition

- **Status:** `under-implementering`
- **Oprettet:** 2026-07-25
- **Slice/scope:** greenfield-planens Fase 5 (`docs/architecture/draft-commit-greenfield-design.md` linje 1447-1501)
- **Kilde:** brugerønske ("implementér så stor en del som muligt, gerne hele fase 5")
- **Risikoklasse:** **H** — dokumentgate er trust-kritisk output, tværgående arkitektur, 18 entrypoints,
  freshness/stale-revision og fail-closed-semantik. Reviewet køres derfor på `sol/medium` efter
  brugerens eksplicitte token-begrænsning (afvigelse fra skillens `sol/high` for klasse H, se
  "Afvigelser fra skillen" nedenfor).
- **Baseline:** HEAD `4b402a33` ("Luk Fase 0-4 endegyldigt …"), rent working tree. Ingen fremmede ændringer.

## Afvigelser fra skillen (brugerbestemt, denne WI)

1. **Review-model:** `sol/medium` i stedet for klasse-H'ens `sol/high`. Brugeren har eksplicit bedt om at
   begrænse codex-tokens. Kompenseres ved punkt 2.
2. **Eget indledende review:** Jeg gennemfører selv et fuldt struktureret selv-review (opus/high) på det
   færdige arbejde FØR codex-kaldet, og retter fundene. Codex reviewer derfor et allerede selv-revideret
   diff.

## Scope

**Inde:**

- Én typed `DocumentDefinition` pr. katalogiseret output — 18 hovedapp-outputs + de 3 standalone
  MinProcesrente-outputs (kontraktens §A2a kræver eksplicit at også standalone dækkes).
- Én fælles prepare-/run-kerne, der ejer HELE download-livscyklussen: commit-barriere (settle),
  frisk kildeoptagelse, token-lighed, projektion, gate, lazy-load, friskheds-recheck, formatvalg,
  generatorkald, fejlrouting.
- Én reaktiv gate-hook, der bruger PRÆCIS samme definition som click-preflight.
- Nedlæggelse af de 18 håndrullede `download*Dokument`-servicefunktioner i `documentService.ts` som
  offentlige entrypoints; deres indhold flyttes til definitionerne (`prepare` + `render`).
- Fjernelse af de lokale click-gates, ad hoc `canDownload`-IIFE'er og duplikerede
  prepare-sekvenser i de 9+ callsites.
- AST-arkitekturregler, der beviser at intet entrypoint kan omgå prepare-flowet.
- Udtømmende matrix-test pr. output (9 cases × 21 definitioner) jf. planens §"Udtømmende matrix".

**Bevidst uden for scope:**

- Fase 6's forbudt-symbol-gate og ledger-nedlæggelse (egen fase).
- Ændringer i generatorernes indhold, layout eller dokumenttekst. Generatorernes signaturer
  bevares uændret; kun kalderen ændres.
- Ændringer i beregningsmotorer, projektioner eller snapshot-logik. Definitionerne GENBRUGER de
  eksisterende reader-projektioner og gates uændret (§5.4).
- `documentService.ts`' dev-server-preflight, dynamic-import-fejlheuristik og
  `reportSystemIssue`-routing — bevares som mekanisk servicelag, men flyttes til kernen.

## Autoritativt grundlag

- `docs/architecture/draft-commit-greenfield-design.md` §3.9 (linje 612-627), §4/§A2-friskhed
  (linje 515-531), Fase 5 (linje 1447-1501), §10 acceptkriterie 27 (linje 1642).
- `src/contracts/document-output-contract.md` §A1, §A2, §A2a, §A2.1, §A7.1 (dokumentdefinitioner
  placeres ved deres domæne-/generatorgrænse og er eneste ejer af inputdependencies, preflight og
  `PreparedDocument<T>`; de må IKKE reduceres til utypede callbacks i service-laget).
- `src/config/consumerInventory.ts:97-116` — `CONSUMER_DOCUMENT_OUTPUTS`, komplethedskilden (18 ids).
- Korrekthedsorakel for det færdige flow: `src/components/pages/Forsoergertab.tsx:110-138`
  (den mest komplette håndrullede prepare-sekvens) og `src/hooks/useFileSaveLoad.ts:229-313`
  (save-sidens tilsvarende freshness-mønster).

## Kortlægning (gennemført 2026-07-25, opus/high)

### Nuværende tilstand pr. output

Alle 18 outputs lazy-loader gennem `documentLoader.ts` (ingen UI-komponent importerer en generator
direkte). Alle 18 har en `download*Dokument`-funktion i `documentService.ts`. Derudover:

| Gruppe | Outputs | Prepare-barriere | Frisk capture | Token-lighed | Reaktiv gate | `isSourceCurrent` |
|---|---|---|---|---|---|---|
| A. Komplet | forsoergertab, varigemen, kapitalisering, efter-eal, differencekrav, loebende-ydelser, rente-oversigt, erstatningsopgoerelse, taf×3 | ja | ja | ja | typed gate | ja |
| B. Mangler token-lighed | satser | ja | ja | **nej** | ad hoc projektions-boolean | ja |
| C. Mangler typed gate | rente (rækkeknap) | ja | ja | ja | **ad hoc** `stamdataProjection.status==='blocked'` | ja |
| D. Gate uden for domænelaget | aarsloen, sh-dage | ja | ja | ja | gate i `src/hooks/` på hånd-samlet snapshot | ja |
| E. Ingen barriere overhovedet | regulering, krl, kl-loenaftaler | **nej** | **nej** | **nej** | **ad hoc IIFE, duplikeret med 2 forskellige formler** | **nej** |
| F. Uden for kataloget | 3× standalone MinProcesrente | **nej** | n/a (egen app) | n/a | ingen | **nej** |

Gruppe E er det alvorligste hul: `regulering`/`krl`/`kl-loenaftaler` kan i dag starte lazy-load og
generator med en åben, ikke-settlet editor og uden nogen friskhedskontrol. Deres `canDownload`
er en IIFE, der er skrevet TO gange med ikke-identiske formler
(`IndtaegtFoerSkadenSection.tsx:635-637` vs `AnsaettelsesforholdCard.tsx:856-858`). De læser rå
`stamdataValues` + rå feltværdier i stedet for en projektion.

### Rod frem for symptom

De seks grupper er ikke seks fejl. De er ÉT strukturelt problem: **download-livscyklussen findes
ikke som ét objekt.** Den er i dag spredt ud over tre lag pr. output — React-handleren (barriere,
capture, token, gate), servicefunktionen (lazy-load, recheck, format, generator, fejl) og et
domæne-gate-modul — og hvert af de 18 outputs har sin egen kopi af den spredning. Derfor:

- kan en kopi glemme et trin (gruppe B, C, E),
- kan reaktiv gate og click-preflight drifte fra hinanden (gruppe E har to forskellige formler),
- er der intet sted, hvor "alle outputs gør dette" kan håndhæves.

Rettelsen er derfor ikke at lappe de fem afvigende grupper op til gruppe A's niveau — det ville
efterlade 21 kopier af det korrekte mønster. Rettelsen er at gøre livscyklussen til ét objekt
(`DocumentDefinition`) og én kerne (`prepareDocument`/`runPreparedDocument`), som de 21 outputs
konfigurerer frem for at reimplementere.

### Hvad kan flytte sig — og hvorfor gør det ikke (klasse H-krav)

| Risiko | Hvorfor uændret |
|---|---|
| **Dokumentindhold/tal** | Generatorernes signaturer og de projektioner/snapshots, der fodrer dem, ændres IKKE. Definitionens `render` kalder den samme generator med præcis de samme argumenter som den nuværende `download*Dokument`. Word-content-tests pr. generator er uændret grønne. |
| **Persisteret form** | Ingen ændring i schemas, descriptors, catalog eller session-envelope. Fase 5 rører kun læsesiden. |
| **Gate-udfald (gruppe A)** | Definitionerne genbruger de EKSISTERENDE `evaluate*DownloadGate`-funktioner uændret. Kernen kalder dem på samme friske projektion som i dag. |
| **Gate-udfald (gruppe B–E)** | Her ÆNDRES udfaldet bevidst: outputtene får den gate-styrke, kontrakten kræver. Det er en synlig UI-ændring → se godkendelsesgaten nedenfor. |
| **Fejlbeskeder** | `buildDocumentFailureMessage`-formatoversættelsen og de per-output "Kunne ikke generere …-PDF"-tekster flyttes til definitionens `errorLabel` og gengives ordret. |

## Parallel / duplikeret logik

- **Fund 1:** 18× samme servicefunktions-skelet i `documentService.ts` (dev-preflight → lazy-load →
  `isSourceCurrent`-recheck → `runSelectedDocumentFormat` → catch → `createPdfDownloadFailure`).
  **Beslutning:** samles i ÉN kerne. Reelle variationer (`brevhovedType`, `errorLabel`,
  generator-kald, gate) bliver felter på definitionen.
- **Fund 2:** 9× samme prepare-sekvens i callsites. **Beslutning:** samles i ÉN
  `useDocumentDownload(definition)`-hook, der leverer både `{canDownload, disabledReason}` (reaktiv)
  og `download()` (click-preflight) fra SAMME definition. Det er acceptkriterie 27's håndhævelse.
- **Fund 3:** 2× ikke-identisk `canDownload`-IIFE for regulering/krl/kl-loenaftaler.
  **Beslutning:** samles i én definition-gate. Dette er en reel adfærdsændring (se
  godkendelsesgate).
- **Fund 4:** `aarsloen`/`sh-dage`-gaten i `src/hooks/useAarsloenDocumentGates.ts` opererer på et
  komponent-samlet snapshot, ikke en reader-projektion. **Beslutning:** gate-logikken flyttes til
  `src/domain/aarsloen/` og tager `AarsloenReaderProjection`, så den matcher de øvrige 16.
  Eligibility-REGLERNE bevares 1:1 (samme prædikater, samme beskeder).
- **Fund 5:** shake implementeret 3 måder. **Beslutning:** shake er ren præsentation og bliver
  IKKE en del af definitionen; den forbliver hvor den er (blokerings-feedback pr. side). Konsolideres
  ikke — det er ægte UI-variation, ikke gate-logik.
- **Fund 6:** standalone MinProcesrente har sit eget `standaloneRentePdfService.ts` uden gate.
  **Beslutning:** dens 3 outputs får definitioner i samme katalog, men beholder deres egen
  PDF-only format-binding (standalone har ingen AppSettings). Se godkendelsesgate.

## Godkendelsesgate

- **Påkrævet:** **UI/UX** — for gruppe B–F ændres hvornår en download-knap er slået til, og hvornår
  et klik afvises.
- **Status:** **GODKENDT 2026-07-25** af brugeren på alle tre forelagte punkter (regulering/KRL/
  KL-lønaftaler får settle-før-download + én fælles regel på tværs af de to faner; Satser afviser ved
  revisionsdrift undervejs; standalone MinProcesrente får samme adfærd som hovedappen). Ændringerne er
  alle i retning "knappen bliver slået fra / klikket afvises i tilfælde, hvor der i dag ville blive
  dannet et dokument på et ikke-friskt eller ikke-settlet grundlag". Ingen ændring gør en tidligere
  blokeret download mulig.
- **Konkret brugeroplevelse, der ændres:**
  1. **Regulering/KRL/KL-lønaftaler:** Hvis du står med markøren i et felt og har skrevet noget
     ugyldigt, og så klikker download — i dag dannes dokumentet på de gamle tal. Efter ændringen
     lukkes feltet først, og hvis indtastningen er ugyldig, afvises downloaden og feltet markeres.
  2. **Samme tre:** Knappen er i dag slået til efter to lidt forskellige regler afhængigt af, om du
     står på Oplysninger-fanen eller Lønindkomst-fanen. Efter ændringen er den samme regel begge steder.
  3. **Satser:** Hvis årstallet ændres i det splitsekund, downloaden forberedes, afvises den nu i
     stedet for at danne satser for det gamle år.
  4. **MinProcesrente (standalone):** samme settle-før-download-adfærd som hovedappen.

## Acceptance criteria

- [x] `DocumentDefinition` findes som én typed kontrakt. — 🔶 10 af 21 outputs har sin definition;
      resten i pass 3-6.
- [ ] Ét kanonisk outputkatalog (`DOCUMENT_OUTPUTS`) med completeness-test mod
      `CONSUMER_DOCUMENT_OUTPUTS` (18) + standalone (3). — kataloget findes med 10 poster; testen
      mangler (pass 7).
- [x] Reaktiv gate og click-preflight kalder samme definition — strukturelt sikret: begge går
      gennem `DocumentOutput.evaluateGate`/`.download`, som kalder samme `project`. Testen der
      beviser det, mangler (pass 7).
- [ ] Ingen callsite kalder en generator, `documentLoader` eller `runSelectedDocumentFormat` direkte.
      AST-regel håndhæver det.
- [ ] Alle 21 definitioner: blokeret aktivering starter IKKE lazy-load, generator eller fil-I/O
      (bevist pr. definition, ikke generisk).
- [ ] Matrix pr. output dækker de 9 cases fra planen, herunder eksplicit BÅDE `reason: 'invalid'`
      (format) OG `range`/`bounds` som separate klasser (§A2a).
- [ ] Frisk `EvaluationSourceToken` kræves efter lazy-load OG umiddelbart før generatorstart.
- [ ] Warnings blokerer intet; ikke-relevante fejl blokerer intet.
- [ ] Formatvalget (PDF/Word) sker EFTER gaten.
- [ ] `npm run typecheck`, `typecheck:test`, `lint`, `test` grønne.

## Implementeringsplan (passes)

**Pass 1 — kernen.** ✅ **GENNEMFØRT.** `src/document/definition/` : `documentDefinition.ts` (typer),
`prepareDocument.ts` (barriere + capture + token + projektion + gate → `PreparedDocument<T>` |
`DocumentPreflightRejection`), `runPreparedDocument.ts` (dev-preflight + lazy-load + recheck + format +
generator + fejlrouting — flyttet fra `documentService.ts`), `downloadDocument.ts` (det ene
entrypoint), `documentSourceContext.ts` (kontekst + delt memo), `documentCatalog.ts` (registret).
Mekanikken fra `documentService.ts` er udskilt til `src/document/service/documentRuntimeFailure.ts`.

**Pass 2 — React-grænsen.** ✅ **GENNEMFØRT.**
`src/document/definition/react/useDocumentDownload.ts`: `useDocumentSourceContext()` (én kontekst
pr. revision, delt af alle outputs på siden) + `useDocumentDownload(output, context)` som leverer
BÅDE `canDownload`/`disabledReason` (reaktiv) og `download()` (click-preflight) fra samme definition.

**Pass 3 — definitionerne, gruppe A.** 🔶 **10 af 11 GENNEMFØRT** (definitionerne; callsites er IKKE
skiftet endnu — se "Status og genoptagelse").
- ✅ `src/domain/erstatningsopgoerelse/eoDocumentDefinitions.ts` — 4 outputs
- ✅ `src/domain/erhvervsevnetab/eetDocumentDefinitions.ts` — 4 outputs
- ✅ `src/domain/forsoergertab/forsoergertabDocumentDefinition.ts`
- ✅ `src/domain/varigemen/varigeMenDocumentDefinition.ts`
- ⬜ `rente-oversigt` (den 11. i gruppe A) mangler.

**Pass 4 — gruppe B/C/D (4 outputs).** ⬜ satser (token-lighed kommer nu gratis fra kernen), rente
(typed gate frem for ad hoc boolean), aarsloen + sh-dage (gate flyttes fra `src/hooks/` til
domænelaget og tager `AarsloenReaderProjection` frem for et komponent-samlet snapshot).

**Pass 5 — gruppe E (3 outputs).** ⬜ regulering/krl/kl-loenaftaler får ægte reader-projektion og
gate. Størst adfærdsdelta; sidste af hovedappen.

**Pass 6 — standalone (3 outputs).** ⬜ MinProcesrente ind i samme katalog med PDF-bundet format.

**Pass 7 — callsites, værn og matrix.** ⬜ Alle sider skiftes til `useDocumentDownload`; AST-regler +
den udtømmende matrix + oprydning (slet de nu ubrugte `download*Dokument`-eksports og
`documentService.ts`-rester).

---

## Status og genoptagelse (skrevet 2026-07-25)

**Træet er GRØNT for det, der er lavet:** `npx tsc -p tsconfig.json --noEmit` er ren, og
EO-domænesuiten (115 filer / 1840 tests) er grøn efter settings-indsnævringen i B2. Fuld gate er
IKKE kørt endnu (kommer i pass 7).

**Vigtigt om mellemtilstanden:** de 10 definitioner + kataloget + hook'en er bygget, men **ingen
callsite bruger dem endnu.** Produktionen kører fortsat 100 % på de gamle
`download*Dokument`-funktioner i `documentService.ts` og de håndrullede prepare-sekvenser i
komponenterne. Der er derfor to parallelle veje i træet lige nu — det er bevidst og midlertidigt,
men det betyder også:

- `documentService.ts` er UÆNDRET og skal først ryddes i pass 7.
- `src/document/service/documentRuntimeFailure.ts` er en KOPI af mekanikken fra
  `documentService.ts` (dev-server-ping, dynamic-import-heuristik, `buildDocumentFailureMessage`,
  `resolvePdfStamdata`). Duplikatet forsvinder i pass 7, når `documentService.ts` reduceres.
  **Bemærk:** `lastKnownDevServerUnavailableAt` findes nu i BEGGE moduler som modul-lokal state;
  det er harmløst i mellemtilstanden (kun DEV-fejltekst-heuristik), men skal ikke overleve pass 7.
- Kataloget har 10 af 21 poster. `DOCUMENT_OUTPUTS`-mappen er derfor endnu ikke komplet, og
  completeness-testen er ikke skrevet (pass 7).

**Næste konkrete skridt, i rækkefølge:**

1. **Pass 3 færdig:** skriv `rente-oversigt`-definitionen. Kilde til adfærd:
   `src/components/pages/renteberegning/RenteberegningTab.tsx:204-239` (handler) +
   `:259-273` (reaktiv gate) + `src/domain/renteberegning/renteberegningDownloadGate.ts`.
   Bemærk at `rente-oversigt` og `rente` deler `buildRenteberegningReaderProjection` → brug
   `context.shared`, som EO/EET gør.
2. **Pass 4:** de fire i gruppe B/C/D. `aarsloen`/`sh-dage` er den eneste med reel strukturændring:
   gate-logikken i `src/hooks/useAarsloenDocumentGates.ts:45-108`
   (`resolveAarsloenDocumentEligibility` + `resolveShDageDocumentEligibility`) flyttes til
   `src/domain/aarsloen/` og skal tage `AarsloenReaderProjection`. Reglerne bevares 1:1 (samme
   prædikater, samme beskeder). Standser det på et reelt designvalg → stop og afgør på high (§3).
3. **Pass 5:** regulering/krl/kl-loenaftaler. Adfærdsdeltaet er brugergodkendt (se
   Godkendelsesgate). De to nuværende, ikke-identiske `canDownload`-IIFE'er er i
   `IndtaegtFoerSkadenSection.tsx:635-637` og `AnsaettelsesforholdCard.tsx:856-858`; den ene fælles
   regel skal dække begge. Husk at ÉN knap dispatcher til TRE outputs efter `loenudviklingBasis`
   (`IndtaegtFoerSkadenSection.tsx:646-676`) — tre definitioner, én knap.
4. **Pass 6:** standalone. `src/components/pages/minprocesrente/MinProcesrenteCalculatorPage.tsx:62,95,110`
   → `src/pdf/infrastructure/standaloneRentePdfService.ts`. Standalone har INGEN AppSettings
   (hardcoder `DEFAULT_DOCUMENT_DOWNLOAD_FORMAT`) og må ikke importere `useAppSettings` —
   AST-reglen `layer/minprocesrente-standalone-import-boundary`
   (`architectureRules.ts:631-652`) forbyder det. Definitionerne skal derfor kunne leve med en
   PDF-bundet `DocumentSettings` uden UI-settings.
5. **Pass 7:** skift alle callsites til `useDocumentDownload`, slet de gamle
   `download*Dokument`-eksports, reducér `documentService.ts` (eller slet den), fjern duplikatet i
   `documentRuntimeFailure.ts`, skriv completeness-test + den udtømmende 9-case-matrix pr. output,
   og tilføj AST-reglerne (dokument-entrypoint må ikke omgå prepare; ingen direkte
   generator-/loader-import uden for definitionerne).
6. **Selv-review (opus/high)** på hele diffen, ret fundene, og FØRST derefter codex
   `sol/medium` (brugerbestemt afvigelse, se "Afvigelser fra skillen").

**Kendte fælder, konstateret undervejs:**

- `DocumentDefinition<TInput>` er INVARIANT i `TInput` (den optræder både i `project`s
  returtype og i `loadRenderer`s parametertype). Kataloget kan derfor ikke holde de rå
  definitioner; `closeDocumentDefinition` er det ENE sted, typen eksistentielt lukkes. Brug ikke
  `as`/`unknown` som genvej — det var netop hvad lukningen findes for at undgå.
- Definitionens input-type skal matche generatorens parametertype PRÆCIST. To reelle fejl fanget
  her: `koen` er `Koen | undefined` (ikke `string | undefined`), og differencekravs
  `bilagSelection` skal være projektionens fulde type
  (`ErhvervsevnetabComposedValues['eetDifferencekravBilagSelection']`), fordi generatorens egen
  `BilagSelection` mangler `visUdvidetSpecifikation` og altså er et subset.
- `resolveStamdataDatoLabel` og andre små, synkrone domænefunktioner skal importeres STATISK i
  definitionen; kun selve generatoren lazy-loades. Ellers flytter man utilsigtet domænekode ind i
  den tunge chunk.

## Beslutninger truffet under implementering (opus/high, §0/§3)

### B1. `project` modtager en `DocumentSourceContext`, ikke en bar `InputReader`

**Problem opdaget i pass 3.** To ting brød den oprindelige `project(reader, settings)`-signatur:

1. EO's projektion har brug for `buildMidlertidigtEetInsertSource(evaluation)`, som læser
   `evaluation.issues.all` (`src/hooks/useMidlertidigtEetInsertSource.ts:23-52`) — ikke kun readeren.
2. Fire EO-dokumenter deler ÉN `buildErstatningsopgoerelseReaderProjection` + ÉN
   `evaluateErstatningsopgoerelseDownloadGates`, og sidstnævnte kører `collectAllEoRows`
   (`erstatningsopgoerelseDownloadGate.ts:79-92`). Samme mønster for de fire EET-faner, de to
   rente-outputs og de to årsløn-outputs. Med én `project` pr. output ville den reaktive gate
   køre den samme aggregering fire gange pr. render — en reel performanceregression.

**Beslutning:** `project` modtager `DocumentSourceContext = { evaluation, settings, shared }`
(`src/document/definition/documentSourceContext.ts`).

- `evaluation` frem for `reader`: `evaluation.reader` og `evaluation.issues` er bundet til det
  SAMME token af `createInputEvaluation`, så konteksten er den ærlige dependency. At sende kun
  readeren ville tvinge hver definition til at genudlede issue-siden — netop den drift, Fase 5
  fjerner.
- `shared(key, compute)`: en memo nøglet på selve kontekst-objektet (én pr. revision på
  render-siden, én pr. aktivering i preflighten). Nøglen er objektidentitet, IKKE tokenet: to
  kontekster med samme token er stadig to selvstændige immutable snapshots, så cachen kan aldrig
  udlevere et resultat, der hører til andet input eller andre settings.

**Fravalgt alternativ:** at lade kataloget holde per-domæne-grupperede definitioner
(`EoDocumentFamily` med fire outputs). Det ville gøre "ét output = én definition" utrue og
genindføre en gruppe-abstraktion oven på katalogets flade liste; memoen løser samme problem uden
at ændre katalogets form.

### B2. EO-download-gatens settings-dependency indsnævres til de to regel-toggles

**Problem opdaget i pass 3.** `evaluateErstatningsopgoerelseDownloadGates` krævede hele
`AppSettings`, men dokument-lagets `DocumentSettings` kender bevidst kun brevhoved + format
(`documentBrevhoved.ts:9-15`: "Dokument-laget kender IKKE UI-indstillingstypen"). Definitionen kunne
derfor ikke kaldes fra en kontekst med `DocumentSettings`.

**Kortlægning af den faktiske afhængighed.** Hele row-evalueringen læser præcis fire nøgler:

| Nøgle | Læst i | Nås af download-gaten? |
|---|---|---|
| `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden` | `eoRowIndkomstRows.ts:124` | **Ja** (builder-stien) |
| `allowReguleringMedUdloebMedMaaneder` | `eoRowIndkomstRows.ts:125` | **Ja** (builder-stien) |
| `defaultFuldLoenUnderFerie` | `eoRowIndkomstModel.ts:120` | Nej |
| `defaultLoenPaaHelligdage` | `eoRowIndkomstModel.ts:151` | Nej |

De to sidste (plus `resolveDefaultOverenskomstFilter`) bruges UDELUKKENDE af
`isLoenindkomstAnsaettelsesforholdEffectivelyEmpty`, som kun har én konsument:
`eoInspektionPageViewModel.ts:213` (DEV-inspektionsfanen). Ingen row-builder kalder den.

**Beslutning.** `DocumentSettings` udvides med de to regel-toggles, og
`EoRowEvaluationContext.appSettings` + `collectAllEoRows` + `buildEoIndkomstRows` +
`evaluateErstatningsopgoerelseDownloadGates` indsnævres fra `AppSettings` til `DocumentSettings`.

Begrundelse — dette er ikke en type-workaround, men en synliggjort invariant:

1. De to toggles ER dokumentgate-input: de afgør validerings-severity for
   overenskomst-/reguleringsdækning og kan flytte en EO-download fra tilladt til blokeret.
2. Begge er allerede med i `evaluationSettingsFingerprint`, så en ændring bumper
   settingsrevisionen og gør et optaget token stale. En builder, der begyndte at læse en nøgle
   UDEN for fingerprintet, ville derimod kunne godkende en download, der ikke blev stale ved et
   regelskift. Den smalle type gør den fejlklasse **urepræsenterbar** frem for kun usandsynlig.
3. Afhængighedspilen UI → dokument bevares: dokument-laget kender værdierne, ikke `AppSettings`.

**Fundet, men UDEN FOR SCOPE (ny WI, se "Resterende"):** `evaluationSettingsFingerprint`
(`productionInputRuntime.tsx:36-42`) er hånd-vedligeholdt, og intet håndhæver, at den dækker det,
evalueringen faktisk læser. Der er ingen live fejl i dag (de to gate-relevante nøgler ER med), men
værnet mangler. Indsnævringen i B2 lukker hullet for EO's row-stien; den generelle håndhævelse er
Fase 6-arbejde.

## Verifikation

- **Plan:** pr. pass målrettede tests; efter pass 7 fuld gate
  (`typecheck`, `typecheck:test`, `lint`, `test`). Klasse H ⇒ fuld gate før handoff.
- **Resultat (delvist, 2026-07-25 — pass 1-3 delvist):**
  - `npx tsc -p tsconfig.json --noEmit` → **grøn**.
  - `npx vitest run src/__tests__/domain/erstatningsopgoerelse src/__tests__/domain/eoRowEvaluation`
    → **grøn** (115 filer / 1840 tests). Kørt specifikt for at bevise, at B2's
    settings-indsnævring er adfærdsneutral.
  - **Bevidst IKKE kørt endnu:** `typecheck:test`, `lint`, fuld `test`, samt matrix/completeness
    (findes ikke endnu). De hører til pass 7 og en færdig cutover; en delvis kørsel på
    mellemtilstanden ville hverken bevise eller afvise noget, da ingen callsite er skiftet.

## Review-fund (udfyldes i review-fasen)

| # | Fund og evidens | Alvor | Disposition | Status |
|---|---|---|---|---|
|   |   |   | rettet / afvist med evidens / ny WI-xxx | |

## Resterende / risici

- **Mellemtilstand:** to parallelle veje i træet (gamle `download*Dokument` i produktion, ny
  definition-kerne ubrugt). Se "Status og genoptagelse". Træet er kompilerbart, men Fase 5 er
  IKKE leveret, og `documentRuntimeFailure.ts` duplikerer bevidst mekanik fra `documentService.ts`
  indtil pass 7.
- Fase 6 (forbudt-symbol-gate, ledger-nedlæggelse) er ikke i scope.
- `useAarsloenDocumentGates`' snapshot-baserede input er den ene reelle strukturændring i
  domænelaget; hvis eligibility-reglerne ikke kan udtrykkes rent på projektionen, standses pass 4
  og beslutningen tages på high (§3).
- **NY WI (skal oprettes):** `evaluationSettingsFingerprint` er hånd-vedligeholdt uden værn mod
  drift fra det, evalueringen faktisk læser (se B2's sidste afsnit). Ingen live fejl i dag. Roden
  ligger uden for Fase 5's scope og hører i Fase 6's håndhævelsesarbejde. Forslag til værn: udled
  fingerprintet af et eksplicit erklæret `EVALUATION_RELEVANT_SETTINGS_KEYS` med
  `satisfies`-completeness, og lad en AST-/type-regel bevise, at ingen evalueringsafhængig
  kodesti læser en nøgle uden for sættet.
