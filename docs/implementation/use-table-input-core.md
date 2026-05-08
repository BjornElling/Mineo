# Implementeringsplan: `useTableInputCore`

**Status:** Udkast  
**Forfatter:** Review / arkitektur  
**Dato:** 2026-05-08

---

## Baggrund og motivation

Der eksisterer i dag 8 Table\*Input-komponenter
(`TableAmountInput`, `TableDateInput`, `TableIntegerInput`, `TablePercentInput`,
`TableWeekInput`, `TableYearInput`, `TableTextInput`, `TableDateIsoInput`)
der alle implementerer det samme ~500–770-linjers mønster uafhængigt:

- Lokal draft-state (`useState`, `useRef`)
- Touch/error-state
- Commit-pipeline (parse → fingerprint → no-op-check → emit)
- `GridCellEditorHandle` med 6 metoder (boilerplate pr. komponent)
- History-restore-kobling via `useTableInputHistoryRestore` (10+ props)
- Keyboard/paste/clipboard-håndtering
- Editor-registrering og -afregistrering

Al denne logik er i dag ikke testet isoleret — den er usynlig bag komponent-grænsen.
Fejl i ét input (fx forkert no-op-detektion eller history-restore-race) skal i dag
lappes i **8 parallelle filer**.

Målet er at indføre `useTableInputCore<TAdapter>` — en hook der indkapsler alt
infrastrukturelt fællesgods og efterlader en snæver, veldefineret
`TableInputAdapter<TModel, TCanonical, TFingerprint>` som den eneste per-type
konfiguration. Komponenterne skrumper til rene "glue"-lag.

---

## Arkitektoniske mål

1. **Enkelt ansvarscenter** — korrekthedskritisk logik (no-op, history, editor-handle)
   lever ét sted med én test-suite.
2. **Adapter-interface** som normativ kontrakt — type-checker håndhæver at alle inputs
   lever op til den samme specifikation.
3. **Ingen regression i kontrakter** — form-contract.md og mineo-field-pattern.md er
   styrende. Enhver afvigelse er en fejl.
4. **Testbar kerne** — `useTableInputCore` skal kunne testes med
   `renderHook` uden at montere GridCore.
5. **Inkrementel migration** — eksisterende inputs migreres ét ad gangen. Ingen
   big-bang-rewrite.

> **Reviewbemærkning:** Målet er rigtigt, men "alt infrastrukturelt fællesgods" skal
> forstås snævert. Kernen bør kun eje adfærd der allerede er semantisk ens på tværs
> af inputs. Variationer som `preserveInvalidDraft`, percent-suffix i lukket mode,
> amount click-selection-restore og per-input konfigurationsvalidering skal enten
> være eksplicitte extension points eller blive i komponent/adapters. Ellers bliver
> kernen hurtigt en skjult feature-matrix.

> **Supplerende:** Denne afgrænsning er korrekt og bør formaliseres fra dag ét.
> Foreslå at kernen eksponerer en `onEditOpen?: (source: GridOpenEditSource) => void`
> og en `onEditClose?: () => void` extension hook i stedet for at forsøge at
> generalisere click-selection-restore og percent-caret-logik inde i kernens
> `useLayoutEffect`. Det holder kernen simpel uden at afskære komponenten fra
> nødvendige timingoperationer.

---

## Centrale invarianter (ikke til forhandling)

Fra `src/contracts/form-contract.md` og `src/contracts/mineo-field-pattern.md`:

| Invariant | Konsekvens for implementeringen |
|---|---|
| Draft ≠ committed | `useTableInputCore` må aldrig lekke draft til parent (onChange opdaterer kun lokal draft) |
| Parsing kun ved commit | `commitPipeline` kører udelukkende i `commitAndEmitBlur` — aldrig i `handleChange` |
| No-op-reglen | Identisk fingerprint → ingen `onBlur`-emission, heller ikke `onErrorChange` |
| History-restore er obligatorisk | `useTableInputHistoryRestore` integreres i kernen — ingen adapter kan undlade det |
| Fokus-beskyttelse | Draft overskrives ikke, mens inputtet har fysisk fokus (preserveDraft + isEditing guards) |
| Escape cancels | `cancelEdit` på `GridCellEditorHandle` restorer pre-edit-snapshot uden emit |
| Gem-gating følger committability | `useTableInputSaveError` aktiveres kun ved echte parse-fejl |
| `useEffect`-commits forbudt | Al commit er imperativ (blur/enter/grid-command) |

> **Rettelse:** No-op-reglen er for hårdt formuleret ift. eksisterende kode.
> `onBlur` må ikke emittes ved identisk fingerprint, men lokal inputfejl og
> save-error-registrering skal stadig kunne ryddes efter en vellykket parse til
> samme fingerprint. `TableAmountInput` gør allerede dette med `onErrorChange({
> hasError: false, kind: 'none' })` ved no-op. Planen bør derfor skelne mellem
> "ingen parent-commit" og "fejlstatus må opdateres, når commit-forsøget lykkes".

