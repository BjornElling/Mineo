# Arkitekturnotat: Undo/Redo

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
| Scroll | Sektion-scroll (`block: 'start'`) på feltets nærmeste `[data-section-id]`-forfader, derefter fokus med `preventScroll: true` |
| Aktivering mens editor er åben | **Blokeret.** Undo/redo kan ikke trigges, så længe en tekstinput-editor eller grid-celle-editor er åben. Brugeren ser en advarsel og skal afslutte/annullere editoren først. |

### Centralt designvalg: undo/redo blokeres mens en editor er åben

Undo og redo er blokeret når enhver af disse er sande:
- `document.activeElement` er et åbent (ikke-readOnly) tekstinput eller textarea — dvs. en `StyledField`-editor er åben med en igangværende draft.
- Mindst ét grid har en aktiv editing-celle (`getEditingCell() !== null`).

I begge tilfælde forhindres tastaturgenvejen, og brugeren får et advarsels-overlay: *"Kan ikke fortryde eller gentage: afslut eller ret det aktive felt først."*

**Hvorfor:** Hvis brugeren trykker Ctrl+Z mens et felt har en uafsluttet draft, ville flytning af fokus til undo-målet udløse en sideeffekt-commit (via blur) på det aktive felt lige inden state restores. Det skaber en ekstra, uventet entry i historikken og en non-deterministisk rækkefølge mellem brugerens intention (fortryd) og browserens fokus-skift. Ved at kræve at editoren først afsluttes (Tab/Enter) eller annulleres (Escape), bevares en simpel og forudsigelig kontrakt: undo/redo opererer altid på committed state, aldrig på drafts.

**Implementering:** Detekteres i `MainLayout` via `isOpenTextEditorElement(document.activeElement) || hasOpenGridEditor()` før `undo()`/`redo()` kaldes. Detektorerne bor i `src/utils/commitFlush.ts`.

### Centralt designvalg: undo-origin fanges fra senest fokuserede felt, ikke `document.activeElement`

Felt-commits trigges typisk af `onBlur` *efter* fokus er flyttet til et andet felt. På det tidspunkt peger `document.activeElement` på det nye felt, ikke på feltet der ændrede sig. Hvis vi læste `activeElement` ved capture, ville undo navigere tilbage til det felt brugeren netop var på vej hen til — ikke det felt der blev redigeret.

