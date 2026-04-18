# Implementeringsplan: Undo/Redo

## Overblik

Undo/redo implementeres som en separat Zustand-store (`undoRedoStore`) der vedligeholder en stak af snapshots over det aktive `formPersistenceStore`-data. Ctrl+Z ruller til forrige snapshot, Ctrl+Shift+Z (og Ctrl+Y) ruller frem igen. Stakken lever udelukkende i session-hukommelsen (in-memory i Zustand, ikke sessionStorage), tømmes ved filindlæsning og ryddes aldrig ved gem.

---

## Nøglebeslutninger

| Spørgsmål | Beslutning |
|---|---|
| Undo-scope | Ét felt-commit = ét undo-skridt (altid, uanset rækkefølge) |
| Tabeller: fortryd tilføjet række | Rækken fjernes igen (snapshot indeholder pre-commit tilstand) |
| Tabeller: gendan slettet række | Rækken og indholdet genskabes fuldt ud |
| Navigation ved undo/redo | Programmet navigerer til den rigtige side + fane og giver cellen fokus |
| Filindlæsning | Tømmer stakken — undo virker ikke over denne grænse |
| Gem | Ingen effekt på stakken; undo/redo virker hen over gem-handlinger |
| Stakstørrelse | Maks 50 skridt |
| UI-indikator | Ingen — rent tastaturbaseret (Ctrl+Z / Ctrl+Shift+Z) |
| Scroll | Auto-scroll til cellen ved fokus |

---

## Datamodel

### HistoryFrame

Hvert skridt i stakken gemmer et fuldt snapshot af `formPersistenceStore`-data samt metadata om *hvorfra* committet kom, så programmet kan navigere tilbage til den rette side og celle.

```typescript
type HistoryFrameOrigin = {
  route: string;           // F.eks. '/erstatningsopgoerelse'
  tabKey: string | null;   // F.eks. 'loenindkomst', eller null for sider uden faner
  sectionKey: keyof FormPersistenceSections;
  fieldPath: string;       // F.eks. 'perioder[2].fra' — til fokus-genfinding
};

type HistoryFrame = {
  id: string;
  timestamp: number;
  sections: FormPersistenceSections;
  sectionRevisions: SectionRevisionMap;
  fieldErrors: FieldErrorCache;
  fieldErrorRevisions: FieldErrorRevisionMap;
  meta: FormPersistenceMeta;
  origin: HistoryFrameOrigin;
};
```

`origin` optages i det øjeblik committet sker — dvs. hvilken side/fane brugeren stod på, og hvilket felt der netop blev committed. Dette bruges til navigation ved undo/redo.

### UndoRedoState

```typescript
type UndoRedoState = {
  past: HistoryFrame[];     // Skridt man kan fortryde — undo går herfra
  present: HistoryFrame;    // Nuværende tilstand
  future: HistoryFrame[];   // Skridt man kan gentage — redo går herfra
};
```

`past[past.length - 1]` er det seneste undo-mål. `future[0]` er det næste redo-mål.

Stakken har maks 50 elementer i `past`. Når grænsen nås droppes det ældste element.

---

## Arkitekturkomponenter

### 1. `undoRedoStore` (ny fil: `src/stores/undoRedoStore.ts`)

En separat Zustand vanilla-store (uden persist-middleware — stakken lever kun i memory).

```typescript
type UndoRedoStore = {
  past: HistoryFrame[];
  present: HistoryFrame | null;
  future: HistoryFrame[];

  canUndo: () => boolean;
  canRedo: () => boolean;

  capture: (origin: HistoryFrameOrigin) => void;
  undo: () => HistoryFrame | null;
  redo: () => HistoryFrame | null;
  clear: () => void;
};
```

**`capture(origin)`** — tages *inden* committet skrives til `formPersistenceStore`. Snapshot optager tilstanden *før* ændringen, plus origin-metadata der angiver hvorfra committet kom. Future ryddes ved capture (en ny gren starter).

**`undo()`** — returnerer den `HistoryFrame` der skal gendannes, og opdaterer stakkene. Returnerer `null` hvis intet kan fortrydes.

**`redo()`** — returnerer den `HistoryFrame` der skal gendannes (present gemmes i future), og opdaterer stakkene.

**`clear()`** — tømmer past, present og future (bruges ved filindlæsning).

### 2. `useUndoRedo` (ny fil: `src/hooks/useUndoRedo.ts`)

React-hook der eksponerer `canUndo`, `canRedo`, `undo()` og `redo()` til brug i `MainLayout`. Den udfører også den faktiske gendannelse mod `formPersistenceStore` og navigationen.

