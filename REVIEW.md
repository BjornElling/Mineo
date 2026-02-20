# Mineo — Kode-review tracking

**Oprettet:** 2026-02-20
**Senest opdateret:** 2026-02-20 (Fase 2 afsluttet)
**Reviewer:** Claude (senior code reviewer)
**Scope:** Komplet gennemgang af hele kodebasen

---

## Arbejdsgang

1. Reviewer gennemgår en fase og publicerer fund med severity og anbefaling.
2. Bruger retter de fundne problemer.
3. Reviewer godkender rettelserne og markerer fund som `GODKENDT`.
4. Næste fase påbegyndes.

Reviewer opdaterer denne fil ved start og afslutning af hver fase.

---

## Legende

### Fase-status
| Symbol | Betydning |
|--------|-----------|
| ⏳ | Afventer (ikke påbegyndt) |
| 🔄 | I gang — review publiceret, afventer rettelser |
| ✅ | Afsluttet — alle fund godkendt |

### Fund-status
| Status | Betydning |
|--------|-----------|
| `ÅBEN` | Fund publiceret — afventer brugers rettelse |
| `GODKENDT` | Rettelse godkendt af reviewer |
| `ACCEPTERET` | Bekræftet ikke-problem eller accepteret afvigelse |

### Severity
| Severity | Definition |
|----------|------------|
| **Kritisk** | Kan producere forkerte beregninger, datatab eller bryde invarianter |
| **Høj** | Arkitekturfejl, type-usikkerhed eller manglende validering med reelle risici |
| **Medium** | Kompleksitet, duplikering eller manglende tests der hæmmer vedligeholdelse |
| **Lav** | Inkonsistens, oprydning eller mindre forbedringer |

---

## Samlet fremgang

| Fase | Område | Status | Fund (Å/G) |
|------|--------|--------|------------|
| 1 | Schema Foundation | ✅ | 0 ÅBNE / 10 G |
| 2 | Numeriske primitiver | ✅ | 0 ÅBNE / 5 G |
| 3 | Dato-primitiver | ⏳ | — |
| 4 | State & Persistence Core | ⏳ | — |
| 5 | Save/Load Pipeline | ⏳ | — |
| 6 | Beregningsengines — Erstatningsopgørelse | ⏳ | — |
| 7 | Beregningsengines — Rente & Varige Mén | ⏳ | — |
| 8 | Erstatningsopgørelse Support Domain | ⏳ | — |
| 9 | Årsløn & Stamdata Domain | ⏳ | — |
| 10 | Form/Input-kontrakt (hooks & validators) | ⏳ | — |
| 11 | Input-komponenter | ⏳ | — |
| 12 | Tabelkomponenter | ⏳ | — |
| 13 | Side-komponenter — Erstatningsopgørelse | ⏳ | — |
| 14 | Side-komponenter — Øvrige sider | ⏳ | — |
| 15 | Layout, UI & fælles komponenter | ⏳ | — |
| 16 | PDF-generering | ⏳ | — |
| 17 | Config, Settings, Auth & Data | ⏳ | — |
| 18 | Utils — Resterende | ⏳ | — |
| 19 | Testkvalitet (tværgående) | ⏳ | — |

Å = Åbne fund | G = Godkendte fund

---

## Prioriteringsrationale

Faserne er sorteret efter korrekthedsrisiko og afhængighedsorden:

- **Fase 1–3:** Fundamentet. Schemas er sandheden om typer; numerik og dato-logik bruges overalt. Fejl her propagerer til alle beregninger.
- **Fase 4–5:** Data-integritet. Commit/persist-grænsen og save/load-pipelinen er trust-kritiske. Stille datatab er uacceptabelt.
- **Fase 6–9:** Beregningskorrekthed. Engines og domænelogik beregner de endelige tal. Her er fejltolerance nul.
- **Fase 10–12:** Kontraktoverholdelse. Input-kontrakten og keyboard-navigations-kontrakten.
- **Fase 13–15:** UI-korrekthed og arkitekturens overholdelse i komponentlaget.
- **Fase 16:** PDF — output-korrekthed.
- **Fase 17–18:** Periferi og konfiguration.
- **Fase 19:** Testkvalitet — afsluttende tværgående analyse.

---

---

## Fase 1: Schema Foundation ✅

**Rationale:** Zod-schemas er den normative sandhedskilde for typer og runtime-validering (AGENTS.md). Fejl her er type-løgne der propagerer til alle downstream-komponenter.

**Scope:**
- `src/schemas/aarsloenSchema.ts`
- `src/schemas/amountExpressionSchema.ts`
- `src/schemas/eoFileSchema.ts`
- `src/schemas/formSchemas.ts`
- `src/schemas/stamdataSchema.ts`
- `src/schemas/index.ts`
- `src/types/branded.ts`
- `src/types/common.ts`
- `src/types/validation.ts`
- `src/types/persistenceInvariants.ts`
- `src/types/result.ts`
- `src/types/fieldErrors.ts`
- `src/types/deepReadonly.ts`
- `src/types/fileOperations.ts`

---

### Sammenfatning

- Den kanoniske schema-kilde (`formSchemas.ts`) er velfunderet og velforberedt med `.strict()`, branded types og expression-aware beløb. Det er tydeligt at arkitekturen er gennemtænkt.
- Der eksisterer imidlertid to parallelle, forældede type-systemer (`aarsloenSchema.ts`, `stamdataSchema.ts`, `types/common.ts`) der modsiger den kanoniske kilde og introducerer type-løgne.
- `aesAfgoerelserSchema` har cross-field refinements der kan blokere deserialisering — direkte strid med den eksplicitte politik i `formSchemas.ts:760`.
- En regex-bug i `coerceToNumberOrUndefined` medfører at dansk-formaterede tusindtalstal ikke parses korrekt ved legacy-migration.
- To domæne-filer importerer aktivt fra den forældede `types/common.ts` med inkompatible typer.

---

### Fund

**F101** · **Kritisk** · `src/schemas/aarsloenSchema.ts` + `src/schemas/stamdataSchema.ts` + `src/schemas/index.ts`

