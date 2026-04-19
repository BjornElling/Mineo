# EO Performance — Implementeringsplan

**Symptom:** Erstatningsopgørelse-siden bliver uacceptabelt langsom ved ~40 lønlinjer + ~10 offentlige
ydelser. Selv tastetryk og cellenavigation sætter sig. Fane-skift er særligt slemme.

---

## Diagnoseoverblik

Der er to separate, uafhængige bottlenecks med forskellig karakter:

### Problem A — GridCore-context forårsager masse-re-render ved cellenavigation

`useGridCoreController.ts:23–26`: `focusedCell` og `editingCell` er React state. Enhver
cellenavigation (Tab, Enter, pil, klik) kalder `setFocusedCellState` / `setEditingCellState`,
som trigger et context-update i `GridCoreProvider`.

`useGridCoreController.ts:127–139`: `contextValue` er memoized, men den afhænger direkte af
`focusedCell` og `editingCell` — begge ændrer sig ved hvert navigationsskridt. Det betyder at
`GridCoreStateReactContext` sender et nyt object ved hvert Tab-tryk, uanset split i to contexts.

`gridCoreContext.tsx:22–44`: Provideren splitter korrekt i `GridCoreStateReactContext` og
`GridCoreApiReactContext` med separate `useMemo`. Men API-contextens `useMemo`-deps inkluderer
`value.closeEditing`, `value.openEditing` m.fl. — alle callbacks der rekonstrueres i det samme
`useMemo` i `useGridCoreController.ts:29–125`, som aldrig genberegnes (tom dep-array). Dette er
korrekt. API-contexten er stabil. **Staten er problemet.**

`TableAmountInput.tsx:116–119` og alle øvrige TableInput-varianter (mindst 7 filer bekræftet via
grep): Alle abonnerer på `useGridCoreState()`. Med 40 lønrækker × ~7 celler = **~280
input-komponenter** der alle re-renderes ved hvert cellenavigationsskridt. `React.memo` er
påsat, men den **afhjælper ikke** problemet, fordi `React.memo` kun blokerer re-render ved
ændrede props — ikke ved ændret context-subscription.

**Kerneproblemet:** Det er arkitektonisk korrekt at splitte state/api i to contexts. Det er
*ikke* tilstrækkeligt, fordi alle inputs stadig abonnerer ubetinget på `GridCoreStateReactContext`,
som ændrer sig ved hvert navigationsskridt uanset om netop den komponents celle er involveret.
Selve re-render af ~280 React-komponenter er den dominerende årsag til at tastetryk og
cellenavigation føles langsomt.

### Problem B — `computeEoSnapshot()` kører synkront og blokerer UI-tråden ved fane-skift

`Erstatningsopgoerelse.tsx:149–153`: Effekten kalder `buildDebugSnapshotRef.current()` synkront.
Med 40 lønrækker kører i rækkefølge:
- `erstatningsopgoerelseSchema.safeParse()` — Zod-validering af hele datasættet
- `computeTafNettoBeregning()` — itererer alle lønrækker × TAF-perioder
- `buildDebugSnapshotForComputed()` — 37 filer i debug-domænet bygger debug-tabellen
- `buildErstatningsopgoerelsePdfModelFromComputed()` — PDF-model bygges og caches

Alt dette blokerer UI-tråden synkront ved fane-skift til Beregning/Debug.

**Hvad der IKKE er årsagen:**

- Data committer kun ved **blur**, ikke ved hvert tastetryk. `handleFieldBlur` i StandardLoenTable
  er den eneste vej til Zustand — ikke `onChange`. Snapshot-beregningen er korrekt gated bag
  `isSnapshotTabActive` og kører ikke ved tastetryk på Lønindkomst-fanen.
- Valideringssløjfen over ansættelsesforhold (`LoenindkomstTab.tsx:548–559`) er O(antal ansættelses-
  forhold), ikke O(antal lønrækker). Med typisk ét ansættelsesforhold er dette minimalt.

---

## Kritik af den eksisterende plan

Den eksisterende plan identificerer de rigtige to bottlenecks og beskriver gyldige løsningsretninger. Men
den undervurderer omfanget af Problem A og overser en strukturel inkonsekvens i løsningsforslaget til
Tiltag 1. Følgende bør korrigeres:

**1. Tiltag 1, Option B (anbefalet i planen) er arkitektonisk korrekt, men skelettet er ufuldstændigt.**

Planen foreslår `useSyncExternalStore` med en selector der returnerer `{ isFocused, isEditing }` pr.
celle. Det er den rigtige tilgang. Men skelettet viser:

```ts
const isFocused = useSyncExternalStore(
  gridStore.subscribe,
  () => areSameGridCell(gridStore.getFocusedCell(), gridCell)
);
```

`gridStore.subscribe` skal kaldes med en *snapshot*-funktion der returnerer en referentielt stabil
værdi, ellers vil React re-rendre alligevel. `areSameGridCell` returnerer en `boolean` — det er
korrekt (primitiver er referentielt stabile). Skelettet er altså rigtigt, men det mangler
**storeimplementeringen**: `focusedCellRef` og `editingCellRef` eksisterer allerede i
`useGridCoreController.ts` som refs, men der er ingen ekstern subscription-mekanisme (ingen
`subscribe`/`getSnapshot`-API). Dette skal bygges som en ny mini-store klasse eller funktionalitet
i `useGridCoreController`.

**Konkret:** `useGridCoreController` skal eksponere et `gridStore`-objekt med:
- `subscribe(callback): () => void` — kalder `callback` ved enhver `focusedCell`- eller
  `editingCell`-ændring
- `getFocusedCell(): GridCellCoord | null`
- `getEditingCell(): GridCellCoord | null`

Denne store kan udelukkende leve i refs (`useRef`) og behøver aldrig `React.useState` — det er
netop pointen. `setFocusedCellState` og `setEditingCellState` erstattes af kald til
`gridStore.setFocusedCell()` der notificerer subscribers via en listener-liste i en ref.
`focusedCell`/`editingCell` React state i controlleren kan herefter **fjernes**.

Der er ét kritisk edge case: `useGridCoreController.ts:150–171` bruger `focusedCell` React
state som dep i en `useEffect` for at trigger focus på `<input>` elementet via RAF. Når
`focusedCell` React state fjernes, skal dette erstattes af en `useEffect`-fri løsning — fx en
direkte `requestAnimationFrame`-kald inde i `setFocusedCell`-implementationen i storen, der
kalder `handle.getElement()?.focus()` direkte. Dette er renere og undgår en ekstra render.

**2. Option A (split i to contexts) er allerede implementeret — men planen beskriver det som en mulig løsning.**

`gridCoreContext.tsx:22–44` og `gridCoreContext.shared.ts` splitter allerede i
`GridCoreStateReactContext` og `GridCoreApiReactContext`. Planen beskriver dette som "option A
(mindst invasiv)" der "ikke er tilstrækkelig alene" — men præsenterer det som et fremtidigt valg.
Det er allerede gjort. Dokumentet skal opdateres til at beskrive det som den nuværende tilstand,
og option A skal udgå som selvstændigt tiltag.

**3. Tiltag 2 (`useTransition`) adresserer problem B korrekt, men skelettet har et subtilt problem.**

`useTransition` markerer state-opdateringen som en lav-prioritets transition. Men
`buildDebugSnapshotRef.current()` kaldes *inden* `startTransition` i skelettet som vist:

```tsx
startTransition(() => {
  setEoSnapshot(buildDebugSnapshotRef.current());  // <-- beregning sker INDENFOR transition
});
```

React afvikler transition-callbacks synkront ved schedulering — `startTransition` forsinker ikke
selve beregningen. `computeEoSnapshot()` er ikke en React-render, det er ren JS-beregning.
`useTransition` hjælper **kun** på den efterfølgende render af den tunge snapshotbaserede UI.
Den primære blokering af UI-tråden (selve Zod-parse + engine-beregning) sker stadig synkront.

For at opnå reel non-blocking adfærd skal beregningen flyttes ud af React-render-tråden. Der
er to reelle muligheder:

- **Option A (anbefalet, ingen ny dependency):** Brug `scheduler.postTask()` (Chromium 94+) eller
  `MessageChannel`-trick til at afvikle beregningen som en macrotask, der giver browseren mulighed
  for at rendere en frame med tab-animationen før beregningen starter. Derefter sættes resultatet
  med `setEoSnapshot`. Kræver håndtering af race conditions (abort/ignore stale results). Se
  afsnit nedenfor.
