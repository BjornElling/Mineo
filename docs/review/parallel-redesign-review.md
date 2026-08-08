# Parallelt redesign-review — samlet status

**Kodeverificeret pr. 2026-08-09** på `greenfield`-branchen.

Dette dokument er den samlede, aktuelle vurdering af alle oprindelige redesign-punkter
(`#1`–`#52`). Det er en status- og beslutningsoversigt, ikke en historisk arbejdsdagbog.
Historiske mellemtrin, gamle statusmarkeringer og slettede arkitekturlag er kun medtaget,
hvor de er nødvendige for at forstå den aktuelle status.

## Konklusion først

Den store draft/commit-omlægning ændrede præmissen for en væsentlig del af den oprindelige
plan. Den aktuelle løsning har ikke blot lappet det gamle system: `src/inputCore/` er en ny,
typed inputkerne med ét settled aggregate, én rejected-input-repræsentation, én `InputReader`,
én command-grænse og eksplicitte runtime-/replacement-porte. Det betyder, at flere gamle
kandidater ikke længere skal vurderes på, om deres oprindelige hooks, contextlag eller slices
findes. De er enten absorberet af en bedre løsning eller gjort irrelevante.

Status er:

- **42 punkter er afsluttet**, heraf flere efter en korrigeret eller stærkere skæring end den
  oprindelige tekst foreslog.
- **7 punkter er reelt delvist gennemført**: `#1`, `#7`, `#18`, `#22`, `#29`, `#32` og `#44`.
- **2 punkter er overflødiggjort** og skal ikke genåbnes: `#2` og `#34`.
- **1 punkt er bevidst afvist** efter brugerbeslutning: `#46`.

Der er altså ikke grundlag for at skrive, at alle oprindelige punkter er gennemført. Der er
heller ikke grundlag for at genoptage hele den gamle plan. De syv delvist gennemførte punkter
er de eneste reelle rester fra denne kandidatliste; deres konkrete omfang skal vurderes på ny,
før der implementeres noget.

## Statusnøgle

| Markering | Betydning |
|---|---|
| ✅ Afsluttet | Det underliggende mål er opfyldt, og den aktuelle løsning er arkitektonisk forsvarlig. |
| ✅ Omformet | Målet er opfyldt, men den oprindelige diagnose eller løsning var forkert, for snæver eller forældet. |
| ◐ Delvist gennemført | En reel del er løst, men der findes fortsat et konkret, verificeret restproblem. |
| ↪ Overflødiggjort | Den oprindelige kandidat giver ikke længere mening efter en stærkere arkitekturomlægning. |
| ⛔ Bevidst ikke gennemført | Punktet er aktivt fravalgt efter brugerbeslutning. |

## 1. Kort statusoversigt

| ID | Oprindeligt punkt | Aktuel status | Kort forklaring / rest |
|:---:|---|---|---|
| 1 | `AnsaettelsesforholdCard` → sektioner | ◐ Delvist | Delt lønudviklingsflade og VM-afledninger er på plads; kortet er stadig stort og ikke opdelt i sektioner. |
| 2 | `documentService` → download-register | ↪ Overflødiggjort | Dokumentdefinitioner, katalog og én livscyklus har erstattet service-modellen. |
| 3 | IndexedDB-/file-handle-primitiv | ✅ Omformet | Fælles IndexedDB-primitiv er gennemført; de to datamodeller holdes korrekt adskilt. |
| 4 | Residual helper-oprydning | ✅ Omformet | Den påståede paste-duplikering fandtes ikke; død paste-kode blev fjernet. |
| 5 | Ensartet viewmodel-mønster | ✅ Afsluttet | Alle persisted fagsider har ét kanonisk VM-indgangspunkt; prop/provider er bevidst fleksibelt. |
| 6 | `Aarsloen` → VM + sektioner | ✅ Afsluttet | VM, provider og sektionskomposition er etableret. |
| 7 | Headless dropdown | ◐ Delvist | `mergeSx` er fælles, men dropdown-interaktion er stadig samlet i en stor komponent. |
| 8 | `PageTabs` + `SideTab` | ✅ Afsluttet | Fælles komponenter bruges på de relevante sider. |
| 9 | Download-knap-konsolidering | ✅ Afsluttet | Én fælles visuel kerne og én settings-bevidst dokumentwrapper. |
| 10 | `Forsoergertab` → VM + sektioner | ✅ Afsluttet | VM/provider og sektioner er etableret. |
| 11 | `defineDocument`-factory | ✅ Afsluttet | Generator-lifecycle og formatvalg er samlet uden global kanaltilstand. |
| 12 | Fælles felt-/range-fejl-seam | ✅ Omformet | Den gamle feltfamilie er slettet; den nye inputkerne ejer samme mål stærkere. |
| 13 | `schemaFingerprint` → `persistedDataVersion` | ✅ Omformet | Navnet og versionsadskillelsen er korrekt videreført i den nye runtime og `.eo`-model. |
| 14 | Duplikeret filnavnssanitering | ✅ Omformet | Det reelle problem var tre ASCII-slugs, som nu bruger én kanonisk slug-primitiv. |
| 15 | `TableSpec` | ✅ Afsluttet | Kanalneutral tabelmodel med separate PDF-/Word-renderere og golden-net. |
| 16 | Regulering/SFGG-opdeling | ✅ Afsluttet | Ansvarene er splittet uden tal- eller outputdrift. |
| 17 | Kanonisk dag-set-algebra | ✅ Afsluttet | EO-politik ligger samlet; neutral SH-dag-primitiv ligger neutralt. |
| 18 | EET-differencekrav + forligseditor | ◐ Delvist | De store lokale bokse er flyttet; forligsfladen er bevidst ikke slået sammen. |
| 19 | Keyed-slice store-factory | ↪ Overflødiggjort | Den gamle slice-model findes ikke længere; inputkernen har en enklere aggregate-model. |
| 20 | Struktureret EO-inspektionsmetadata | ✅ Afsluttet | Tabelstruktur og employment-id bæres nu som data, ikke rekonstrueret fra tekst. |
| 21 | Deklarativt indstillingsregister | ✅ Omformet | Registerforslaget var forkert; enum-etiketterne blev centraliseret, mens heterogene settings er eksplicitte. |
| 22 | `IndtaegtFoerSkadenSection` → undersektioner | ◐ Delvist | Delt lønudviklingsflade er etableret; den resterende sektion er stadig stor. |
| 23 | Regulering → kanonisk forløb | ✅ Afsluttet | Kildeserier bæres fra formregisteret til læse-/kontrollag uden rådata-fallbacks. |
| 24 | Deklarativt dokument-IR | ✅ Afsluttet | Alle dokumenter bygges som én kanalneutral `DocumentModel`. |
| 25 | Samlet felt-state-kerne | ✅ Omformet | En surface-agnostisk kerne i `inputCore` erstatter planens mega-hook. |
| 26 | `Container` → keyboard-nav-lag | ✅ Afsluttet | Navigation og geometri er udtrukket til headless moduler. |
| 27 | Samlet række-persistering | ✅ Omformet | Række-/celleadfærd er indlejret i inputkernen og den fælles collection-flade. |
| 28 | Persistence-læse-sti | ✅ Omformet | De gamle context-/selector-pass-throughs er erstattet af reader/projection-grænser. |
| 29 | `dateRanges` + read-time `TODAY` | ◐ Delvist | Read-time-dato er løst; den foreslåede fulde fil-/dataopdeling er ikke gennemført. |
| 30 | Validerings-ejerskab | ✅ Omformet | Lagene er gjort komplementære og konvergerer i én issue-/invariant-valuta. |
| 31 | PDF/Word-paritet | ✅ Afsluttet | Fælles model og semantiske blokke bærer pariteten strukturelt. |
| 32 | EO-sektioner → rene `Block[]`-funktioner | ◐ Delvist | IR'et er på plads, men de største EO-sektioner er stadig writer-/context-orienterede. |
| 33 | Atomisk mutationsprimitiv | ↪ Overflødiggjort | Den tidligere persistence-context er slettet; replacement-/command-porten er den nye autoritet. |
| 34 | EO-schema-variant-dedup | ↪ Overflødiggjort | Den påståede parallelle variant-form findes ikke. |
| 35 | Carry-forward-serieopslag | ✅ Omformet | Fælles typed lookup er gennemført for den relevante reguleringsserie-model; andre datamodeller er ikke tvangsforenet. |
| 36 | EET på `MoneyOre`/canonical spine | ✅ Afsluttet | EET-output er branded, schema-valideret og golden-verificeret. |
| 37 | Branded `MoneyOre` | ✅ Afsluttet | Lukket pengealgebra er etableret som fælles domæneprimitiv. |
| 38 | Eksplicit dokumentgenereringssession | ✅ Afsluttet | Format, rendering og filartefakt går gennem en eksplicit session. |
| 39 | Persistence før React-render | ✅ Afsluttet | Runtime hydreres én gang før render og distribueres som binding. |
| 40 | Critical-action-/commit-barriere | ✅ Omformet | Typed coordinatoren skelner korrekt mellem settle-handlinger og replacement-handlinger. |
| 41 | Typed save/load + tilstandsmaskine | ✅ Omformet | Codec, preflight og atomisk replacement er samlet omkring inputkernen. |
| 42 | Versionsbåret `.eo`-schema-evolution | ✅ Omformet | Container-, data- og migreringsversion er adskilt og load er tolerant/fail-closed. |
| 43 | Page-manifest + persistent app-shell | ✅ Afsluttet | Ruteinventar og layout-flow er samlet og værnet. |
| 44 | Feature-slicede EO-viewmodels | ◐ Delvist | Side-/tab-VM’er findes, men flere featureinterne VM-/view-grænser er stadig brede. |
| 45 | Deklarativ `GridSpec` | ✅ Omformet | Fuld `GridSpec` blev afvist som forceret abstraktion; sorterings-/rækkeordenslaget er samlet. |
| 46 | Variant-ejede styles/build-assets | ⛔ Bevidst ikke gennemført | Styles er isoleret; build-asset-oprydningen er bevidst fravalgt. |
| 47 | Ét verificeret release-artefakt | ✅ Afsluttet | Én release-gate verificerer og uploader de artefakter, deploy bruger. |
| 48 | AST-baseret arkitekturharness | ✅ Afsluttet | Manifest, AST-regler, fixtures og anti-rot-værn er etableret. |
| 49 | Neutral måneds-/intervalalgebra | ✅ Afsluttet | Månedsbrøken ligger i neutralt domænehjem; EO-politik er ikke fejlagtigt flyttet med. |
| 50 | TAF-graf → scene-model + renderer | ✅ Afsluttet | Ren scene-model, Canvas-renderer og golden-net er etableret. |
| 51 | Typed beregningsdatakatalog | ✅ Afsluttet | Typed envelopes, provenance, completeness og fingerprints er samlet. |
| 52 | Normative kontrakter vs. implementeringskort | ✅ Omformet | Kortene blev ikke flyttet; de blev gjort levende, stemplede og testforbundne. |