*Problem:* Begge filer er markeret `@deprecated` men er stadig aktivt re-eksporteret via `schemas/index.ts`. De definerer `AarsloenValues` og `StamdataValues` med fundamentalt anden struktur end de kanoniske definitioner i `formSchemas.ts`:
- `aarsloenSchema.ts`: `feriePct: z.string()`, kolonnebeløb som `z.union([z.string(), z.number()])` — kanon: `percentageDecimal` (number), `tableAmountCellValue` (AmountValue)
- `stamdataSchema.ts`: `skadesdato` i dansk format (dd-mm-åååå), felter som `cprNummer`, `navn`, `adresse` — eksisterer slet ikke i den kanoniske schema

`schemas/index.ts` eksporterer KUN disse deprecated schemas, ikke `formSchemas.ts`. Enhver fremtidig kode der importerer via `schemas/index` eller `@/schemas` vil stiltiende få de forkerte typer.

*Risiko:* Type-løgne ved import fra `schemas/index`. Potentiale for regression hvis legacy-kode genaktiveres.

*Anbefaling:* Slet `aarsloenSchema.ts` og `stamdataSchema.ts` (tjek at ingen produktionskode importerer dem). Opdater `schemas/index.ts` til udelukkende at re-eksportere fra `formSchemas.ts`.

Status: `GODKENDT` — `aarsloenSchema.ts` og `stamdataSchema.ts` er slettet. `schemas/index.ts` re-eksporterer nu udelukkende fra `formSchemas.ts`.

---

**F102** · **Kritisk** · `src/schemas/formSchemas.ts:609–636` (`aesAfgoerelserSchema`)

*Problem:* `aesAfgoerelserSchema` indeholder tre `.refine()`-validatorer der blokerer parsing når:
- `varigeMenAfgorelse === 'Ja'` men `menAfgoerelseDato` er `undefined`
- `midlertidigtEetAfgorelse === 'Ja'` men begge dato-felter mangler
- `endeligtEetAfgorelse === 'Ja'` men begge dato-felter mangler

Dette schema merges ind i `erstatningsopgoerelseSchema` via `.merge()`. I Zod v4 bevares refinements ved merge. `formSchemas.ts:760–761` siger eksplicit: "`.refine()` validering må ALDRIG blokere deserialisering – alt gemt data skal kunne indlæses."

Scenariet er realistisk: en bruger sætter afgørelse til 'Ja', glemmer datoen, gemmer filen, og kan derefter ikke genindlæse den hvis `erstatningsopgoerelseSchema` anvendes ved load-validering.

*Risiko:* Potentielt datatab — brugere kan ikke genindlæse korrekt gemte filer. Direkte brud på AGENTS.md save/load-garanti og den eksplicitte kommentar i kodebasen selv.

*Anbefaling:* Flyt cross-field validation ud af schema og ind i UI-valideringslaget (jf. den eksisterende kommentar ved linje 760). `erstatningsopgoerelseSchema` må ikke have `.refine()` der kan fejle på lovlig persisted data.

Status: `GODKENDT` — `aesAfgoerelserSchema` indeholder ingen `.refine()`-kald. Cross-field validering er korrekt placeret udenfor schema.

---

**F103** · **Kritisk** · `src/types/common.ts`

*Problem:* Filen definerer 5+ typer der er strukturelt inkompatible med de kanoniske Zod-inferred typer fra `formSchemas.ts`:

| Type | `types/common.ts` | `formSchemas.ts` |
|------|-------------------|------------------|
| `StamdataValues` | `journalnr: string` (non-optional), har `cprNummer`, `navn`, `adresse` | `journalnr: string \| undefined`, ingen CPR/navn/adresse |
| `TafPeriodeRow` | `loseFeriedage: string` | `loseFeriedage: number \| undefined` |
| `FerieperiodeRow` | har `feriedage: string` | feltet eksisterer ikke i schema |
| `SvieSmertePeriodeRow` | `fra/til: string` (non-optional) | `fra/til: ISODateString \| undefined` |
| `ErstatningsopgoerelseValues` | mange ISO-dato-felter som `string` | `ISODateString \| undefined` |
| `VarigeMenValues` | `Record<string, never>` (tom) | har reelle felter (fødselsdato, mengrad, beregningsdato) |

To domæne-filer importerer aktivt de forkerte typer:
- `src/domain/debug/eoDebugRegulationCore.ts:8` — importerer `ErstatningsopgoerelseValues, StamdataValues, LoenPaaHelligdage` fra `types/common`
- `src/domain/debug/eoDebugLoenCoreModel.ts:13` — samme
- Deres tests importerer også fra `types/common`

*Risiko:* TypeScript-compileren tillader usikre adgange baseret på forkerte type-antagelser (f.eks. `journalnr` antaget ikke-null). Beregnede debug-modeller kan producere forkerte TypeScript-narrowings.

*Anbefaling:* Migrer `eoDebugRegulationCore.ts` og `eoDebugLoenCoreModel.ts` til at importere fra `formSchemas.ts`. Fjern de konflikterende type-definitioner fra `types/common.ts` (behold utility-types som `AarsloenTableColumnKey`, `TableError`, etc.). Erstat `EoFileData`-interface med type afledt fra `eoFileSchema.ts`.

Status: `GODKENDT` — `types/common.ts` re-eksporterer nu alle form-typer fra `formSchemas.ts` med korrekte strukturer. Ingen inkompatible definitioner tilbageværende. `ValidationResult` og `FormulaEvaluationResult` er fjernet fra både `types/common.ts` og `formSchemas.ts`; alle forbrugere importerer fra den kanoniske `types/validation.ts`.

---

**F104** · **Høj** · `src/schemas/formSchemas.ts:83`

*Problem:* `coerceToNumberOrUndefined` indeholder:
```ts
const cleaned = trimmed.replace(/\\./g, '').replace(',', '.');
```
Regex `/\\./g` matcher en literal backslash efterfulgt af et vilkårligt tegn — IKKE et literal punktum. Hensigten er at fjerne danske tusindtals-separatorer (`.` i `"1.234,56"`). Den korrekte regex er `/\./g`.

Konsekvens for `"1.234,56"`: `.replace(/\\./g, '')` gør ingenting → `.replace(',', '.')` giver `"1.234.56"` → `Number.parseFloat("1.234.56")` giver `1.234` (ikke `1234.56`).

