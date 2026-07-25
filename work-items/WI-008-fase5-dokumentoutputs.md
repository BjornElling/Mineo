# WI-008: Fase 5 — alle 18 dokumentoutputs bag én typed dokumentdefinition

- **Status:** `under-implementering` — kernen er færdig og fuld gate er grøn; 16 af 21 definitioner
  står. Resterende: pass 5 (regulering/krl/kl-loenaftaler), pass 6 (standalone), pass 7 (cutover +
  værn + matrix). **Læs "Status og genoptagelse" nederst før arbejdet genoptages.**
- **Oprettet:** 2026-07-25
- **Slice/scope:** greenfield-planens Fase 5 (`docs/architecture/draft-commit-greenfield-design.md` linje 1447-1501)
- **Kilde:** brugerønske ("implementér så stor en del som muligt, gerne hele fase 5")
- **Risikoklasse:** **H** — dokumentgate er trust-kritisk output, tværgående arkitektur, 18 entrypoints,
  freshness/stale-revision og fail-closed-semantik. Slutreview køres på **`sol/high`** (skillens
  normale klasse-H-routing; den tidligere token-begrundede afvigelse til `sol/medium` er ANNULLERET
  af brugeren 2026-07-25, se "Review-fund").
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

- [x] `DocumentDefinition` findes som én typed kontrakt. — 🔶 **16 af 21** outputs har sin definition;
      regulering/krl/kl-loenaftaler (pass 5) + 3× standalone (pass 6) mangler.
- [ ] Ét kanonisk outputkatalog med completeness-test mod `CONSUMER_DOCUMENT_OUTPUTS` (18) +
      standalone (3). — **ID-inventaret findes** (`documentOutputId.ts`) og katalog-FABRIKKEN findes
      (`closeDocumentDefinition`), men runtime-katalogerne komponeres først i app-rødderne i pass 7
      (C3: kataloget må ikke være en global `Map` i kernelaget). Completeness-testen skrives der.
- [x] Reaktiv gate og click-preflight kalder samme definition — strukturelt sikret: begge går
      gennem katalogpostens `evaluateGate`/`download`, som kalder samme `project` med samme
      `request`. Testen der beviser det, mangler (pass 7).
- [ ] Ingen callsite kalder en generator, `documentLoader` eller kernens interne moduler direkte.
      AST-regel håndhæver det. (Pass 7.)
- [ ] Alle 21 definitioner: blokeret aktivering starter IKKE lazy-load, generator eller fil-I/O
      (bevist pr. definition, ikke generisk). — **strukturelt sikret nu** (afvikleren er ikke
      eksporteret, og dens input kan kun konstrueres af preflighten; verificeret med
      `@ts-expect-error`-prober), men beviset PR. DEFINITION hører i matrixen (pass 7).
- [ ] Matrix pr. output dækker de 9 cases fra planen, herunder eksplicit BÅDE `reason: 'invalid'`
      (format) OG `range`/`bounds` som separate klasser (§A2a). (Pass 7.)
- [x] Frisk `EvaluationSourceToken` kræves ved HVER asynkron grænse — entry, efter dev-preflight,
      efter generator-load, efter writer-load OG efter rendererens promise før fil-I/O. Se B5 for
      entry-checket, der oprindeligt manglede uden for dev-server-grenen.
- [x] Warnings blokerer intet; ikke-relevante fejl blokerer intet. — arvet uændret fra de
      genbrugte `evaluate*DownloadGate`/projektioner (§5.4); verificeres i matrixen.
- [x] Formatvalget (PDF/Word) sker EFTER gaten — `environment.resolveFormat` kaldes i afvikleren,
      efter `project` har sagt ready.
- [x] `typecheck`, `typecheck:test`, `lint`, `test` grønne. — **kørt 2026-07-26: 484 filer / 6109
      tests grøn.** Skal køres igen efter pass 5-7.

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

**Pass 0 — KERNEOMSKRIVNING (indsat 2026-07-25 efter codex-review; se B3).** ✅ **GENNEMFØRT
2026-07-26.** Omskriv
`src/document/definition/` til den nye kerneform: `DocumentDefinition<TRequest, TInput>`,
`DocumentExecutionEnvironment`, brevhoved-policy, nominal/modulprivat `PreparedDocument` verificeret
mod miljøets token-reader, én end-to-end resultat-union, `requireCurrentSource()` i alle async-faser,
katalogfabrik + app-komposition, typebundet `shared(builder)`. Tilpas de 10 eksisterende
definitioner mekanisk. Lukker C1-C8. **Skal være færdigt FØR pass 3-6 fortsætter.**

**Pass 3 — definitionerne, gruppe A.** 🔶 **10 af 11 skrevet, men mod den GAMLE kerneform** —
tilpasses i pass 0 (callsites er IKKE skiftet endnu — se "Status og genoptagelse").
- ✅ `src/domain/erstatningsopgoerelse/eoDocumentDefinitions.ts` — 4 outputs
- ✅ `src/domain/erhvervsevnetab/eetDocumentDefinitions.ts` — 4 outputs
- ✅ `src/domain/forsoergertab/forsoergertabDocumentDefinition.ts`
- ✅ `src/domain/varigemen/varigeMenDocumentDefinition.ts`
- ⬜ `rente-oversigt` (den 11. i gruppe A) mangler.

**Pass 4 — gruppe B/C/D (4 outputs).** ✅ **GENNEMFØRT 2026-07-26.**
- ✅ `satser` (`src/domain/satser/satserDocumentDefinition.ts`) — token-ligheden kommer nu gratis fra
  kernen; det var netop det hul, gruppe B manglede.