### Anbefalinger for de syv reelle rester

| ID | Konkret anbefaling | Beslutning i praksis |
|:---:|---|---|
| #1 | Gennemfør en afgrænset ændring | Opdel kortets reelle præsentationsansvar i få domænebaserede underkomponenter uden at ændre brugerrejse eller beregning. |
| #7 | Bevar nuværende tilstand | Indfør ikke en generisk headless dropdown-kerne uden et konkret fælles korrekthedsproblem. |
| #18 | Bevar nuværende tilstand | Slå ikke EO- og EET-forligsfladerne sammen; de forskellige domænegrænser er tilsigtede. |
| #22 | Gennemfør en afgrænset ændring | Opdel sektionen efter de faktiske input- og lønudviklingsansvar, men behold én VM- og bindingsflade. |
| #29 | Bevar nuværende tilstand | Behold den centrale dato-range-katalogfil; den gennemførte read-time-rettelse og dens tests er den relevante løsning. |
| #32 | Bevar nuværende tilstand | Behold `DocumentComposer`/`DocumentModel`-grænsen; gennemfør ikke en mekanisk omlægning til bogstavelige `Block[]`-returværdier. |
| #44 | Bevar nuværende tilstand | Opret ikke et ekstra generisk feature-VM-lag; page- og tab-VM’erne følger den bindende sidekontrakt. |

Det betyder, at kun #1 og #22 anbefales som konkrete næste strukturændringer. For #7, #18,
#29, #32 og #44 er den anbefalede handling netop at bevare den verificerede løsning og lukke
den historiske rest som et bevidst fravalg. De fem punkter skal ikke genåbnes alene for at få
statusoversigten til at se fuldt gennemført ud.

## 2. Punktvis vurdering

### #1 — `AnsaettelsesforholdCard` → sektioner

**Status: ◐ Delvist gennemført.**

Den oprindelige præmis var, at der allerede fandtes en `loenindkomst/sections/`-mappe at
spejle. Det gør der ikke. Den reelle forbedring er i stedet gennemført i to trin:

- `LoenudviklingFields` og `loenudviklingBinding` er blevet én delt, typet flade for
  ansættelsesforholdskortet og EO-oplysninger.
- SFGG-afledningerne er flyttet ud af kortets JSX og ind i VM-/derivationslaget.

Det har fjernet reel duplikering og gjort kortet mindre, men `AnsaettelsesforholdCard` er
stadig en stor komponent med flere selvstændige præsentationsansvar. Det resterende punkt er
derfor ikke “opret en mappe og flyt blokke”; det kræver en ny vurdering af konkrete ansvarssømme
og må ikke gennemføres som mekanisk filopdeling.

**Arkitektonisk vurdering:** Den delte lønudviklingsflade er et godt greenfield-træk, fordi
den samler en faktisk fælles brugerflade uden at udviske forskellen på read-only og redigerbare
felter. Den resterende monolit betyder dog, at punktet ikke kan kaldes fuldt gennemført.

**Konkret anbefaling: Gennemfør en afgrænset ændring.**

Opdel kortet i få domænebaserede underkomponenter for henholdsvis ansættelsesforholdets
identitet/status, overenskomst og satser samt de afsluttende SFGG-/advarselsvisninger.
Lønudviklingen skal fortsat bruge den eksisterende `LoenudviklingFields`- og
`loenudviklingBinding`-flade, og alle underkomponenter skal læse fra den eksisterende VM.
Bevar rækkefølge, labels, focus-flow og beregningsadfærd; der skal ikke indføres et nyt
generisk sections-framework eller en parallel bindingsmodel.

### #2 — `documentService` → deklarativt download-register

**Status: ↪ Overflødiggjort.**

Der findes ikke længere et `documentService.ts`. Dokumenter beskrives med typed
`DocumentDefinition`-poster, katalogiseres med dokumentdefinitionerne og afvikles gennem den
ene dokumentlivscyklus. `src/document/service/` indeholder kun runtime-fejlporte.

**Arkitektonisk vurdering:** Den nuværende løsning er bedre end det foreslåede globale
download-register. Et globalt register ville samle alle dokumenter i kernelaget og risikere at
ødelægge lazy-load- og appvariantgrænserne. Punktet skal ikke genoplives; nye problemer skal
formuleres mod den aktuelle definition-/lifecycle-model.

### #3 — `fileHandleStorage` → generisk IndexedDB-primitiv

**Status: ✅ Omformet og afsluttet.**

