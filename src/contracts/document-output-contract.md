# Dokument-output-kontrakt

**Status:** Normativ og gældende
**Type:** Tværgående kontrakt
**Prioritet:** Tværgående kontrakt. Begrænser øvrige kontrakter for sit emne (dokument-output). Domænespecifikke snapshot-/projektionskontrakter må specificere egne projektioner, men må ikke svække reglerne her. Underordnet `domain-boundary-contract.md` for domænegrænser; formatvalg mellem PDF og Word reguleres normativt af `document-format-contract.md`. `page-component-contract.md` er underordnet denne kontrakt.
**Senest verificeret mod kode:** 2026-08-22

## Scope

Denne kontrakt fastlægger de tværgående regler for alt dokument-output i Mineo: de genererede tillidskritiske dokumenter, der downloades til brugeren.

Output dækker **to kanaler**:

1. **PDF** (jsPDF), bygget via PDF-kanalen i `src/pdf/` (`createPdfChannelWriter`).
2. **Word** (.docx), bygget via Word-kanalen i `src/docx/` (`createDocxWriter`).

Begge kanaler forbruger den samme immutable `DocumentModel` fra
`src/document/model/documentModel.ts`. Generatorerne bygger modellen gennem
`DocumentComposer` og har ingen adgang til kanal, sidecursor, dokumentbredde eller råt
kanalobjekt. En eksplicit `DocumentGenerationSession` ejer renderingen uden modul-global
state; formatvalget reguleres af `document-format-contract.md`.

Kontrakten er opdelt i tre afsnit, og henvisninger bruger afsnitsbogstavet: §A2a, §B5.1, §C1.

- **Afsnit A – Data, gate og guards (kanal-neutral):** hvilke data og guards output må bygge på. Gælder fuldt for begge kanaler.
- **Afsnit B – Komposition og render-target-API:** hvordan generatorer komponerer via `DocumentComposer`, og hvordan den centrale modelrenderer afspiller blokke mod det interne writer-target. Layoutreglerne er dobbeltkanal, fordi både PDF- og Word-targetet opfylder samme interne grænseflade.
- **Afsnit C – Kilder, testkobling og undtagelser:** hvor sandheden står i koden, hvilke suiter der holder kontrakten, og hvad der bevidst afviger.

Domænespecifikke snapshot-kontrakter må gerne specificere egne projektioner, men de må ikke afvige fra reglerne her.

---

# Afsnit A – Data, gate og guards (kanal-neutral)

Reglerne i dette afsnit er uafhængige af outputkanal. De gælder uændret for både PDF (jsPDF) og Word (docx), fordi begge kanaler forsynes med den samme autoritative model og afvikles gennem den samme download-sti.

## A1. Grundregel

1. Dokument-output er trust-kritisk output.
2. Hvert output har én typed dokumentdefinition, der ejer dependencies, domæneprojektion og output-invariants.
3. Dokumentdefinitionen læser gennem `InputReader` og må kun danne et `EvaluationSourceToken`-bundet
   `PreparedDocument<T>` fra en
   `ready` projektion.
4. Renderere og generatorer modtager kun den godkendte dokumentmodel/projektion. De må ikke læse rå canonical
   sektioner, rejected input, åben draft, UI-state eller uautoriserede domæner.
5. Den reaktive knap-gate og click-preflight evaluerer samme dokumentdefinition.

## A2. Download-gate-definition

Download er blokeret, hvis mindst én af følgende er sand:

1. Et issue med `severity: 'error'` rammer et input, som dokumentdefinitionen afhænger af. Det omfatter `invalid`,
   `missing`, `range`/`bounds`, `schema` og `rule`. En rød range/bounds-feltfejl blokerer dokumentet uanset
   repræsentation. En canonical værdi med et afledt rødt issue kan fortsat gemmes i `.eo`; save-gaten er uafhængig af
   dokumentgaten.
2. Den autoritative beregning/projektion kan ikke dannes. Snapshot-first-domæner bruger deres typed snapshotprojektion;
   øvrige domæner leverer et typed gate-/preflight-resultat med samme semantik.
3. Output-specifikke invariants eller guards er brudt.
4. Den godkendte projektion er stale i forhold til det aktuelle `EvaluationSourceToken` – dvs. hvis enten inputrevisionen
   eller den relevante settingsrevision har ændret sig siden optagelsen.

Konsekvens:

- Dependencies, domænestatus og output-invariants aggregeres af dokumentdefinitionen, ikke React-handleren eller rendereren.
- Download-knappen modtager et samlet gate-resultat med `canDownload`, `EvaluationSourceToken` og auditerbare årsager.
- Ved blokering er knappen både visuelt og funktionelt disabled efter reglerne i `page-component-contract.md`.
- Generatorer afgør ikke selv, om domænet er `fail_closed`; de modtager en godkendt model eller returnerer runtimefejl.
- En tidligere godkendelse må ikke genbruges efter et nyt input- eller settingsrevisionstoken.

Gate-definitionen er kanal-neutral: et dokument der er blokeret for PDF, er også blokeret for Word, og omvendt. Formatvalget ændrer ikke gaten.

### A2a. Udtømmende håndhævelse på tværs af outputkataloget

Det maskinelt inventariserede outputkatalog er komplethedskilden for dokumentgaten. Hvert katalogiseret output – også
standalone MinProcesrente – skal have præcis én typed dokumentdefinition og være dækket af samme centrale gate- og
preflight-infrastruktur. Et UI-entrypoint, servicekald eller standalone-flow må ikke kunne starte dokumentarbejde uden
denne definition.

For hver dokumentdefinition skal kontrakttests særskilt bevise begge følgende fejlklasser, når de kan forekomme blandt
definitionens dependencies:

1. afsluttet rejected input med `reason: 'invalid'`, herunder et uparseligt format,
2. canonical input med et dokumentrelevant `range`-/`bounds`-issue med `severity: 'error'`.

For begge fejlklasser skal testen bevise, at den reaktive gate gør knappen visuelt og funktionelt disabled, og at en
direkte aktivering stoppes før lazy-load, generator og fil-I/O. En generisk test med én vilkårlig blocker er ikke
tilstrækkelig til at dække begge klasser. Arkitekturværn skal samtidig bevise, at hele outputkataloget går gennem den
fælles preflight, så lokale gates ikke kan genindføre forskellen mellem format- og range/bounds-fejl.

### A2.1 Åben og afsluttet inputtilstand

- Mens editoren er åben, bygger den reaktive gate på den senest afsluttede revision. Åben draft må ikke få knappen eller
  den beregnede visning til at skifte tilstand.