- ✅ `rente` + `rente-oversigt` (`src/domain/renteberegning/renteberegningDocumentDefinitions.ts`) —
  `rente` er det første output med ægte `TRequest` (`{ rowId }`). Fire duplikerede gate-preluder i
  `RenteberegningTab` er nu ÉN `project`-kæde.
- ✅ `aarsloen` + `sh-dage` (`src/domain/aarsloen/aarsloenDocumentDefinitions.ts` +
  `aarsloenDownloadGate.ts`) — gate-reglerne flyttet fra `src/hooks/useAarsloenDocumentGates.ts` til
  domænelaget og læser nu `AarsloenReaderProjection`. **Ækvivalensen er BEVIST, ikke påstået:**
  `src/__tests__/domain/aarsloen/aarsloenDownloadGate.equivalence.test.ts` kører gammel og ny
  implementering på de samme 9 scenarier for BEGGE gates (18 cases) og kræver identisk `canDownload`,
  årsagskode og besked. 19/19 grøn. Testen slettes sammen med `useAarsloenDocumentGates` i pass 7.
  Den ENE bevidste forskel er dokumenteret og testet særskilt: projektionen har `calculation === null`
  når feltgaten er rød (§3.9 — motoren kaldes ikke), hvor det gamle snapshot altid havde et forsøgt
  resultat; den nye gate blokerer da med samme klasse (`fatal-calculation-error`).

**Pass 5 — gruppe E (3 outputs).** ⬜ regulering/krl/kl-loenaftaler får ægte reader-projektion og
gate. Størst adfærdsdelta; sidste af hovedappen.

**Pass 6 — standalone (3 outputs).** ⬜ MinProcesrente ind i samme katalog med PDF-bundet format.

**Pass 7 — callsites, værn og matrix.** ⬜ Alle sider skiftes til `useDocumentDownload`; AST-regler +
den udtømmende matrix + oprydning (slet de nu ubrugte `download*Dokument`-eksports og
`documentService.ts`-rester).

---

## Status og genoptagelse (opdateret 2026-07-26)

**Træet er GRØNT.** Fuld gate kørt på dette commit:

| Check | Resultat |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | grøn |
| `npx tsc -p tsconfig.test.json --noEmit` | grøn |
| `npx eslint` (alle berørte områder) | grøn |
| `npx vitest run` (fuld suite) | **484 filer / 6109 tests grøn** |

`scripts/generate-build-info.mjs` blev kørt før suiten (jf. den kendte fælde om forældet build-info,
der forskyder dato-gates).

### Hvad der står færdigt

**16 af 21 definitioner + hele kernen.** Kernens moduler og deres ansvar er dokumenteret i
`docs/architecture/draft-commit-greenfield-design.md` under "Kernens moduler" — læs den tabel FØRST.

| Pass | Indhold | Status |
|---|---|---|
| 0 | Kerneomskrivning (lukker C1–C8) + tilpasning af de 10 første definitioner + `EoRowPolicy` | ✅ |
| 3 | 4× EO, 4× EET, forsørgertab, varige mén, rente-oversigt | ✅ |
| 4 | satser, rente (`TRequest = {rowId}`), aarsloen, sh-dage | ✅ |
| 5 | regulering, krl, kl-loenaftaler + `DocumentAction` (se B4) | ⬜ |
| 6 | 3× standalone MinProcesrente | ⬜ |
| 7 | Callsite-cutover, oprydning, værn, matrix | ⬜ |

### Mellemtilstanden — læs dette før du fortsætter

**Ingen callsite bruger kernen endnu.** Produktionen kører fortsat 100 % på de gamle
`download*Dokument`-funktioner i `documentService.ts` og de håndrullede prepare-sekvenser i
komponenterne. To parallelle veje i træet er bevidst og midlertidigt. Konsekvenser:

- `documentService.ts` er UÆNDRET (982 linjer, 18 eksports) og ryddes først i pass 7.
- `src/document/service/documentRuntimeFailure.ts` er nu reduceret til TO port-implementeringer
  (`ensureDevServerAvailableForDocumentDownload`, `reportDocumentRuntimeFailure`). Den duplikerer
  fortsat dev-server-ping-mekanikken med `documentService.ts`, og
  `lastKnownDevServerUnavailableAt` findes i BEGGE moduler som modul-lokal state. Harmløst i
  mellemtilstanden (kun DEV-fejltekst-heuristik), men må ikke overleve pass 7.
- `DOCUMENT_OUTPUTS`-registret findes IKKE længere som en global `Map` — kataloget er nu kun en
  fabrik (`closeDocumentDefinition`), og komposition sker i app-rødder (C3). Pass 7 skal derfor
  OPRETTE Mineos runtime-katalog, ikke udvide et eksisterende.
- `src/hooks/useAarsloenDocumentGates.ts` lever stadig og bruges af `Aarsloen.tsx`. Den nye
  domæne-gate ligger parallelt, og ækvivalensen mellem dem er bevist af
  `src/__tests__/domain/aarsloen/aarsloenDownloadGate.equivalence.test.ts`. **Slet både hooken og
  ækvivalens-testen i pass 7** — testen har kun værdi, så længe begge implementeringer findes.

### Næste konkrete skridt

