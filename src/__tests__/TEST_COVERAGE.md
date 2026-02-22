# TEST_COVERAGE.md — Mineo Testdækning

**Sidst opdateret:** 2026-02-22 (strukturel oprydning gennemført)
**Formål:** Levende dokument der kortlægger testdækning for alle testbare kildefiler. Bruges som arbejdsredskab til at identificere mangler, følge fremdrift, og prioritere indsats.

## Statusnøgle

| Symbol | Betydning |
|--------|-----------|
| ✅ | Dækket og kvalitetssikret |
| ✅⚠️ | Dækket, men ikke kvalitetssikret endnu |
| ⚠️ | Delvis dækket (mangler edge cases, stier eller funktioner) |
| ❌ | Ingen tests |
| 🔇 | Bevidst undtaget (begrundelse påkrævet) |

## Prioritetsnøgle

| Prioritet | Betydning |
|-----------|-----------|
| **Kritisk** | Beregning, validering, persistens, kernetyper. Forkerte resultater = forkerte erstatningsopgørelser. |
| **Høj** | Utilities, domain-hjælpere, schemas, config med logik. Fejl her kan propagere til kritiske stier. |
| **Medium** | PDF-generering, data-lookup, tabelmodeller, debug-system. |
| **Lav** | UI-komponenter, config uden logik, debug-hjælpere, scroll-utils. |

---

## 1. Beregning (Kritisk)

### `src/domain/erstatningsopgoerelse/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `erstatningsopgoerelseAggregationEngine.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationEngine.test.ts` | Total + delkomponenter + fail-closed |
| `erstatningsopgoerelseAggregationPolicy.ts` | ❌ | — | Policy-regler for hvornår aggregation aktiveres. Kritisk — bestemmer om beregning overhovedet køres |
| `periodiseringsMotor.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/periodiseringsMotor.test.ts` | Apportionment, DST, delår, flere perioder |
| `tafBeregningsEngine.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/tafBeregningsEngine.test.ts` | Måneder/Arbejdsdage, Store Bededag, svie/smerte |
| `tafCalculations.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/tafCalculations.test.ts` | Dagoptælling, periodearitmetik. NB: duplikat i `domain/erstatningsopgoerelse/__tests__/` |
| `tafPerYearDerived.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/tafPerYearDerived.test.ts` | Årsbuckets, negativt TAF |
| `tafRowDerived.ts` | ❌ | — | Per-række afledte TAF-værdier. Kritisk |
| `tafBeregningsenhed.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/tafBeregningsenhed.test.ts` | Minimal dækning |
| `tafDaySets.ts` | ❌ | — | Dagssæt-beregninger for TAF. Kritisk |
| `ferieCalculations.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/ferieCalculations.test.ts` | Feriedage, DST, weekends |
| `reguleringFormulaUtils.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/reguleringFormulaUtils.test.ts` | Kumulativ faktor, ILON12/SBLON2 |
| `offentligeYdelserDerived.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/offentligeYdelserDerived.test.ts` | Dage, ydelse/dag, tillæg, invalide perioder |
| `angivetLoenHelpers.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/angivetLoenHelpers.test.ts` | Beløbsopløsning, normalisering |
| `arbejdsdageMaaneder.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/arbejdsdageMaaneder.test.ts` | Arbejdsdage, månedsfraktion |
| `indtaegtPerioder.ts` | ⚠️ | `domain/erstatningsopgoerelse/indtaegtPerioder.failClosed.test.ts` | Kun fail-closed-test. Mangler: normal flow, periodesammensætning, edge cases |
| `periodMerging.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/periodMerging.test.ts` | Sammenhængende/overlappende, ikke-overlappende, enkelt |
| `periodOverlapDetection.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/periodOverlapDetection.test.ts` | Alle geometrier |
| `beregningsperiodeTafOverlap.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/beregningsperiodeTafOverlap.test.ts` | Alle overlap-cases |
| `aarsloenRowInterval.ts` | ❌ | — | Årsløn-rækkeintervaller. Kritisk |
| `aggregationAdapters.ts` | ❌ | — | Adaptere mellem formdata og engine-input. Kritisk — fejl her giver forkert input til beregning |
| `indkomstRowValidation.ts` | ❌ | — | Indkomstrække-validering. Kritisk |
| `loenudviklingManuelBaseRowValidation.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/loenudviklingManuelBaseRowValidation.test.ts` | Krævede felter, datorækkefølge, beløbsfortegn |