> **Rettelse:** "Gem-gating følger committability" bør præciseres til: `useTableInputSaveError`
> aktiveres kun for ikke-committable parse-/inputfejl, ikke for eksterne/range-fejl
> hvor committed state allerede er schema-valid. Det matcher `form-contract.md` 4.4.

> **Supplerende:** Invarianttabellen mangler én vigtig distinktion: range-fejl
> i `TableDateInput` og `TableIntegerInput` er ikke-blokerende (commits sker, men
> fejl vises) og hører under "visuel fejl, ikke parse-fejl". `TablePercentInput`
> er anderledes — range er commit-blokerende der. Kernen skal understøtte begge
> semantikker via adapteren (fx `rangeErrorBlocksCommit: boolean`) i stedet for at
> hardkode ét mønster. Ellers risikerer refaktoren at ændre dato- og heltalsfelternes
> nuværende adfærd lydløst.

---

## Adapter-interface

Adapterens opgave er at beskrive ét feltdomæne. Infrastrukturen (draft-state,
editor-handle, history, no-op) håndteres af kernen.

```typescript
// src/hooks/tableInput/tableInputAdapter.ts

export type TableInputAdapter<TModel, TCanonical extends string, TFingerprint extends string> = Readonly<{
  /**
   * Formatér committed value til den streng brugeren ser i feltet.
   * Skal være deterministisk og stabil.
   */
  format: (value: TModel) => string;

  /**
   * Forsøg at committe en draft-streng.
   * Returnerer ok eller fejl — aldrig stille default.
   */
  parse: (draft: string) => TableAdapterParseResult<TModel>;

  /**
   * Kanonisk strengrepræsentation af committed value.
   * Bruges til fingerprint-sammenligning (no-op-detektion).
   */
  toCanonical: (value: TModel) => TCanonical;

  /**
   * Fingerprint afledt af canonical. Brug eksisterende make*Fingerprint-helpers.
   */
  toFingerprint: (canonical: TCanonical) => TFingerprint;

  /**
   * Tomme/nulstillede payload — hvad repræsenterer et tomt felt.
   */
  empty: CommittedPayload<TModel, TCanonical, TFingerprint>;

  /**
   * Validér om en tast er et plausibelt første-tegn for key-initiated edit.
   * Returnér false for at ignorere tasten.
   */
  isValidStartKey: (key: string) => boolean;

  /**
   * Normalisér en paste-streng inden den sættes som draft.
   * Returnér null for at ignorere pasten.
   */
  normalizePaste: (raw: string) => string | null;

  /**
   * Keyboard-filter der kører under edit. Returnér true for at blokere tasten.
   * Valgfrit — standardadfærd: tillad alt.
   */
  filterKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => boolean;

  /**
   * Hvad vises i read-only/display-mode kontra edit-mode, hvis de afviger?
   * Standardadfærd: format(value).
   * Kun relevant for inputs der ønsker et "edit draft" der adskiller sig fra
   * display-formen (fx beløb med udtryks-draftformat vs. rundet displayformat).
   */
  toDraftString?: (value: TModel) => string;
}>;

export type TableAdapterParseResult<TModel> =
  | { ok: true; value: TModel }
  | { ok: false; errorMessage: string };
```

> `CommittedPayload` importeres fra `src/types/parserSpec.ts` (eksisterende type).

> **Reviewbemærkning:** Adapteren mangler en eksplicit model for props-afhængig
> konfiguration. Flere inputs har commit-semantik der afhænger af props:
> `canBeNegative`, `allowDecimals`, `allowNegative`, `minValue`, `maxValue`,
> `useDefaultPercentRange`, dato-bounds og year-policy. Undgå at lukke disse ind
> via stale closures uden typekontrakt. Foretrukken retning: adaptere laves via
> typed factories, fx `createPercentAdapter(config)`, eller `parse/format` modtager
> en typed context. Konfigurationsvalidering skal fortsat være DEV/fail-fast og
> testbar.

> **Reviewbemærkning:** `parse` returnerer kun modelværdien, men kernen skal også
> kende den canonical/fingerprint der faktisk er parse-resultatet. Det kan afledes
> via `toCanonical` + `toFingerprint`, men for percent/date er canonical ofte et
> resultat af normalisering, afrunding eller suffix-fjernelse. Det bør gøres
> eksplicit at `toCanonical(parse(draft).value)` er den eneste autoritative
> no-op-kilde, og at adapter-unit-tests skal dække denne kæde samlet.

> **Forbedring:** Overvej at adapteren eksponerer en `toCommittedPayload(value)`
> helper i stedet for separate `toCanonical`/`toFingerprint` i kerneflowet. Den type
> findes allerede som canonical concept i komponenterne og reducerer risikoen for,
> at kernen sammensætter canonical/fingerprint forkert for en specialtype.

> **Rettelse:** `normalizePaste(raw): string | null` skal afstemmes med eksisterende
> helpers, hvor tom streng typisk betyder "ignorer paste". Vælg én kontrakt:
> enten `null` er eneste ignore-signal, eller både `null` og `''` ignoreres
> eksplicit. Det skal være normativt, fordi lukket-editor paste ellers kan komme
> til at committe en rydning ved et ugyldigt paste.