1. **Pass 5 — regulering/krl/kl-loenaftaler.** Følg **B4**: `DocumentAction`-resolver, der vælger
   `{definition, request}` EFTER settle. `TRequest` = `{scope:'case'} | {scope:'employment';
   employmentId}` (identiteten er `af.id`). De to callsites er
   `IndtaegtFoerSkadenSection.tsx:635-637` + `:646-676` (sagsniveau) og
   `AnsaettelsesforholdCard.tsx:856-858` + `:866-895` (pr. ansættelsesforhold). Den ene fælles
   `canDownload`-regel skal dække begge. Adfærdsdeltaet er brugergodkendt (se Godkendelsesgate).
   Bemærk: `resolveReguleringInterval` (`documentService.ts:374-383`) KASTER ved ugyldigt interval —
   i den nye struktur skal det være en `blocked`-årsag fra `project`, ikke en exception.
2. **Pass 6 — standalone.** Byg et andet `DocumentExecutionEnvironment`:
   `resolveFormat: () => 'pdf'`, `brevhoved: {kind:'none'}`, ingen `checkDevServerAvailability`,
   og en lokal `reportFailure` (standalone må IKKE importere `reportSystemIssue` — AST-reglen
   `layer/minprocesrente-standalone-import-boundary`, `architectureRules.ts:631-652`, forbyder det).
   Callsites: `MinProcesrenteCalculatorPage.tsx:62,95,110` →
   `src/pdf/infrastructure/standaloneRentePdfService.ts`.
   **Åbent punkt:** `downloadAllStandaloneRentePdf` komponerer N renteberegninger i ÉN artifact via
   `createDocumentComposer` + `writeRenteDocumentContent` og kalder altså ikke én generator.
   `DocumentRenderer<TInput>` kan godt udtrykke det (den returnerer blot en `DocumentArtifact`, og
   `loadRenderer` må gerne bygge den selv), men det bør bekræftes ved implementering. `TRequest` for
   den bliver et rækkesæt-udvalg — hold fast i identitets-invarianten: ID'er, ikke præberegnede rækker.
3. **Pass 7 — cutover og værn.**
   - Opret Mineos runtime-katalog (og standalones) fra fabrikken; skriv completeness-test mod
     `MINEO_DOCUMENT_OUTPUT_IDS` + `STANDALONE_DOCUMENT_OUTPUT_IDS` (og mod
     `CONSUMER_DOCUMENT_OUTPUTS`).
   - Skift alle callsites til `useDocumentDownload`; slet de 18 `download*Dokument`, reducér/slet
     `documentService.ts`, fjern dev-server-duplikatet, slet `useAarsloenDocumentGates` +
     ækvivalens-testen, slet `standaloneRentePdfService.ts`.
   - AST-værn: intet entrypoint må importere en generator, `documentLoader` eller kernens interne
     moduler uden for definitionerne. **Mutationstest værnet** (jf. guard-selvtest-princippet).
   - Den udtømmende 9-case-matrix pr. output, incl. `reason:'invalid'` OG `range`/`bounds` som
     SEPARATE klasser (§A2a), og bevis pr. definition at blokeret aktivering ikke starter lazy-load,
     generator eller fil-I/O.
4. **Slutreview:** codex `sol/high` (klasse H). **Scope prompten til en DIFF, ikke en filliste** — to
   forsøg på pass-0-reviewet løb tør for budget, fordi prompten listede for mange filer og modellen
   dumpede dem i stedet for at konkludere.

### Kendte fælder, konstateret undervejs

- **`defineMineoDocument`, ikke `defineDocumentOutput`.** `defineDocumentOutput` inferer
  `TBrevhovedKey` fra det konkrete literal (fx `'shDage'`) og giver en definition, der er SMALLERE
  end `MineoDocumentDefinition` og derfor ikke kan tildeles den (`DocumentBrevhovedPolicy` er
  invariant i sin nøgletype). Brug hovedappens konstruktør.
- **Definitionens input-type skal matche generatorens parametertype PRÆCIST.** Reelle fejl fanget
  her: `koen` er `Koen | undefined` (ikke `string | undefined`); differencekravs `bilagSelection`
  skal være projektionens fulde type, fordi generatorens egen `BilagSelection` mangler
  `visUdvidetSpecifikation`; og `sh-dage`s `perioder` skal være `PeriodeResult['perioder']`
  (`DateInterval[]`), fordi generatorens `defineDocument`-parameter er MUTABEL og ikke tager et
  `readonly`-array. Genbrug kildens egen type frem for at restate den.
- **Kun generatoren lazy-loades.** Små, synkrone domænefunktioner (`resolveStamdataDatoLabel` m.fl.)
  importeres STATISK i definitionen; ellers flytter man domænekode ind i den tunge chunk.
- **`context.shared(builder)` — builderen ER nøglen.** Den skal være en modul-lokal `const`, ellers
  rammer to kald aldrig samme slot.
- **Boundary-værn kan brække af filflytninger.** `domainBoundaryIsolation.test.ts` assertede, at
  `useMidlertidigtEetInsertSource.ts` indeholdt `buildErhvervsevnetabReaderProjection`; da builderen
  flyttede til domænelaget, fejlede værnet. Det er nu udvidet til at dække BEGGE filer og er
  mutationstestet. Tjek tilsvarende sti-baserede værn, når du flytter filer i pass 7.

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

### B3. Frameworket omskrives fra bunden frem for at lappes (besluttet 2026-07-25, opus/high, §0/§3)

**Anledning.** Codex' otte fund er ikke otte fejl. Syv af dem (C1–C7) deler én rod, som jeg selv
formulerede forkert i kortlægningen: jeg skrev, at rettelsen var at gøre livscyklussen til ét objekt
— men jeg byggede det objekt som **fællesmængden af de 18 eksisterende servicefunktioner** frem for
at designe livscyklussen fra bunden. Derfor:

- arvede kernen `documentService.ts`' runtime-politik (settings-drevet format/brevhoved, central
  fejl-sink) som en *forudsætning* i stedet for som en *injiceret afhængighed* → C2, C3;
- arvede den `{success, error}`-fejlalgebra, der ikke kan skelne stale fra generatorfejl → C6;
- kopierede den gamle stiens manglende post-render-recheck → C7;
- modellerede kun det de 18 funktioner havde til fælles, og de fem parameteriserede outputs var
  ikke i den fællesmængde → C1;
- og "urepræsenterbart" blev en kommentar i stedet for en type, fordi den strukturelle
  `PreparedDocument` var nok til at få de 10 første definitioner til at compile → C5, og
  tilsvarende blev B2 en type-workaround → C4.

**Beslutning.** `src/document/definition/` omskrives, før der bygges flere definitioner ovenpå.
Kriteriet er §0's: hvad giver det bedste slutprodukt. Tre alternativer blev vejet:

1. **Lap de otte fund i den nuværende form.** Forkastet: C1 og C2 kræver ændringer i
   `DocumentDefinition`s og kernens SIGNATURER (parameter-slot; injiceret miljø). Lapper man dem
   enkeltvis, får man optionelle felter og escape-hatches — netop det Fase 5 findes for at fjerne,
   og netop det brugeren udtrykkeligt bad om ikke at gøre.
2. **Behold kernen, men indfør et parallelt "avanceret" spor for de parameteriserede outputs.**
   Forkastet hårdt: to veje gennem download-livscyklussen er præcis Fase 5's oprindelige sygdom.
3. **Omskriv kernetyperne nu, mens der kun er 10 definitioner og NUL callsites.** Valgt.
   Omkostningen er lavest den er nogensinde bliver: de 10 definitioner skal justeres mekanisk
   (`project` får en `request`-parameter, `brevhovedType` bliver en policy), ingen produktionskode
   afhænger endnu af kernen, og de resterende 11 skrives kun én gang — mod den rigtige form.

**Den nye kerneform (bindende for resten af Fase 5):**

- `DocumentDefinition<TRequest, TInput>` — `project(context, request)`. `TRequest` er KUN stabil
  identitet (`rowId`, `{scope, entityId}`), aldrig præberegnet data; entiteten genlæses friskt efter
  settle. Outputs uden parameter får `TRequest = void`.
- `DocumentExecutionEnvironment` — obligatorisk, komponeret pr. app: source-port, autoritativ
  `readCurrentSourceToken`, format/session-policy, failure-sink. Kernen kender ingen `AppSettings`.
- Brevhoved som discriminated policy: `{ kind: 'settings-key', key } | { kind: 'none' }`.
- `PreparedDocument` bliver modulprivat/nominal; kun en app-bundet aktivering eksporteres.
  Runneren verificerer mod miljøets token-reader, ikke mod en injiceret closure.
- Én end-to-end resultat-union med fase/cause; samme stale-taksonomi i ALLE faser; `reasons` som
  non-empty tuple.
- `requireCurrentSource()` kaldt ved entry, efter DEV-preflight, efter hvert modul-load og efter
  rendererens promise før fil-I/O.
- Katalog: fabrik i kernen, komposition i app-/route-rødder; to runtime-kataloger; ét ID-inventar
  som completeness-kilde.
- `shared(builder)` med builderen som både nøgle og compute (typebundet).

**Konsekvens for planen.** Pass 3-7 omnummereres: der indsættes et **pass 0 (kerneomskrivning +
tilpasning af de 10 definitioner)** før de resterende 11. C4's source-settings-projector og C6's
centrale fejloverflade har rødder uden for Fase 5; de behandles i pass 0 så langt Fase 5 kræver, og
resten udskilles (se "Resterende").

**Uændret:** ingen af rettelserne ændrer beregningstal, persisteret form eller
dokumentindhold. Den brugergodkendte adfærdsdelta (gruppe B-F) er uændret. C6 kan ændre
FEJLBESKEDER i stale-tilfælde — det er en stramning i fail-closed retning og ligger inden for den
allerede godkendte ramme (»klik afvises i tilfælde, hvor der i dag dannes et dokument på et
ikke-friskt grundlag«), men noteres eksplicit her.

### Pass 0's resultat (2026-07-26) — hvad der faktisk blev bygget

Nye moduler i `src/document/definition/`:

| Modul | Ansvar | Lukker |
|---|---|---|
| `documentOutputId.ts` | ID-inventaret, uden afhængigheder; `MINEO_*` (18) + `STANDALONE_*` (3) | C3 (completeness uden domænegraf) |
| `documentOutcome.ts` | Én end-to-end union: `downloaded` / `rejected{gate-blocked,stale-source,settle-failed}` / `failed{dev-server-unavailable,runtime}`, alle med `phase` som DIAGNOSTIK. Non-empty `DocumentGateReasons` + `toGateReasons` | C6 |
| `documentExecutionEnvironment.ts` | Injiceret app-runtime: `captureSource`, `readCurrentSourceToken`, `criticalActions`, `resolveFormat`, `createSession`, `resolveVisBrevhoved`, `checkDevServerAvailability?`, `reportFailure`. Brevhoved som `{kind:'settings-key',key} \| {kind:'none'}` | C2 |
| `documentSourceSettings.ts` | `DocumentRenderSettings` / `EoRowPolicy` / `DocumentSourceSettings` + `SOURCE_RELEVANT_SETTINGS_KEYS` med compile-time completeness | C4 |
| `documentDefinition.ts` | `DocumentDefinition<TRequest, TInput, TSettings, TBrevhovedKey>`; `project(context, request)`; `labels.documentName` frem for `errorLabel` | C1, C6 |
| `documentSourceContext.ts` | `shared(builder)` — builderen er selv nøglen, så nøgle og resultattype ikke kan skilles | C8 |
| `documentLifecycle.ts` | Preflight OG afvikling i ét modul. `PreparedDocument` nominal (`unique symbol`-brand) + modulprivat; kun `executeDocumentDownload` eksporteres; `requireCurrentSource()` ved entry, efter dev-preflight, efter renderer-load, efter writer-load OG efter render før fil-I/O | C5, C7 |
| `documentCatalog.ts` | Kun FABRIK (`closeDocumentDefinition`), ingen definitioner. Binder definition til miljø | C3 |
| `documentMessages.ts` | Beskeder ud fra TILSTAND, ikke fase; ingen `/PDF/g`-substitution | C6 |
| `mineoDocumentDefinition.ts` | Hovedappens alias, så de 18 ikke gentager fire typeparametre | — |
| `react/useDocumentDownload.ts` | Miljøet injiceres; `blockedReasons` bevarer HELE listen | C2, C6 |
| `src/document/runtime/mineoDocumentEnvironment.ts` | Mineos composition root | C2 |

Øvrige ændringer: `readCurrentEvaluationSourceToken` tilføjet i `productionInputRuntime.tsx` (den
autoritative friskhedskilde); `evaluationSettingsFingerprint` udledes nu af
`SOURCE_RELEVANT_SETTINGS_KEYS`; `buildMidlertidigtEetInsertSource` flyttet til
`src/domain/erhvervsevnetab/midlertidigtEetInsertSource.ts` (rent domænemodul uden React);
`EoRowPolicy` erstatter `DocumentSettings` i `src/domain/eoRowEvaluation/` +
`erstatningsopgoerelseDownloadGate.ts`, og kontekstfeltet `appSettings` er omdøbt til `rowPolicy`;
de gamle `prepareDocument.ts`/`runPreparedDocument.ts`/`downloadDocument.ts` er SLETTET;
`documentRuntimeFailure.ts` reduceret til to port-implementeringer (dead `resolvePdfStamdata` og
`buildDocumentFailureMessage` fjernet).

**Verifikation af pass 0 (ikke kun påstået):**

1. `npx tsc -p tsconfig.json --noEmit` → **grøn** (hele appen).
2. **C5 bevist lukket:** probe med `@ts-expect-error` på `lifecycle.runPreparedDocument` og
   `lifecycle.PreparedDocument` — BEGGE fyrede, dvs. navnene findes ikke offentligt. Til
   sammenligning compilerede den tilsvarende bypass-probe RENT før pass 0.
3. **C4's værn mutationstestet:** en ekstra nøgle tilføjet til `DocumentSourceSettings` gav
   compile-fejl i completeness-checket (`documentSourceSettings.ts:73`). Værnet er altså ikke inert.
4. **Adfærdsneutralitet af `EoRowPolicy`-indsnævringen:** `src/__tests__/domain/erstatningsopgoerelse`
   + `src/__tests__/domain/eoRowEvaluation` → **115 filer / 1840 tests grøn**. Den ene fejl undervejs
   var en test, der assertede det gamle feltnavn `appSettings`; rettet til `rowPolicy` (ren
   omdøbning, ingen adfærd).

### B4. Regulering/KRL/KL: outputvalget flyttes efter barrieren via en `DocumentAction` (besluttet 2026-07-26, opus/high, §0/§3)

**Anledning.** C1's sidste led. Knappen "Tilgængelige reguleringssatser" findes to steder — EO's
Oplysninger-fane (sagsniveau) og hvert ansættelsesforhold på Lønindkomst-fanen — og den dispatcher
til TRE forskellige outputs afhængigt af `loenudviklingBasis`:

- `IndtaegtFoerSkadenSection.tsx:646-676` (sagsniveau)
- `AnsaettelsesforholdCard.tsx:866-895` (pr. `af.id`)

Begge læser `loenudviklingBasis` ved KLIK, altså FØR commit-barrieren. Et settle kan ændre netop den
værdi (feltet er en almindelig committed indtastning), så det leverede dokument kan tilhøre et andet
output end det, den friske revision peger på. `executeDocumentDownload` tager én definition som
parameter og kan derfor ikke selv rette op på det.

**Beslutning.** Der indføres en `DocumentAction`: en typed resolver, som ejer BÅDE den reaktive gate
og outputvalget, og som vælger `{definition, request}` FØRST efter settle, på det friske snapshot.

- `TRequest` for de tre bliver `{ scope: 'case' } | { scope: 'employment'; employmentId: string }` —
  ren identitet (`af.id`), aldrig `interval`/`overenskomstId`/labels, som callsiten i dag beregner
  og sender med. Alle de værdier genlæses friskt i `project` fra entiteten.
- Resolveren afgør ud fra den friske `loenudviklingBasis`, hvilken af de tre definitioner der gælder,
  og returnerer `blocked` med en synlig grund, hvis basis ikke svarer til noget output.
- Den ene fælles `canDownload`-regel (brugergodkendt punkt 2) lever i resolveren, så de to callsites
  ikke længere har hver sin IIFE-formel (`IndtaegtFoerSkadenSection.tsx:635-637` vs
  `AnsaettelsesforholdCard.tsx:856-858`).

