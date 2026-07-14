# Mineo – Error- og kontrolkontrakt

**Status:** Gældende arkitektur (runtime-only)
**Type:** Tværgående kontrakt
**Senest verificeret mod kode:** 2026-07-14

Dette dokument beskriver den **normative** model for felt-fejl (errors) og kontrolvisning i Mineo.

Formålet er at sikre:
- deterministisk og auditérbar fejlhåndtering
- type-sikker binding mellem schema og feltidentiteter
- ingen implicitte sidekanaler (ingen polling, ingen browser-storage som event-bus)
- ingen persistence-læk (errors må aldrig gemmes i `.eo` eller sessionStorage)

> Bemærk: Dette dokument beskriver **fejl som data** (diagnostik og UI-state). Det ændrer ikke Form Contract-reglerne om parsing/commit på `onBlur`.

---

## 1. Begreber

### 1.1 Felt-identitet

Et felt identificeres af:
- `pageKey: StorageKey` (fx `stamdata`)
- `fieldName: keyof PersistedSectionMap[pageKey]`

Statiske sagsfelter skal rapporteres gennem typed facader som `useFormFieldErrorReporter`. Dynamiske tabel-/entity-felter må bruge string-baserede keys, men kun via canonical key-builders eller dokumenterede field-key konventioner. Absolut compile-time-sikkerhed gælder derfor ikke for alle dynamiske keys; review skal afvise frie, utestede string-keys.

### 1.2 Fejl-kilde (source)

Et felt kan have flere samtidige fejl, adskilt af `source`:
- `input` – input-komponentens egen parsing/format/range-fejl
- `schema` – schema-/Zod-fejl (runtime-validering)
- `rule` – afledte/cross-field forretningsregler (runtime)
- `invalid-draft` – syntetisk kilde projiceret fra `invalidDrafts` (afsluttet ugyldigt input, `reason: 'invalid'`, jf.
  §3A og `form-contract.md` §2.4). Den er ikke en persisteret `fieldErrors`-entry; read-modellen fletter den ind ved
  læsning med forrang via `resolveActiveFieldError`.

### 1.3 Fejl-severity

- `error` – blokerende (må stoppe beregning/commit afhængigt af kontekst)
- `warning` – informerende (må ikke forveksles med `error`)

---

## 2. Data-model (runtime-only)

Den kanoniske model er:

```
fieldErrors[pageKey][fieldName][source] = FormFieldError
```

Hvor `FormFieldError` mindst indeholder:
- `message: string` (trimmes og normaliseres centralt)
- `severity: 'error' | 'warning'`
- `source: 'input' | 'schema' | 'rule'`
- `blocksSave?: boolean`

`blocksSave` er en commitbarhedsregel, ikke en severity-regel:

- udeladt eller `true` betyder, at fejlen blokerer save
- `false` skal sættes eksplicit for bounds/range-fejl, hvor committed state allerede er canonical og schema-valid
- `severity: 'error'` kan derfor være ikke-save-blokerende

**Ikke-committbart input hører ikke til her.** Et commit-forsøg, der ikke kan parses (ugyldigt format), er **ikke** en runtime-only `fieldError`. Den rå streng skrives i stedet til den persisterede recovery-kanal `invalidDrafts` (jf. `form-contract.md` §2.4 og `persistence-contract.md`). Feltets rød kant + tooltip for parse-fejl er en **afledt** visning af, at feltet har en `invalidDrafts`-entry; selve fejlbeskeden gen-udledes lokalt ved at parse den rå streng. `fieldErrors` bærer derfor kun `input`-fejl, der er `blocksSave:false` (fx range/bounds på en allerede committet værdi), samt `schema`/`rule`-fejl.

**Invariants (normative):**
- `fieldErrors` er **runtime-only** og må aldrig persisteres. (`invalidDrafts` er en separat persisteret kanal og hører under `persistence-contract.md`, ikke her.)
- En `message` må aldrig være tom/whitespace efter normalisering.
- Kontrolvisningen må aldrig “gætte” fejl – den må kun læse modellen.
- UI må aldrig være timing-afhængig: “hvad vises” skal komme fra en deterministisk resolver.

---

## 3. Resolver (deterministisk “aktiv” fejl)

