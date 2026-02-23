# TEST_COVERAGE.md — Mineo Testdækning

**Sidst opdateret:** 2026-02-23 (session 9 afsluttet: +95 nye tests, +7 nye testfiler — regulationRates (36→45), readableSummaryMessage (4→16), encryption (6→9), persistenceLoadSanitization (5→8), fileLoad (1→12), formSchemas (24→34), FormPersistenceContext (2→10), logger (1→5), usePersistedActiveTab/Section (18), PDF sections (17); ~35 ✅⚠️→✅ promotioner; samlet antal 2821/210)
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
| `erstatningsopgoerelseAggregationPolicy.ts` | ✅ | `domain/erstatningsopgoerelse/erstatningsopgoerelseAggregationPolicy.test.ts` | 29 tests: schema-validering, alle enum-værdier, duplikat-id, strategy enum eksklusivitet, roundingOverride method=none, whitespace i id (dokumenterer min(1)-adfærd), precision øvre grænse |
| `periodiseringsMotor.ts` | ✅ | `domain/erstatningsopgoerelse/periodiseringsMotor.test.ts` | 18 tests: periodiserBeloebForMaaneder/Arbejdsdage/OffentligYdelse (apportionment, DST, delår), buildLoenArbejdsdageSet, optaelMaaneder(Praecis/Afrundet) null-cases, isOffentligYdelseDatoMedregnet (sygedagpenge cutoff, arbejdsdage weekend/SH, kalenderdage alle-dage) |
| `tafBeregningsEngine.ts` | ✅ | `domain/erstatningsopgoerelse/tafBeregningsEngine.test.ts` | 15 tests: Måneder/Arbejdsdage, loseFeriedage-summering på merged grupper, null-aggregation (alle rækker ugyldige), tom input, invalide rækker i output, bounds-clamping |
| `tafCalculations.ts` | ✅ | `domain/erstatningsopgoerelse/tafCalculations.test.ts` + `tafCalculations.kalenderdage.test.ts` | 19 tests: calculateTafArbejdsdageBreakdown (4: breakdown-struktur, løse feriedage, clamp til nul, DST-kanariefugl), calculateKalenderdageInclusive/TafAntalMaaneder/TafAntalMaanederPraecis (15: DST, reversed, fuld mdr, SH-fradrag, null-cases, uafrundet fraktion) |
| `tafPerYearDerived.ts` | ✅ | `domain/erstatningsopgoerelse/tafPerYearDerived.test.ts` | 28 tests: Årsbuckets, negativt TAF, loenudviklingTotal.status='not_calculable'→null, tafArbejdsdageSet=null ved MAANEDER (segments skipped), weekend-only TAF→allWeights=0→fallback til første år |
| `tafRowDerived.ts` | ✅ | `domain/erstatningsopgoerelse/tafRowDerived.test.ts` | 19 tests: Måneder/arbejdsdage, clamping, null-cases, feriedage, loseFeriedage=undefined, determinisme |
| `tafBeregningsenhed.ts` | ✅ | `domain/erstatningsopgoerelse/tafBeregningsenhed.test.ts` | 15 tests: alle beregningsenhed-paths, fraDate>tilDate→MAANEDER, tom loenindkomstAnsaettelsesforhold→MAANEDER, single-day beregningsperiode med SH-overlap→ARBEJDSDAGE |
| `tafDaySets.ts` | ✅ | `domain/erstatningsopgoerelse/tafDaySets.test.ts` | 46 tests: Alle 6 funktioner: isWeekdayUtc, buildDatoSetInclusive(FromDates), buildFerieDageSet, buildShDageSet, buildShDageSetFromIsoRange, placeLoseFeriedage — DST, skudår, SH, overlappende ferie, NaN/Inf/negative count |
| `ferieCalculations.ts` | ✅ | `domain/erstatningsopgoerelse/ferieCalculations.test.ts` | 10 tests: undefined fra/til→null, fra>til→null, fuld uge, SH-fradrag, Math.max(0,...), multi-år grænse |
| `reguleringFormulaUtils.ts` | ✅ | `domain/erstatningsopgoerelse/reguleringFormulaUtils.test.ts` | 57 tests: computeFormulaValue (NaN/Inf/nul), parsePercentInput (dansk komma, tusind-sep, NaN), resolveFeriePctForFormula (fallback), formatPercentCellFromRaw (undefined/-/malformed), mergeFeriepengeDisplay (alle 4 grene), wrapIndexFormulaAfterSlashWhenLong (kort/lang/newline/custom-max), formatOverenskomstPercent/Amount (null/undef/0/tal), buildFormulaText (ingen/en/to faktorer, visibility-flags) |
| `offentligeYdelserDerived.ts` | ✅ | `domain/erstatningsopgoerelse/offentligeYdelserDerived.test.ts` | 9 tests: ydelsestype mangler→null, kalenderdage (10 dage), ugyldig periode, periodiseringLabel (dagpenge/sygedagpenge/ukendt), antalDage sat men ydelsePerDag null, ydelse+tillaeg sum, kun tillaeg |
| `angivetLoenHelpers.ts` | ✅ | `domain/erstatningsopgoerelse/angivetLoenHelpers.test.ts` | 12 tests: resolveLoenudviklingKilde (alle 3 beregnesUdFra + dagsløn success + alle 3 loenPaaHelligdage), LoenudviklingKildeError (code/name), getAngivetLoenBaseretPaa (alle 3 grene), getAngivetLoenOpreguleresFraDato (alle 3 grene) |
| `arbejdsdageMaaneder.ts` | ✅ | `domain/erstatningsopgoerelse/arbejdsdageMaaneder.test.ts` | 7 tests: enkelt hverdag, hel januar (23 arbejdsdage), SH+ferie=0, lørdag+søndag=0, SH+ferie samme dag=0 (ikke negativ), årsgrænse, tom SH+ferie=5 |
| `indtaegtPerioder.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/indtaegtPerioder.failClosed.test.ts` + `indtaegtPerioder.test.ts` | buildTafRanges, buildBeregningsperiodeRange, buildIncomeCalculationContext + fail-closed |
| `periodMerging.ts` | ✅ | `domain/erstatningsopgoerelse/periodMerging.test.ts` | 12 tests: tom liste, enkelt, overlappende, adjacent (mergeAdjacent=true/false), samme fra-dato (sort by til), nested range, tre uafhængige, mergeDateRanges (Date-objekter) |
| `periodOverlapDetection.ts` | ✅ | `domain/erstatningsopgoerelse/periodOverlapDetection.test.ts` | 12 tests: tom liste, enkelt, separate, grænsedag-overlap, ugyldige rækker, 3 overlappende — detectConflictingSvieSmerteOverlaps: tom, enkelt, forskellig tilstand, samme tilstand, undefined tilstand |
| `beregningsperiodeTafOverlap.ts` | ✅ | `domain/erstatningsopgoerelse/beregningsperiodeTafOverlap.test.ts` | 18 tests: isValidClosedDateRange (6), rangesOverlap (5), computeTafOverlapWithBeregningsperiode edge cases (5), buildBeregningsperiodeTafOverlapErrorMessage, per-row overlap |
| `aarsloenRowInterval.ts` | ✅ | `domain/erstatningsopgoerelse/aarsloenRowInterval.test.ts` | 33 tests: Alle 3 lønperioder (maaned/uge/dag), skudår, DST, nytår, grænseår (1900/2100), whitespace, ugyldige datoer |
| `aggregationAdapters.ts` | ✅ | `domain/erstatningsopgoerelse/aggregationAdapters.test.ts` | 27 tests: Alle 4 adaptere, null/NaN/Infinity, sumFinite, null første i liste, negativ varigeMen, partial emptiness (dato sat, beloeb undefined→null) |
| `indkomstRowValidation.ts` | ✅ | `domain/erstatningsopgoerelse/indkomstRowValidation.test.ts` | 43 tests: Alle 4 funktioner, alle lønperioder, datoformat, rækkefølgefejl, null-paths (implicit), error-set |
| `loenudviklingManuelBaseRowValidation.ts` | ✅ | `domain/erstatningsopgoerelse/loenudviklingManuelBaseRowValidation.test.ts` | 10 tests: baseRow undefined, tolerance (0.01), ugyldig streng→0, null→0, mismatch-fejlformat |
| `tafPeriodConstraints.ts` | ✅ | `domain/erstatningsopgoerelse/tafPeriodConstraints.test.ts` | 43 tests: Alle 5 funktioner, clamp, EET-constraint, verserende klage — alle branches |
| `eoNummerValidering.ts` | ✅ | `domain/erstatningsopgoerelse/eoNummerValidering.test.ts` | 22 tests: undefined/empty, whitespace, tal (1/2/9/12/10/1A/1a/2A), bogstav, specialtegn-præfix |
| `rowEmpty.ts` | ✅ | `domain/erstatningsopgoerelse/rowEmpty.test.ts` | 20 tests: Alle 4 row-typer: tom, hvert felt sat, 0≠undefined, id ignoreres |
| `rowDateBounds.ts` | ✅ | `domain/erstatningsopgoerelse/rowDateBounds.test.ts` | 12 tests: fra/til-bounds alle grene: skadesdatoMinDate, rowTil/fraMax, rowFra/tilMin, tilExtraMaxDate (min), useTilExtraMaxDate=false, fuld kombineret scenarie |
| `tafArbejdsstatusConfig.ts` | ✅ | `domain/erstatningsopgoerelse/tafArbejdsstatusConfig.test.ts` | 19 tests: CONFIG-integritet (11 nøgler), buildTafArbejdsstatusLinje: alle 11 statuser, suffix-normalisering, dato-output |
| `periodRangeGroups.ts` | ✅ | `domain/erstatningsopgoerelse/periodRangeGroups.test.ts` | 18 tests: normalizeBilagMode, buildPeriodRangeGroups: Alle/Perioden, første/anden opgørelse, TAF, konstanterne, allRanges-ignorering, PeriodRangeGroup-struktur |
| `erstatningsopgoerelseInitialValues.ts` | ✅ | `domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues.test.ts` + `.udkast.test.ts` | Schema-validering, settings-integration, alle defaults, determinisme |
| `readableSummaryMessage.ts` | ✅ | `domain/erstatningsopgoerelse/readableSummaryMessage.test.ts` | 16 tests: normalisering (tom streng, whitespace-only, 'Alle lønoplysninger mangler', 'Ugyldig indtastning', 'X er ikke valgt'→'"x" mangler', felt-'X mangler', 'Advarsel (X)' unwrap, pass-through), idempotens, fejl-wrapper-stripping |