**Fravalgt:** at lade de tre outputs blive ét output med en intern variant-switch. Det ville skjule
tre reelt forskellige dokumenter (og tre `documentName`-labels, tre generatorer) bag ét id og bryde
katalogets "ét id = ét output"-invariant samt completeness-testen mod `CONSUMER_DOCUMENT_OUTPUTS`.

**Konsekvens for kernen:** `executeDocumentDownload` er uændret. `DocumentAction` er et lag OVER
kataloget, ikke en ændring af livscyklussen — den vælger hvilket katalogopslag der aktiveres, og
livscyklussen er fortsat den ene vej til afvikling.

### B5. Entry-check flyttet ud af dev-server-grenen (2026-07-26)

Ved selv-review af pass 0 fandt jeg, at `runPreparedDocument`'s første friskhedscheck lå INDE i
`if (environment.checkDevServerAvailability)`. I hovedappen er porten altid sat (og returnerer
`null` uden for DEV), så checket kørte — men et miljø UDEN porten, fx standalone i pass 6, ville slet
ikke blive verificeret mellem gate og modul-load. Checket er flyttet ud som et ubetinget entry-check
(`phase: 'gate'`). Fundet stammer fra min egen C7-rettelse og var altså ikke helt lukket.

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

## Review-fund

### Afvigelse fra skillen ANNULLERET 2026-07-25 (brugerbeslutning)

Brugeren har eksplicit bedt om **codex sol 5.6 / high** til et kritisk struktur- og arkitekturreview
af det hidtidige arbejde. Punkt 1 i "Afvigelser fra skillen" (sol/medium af token-hensyn) er dermed
ophævet; klasse H's normale `sol/high`-routing gælder igen. Punkt 2 (mit eget indledende review)
bevares som supplement, ikke som erstatning.

### Egne fund før codex-svar (opus/high, 2026-07-25)

| # | Fund og evidens | Alvor | Disposition | Status |
|---|---|---|---|---|
| E1 | **`PreparedDocument` er IKKE ikke-konstruerbar.** Typen er et almindeligt eksporteret struktur-`Readonly<{…}>` uden brand/nominalitet (`prepareDocument.ts:47-53`). Bevist ved probe: en callsite, der har en LOVLIGT optaget kilde (`captureProductionEvaluationSource()`), kan håndbygge en `PreparedDocument` med et `input`, der aldrig har været gennem `definition.project`, og kalde `runPreparedDocument` — uden `as`, `unknown` eller cast. Probe typecheckede rent mod `tsconfig.json`. Kun de brandede revisionstal stoppede en HELT fabrikeret variant; med et ægte token er der intet værn. Dermed er påstanden i `documentDefinition.ts:12-15`, `runPreparedDocument.ts:2-4`, WI'ens scope og design-dokumentets Fase 5-afsnit ("at omgå gaten er urepræsenterbart frem for blot frarådet") **faktuelt forkert**. | **Kritisk (arkitektur-påstand)** | Afventer codex' uafhængige vurdering, derefter beslutning på high | åben |
| E2 | **Abstraktionen har ingen parameter-slot, men mindst 3 outputs er parameteriserede.** `project: (context) => …` kan kun læse input-snapshottet. Men `rente` downloades **pr. række** ud fra et `rowId`, som er et BRUGERVALG og ikke findes i `context.evaluation` (`RenteberegningTab.tsx:164-176`), og standalone `downloads-alle` er parameteriseret af et rækkesæt (`standaloneRentePdfService.ts:downloadAllStandaloneRentePdf`). Uden en typet parameter i definitionen vil pass 4/6 blive tvunget til en escape-hatch (definition-fabrik pr. klik, eller `rowId` smuglet ind via closure) — netop det mønster Fase 5 findes for at fjerne. | **Høj (blokerer pass 4+6)** | Afventer codex; derefter designvalg på high | åben |
| E3 | **`downloadAllStandaloneRentePdf` passer ikke i `render`-formen.** Den komponerer N renteberegninger i ÉN artifact via `createDocumentComposer` + `writeRenteDocumentContent` og kalder altså ikke én generator (`standaloneRentePdfService.ts`). `DocumentRenderer<TInput>` antager ét generatorkald pr. output. | Middel (blokerer pass 6) | Afventer codex | åben |
| E4 | **`resolvePdfStamdata` er død kode i det nye lag.** Kopieret til `documentRuntimeFailure.ts:222-237`, men ingen i definition-laget bruger den: de nye definitioner får typet `StamdataValues` fra `projectStamdataForDocument(...)` i stedet for at re-parse `unknown` ved servicegrænsen. Det er en ægte legacy-afskrælning — men kopien blev slæbt med. | Lav (oprydning) | Slettes; `DocumentRenderContext` skal ikke have `stamdata` | åben |

**Note til E4:** dette er samtidig et POSITIVT strukturfund værd at bevare bevidst: det nye lag har
fjernet `unknown`-stamdata-stien helt. Det skal ikke genindføres for de resterende 11 outputs.

### Codex-fund (sol/high, 2026-07-25) — 8 fund

Codex bekræftede uafhængigt E1 (= C5), E2 (= C1), E3 (= del af C2) og E4 (= del af C6), og fandt
fire ting jeg havde overset (C3, C4, C7, C8). Reviewet er accepteret som helhed: **roden er, at
frameworket blev bygget som en "samling" af de 18 eksisterende servicefunktioners fællesmængde
frem for som en livscyklus designet fra bunden.** Derfor arvede det tre legacy-træk (fejlalgebra,
runtime-politik hardkodet i kernen, manglende aktiveringsidentitet), og derfor er "urepræsenterbart"
kun kommentar-dybt. Det er præcis den fejl brugeren bad om at undgå.

