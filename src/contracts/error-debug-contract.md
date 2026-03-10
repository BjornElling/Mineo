# Mineo – Error- og Debug-kontrakt

**Status:** Gældende arkitektur (runtime-only)

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

Dette er compile-time type-sikret. Det skal være umuligt at rapportere en fejl på et ikke-eksisterende felt uden at build’et fejler.

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

### 4.2 Unmount-cleanup (forbud mod orphaned errors)

Når en producer unmount’er, skal den rydde sine fejl for at undgå “orphaned errors”.

Dette er en del af hook-kontrakten i `useFormFieldErrorReporter`.

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

Mineo’s `EODebug` er på nuværende tidspunkt designet til strategi **B**.

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
  `runtime_exception` eller `schema_guard`
- I download-fejl-dialog eller enhver anden dialog som del af normale brugerflows
- Enhver visning der vises som fast element ved normale og forventelige brugerscenarier

### 7.3 `fail_closed`-snapshot og BugReportButton

`fail_closed` med `schema_guard` (forventelig inkonsistens i committed state, fx ved
korrupt `.eo`-fil) vises som en neutral fejlbesked i `EOberegningTab` uden `BugReportButton`.
Brugeren vejledes om at rette manglende felter.

`fail_closed` med `runtime_exception` er en uventet systemfejl. Den logges via
`console.error` og routes til `ErrorFallback`/ErrorBoundary-flowet der allerede
indeholder `BugReportButton`. Fejlen vises ikke som inline-element i `EOberegningTab`.

---

## 8. Runtime-fejlbehandling i EO-scope

### 8.1 PDF-download-fejl og download-gating

**Download-gating:** Download-knappen er aktiv hvis og kun hvis `errors`-listen fra
`collectAllDebugRows` er tom (ingen fejl i felter fra EO-oplysninger eller stamdata).
Snapshot-baserede invariants (`authoritativeBlockingInvariants`, `eoPdfBlockingInvariants`)
bidrager til `systemIssueRows` men blokerer knappen via den samlede fejl-og-advarsler-visning.

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

### 8.3 Generel regel

Al fejlhåndtering der viser `BugReportButton` som del af sideflowet skal overholde §7.
Runtime-fejl der opstår i beregningstabs skal logges via `logError`/devtools-monitor og
routes til eksisterende systemfejl-flow — ikke vises som inline-elementer i normale visninger.