- **Option B (mere robust, men kræver ny infrastruktur):** Flyt `computeEoSnapshot` til en
  Web Worker. Dette er den eneste løsning der garanterer at beregningen ikke blokerer UI-tråden
  overhovedet. Kræver at alt input serialiseres (allerede muligt, da input er rene data uden
  funktioner), men kræver bundling-konfiguration og WorkerPool-infrastruktur. Høj implementerings-
  kompleksitet.

`useTransition` bør stadig bruges, da det hjælper React til at deprioritere den efterfølgende
re-render af snapshot-UI. Men det er ikke tilstrækkeligt alene til at eliminere frysen.

**Anbefalet korrigeret skelet for Tiltag 2 (scheduler/macrotask-approach):**

```tsx
const snapshotRevisionRef = React.useRef<string | null>(null);

React.useEffect(() => {
  if (!isSnapshotTabActive) return;
  if (eoSnapshot?.revision === currentDebugRevision) return;
  if (snapshotRevisionRef.current === currentDebugRevision) return; // allerede igangværende

  snapshotRevisionRef.current = currentDebugRevision;
  const targetRevision = currentDebugRevision;

  const run = () => {
    if (snapshotRevisionRef.current !== targetRevision) return; // stale, afbryd
    const snapshot = buildDebugSnapshotRef.current();
    if (snapshotRevisionRef.current !== targetRevision) return; // stale under beregning
    startTransition(() => setEoSnapshot(snapshot));
  };

  // Giv browseren én frame til at rendere tab-animation inden beregning starter
  const id = requestAnimationFrame(() => {
    // requestAnimationFrame kører inden paint — brug MessageChannel til post-paint
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = run;
    port2.postMessage(null);
  });

  return () => {
    cancelAnimationFrame(id);
    snapshotRevisionRef.current = null;
  };
}, [currentDebugRevision, eoSnapshot?.revision, isSnapshotTabActive, startTransition]);
```

Dette sikrer at tab-animationen renderes ét frame inden beregningen blokerer tråden.

**4. Tiltag 3 og 4 er korrekte men rækkefølgen i den fulde løsning bør omformuleres.**

Tiltag 3 (lazy PDF-model) og Tiltag 4 (lazy debug-snapshot) er begge gyldige og uafhængige af
hinanden. Planen er korrekt. Det eneste der mangler er en præcisering: Tiltag 3 og 4 giver kun
meningsfuld effekt *efter* at Tiltag 2 er implementeret i den korrigerede form (macrotask), fordi
det er beregningens *totale varighed* der afgør om UI-tråden blokerer — ikke antallet af
delberegninger alene.

**5. Tiltag 5 er korrekt vurderet, men kommentaren i `eoSnapshot.ts:332–336` er vigtig kontekst.**

`eoSnapshot.ts:332–336` dokumenterer eksplicit at `collectSammentaellingControlMismatchMessages`
er afhængig af debug-infrastruktur **by design** — ikke som en fejl. Denne invariant
cross-checker engine-outputs mod en separat debug-tabelprojektion, hvilket er en aktiv,
bevidst arkitekturbeslutning. Tiltag 5 er ikke trivielt at gennemføre uden at svække denne
kontrol, og planen er korrekt i at placere den sidst og advavre om risikoen.

---

## Korrigeret tiltag-liste

### Tiltag 1 — Erstat `GridCoreStateReactContext` med en ref-baseret ekstern store ★★★★★

**Effekt:** Eliminerer re-render af ~280 input-komponenter ved hvert cellenavigationsskridt.
Dette er sandsynligvis den dominerende årsag til at tastetryk og Tab-navigation er langsom.
**Risiko:** Medium — involverer ændring i GridCore-infrastrukturen som bruges af alle tabeller.
Kræver omhyggelig test.
**Arbejde:** ~4–6 timer (mere end de 3–5 i original plan pga. fokus-effect-migrering).

**Problem:** `useGridCoreController.ts:23–26`: `focusedCell` og `editingCell` er React state.
`contextValue` (linje 127–139) afhænger af begge og sender et nyt object ved hvert Tab-tryk.
Alle 7+ TableInput-varianter abonnerer på `useGridCoreState()` og re-renderes alle ved hvert
navigationsskridt — `React.memo` hjælper ikke mod context-ændringer.