> **Reviewbemærkning:** `filterKeyDown` med event-objekt gør adapteren React-/DOM-nær.
> Det kan være nødvendigt for eksisterende key-filter helpers, men så er adapteren
> ikke længere en ren domæneadapter. Alternativt kan key-filter blive et separat
> optional UI-extension point, mens parse/format/canonical holdes som rene funktioner.

> **Supplerende:** `toCommittedPayload(value)` er det rigtige valg frem for
> separate `toCanonical`/`toFingerprint`. Årsagen er konkret: `TablePercentInput`s
> fingerprint beregnes fra den numerisk normaliserede canonical (via
> `percentNumericCanonicalFromDisplay`), ikke fra `format(value)`. Hvis kernen
> kalder `toFingerprint(toCanonical(value))` er kæden korrekt — men kun fordi
> adapteren gemmer kompleksiteten. Eksponér i stedet `toCommittedPayload(value):
> CommittedPayload<TModel, TCanonical, TFingerprint>` direkte i adapter-interface og
> slet `toCanonical`/`toFingerprint` som separate members. Det er én metode i stedet
> for to og giver adapteren fuld kontrol over normaliseringsrækkefølgen.

> **Supplerende:** Adapter-interface bør tilføje en valgfri
> `preserveInvalidDraft?: boolean` eller tilsvarende som factory-option. I dag
> er `TableTextInput` det eneste input uden `hasError`-styret draft-preserve;
> `TableAmountInput` bruger `hasError` direkte; `TablePercentInput` bruger
> `preserveDraft: hasError` kombineret med en `toDisplayString` der accepterer
> `allowDecimals` — det er ikke et rent domænespørgsmål. Kernen skal have en
> klar policy for hvornår invalid draft bevares: foreslå at adapter returnerer
> `preserveInvalidDraft: true` (default) og kun `TableTextInput`-adapteren
> sætter `false`, da tekst ikke kan have parse-fejl.

---

## `useTableInputCore` — interface

```typescript
// src/hooks/tableInput/useTableInputCore.ts

export type UseTableInputCoreOptions<TModel, TCanonical extends string, TFingerprint extends string> = Readonly<{
  adapter: TableInputAdapter<TModel, TCanonical, TFingerprint>;
  gridCell: GridCellCoord;
  value: TModel;
  locked?: boolean;
  onBlur?: (e: { target: { value: TModel } }) => void;
  onChange?: (e: { target: { value: string } }) => void;
  onErrorChange?: (info: TableInputErrorInfo) => void;
  externalErrorMessage?: string;
  inputRef?: React.Ref<HTMLInputElement>;
  /** Diagnostisk label til useTableInputSaveError-nøglen */
  saveErrorKey: string;
}>;

export type UseTableInputCoreResult = Readonly<{
  // State til rendering
  draft: string;
  displayValue: string;
  isFocused: boolean;
  touched: boolean;
  hasError: boolean;
  errorMessage: string;
  showError: boolean;
  isEditing: boolean;
  isReadOnly: boolean;
  cellFocused: boolean;

  // Refs
  inputElRef: React.RefObject<HTMLInputElement | null>;
  undoFocusToken: string;
  gridCellKey: string;

  // Handlers
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFocus: () => void;
  handleBlur: (e: React.FocusEvent<HTMLInputElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  handleCopy: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  handleDoubleClick: () => void;
}>;
```

Komponenten beholder kun:
- `<Box>`, `<Tooltip>`, `<InputBase>` rendering
- Domænespecifikke inputProps (fx `inputMode: 'decimal'` for beløb)
- Eventuelle ekstra DOM-elementer (fx expression-indicator for beløb)

> **Rettelse:** `onChange` mangler i options. Table-inputs bruger `onChange` som
> draft-kanal, og kernen skal enten understøtte den eksplicit eller dokumentere, at
> de migrerede komponenter ikke længere emitter draft-change. Sidstnævnte er en
> bruger-observerbar/adfærdsændring og kræver særskilt beslutning.

> **Reviewbemærkning:** Resultatet bør ikke kun have `displayValue`; eksisterende
> komponenter har mindst tre visningsformer: edit-draft, lukket committed display
> og lukket invalid-draft display. `TablePercentInput` tilføjer `%` i lukket mode,
> mens `TableAmountInput` kan vise draft ved fejl og har expression-indicator.
> Enten skal core returnere et færdigt `renderedValue`, eller adapteren skal have
> en typed `getRenderedValue(...)`/display-policy. Ellers flytter komponenterne
> stadig vigtig state-logik uden for kernen.

> **Forbedring:** `inputRef` bør håndteres via eksisterende `assignRef`-mønster.
> Hvis kernen ejer `inputElRef`, skal den også returnere en ref-callback der både
> sætter intern ref og videresender ekstern `inputRef`, så komponenterne ikke
> genimplementerer den del.