Funktionen bruges som `z.preprocess` i `percentageDecimal`, `nonNegativeInteger`, `dayCount`, `yearInteger`, `loseFeriedageCount`. Fejlen rammer ved legacy-migration af dansk-formaterede string-tal i .eo-filer.

*Risiko:* Stille forkert parsing af dansk-formaterede tal ved filindlæsning. Beregnede beregninger baseret på migrerede procent-værdier kan være faktor 1000 forkert.

*Anbefaling:* Erstat `/\\./g` med `/\./g`. Tilføj en unit-test der verificerer at `"1.234,56"` → `1234.56`.

Status: `GODKENDT` — `formSchemas.ts:59` bruger nu korrekt `/\./g`.

---

**F105** · **Høj** · `src/schemas/amountExpressionSchema.ts:24`

*Problem:* I `normalizeAmountToTwoDecimals`:
```ts
if (!parsed.ok || !parsed.value) return value;
return parsed.value.value;
```
Hvis `parseAmountInput` fejler (returnerer `!parsed.ok`) eller resulterer i `null`, returneres den originale `value` — et potentielt uafrundet tal. Dette bypass-er den 2-decimal normalisering der er normativt krævet (calculation-architecture.md §9).

Eksempel: `value = 1.23456789`. Hvis parseAmountInput fejler internt, returneres `1.23456789` (ikke `1.23`). Downstream beregninger forventer `AmountValue.value` er afrundet til 2 decimaler.

*Risiko:* Beregningsfejl ved kant-cases i beløbsparsing. Brud på arkitekturkontrakten om at `AmountValue.value` altid er 2-decimal normaliseret.

*Anbefaling:* Fallback ved parse-fejl skal være `roundByMethod(value, 2, 'halfAwayFromZero')` — ikke det originale tal. Tilføj test der verificerer at normaliseringen gennemtvinges selv ved parse-fejl.

Status: `GODKENDT` — `amountExpressionSchema.ts:24` returnerer nu `roundByMethod(value, AMOUNT_SCHEMA_PRECISION, 'halfAwayFromZero')` ved parse-fejl.

---

**F106** · **Høj** · `src/schemas/formSchemas.ts:770–773`

*Problem:* `overenskomstFilterSchema` mangler `.strict()`:
```ts
const overenskomstFilterSchema = z.object({
  loenmodtager: optionalString,
  arbejdsgiver: optionalString,
});  // ← mangler .strict()
```
Alle øvrige schemas i filen (og i projektet generelt) bruger `.strict()`. Ukendte felter i dette sub-schema passerer stiltiende igennem ved deserialisering.

*Risiko:* Ukendte felter gemmes og genindlæses uden fejl. Svær at opdage data-drift.

*Anbefaling:* Tilføj `.strict()`.

Status: `GODKENDT` — `overenskomstFilterSchema` har nu `.strict()`.

---

**F107** · **Medium** · `src/types/branded.ts:50–77` + `src/schemas/formSchemas.ts:37–61`

*Problem:* ISO-dato-validering er implementeret to gange med næsten identisk logik:
- `isISODateString()` i `branded.ts` (linje 50–77)
- `validateISODateFormat()` i `formSchemas.ts` (linje 37–61)

Begge parser ISO-strengen manuelt, konstruerer UTC-dato og verificerer round-trip. Eneste forskel: `branded.ts` verificerer `year < 1900 || > 2100`, `formSchemas.ts` gør det samme via `DATE_MIN_YEAR` konstanter.

*Risiko:* Fremtidig divergens hvis én ændres (fx bugfix) men ikke den anden. Er allerede sket: `formSchemas.ts` mangler at tjekke at `parts.length !== 3` (det gør `branded.ts`, men ikke eksplicit — `formSchemas.ts` bruger regex-pre-check i stedet).

*Anbefaling:* `formSchemas.ts`'s `validateISODateFormat` bør delegere til `isISODateString` fra `branded.ts`, eller den kanoniske funktion eksporteres fra `branded.ts` og genbruges i schema-definitionen.

Status: `GODKENDT` — `validateISODateFormat` er nu en simpel wrapper: `(val) => isISODateString(val)`. Duplikeringen er elimineret.

---

**F108** · **Medium** · `src/schemas/formSchemas.ts:105, 123, 174`

*Problem:* Tre schemas er defineret men aldrig brugt:
```ts
const _nonNegativeNumber = ...  // linje 105
const _positiveNumber = ...      // linje 123
const _percentageInteger = ...   // linje 174
```
Prefix `_` indikerer bevidst ubrugt, men de er dead code der fylder i filen.

*Anbefaling:* Slet dem. Hvis de er tiltænkt fremtidig brug, er det en violation af AGENTS.md ("Do not generalize code for hypothetical future reuse").

Status: `GODKENDT` — `_nonNegativeNumber`, `_positiveNumber` og `_percentageInteger` er slettet.

---

**F109** · **Medium** · `src/schemas/formSchemas.ts:770–874` (`loenindkomstAnsaettelsesforholdSchema` + `eoAngivetLoenLoenudviklingSchema`)

*Problem:* Mindst 12 felter er identisk defineret i begge schemas:
`feriePct`, `loenPaaHelligdage`, `saerligFraDatoRegulering`, `loenudviklingBeregningsgrundlag`, `loenudviklingStatistikModel`, `loenudviklingKRLSatstabel`, `loenudviklingManuelNavn`, `loenudviklingManuelTableData`, `offentligLoenType`, `offentligLoenTrin`, `offentligLoenGruppe`, `offentligLoenEkstraGrundloen`, `overenskomstFilter`.

Feltdefinitionerne er duplikeret ord for ord inkl. `z.preprocess(coerceToIntegerOrUndefined, ...)` blokke.

*Risiko:* En ændring (fx. range-justering for `offentligLoenTrin`) skal manuelt synkroniseres i begge schemas. Høj risiko for divergens over tid.

*Anbefaling:* Ekstraher de delte felter til et fælles sub-schema (`loenudviklingOgSatserSchema` eller lignende) og brug `.merge()` i begge.

Status: `GODKENDT` — Delt logik er udtrukket til `createLoenudviklingOgSatserSchema` factory-funktion. Begge schemas bruger den; duplikeringen er elimineret.