### `src/domain/renteberegning/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `renteberegningEngine.ts` | ✅⚠️ | `domain/renteberegning/renteberegningEngine.test.ts` | Determinisme, ordensuvafhængighed, legacy-paritet |
| `renteEngine.ts` | ❌ | — | Kerne-renteengine. Kritisk |

### `src/domain/varigemen/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `varigeMenCalculations.ts` | ❌ | — | Méngradberegning, aldersjustering, grundbeløb. Kritisk — 150 linjer beregningslogik |
| `varigeMenEngine.ts` | ✅⚠️ | `domain/varigemen/varigeMenEngine.test.ts` | Orchestrering |

### `src/domain/aarsloen/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `aarsloenCalculations.ts` | ❌ | — | Årslønsberegning. Kritisk — 203 linjer |

### `src/domain/calculations/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `aarsloenPolicy.ts` | ❌ | — | Policy for årslønsberegning. Kritisk |
| `satserCalculations.ts` | ❌ | — | Satser-beregning. Kritisk |
| `stamdataCalculations.ts` | ❌ | — | Stamdata-afledte beregninger. Kritisk |

### `src/calculation/pipeline/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `erstatningsopgoerelseAggregationPipeline.ts` | ✅⚠️ | `calculation/erstatningsopgoerelseAggregationPipeline.test.ts` + `.orchestration.test.ts` | Fail-closed, totaler, orkestrering |

### `src/calculation/policy/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `erstatningsopgoerelse.policy.ts` | ❌ | — | Policy-regler. Kritisk |

### `src/utils/` (beregning)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `rounding.ts` | ✅⚠️ | `utils/__tests__/rounding.test.ts` | halfAwayFromZero, floor/ceil, -0, NaN, store tal |
| `interestCalculator.ts` | ✅⚠️ | `utils/__tests__/interestCalculator.test.ts` | DST-regression |
| `interestDomain.ts` | ❌ | — | Rentedomæne-typer og hjælpere. Kritisk — 211 linjer |
| `periodeBeregning.ts` | ✅⚠️ | `utils/__tests__/periodeBeregning.test.ts` | DST, skudår, uge 53 |
| `shDageBeregning.ts` | ✅⚠️ | `utils/beregnHelligdageMedNavn.test.ts` | Alle helligdage inkl. Store Bededag-afskaffelse |
| `aarsloenTableCalculations.ts` | ✅⚠️ | `utils/__tests__/aarsloenTableCalculations.test.ts` | Formel, ATP, pension |

---

## 2. Validering (Kritisk)

### `src/validators/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `erstatningsopgoerelseValidator.ts` | ✅⚠️ | `validators/erstatningsopgoerelseValidator.test.ts` | Forlig, svie/smerte, TAF, øvrige krav, samlet |

### `src/utils/` (validering)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `dateInputValidation.ts` | ❌ | — | Dato-input-validering ved UI-grænse. Kritisk — 106 linjer |
| `offentligeYdelserTableValidation.ts` | ✅⚠️ | `utils/offentligeYdelserTableValidation.test.ts` | Rækkevel |
| `aarsloenTableValidation.ts` | ✅⚠️ | `utils/aarsloenTableValidation.test.ts` | Rækkevel |
| `aarsloenValidation.ts` | ❌ | — | Årsløn-validering. Kritisk — 115 linjer |
| `inputValidation.ts` | ❌ | — | Generisk input-validering. Høj |
| `tableValidationCommon.ts` | ❌ | — | Fælles tabel-validering. Høj |
| `zodTypeGuards.ts` | ❌ | — | Zod-baserede typeguards. Høj |

