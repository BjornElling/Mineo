# Mineo — Kode-review tracking

**Oprettet:** 2026-02-20
**Senest opdateret:** 2026-02-21 (Fase 6–19 publiceret — komplet gennemgang)
**Reviewer:** Claude (senior code reviewer)
**Scope:** Komplet gennemgang af hele kodebasen

---

## Arbejdsgang

1. Reviewer gennemgår en fase og publicerer fund med severity og anbefaling.
2. Bruger retter de fundne problemer.
3. Reviewer godkender rettelserne og markerer fund som `GODKENDT`.
4. Næste fase påbegyndes.

Reviewer opdaterer denne fil ved start og afslutning af hver fase.

**Komprimering af afsluttede faser:** Når alle fund i en fase er godkendt, komprimeres fasen: hvert fund reduceres til én linje (`**FXxx** · Severity · Lokation — Rettelse`). Godkendte tilfældighedsfund slettes helt. Åbne tilfældighedsfund beholdes indtil behandlet.

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
| 3 | Dato-primitiver | ✅ | 0 ÅBNE / 8 G |
| 4 | State & Persistence Core | ✅ | 0 ÅBNE / 9 G |
| 5 | Save/Load Pipeline | ✅ | 0 ÅBNE / 9 G |
| 6 | Beregningsengines — Erstatningsopgørelse | 🔄 | 7 ÅBNE / 0 G |
| 7 | Beregningsengines — Rente & Varige Mén | 🔄 | 7 ÅBNE / 0 G |
| 8 | Erstatningsopgørelse Support Domain | 🔄 | 5 ÅBNE / 0 G |
| 9 | Årsløn & Stamdata Domain | 🔄 | 4 ÅBNE / 0 G |
| 10 | Form/Input-kontrakt (hooks & validators) | 🔄 | 4 ÅBNE / 0 G |
| 11 | Input-komponenter | 🔄 | 3 ÅBNE / 0 G |
| 12 | Tabelkomponenter | 🔄 | 2 ÅBNE / 0 G |
| 13 | Side-komponenter — Erstatningsopgørelse | 🔄 | 3 ÅBNE / 0 G |
| 14 | Side-komponenter — Øvrige sider | 🔄 | 4 ÅBNE / 0 G |
| 15 | Layout, UI & fælles komponenter | 🔄 | 2 ÅBNE / 0 G |
| 16 | PDF-generering | 🔄 | 5 ÅBNE / 0 G |
| 17 | Config, Settings, Auth & Data | 🔄 | 1 ÅBNE / 0 G |
| 18 | Utils — Resterende | 🔄 | 1 ÅBNE / 0 G |
| 19 | Testkvalitet (tværgående) | 🔄 | 5 ÅBNE / 0 G |

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

**F101** · Kritisk · `schemas/aarsloenSchema.ts` + `stamdataSchema.ts` + `index.ts` — `aarsloenSchema.ts` og `stamdataSchema.ts` er slettet. `schemas/index.ts` re-eksporterer nu udelukkende fra `formSchemas.ts`.

**F102** · Kritisk · `formSchemas.ts` (`aesAfgoerelserSchema`) — `.refine()`-kald fjernet fra schema. Cross-field validering er korrekt placeret udenfor schema.

**F103** · Kritisk · `types/common.ts` — Slettet fuldstændigt. `ValidationResult` og `FormulaEvaluationResult` fjernet fra `formSchemas.ts`; alle forbrugere importerer fra `types/validation.ts`.

**F104** · Høj · `formSchemas.ts` (`coerceToNumberOrUndefined`) — Regex rettet fra `/\\./g` til `/\./g`.

**F105** · Høj · `amountExpressionSchema.ts` (`normalizeAmountToTwoDecimals`) — Fallback returnerer nu `roundByMethod(value, AMOUNT_SCHEMA_PRECISION, 'halfAwayFromZero')` ved parse-fejl.

**F106** · Høj · `formSchemas.ts` (`overenskomstFilterSchema`) — `.strict()` tilføjet.

**F107** · Medium · `branded.ts` + `formSchemas.ts` (duplikeret ISO-dato-validering) — `validateISODateFormat` er nu en simpel wrapper: `(val) => isISODateString(val)`.

**F108** · Medium · `formSchemas.ts` (dead code) — `_nonNegativeNumber`, `_positiveNumber` og `_percentageInteger` er slettet.

**F109** · Medium · `formSchemas.ts` (duplikerede schema-felter) — Delt logik udtrukket til `createLoenudviklingOgSatserSchema` factory-funktion.

**F110** · Lav · `schemas/index.ts` — Løst som del af F101. Re-eksporterer nu `export * from './formSchemas'`.

### Åbne tilfældighedsfund (Fase 1)

**FT-1D** · `fieldErrors.ts` og `validation.ts` løser overlappende problemer. `validation.ts`'s `ValidationErrorMap` og `normalizeErrors` bør undersøges for overlap i fase 10.

---

## Fase 2: Numeriske primitiver ✅

**F201** · Høj · `formatUtils.ts` (`roundHalfAwayFromZero`) — Slettet fra `formatUtils.ts`.

**F202** · Høj · `formatUtils.ts` (`parseAmount`) — Typesignatur er nu `number | AmountValue | undefined`. String-grenen og `console.warn` er slettet.

**F203** · Medium · `formatUtils.ts` (`formatPercent`) — Bruger nu `roundByMethod(num, 2, 'halfAwayFromZero')` og `toFixed(2)` med trailing-zero-stripping.

**F204** · Medium · `safeComputation.ts` (`safeComputeMultiple`) — `ACCEPTERET`. Fejlagtigt fund: `Result<T>` bruger `success` som discriminant. Implementeringen er korrekt.

**F205** · Lav · `inputValidation.ts` (`shouldClearField`) — Redundant `trimmed === ''`-check er fjernet.

---

## Fase 3: Dato-primitiver ✅

**F301** · Høj · `dateValidation.ts` vs. `branded.ts` — `dateValidation.ts` slettet. Kanonisk `parseISODate` i `branded.ts` er eneste implementation.

**F302** · Høj · `dateValidation.ts` (ansvarsopdeling + lagkrænkelse) — Fil slettet og splittet: `formatISOToDanish` → `dateFormatting.ts`, `validateISODateRange` → `isoDateHelpers.ts`, UI-validering → `dateInputValidation.ts`.

**F303** · Medium · `dateUtils.ts` (`beregnMaanederMellemDatoer`) — Død kode slettet.

**F304** · Medium · `isoDateHelpers.ts` (ansvar og duplikering) — `toNonNegativeInt` → `numberUtils.ts`. `iterateDatesInclusive` har fået kontraktkrævet JSDoc. `DateInterval` samlet i `formSchemas.ts` via `types/calculation.ts`.

**F305** · Medium · `dateUtils.ts` (`minIsoDate`) — Slettet. `BeregnetRenteTable.tsx` bruger nu `minISO` fra `isoDateHelpers.ts`.

**F306** · Medium · `periodeBeregning.ts` (`beregnUgePeriode`) — `isoWeeksInYear(year)` helper indført. Ugegenerering og totaltælling er nu år-aware.

**F307** · Lav · `dateUtils.ts` + `isoDate.ts` + `branded.ts` (`createDate`) — Mønstret udtrukket til `datePrimitives.ts`. Alle tre importerer fra `datePrimitives.ts`.

**F308** · Lav · `dateInputValidation.ts` (`validateDate`) — Død kode slettet.

**R01** · Lav · `numberParsing.ts` (`parsePercentToDecimal`) — Dansk tusindtalsseparator håndteres korrekt via `lastIndexOf`. Tests tilføjet.

**R02** · Lav · `types/table.ts` — `TableRowIssueReason` indført og genbrugt i alle tre reason-aliaser.

### Åbne tilfældighedsfund (Fase 3)

**FT-3B** · `isoDateHelpers.ts` er placeret i `src/utils/` men opererer på `ISODateString` branded types og range-logik tæt på `src/types/branded.ts`. Overvej konsolidering i `src/domain/dates/` (hvor `isoDate.ts` og `dateCommit.ts` allerede bor).

**FT-3D** · `src/domain/dates/dateCommit.ts` er 14 linjer med én funktion. Korrekt og velplaceret, men kan integreres i `isoDate.ts` uden tab af klarhed.

**RT-C** (udskudt) · `src/types/formEvents.ts` + `usePersistedForm.ts` — migrering fra `FormFieldChangeEvent` til `fieldEvents`-kontrakt. Behandles som selvstændigt refactor-step.

---

## Fase 4: State & Persistence Core ✅

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

**F401** · Høj · `src/utils/serialization.ts:131-148` (`deserializeFormValues`) — Alle `console.log`/`console.group`/`console.warn`-kald mangler `DEV`-guard og dumper brugerdata til konsollen i produktion. Risiko: GDPR-lækage af sagsindhold. Anbefaling: fjern kaldene (funktionen er alligevel dead code, se F402).