---

**F110** · **Lav** · `src/schemas/index.ts`

*Problem:* Filen eksporterer udelukkende de deprecated schemas. Den kanoniske `formSchemas.ts` er ikke med. Filen fungerer som en falsk convenience-indgang.

*Anbefaling:* Opdater `schemas/index.ts` til at re-eksportere det relevante offentlige API fra `formSchemas.ts`. Eller fjern den hvis den ikke bruges som indgangspoint.

Status: `GODKENDT` — Løst som del af F101. `schemas/index.ts` re-eksporterer nu `export * from './formSchemas'`.

---

### Tilfældighedsfund (Fase 1)

**FT-1A** · `types/common.ts` bærer to ansvarsområder: (1) legacy type-definitioner der burde fjernes/konsolideres, (2) utility-types og table-specifikke types der faktisk er nyttige. Filen bør opdeles eller renses — men dette hænger tæt sammen med F103.

**FT-1B** · `types/validation.ts` definerer `ValidationResult` (med `errors: ValidationError[]`). Det samme interface er defineret i `formSchemas.ts:946`. De er strukturelt ens men bruges via separate imports. Konsolidér til én.

**FT-1C** · `result.ts`'s `Result<T, E>` type er veldesignet og bruges i `amountExpressionSchema` (via `parsed.ok`). Ingen fund.

**FT-1D** · `fieldErrors.ts` og `validation.ts` løser overlappende problemer (begge handler om felt-fejl). `fieldErrors.ts` er nyere og mere præcis (source-tracking). `validation.ts`'s `ValidationErrorMap` og `normalizeErrors` bør undersøges for overlap i fase 10.

---

## Fase 2: Numeriske primitiver ✅

**Rationale:** Beløbshåndtering og afrunding er normativt specificeret i `calculation-architecture.md` §9. Afvigelser herfra invaliderer alle beregningsresultater. Skal gennemgås før engines.

**Scope:**
- `src/utils/rounding.ts`
- `src/utils/amountInputUtils.ts`
- `src/utils/expressionAmount.ts`
- `src/utils/formatUtils.ts`
- `src/utils/inputValidation.ts`
- `src/utils/safeComputation.ts`

---

### Sammenfatning

- `rounding.ts` er veldesignet og overholder kontrakten fuldt ud.
- `expressionAmount.ts` bruger BigInt-rationel aritmetik korrekt i overensstemmelse med calculation-architecture.md §9.1.
- `formatUtils.ts` indeholder en duplikeret afrundingsfunktion og accepterer strings som beløbsinput trods eksplicit advarsel — typesignaturen lyver.
- `safeComputation.ts` har et muligt discriminant-mismatch i `safeComputeMultiple` (`success` vs. `ok`).
- `inputValidation.ts`'s `shouldClearField` behandler numerisk `0` inkonsistent.

---

### Fund

**F201** · **Høj** · `src/utils/formatUtils.ts` (`roundHalfAwayFromZero`)

*Problem:* `roundHalfAwayFromZero` er eksporteret fra `formatUtils.ts` men er en ren wrapper rundt om `roundByMethod(value, precision, 'halfAwayFromZero')` — identisk med direkte kald. Duplikeringen skaber en sekundær indgang til afrunding der omgår den kanoniske `rounding.ts`.

*Risiko:* Fremtidig divergens; forvirring om hvilken funktion der er kanonisk.

*Anbefaling:* Slet `roundHalfAwayFromZero` fra `formatUtils.ts`. Forbrugere importerer direkte `roundByMethod` fra `rounding.ts`.

Status: `GODKENDT` — Funktionen er slettet fra `formatUtils.ts`.

---

**F202** · **Høj** · `src/utils/formatUtils.ts` (`parseAmount`)

*Problem:* `parseAmount` accepterer `string | number | AmountValue | undefined`. Typesignaturen legitimerer string-input, men kommentaren i koden siger eksplicit at strings ikke burde forekomme i beregningskontekst — en type-løgn. Strings rammer en `console.warn`-sti i DEV der ikke fanges i produktion. Edge-cases som `String(val)` på ikke-string-typer kan give `"[object Object]"` → `NaN` → `0` uden fejl.

*Risiko:* Stille forkert parsing i produktion. Typesignaturen dækker over en designfejl.

*Anbefaling:* Fjern `string` fra input-typen. Slet string-parsing-grenen. Migrer eventuelle forbrugere til `AmountValue`.

Status: `GODKENDT` — Typesignatur er `number | AmountValue | undefined`. String-grenen og `console.warn` er slettet.

---

**F203** · **Medium** · `src/utils/formatUtils.ts` (`formatPercent`)

*Problem:* Bruger `num.toString().replace('.', ',')` uden forudgående afrunding. `toString()` kan producere videnskabelig notation eller mange decimaler ved float-edge-cases. Resultatet afrundes ikke.

*Risiko:* Visuelt forkert output (fx `"33,333333 %"`, `"1,5e-7 %"`). Inkonsistent med systemets øvrige afrundingskonvention.

*Anbefaling:* Afrund til relevant precision via `roundByMethod` inden formatering. Brug `toFixed(n).replace('.', ',')`.

Status: `GODKENDT` — Bruger nu `roundByMethod(num, 2, 'halfAwayFromZero')` og `toFixed(2)` med trailing-zero-stripping.

---

**F204** · **Medium** · `src/utils/safeComputation.ts` (`safeComputeMultiple`)

*Problem:* `safeComputeMultiple` tjekker `result.success` for early-exit. `Result<T>`-typen i `types/result.ts` bruger `ok` som discriminant (bekræftet via brug i `amountExpressionSchema.ts`). Hvis discriminanten er `ok` og ikke `success`, er tidlig-exit-logikken defekt — fejlede beregninger pusher `undefined` til `results`-arrayet i stedet for at returnere tidligt.

*Risiko:* Stille fejl: fejlede delberegninger samles i stedet for at stoppes. Downstream kan modtage ufuldstændige resultater uden fejlindikation.

*Anbefaling:* Verificer `Result`-typen og ret discriminant-tjekket til `result.ok`. Tilføj test der verificerer early-exit ved fejl.