```typescript
const { canUndo, canRedo, undo, redo } = useUndoRedo();
```

Internt kalder den:
- `formPersistenceStore.rollbackSections(frame.sections, frame.sectionRevisions, frame.authoritativeSnapshotEpoch, frame.meta)`
- `formPersistenceStore.restoreFieldErrors(frame.fieldErrors, frame.fieldErrorRevisions)`
- Navigation og fokus (se nedenfor)

### 3. Capture-punkt i `usePersistedForm`

`setValues` i `usePersistedForm` er stedet hvor felt-commits ender, inden de når `commitSection`. Det er her capture skal ske.

Nuværende flow:
```
onCommit → setValues(updater) → persistData(pageKey, next) → commitSection()
```

Nyt flow med capture:
```
onCommit → setValues(updater) → capture(origin) → persistData(pageKey, next) → commitSection()
```

`usePersistedForm` modtager `origin`-informationen (route, tabKey, sectionKey, fieldPath) som parameter, eller via en kontekst. Se sektion om fieldPath-sporing nedenfor.

**Alternativt capture-punkt:** `commitSection` i selve `formPersistenceStore`. Fordelen er centralisering; ulempen er at `commitSection` ikke kender til UI-origin (side, fane, felt). Da origin er afgørende for navigation, er `usePersistedForm.setValues` det rigtige sted.

### 4. Origin-sporing

For at vide *hvad der netop blev committed* og kunne give fokus til det rigtige felt, skal der spores:

- **route**: fra React Router (`useLocation().pathname`)
- **tabKey**: fra `usePersistedActiveTab` (den aktive fane for siden, eller null)
- **sectionKey**: kendes af `usePersistedForm` (dens `pageKey`-parameter)
- **fieldPath**: stien til det specifikke felt i data-objektet

`fieldPath` er den svære del. Felter kalder `setFieldValue(fieldName, value)` eller `setValues(updater)`. For `setFieldValue` er feltnavnet direkte tilgængeligt. For tabelrækker er stien f.eks. `perioder[2].fra`.

**Løsning:** `setValues` og `setFieldValue` udvides med en valgfri `fieldPath: string`-parameter. Tabeller sender rækkeindex + feltnavn. Simple felter sender feltnavnet direkte. Implementationen kan starte med feltnavnet og udvides med tabelstier i takt med tabel-by-tabel implementering.

#### Fokus ved undo/redo

For at give fokus til et felt uden at åbne editoren, kræves en mekanisme til at finde DOM-elementet fra en `fieldPath`. To tilgange:

**Option A: `data-field-path`-attribut på input-elementer**
Hvert `StyledField`-element (Layer B/C i feltarkitekturen) renders med `data-field-path="perioder[2].fra"`. Undo-logikken bruger `document.querySelector('[data-field-path="..."]')` til at finde og fokusere elementet.

**Option B: Ref-registry**
En React-kontekst med et `Map<fieldPath, HTMLElement>` der registreres ved mount og afregistreres ved unmount.

Option A er enklere at implementere og vedligeholde. Brug Option A.

---

## Tabelrækkehåndtering

Tabeller bruger `normalizeGridRows` som altid sikrer en trailing-tom-række. Snapshot-tilgangen håndterer dette naturligt:

**Scenarie: Brugeren tilføjer en ny række**
1. Bruger taster "01.01.2022" i Fra-feltet i den tomme bundlinje → trykker Tab
2. *Inden* commit: `capture()` gemmer snapshot af sektionen *uden* den nye udfyldte række (trailing-tom-række er stadigt tom)
3. `commitSection` skrives — `normalizeGridRows` sikrer ny trailing-tom-række tilføjes
4. Brugeren trykker Ctrl+Z
5. Snapshot gendannes — sektionen har nu kun den tomme trailing-række → den fyldte række er borte

**Scenarie: Brugeren sletter en rækkes indhold**
1. Bruger sletter Fra-feltet i en eksisterende udfyldt række → trykker Tab
2. Rækken bliver tom → `normalizeGridRows` fjerner den (kun trailing-tom-række overlever)
3. *Inden* commit: `capture()` gemmer snapshot *med* rækken intakt
4. Brugeren trykker Ctrl+Z
5. Snapshot gendannes — rækken er tilbage med sit tidligere indhold

Da capture sker *inden* committet skrives, er begge scenarier dækket automatisk. Ingen særlig tabel-logik nødvendig.

---

## Navigation og fokus

### Navigationsstrategi

Ved undo/redo:

1. Hent `origin` fra den `HistoryFrame` der gendannes
2. Naviger til `origin.route` med React Router (`navigate(origin.route)`)
3. Hvis `origin.tabKey !== null`: sæt aktiv fane via `setActiveTab(origin.tabKey)` for den relevante side
4. Giv fokus til feltet: `document.querySelector('[data-field-path="..."]')?.focus()`

For punkt 3 kræves adgang til tab-state for de relevante sider udefra. Da `usePersistedActiveTab` bruger sessionStorage, kan tab-key sættes direkte:

```typescript
sessionStorage.setItem(createActiveTabStorageKey(pageId), tabKey);
```

Dette er lavniveauadgang til en implementeringsdetalje i `usePersistedActiveTab`. Alternativt kan en funktion `setActiveTabForPage(pageId, tabKey)` eksponeres. Sidstnævnte er renere og bør foretrækkes.

### Timing

Navigation og fokus skal ske *efter* at React har re-renderet med de gendannede værdier. Brug `requestAnimationFrame` eller `setTimeout(0)` til at forsinke fokus-kaldet. Scroll til elementet med `element.scrollIntoView({ behavior: 'smooth', block: 'nearest' })`.

---

## Keyboard-integration i `MainLayout`

Udvid den eksisterende keydown-handler (linje ~223):

```typescript
if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 'z') {
  e.preventDefault();
  undo();
}
if (((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'z') ||
    ((e.ctrlKey || e.metaKey) && e.key === 'y')) {
  e.preventDefault();
  redo();
}
```

Ctrl+Y er konventionel redo-genvej på Windows; Ctrl+Shift+Z er Mac/Linux-konventionen. Begge understøttes.

---

## Filindlæsning og gem

**Filindlæsning:** `executePersistenceLoadApply` kalder `replaceAllPersistedData`. Umiddelbart *efter* dette kald skal `undoRedoStore.clear()` kaldes. Det sikrer at stakken er tom og brugeren ikke kan undo over filindlæsningen.

**Gem:** Ingen ændring. Gem-handlingen kalder ikke `commitSection` og rører dermed hverken stakken eller capture-logikken.

---

## Implementeringsstadier

### Stadie 1: Fundament (undoRedoStore + capture)

**Mål:** Stakken eksisterer og fanger commits korrekt, men ingen navigation eller fokus endnu.

1. Opret `src/stores/undoRedoStore.ts` med `capture`, `undo`, `redo`, `clear`
2. Udvid `usePersistedForm.setValues` til at kalde `capture()` inden `persistData()`
3. Tilslut `clear()` i `executePersistenceLoadApply` efter `replaceAllPersistedData`
4. Tilslut Ctrl+Z/Ctrl+Shift+Z/Ctrl+Y i `MainLayout.tsx`
5. Gendannelse: kald `rollbackSections` + `restoreFieldErrors` — ingen navigation endnu

**Test:** Verificer at snapshot gemmes korrekt (pre-commit tilstand), at stakstørrelsesgrænsen på 50 håndhæves, at filindlæsning tømmer stakken, og at gem ikke påvirker stakken.

### Stadie 2: Navigation og fokus

**Mål:** Undo/redo bringer brugeren til rette side, fane og felt.

1. Tilføj `origin: HistoryFrameOrigin` til `HistoryFrame`
2. Udbyg `usePersistedForm` til at kende `route`, `tabKey`, og `fieldPath` ved capture
3. Tilføj `data-field-path`-attribut til `StyledTextFieldBase` (og tilsvarende base-komponenter)
4. For tabeller: send `fieldPath` som `perioder[${rowIndex}].${fieldName}` fra tabelcellers onCommit
5. Implementér `setActiveTabForPage(pageId, tabKey)` i `usePersistedActiveTab`
6. Implementér navigation + fokus + scroll i `useUndoRedo` med `requestAnimationFrame`

**Test:** Verificer navigation til korrekt side og fane for felter på begge flersidet-sider (`erstatningsopgoerelse`, `erhvervsevnetab`). Verificer at `data-field-path` er unik og findbar.

### Stadie 3: Tabelintegration

**Mål:** Undo/redo håndterer tilføjelse og sletning af tabelrækker korrekt.

1. Verificer at capture-tidspunktet (før committet) er *inden* `normalizeGridRows` kører
2. Gennemgå alle tabeller med auto-add-rækker og verificer korrekt `fieldPath`-format
3. Håndtér edge case: undo af commit der medførte sortering af tabelrækker (snapshot indeholder pre-sort tilstand, som er korrekt)