### `src/domain/erstatningsopgoerelse/` (validering)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `tafPeriodConstraints.ts` | ❌ | — | TAF-periodeafgrænsning. Kritisk — 93 linjer |
| `eoNummerValidering.ts` | ❌ | — | EO-nummervvalidering. Høj |

---

## 3. Persistens (Kritisk)

### `src/utils/` (fil-I/O)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `fileLoad.ts` | ⚠️ | `utils/fileLoad.decryptFailure.test.ts` | Kun decrypt-fejl. Mangler: normal load-flow, Zod-parsing, sanitering, preflight |
| `fileSave.ts` | ❌ | — | Fil-save-orkestrering. Kritisk — 787 linjer! |
| `fileHelpers.ts` | ❌ | — | Filoperationshjælpere. Kritisk — 323 linjer |
| `fileHandleStorage.ts` | ❌ | — | IndexedDB-filhåndtering. Kritisk — 590 linjer |
| `serialization.ts` | ❌ | — | JSON-serialisering. Kritisk |
| `encryption.ts` | ✅⚠️ | `utils/encryption.test.ts` | Roundtrip, tampered, wrong key |
| `persistenceLoadSanitization.ts` | ✅⚠️ | `utils/persistenceLoadSanitization.test.ts` | Deep defaults, unknown fields |
| `aarsloenTableLegacySanitization.ts` | ❌ | — | Legacy-sanitering ved load. Kritisk — 211 linjer |
| `nullToUndefinedDeep.ts` | ❌ | — | Deep null→undefined konvertering. Høj |
| `draftNormalization.ts` | ✅⚠️ | `utils/draftNormalization.test.ts` | Unicode-normalisering |
| `eoConverters.ts` | ❌ | — | EO-datakonvertere. Høj |
| `safeLocalStorage.ts` | ❌ | — | Safe localStorage-wrapper. Høj |
| `fileSystemAccess.ts` | ❌ | — | File System Access API wrapper. Høj |

### `src/schemas/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `formSchemas.ts` | ⚠️ | `schemas/formSchemas.test.ts` | Kun tusindtalsseparator-test. Mangler: fuldt schema round-trip, default-værdier, edge cases |
| `eoFileSchema.ts` | ❌ | — | Fil-format-schema ved load. Kritisk |
| `amountExpressionSchema.ts` | ✅⚠️ | `schemas/amountExpressionSchema.test.ts` | Normalisering |

### `src/stores/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `formPersistenceStore.ts` | ✅⚠️ | `stores/formPersistenceStore.*.test.ts` (4 filer) | stamdata, aarsloen, satser, API (atomicitet, fail-closed) |

### `src/contexts/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `FormPersistenceContext.tsx` | ⚠️ | `contexts/FormPersistenceContext.replaceAllPersistedData.rollback.test.tsx` | Kun rollback. Mangler: normal flow, sessionStorage-synk, hydrate, multi-section |

### `src/hooks/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `usePersistedForm.ts` | ❌ | — | Kerne-persistens-hook. Kritisk — 182 linjer |
| `usePersistedActiveTab.ts` | ❌ | — | Tab-persistens. Medium |
| `usePersistedSection.ts` | ❌ | — | Section-persistens. Medium |

### `src/config/` (persistens)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `persistenceDefaults.ts` | ❌ | — | Default-værdier for persisterede sektioner. Høj |
| `persistenceRegistry.ts` | ❌ | — | Registry af persisterede sektioner. Høj |
| `storageManifest.ts` | ❌ | — | Storage-nøglemanifest. Medium |

### `src/settings/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `appSettingsSchema.ts` | ❌ | — | Indstillings-schema. Høj |
| `appSettingsParse.ts` | ❌ | — | Indstillingsparsing. Høj |
| `appSettingsStorage.ts` | ❌ | — | Indstillings-læs/skriv. Høj |

---