**Løsning:** Document-level `focusin` (capture phase) sporer det senest fokuserede felt der bærer `data-mineo-undo-focus-token` / `data-mineo-undo-field-path`. `usePersistedForm.createUndoOrigin` læser fra denne tracker. Bor i `src/utils/undoFocusTracker.ts`.

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
  future: HistoryFrame[];   // Skridt man kan gentage — redo går herfra
};
```

`past[past.length - 1]` er det seneste undo-mål. `future[0]` er det næste redo-mål.
Der findes bevidst intet `present`-felt; den aktuelle tilstand læses fra `formPersistenceStore`
og snapshots af den aktuelle tilstand oprettes først ved `undo()`/`redo()`, så redo-stakken kan bygges.

Stakken har maks 50 elementer i `past`. Når grænsen nås droppes det ældste element.

---

## Arkitekturkomponenter

### 1. `undoRedoStore` (`src/stores/undoRedoStore.ts`)

En separat Zustand vanilla-store (uden persist-middleware — stakken lever kun i memory).

```typescript
type UndoRedoStore = {
  past: HistoryFrame[];
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

**`redo()`** — returnerer den `HistoryFrame` der skal gendannes, snapshottet af den aktuelle tilstand gemmes i `past`, og stakkene opdateres.

**`clear()`** — tømmer past og future (bruges ved filindlæsning).

### 2. `useUndoRedo` (`src/hooks/useUndoRedo.ts`)

React-hook der eksponerer `canUndo`, `canRedo`, `undo()` og `redo()` til brug i `MainLayout`. Den udfører også den faktiske gendannelse mod `formPersistenceStore` og navigationen.

```typescript
const { canUndo, canRedo, undo, redo } = useUndoRedo();
```

Internt kalder den:
- `formPersistenceStore.restoreHistoryFrame(...)`, som atomisk gendanner sections, revisions, fieldErrors og fieldErrorRevisions og bumper `authoritativeSnapshotEpoch`
- Navigation og fokus (se nedenfor)

### 3. Capture-punkt i `usePersistedForm`

`setValues` i `usePersistedForm` er stedet hvor felt-commits ender, inden de når `commitSection`. Det er her capture skal ske.

```
onCommit → setValues(updater) → persistData(pageKey, next, { undoOrigin }) → capture(origin) → commitSection()
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

Navigation, draft-restore og fokus sekventeres i én `requestAnimationFrame`-retry-løkke. Først sættes route og aktiv fane, derefter venter løkken på at målfeltet er synligt i DOM. Når feltet findes, forsøges draft-restore via `draftHistoryRegistry`, og derefter scrolles/fokuseres feltet. Denne sekvensering forhindrer at separate rAF-løkker konkurrerer med React Router-mount og tab-mount.

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

## Implementeringsstatus

Undo/redo er implementeret. Punkterne nedenfor beskriver den aktuelle test- og vedligeholdelsesflade, ikke manglende implementeringsstadier.

Automatiske tests dækker:
- Snapshot gemmes korrekt som pre-commit-tilstand.
- Stakstørrelsesgrænsen på 50 håndhæves.
- Redo-grenen ryddes ved ny capture.
- Navigation til korrekt side/fane/felt.
- Ugyldig draft gendannes via fieldPath.
- Atomisk history-restore af sections + field-errors.
- Centrale tabelscenarier:
- Tilføj ny række → undo → rækken forsvinder
- Slet rækkeindhold → commit → undo → rækken og indholdet genskabes
- Row-drafts resyncer efter undo via `authoritativeSnapshotEpoch`.

---

## Risici og opmærksomhedspunkter

### formVersion og draft-resync

`usePersistedForm.formVersion` bruges af tabelkomponenter (bl.a. `useRowDrafts`) til at resync lokale draft-strenge med committed-værdier. Undo bruger `restoreHistoryFrame`, som bumper `authoritativeSnapshotEpoch`; `usePersistedForm` observerer epoch-skiftet og bumper `formVersion`.

Denne kæde er dækket af integrationstest for tilføjet og slettet tabelrække.

### authoritativeSnapshotEpoch

`restoreHistoryFrame` bumper `authoritativeSnapshotEpoch` med +1. Det gør undo/redo til et autoritativt replace-flow for form-consumers og sikrer row-draft resync.

### Fokus-tilgængelighed

`data-field-path`-queryen fungerer kun hvis feltet er renderet. Felter på ikke-aktive faner er ikke i DOM. Navigation-steget (Stadie 2) skal ske *inden* focus-steget, og focus skal udskydes til komponenten er mounted via `requestAnimationFrame`.

### Tabelrækker med server-genererede ID'er

Tabelrækker har `id`-felter (f.eks. `{ id: string; fra: string; til: string }`). Snapshot-gendannelse bevarer de gemte ID'er, ikke de auto-genererede. Verificer at `createEmptyRow()` ikke kolliderer med gendannede rækkers ID'er, og at tabeller er robuste over for ID-genbrug.

---

## Filer der berøres

| Fil | Ændring |
|---|---|
| `src/stores/undoRedoStore.ts` | In-memory history stack |
| `src/hooks/useUndoRedo.ts` | Restore, navigation, draft-restore og fokus |
| `src/hooks/usePersistedForm.ts` | Opretter undo-origin ved `setValues`/`setFieldValue` |
| `src/hooks/usePersistedActiveTab.ts` | Tilføj `setActiveTabForPage` |
| `src/components/layout/MainLayout.tsx` | Tilslut keyboard-shortcuts; tilslut `clear()` efter filindlæsning |
| `src/components/inputs/StyledTextFieldBase.tsx` | Bærer undo-attributter |
| `src/components/inputs/table/Table*.tsx` | Bærer undo-attributter for grid-celler |
| `src/contracts/form-contract.md` | Dokumentér capture-kontrakten |