**Test:** Enhedstest for de centrale tabelscenarier:
- Tilføj ny række → undo → rækken forsvinder
- Slet rækkeindhold → commit → undo → rækken og indholdet genskabes
- Undo over rækkeomsorterings-commit

### Stadie 4: Tværgående test og edge cases

1. Test Ctrl+Z over sideskift (fra `/aarsloen` til `/erstatningsopgoerelse`, undo → hopper tilbage)
2. Test redo-stakken tømmes ved ny commit (korrekt; sker via `capture()`)
3. Test 50-skridt-grænsen: skridt 51 dropper det ældste
4. Test at `authoritativeSnapshotEpoch` ikke bumpes under undo/redo (bruger `rollbackSections`, der gendanner epoch fra snapshot — skal specificeres at epoch fra snapshot bevares, ikke at en ny genereres)
5. Test at `formVersion` reagerer korrekt: `replaceValues` kalder `bumpFormVersion()`, men undo/redo bruger `rollbackSections` direkte, som ikke bumper formVersion via den rute

**Bemærk formVersion-risiko:** `formVersion` i `usePersistedForm` bumpes ved `replaceValues`, men `rollbackSections` bypasser dette. Hooks der lytter på `formVersion` (f.eks. `useRowDrafts`) resetter muligvis ikke draft-tilstand korrekt ved undo. Dette skal undersøges og adresseres i Stadie 4 — muligvis ved at expose en `bumpFormVersion()`-mekanisme der også kan trigges fra undo-stien.

---

## Risici og opmærksomhedspunkter

### formVersion og draft-resync

`usePersistedForm.formVersion` bruges af tabelkomponenter (bl.a. `useRowDrafts`) til at resync lokale draft-strenge med committed-værdier. Undo bruger `rollbackSections` direkte på store-niveau, som *ikke* kalder `replaceValues` og dermed ikke bumper `formVersion`.

**Risiko:** Tabelrækker viser forældet draft-tekst efter undo.

**Løsning:** Undo-stien skal trigge den samme resync-mekanisme som `replaceValues`. Mulige tilgange:
- Kald `replaceValues` for berørte sektioner fra undo-stien (men det bumper uønsket `authoritativeSnapshotEpoch`)
- Tilføj en dedikeret `bumpFormVersionForSection(key)` funktion der kun trigge resync uden at bumpe epoch
- Eksponér en `useUndoApplied`-event der tables kan abonnere på

Dette er det teknisk vanskeligste punkt i implementeringen og bør løses i Stadie 1 inden tabeller tilføjes.

### authoritativeSnapshotEpoch

`rollbackSections` gendanner `authoritativeSnapshotEpoch` til den værdi der var i snapshot'et. Komponenter der lytter på epoch-ændringer (f.eks. `useUnsavedChangesGuard`) kan reagere uforudsigeligt. Bekræft at undo-gendannelse producerer en epoch-ændring eller ej, og om det medfører utilsigtet side-effekt.

### Fokus-tilgængelighed

`data-field-path`-queryen fungerer kun hvis feltet er renderet. Felter på ikke-aktive faner er ikke i DOM. Navigation-steget (Stadie 2) skal ske *inden* focus-steget, og focus skal udskydes til komponenten er mounted via `requestAnimationFrame`.

### Tabelrækker med server-genererede ID'er

Tabelrækker har `id`-felter (f.eks. `{ id: string; fra: string; til: string }`). Snapshot-gendannelse bevarer de gemte ID'er, ikke de auto-genererede. Verificer at `createEmptyRow()` ikke kolliderer med gendannede rækkers ID'er, og at tabeller er robuste over for ID-genbrug.

---

## Filer der berøres

| Fil | Ændring |
|---|---|
| `src/stores/undoRedoStore.ts` | Ny |
| `src/hooks/useUndoRedo.ts` | Ny |
| `src/hooks/usePersistedForm.ts` | Tilføj capture-kald i `setValues`/`setFieldValue` |
| `src/hooks/usePersistedActiveTab.ts` | Tilføj `setActiveTabForPage` |
| `src/components/layout/MainLayout.tsx` | Tilslut keyboard-shortcuts; tilslut `clear()` efter filindlæsning |
| `src/utils/executePersistenceLoadApply.ts` | Kald `undoRedoStore.clear()` |
| `src/components/inputs/StyledTextFieldBase.tsx` | Tilføj `data-field-path`-prop |
| `src/components/inputs/table/Table*.tsx` | Send `fieldPath` med rækkeindex til onCommit |
| `src/contracts/form-contract.md` | Dokumentér capture-kontrakten |
