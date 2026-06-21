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

## Klasse A — høj værdi, forsvarligt omfang/risiko

### A1. Manglende view-model-lag under fagsiderne (god-class-tabs) — ✅ IMPLEMENTERET (2026-06-21)

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

### B7. Flere parallelle "felt-tilstand"-kanaler: fieldErrors + invalidDrafts + undo-historik

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

### B9. EO-debug-laget: 33 moduler / ~11.000 linjer (inkl. én fil på 3590 linjer)

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

### B11. To konkurrerende "læg måneder til dato"-semantikker

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

### C16. Statiske rate-data uden ensartet form

**Nuværende tilstand.** "Rate" betyder forskellige ting på tværs af datadomæner: årlige søjler (ASL), år-bånd inden for år (folkepension), dato-bestemte bekendtgørelser (kapitalisering), auto-genererede import-tabeller (offentlig løn). Sygedagpenge blev konsolideret til én tabel i gruppe 6, men de øvrige varierer i model (6.1–6.4).

**Anderledes fra bunden.** Ensartede, typede resolvere pr. variations-dimension (`getRateForAar`, `getRateForDato`, …) så opslag er forudsigeligt. **Forbehold:** dette er på grænsen til en abstraktion uden aktuel smerte — kun værd at gøre hvis et konkret opslags-mønster faktisk gentager sig fejlbehæftet.

**Gevinst 2 · Omfang 3 · Risiko 2** — primært konsistens; lav hastværk givet låst feature-flade.

### C17. Generator-laget: ~17 generatorer uden delt skabelon

**Nuværende tilstand.** EO-familien (9 filer) + øvrige (8) gentager hver opsætnings-sekvensen overskrift → tabel → spacing mod `DocumentWriter` (10.5/10.6). Layout-konstanter var duplikeret (konsolideret til `pdfConfig.ts` i 10.5/10.6).

**Anderledes fra bunden.** Et tyndt builder-/skabelon-lag over `DocumentWriter` for de tilbagevendende sektions-sekvenser, så domæne-generatoren beskriver *hvad* der skrives, ikke *hvordan* spacing/overskrifter sættes.

**Gevinst 2 · Omfang 3 · Risiko 3** — moderat duplikering; rører alle dokument-outputs, så risiko for visuelle PDF/Word-regressioner. Lav prioritet.

---

## Sammenfattende prioritetstabel

| # | Kandidat | Gevinst | Omfang | Risiko | Forelæggelse |
|---|---|:---:|:---:|:---:|:---:|
| A1 ✅ | View-model-lag under fagsiderne | 5 | 5 | 3 | Nej (ren refaktor) |
| A2 ✅ | Delt felt-adapter-kerne (StyledField × TableInput) | 4 | 3 | 2 | Nej |
| A3 ✅ | Delt celle-fejl-sporing i grid | 4 | 2 | 2 | Nej |
| A4 🟡 | Side-byggeklodser (gate/download/dato-grænser) | 4 | 3 | 3 | Delvis |
| B6 ✅ | Samlet persistence-serialiserings-primitiv | 3 | 3 | 4 | Nej |
| B7 | Samlet felt-tilstand (fejl/draft/undo) | 4 | 5 | 5 | Nej |
| B8 ✅ | Tvungne grænser i EO snapshot→presentation | 4 | 4 | 3 | Nej |
| B9 | Slank EO-debug-laget (33 filer/11k linjer) | 3 | 5 | 2 | Nej |
| B10 ✅ | Én ASL-maks-opslags-gateway | 3 | 2 | 3 | Ja |
| B11 | Én kanonisk måned-additions-semantik | 3 | 1 | 3 | Ja |
| B12 ✅ | Systematisér delt UI↔dokument-domænelogik | 3 | 2 | 2 | Nej |
| C13 ✅ | Én STORAGE_KEYS-kilde + schema-afledte defaults | 2 | 2 | 1 | Nej |
| C14 🟡 | Samlet settings-katalog | 2 | 3 | 2 | Nej |
| C15 ✅ | Options-DTO mellem AppSettings og dokument-lag | 2 | 2 | 1 | Nej |
| C16 | Ensartede rate-resolvere | 2 | 3 | 2 | Nej |
| C17 | Builder/skabelon-lag for generatorer | 2 | 3 | 3 | Nej |