### `src/domain/renteberegning/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `renteberegningEngine.ts` | ✅ | `domain/renteberegning/renteberegningEngine.test.ts` | 10 tests: DST, afrunding, determinisme, rækkefølge-uafhængig, tom rentekravRows, !renterFra→null, blandet valid/invalid, parity-test |
| `renteEngine.ts` | ✅ | `domain/renteberegning/renteEngine.test.ts` | 20 tests: calculateActualInterestDate (alle enheder, overflow, negativ), computeRentekravCalculation, belob=0, issue-struktur ved beregningsfejl |
| `rowEmpty.ts` | ✅ | `domain/renteberegning/rowEmpty.test.ts` | 7 tests: alle felter, 0≠undefined, enhed ignoreres — komplet |

### `src/domain/varigemen/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `varigeMenCalculations.ts` | ✅ | `domain/varigemen/varigeMenCalculations.test.ts` | 32 tests: Alle aldersfradrag-grænser, afrunding, rate-lookup, negativ/null inputs |
| `varigeMenEngine.ts` | ✅ | `domain/varigemen/varigeMenEngine.test.ts` | 7 tests: Orchestrering: manglende data, fuldt beregningsflow, alle inputs |

### `src/domain/aarsloen/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `aarsloenCalculations.ts` | ✅ | `domain/aarsloen/aarsloenCalculations.test.ts` | 28 tests: beregnMetode (alle 3), beregnOmregnetAarsloen (A/B/C, null), shDageAntal>hverdageIPeriode→0, NaN-koercering→0, negativ beregnetAarsloen (ingen clamping) |

### `src/domain/calculations/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `aarsloenPolicy.ts` | ✅ | `domain/calculations/aarsloenPolicy.test.ts` | 24 tests: resolveAarsloenPolicy, getActivePolicies, getPolicyLabel, isPolicyAvailable, getPolicyCount |
| `satserCalculations.ts` | ✅ | `domain/calculations/satserCalculations.test.ts` | 24 tests: resolveSatserEffectiveAargang, resolveSatserAargangErrorMessage, canDownloadSatser, hasSatserAny — alle branches |
| `stamdataCalculations.ts` | ✅ | `domain/calculations/stamdataCalculations.test.ts` | 15 tests: resolveStamdataDatoLabel, hasStamdataAny — alle branches |

### `src/calculation/pipeline/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `erstatningsopgoerelseAggregationPipeline.ts` | ✅ | `calculation/erstatningsopgoerelseAggregationPipeline.test.ts` + `.orchestration.test.ts` | 9 tests: Fail-closed, totaler, orchestration (TAF-skipping, error-logging, snapshot-ok) |

### `src/calculation/policy/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `erstatningsopgoerelse.policy.ts` | ✅ | `calculation/erstatningsopgoerelsePolicy.test.ts` | 18 tests: Struktur, linje-ids, sign-konfiguration, RAW→parsed konsistens, alle felter |

### `src/utils/` (beregning)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `rounding.ts` | ✅ | `utils/rounding.test.ts` | 9 tests: halfAwayFromZero (symmetrisk, store tal), floor/ceil (pos/neg), -0, NaN, Infinity, none, decimals=0 |
| `interestCalculator.ts` | ✅ | `utils/interestCalculator.test.ts` | 11 tests: DST-regression, null-paths (ugyldig dato, startDate>endDate, NaN/Infinity), single-day, multi-år, halvårsskift, legacy wrapper |
| `interestDomain.ts` | ✅ | `utils/interestDomain.test.ts` | 25 tests: calculateInterestDate (tillaegstid≤0, enheder, fejl), validateInterestCalculation (alle fejlkoder, success) |
| `periodeBeregning.ts` | ✅ | `utils/periodeBeregning.test.ts` | 36 tests: beregnDagPeriode (DST), beregnPeriodiseringsDage (kalenderdage/arbejdsdage, sygedagpenge cutoff), beregnUgePeriode (uge 53), beregnAntalHverdage, beregnFeriedagePaaEtAar, beregnMaanedPeriode, erNoejagtEtAar |
| `shDageBeregning.ts` | ✅ | `utils/beregnHelligdageMedNavn.test.ts` | 20 tests: beregnHelligdageMedNavn (alle navne, Store Bededag 2023/2024, dato-match), beregnSHDage (fra>til→0, hverdag/weekend-helligdag, grænseværdier, multi-år), beregnSHDageForDatoSet (tomt set, ikke-helligdag, weekend-helligdag, blandet) |
| `aarsloenTableCalculations.ts` | ✅ | `utils/aarsloenTableCalculations.test.ts` | 28 tests: calculateAarsloenRowDerived (formel, ATP, pension), roundAarsloenAmountToTwoDecimals (NaN/Inf→0), isAarsloenTableCellEffectivelyEmpty (alle typer), isAarsloenRowEffectivelyEmpty, hasCompletePeriodForLoenperiode (alle lønperioder), hasAtLeastOneValidRow |