## 4. Datoer og kernetyper (Kritisk)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/types/branded.ts` | ✅⚠️ | `types/branded.date.test.ts` | Roundtrip, DST-stabilitet |
| `src/domain/dates/isoDate.ts` | ❌ | — | Branded ISODate-type. Kritisk |
| `src/domain/dates/dateCommit.ts` | ❌ | — | Dato-commit-parsing. Høj |
| `src/utils/dateUtils.ts` | ✅⚠️ | `utils/dateUtils.test.ts` | Dansk parsing, addMonths, DST |
| `src/utils/datePrimitives.ts` | ❌ | — | Primitive dato-operationer. Høj |
| `src/utils/isoDateHelpers.ts` | ❌ | — | ISO-dato-hjælpere. Kritisk — bruges bredt |
| `src/utils/utcDayMath.ts` | ✅⚠️ | `utils/__tests__/utcDayMath.test.ts` | Inklusiv/eksklusiv, DST |
| `src/utils/dateFormatting.ts` | ❌ | — | Dato-formatering. Høj |
| `src/utils/dateRangeErrorMessages.ts` | ✅⚠️ | `utils/dateRangeErrorMessages.test.ts` | In-range, out-of-range, format |

---

## 5. Utilities (Høj)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/utils/numberUtils.ts` | ❌ | — | Talhjælpere |
| `src/utils/numberParsing.ts` | ⚠️ | `utils/__tests__/numberParsing.test.ts` + `utils/__tests__/formatUtils.test.ts` | Kun 3+2 tests. Minimal |
| `src/utils/formatUtils.ts` | ⚠️ | `utils/__tests__/formatUtils.test.ts` | Kun 2 tests. Minimal |
| `src/utils/expressionAmount.ts` | ✅⚠️ | `utils/expressionAmount.test.ts` | 24 cases, grundig |
| `src/utils/amountInputUtils.ts` | ✅⚠️ | `utils/amountInputUtils.test.ts` | Sanitering |
| `src/utils/safeComputation.ts` | ✅⚠️ | `utils/__tests__/safeComputation.test.ts` | Minimal men komplet |
| `src/utils/errorMessages.ts` | ❌ | — | Fejlmeddelelseskonstanter. Medium |
| `src/utils/schemaFingerprint.ts` | ❌ | — | Schema-fingerprint. Medium |
| `src/utils/insertTodayDate.ts` | ❌ | — | Lav |
| `src/utils/bugReport.ts` | ✅⚠️ | `utils/bugReport.test.ts` | Cirkulær ref, BigInt, URL-grænser |

---

## 6. Domain-modeller og hjælpere (Høj)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/domain/rowId.ts` | ❌ | — | RowId branded type. Høj |
| `src/domain/tableModelUtils.ts` | ❌ | — | `parseOptionalIntegerFromString`. Høj |
| `src/domain/tableRowManagement.ts` | ❌ | — | `ensureRowsWithTrailingEmpty`. Høj |
| `src/domain/erstatningsopgoerelse/rowEmpty.ts` | ❌ | — | Række-tomheds-tjek. Høj |
| `src/domain/erstatningsopgoerelse/periodRangeGroups.ts` | ❌ | — | Periodegruppering. Høj |
| `src/domain/erstatningsopgoerelse/rowDateBounds.ts` | ❌ | — | Dato-grænser for rækker. Høj |
| `src/domain/erstatningsopgoerelse/tafArbejdsstatusConfig.ts` | ❌ | — | TAF arbejdsstatus-config. Høj |
| `src/domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues.ts` | ⚠️ | `domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues.udkast.test.ts` | Kun udkast-flag. Mangler: resten af initial values |
| `src/domain/renteberegning/rowEmpty.ts` | ❌ | — | Rente-række-tomhed. Høj |
| `src/domain/stamdata/stamdataInitialValues.ts` | ❌ | — | Stamdata initial values. Høj |
| `src/types/result.ts` | ❌ | — | Result/Either type. Høj |
| `src/types/validation.ts` | ❌ | — | Validerings-resultater. Høj |
| `src/types/loen.ts` | ❌ | — | Løntyper. Høj |

