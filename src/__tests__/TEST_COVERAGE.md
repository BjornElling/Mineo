# TEST_COVERAGE.md — Mineo Testdækning

**Sidst opdateret:** 2026-02-23 (session 5: tafBeregningsEngine +6 tests, reguleringFormulaUtils 2→57 tests, ferieCalculations 3→10 tests, offentligeYdelserDerived 3→9 tests, aggregationEngine 5→14 tests (rounding strategies + array paths), domain/calculations + varigemen alle ✅)
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
| `erstatningsopgoerelseAggregationEngine.ts` | ✅ | `domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationEngine.test.ts` | 14 tests: computed-only sign+rounding, fail-closed (missing/invalid), determinisme, alle when-strategier (perLineThenTotal/onlyTotal/perLine/none), roundingOverride (method/none), nested dot-path, array [0]/[1], out-of-bounds→missing_computed, null-intermediate→missing_computed |
| `erstatningsopgoerelseAggregationPolicy.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationPolicy.test.ts` | 25 tests: schema-validering, alle enum-værdier, duplikat-id — mangler: strategy enum eksklusivitet (kun computedOnly), roundingOverride med method=none, whitespace i id, precision øvre grænse |
| `periodiseringsMotor.ts` | ✅ | `domain/erstatningsopgoerelse/periodiseringsMotor.test.ts` | 18 tests: periodiserBeloebForMaaneder/Arbejdsdage/OffentligYdelse (apportionment, DST, delår), buildLoenArbejdsdageSet, optaelMaaneder(Praecis/Afrundet) null-cases, isOffentligYdelseDatoMedregnet (sygedagpenge cutoff, arbejdsdage weekend/SH, kalenderdage alle-dage) |
| `tafBeregningsEngine.ts` | ✅ | `domain/erstatningsopgoerelse/tafBeregningsEngine.test.ts` | 15 tests: Måneder/Arbejdsdage, loseFeriedage-summering på merged grupper, null-aggregation (alle rækker ugyldige), tom input, invalide rækker i output, bounds-clamping |
| `tafCalculations.ts` | ✅ | `domain/erstatningsopgoerelse/tafCalculations.test.ts` | 15 tests: calculateKalenderdageInclusive (DST, reversed), calculateTafAntalMaaneder (fuld mdr, SH-fradrag, null-cases), calculateTafAntalMaanederPraecis (uafrundet fraktion, null-cases) |
| `tafPerYearDerived.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/tafPerYearDerived.test.ts` | 18 tests: Årsbuckets, negativt TAF — mangler: loenudviklingTotal.status != 'ok', tafArbejdsdageSet null med arbejdsdage, allocateOreByWeight allWeights=0 |
| `tafRowDerived.ts` | ✅ | `domain/erstatningsopgoerelse/tafRowDerived.test.ts` | Måneder/arbejdsdage, clamping, null-cases, feriedage, loseFeriedage=undefined, determinisme |
| `tafBeregningsenhed.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/tafBeregningsenhed.test.ts` | 12 tests: alle beregningsenhed-paths — mangler: fraDate>tilDate, tom loenindkomstAnsaettelsesforhold, boundary overlap |
| `tafDaySets.ts` | ✅ | `domain/erstatningsopgoerelse/tafDaySets.test.ts` | Alle 6 funktioner: isWeekdayUtc, buildDatoSetInclusive(FromDates), buildFerieDageSet, buildShDageSet, buildShDageSetFromIsoRange, placeLoseFeriedage — DST, skudår, SH, overlappende ferie, NaN/Inf/negative count |
| `ferieCalculations.ts` | ✅ | `domain/erstatningsopgoerelse/ferieCalculations.test.ts` | 10 tests: undefined fra/til→null, fra>til→null, fuld uge, SH-fradrag, Math.max(0,...), multi-år grænse |
| `reguleringFormulaUtils.ts` | ✅ | `domain/erstatningsopgoerelse/reguleringFormulaUtils.test.ts` | 57 tests: computeFormulaValue (NaN/Inf/nul), parsePercentInput (dansk komma, tusind-sep, NaN), resolveFeriePctForFormula (fallback), formatPercentCellFromRaw (undefined/-/malformed), mergeFeriepengeDisplay (alle 4 grene), wrapIndexFormulaAfterSlashWhenLong (kort/lang/newline/custom-max), formatOverenskomstPercent/Amount (null/undef/0/tal), buildFormulaText (ingen/en/to faktorer, visibility-flags) |
| `offentligeYdelserDerived.ts` | ✅ | `domain/erstatningsopgoerelse/offentligeYdelserDerived.test.ts` | 9 tests: ydelsestype mangler→null, kalenderdage (10 dage), ugyldig periode, periodiseringLabel (dagpenge/sygedagpenge/ukendt), antalDage sat men ydelsePerDag null, ydelse+tillaeg sum, kun tillaeg |
| `angivetLoenHelpers.ts` | ✅ | `domain/erstatningsopgoerelse/angivetLoenHelpers.test.ts` | 12 tests: resolveLoenudviklingKilde (alle 3 beregnesUdFra + dagsløn success + alle 3 loenPaaHelligdage), LoenudviklingKildeError (code/name), getAngivetLoenBaseretPaa (alle 3 grene), getAngivetLoenOpreguleresFraDato (alle 3 grene) |
| `arbejdsdageMaaneder.ts` | ✅ | `domain/erstatningsopgoerelse/arbejdsdageMaaneder.test.ts` | 7 tests: enkelt hverdag, hel januar (23 arbejdsdage), SH+ferie=0, lørdag+søndag=0, SH+ferie samme dag=0 (ikke negativ), årsgrænse, tom SH+ferie=5 |
| `indtaegtPerioder.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/indtaegtPerioder.failClosed.test.ts` + `indtaegtPerioder.test.ts` | buildTafRanges, buildBeregningsperiodeRange, buildIncomeCalculationContext + fail-closed |
| `periodMerging.ts` | ✅ | `domain/erstatningsopgoerelse/periodMerging.test.ts` | 12 tests: tom liste, enkelt, overlappende, adjacent (mergeAdjacent=true/false), samme fra-dato (sort by til), nested range, tre uafhængige, mergeDateRanges (Date-objekter) |
| `periodOverlapDetection.ts` | ✅ | `domain/erstatningsopgoerelse/periodOverlapDetection.test.ts` | 12 tests: tom liste, enkelt, separate, grænsedag-overlap, ugyldige rækker, 3 overlappende — detectConflictingSvieSmerteOverlaps: tom, enkelt, forskellig tilstand, samme tilstand, undefined tilstand |
| `beregningsperiodeTafOverlap.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/beregningsperiodeTafOverlap.test.ts` | 2 tests — mangler: fra>til validation, rangesOverlap edge cases, formatISOForMessage null-path, tom tafPerioder |
| `aarsloenRowInterval.ts` | ✅ | `domain/erstatningsopgoerelse/aarsloenRowInterval.test.ts` | 39 tests: Alle 3 lønperioder (maaned/uge/dag), skudår, DST, nytår, grænseår (1900/2100), whitespace, ugyldige datoer |
| `aggregationAdapters.ts` | ✅ | `domain/erstatningsopgoerelse/aggregationAdapters.test.ts` | 27 tests: Alle 4 adaptere, null/NaN/Infinity, sumFinite, null første i liste, negativ varigeMen, partial emptiness (dato sat, beloeb undefined→null) |
| `indkomstRowValidation.ts` | ✅ | `domain/erstatningsopgoerelse/indkomstRowValidation.test.ts` | 38 tests: Alle 4 funktioner, alle lønperioder, datoformat, rækkefølgefejl, null-paths (implicit), error-set |
| `loenudviklingManuelBaseRowValidation.ts` | ✅ | `domain/erstatningsopgoerelse/loenudviklingManuelBaseRowValidation.test.ts` | 10 tests: baseRow undefined, tolerance (0.01), ugyldig streng→0, null→0, mismatch-fejlformat |
| `tafPeriodConstraints.ts` | ✅ | `domain/erstatningsopgoerelse/tafPeriodConstraints.test.ts` | 32 tests: Alle 5 funktioner, clamp, EET-constraint, verserende klage — alle branches undtagen minDefined edge case (implicit) |
| `eoNummerValidering.ts` | ✅ | `domain/erstatningsopgoerelse/eoNummerValidering.test.ts` | undefined/empty, whitespace, tal (1/2/9/12/10/1A/1a/2A), bogstav, specialtegn-præfix |
| `rowEmpty.ts` | ✅ | `domain/erstatningsopgoerelse/rowEmpty.test.ts` | Alle 4 row-typer: tom, hvert felt sat, 0≠undefined, id ignoreres |
| `rowDateBounds.ts` | ✅ | `domain/erstatningsopgoerelse/rowDateBounds.test.ts` | Fra/til-bounds alle grene: skadesdatoMinDate, rowTil/fraMax, rowFra/tilMin, tilExtraMaxDate (min), useTilExtraMaxDate=false, fuld kombineret scenarie |
| `tafArbejdsstatusConfig.ts` | ✅ | `domain/erstatningsopgoerelse/tafArbejdsstatusConfig.test.ts` | CONFIG-integritet (11 nøgler), buildTafArbejdsstatusLinje: alle 11 statuser, suffix-normalisering, dato-output |
| `periodRangeGroups.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/periodRangeGroups.test.ts` | normalizeBilagMode, buildPeriodRangeGroups: Alle/Perioden, første/anden opgørelse, TAF, konstanterne |
| `erstatningsopgoerelseInitialValues.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues.test.ts` + `.udkast.test.ts` | Schema-validering, settings-integration, alle defaults |