---

## 2. Validering (Kritisk)

### `src/validators/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `erstatningsopgoerelseValidator.ts` | ✅ | `validators/erstatningsopgoerelseValidator.test.ts` | 51 tests: forlig, svie/smerte (inkl. beregnes=Nej, tidligereSsMax=Ja, fra>til, manglende fra/tilstand), TAF (fra mangler alene), validateBeregnesUdFra (dagsløn, bp-fra>til), validateLoenudviklingKonsistens (uens grundlag/overenskomst/statistik, multi-AF), validateLoenudviklingsKravForAktivKilde (Statistik, KRL, Manuel), øvrige krav (dato mangler, beloeb mangler), standalone (vedroererPeriode fra>til) |

### `src/utils/` (validering)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `dateInputValidation.ts` | ✅ | `utils/dateInputValidation.test.ts` | 36 tests: isValidDate (skudår, grænser), interpretYear (1/2/3/4 cifre), isDateFormatValid, validateDateRange (bounds, tom, ugyldig) |
| `offentligeYdelserTableValidation.ts` | ✅ | `utils/offentligeYdelserTableValidation.test.ts` | 10 tests: getOffentligeYdelserTableValidation (missing/input/warning), isOffentligeYdelserTableValueEffectivelyEmptyForValidation, isOffentligeYdelserAmountValueValidForValidation |
| `aarsloenTableValidation.ts` | ✅ | `utils/aarsloenTableValidation.test.ts` | 9 tests: getAarsloenTableValidation (alle fejltyper, warning, input-errors, multi-row), isAarsloenTableValueEffectivelyEmptyForValidation |
| `aarsloenValidation.ts` | ✅ | `utils/aarsloenValidation.test.ts` | 31 tests: beregnFejlmeddelelser (alle 5 fejltyper + kombination), harTabelValideringsFejl (partial period), harTabelData |
| `inputValidation.ts` | ✅ | `utils/inputValidation.test.ts` | 24 tests: shouldClearField (alle branches), trimValue |
| `tableValidationCommon.ts` | ✅ | `utils/tableValidationCommon.test.ts` | 31 tests: ZERO_ONLY_PATTERN, isZeroOnlyString, isAmountValueStrict (DEV-throw), isEffectivelyEmptyNumber |
| `zodTypeGuards.ts` | ✅ | `utils/zodTypeGuards.test.ts` | 6 tests: isLoenperiodeValue, isLoenPaaHelligdageValue (alle typer) |

---

## 3. Persistens (Kritisk)

### `src/auth/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `auth.ts` | ✅ | `auth/auth.test.ts` | 5 tests: verifySharedPassword (korrekt/forkert), isAuthenticated/setAuthenticated round-trip, storage-fejl→deterministisk fejl, crypto.subtle utilgængelig→throw |

### `src/utils/` (fil-I/O)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `fileLoad.ts` | ✅ | `utils/fileLoad.decryptFailure.test.ts` + `utils/fileLoad.normalLoad.test.ts` | 12 tests: success-path (snapshot, filnavn), annullering, forkert extension, for stor fil, ugyldig container, tomme felter, ukendte sektioner→preflightWarning; validateEoFile (gyldig, ugyldig, dårlig JSON, filstruktur) |
| `fileSave.ts` | ❌ | — | Kritisk — 787 linjer. Browser File API svær at mocke |
| `fileHelpers.ts` | ❌ | — | Kritisk — 323 linjer |
| `fileHandleStorage.ts` | ❌ | — | Kritisk — 590 linjer |
| `serialization.ts` | ✅ | `utils/serialization.test.ts` | 14 tests: undefined→null, primitiver, arrays, nested, JSON round-trip |
| `encryption.ts` | ✅ | `utils/encryption.test.ts` | 9 tests: Roundtrip, tampered, wrong key, version≠1→rejection, non-JSON→rejection, resetKeyCache round-trip |
| `persistenceLoadSanitization.ts` | ✅ | `utils/persistenceLoadSanitization.test.ts` | 8 tests: Deep defaults, unknown fields, non-record mod ZodObject→uændret, array defaults >1 element→throw, tom array default→uændret |
| `aarsloenTableLegacySanitization.ts` | ✅ | `utils/aarsloenTableLegacySanitization.test.ts` | 14 tests: col10→col5 migration, id-fallback, EO migrering |
| `nullToUndefinedDeep.ts` | ✅ | `utils/nullToUndefinedDeep.test.ts` | 19 tests: Deep null→undefined, JSON round-trip |
| `draftNormalization.ts` | ✅ | `utils/draftNormalization.test.ts` | 18 tests: trimWhitespaceEdges, trimToAlphanumericEdges, trimToNumericEdgesPreserveLeadingMinus, prefixZeroBeforeLeadingComma, stripAmountGroupingSeparators, fuld pipeline (integration) |
| `eoConverters.ts` | ✅ | `utils/eoConverters.test.ts` | 22 tests: initialRow, alle ID-generatorer (prefix, uniqueness), initialOffentligYdelseRow, initialLoenudviklingManuelRow |
| `safeLocalStorage.ts` | ✅ | `utils/safeLocalStorage.test.ts` | 10 tests: getItem/setItem/removeItem, in-memory fallback i Node |
| `fileSystemAccess.ts` | ❌ | — | File System Access API wrapper. Browser API — svær at teste i Node |

### `src/schemas/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `formSchemas.ts` | ✅⚠️ | `schemas/formSchemas.test.ts` | 34 tests: tusindtalsseparator, AES, diverse valideringer, renteberegningSchema round-trip+stripTopLevelKey, varigeMenSchema round-trip+stripTopLevelKey, aarsloenSchema round-trip. Mangler: satser- og erstatningsopgoerelse-sektioner |
| `eoFileSchema.ts` | ✅ | `schemas/eoFileSchema.test.ts` | 17 tests: eoFileDataSchema (null→undef), eoFileDataLoadSchema (passthrough), eoFileContainerSchema (strict) |
| `amountExpressionSchema.ts` | ✅ | `schemas/amountExpressionSchema.test.ts` | 5 tests: Normalisering |

### `src/stores/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `formPersistenceStore.ts` | ✅ | `stores/formPersistenceStore.*.test.ts` (4 filer) | 18 tests: stamdata, aarsloen, satser, API |

