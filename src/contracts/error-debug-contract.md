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