**Løsning:** Byg en ekstern mini-store i `useGridCoreController` baseret på refs. Fjern
`focusedCell`/`editingCell` React state. Input-komponenter abonnerer med `useSyncExternalStore`
og en cell-specifik selector der returnerer `boolean`.

**Store-interface** (nyt, i `useGridCoreController.ts` eller en dedikeret `gridCoreStore.ts`):

```ts
type GridCellStore = {
  subscribe: (listener: () => void) => () => void;
  getFocusedCell: () => GridCellCoord | null;
  getEditingCell: () => GridCellCoord | null;
  setFocusedCell: (cell: GridCellCoord | null) => void;
  setEditingCell: (cell: GridCellCoord | null) => void;
};
```

**Brug i TableInput-komponenter:**

```ts
const isFocused = useSyncExternalStore(
  gridStore.subscribe,
  () => areSameGridCell(gridStore.getFocusedCell(), gridCell)
);
const isEditing = useSyncExternalStore(
  gridStore.subscribe,
  () => areSameGridCell(gridStore.getEditingCell(), gridCell)
);
```

**Fokus-effect migrering:** `useGridCoreController.ts:150–171` skal omskrives. Fjern `useEffect`
for focus. Kald `requestAnimationFrame(() => handle?.getElement()?.focus())` direkte fra
`setFocusedCell` i storen — kun når den nye focusedCell er non-null og handles element er
tilgængeligt.

**`GridCoreStateReactContext` kan herefter fjernes.** `useGridCoreState()` hook bør opdateres
til at eksponere `gridStore`-referencen i stedet, eller `useSyncExternalStore` kald flyttes
direkte til inputs. Sidstnævnte er renere.

**API-contexten (`GridCoreApiReactContext`) er stabil og berøres ikke.**

**Placering:**
- `src/components/tables/useGridCoreController.ts`
- `src/components/tables/gridCore/gridCoreContext.shared.ts` (fjern `GridCoreStateReactContext`)
- `src/components/tables/gridCore/gridCoreContext.tsx` (fjern `GridCoreStateReactContext.Provider`)
- `src/components/tables/useGridCore.ts` (fjern/erstat `useGridCoreState`)
- `src/components/inputs/table/TableAmountInput.tsx` + alle øvrige TableInput-varianter

**Test:** Med 40 lønrækker: Tab-tast gennem celler bør føles øjeblikkeligt. Brug React DevTools
Profiler til at bekræfte at kun den fokuserede/editerede celle re-renders ved navigation.

---

### Tiltag 2 — Defer snapshot-beregning til post-paint med MacroTask + `useTransition` ★★★★★

**Effekt:** Eliminerer browser-frys ved fane-skift til Beregning/Debug.
**Risiko:** Lav — ingen ændring af beregningslogik. Kræver håndtering af stale-revision.
**Arbejde:** ~1–2 timer (lidt mere end original plan pga. macrotask-koordinering).

**Problem:** `computeEoSnapshot()` køres synkront i `useEffect` og blokerer UI-tråden under
fane-skift. `useTransition` alene er ikke tilstrækkeligt — det deprioriterer render, men
selve beregningens JS-CPU-tid blokerer tråden inden rendering overhovedet sker.

**Løsning:** Defer beregningen til en macrotask der kører *efter* browseren har malet
tab-animationen, kombineret med `useTransition` for den efterfølgende render:

```tsx
const [isPending, startTransition] = React.useTransition();
const snapshotRevisionRef = React.useRef<string | null>(null);

React.useEffect(() => {
  if (!isSnapshotTabActive) return;
  if (eoSnapshot?.revision === currentDebugRevision) return;
  if (snapshotRevisionRef.current === currentDebugRevision) return;

  snapshotRevisionRef.current = currentDebugRevision;
  const targetRevision = currentDebugRevision;

  let rafId: number;
  const run = () => {
    if (snapshotRevisionRef.current !== targetRevision) return;
    const snapshot = buildDebugSnapshotRef.current();
    if (snapshotRevisionRef.current !== targetRevision) return;
    startTransition(() => setEoSnapshot(snapshot));
  };

  rafId = requestAnimationFrame(() => {
    const { port1, port2 } = new MessageChannel();
    port1.onmessage = run;
    port2.postMessage(null);
  });

  return () => {
    cancelAnimationFrame(rafId);
    snapshotRevisionRef.current = null;
  };
}, [currentDebugRevision, eoSnapshot?.revision, isSnapshotTabActive, startTransition]);
```