- Et afsluttet rejected input har ryddet feltets canonical slot til tomværdien (XOR); der findes ingen maskeret tidligere
  værdi. Dokumentdefinitionen kan derfor ikke utilsigtet godkende en skjult værdi, og `InputReader` eksponerer aldrig en
  værdi fra et felt med en aktiv rød feltfejl.
- Lokale feltbooleans, reporterstate og direkte sektionslæsning er ikke gyldige gatekilder.
- Afhængighedsscope udledes strukturelt: et per-række-dokument afhænger af fælles felter og den konkrete række; et
  aggregat afhænger af fælles felter og alle inkluderede rækker. Et manuelt `global/section/row`-scope er forbudt.
- Ved downloadaktivering finaliserer commit-barrieren editoren, hvorefter en frisk `InputReader` og samme
  dokumentdefinition evalueres. Blokering stopper før lazy-load, generator og fil-I/O.
- Pointerevent-rækkefølgen, hvor blur normalt når at disable knappen før click, er nyttig normaladfærd, men ikke et
  korrekthedskrav. Tastatur-, programmatisk og allerede leveret click går gennem samme preflight.
- Hvis en aktivering når preflight efter et ugyldigt settle, stoppes den, feltet fokuseres uden scroll, og den eksisterende
  danske advarsel vises. Dette er et sidste sikkerhedsværn.

`src/document/definition/documentLifecycle.ts` er den ENE afvikling af download-livscyklussen: commit-barriere,
frisk kildeoptagelse, token-lighed, gate, lazy-load, friskheds-recheck ved hver asynkron grænse, formatvalg,
generatorkald, fil-I/O og fejlrouting. `executeDocumentDownload` er dens eneste eksporterede indgang; afvikleren og
dens godkendte input (`PreparedDocument`) er modulprivate og nominale, så et ugated input ikke kan nå afviklingen.
Livscyklussen ejer rækkefølgen, ikke domænepolitik eller gate – dem ejer definitionen.

App-specifik runtimepolitik (kildeport, formatvalg, brevhoved-opslag, session, failure-sink) injiceres som et
`DocumentExecutionEnvironment`, komponeret i hver apps composition root. Kernen kender hverken `AppSettings`,
Word-formatet eller `reportSystemIssue`.

**Kildesnapshottets settings er delt i to roller med en bevidst brevhoved-overlapning, og delingen er NORMATIV.**
`DocumentSourceSnapshot` bærer `gateSettings` og `renderSettings`:

1. **`gateSettings`** er det ENESTE settings, en definitions `project` kan se, og er derfor typen på
   `DocumentSourceContext`. I hovedappen er den EO-rækkepolitikken og brevhoved-flagene
   (`MineoDocumentGateSettings`), fordi flaget afgør, om stamdata overhovedet er en gate-relevant
   dokumentafhængighed.
2. **`renderSettings`** er det valgte outputformat og brevhoved-flagene. Miljøet læser dem efter gaten
   har svaret `ready` for at vælge writer og tegne brevhovedet. Flaget findes i begge projektioner, men
   projiceres fra samme source-snapshot.