### `src/domain/renteberegning/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `renteberegningEngine.ts` | ✅⚠️ | `domain/renteberegning/renteberegningEngine.test.ts` | 6 tests — mangler: !renterFra med gyldig beregningsdato, datokonverteringsfejl, tom rentekravRows, null fra interest-calculator, blandet valid/invalid rækker |
| `renteEngine.ts` | ✅⚠️ | `domain/renteberegning/renteEngine.test.ts` | 21 tests: calculateActualInterestDate (alle enheder, overflow, negativ), computeRentekravCalculation — mangler: fejlsti i calculateInterestDate, catch-blok, belob=0, datokonverteringsfejl |
| `rowEmpty.ts` | ✅ | `domain/renteberegning/rowEmpty.test.ts` | 6 tests: alle felter, 0≠undefined, enhed ignoreres — komplet |

### `src/domain/varigemen/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `varigeMenCalculations.ts` | ✅ | `domain/varigemen/varigeMenCalculations.test.ts` | Alle aldersfradrag-grænser, afrunding, rate-lookup, negativ/null inputs |
| `varigeMenEngine.ts` | ✅ | `domain/varigemen/varigeMenEngine.test.ts` | Orchestrering: manglende data, fuldt beregningsflow, alle inputs |

### `src/domain/aarsloen/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `aarsloenCalculations.ts` | ✅⚠️ | `domain/aarsloen/aarsloenCalculations.test.ts` | 27 tests: beregnMetode (alle 3), beregnOmregnetAarsloen (A/B/C, null) — mangler: shDageAntal > hverdageIPeriode, NaN-koercering af antalFeriedage, negativ beregnetAarsloen |

