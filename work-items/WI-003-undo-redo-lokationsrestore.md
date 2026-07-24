# WI-003: Greenfield undo/redo lokationsbaseret fokusrestore (fuld parity)

- **Status:** `under-implementering` (delvist — fundament bygget og inert/grønt; long tail udestår). Genoptag med
  `/greenfield work-items/WI-003-undo-redo-lokationsrestore.md`.
- **Oprettet:** 2026-07-24
- **Branch:** `greenfield`. **Baseline for dette WI:** commit hvor WI-002 Fase-4 shell-cutover blev landet (se
  git-loggen: "Fase 4 …"-committen umiddelbart før "WI-003 …"-committen).
- **Risikoklasse:** M — krydslags UI-projektion (core + editor + surface + delte Styled*-komponenter + shell), men
  additiv og bag-eksisterende-adfærd indtil shell-wiren aktiveres.

## Hvorfor (baggrund)

WI-002 Fase-4 shell-cutoveren erstattede legacy `useUndoRedoShortcuts(navigate)` med `useGreenfieldUndoRedoShortcuts()`,
som KUN ændrer history. Legacy gjorde tre ting ved Ctrl+Z/Ctrl+Y: (1) `navigate(frame.origin.route)`, (2)
`setActiveTabForPage(...)`, (3) `scheduleHistoryTargetRestore(frame)` → flyttede fokus/scroll/fokus-ring til det
ændrede felt. Greenfield-shortcuttet mangler alle tre → **§5.4 synlig-adfærds-regression** (bruger, der fortryder en
ændring lavet på en anden side, strandes på nuværende side uden fokus på feltet).

**Beslutning (Codex sol/high, 2026-07-24): B — fuld parity NU** (nav + fane + felt-fokus i Fase 4, ikke udskudt).
Kernebegrundelse: undo-redo-kontrakten kræver "navigér og fokusér efter succes"; §8 placerer eksplicit fuld
lokationsbaseret fokusrestore i Fase 4; en ikke-deploybar tranche er ikke fritaget for §5.4. **Kritisk arkitektur-
constraint:** route/fane må IKKE udledes af `field.section` eller string-parses fra `locationId` — `faellesAarsloen`
har ingen egen route og bor på flere sider (EET vs Forsørgertab). Route+fane skal være eksplicit typed metadata båret
med history-origin. (Fuld beslutningsrapport i
`…/scratchpad/codex-decision.log` fra kørslen; sammendrag her.)

## Autoritativt grundlag
- `docs/architecture/draft-commit-greenfield-design.md` §3.7 (history + fokus-origin), §1.4, §5.4.
- `src/contracts/undo-redo-contract.md` (restore navigerer + fokuserer efter succes).
- Legacy-orakel (adfærd at spejle): `git show <baseline>~1:src/hooks/useUndoRedo.ts` — se `applyFrame`:
  `setActiveTabForPage` → `navigate(route)` → `scheduleHistoryTargetRestore(frame)`.

## GENNEMFØRT (bygget, typechecker rent, inert + grønt: inputCore-suiter 138/138)

Alt nedenstående er ADDITIVT og OPTIONELT, og shell-wiren er endnu IKKE aktiveret — derfor ingen adfærdsændring og
ingen rød suite. Dette er en sikker mellemtilstand.

1. **Core — route/tab båret i history-origin:**
   - `src/inputCore/editor/fieldEditorState.ts`: `EditorLocation` udvidet med `route?: string` + `tabKey?: string | null`.
   - `src/inputCore/inputHistory.ts`: `HistoryOrigin` udvidet med `route?` + `tabKey?`.
   - `src/inputCore/editor/fieldEditorEngine.ts`: `originFor` bærer nu `route`/`tabKey` fra `EditorLocation`
     (spreder kun de definerede felter).
2. **Core — restoredOrigin surfaces kun ved succes:**
   - `src/inputCore/runtime/dispatchInput.ts`: `DispatchInputResult` udvidet med `restoredOrigin?: HistoryOrigin`.
     Sættes KUN efter en gennemført undo/redo-commit (`result.changed && transition.target.origin !== undefined`).
     No-op/fejl surfacer aldrig origin → shellen kan ikke navigere efter en mislykket/tom restore.
