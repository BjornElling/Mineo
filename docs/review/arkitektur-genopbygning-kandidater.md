# Arkitektoniske genopbygnings-kandidater — "hvis jeg byggede det fra bunden"

**Dato:** 2026-06-21
**Grundlag:** Systematisk gennemgang af `code-review-plan.md` + samtlige 70 review-docs i `docs/review/`, krydset med egne kode-undersøgelser (verifikation/udfordring af review-fundene mod den *nuværende* kode, ikke kun review-teksten).
**Formål:** Prioriteret liste over de strukturelle/arkitektoniske steder, hvor en anden grundopbygning — med nuværende viden — ville give en rimelig gevinst. Dette er *ikke* en fejl-liste; reviewet (gruppe 1–14) har allerede rettet de konkrete fejl. Dette er bakspejls-arkitektur.

> **Vigtig forudsætning (jf. `AGENTS.md`):** Feature-fladen er låst, og programmet favoriserer *forenkling og konsolidering* over udvidelsespunkter til hypotetiske features. Kandidater er derfor vurderet på, om de fjerner *faktisk* duplikering/grænse-smerte i dag — ikke om de gør koden "mere fleksibel" til noget der aldrig kommer. Alt der ville røre beregningslogik eller synlig UI/UX er markeret som **kræver forelæggelse**.

## Sådan holdes dokumentet ajour (løbende)

Dette dokument er en **levende** arbejdsliste. Hver gang en kandidat færdiggøres (helt eller delvist), opdateres dokumentet i **samme** ændring som koden — ikke bagefter. Brug denne ensartede struktur, så status kan ses på ét blik:

1. **Overskriften** får suffikset `— ✅ IMPLEMENTERET (ÅÅÅÅ-MM-DD)` (eller `— 🟡 DELVIST (ÅÅÅÅ-MM-DD)` hvis kun en del er løst).
2. **Et status-blockquote** indsættes umiddelbart under overskriften — **kort, få linjer**: hvad blev gjort + de centrale nye filer. Ikke en udtømmende redegørelse. Den oprindelige "Nuværende tilstand / Anderledes fra bunden / karakter"-tekst bevares nedenunder som historik (skriv den ikke om).
3. **Prioritetstabellen** nederst: markér kandidatens `#`-celle med ✅ (eller 🟡) så oversigten matcher.
4. Er noget kun delvist løst, så beskriv præcist hvad der mangler, og lad kandidaten stå som åben.

Eksempel på formen findes i A3 og A2 nedenfor.

## Karakterskala

Hvert punkt får tre karakterer (1–5). Bemærk retningen:

| Dimension | 1 | 5 |
|---|---|---|
| **Gevinst** | Marginal | Stor forbedring af korrekthed / vedligehold / klarhed |
| **Omfang** | Lille indgreb | Meget stort, gennemgribende arbejde |
| **Risiko** | Lav (mekanisk, testdækket) | Høj (trust-kritisk, beregning/datatab/svær at teste) |

Den ideelle kandidat har **høj gevinst, lavt omfang, lav risiko**. Listen er ordnet i prioritetsklasser (A = gør først, C = kun hvis tid/lyst), og inden for hver klasse efter faldende værdi-pr-indsats.

---

## Kritisk efter-review (2026-06-24)

Et uafhængigt, skeptisk efter-review: kode-review af samtlige implementerede commits + en arkitektur-vurdering holdt mod den **faktiske kode** (ikke mod doc-teksten, som er skrevet af samme indsats den dokumenterer). Formål jf. opgaven: (1) blev de rigtige ændringer lavet, og er de det bedst mulige slutprodukt — kritisk, også over for store breaking-ændringer; (2) egentligt kode-review med rettelse af fund.

### Kode-review: fund og rettelser

Ingen Kritisk/Høj korrektheds-bugs. De implementerede konsolideringer er adfærdsbevarende, og guards (B10 path-guard, C15 `satisfies`, B7 reconcile-guard) er ægte anti-vacuous. Rettet i denne omgang:

- **A3 (Medium) — rettet.** `useTableCellErrorTracker` returnerede et nyt objekt-literal hver render; de tre tabellers prune/notify-effects (der lister trackeren i deps) kørte derved ved *hver* render i stedet for kun ved rækkeliste-ændring. Ikke en korrektheds-bug (funktionerne var `useCallback`-stabile, notify deduper) men den slog dep-arrays ud. Pakket return i `useMemo`.
- **B8 (Medium) — rettet (test-ærlighed).** `eoCanonicalOutput.parity.test.ts` projicerede de tre B8-berørte totaler FRA `pdfModel` — men efter B8 hentes de selv fra canonical, så sammenligningen blev tautologisk for de felter. Testen guarder fortsat *wiring* (fanger hvis `pdfModel` holder op med at viderebringe canonical) + de strukturelle felter er stadig ægte paritet; kommentaren er rettet til at sige præcist hvad der nu testes.
- **B11 (Lav, faktuel) — rettet.** Kommentar/doc påstod "overløb krydser aldrig en årsgrænse" — faktuelt forkert (December gør netop det). Korrekt proof (kun årstallet udtrækkes; clamp/rollover-forskellen er kun dag-på-måneden og kan aldrig ændre året) skrevet i kode + doc; December-testcase tilføjet i `dateUtils.test.ts`.
- **A2 (Lav) — rettet (guard-hærdning).** Felt-identitets-værnets selv-test tjekkede kun string-literaler. Tilføjet en ægte selv-test der kører den *faktiske* scanner (`findOpeningTags` + `isPersistedCommit` + name-tjek) mod en kendt overtræder + compliant udgave (jf. guard-selftest-princippet).

