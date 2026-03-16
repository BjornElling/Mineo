# Hurtigere faneskift i Erstatningsopgørelse

Dette notat beskriver de mest sandsynlige årsager til langsomme faneskift i `Erstatningsopgørelse`, især når der er mange indtastninger i `Lønindkomst` og `Offentlige ydelser`. Notatet er verificeret mod kildekoden (2026-03-16).

---

## Status på implementering

| Punkt | Beskrivelse | Status |
|---|---|---|
| 1.5 / 2.1a | Props til `OffentligeYdelserTab` indsnævret | ✅ Implementeret |
| 1.4 / 2.2 | `aarsloenExternalCellErrorMessagesByAfId`-dependency indsnævret | ✅ Implementeret |
| 1.7 / 2.5 | Selector-baseret persistence (snapshot via `useSyncExternalStore`) | ✅ Implementeret |
| 1.2 / 2.1b | Props til `LoenindkomstTab` indsnævret | ❌ Ikke implementeret |
| 2.3 | `LoenindkomstTab` opdelt i delkomponenter pr. ansættelsesforhold | ❌ Ikke implementeret |
| 2.6 | Virtualisering | ❌ Ikke implementeret (lavest prioritet) |

---

## 1. Årsager til problemet

### 1.1 Monterede faner holdes i live efter første besøg

I [Erstatningsopgoerelse.tsx](src/components/pages/Erstatningsopgoerelse.tsx) bruges en `visitedTabs`-strategi, hvor tunge faner mountes ved første besøg og derefter forbliver mounted. De skjules med `display: none`.

Konsekvens:
- Skjulte faner kan stadig rerendere.
- Faneskift er ikke kun et spørgsmål om at vise/skjule UI, men også om reconciliation af allerede tunge undertræer.
- Problemet er proportionalt med antallet af ansættelsesforhold og tabeller i de skjulte faner.

Strategien er en bevidst arkitektonisk forudsætning for at overholde no-live-preview- og draft/commit-kontrakten. Den bør **ikke** løses med unmount som første greb — det risikerer at flytte problemet fra performance til dataintegritet og draft-tab. Se 2.4.

### 1.2 LoenindkomstTab modtager stadig hele `form` som prop

`LoenindkomstTab` modtager `form: ErstatningsopgoerelseFormApi` (dvs. `{ values, setValues }`), som giver ny reference ved enhver EO-ændring. Fanens `React.memo` bryder dermed ved enhver value-ændring i hele EO — uanset om ændringen berører lønindkomst.

**Status: Ikke implementeret.** Se åbne fund i afsnit 4.

### 1.3 LoenindkomstTab genberegner bredt på tværs af hele fanen

`LoenindkomstTab` er stor og centraliseret og laver afledte beregninger over alle ansættelsesforhold i samme komponent.

Konsekvens:
- Små ændringer kan udløse bred genberegning og rerendering.
- Jo flere ansættelsesforhold og tabeller, desto dyrere ved faneskift og EO-opdateringer.

**Status: Ikke implementeret.** Se åbne fund i afsnit 4.

### 1.4 Memo-dependency for `aarsloenExternalCellErrorMessagesByAfId` — ✅ Rettet

Tidligere var dependency `[values]` (hele state-objektet). Nu er den indsnævret:

```tsx
// LoenindkomstTab.tsx — nu implementeret
const aarsloenZeroArbejdsdageValidationInput = React.useMemo<AarsloenZeroArbejdsdageValidationInput>(() => ({
  beregnesUdFra: values.beregnesUdFra,
  periodeTilBeregningFra: values.periodeTilBeregningFra,
  periodeTilBeregningTil: values.periodeTilBeregningTil,
  loenindkomstAnsaettelsesforhold: values.loenindkomstAnsaettelsesforhold,
  ferieperioder: values.ferieperioder,
  fravaerPerioder: values.fravaerPerioder,
}), [
  values.beregnesUdFra,
  values.ferieperioder,
  values.fravaerPerioder,
  values.loenindkomstAnsaettelsesforhold,
  values.periodeTilBeregningFra,
  values.periodeTilBeregningTil,
]);

const aarsloenExternalCellErrorMessagesByAfId = React.useMemo(..., [
  aarsloenZeroArbejdsdageValidationInput,
  values.loenindkomstAnsaettelsesforhold,
]);
```

Implementeringen er korrekt og præcist afgrænset til de felter `computeTafBeregningsenhed` og valideringshelpers faktisk læser. Det er en to-trins memoization: den dyre validering afhænger af `aarsloenZeroArbejdsdageValidationInput`, som kun ændres når de relevante felter skifter.

**Review-fund:** Se afsnit 4.1.

### 1.5 OffentligeYdelserTab modtog hele `form` — ✅ Rettet

`OffentligeYdelserTab` modtager nu præcist afgrænsede props:

```tsx
// Erstatningsopgoerelse.tsx — nu implementeret
const handleOffentligeYdelserRowsChange = React.useCallback(
  (newData: ...) => {
    form.setValues((prev) => ({ ...prev, offentligeYdelserRows: newData }));
  },
  [form.setValues]
);

<OffentligeYdelserTab
  rows={form.values.offentligeYdelserRows ?? []}
  onRowsChange={handleOffentligeYdelserRowsChange}
/>
```

Fanen modtager nu `rows: OffentligeYdelserRow[]` og `onRowsChange: (rows) => void` — ikke `form`. `React.memo` bryder kun når `offentligeYdelserRows` referencen skifter.

**Review-fund:** Se afsnit 4.2.

### 1.6 Beregning-fanen er gated korrekt

Snapshot-opbygning er korrekt gated bag `isSnapshotTabActive`. Snapshot bygges i en gated effect med `buildDebugSnapshotRef.current()` og sættes i state — det trigger én ekstra re-render ved aktivering, men det er forventeligt.

Ingen ændringer her. Status uændret.

### 1.7 Persistence-rerenders — ✅ Rettet via selector-arkitektur

`FormPersistenceContext`s brede context-consumer er erstattet med selector-baseret adgang via `useSyncExternalStore`:

```typescript
// useFormPersistenceSelectors.ts — nu implementeret
export const usePersistedSectionSelector = <K extends StorageKey>(pageKey: K) =>
  React.useSyncExternalStore(
    subscribeToFormPersistenceStore,
    () => getPersistedSectionSnapshot(pageKey),
    () => getPersistedSectionSnapshot(pageKey)
  );

export const useSectionRevisionSelector = (pageKey: StorageKey) =>
  React.useSyncExternalStore(subscribeToFormPersistenceStore, ...);
```

Parent-komponenten kalder nu de granulære selectors direkte frem for `useFormPersistence()`:

```tsx
// Erstatningsopgoerelse.tsx — nu implementeret
const persistedStamdata = usePersistedSectionSelector('stamdata');
const stamdataRevision = useSectionRevisionSelector('stamdata');
const eoRevision = useSectionRevisionSelector('erstatningsopgoerelse');
const stamdataErrorRevision = useFieldErrorRevisionSelector('stamdata');
const eoErrorRevision = useFieldErrorRevisionSelector('erstatningsopgoerelse');
```

`buildDebugRevision` bruger snapshot-funktioner (ikke hooks) og er en `useCallback` der aldrig ændres (`[]`-deps). Parent re-renders drives nu kun af revision-ændringer i de konkrete sektioner den abonnerer på, ikke af context-opdateringer fra andre sektioner.

**Review-fund:** Se afsnit 4.3.

---

## 2. Foreslåede løsninger — implementeringstilstand

### 2.1 Indsnævr props til hver fane

- **`OffentligeYdelserTab`** ✅ — Implementeret, se 1.5.
- **`LoenindkomstTab`** ❌ — Modtager stadig `form`. Kræver forudgående kortlægning af alle `values`-felter fanen faktisk bruger. Se åbne fund 4.4.
- **`EOberegningTab`** — Sender stadig `eoValues={form.values}`. Ikke ændret, men mindre kritisk da fanen er gated.

### 2.2 Indsnævr memo-dependencies i Lønindkomst

✅ Implementeret for `aarsloenExternalCellErrorMessagesByAfId`. Se 1.4.

### 2.3 Opdel LoenindkomstTab i delkomponenter pr. ansættelsesforhold

❌ Ikke implementeret. Afhænger af prop-isolering (2.1) som forudsætning.

### 2.4 Behold "mount once, hide"

Strategien er fastholdt som planlagt. Ingen ændring.

### 2.5 Selector-baseret persistence

✅ Implementeret. Se 1.7.

### 2.6 Virtualisering

❌ Ikke implementeret. Korrekt prioritering — bør vente til øvrige optimeringer er indført.

---

## 3. Samlet anbefaling (opdateret)

Gennemført:
1. ~~Indsnævr props til `OffentligeYdelserTab`~~ ✅
2. ~~Indsnævr `aarsloenExternalCellErrorMessagesByAfId`-dependency~~ ✅
3. ~~Selector-baseret persistence i parent~~ ✅

Udestår:
4. Kortlæg `LoenindkomstTab`'s faktiske `values`-brug statisk; indsnævr derefter props til fanen.
5. Opdel `LoenindkomstTab` i memoiserede delkomponenter pr. ansættelsesforhold — efter prop-isolering.
6. Overvej virtualisering til sidst, hvis der stadig er et performanceproblem.

---

## 4. Review-fund

### 4.1 `aarsloenZeroArbejdsdageValidationInput` — overflødig double-dependency (Lav)

**Lokation:** [LoenindkomstTab.tsx](src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx), linje 317–326