> **Supplerende — `displayValue`:** Lad kernen returnere to separate strings:
> `committedDisplayValue` (hvad `format(value)` giver) og `draft` (nuværende
> draft-streng inkl. fejl-draft). Komponenten beregner herefter `renderedValue`
> fra de to, eventuelt med adapter-hjælp. Det er simplere end at kernen forsøger
> at kende `%`-suffix-logik og expression-indicator-logik. Eksempel:
> ```
> const renderedValue = isEditing ? draft
>   : (touched && hasError) ? draft
>   : committedDisplayValue;
> ```
> Denne ternary er ens for alle komponenter i dag — kernen kan godt eje den — men
> `%`-suffix er en komponentbeslutning der lægges oven på `committedDisplayValue`.
> Skil de to niveauer eksplicit.

> **Supplerende — `saveErrorKey`:** `saveErrorKey` som fri streng øger risikoen
> for nøglekollision ved samme komponenttype brugt på flere koordinater.
> `useTableInputSaveError` bruger nøglen til at registrere én fejl pr. cell.
> Brug i stedet `a11yErrorId` (fra `React.useId()` inde i kernen) som nøgle, da
> den allerede er garanteret unik pr. instans. Fjern `saveErrorKey` fra options.

---

## Intern struktur i `useTableInputCore`

```
useTableInputCore
  ├── GridCore integration
  │     ├── useGridCoreApi()
  │     ├── useGridCellFocus(gridCell)
  │     └── useGridCellEditing(gridCell)
  │
  ├── State
  │     ├── draft / draftRef
  │     ├── isFocused
  │     ├── touched
  │     ├── hasError / hasErrorRef
  │     ├── errorMessage
  │     ├── originalValueOnEditStartRef
  │     ├── keyInitiatedEditRef
  │     ├── skipClickSelectionRestoreRef
  │     └── latestCommittedPayloadRef  ←  opdateres via useLayoutEffect(value)
  │
  ├── latest-ref  (callbacks + config, opdateres via useLayoutEffect)
  │
  ├── commitPipeline(rawDraft): boolean
  │     ├── adapter.parse(rawDraft)
  │     ├── toCommittedPayload(parsed.value)
  │     ├── fingerprint-sammenligning (no-op-check)
  │     └── emit onBlur eller no-op-cleanup
  │
  ├── useTableInputHistoryRestore (med resetEditingState, onRestoreError, onRestoreCommitted)
  │
  ├── useLayoutEffect(isEditing)  ←  click-initiated edit: sæt draft fra committed
  │
  ├── GridCellEditorHandle (useMemo)
  │     ├── getElement / getIsLocked
  │     ├── commitCurrent → commitPipeline + closeEditing
  │     ├── clearAndCommit → reset state + commitPipeline('')
  │     ├── cancelEdit → restore originalValueOnEditStartRef + closeEditing
  │     ├── prepareEditFromKey → adapter.isValidStartKey + setDraft(key)
  │     └── selectAll
  │
  ├── useEffect: gridApi.registerEditor / unregisterEditor
  │
  └── useTableInputSaveError
```

> **Rettelse:** State-listen mangler `preserveInvalidDraft`/tilsvarende policy.
> `TablePercentInput` bruger den til at bevare invalid draft i lukket editor og
> rydde den når parent committed value faktisk ændrer sig. `TableAmountInput` har
> en simplere variant bundet til `hasError`. Kernen skal modellere dette eksplicit,
> ellers risikerer refaktoren enten at tabe brugerens invalid draft eller at bevare
> en stale fejl efter autoritativ parent-opdatering.

> **Reviewbemærkning:** `useTableInputSaveError` bør ikke være ubetinget kernelogik
> for alle inputs. `TableTextInput` bruger den ikke i dag, fordi lokale parsefejl
> ikke findes. Kernen kan godt eje hook-kaldet, men kun med en klar `saveErrorKey`
> og `active`-policy der er false for ikke-parsebare/fejlfrie typer.

> **Forbedring:** `latest-ref` bør indeholde alle props der påvirker commit:
> callbacks, `locked` og adapter/config. Den skal opdateres i `useLayoutEffect`
> eller anden valgt standard konsekvent, så imperative grid-handles ikke læser
> stale parse-regler efter propændringer.

> **Supplerende — `skipClickSelectionRestoreRef`:** Denne ref er specifik for
> `TableAmountInput`s dobbelt-klik-logik og har ingen generel semantik for andre
> inputs. Den bør ikke bo i kernen. Flyt den til komponentens `onEditOpen`
> extension-callback (jf. bemærkning under Arkitektoniske mål). Kernen returnerer
> `keyInitiatedEdit: boolean` fra result-objektet til brug i komponenten.