### `src/contexts/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `FormPersistenceContext.tsx` | ✅ | `contexts/FormPersistenceContext.replaceAllPersistedData.rollback.test.tsx` + `contexts/FormPersistenceContext.normalFlow.test.tsx` | 10 tests: rollback (2), null ved tom storage, load fra sessionStorage, persistData opdaterer cache, skriver til sessionStorage, version-mismatch rydder alt, korrupt JSON ryddet, hasAnyData false/true |

### `src/hooks/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `usePersistedForm.ts` | ❌ | — | Kerne-persistens-hook. Kritisk — 182 linjer |
| `usePersistedActiveTab.ts` | ✅⚠️ | `hooks/usePersistedActiveTab.test.tsx` | 13 tests: defaultTab, restore fra sessionStorage, ugyldig nøgle→fallback, setActiveTab (tilladt/forbudt), sessionStorage-persistering, isAllowedTab (alle grene), legacy-migrering (success/override/ugyldig/bad JSON) |
| `usePersistedSection.ts` | ✅⚠️ | `hooks/usePersistedSection.test.tsx` | 5 tests: null-return, korrekt data-forwarding, pageKey-argument, throw uden context, reaktivitet ved nyt context-objekt |

### `src/config/` (persistens)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `persistenceDefaults.ts` | ✅ | `config/persistenceDefaults.test.ts` | 12 tests: Defaults, settings-fallback, determinisme |
| `persistenceRegistry.ts` | ✅ | `config/persistenceRegistry.test.ts` | 23 tests: persistenceSchemas (alle 6 StorageKeys, per-schema validering: stamdata/satser/aarsloen/renteberegning/varigemen/erstatningsopgoerelse), fingerprint |
| `storageManifest.ts` | ✅ | `config/storageManifest.test.ts` | 14 tests: STORAGE_KEYS, UI_STORAGE_KEYS, getStorageKey, isValidStorageKey, createActiveTabStorageKey |

### `src/settings/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `appSettingsSchema.ts` | ✅ | `settings/appSettingsSchema.test.ts` | 17 tests: Schema, DEFAULT_*, brevhoved, resolveDefaultOverenskomstFilter, loadInitialSettings |
| `appSettingsParse.ts` | ✅ | `settings/appSettingsParse.test.ts` | 16 tests: parseStoredSettings alle cases, loadInitialSettings (3 branches) |
| `appSettingsStorage.ts` | ✅ | `settings/appSettingsStorage.test.ts` | 9 tests: LOCAL_STORAGE_KEY, readLocalStorage, writeLocalStorage — catch-path utestbar (intern exception-swallowing) |

---

## 4. Datoer og kernetyper (Kritisk)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/types/branded.ts` | ✅ | `types/branded.date.test.ts` | 40 tests: Roundtrip, DST-stabilitet, isISODateString, isDanishDateString, coerceToISODateString, coerceToDanishDateString — type guards og coercion fuldt testet |
| `src/domain/dates/isoDate.ts` | ✅ | `domain/dates/isoDate.test.ts` | 14 tests: parseIsoDateOrUndefined→ISODateString, isoDateToDate→Date, DST-safe — komplet |
| `src/domain/dates/dateCommit.ts` | ✅ | `domain/dates/dateCommit.test.ts` | 11 tests: commitIsoDateFromDraftString: tom/whitespace/dansk/ISO — komplet |
| `src/utils/dateUtils.ts` | ✅ | `utils/dateUtils.test.ts` | 33 tests: parseDanishDate, formatDanishDate, formatToISO, getTodayLocalISO, isLeapYear, getDaysInYear, addDays (6 tests), addMonths (5 tests), parseWeekString (7 tests) |
| `src/utils/datePrimitives.ts` | ✅ | `utils/datePrimitives.test.ts` | 9 tests: createDate UTC-baseret, DST-safe — komplet |
| `src/utils/isoDateHelpers.ts` | ✅ | `utils/isoDateHelpers.test.ts` | 34 tests: validateIsoRange, minISO, maxISO, iterateDatesInclusive, validateISODateRange — komplet |
| `src/utils/utcDayMath.ts` | ✅ | `utils/utcDayMath.test.ts` | 10 tests: countInclusiveUtcDays (DST, start>end→null, samme dato=1), countExclusiveUtcDays (start>end→null, samme=0), diffUtcDaysAbs (absolut, symmetrisk) |
| `src/utils/dateFormatting.ts` | ✅ | `utils/dateFormatting.test.ts` | 22 tests: formatIsoDateShort→dd-mm-yyyy, formatIsoDateLong→dansk månedsnavn, formatUtcDateShort/Long, formatISOToDanish — komplet |
| `src/utils/dateRangeErrorMessages.ts` | ✅ | `utils/dateRangeErrorMessages.test.ts` | 3 tests: In-range, out-of-range, format — tilstrækkeligt for enkel funktion |

---