**F402** · Høj · `src/utils/serialization.ts` — Massiv dead code: `deserializeFormValues`, `preprocessStoredData`, `extractFieldTypes`, `deserializeArray`, `coerceToNumber`, `coerceToInteger`, `coerceToBoolean`, `coerceToISODate` bruges ingen steder i kodebasen. Eneste levende export er `serializeFormValues`. Anbefaling: slet alt andet og reducer filen til `serializeFormValues` alene.

**F403** · Medium · `src/config/persistenceRegistry.ts:30-41` + `src/utils/serialization.ts:91-109` — `nullToUndefinedDeep` og den private `nullToUndefined` er logisk identiske. Duplikering drives af dead code i F402 — løses automatisk ved F402-oprydning.

**F404** · Medium · `src/contexts/FormPersistenceContext.tsx:547` (`clearPageData`) — `setCacheForKey` er listet som dependency men bruges ikke i `clearPageData`-kroppen (`syncSection` kalder det internt, men det tæller ikke). Stale deps-fejl — ufarlig i dag men misvisende. Anbefaling: fjern `setCacheForKey` fra dependency-arrayet.

**F405** · Medium · `src/config/persistenceVersion.ts` — `PERSISTED_DATA_VERSION = '1.0.0'` er statisk og skal bumpes manuelt ved skemaændringer. Systemet beregner allerede `persistenceSchemaFingerprint` men bruger det ikke til sessionStorage-versionering. Glemmer udvikleren at bumpe, ryddes inkompatibel data ikke. Anbefaling: vurder om versionen bør inkorporere fingerprint for automatisk invalidering.

**F406** · Medium · `src/contexts/FormPersistenceContext.tsx:152-215` — `useState`-initializeren er ~65 linjer med sessionStorage-læsning, Zod-parsing, legacy-sanitisering og opbygning af `initPlanRef`. Testunvenlig og svær at isolere. Anbefaling: udtruk til ren hjælpefunktion `loadInitialCache() => { cache, plan }`.

**F407** · Medium · `src/rowDrafts/useRowDrafts.ts:109-114` — `rowErrors`-beregningen er en O(n) validation-loop der køres på hvert render uden memoizing. Anbefaling: wrap i `useMemo([draftRows, config.validateDraftRow])`.

**F408** · Lav · `src/contexts/ScrollContainerContext.tsx:26-31` — DEV-guard `!context` er altid falsk fordi konteksten har et non-null default-objekt. Advarslen kan aldrig trigges. Anbefaling: enten sæt default til `null` og lav korrekt null-check, eller fjern den uvirksomme guard.

**F409** · Lav · `src/utils/schemaFingerprint.ts:23-30` — FNV-1a bruger `charCodeAt` (UTF-16 code units) ikke code points; giver forkerte resultater for surrogate pairs. Anbefaling: tilføj kommentar om ASCII-safe-antagelse eller brug `codePointAt`.

### Tilfældighedsfund (Fase 4)

**FT-4A** · `src/utils/serialization.ts` bærer titlen "Serialization/deserialization layer" men er reelt kun en `serializeValue`-hjælper omgivet af 270 linjer arkæologi. Filnavnet er misvisende. Efter F402-oprydning: sammenlæg med `persistenceRegistry.ts` eller omdøb til `persistenceSerializer.ts`.

**FT-4B** · `src/rowDrafts/` er en top-level mappe med kun 2 filer og er reelt et hook-mønster. Bør flyttes til `src/hooks/rowDrafts/` eller integreres direkte i `src/hooks/`.

**FT-4C** · `FormPersistenceContext.tsx:107` re-eksporterer `FormPersistenceContextValue` — typen eksporteres allerede fra `FormPersistenceContext.types.ts`. Dobbelt-eksport; den ene er overflødig.

**FT-4D** · `src/config/persistenceVersion.ts` er en micro-fil med én streng-konstant. Kan samles i `persistenceRegistry.ts` og eliminere filen.

---

## Fase 5: Save/Load Pipeline ✅

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

**F501** · Høj · `src/utils/fileLoad.ts:240-260` + `src/utils/fileLoad.ts:449-470` — Debug-blokke med `[FILELOAD DEBUG]`-præfix er efterladt uden `DEV`-guard. De logger Zod-fejl og `loenindkomstAnsaettelsesforhold`-nøgler (potentielt sagsindhold) via `logDebug`. Anbefaling: fjern debug-blokkene. Zod-issues rapporteres allerede i `loadIssues`-listen.

**F502** · Høj · `src/utils/fileLoad.ts` — `loadFromFile` og `loadFromFileHandle` deler ~200 linjer identisk kerne (decrypt → normalize → strip → defaults → Zod-parse → issue-rapport). Eneste forskel er filhentnings-mekanisme og `source`-felt. Risiko: divergerende adfærd ved fremtidige ændringer. Anbefaling: udtruk til intern `processDecryptedContainer(decrypted, options)`.

**F503** · Høj · `src/utils/fileHelpers.ts:26` + `src/utils/fileHelpers.ts:68` — `sanitizeFilename` og `generateFilename` mangler TypeScript-typeannoteringer på parametrene (implicit `any`). Filen er `.ts` men opfører sig som `.js` for disse funktioner. Anbefaling: tilføj eksplicitte parametertyper.

**F504** · Høj · `src/schemas/eoFileSchema.ts:30-41` — Endnu en privat `nullToUndefinedDeep`-implementation (fjerde forekomst i kodebasen). Logisk identisk med den kanoniske i `persistenceRegistry.ts`. Anbefaling: importer fra `persistenceRegistry.ts`.

**F505** · Medium · `src/utils/fileSave.ts:627-637` + `src/utils/fileSave.ts:704-714` — Stamdata-basis-gemning til sessionStorage er duplikeret i begge gem-grene (File System API og fallback). Anbefaling: udtruk til hjælpefunktion `saveFilenameBasis(fileData)`.

**F506** · Medium · `src/utils/fileSave.ts` — `mineo_ui_lastSavedFilename` og `mineo_ui_lastSavedFilenameBasis` er sessionStorage-nøgler der ikke er registreret i `storageManifest.ts`. De ryddes ikke af `getAllMineoKeys()` / `clearAllData`. Anbefaling: tilføj til manifestet eller rens eksplicit i `clearAllData`.

**F507** · Medium · `src/utils/encryption.ts:29` — `cachedKey` er et modul-niveau mutable singleton. I test-kontekster kan en forurenet cached key lække på tværs af test-runs. Anbefaling: eksporter `resetKeyCache()` til test-brug eller dokumenter session-scope-antagelsen.

**F508** · Medium · `src/utils/eoConverters.ts:22-27` — `generateRowId()`, `generateOffentligYdelseRowId()` og `generateLoenudviklingRowId()` bruger en delt modul-niveau tæller (`rowIdCounter`) kombineret med `Date.now()`. `generateAnsaettelsesforholdId()` bruger kun timestamp uden tæller. Anbefaling: brug `crypto.randomUUID()` konsekvent for alle ID-generatorer.

**F509** · Lav · `src/utils/fileSave.ts:647-649` — Filnavns-genbrugslogik i fallback-grenen bruger `lastSavedPath.startsWith(currentFilename.split('_')[0])` som fragil heuristik. Kan give false positives. Anbefaling: brug samme stamdata-sammenligning som i File System API-grenen.

### Tilfældighedsfund (Fase 5)

**FT-5A** · `src/utils/fileHelpers.ts` blander tre ansvarsområder: filnavn-hjælpere, browser-I/O og directory-resolution. Directory-resolution-logikken (`resolveDefaultDirectoryHandle`, `getStartInValue`) hører tættere på `fileHandleStorage.ts`. Anbefaling: split filen.

**FT-5B** · `src/utils/eoConverters.ts` hedder "converters" men indeholder udelukkende row-ID-generatorer og initial-row-konstanter. Bør omdøbes til `eoRowFactories.ts` eller `eoTableDefaults.ts`.

---

## Fase 6: Beregningsengines — Erstatningsopgørelse 🔄

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

**F601** · Høj · `src/domain/erstatningsopgoerelse/tafCalculations.ts:31-57` — `calculateTafAntalMaaneder` og `calculateTafAntalMaanederPraecis` accepterer parametrene `_ferieperioder` og `_loseFeriedage` men ignorerer dem komplet (markeret med `_`-prefix). Signaturerne er arkæologi fra en tidligere implementation — de ligner at ferie/løse-feriedage fradrages, men det gør de ikke. Enhver fremtidig kaldende kode der forventer fradrag vil producere forkerte tal. Anbefaling: fjern de ubrugte parametre fra signaturerne og kald-stederne, eller dokumentér eksplicit at måneds-beregning bevidst ikke fradrager feriedage (med reference til `tafBeregningsenhed.ts`-kontrakten der siger det samme).