`src/utils/indexedDbStore.ts` ejer nu forbindelse, transaktion og promisificering. De
domænenavnede operationer ligger i fil-handle-laget, og permission-verifikation er flyttet ud,
fordi den ikke er IndexedDB. `logStorage` bruger samme transportprimitiv, men den append-only
logdatabase er fortsat adskilt fra key/value-databasen.

Der er samtidig lukket reelle integritetsfejl: forbindelser lukkes i `finally`, handle og
metadata skrives i én transaktion, og transaction failure kan ikke længere rapporteres som
succes. Der er en målrettet test med utilgængelig IndexedDB, rollback-/lukningsadfærd og flere
skrivninger.

**Arkitektonisk vurdering:** Dette er greenfield-korrekt. Transportmekanikken er samlet, mens
de to forskellige persistence-modeller ikke er tvangsforenet for at spare en database-
definition. Det er den rigtige balance mellem konsolidering og klarhed.

### #4 — Residual parallel-helper-oprydning

**Status: ✅ Omformet og afsluttet.**

Den oprindelige påstand om to parallelle beløbs-paste-stier var forkert. Den generelle
paste-normalisering importerer allerede den kanoniske beløbsnormalisering. Det faktiske fund
var død produktionskode (`sanitizePastedAmount`), som blev fjernet sammen med den isolerede
testafhængighed.

De små moduler `dateOrderValidation`, `numberComparison` og `percentInputUtils` har stadig
hver sit hjem, fordi deres concerns fortsat er forskellige og har reelle forbrugere.

**Arkitektonisk vurdering:** Den gennemførte løsning viser den rigtige greenfield-disciplin:
den flytter ikke kode bare for at få færre filer, men fjerner den kode, der faktisk ikke havde
en produktionsrolle. Der er intet verificeret restarbejde fra den oprindelige kandidat.

### #5 — Ensartet viewmodel-mønster på persisted fagsider

**Status: ✅ Afsluttet.**

Alle otte persisted fagsider har nu ét kanonisk viewmodel-indgangspunkt. Sider med dyb prop-
boring bruger provider/context, mens flade sektions-træer modtager VM’en som prop. Det er
bevidst tilladt i `page-component-contract.md`; kontrakten kræver ét indgangspunkt, ikke én
bestemt transportform.

System-/indstillingssider og informationssiden er korrekt uden for kravet. De har ikke
automatisk brug for et tomt VM-lag.

**Arkitektonisk vurdering:** Dette er gennemført optimalt i forhold til det faktiske behov.
En universel `useXxxViewModel(form)`-signatur eller et krav om provider på alle sider ville
være ceremoniel ensretning. VM’en orkestrerer; beregningskernen og inputkernen forbliver andre
lag.

### #6 — `Aarsloen.tsx` → VM + sektioner

**Status: ✅ Afsluttet.**

`Aarsloen` har et kanonisk viewmodel-lag, en provider og separate sektioner for indtastning,
beregningsprincipper, beregning, satser og meddelelser. Siden sammensætter i stedet for at
holde hooks, handlers og den dybe metode-/periode-rendering samlet.

**Arkitektonisk vurdering:** Opdelingen følger den etablerede page-kontrakt og flytter ikke
beregning ind i UI-komponenter. Den er derfor en reel ansvarsomlægning og ikke blot en fil,
der er flyttet et niveau ned. Der er ikke et dokumenteret restproblem for punktet.

### #7 — Headless `StyledDropdown`

**Status: ◐ Delvist gennemført.**

`mergeSx` er blevet gjort fælles, og stylingduplikering er fjernet eller reduceret. Den
headless interaktionskerne, som den oprindelige kandidat foreslog, er dog ikke etableret.
`StyledDropdown.tsx` er fortsat stor og kombinerer interaktionslogik, præsentation, typeahead,
focus og menu-rendering.

Det er ikke dokumenteret som et konkret korrekthedsproblem, at den headless opdeling mangler.
Et eventuelt restarbejde skal derfor først afgrænses til en konkret fælles invariant mellem
dropdown-fladerne og karakteriseres med keyboard-tests.

**Arkitektonisk vurdering:** Den fælles `mergeSx` er god konsolidering. En blind mega-hook med
escape-hatches for form- og grid-surface ville sandsynligvis flytte kompleksiteten i stedet
for at fjerne den. Punktet er derfor reelt delvist, men den oprindelige løsning er ikke
automatisk den rigtige næste løsning.

**Konkret anbefaling: Bevar den nuværende tilstand.**

Der skal ikke indføres en generisk headless dropdown-kerne nu. Den aktuelle komponent har én
samlet interaktionsmodel, og der er ikke verificeret en fejl eller en konkret fælles invariant,
som kræver en ny abstraktion. Bevar `mergeSx` og den eksisterende keyboard-/typeahead-adfærd.
Genåbn kun punktet, hvis en dokumenteret duplikering eller en konkret regressionsrisiko viser,
at netop en ren interaktionskerne vil fjerne kompleksitet; filstørrelsen alene er ikke nok.

### #8 — Delt fane-scaffolding og `SideTab`

**Status: ✅ Afsluttet.**

`PageTabs` og `SideTab` bruges af de relevante fanesider og sidefaner. Fælles positionering,
styling og fane-guard er samlet ét sted, mens forskelle som `minTabWidth` og værdien `false`
for en kontrolfane er eksplicitte API-egenskaber.

**Arkitektonisk vurdering:** Abstraktionen er tilpas lille. Den centraliserer den gentagne
scaffolding uden at gøre sidernes domænespecifikke tabvalg til et globalt register. Det er
greenfield-korrekt og kræver ikke yderligere arbejde.

### #9 — `DocumentDownloadButton`-konsolidering

**Status: ✅ Afsluttet.**

Den fælles `DownloadIconButton` ejer den visuelle affordance, mens
`DocumentDownloadButton` kobler den til app-settings og dokumentformat. Standalone-
MinProcesrente bruger den præsentationelle kerne, hvor Mineo-wrapperen ikke passer.

**Arkitektonisk vurdering:** To lag er her bedre end én universel komponent: styling/fokus-
adfærd er fælles, mens settings- og dokumentlivscyklus er kontekstafhængig. Formatbevidst
tooltip, disabled-state og keyboard-adfærd er samlet uden at presse standalone ind i Mineos
providers.

### #10 — `Forsoergertab.tsx` → VM + sektioner

**Status: ✅ Afsluttet.**

Forsørgertab har et viewmodel/provider-mønster og separate sektioner for oplysninger,
beregning, EAL, ASL og resultat. Siden sammensætter sektionerne, mens afledt state og
dokumentflow ligger i VM’en.

**Arkitektonisk vurdering:** Opdelingen respekterer snapshot-/beregningskernen og gør ikke
UI’et til en alternativ beregningsvej. Den er derfor mere end kosmetisk filopdeling og er
tilstrækkelig for punktets mål.

### #11 — `defineDocument`-generator-factory

**Status: ✅ Afsluttet.**

Generatorerne bruger et fælles lifecycle-skelet gennem `defineDocument`. Format og filendelse
kommer fra den eksplicitte dokumentgenereringssession, og generatorerne bygger mod
`DocumentComposer` i stedet for at eje kanal- eller save-logik.

**Arkitektonisk vurdering:** Factoryen er korrekt placeret som generator-lifecycle, ikke som
et globalt download-service-lag. Den nyere `DocumentDefinition`-/catalog-model er en naturlig
udbygning, ikke en konkurrerende løsning. Der er ingen grund til at genindføre den gamle
filnavns- eller formatkæde.

### #12 — Fælles visual/range-fejl-seam

**Status: ✅ Omformet og afsluttet.**

Den oprindelige `Styled*Field`-/`useStyledFieldAdapter`-arkitektur er slettet. Den fælles
`mergeSx` og den numeriske konfigurationsvalidering eksisterer fortsat, men feltadfærd,
settle, rejected input og issues ejes nu af `src/inputCore/`.