UI vil ofte have behov for “den aktive fejl” pr felt (én fejltekst/tooltip).
Det skal ske via en deterministisk resolver:

Prioritet (normativ):
1. `severity`: `error` før `warning`
2. indenfor samme severity: `sourcePriority` (default: `input → rule → schema`)

Dette er implementeret i `src/types/fieldErrors.ts` via `resolveActiveFieldError`.

---

## 3A. Maskinlæsbar fejlårsag: *ikke udfyldt* vs. *ugyldig værdi* (normativt)

Dette afsnit er tilføjet af greenfield draft/commit-designet (2026-07-14). Det er **normativt** og gælder brugervendte
fejlbokse ("Fejl og advarsler") og enhver blocker, der forklarer, hvorfor et output er blokeret.

### 3A.1 Taksonomi

En blocker/fejl for et afhængigt felt skal bære en **maskinlæsbar årsag** — den må ikke gættes ud fra en beskedstreng:

- **`missing`** — feltet er påkrævet i den aktuelle kontekst, men er tomt (gyldigt/`undefined`). Produceres af den
  påkrævende consumer/domæneprojektion, der kender kravet (dagens domæne-validator-vej, fx "…er ikke udfyldt").
- **`invalid`** — feltets afsluttede tilstand er ikke-committbar (ugyldigt format, `invalidDrafts`, jf.
  `form-contract.md` §2.4). Erstatter dagens generiske `Ugyldig værdi: "<rå tekst>"` fra read-modellen.
- **`range`/`bounds`** (eksisterende, tredje kategori) — parseable men uden for interval; har en gyldig canonical værdi
  og bevarer sin nuværende semantik (`blocksSave:false`, jf. `form-contract.md` §4.4). Hverken `missing` eller `invalid`.

Sondringen mellem `missing` og `invalid` afgøres i den forbrugende projektion, ikke i feltet (jf. `form-contract.md`
§7.3): tom = potentielt `missing`; ikke-tom-men-ikke-committbar = `invalid`.

### 3A.2 Stabil feltidentitet + central skabelon

Hver blocker bærer en stabil feltidentitet (`fieldPath`/`FieldId`), så beskeden altid kan **navngive** feltet — dagens
`invalid-draft`-besked kunne ikke, fordi read-modellen manglede feltidentitet. Beskeden dannes af en **central skabelon**
ud fra `reason` + feltnavn, ikke ad-hoc pr. producent.

Skabelonerne (UI/UX-godkendt 2026-07-14) er kontroltype-tilpassede for `missing` og ensartede for `invalid`:

| `reason` | Kontroltype | Skabelon (feltnavn indsat) |
|---|---|---|
| `missing` | Tekst-/talfelt | `Feltet <navn> er ikke udfyldt` |
| `missing` | Dropdown/valg | `<navn> er ikke valgt` |
| `missing` | Til/fra (toggle/radio) | `<navn> er ikke angivet` |
| `invalid` | Alle | `Der er udfyldt en ugyldig værdi i feltet <navn>` |

Dette er foreneligt med §8.1's konvention ("er ikke udfyldt/angivet/valgt"; aldrig et bart "<felt> mangler") og med
værn-testens forbud mod en vist tekst, der ender på " mangler". Kontroltypen skal derfor være kendt, hvor beskeden dannes;
den udledes af feltets identitet/metadata, ikke af en fri streng.

### 3A.3 Fejlbokse kategoriserer på `reason`

Boks-modellen (i dag `EoRowStatus`/`FormFieldError` med kun `severity`) udvides **additivt**, så en `error`-række også kan
gruppere/formulere efter *manglende* vs. *ugyldig*. Dette bryder ikke `severity`-splittet (error vs. warning) og er
bagudkompatibelt: en manglende `reason` behandles som i dag.

---

## 4. Ejerskab og livscyklus (producer ownership)

### 4.1 Producer-ejerskab

Den komponent/hook der producerer en fejl for `(pageKey, fieldName, source)` **ejer** den fejl.

Det betyder:
- Producenten skal **sætte** fejl når den er aktiv.
- Producenten skal **rydde** fejl når den ikke længere er aktiv.
- Producenten må kun rydde **sin egen** source (må ikke slette andre sources).