### `src/domain/calculations/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `aarsloenPolicy.ts` | ✅ | `domain/calculations/aarsloenPolicy.test.ts` | Alle 5 policy-funktioner: resolveAarsloenPolicy, getActivePolicies, getPolicyLabel, isPolicyAvailable, getPolicyCount |
| `satserCalculations.ts` | ✅ | `domain/calculations/satserCalculations.test.ts` | resolveSatserEffectiveAargang, canDownloadSatser, hasSatserAny — alle branches |
| `stamdataCalculations.ts` | ✅ | `domain/calculations/stamdataCalculations.test.ts` | resolveStamdataDatoLabel, hasStamdataAny — alle branches |

### `src/calculation/pipeline/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `erstatningsopgoerelseAggregationPipeline.ts` | ✅⚠️ | `calculation/erstatningsopgoerelseAggregationPipeline.test.ts` + `.orchestration.test.ts` | Fail-closed, totaler |

### `src/calculation/policy/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `erstatningsopgoerelse.policy.ts` | ✅⚠️ | `calculation/erstatningsopgoerelsePolicy.test.ts` | Struktur, linje-ids, sign-konfiguration |

### `src/utils/` (beregning)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `rounding.ts` | ✅⚠️ | `utils/rounding.test.ts` | halfAwayFromZero, floor/ceil, -0, NaN |
| `interestCalculator.ts` | ✅⚠️ | `utils/interestCalculator.test.ts` | DST-regression |
| `interestDomain.ts` | ✅⚠️ | `utils/interestDomain.test.ts` | calculateInterestDate (tillaegstid≤0, enheder, fejl), validateInterestCalculation |
| `periodeBeregning.ts` | ✅⚠️ | `utils/periodeBeregning.test.ts` | DST, skudår, uge 53 |
| `shDageBeregning.ts` | ✅ | `utils/beregnHelligdageMedNavn.test.ts` | 20 tests: beregnHelligdageMedNavn (alle navne, Store Bededag 2023/2024, dato-match), beregnSHDage (fra>til→0, hverdag/weekend-helligdag, grænseværdier, multi-år), beregnSHDageForDatoSet (tomt set, ikke-helligdag, weekend-helligdag, blandet) |
| `aarsloenTableCalculations.ts` | ✅⚠️ | `utils/aarsloenTableCalculations.test.ts` | Formel, ATP, pension |

---

## 2. Validering (Kritisk)