Status: `ACCEPTERET` — Fejlagtigt fund. `Result<T>` bruger `success` som discriminant (ikke `ok`). `safeComputeMultiple` er korrekt implementeret. `ok`-forvirringen opstod fordi `AmountParseResult` bruger `ok` som separat discriminant i en anden type.

---

**F205** · **Lav** · `src/utils/inputValidation.ts` (`shouldClearField`)

*Problem:* `0` (number) ryddes konsekvent fordi `String(0) = "0"` ikke matcher `/[A-Za-zÆØÅæøå1-9]/`. Designet er dokumenteret (kun 1-9 er gyldige cifre), men gør funktionen uegnet til felter hvor 0 er en lovlig inputværdi. Derudover er `!trimmed || trimmed === ''` redundant.

*Risiko:* Lav — men kan overraske ved brug i numeriske felter med 0-værdier.

*Anbefaling:* Dokumentér eksplicit at funktionen ikke er egnet til numeriske felter med 0-defaultværdi. Fjern den redundante check.

Status: `GODKENDT` — Redundant `trimmed === ''`-check er fjernet.

---

### Tilfældighedsfund (Fase 2)

**FT-2A** · `expressionAmount.ts` mangler en eksplicit kontrakt-kommentar der binder BigInt-implementeringen til calculation-architecture.md §9. Fremtidige udviklere kan fejlagtigt forenkle til float-aritmetik uden at forstå konsekvensen.

**FT-2B** · `safeComputeAsync` og `safeComputeMultiple` i `safeComputation.ts` — det er uklart om disse faktisk bruges i kodebasen. Undersøges i Fase 19.

**FT-2C** · `formatUtils.ts` blander formatering (til UI) og parsing (fra UI). Parsings-funktionerne hører arkitekturelt tættere på schema-laget eller input-komponenterne. Ikke akut, men bør overvejes.

---

## Fase 3: Dato-primitiver ⏳

**Rationale:** Dato-håndtering er kompleks og fejlbehæftet (locale, tidszoner, UTC vs. lokal). Dato-helpers bruges overalt i periodeberegninger. `date-contract.md` er normativ.

**Scope:**
- `src/contracts/date-contract.md` (referencekontrakt)
- `src/utils/dateUtils.ts`
- `src/utils/dateFormatting.ts`
- `src/utils/dateValidation.ts`
- `src/utils/isoDateHelpers.ts`
- `src/utils/utcDayMath.ts`
- `src/utils/periodeBeregning.ts`
- `src/utils/dateRangeErrorMessages.ts`
- `src/domain/dates/dateCommit.ts`
- `src/domain/dates/isoDate.ts`
- `src/utils/insertTodayDate.ts`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 4: State & Persistence Core ⏳

**Rationale:** Commit/persist-grænsen og Zustand-storen er systemets hjerte. Her håndhæves No-Live-Preview-reglen og runtime-dataintegritet (AGENTS.md). Forkert state-håndtering kan medføre implicitte data-overskrivninger.

**Scope:**
- `src/stores/formPersistenceStore.ts`
- `src/contexts/FormPersistenceContext.tsx`
- `src/contexts/AppSettingsContext.tsx`
- `src/contexts/ScrollContainerContext.tsx`
- `src/rowDrafts/types.ts`
- `src/rowDrafts/useRowDrafts.ts`
- `src/utils/serialization.ts`
- `src/utils/persistenceLoadSanitization.ts`
- `src/utils/safeLocalStorage.ts`
- `src/utils/draftNormalization.ts`
- `src/utils/schemaFingerprint.ts`
- `src/config/persistenceDefaults.ts`
- `src/config/persistenceRegistry.ts`
- `src/config/persistenceVersion.ts`
- `src/config/storageManifest.ts`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 5: Save/Load Pipeline ⏳

**Rationale:** Save/load er trust-kritisk — stille datatab er uacceptabelt (AGENTS.md). Preflight-krav, atomicitet, round-trip-garanti og schema-validering ved load skal verificeres eksplicit.

**Scope:**
- `src/utils/fileLoad.ts`
- `src/utils/fileSave.ts`
- `src/utils/fileHelpers.ts`
- `src/utils/fileSystemAccess.ts`
- `src/utils/fileHandleStorage.ts`
- `src/utils/encryption.ts`
- `src/utils/eoConverters.ts`
- `src/schemas/eoFileSchema.ts` (cross-ref fra Fase 1)
- `src/utils/aarsloenTableLegacySanitization.ts`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 6: Beregningsengines — Erstatningsopgørelse ⏳

**Rationale:** Den mest komplekse og korrekthedsrisikable del af kodebasen. Engines skal være rene funktioner uden UI/store/persistence-afhængigheder (calculation-architecture.md §1–2). Fejl her producerer forkerte sluttal.

**Scope:**
- `src/calculation/pipeline/erstatningsopgoerelseAggregationPipeline.ts`
- `src/calculation/policy/erstatningsopgoerelse.policy.ts`
- `src/calculation/useErstatningsopgoerelseAggregation.ts`
- `src/domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationEngine.ts`
- `src/domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationPolicy.ts`
- `src/domain/erstatningsopgoerelse/tafBeregningsEngine.ts`
- `src/domain/erstatningsopgoerelse/tafEngine.ts`
- `src/domain/erstatningsopgoerelse/tafCalculations.ts`
- `src/domain/erstatningsopgoerelse/tafBeregningsenhed.ts`
- `src/domain/erstatningsopgoerelse/tafPerYearDerived.ts`
- `src/domain/erstatningsopgoerelse/tafDaySets.ts`
- `src/domain/erstatningsopgoerelse/tafPeriodConstraints.ts`
- `src/domain/erstatningsopgoerelse/tafArbejdsstatusConfig.ts`
- `src/domain/erstatningsopgoerelse/ferieCalculations.ts`
- `src/domain/erstatningsopgoerelse/periodiseringsMotor.ts`
- `src/domain/erstatningsopgoerelse/periodMerging.ts`
- `src/domain/erstatningsopgoerelse/periodOverlapDetection.ts`
- `src/domain/erstatningsopgoerelse/periodRangeGroups.ts`
- `src/domain/erstatningsopgoerelse/beregningsperiodeTafOverlap.ts`
- `src/domain/erstatningsopgoerelse/offentligeYdelserDerived.ts`
- `src/domain/erstatningsopgoerelse/angivetLoenHelpers.ts`
- `src/domain/erstatningsopgoerelse/aarsloenRowInterval.ts`
- `src/domain/erstatningsopgoerelse/arbejdsdageMaaneder.ts`
- `src/domain/erstatningsopgoerelse/aggregationAdapters.ts`
- `src/domain/erstatningsopgoerelse/reguleringFormulaUtils.ts`
- `src/domain/erstatningsopgoerelse/indtaegtPerioder.ts`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 7: Beregningsengines — Rente & Varige Mén ⏳