`aarsloenExternalCellErrorMessagesByAfId`-memoen har dependency på både `aarsloenZeroArbejdsdageValidationInput` **og** `values.loenindkomstAnsaettelsesforhold`. Sidstnævnte er allerede indeholdt i `aarsloenZeroArbejdsdageValidationInput`, som ændres præcist når `values.loenindkomstAnsaettelsesforhold` skifter. Dobbelt-dependency er ikke forkert — React deduplikerer ikke, men memoen genberegner stadig korrekt — men den er misvisende og skaber tvivl om hvad der faktisk driver genberegningen.

**Anbefaling:** Fjern `values.loenindkomstAnsaettelsesforhold` fra dependency-listen og behold kun `aarsloenZeroArbejdsdageValidationInput`. Bekræft at `aarsloenZeroArbejdsdageValidationInput` allerede dækker alle felter funktionen læser — det gør den.

### 4.2 `handleOffentligeYdelserRowsChange` — dependency på `form.setValues` (Lav)

**Lokation:** [Erstatningsopgoerelse.tsx](src/components/pages/Erstatningsopgoerelse.tsx)

`handleOffentligeYdelserRowsChange` er memoized med `[form.setValues]` som dependency. `form.setValues` er returneret fra `usePersistedForm`, og dens reference-stabilitet afhænger af hookens implementering. Hvis `setValues` er stabil (som den bør være for en form-hook), er dette korrekt. Hvis den ikke er det, bryder `handleOffentligeYdelserRowsChange` ved enhver render, og `OffentligeYdelserTab`s `React.memo` er ineffektiv.

**Anbefaling:** Verificér at `usePersistedForm` returnerer en stabil `setValues`-reference (dvs. at den er pakket i `useCallback` med tomme deps eller kun nødvendige deps). Dokumentér stabilitetsgarantien i `usePersistedForm`.

### 4.3 `buildDebugRevision` — `useCallback([])`-deps korrekt men afhænger af snapshot-funktioner (Medium)

**Lokation:** [Erstatningsopgoerelse.tsx](src/components/pages/Erstatningsopgoerelse.tsx)

`buildDebugRevision` og `buildDebugSnapshot` er begge `useCallback` med tomme deps (`[]`). De kalder `getSectionRevisionSnapshot`, `getFieldErrorRevisionSnapshot`, `getPersistedSectionSnapshot` og `getFieldErrorsBySourceSnapshot` — alle snapshot-funktioner der læser direkte fra `formPersistenceStore.getState()` uden React-subscription. Det er korrekt at deps er tomme, da funktionerne ikke er closures over React-state.

Problemet er at `buildDebugRevision` alligevel aldrig ændres (tom dep-liste), men `currentDebugRevision` ændres korrekt via `useSectionRevisionSelector`-hooks. De to reads (hook-subscription for revision-detektion + snapshot-læsning i callback) er intentionelt adskilte, men den dobbelte semantik (subscriber vs. snapshot) er ikke dokumenteret i koden.

**Anbefaling:** Tilføj en kommentar der forklarer det intentionelle split: revision-hooks bruges til at trigge re-render ved ændring; snapshot-funktioner bruges til at læse konsistent state ved byggetidspunktet. Uden denne kommentar risikerer fremtidige udviklere at forenkle det til kun at bruge hooks, hvilket ville give stale reads.

### 4.4 `LoenindkomstTab` modtager stadig `form` — `React.memo` bryder ved enhver EO-ændring (Høj)

**Lokation:** [Erstatningsopgoerelse.tsx](src/components/pages/Erstatningsopgoerelse.tsx), [LoenindkomstTab.tsx](src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx)

`LoenindkomstTab` modtager `form: { values, setValues }`. Da `values` er et nyt objekt ved enhver EO-ændring, bryder `LoenindkomstTab`s `React.memo` ved enhver ændring i EO — herunder ændringer i `OffentligeYdelser` og `Beregning`-data. Fanen er skjult men forbliver i DOM og reconcilierer det fulde undertræ inkl. alle ansættelsesforhold.

Dette er det største tilbageværende performanceproblem, og det blokerer gevinsten af 2.3 (opsplitning i delkomponenter), da delkomponenter med brede props ikke profiterer af memoization.

**Anbefaling:** Kortlæg alle `values`-felter `LoenindkomstTab` faktisk læser (statisk analyse af komponentens kode — ikke estimat). Indsnævr derefter prop-kontrakten til de specifikke felter. Gør dette inden opdeling i delkomponenter (2.3).

Vigtig forudsætning: `LoenindkomstTab` kalder `getPersistedData('stamdata')` via `useFormPersistence()`. Hvis dette kald er det eneste brug af `useFormPersistence()` i fanen, bør det erstattes af `usePersistedSectionSelector('stamdata')` (selector-baseret, som allerede er implementeret i parent). Det eliminerer `useFormPersistence`-context-subscription fra fanen helt.