**F602** · Høj · `src/domain/erstatningsopgoerelse/tafEngine.ts` + `src/domain/erstatningsopgoerelse/tafBeregningsEngine.ts` — To parallelle TAF-engines med overlappende ansvar og divergerende beregningsmodel. `tafEngine.ts` (`buildTafDerived`) beregner per-row uden merge; `tafBeregningsEngine.ts` (`computeTafEngine`) merger overlappende perioder før beregning. Ej klart dokumenteret hvornår den ene vs. den anden bruges, eller om de garanteres at give konsistente totaler. Risiko: brugeren ser per-row-tal fra `tafEngine` der ikke matcher aggregat-tal fra `tafBeregningsEngine` hvis overlappende perioder er indtastet. Anbefaling: dokumentér eksplicit i begge filer hvem der ejer hvad, og tilføj en kommentar der bekræfter at per-row-visning vs. samlet-beregning bevidst er adskilt.

**F603** · Medium · `src/domain/erstatningsopgoerelse/arbejdsdageMaaneder.ts` — `beregnArbejdsdageOgMaaneder` implementerer en manuel day-by-day måneds-optælling (`monthCounts` map, divide by days-in-month) der er semantisk identisk med `optaelMaanederPraecis` i `periodiseringsMotor.ts`. Divergens er mulig ved fremtidige rettelser. `tafPerYearDerived.ts` importerer fra `arbejdsdageMaaneder.ts` og `periodiseringsMotor.ts` bruges fra `tafCalculations.ts` — to stier til (forhåbentlig) samme svar. Anbefaling: konsolidér — `beregnArbejdsdageOgMaaneder` bør delegere til motorens `optaelMaanederPraecis` i stedet for at reimplementere logikken.

**F604** · Medium · `src/domain/erstatningsopgoerelse/tafPerYearDerived.ts:39-47` — `beregnMaanederUdenFridage` afrunder via `Math.round(stats.maaneder * 10_000) / 10_000` (4 decimaler). Dette er et ikke-kanonisk afrundingsmønster — alle andre steder bruger `roundByMethod(..., n, 'halfAwayFromZero')`. Risiko: inkonsistent afrundingsadfærd ved halvtalspræcision. Anbefaling: brug `roundByMethod(stats.maaneder, 4, 'halfAwayFromZero')`.

**F605** · Medium · `src/domain/erstatningsopgoerelse/reguleringFormulaUtils.ts:21` — `const formatPercentFixed2 = formatPercentFixed2Shared;` er en redundant lokal alias der blot videresender den importerede funktion. Tilføjer ingen klarhed. Anbefaling: brug `formatPercentFixed2Shared` direkte i de kald der bruger `formatPercentFixed2`, og fjern alias-linjen.

**F606** · Medium · `src/calculation/useErstatningsopgoerelseAggregation.ts:21-30` (`tryCompute`) — Error-swallowing wrapperen returnerer `null` og logger kun i DEV. I produktion: alle beregningsfejl er tavse, og UI viser tomme/null-resultater uden nogen indikation til brugeren om, hvad der gik galt. Enbefaling: overvej en mekanisme til at signalere fejltilstand i UI (f.eks. error-signal i returværdi) — specielt for trust-kritisk kode. Som minimum: dokumentér det bevidste design-valg.

**F607** · Lav · `src/domain/erstatningsopgoerelse/tafBeregningsEngine.ts:88-100` — I `buildMergedTafGroups` tildeles `id` for en merged gruppe til `firstSource?.id ?? \`${range.fra}-${range.til}\``. Når to rækker merges bruges kun første rækkens ID — de øvrige ID'er forsvinder. `invalidRows` er hardkodet med `loseFeriedage: 0` (linje 55) uanset hvad row'ens faktiske loseFeriedage er. Disse to valg er formentlig intentionelle (merged grupper præsenteres som én post), men er ikke dokumenterede som invarianter. Anbefaling: tilføj en kommentar der forklarer ID-valget og at loseFeriedage for invalide rækker irrelevant for beregningen.

### Tilfældighedsfund (Fase 6)

**FT-6A** · `src/domain/erstatningsopgoerelse/tafEngine.ts` vs. `tafBeregningsEngine.ts` — Navngivningen er forvirrende: "engine" bruges om begge, men de har fundamentalt forskellig semantik (per-row vs. merge-og-aggreger). Anbefaling: omdøb `tafEngine.ts` til `tafRowDerived.ts` for at signalere at det er display-afledte per-row-værdier, og ikke den autoritative beregningsmotor.

**FT-6B** · `src/domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationPolicy.ts` — `signSchema` inkluderer `'fromSource'` som mulig værdi, men den bruges ikke i den konkrete `erstatningsopgoerelse.policy.ts`. Er `fromSource` reserveret til fremtidig brug, eller er det dead schema? Bør afklares og enten bruges eller fjernes.

---

## Fase 7: Beregningsengines — Rente & Varige Mén 🔄

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

**F701** · Høj · `src/utils/interestDomain.ts:178-179` — `validateInterestCalculation` returnerer fejlkoden `'MISSING_KRAVET_DATO'` (linje 179) når `rentedato` mangler — en forkert kode for en forkert årsag. Fejlkoden `'MISSING_RENTEDATO'` eksisterer ikke i `ValidationError`-unionen, så i stedet genbruges en misvisende kode. Anbefaling: tilføj `'MISSING_RENTEDATO'` til `ValidationError`-unionen og brug den.

**F702** · Høj · `src/domain/renteberegning/renteEngine.ts` vs. `src/domain/renteberegning/renteberegningEngine.ts` — To parallelle renteberegnings-engines. `renteEngine.ts` (`computeRentekravCalculation`) bruger den legacy `calculateProcessInterest` med modul-globale satser. `renteberegningEngine.ts` (`computeRenteberegning`) bruger `calculateProcessInterestWithRates` med injicerede satser. Forholdet er ikke dokumenteret: bruges begge i produktion? Producerer de samme resultat? Svaret er: nej — `renteEngine.ts` runder resultatet inde i `calculateProcessInterest`, `renteberegningEngine.ts` runder i `roundInterest` bagefter. Anbefaling: afklar og dokumentér rollerne, eller konsolidér til én entry point med injicerede satser.

**F703** · Medium · `src/utils/interestDomain.ts:220-239` — `ensureCryptoUUID` og `generateUUID` er placeret i `interestDomain.ts` men har intet at gøre med renteberegning. Feature-detection og UUID-generering hører i et dedikeret modul (fx `src/utils/browserFeatures.ts` eller `src/utils/uuid.ts`). Risiko: logisk inkoherent modul der hæmmer søgbarhed og vedligeholdelse. Anbefaling: flyt til et korrekt navngivet modul.

**F704** · Medium · `src/utils/interestCalculator.ts:219-228` (`formatAmount`) — Funktionen bruger `toLocaleString('da-DK')` som er locale-afhængig formattering — afviger fra det kanoniske `formatCurrency` fra `formatUtils.ts`. Tilstedeværelsen af en lokal `formatAmount` i beregningslaget er desuden et arkitekturbrud (beregningsfiler bør ikke formatere). Anbefaling: slet `formatAmount` fra `interestCalculator.ts`; brug `formatCurrency` der hvor output skal vises.

**F705** · Medium · `src/utils/shDageBeregning.ts:103-107` — `_erSammeDag` er en privat hjælpefunktion markeret med `_`-prefix, men den kaldes ingen steder i filen (hverken direkte eller indirekte). Funktionen er dead code. Anbefaling: slet den.

**F706** · Medium · `src/utils/shDageBeregning.ts:190-191` — `parseDanishDate` og `parseWeekString` re-eksporteres "for bagudkompatibilitet". Disse utilities tilhører `dateUtils.ts` og bør importeres direkte derfra. Re-eksport fra `shDageBeregning.ts` skaber en misvisende afhængighed og en ekstra indirektion. Anbefaling: find forbrugerne og opdater imports til at pege direkte på `dateUtils.ts`; fjern re-eksporten.

**F707** · Lav · `src/domain/varigemen/varigeMenCalculations.ts:73` — `skadestidspunktRaw: unknown` er typet som `unknown` selvom kalderen (`varigeMenEngine.ts`) passerer `ISODateString | undefined`. Forsvarlig defensiv typing, men unødvendig ved et internt modul-til-modul-kald. Anbefaling: ændr typen til `ISODateString | undefined` og fjern `coerceToISODateString`-konverteringen der nu er overflødig.

### Tilfældighedsfund (Fase 7)

**FT-7A** · `src/utils/interestDomain.ts` bruger `interface`-keyword (`InterestDateInput`, `ValidatedInterestInput`) inkonsistent med resten af kodebasen der bruger `type`. Ingen funktionel forskel her, men stil-inkonsistens. Anbefaling: konvertér til `type`.

**FT-7B** · `src/domain/varigemen/varigeMenCalculations.ts:109` — `grundbeloeb = satsPerMengrad * 100` mangler en forklarende kommentar om, at `satsPerMengrad` er satsen pr. méntrin og at `* 100` giver det lovbestemte grundbeløb ved 100 % méngrad. Uden kommentar er den magiske `* 100` uklar for vedligeholdere.

---

## Fase 8: Erstatningsopgørelse Support Domain 🔄

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