Det betyder, at den gamle kandidat ikke skal “færdiggøres” ved at genskabe seam’en. Den nye
feltmotor leverer det stærkere mål: én editor-state-machine og én afledt issueprojektion for
form- og grid-surface.

**Arkitektonisk vurdering:** Det er et godt greenfield-resultat, fordi migrationsnavne og
parallel state ikke er bevaret af hensyn til historien. Den aktuelle kontrakt har endda
fraværsværn mod de slettede navne. Punktet er afsluttet gennem en bedre løsning end den
oprindelige.

### #13 — `schemaFingerprint` → `persistedDataVersion`

**Status: ✅ Omformet og afsluttet.**

`persistedDataVersion` er nu navnet i både runtime-state og `.eo`-modellen. Den beregnede
`schemaFingerprint` er fortsat et separat test-/CI-begreb. Den adskillelse er vigtig: runtime-
versionen beskriver persisted data, mens fingerprintet opdager schema-drift under udvikling.

**Arkitektonisk vurdering:** Navneændringen var korrekt, og den nye inputruntime har ført
versionsbegrebet videre uden at genintroducere den gamle persistence-store. Punktet er derfor
ikke kun historisk gennemført; dets semantik lever i slutproduktet på den rigtige grænse.

### #14 — Filnavnssanitering og ASCII-slug

**Status: ✅ Omformet og afsluttet.**

Den foreslåede udskiftning af `ContentBoxReportDialog`’s lokale funktion med dokumentets
`sanitizeFilenamePart` ville have været forkert: de to funktioner har forskellige concerns.
Dokumentfilnavnet skal bevare brugervendte danske tegn, mens skærmprint- og serie-id’er skal
være ASCII-slugs.

Det reelle problem var tre forskellige ASCII-slug-varianter. `src/utils/asciiSlug.ts` er nu
kanonisk og bruges af de tre callsites med eksplicit separator/fallback. Den danske
translitteration (`ø` → `oe`, `æ` → `ae`, `å` → `aa`) er testet mod eksisterende navnekonventioner.

**Arkitektonisk vurdering:** Dette er bedre end den oprindelige løsning, fordi det konsoliderer
det faktiske concern uden at ændre dokumentfilnavnenes semantik. Den synlige ændring i
skærmprint-navne er en korrektion af tabte danske tegn, ikke en ny UI-beslutning.

### #15 — `TableSpec`

**Status: ✅ Afsluttet.**

`TableSpec` er ren semantisk data. PDF og Word renderer specifikationen direkte i hver sin
kanal, og kolonnebredder, alignment, totalrækker og relevante præsentationsdetaljer er dækket
af golden-tests for både standalone-generatorer og EO-sektioner.

**Arkitektonisk vurdering:** Det er den rigtige grænse. En fælles renderer ville igen have
blandet PDF- og Word-mekanik, mens en ren `TableSpec` giver én struktur og to kanalnære
projektioner. Den tidligere tabelbro er fjernet frem for at blive vedligeholdt parallelt.

### #16 — Split af regulering og sygeferiegodtgørelse

**Status: ✅ Afsluttet.**

SFGG er splittet i kilde, referencesats, periodisering, segmentering, ansættelsesforhold,
resultat og warnings med en tynd orkestrator. Reguleringsdelen er samtidig ført ind i den
kanoniske reguleringsmodel. Resultatgoldens låser blandt andet segmenter, tekster, årsresultat
og øre-restfordeling.

**Arkitektonisk vurdering:** Opdelingen følger de reelle data- og ansvarssømme. Teksthelpers
er ikke flyttet ind i beregningsmotoren, og warnings er ikke gjort til en skjult alternativ
resultatmodel. Det er en reel greenfield-konsolidering.

### #17 — Kanonisk dag-set-algebra

**Status: ✅ Afsluttet.**

Dag-set-byggeri ligger samlet i EO-motorlaget, mens det neutrale SH-dag-modul ligger i et
neutralt datohjem. `eoInspektion` forbruger read-only resultater og bygger ikke længere en
parallel kopi af ferie-/SH-daglogikken.

**Arkitektonisk vurdering:** Det er vigtigt, at ikke alt blev flyttet til `domain/dates/`.
Ferie- og TAF-dag-sæt indeholder EO-politik og hører derfor i EO-motoren. Kun den reelt
neutrale primitive er flyttet. Golden-ækvivalens dækker ændringen.

### #18 — `EetDifferencekravTab` og delt forligseditor

**Status: ◐ Delvist gennemført og bevidst beskåret.**

De to store, fil-lokale bokse er flyttet til `erhvervsevnetab/differencekrav/`, og en delt
formatter er placeret i domænenaboen. Den foreslåede fælles forligseditor er ikke indført.

Det er ikke en glemt rest: EO og EET har forskellige ref-/domænegrænser. EET skal bruge
`forligInputPort`, og et naivt fælles komponent-import ville bryde `domain-boundary-contract`.
Den resterende duplikering er lille og er ikke i sig selv en god grund til at bryde grænsen.

**Arkitektonisk vurdering:** Den gennemførte del er god. Punktet skal ikke kaldes fuldt
gennemført, fordi den oprindelige kandidat også omfattede forligsfladen, men fravalget er
arkitektonisk begrundet og ikke et kvalitetsproblem.

**Konkret anbefaling: Bevar den nuværende tilstand.**

EO- og EET-forligsfladerne skal ikke slås sammen. EET’s `forligInputPort` og den relevante
domain-boundary gør en fælles editor med EO’s descriptor-katalog til den forkerte grænse.
Den lille resterende duplikering er ikke tilstrækkelig til at retfærdiggøre en ny fælles
komponent. Hvis den senere vokser mærkbart, må der højst udtrækkes en neutral præsentations-
primitive, der kun modtager eksplicitte porte og ikke kender EO- eller EET-descriptors.

### #19 — Generisk keyed-slice store-factory

**Status: ↪ Overflødiggjort af den nye inputkerne.**

Den gamle model med parallelle `sections`, `fieldErrors`, `invalidDrafts` og revisions-slices
er ikke længere produktionsarkitekturen. `settledInput`, `inputReducer`, `InputReader` og
runtime-storet udtrykker nu aggregate, rejected input og revision samlet.

**Arkitektonisk vurdering:** En factory over de gamle slices ville have været en pænere
legacy-model, men stadig den forkerte slutarkitektur. At slette hele parallelmodellen er mere
greenfield end at konsolidere dens interne boilerplate. Punktet har intet restarbejde.

### #20 — EO-inspektion: regex-id’er og struktureret metadata

**Status: ✅ Afsluttet.**

`EoRowModel` bærer nu struktureret tabeldata, og `serializeEoRowTable` producerer
`displayValue`. Viewmodellen parser ikke længere tabelindhold fra `\n` og `|` eller genkender
totalrækker ved at matche teksten `I alt`. Employment-id’er bæres eksplicit af row-builderne.

Den resterende regulerings-id-afledning er bevidst bevaret, fordi dens kilde er en sektion og
ikke en række, der kan bære id’et. Den er dokumenteret som en anden datamodel.

**Arkitektonisk vurdering:** Strukturen er nu autoritativ, og den formaterede streng er en
ren outputprojektion. Det er netop den rigtige retning. Serialiseringsformatet er separat
testdækket, så outputændringer ikke kan gemme sig i de øvrige goldens.

### #21 — `Indstillinger.tsx` → deklarativt settings-register

**Status: ✅ Omformet og afsluttet.**

Et fuldt register var ikke en god løsning. Settings-siden har flere kontroltyper,
opdateringsformer, udviklingsgating og asynkrone filsystem-handlers. Et register ville have
krævet så mange escape-hatches, at det blot ville skjule forskellene.