---

## 7. Data-lookup (Medium–Kritisk)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/data/offentligLoenLookup.ts` | ✅⚠️ | `data/offentligLoenLookup.test.ts` + `.missingEntry.test.ts` | Dataintegritet, lookup, fail-hard |
| `src/data/offentligLoenTypes.ts` | ❌ | — | Branded types. Høj |
| `src/data/interestRates.ts` | ❌ | — | Statisk ratetabel. Medium — bør have integritetstjek |
| `src/data/KRLrates.ts` | ❌ | — | KRL-ratetabel. Medium |
| `src/data/regulationRates.ts` | ❌ | — | Reguleringsratetabel. Medium |
| `src/data/overenskomstRates.ts` | ❌ | — | Overenskomstratetabel. Medium |
| `src/data/statistiskLoenudviklingRates.ts` | ❌ | — | Statistisk lønudvikling. Medium |
| `src/data/ydelsestyper.ts` | ✅⚠️ | `data/ydelsestyper.registry.test.ts` | Registreringsintegritet |

---

## 8. Hooks med logik (Høj)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/hooks/useAarsloenBeregning.ts` | ❌ | — | Årsløn-hook. Høj — 263 linjer |
| `src/hooks/useDraftField.ts` | ❌ | — | Draft-field engine. Høj — 331 linjer |
| `src/hooks/useFieldBehavior.ts` | ❌ | — | Felt-adfærd. Høj |
| `src/hooks/useFormFieldErrors.ts` | ❌ | — | Formfelt-fejl. Høj |
| `src/hooks/useOmregningToggle.ts` | ✅⚠️ | `hooks/useOmregningToggle.test.tsx` | Blocking, shake, auto-disable |
| `src/hooks/useAarsloenPdfGates.ts` | ❌ | — | PDF-gate-logik. Medium |

---

## 9. Config med logik (Høj)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/config/dateRanges.ts` | ❌ | — | Juridiske dato-grænser. Høj — 535 linjer! Bruges i validering |
| `src/config/computeSkadesdatoMinRule.ts` | ✅⚠️ | `config/computeSkadesdatoMinRule.test.ts` | Skadestype-baseret min-dato |

---

## 10. PDF-generering (Medium)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/domain/erstatningsopgoerelse/eoPdfModel.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/eoPdfModel.test.ts` | Model-builder, sektionsbetingelser, bilag |
| `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/sharedPdfUtils.test.ts` | 30+ cases |
| `src/utils/pdf/erstatningsopgoerelsePdf.ts` | ✅⚠️ | Flere testfiler (indkomst, udkast, periodFilter) | Grundig dækning |
| `src/utils/pdf/pdfWriter.ts` | ✅⚠️ | `utils/pdf/pdfWriter.layoutFallback.test.ts` | Kun layout-fallback |
| `src/utils/pdf/pdfService.ts` | ✅⚠️ | `utils/pdf/pdfService.test.ts` | Minimal — 3 tests |
| `src/utils/pdf/pdfHelpers.ts` | ✅⚠️ | `utils/pdf/pdfHelpers.test.ts` + `addBrevhoved.gate.test.ts` | Grundig |
| `src/utils/pdf/jsPdfAdapter.ts` | ✅⚠️ | `utils/pdf/jsPdfAdapter.test.ts` | Real jsPDF |
| `src/utils/pdf/pdfBrevhoved.ts` | ✅⚠️ | `utils/pdf/pdfBrevhoved.test.ts` | visBrevhoved for alle PDF-typer |
| `src/utils/pdf/tafFordeltPaaAarPdf.ts` | ✅⚠️ | `utils/pdf/tafFordeltPaaAarPdf.wiring.test.ts` | Wiring, filnavn, negativt TAF |
| `src/utils/pdf/aarsloenPdf.ts` | ❌ | — | Årsløn-PDF. Medium |
| `src/utils/pdf/reguleringPdf.ts` | ❌ | — | Regulerings-PDF. Medium |
| `src/utils/pdf/rentePdf.ts` | ❌ | — | Rente-PDF. Medium |
| `src/utils/pdf/satserPdf.ts` | ❌ | — | Satser-PDF. Medium |
| `src/utils/pdf/shDagePdf.ts` | ❌ | — | SH-dage-PDF. Medium |
| `src/utils/pdf/varigeMenPdf.ts` | ❌ | — | Varigt mén-PDF. Medium |
| `src/utils/pdf/krlPdf.ts` | ❌ | — | KRL-PDF. Medium |
| `src/utils/pdf/pdfTableRenderer.ts` | ❌ | — | Tabel-layout. Medium |
| `src/utils/pdf/erstatningsopgoerelse/sections/*.ts` | ❌ | — | 6 section-renderers. Medium |