**Anbefalet startsekvens:** A3 → A2 → A1 (de tre UI-strukturelle, i stigende omfang), sideløbende med B10/B11 som små, forelæggelses-pligtige korrekthedssnit. B7 og B9 er de største løft og bør først tages, når den øvrige struktur er på plads. (A1, A2, A3, B8, B12, C13 og C15 er implementeret; A4 og C14 blev verificeret 2026-06-21 og er stort set allerede løst/nedjusteret — A4: concern #2/#3 lukket, #1 stilistisk/parkeret; C14: AppThemeMode-dubletten fikset (reviewpunkt 11), samlet katalog ikke berettiget; A5 blev verificeret og forkastet — se appendiks punkt 5.)

---

## Appendiks: påstande jeg undersøgte og forkastede (eller nedjusterede)

For at udfordre — ikke kun understøtte — review-fundene verificerede jeg flere fremtrædende kandidater direkte mod den nuværende kode. Disse holdt *ikke* og indgår derfor ikke i listen:

1. **"Dokument-output bærer naming-gæld: `PdfWriter`-interface med Word + `as never`-casts."** **Forkastet.** Gruppe 10/14.2 har allerede indført `src/document/writer/documentWriter.ts` (`DocumentWriter`, format-agnostisk). `getDoc()` returnerer en *honest union* `jsPDF | DocumentTableBridgeDocument` — ikke `as never` — og kommentaren dokumenterer eksplicit, at den tidligere kanal-lækage (review-fund F2) er lukket: et jsPDF-only kald på et bro-doc er nu en compile-fejl. `as never` findes kun ét sted i ikke-test-kode (`eoDebugSammentaelling.ts`). Kandidaten er reelt allerede løst.

2. **".eo-filen mangler `persistedDataVersion` for migrator-dispatch."** **Forkastet som kandidat.** Planen (2.5) afviste dette bevidst som et hypotetisk extension point, og `AGENTS.md` forbyder netop abstraktioner til hypotetisk fremtidig brug. Det er korrekt udeladt, ikke en mangel.

3. **Dedikeret multi-app-kontrakt / DI-baseret namespace-isolation i stedet for import-rækkefølge.** **Nedjusteret.** Isolationen er testdækket og bevidst konservativ (12.2). At indføre et nyt lag her ville være præcis det hypotetiske udvidelsespunkt, feature-låsen taler imod. Den eksisterende side-effekt-import er skør i teorien men dækket i praksis.

4. **Kontrakt-fragmentering (for mange tværgående kontrakter).** **Nedjusteret.** Landskabet er 17 tværgående + 8 domæne + 1 page-component og er allerede konsolideret i gruppe 1 (pdf+pdf-layout → document-output). Balancen er rimelig; ingen yderligere merge gav nettogevinst (to kandidater afvist med begrundelse i 14.1).

5. **"Fælles TAF-år-sæt for validering + beregning" (tidl. A5).** **Forkastet efter verifikation (2026-06-21, brugergodkendt).** Påstanden var, at `erstatningsopgoerelseValidator.ts` og `tafPerYearOpreguleretDerived.ts` konstruerer *samme* TAF-år-sæt forskelligt og bør deles. På inspektion svarer de to på *forskellige* spørgsmål: beregningen opregulerer hvert TAF-år (0-beløbs-år sprunget over) til `beregningsAar`; validatoren tjekker reguleringssats-dækning for **regulering af offentlige ydelser** over et sammenhængende `baseYear`→`maxTafYear`-interval (anden `kildeAar` OG `maalAar`, andet formål). TAF-opreguleringens dækningstjek har desuden allerede **én kilde**: beregningens eget `manglendeAar`-output fødes direkte ind i snapshot-invarianten (`buildTafPerYearOpreguleretManglendeReguleringssatsInvariant`) — ingen separat validator gen-konstruerer det. Det eneste delte er *motoren* (`opregulerMedAkkumuleretReguleringssats`), som allerede er delt. **Brugervendt:** en ensartning har ingen synlig opside og ville indføre enten et stille forkert tal (hvis offentlige-ydelser-valideringen begyndte at springe mellem-år over) eller en falsk "kan ikke beregnes"-blokering (hvis TAF-opreguleret-PDF'en tvinges over på det forkerte interval). Den nuværende adfærd er den korrekte; ingen kode-ændring.