Det reelle fund var enum-etiketter, der fandtes flere steder, blandt andet i EO-række-
evalueringen. De er samlet i `src/schemas/formSchemas/enumLabels.ts` med testdækning. Den
store directory-handle-flade er fortsat eksplicit, fordi den er et selvstændigt browser-
storage-flow og ikke en almindelig settings-række.

**Arkitektonisk vurdering:** Det er bedre at bevare heterogenitet synligt end at indføre et
deklarativt register, der kun ser ensartet ud på overfladen. Den faktiske fælles metadata har
fået ét hjem; resten er ikke kunstigt abstraheret.

### #22 — `IndtaegtFoerSkadenSection` → undersektioner

**Status: ◐ Delvist gennemført.**

Den fælles `LoenudviklingFields`-flade har fjernet den væsentligste konkrete duplikering
mellem indkomst-før-skaden og ansættelsesforholdskortet. Der er også rettet en manglende
basisdato-tooltip og samlet fælles styling.

`IndtaegtFoerSkadenSection.tsx` er dog fortsat en stor sektion med flere ansvarsområder. Den
oprindelige undersektion-opdeling er derfor ikke gennemført. Et næste trin skal først finde
reelle ansvarssømme og må ikke skabe mange små komponenter uden selvstændig værdi.

**Arkitektonisk vurdering:** Den delte flade er en stærk greenfield-løsning; den resterende
filstørrelse gør status delvis. Det er ikke nødvendigvis optimalt at splitte resten alene
efter markup-blokke.

**Konkret anbefaling: Gennemfør en afgrænset ændring.**

Opdel sektionen i få ansvarsbårne undersektioner: én for indtægt-før-skaden-felterne og én for
lønudvikling/basisdato og den tilhørende opslagshandling. Bevar den eksisterende
`useEoOplysningerVm()`-flade, den delte `LoenudviklingFields` og den nuværende synlige
rækkefølge. Opdelingen skal være en ren strukturændring uden ny inputmodel, prop-boring eller
ændring af validering, beregning, labels eller tooltips.

### #23 — Regulering → kanonisk forløb

**Status: ✅ Afsluttet.**

Reguleringsformerne med selvstændige kildeserier emitterer forløbet sammen med segmenterne.
Dokument- og kontrollagene modtager det samme forløb og genindlæser ikke rå satsdata via
parallelle `build*IndexEntries`-fallbacks. Manglende eller mismatchet forløb fejler lukket.

Former uden selvstændig serie bærer ikke et kunstigt `forloeb` alene for at opnå en ensartet
union; de bruger deres egne kanoniske formel-/opslagsprimitiver.

**Arkitektonisk vurdering:** Det er bedre end en universel forløbstype. Den kanoniske kilde
er samlet, hvor der findes en reel serie, og domæneforskelle er bevaret, hvor de er reelle.
Golden-nettet beskytter tallene og teksten.

### #24 — Deklarativt dokument-IR

**Status: ✅ Afsluttet.**

Generatorer og EO-sektioner bygger én immutable, kanalneutral `DocumentModel` gennem
`DocumentComposer`. Modellen dækker tekst, label/value, spacing, keep-with-next, sideskift,
tabeller, grupper, underskrift, brevhoved, vandmærke, billeder og footer. Generatorer ser
ikke kanal, cursor eller råt dokumentobjekt.

**Arkitektonisk vurdering:** Dette er en reel greenfield-grænse. `DocumentWriter` er bevaret
som intern render-target-adapter, hvor den hører hjemme, i stedet for at lade generatorerne
bruge den direkte. AST-værn og modeltests gør grænsen håndhævet, ikke kun beskrevet.

### #25 — Samlet felt-state-kerne

**Status: ✅ Omformet og afsluttet.**

Planens idé om én mega-hook med to næsten ens adaptere blev erstattet af en mindre og renere
kerne i `src/inputCore/`. Den fælles state-/resync-/rejected-input-logik er surface-agnostisk,
mens React-form- og grid-surface stadig ejer deres forskellige DOM-/editor-lifecycle.

**Arkitektonisk vurdering:** Det er den rigtige afgrænsning. En mega-hook ville have samlet
forskelle som flag og skabt en ny kompleksitet. Den nuværende løsning deler invarianten, men
ikke ansvar, der reelt hører til forskellige surfaces. Den er verificeret med transitions-
tests og form-/grid-kontraktnet.

### #26 — `Container` → headless keyboard-navigation

**Status: ✅ Afsluttet.**

`Container` er reduceret til layout-/komponentansvar, mens focusable inventory, rækkegeometri,
widgetsemantik og keyboard-navigation ligger i `containerNavigation/`. Geometrien er nu
testbar uden at stole på jsdom-layout, hvor DOM-rects ellers er nul.

**Arkitektonisk vurdering:** Det stærke argument var testbarhed og ansvar, ikke blot antal
linjer. Refaktoreringen bevarede den eksisterende keyboard-kontrakt og blandede ikke grid-
navigation ind i den generelle containerlogik.

### #27 — Samlet række-persistering

**Status: ✅ Omformet og afsluttet.**

De gamle `useRowDrafts`-/`useGridRowPersistenceCore`-spor er væk. Collection-tabeller læser
committed rows fra inputkernen, og `useCollectionTable` samler placeholder-identitet,
cellebinding og rækkecommands. `useSortedCollectionTable` ejer sortering, renderorden,
save-order og header-binding som én koblet enhed.

**Arkitektonisk vurdering:** Dette er stærkere end en fælles hook over de gamle row-draft-
modeller. Draften hører til cellens inputsurface, mens aggregate og row commands hører til
inputkernen. Forskellen mellem løse tabeller og grid-tabeller er nu styling-/renderings-
variation, ikke en anden persistence-model.

### #28 — Persistence-læse-sti-lagstak

**Status: ✅ Omformet og afsluttet.**

Den gamle persistence-context, selector-hook og pass-through-læsemodel er ikke længere den
autoritative læsevej. `InputReader`, typed projections og runtime-bindingen udgør den aktuelle
læsegrænse. Pages og beregninger læser ikke rå aggregate-sektioner.

**Arkitektonisk vurdering:** Den nye løsning løser mere end at slette trivielle wrappers: den
gør det strukturelt vanskeligere at læse den forkerte stateform. Det ville være forkert at
genindføre gamle selectors/context blot for at bevare kandidatens historiske filnavne.

### #29 — `dateRanges.ts` og read-time `TODAY`

**Status: ◐ Delvist gennemført.**

Den konkrete stale-date-fejl er løst. Dags dato og aktuelt år læses ved opslagstidspunktet,
og validatorer kan modtage dynamiske year-bounds. Tests krydser midnat og årsskifte og fejler,
hvis den gamle import-tidskonstant genindføres.

Den fulde oprindelige filopdeling og deklarative range-datatabel er ikke gennemført. `dateRanges.ts`
indeholder fortsat flere concerns og gentagen metadata. Det er et reelt strukturelt restpunkt,
men enhver ændring skal bevise identiske dato-grænser og må ikke ændre beregnings- eller
valideringsadfærd.

**Arkitektonisk vurdering:** Read-time-delen er gennemført korrekt. En fuld opdeling kan være
fornuftig, men er ikke automatisk nødvendig, hvis den kun flytter data og øger antallet af
moduler. Punktet står derfor som delvist, ikke som afsluttet.

**Konkret anbefaling: Bevar den nuværende tilstand.**

Den centrale `dateRanges.ts`-fil er et samlet, auditerbart katalog over dato-grænser på tværs
af siderne. Den bør ikke splittes i mindre data- og logikfiler alene på grund af filstørrelse,
og de gentagne `notes` er en del af range-dokumentationen, ikke i sig selv en parallel
autoritet. Bevar read-time-getterne og de eksisterende midnat-/årsskiftetests. En senere
ændring kræver et konkret nyt grænseproblem og golden-/kontrakt-tests for at bevise identiske
grænser.