3. **Restore-hjælper (delt kerne + greenfield-variant):**
   - `src/utils/historyTargetRestore.ts`: udtrukket `runHistoryTargetRestoreLoop(findTarget)` (den fælles rAF-retry-,
     scroll-hvis-ikke-synlig-, fokus-ring-, blur-commit-undertrykkelse- og bruger-fokus-afbrydelses-løkke). Legacy
     `scheduleHistoryTargetRestore` bruger nu denne. `HISTORY_TARGET_RESTORE_MAX_ATTEMPTS` eksporteret.
   - `src/inputCore/react/greenfieldHistoryRestore.ts` (NY): `scheduleGreenfieldHistoryTargetRestore(origin)` +
     `findGreenfieldRestoreTarget(origin)` (slår op via BÅDE `data-mineo-field-address` = serialiseret feltadresse OG
     `data-mineo-editor-location-id`), plus `buildRestoreTargetAttributes(...)`, `useRestoreTargetAttributes(field
     .address, location)`, og attribut-navn-konstanterne `GREENFIELD_FIELD_ADDRESS_ATTR`/`GREENFIELD_EDITOR_LOCATION_ATTR`.
4. **Surface-attributter (form + grid tekst-familier — FÆRDIGE):**
   - `useFormFieldSurface`/`useGridCellSurface` eksponerer nu `restoreTargetAttributes`.
   - Group A (surface-hook-forbrugere) spreder dem på deres `<input>`: `GreenfieldTextField`,
     `GreenfieldNumericTextField`, `GreenfieldDateField`, `GreenfieldMultilineTextField` (via `htmlTextAreaAttributes`),
     `GreenfieldGridTextCell` (via `inputProps`).
5. **Group B immediate-commit — TEMPLATE færdig for toggle:**
   - `src/components/inputs/StyledToggleSwitch.tsx`: ny valgfri `restoreTargetAttributes`-prop spredt ind i
     `inputSlotProps` (ved siden af den bevarede legacy `data-mineo-undo-field-path`). `name` er IKKE længere
     greenfield-restorens identitet.
   - `src/inputCore/react/fields/GreenfieldToggleField.tsx`: bruger `useRestoreTargetAttributes` og sender prop'en videre.

## UDESTÅR (long tail — genoptag her, i denne rækkefølge)

### A) Resten af Group B immediate-commit-controls (samme template som toggle)
For hver: (i) tilføj valgfri `restoreTargetAttributes?: Readonly<Record<string,string>>`-prop til den delte
`Styled*`-komponent og spred den på det fokuserbare input-slot (ved siden af evt. eksisterende
`data-mineo-undo-field-path`); (ii) i greenfield-wrapperen: `const rta = useRestoreTargetAttributes(field.address,
location)` og send den videre. Kontrollér det FOKUSERBARE element pr. kontroltype (checkbox-input, radio-input,
select/combobox).
- `GreenfieldRadioField.tsx` → dens Styled radio-gruppe.
- `GreenfieldChoiceField.tsx` → dens Styled dropdown/select.
- `GreenfieldCheckbox.tsx` → dens Styled checkbox.
- `GreenfieldMappedToggleField.tsx` → `StyledToggleSwitch` (genbrug allerede-tilføjet prop).
- `GreenfieldEntityChoiceField.tsx` (grid entity-valg via `useCellEditor`) → dens Styled select. `field.address` =
  `cellFieldOf`-adresse; `location` = `cell.location`.
- `GreenfieldGridChoiceCell.tsx` (grid immediate choice via `useCellEditor`) → tilsvarende.
  Se `src/inputCore/react/fields/greenfieldGridCells.tsx` for hvordan grid-choice-cellen renderer sit fokuserbare element.

### B) Editorlokationer deklarerer eksplicit route + tabKey (~30+ callsites)
Alle `{ locationId: … }`-deklarationer skal have `route` (+ `tabKey` hvor siden har faner). Mest robust: tilføj
route/tab ÉT sted pr. side (de fleste sider har allerede en lokal `loc()`-helper eller per-fil-konstanter). Routes fra
`src/config/pageNavigation.ts` (`APP_ROUTES`/`getRouteForPageKey`). Faner: samme tab-nøgler som
`setActiveTabForPage`/`PAGE_DEFAULT_TAB` bruger (se `src/config/pageNavigation.ts` + `usePersistedActiveTab`).
Callsites (fra `grep "locationId:"`):
- `components/pages/Stamdata.tsx` (`loc()` helper) — route `/stamdata`, tabKey `null`.
- `components/pages/Satser.tsx` (`aargangLocation`) — `/satser`, `null`.
- `components/pages/Forsoergertab.tsx` (7 konstanter, inkl. `ASL_AARSLOEN_LOCATION`/`EAL_AARSLOEN_LOCATION` =
  faellesAarsloen-felter) — route `/forsoergertab`. **faellesAarsloen her SKAL have route `/forsoergertab`** (kontekst).