---

## 11. Debug-system (Medium)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/domain/debug/eoDebugIntegrity.ts` | ✅⚠️ | `domain/debug/__tests__/eoDebugIntegrity.test.ts` | Overlap, huller, inkonsistens |
| `src/domain/debug/eoDebugSammentaelling.ts` | ✅⚠️ | `domain/debug/eoDebugSammentaelling.test.ts` + `.regression.test.ts` | Sammentælling + regression |
| `src/domain/debug/eoDebugCoreModel.ts` | ✅⚠️ | `domain/debug/__tests__/eoDebugCoreModel.test.ts` | Alle kerneinvarianter |
| `src/domain/debug/eoDebugModel.ts` | ✅⚠️ | `domain/debug/__tests__/eoDebugModel.workdayMarking.test.ts` | Arbejdsdagmarkering |
| `src/domain/debug/eoDebugParity.ts` | ⚠️ | `domain/erstatningsopgoerelse/eoDebugTafOverlapParity.test.ts` | Har kendt fejlende test |
| `src/domain/debug/eoDebugRowAggregator.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/eoDebugRowAggregator.test.ts` | Rækkeopsamling |
| `src/domain/debug/eoDebugLoenCoreModel.ts` | ✅⚠️ | `domain/debug/__tests__/eoDebugLoenCoreModel.test.ts` | Store Bededag, svie/smerte-år |
| `src/domain/debug/eoDebugRegulationCore.ts` | ✅⚠️ | `domain/debug/__tests__/eoDebugRegulationCore.test.ts` | Store Bededag-regel |
| `src/domain/debug/eoDebugSeverity.ts` | ✅⚠️ | `domain/debug/__tests__/eoDebugSeverity.test.ts` | Rank, max |
| `src/domain/debug/eoDebugViewModel.ts` | ✅⚠️ | `domain/debug/__tests__/eoDebugViewModel.test.ts` | Grundig |
| `src/domain/debug/eoDebugDateUtils.ts` | ✅⚠️ | `domain/debug/__tests__/eoDebugDateUtils.test.ts` | Overlap, grænser |
| `src/domain/debug/eoDebugLoenViewModel.ts` | ⚠️ | `domain/debug/__tests__/eoDebugLoenViewModel.test.ts` | Minimal — 2 tests |
| `src/domain/debug/eoDebugRegulationViewModel.ts` | ⚠️ | `domain/debug/__tests__/eoDebugRegulationViewModel.test.ts` | Minimal — 2 tests |
| Øvrige debug-filer | 🔇 | — | Lav prioritet (formattering, CSV, hash, navigation, snapshot) |

---

## 12. Komponent-logik med tests (Input/Table/Layout)

Disse er allerede dækket — her er oversigten:

| Område | Status | Bemærkninger |
|--------|--------|--------------|
| Input-komponenter (commit-kontrakt) | ✅⚠️ | `tableCommitContract.test.tsx` er exceptionel. Alle input-typer dækket |
| Keyboard-navigation (Container) | ✅⚠️ | `Container.test.tsx` tester fuld kontrakt |
| Keyboard-navigation (tables) | ✅⚠️ | 3 testfiler dækker alle table-varianter |
| Table-derived-on-blur | ✅⚠️ | Aarsloen + OffentligeYdelser + BeregningsperiodeFerie |
| Row-focus-management | ✅⚠️ | `tableRowFocus.test.tsx` — 18 tests |
| MainLayout (persistence) | ✅⚠️ | Overwrite, preflight, beforeunload, PWA |
| Fingerprint/no-op | ✅⚠️ | `fingerprintDeterminism.test.ts` + `noopUsesCommittedFingerprint.test.tsx` |