| # | Fund og evidens | Alvor | Disposition | Status |
|---|---|---|---|---|
| C1 | **Ingen aktiveringsidentitet.** `project(context)` har ingen parameter-slot, men `rente` (pr. `rowId`), `standalone-rente`, og `regulering`/`krl`/`kl-loenaftaler` (pr. ansættelsesforhold) er alle parameteriserede. Desuden vælges DEFINITIONEN før commit-barrieren, mens settlet selv kan ændre `loenudviklingBasis` → det leverede klik kan fortsætte med forrige revisions output. | **Blokerende** | **Bekræftet, anbefaling følges.** `DocumentDefinition<TRequest, TInput>`; `project(context, request)` genlæser entiteten friskt. Regulering/KRL/KL-knappen får en typed `DocumentAction`-resolver, der vælger `{definition, request}` EFTER settle. | åben |
| C2 | **Kernen hardkoder Mineos runtimepolitik.** `DocumentEvaluationSource` kræver altid `DocumentSettings`; hver definition kræver `brevhovedType`; runneren vælger format/brevhoved fra settings; React-grænsen hardkoder `captureProductionEvaluationSource` og kræver `AppSettingsProvider`, som standalone-træet ikke monterer. Standalone er fast PDF uden brevhoved. | **Blokerende for pass 6** | **Bekræftet, anbefaling følges.** `DocumentExecutionEnvironment` komponeret pr. app (source-port, token-reader, format/session-policy, failure-sink). Brevhoved bliver en discriminated policy (`settings-key` \| `none`) — ikke et falsk `DocumentBrevhovedType`. | åben |
| C3 | **Globalt katalog i kernelaget kollapser chunkgrænser.** `documentCatalog.ts` importerer alle domæner statisk i én global `Map`, mens appen ellers er route-lazy (`App.tsx:19`). Efter cutover trækker første dokumentførende route alle domæners projektioner ind, og standalone ville trække hovedappens domænegraf. EO-definitionen importerer endda et UI-hookmodul (`eoDocumentDefinitions.ts:23` → `useMidlertidigtEetInsertSource` → React). Generatorerne bliver IKKE initiale (`loadRenderer` er fortsat dynamisk) — det er projektionslaget der mister sin opdeling. | Høj | **Bekræftet, anbefaling følges.** Kontrakter + katalogFABRIK bliver i `src/document/definition`; komposition flyttes til app-/route-rødder. To runtime-kataloger (Mineo/standalone), ét rent ID-inventar som completeness-kilde. `buildMidlertidigtEetInsertSource` flyttes til et rent domænemodul. | åben |
| C4 | **B2 er en type-workaround, ikke den påståede invariant.** `DocumentSettings` er dokumenteret som brevhoved-/format-DTO men fik to EO-regeltoggles; EO-row-evalueringen afhænger nu af dokument-LAYOUT-laget og modtager irrelevante format-/brevhovedfelter. Friskhedskoblingen er fortsat håndholdt (`productionInputRuntime.tsx:36`) — en ny source-relevant setting kan tilføjes uden compile-fejl. Typen gør altså kun dagens to læsninger smallere; fejlklassen bliver ikke urepræsenterbar. | Høj | **Bekræftet — min B2-begrundelse var forkert på det afgørende punkt** (jeg skrev "urepræsenterbar"; det er den ikke). Anbefaling følges: split i (a) render-indstillinger, (b) `EoRowPolicy`, (c) ét neutralt source-settings-snapshot bygget af én exhaustiv projector, som driver BÅDE evaluation, fingerprint og dokumentcapture. Codex bekræfter samtidig at `useMemo([evaluation, settings])` er korrekt. | åben |
| C5 | **Prepare→run-grænsen er kun kommentar-beskyttet** (= mit E1, bevist med compile-probe). Desuden: runneren bruger IKKE det optagne `sourceToken` — den stoler kun på den injicerede closure. `DocumentOutput` er også strukturel, så reaktiv gate og klik kan kobles til to forskellige implementeringer. | **Kritisk** | **Bekræftet, anbefaling følges.** Prepare→run gøres modulprivat; kun en app-bundet aktivering eksporteres. Runneren skal sammenligne det optagne token mod miljøets autoritative `readCurrentSourceToken` frem for en closure. Katalogposter må kun kunne skabes af fabrikken. Gate-resultatet bærer sit token. | åben |
| C6 | **Fejl-/rejection-algebraen er legacy-portering.** Runneren returnerer stadig `{success,error}`, som oversættes til endnu en union. Runtime-stale får SAMME generiske besked som en ægte generatorfejl, mens preflight-stale får en korrekt transientbesked. Hverken `downloadDocument` eller hooken har `catch` → en exception i capture/`project` giver en rejected Promise uden synlig eller central fejl. `settle-failed` er reelt en teknisk exception men behandles som tavs brugerafvisning. Uventede generatorfejl rapporteres BÅDE centralt og som lokal sidefejl, i strid med §A5. Metadataformen er legacy: `errorLabel` som PDF-prosa + global `PDF`-regex-substitution + `context: 'documentService.<id>'`. | Høj | **Bekræftet, anbefaling følges.** Én end-to-end union (`downloaded`, `rejected/gate`, `rejected/stale-source`, `failed/dev-unavailable`, `failed/runtime`); samme taksonomi for ALLE stale-faser; ydre lifecycle-boundary der bevarer fase/cause og rapporterer struktureret `{outputId, phase, format}`; `reasons` som non-empty tuple og hooken bevarer HELE listen. `errorLabel` → struktureret metadata. DEV-detektion bevares men formatneutral. | åben |
| C7 | **Friskhedsrecheck mangler efter rendering — stale artifact kan downloades.** `render()` awaiter kanalrenderingen (`documentGeneratorSetup.ts:111`), og runneren går direkte fra `await render(...)` til `triggerDocumentDownload` uden recheck (`runPreparedDocument.ts:61`). Ændres input under renderingen, downloades et forældet dokument. Bryder `critical-action-contract.md:77`. VERIFICERET SELV: gælder også den gamle `runSelectedDocumentFormat` (`documentService.ts:335-336`) → **pre-eksisterende hul, trofast portet med.** Mangler også et check efter DEV-preflight. | **Kritisk (trust)** | **Bekræftet, anbefaling følges.** Én runner-lokal `requireCurrentSource()` med typed stale-return, kaldt ved entry, efter DEV-preflight, efter hvert modul-load OG efter rendererens promise umiddelbart før fil-I/O. Stale artifact kasseres uden fil-I/O. | åben |
| C8 | **`shared`-memoen er generisk usikker.** `<T>(key: object, compute: () => T)` gemmer `unknown` og caster til kalderens frit valgte `T`; samme key kan lovligt genbruges med anden forventet type og returnere første værdi under forkert statisk type. | Middel (lokalt typehul) | **Bekræftet, anbefaling følges.** Bind type til nøgle: `shared(builder: (context) => T): T` med builderen som både key og compute. Codex bekræfter eksplicit at B1 IKKE skal forkastes, og at levetid/kollision mellem kontekster er i orden. | åben |