> **Supplerende — `latestCommittedPayloadRef` vs. `useLayoutEffect`:**
> Den eksisterende kode opdaterer `latestCommittedPayloadRef` i en `useLayoutEffect`
> synkront med `value`-ændringer. Det er korrekt. Men adapter-factory-config
> (`allowDecimals`, `canBeNegative` etc.) der ændrer fingerprint-semantikken, kan
> ikke opdateres via `latestCommittedPayloadRef` alene — de ændrer definitionen af
> hvad der er "samme fingerprint". Kernen skal genberegne committed payload fra den
> aktuelle adapter ved value-ændringer, ikke fra en cachedet payload der kan være
> stale ift. config. Brug `adapter.toCommittedPayload(value)` i stedet for at
> cachelagre en snapshot fra forrige render.

---

## Paste-strategi

Paste er den eneste handler med væsentligt per-type indhold. Kernen delegerer til
`adapter.normalizePaste(raw)`:

- Returnerer `null` → pasten ignoreres
- Returnerer streng → kernen sætter draft og kører commit-pipeline ved lukket editor,
  sætter draft ved åben editor (identisk logik som i dag)

Clipboard-cursorbevægelse (`setSelectionRange`) håndteres i kernen — det er
infrastruktur, ikke domæne.

> **Reviewbemærkning:** Paste er ikke helt generisk i dag. Amount-paste kontrollerer
> `containsUnaryMinusToken(nextDraft)` efter indsættelse, percent-paste bruger max
> 100 i normaliseringen, og begge rydder lokal fejltilstand på forskellig måde.
> Kernen bør derfor have et optional `validatePastedDraft(nextDraft)` eller en
> samlet `applyPaste`-policy, hvis den skal eje cursor/selection uden at miste
> domæneregler.

> **Rettelse:** Lukket-editor paste skal kalde `preventDefault()` og
> `stopPropagation()` for de taster/clipboard-hændelser GridCore-subtree ejer, i
> tråd med `keyboard-navigation.md`. Det bør nævnes eksplicit i paste-strategien,
> fordi dobbelt håndtering kan give både browser-paste og commit.

> **Supplerende:** `containsUnaryMinusToken(nextDraft)` i `TableAmountInput`
> er en post-normaliserings-guard, ikke en normaliseringsregel. Det er et eksempel
> på en "paste-eftervalidering" der ikke naturligt kan foldes ind i
> `normalizePaste(raw)` fordi den afhænger af den samlede draft-streng (ikke kun
> den indsatte del). Tilføj en explicit `validatePastedDraft?: (nextDraft: string)
> => boolean` i adapteren — `false` afviser pasten uden at ændre draft. Alternativt
> foldes den ind i `normalizePaste` ved at lade adapteren modtage både råtekst og
> nuværende draft:
> ```
> normalizePaste: (raw: string, context: { currentDraft: string }) => string | null
> ```
> Den anden form er mere generel og undgår en ekstra member i interface. Vælg én.

> **Supplerende — `requestAnimationFrame` i paste:**
> `TableAmountInput`s paste bruger `requestAnimationFrame` til at placere caret
> efter indsættelse. Dette er timing-afhængigt og bør isoleres i en
> `afterPasteApplied?: (el: HTMLInputElement, caretPos: number) => void`
> extension-callback der returneres fra kernen til komponenten — ikke hardkodes
> i kernen for alle inputs.

---

## Filstruktur (ny)

```
src/hooks/tableInput/
  tableInputAdapter.ts        ← Adapter-interface + TableAdapterParseResult
  useTableInputCore.ts        ← Selve kernen
  index.ts                    ← Re-eksport af offentlige typer
  adapters/
    amountAdapter.ts          ← TableInputAdapter<AmountValue|undefined, ...>
    dateAdapter.ts
    integerAdapter.ts
    percentAdapter.ts
    weekAdapter.ts
    yearAdapter.ts
    textAdapter.ts

src/components/inputs/table/
  TableAmountInput.tsx        ← Migreret: kun glue + rendering
  TableDateInput.tsx          ← Migreret
  TableIntegerInput.tsx       ← Migreret
  TablePercentInput.tsx       ← Migreret
  TableWeekInput.tsx          ← Migreret
  TableYearInput.tsx          ← Migreret
  TableTextInput.tsx          ← Migreret
  TableDateIsoInput.tsx       ← Migreret
```

Adapter-filerne indeholder det der i dag er de per-komponent private
`commitAmountDraft`, `toDisplayString`, `amountCanonicalFromModel` osv.
De er nu rene funktioner, let testbare uden React.

> **Rettelse:** Adapterplaceringen under `src/components/inputs/table/adapters/`
> er acceptabel, hvis adapterne forbliver table-UI-adaptere. Hvis de også bliver
> canonical parse/format helpers for andre lag, skal de ikke ligge under components.
> Afgræns dem eksplicit som table-input adapters for at undgå utilsigtet domænebrug
> fra beregning/persistence.

> **Forbedring:** `assignRef` er allerede en lokal table-input helper. Hvis kernen
> overtager ref-binding, bør `assignRef` enten flyttes sammen med kernen eller
> forblive lokal og bruges af komponenten via en returned callback. Undgå en ny
> parallel implementation.