**Rationale:** To separate beregningsdomæner med egne engines. Samme krav om renhed og fail-closed adfærd som Fase 6.

**Scope:**
- `src/domain/renteberegning/renteberegningEngine.ts`
- `src/domain/renteberegning/renteEngine.ts`
- `src/domain/renteberegning/rentekravTableModel.ts`
- `src/domain/renteberegning/rentekravRowUI.ts`
- `src/domain/renteberegning/rowEmpty.ts`
- `src/domain/renteberegning/tableDraftRows.ts`
- `src/utils/interestCalculator.ts`
- `src/utils/interestDomain.ts`
- `src/domain/varigemen/varigeMenEngine.ts`
- `src/domain/varigemen/varigeMenCalculations.ts`
- `src/utils/shDageBeregning.ts`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 8: Erstatningsopgørelse Support Domain ⏳

**Rationale:** Støttefiler til det primære beregningsdomæne: initialisering, tabel-modeller, PDF-model, debug-model og valideringslogik. Vigtige for korrekthed og arkitekturgrænser.

**Scope:**
- `src/domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues.ts`
- `src/domain/erstatningsopgoerelse/tableDraftRows.ts`
- `src/domain/erstatningsopgoerelse/rowEmpty.ts`
- `src/domain/erstatningsopgoerelse/rowDateBounds.ts`
- `src/domain/erstatningsopgoerelse/indkomstRowValidation.ts`
- `src/domain/erstatningsopgoerelse/loenudviklingManuelBaseRowValidation.ts`
- `src/domain/erstatningsopgoerelse/loenoplysningerInput.ts`
- `src/domain/erstatningsopgoerelse/readableSummaryMessage.ts`
- `src/domain/erstatningsopgoerelse/eoNummerValidering.ts`
- `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts`
- `src/domain/erstatningsopgoerelse/eoPdfModel.ts`
- `src/domain/erstatningsopgoerelse/tafTableModel.ts`
- `src/domain/erstatningsopgoerelse/svieSmerteTableModel.ts`
- `src/domain/erstatningsopgoerelse/oevrigeKravTableModel.ts`
- `src/domain/erstatningsopgoerelse/ferieTableModel.ts`
- `src/domain/erstatningsopgoerelse/eoDebugBuilderRegistry.ts`
- `src/domain/erstatningsopgoerelse/eoDebugCommon.ts`
- `src/domain/erstatningsopgoerelse/eoDebugContextBuilders.ts`
- `src/domain/erstatningsopgoerelse/eoDebugErstatningsopgoerelseModel.ts`
- `src/domain/erstatningsopgoerelse/eoDebugExecutionContext.ts`
- `src/domain/erstatningsopgoerelse/eoDebugIndkomstModel.ts`
- `src/domain/erstatningsopgoerelse/eoDebugNavigationMap.ts`
- `src/domain/erstatningsopgoerelse/eoDebugRowAggregator.ts`
- `src/domain/erstatningsopgoerelse/eoDebugRowPresentation.ts`
- `src/domain/erstatningsopgoerelse/eoDebugStamdataModel.ts`
- `src/domain/debug/` (alle filer)
- `src/domain/rowId.ts`
- `src/domain/tableRowManagement.ts`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 9: Årsløn & Stamdata Domain ⏳

**Rationale:** Årslønsberegning er input til den samlede erstatningsopgørelse. Duplikering i `src/domain/aarsloen/` vs. `src/domain/calculations/` er en potentiel arkitekturrisiko der skal afklares.

**Scope:**
- `src/domain/aarsloen/aarsloenCalculations.ts`
- `src/domain/calculations/aarsloenCalculations.ts` _(OBS: potentiel duplikering)_
- `src/domain/calculations/satserCalculations.ts`
- `src/domain/calculations/stamdataCalculations.ts`
- `src/domain/calculations/index.ts`
- `src/domain/stamdata/stamdataInitialValues.ts`
- `src/hooks/useAarsloenBeregning.ts`
- `src/hooks/useAarsloenPdfGates.ts`
- `src/utils/aarsloenTableCalculations.ts`
- `src/utils/aarsloenTableValidation.ts`
- `src/utils/aarsloenTableLegacySanitization.ts`
- `src/utils/aarsloenValidation.ts`
- `src/validators/erstatningsopgoerelseValidator.ts`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 10: Form/Input-kontrakt (hooks & validators) ⏳

**Rationale:** `form-contract.md` og `mineo-field-pattern.md` er bindende kontrakter. Hooks implementerer commit/draft-grænsen. Fejl her bryder No-Live-Preview-reglen.

**Scope:**
- `src/contracts/form-contract.md` (referencekontrakt)
- `src/contracts/mineo-field-pattern.md` (referencekontrakt)
- `src/hooks/useFieldBehavior.ts`
- `src/hooks/useDraftField.ts`
- `src/hooks/useFormFieldErrors.ts`
- `src/hooks/useTwoStageInputActivation.ts`
- `src/hooks/usePersistedForm.ts`
- `src/hooks/usePersistedSection.ts`
- `src/hooks/usePersistedActiveTab.ts`
- `src/hooks/useOmregningToggle.ts`
- `src/utils/tableValidationCommon.ts`
- `src/utils/offentligeYdelserTableValidation.ts`
- `src/utils/zodTypeGuards.ts`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 11: Input-komponenter ⏳

**Rationale:** Input-komponenterne implementerer bruger-siden af form-kontrakten. Skal gennemgås for korrekt commit-timing, keyboard-håndtering og validerings-feedback i henhold til kontrakterne.

