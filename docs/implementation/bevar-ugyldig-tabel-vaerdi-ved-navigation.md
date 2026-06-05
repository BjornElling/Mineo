# Plan: Bevar ugyldig tabel-celle-værdi ved fane-/side-skift (+ scroll + ingen blink)

> Status: PLANLAGT (ikke udført). Skrevet 2026-06-05.

## Kontekst

Når Gem blokeres af en ugyldig værdi i en lønindkomst-tabelcelle, og brugeren står på en anden side/fane, skal programmet hoppe til den korrekte fane og scrolle til cellen. Tre symptomer rapporteret:

1. Den scroller ikke ned til cellen efter fane-skift.
2. Feltet med den ugyldige værdi **tømmes** ved fane-skift.
3. Den gule fejl-boks blinker kortvarigt og forsvinder ved sideskift.

**Fælles rod:** En ugyldig tabel-indtastning lever KUN som flygtig lokal state — `draft`/`draftRef` i [useTableInputCore.ts](../../src/hooks/tableInput/useTableInputCore.ts) og et globalt registry ([tableInputErrorRegistry.ts](../../src/utils/tableInputErrorRegistry.ts)) keyet på et ustabilt per-mount `useId()`, der ryddes ved unmount ([useTableInputSaveError.ts](../../src/hooks/useTableInputSaveError.ts)). Den blokerende fejl udledes per-ansættelsesforhold som en afledt boolean (`manuelReguleringHasErrorsByAfId`, også lokal state) → dynamisk feltfejl `${af.id}:loenindkomst` ([LoenindkomstTab.tsx](../../src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx) ~587-607). Ved unmount destrueres draft'en, registry-entry ryddes, boolean'en nulstilles → ved remount er cellen tom, fejlen blinker væk, og der er intet at scrolle til.

**Eksisterende mønster der løser det samme for alm. felter:** [StyledPercentField.tsx](../../src/components/inputs/StyledPercentField.tsx) ~263-305 læser ved mount `onFieldError.getCurrentError()` og genskaber sin draft fra `invalidDraft`; ved fejl rapporterer den `{ message, blocksSave:true, invalidDraft: draft }`. Field-error-store er **bevidst designet til at overleve navigation** ([useFormFieldErrors.ts](../../src/hooks/useFormFieldErrors.ts) ~140-148) og understøtter allerede `invalidDraft` ([fieldErrors.ts](../../src/types/fieldErrors.ts) ~19-25; `useDynamicFormFieldErrorReporter` ~264-269).

Beslutning (bruger): udrul til **ALLE grid-tabeller**, ikke kun lønindkomst.

## Tilgang (anbefalet)

Genbrug field-error-store som persistenslag (overlever navigation) ved at lade hver tabelcelle rapportere sin egen ugyldige draft som en **per-celle `blocksSave:false` dynamisk feltfejl**, og genskabe den ved mount — spejling af `StyledPercentField`. Den eksisterende aggregerede blokerende fejl (fx `${af.id}:loenindkomst`, `blocksSave:true`) forbliver det ENE felt der gater Gem og styrer fane-routing.

**Hold table-input-laget afkoblet fra form-persistence** (det kommunikerer kun via `onErrorChange`/`value`/`onBlur` og skal forblive genbrugeligt). Derfor: cellen *emitterer* sin draft op via et udvidet `onErrorChange`-info-objekt; den ejende side persisterer i store; cellen *modtager* en read-only `externalInvalidDraft` ned igen til genskabelse.

### Ændringer (mønster + repræsentative filer)

1. **Kontrakt** — [tableInputContracts.ts](../../src/utils/tableInputContracts.ts): `TableInputErrorInfo` får additivt `invalidDraft?: string` og `cellKey?: string` (optional → alle eksisterende `onErrorChange`-callsites kompilerer uændret).

2. **Celle-core** — [useTableInputCore.ts](../../src/hooks/tableInput/useTableInputCore.ts): ny option `externalInvalidDraft?: string`. Mount-only (ref-guarded) seed af `draft` + fejltilstand (`touched/hasError/localErrorKind='input'/saveErrorActive=true/errorMessage`) fra den. Emittér `invalidDraft: draftRef.current` + `cellKey: resolvedGridCellKey` i info — KUN for `kind:'input'` (ikke `visual`/committed). Fordi `saveErrorActive` er sand fra første render, genregistrerer cellen sig straks i registry → focus-loopet kan finde den.

3. **Wrappers (gennemstik)** — [TablePercentInput.tsx](../../src/components/inputs/table/TablePercentInput.tsx) + søskende (`TableAmountInput`, `TableDateInput`, `TableYearInput`, `TableWeekInput`, `TableIntegerInput`, `TableTextInput`): videregiv `externalInvalidDraft` til core.