> **Supplerende — adapterplacering:** Foretrukken filstruktur er
> `src/hooks/tableInput/adapters/` frem for `src/components/inputs/table/adapters/`.
> Adapterne er rene domæne-/parse-funktioner uden React-afhængigheder og hører
> naturligt til hooks-laget, ikke UI-laget. Placeringen under `components/`
> signalerer visuelt at de er UI-kode, hvilket modvirker den vigtige pointe om
> at de er testbare uden at montere komponenter. Filstrukturen ovenfor er
> opdateret i overensstemmelse hermed.

> **Supplerende — `dateAdapter.ts` og `onRegisterSanitize`:**
> `TableDateInput` eksponerer `onRegisterSanitize?: (sanitize: TableDateSanitizeCallback) => void`
> — en imperativ-handle-mekanisme der ikke matcher det øvrige adapter-pattern.
> Adapteren og kernen bør ikke arve dette direkte. Overvej om `onRegisterSanitize`
> kan erstattes af en pure `sanitize(value: string): string` prop på komponenten
> der kalder adapteren synkront, eller om den skal bevares som komponent-niveau
> extension. Under alle omstændigheder hører den ikke i `TableInputAdapter`.

---

## Migrationsstadier

### Stadie 0 — Testfundament (forudsætning)

Før nogen refaktorering: skriv karakteriseringstests for de nuværende inputs.

**Mål:** Fastlæg observerbar adfærd der skal overleve refaktoreringen.
Prioritér:

1. Commit-pipeline: parse → no-op → emit (eller ej)
2. History-restore: `onRestoreError` vs. `onRestoreCommitted`
3. `clearAndCommit` og `cancelEdit`-semantik
4. Paste med åben/lukket editor

Brug `renderHook` + mock af GridCore-context.
Disse tests kører mod **nuværende kode** og bruges som regressionssikring i stadie 2–4.

> **Rettelse:** Karakteriseringstests mod nuværende komponenter kan ikke primært
> være `renderHook`, fordi logikken i dag ligger inde i komponenterne. Brug
> eksisterende komponenttest-mønstre (`@testing-library/react` med GridCore-wrapper)
> til stadie 0. `renderHook` bliver relevant fra stadie 2, når kernen findes.

> **Forbedring:** Start med at udvide de eksisterende tests i
> `src/__tests__/components/inputs/Table*Input*.test.tsx` i stedet for at oprette
> en separat parallel teststruktur. Det gør regressioner mere synlige under den
> trinvise migration.

> **Supplerende:** Overvej at stadie 0-tests primært dækker mindst to inputs med
> fundamentalt forskellig fejlsemantik inden migration starter: ét med
> commit-blokerende fejl (`TablePercentInput`) og ét med ikke-blokerende range-fejl
> (`TableDateInput` eller `TableIntegerInput` med `enforceRange: false`). Disse to
> semantikker er den vigtigste korrekthedsskel at bevare, og de er svære at opdage
> via type-check alene.

---

### Stadie 1 — Adapter-interface + statiske adapter-filer

**Hvad:**
- Definér `TableInputAdapter<TModel, TCanonical, TFingerprint>` i
  `src/hooks/tableInput/tableInputAdapter.ts`
- Udtræk per-type logik fra eksisterende inputs til
  `src/hooks/tableInput/adapters/*.ts`
- Adapterne eksponerer de eksisterende lokale funktioner som navngivne exports
- Ingen adfærdsændring — kode kalder stadig de lokale funktioner; adapterne eksisterer
  som parallelle, men ubrugte moduler

**Hvad testes:**
- Adapter-unit-tests: `parse`, `format`, `toCommittedPayload`, `isValidStartKey`,
  `normalizePaste` pr. inputtype
- Fingerprint-stabilitet: samme model → samme fingerprint, forskellig model → forskellig
- No-op-kæde: `toCommittedPayload(parse(draft).value).fingerprint === toCommittedPayload(value).fingerprint`
  for semantisk identiske inputs

**Risici:** Lav. Ingen eksisterende kode ændres.

> **Reviewbemærkning:** "Ingen eksisterende kode ændres" passer kun, hvis adapterne
> oprettes ved copy/extract uden at komponenterne importerer dem endnu. Det giver
> midlertidig duplikation mellem komponent og adapter, som er acceptabel i dette
> stadie, men skal holdes kortlivet og markeres som migrationskode i planen.

> **Supplerende:** `TablePercentInput` er den svageste adapter at skrive uden at
> forstå `allowDecimals`-afhængig fingerprinting fuldt ud.
> `percentNumericCanonicalFromDisplay` kalder `parsePercentOnCommit` bagfra på en
> committed display-string — det er cirkulært i stafetten. Adapter-tests skal
> eksplicit verificere at `toCommittedPayload(format(model)).fingerprint ===
> toCommittedPayload(model).fingerprint` for alle mulige `model`-værdier, ellers
> er no-op-detektion for percent ustabil og afhænger af displayformat-overgange.

---

### Stadie 2 — `useTableInputCore` skeleton (ingen UI-ændring)

**Hvad:**
- Implementér `useTableInputCore` med fuld intern logik baseret på adapter-interface
- Brug `TableTextInput`s eksisterende kode som primær skabelon — den er simpel og
  undgår at gøre specialadfærd til standardadfærd i kernen