### 4.2 Navigation/unmount må ikke rydde committed feltfejl

Når en producer unmount’er pga. faneskift, sideskift eller anden navigation, må dens feltfejl
ikke ryddes automatisk. Ellers mister appen sammenhæng mellem committed input og fejltilstand,
og andre beregningsfaner kan ikke gengive de samme blokkerende fejl deterministisk.

Feltfejl ryddes kun ved:
- eksplicit clear fra den producer der ejer `(pageKey, fieldName, source)`
- autoritative state replacements (fx reset/load/migration), hvor form-laget rydder fejl atomisk

`useFormFieldErrorReporter` må derfor ikke have implicit unmount-cleanup.

Re-mount af en producer med samme `(pageKey, fieldName, source)` erstatter en eventuel eksisterende fejl for den source. Det er producentens normale re-registrering, ikke en autoritativ state replacement.

### 4.3 Autoritative state replacements

Ved autoritative state replacements (fx reset/load/migration) rydder form-laget alle field errors for at undgå “ghost errors”.
Dette sker i `usePersistedForm`/persistence-laget.

---

## 5. API-kontrakt (anvendelse)

### 5.1 Anbefalet API

Producenter bør bruge:
- `useFormFieldErrorReporter(pageKey, fieldName, { source, severity })`

Kontrol/diagnostik kan læse:
- `useFormFieldErrors(pageKey)` → resolved (aktiv fejl pr felt)
- `useFormFieldErrorsBySource(pageKey)` → rå pr source

### 5.2 Forbudte patterns

- Ingen direkte `sessionStorage` keys til errors.
- Ingen polling for fejl.
- Ingen “free string” field keys.
- Ingen “clear all field errors” fra et input for at skjule andre sources.

### 5.3 Fejl-links til andre sider

Når en fejltekst henviser til en anden side, må kun selve sidens brugervendte navn være klikbart. Eksempel: i teksten `Mangler (angiv i Stamdata)` er kun `Stamdata` et link; `Mangler (angiv i ` og `)` er almindelig tekst. Hele fejlteksten må ikke pakkes i ét link eller én klikbar knap.

---

## 6. Strategier for kontrolvisning (vælg bevidst)

Der findes to gyldige strategier for kontrolvisninger:

### A) “Hvad er aktivt lige nu?”
- Brug resolved view: `useFormFieldErrors(pageKey)`
- Matcher typisk brugerens UI (én aktiv fejl)

### B) “Hvor kommer fejlen fra?”
- Brug by-source view: `useFormFieldErrorsBySource(pageKey)`
- Viser input/schema/rule samtidig og gør prioritet synlig

Strategi **B** er normativ default for kontrolvisninger, medmindre en domænekontrakt eksplicit vælger strategi A.

---

## 7. `BugReportButton` — tilladte placeringer

`BugReportButton` er en fejlrapporteringskomponent til **systemtekniske runtime-fejl**.
Den er ikke beregnet til normale valideringsfejl, manglende brugerinput eller
out-of-range-input, som håndteres via feltfejl og EOBeregningTab-blokering.

### 7.1 Tilladte placeringer

- `ErrorFallback` (ErrorBoundary-flow ved uventede React-komponent-crashes)
- `DevtoolsIssueNotice` (devtools-monitor-flow ved `console.error`-detektion)
- Fil-load-preflight-dialogen (`MainLayout`), men **kun** som betinget `extraAction` når preflight
  faktisk fangede en systemteknisk load-fejl (`pendingPreflightBugReportError`). Denne placering er
  påkrævet af save/load-garantierne i `AGENTS.md` (preflight skal tilbyde "Send fejloplysninger") og
  er netop en systemteknisk fejlsti, ikke et normalt beregningsflow.

### 7.2 Forbudte placeringer

- Som inline-element i normale beregningstabs, inputsider eller resultatvisninger
- I `EOInspektion` eller `EOKontrolTabel`
- I “Fejl og advarsler”-sektionen i `EOberegningTab` — hverken ved `fail_closed` med
  `runtime_exception`, `schema_guard` eller `invariant_guard`
- I download-fejl-dialog eller enhver anden dialog som del af **normale, forventelige** brugerflows
  (modsat den systemtekniske load-preflight-fejlsti i §7.1)