## 5. Utilities (Høj)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/utils/numberUtils.ts` | ✅ | `utils/numberUtils.test.ts` | 15 tests: toNonNegativeInt: NaN/Inf→0, negative→0, trunkering |
| `src/utils/numberParsing.ts` | ✅ | `utils/numberParsing.test.ts` | 19 tests: parsePercentToDecimal (alle cases inkl. undefined/number/komma/punkt), parseAmount (alle typer) |
| `src/utils/formatUtils.ts` | ✅ | `utils/formatUtils.test.ts` | 33 tests: formatPercent, formatCurrency, formatAsAmount, isSingularCount, formatCountWithUnit — NaN/Inf/negativ, precision clamping |
| `src/utils/expressionAmount.ts` | ✅ | `utils/expressionAmount.test.ts` | 44 tests: parseAmountInput (24), amountValueToNumber, amountValueToDisplayString, amountValueToDraftString, isExpressionErrorMessage, formatExpressionErrorMessage |
| `src/utils/amountInputUtils.ts` | ✅ | `utils/amountInputUtils.test.ts` | 19 tests: sanitizePastedAmount, containsAnyDigit, normalizeTrailingSeparator, normalizeZero |
| `src/utils/safeComputation.ts` | ✅ | `utils/safeComputation.test.ts` | 5 tests: success, Error-kast, ikke-Error-kast, undefined/object value |
| `src/utils/serialization.ts` | ✅ | `utils/serialization.test.ts` | 14 tests: undefined→null, primitiver, nested arrays/objekter, round-trip JSON |
| `src/utils/nullToUndefinedDeep.ts` | ✅ | `utils/nullToUndefinedDeep.test.ts` | 19 tests: primitiver, nested, arrays, round-trip JSON parse |
| `src/utils/inputValidation.ts` | ✅ | `utils/inputValidation.test.ts` | 24 tests: shouldClearField (alle branches), trimValue |
| `src/utils/tableValidationCommon.ts` | ✅ | `utils/tableValidationCommon.test.ts` | 31 tests: ZERO_ONLY_PATTERN, isZeroOnlyString, isAmountValueStrict (DEV-throw), isEffectivelyEmptyNumber |
| `src/utils/zodTypeGuards.ts` | ✅ | `utils/zodTypeGuards.test.ts` | 6 tests: isLoenperiodeValue, isLoenPaaHelligdageValue (alle typer) |
| `src/utils/aarsloenTableLegacySanitization.ts` | ✅ | `utils/aarsloenTableLegacySanitization.test.ts` | 14 tests: aarsloen: col10 migration, id-fallback, ukendt nøgle, advarsler; eo: fuldLoenUnderFerie/loenPaaHelligdage migration |
| `src/utils/aarsloenValidation.ts` | ✅ | `utils/aarsloenValidation.test.ts` | 31 tests: beregnFejlmeddelelser (alle 5 fejltyper + kombination), harTabelValideringsFejl (partial period), harTabelData |
| `src/utils/interestDomain.ts` | ✅ | `utils/interestDomain.test.ts` | 25 tests: calculateInterestDate (alle enheder, ≤0, fejl), validateInterestCalculation (alle fejlkoder, success) |
| `src/utils/dateInputValidation.ts` | ✅ | `utils/dateInputValidation.test.ts` | 36 tests: isValidDate (skudår, grænser), interpretYear (1/2/3/4 cifre), isDateFormatValid, validateDateRange (bounds, tom, ugyldig) |
| `src/utils/errorMessages.ts` | ✅ | `utils/errorMessages.test.ts` | 17 tests: ERROR_MESSAGES (alle nøgler), CalculationError (code/name/message/cause/stack), getUserMessage, isCalculationError |
| `src/utils/schemaFingerprint.ts` | ✅ | `utils/schemaFingerprint.test.ts` | 10 tests: Determinisme, rækkefølgeuafhængighed, fnv1a-format, ændringsfølsomhed, nested |
| `src/utils/insertTodayDate.ts` | ✅ | `utils/insertTodayDate.test.ts` | 5 tests: onCommit (ISO-format, tidspunkt), focusRef=null, mock input, ingen focusRef |
| `src/utils/bugReport.ts` | ✅ | `utils/bugReport.test.ts` | 4 tests: generateBugReport, prepareBugReport — openBugReportEmail/copyBugReport/downloadBugReport er browser API side effects, ikke meningsfuldt testbare i Node |
| `src/utils/eoConverters.ts` | ✅ | `utils/eoConverters.test.ts` | 22 tests: initialRow, alle ID-generatorer (prefix, uniqueness), initialOffentligYdelseRow, initialLoenudviklingManuelRow |
| `src/utils/safeLocalStorage.ts` | ✅ | `utils/safeLocalStorage.test.ts` | 10 tests: getItem/setItem/removeItem, overwrite, remove-nonexistent, tom streng key/value |
| `src/utils/devtoolsMonitor.ts` | ✅ | `utils/devtoolsMonitor.test.ts` | 7 tests: detektionslogik — tilstrækkeligt for lav-prioritets utility |
| `src/utils/logger.ts` | ✅ | `utils/logger.test.ts` | 5 tests: sanitizeFilenameForLog (persondata fjernes+hash, non-string→fallback, tom streng→fallback, ingen filendelse, determinisme) |
| `src/utils/scrollToDebugRow.ts` | ✅ | `utils/scrollToDebugRow.test.ts` | 4 tests |

---

## 6. Domain-modeller og hjælpere (Høj)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/domain/rowId.ts` | ✅⚠️ | `domain/rowId.test.ts` | 7 tests: createRowId: prefix, uniqueness — fallback-paths (getRandomValues/Date.now) er utestbare uden mocking |
| `src/domain/tableModelUtils.ts` | ✅ | `domain/tableModelUtils.test.ts` | 14 tests: parseOptionalIntegerFromString: valid, whitespace, parseInt-quirks ("12abc"→12), decimaler |
| `src/domain/tableRowManagement.ts` | ✅ | `domain/tableRowManagement.test.ts` | 9 tests: ensureRowsWithTrailingEmpty: tom liste, all-empty, non-empty, mixed, reuse trailing empty, rækkefølge |
| `src/domain/erstatningsopgoerelse/rowEmpty.ts` | ✅ | `domain/erstatningsopgoerelse/rowEmpty.test.ts` | 20 tests: Alle 4 row-typer: tom, hvert felt sat, id ignoreres, 0≠undefined |
| `src/domain/erstatningsopgoerelse/periodRangeGroups.ts` | ✅ | `domain/erstatningsopgoerelse/periodRangeGroups.test.ts` | 18 tests: Alle/Perioden modes, første/anden opgørelse, TAF, konstanter, rækkefølge |
| `src/domain/erstatningsopgoerelse/rowDateBounds.ts` | ✅ | `domain/erstatningsopgoerelse/rowDateBounds.test.ts` | 12 tests: fra/til-bounds, skadesdato, tilExtraMaxDate |
| `src/domain/erstatningsopgoerelse/tafArbejdsstatusConfig.ts` | ✅ | `domain/erstatningsopgoerelse/tafArbejdsstatusConfig.test.ts` | 19 tests: Alle 11 statuser, CONFIG-integritet, buildTafArbejdsstatusLinje, suffix-normalisering |
| `src/domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues.ts` | ✅ | `domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues.test.ts` + `.udkast.test.ts` | Schema-validering, settings-integration, alle defaults, determinisme |
| `src/domain/renteberegning/rowEmpty.ts` | ✅ | `domain/renteberegning/rowEmpty.test.ts` | 7 tests: isRentekravRowEmpty: alle felter, 0≠undefined, enhed ignoreres |
| `src/domain/stamdata/stamdataInitialValues.ts` | ✅ | `domain/stamdata/stamdataInitialValues.test.ts` | 4 tests: Schema-validering, tekstfelter=tom, valgfrie=undefined |
| `src/types/result.ts` | ✅ | `types/result.test.ts` | 13 tests: ok, err, isErr type guard; null/undefined/objekt-værdier; type narrowing |
| `src/types/validation.ts` | ✅ | `types/validation.test.ts` | 9 tests: Type-kontrakt: ValidationError, ValidationResult, FormValidator, alle severity-niveauer |
| `src/types/loen.ts` | ✅ | `types/loen.test.ts` | 6 tests: LOENPERIODE, LOEN_PAA_HELLIGDAGE: nøgler, unikhed, satisfies-kontrakt |

---

## 7. Data-lookup (Medium–Kritisk)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/data/offentligLoenLookup.ts` | ✅ | `data/offentligLoenLookup.test.ts` + `.missingEntry.test.ts` | 26 tests: Dataintegritet, lookup, fail-hard |
| `src/data/offentligLoenTypes.ts` | ✅ | `data/offentligLoenTypes.test.ts` | 22 tests: toLoentrin (grænseværdier, fejl), resolveOffentligLoenTypeFromLabel — komplet |
| `src/data/interestRates.ts` | ✅ | `data/interestRates.test.ts` | 10 tests: Format, kendte satser, MIN_CALCULATION_DATE, CURRENT_YEAR, MAX_CALCULATION_YEAR |
| `src/data/KRLrates.ts` | ✅ | `data/KRLrates.test.ts` | 16 tests: isKRLSatstabelId, getKRLSatstabel, formatKRLSatstabelDisplay, getReguleringsDatoIntervalForKRL |
| `src/data/regulationRates.ts` | ✅ | `data/regulationRates.test.ts` | 45 tests: getYearBoundsFor*, getSatserForYear, aarsloenMin invariant, aarsloenMinFoer/Fra20240701, reguleringsprocentErhvervsevnetabFoer/Fra2024, 2024 split-felter i getSatserForYear.asl |
| `src/data/overenskomstRates.ts` | ✅ | `data/overenskomstRates.test.ts` | 68 tests: dataintegritet, getOverenskomstMetaById (legacy suffix), resolveDisplay, getOverenskomsterByOrg, orgs, isOffentlig, getOffentligType, getReguleringsDatoInterval, getEffektiveSatserFor*, resolveOverenskomstRef (strukturel parse, legacy, offentlig), getGrundloenAngivetPerForOverenskomst (KL/RLTN med/uden tafBeregnesSom), getOffentligTillaegsSatserForDato/ForPeriode |
| `src/data/statistiskLoenudviklingRates.ts` | ✅ | `data/statistiskLoenudviklingRates.test.ts` | 18 tests: integritet, getStatistiskLoenudvikling, getReguleringsDatoIntervalForStatistikModel |
| `src/data/ydelsestyper.ts` | ✅ | `data/ydelsestyper.registry.test.ts` | 7 tests: alle 13 ydelsestyper registreret, unikke labels, sygedagpenge=arbejdsdage, debugLabel for 3 typer |