### `src/validators/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `erstatningsopgoerelseValidator.ts` | ✅ | `validators/erstatningsopgoerelseValidator.test.ts` | 51 tests: forlig, svie/smerte (inkl. beregnes=Nej, tidligereSsMax=Ja, fra>til, manglende fra/tilstand), TAF (fra mangler alene), validateBeregnesUdFra (dagsløn, bp-fra>til), validateLoenudviklingKonsistens (uens grundlag/overenskomst/statistik, multi-AF), validateLoenudviklingsKravForAktivKilde (Statistik, KRL, Manuel), øvrige krav (dato mangler, beloeb mangler), standalone (vedroererPeriode fra>til) |

### `src/utils/` (validering)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `dateInputValidation.ts` | ✅⚠️ | `utils/dateInputValidation.test.ts` | isValidDate, interpretYear, isDateFormatValid, validateDateRange |
| `offentligeYdelserTableValidation.ts` | ✅⚠️ | `utils/offentligeYdelserTableValidation.test.ts` | Rækkevel |
| `aarsloenTableValidation.ts` | ✅⚠️ | `utils/aarsloenTableValidation.test.ts` | Rækkevel |
| `aarsloenValidation.ts` | ✅⚠️ | `utils/aarsloenValidation.test.ts` | beregnFejlmeddelelser (5 fejltyper), harTabelValideringsFejl (partial period), harTabelData |
| `inputValidation.ts` | ✅⚠️ | `utils/inputValidation.test.ts` | shouldClearField, trimValue |
| `tableValidationCommon.ts` | ✅⚠️ | `utils/tableValidationCommon.test.ts` | isZeroOnlyString, isAmountValueStrict (DEV-throw), isEffectivelyEmptyNumber |
| `zodTypeGuards.ts` | ✅⚠️ | `utils/zodTypeGuards.test.ts` | isLoenperiodeValue, isLoenPaaHelligdageValue |

---

## 3. Persistens (Kritisk)

### `src/utils/` (fil-I/O)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `fileLoad.ts` | ⚠️ | `utils/fileLoad.decryptFailure.test.ts` | Kun decrypt-fejl. Mangler: normal load-flow |
| `fileSave.ts` | ❌ | — | Kritisk — 787 linjer. Browser File API svær at mocke |
| `fileHelpers.ts` | ❌ | — | Kritisk — 323 linjer |
| `fileHandleStorage.ts` | ❌ | — | Kritisk — 590 linjer |
| `serialization.ts` | ✅⚠️ | `utils/serialization.test.ts` | undefined→null, primitiver, arrays, nested, JSON round-trip |
| `encryption.ts` | ✅⚠️ | `utils/encryption.test.ts` | Roundtrip, tampered, wrong key |
| `persistenceLoadSanitization.ts` | ✅⚠️ | `utils/persistenceLoadSanitization.test.ts` | Deep defaults, unknown fields |
| `aarsloenTableLegacySanitization.ts` | ✅⚠️ | `utils/aarsloenTableLegacySanitization.test.ts` | col10→col5 migration, id-fallback, EO migrering |
| `nullToUndefinedDeep.ts` | ✅⚠️ | `utils/nullToUndefinedDeep.test.ts` | Deep null→undefined, JSON round-trip |
| `draftNormalization.ts` | ✅⚠️ | `utils/draftNormalization.test.ts` | Unicode-normalisering |
| `eoConverters.ts` | ✅⚠️ | `utils/eoConverters.test.ts` | initialRow, ID-generatorer (prefix, uniqueness), initial rows |
| `safeLocalStorage.ts` | ✅⚠️ | `utils/safeLocalStorage.test.ts` | getItem/setItem/removeItem, in-memory fallback i Node |
| `fileSystemAccess.ts` | ❌ | — | File System Access API wrapper. Browser API — svær at teste i Node |

### `src/schemas/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `formSchemas.ts` | ⚠️ | `schemas/formSchemas.test.ts` | Kun tusindtalsseparator + AES-test. Mangler: fuldt round-trip for alle sektioner |
| `eoFileSchema.ts` | ✅⚠️ | `schemas/eoFileSchema.test.ts` | eoFileDataSchema (null→undef), eoFileDataLoadSchema (passthrough), eoFileContainerSchema (strict) |
| `amountExpressionSchema.ts` | ✅⚠️ | `schemas/amountExpressionSchema.test.ts` | Normalisering |

### `src/stores/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `formPersistenceStore.ts` | ✅⚠️ | `stores/formPersistenceStore.*.test.ts` (4 filer) | stamdata, aarsloen, satser, API |

### `src/contexts/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `FormPersistenceContext.tsx` | ⚠️ | `contexts/FormPersistenceContext.replaceAllPersistedData.rollback.test.tsx` | Kun rollback |