- Kernen er ikke i brug endnu (ingen komponent er skiftet)

**Hvad testes:**
- `renderHook`-tests af `useTableInputCore` med mock-adapters og mock-GridCore:
  - Draft-state-flow
  - `commitPipeline` (ok / fejl / no-op / no-op der rydder fejl)
  - History-restore callbacks
  - `editorHandle.commitCurrent`, `clearAndCommit`, `cancelEdit`, `prepareEditFromKey`
  - Paste med åben vs. lukket editor
  - `preserveInvalidDraft`-adfærd: invalid draft bevares ved re-render, ryddes ved
    autoritativ committed value update
- Disse tests erstatter karakteriseringstestene fra stadie 0 som den primære dækning

**Risici:** Medium. Korrekthed af kernen skal verificeres fuldt her, inden komponenter migreres.

> **Forbedring:** Skeleton bør bygges efter den simpleste komponent først
> (`TableTextInput`) og derefter udvides med percent/amount edge cases. At bruge
> `TableAmountInput` som primær skabelon risikerer at gøre specialadfærd til
> standardadfærd i kernen.

> **Rettelse:** Core-tests skal også dække at no-op ikke kalder `onBlur`, men gerne
> kan rydde lokal parsefejl/save-error efter vellykket parse. Det er en særskilt
> invariant fra parent-commit.

> **Supplerende:** Kerne-tests skal inkludere scenariet "prop `value` opdateres
> udefra mens isEditing er true" — kernen må ikke overskrive draft i dette tilfælde.
> Det er `useTableInputHistoryRestore`s `hasPhysicalFocus`-guard der beskytter her
> i dag, og den logik bevares i kernen, men testen er afgørende for at fange
> regressioner ved kernens integration af history-hook.

---

### Stadie 3 — Migrér ét input ad gangen

Rækkefølge (enklest til mest kompleks, med korrekthedshensyn):

1. `TableTextInput` — ingen fingerprint-kompleksitet, ingen key-filter, ingen save-error
2. `TableIntegerInput` — key-filter, range-logik, save-error (første input med parsefejl)
3. `TableYearInput` — year-parsing-policy
4. `TableWeekInput` — week-format
5. `TableDateIsoInput` — minimal variant
6. `TableDateInput` — range-validering (ikke-blokerende), separator-normalisering, year-policy, `onRegisterSanitize`
7. `TablePercentInput` — commit-blokerende range, `allowDecimals`-afhængig fingerprint
8. `TableAmountInput` — udtryk, expression-indicator, click-selection-restore

**Per input:**
1. Flyt adapter-kode fra stadie 1 til `src/hooks/tableInput/adapters/[type]Adapter.ts`
2. Erstat komponentens indre logik med `useTableInputCore(adapter, ...)`
3. Komponent beholder kun rendering og evt. ekstra DOM
4. Kør `npm run typecheck` + den relevante `Table*Input` testfil
5. Manuel smoke-test i browser: fokus, edit, commit, undo/redo, paste, escape, tab-navigation

**Rollback:** Hvert input migreres i sin egen PR/commit. Fejler ét, rulles kun det tilbage.

**Risici:** Lav-medium pr. input. `TableAmountInput` og `TablePercentInput` er de sværeste.

> **Forbedring:** Efter hver migreret inputtype bør der køres mindst:
> `npm run typecheck` og den relevante `Table*Input` testfil. Planen kan stadig
> kræve fuld suite ved større milepæle, men per-input feedback skal være smallere
> og deterministisk.

> **Reviewbemærkning:** Rækkefølgen er fornuftig, men `TableTextInput` er ikke en
> fuld prøve på save-error eller local parse-error. Før de øvrige simple inputs
> migreres, bør én parse-fejlende type (`TableIntegerInput` eller `TableYearInput`)
> migreres og validere error/save-error-adfærden.

> **Supplerende:** `TableDateInput` med `onRegisterSanitize` bør migreres med en
> eksplicit beslutning i hånden: enten fjernes `onRegisterSanitize` fra den offentlige
> prop-type (breaking change der kræver søgning i callsites), eller bevares den som
> komponentniveau-callback der ikke rutes via kernen. Dette skal afklares før stadie
> 3 step 6 påbegyndes, ikke undervejs.

---

### Stadie 4 — Ryd op og konsolidér

**Hvad:**
- Fjern de nu-overflødige lokale hjælpefunktioner fra komponent-filerne
- Slet `assignRef`-duplikater hvis de er konsoliderede (eller flyt til shared utility)
- Opdatér `mineo-field-pattern.md` med et "Table inputs"-afsnit der nævner
  `useTableInputCore` som den normative mekanisme
- Opdatér `form-contract.md` afsnit 6.4 med `useTableInputCore` som kanonisk mekanisme
  i ansvarsfordelingstabellen
- Verificér bundle-size ikke er vokset (adapterne er rene funktioner uden ekstra deps)