**F801** · Medium · `src/domain/erstatningsopgoerelse/loenudviklingManuelBaseRowValidation.ts:14-16` — `formatPercentDa` bruger `toLocaleString('da-DK')` til procentformatering i stedet for det kanoniske `formatPercentFixed2` fra `sharedPdfUtils.ts`. Yderligere: fejlmeddelelsen (linje 74) formaterer via `formatPercentDa(normalizeComparablePercent(check.expected))` som altid giver 0–2 decimaler baseret på locale-adfærd — ikke garanteret konsistent med andre procent-visninger. Anbefaling: brug `formatPercentFixed2` fra `sharedPdfUtils.ts`.

**F802** · Medium · `src/domain/erstatningsopgoerelse/tafTableModel.ts:41-46` + `src/domain/renteberegning/rentekravTableModel.ts:56-61` — `parseOptionalIntegerFromString` er implementeret identisk i begge filer. Kandidat til konsolidering i et fælles tableModel-utility-modul. Anbefaling: udtruk til `src/domain/tableModelUtils.ts` eller tilsvarende delt lokation.

**F803** · Medium · `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts:80-86` — `formatAmount2` og `formatAmountWithoutTrailingDecimals` bruger `toLocaleString('da-DK')` — ikke-kanonisk møde (se `formatCurrency` i `formatUtils.ts`). `sharedPdfUtils.ts` er et PDF-specifikt modul og bruger muligvis bevidst locale-formatering til PDF-output, men det bør kommenteres eksplicit. Anbefaling: tilføj kommentar om det bevidste valg, eller brug `formatCurrency`-kompatibelt format.

**F804** · Lav · `src/domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues.ts:34-51` — To JSDoc-kommentarblokke på hinanden over `createNewEOInitialValuesFromSettings` og `createErstatningsopgoerelseInitialValues`: den første (linje 34-43) er forældet og beskriver `createErstatningsopgoerelseInitialValues`, men sidder over den private hjælpefunktion. Den anden (linje 45-51) er korrekt placeret. Anbefaling: slet den redundante første blok.

**F805** · Lav · `src/domain/erstatningsopgoerelse/eoPdfModel.ts:12-13` — To separate import-statements fra `'./tafCalculations'` på linje 11 og 12. Bør slås sammen til ét import-statement.

### Tilfældighedsfund (Fase 8)

**FT-8A** · `src/domain/debug/` indeholder 23 filer — et betydeligt subsystem der ikke er dækket fuldt ud i dette review. Subsystemet har et registry-mønster (`eoDebugBuilderRegistry.ts`) med god fejl-isolation. Subsystemets scope bør afklares eksplicit i Fase 19 (testkvalitet).

**FT-8B** · `src/domain/erstatningsopgoerelse/eoDebugContextBuilders.ts`, `eoDebugExecutionContext.ts`, `eoDebugNavigationMap.ts`, `eoDebugRowAggregator.ts`, `eoDebugRowPresentation.ts`, `eoDebugStamdataModel.ts` — 6 debug-relaterede filer er placeret i `src/domain/erstatningsopgoerelse/` mens `src/domain/debug/` allerede eksisterer som dedikeret debug-mappe med 23 filer. Ansvaret er splittet. Anbefaling: flyt de 6 filer til `src/domain/debug/` for kohærens.

---

## Fase 9: Årsløn & Stamdata Domain 🔄

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

**F901** · Høj · `src/domain/aarsloen/aarsloenCalculations.ts` vs. `src/domain/calculations/aarsloenCalculations.ts` — T001 bekræftet. De to filer har identisk navn men fundamentalt forskelligt ansvar: `domain/aarsloen/` indeholder beregningsenginen (`beregnOmregnetAarsloen`); `domain/calculations/` indeholder UI policy helpers (`hasAarsloenEffectiveRows`, `shouldShowAarsloenFerieFields` etc.). Navnekonflikten er en arkitekturfejl — importfejl er svære at opdage. Anbefaling: omdøb `domain/calculations/aarsloenCalculations.ts` til `domain/calculations/aarsloenPolicy.ts` (og tilsvarende export i `index.ts`).

**F902** · Medium · `src/domain/aarsloen/aarsloenCalculations.ts:109` + `:133` + `:175` — `Math.round(365 / 7 * 5)` (= 261) beregnes inline 3 gange som magisk floating-point-konstant. Dertil bruges `52.14` (uger per år) inline på linje 163 uden navngivning. Disse er normative domæne-konstanter der bør være named exports: `HVERDAGE_PAA_AAR = 261`, `UGER_PAA_AAR = 52.14`. Anbefaling: udtræk til topniveau-konstanter i filen.

**F903** · Medium · `src/hooks/useAarsloenPdfGates.ts:97` — `setTimeout(() => setDownloadShake(false), 500)` er unregistreret — timer kan fyre efter komponent er unmounted og resultere i state-opdatering på umounted komponent. Anbefaling: brug `useEffect` med cleanup (`return () => clearTimeout(id)`) eller ignorer (React 18+ håndterer dette sikkert internt, men en eksplicit cleanup er korrekt praksis).

**F904** · Lav · `src/utils/aarsloenTableCalculations.ts:58` — `export const isEffectivelyEmptyCell = isAarsloenTableCellEffectivelyEmpty;` er et redundant alias-export. Anbefaling: fjern alias og brug `isAarsloenTableCellEffectivelyEmpty` direkte, eller omdøb den originale til det kortere navn.

### Tilfældighedsfund (Fase 9)

**FT-9A** · `src/hooks/useAarsloenBeregning.ts` og `src/hooks/useAarsloenPdfGates.ts` bruger begge `interface`-keyword til lokale typer (`AarsloenBeregningState`, `UseAarsloenBeregningProps`, `PdfEligibility`, `UseAarsloenPdfGatesReturn`) — inkonsistent med resten af kodebasen der bruger `type`. Anbefaling: konvertér til `type`.

**FT-9B** · `src/domain/aarsloen/aarsloenCalculations.ts:147-188` — Metode C for dagsløn (linje 165-188) er kommenteret som "faktisk metode B logik, men for dagsløn". Dette er en red flag: en beregningsmetode der er dokumenteret som at implementere en anden metodes logik bør refaktoreres — ideelt ved at genbruge Metode B's kode direkte.

---

## Fase 10: Form/Input-kontrakt (hooks & validators) 🔄

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

**F1001** · Medium · `src/hooks/usePersistedActiveTab.ts` — Tab-keys på formen `mineo_ui_activeTab_${pageId}` skrives direkte til sessionStorage uden at være registreret i `storageManifest.ts`. Det betyder at disse nøgler ikke ryddes af `clearAllData()` (eller tilsvarende manifest-drevet oprydning). Anbefaling: tilføj disse nøgler til `storageManifest.ts`, eller brug en manifest-drevet storage-helper fremfor direkte `sessionStorage`-adgang.

**F1002** · Medium · `src/hooks/useFieldBehavior.ts:~69` — Escape-handler sætter `input.style.caretColor = 'transparent'` som inline stil, men nulstiller den ikke efterfølgende. Hvis inputtet genbruges (focus/blur-cyklus), forbliver `caretColor: transparent` og cursoren er usynlig. Anbefaling: nulstil `caretColor` enten i `onBlur` eller via en separat `useEffect` cleanup.

**F1003** · Lav · `src/hooks/useFormFieldErrors.ts` og `src/hooks/usePersistedSection.ts` — Begge bruger `React.useMemo(() => value, [value])` som identity-memo: de videregiver blot en allerede-stabilt-memoized værdi der ikke transformeres. Det er meningsløst (React memoizer ikke over primitiver/referencer der allerede er stabile). Anbefaling: fjern `useMemo`-wrapperen og returnér `value` direkte — det forenkler koden uden adfærdsændring.

**F1004** · Lav · `src/hooks/useOmregningToggle.ts:123-136` — To separate `useEffect`s (`tabelHarFejl`-guard og `hasValidPeriod`-guard) kalder begge `dispatch({ type: 'DISABLE' })` og `onEnabledChange(false)`. Hvis begge betingelser er sande i samme render, afvikles `onEnabledChange(false)` to gange i samme render-cyklus. Selvom det er idempotent i praksis, er det en dobbelt-dispatch der kan forvirre konsumenter der forventer præcis én ændring. Anbefaling: konsolidér de to guards til ét `useEffect` med `|| `-logik, eller kald `onEnabledChange` kun når `state.enabled` faktisk ændrer sig (via separat `useEffect` der observerer `state.enabled`).

### Tilfældighedsfund (Fase 10)

**FT-10A** · `src/hooks/useFieldBehavior.ts` bruger `interface`-keyword til `UseFieldBehaviorProps` og `UseFieldBehaviorReturn`, og har `export default` som eneste default-export i kodebasen. Begge er inkonsistente med resten af kodebasen der bruger `type` og named exports. Anbefaling: konvertér til `type` og `export const`.

**FT-10B** · `src/hooks/useOmregningToggle.ts` bruger `interface`-keyword til `UseOmregningToggleProps` og `UseOmregningToggleReturn` — samme inkonsistens som FT-10A. Anbefaling: konvertér til `type`.

---

## Fase 11: Input-komponenter 🔄

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

**Bemærk:** Table-input-filerne er skimmet strukturelt men ikke læst i fuld detalje — fundene baseres primært på standalone-felterne og tableInputContracts.ts.