### `src/hooks/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `usePersistedForm.ts` | ❌ | — | Kerne-persistens-hook. Kritisk — 182 linjer |
| `usePersistedActiveTab.ts` | ❌ | — | Tab-persistens. Medium |
| `usePersistedSection.ts` | ❌ | — | Section-persistens. Medium |

### `src/config/` (persistens)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `persistenceDefaults.ts` | ✅⚠️ | `config/persistenceDefaults.test.ts` | Defaults, settings-fallback, determinisme |
| `persistenceRegistry.ts` | ✅⚠️ | `config/persistenceRegistry.test.ts` | persistenceSchemas (alle 6 StorageKeys), fingerprint |
| `storageManifest.ts` | ✅⚠️ | `config/storageManifest.test.ts` | Keys, isValidStorageKey, createActiveTabKey |

### `src/settings/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `appSettingsSchema.ts` | ✅⚠️ | `settings/appSettingsSchema.test.ts` | Schema, DEFAULT_*, brevhoved, resolveDefaultOverenskomstFilter |
| `appSettingsParse.ts` | ✅⚠️ | `settings/appSettingsParse.test.ts` | parseStoredSettings: null/undefined/array/partial/ugyldig/tolerant |
| `appSettingsStorage.ts` | ✅⚠️ | `settings/appSettingsStorage.test.ts` | LOCAL_STORAGE_KEY, readLocalStorage, writeLocalStorage |

---

## 4. Datoer og kernetyper (Kritisk)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/types/branded.ts` | ✅⚠️ | `types/branded.date.test.ts` | Roundtrip, DST-stabilitet |
| `src/domain/dates/isoDate.ts` | ✅⚠️ | `domain/dates/isoDate.test.ts` | parseIsoDateOrUndefined→ISODateString, isoDateToDate→Date, DST-safe |
| `src/domain/dates/dateCommit.ts` | ✅⚠️ | `domain/dates/dateCommit.test.ts` | commitIsoDateFromDraftString: tom/whitespace/dansk/ISO |
| `src/utils/dateUtils.ts` | ✅⚠️ | `utils/dateUtils.test.ts` | Dansk parsing, addMonths, DST |
| `src/utils/datePrimitives.ts` | ✅⚠️ | `utils/datePrimitives.test.ts` | createDate UTC-baseret, DST-safe |
| `src/utils/isoDateHelpers.ts` | ✅⚠️ | `utils/isoDateHelpers.test.ts` | validateIsoRange, iterateDatesInclusive, validateISODateRange |
| `src/utils/utcDayMath.ts` | ✅⚠️ | `utils/utcDayMath.test.ts` | Inklusiv/eksklusiv, DST |
| `src/utils/dateFormatting.ts` | ✅⚠️ | `utils/dateFormatting.test.ts` | formatIsoDateShort→dd-mm-yyyy, Long→dansk månedsnavn |
| `src/utils/dateRangeErrorMessages.ts` | ✅⚠️ | `utils/dateRangeErrorMessages.test.ts` | In-range, out-of-range, format |

---