---

## 8. Hooks med logik (Høj)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/hooks/useAarsloenBeregning.ts` | ❌ | — | Årsløn-hook. Høj — 263 linjer |
| `src/hooks/useDraftField.ts` | ❌ | — | Draft-field engine. Høj — 331 linjer |
| `src/hooks/useFieldBehavior.ts` | ❌ | — | Felt-adfærd. Høj |
| `src/hooks/useFormFieldErrors.ts` | ❌ | — | Formfelt-fejl. Høj |
| `src/hooks/useOmregningToggle.ts` | ✅⚠️ | `hooks/useOmregningToggle.test.tsx` | 3 tests: Blocking, shake, auto-disable |
| `src/hooks/useAarsloenPdfGates.ts` | ❌ | — | PDF-gate-logik. Medium |

---

## 9. Config med logik (Høj)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/config/dateRanges.ts` | ✅ | `config/dateRanges.test.ts` | 24 tests: TODAY/MIN_YEAR/MAX_YEAR, stamdata/EO-ranges (type, dynamic, unconstrained), computeSkadesdatoMinRule (alle branches inkl. skudår) |
| `src/config/computeSkadesdatoMinRule.ts` | ✅ | `config/computeSkadesdatoMinRule.test.ts` | 4 tests: Alle skadestyper, grænseværdier, skadestype-baseret min-dato |
| `src/config/persistenceDefaults.ts` | ✅ | `config/persistenceDefaults.test.ts` | 12 tests: Defaults, settings-fallback, determinisme |
| `src/config/storageManifest.ts` | ✅ | `config/storageManifest.test.ts` | 14 tests: STORAGE_KEYS, UI_STORAGE_KEYS, getStorageKey, isValidStorageKey, createActiveTabStorageKey |
| `src/config/persistenceRegistry.ts` | ✅ | `config/persistenceRegistry.test.ts` | 23 tests: persistenceSchemas (alle 6 StorageKeys, per-schema validering: stamdata/satser/aarsloen/renteberegning/varigemen/erstatningsopgoerelse), fingerprint |
| `src/settings/appSettingsSchema.ts` | ✅ | `settings/appSettingsSchema.test.ts` | 17 tests: Schema, DEFAULT_*, resolveDefaultOverenskomstFilter, loadInitialSettings |
| `src/settings/appSettingsParse.ts` | ✅ | `settings/appSettingsParse.test.ts` | 16 tests: parseStoredSettings alle cases, loadInitialSettings (3 branches) |
| `src/settings/appSettingsStorage.ts` | ✅ | `settings/appSettingsStorage.test.ts` | 9 tests: alle 3 exports — writeLocalStorage catch-path (silent fail) er utestbar (intern exception-swallowing) |

---

## 10. PDF-generering (Medium)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `src/domain/erstatningsopgoerelse/eoPdfModel.ts` | ✅ | `domain/erstatningsopgoerelse/eoPdfModel.test.ts` | 42 tests: Model-builder (alle Beregningsperiode/Angivet/Dagsløn-grene), satser, TAF-indkomst, afdrag, øvrige krav, afvisning af ugyldigt input |
| `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts` | ✅ | `domain/erstatningsopgoerelse/sharedPdfUtils.test.ts` | 27 tests: alle exports — parseOptionalIsoDate, parseDanishToIso, resolveReguleringsdato, formatDateShort/Long, formatPercentFixed2, detectDecimalPlaces, konstanter |
| `src/utils/pdf/erstatningsopgoerelsePdf.ts` | ✅ | `erstatningsopgoerelsePdf.indkomstBreakdownVisibility.test.ts` + `erstatningsopgoerelsePdf.udkast.test.ts` + `erstatningsopgoerelsePdf.periodFilter.test.ts` | 35 tests: indkomst-breakdown visibility (4), udkast-flag (9), period filter (22) |
| `src/utils/pdf/pdfWriter.ts` | ✅⚠️ | `utils/pdf/pdfWriter.layoutFallback.test.ts` | 2 tests: Kun layout-fallback — mangler: writeWrappedText multi-line, ensureSpace page-break, writeUnderlinedLabel, writeSignatureBlock |
| `src/utils/pdf/pdfService.ts` | ✅⚠️ | `utils/pdf/pdfService.test.ts` | 3 tests: canDownloadEoPdf kun — mangler: 9 async download-funktioner, error-return-stier |
| `src/utils/pdf/pdfHelpers.ts` | ✅ | `utils/pdf/pdfHelpers.test.ts` + `addBrevhoved.gate.test.ts` | 20 tests: addBrevhoved (13: alle felter, throw ved ugyldig dato, whitespace), ensurePdfPageSpace (4), addFooter (3) |
| `src/utils/pdf/jsPdfAdapter.ts` | ✅ | `utils/pdf/jsPdfAdapter.test.ts` | 7 tests: A4-dimensioner, getNumberOfPages, addPage, setPage, defensive guard (manglende pageSize/width) |
| `src/utils/pdf/pdfBrevhoved.ts` | ✅ | `utils/pdf/pdfBrevhoved.test.ts` | 5 tests: getVisBrevhoved for alle 7 PDF-typer, purity, DEFAULT_APP_SETTINGS baseline |
| `src/utils/pdf/tafFordeltPaaAarPdf.ts` | ✅ | `utils/pdf/tafFordeltPaaAarPdf.wiring.test.ts` | 7 tests: Wiring, filnavn, udkast-suffix, journalnr-præfix, negativt TAF, "Allerede betalt TAF"-linje |
| `src/utils/pdf/erstatningsopgoerelse/sections/loenindkomstSection.ts` | ⚠️ | `utils/pdf/erstatningsopgoerelse/sections/loenindkomstSection.test.ts` | 3 tests: periodeoverskrifter, kolonnebredder — metadata-felter utestet |
| `src/utils/pdf/erstatningsopgoerelse/sections/offentligeYdelserSection.ts` | ⚠️ | `utils/pdf/erstatningsopgoerelse/sections/offentligeYdelserSection.test.ts` | 1 test: kolonnebredde — gruppering/filtrering utestet |
| `src/utils/pdf/erstatningsopgoerelse/sections/sygeferiegodtgoerelseSection.ts` | ✅ | `utils/pdf/erstatningsopgoerelse/sections/sygeferiegodtgoerelseSection.test.ts` | 4 tests: throw ved sygeferiegodtgoerelse=true, pass-through ved false, void-return |
| `src/utils/pdf/erstatningsopgoerelse/sections/shDageSection.ts` | ⚠️ | `utils/pdf/erstatningsopgoerelse/sections/shDageSection.test.ts` | 7 tests: startBilagPage, "Ingen periode", "Ingen helligdage", tabel med helligdage, subheader i Beregningsperiode-mode |
| `src/utils/pdf/erstatningsopgoerelse/sections/reguleringSection.ts` | ⚠️ | `utils/pdf/erstatningsopgoerelse/sections/reguleringSection.test.ts` | 6 tests: startBilagPage, tom ansættelsesforhold-liste, label, navn, fallback-navn, KRL-link — dybe overenskomst/statistik-stier utestet |
| `src/utils/pdf/erstatningsopgoerelse/sections/opgoerelseSection.ts` | 🔇 | — | 691-linje context-injected renderer; ingen ekstraherbar ren logik; dækket på integrationsniveau via erstatningsopgoerelsePdf.udkast.test.ts |
| `src/utils/pdf/aarsloenPdf.ts` | ❌ | — | Årsløn-PDF. Medium |
| `src/utils/pdf/reguleringPdf.ts` | ❌ | — | Regulerings-PDF. Medium |
| `src/utils/pdf/rentePdf.ts` | ❌ | — | Rente-PDF. Medium |
| `src/utils/pdf/satserPdf.ts` | ❌ | — | Satser-PDF. Medium |
| `src/utils/pdf/shDagePdf.ts` | ❌ | — | SH-dage-PDF. Medium |
| `src/utils/pdf/varigeMenPdf.ts` | ❌ | — | Varigt mén-PDF. Medium |
| `src/utils/pdf/krlPdf.ts` | ❌ | — | KRL-PDF. Medium |
| `src/utils/pdf/pdfTableRenderer.ts` | ❌ | — | Tabel-layout. Medium |