`isPending` kan bruges til at vise en spinner/loading-indikator i Beregning-fanen.

**Placering:** `src/components/pages/Erstatningsopgoerelse.tsx`, linje 149–153.

**Test:** Skift til Beregning-fanen med 40 lønrækker; fanens animation og øvrig UI bør ikke
fryse. Beregningsresultater må gerne dukke op 100–500 ms forsinket.

---

### Tiltag 3 — Fjern PDF-model fra snapshot-bygning (lazy on-demand) ★★★☆☆

**Effekt:** Reducerer `computeEoSnapshot()` med bygning af PDF-modellen — den del der er mindst
nødvendig ved normale fane-skift.
**Risiko:** Medium — PDF-modellen er aktuelt cached i snapshot for at undgå dobbeltberegning.
Kræver at begge PDF-handlers finder modellen et andet sted.
**Arbejde:** ~2–3 timer.

**Problem:** `eoSnapshot.ts:345–356` bygger `buildErstatningsopgoerelsePdfModelFromComputed()` som
del af ethvert `computeEoSnapshot()`-kald og gemmer den som `data.pdfModel` i snapshot — selv når
brugeren aldrig eksporterer PDF.

**Løsning:** Fjern `pdfModel` fra `EoSnapshotComputedData`. Flyt PDF-model-bygning ind i
`eoSnapshotToEoPdfDocument.ts` og `eoSnapshotToTafPerYearPdfDocument.ts`, der allerede transformerer
snapshot til PDF. For at undgå dobbeltberegning hvis begge PDF'er eksporteres i samme session,
kan en `WeakMap<EoSnapshot, EoModel>`-cache bruges baseret på snapshot-referencen.

**Placering:**
- `src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts` (fjern pdfModel fra type og beregning)
- `src/domain/erstatningsopgoerelse/snapshot/eoSnapshotToEoPdfDocument.ts`
- `src/domain/erstatningsopgoerelse/snapshot/eoSnapshotToTafPerYearPdfDocument.ts`

**Test:** Eksporter begge PDF-typer; bekræft at output er identisk med status quo. Kør testsuite.

---

### Tiltag 4 — Lazy debug-snapshot: spring `buildDebugSnapshotForComputed()` over på Beregning-fanen ★★★☆☆

**Effekt:** Sparer bygning af den store debug-tabel (37 filer) ved fane-skift til Beregning-fanen.
**Risiko:** Lav for selve lazy-loadingen. Høj for den fulde løsning, fordi `buildDebugSnapshotForComputed`
aktuelt er nødvendig for kontrol-mismatch-invarianten (se Tiltag 5).
**Arbejde:** ~1–2 timer for den delvise løsning.

**Problem:** `computeEoSnapshot()` bygger altid `buildDebugSnapshotForComputed()` (linje 308).
Debug-tabellen er udelukkende relevant for Debug/DebugTabel-fanerne, ikke for Beregning-fanen.

**Delvis løsning (uafhængig af Tiltag 5):** Tilføj en `includeDebugSnapshot: boolean`-parameter
til `computeEoSnapshot()`. Kald den med `false` fra Beregning-fanen, `true` fra Debug/DebugTabel.
Kontrol-mismatch-invarianten kræver dog fortsat `debugSnapshot`, så invariant-checket skal gøres
conditionelt: spring det over hvis `debugSnapshot === null`.

**Fuld løsning (kræver Tiltag 5 først):** Når kontrol-mismatch-checket er refaktoreret til at gå
direkte på engine-outputs, kan `buildDebugSnapshotForComputed` fjernes fuldstændigt fra normal-beregningstien.

**Vigtig kontekst fra koden:** `eoSnapshot.ts:332–336` indeholder en eksplicit kommentar der
dokumenterer at debug-infrastruktur-afhængigheden er arkitektonisk bevidst: invarianten
cross-checker engine-outputs mod en uafhængig tabelprojektion. Dette er feature, ikke fejl.
Tiltag 5 svækker denne garanti — det skal vurderes kritisk.