**Fund:**

**F1101** · Medium · `src/components/inputs/StyledPercentField.tsx:420` — `handleKeyDown` er defineret som en regulær funktionsudtryk (ikke `React.useCallback`), modsat alle andre feltkomponenter der konsekvent bruger `useCallback`. Genskabes ved hvert render; konsumenter der afhænger af callback-stabilitet kan påvirkes. Anbefaling: konvertér til `React.useCallback` med korrekt dependency-array (følg mønstret fra `StyledIntegerField`, `StyledDateField` etc.).

**F1102** · Lav · `src/components/inputs/StyledYearField.tsx` — Filen er dokumenteret som "legacy wrapper" for `StyledYearFieldNext`, men ingen af filerne har `@deprecated`-markering, og `StyledYearField` er fuldt udadvendt. Anbefaling: markér `StyledYearField` eksplicit som `@deprecated` og migrér forbrugerne, eller fjern "legacy wrapper"-kommentaren hvis det ikke er intentionen at nedlægge den.

**F1103** · Lav · `src/components/inputs/StyledFractionField.tsx:93` — `configErrorMessage` afviser alle `maxDigits`-værdier der ikke er `2` som konfigurationsfejl. `maxDigits`-parameteren er reelt ikke-konfigurerbar — kun default `2` er gyldigt. Anbefaling: fjern parameteren, eller dokumentér eksplicit at kun `2` er tilladt og lad DEV-fejlen beskrive det.

### Tilfældighedsfund (Fase 11)

**FT-11A** · `src/components/inputs/StyledTextField.tsx:210-230` — `handleKeyDown`s `multiline`-gren har inkonsistent indrykning: den indre `if (!textAreaActivation.isEditorOpen)` blok er indenteret med 2 ekstra mellemrum sammenlignet med resten af funktionen. Sandsynligvis en copy-paste merge-artefakt. Ingen funktionel effekt.

**FT-11B** · `src/components/inputs/StyledDropdown.tsx:295,301` — `findNextMatchIndex` bruger `toLocaleLowerCase('da-DK')` til typeahead-søgning. Locale-afhængig adfærd der ikke følger det kanoniske mønster i kodebasen (`.toLowerCase()` ellers). Lav prioritet da typeahead er en UI-feature.

---

## Fase 12: Tabelkomponenter 🔄

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

**Bemærk:** Individuelle table-komponenter (`AarsloenTable`, `TAFPeriodeTable` etc.) er ikke læst i fuld detalje — fundene baseres primært på GridCore-lagene.

**Fund:**

**F1201** · Medium · `src/components/tables/gridCoreContext.tsx:17-24` — `GridCoreContextValue` blander state (`focusedCell`, `editingCell`) og API (metoder) i samme context-objekt. Filen selv dokumenterer konsekvensen: _"enhver ændring i focus/editing trigger rerender af alle consumers"_. I tabeller med mange celler er dette et potentielt performance-problem. Anbefaling: split context i `GridCoreStateContext` (state) og `GridCoreAPIContext` (metoder) — API-kontexten ændres aldrig og giver stable references til alle komponenter der kun bruger metoderne.

**F1202** · Lav · `src/components/tables/useGridCoreController.ts:30-36` — Dual-state-syncing: `focusedCellRef` og `editingCellRef` holdes i sync med tilsvarende state-variabler via `useEffect`. Dette er korrekt men skaber 2 renders ved hvert fokus-skift (state-ændring → render → effect → ref-opdatering). `ref`-opdateringen burde ske synkront i `setFocusedCell`/`setEditingCell` (som allerede gøres inline i linjerne 43/48-49), men `useEffect`-synken er redundant. Anbefaling: fjern de to `useEffect`-synks (linje 30-36) da `setFocusedCell`/`setEditingCell` allerede opdaterer ref synkront.

### Tilfældighedsfund (Fase 12)

**FT-12A** · Fase 12 er eksklusiv stor (30+ filer) og er kun delvist gennemgået. De individuelle table-komponenter (`AarsloenTable`, `TAFPeriodeTable`, `LoenudviklingManuelTable` etc.) er ikke gennemgået for fundspecifikke problemer. Disse bør gennemgås separat i en dedikeret session.

---

## Fase 13: Side-komponenter — Erstatningsopgørelse 🔄

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

**Gennemgåede filer:**
- `src/components/pages/Erstatningsopgoerelse.tsx`
- `src/components/pages/erstatningsopgoerelse/EOberegningTab.tsx`
- `src/components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx`
- `src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx`

**Ikke gennemgået:** `EODebug.tsx`, `EODebugTabel.tsx`, `EODebugLoenSections.tsx`, `EODebugRegulationSections.tsx`, `components/` (alle) — disse er debug-output og visningskomponenter, men bør gennemgås for fund separat.

**Fund:**

**F1301** · Medium · `src/components/pages/erstatningsopgoerelse/EOberegningTab.tsx:34-49` og `src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx:89-101` — To private hjælpefunktioner (`formatDateLongDisplay` og `formatIsoDateAsLongDanish`) gør begge ISO-dato → langt dansk datoformat, men implementerer det forskelligt. `dateFormatting.ts:50-58` eksporterer allerede `formatIsoDateLong` der gør præcis det samme. Derudover afviger de to lokale implementeringer fra hinanden: `formatDateLongDisplay` producerer `"1. januar 2024"` (med punktum, som `formatIsoDateLong`), mens `formatIsoDateAsLongDanish` producerer `"1 januar 2024"` (uden punktum) via `Intl.DateTimeFormat` + regex-strip. Anbefaling: fjern begge lokale implementeringer og brug den kanoniske `formatIsoDateLong` — afklar om punktum ønskes (det er den historiske konvention i projektet).

**F1302** · Medium · `src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx:193` — `LOENTRIN_FINDER_SESSION_STORAGE_KEY = 'mineo_ui_loentrinFinderOverlay_v1'` er defineret og brugt lokalt i filen uden at være registreret i `storageManifest.ts`. Konsekvens: key ryddes ikke ved `clearAllData()` og er usynlig for manifest-baseret debugging. Anbefaling: tilføj key til `STORAGE_KEYS` i `storageManifest.ts` og brug `getStorageKey()` som alle andre moduler.

**F1303** · Lav · `src/components/pages/erstatningsopgoerelse/EOberegningTab.tsx:91-94` — Fire separate `useState`-variabler styrer ét sammenhængende UI-flow (control mismatch dialog). State der altid opdateres atomisk bør holdes samlet. Anbefaling: konsolider til ét objekt, fx `{ open: false, rows: [], report: null, error: null }`, for at eliminere risikoen for delvis opdatering mellem renders.

### Tilfældighedsfund (Fase 13)

**FT-13A** · `LoenindkomstTab.tsx` er en meget stor fil (700+ linjer) med ansvar for både formular-layout, domæne-hjælpefunktioner, en lokal Zod-schema-definition (`loentrinFinderSessionEntrySchema`), sessionStorage-read/write og en kompleks overlay-komponent (`LoentrinFinderOverlay`). Filen overtager ansvar der burde ligge i separate moduler. Anbefaling: udtræk `LoentrinFinderOverlay` til en separat komponent og flyt sessionStorage-logikken til en dedikeret hook.

---

## Fase 14: Side-komponenter — Øvrige sider 🔄

**Rationale:** Øvrige sider gennemgås for arkitekturoverensstemmelse og korrekthed.

**Gennemgåede filer:**
- `src/components/pages/Aarsloen.tsx` (via agent)
- `src/components/pages/Stamdata.tsx`
- `src/components/pages/VarigeMen.tsx`
- `src/components/pages/Renteberegning.tsx`
- `src/components/pages/Satser.tsx`
- `src/components/pages/Erhvervsevnetab.tsx`
- `src/components/pages/Indstillinger.tsx`

**Ikke gennemgået:** `Om.tsx`, `OpenEo.tsx`, `Test.tsx`, `UnsupportedDevicePage.tsx`, `LoginPage.tsx` — disse er statiske eller simple sider uden forretningslogik.

**Fund:**

**F1401** · Medium · `src/components/pages/Satser.tsx:21-40` — Tre private formatteringsfunktioner (`formatKroner`, `formatKronerPerEnhed`, `formatProcent`) definerer egne locale-baserede formateringslogikker med `toLocaleString('da-DK')` og `value.toString().replace('.', ',')`. Projektet har kanoniske formatters i `formatUtils.ts` (`formatCurrency`, `formatAsAmount`) og `sharedPdfUtils.ts` (`formatPercentFixed2`), som er locale-uafhængige og bruger intern afrundingslogik. `toLocaleString` er driftsusikker (browserens locale kan i teorien overrides). `formatProcent` er desuden fragil ved at bruge `toString().replace('.',',')` — ej robust over for tal med mere end ét decimaltegn i streng-repræsentationen. Anbefaling: brug de kanoniske formatters og tilføj eventuelt en `formatKroner`-variant (uden decimaler) til `formatUtils.ts` frem for lokale genopfindelser.