4. **Grid-tabeller (ALLE)** — [LoenudviklingManuelTable.tsx](../../src/components/tables/LoenudviklingManuelTable.tsx), [StandardLoenTable.tsx](../../src/components/tables/StandardLoenTable.tsx), [OffentligeYdelserTable.tsx](../../src/components/tables/OffentligeYdelserTable.tsx), [EetAslAfgoerelserTable.tsx](../../src/components/tables/EetAslAfgoerelserTable.tsx): udvid celle-fejl-callback til at bære `{ hasError, invalidDraft, cellKey }` (i stedet for kun boolean); ny prop `invalidDraftsByCellKey?: Record<string,string>` der seeder `externalInvalidDraft` pr. celle (cellKey bygges via `gridCellKey({rowId,colIndex})`). Hver tabels ejende side persisterer per-celle draft i field-error-store og sender drafts ned igen.

5. **Ejende sider** — [LoenindkomstTab.tsx](../../src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx) (lønindkomst-tabellerne) samt de sider/komponenter der ejer `OffentligeYdelserTable` og `EetAslAfgoerelserTable`: rapportér per-celle draft som `reportDynamicFieldError("<entitet>:<suffix>:<tabel>:<cellKey>", hasError ? { message, blocksSave:false, invalidDraft } : undefined)`. Behold den blokerende aggregat-fejl, men (a) seed de lokale fejl-maps fra store ved mount via `useBlockingFieldIdsBySuffixForSection(...)`, og (b) ryd ALDRIG aggregatet mens en per-celle-draft stadig findes → ingen transient `undefined` i remount-vinduet (fjerner blinket). Læs per-celle drafts fra store og send `invalidDraftsByCellKey` ned pr. tabel. Bevar hver tabels eksisterende routing-suffix i `prepareTabForBlockingError`.

6. **saveBlockedFocus** — [saveBlockedFocus.ts](../../src/utils/saveBlockedFocus.ts): forventet uændret. `prepareTabForBlockingError` mapper allerede `${af.id}:loenindkomst` → loenindkomst-fanen; 30-frame `waitForAnimationFrame`-retry-loopet venter på mount; den genskabte celle (med `saveErrorActive` fra render 1) findes af `getFirstBlockingTableInputErrorTarget()` og scrolles via `scrollTargetIntoView`. Verificér at 30 frames rækker.

### Edge cases
- Flere ugyldige celler: hver får eget per-celle feltnavn/`invalidDraft`; aggregatet blokerer mens nogen findes.
- Rydning ved rettelse: `commitAndEmitBlur` rydder lokal fejl ved gyldig commit → emitter `{hasError:false}` → side rydder den per-celle-entry; sidste rydder aggregatet. Sørg for at ekstern-værdi-resync også emitter ryddet info.
- rowId er kun unik pr. tabel → inkludér tabel-diskriminator (`:manuel:`/`:standard:` osv.) + entitets-id i feltnavnet mod kollisioner.
- Undo/redo: tabelcelle-undo forbliver på `draftHistoryRegistry`/`useTableInputHistoryRestore` (keyet på `fieldPath`) — uændret. `blocksSave:false` draft-bærere udløser ikke en felt-fejl-undo-frame (`captureInvalidDraftIfNew` kræver `blocksSave!==false`) — ønsket, ingen konflikt.
- Seed skal være mount-only (ref-guarded), så re-renders/StrictMode ikke overskriver live indtastning.

## Verifikation
- `npx vitest run` for berørte suites: ny `useTableInputCore` seed/emit-test; tabel-niveau "remount genskaber draft"-test; integrationstest der asserterer at den blokerende aggregat-fejl ALDRIG går til ryddet hen over navigate-væk/tilbage; eksisterende `saveBlockedFocus`/`MainLayout.unsavedBeforeUnload`/`useFileSaveLoad`-suiter grønne.
- `npx tsc --noEmit` rent.
- Manuel: indtast ugyldig værdi i lønindkomst-manuel-regulering, gå til stamdata, tryk Gem → hopper til lønindkomst-fanen, scroller til cellen, værdien er bevaret, gul boks bliver stående. Gentag for offentlige ydelser og EET-asl-tabellerne.

## Risici
- Aggregatet skal udledes deterministisk fra per-celle-entries (ikke den transiente boolean) — afbødet ved at seede fra store + kun rydde ved faktisk rettelse.
- Touch-count: ~6 wrappers + 4 tabeller + 2-3 ejende sider. Lav logisk risiko, men bred. Load-bearing er trin 1-2 (kontrakt + core); tabel-wiring er mekanisk gentaget mønster pr. tabel.
- For `OffentligeYdelserTable`/`EetAslAfgoerelserTable`: verificér deres eksisterende fejl-rapporterings-/routing-suffiks før wiring, så aggregat-gating og fane-routing bevares.