### #30 — Konsolider validerings-ejerskab

**Status: ✅ Omformet og afsluttet.**

Den oprindelige løsning med én universal cross-field-validator blev ikke valgt. Den aktuelle
arkitektur skelner mellem schema/form-validering, feltissues fra inputkernen, domænespecifik
cross-field-evaluering, EO-row-gating og systeminvarianter. Ansvarsdelingen er dokumenteret
og konvergerer i fælles issue-/invariant-formater, hvor lagene mødes.

**Arkitektonisk vurdering:** At flere moduler findes er ikke i sig selv drift. De har
forskellige autoriteter og er afgrænset af kontrakter og værn. En yderligere “konsolidering”
til ét modul ville blande field, domain og system concerns og være et dårligere slutprodukt.

### #31 — PDF/Word-paritet som struktur

**Status: ✅ Afsluttet.**

Begge kanaler renderer samme `DocumentModel`. `TableSpec`, semantiske tekstblokke, totaler,
signatur, brevhoved, vandmærke, spacing og keep-intentioner går gennem samme modelautoritet.
PDF-goldens er bevaret, mens Word-output har et eksplicit golden-net for den godkendte paritet.

**Arkitektonisk vurdering:** Pariteten er nu strukturel, men kanalernes nødvendige
renderingsmekanik er stadig separat. Det er mere robust end fælles lavniveau-layoutkode og
undgår at Word simulerer PDF’ens cursor.

### #32 — EO-sektioner → rene `Block[]`-funktioner

**Status: ◐ Delvist gennemført og omformet.**

Den oprindelige præmis om, at sektionerne ikke producerede blokke, var forkert: de bruger nu
`DocumentComposer`, som bygger `DocumentModel`. Den reelle svaghed er, at de største EO-
sektioner stadig er `void`-funktioner med store context-objekter, writer-afledte lokale
funktioner og blandet projektion/komposition. `opgoerelseSection`, `reguleringSection` og
`eoBilagSections` viser fortsat denne form.

Den aktuelle IR-grænse gør, at en senere oprydning kan ske uden at ændre kanalmodellen, men
punktet er ikke fuldt afsluttet. Nogle context-funktioner kan være en bevidst testseam; det
skal vurderes ved konkret split, ikke fjernes blindt.

**Arkitektonisk vurdering:** Dokument-IR’et er greenfield-korrekt. EO-sektionslaget er endnu
ikke helt på samme niveau og er derfor et ægte restpunkt, selv om den oprindelige formulering
var fejldiagnosticeret.

**Konkret anbefaling: Bevar den nuværende tilstand.**

Der skal ikke gennemføres en mekanisk omlægning til funktioner, der returnerer bogstavelige
`DocumentBlock[]`. `DocumentComposer` er den bindende, kanalneutrale kompositionsgrænse, og
`void`-returen betyder her, at sektionen føjer blokke til den modelbygger — ikke at den skriver
direkte til en PDF- eller Word-writer. De nuværende context-objekter er eksplicitte og kan
bevares som testseams. Kun en senere, navngiven intern ansvarssøm med dokumenteret gevinst bør
føre til en lokal funktionsopdeling, og den skal i så fald golden-verificeres.

### #33 — Atomisk mutationsprimitiv i `FormPersistenceContext`

**Status: ↪ Overflødiggjort af inputkernen.**

Den gamle `FormPersistenceContext` og dens atomiske write-metoder er slettet. Atomiske felt-
og row-ændringer går gennem inputreduceren; hel-sags load/reset/clear går gennem typed
replacement-commands og coordinatoren.

**Arkitektonisk vurdering:** Den tidligere fælles rollback-helper var en rimelig forbedring af
den gamle model, men den er ikke slutpunktet. Den nye løsning har færre stateformer og én
systemport, så en genindførelse af context-primitiven ville være tilbageskridt.

### #34 — EO-schema-variant-dedup

**Status: ↪ Overflødiggjort.**

Verifikationen viste, at schema-varianterne allerede blev afledt gennem den eksisterende
factory. Den påståede parallelle schema-form findes ikke, og en filopdeling uden et konkret
grænseproblem ville være ændring for ændringens skyld.

**Arkitektonisk vurdering:** Korrekt lukket som ikke-kandidat. Der skal ikke oprettes en ny
abstraktion for at gøre et historisk punkt “synligt”.

### #35 — Carry-forward-serieopslag

**Status: ✅ Omformet og afsluttet efter korrigeret skæring.**

Der fandtes allerede en generisk typed lookup (`findLatestByDateKeyInSortedList` og den
ergonomiske `findLatestByDateInSortedList`). Det reelle problem var ikke fraværet af en
primitiv, men at nogle serier ikke brugte den fælles `startIso`-form.

Den relevante reguleringsserie-model bruger nu den fælles lookup og dens sorteringsinvariant.
Andre dataområder som lukkede intervaller, eksakte årstabeller og offentlig løn med en anden
dato-/coverage-model er ikke presset ind i carry-forward-typen.

**Arkitektonisk vurdering:** Den korrigerede løsning er bedre end en universal
`carryForwardSeries<T>`. Den samler identisk semantik og bevarer domænemæssigt forskellige
datamodeller. Lookupens sorteringsretning og coverage-værn er de vigtige invariants.

### #36 — EET på `MoneyOre` og canonical spine

**Status: ✅ Afsluttet.**

EET’s offentlige pengebeløb er nu `MoneyOre` efter de eksisterende domænespecifikke
afrundingspunkter. `EetSnapshot` er schema-valideret canonical output, og EET→EO går gennem
en typed import-context. Højpræcisionsprocenter og faktorer er ikke fejlagtigt gjort til
ørebeløb.

**Arkitektonisk vurdering:** Det er en korrekt greenfield-anvendelse af pengealgebraen:
pengeenheder er lukkede, mens mellemregninger beholder den præcision de faktisk kræver.
Golden-værdier før/efter er afgørende og er en del af afslutningen.

### #37 — Branded `MoneyOre` og lukket pengealgebra

**Status: ✅ Afsluttet.**

`MoneyOre` og den lukkede algebra er etableret som fælles typed primitive med Zod-validerede
canonical outputs og arkitekturværn mod usikre konverteringer.

**Arkitektonisk vurdering:** Pengeconcernet er placeret neutralt nok til at kunne bruges af
flere domæner, men ikke gjort til en generel “tal-wrapper”. Konvertering til kroner sker ved
en eksplicit port tæt på den relevante grænse. Det er en passende balance mellem type-sikkerhed
og læsbar domænekode.

### #38 — Eksplicit dokumentgenereringssession

**Status: ✅ Afsluttet.**

`DocumentGenerationSession` bærer format og rendering. Den kanalaktive state ligger ikke i
modul-global context, og fil-download startes kun af dokumentlivscyklussen efter gate og
friskhedschecks.

**Arkitektonisk vurdering:** Sessionen er en reel livscyklusgrænse, ikke blot en wrapper om
den gamle globale writer. Den gør samtidige downloads og PDF/Word-routing eksplicitte og
testbare. Den skal bevares som fundament for #24 og #31.

### #39 — Persistence initialiseres før React-render

**Status: ✅ Afsluttet.**

Begge app-entries kalder `bootstrapProductionInputRuntime()` før React-træet renderes.
Bootstrap er idempotent, hydrering sker én gang, og providerens remount overskriver ikke
input. Storage-namespace etableres før standalone-appens øvrige imports.

**Arkitektonisk vurdering:** Dette er den rigtige composition-root-placering. React-provider
distribuerer en færdig binding, men ejer ikke initialisering. Dermed kan rendering, remount og
test-wiring ikke skabe en ny persistence-sandhed.

### #40 — Explicit critical-action-/commit-barriere

**Status: ✅ Omformet og afsluttet.**