## 5. Utilities (Høj)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/utils/numberUtils.ts` | ✅ | `utils/numberUtils.test.ts` | toNonNegativeInt: NaN/Inf→0, negative→0, trunkering |
| `src/utils/numberParsing.ts` | ✅ | `utils/numberParsing.test.ts` | parsePercentToDecimal (alle cases inkl. undefined/number/komma/punkt), parseAmount (alle typer) |
| `src/utils/formatUtils.ts` | ✅⚠️ | `utils/formatUtils.test.ts` | formatPercent, formatCurrency, formatAsAmount, isSingularCount, formatCountWithUnit |
| `src/utils/expressionAmount.ts` | ✅ | `utils/expressionAmount.test.ts` | 44 cases: parseAmountInput (24), amountValueToNumber, amountValueToDisplayString, amountValueToDraftString, isExpressionErrorMessage, formatExpressionErrorMessage |
| `src/utils/amountInputUtils.ts` | ✅ | `utils/amountInputUtils.test.ts` | sanitizePastedAmount, containsAnyDigit, normalizeTrailingSeparator, normalizeZero |
| `src/utils/safeComputation.ts` | ✅ | `utils/safeComputation.test.ts` | success, Error-kast, ikke-Error-kast, undefined/object value |
| `src/utils/serialization.ts` | ✅ | `utils/serialization.test.ts` | undefined→null, primitiver, nested arrays/objekter, round-trip JSON |
| `src/utils/nullToUndefinedDeep.ts` | ✅ | `utils/nullToUndefinedDeep.test.ts` | primitiver, nested, arrays, round-trip JSON parse |
| `src/utils/inputValidation.ts` | ✅ | `utils/inputValidation.test.ts` | shouldClearField (alle branches), trimValue |
| `src/utils/tableValidationCommon.ts` | ✅ | `utils/tableValidationCommon.test.ts` | ZERO_ONLY_PATTERN, isZeroOnlyString, isAmountValueStrict (DEV-throw), isEffectivelyEmptyNumber |
| `src/utils/zodTypeGuards.ts` | ✅ | `utils/zodTypeGuards.test.ts` | isLoenperiodeValue, isLoenPaaHelligdageValue (alle typer) |
| `src/utils/aarsloenTableLegacySanitization.ts` | ✅ | `utils/aarsloenTableLegacySanitization.test.ts` | aarsloen: col10 migration, id-fallback, ukendt nøgle, advarsler; eo: fuldLoenUnderFerie/loenPaaHelligdage migration |
| `src/utils/aarsloenValidation.ts` | ✅ | `utils/aarsloenValidation.test.ts` | beregnFejlmeddelelser (alle 5 fejltyper + kombination), harTabelValideringsFejl (partial period), harTabelData |
| `src/utils/interestDomain.ts` | ✅ | `utils/interestDomain.test.ts` | calculateInterestDate (alle enheder, ≤0, fejl), validateInterestCalculation (alle fejlkoder, success) |
| `src/utils/dateInputValidation.ts` | ✅ | `utils/dateInputValidation.test.ts` | isValidDate (skudår, grænser), interpretYear (1/2/3/4 cifre), isDateFormatValid, validateDateRange (bounds, tom, ugyldig) |
| `src/utils/errorMessages.ts` | ✅ | `utils/errorMessages.test.ts` | ERROR_MESSAGES (alle nøgler), CalculationError (code/name/message/cause/stack), getUserMessage, isCalculationError |
| `src/utils/schemaFingerprint.ts` | ✅ | `utils/schemaFingerprint.test.ts` | Determinisme, rækkefølgeuafhængighed, fnv1a-format, ændringsfølsomhed, nested |
| `src/utils/insertTodayDate.ts` | ✅ | `utils/insertTodayDate.test.ts` | onCommit (ISO-format, tidspunkt), focusRef=null, mock input, ingen focusRef |
| `src/utils/bugReport.ts` | ✅⚠️ | `utils/bugReport.test.ts` | Cirkulær ref, BigInt, URL-grænser |
| `src/utils/eoConverters.ts` | ✅ | `utils/eoConverters.test.ts` | initialRow, alle ID-generatorer (prefix, uniqueness), initialOffentligYdelseRow, initialLoenudviklingManuelRow |
| `src/utils/safeLocalStorage.ts` | ✅ | `utils/safeLocalStorage.test.ts` | getItem/setItem/removeItem, overwrite, remove-nonexistent, tom streng key/value |

---

## 6. Domain-modeller og hjælpere (Høj)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/domain/rowId.ts` | ✅⚠️ | `domain/rowId.test.ts` | createRowId: prefix, uniqueness — fallback-paths (getRandomValues/Date.now) er utestbare uden mocking |
| `src/domain/tableModelUtils.ts` | ✅ | `domain/tableModelUtils.test.ts` | parseOptionalIntegerFromString: valid, whitespace, parseInt-quirks ("12abc"→12), decimaler |
| `src/domain/tableRowManagement.ts` | ✅ | `domain/tableRowManagement.test.ts` | ensureRowsWithTrailingEmpty: tom liste, all-empty, non-empty, mixed, reuse trailing empty, rækkefølge |
| `src/domain/erstatningsopgoerelse/rowEmpty.ts` | ✅ | `domain/erstatningsopgoerelse/rowEmpty.test.ts` | Alle 4 row-typer: tom, hvert felt sat, id ignoreres, 0≠undefined |
| `src/domain/erstatningsopgoerelse/periodRangeGroups.ts` | ❌ | — | Høj — afhænger af fuldt eoValues-objekt |
| `src/domain/erstatningsopgoerelse/rowDateBounds.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/rowDateBounds.test.ts` | fra/til-bounds, skadesdato, tilExtraMaxDate |
| `src/domain/erstatningsopgoerelse/tafArbejdsstatusConfig.ts` | ✅ | `domain/erstatningsopgoerelse/tafArbejdsstatusConfig.test.ts` | Alle 11 statuser, CONFIG-integritet, buildTafArbejdsstatusLinje, suffix-normalisering |
| `src/domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues.test.ts` + `.udkast.test.ts` | Schema-validering, settings-integration, defaults |
| `src/domain/renteberegning/rowEmpty.ts` | ✅ | `domain/renteberegning/rowEmpty.test.ts` | isRentekravRowEmpty: alle felter, 0≠undefined, enhed ignoreres |
| `src/domain/stamdata/stamdataInitialValues.ts` | ✅⚠️ | `domain/stamdata/stamdataInitialValues.test.ts` | Schema-validering, tekstfelter=tom, valgfrie=undefined |
| `src/types/result.ts` | ✅ | `types/result.test.ts` | ok, err, isErr type guard; null/undefined/objekt-værdier; type narrowing |
| `src/types/validation.ts` | ✅ | `types/validation.test.ts` | Type-kontrakt: ValidationError, ValidationResult, FormValidator, alle severity-niveauer |
| `src/types/loen.ts` | ✅ | `types/loen.test.ts` | LOENPERIODE, LOEN_PAA_HELLIGDAGE: nøgler, unikhed, satisfies-kontrakt |