---

## 13. Arkitekturelle guards

| Testfil | Status | Hvad den beskytter |
|---------|--------|--------------------|
| `quality/noDirectLocalStorageAccess.test.ts` | ✅⚠️ | Ingen direkte localStorage |
| `quality/noDirectSessionStorageAccess.test.ts` | ✅⚠️ | Ingen direkte sessionStorage |
| `quality/mojibake.test.ts` | ✅⚠️ | Tegnkodningsintegritet |
| `quality/eetDomainIsolation.test.ts` | ✅⚠️ | EET-domæneisolation |

---

## Strukturelle problemer

✅ **Løst 2026-02-22** — Al testplacering er nu konsolideret under `src/__tests__/`:

- Alle 11 filer fra `src/domain/debug/__tests__/` er flyttet til `src/__tests__/domain/debug/` med opdaterede import-stier
- Alle 8 filer fra `src/utils/__tests__/` er flyttet til `src/__tests__/utils/` med opdaterede import-stier
- `src/domain/erstatningsopgoerelse/__tests__/tafCalculations.test.ts` er konverteret til `src/__tests__/domain/erstatningsopgoerelse/tafCalculations.kalenderdage.test.ts` (testede andre funktioner end den eksisterende kanoniske fil)
- `src/__tests__/utils/noDirectSessionStorageAccess.test.ts` er flyttet til `src/__tests__/quality/noDirectSessionStorageAccess.test.ts`
- `src/__tests__/minimal.test.ts` er slettet

**Verificeret:** 140 testfiler, 1012 tests — alle grønne.

---

## Opsummering

### Kritiske mangler (prioriteret)

1. **Persistens-flow**: `fileSave.ts`, `fileHelpers.ts`, `fileHandleStorage.ts`, `serialization.ts` — ingen af de store persistensfiler har meningsfulde tests
2. **Årsløn-beregning**: `aarsloenCalculations.ts` — 203 linjer uden tests
3. **Varigt mén-beregning**: `varigeMenCalculations.ts` — 150 linjer uden tests
4. **TAF-hjælpere**: `tafRowDerived.ts`, `tafDaySets.ts` — kernelogik uden tests
5. **Aggregation-adaptere**: `aggregationAdapters.ts` — broer formdata til engine-input
6. **Indkomstperioder**: `indtaegtPerioder.ts` — 399 linjer, kun fail-closed-test
7. **Schema/fil-format**: `eoFileSchema.ts`, `formSchemas.ts` — utilstrækkelig dækning
8. **Policy-filer**: `erstatningsopgoerelse.policy.ts`, `erstatningsopgoerelseAggregationPolicy.ts`, `aarsloenPolicy.ts`
9. **Date-infrastruktur**: `isoDateHelpers.ts`, `dateInputValidation.ts`, `isoDate.ts`
10. **Rente-engine**: `renteEngine.ts` — kerne-engine uden tests
11. **Satser/stamdata-beregning**: `satserCalculations.ts`, `stamdataCalculations.ts`
12. **Validering**: `aarsloenValidation.ts`, `tafPeriodConstraints.ts`, `indkomstRowValidation.ts`
13. **Legacy-sanitering**: `aarsloenTableLegacySanitization.ts` — 211 linjer persistens-kritisk kode

### Statistik

- Kildefiler der bør testes: ~120
- Filer med tests: ~55
- Filer med grundig dækning: ~40
- Filer med delvis dækning: ~8
- Filer helt uden tests: ~65
- Kvalitetssikrede tests: 0 (alle eksisterende afventer review)