- `components/pages/varigemen/MenberegningTab.tsx` (2 konstanter) — `/varigemen` + relevant tabKey.
- `components/pages/renteberegning/RenteberegningTab.tsx` (`beregningsdato`, `kommentarer`, inline) — `/renteberegning`.
- `components/pages/erhvervsevnetab/EetOplysningerTab.tsx` (`LOCATIONS`, inkl. `aslAarsloen`/`ealAarsloen` =
  faellesAarsloen) — route `/erhvervsevnetab`, tabKey oplysninger-fanen. **faellesAarsloen her = `/erhvervsevnetab`.**
  → Dette er den kritiske EET-vs-Forsørgertab-split: SAMME feltadresse, TO editorlokationer med FORSKELLIG route.
- `components/pages/erhvervsevnetab/EetLoebendeYdelserTab.tsx`, `EetDifferencekravTab.tsx` (`location()` helper) —
  `/erhvervsevnetab` + hhv. løbende-ydelser-/differencekrav-fanen.
- Grid-tabeller (dynamisk locationId): `EetAslAfgoerelserTable.tsx`, `BeregnetRenteTable.tsx`,
  `GreenfieldOevrigeKravTable.tsx`, `StandardLoenTable.tsx`, `useGreenfieldCollectionTable.ts` — route fra tabellens
  side + tabKey fra dens fane. Overvej at lade collection-/grid-adapteren tage route/tab som parametre.
Bemærk: `route === undefined` = bevidst ikke-navigerbar lokation (fx standalone MinProcesrente-grid) → restoren
navigerer da ikke; det er OK.

### C) Shell-wiring (aktiverer adfærden)
- `src/inputCore/react/useGreenfieldUndoRedoShortcuts.ts`: tag en valgfri `onRestore?: (origin: HistoryOrigin) => void`.
  Efter `runtime.history.undo()/redo()` returnerer `DispatchInputResult`; hvis `.restoredOrigin` er sat, kald `onRestore`.
  (Bemærk: `runtime.history.undo/redo` returnerer allerede `DispatchInputResult` — verificér i `inputRuntimeContext.tsx`.)
- `src/components/layout/MainLayout.tsx`: giv `onRestore` til hooken. Rækkefølge SOM LEGACY: (1) hvis `origin.tabKey`
  ikke er `null/undefined` → `setActiveTabForPage(routeToPageId(origin.route!), origin.tabKey)`; (2) `navigate(origin
  .route!)` hvis route findes og ≠ nuværende; (3) `scheduleGreenfieldHistoryTargetRestore(origin)`.

### D) Tests (Codex sol/high's testkrav)
- `dispatchInput`: undo/redo returnerer `restoredOrigin` efter succes; no-op ingen origin; fejlende restore ingen origin.
- `inputHistory`: origin bevares symmetrisk gennem undo → redo.
- Greenfield restore-hjælper: finder KUN element med BÅDE feltadresse OG editorlokation; fokus/scroll/fokus-ring;
  respekterer skjulte mål, rAF-retry-grænse og brugerens efterfølgende fokusflytning.
- MainLayout-integration: ændring på anden route/fane → Ctrl/Cmd+Z + redo går til korrekt route+fane+felt; samme
  feltadresse med to editorlokationer lander på den editor der lavede ændringen; `faellesAarsloen` → korrekt EET-/
  Forsørgertab-lokation.
- Field-surface-dækning: formularfelt, gridcelle, dropdown, radio, checkbox, toggle renderer target-attributterne.
- **Arkitekturtest:** forhindr at en greenfield-kommitterende field-familie mangler target-attributterne (tilføj i
  `src/__tests__/quality/architecture/` — dynamisk glob over `fields/Greenfield*` + assert `restoreTargetAttributes`/
  `useRestoreTargetAttributes` forekommer; jf. [[project_guard_selftest_principle]]).

### E) Afslut
- Codex sol/medium review af HELE WI-003-diffen; adressér fund.
- Gates: `typecheck`, `typecheck:test`, `lint`, `verify:ledgers`, fuld `vitest run`.
- Opdatér `docs/architecture/draft-commit-greenfield-design.md` §8 Fase 4 + fjern regressions-noten i
  `useGreenfieldUndoRedoShortcuts.ts` (linje ~10: "navigerer IKKE til origin-feltet endnu").

## Invarianter (må ikke brydes)
- Route/fane er EKSPLICIT typed metadata — aldrig udledt af `field.section` eller string-parset fra `locationId`.
- `restoredOrigin` surfaces KUN efter en gennemført undo/redo (aldrig no-op/fejl).
- Greenfield-restore lokaliserer via feltadresse + editorlokation (IKKE `name`), så samme datafelt redigeret flere
  steder fokuserer den editor der lavede ændringen.
- §5.4: ingen ændring i beregningstal/dokumentindhold; kun undo/redo-navigations-/fokusadfærd genskabes (= legacy).
