# Undo/Redo Architecture

**Status:** Arkitekturforklarende reference, ikke selvstændig kontrakt  
**Scope:** Global undo/redo for committed brugerinput i Mineo

Bindende regler ligger i `src/contracts/undo-redo-contract.md`, `src/contracts/persistence-contract.md`, `src/contracts/form-contract.md` og `src/contracts/error-debug-contract.md`.

Dette dokument beskriver den implementerede undo/redo-arkitektur. Det er ikke en implementeringsplan.

## 1. Formål

Undo/redo giver brugeren mulighed for at fortryde og gentage committed ændringer i formular-state.

Funktionen er afgrænset til Mineos committed, schema-validerede inputstate. Den arbejder ikke på åben draft-state og erstatter ikke browserens native tekst-undo inde i et aktivt inputfelt.

## 2. Brugeradfærd

| Situation | Adfærd |
|---|---|
| `Ctrl+Z` / `Cmd+Z` | Undo til seneste committed snapshot |
| `Ctrl+Shift+Z` / `Cmd+Shift+Z` | Redo til næste snapshot |
| `Ctrl+Y` / `Cmd+Y` | Redo |
| Editor lukket | Genvejen håndteres af Mineo |
| Tekstinput-editor åben | Genvejen er et stille no-op |
| Grid-celle-editor åben | Genvejen er et stille no-op |
| Filindlæsning | Undo/redo-stakken ryddes |
| Gem | Ingen effekt på stakken |

Når en editor er åben, kalder `MainLayout` stadig `preventDefault()` på undo/redo-genvejen. Det forhindrer browserens egen tekst-undo i at ændre en ucommitted draft uden om Mineos commit-flow. Mineos `undo()`/`redo()` kaldes ikke, history-stakken ændres ikke, og der vises ingen advarsel.

## 3. Grundregel

Undo/redo opererer kun på committed state.

Der må ikke ske beregning, validation eller history-restore fra åben draft-state. Hvis en tekstinput-editor eller grid-celle-editor er åben, ignoreres undo/redo derfor deterministisk.

## 4. History-model

History ejes af `src/stores/undoRedoStore.ts`.

Storen er en in-memory Zustand vanilla-store uden persist-middleware. Den gemmes ikke i `sessionStorage` og indgår ikke i `.eo`-filer.

```typescript
type HistoryFrameOrigin = {
  route: string;
  tabKey: string | null;
  sectionKey: keyof FormPersistenceSections;
  fieldPath: string | null;
  focusToken: string | null;
};

type HistoryFrame = {
  id: string;
  timestamp: number;
  sections: FormPersistenceSections;
  sectionRevisions: SectionRevisionMap;
  authoritativeSnapshotEpoch: number;
  fieldErrors: FieldErrorCache;
  fieldErrorRevisions: FieldErrorRevisionMap;
  meta: FormPersistenceMeta;
  origin: HistoryFrameOrigin;
};
```

`past` indeholder undo-mål. `future` indeholder redo-mål. Der findes bevidst ikke et `present`-felt; aktuel state læses fra `formPersistenceStore`, og aktuel state snapshots først når `undo()` eller `redo()` flytter et frame mellem stakkene.

Stakken er begrænset til 50 `past`-frames. Når grænsen nås, droppes de ældste frames. Redo-stakken kan praktisk rumme op til 50 frames, så memory-bound er op til 100 fulde snapshots.

## 5. Capture

History capture sker før en committed ændring skrives til `formPersistenceStore`, men capture, storage-write og store-commit skal behandles som én logisk transaktion efter `undo-redo-contract.md`.

Normal formularvej:

```text
onCommit -> usePersistedForm.setValues/setFieldValue
         -> FormPersistenceContext.persistData(..., { undoOrigin })
         -> undoRedoStore.capture(origin)
         -> formPersistenceStore.commitSection(...)
```

`persistData` springer capture over, hvis den serialiserede sektion er uændret. Det forhindrer no-op commits i at oprette history entries.

Blocking field errors med invalid draft kan også capture en undo-origin via `useFormFieldErrors`, så undo kan gendanne både committed snapshot og den relevante invalid draft-fejl.

## 6. Origin og fokus

Et `HistoryFrame` gemmer origin, så undo/redo efter restore kan navigere brugeren tilbage til den side, fane og feltposition hvor ændringen hører til.

Origin består af:
- `route` fra React Router
- `tabKey` fra aktiv fane i `sessionStorage`
- `sectionKey` fra den persisted sektion
- `fieldPath` fra commit-option eller senest fokuserede undo-bærende felt
- `focusToken` fra senest fokuserede undo-bærende felt, men kun når commit ikke sender en eksplicit `fieldPath`

`src/utils/undoFocusTracker.ts` installeres i `MainLayout` og lytter på `focusin` i capture phase. Den gemmer seneste element med `data-mineo-undo-focus-token` eller `data-mineo-undo-field-path`.

Dette er nødvendigt, fordi felt-commit typisk sker på blur efter fokus allerede er flyttet. `document.activeElement` ville derfor ofte pege på det nye felt, ikke det felt der netop blev committed.