**Placering:** `src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts`, linje 308 og 336–340.

**Test:** Skift til Beregning-fanen; bekræft at totaler er korrekte og invarianter vises korrekt.
Skift til Debug-fanen; bekræft at debug-tabellen stadig vises korrekt. Kør testsuite.

---

### Tiltag 5 — Kontrol-mismatch-invariant: refaktorér til engine-direkte check ★★☆☆☆

**Effekt:** Forudsætning for Tiltag 4 i fuld form — muliggør at fjerne `buildDebugSnapshotForComputed`
fra normal-beregningstien.
**Risiko:** Medium-høj — involverer logik der cross-checker authoritative engine-outputs mod
debug-infrastruktur. Kræver grundig forståelse af sammentæl­lingsmodellen. Svækker potentielt
den arkitektonisk bevidste cross-check-egenskab (se ovenfor).
**Arbejde:** ~4–6 timer.

**Problem:** `eoSnapshot.ts:337`: `collectSammentaellingControlMismatchMessages(debugSnapshot.sammentaellingRows)`.
Debug-snapshot bygges altid, fordi kontrol-mismatch-invarianten afhænger af den.

**Løsning:** Refaktorér `collectSammentaellingControlMismatchMessages` til at arbejde direkte på
engine-outputs (`tafNetto`, `svieSmerte`, `oevrigeKrav`, `totals`) i stedet for via
`sammentaellingRows` i debug-tabellen. Kontrol-mismatch er en matematisk egenskab der principielt
kan verificeres mod engine-data uden debug-infrastruktur.

**Advarsel:** Invariantens nuværende styrke ligger i at den bruger en *uafhængig kodegren* til at
checke. En engine-direkte check tester kun at engine-koden er intern konsistent — ikke at
debug-tabel-beregningen stemmer. Overvej om begge checks bør bevares (engine + debug), eller
om debug-tabel-checket accepteres fjernet som en bevidst trade-off.

**Placering:**
- `src/domain/debug/eoDebugSammentaelling.ts`
- `src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts`

**Test:** Kør testsuite inkl. `eoDebugTafOverlapParity.test.ts`. Bekræft eksplicit at
kontrol-mismatch-invarianten fortsat opfanger mismatch i kendte fejlscenarier.

---

## Rækkefølge og afhængigheder

```
Tiltag 1  →  Kan indarbejdes isoleret. Kræver omhyggelig test af GridCore.
Tiltag 2  →  Kan indarbejdes isoleret. Ingen afhængigheder.
Tiltag 3  →  Kan indarbejdes isoleret.
Tiltag 4  →  Delvis løsning er uafhængig. Fuld løsning kræver Tiltag 5 først.
Tiltag 5  →  Forudsætning for Tiltag 4 (fuld effekt). Indarbejdes sidst.
```

**Anbefalet rækkefølge:** 2 → 1 → 3 → 4 (delvis) → 5 → 4 (fuld)

Start med Tiltag 2 (lavest risiko, øjeblikkelig effekt på fane-skift), derefter Tiltag 1 som er
den største enkeltforbedring men også mest kompleks at teste.

---

## Testplan

Prioritér i nævnte rækkefølge:

1. **Manuel responsivitetstest:** Opret sag med 40 lønrækker + 10 offentlige ydelser. Mål
   subjektiv responstid for: Tab-tast cellenavigation, tastetryk i beløbscelle, fane-skift
   til Beregning, fane-skift tilbage til Lønindkomst.
2. **React DevTools Profiler:** Brug Profiler-tab til at måle antal re-renders og render-tid
   per cellenavigation — især nyttigt til at verificere effekten af Tiltag 1.
3. **Korrekthedstjek:** Efter hvert tiltag: verificer at totaler på Beregning-fanen er identiske
   med status quo. Brug Debug-tabellen som reference.
4. **Regressions-testsuite:** `npx vitest run` efter hvert tiltag. Bemærk at
   `eoDebugTafOverlapParity.test.ts` har en pre-existing failing test der ikke er relateret til
   disse ændringer.
5. **PDF-eksport:** Efter Tiltag 3: eksporter begge PDF-typer og sammenlign output visuelt med
   reference-PDF fra uændret kode.