**Hvad testes:**
- Fuld test-suite grøn
- Ingen ubrugte exports (tjek med `ts-prune` eller tilsvarende)

---

## Kendte risici og mitigering

| Risiko | Sandsynlighed | Mitigering |
|---|---|---|
| `TableAmountInput` click-selection-restore er skrøbelig (requestAnimationFrame + selectionRange) | Medium | Bevar som komponent-niveau `onEditOpen`-callback; kernen returnerer `keyInitiatedEdit: boolean` til brug heri |
| `TablePercentInput` åben/lukket-caret-logik afviger fra de øvrige | Medium | Håndtér som komponent-niveau CSS/styling baseret på `isEditing` fra kernens result — ikke kernens ansvar |
| History-restore race: `pendingHistoryValueResyncRef` er timing-sensitiv | Lav | Eksisterende logik i `useTableInputHistoryRestore` bevares uændret; kernen delegerer til den |
| Adapter-interface tvinger et fælles parse-return-type, men `TableAmountInput` har to fejl-varianter (expression / format) | Lav | `ok: false; errorMessage: string` er tilstrækkelig — kald `formatExpressionErrorMessage` inden return i adapteren |
| `gridCellKey`-kommentar om bevidst udeladt dep-array-entry (`gridCell`) | Lav | Bevar `eslint-disable`-kommentar og den tilhørende forklaring — flyttes til kernen |
| Adapter/config stale closures efter propændringer (`allowDecimals`, `canBeNegative`, bounds) | Medium | Typed config i adapter factory/context, opdateret latest-ref og tests hvor props ændres mellem edit-start og commit |
| Invalid draft mistes ved parent rerender/history restore | Medium | Eksplicit preserve-invalid-draft policy i kernen og karakteriseringstest for amount/percent efter fejl, undo/redo og autoritativ committed value update |
| Offentlig `onChange` draft-adfærd fjernes ved migration | Medium | Inkluder `onChange` i core-options og test at typing stadig kun emitter draft, aldrig committed state |

> **Supplerende:** Risiko: `TablePercentInput`s fingerprint-logik går via
> `percentNumericCanonicalFromDisplay` som kalder `parsePercentOnCommit` på en
> committed display-string. Hvis `format(value)` og `toDisplayString(value, allowDecimals)`
> divergerer for en edge-case (fx `number`-input mod `string`-input), kan
> fingerprinting give falsk no-op. Sandsynlighed: Lav-Medium. Mitigering: skriv
> round-trip-test `toCommittedPayload(parse(format(model)).value).fingerprint ===
> toCommittedPayload(model).fingerprint` for alle model-typer i percent-adapteren.

---

## Hvad `useTableInputCore` ikke gør

- **Ingen styling-beslutninger** — komponenterne beholder ejerskab over `sx`, border,
  `inputMode`, `data-*`-attributter, `%`-suffix i display
- **Ingen rækkefloat** — `useRowDrafts` forbliver uberørt; kernen er cell-niveau
- **Ingen `TableDropdown`-ændring** — dropdown er instant-commit og passer ikke til
  draft/commit-modellen
- **Ingen ændring af `GridCorePublicAPI`** — editor-handle-kontrakten er uændret
- **Ingen click-selection-restore** — komponent-ansvar via `onEditOpen`-callback
- **Ingen `requestAnimationFrame`-caret-logik** — komponent-ansvar

> **Rettelse:** "Ingen styling-beslutninger" skal stadig tillade at kernen returnerer
> state der påvirker styling (`showError`, `isReadOnly`, `cellFocused`,
> `undoFocusToken`, `gridCellKey`). Selve `sx` bliver i komponenterne, men de
> kontraktbærende flags må gerne centraliseres.

---

## Ikke-mål (eksplicit afgrænset)

- Ny abstraktion over `useRowDrafts` — separat beslutning
- Ændring af persisterings-lag eller Zustand-stores
- Introduktion af nye dependencies
- Ændring af `useDraftField` (bruges ikke i table-inputs)

---

## Succeskriterie

Planen er gennemført når:

1. Alle 8 `Table*Input`-komponenter bruger `useTableInputCore`
2. Ingen komponent-fil indeholder lokale `commit*Draft`, `toCommittedPayload`,
   fingerprint-logik eller history-restore-wiring
3. `useTableInputCore` har en isoleret test-suite der dækker alle invarianter
4. Alle eksisterende tests er grønne
5. `mineo-field-pattern.md` er opdateret med den normative reference til kernen
6. `form-contract.md` afsnit 6.4 er opdateret med `useTableInputCore` som kanonisk mekanisme
7. Adapter-unit-tests for alle 8 typer dækker no-op-kæden end-to-end
   (`parse → toCommittedPayload → fingerprint`) — primær garanti mod stille
   fingerprint-fejl der giver falske eller manglende parent-commits
8. Migrationen har ingen ændring i offentlig table-input API: `onChange` er fortsat
   draft-only, `onBlur` er fortsat commit-only, og alle bruger-facing fejltekster
   forbliver danske og uændrede, medmindre en ændring er eksplicit besluttet som bugfix