Bevidst IKKE ændret drive-by (dokumenteret som opfølgning):
- **A1 context/VM-memoisering.** Begge fag-siders kontekst-værdi (og selve VM-hookenes return) er friske objekter hver render. Adfærds-neutralt i dag (ingen forbruger er `React.memo`'et på en måde konteksten slår ud). En forsvarlig rettelse kræver at memoisere hele god-hookens return → risiko for stale closures; hører til A1-opfølgningen, ikke et sikkert drive-by-snit.
- **A4 download-gate-adoption** og **B9-arkitektur** — forelæggelses-pligtige / høj-risiko, se verdicts + shortlist.

**De mindre udestående fund er nu håndteret (2026-06-24, anden omgang):**
- **C17 (residual) — rettet.** Den verbatim-identiske `writeRows` i `aarsloenDocument` + `varigeMenDocument` (og satsers degenererede string-par-variant) er løftet til ét delt `writeLabelValueRows` i `documentGeneratorSetup.ts`; satser mapper sine `[label, value]`-par ved callsite. Ny `documentGeneratorSetup.test.ts` låser preamble-kontrakten (display-mode, metadata, creator-fra-brand) + `writeLabelValueRows` (lukker også C17-metadata-testhullet).
- **B8 dead total-beregning — rettet.** `buildSvieSmerteModel` returnerer nu `SvieSmerteSectionPresentation` (uden den ulæste `totalOre`-clamp; canonical bruger engine-outputtet), og `buildOevrigeKravModel` returnerer en ny `OevrigeKravCanonicalInput` (`Omit<OevrigeKravModel,'totalOre'>`) — den prune'de `totalOre` var en ulæst dublet af `totalFoerForligOre`. `buildEoComputedTotals`/`buildEoCanonicalOutputFromComputed` tager nu canonical-input-typen. Adfærdsbevarende (1179 EO-tests grønne). *Bemærk: `oevrigeKrav.totalFoerForligOre` er IKKE dødt — canonical læser det som pre-forlig-input.*
- **Styled-felt dead grene — rettet.** Hele den døde `mode:'typing'`-flade er fjernet fra `DraftParse`-kontrakten (`fieldEvents.ts`), de 8 Styled-felter, draft-cores (`dateDraftCommit.ts`s `DateDraftParseMode`, `weekDraftCore`s `partialEligible`) og `dateAdapter`. Parse afledes nu altid på commit — i tråd med form-kernereglen "Ingen live preview", som typing-grenene reelt modsagde. (`'partial'`-kind beholdt i union'en; bredere kontraktændring ikke berettiget.)
- **B9 fejlplacering — rettet.** `buildEODebugMidlertidigtEetKonsistensRows` flyttet fra `eoDebugOevrigeKravRows.ts` til `eoDebugIndkomstRows.ts` (eneste forbruger); orphan-imports ryddet. Ingen cyklus.
- **B9 isolations-scanner — hærdet.** `debugLayerIsolation.test.ts` fanger nu også ikke-relative debug-imports (alias `@/…`, absolut `src/…`) via tekstuelt `domain/debug`-segment-match. Anti-vacuous selvtest for alias/absolut-former tilføjet.
- **Test-huller lukket.** B7 undo-genskaber-pruned-draft-roundtrip (`reconcileInvalidDraftsToLiveRows.test.tsx`), A3 tabel-integration for celle-fejl-kanalen (`tableCellErrorIntegration.test.tsx`), C17 `documentGeneratorSetup`-metadata (se ovenfor).

**Tilfældighedsfund — nu rettet (2026-06-24, tredje omgang):** `buildEoCanonicalOutputFromComputed`s `oevrige`-param var ubrugt i kroppen (pre-eksisterende dead param — kun `buildEoComputedTotals` læser faktisk `oevrige.totalFoerForligOre`). Den døde param er fjernet fra builderen + hele forwarding-kæden gennem `buildCanonicalOutput` (`eoSnapshot.ts`); `OevrigeKravCanonicalInput`-typen bevares (stadig brugt af `buildEoComputedTotals`). Rent adfærdsbevarende (param blev aldrig læst); typecheck + 1179 EO-tests + lint grønne.

### Arkitektur-verdicts — er det det bedst mulige slutprodukt?

| # | Verdict | Vurdering (kode-verificeret) |
|---|---|---|
| **A1** | 🟡 ikke-ideelt | `useEoOplysningerViewModel` er en troværdig kompositions-rod (handlere i sub-hooks). Men `useLoenindkomstViewModel` er en **1211-linjers god-hook flyttet bag en kontekst** (Tab-diff: 2067 sletninger / 42 indsættelser = verbatim relokering); begge VM'er **lækker rå store-adgang** (`values/setValues/setFieldValue` returneres direkte, kommenteret "Rå form-state") og **ingen af dem har isolations-tests** — den primære gevinst ved et VM-lag (test af afledning uden React-render) er ikke realiseret. God-class-problemet er delvist *flyttet*, ikke løst. **Status nedjusteret ✅→🟡.** |
| **B9** | ❌ ufuldstændig på det egentlige problem | Fil-splittet (3590→788) + isolations-værn er fint, men den reelle defekt er urørt: produktions-PDF-gaten drives af `status:'error'`-rækker hvis regler er **inlinet i DEV-display-formateringen** (fx periode-komplethed, TAF-dato/overlap beregnet ved row-format-tid; "error" er bare `status:'error'` på display-rækken). Værnets invariant C er et **string-match på VM-filen** der *dokumenterer* sammenfiltringen ("freeze, don't fix") frem for at fjerne den → enhver reformatering brækker testen, og DEV-formaterings-ændringer kan ændre produktions-gating. |
| **A4** | 🟡 overstated claim | Dato-grænser + felt-fejl er ægte centraliseret. Men "download-gate korrekthed allerede ens by construction" er overstated: `RenteberegningTab` og `MenberegningTab` håndruller rå-boolean-gates **uden for** det delte `documentGateTypes`-primitiv — committed-reglen er dér håndhævet af en kommentar, ikke af konstruktion. |
| **B8** | 🟡 smallere end ✅ antyder | Type-seglet er ægte (`Omit`, ingen cast/`any`), men `buildEoComputedTotals` **viderebringer** engine/sektion-totaler (clamp + forlig-skalering), den **re-deriverer dem ikke uafhængigt**. Seglet stopper divergens-ved-tastefejl/parallel-genberegning — ikke divergens-ved-engine-fejl (et forkert engine-tal flyder identisk til begge). Ingen yderligere indsats berettiget (ægte krydsudledning = en anden engine, ikke berettiget mod låst flade). |
| **C17** | ✅ residual rettet | `initStandardDocumentWriter` + creator-brand-fix er korrekt. Den verbatim-identiske `writeRows` (aarsloen + varigemen; satsers string-par-variant) er nu løftet til delt `writeLabelValueRows` i `documentGeneratorSetup.ts` (satser mapper ved callsite). Lukket 2026-06-24. |
| Øvrige | ✅ | A2, A3, A5, B6, B7 (merge-forkastelse + residual-fix), B10, B11, B12, C13, C14, C15, C16 er på bedst-muligt slutprodukt givet den låste feature-flade. Flere forkastelser (A5, B7-merge, C14, C16) er blandt doc'ens bedst-begrundede — genåbn dem ikke. |

### Hvor et større/breaking snit faktisk er værd det (rangordnet)

1. **B9 — træk produktions-blokerings-validering UD af debug-laget.** ✅ **GENNEMFØRT 2026-06-25** — men via **single-source relocation** (ikke en parallel `eoBlockingValidation`): række-evaluerings-motoren er flyttet `domain/debug/` → `src/domain/eoRowEvaluation/` (autoritativ, debug-fri), gaten konsumerer den derfra, DEV-debug-laget er nedstrøms, og isolations-værnet er omskrevet (ENGINE-invariant + inverteret invariant C). Over-block-fixet (arbejdsstatus/helbredsstatus kun-når-relevant) er anvendt. Den parallelle `eoBlockingValidation`-infrastruktur er retireret som død kode. Motor-filer/symboler er omdøbt `eoDebug…`/`collectAllDebugRows` → `eoRow…`/`collectAllEoRows` (autoritativ identitet). Se `b9-blokeringsvalidering-plan.md` §8.
2. **A1 — gør `useLoenindkomstViewModel` til et ægte VM** (medium værdi, lav risiko). Split god-hooken i en ren `deriveLoenindkomstVm(committed, settings): FlatModel` (testbar uden React) + en tynd state/handler-hook; stop med at returnere `setValues`/refs gennem konteksten; tilføj isolations-tests. ~1-2 dage. **Delvist gjort 2026-06-24:** den rene sats-validering (`validateFeriePct`/`validateOverenskomstSats`/`validateAllSatserForAnsaettelsesforhold` + `SatsErrorState`/`OverenskomstSatsField`-dubletten) er løftet ud af god-hooken til `domain/erstatningsopgoerelse/validation/loenindkomstSatsValidation.ts` — React-fri, dækket af nye isolations-tests (`loenindkomstSatsValidation.test.ts`, 14 cases). Det realiserer A1's primære gevinst (afledning testbar uden render) for sats-laget; hooken kalder nu ind via en tynd binding. Udestående: den fulde `deriveLoenindkomstVm: FlatModel`-udskillelse af de øvrige afledte maps + stop med at eksponere rå `eoValues` gennem konteksten.
3. **A4 — migrér de to rå-boolean-download-gates** (`RenteberegningTab` + `MenberegningTab`) til `documentGateTypes`-primitivet, så committed-reglen er konstruktion ikke kommentar. Timer. **UX-nær → kræver forelæggelse.**
4. **C17 — løft tripleret `writeRows` ind i `documentGeneratorSetup.ts`.** ✅ Gjort 2026-06-24 (`writeLabelValueRows`).

Alt øvrigt er på bedst-muligt slutprodukt mod den låste feature-flade; ingen yderligere stor ændring er berettiget.

---

## Klasse A — høj værdi, forsvarligt omfang/risiko

### A1. Manglende view-model-lag under fagsiderne (god-class-tabs) — 🟡 DELVIST (nedjusteret 2026-06-24; oprindeligt ✅ 2026-06-21)

> **Efter-review-note (2026-06-24):** Nedjusteret ✅→🟡. Begge halvdele af mekanikken er på plads, men
> `useLoenindkomstViewModel` er en **1211-linjers god-hook flyttet bag en kontekst** (verbatim
> relokering), begge VM'er **lækker rå store-adgang** (`values/setValues/setFieldValue`) og **ingen har
> isolations-tests** — VM-lagets primære gevinst (afledning testbar uden render) er ikke realiseret.
> God-class-problemet er delvist flyttet, ikke løst. Konkret opfølgning: se "Kritisk efter-review",
> shortlist punkt 2. Den oprindelige ✅-status-tekst bevares nedenfor som historik.
>
> **Fremdrift (2026-06-24):** Første skridt taget på shortlist-punkt 2: den rene sats-validering er
> løftet ud af `useLoenindkomstViewModel` til `domain/.../validation/loenindkomstSatsValidation.ts`
> (React-fri) og dækket af nye isolations-tests. A1's primære gevinst (afledning testbar uden render)
> er dermed realiseret for sats-laget. De øvrige afledte maps + den rå `eoValues`-kontekst-eksponering
> udestår fortsat.

> **Status:** Begge halvdele af A1 er på plads for alle tre EO-fagsider: (1) **view-model-lag** — ét
> `useXxxViewModel`-hook pr. fagside der ejer al afledt visningstilstand, lokal UI-state og handlers og
> returnerer én flad model; (2) **sektion-dekomponering** — den store inline-JSX er splittet i
> komponenter der forbruger view-modellen via en smal **kontekst** (`useXxxVm()`), ikke via props
> (ingen prop-boring).
>
> | Fagside | Før | Efter | View-model-hook | Sektion-dekomponering |
> |---|---:|---:|---|---|
> | `EOOplysningerTab.tsx` | 2059 | **69** | `useEoOplysningerViewModel.ts` | 9 sektion-komponenter (`eoOplysninger/sections/`) + `eoOplysningerContext.ts` |
> | `LoenindkomstTab.tsx` | 2232 | **207** | `useLoenindkomstViewModel.ts` | `AnsaettelsesforholdCard.tsx` (per-række-kort) + `loenindkomstContext.ts` |
> | `EOberegningTab.tsx` | 1410 | **568** | `useEoBeregningViewModel.ts` | Allerede tynd; render-helpers (renderDebugRows m.fl.) fungerer som sektion-byggere — ikke yderligere splittet (lav værdi) |
>
> Adfærdsbevarende; fuld suite grøn (5485 tests, inkl. ny smoke-test `EOOplysningerTab.sektioner.test.tsx`).
> Per-række-værdier (`af`, `index`) gives bevidst fortsat som props (varierer pr. iteration), ikke via
> kontekst. Fire path-baserede quality-guards blev opdateret, da den auditerede kode flyttede med til de
> nye filer (`roundingNormGuard`, `formContractIsolation`, `eoFieldVisibilitySingleSource`,
> `eetDomainIsolation` — de to sidste scanner nu sektion-mappen dynamisk).

**Nuværende tilstand (verificeret).** `LoenindkomstTab.tsx` er stadig **2232** linjer og `EOOplysningerTab.tsx` **2059** linjer efter gruppe 8's dekomponering; `EOberegningTab.tsx` er **1410**. Dekomponeringen i gruppe 8 standsede bevidst, fordi kort-/sektion-ekstraktion ville kræve at bore 20–30+ props/handlers ned i børnene (8.3 + 14.2-parkering). De udtrukne `loenindkomst/`- og `eoOplysninger/`-mapper indeholder kun et par hooks og én sektion — selve siderne bærer stadig hele state- og handler-vægten.

**Rod-årsag.** Der findes intet *view-model-lag* mellem den persisterede sektion og JSX. Hver side læser persisteret data, afleder visningstilstand, og holder alle commit-/redigerings-handlers inline i samme komponent. Det er derfor "prop-boring" og ikke "ren komponent-deling" der er forhindringen.

**Anderledes fra bunden.** Ét view-model-hook pr. fagside (fx `useLoenindkomstViewModel(...)`) — eller pr. *ansættelsesforhold* — der ejer afledt visningstilstand + handlers og returnerer en flad, serialiserbar model. Sektion-komponenter forbruger view-modellen via en smal kontekst/hook i stedet for at modtage 25 props. Det gør sektionerne testbare uden React-context-opsætning og fjerner prop-boringen, der blokerede dekomponeringen.

**Gevinst 5 · Omfang 5 · Risiko 3** — adfærdsbevarende strukturel omlægning; risiko begrænset af eksisterende testdækning, men siderne er store nok til at gøre arbejdet stort. Berører ikke beregning eller synlig UI (forelæggelse ikke nødvendig hvis ren refaktor).

### A2. Ingen delt "persisteret felt"-adapter-kerne (StyledField × TableInput) — ✅ IMPLEMENTERET (2026-06-21)

> **Status:** Løst. Heltal/årstal/uge fik delte commit-parse-kerner (`integerDraftCore.ts`, `yearDraftCore.ts`,
> `weekDraftCore.ts`) som både form-felt og tabel-adapter nu bygger på (beløb/dato/procent/tekst delte allerede).
> Felt-identitet samlet i ét værn (`fieldIdentityGuard.test.ts`) der nu også dækker grid-tabelceller. Fejltekster
> gjort ensartede mellem form og tabel (forelagt + godkendt). `TableDropdown` bruger nu den kanoniske `gridCellKey`-util
> frem for et inline-nøgleformat. Behavior-bevarende; fuld suite grøn.

**Nuværende tilstand (verificeret).** To parallelle familier løser *samme* concern: 8 styled form-felter (`StyledAmountField`, `StyledDateField`, `StyledPercentField`, `StyledIntegerField`, `StyledFractionField`, `StyledWeekField`, `StyledYearField`, `StyledTextField`) og 8 tabel-inputs (`TableAmountInput`, `TableDateInput`, `TablePercentInput`, …). Hver familie har sit eget parse/format/validate/coalesce + visuel-fejl-invariant. Gruppe 7 indførte `useStyledFieldAdapter` som delt commit-lim for form-siden, men tabel-siden kører sin egen adapter-stak — og review fandt gentagne gange *samme* fejlklasse uafhængigt i hver familie (asymmetrisk coalescing 7.2; manglende felt-identitet `data-mineo-undo-field-path`/`name`/`fieldPath` 7.1).

**Anderledes fra bunden.** Én adapter-kerne pr. datatype (beløb, dato, procent, …) som *både* form- og tabel-wrapperen bygger oven på — parse/format/validate defineret ét sted, og felt-identitet håndhævet af én værn-test der dækker *alle* persisterende widgets (form + tabel + immediate-commit). Wrapperne reduceres til præsentations-/event-skaller.

**Gevinst 4 · Omfang 3 · Risiko 2** — fjerner en bekræftet, tilbagevendende fejlklasse og halverer adapter-vedligeholdet. Lav risiko fordi adfærden er veldækket af eksisterende commit-kontrakt-tests.

### A3. Tre parallelle celle-fejl-sporings-implementeringer i grid-tabellerne — ✅ IMPLEMENTERET (2026-06-21)

> **Status:** Løst. Ny delt `useTableCellErrorTracker`-hook (`gridCore/`) ejer celle-fejl-sporing for de tre
> tabeller (transition-guard + read-time-filtrering mod gyldige rækker + prune), så en fjernet rækkes fejl ikke
> kan blokere Gem. Behavior-bevarende; tester grønne.


**Nuværende tilstand (verificeret).** De tre redigerbare tabeller sporer celle-fejl på tre forskellige måder: `StandardLoenTable` bruger `Set<string>` + `getValidationResult`; `OffentligeYdelserTable` bruger `Record<string, true>` + lazy-filter på `validRowIds`; `LoenudviklingManuelTable` bruger `Record<string, true>` + en `onInputErrorChange(hasError)`-callback. 14.2 ensartede *gate-adfærden* (fjernede den committed-gate i `OffentligeYdelserTable` der kunne tabe en reel fejl) men efterlod bevidst de tre implementeringer.

**Anderledes fra bunden.** Én delt `useTableCellErrorTracker`-hook (på linje med den allerede delte `useGridRowPersistenceCore`) der ejer "spor celle-fejl, filtrér mod synlige rækker, rapportér summary". 14.2 fravalgte den fælles hook fordi de tre validerings-*builders* er forskellige — men selve fejl-sporingen (det der faktisk divergerede og tabte data) er identisk og bør deles.

**Gevinst 4 · Omfang 2 · Risiko 2** — lukker en bekræftet stille-datatab-risiko (fejl der ikke blokerer Gem), lille indgreb.

### A4. Side-laget genimplementerer fejl-gating, download-gate og dato-grænser — 🟡 STORT SET LØST / NEDJUSTERET (2026-06-21)

> **Status (verificeret 2026-06-21).** To af de tre concerns var allerede løst af tidligere arbejde,
> og den tredje viste sig at være stilistisk frem for reel duplikering:
>
> | Concern | Faktisk tilstand i dag | Reel duplikering tilbage |
> |---|---|---|
> | **Dato-grænser** | Alle faner går gennem `src/config/dateRanges.ts` (`dateRanges_renteberegning`, `_varigemen`, `_forsoergertab`, `_erstatningsopgoerelse` …) | **Nej** — fuldt konsolideret (8.5 m.fl.) |
> | **Felt-fejl-rapportering** | Alle faner bruger `useFormFieldErrorReporter`/`useFormFieldErrors` + den ene `resolveActiveFieldError()` + `saveBlockedFocus.ts` som eneste jump-to-error-orkestrering | **Nej** — fuldt centraliseret |
> | **Download-gate** | Alle faner driver gaten fra **committed** state (korrekthed allerede ens). 4 forskellige *strukturer* (inline `useMemo`, snapshot-modul, `useAarsloenDocumentGates`-hook, EO view-model) — men forskellene følger fanens egen datamodel | **Stilistisk** — fælles del (committed) allerede håndhævet; en delt `useDocumentDownloadGate()` ville kun samle den sidste boolean-sammensætning (lav værdi, UX-nær → forelæggelse) |
>
> Konklusion: A4 forblev *ikke* et rent lavrisiko-snit som A2/A3. Concern #2 og #3 er lukkede; #1 er
> nedjusteret til stilistisk og parkeret (lav værdi + forelæggelsespligtig). Ingen kode-ændring foretaget.

**Nuværende tilstand.** Hver fagside (Stamdata, Årsløn, Erstatningsopgørelse, Erhvervsevnetab, Forsørgertab, Varige Mén, Renteberegning) finder sin egen vej gennem: persisterede feltfejls-rapportering, PDF/Word-download-gate, og dato-grænse-opslag. Review fandt samme klasse-fejl flere steder: download-gate drevet fra *draft* i stedet for committed (`RenteberegningTab`, rettet i 14.2 §2.4); dato-grænser bygget uden for `dateRanges.ts` (`MenberegningTab`, rettet i 8.5); forligs-regler der måtte ekstraheres for at håndhæves ens fra to sider (`forligAnsvarsgradRules`, 8.2).

**Anderledes fra bunden.** Tre små, kanoniske side-byggeklodser: `useDocumentDownloadGate(committed)` (altid committed-baseret, §2.4 by construction), en deklarativ dato-grænse-registrering (felt → bounds) der altid går gennem `dateRanges.ts`, og et ensartet felt-fejl-rapporterings-mønster. Hver enkelt rettelse ovenfor var et symptom på, at disse mønstre ikke var byggeklodser.

**Gevinst 4 · Omfang 3 · Risiko 3** — fjerner en hel klasse af gentagne fejl. Download-gate-/grænse-logik er tæt på UX-adfærd, så enkelte dele **kræver forelæggelse**.

> **A5 (Fælles TAF-år-sæt for validering + beregning) blev verificeret og forkastet 2026-06-21
> — se appendiks punkt 5.** På inspektion svarer "validering" og "beregning" på to forskellige
> spørgsmål (forskellig `kildeAar` OG `maalAar`), og TAF-opreguleringens dækningstjek har allerede
> én kilde (beregningens eget output → snapshot-invarianten). Det eneste delte er motoren, som
> allerede er delt. En ensartning ville give brugeren enten et forkert tal eller en falsk
> blokering. Punktet er flyttet til appendikset og fjernet fra prioritetstabellen.

---

## Klasse B — reel gevinst, men større omfang eller højere risiko

### B6. Persistence: tre næsten-identiske validér→serialisér→re-validér-stier — ✅ IMPLEMENTERET (2026-06-21)

> **Status:** Løst. Den trust-kritiske kæde (`nullToUndefinedDeep` → schema-validér → serialiser →
> re-validér (reload-ækvivalens) → pak i `{ version, timestamp, data }`) er nu samlet i ét primitiv,
> `buildPersistedSection(pageKey, data, timestamp)` i [`src/utils/buildPersistedSection.ts`](../../src/utils/buildPersistedSection.ts).
> Alle tre stier kalder det: `persistData` + `replaceAllPersistedData` (`FormPersistenceContext.tsx`) og
> `buildPersistenceSectionWrites` (`persistenceSnapshotStorage.ts`). Primitivet returnerer et
> diskrimineret resultat (`ok` + `validatedData`/`persistedData`/`serialized`, eller `stage` +
> `error`), så et trin aldrig kan afvige mellem stierne. **Kontrol-flowet forbliver bevidst
> forskelligt** — `persistData` giver notice + returnerer `false` (må aldrig crashe under normal
> redigering), de to snapshot-stier kaster transaktionelt — men fejl-ordlyden ejes nu af hver caller via
> `stage`, ikke af duplikeret transform-kode. `timestamp` gives af caller, så loop-stierne stadig
> stempler alle sektioner med ét fælles `Date.now()`. Behavior-bevarende; fuld suite grøn (5485 tests),
> ny `buildPersistedSection.test.ts` låser primitivets kontrakt.

**Nuværende tilstand (verificeret).** `persistData()`, `replaceAllPersistedData()` og `buildPersistenceSectionWrites()` bygger hver `{ version, timestamp, data }`-strukturen og kører validér→serialisér med subtilt forskellig fejl-UX (set i `FormPersistenceContext.shared.ts` — flere steder gentager `version: PERSISTED_DATA_VERSION` + `timestamp` + serialisering). På trust-kritiske gem-stier er det netop her, drift er farligst.

**Anderledes fra bunden.** Ét serialiserings-/validerings-primitiv (`buildPersistedSection(pageKey, data)`) som alle tre stier kalder, med én fejl-UX-politik. Reducerer test-overflade og fjerner drift-risiko mellem stierne.

**Gevinst 3 · Omfang 3 · Risiko 4** — trust-kritisk save/load; gevinsten er reel men risikoen kræver grundig round-trip-test før/efter.

### B7. Flere parallelle "felt-tilstand"-kanaler: fieldErrors + invalidDrafts + undo-historik — 🟡 VERIFICERET: STRUKTUR ALLEREDE SAMLET; ÉN RESIDUAL-DATATABSFEJL RETTET (2026-06-22)

> **Status (verificeret + delvist rettet 2026-06-22).** Den store "byg én sammenhængende model"-præmis
> var **allerede opfyldt** af den senere `invalidDrafts`-Option-C-omlægning (efter review 2.1): `sections`,
> `fieldErrors` OG `invalidDrafts` er ÉT store (`formPersistenceStore`) — ikke tre stores; `HistoryFrame`
> snapshotter alle tre (+ revisioner) atomisk, og `restoreHistoryFrame`/`hydrate`/
> `replaceSectionsAndClearFieldErrors`/`clearAll` gendanner/rydder dem i ÉT `set()`. De to konkrete fejl
> B7 nævnte som motivation var **allerede rettet i review 2.1 selv**: (1) hydrate rydder nu fieldErrors
> atomisk; (2) resolved-fejl-cachen invaliderer på BÅDE reference-identitet OG `fieldErrorRevisions`
> (en glemt `clearResolvedFieldErrorsCache()` kan ikke servere stale fejl). Selve den "anderledes fra
> bunden"-arkitektur er altså den gældende kontrakt (`undo-redo-contract.md` §1/§3/§4/§6, dateret efter
> omlægningen). En fuld "merge undoRedoStore ind i formPersistenceStore"-omskrivning ville være
> abstraktion-for-sin-egen-skyld mod en låst feature-flade, med listens højeste regressionsrisiko og
> ingen brugervendt opside — **forkastet**.
>
> **Den ene genuine residual** (et adversarielt sweep fandt den): en celle-`invalidDraft` blev
> **forældreløs** ved række-/ansættelsesforhold-sletning. `invalidDrafts` var den ENESTE kanal uden
> read-time-reconcile mod levende rækker (modsat `fieldErrors`, som `useTableCellErrorTracker` allerede
> filtrerer). Sletter man en række/AF der bærer en draft, forsvinder kun rækken fra sektionen — draften
> blev liggende og blokerede Gem som et **spøgelses-mål uden synligt felt** (overlevede F5). Rettet ved at
> give `invalidDrafts` det manglende modstykke til trackerens filtrering:
> - Ny delt hook **`useReconcileInvalidDraftsToLiveRows(liveRowIds)`** (`hooks/tableInput/`) — kaldt af
>   ALLE 10 celle-bærende, sletbare tabeller (3 grid + EET ASL + 6 løse). Rydder en slettet rækkes draft
>   mod de RENDEREDE rækker (ikke committede — en tom-men-synlig rækkes draft blokerer fortsat; uændret).
> - **Scope-niveau reconcile** i `useLoenindkomstViewModel` (et slettet AFs tabeller er afmonteret, så
>   per-tabel-reconcilen kan ikke nå dem) — rydder drafts hvis af-id-rowScope ikke længere lever.
> - Nyt atomisk primitiv **`reconcileInvalidDrafts(pageKey, isOrphan)`** (context) +
>   `pruneInvalidDraftsForSectionFields` (store): storage+store-atomisk, fail-closed rollback, **fanger
>   bevidst ingen undo-frame** (housekeeping — sletningens egen frame bærer draften). fieldPath-scope-
>   helpers + completeness-guard (`invalidDraftRowReconcileGuard.test.ts`) der fejler hvis en ny
>   draft-bærende, sletbar tabel mangler reconcile. Adfærdsbevarende på alt andet; fuld suite grøn.
>
> Konklusion: B7 forblev — som A4/C14/A5 — *ikke* det store strukturelle løft det så ud til; strukturen
> var samlet. Punktet efterlades åbent/nedjusteret: den fulde store-merge er forkastet, men datatabs-
> residualen er lukket.

**Nuværende tilstand.** Et felts tilstand er fordelt over tre uafhængige kanaler: runtime `fieldErrors` (i `formPersistenceStore`), persisteret `invalidDrafts` (egen slice → sessionStorage → undo), og undo/redo-historikken (`undoRedoStore`). Review fandt gentagne "skal-ryddes-sammen"-fejl (hydration ryddede ikke fieldErrors atomisk 2.1; resolved-fejl-cache med implicit invalidering 2.1). invalidDrafts har sit eget recovery-system uden formel integration med undo-stakken.

**Anderledes fra bunden.** Én sammenhængende model for "et felts committed-værdi, draft-tilstand og fejl-tilstand", hvor undo-frames fanger alle tre atomisk og en sektion-replace altid rydder konsistent. I dag er det tre stores med eksplicitte synk-regler, der hver gang skal huskes.

**Gevinst 4 · Omfang 5 · Risiko 5** — kernen i runtime-data-integriteten; stor gevinst i klarhed, men den højeste regressions-risiko på listen. Bør kun gøres med meget stærk test-baseline først.

### B8. EO-snapshot/canonical/presentation/debug — flere repræsentationer uden tvungne grænser — ✅ IMPLEMENTERET (2026-06-21)

> **Status:** Løst. Grænsen mellem section-præsentation og canonical-totaler er nu *type-tvungen*.
> `buildErstatningsopgoerelsePdfModelFromComputed` modtager section-modellerne via nye `Omit`-
> præsentationstyper (`SvieSmerteSectionPresentation`, `TabtArbejdsfortjenesteSectionPresentation`,
> `OevrigeKravSectionPresentation` i `eoTypes.ts`) der har fjernet de autoritative beløbs-totaler.
> PDF-modellen *kan derfor kun* få totaler fra `EoComputedTotals` (canonical) — en re-derivation/
> forwarding af et section-afledt total er nu en **compile-fejl** frem for noget der skal verificeres
> manuelt (jf. eo-snapshot-contract.md §1). De totaler der tidligere ikke blev forwardet
> (`svieSmerte.totalOre`, `oevrigeKrav.totalFoerForligOre`, `tabtArbejdsfortjenesteFoerForligOre`)
> kommer nu også fra canonical. Behavior-bevarende: de tre var enten allerede identiske ad uafhængig
> vej (svie/øvrige = samme clamp) eller blev aldrig vist (taf-FoerForlig på modellen læses ikke —
> view-modellen bruger canonical direkte). Builderne, canonical, debug-laget og rendereren er urørte;
> den eksisterende `eoCanonicalOutput.parity.test.ts` står som runtime-backstop. Fuld suite grøn (5485
> tests). (Bevidst afgrænset: grænsen forsegles ved *præsentations-assembly* — det punkt hvor en
> divergens ville lække til output; section-builderne beregner stadig rå totaler, men de forbruges kun
> af den autoritative `buildEoComputedTotals`, ikke af en parallel præsentations-sti.)

**Nuværende tilstand (verificeret).** Fire lag bygges fra samme `snapshot.data`: `eoCanonicalOutput.ts` (autoritative totaler), `eoPresentationModel.ts` (PDF/Word-visning), debug-laget (33 filer, se B9), og validatoren. Review måtte *manuelt* trace hver presentation-builder for at bevise, at den ikke re-deriverer et total (4.13). Intet arkitektonisk værn forhindrer, at en presentation-builder reaggregerer et beløb og dermed afviger fra canonical uden at validator eller debug fanger det.

**Anderledes fra bunden.** Gør "presentation forwarder canonical-totaler, re-deriverer aldrig" *tvingende* — fx ved at presentation-modellen kun modtager de færdige totaler fra canonical (ikke de rå inputs), så en re-derivation bliver en type-/compile-umulighed frem for noget der skal verificeres manuelt.

**Gevinst 4 · Omfang 4 · Risiko 3** — lukker en usynlig fejlklasse (PDF viser forkert tal uden at noget fejler). Berører ikke tallene hvis korrekt gjort, men rører den centrale EO-datavej.

### B9. EO-debug-laget: 33 moduler / ~11.000 linjer (inkl. én fil på 3590 linjer) — 🟡 DELVIST (2026-06-23)

> **Status (verificeret + delvist løst 2026-06-23).** Punktets PRÆMIS holdt ikke: laget er **ikke
> "DEV-only / lav risiko"**. `collectAllDebugRows` (→ `executeAllEODebugBuilders`, dvs. de samme
> `buildEODebug…Rows`-buildere som EODebug-siden) producerer `error`-rækker, der i
> `useEoBeregningViewModel` bliver til `hasBlockingDebugErrors` og **blokerer produktions-PDF/Word-
> download** for alle fire dokumenter ([`useEoBeregningViewModel.ts`](../../src/components/pages/erstatningsopgoerelse/eoBeregning/useEoBeregningViewModel.ts)).
> Debug er desuden ikke strengt nedstrøms: den kanoniske `eoSnapshot` indlejrer bevidst debug-output
> (`debugSnapshot`-feltet + control-mismatch-beskeder). Laget er altså trust-kritisk produktions-
> validering, ikke kun inspektion — **Risiko 2 var forkert** (reelt høj på den load-bearing del).
>
> **Gjort (den sikre, klarhedsgivende del):**
> - Den 3590-linjers `eoDebugErstatningsopgoerelseModel.ts` (projektets største kildefil) er splittet
>   **adfærdsbevarende** (verbatim move, 0 logik-ændringer) i et delt hjælpe-modul (`eoDebugEoShared.ts`)
>   + 7 kohæsive per-sektion-builder-filer (`eoDebugEoOverviewRows`, `eoDebugSvieSmerteRows`,
>   `eoDebugTaftRows`, `eoDebugTafBeregningsgrundlagRows`, `eoDebugIndkomstRows`,
>   `eoDebugSygeferiegodtgoerelseRows`, `eoDebugOevrigeKravRows`); den oprindelige fil er nu en
>   8-linjers barrel der re-eksporterer alt (importører urørte). Største fil nu **788** linjer.
> - Nyt arkitektur-værn [`debugLayerIsolation.test.ts`](../../src/__tests__/quality/debugLayerIsolation.test.ts)
>   pinner de tre invarianter der gør rollefordelingen forsvarlig: **(A)** domæne→debug-koblingen er
>   indesluttet til de to navngivne snapshot-bro-filer (`eoSnapshot.ts`, `eoSnapshotToDebugView.ts`) —
>   ingen engine/validator/helper må importere debug; **(B)** de autoritative totaler
>   (`eoCanonicalOutput`) er debug-frie (debug fødes aldrig tilbage i det rigtige tal, jf. B8/4.14);
>   **(C)** builderne er produktions-load-bearing (gater PDF) — så laget ikke fejlagtigt nedlægges som
>   dødt DEV-only-kode. Med selvtest (anti-vacuous) + anti-rot på allowlisten.
>
> **Bevidst IKKE gjort (forkastet/parkeret):** den fulde "data-dreven, tyndere debug-lag"-omskrivning.
> Mod en låst feature-flade ville det være abstraktion-for-sin-egen-skyld, og — nu hvor præmissen er
> rettet — en høj-risiko-ændring af en produktions-validerings-/PDF-gate-sti uden brugervendt opside.
> Den reelle arkitektoniske oprydning (adskil produktions-valideringen fra DEV-inspektionen, så de ikke
> deler "debug"-lag) er noteret men **kræver forelæggelse** + stærk test-baseline. Fuld debug-suite grøn
> (457 tests), typecheck + lint (max-warnings 0) grønne.

**Nuværende tilstand (verificeret).** `src/domain/debug/` er 33 filer / ~11.069 linjer; `eoDebugErstatningsopgoerelseModel.ts` alene er **3590 linjer** — den største kildefil i hele projektet. Laget er en DEV-only projektion af snapshot'et til divergens-inspektion. Det er instrueret som "ikke en parallel beregning", men det er ikke arkitektonisk tvunget (4.14).

**Anderledes fra bunden.** Et markant tyndere, mere deklarativt debug-lag: en datadreven beskrivelse af "hvilke snapshot-felter vises som hvilke tabeller", i stedet for 33 håndskrevne view-model-moduler. Alternativt: anerkend at det er et separat, accepteret undersystem og isolér det skarpt fra domænet, så dets vægt ikke forveksles med produktions-domænekode.

**Gevinst 3 · Omfang 5 · Risiko 2** — stor vedligeholds-/klarhedsgevinst (det fylder uforholdsmæssigt meget), men lav risiko da det er DEV-only. Stort arbejde.

### B10. To opregulerings-motorer + tre ASL-maksimum-opslag uden fælles indgang — ✅ IMPLEMENTERET (2026-06-21)

> **Status (brugergodkendt forelæggelse).** De to motorer er bevidst bevaret (forskellige
> matematiske problemer). Selve *opslaget* af ASL-årslønsmaksimum-tabellen er nu konsolideret i
> én gateway, [`resolveAslAarsloensmaksimumForAar`](../../src/domain/satser/aslAarsloensmaksimum.ts)
> (`domain/satser/aslAarsloensmaksimum.ts`). Den erstatter alle ~10 rå `aarsloenAslMax[år]`-opslag
> (grænse-validator, opreguleringsmotor metode 1, forsørgertab, EET-kapitalisering/løbende/EAL,
> regulerings-præsentation, lønudvikling, EO-debug, regulerings-dokument). Efter brugerens valg
> ("ensret beskeden overalt") ejer gateway'en desuden ÉN brugervendt "mangler"-ordlyd
> (`ASL-maks-sats mangler for år X (satser findes kun for A–B)`) — de tidligere **fem** afvigende
> formuleringer er væk. En path-baseret guard
> ([`aslAarsloensmaksimumSingleSource.test.ts`](../../src/__tests__/quality/aslAarsloensmaksimumSingleSource.test.ts))
> fejler hvis et rå subscript-opslag genintroduceres. Adfærdsbevarende (opslags-værnet er identisk:
> positiv-finit-heltal); fuld suite grøn (5495 tests). Bevidst urørt: at *sende hele map'et* videre
> som injiceret indeks (forsørgertab/EET-snapshot) — det er ikke et enkelt-år-opslag.

**Nuværende tilstand (verificeret).** `opreguleringsmotorer.ts` eksporterer to motorer (`opregulerMedAslAarsloensmaksimum`, `opregulerMedAkkumuleretReguleringssats`); kalderen vælger manuelt den rigtige. ASL-årslønsmaksimum slås desuden op tre steder med to formål blandet sammen: som regulering (motoren) og som grænse-validering (`aarsloenValidators.ts` direkte i tabellen) (4.0/4.2/4.10).

**Anderledes fra bunden.** Behold de to motorer (de løser reelt forskellige matematiske problemer — *ikke* et hypotetisk strategimønster der skal abstraheres væk), men indfør én kanonisk opslags-gateway for selve ASL-maks-tabellen (`resolveAslAarsloensmaksimumForAar`), som både grænse-validering og motoren bruger. ASL-maks er en *datakilde*, ikke en beregning, og bør have ét opslagspunkt.

**Gevinst 3 · Omfang 2 · Risiko 3** — fjerner drift mellem tre opslag af samme tabel. **Kræver forelæggelse** (rører validerings-/beregnings-input).

### B11. To konkurrerende "læg måneder til dato"-semantikker — ✅ IMPLEMENTERET (2026-06-21)

> **Status (brugergodkendt forelæggelse).** Domæneafgørelsen er **clamp** (én måned efter 31-01 →
> udgangen af februar), bekræftet af brugeren. Produktionsstien var allerede ensrettet til den
> kanoniske `addMonths` i commit `e62d433d` (2026-06-14) — `calculateInterestDate` (`case 'maaneder'`)
> bruger clamp, ingen rå `setUTCMonth`-rollover tilbage. Det sidste rå `setUTCMonth` i ikke-test-kode
> (DEV-debug-hjælperen `getYearAfterAddingOneMonth`, efter B9-splittet i `eoDebugSvieSmerteRows.ts`, der
> kun udtrækker et *årstal*) er nu også routet gennem `addMonths` — bevisligt adfærdsbevarende, **fordi
> kun årstallet udtrækkes**: clamp og rollover er udelukkende forskellige i dag-på-måneden, og den
> forskel kan aldrig ændre året. (December + 1 måned ruller ganske vist til næste år — men identisk
> under begge semantikker.) Der er dermed ÉN "læg måneder til dato"-semantik i hele kodebasen.
> *Rettet 2026-06-24: tidligere formulering ("overløb krydser aldrig en årsgrænse") var faktuelt
> forkert (December gør netop det) — proof-formuleringen er nu korrekt; in-code-kommentar +
> December-testcase tilføjet.*

**Nuværende tilstand.** `rentekravValidation.ts:calculateInterestDate` bruger rå `setUTCMonth`-rollover (31-01 + 1 md → 03-03), mens `dateUtils.ts:addMonths` clamper til månedsslut (→ 28-02). To sandheder for samme operation i samme kodebase (4.7, ⏸ afventede domæneafgørelse).

**Anderledes fra bunden.** Én kanonisk dato-aritmetik. Hvis rente-domænet *bevidst* skal have rollover, navngives det eksplicit (`addMonthsWithRollover`) og dokumenteres ved callsite — ikke en lokalt håndskrevet variant der ligner et tilfælde.

**Gevinst 3 · Omfang 1 · Risiko 3** — lille indgreb, men **kræver forelæggelse** (rentedatoer kan flytte sig omkring månedsskifte).

### B12. Delt UI↔dokument-domænelogik er ikke systematiseret — ✅ IMPLEMENTERET (2026-06-21)

> **Status:** Løst. Den resterende genuine duplikering ryddet: visnings-betingelsen for
> 2003→2024-grundydelse-niveauskift samlet i `visGrundydelseNiveauSkift()` (delt af
> `EetLoebendeYdelserTab` + `loebendeYdelserDocument`), og de identiske EET-formatere samlet i
> domænets `eetFormatUtils.ts` (`formatPct` flyttet dertil; `eetLoebendeYdelserCalculation` og
> PDF-lagets `eetDocumentUtils` re-eksporterer nu frem for at gendefinere; `formatJaNejEet` →
> domænets `formatJaNej`). Mønstret gjort til en **stående regel** i
> `docs/architecture/document-output-architecture.md` (afsnit 15). Behavior-bevarende; fuld suite
> grøn. (Bevidst urørt: `formatMaaneder` har to *divergerende* implementeringer (med/uden
> `roundByMethod`) — en sammensmeltning ville ændre output og kræver forelæggelse; og
> `ingenLoebendeYdelse` defineres bevidst forskelligt i fane (perioder.length) vs. generator
> (iAltBeregnetEet) — ikke rørt.)

**Nuværende tilstand.** Den gennemgående lære fra 14.2: logik der bruges af *både* en UI-fane og en dokument-generator blev gentagne gange duplikeret, indtil reviewet samlede den i en domæne-helper — `resolveLoebendeAfgoerelseRestVisning()` (show-rest-flag var dubleret UI↔PDF med inkonsistent skæringsdato, 14.2 §8) og `loentrinFinderCore.ts` + delt overlay (99,8 % dubleret komponent + 100 % dubleret calc, 14.2 §10). Disse blev rettet reaktivt.

**Anderledes fra bunden.** En eksplicit regel/konvention: enhver afledning der konsumeres af både UI og dokument-output ejes af domænelaget, og hverken fanen eller generatoren må holde sin egen kopi. De to rettelser var symptomer på, at "domæne ejer delt visningssemantik" ikke var et etableret lag.

**Gevinst 3 · Omfang 2 · Risiko 2** — meste af den akutte duplikering er allerede ryddet; gevinsten er at gøre mønstret til en stående regel + et sidste sweep efter resterende tilfælde.

---

## Klasse C — oprydning/konsistens, lavere prioritet

### C13. Schema-key-lister duplikeret tre steder + objekt-defaults som dobbelt-sandhed — ✅ IMPLEMENTERET (2026-06-21)

> **Status:** Løst. `eoFileDataInnerSchema` udledes nu af `persistenceSchemas` (samme nøglesæt +
> per-sektion-schema, `.optional()`-mappet) frem for en tredje håndskreven nøgleliste — `StorageKey`
> (manifest) → `persistenceSchemas` (`satisfies`) → `.eo`-schema er nu én afledningskæde. Objekt-
> defaults afledt af schemaet: `eoBilagSelection`-litteralen i initialValues fjernet (schema-
> defaulten materialiseres), og `createDefaultAngivetLoenLoenudvikling` bygger nu på
> `eoAngivetLoenLoenudviklingSchema.parse({})` + kun de 3 bevidste new-data-overstyringer
> (loenPaaHelligdage/overenskomstFilter settings-afledte, offentligLoenType='Månedsløn').
> Regressions-lås tilføjet (eksakt forventet form). Behavior-bevarende; fuld suite grøn.

**Nuværende tilstand.** `persistenceRegistry`, `storageManifest` og `eoFileSchema` holder hver sin `StorageKey[]`-liste (compiletime-asserts fanger drift, men tre steder skal vedligeholdes, 3.5). Objekt-defaults blev dobbelt-kodet (`eoBilagSelection`-litteral duplikerede 8 felt-`.default()`'er; lønudviklings-default-helper, 3.3).

**Anderledes fra bunden.** Én `STORAGE_KEYS`-konstant som registry/manifest/eoFile alle afledes af; objekt-defaults udledt af `schema.parse({})` i stedet for håndskrevne litteraler.

**Gevinst 2 · Omfang 2 · Risiko 1** — ergonomi + fjerner stille-default-drift; drift-værn findes allerede, så lav hastværk.

### C14. Config spredt over fem moduler uden fælles katalog — 🟡 KERNE LØST / KATALOG IKKE BERETTIGET (2026-06-21)

> **Status (verificeret 2026-06-21).** Den eneste *konkrete* drift-risiko punktet navngav —
> `AppThemeMode` defineret to steder — er allerede væk (commit `551889b5`, "gennemført reviewpunkt 11"):
> `themeModeEnum` i [`appSettingsSchema.ts:88`](../../src/settings/appSettingsSchema.ts) er nu eneste
> kilde, og [`appTheme.ts`](../../src/config/appTheme.ts) re-eksporterer typen via `z.infer` (ingen parallel
> håndskreven union). Ingen andre Zod↔TS-union-dubletter findes: alle 23 domæne-enums i
> `enumSchemas.ts` følger `z.infer`-mønstret, og `appSettingsSchema` udleder sine option-lister af
> enums' `.options`. De fem moduler (`appSettings`, `regulatoryRates`, `indskudteLoentillaeg`,
> `pdfConfig`, `tableTheme`) ejer hvert et **distinkt** concern med forskellige mutationsmønstre
> (bruger-mutérbar localStorage vs. kode-drevne regel-/præsentations-konstanter). Et samlet
> "settings-katalog" oven på det ville være præcis det abstraktionslag-for-sin-egen-skyld som punktet
> selv advarer imod — **ikke berettiget**. Kerne løst; ingen yderligere kode-ændring.

**Nuværende tilstand.** Indstillinger/konfiguration lever i `appSettings` (device-lokal), `regulatoryRates`/`indskudteLoentillaeg` (regler), `pdfConfig`/`tableTheme` (præsentation) m.fl. — ingen ét sted at placere en ny tværgående setting; én type (`AppThemeMode`) var defineret to steder (11.1–11.3).

**Anderledes fra bunden.** Ét "settings-katalog" hvor alle Zod-skemaer + afledte typer bor, så type-drift (Zod ↔ TS-union) er umulig. Vær varsom med *ikke* at bygge en generel config-service til hypotetisk brug — kun samle det der faktisk findes.

**Gevinst 2 · Omfang 3 · Risiko 2** — konsistensgevinst; må ikke blive et abstraktionslag for sin egen skyld.

### C15. Dokument-laget type-binder til AppSettings — ✅ IMPLEMENTERET (2026-06-21)

> **Status:** Løst. Dokument-laget kender ikke længere UI-indstillingstypen: ny smal
> `DocumentSettings`-DTO (brevhoved-flag + downloadformat) i `documentBrevhoved.ts`, og
> `documentService` tager den i stedet for hele `AppSettings`. Afhængigheds-pilen vendt:
> dokument-laget ejer nu det kanoniske `DOCUMENT_BREVHOVED_TYPES`-sæt, og `appSettingsSchema`
> verificerer sit brevhoved-nøglesæt mod det via `satisfies` (+ runtime selv-test). UI-callsites
> uændrede (AppSettings opfylder DTO'en strukturelt). Behavior-bevarende; fuld suite grøn.
> (DTO'en hedder `DocumentSettings` frem for `DocumentBrevhovedOptions`, da den også bærer
> `documentDownloadFormat` — dokument-lagets fulde behov fra settings.)

**Nuværende tilstand.** `documentBrevhoved.ts` binder direkte til `AppSettings['brevhovedIndstillinger']`, og `documentService.ts` tager hele `AppSettings`-typen (erkendt teknisk gæld, 11.3). Dokument-laget blev ellers udskilt rent i gruppe 10.

**Anderledes fra bunden.** En smal options-DTO (`DocumentBrevhovedOptions`) som UI-laget mapper `AppSettings` ind i, så dokument-generatorerne ikke kender UI-indstillingstypen.

**Gevinst 2 · Omfang 2 · Risiko 1** — renere laggrænse; ingen funktionel effekt.

### C16. Statiske rate-data uden ensartet form — 🟡 VERIFICERET / IKKE BERETTIGET (2026-06-23)

> **Status (verificeret 2026-06-23).** Hvert rate-domæne svarer på et *forskelligt* opslags-
> spørgsmål (forskellig variations-dimension), og de sammensatte opslag har allerede hver ÉN kanonisk
> resolver: ASL-årslønsmaksimum (`resolveAslAarsloensmaksimumForAar`, jf. B10), offentlig løn
> (`getOffentligLoenForDato` / `getOffentligLoenForPeriode` — dato × løntrin × løngruppe), folkepension
> (`getFolkepensionAlder` — opslagsdato × fødselsdato) og kapitalisering
> (`resolveKapitaliseringsbekendtgoerelseId` — skadedato × kapitaliseringsdato). Det eneste domæne uden
> en dedikeret periode-resolver er sygedagpenge — men det har præcis ÉT forbrugende kaldested
> (`splitSygedagpengeRateSegments`), der itererer for at bygge *klippede* segmenter, ikke et gentaget
> enkelt-dato-opslag. En `getRatesForPeriode`-helper dér ville splitte en sammenhængende løkke og
> udtrække et ét-linjes overlap-prædikat brugt ét sted — der er ingen gentaget, fejlbehæftet
> opslags-kode at fjerne. En generisk, typet resolver pr. dimension (`getRateForAar`/`getRateForDato`)
> på tværs af alle domæner ville være abstraktion-for-sin-egen-skyld mod en låst feature-flade — præcis
> det punktets eget forbehold (og `AGENTS.md`) advarer imod. **Ikke berettiget; ingen kode-ændring.**

**Nuværende tilstand.** "Rate" betyder forskellige ting på tværs af datadomæner: årlige søjler (ASL), år-bånd inden for år (folkepension), dato-bestemte bekendtgørelser (kapitalisering), auto-genererede import-tabeller (offentlig løn). Sygedagpenge blev konsolideret til én tabel i gruppe 6, men de øvrige varierer i model (6.1–6.4).

**Anderledes fra bunden.** Ensartede, typede resolvere pr. variations-dimension (`getRateForAar`, `getRateForDato`, …) så opslag er forudsigeligt. **Forbehold:** dette er på grænsen til en abstraktion uden aktuel smerte — kun værd at gøre hvis et konkret opslags-mønster faktisk gentager sig fejlbehæftet.

**Gevinst 2 · Omfang 3 · Risiko 2** — primært konsistens; lav hastværk givet låst feature-flade.

### C17. Generator-laget: ~17 generatorer uden delt skabelon — 🟡 DELVIST (2026-06-23)

> **Status (verificeret + delvist løst 2026-06-23).** Den ensartede del er konsolideret; den risikable
> del er forkastet.
>
> **Gjort (den sikre, drift-fjernende del):** Alle 18 generatorer indledte ens — `createStandardPdfWriter`
> → `setDisplayMode('fullheight')` → `setProperties({title, subject, author, creator})` — med de samme
> metadata-konstanter kopieret ind hver gang. Det er samlet i ét primitiv,
> `initStandardDocumentWriter` ([`src/document/generators/documentGeneratorSetup.ts`](../../src/document/generators/documentGeneratorSetup.ts)),
> og stamdata-brevhovedet (Pattern A, 14 generatorer) i `buildStamdataBrevhovedData`. Samtidig lukkede
> det en **latent drift**: `creator` var hardkodet `'mineo.dk'` i 16 generatorer, men slået op via
> `getDocumentCreatorBrand()` i de 2 rente-dokumenter — et brand-override (standalone MinProcesrente via
> `setDocumentBrand`) ville have slået igennem på rente-PDF'erne men efterladt et forældet brand på alle
> øvrige. Nu går feltet ensartet gennem brandet (byte-identisk i standard-appen). Adfærdsbevarende;
> typecheck + lint grønne, docx (52) + pdf/dokument (376) + EO-projektion/guards (105) tests grønne.
>
> **Bevidst IKKE gjort (forkastet):** det fulde builder-/skabelon-lag over selve sektions-renderingen.
> Den tilbageværende "gentagelse" er hver generator der beskriver *forskelligt* indhold (forskellige
> tabeller, kolonner, betinget logik) — ikke mekanisk ens boilerplate. EO-sektions-modulerne
> (`opgoerelseSection.ts` m.fl.) indkoder domænelogik, ikke layout; et skabelon-lag ville tilføje
> indirektion uden at fjerne reel duplikering og risikere visuelle PDF/Word-regressioner på tværs af
> alle outputs.
>
> **Residual rettet (2026-06-24, efter-review):** Den tidligere note her ("`writeRows` kunne ikke deles:
> divergerende signaturer") var kun halvt rigtig — `aarsloen` og `varigemen` havde en **verbatim
> identisk** objekt-række-`writeRows`, mens kun `satser` afveg (string-par). Den fælles løkke er nu løftet
> til `writeLabelValueRows` i `documentGeneratorSetup.ts`; `satser` mapper sine `[label, value]`-par til
> objekt-formen ved callsite. Adfærdsbevarende; ny `documentGeneratorSetup.test.ts` dækker preamblen +
> det nye primitiv.

**Nuværende tilstand.** EO-familien (9 filer) + øvrige (8) gentager hver opsætnings-sekvensen overskrift → tabel → spacing mod `DocumentWriter` (10.5/10.6). Layout-konstanter var duplikeret (konsolideret til `pdfConfig.ts` i 10.5/10.6).

**Anderledes fra bunden.** Et tyndt builder-/skabelon-lag over `DocumentWriter` for de tilbagevendende sektions-sekvenser, så domæne-generatoren beskriver *hvad* der skrives, ikke *hvordan* spacing/overskrifter sættes.

**Gevinst 2 · Omfang 3 · Risiko 3** — moderat duplikering; rører alle dokument-outputs, så risiko for visuelle PDF/Word-regressioner. Lav prioritet.

---

## Sammenfattende prioritetstabel

| # | Kandidat | Gevinst | Omfang | Risiko | Forelæggelse |
|---|---|:---:|:---:|:---:|:---:|
| A1 🟡 | View-model-lag under fagsiderne — mekanik på plads, men `useLoenindkomstViewModel` er en god-hook flyttet bag kontekst (lækker rå store-adgang); nedjusteret 2026-06-24. **Delvis fremdrift 2026-06-24:** ren sats-validering udskilt til `loenindkomstSatsValidation.ts` (React-fri + isolations-tests); resten af `deriveLoenindkomstVm` + rå `eoValues`-kontekst udestår | 5 | 5 | 3 | Nej (ren refaktor) |
| A2 ✅ | Delt felt-adapter-kerne (StyledField × TableInput) | 4 | 3 | 2 | Nej |
| A3 ✅ | Delt celle-fejl-sporing i grid | 4 | 2 | 2 | Nej |
| A4 🟡 | Side-byggeklodser (gate/download/dato-grænser) — NB: 2 sider (`RenteberegningTab`/`MenberegningTab`) håndruller download-gates uden for `documentGateTypes`-primitivet; committed-regel er kommentar ikke konstruktion (se Kritisk efter-review) | 4 | 3 | 3 | Delvis |
| B6 ✅ | Samlet persistence-serialiserings-primitiv | 3 | 3 | 4 | Nej |
| B7 🟡 | Samlet felt-tilstand (fejl/draft/undo) — struktur allerede samlet; orphan-datatab rettet | 4 | 5 | 5 | Nej |
| B8 ✅ | Tvungne grænser i EO snapshot→presentation (NB: seglet er forwarding af canonical-totaler, ikke uafhængig krydsudledning — stopper divergens-ved-tastefejl, ikke -ved-engine-fejl; se Kritisk efter-review) | 4 | 4 | 3 | Nej |
| B9 ✅ | Træk produktions-blokerings-validering ud af debug-laget. **Gennemført 2026-06-25 via single-source relocation:** række-evaluerings-motoren (20 filer) flyttet `domain/debug/` → `domain/eoRowEvaluation/` (autoritativ, debug-fri); gaten konsumerer den derfra; DEV-debug-laget er nu rent nedstrøms; isolations-værnet omskrevet (ENGINE-invariant + inverteret invariant C); over-block-fix anvendt; parallel `eoBlockingValidation` retireret som død kode; motor omdøbt `eoDebug…` → `eoRow…`. Se plan §8 | 3 | 5 | høj | ✅ |
| B10 ✅ | Én ASL-maks-opslags-gateway | 3 | 2 | 3 | Ja |
| B11 ✅ | Én kanonisk måned-additions-semantik | 3 | 1 | 3 | Ja |
| B12 ✅ | Systematisér delt UI↔dokument-domænelogik | 3 | 2 | 2 | Nej |
| C13 ✅ | Én STORAGE_KEYS-kilde + schema-afledte defaults | 2 | 2 | 1 | Nej |
| C14 🟡 | Samlet settings-katalog | 2 | 3 | 2 | Nej |
| C15 ✅ | Options-DTO mellem AppSettings og dokument-lag | 2 | 2 | 1 | Nej |
| C16 🟡 | Ensartede rate-resolvere — verificeret: hvert domæne har egen variations-dimension; sammensatte opslag har allerede én resolver; generisk resolver ikke berettiget | 2 | 3 | 2 | Nej |
| C17 🟡 | Builder/skabelon-lag for generatorer — ensartet init-preamble konsolideret (initStandardDocumentWriter) + creator-drift lukket; tripleret `writeRows`-residual løftet til `writeLabelValueRows` (2026-06-24); fuldt skabelon-lag forkastet (regressionsrisiko) | 2 | 3 | 3 | Nej |

**Anbefalet startsekvens:** A3 → A2 → A1 (de tre UI-strukturelle, i stigende omfang), sideløbende med B10/B11 som små, forelæggelses-pligtige korrekthedssnit. (A1, A2, A3, B6, B8, B10, B11, B12, C13 og C15 er implementeret; B9 blev verificeret 2026-06-23 — "DEV-only/lav risiko"-præmissen blev modbevist (laget er trust-kritisk produktions-validering der gater PDF-download), den sikre klarhedsgivende del er gjort (projektets største kildefil splittet adfærdsbevarende 3590→788 linjer + isolations-værn der pinner produktions/DEV-grænsen), og den fulde data-drevne omskrivning er forkastet som høj-risiko/forelæggelses-pligtig mod en låst feature-flade; B7 blev verificeret 2026-06-22 — strukturen var allerede samlet af invalidDrafts-omlægningen (fuld merge forkastet), og den ene residual (forældreløse celle-drafts ved række-/AF-sletning der blokerede Gem) er rettet via read-time-reconcile af invalidDrafts-kanalen; A4 og C14 blev verificeret 2026-06-21 og er stort set allerede løst/nedjusteret — A4: concern #2/#3 lukket, #1 stilistisk/parkeret; C14: AppThemeMode-dubletten fikset (reviewpunkt 11), samlet katalog ikke berettiget; A5 blev verificeret og forkastet — se appendiks punkt 5. C16 og C17 blev verificeret 2026-06-23 — C16: hvert rate-domæne har sin egen variations-dimension, og de sammensatte opslag har allerede hver én kanonisk resolver, så en generisk resolver er ikke berettiget (ingen kode-ændring); C17: den ensartede init-preamble er konsolideret i `initStandardDocumentWriter` på tværs af alle 18 generatorer og en latent `creator`-brand-drift lukket, mens det fulde skabelon-lag over sektions-renderingen er forkastet som regressionsrisiko mod en låst feature-flade.)

**Status:** Alle kandidater i prioritetstabellen er behandlet (implementeret, delvist løst, eller verificeret-og-nedjusteret/forkastet). Det kritiske efter-review (2026-06-24) rettede de fundne kode-fund. **C17-residualen + alle de mindre udestående fund er lukket i en efterfølgende omgang (2026-06-24):** tripleret `writeRows`, B8 dead total-beregning, Styled-felt-typing-grene, B9-builder-fejlplacering, B9-scanner-hærdning og test-hullerne B7/A3/C17-metadata (se "Kritisk efter-review" → "De mindre udestående fund er nu håndteret"). Tilbage som åbne, ikke-haste opfølgninger er de tre større/forelæggelses-pligtige: **B9** (træk produktions-validering ud af debug-laget — størst værdi, forelæggelses-pligtig), **A1** (gør `useLoenindkomstViewModel` til et ægte VM) og **A4** (migrér 2 download-gates til primitivet — forelæggelses-pligtig). Se "Kritisk efter-review (2026-06-24)" for detaljer + rangordnet shortlist.

---

## Appendiks: påstande jeg undersøgte og forkastede (eller nedjusterede)

For at udfordre — ikke kun understøtte — review-fundene verificerede jeg flere fremtrædende kandidater direkte mod den nuværende kode. Disse holdt *ikke* og indgår derfor ikke i listen:

1. **"Dokument-output bærer naming-gæld: `PdfWriter`-interface med Word + `as never`-casts."** **Forkastet.** Gruppe 10/14.2 har allerede indført `src/document/writer/documentWriter.ts` (`DocumentWriter`, format-agnostisk). `getDoc()` returnerer en *honest union* `jsPDF | DocumentTableBridgeDocument` — ikke `as never` — og kommentaren dokumenterer eksplicit, at den tidligere kanal-lækage (review-fund F2) er lukket: et jsPDF-only kald på et bro-doc er nu en compile-fejl. `as never` findes kun ét sted i ikke-test-kode (`eoDebugSammentaelling.ts`). Kandidaten er reelt allerede løst.

2. **".eo-filen mangler `persistedDataVersion` for migrator-dispatch."** **Forkastet som kandidat.** Planen (2.5) afviste dette bevidst som et hypotetisk extension point, og `AGENTS.md` forbyder netop abstraktioner til hypotetisk fremtidig brug. Det er korrekt udeladt, ikke en mangel.

3. **Dedikeret multi-app-kontrakt / DI-baseret namespace-isolation i stedet for import-rækkefølge.** **Nedjusteret.** Isolationen er testdækket og bevidst konservativ (12.2). At indføre et nyt lag her ville være præcis det hypotetiske udvidelsespunkt, feature-låsen taler imod. Den eksisterende side-effekt-import er skør i teorien men dækket i praksis.

4. **Kontrakt-fragmentering (for mange tværgående kontrakter).** **Nedjusteret.** Landskabet er 17 tværgående + 8 domæne + 1 page-component og er allerede konsolideret i gruppe 1 (pdf+pdf-layout → document-output). Balancen er rimelig; ingen yderligere merge gav nettogevinst (to kandidater afvist med begrundelse i 14.1).

5. **"Fælles TAF-år-sæt for validering + beregning" (tidl. A5).** **Forkastet efter verifikation (2026-06-21, brugergodkendt).** Påstanden var, at `erstatningsopgoerelseValidator.ts` og `tafPerYearOpreguleretDerived.ts` konstruerer *samme* TAF-år-sæt forskelligt og bør deles. På inspektion svarer de to på *forskellige* spørgsmål: beregningen opregulerer hvert TAF-år (0-beløbs-år sprunget over) til `beregningsAar`; validatoren tjekker reguleringssats-dækning for **regulering af offentlige ydelser** over et sammenhængende `baseYear`→`maxTafYear`-interval (anden `kildeAar` OG `maalAar`, andet formål). TAF-opreguleringens dækningstjek har desuden allerede **én kilde**: beregningens eget `manglendeAar`-output fødes direkte ind i snapshot-invarianten (`buildTafPerYearOpreguleretManglendeReguleringssatsInvariant`) — ingen separat validator gen-konstruerer det. Det eneste delte er *motoren* (`opregulerMedAkkumuleretReguleringssats`), som allerede er delt. **Brugervendt:** en ensartning har ingen synlig opside og ville indføre enten et stille forkert tal (hvis offentlige-ydelser-valideringen begyndte at springe mellem-år over) eller en falsk "kan ikke beregnes"-blokering (hvis TAF-opreguleret-PDF'en tvinges over på det forkerte interval). Den nuværende adfærd er den korrekte; ingen kode-ændring.