- Enhver visning der vises som fast element ved normale og forventelige brugerscenarier

Bemærk:
- `EOberegningTab` må godt vise en systemfejl-række for snapshot-invarianter med systemfejl-semantik.
- Denne række må ikke selv indeholde `BugReportButton`.
- Fejlrapportering skal i stedet ske via devtools-monitor-flowet (`console.error` -> `DevtoolsIssueNotice`).

### 7.3 `fail_closed`-snapshot og BugReportButton

`fail_closed` med `schema_guard` (schema/parsing-fejl) eller `invariant_guard`
(afledt intern datainkonsistens efter vellykket parsing) vises som en neutral
fejlbesked i `EOberegningTab` uden `BugReportButton`.
Brugeren vejledes om at rette manglende felter.

`fail_closed` med `runtime_exception` er en uventet systemfejl. Den logges via
`console.error`/system issue-flowet og skal kunne indrapporteres via det eksisterende
devtools-/bug-report-flow. `EOberegningTab` må højst vise en neutral inline-række uden
`BugReportButton`, og den må ikke selv forsøge at rapportere fejlen igen.

---

## 8. Runtime-fejlbehandling i EO-scope

### 8.1 Dokument-download-fejl og download-gating

**Download-gating:** Den autoritative definition findes i `src/contracts/document-output-contract.md` afsnit A (A2) og
formatvalget findes i `src/contracts/document-format-contract.md`.

EO-specifik præcisering:
- I EO eksponerer den autoritative række-evalueringsmotor `collectAllEoRows` de blokerende
  EO-rækker til brugerfladen og download-gaten.
- `EOBeregningTab` er den centrale visning, hvor disse blokeringer aggregeres og vises.
- EO-specifikke snapshot-invariants og outputblokeringer må gerne give yderligere forklaring i UI, men de må ikke redefinere de tværgående gate-kriterier.
- EO-fejl i "Fejl og advarsler" skal gå gennem et domænenært issue-katalog
  (`src/domain/eoRowEvaluation/eoRowIssueCatalog.ts`) for målrettet brugertekst,
  parent-child-suppression og primært focus target. Row-builderne må fortsat beregne
  status og rå domæneårsag, men Beregning-fanen må ikke have egne label-baserede
  specialtekster for EO-række-fejl.
- Når en EO-række-fejl blokerer download, skal den have navigation-metadata. Linket i
  højre side må vise fane/sektion som overordnet sti, men selve klikhandlingen skal
  først forsøge at scrolle til katalogets konkrete felt-/cellemål (`data-mineo-field-path`
  eller `data-mineo-undo-field-path`) og først derefter falde tilbage til række- eller
  sektionsmål.
- Fejl/advarsler der peger ud af EO-siden, skal sætte både route og konkret inputfane
  før navigationen. Det er ikke nok at navigere til siden, fordi faner er session-persistede
  og ellers kan efterlade brugeren på en tidligere aktiv, men forkert, fane.
- Hvis en overordnet fejl forklarer en afledt fejl, skal den overordnede fejl undertrykke
  den afledte via den deterministiske dependency-graf. Nye målrettede fejltyper skal
  derfor enten have en eksplicit katalogrelation eller en lokal `dependsOn`, hvis de
  kan forårsage afledte fejl i samme visning.