Den typed coordinator skelner mellem handlinger, der skal finalisere åbne editors, og
authoritative replacement-handlinger som load, reset og `Slet alt`, der bevidst ikke
settler før replacement. Save, navigation og dokumentdownload evaluerer friskt efter
settle; replacement-flowet anvender no-settle-policy og kasserer først draften ved succes.

**Arkitektonisk vurdering:** Denne skelnen er bedre end at tvinge alle kritiske handlinger
ind i samme workflow. Den beskytter både brugerens åbne editor og den autoritative
replacement-semantik. Kontrakten og overgangstests er vigtigere end et bestemt klassenavn.

### #41 — Typed save/load og tilstandsmaskine

**Status: ✅ Omformet og afsluttet.**

Save/load er samlet omkring typed case-operations, schema-verificeret codec, preflight og
atomic replacement. Rejected input blokkerer save og skrives ikke i filen; load ændrer ikke
in-memory state før preflight/apply-flowet er godkendt. Fejl bevarer den nuværende sag.

**Arkitektonisk vurdering:** Den nuværende løsning er stærkere end den gamle context-
transaktionsplan, fordi persistence ikke længere har en parallel state-model. `InputReader`
er den eneste læseport, og replacement-porten er den eneste hel-sags-skriveport. Det er
greenfield-korrekt for en trust-kritisk client-side app.

### #42 — Versionsbåret schema-evolution i `.eo`

**Status: ✅ Omformet og afsluttet.**

`FILE_FORMAT_VERSION`, `PERSISTED_DATA_VERSION` og current-session envelope-version er
adskilte begreber. Loaded data valideres, migreres og sanitiseres tolerant for ældre filer;
ukendte eller fjernede værdier rapporteres i preflight, mens manglende nye felter ikke
blokkerer. Runtime-state og `.eo`-filen har dermed forskellige, tydelige versionsejere.

**Arkitektonisk vurdering:** Det er korrekt at være tolerant over for historiske `.eo`-filer,
men fail-closed over for datatab og korruption i den aktuelle version. En generel “gør filen
komplet med app-defaults”-sti ville være forkert og er ikke indført.

### #43 — Page-manifest og persistent app-shell

**Status: ✅ Afsluttet.**

`pageNavigation.ts` ejer sags- og systemruteinventaret. `App.tsx` afleder routes fra det,
loader-inventaret valideres mod kataloget, og én `<Route element={<AppShell />}>` ejer
`MainLayout`/`Outlet`-flowet.

Den oprindelige antagelse om, at den gamle per-route-wrapper remountede shellen og tabte
focus-cache, var forkert. Gevinsten er strukturel: ét route-/layout-flow og ét inventar,
ikke en rettelse af en allerede observeret remount-fejl.

**Arkitektonisk vurdering:** Den nye struktur er bedre, fordi den gør driftsfejl synlige ved
import-/type-/testtid. Den ændrer ikke en brugerrejse i sig selv og undgår at begrunde
arkitektur med en upræcis React-antagelse.

### #44 — Feature-slicede EO-viewmodels

**Status: ◐ Delvist gennemført.**

Der findes nu page-level VM’er og flere tab-/feature-VM’er for EO, EET og de øvrige fagsider.
`EOOplysningerTab`, `EOberegningTab` og `LoenindkomstTab` har egne indgange, og flere store
UI-flader er flyttet til sektioner eller delte features.

Det er dog ikke gennemført helt ned på feature-slice-niveau. Nogle VM’er og viewfiler samler
stadig mange gates, navigationer, downloads og præsentationsprojektioner. Dette overlapper
med de konkrete rester i #1, #18 og #22; der skal ikke oprettes et nyt VM-lag uden en navngiven
ansvarssøm.

**Arkitektonisk vurdering:** Page-kontraktens ene VM-indgangspunkt er korrekt gennemført.
Den indre dekomponering er delvis, men den oprindelige idé om at splitte alt efter filstørrelse
er ikke i sig selv et greenfield-kriterium.

**Konkret anbefaling: Bevar den nuværende tilstand.**

Der skal ikke oprettes et ekstra, generisk feature-VM-lag. `page-component-contract.md` kræver
ét kanonisk VM-indgangspunkt pr. persisted side og tillader tab-VM’er, hvor de giver reel værdi;
den aktuelle side-/tab-struktur følger netop den regel. Eventuel fremtidig dekomponering skal
ske under de konkrete ansvarssømme i #1, #18 eller #22 og ikke som et parallelt initiativ under
#44. Den generiske rest bør derfor lukkes uden kodeændring.

### #45 — Deklarativ `GridSpec`

**Status: ✅ Omformet og afsluttet.**

En fuld `EditableGridSpec` blev afvist efter gennemgang. Tabel-shells har forskellige
bredde-API’er, ikke alle visuelle kolonner svarer 1:1 til felter, og cellerenderne er ikke
uniforme. En universal spec ville få flere escape-hatches end reelle deklarative gevinster.

Det reelle fælles concern er nu samlet i `useSortedCollectionTable`: sortering,
reorder-persistering, renderorden, save-order og header-binding følger samme lag. `cellSpecBuilder`
og `useCollectionTable` samler desuden celleidentitet og placeholder-livscyklus.

**Arkitektonisk vurdering:** Dette er den rigtige skæring. Den reducerer en farlig koblet
duplikering uden at opfinde et falsk fælles visuelt tabelformat. En senere fælles kolonnespec
kræver et nyt konkret behov og skal ikke genintroduceres fra den gamle kandidattekst.

### #46 — Variant-ejede styles og build-assets

**Status: ⛔ Bevidst ikke gennemført.**

Styles er i praksis variant-isoleret gennem app-entryens style-loading, og den del af den
oprindelige kandidat er løst. Brugeren har besluttet, at den resterende build-asset-oprydning
ikke skal gennemføres: `_headers`, `robots.txt`, `sitemap.xml` og `llms.txt` er host-/deploy-
artefakter, og den eksisterende pipeline fungerer.

Den accepterede restrisiko er, at begge builds deler `public/`, og standalone-buildets
postbehandling sletter/omskriver variantfiler. Punktet skal ikke åbnes igen uden en ny,
konkret beslutning. Det eneste aktive UI-spørgsmål i nærheden er den tidligere forelagte
enhedsadfærd for Anciennitetstillæg; det er ikke en del af #46.

### #47 — Ét verificeret release-artefakt

**Status: ✅ Afsluttet.**

`verify:release` samler typechecks, lint, integritetskontroller, tests, E2E og build. CI uploader
de verificerede `dist`-artefakter, og deploy-jobbet downloader og deployer dem uden en ny build.
Buildene har fortsat variant-specifik postbehandling, men de artefakter, der deployes, er de
samme som gate-jobbet verificerede.

**Arkitektonisk vurdering:** Den vigtige invariant er “verificér præcis det, der deployes”,
og den er opfyldt. Den historiske beskrivelse af fjernede dependencies eller præcise testtal
skal ikke gentages som aktuel status; release-gaten skal vurderes på sin nuværende kommando-
og CI-kæde.

### #48 — AST-baseret arkitekturgrænse-harness

**Status: ✅ Afsluttet.**

Arkitekturtests har en fælles source-graph, AST-forespørgsler, deklarativt regelmanifest,
præcise diagnostics og anti-rot-/fixture-værn. Regex/tekstkontroller er kun bevaret, hvor
tekstformen selv er kontrakten, eksempelvis mojibake eller specifikke CSS-/dokumentidiomer.

**Arkitektonisk vurdering:** Harnesset er ikke blot flyttet fra mange filer til én fil. Det
har en eksplicit distinction mellem import-/adgangsgrænser og positive wiring-/runtime-
invarianter, som fortsat må have dedikerede guards. Mutation-/liveness-værnene reducerer
risikoen for grønne regler uden mål.