**F1402** · Lav · `src/components/pages/Satser.tsx:92-93` + `:120-126` — `satser` og `gyldigtAar` holdes som lokal state der synkroniseres via `useEffect` fra den beregnede `effectiveYear`. Dette indebærer ét renders ekstra ved hvert gyldigt år-skift (state-opdatering → render → effect → ny render). Anbefaling: beregn `satser` og `gyldigtAar` direkte i render fra `effectiveYear` med `useMemo` — eliminer state-synkronisering.

**F1403** · Lav · `src/components/pages/Indstillinger.tsx:333-395` — To næsten identiske JSX-blokke rendrer brevhoved-checkboxes (rad 1: 3 checkboxes, rad 2: 4 checkboxes) med duplikeret `onChange`-logik og identisk `FormControlLabel`/`Checkbox`-styling. Anbefaling: udtræk til en `BrevhovedCheckboxRow`-komponent der tager en items-array som prop.

**F1404** · Lav · `src/components/pages/Stamdata.tsx:44` — `useMemo` deps-array er `[values.skadestype]` mens factory-parameteren er hele `values`-objektet (`selectStamdataDefaultDatoLabel(values)`). I dette tilfælde er `values.skadestype` det eneste felt der reelt bruges i selektoren (bekræftet i `stamdataCalculations.ts:8`), men dette er en skjult invariant: hvis selektoren en dag ændres til at læse andre felter, opdaterer memoen ikke. Anbefaling: brug `[values]` eller destrukturér eksplicit `values.skadestype` som parameter til selektoren fremfor at sende hele objektet.

### Tilfældighedsfund (Fase 14)

**FT-14A** · `Satser.tsx:78-79` — `MIN_SATSER_YEAR` og `MAX_SATSER_YEAR` beregnes inde i komponenten. Disse er konstante (de ændrer sig ikke under kørsel) og bør defineres på modul-niveau for at undgå genberegning ved hvert render.

---

## Fase 15: Layout, UI & fælles komponenter 🔄

**Rationale:** Layout-laget og fælles UI-komponenter gennemgås for arkitekturmæssig isolation og korrekt statshåndtering.

**Gennemgåede filer:**
- `src/App.tsx`
- `src/components/AuthGate.tsx`
- `src/components/layout/MainLayout.tsx`
- `src/components/layout/SideMenu.tsx`
- `src/components/errors/ErrorBoundary.tsx`
- `src/components/errors/ErrorFallback.tsx`
- `src/components/errors/BugReportButton.tsx`
- `src/components/ui/ConfirmationDialog.tsx`
- `src/components/ui/FloatingActionButton.tsx`
- `src/components/reports/ContentBoxReportDialog.tsx`

**Ikke gennemgået:** `Container.tsx`, `ContentBox.tsx`, `LicenseModal.tsx`, `Overlay.tsx`, `ScrollToTopButton.tsx`, `scrollToTopConfig.ts`, `visuallyHiddenStyle.ts`, `ComputationErrorAlert.tsx`, `DevtoolsIssueNotice.tsx`, `main.tsx`.

**Fund:**

**F1501** · Lav · `src/components/ui/FloatingActionButton.tsx:39` — `setTimeout(() => setIsShaking(false), 500)` uden `clearTimeout`. Hvis komponenten unmountes mens timeout kører (fx ved hurtig navigation), forsøger callbacket at kalde `setIsShaking` på en umounted komponent. React 18+ logger ikke fejl, men timeout-referancen lækker. Anbefaling: returnér en cleanup-funktion via `useEffect` der kalder `clearTimeout`, eller check om komponenten stadig er mounted via ref.

**F1502** · Lav · `src/components/errors/BugReportButton.tsx:62-156` — Seks async event-handlers (`handleBugReport`, `handleCopyToClipboard`, `handleOpenEmail`, `handleDownload`, `handleSnackbarClose`, `handleDialogClose`) er defineret som inline funktioner uden `useCallback`. Komponenten er ikke memoized med `React.memo`. Da `BugReportButton` næsten altid rendres i error-kontekst er den praktiske konsekvens minimal, men mønstret er inkonsistent med `ContentBoxReportDialog` (som memoizer alle 6 handlers) og `FloatingActionButton` i samme mappe. Anbefaling: pak handlers ind i `useCallback` for konvergens.

### Tilfældighedsfund (Fase 15)

**FT-15A** · `MainLayout.tsx` er 895 linjer og rummer mange orthogonale ansvarsområder: PWA-filopening, `beforeunload`-guard, Ctrl+S-shortcut, DevTools-monitor, nav-logik, dialogs, snackbars og diverse persistence-refs. Dette er accidental complexity. Filen bør opdeles i separate hooks og eventuel sub-kontekst.

---

## Fase 16: PDF-generering 🔄

**Rationale:** PDF-output er et slutprodukt der bruges i juridiske sammenhænge. Korrekthed og konsistens med beregnede tal er kritisk. Arkitekturoverholdelse (ingen beregninger i PDF-lag) skal verificeres.

**Gennemgåede filer:**
- `src/utils/pdf/erstatningsopgoerelsePdf.ts` (delvist)
- `src/utils/pdf/rentePdf.ts` (delvist)
- `src/utils/pdf/pdfFormatters.ts` (via agent)
- `src/utils/pdf/pdfHelpers.ts` (via agent)
- `src/utils/pdf/sharedPdfUtils.ts` (via agent)
- `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts` (via agent)
- `src/utils/pdf/erstatningsopgoerelse/sections/loenindkomstSection.ts` (delvist)
- `src/utils/pdf/erstatningsopgoerelse/sections/opgoerelseSection.ts` (delvist)

**Ikke gennemgået:** `pdfConfig.ts`, `pdfOptions.ts`, `pdfLoader.ts`, `pdfWriter.ts`, `pdfBrevhoved.ts`, `aarsloenPdf.ts`, `krlPdf.ts`, `reguleringPdf.ts`, `satserPdf.ts`, `shDagePdf.ts`, `tafFordeltPaaAarPdf.ts`, `varigeMenPdf.ts`.

**Fund:**

**F1601** · Høj · `src/utils/pdf/erstatningsopgoerelsePdf.ts:440-448` og `src/components/pages/erstatningsopgoerelse/EODebug.tsx:267-277` — `computeFormulaValue` er en identisk finansiel beregningsfunktion (grundløn × (1 + tillaegspct/100) × (1 + pensionpct/100)) der er duplikeret ordret i PDF-renderet og debug-komponenten. Begge steder laver de beregningen fra `FormulaComponents`. Tilsvarende logik findes også i `eoPdfModel.ts:1035`. Det er arkitekturbryd at have beregningslogik i PDF-laget fremfor i domænelaget — PDF-renderer bør modtage færdigberegnede værdier fra modellen. Risiko: en fejlretning i én kopi retter ikke den anden. Anbefaling: `computeFormulaValue` bør kun eksistere i domænelaget (fx `reguleringFormulaUtils.ts`) og eksporteres derfra til alle forbrugere.

**F1602** · Høj · `src/utils/pdf/rentePdf.ts:60-62` — `getDaysInYear` er en identisk kopi af `getDaysInYear` i `src/utils/interestCalculator.ts:36-38`. Derudover er `isLeapYear`-logikken (inline) gentaget i `periodeBeregning.ts:60`, `dateInputValidation.ts:18` og `StyledWeekField.tsx:53`. Der er ingen kanonisk kilde for skudårsberegning i projektet. Risiko: en fejl i definitionen kan eksistere i én kopi uden at rettes i de andre. Anbefaling: eksportér én `isLeapYear(year)` og `getDaysInYear(year)` fra `dateUtils.ts` (eller `isoDate.ts`) og brug den alle steder.

**F1603** · Høj · Pct-konvention-uoverensstemmelse: `erstatningsopgoerelsePdf.ts:448` og `EODebug.tsx:275` dividerer procentsatser med 100 (`tillaeg / 100`, `pensionPct / 100`) — de forventer altså procent som heltal (fx `12.0` for 12%). `eoDebugRegulationCore.ts:124` bruger derimod `(1 + totalPct)` uden division — dvs. den forventer decimal-form (fx `0.12` for 12%). Hvis `FormulaComponents` nogensinde blandes på tværs af disse kontekster (fx ved deling af input) vil beregningerne afvige med faktor 100. Anbefaling: dokumentér pct-konventionen eksplicit i `FormulaComponents`-typen (fx med JSDoc: `@remarks pct er i procentpoint, fx 12.0 for 12%`) og tilføj en test der verificerer round-trip fra input til PDF-output.

**F1604** · Medium · `src/utils/pdf/erstatningsopgoerelsePdf.ts` (multiple linjer: 430, 434, 436, 811, 835, 897) — Direkte `toLocaleString('da-DK', {...})` kald for talformattering i PDF-renderet, frem for at bruge kanoniske formatters (`formatCurrency`, `formatAsAmount`, `formatPercentFixed2`). Projektet har allerede locale-uafhængige kanoniske formatters med determinisme-garantier (ingen afhængighed af browser-locale). Anbefaling: erstat alle direkte `toLocaleString`-kald med kanoniske formatters.