**Egne fund E1-E4 vs. codex:** E1 = C5 (bekræftet, med ekstra evidens fra min probe). E2 = C1
(codex fandt to flere tilfælde end jeg: regulering pr. ansættelsesforhold, og at definitionsvalget
ligger før barrieren). E3 = dækket af C2's løsning (miljøet ejer session/komposition). E4 = del af
C6 (`resolvePdfStamdata` slettes; `DocumentRenderContext` får ikke `stamdata`).

## Resterende / risici

- **Mellemtilstand:** to parallelle veje i træet (gamle `download*Dokument` i produktion, ny
  definition-kerne ubrugt). Se "Status og genoptagelse". Træet er kompilerbart, men Fase 5 er
  IKKE leveret, og `documentRuntimeFailure.ts` duplikerer bevidst mekanik fra `documentService.ts`
  indtil pass 7.
- Fase 6 (forbudt-symbol-gate, ledger-nedlæggelse) er ikke i scope.
- `useAarsloenDocumentGates`' snapshot-baserede input er den ene reelle strukturændring i
  domænelaget; hvis eligibility-reglerne ikke kan udtrykkes rent på projektionen, standses pass 4
  og beslutningen tages på high (§3).
- **✅ OPRETTET: `WI-009-source-settings-projector.md`** (fra C4) og
  **`WI-010-systemfejl-vs-preflightfejl.md`** (fra C6). Beskrivelserne nedenfor er bevaret som
  begrundelse; det konkrete arbejde ligger i de to WI'er.
- **NY WI (fra C4, erstatter/udvider fingerprint-WI'en nedenfor):** roden er, at der ikke findes ét
  neutralt **source-settings-snapshot**. I dag gentages de source-relevante nøgler i
  `evaluationSettingsFingerprint` (`productionInputRuntime.tsx:36`) UAFHÆNGIGT af hvad evalueringen
  faktisk læser, og dokumentcapture læser en tredje form (`DocumentSettings`). Fase 5's pass 0
  indfører `EoRowPolicy` + render-indstillinger og fjerner dermed layer-krænkelsen, men den
  exhaustive projector, der skal drive evaluation + fingerprint + capture fra ÉN værdi, rører
  input-runtime/settings-arkitekturen uden for Fase 5. Udskilles.
- **NY WI (fra C6):** §A5's skel mellem systemfejl og lokale, forventelige preflight-fejl holdes
  ikke i dag: uventede generatorfejl rapporteres BÅDE til `reportSystemIssue` og som lokal sidefejl.
  Fase 5 kan indføre den korrekte taksonomi i dokumentlaget, men hvis der ikke findes en synlig
  central systemfejls-overflade, ligger den del af roden i den generelle fejlinfrastruktur.
  Afklares i pass 0; etableres uden for Fase 5 hvis den mangler.
- **C7 er et pre-eksisterende hul:** den manglende post-render-recheck findes også i den gamle
  `runSelectedDocumentFormat` (`documentService.ts:335-336`) og gælder derfor alle 18 outputs i
  produktionen i dag. Den lukkes i Fase 5's pass 0 for alle outputs på én gang; der er ikke behov
  for en separat WI, men det bør noteres, at dette er en RETTELSE af eksisterende adfærd, ikke kun
  en migrering.
- **NY WI (skal oprettes):** `evaluationSettingsFingerprint` er hånd-vedligeholdt uden værn mod
  drift fra det, evalueringen faktisk læser (se B2's sidste afsnit). Ingen live fejl i dag. Roden
  ligger uden for Fase 5's scope og hører i Fase 6's håndhævelsesarbejde. Forslag til værn: udled
  fingerprintet af et eksplicit erklæret `EVALUATION_RELEVANT_SETTINGS_KEYS` med
  `satisfies`-completeness, og lad en AST-/type-regel bevise, at ingen evalueringsafhængig
  kodesti læser en nøgle uden for sættet.
