# Mineo – Error- og Debug-kontrakt

**Status:** Gældende arkitektur (runtime-only)
**Type:** Tværgående kontrakt

Dette dokument beskriver den **normative** model for felt-fejl (errors) og debug-visning i Mineo.

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
- `invalidDraft?: string`

`blocksSave` er en commitbarhedsregel, ikke en severity-regel:

- udeladt eller `true` betyder, at fejlen blokerer save
- `false` skal sættes eksplicit for bounds/range-fejl, hvor committed state allerede er canonical og schema-valid
- `severity: 'error'` kan derfor være ikke-save-blokerende

`invalidDraft` er runtime-only og bruges til at genskabe en ikke-committable draft-fejl, fx ved undo/redo. Feltet må aldrig persisteres, bruges til beregning eller indgå i `.eo`.

**Invariants (normative):**
- Errors er **runtime-only** og må aldrig persisteres.
- En `message` må aldrig være tom/whitespace efter normalisering.
- Debug må aldrig “gætte” fejl – den må kun læse modellen.
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

Debug/diagnostik kan læse:
- `useFormFieldErrors(pageKey)` → resolved (aktiv fejl pr felt)
- `useFormFieldErrorsBySource(pageKey)` → rå pr source

### 5.2 Forbudte patterns

- Ingen direkte `sessionStorage` keys til errors.
- Ingen polling for fejl.
- Ingen “free string” field keys.
- Ingen “clear all field errors” fra et input for at skjule andre sources.

---

## 6. Debug-strategier (vælg bevidst)

Der findes to gyldige strategier for debug-visninger:

### A) “Hvad er aktivt lige nu?”
- Brug resolved view: `useFormFieldErrors(pageKey)`
- Matcher typisk brugerens UI (én aktiv fejl)

### B) “Hvor kommer fejlen fra?”
- Brug by-source view: `useFormFieldErrorsBySource(pageKey)`
- Viser input/schema/rule samtidig og gør prioritet synlig

Strategi **B** er normativ default for debug-visninger, medmindre en domænekontrakt eksplicit vælger strategi A.

---

## 7. `BugReportButton` — tilladte placeringer

`BugReportButton` er en fejlrapporteringskomponent til **systemtekniske runtime-fejl**.
Den er ikke beregnet til normale valideringsfejl, manglende brugerinput eller
out-of-range-input, som håndteres via feltfejl og EOBeregningTab-blokering.

### 7.1 Tilladte placeringer

- `ErrorFallback` (ErrorBoundary-flow ved uventede React-komponent-crashes)
- `DevtoolsIssueNotice` (devtools-monitor-flow ved `console.error`-detektion)

### 7.2 Forbudte placeringer

- Som inline-element i normale beregningstabs, inputsider eller resultatvisninger
- I `EODebug` eller `EODebugTabel`
- I “Fejl og advarsler”-sektionen i `EOberegningTab` — hverken ved `fail_closed` med
  `runtime_exception`, `schema_guard` eller `invariant_guard`
- I download-fejl-dialog eller enhver anden dialog som del af normale brugerflows
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

### 8.1 PDF-download-fejl og download-gating

**Download-gating:** Den autoritative definition findes i `src/contracts/pdf-contract.md` §2.

EO-specifik præcisering:
- I EO er det typisk `collectAllDebugRows`, der eksponerer de blokerende feltfejl til brugerfladen.
- `EOBeregningTab` er den centrale visning, hvor disse blokeringer aggregeres og vises.
- EO-specifikke snapshot-invariants og outputblokeringer må gerne give yderligere forklaring i UI, men de må ikke redefinere de tværgående gate-kriterier.

**PDF-download-fejl:** Kan PDF’en alligevel ikke genereres (runtime-undtagelse i
jsPDF-laget), er det en systemteknisk fejl — ikke en brugerrettelig valideringsfejl.

Korrekt håndtering:
- Ingen dialog (`ConfirmationDialog`) vises til brugeren
- Ingen `BugReportButton` vises i UI
- Fejlen logges via `console.error` til devtools-monitor-flowet
- `DevtoolsIssueNotice` håndterer fejlrapporteringsflowet for udviklere

Rationale: Alle forhold der burde forhindre PDF-download bør have været fanget af
validator/invariants der inaktiverede download-knappen. Sker der alligevel en runtime-fejl
under download, er det et systemteknisk problem der ikke kan løses af brugeren — og
brugeren skal ikke præsenteres for en fejlrapporteringsknap som del af sit normale arbejde.

### 8.2 EODebug og EODebugTabel — altid-kan-dannes garanti

EODebug og EODebugTabel **kan altid dannes** fra snapshot-data (clampede værdier).

**Manglende fra- eller til-datoer** på TAF/svie-smerte-rækker er **forventelig adfærd**
(brugeren har ikke udfyldt dem endnu). Det er ikke en systemfejl, og det må ikke:
- Udløse en `BugReportButton` i EODebug
- Forhindre debug-visningen i at dannes
- Klassificeres som runtime-fejl

Validator og snapshot-invariants klassificerer manglende datoer som fejl og viser dem
i EOBeregningTab — ikke i EODebug-visningen.

I validerings-fejl-stien, hvor snapshot ikke har autoritativt engine-output, må debug-laget
ikke lave nye fallback-enginekald for at udfylde svie/smerte-tal, TAF-tal eller andre
delresultater. Debug skal i stedet vise tom/ikke-beregnet tilstand for sådanne felter.

Hvis `debugSnapshot` er `null` (ved `fail_closed` inden engines kørte), vises en passende
tom-/fejltilstand uden at forsøge at rendere beregningsindhold. Dette er forventelig adfærd.

### 8.2a Tabeltyper i EODebug

EODebug må ikke introducere nye ad hoc-tabeltyper i komponenter eller row-builders.

Regler:
- Hvis debug-indhold skal vises som tabel, skal det renderes via en eksisterende, forhåndsdefineret tabeltype.
- For rene visningstabeller i EODebug er den kanoniske tabeltype `StandardDisplayTable`.
- For `StandardDisplayTable` i EODebug er samlet tabelbredde centralt styret til 100 %; kolonnebredder må gerne være automatiske eller sættes manuelt pr. kolonne, men den samlede bredde må ikke overstyres lokalt.
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
- Snapshot-invarianterne `debug:control_mismatch` og `taf_per_year:afrunding_over_100` må både
  vises som systemfejl-rækker i `EOberegningTab` og logges til devtools-monitor-flowet, fordi de
  repræsenterer interne beregningsinkonsistenser der skal kunne indrapporteres. `BugReportButton`
  må fortsat kun vises i `DevtoolsIssueNotice`.