**F1605** · Medium · `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts` eksporterer `formatAmount2` (linje ~80) der bruger `value.toLocaleString('da-DK', ...)` direkte, mens `formatUtils.ts` har `formatCurrency` og `formatAsAmount` der gør præcis det samme men på en locale-uafhængig måde. `formatAmount2` er en duplikat med svagere garantier. Anbefaling: erstat `formatAmount2` med `formatAsAmount(value, 2)` og fjern funktionen.

### Tilfældighedsfund (Fase 16)

**FT-16A** · `isLeapYear`-logikken er spredt på 4 steder (`dateInputValidation.ts`, `periodeBeregning.ts`, `StyledWeekField.tsx`, `rentePdf.ts`) + `interestCalculator.ts` (som `getDaysInYear`). Alle bruger samme formel. En central `isLeapYear`-funktion i `dateInputValidation.ts` eksisterer allerede men eksporteres ikke og bruges ikke af de andre.

---

## Fase 17: Config, Settings, Auth & Data 🔄

**Rationale:** Konfiguration og indstillinger skal holdes adskilt fra forretningslogik. Auth-isolering og GDPR-compliance verificeres. Data-filer (løntabeller) gennemgås for integritet og korrekt import.

**Gennemgåede filer:**
- `src/auth/auth.ts`
- `src/auth/authConfig.ts`
- `src/settings/appSettingsParse.ts`
- `src/settings/appSettingsSchema.ts`
- `src/settings/appSettingsStorage.ts`
- `src/config/dateRanges.ts`
- `src/utils/logger.ts`
- `src/utils/logStorage.ts`

**Ikke gennemgået:** `tableTheme.ts`, `version.ts`, `src/data/`, `devtoolsMonitor.ts`, `pwaInstallPrompt.ts`, `pwaLaunchQueue.ts`.

**Overordnet vurdering:** Auth er 100% client-side, GDPR-compliant (ingen data forlader browseren), logger saniterer PII aktivt, settings valideres med Zod ved load med fallback til defaults. Ingen kritiske fund.

**Fund:**

**F1701** · Lav · `src/config/dateRanges.ts:22-25` — Hardkodede fremtidsdatoer (`DATE_2025_12_31`, `DATE_2026_12_31`, `DATE_2030_12_31`) kræver manuel opdatering når nye skatteår defineres. Filen har allerede en "ÅRLIG OPDATERING"-kommentar (linje 4-6), men fremtidsdatoerne er ikke markeret som planlagte opdateringspunkter. Risiko er lav da `MAX_YEAR` er dynamisk (beregnet fra `TODAY`), men de øvre grænser for specifikke felter kan blive forældede. Anbefaling: tilføj en kommentar ved `DATE_2026_12_31` etc. med "skal opdateres senest [dato]" så det er tydeligt hvornår en revision er nødvendig.

### Tilfældighedsfund (Fase 17)

**FT-17A** · `src/auth/authConfig.ts` — Delt passwordhash (`SHARED_PASSWORD_HASH`) er en compile-time konstant i kildefilen. I en åben kildekode-repo ville dette eksponere hashen. For intern brug er det acceptabelt, men det bør dokumenteres eksplicit at dette er intentionelt (snarere end en forglemmelse) og at en adgangskode-rotation kræver kilde-ændring + ny release.

---

## Fase 18: Utils — Resterende 🔄

**Rationale:** Resterende utility-filer gennemgås for duplikering, ansvarsblanding og manglende konvergens med kanoniske helpers.

**Gennemgåede filer:**
- `src/utils/scrollToDebugRow.ts`
- `src/utils/scrollToSection.ts`
- `src/utils/dataCollection.ts`
- `src/utils/dataValidator.ts`
- `src/utils/formatUtils.ts`

**Ikke gennemgået:** `assertNever.ts`, `bugReport.ts`, `clipboardUtils.ts`, `errorMessages.ts`, `mui/isFocusVisible.ts`.

**Fund:**

**F1801** · Medium · `src/utils/scrollToDebugRow.ts` og `src/utils/scrollToSection.ts` — To filer implementerer næsten identisk `requestAnimationFrame`-retry-loop til DOM-scroll. Strukturen er identisk (attempts-tæller, tryScroll-funktion, success/failure-callbacks, requestAnimationFrame-rekursion) — eneste reel forskel er elementfinding og max-retries-default. Derudover mangler `scrollToSection` `prefers-reduced-motion`-support (linje 47: hardkodet `'smooth'`), som `scrollToDebugRow` korrekt implementerer (linje 63-67). Anbefaling: udtræk en fælles `scrollWithRetry(finder, options)` hjælpefunktion; begge filer delegerer til den; tilsæt `prefers-reduced-motion` i `scrollToSection`.

### Tilfældighedsfund (Fase 18)

Ingen yderligere tilfældighedsfund.

---

## Fase 19: Testkvalitet (tværgående) 🔄

**Rationale:** Tværgående analyse af testdækning, teststruktur og -mønstre. Prioriterer dækning af beregninger, save/load-round-trip og validering over UI-tests.

**Scope:** Hele `src/__tests__/` og inline tests i domænelag

**Overordnet billede:** 77 testfiler (`.ts` + `.tsx`), ~1.778 assertions. Nul flakiness-mønstre (ingen `it.skip`, ingen `Math.random()`, ingen `setTimeout` i logik-tests). Kritiske beregningsengines for TAF, renteberegning og varigemengrad er dækket. Persistence round-trip er dækket via `formPersistenceStore.*`-tests.

**Fund:**

**F1901** · Høj · `src/utils/rounding.ts` — **ingen dedikerede tests**. `roundByMethod` er det primære afrundingsprimitiv for alle finansielle beregninger i projektet (bruges af `formatCurrency`, `calculateAarsloenRowDerived`, `beregnArbejdsdageOgMaaneder`, `erstatningsopgoerelseAggregationEngine` m.fl.). Afrundingsfejl i denne funktion viler upåvirkede under alle integrationstests, da de alle forudsætter korrekt afrunding. Anbefaling: tilføj isolerede unit tests for `halfAwayFromZero`, `floor`, `ceil` for positive, negative og halve værdier (fx 0.5, -0.5, 2.005, store tal med floating-point-huller).

**F1902** · Høj · `src/utils/aarsloenTableCalculations.ts` — `calculateAarsloenRowDerived` har **ingen dedikerede tests**. Funktionen beregner `ferieberet`, `fpFvShSo`, `pension` og `samlet` ud fra løntrinnet for årslønsberegning. `AarsloenTable.onBlurDerived.test.tsx` tester den indirekte via UI-events, men tester ikke isoleret om formlen er korrekt. En fejl i pensionsformlen (`pensionBase = (grundloen + tillaegInput) * (1 + totalPct)`) vil passere UI-testen hvis UI blot viser det beregnede tal. Anbefaling: tilføj isolerede unit tests for `calculateAarsloenRowDerived` med kendte inputværdier og forventede outputs.

**F1903** · Medium · `src/utils/interestCalculator.ts` og `src/utils/pdf/rentePdf.ts` — Begge implementerer renteberegning med `getDaysInYear`. `renteberegningEngine.test.ts` tester `renteberegningEngine` (EO-domænet), men det er uklart om `interestCalculator.ts` er den samme engine eller en anden. Hvis der er to separate renteberegninger i kodebasen (én til UI-visning, én til PDF) med potentielt divergerende resultater, er det kritisk at begge er testet mod de samme kendte inputs. Anbefaling: afklar om `interestCalculator.ts` og `renteberegningEngine` beregner det samme — og tilføj en parity-test der verificerer output-identitet.

**F1904** · Medium · `src/domain/erstatningsopgoerelse/eoDebugTafOverlapParity.test.ts` — **1 kendt fejlende test** (se MEMORY.md). Tests med kendte fejl i test-suiten er en vedligeholdelsesrisiko: de optager "forventet fejl"-tolerance og kan maskere nye fejl. Anbefaling: enten ret det underliggende overlap-problem (foretrukket), eller marker testen eksplicit med `it.skip` og en kommentar der beskriver den kendte fejl og dens accepterede omfang.

**F1905** · Lav · Testnavngivning er generelt god, men der er inkonsistens i konventioner: nogle testfiler bruger ét `describe`-niveau (`describe('calculateX', () => { it(...) })`), andre bruger flade `it`-struktur uden `describe`. For et projekt af denne størrelse er konvergens til ét mønster vigtig for søgbarhed og rapportering. Anbefaling: fastlæg konventionen (fx altid mindst ét `describe`-niveau der navngiver det testede modul) i AGENTS.md.

### Tilfældighedsfund (Fase 19)

**FT-19A** · `src/__tests__/quality/noDirectLocalStorageAccess.test.ts` — der eksisterer en automatiseret kvalitetstest der scanner kildekoden for direkte `localStorage`-adgang. Tilsvarende scanning for direkte `sessionStorage`-adgang uden for `storageManifest`-registrerede nøgler eksisterer ikke, selvom F1001 og F1302 viser at dette er et reelt problem. Anbefaling: udvid eller opret en tilsvarende `noDirectSessionStorageAccess.test.ts` der verificerer at alle `sessionStorage.setItem`-kald bruger nøgler fra `STORAGE_KEYS`.

