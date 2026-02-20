# Mineo — Kode-review tracking

**Oprettet:** 2026-02-20
**Senest opdateret:** 2026-02-21 (Fase 3 afsluttet — alle fund godkendt)
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