---

## 11. Debug-system (Medium)

### `src/domain/debug/`

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `eoDebugIntegrity.ts` | ✅ | `domain/debug/eoDebugIntegrity.test.ts` | 14 tests: alle 5 invarianter (PERIOD_OVERLAP, DATE_HOLES, BASE_DATE_INCONSISTENT, TAF_DAYS_MISMATCH, SVIE_SMERTE_MISMATCH), touching vs. overlapping, tom input |
| `eoDebugSammentaelling.ts` | ✅ | `domain/debug/eoDebugSammentaelling.test.ts` + `.regression.test.ts` | 14 tests: status-logik (ok/warning/error/tolerance), display-tabeller, 9 regressions-scenarier (måneder/arbejdsdage, disabled TAF/BP) |
| `eoDebugCoreModel.ts` | ✅ | `domain/debug/eoDebugCoreModel.test.ts` | 15 tests: timeline-byggeri: tom input, enkeltdag, inklusive intervaller, TAF/svie-smerte grænser, datofiltrering, menAfgoelseDato-clamping |
| `eoDebugModel.ts` | ✅⚠️ | `domain/debug/eoDebugModel.workdayMarking.test.ts` | 3 tests: arbejdsdag-markering under Måned/Arbejdsdage — mangler: kolonngenerering, celllogik, tabelaggregering |
| `eoDebugParity.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/eoDebugTafOverlapParity.test.ts` | 2 tests: overlappende TAF-perioder→error rows, TAF ud over vedroererPeriode→ok — mangler: parity-diff logik (findFirstDebugTableParityDiff) |
| `eoDebugRowAggregator.ts` | ✅ | `domain/erstatningsopgoerelse/eoDebugRowAggregator.test.ts` | 19 tests: builder-orkestrering, status-filtrering, dependency-sortering, dependency-specs (id/pattern), dependency-cycles |
| `eoDebugRowPresentation.ts` | ✅ | `domain/erstatningsopgoerelse/eoDebugRowPresentation.test.ts` | 5 tests: "Fejl (...)" prefix-ekstraktion, messageOnly-flag, explict message override, integration med buildEODebugIndkomstRows |
| `eoDebugLoenCoreModel.ts` | ✅⚠️ | `domain/debug/eoDebugLoenCoreModel.test.ts` | 6 tests: timeline-byggeri, Store Bededag, svie/smerte — mangler: komponent/rate-lookup, overenskomst/løntrin-resolution |
| `eoDebugRegulationCore.ts` | ✅⚠️ | `domain/debug/eoDebugRegulationCore.test.ts` | 3 tests: Store Bededag-regel — mangler: indeks-generering per ansættelsesforhold, overenskomst-periodsplit, rate-lookup |
| `eoDebugSeverity.ts` | ✅ | `domain/debug/eoDebugSeverity.test.ts` | 4 tests: rank-rækkefølge, max fra issues, tom→'ok', konstanter |
| `eoDebugViewModel.ts` | ✅⚠️ | `domain/debug/eoDebugViewModel.test.ts` | 17 tests: rækkeantal, getRowKey/getRowIso — mangler: kolonngenerering, cellformatering, visibility-logik, getCell |
| `eoDebugDateUtils.ts` | ✅ | `domain/debug/eoDebugDateUtils.test.ts` | 31 tests: compareIso (3 branches), getOverlap (alle typer), getIsoRange, isDateInRange, minDate, maxDate, skudår, Store Bededag |
| `eoDebugLoenViewModel.ts` | ✅ | `domain/debug/eoDebugLoenViewModel.test.ts` | 10 tests: sektionsantal (loen/svieSmerte/begge), kolonnestruktur (8 kolonner), manglende komponent→"-", summary aggregering, sektionsrækkefølge |
| `eoDebugRegulationViewModel.ts` | ✅ | `domain/debug/eoDebugRegulationViewModel.test.ts` | 11 tests: ansaettelsesforhold→sektioner, header (med/uden navn), 11 kolonner, row-id, arbejdsdage/maaneder=null→"-", 4 info-rækker, tom entries→"-" |
| `eoDebugLoenTypes.ts` | ✅ | `domain/debug/eoDebugLoenTypes.test.ts` | 6 tests: type-hjælpere og konstanter |
| Øvrige debug-filer | 🔇 | — | Lav prioritet (formattering, CSV, hash, navigation, snapshot, context builders) |

### `src/domain/erstatningsopgoerelse/` (debug-relaterede)

| Kildefil | Status | Testfil | Bemærkninger |
|----------|--------|---------|--------------|
| `eoDebugErstatningsopgoerelseModel.ts` | ✅ | `domain/erstatningsopgoerelse/svieSmerteBeregning.test.ts` + `eoDebugIndkomstRows.reguleringsCoverage.test.ts` + `eoDebugIndkomstRows.reguleringVisibility.test.ts` + `eoDebugTafBeregningsgrundlagRows.visibility.test.ts` | 48 tests: buildEODebugSvieSmerteRows (38), buildEODebugIndkomstRows regulerings-dækning/visibilitet (6), buildEODebugTafBeregningsgrundlagRows visibility (4) |
| `eoDebugIndkomstModel.ts` | ✅ | `domain/erstatningsopgoerelse/eoDebugIndkomstModel.test.ts` | 7 tests: buildIndkomstSectionStatuses, buildOffentligeYdelserDebugRows — manuel regulering, manglende beløb/perioder, validering |
| `eoDebugBuilderRegistry.ts` | ✅⚠️ | `domain/erstatningsopgoerelse/eoDebugBuilderRegistry.test.ts` | 1 test: executeEODebugBuilderEntries exception-isolation — mangler: builder-registrering, rækkefølge, navigationsmap |
| `eoDebugCommon.ts` | ❌ | — | Lav prioritet |