For tabelceller er `fieldPath` den autoritative identitet. Tabellen sender cellens stabile `rowId:colIndex` med commit-kaldet, og `focusToken` sættes derfor til `null` for den history-frame. Det forhindrer, at hurtig navigation til nabocellen kan få undo/redo til at fokusere eller draft-restore den forkerte celle. Almindelige felter, der ikke sender en eksplicit `fieldPath`, bruger fortsat focus-trackeren som fallback.

### Blur-commit input-felter (dato, tekst, beløb m.fl.)

Et blur-commit-felt committer på blur, *efter* fokus typisk er flyttet videre. På commit-tidspunktet kender call-sitet feltets `fieldPath` (det er feltnøglen, fx `forligDato`), og sender den enten eksplicit via `setValues(..., { fieldPath })` eller implicit via `setFieldValue(key, ...)`.

For at restore kan finde feltet igen, **skal feltet bære en `name`-prop lig sin `fieldPath`**. `name` udsendes som `data-mineo-undo-field-path` på `<input>` (se `StyledTextFieldBase`), og det er den DOM-identitet `historyTargetRestore` slår op. Mangler `name`, har elementet ingen `data-mineo-undo-field-path`, og restore kan ikke lande fokus via fieldPath-stien.

`focusToken` (et stabilt per-mount `useId` på samme element) udsendes altid og fungerer som fallback for den live undo/redo i samme mount. Men den durable identitet — invalid-draft-restore (hvor `useFormFieldErrors` capter framet med `fieldPath = feltnøgle`), navigation mellem sider og remounts — kræver det stabile `name`. Derfor er `name` obligatorisk på alle persisterede blur-commit-felter på sags-sider, på linje med immediate-commit widgets.

For felter pr. ansættelsesforhold/række er identiteten `${id}:${felt}` (samme princip som tabelceller), så flere instanser ikke kolliderer.

Undtaget: transiente "komponér-og-indsæt"-hjælpefelter (fx løntrin-finderen og sygedagpenge-indsæt), der kun skriver til lokal React-state og aldrig committer til persisteret state — de deltager ikke i undo/redo og bærer derfor ikke `name`.

### Immediate-commit widgets (toggle, dropdown, radio)

Toggle/dropdown/radio committer øjeblikkeligt (ikke på blur) og kan derfor ikke spores pålideligt af focus-trackeren: på commit-tidspunktet peger `document.activeElement`/trackeren ofte på det *forrige* felt. Disse widgets **skal** derfor:

1. sende en eksplicit `fieldPath` i deres commit (`setValues(..., { fieldPath })`), og
2. bære en `name`-prop, så elementet emitterer `data-mineo-undo-field-path` og kan findes + fokuseres ved restore.

For widgets pr. række/ansættelsesforhold er identiteten `${id}:${felt}` (samme princip som tabelceller), så flere instanser ikke kolliderer. `src/__tests__/quality/immediateCommitWidgetUndoName.test.ts` håndhæver `name`-kravet på alle sags-input-sider.

## 7. Restore

Restore ejes af `src/hooks/useUndoRedo.ts`.

Ved undo/redo:
1. Undo/redo planlægger target-frame og current-frame uden endelig stack-mutation.
2. `useUndoRedo` skriver frame-sektionerne til `sessionStorage` via rollback-beskyttet snapshot-write.
3. `formPersistenceStore.restoreHistoryFrame(...)` gendanner sections, revisions, field errors og meta atomisk og bumper `authoritativeSnapshotEpoch`.
4. History-stack-transitionen committes først efter succesfuld restore.
5. Aktiv fane sættes med `setActiveTabForPage(...)`, hvis frame har `tabKey`.
6. React Router navigerer til frame-route.
7. En `requestAnimationFrame`-retry-løkke finder det synlige target via `data-mineo-undo-field-path` eller `data-mineo-undo-focus-token`.
8. Draft-restore forsøges via `draftHistoryRegistry`.
9. Feltets sektion scrolles til start, og feltet fokuseres med `preventScroll: true`.

Retry-løkken findes, fordi route- og tab-skift kan betyde, at target-feltet først findes i DOM efter efterfølgende renders.

## 8. Draft-restore

Undo/redo gendanner committed state. For felter med en gemt blocking invalid draft-fejl gendannes også draft-fejlen, så brugeren kan lande tilbage på samme fejltilstand.

Mekanismen er:
- `useDraftField` og table-inputs registrerer controllere i `src/utils/draftHistoryRegistry.ts`.
- Controlleren registreres på `focusToken` og `fieldPath`.
- `useUndoRedo` udleder restore-state fra frame-fieldErrors.
- Hvis field error er blocking og har `invalidDraft`, kaldes controlleren med `{ kind: 'error' }`.
- Ellers kaldes controlleren med `{ kind: 'committed' }`.

Draft-restore er one-shot pr. restore-loop, så gentagne `requestAnimationFrame` ticks ikke overskriver brugerinput, hvis brugeren når at interagere mellem ticks.