---

## Løbende tilfældighedsfund

Observationer der opstår undervejs på tværs af faser, og som ikke hører til et specifikt fund-ID i en fase.

| ID | Opdaget i fase | Observation | Status |
|----|----------------|-------------|--------|
| T001 | Kortlægning | `src/domain/aarsloen/aarsloenCalculations.ts` og `src/domain/calculations/aarsloenCalculations.ts` — to filer med identisk navn i overlappende placeringer. Behandlet i Fase 9: F901 beskriver overlap og duplikering. | ✅ Behandlet (F901) |
| T002 | Kortlægning | `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts` og `src/utils/pdf/sharedPdfUtils.ts` — potentielt samme ansvar i to filer. Behandlet i Fase 16: F1605 dokumenterer duplikeret `formatAmount2`. | ✅ Behandlet (F1605) |
| T003 | Kortlægning | `src/components/pages/Test.tsx` — en side der hedder "Test" i produktionskode. Fase 14 bekræftede at siden kun vises via `showStamdataTestTab`-setting (Indstillinger) og er bevidst gemt bag feature-flag. Ingen fund. | ✅ Behandlet — accepteret |

---

*Filen vedligeholdes automatisk af reviewer. Opdateres ved start og afslutning af hver fase samt ved hvert godkendt fund.*

---

## Efterfølgende tilføjelser (Codex) — 2026-02-21

Disse punkter er tilføjet efter en selvstændig, kritisk verifikation af `REVIEW.md` mod den aktuelle kodebase.
Eksisterende indhold ovenfor er ikke slettet eller omskrevet.

### Kritisk validering af eksisterende fund/løsningsforslag

**CR-01** · Vurdering af **F501** (`src/utils/fileLoad.ts`) — Delvist uenig i severity-begrundelsen.
`F501` beskriver, at `[FILELOAD DEBUG]`-blokke logger i produktion uden DEV-guard. I den aktuelle kode går al den pågældende output via `logDebug(...)`, og `logDebug` er allerede gated af `isDevelopment` i `src/utils/logger.ts:117-120`. Derfor er "produktion/GDPR-lækage via disse debug-kald" ikke dokumenteret af den nuværende implementation. Oprydning kan stadig være hensigtsmæssig, men severity/rationale bør justeres.

> **Reviewer:** Korrekt. Verificeret: `logDebug` (linje 117-120 i `logger.ts`) er gated på `isDevelopment` og persisterer ikke. F501's GDPR-begrundelse er fejlagtig — severity bør nedjusteres til Lav (dead code / oprydning). F501 rettes i næste revision.

**CR-02** · Vurdering af **F503** (`src/utils/fileHelpers.ts`) — Løsningsforslaget er korrekt men ikke tilstrækkeligt.
At tilføje typeannoteringer på de konkrete funktioner hjælper, men den strukturelle årsag er at `tsconfig.json` har `noImplicitAny: false` (`tsconfig.json:15`). Så længe den står sådan, kan implicit `any` fortsat glide ind andre steder uden compile-fejl.

> **Reviewer:** Korrekt. `noImplicitAny: false` er bekræftet i `tsconfig.json:15`. Løsningsforslaget i F503 adresserer symptomet men ikke årsagen. CF-01 nedenfor behandler rodproblemet.

**CR-03** · Vurdering af **F1701** (`src/config/dateRanges.ts`) — Fundet er underklassificeret.
Dette er ikke kun et "årlig opdatering"-signal. Der er en konkret intern inkonsistens nu: `max: DATE_2026_12_31` (`src/config/dateRanges.ts:446`) men note-tekst siger `31-12-2025` (`src/config/dateRanges.ts:448`).

> **Reviewer:** Korrekt og verificeret. `max` er `DATE_2026_12_31` (linje 446) men `notes`-teksten siger `"31-12-2025"` (linje 448). Dette er en aktiv inkonsistens — ikke kun et fremtidigt opdateringsproblem. F1701 var underklassificeret; dette bør stå som Medium (kode og dokumentation peger i hver sin retning ved audit). CF-05 dækker samme fund.

### Nye fund (ikke allerede listet ovenfor)

**CF-01** · Høj · `tsconfig.json:15` — `noImplicitAny` er slået fra trods "strict TypeScript"-krav.
`"strict": true` står sat, men `"noImplicitAny": false` undergraver type-sikkerheden i trust-kritisk kode. Dette forklarer også, hvorfor implicit-any-problemer ikke fanges globalt.

> **Reviewer:** Korrekt og bekræftet. `tsconfig.json:14-15` viser `"strict": true` efterfulgt af `"noImplicitAny": false`, som eksplicit overstyrer `strict`-flaget. I TypeScript er `"strict": true` en sammensætning af bl.a. `noImplicitAny`, `strictNullChecks`, `strictFunctionTypes` m.fl. — en eksplicit `"noImplicitAny": false` bagefter slår netop det flag fra igen. For trust-kritisk kode er dette et reelt hul. Enig i Høj severity.

**CF-02** · Høj · `src/utils/fileSave.ts:206` + `src/utils/fileSave.ts:337` + `src/utils/logger.ts:101-109` + `src/utils/logStorage.ts` — Potentiel PII-lækage til persistent log-lager.
`compareData` indbygger konkrete feltværdier i differencetekster (`forventet/faktisk`), og disse skrives via `logError(...)` i loop. `logError` persisterer `message` i IndexedDB (`persistLog`/`saveLogEntry`). `sanitizeData` beskytter kun `options.data`, ikke selve `message`. Ved save-verifikationsfejl kan brugerdata dermed ende i vedvarende log-storage.

> **Reviewer:** Korrekt og verificeret. `fileSave.ts:206`: `compareData` bygger strenge af typen `"${path}: Værdi afviger (forventet: \"${expected}\", faktisk: \"${actual}\")"` med rå feltværdier. `fileSave.ts:337`: disse `differences[i]`-strenge sendes direkte som `message`-argument til `logError(...)`. `logger.ts:178-203`: `logError` persisterer `message` umodificeret til IndexedDB via `persistLog`. `sanitizeData` (linje 184) saniterer kun `options.data` — ikke `message`. Hvis feltet f.eks. er `skadelidte`-navn eller `journalnr`, lander det i vedvarende IndexedDB-log. Enig i Høj severity.

**CF-03** · Høj · `src/index.css:2` — Ekstern netværksafhængighed til Google Fonts.
Global `@import` fra `fonts.googleapis.com` betyder runtime-kald ud af browserens lokale app-scope. Det er i konflikt med projektets non-negotiable constraint om ingen eksterne API/netværksafhængigheder.

> **Reviewer:** Korrekt og bekræftet. `index.css:2` indeholder `@import url('https://fonts.googleapis.com/css2?family=Montserrat:...')`. Dette er et runtime HTTP-kald til Google's servere ved hver sideload. Kommentaren i linje 1 erkender valget (`"to avoid bundling TTFs"`), men PWA-appen annoncerer sig som offline-capable — Google Fonts vil fejle uden netværk. Severity-vurdering som Høj er rimelig for en offline PWA.

**CF-04** · Medium · `src/main.tsx:27-33` — `UNSUPPORTED_MAX_WIDTH_PX`-grenen er i praksis død i moderne browsere.
Når `matchMedia` findes (normalt tilfældet), returnerer `isUnsupportedDevice` kun resultatet af `isTouchLikeDevice()`, og bredde-check (`UNSUPPORTED_MAX_WIDTH_PX`) bruges ikke. Det skaber en skjult semantik-forskel mellem fallback-browser og moderne browser.

> **Reviewer:** Delvist enig med en præcisering. Koden (linje 27-33) er: hvis `matchMedia` ikke findes → brug `window.innerWidth <= UNSUPPORTED_MAX_WIDTH_PX`. Hvis `matchMedia` findes → returnér `false` (ikke `isTouchLikeDevice()` — touch-check sker ét niveau oppe). `isTouchLikeDevice()` evalueres altid (linje 29: `if (isTouchLikeDevice()) return true`). Bredde-checket er altså en eksplicit fallback for meget gamle browsere der ikke understøtter `matchMedia` — og det er dead code i praksis. Fundet er gyldigt: `UNSUPPORTED_MAX_WIDTH_PX`-konstanten bruges kun i legacy-stien. Enig i Medium severity.

**CF-05** · Medium · `src/config/dateRanges.ts:446-448` — Konfigurationsinkonsistens mellem aktiv grænse og brugerforklaring.
`beregningsdato.max` er sat til 2026, men note-teksten angiver 2025. Uanset domæneintention er dette en audit-/forudsigelighedsfejl, fordi kode og brugerforklaring peger i hver sin retning.

> **Reviewer:** Korrekt — dækker samme konkrete inkonsistens som CR-03. Bekræftet: `max: DATE_2026_12_31` (linje 446) vs. `notes: '... fast max-værdi (31-12-2025)'` (linje 448). Enig i Medium severity. Dette er identisk med CR-03's fund og bør behandles samlet med F1701.