---

## 12. Komponent-logik med tests (Input/Table/Layout)

### Input-komponenter

| Testfil | Tests | Bemærkninger |
|---------|-------|--------------|
| `components/inputs/tableCommitContract.test.tsx` | 11 | Commit-kontrakt for alle input-typer — exceptionel test |
| `components/inputs/fingerprintDeterminism.test.ts` | 4 | Fingerprint determinisme |
| `components/inputs/noopUsesCommittedFingerprint.test.tsx` | 1 | No-op bruger committed fingerprint |
| `components/inputs/inputKeyFilters.integer.test.ts` | 6 | Integer key constraints |
| `components/inputs/integerRange.shared.test.ts` | 4 | Shared integer range helper |
| `components/inputs/StyledAmountField.expression.test.tsx` | 8 | Expression behavior |
| `components/inputs/StyledDateField.test.tsx` | 4 | Date field |
| `components/inputs/StyledDropdown.test.tsx` | 8 | Dropdown |
| `components/inputs/StyledToggleSwitch.test.tsx` | 18 | Toggle switch: pointer/keyboard/shake/rendering — komplet |
| `components/inputs/StyledWeekField.test.tsx` | 1 | Week field |
| `components/inputs/TableAmountInput.expression.test.tsx` | 11 | Expression behavior |
| `components/inputs/TableDateInput.test.tsx` | 2 | Date input |
| `components/inputs/TableDropdown.gridCore.test.tsx` | 2 | GridCore integration |

### Layout

| Testfil | Tests | Bemærkninger |
|---------|-------|--------------|
| `components/layout/Container.test.tsx` | 23 | Keyboard navigation — fuld kontrakt |
| `components/layout/MainLayout.overwriteGating.test.tsx` | 1 | Overwrite gating |
| `components/layout/MainLayout.preflightApply.test.tsx` | 1 | Preflight apply |
| `components/layout/MainLayout.pwaConcurrency.test.tsx` | 1 | PWA concurrency |
| `components/layout/MainLayout.unsavedBeforeUnload.test.tsx` | 6 | Unsaved/beforeunload |
| `components/layout/MainLayout.devtoolsNoticePersistence.test.tsx` | 2 | DevTools notice persistence |

### Tabeller

| Testfil | Tests | Bemærkninger |
|---------|-------|--------------|
| `components/tables/tableKeyboardNavigation.arrowWrap.test.tsx` | 2 | Arrow wrap (grid table) |
| `components/tables/tableKeyboardNavigation.dropdownCell.test.tsx` | 3 | Dropdown-celle integration |
| `components/tables/tableKeyboardNavigation.looseNavigation.test.tsx` | 8 | Loose table navigation |
| `components/tables/tableRowFocus.test.tsx` | 22 | Row focus management |
| `components/tables/AarsloenTable.onBlurDerived.test.tsx` | 1 | On-blur derived |
| `components/tables/OffentligeYdelserTable.onBlurDerived.test.tsx` | 8 | Ydelse/dag on-blur derived |
| `components/tables/BeregningsperiodeFerieTable.test.tsx` | 1 | Beregningsperiode ferie |
| `components/tables/BeregnetRenteTable.amountfield.test.tsx` | 1 | Amount commit wiring |
| `components/tables/LoenudviklingManuelTable.focus.test.tsx` | 1 | Fokus-gendannelse |
| `components/tables/SvieSmerteTable.test.tsx` | 3 | Svie/smerte table |
| `components/tables/TAFPeriodeTable.test.tsx` | 3 | TAF periode table |
| `components/tables/VirtualizedDisplayTable.test.tsx` | 1 | Virtualized display |

### Sider

| Testfil | Tests | Bemærkninger |
|---------|-------|--------------|
| `components/pages/erstatningsopgoerelse/EOberegningTab.controlCheck.test.tsx` | 5 | Kontroltjek |
| `components/pages/erstatningsopgoerelse/EOberegningTab.pdfAfsluttesMed.test.tsx` | 1 | PDF-afslutning |
| `components/pages/erstatningsopgoerelse/EODebugRegulationSections.test.tsx` | 4 | Phase 4.5 debug UI |
| `components/pages/erstatningsopgoerelse/EODebugTabel.test.tsx` | 2 | Debug tabel |
| `components/pages/Om.test.tsx` | — | Struktur-validering (ingen it-assertions) |

### UI-komponenter

| Testfil | Tests | Bemærkninger |
|---------|-------|--------------|
| `components/ui/LicenseModal.test.tsx` | — | Struktur-validering (ingen it-assertions) |
| `components/ui/ScrollToTopButton.test.tsx` | 3 | Scroll-to-top |

### Calculation hooks

| Testfil | Tests | Bemærkninger |
|---------|-------|--------------|
| `calculation/useErstatningsopgoerelseAggregation.test.tsx` | 2 | Aggregations-hook wiring |

---

## 13. Arkitekturelle guards

| Testfil | Status | Hvad den beskytter |
|---------|--------|--------------------|
| `quality/noDirectLocalStorageAccess.test.ts` | ✅ | Ingen direkte localStorage |
| `quality/noDirectSessionStorageAccess.test.ts` | ✅ | Ingen direkte sessionStorage |
| `quality/mojibake.test.ts` | ✅ | Tegnkodningsintegritet |
| `quality/eetDomainIsolation.test.ts` | ✅ | EET-domæneisolation: 4 grænser håndhævet |

---

## Strukturelle problemer

✅ **Løst 2026-02-22** — Al testplacering er nu konsolideret under `src/__tests__/`.

**Verificeret:** 210 testfiler, 2821 tests — alle grønne.

---

## Opsummering

### Tilbageværende kritiske mangler (prioriteret)

1. **Persistens-flow**: `fileSave.ts`, `fileHelpers.ts`, `fileHandleStorage.ts` — store persistensfiler uden meningsfulde tests. Browser File System Access API er svær at mocke i Node-miljø.
2. **Indkomstperioder**: `indtaegtPerioder.ts` — 399 linjer, kun fail-closed-test. Kræver fuldt EO-values-fixture.
3. **Schema-round-trip**: `formSchemas.ts` — mangler fuld round-trip-test for alle sektioner.
4. **React hooks**: `usePersistedForm.ts`, `useDraftField.ts`, `useFieldBehavior.ts`, `useFormFieldErrors.ts` — hook-test kræver kompleks React-setup. (`usePersistedActiveTab` og `usePersistedSection` er nu dækket.)
5. **PDF-renderers**: 7+ PDF-filer (aarsloenPdf, reguleringPdf, rentePdf osv.) — jsPDF-afhængighed gør integration tung.

### Statistik

- Kildefiler der bør testes: ~130
- Filer med tests: ~130 (op fra ~115 i session 7 pga. dokumentation af hidtil uregistrerede filer)
- Filer med grundig dækning (✅): ~118
- Filer med delvis dækning (✅⚠️): ~15
- Filer helt uden tests: ~6 (fileSystemAccess, fileSave, fileHelpers, fileHandleStorage, usePersistedForm, eoDebugCommon)
- Tests: 2821 (session 9: +95 tests — fulde detaljer i header)