## 9. Authoritative Resync

`restoreHistoryFrame` bumper `authoritativeSnapshotEpoch`.

`usePersistedForm` observerer epoch-skift og bumper `formVersion`, når den relevante sektion ser et nyt authoritative snapshot. Det er signalet til row-draft-systemer som `useRowDrafts` om at resynkronisere lokale draft-strenge med restored committed state.

Almindelige commits bumper ikke `formVersion`; resync er reserveret til authoritative replace-flows som load, reset/migration og undo/redo restore.

## 10. Tabeller

Tabeller kræver ikke særskilt undo-logik for tilføjede eller slettede rækker.

Fordi capture sker før commit, indeholder undo-framet tilstanden før tabelnormalisering:
- En ny udfyldt række fjernes igen ved undo, fordi snapshot kun havde den tomme trailing-række.
- En slettet/tømt række genskabes ved undo, fordi snapshot havde rækken med indhold.

Tabelceller bærer `data-mineo-undo-focus-token` og `data-mineo-undo-field-path`, så restore kan finde og fokusere cellen efter navigation. Ved restore slås tabelceller først op via `fieldPath`; `focusToken` er kun fallback for almindelige felter. Tabel-inputs registrerer også draft-restore-controllere, så local draft/error-state ryddes sammen med committed restore.

## 11. Load, Clear og Save

Filindlæsning rydder undo/redo-stakken efter en succesfuld apply:
- `FormPersistenceContext.replaceAllPersistedData(...)` rydder stakken efter succesfuld autoritativ erstatning.
- Load-utilities skal ikke duplikere denne policy.

`clearAllData` rydder ligeledes undo/redo-stakken.

Gem påvirker ikke undo/redo. Save er persistence af allerede committed state og må ikke oprette, rydde eller flytte history frames.

## 12. Debug

Undo/redo har opt-in debug logging via `src/utils/undoRedoDebug.ts`.

Logging er kun aktiv, når browserkonsollen sætter:

```javascript
window.__MINEO_UNDO_LOG__ = true
```

Når aktivt, bruger logging `console.debug` med `[UNDO/REDO]`-prefix. Normal drift er console-silent.

## 13. Vigtige filer

| Fil | Ansvar |
|---|---|
| `src/stores/undoRedoStore.ts` | In-memory history stack og stack-transitioner |
| `src/hooks/useUndoRedo.ts` | Restore, navigation, draft-restore og fokus |
| `src/hooks/usePersistedForm.ts` | Opretter undo-origin ved felt-commits |
| `src/hooks/useFormFieldErrors.ts` | Capturer invalid draft-fejl til history |
| `src/hooks/usePersistedActiveTab.ts` | Sætter target-fane ved restore |
| `src/components/layout/MainLayout.tsx` | Installerer focus tracker og globale keyboard shortcuts |
| `src/utils/undoFocusTracker.ts` | Sporer senest fokuserede undo-bærende felt |
| `src/utils/draftHistoryRegistry.ts` | Registrerer draft-restore controllers |
| `src/utils/persistenceLoadApply.ts` | Rydder history efter filindlæsning |
| `src/components/inputs/StyledTextFieldBase.tsx` | Bærer undo-attributter (`data-mineo-undo-field-path` fra `name`, `data-mineo-undo-focus-token`) for almindelige blur-commit-felter |
| `src/components/inputs/table/Table*Input.tsx` | Bærer undo-attributter for grid-celler |
| `src/rowDrafts/useRowDrafts.ts` | Bygger `rowId:colIndex` fieldPath ved row-commit (via `fieldColIndex`-mapping) |
| `src/components/inputs/StyledToggleSwitch.tsx` / `StyledDropdown.tsx` / `StyledRadioButton.tsx` | Emitterer `data-mineo-undo-field-path` fra `name`-prop for immediate-commit fokus-restore. Toggle og radio tegner desuden en eksplicit fokus-halo bundet til BÅDE `.Mui-focusVisible` (tab) og `[data-mineo-undo-focused]` (undo/redo-restore), så de to ser ens ud |

## 14. Testflade

Automatiske tests dækker blandt andet:
- pre-commit snapshot capture
- history-størrelsesgrænse
- redo-gren ryddes ved ny capture
- navigation til korrekt side/fane/felt
- restore af invalid draft
- atomisk restore af sections og field errors
- row-draft resync efter restore
- load rydder history
- undo/redo er stille no-op mens editor er åben
- celle-commit tagges med korrekt `rowId:colIndex` (`undoRedoCellIdentity.test.tsx`, `EetAslAfgoerelserTable.test.tsx`)
- immediate-commit widgets tagges med eget felt og bærer `name` (`undoRedoToggleFocus.test.tsx`, `immediateCommitWidgetUndoName.test.ts`)
- blur-commit-felter og radio får fokus/fokus-halo efter undo (`undoRedoBlurCommitFocus.test.tsx`)
- alle persisterede sags-input-felter (immediate-commit + blur-commit) bærer `name` (`immediateCommitWidgetUndoName.test.ts` — værnet dækker nu begge klasser)