### #49 — Neutral måneds-/intervalalgebra

**Status: ✅ Afsluttet.**

Den rene inklusive månedsbrøk ligger i `domain/dates/maanedsbroek.ts` og bruges af EO og
EET. EO-specifik fraværsjustering og afrunding er blevet i EO-motoren. Den tidligere test-
only wrapper er fjernet.

**Arkitektonisk vurdering:** Afgrænsningen er korrekt: neutral intervalalgebra er delt,
mens domænepolitik ikke skjules i et “neutralt” modul. Golden-værdier for månedsgrænser,
skudår og floating-point-identitet beskytter mod taldrift.

### #50 — TAF-graf → ren scene-model og renderer

**Status: ✅ Afsluttet.**

Grafen har nu en ren `TafChartScene`, en Canvas-renderer og golden-/helper-tests for scene-
indholdet. Den gamle monolits domænebeslutninger, layout og rasterisering er adskilt. Der er
desuden kørt en før/efter-sammenligning mod den gamle renderer for at sikre pixel-/kald-
identitet, bortset fra eventuelle reelle tegnefejl.

**Arkitektonisk vurdering:** Scene-modellen er den rigtige testseam, fordi jsdom ikke har et
meningsfuldt Canvas-API. Rendererens ansvar er nu mekanisk. Den aftalte pixel-troskab betyder,
at farver, størrelser og placeringer ikke må ændres som smag; kun dokumenterede reelle
tegnefejl kan ændres efter særskilt forelæggelse.

### #51 — Typed beregningsdatakatalog og provenance

**Status: ✅ Afsluttet.**

Et typed, udtømmende katalog bærer id, provenance, coverage, kilde-specifik payload og
validator. Golden-fingerprints låser payloads, kapitaliseringstabeller og kildeudvalg.
Registryet er en verifikationsgrænse og eager-importeres ikke fra app-entrypoints, så
standalone-bundlen ikke får Mineos beregningsdata uden grund.

**Arkitektonisk vurdering:** Kataloget standardiserer metadata og verifikation uden at tvinge
alle datakilder ind i samme payload-shape. At beholde kilde-specifikke datafiler er her bedre
end at skabe mange generiske aliasmoduler for en låst featureflade.

### #52 — Normative kontrakter: invariant-kerne vs. implementeringskort

**Status: ✅ Omformet og afsluttet.**

Den oprindelige plan ville flytte konkrete fil- og symbolreferencer ud af kontrakterne. Det
ville have fjernet nyttig, i høj grad korrekt implementeringsinformation. I stedet er
referencerne gjort kontrollerbare:

- liveness-testen verificerer navngivne filer, mapper og symboler, inklusive håndhævede
  fraværsværn;
- git-bundne verifikationsstempler opdager drift mellem kontrakt og kode;
- in-file testkobling afstemmes mod kontrakt-topologien;
- konkrete fejl i referencer og afsnit er rettet.

**Arkitektonisk vurdering:** Den aktuelle løsning er bedre end en mekanisk adskillelse. En
kontrakt må gerne have et implementeringskort, når kortet er en del af den auditerbare
autoritet og bliver holdt levende af værn. Begrænsningen er eksplicit: liveness beviser, at
en reference findes, ikke at beskrivelsen af dens betydning er rigtig. Det er et passende,
ærligt loft for værnet.

## 3. Samlet arkitektonisk vurdering

### Det, der reelt er greenfield

Den nuværende kerne opfylder greenfield-målet på de mest risikable områder:

- input har én autoritativ aggregate-model, én reader og én typed write-grænse;
- rejected input og canonical input kan ikke eksistere skjult samtidig;
- kritiske handlinger har eksplicit policy og coordinator;
- save/load har schema-, preflight-, migration- og replacement-grænser;
- dokumenter bygges som kanalneutral model før PDF-/Word-rendering;
- penge, perioder og beregningsdata har typed, verificerede fælles primitiver;
- ruteinventar, release-flow og arkitekturgrænser har maskinelt håndhævede samlingspunkter.

Det er ikke en legacy-refaktorering med nye navne. De gamle draft-hooks, persistence-contexts,
parallelle row-draft-systemer og globale dokumentkanaler er fjernet, hvor de stod i vejen for
en mere entydig arkitektur.

### Det, der endnu ikke er greenfield-konsolideret

De syv delvise punkter er reelle ydre lagrester:

1. store featureviews i lønindkomst/EO (`#1`, `#22`),
2. dropdown-komponentens kombinerede interaktions-/renderingsansvar (`#7`),
3. EET-differencekravets resterende featuregrænse (`#18`),
4. `dateRanges.ts`’s fortsatte blanding af data og logik (`#29`),
5. EO-dokumentsektionernes store context-objekter (`#32`),
6. den dybere featureopdeling af viewmodels (`#44`).

De skal ikke behandles som en samlet ny refaktorering. Hvert punkt har forskellig risiko og
skal først have en konkret skæring, karakterisering og — hvor brugeroplevelse eller tal kan
ændres — forudgående forelæggelse.

### Bevidste afslutninger uden yderligere arbejde

`#2`, `#19`, `#25`, `#27`, `#28`, `#33`, `#34` og de tilsvarende gamle draft-/commit-ideer skal
ikke genåbnes for at “afslutte” de historiske løsningsforslag. Deres mål er allerede opfyldt
eller afløst af den aktuelle inputkerne. `#46` er den eneste eksplicit brugerbesluttede
ikke-gennemførte kandidat.

## 4. Verifikationsgrundlag

Reviewet er udført ved at sammenholde:

- den oprindelige kandidatliste og senere tilføjelser i git-historikken;
- den aktuelle kode i `src/inputCore/`, dokumentlaget, domæne-/data-lagene, page-/table-lagene
  samt build- og CI-konfigurationen;
- normative kontrakter, især `input-architecture.md`, `form-contract.md`,
  `critical-action-contract.md`, `persistence-contract.md`, `schema-evolution.md`,
  `document-output-contract.md`, `page-component-contract.md`, `app-shell-contract.md`,
  `domain-boundary-contract.md` og `calculation-data-contract.md`;
- relevante tests og arkitekturværn, herunder inputcore-, dokument-, tabel-, dato-, IndexedDB-,
  ASCII-slug- og architecture-suiterne;
- git-historikken for de store draft/commit-, dokument-, shell- og reviewomlægninger.

Kørte kontroller på den aktuelle arbejdsmappe:

- `npm run typecheck` — grøn.
- `npm run typecheck:test` — grøn.
- `npm run lint` — grøn.
- Målrettet Vitest-run af inputcore, dokumenter, architecture guards, tabeller, dato-ranges,
  ASCII-slug og IndexedDB — **74 testfiler / 1.136 tests grønne**.

Der er ikke kørt en fuld release/build/E2E-gate, fordi denne ændring kun omskriver dette
reviewdokument og ikke ændrer produktkode, buildkonfiguration eller brugerrejser.

## 5. Vedligeholdelsesregel for dette review

Dette dokument må fremover kun opdateres efter en kodeverificeret gennemgang. En kandidat må
ikke markeres afsluttet, fordi dens oprindelige symptom er forsvundet; den relevante mekanisme
skal undersøges. Omvendt må en kandidat ikke stå åben, hvis den gamle mekanisme er slettet og
erstattet af en stærkere autoritet.

Ved nyt arbejde skal status altid skelne mellem:

1. det oprindelige problem,
2. den løsning der faktisk findes nu,
3. om løsningen er korrekt og greenfield-mæssigt optimal,
4. et konkret resterende problem, hvis der er et,
5. om resten kræver brugerens godkendelse på grund af UI/UX eller beregningslogik.

Den næste læser skal kunne bruge statusoversigten alene til at se, hvad der er afsluttet,
hvad der er reelt åbent, og hvad der ikke må genoplives.