**Scope:**
- `src/components/inputs/StyledAmountField.tsx`
- `src/components/inputs/StyledDateField.tsx`
- `src/components/inputs/StyledDropdown.tsx`
- `src/components/inputs/StyledFractionField.tsx`
- `src/components/inputs/StyledIntegerField.tsx`
- `src/components/inputs/StyledPercentField.tsx`
- `src/components/inputs/StyledRadioButton.tsx`
- `src/components/inputs/StyledTextAreaBase.tsx`
- `src/components/inputs/StyledTextField.tsx`
- `src/components/inputs/StyledTextFieldBase.tsx`
- `src/components/inputs/StyledToggleSwitch.tsx`
- `src/components/inputs/StyledWeekField.tsx`
- `src/components/inputs/StyledYearField.tsx`
- `src/components/inputs/StyledYearFieldNext.tsx`
- `src/components/inputs/fieldEvents.ts`
- `src/components/inputs/inputKeyFilters.ts`
- `src/components/inputs/InsertTodayDateButton.tsx`
- `src/components/inputs/shared/fingerprintParserSpecs.ts`
- `src/components/inputs/shared/integerRange.ts`
- `src/components/inputs/shared/parserSpec.ts`
- `src/components/inputs/table/TableAmountInput.tsx`
- `src/components/inputs/table/TableDateInput.tsx`
- `src/components/inputs/table/TableDateIsoInput.tsx`
- `src/components/inputs/table/TableDropdown.tsx`
- `src/components/inputs/table/TableIntegerInput.tsx`
- `src/components/inputs/table/TablePercentInput.tsx`
- `src/components/inputs/table/TableTextInput.tsx`
- `src/components/inputs/table/TableWeekInput.tsx`
- `src/components/inputs/table/TableYearInput.tsx`
- `src/components/inputs/table/assignRef.ts`
- `src/components/inputs/table/tableInputContracts.ts`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 12: Tabelkomponenter ⏳

**Rationale:** Tabeller er det primære UI-mønster og implementerer `keyboard-navigation.md`-kontrakten. Grid-core er et centralt abstraktionslag der påvirker al tabeladfærd.

**Scope:**
- `src/contracts/keyboard-navigation.md` (referencekontrakt)
- `src/components/tables/gridCoreContext.tsx`
- `src/components/tables/gridCoreRegistry.ts`
- `src/components/tables/gridCoreTypes.ts`
- `src/components/tables/gridCoreUtils.ts`
- `src/components/tables/gridModel.ts`
- `src/components/tables/gridUxSpec.ts`
- `src/components/tables/useGridCoreController.ts`
- `src/components/tables/tableKeyboardNavigation.ts`
- `src/components/tables/tableNavigationCommon.ts`
- `src/components/tables/tableFocusHelpers.ts`
- `src/components/tables/tableRowFocus.ts`
- `src/components/tables/standardGridStyles.ts`
- `src/components/tables/StandardGridTable.tsx`
- `src/components/tables/StandardDisplayTable.tsx`
- `src/components/tables/StandardLooseTable.tsx`
- `src/components/tables/VirtualizedDisplayTable.tsx`
- `src/components/tables/AarsloenTable.tsx`
- `src/components/tables/BeregnetRenteTable.tsx`
- `src/components/tables/BeregningsperiodeFerieTable.tsx`
- `src/components/tables/FerieperiodeTable.tsx`
- `src/components/tables/InterestRatesTable.tsx`
- `src/components/tables/LoenudviklingManuelTable.tsx`
- `src/components/tables/OevrigeKravTable.tsx`
- `src/components/tables/OffentligeYdelserTable.tsx`
- `src/components/tables/SvieSmerteTable.tsx`
- `src/components/tables/TAFPeriodeTable.tsx`
- `src/components/tables/VarigeMenSatserTable.tsx`
- `src/components/tables/useFerieRows.ts`
- `src/components/tables/useFravaerRows.ts`
- `src/components/tables/useOevrigeKravRows.ts`
- `src/components/tables/useRentekravRows.ts`
- `src/components/tables/useSvieSmerteRows.ts`
- `src/components/tables/useTafRows.ts`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 13: Side-komponenter — Erstatningsopgørelse ⏳

**Rationale:** Den mest komplekse side i applikationen. Samspillet mellem UI, beregning og state skal overholde arkitekturkontrakterne.

**Scope:**
- `src/components/pages/Erstatningsopgoerelse.tsx`
- `src/components/pages/erstatningsopgoerelse/EOberegningTab.tsx`
- `src/components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx`
- `src/components/pages/erstatningsopgoerelse/EODebug.tsx`
- `src/components/pages/erstatningsopgoerelse/EODebugTabel.tsx`
- `src/components/pages/erstatningsopgoerelse/EODebugLoenSections.tsx`
- `src/components/pages/erstatningsopgoerelse/EODebugRegulationSections.tsx`
- `src/components/pages/erstatningsopgoerelse/components/` (alle)

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 14: Side-komponenter — Øvrige sider ⏳

**Rationale:** Øvrige sider gennemgås for arkitekturoverensstemmelse og korrekthed.

**Scope:**
- `src/components/pages/Aarsloen.tsx`
- `src/components/pages/Stamdata.tsx`
- `src/components/pages/VarigeMen.tsx`
- `src/components/pages/Renteberegning.tsx`
- `src/components/pages/Satser.tsx`
- `src/components/pages/Erhvervsevnetab.tsx`
- `src/components/pages/Indstillinger.tsx`
- `src/components/pages/Om.tsx`
- `src/components/pages/OpenEo.tsx`
- `src/components/pages/Test.tsx`
- `src/components/pages/UnsupportedDevicePage.tsx`
- `src/components/pages/LoginPage.tsx`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 15: Layout, UI & fælles komponenter ⏳

**Rationale:** Layout-laget og fælles UI-komponenter gennemgås for arkitekturmæssig isolation og korrekt statshåndtering.