Reglen bag delingen: **formatet vælger writer, ikke dækning.** Et output SKAL have samme
`ready`/`blocked` for PDF og Word for samme input. Kravet kan ikke opfyldes af et værn, fordi begge
kanaler i §A2a's paritet ville se den samme skæve gate; det er derfor en TYPEGRÆNSE – en `project`, der
læser `documentDownloadFormat`, kompilerer ikke. Begge halvdele projiceres fra ÉT `captureSource`-læs,
så gate og rendering ikke kan stamme fra to revisioner (samme atomicitetskrav som §A2.1's friskhed).

Alle tre settings-typer (`SourceSettings`, `EoRowPolicy`, `DocumentRenderSettings`) er NOMINELLE med
deres projektor som eneste konstruktør, så hele `AppSettings` ikke kan flyde ind som struktur-supersæt
og indføre en afhængighed, der ikke bumper settingsrevisionen.

## A3. Toggle-guards for betingede felter

Når et felt i UI vises betinget af et toggle, et valg eller en anden brugerbeslutning, skal den renderer der kan udskrive feltet have en tilsvarende guard.

Acceptable mønstre:

1. Sektionsniveau:
   - engine/projection returnerer autoritativt `beregnes = false`
   - rendereren undertrykker hele sektionen
2. Feltniveau:
   - rendereren har en eksplicit `if`-guard før værdien skrives

Det er ikke acceptabelt at indføre parallel masking eller skjult data-mutation i entry-pointet kun for dokument-output.

Manglende guard er en kritisk fejl, fordi stale værdier ellers kan udskrives i et tillidskritisk dokument – uanset kanal.

## A4. Semantisk fravalg

Hvis en delberegning er semantisk fravalgt i det autoritative beregningslag, må dokument-laget ikke genindføre den via visningsvalg.

Det gælder både:

- sektioner
- fradragslinjer
- mellemregninger
- bilag
- andre afledte visninger

Et visningsvalg er et visningsønske, ikke en ret til at overstyre semantisk fravalg.

## A5. Runtime-fejl under download

1. Hvis download var korrekt gated, men selve dokument-genereringen fejler ved runtime, er det en systemteknisk fejl.
2. Brugeren må ikke mødes af en `BugReportButton` inline i sideflowet eller i en download-dialog.
3. Fejlen routes via den centrale fejlrapportering jf. `error-contract.md`.

Lokale fejlbeskeder må kun bruges til de forventelige udfald, brugeren ikke kunne forudse af knappens
tilstand: et stale-afbrud og DEV-specifik dev-server-nedetid. Uventede runtime-fejl under en godkendt
download er systemfejl.

En GATE-blokering er udtrykkeligt IKKE en lokal fejlbesked. En deaktiveret download-knap svarer aldrig
med tekst – årsagen har én kanal, knappens tooltip ved hover – og det gælder også, når blokeringen først
opdages under aktiveringen. Se `page-component-contract.md` §11.1, som ejer reglen.

### A5.1 Gate-årsagens fire klasser (normativ)

Tooltippets tekst afgøres af årsagens `kind`, aldrig af dens `message` (som altid er den interne
forklaring) og aldrig af den flade, der tegner knappen. `resolveDocumentGateTooltip` er den ENE oversættelse.

| `kind` | Brugertekst | Hvornår |
|---|---|---|
| `page-errors` | «Opgørelse kan ikke hentes, når der er fejl ovenfor» | Blokeringen skyldes fejl, siden ALLEREDE viser i sin egen fejl-/advarselsboks |
| `invalid-input` | «Fejl i indtastning» | Mindst ét rødt felt blokerer |
| `missing-input` | «Indtastning mangler» | Tomme påkrævede felter, eller en beregning der ikke kan dannes |
| `specific` | årsagens besked, ordret | Præcis ÉN felt-/rækkenavngiven årsag med konkret tekst |

**Prioritet ved flere årsager:** `page-errors` → `invalid-input` → `missing-input` → `specific`.

- `page-errors` vinder alt: er fejlen synlig i boksen, er henvisningen dertil det, brugeren skal læse –
  også når en af de underliggende fejl kunne navngives (brugerbeslutning 2026-08-13: forudsigelighed over
  handlingsanvisning). Klassen må KUN bruges, når fejlen faktisk gengives på siden; en snapshot- eller
  invariantblokering uden garanteret fejlrække må den ikke dække.
- `invalid-input` slår `missing-input`: noget forkert er mere akut end noget uudfyldt.
- `specific` er LAVEST rangerende. Er en anden klasse også i spil, dækker blokeringen mere end den ene
  fejl, og at fremhæve den ville få brugeren til at tro, den var den eneste.

Klassen skal **udledes** af producentens `DocumentBlockingCause`-liste gennem `classifyBlockingCauses` /
`blockDocumentDownloadFromCauses`, når årsagerne kan opregnes. En gate må ikke hardkode en klasse, den kunne
have udledt – en hardkodet klasse er den fejlkilde, der giver «Indtastning mangler» på et felt, som ER
udfyldt, blot ugyldigt. Se `error-contract.md` §4 for `specific`-allowlisten og hvorfor issue-listens LÆNGDE
ikke er et gyldigt mål.

Gaten skal være uafhængig af mount- og fanetilstand (§A2.1). En klasse må derfor ikke udledes af en
view-models filtrerede visningsliste, men af gatens egen rene projektion.

#### Årsagens form bestemmer klassen (`classifyBlockingCause`)

Skelnen er brugerens, formuleret 2026-08-15 og gældende for HELE programmet – ikke kun for downloadknapper:
«Fejl i indtastning» bruges, når der ER indtastet noget, men indtastningen er forkert (feltet får rød ring,
uanset om årsagen er format eller en grænse); «Indtastning mangler», når en indtastning mangler.

`classifyBlockingCause` (`src/document/layout/documentGateTypes.ts`) er den ENE oversættelse fra
årsagsform til klasse, og switchen er udtømmende – en ny `scope` giver en compile-fejl frem for at arve en
default:

| `scope` | Klasse | Hvorfor |
|---|---|---|
| `field` | `invalid-input` | En `FieldIssue` er afsluttet input, der blev afvist (§1.6) – der ER indtastet noget |
| `row` | `invalid-input` | Rækkeækvivalenten til `field`; bærer samme røde markering |
| `missing` | `missing-input` | Et tomt påkrævet felt |
| `unavailable-calculation` | `missing-input` | Input er komplet og gyldigt, men beregningen kan ikke dannes; brugerens handling er at udfylde mere |
| `aggregate` | `kind` på årsagen | Formen alene siger intet – producenten SKAL angive klassen |

`aggregate` er den eneste form, hvis klasse ikke følger af formen: «tabellen har fejl» siger intet om,
hvorvidt cellerne er udfyldt forkert eller slet ikke udfyldt. `kind` er derfor et påkrævet felt, og et
aggregat uden klasse kan ikke konstrueres.

**Håndhævelse.** `document/gate-class-hardcoded-invalid-input` (arkitektur-manifestet) forbyder
`blockDocumentDownloadForInvalidInput` / `invalidInputReason` / den slettede
`blockedProjectionForInvalidInput` uden for en auditeret allowlist, hvor grenen er beviseligt ét-klasset.
Reglen findes efter et brugerfund 2026-08-15: Årslønssidens gate kollapsede hele `tableValidation.errors`
til én hardkodet klasse og svarede «Fejl i indtastning» på en lønrække med komplet periode og intet beløb,
selv om `TableError.issue` allerede skelnede `invalid` fra `partial_period`/`missing_amount`. Samme form
fandtes på Renteberegning. Kontrakten forbød det i forvejen i ord; nu er forbuddet målt.

## A6. Domænespecifikke projektioner

EO- og TAF-fordelt-på-år-projektioner er specificeret i `eo-snapshot-contract.md`. Øvrige domæner skal pege på deres minimale domænekontrakt, fx:

- `aarsloen-contract.md`
- `renteberegning-contract.md`
- `varigemen-contract.md`
- `forsoergertab-snapshot-contract.md`
- `satser-contract.md`

Domænespecifikke projektioner må supplere denne kontrakt, men må ikke svække A1–A5.
De må kun modtage `InputReader` eller en allerede godkendt typed projektion; rå canonical sektioner er ikke en tilladt
genvej.

## A7. Autoritative kilder og lag-topologi

1. `src/document/` er den **kanoniske**, format-agnostiske dokument-kerne og opdelt i:
   - `src/document/model/` – blokalgebra, `DocumentComposer` og central modelrenderer.
   - `src/document/writer/` – intern render-target-grænse; må ikke importeres af generatorer.
   - `src/document/layout/` – kanalneutral tabelmodel (`tableSpec.ts`), tekst-/format-utils, fælles layoutværdier, helpers, brevhoved-mapping, gate-typer og dokument-options. Mappen må ikke indeholde en Word↔PDF-bro eller importere en konkret tabelkanal.
   - `src/document/generators/` – én generator (+ evt. `sections/`) pr. domæne (`*Document.ts`).
   - `src/document/definition/` – dokument-livscyklussens kerne: `DocumentDefinition`-kontrakten, katalogfabrikken,
     resultat-algebraen, beskedlaget og den ene afvikling (`documentLifecycle.ts`). Indeholder INGEN definitioner og
     kender ingen apps settings.
   - `src/document/runtime/` – hovedappens composition root (`DocumentExecutionEnvironment` + React-grænsen).
     Standalone MinProcesrente komponerer sit eget i `src/apps/minprocesrente/document/`.
   - `src/document/service/` – runtime-fejlporte (`documentRuntimeFailure.ts`). Lazy-loading ejes af den
     enkelte definitions `loadRenderer`, så der findes ingen parallel loader-registrering. Laget ejer IKKE
     afviklingen; den ligger i `definition/documentLifecycle.ts`.
   - Dokumentdefinitioner placeres ved deres domæne-/generatorgrænse og er eneste ejer af inputdependencies, gate og
     den godkendte inputmodel; de må ikke reduceres til utypede callbacks i service-laget. Kataloget komponeres pr.
     app/route – aldrig som en global `Map` i kernelaget, da det ville kollapse rutens chunkgrænser.
2. De **to kanaler** er rene infrastruktur-implementeringer af `DocumentWriter` og ligger uden for kernen:
   - **PDF-kanalen** i `src/pdf/` (jsPDF): adapter, writer-fabrik, brevhoved-renderer, den direkte `TableSpec`-renderer (`pdfTableRenderer.ts` + `pdfDocumentTableRenderer.ts`) og render-helpers. Kanalen indeholder ingen download-service: også standalone MinProcesrentes tre outputs går gennem den fælles livscyklus.
   - **Word-kanalen** i `src/docx/` (writer + understøttende infrastruktur). Begge kanaler indeholder ingen domænegeneratorer: PDF og Word genbruger den samme `DocumentModel`, som generatorerne bygger gennem `DocumentComposer` (jf. afsnit B).
3. EO-præsentations- og reguleringslogik, der bygger tabel-*data*, hører til i domænelaget og må ikke ligge i et selvstændigt PDF-lag:
   - Regulerings-/lønudviklings-tabeldata: `src/domain/erstatningsopgoerelse/engines/reguleringsPresentation.ts`.
   - Pengeenhed og -algebra: `src/domain/money/money.ts`.
   - EO-model-typer: `src/domain/erstatningsopgoerelse/shared/eoTypes.ts`.
   - Delte EO-helpers (dato-/sats-/pct-utils): `src/domain/erstatningsopgoerelse/helpers/eoSharedUtils.ts`.
   - Lønudviklings-segmentering: `src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts`.
4. Ingen ny generator må oprettes uden for `src/document/generators/`.
5. `DocumentWriter` er den interne semantiske render-target-grænse mellem den centrale
   modelrenderer og kanal-infrastrukturen. Den eksponerer ikke kanalobjekt, cursor eller
   kanalspecifikke koordinater. Semantiske fysiske mål som afstand og stregbredde angives i
   millimeter og oversættes af hver kanal. Generatorer må aldrig importere eller modtage den.

## A8. Datoformat i output (kanal-neutralt)

1. Alle brugersynlige datoer i dokument-output SKAL vises i dansk format: enten kort
   `DD-MM-ÅÅÅÅ` eller langt `d. mmmm åååå`. En rå ISO-dato (`ÅÅÅÅ-MM-DD`) må aldrig nå
   et brugersynligt dokument – i nogen kanal.
2. Datoer formateres ved kilden via de kanoniske formattere (`formatDateShort`/`formatDateLong`,
   dvs. `formatISOToDanish`/`formatIsoDateLong` i `src/utils/dateFormatting.ts`). En generator
   må aldrig skrive en `ISODateString` eller en uformateret dato-streng direkte til en celle
   eller en tekstlinje.
3. Periode-kolonner for standard-løn-tabeller (måned/uge/dag) resolves via den delte
   `resolveStandardLoenPeriodColumns` (`src/domain/aarsloen/standardLoenTableColumns.ts`),
   så `dag`-perioden altid formateres til dansk. Generatorer må ikke duplikere denne
   periode-resolvering lokalt.
4. **Sidste forsvarslinje (kanal-neutral):** Begge kanalers tekst- og tabel-stier router
   gennem det centrale dato-værn `guardDocumentDateText` (`src/document/layout/documentDateGuard.ts`).
   Værnet er IKKE et alternativ til formatering ved kilden; det er et sikkerhedsnet, der
   fanger en stray ISO-dato (valideret token), logger høj-lydt i udvikling (brudt invariant,
   jf. console-politik) og deterministisk omformaterer til dansk `DD-MM-ÅÅÅÅ` i produktion,
   så en utestet lækage-sti aldrig viser brugeren en ISO-dato. Værnet er en ren
   string→string-ombytning uden `Date`/tidszone (samme kalenderdag).

## A9. Stregtegn i output (kanal-neutralt)

1. **Tankestreg er en-dash `–` (U+2013) med mellemrum på begge sider.** Em-dash `—` (U+2014)
   må ikke bruges som tegnsætning i dokumenttekst – jf. AGENTS.md § Sprogpolitik, som er den
   generelle kilde til reglen. Håndhæves repo-bredt af `npm run check:mojibake`.
2. **Pladsholderen for «ingen værdi» er em-dash `—` og forbliver em-dash.** Her er tegnet ikke
   tegnsætning, men et grafisk mærke for en celle/linje uden beløb, og bredden er en del af det
   visuelle udtryk. Kanoniske steder: `eoMoneyText.ts` (`formatEoMoney*`) og
   `sections/opgoerelseSection.ts` («Beregnet krav ..... —», «I alt ..... —»).
   Pladsholderen må ikke bruges til at skjule en ubrugelig værdi, der skulle have blokeret
   download – den grænse ejes af A2/A5.1 og er dækket af
   `src/__tests__/domain/erstatningsopgoerelse/eoDocumentPlaceholderReachability.test.ts`.
3. I PDF-kanalen mapper `PDF_ASCII_FALLBACKS` (`src/document/layout/pdfTextUtils.ts`) både `–`
   og `—` til ASCII `-`, fordi kanalens standardfont ikke bærer stregtegnene. Skiftet fra
   em-dash til en-dash i prosa er derfor visuelt neutralt i PDF, mens Word-kanalen viser
   tegnene som skrevet.

---

# Afsnit B – Komposition og render-target-API

Dette afsnit fastlægger den visuelle og strukturelle standard for Mineos dokument-output, så dokumenterne fremstår ensartede og uden utilsigtede lokale layoutafvigelser.

**Blokmodellen er dobbeltkanal.** `DocumentComposer` bygger én `DocumentModel`; sessionens
renderer afspiller modellen mod én af to interne kanal-targets:

- `createPdfChannelWriter` (`src/pdf/infrastructure/pdfWriter.ts`) – PDF via jsPDF.
- `createDocxWriter` (`src/docx/infrastructure/docxWriter.ts`) – Word via docx.

`defineDocument(...)` bygger hele modellen før sessionen opretter kanal-targetet. Reglerne
gælder derfor begge kanaler, og en kompositionsfejl kan ikke efterlade et delvist renderet
dokument. Generator-entrypointet returnerer et `DocumentArtifact`; kun livscyklussen
(`definition/documentLifecycle.ts`) starter browser-downloaden, og først efter det sidste
friskheds-recheck. Et UI-lag må hverken importere en generator, livscyklussen eller
`triggerDocumentDownload` – håndhævet af AST-reglen `document/lifecycle-single-entrypoint`.

Alle generator-entrypoints defineres med `defineDocument(...)` i
`src/document/generators/documentGeneratorSetup.ts`. Factoryen ejer den faste lifecycle:
komposition af eventuelt vandmærke → eventuelt brevhoved → eventuel titel →
domæneindhold → footer → én samlet rendering med metadata/writer-options → formatkorrekt filnavn.
Generatoren ejer kun sin deklarative opsætning og sin synkrone, kanal-neutrale
`body(document, input)`-callback. En generator må ikke gentage
eller springe dele af denne ydre lifecycle over; reelle variationer angives i definitionen
(fx ingen synlig titel på TAF-grafen).

Ved konflikt internt i kontrakten gælder:

1. Afsnit A for data-/gate-/guard-regler
2. Afsnit B for visuel struktur, teksttyper, tabeller og spacing
3. domænespecifikke regler kun hvor dette afsnit udtrykkeligt giver plads til dem

## B1. Grundregel

1. Layout skal være standardiseret på tværs af dokumenttyper og kanaler.
2. Lokale generatorer må ikke indføre egne spacing- eller tekstmønstre, hvis concernet allerede er dækket af composer-/layoutlaget (`documentModel.ts`, `documentLayoutHelpers.ts`, `tableSpec.ts`, `pdfConfig.ts`).
3. Ensartethed vægtes højere end lokal finjustering.
4. Afvigelser er kun acceptable, når de er nødvendige for korrekt sidebrydning, reel tabelgeometri eller eksplicit dokumenteret domænekrav.

## B2. Kanoniske teksttyper

Følgende teksttyper er de eneste kanoniske bloktyper i Mineo-dokumenter:

1. Dokumenttitel
2. Sektionsoverskrift
3. Underoverskriftsfamilie
4. Brødtekst (ren tekst / mixed normal+fed)
5. Venstre/højre-oplysningslinje
6. Tabel

Underoverskriftsfamilien har præcis to kanoniske typer:

1. Fed underoverskrift
2. Understreget underoverskrift

De to typer er ligestillede i layoutmæssig forstand. Deres fælles adfærdsregler er defineret i B4.

De adskiller sig kun ved deres visuelle markering:

1. Fed underoverskrift renderes med fed skrift
2. Understreget underoverskrift renderes med understregning

Generatorer må ikke indføre lokale mellemformer eller pseudo-underoverskrifter for de samme formål.

Generatorer må ikke opfinde ekstra lokale tekstkategorier for de samme formål.

> **Bemærkning:** `writeNormalThenBoldLine()` er en variant af brødtekst (type 4), der skriver normal tekst efterfulgt af fed tekst på samme linje. Den er kanonisk og hører under brødtekst-kategorien – ikke en selvstændig type.

## B3. Kanoniske composer-/render-target-API'er

Hver teksttype har én primær, gyldig kompositionsvej via `DocumentComposer`. Den centrale
modelrenderer mapper derefter hver bloktype til den tilsvarende interne `DocumentWriter`-metode:

| Formål | Kanonisk API | Bemærkning |
|--------|---------------|------------|
| Dokumenttitel | `document.writeTitle()` | Eneste gyldige titel-API |
| Sektionsoverskrift | `document.writeSectionHeader()` | Bruges ved egentlige sektionsskift |
| Fed underoverskrift | `document.writeBoldSubheader()` | Kanonisk basis-API; standard-followup er targetets observerbare keep-together garanti |
| Fed underoverskrift kun hvis der følger indhold | `document.writeBoldSubheaderIfContent()` | Implementerer B4's regel: en underoverskrift må ikke stå alene uden efterfølgende indhold |
| Fed underoverskrift + ét tekstafsnit | `document.writeBoldSubheaderWithWrappedText()` | Foretrækkes når underoverskrift og ét efterfølgende tekstafsnit skal holdes atomisk samlet |
| Understreget underoverskrift | `document.writeUnderlinedSubheader()` | Kanonisk basis-API; standard-X er centralt renderer-ejet |
| Brødtekst | `document.writeWrappedText()` | Standard for almindelig fritekst |
| Fed brødtekst | `document.writeBoldWrappedText()` | Variant af brødtekst til hele tekstblokke med fed vægt |
| Fortsat brødtekst uden trailing spacing | `document.writeWrappedTextContinued()` | Kun ved bevidst fortsættelse af samme logiske blok |
| Mixed normal+fed på én linje | `document.writeNormalThenBoldLine()` | Til formler og linjer med blandet vægt; ikke en selvstændig teksttype |
| Venstre/højre-oplysningslinje | `document.writeLeftRightText()` | Standard for key/value-, formel- og beløbslinjer |
| Tabel | `document.addTable(spec)` | Eneste gyldige generator-API til egentlige tabeller; hvert kanal-target ejer `renderTable(spec)` |

Hvis underoverskrifter kræver conditional rendering eller atomisk sammenkædning med efterfølgende indhold, skal dette løses centralt i writer/helper-laget. Generatorer må ikke reimplementere disse regler lokalt.

`standard-followup-height` er ikke én offentlig konstant. Det er writerens observerbare garanti for, at underoverskrift og første meningsbærende indholdsblok ikke adskilles af sideskift. De konkrete minimumshøjder ejes af writer-laget og dets tests.

Generatorer kan ikke angive en lokal followup-højde. Overskrifters keep-together-højde ejes af det interne
writer-lag, som kender den konkrete kanal. Kræver en ny bloktype en anden højde, skal behovet udtrykkes som en
navngiven blokintention i modellen frem for som et råt mål fra generatoren.

`writeUnderlinedSubheader()` bruger altid rendererens centralt definerede standard-X-position.
Generator-API'et modtager ikke en X-koordinat; en reel afvigelse kræver derfor en navngiven
blokintention frem for et råt mål.

Hvis en venstre/højre-oplysningslinje kræver eksplicitte linjeskift i højrekolonnen, skal også dette håndteres centralt i writer-laget. Generatorer må ikke splitte værdien lokalt og derefter reparere spacing eller Y-forløb med `advanceY(...)`, tom venstre kolonne eller anden ad hoc layoutlogik.

Hvis en generator har behov for en hel tekstblok i fed som advarsel, note eller anden fremhævet brødtekst, skal dette løses via en central brødtekst-variant i writer-laget. Generatorer må ikke omkring et enkelt `writeWrappedText()`-kald sætte font manuelt og derefter nulstille den igen.

Det er ikke tilladt at:

- sætte font manuelt og skrive tekst direkte som erstatning for `writeTitle`, `writeSectionHeader`, `writeBoldSubheader` eller `writeUnderlinedSubheader`
- implementere lokale pseudo-overskrifter via `doc.text(...)` + egen spacing
- bruge tabelrendereren til indhold som semantisk er almindelig tekst

## B4. Font og semantik

Teksttyperne har fast semantik:

1. `writeSectionHeader()`
   Bruges til hovedafsnit eller markante sektionsskift i dokumentet.

2. Underoverskriftsfamilien
   Bruges til underafsnit og markerede delafsnit under en sektion.
   Må ikke bruges som ren spacing-mekanisme.
   De to typer er layoutmæssigt ligestillede og følger samme centrale invariants for:
   - afstand over underoverskriften
   - afstand under underoverskriften
   - sidebrydningsregler
   - undertrykkelse ved tomt afsnit
   - central styring af spacing og layoutinvariants
   Begge underoverskriftstyper følger disse fælles regler:
   - de må kun renderes, hvis der følger mindst én meningsbærende indholdsblok
   - de skal holdes samlet med den første meningsbærende indholdsblok efter underoverskriften
   - de må ikke stå alene nederst på en side uden efterfølgende indhold i samme afsnit

3. Meningsbærende indholdsblok
   Omfatter mindst brødtekst, venstre/højre-oplysningslinjer, mixed normal+fed-linjer, tabeller og andre kanoniske tekstblokke, der reelt udgør afsnittets indhold.
   Tom spacing, tomme labels eller tekniske placeholders er ikke meningsbærende indhold.

4. `writeWrappedText()`
   Bruges til forklarende tekst og almindelige linjer uden højre kolonne.

5. `writeLeftRightText()`
   Bruges til oplysningslinjer, formler og beløbslinjer, der ikke skal i tabel.

### B4.1 Brødtekst som typografisk baseline

Brødtekst er den kanoniske typografiske baseline for almindeligt dokument-indhold.

Det indebærer, at følgende writer-API'er skal bygge på samme grundtypografi som brødtekst og kun afvige med det minimum, der er nødvendigt for deres formål:

1. `writeWrappedText()`
2. `writeBoldWrappedText()`
3. `writeWrappedTextContinued()`
4. `writeNormalThenBoldLine()`
5. `writeLeftRightText()`

Den fælles baseline omfatter mindst:

1. samme font family
2. samme fontstørrelse
3. samme standardtekstfarve
4. samme normale line-height
5. samme grundlæggende tekstflow/wrapping-princip, hvor layouttypen tillader det

Tilladte variationer over brødtekst-baselinen er kun:

1. fjernelse af trailing spacing ved bevidst fortsættelse af samme logiske blok
2. lokal vægtændring i hele tekstblokke eller dele af en linje
3. venstre/højre-kolonneopsætning, alignment og anden minimal layoutlogik, der er nødvendig for oplysningslinjer, formler eller beløbslinjer

Det er ikke tilladt at lade disse writer-API'er udvikle egne lokale typografiske systemer med særskilt fontstørrelse, særskilt linjehøjde eller andre frie visuelle regler, hvis concernet kan bæres af brødtekst-baselinen.

Hvis indholdets semantik er uklar, skal generatoren vælge den eksisterende teksttype, der bedst matcher brugerens læseoplevelse, frem for at opfinde et lokalt layoutmønster.

## B5. Spacing-regler

### B5.1 Omkring underoverskriftsfamilien

1. Afstand over fed og understreget underoverskrift styres centralt og skal være identisk.
2. Afstand under fed og understreget underoverskrift styres centralt og skal være identisk.
3. En generator må ikke lægge ekstra manuel topafstand eller bundafstand omkring en underoverskrift for at "få det til at se rigtigt ud".
4. Hvis der allerede er opnået spacing via den foregående kanoniske blokovergang, skal underoverskriften stadig ende med den centrale standardafstand og ikke mere.
5. Hvis spacing eller sidebrydningsadfærd ændres for den ene underoverskriftstype, skal den anden automatisk følge med via samme centrale invariant.
6. Hvis der opleves behov for lokal kompensation omkring én af underoverskriftstyperne, er det et arkitekturproblem i writer/helper-laget og skal løses centralt dér.
7. Eventuelle options til at undertrykke topspacing må kun bruges, når underoverskriften bevidst skal stå direkte efter en sektionsoverskrift eller tilsvarende kanonisk header-kontekst.

### B5.2 Mellem almindelige tekstblokke

1. Brødtekst og venstre/højre-oplysningslinjer bruger writerens indbyggede line-height og trailing spacing.
2. Generatorer må ikke kompensere for standard line-height med lokale negative `advanceY(...)`, medmindre det er en veldokumenteret teknisk undtagelse.
3. Et tilbagevendende anti-mønster i venstre/højre-oplysningslinjer er lokal `value.split('\n')` efterfulgt af manuel Y-korrektion for at få fortsættelseslinjer til at "sidde rigtigt". Det skal betragtes som en afvigelse og erstattes af central writer-adfærd.

### B5.3 Mellem sektioner

1. Mellemrum mellem sektioner styres af composerens header-blokke eller af `document.addSectionSpacer()`.
2. Generatorer kan ikke vælge en fri afstand; `DocumentComposer` eksponerer bevidst ingen `addSpacer(height)`.
3. `SECTION_SPACER`, `PDF_BASE_LINE_HEIGHT_MM` og cursor-/Y-helpers er interne render-target-detaljer.
4. Den kanoniske eksplicitte sektionsseparator i en generator er `document.addSectionSpacer()`.

### B5.4 Efter tabeller

1. Tabellen afsluttes med en kanonisk overgang til næste blok.
2. Modelrendereren videresender hele `TableSpec` til kanal-targetet; generatoren modtager ingen cursor og må ikke kompensere for tabelafslutningen.
3. Generatoren må ikke lægge ad hoc ekstra topafstand ind foran næste underoverskrift.

## B6. Spacing-capability

Generatorfladen tilbyder kun den navngivne `document.addSectionSpacer()`. Fri manuel spacing, rå
cursorflytning og lokale followup-højder findes ikke på `DocumentComposer`. Tekniske layoutjusteringer til
sidebrydning eller tabelgeometri ejes af modelrendereren og kanalens interne `DocumentWriter`.

Hvis en generator mangler en overgang, skal behovet løses som en central, semantisk blokintention. En rå
højde må ikke genindføres som genvej.

## B7. Tabeller vs. ikke-tabeller

1. Egentlige tabeller skal beskrives som `TableSpec` og tilføjes via `DocumentComposer.addTable()`.
2. Headerløse 2-kolonne-opstillinger, formler, specifikationer og simple label/værdi-linjer er ikke tabeller og skal komponeres via `DocumentComposer`.
3. En generator må ikke vælge tabelrenderer alene for at få "nem alignment", hvis indholdet semantisk ikke er en tabel.

## B8. Direkte jsPDF-brug

Rå jsPDF-, cursor- og fontprimitiver findes kun inde i PDF-kanalen. De findes ikke på `DocumentComposer`, og
AST-reglerne for generatorgrænsen spærrer imports og adgang ad sideveje. Reglerne nedenfor gælder derfor
kanalimplementeringen; generatorer kan ikke repræsentere disse indgreb.

Direkte skrivning via `doc.text(...)` eller lignende er kun acceptabel efter formålskategori:

1. Den interne tabelrenderer og dens kanal-integration må bruge direkte jsPDF-adgang uden ekstra note.
2. Lavniveau-tegneprimitiver for streger og geometri må bruge direkte jsPDF-adgang uden ekstra note.
3. Almindelig tekst, spacing eller domænetekst må kun bruge direkte jsPDF-adgang, hvis writer/helper-laget mangler en nødvendig evne, og callsite dokumenterer undtagelsen efter B9.

Direkte jsPDF-brug til almindelige tekstblokke er en afvigelse og skal som udgangspunkt fjernes. Direkte jsPDF-adgang giver kun mening inde i PDF-kanalen. Word renderer den samme semantiske `TableSpec` direkte til OOXML; der findes ingen tabelbro. Generatorer skal bygge via `DocumentComposer` frem for at antage en konkret kanal eller importere `DocumentWriter`.

## B9. Undtagelser

Hvis en bevidst afvigelse er nødvendig, skal den dokumenteres kort ved callsite i koden med:

1. hvorfor kanonisk API ikke kan bruges sikkert
2. hvilken konkret layout-risiko afvigelsen håndterer
3. hvad der skal være sandt før afvigelsen kan fjernes igen

Undtagelser må ikke bruges som stilvalg.

## B10. Hvordan generatorgrænsen håndhæves

Reglerne i afsnit B er ikke en tjekliste, en generator skal gennemgås mod. De er enten
**uudtrykkelige** på generatorfladen eller **maskinelt håndhævede**. Dette afsnit siger hvilken af
delene der bærer hver regel, så en fremtidig ændring ikke svækker et værn i den tro, at en manuel
audit fanger resten.

**Uudtrykkelige – båret af `DocumentComposer`s form.** `DocumentComposer`
(`src/document/model/documentModel.ts`) eksponerer udelukkende navngivne semantiske blokke. Der findes
ingen font-, cursor- eller `advanceY`-metode, ingen spacer der tager en højde, og intet
`DocumentWriter`- eller kanalobjekt. En generator har derfor ingen syntaks for:

1. en overskrift uden for de kanoniske metoder (§B3),
2. manuel top-/bundafstand omkring en underoverskrift (§B5.1),
3. forskellig spacing/sidebrydning for de to underoverskriftstyper – begge afvikles af samme
   blokintention i modelrendereren (§B4, pkt. 2),
4. en underoverskrift uden efterfølgende indhold: `writeBoldSubheaderIfContent` tilføjer ingen blok,
   når `hasContent` er falsk, og modelrendereren udleder gaten igen ved render (§B4, pkt. 2),
5. lokal kompensation efter en tabel – generatoren modtager ingen cursor (§B5.4),
6. fri sektionsafstand: `addSectionSpacer()` tager ingen argumenter (§B5.3, §B6).

**Maskinelt håndhævede – båret af AST-regler i `src/__tests__/quality/architecture/`.**

| Regel-id | Håndhæver |
|---|---|
| `document/generator-writer-import-boundary` | Ingen import af `DocumentWriter`, en kanal (`src/pdf/`, `src/docx/`), `renderDocumentModel` eller sessionsfabrikken fra `src/document/generators/**` (§B8). |
| `document/generator-cursor-access-boundary` | Ingen medlemsadgang til cursor-/målprimitiver (`getDoc`, `getY`, `setY`, `advanceY`, `ensureSpace`, `getTextWidth`, `getPageWidth` m.fl.) i generatorlaget. |
| `document/generator-cursor-element-access-boundary` | Samme grænse via bracket-notation, så `writer['getDoc']()` ikke er en sidevej. |
| `document/no-headerless-pseudo-table` | Ingen `hasHeaderRow: false` i generatorlaget – headerløse opstillinger skal komponeres som tekst (§B7). |
| `document/lifecycle-single-entrypoint` | Kun kataloget må importere livscyklus-kernen, og kun livscyklussen må importere fil-I/O – så en download ikke kan startes uden om gaten (afsnit B, indledningen). |
| `document/generator-import-boundary` | Kun en dokumentdefinition må importere en generator; et UI-lag kan ikke nå den uden om definitionens `loadRenderer`. |

**Den ene regel uden mekanisme.** §B3's krav om, at flerlinjede højrekolonner håndteres centralt og
ikke ved lokal `split('\n')`, kan ikke udtrykkes som en AST-regel uden også at ramme legitim
afsnitsopdeling af brødtekst. Den centrale adfærd ligger i `writeLeftRightText` og er dækket af
`pdfWriter.test.ts`. En generator, der splitter en **højrekolonneværdi** lokalt, er derfor stadig en
kontraktovertrædelse, der kun fanges ved læsning. Splitter en generator derimod en **brødtekst** i
afsnit, som hver skrives med `writeWrappedText`, er det kanonisk brug og ikke en afvigelse: det er
måden at få §B5.2's normale afsnitsafstand. Forskellen er hvilket API værdien lander i, og den bør
noteres ved callsite – ikke som en §B9-undtagelse, men så den næste læser ikke forveksler de to.

Ved review af en ny eller ændret generator er det derfor kun to ting, der kræver øjne: den nævnte
`split('\n')`-skelnen, og §B4's semantiske valg af teksttype. Alt øvrigt fejler af sig selv.

---

# Afsnit C – Kilder, testkobling og undtagelser

## C1. Autoritative kilder

- Kanalneutral blokmodel og generator-API: `src/document/model/documentModel.ts` (`DocumentModel`/`DocumentComposer`).
- Intern render-target-grænse: `src/document/writer/documentWriter.ts` (`DocumentWriter`).
- Fælles generator-lifecycle: `defineDocument` i `src/document/generators/documentGeneratorSetup.ts`.
- Eksplicit generationssession: `src/document/documentGenerationSession.ts`.
- PDF-writer-fabrik (kanal): `createPdfChannelWriter` (`src/pdf/infrastructure/pdfWriter.ts`).
- Word-writer-fabrik (kanal): `createDocxWriter` (`src/docx/infrastructure/docxWriter.ts`).
- Word-typografier (navngivne styles): `src/docx/infrastructure/docxStyles.ts`.
- Kanalneutral tabelmodel: `src/document/layout/tableSpec.ts`.
- PDF-tabelrenderer: `src/pdf/infrastructure/pdfTableRenderer.ts` og `pdfDocumentTableRenderer.ts`.
- Word-tabelrenderer: den modulprivate `createDocxTable` i `src/docx/infrastructure/docxWriter.ts` (bevidst ikke eksporteret – kun writeren selv renderer tabeller).
- Word-vandmærke: `src/docx/infrastructure/docxWatermark.ts`.
- Download-entrypoint og livscyklus: `src/document/definition/documentLifecycle.ts` (ét entrypoint, håndhævet af `document/lifecycle-single-entrypoint`). Der findes ingen afviklende dokumentservice og ingen `documentService.ts` – navnet står her som fraværsværn. `src/document/service/` rummer alene runtime-fejlporte og ejer ikke afviklingen (§A7.1).
- Layout-konstanter: `src/document/layout/pdfConfig.ts`.

## C2. Testkobling

Kontrakten er koblet i `contractCoverageMatrix.test.ts` til:

- `src/__tests__/quality/architecture/architectureRules.test.ts` (download-committed-state-grænsen, AST-regel `pdf/download-committed-state`)
- `src/__tests__/document/documentCatalogCompleteness.test.ts` (ét kanonisk katalog med præcis én definition pr. output, §A2a)
- `src/__tests__/document/documentLifecycleMatrix.test.ts` (definitionsuafhængige livscyklus-cases)
- `src/__tests__/document/documentGateMatrix.test.ts` (per-definition gate-cases, med `invalid` og `bounds` som SEPARATE klasser jf. §A2a)
- `src/__tests__/components/pages/Satser.downloadGate.integration.test.tsx` (hele livscyklussen end-to-end gennem den rigtige side og den ægte runtime)
- `src/__tests__/quality/architecture/architectureRules.test.ts` (`document/no-headerless-pseudo-table` og generatorgrænserne)
- `src/__tests__/utils/pdf/pdfTableRenderer.layout.test.ts`
- `src/__tests__/utils/pdf/pdfWriter.test.ts`
- `src/__tests__/docx/docxWriter.test.ts` (Word-kanalens paritet mod det fælles writer-API)
- `src/__tests__/quality/documentDateFormatGuard.test.ts` (datoformat-værnet, §A8)

Word-kanalens indholds-paritet pr. generator er desuden dækket af `src/__tests__/docx/generators/*WordContent.test.ts` (én pr. dokument-generator, kørt gennem den rigtige generator via `wordContentHarness.ts`). Disse verificerer, at samme tekst og tal når `.docx`'en som PDF'en, og knyttes formatvalgsmæssigt til `document-format-contract.md`.

### C2.1 Residual visuel verifikation

Automatiske tests ejer indhold, tal, blokrækkefølge, tabelgeometri, spacing- og sidebrydningsinvariants. De må ikke
erstattes af platformafhængige pixel-goldens: PDF- og Word-rendering afhænger af fontmotor og den konkrete
dokumentrenderer, og en ustabil billedsammenligning ville enten give støj eller kræve tolerancer, som skjuler
reelle layoutfejl.

Ved ændringer i writerne, fonts, layoutkonstanter, tabelrendering, sidebrydning, brevhoved, footer eller vandmærke
skal de seneste repræsentative fler-sidede PDF- og Word-fixtures også kontrolleres visuelt i en rigtig renderer.
Kontrollen omfatter mindst klippet/overlappende tekst, danske tegn, tabelbredder, sideskift, overskriftsbinding,
sidehoved/-fod og læsbarhed. PDF renderes til sidebilleder før inspektion; Word åbnes i en kompatibel Word-renderer.
Kravet er residualt og gælder kun ændringer med fysisk layout-risiko.

## C3. Enforcement

Denne kontrakt skal understøttes af:

1. central adfærd i writer-laget (`documentWriter.ts` + kanal-fabrikkerne)
2. fælles konstanter i `src/document/layout/pdfConfig.ts`
3. writer unit-tests for spacing- og sidebrydningsinvariants
4. quality guards for kendte generator-anti-mønstre
5. generator-/domænetests for trust-kritiske gates og output-specifikke blokeringer
6. det kanal-neutrale dato-værn `guardDocumentDateText` (`src/document/layout/documentDateGuard.ts`), kaldt fra både tabel-rendereren og begge kanalers tekst-normalisering (§A8)

Tekstbaserede quality guards er sekundære sikkerhedsnet. De må ikke erstatte egentlige writer- og domænetests.

Hvis kode og kontrakt divergerer, er det en arkitekturfejl, ikke en stilforskel.

## C4. Kendte undtagelser

- Word-kanalens layout er en oversættelse af de samme blokintentioner til Words afsnitsmodel
  og navngivne typografier. Word ejer selv sideflow, mens overskrifters `keepNext`, atomiske
  tabelrækker og den samlede signaturblok udtrykker de fælles keep-intentioner uden cursor/Y.
  Vandmærke og footer er ikke options eller implicit build-adfærd: deres respektive
  `DocumentBlock` er eneste autoritet i begge kanaler.
- `TableSpec` er ren semantisk data. Kolonnebredde, alignment, dæmpet tone, totalrække og kort
  totalstreg fortolkes direkte af begge kanalrenderere. Fysiske millimetermål er fælles
  layoutintentioner, ikke PDF-only hints. EO-sektionernes store composer-/formatter-contexts er fortsat
  domænelokale og bevidst ikke sammenlagt: en sammenlægning ville kræve byte-identitetsbevis pr. output.
- `satserDocument.ts` inkluderer bevidst ikke journalnr i filnavnet – satser er årsspecifikke og sagsagnostiske.