---

## 7. Data-lookup (Medium–Kritisk)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/data/offentligLoenLookup.ts` | ✅⚠️ | `data/offentligLoenLookup.test.ts` + `.missingEntry.test.ts` | Dataintegritet, lookup, fail-hard |
| `src/data/offentligLoenTypes.ts` | ✅⚠️ | `data/offentligLoenTypes.test.ts` | toLoentrin (grænseværdier, fejl), resolveOffentligLoenTypeFromLabel |
| `src/data/interestRates.ts` | ✅⚠️ | `data/interestRates.test.ts` | 7 tests: Format, kendte satser, MIN_CALCULATION_DATE — mangler: CURRENT_YEAR/MAX_CALCULATION_YEAR, egentlig sorteringsvalidering |
| `src/data/KRLrates.ts` | ✅⚠️ | `data/KRLrates.test.ts` | 13 tests: 5 exports dækket — mangler: formatKRLSatstabelDisplay fuld output-format, getReguleringsDatoIntervalForKRL beregningslogik |
| `src/data/regulationRates.ts` | ✅⚠️ | `data/regulationRates.test.ts` | 27 tests: getYearBoundsFor*, getSatserForYear — mangler: fuld objektstruktur, 2024 split-værdier, intersection med 3 dicts |
| `src/data/overenskomstRates.ts` | ✅ | `data/overenskomstRates.test.ts` | 68 tests: dataintegritet, getOverenskomstMetaById (legacy suffix), resolveDisplay, getOverenskomsterByOrg, orgs, isOffentlig, getOffentligType, getReguleringsDatoInterval, getEffektiveSatserFor*, resolveOverenskomstRef (strukturel parse, legacy, offentlig), getGrundloenAngivetPerForOverenskomst (KL/RLTN med/uden tafBeregnesSom), getOffentligTillaegsSatserForDato/ForPeriode |
| `src/data/statistiskLoenudviklingRates.ts` | ✅⚠️ | `data/statistiskLoenudviklingRates.test.ts` | 15 tests: integritet, getReguleringsDatoIntervalForStatistikModel — mangler: kvartalToNumber/StartDato helpers, korrekt type-assertion i getStatistiskLoenudvikling-tests |
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
| `src/config/dateRanges.ts` | ✅⚠️ | `config/dateRanges.test.ts` | TODAY/MIN_YEAR/MAX_YEAR, stamdata/EO-ranges (type, dynamic, unconstrained), computeSkadesdatoMinRule (alle branches inkl. skudår) |
| `src/config/computeSkadesdatoMinRule.ts` | ✅⚠️ | `config/computeSkadesdatoMinRule.test.ts` | Skadestype-baseret min-dato |
| `src/config/persistenceDefaults.ts` | ✅⚠️ | `config/persistenceDefaults.test.ts` | Defaults, settings-fallback, determinisme |
| `src/config/storageManifest.ts` | ✅⚠️ | `config/storageManifest.test.ts` | Keys, isValidStorageKey, createActiveTabKey |
| `src/config/persistenceRegistry.ts` | ✅⚠️ | `config/persistenceRegistry.test.ts` | persistenceSchemas (alle 6 StorageKeys, alle har .parse), fingerprint |
| `src/settings/appSettingsSchema.ts` | ✅⚠️ | `settings/appSettingsSchema.test.ts` | 17 tests: Schema, DEFAULT_*, resolveDefaultOverenskomstFilter — mangler: defaultLoenPaaHelligdage enum (SH-udbetaling/Ingen), loadInitialSettings |
| `src/settings/appSettingsParse.ts` | ✅⚠️ | `settings/appSettingsParse.test.ts` | 12 tests: parseStoredSettings alle cases — mangler: loadInitialSettings (3 branches helt utestet), partial brevhovedIndstillinger merge |
| `src/settings/appSettingsStorage.ts` | ✅⚠️ | `settings/appSettingsStorage.test.ts` | 9 tests: alle 3 exports — mangler: writeLocalStorage catch-path (silent fail), localStorage throws |

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
| `src/domain/debug/eoDebugIntegrity.ts` | ✅⚠️ | `domain/debug/eoDebugIntegrity.test.ts` | Overlap, huller, inkonsistens |
| `src/domain/debug/eoDebugSammentaelling.ts` | ✅⚠️ | `domain/debug/eoDebugSammentaelling.test.ts` + `.regression.test.ts` | Sammentælling + regression |
| `src/domain/debug/eoDebugCoreModel.ts` | ✅⚠️ | `domain/debug/eoDebugCoreModel.test.ts` | Alle kerneinvarianter |
| `src/domain/debug/eoDebugModel.ts` | ✅⚠️ | `domain/debug/eoDebugModel.workdayMarking.test.ts` | Arbejdsdagmarkering |
| `src/domain/debug/eoDebugParity.ts` | ⚠️ | `domain/erstatningsopgoerelse/eoDebugTafOverlapParity.test.ts` | Har kendt fejlende test |
| `src/domain/debug/eoDebugRowAggregator.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/eoDebugRowAggregator.test.ts` | Rækkeopsamling |
| `src/domain/debug/eoDebugLoenCoreModel.ts` | ✅⚠️ | `domain/debug/eoDebugLoenCoreModel.test.ts` | Store Bededag, svie/smerte-år |
| `src/domain/debug/eoDebugRegulationCore.ts` | ✅⚠️ | `domain/debug/eoDebugRegulationCore.test.ts` | Store Bededag-regel |
| `src/domain/debug/eoDebugSeverity.ts` | ✅⚠️ | `domain/debug/eoDebugSeverity.test.ts` | Rank, max |
| `src/domain/debug/eoDebugViewModel.ts` | ✅⚠️ | `domain/debug/eoDebugViewModel.test.ts` | Grundig |
| `src/domain/debug/eoDebugDateUtils.ts` | ✅⚠️ | `domain/debug/eoDebugDateUtils.test.ts` | Overlap, grænser |
| `src/domain/debug/eoDebugLoenViewModel.ts` | ⚠️ | `domain/debug/eoDebugLoenViewModel.test.ts` | Minimal — 2 tests |
| `src/domain/debug/eoDebugRegulationViewModel.ts` | ⚠️ | `domain/debug/eoDebugRegulationViewModel.test.ts` | Minimal — 2 tests |
| Øvrige debug-filer | 🔇 | — | Lav prioritet (formattering, CSV, hash, navigation, snapshot) |