**Scope:**
- `src/components/layout/Container.tsx`
- `src/components/layout/ContentBox.tsx`
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/SideMenu.tsx`
- `src/components/ui/ConfirmationDialog.tsx`
- `src/components/ui/FloatingActionButton.tsx`
- `src/components/ui/LicenseModal.tsx`
- `src/components/ui/Overlay.tsx`
- `src/components/ui/ScrollToTopButton.tsx`
- `src/components/ui/scrollToTopConfig.ts`
- `src/components/shared/visuallyHiddenStyle.ts`
- `src/components/reports/ContentBoxReportDialog.tsx`
- `src/components/errors/BugReportButton.tsx`
- `src/components/errors/ComputationErrorAlert.tsx`
- `src/components/errors/DevtoolsIssueNotice.tsx`
- `src/components/errors/ErrorBoundary.tsx`
- `src/components/errors/ErrorFallback.tsx`
- `src/components/AuthGate.tsx`
- `src/App.tsx`
- `src/main.tsx`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 16: PDF-generering ⏳

**Rationale:** PDF-output er et slutprodukt der bruges i juridiske sammenhænge. Korrekthed og konsistens med beregnede tal er kritisk. Arkitekturoverholdelse (ingen beregninger i PDF-lag) skal verificeres.

**Scope:**
- `src/utils/pdf/pdfConfig.ts`
- `src/utils/pdf/pdfOptions.ts`
- `src/utils/pdf/pdfLoader.ts`
- `src/utils/pdf/pdfWriter.ts`
- `src/utils/pdf/pdfHelpers.ts`
- `src/utils/pdf/pdfFormatters.ts`
- `src/utils/pdf/pdfBrevhoved.ts`
- `src/utils/pdf/sharedPdfUtils.ts`
- `src/utils/pdf/aarsloenPdf.ts`
- `src/utils/pdf/erstatningsopgoerelsePdf.ts`
- `src/utils/pdf/erstatningsopgoerelse/types.ts`
- `src/utils/pdf/erstatningsopgoerelse/sections/loenindkomstSection.ts`
- `src/utils/pdf/erstatningsopgoerelse/sections/offentligeYdelserSection.ts`
- `src/utils/pdf/erstatningsopgoerelse/sections/opgoerelseSection.ts`
- `src/utils/pdf/erstatningsopgoerelse/sections/reguleringSection.ts`
- `src/utils/pdf/erstatningsopgoerelse/sections/shDageSection.ts`
- `src/utils/pdf/erstatningsopgoerelse/sections/sygeferiegodtgoerelseSection.ts`
- `src/utils/pdf/krlPdf.ts`
- `src/utils/pdf/reguleringPdf.ts`
- `src/utils/pdf/rentePdf.ts`
- `src/utils/pdf/satserPdf.ts`
- `src/utils/pdf/shDagePdf.ts`
- `src/utils/pdf/tafFordeltPaaAarPdf.ts`
- `src/utils/pdf/varigeMenPdf.ts`
- `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts` _(OBS: mulig duplikering med `src/utils/pdf/sharedPdfUtils.ts`)_

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 17: Config, Settings, Auth & Data ⏳

**Rationale:** Konfiguration og indstillinger skal holdes adskilt fra forretningslogik. Auth-isolering og GDPR-compliance verificeres. Data-filer (løntabeller) gennemgås for integritet og korrekt import.

**Scope:**
- `src/config/dateRanges.ts`
- `src/config/tableTheme.ts`
- `src/config/version.ts`
- `src/settings/appSettingsParse.ts`
- `src/settings/appSettingsSchema.ts`
- `src/settings/appSettingsStorage.ts`
- `src/auth/auth.ts`
- `src/auth/authConfig.ts`
- `src/data/` (opslagsdata, importerede løntabeller)
- `src/utils/logStorage.ts`
- `src/utils/logger.ts`
- `src/utils/devtoolsMonitor.ts`
- `src/utils/pwaInstallPrompt.ts`
- `src/utils/pwaLaunchQueue.ts`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 18: Utils — Resterende ⏳

**Rationale:** Resterende utility-filer gennemgås for duplikering, ansvarsblanding og manglende konvergens med kanoniske helpers.

**Scope:**
- `src/utils/assertNever.ts`
- `src/utils/bugReport.ts`
- `src/utils/clipboardUtils.ts`
- `src/utils/dataCollection.ts`
- `src/utils/dataValidator.ts`
- `src/utils/errorMessages.ts`
- `src/utils/scrollToDebugRow.ts`
- `src/utils/scrollToSection.ts`
- `src/utils/mui/isFocusVisible.ts`

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Fase 19: Testkvalitet (tværgående) ⏳

**Rationale:** Tværgående analyse af testdækning, teststruktur og -mønstre. Prioriterer dækning af beregninger, save/load-round-trip og validering over UI-tests.

**Scope:** Hele `src/__tests__/` og inline tests i domænelag

**Nøglespørgsmål:**
- Er alle beregningsengines dækket med happy path, edge cases, afrunding og determinisme?
- Er save/load round-trip testet for alle schema-felter?
- Er der tests for fail-closed-adfærd?
- Følger tests de normative mønstre (ingen store/context-afhængigheder i engine-tests)?
- Er der flakiness-risici (timing, snapshot-instabilitet)?
- Er der testfiler der tester implementeringsdetaljer frem for invarianter?

**Fund:**

_Ingen fund endnu — fase afventer start._

---

## Løbende tilfældighedsfund

Observationer der opstår undervejs på tværs af faser, og som ikke hører til et specifikt fund-ID i en fase.

| ID | Opdaget i fase | Observation | Status |
|----|----------------|-------------|--------|
| T001 | Kortlægning | `src/domain/aarsloen/aarsloenCalculations.ts` og `src/domain/calculations/aarsloenCalculations.ts` — to filer med identisk navn i overlappende placeringer. Potentiel duplikering eller arkitekturforveksling. Undersøges i Fase 9. | ⏳ Afventer Fase 9 |
| T002 | Kortlægning | `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts` og `src/utils/pdf/sharedPdfUtils.ts` — potentielt samme ansvar i to filer. Undersøges i Fase 16. | ⏳ Afventer Fase 16 |
| T003 | Kortlægning | `src/components/pages/Test.tsx` — en side der hedder "Test" i produktionskode er mistænkelig. Skal afklares om den er tilgængelig i produktion. Undersøges i Fase 14. | ⏳ Afventer Fase 14 |

---

*Filen vedligeholdes automatisk af reviewer. Opdateres ved start og afslutning af hver fase samt ved hvert godkendt fund.*