- Hver fejl-/advarselslinje skal være KORT, SPECIFIK og SELVSTÆNDIG: den skal navngive det
  konkrete problem (fx "Til-dato er ikke angivet", ikke "Ikke alle felter udfyldt"; "Beregningsgrundlag
  for sygeferiegodtgørelse er ikke valgt", ikke "Intet valgt") og må ikke bære et `Label:`-præfiks
  (det højrestillede link angiver placeringen). Generiske catch-all-fraser er forbudt som vist
  tekst. To kanoniske mekanismer: (1) en katalog-`summaryText`-gren der returnerer en selvstændig
  streng, eller (2) at row-builderen sætter en selvstændig `message` + `summaryDisplay: 'messageOnly'`.
  `fallbackIssueText` (`${label}: …`) er kun et sikkerhedsnet for ukatalogiserede rækker, ikke
  normalvejen. Værnet er `eoRowIssueCatalogCoverage.test.ts`.
- Et standalone "`<felt> mangler`" som vist tekst er forbudt: det kan læses som om VÆRDIEN er
  forsvundet i programmet, ikke at brugeren mangler at indtaste den. Brug i stedet "er ikke angivet"
  / "er ikke udfyldt" / "er ikke valgt" (eller en form med flere ord, fx "Der mangler en …",
  "mangler at blive angivet"). Værnet (`eoRowIssueCatalogCoverage.test.ts`) afviser en vist tekst,
  der ender på " mangler".
- Fejlens fokus-celle i en periode-/tabelrække vælges ud fra rækkens strukturelle `focusFieldHint`
  (`fra`/`til`/`tilstand`), sat af row-builderen fra valideringsresultatet — IKKE ud fra en
  ordlyd-gætning på beskedteksten (som ikke kan skelne fx en fra-dato efter en cutoff fra en
  til-dato-fejl). Ordlyd-heuristikken (`inferDateColumn`) er kun fallback, når hintet mangler.

**Dokument-download-fejl:** Kan dokumentet alligevel ikke genereres (runtime-undtagelse i
PDF- eller Word-laget), er det en systemteknisk fejl — ikke en brugerrettelig valideringsfejl.
Fejlen routes via `reportSystemIssue(...)` med området `document`.

Korrekt håndtering:
- Ingen dialog (`ConfirmationDialog`) vises til brugeren
- Ingen `BugReportButton` vises i UI
- Fejlen logges via `console.error` til devtools-monitor-flowet
- `DevtoolsIssueNotice` håndterer fejlrapporteringsflowet for udviklere

Rationale: Alle forhold der burde forhindre dokument-download bør have været fanget af
validator/invariants der inaktiverede download-knappen. Sker der alligevel en runtime-fejl
under download, er det et systemteknisk problem der ikke kan løses af brugeren — og
brugeren skal ikke præsenteres for en fejlrapporteringsknap som del af sit normale arbejde.

### 8.2 EOInspektion og EOKontrolTabel — altid-kan-dannes garanti

EOInspektion og EOKontrolTabel **kan altid dannes** fra snapshot-data (clampede værdier).

**Manglende fra- eller til-datoer** på TAF/svie-smerte-rækker er **forventelig adfærd**
(brugeren har ikke udfyldt dem endnu). Det er ikke en systemfejl, og det må ikke:
- Udløse en `BugReportButton` i EOInspektion
- Forhindre kontrolvisningen i at dannes
- Klassificeres som runtime-fejl

Validator og snapshot-invariants klassificerer manglende datoer som fejl og viser dem
i EOBeregningTab — ikke i EOInspektion-visningen.

I validerings-fejl-stien, hvor snapshot ikke har autoritativt engine-output, må kontrollaget
ikke lave nye fallback-enginekald for at udfylde svie/smerte-tal, TAF-tal eller andre
delresultater. Kontrollaget skal i stedet vise tom/ikke-beregnet tilstand for sådanne felter.

Hvis `inspektionSnapshot` er `null` (ved `fail_closed` inden engines kørte), vises en passende
tom-/fejltilstand uden at forsøge at rendere beregningsindhold. Dette er forventelig adfærd.

### 8.2a Tabeltyper i EOInspektion

EOInspektion må ikke introducere nye ad hoc-tabeltyper i komponenter eller row-builders.

Regler:
- Hvis kontrolindhold skal vises som tabel, skal det renderes via en eksisterende, forhåndsdefineret tabeltype.
- For rene visningstabeller i EOInspektion er den kanoniske tabeltype `StandardDisplayTable`.
- For `StandardDisplayTable` i EOInspektion er samlet tabelbredde centralt styret til 100 %; kolonnebredder må gerne være automatiske eller sættes manuelt pr. kolonne, men den samlede bredde må ikke overstyres lokalt.
- Row-builders må ikke opfinde nye tabel-layouts som fritekstblokke, pseudo-tabeller eller specialmarkup, når indholdet semantisk er en tabel.
- Nye tabelbehov skal først vurderes mod de eksisterende tabeltyper; hvis ingen passer, kræver det en eksplicit kontraktændring før implementering.

### 8.3 Generel regel

Al fejlhåndtering der viser `BugReportButton` som del af sideflowet skal overholde §7.
Runtime-fejl der opstår i beregningstabs skal logges via `logError`/devtools-monitor og
routes til eksisterende systemfejl-flow — ikke vises som inline-elementer i normale visninger.

### 8.4 Standardiseret systemfejl-payload

Tekniske fejl der skal kunne fejlsøges og indrapporteres, skal så vidt muligt routes gennem
den centrale helper `reportSystemIssue(...)`.

Formål:
- sikre ensartet payload til devtools-monitor, persisted logs og bug report
- sikre minimumskontrakt for kode, område, revision, evidens og diagnostik
- undgå ad hoc `console.error`-payloads som varierer fra komponent til komponent

Minimum:
- `schemaVersion`
- stabil `kind`/`code`
- `severity`
- kort `userMessage`
- teknisk `context`/`route`
- `area`
- `timestamp`
- `revision` kun når der findes en snapshot-/beregningsrevision
- `evidence`/`diagnostics` med den konkrete tekniske tilstand der er nødvendig for fejlsøgning

Når ingen revision findes, udelades feltet helt. Skriv ikke `revision: undefined`.

Persondata må ikke lægges i payloaden eller i string-felter; loggerens sanitizering er et sikkerhedsnet, ikke den primære kontrakt.
Diagnostics-nøgler bør desuden undgå navne som ligner persondatafelter (`navn`, `email`,
`telefon`, osv.), hvis værdien er teknisk og ikke personhenførbar, da loggerens sanitizering
ellers med vilje kan fjerne feltet.

Devtools-noticen og fejlrapporten læser ikke fra samme retention-lag:
- `DevtoolsIssueNotice` viser kun den aktuelle in-memory devtools-session.
- Fejlrapporten medtager også persisted loghistorik fra IndexedDB og kan derfor indeholde fejl
  som ikke længere vises i den aktuelle notice efter reload eller ny session.

Undtagelse:
- Snapshot-invarianterne `control:sammentaelling_mismatch` og `taf_per_year:afrunding_over_100` må både
  vises som systemfejl-rækker i `EOberegningTab` og logges til devtools-monitor-flowet, fordi de
  repræsenterer interne beregningsinkonsistenser der skal kunne indrapporteres. `BugReportButton`
  må fortsat kun vises i `DevtoolsIssueNotice`.

### 8.5 Tidsstempler og tidszone (normativ)

Tidsstempler i fejl-/diagnostik-flowet har **to lag** med hver sit tidszone-ansvar:

**Lagring (kanonisk instant):**
- Logs og system-issue-payloads lagrer tidspunktet som UTC ISO 8601 via `getTimestamp()`
  (`new Date().toISOString()`). Dette er det kanoniske, entydige instant og MÅ IKKE laves
  om til lokal tid ved lagring. (Felt `timestamp` i §8.4 er netop dette UTC-instant.)

**Præsentation (dansk tidszone):**
- ALT tids-output der vises til brugeren eller sendes videre til udvikleren SKAL formateres
  i dansk tidszone (Europe/Copenhagen) — ikke UTC og ikke en antagelse om maskinens lokale zone.
- Klokkeslæt formateres via `formatCopenhagenTimestampSeconds(date)` (`dateFormatting.ts`).
- Dato-kun output (filnavne, email-emne) formateres via `getTodayCopenhagenISO()` /
  `formatCopenhagenISODate(date)`.
- Dette omfatter mindst: fejlrapportens header-dato og per-fejl-tidsstempler, indlejrede
  ISO-tidsstempler i payloads (jf. `stringifyReportData`), `DevtoolsIssueNotice`-visningen samt
  download-filnavne og skærmprint-filnavne i rapport-/content-box-flowet.

Rationale: Programmet bruges udelukkende af danske brugere i Danmark (én tidszone: Europe/Copenhagen).
Udvikleren skal kunne sammenholde et indrapporteret tidspunkt direkte med brugerens danske klokkeslæt.
At konvertere ét sted — på formaterings-grænsen, hvor rapporten samler UTC-tidsstempler fra lagringen —
holder hele det udvikler-/brugersynlige output i samme zone uden at gøre lagringen flertydig.