---

## 12. Komponent-logik med tests (Input/Table/Layout)

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

✅ **Løst 2026-02-22** — Al testplacering er nu konsolideret under `src/__tests__/`.

**Verificeret:** 203 testfiler, 2560 tests — alle grønne (session 5: +131 tests).

---

## Opsummering

### Tilbageværende kritiske mangler (prioriteret)

1. **Persistens-flow**: `fileSave.ts`, `fileHelpers.ts`, `fileHandleStorage.ts` — store persistensfiler uden meningsfulde tests. Browser File System Access API er svær at mocke i Node-miljø.
2. **Indkomstperioder**: `indtaegtPerioder.ts` — 399 linjer, kun fail-closed-test. Kræver fuldt EO-values-fixture.
3. **Schema-round-trip**: `formSchemas.ts` — mangler fuld round-trip-test for alle sektioner.
4. **Rente-engine**: `renteEngine.ts` — calculateActualInterestDate svær at isolere (afhænger af calculateProcessInterest).
5. **Periodegruppering**: `periodRangeGroups.ts` — afhænger af fuldt eoValues-objekt.
6. **React hooks**: `usePersistedForm.ts`, `useDraftField.ts`, `useFieldBehavior.ts`, `useFormFieldErrors.ts` — hook-test kræver kompleks React-setup.
7. **PDF-renderers**: 7+ PDF-filer (aarsloenPdf, reguleringPdf, rentePdf osv.) — jsPDF-afhængighed gør integration tung.

### Statistik

- Kildefiler der bør testes: ~120
- Filer med tests: ~115 (op fra ~63 ved sessionstart i session 1)
- Filer med grundig dækning (✅): ~105 (op fra ~95 ved start af session 5)
- Filer med delvis dækning (✅⚠️): ~18
- Filer helt uden tests: ~8 (ned fra ~57)
- Tests: 2560 (op fra 2429 ved start af session 5, +131 denne session)
