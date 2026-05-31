# Mineo Field Pattern (intern standard)

Dette dokument fastlægger det **påkrævede interne mønster** for Mineos custom form-felter (Styled*Fields og tabel-inputs).

**Status:** Gældende arkitektur (normativt supplement)  
**Type:** Tværgående komponent-/adapterkontrakt  
**Prioritet:** Supplement til `form-contract.md`; ejer komponent-/adaptermønstret (lag A/B/C), ikke draft/commit-semantikken.  
**Senest verificeret mod kode:** 2026-05-30

Det er et supplement til den normative Form Contract:
- `src/contracts/form-contract.md`

Mineo er trust-kritisk. Enhver tvetydighed i felt-semantik (draft vs commit vs blur) behandles som en korrekthedsrisiko.

## Begreber

- **Draft**: den midlertidige string, brugeren har tastet, og som vises i inputtet mens der skrives.
- **Committed værdi**: den validerede, typede model-værdi, der bruges af beregninger/persistering.
- **Commit-forsøg**: en intern operation, der initieres af `useDraftField`, typisk udløst af blur, Enter eller et eksplicit imperativt commit. Udløses aldrig af tastning (`onDraftChange`).
- **Fysisk blur**: at focus rent faktisk forlader kontrollen. MÅ IKKE indebære commit-semantik.

## Lagdeling (MÅ IKKE brydes)

### Lag A — UI-base (fx `StyledTextFieldBase.tsx`, `StyledTextAreaBase.tsx`)

Ansvar:
- Render/styling
- Videresend focus/blur/keydown
- Draft-string ind/ud

MÅ IKKE:
- parse/validere/normalisere
- kende model-typer
- eksponere event-baserede `onChange(event)`-API'er opad

Invarianter:
- Accepterer kun `draft: string` + `onDraftChange(draft: string)`
- Input-semantiske handlers (`onFocus`/`onBlur`/`onKeyDown`/`onPaste`) bindes til det faktiske `<input>`/`<textarea>`
- Muse-interaktions-handlers (`onClick`/`onMouseDown`/`onDoubleClick`) bindes til input-roden, så hele feltets
  hit-area (inklusive adornments med `pointer-events: none`) deltager i to-trins-aktiveringen
- `inputRef` er ærligt typet (`HTMLInputElement`/`HTMLTextAreaElement`)

### Lag B — Draft/commit-motor (`useDraftField.ts`)

Ansvar:
- Lokal draft-state
- Commit-policy (blur/enter/escape)
- Race-fri håndtering af asynkrone parent-opdateringer (resync efter commit)
- `touched` + lokal parse-fejltilstand
- Præcis én commit-kanal (`onCommit`)

MÅ IKKE:
- vide noget om specifikke felt-domæner
- bruge event-objekter i sit offentlige API
- forlade sig på reference-lighed eller objekt-identitet som korrekthedssignal ved resync af eksterne værdier

### Lag C — Felt-adapter (fx `StyledAmountField.tsx`, `StyledDateField.tsx`, …)

Ansvar:
- Definere parse-/valideringsregler
- Definere canonical formattering af committed værdier
- Definere domæne-constraints (min/max/osv.)
- Mappe `draft: string` ⇄ `TModel`
- Adfærd for forrang af eksterne fejl

MÅ IKKE:
- mutere brugerens draft mens der skrives (ingen masking, erstatning eller canonicalisering under `onDraftChange`; normalisering er kun tilladt ved commit)
- have flere commit-stier

## Event-kontrakt (Styled*Fields)

Alle Styled*Fields SKAL følge denne offentlige kontrakt (navnene er normative):

- `onDraftChange?: (e: { target: { value: string } }) => void`
  - kaldes kun ved tastning
  - payload er den rå draft-string
- `onCommit?: (e: { target: { value: TModel } }) => void`
  - kaldes kun ved vellykkede commit-forsøg (blur/enter/imperativt)
  - payload er den typede committed værdi
- `onBlur?: (e: React.FocusEvent<...>) => void`
  - kun fysisk blur (aldrig "commit")
  - invariant: intern `useDraftField.onBlur` kører **før** ekstern `onBlur`
  - bemærk: intern blur-håndtering kan committe synkront og udløse parent-re-renders; ekstern `onBlur` MÅ IKKE antage, at feltet stadig er mounted efter det interne kald

Delte typer ligger i:
- `src/types/fieldEvents.ts`

Bemærkning om event-form:
- `DraftChangeEvent` og `CommitEvent<T>` fra `src/types/fieldEvents.ts` er de normative offentlige event-typer.
- Mineos felt-events er branded og er ikke DOM-events; behandl dem ikke som sådan.
- `{ target: { value } }`-event-formen gælder ved Styled*Field-grænsen (Lag C-output).
- Lag A bruger `onDraftChange(draft: string)` internt; Lag C er ansvarlig for at wrappe til branded Mineo-felt-events.

## Parsing-kontrakt

Adaptere implementerer:

`parse(draft: string, { mode: 'typing' | 'commit' }): DraftParseResult<TModel>`

`DraftParseResult<TModel>` ejes af `src/types/fieldEvents.ts`. Brug den eksporterede type; konstruer ikke parallelle result-former ved callsites.

Regler:
- `ok: true` betyder **committbar**
- I `typing`-mode: returnér `partial` for ethvert input, der ikke er fuldt committbart. Påstå ikke gyldighed for ufuldstændigt input.
- I `commit`-mode: returnér enten `ok: true` eller `invalid` (med en deterministisk besked)
- `partial/empty` uden besked i `commit`-mode er forbudt (DEV-asserteret af `useDraftField`)

Canonicalisering af værdi (commit-semantik):
- Visse adaptere canonicaliserer bevidst den committede **værdi** under `commit`-parsing (fx afrunding, brøkforkortelse).
- Dette er kun tilladt, hvis og kun hvis det er deterministisk, kun sker i `commit`-mode og er dokumenteret som en del af felt-kontrakten.
- I `typing`-mode må parsing ikke påstå committbare værdier for ufuldstændigt input og må ikke canonicalisere/transformere brugerens draft.

Vejledning (UX-konsistens):
- I `typing`-mode bør `partial` normalt udelade `message` for at undgå præmatur "fejl"-UI.
  Brug kun en `message` til reelt UX-kritisk vejledning.
- Helt stille tastning er også tilladt (ingen besked før commit). Hvis vejledning er nødvendig, foretræk placeholder/helperText frem for parse-beskeder.

## Formatterings-kontrakt

Formattering sker **kun post-commit** og defineres alene af:
- `format(value: TModel): string`

Krav:
- deterministisk og stabil
- canonical committed repræsentation for dette felt
- må ikke kollapse distinkte committede værdier inden for feltets semantik

## Keyboard/commit-policy (standard)

Standard-policy (alle felter medmindre eksplicit begrundet):
- `Blur` → commit-forsøg
- `Enter` → commit-forsøg (prevent default)
- `Escape` → annullér (committer aldrig; undertrykker det umiddelbart efterfølgende blur-udløste commit)
- `Backspace`/`Delete` i fokuseret lukket-editor-tilstand (grid-celle) → ryd og committ med det samme uden at åbne editoren

`useDraftField` implementerer `Blur`/`Enter`/`Escape`-policyen for åben-editor-tilstanden. Lukket-celles `Backspace`/`Delete`-rydning er en grid-celle-tilstand, der ejes af gridCore (`src/components/tables/gridCore/tableKeyboardNavigation.ts` og `gridUxSpec.ts`), ikke af `useDraftField`.

`Backspace`/`Delete`-undtagelsen matcher `form-contract.md` og `keyboard-navigation.md`: rydning er en eksplicit brugerhandling, så den må committe med det samme, men den må ikke starte redigering eller parse vilkårlig draft-tekst.

## Fejl-ejerskab (én kilde i UI)

UI SKAL vise højst én fejlkilde ad gangen pr. felt-instans:
1) ekstern fejl (autoritativ)
2) lokal parse-fejl (gated af `touched`)
3) ingen

Lokal fejltilstand SKAL bevares, selv mens en ekstern fejl vises (suspenderet, ikke nulstillet).

Lokal fejltilstand genopstår automatisk, når den eksterne fejl ryddes. Suspensionen er passiv: den lokale fejl re-evalueres ikke, bare fordi den bliver synlig igen.

## Tabel-inputs

Tabel-inputs er UI-specialiserede, men SKAL bevare de samme principper:
- `onChange` = kun draft
- `onBlur` = kun commit-forsøg. Den tabel-specifikke afvigelse er triggeren, ikke commit-semantikken: Tab/Enter/celle-overgang kan committe ved tabel-grænsen, selv når den fysiske focus-håndtering afviger fra Styled*Field-blur.
- Validering må ikke køre kontinuerligt via `useEffect` mens der skrives
- Enhver normalisering/canonicalisering SKAL kun ske ved blur (commit)
- GridCore-tabel-inputs SKAL bruge `useTableInputCore` med en type-specifik tabel-input-adapter.
- Parser, formatter, canonical payload, fingerprint, paste-normalisering og key-filtrering hører til
  i adapteren.
- Rendering, styling, ikoner/indikatorer og komponent-specifikke DOM-timing-udvidelser forbliver i
  `Table*Input`-komponenten.
- `useTableInputCore` ejer `useTableInputHistoryRestore`, resync af committed værdi,
  fysisk-focus-beskyttelse, registrering i `draftHistoryRegistry`, no-op-detektion, save-error-
  gating og GridCore-editor-handle-wiring.
- De enkelte `Table*Input`-komponenter må ikke hver især implementere deres egne uafhængige
  `restoreFromHistory`-, pending-history-resync-, no-op-fingerprint- eller editor-handle-pipelines.

## Instant-commit-kontroller (eksplicitte undtagelser)

Visse kontroller er bevidst **instant commit** (ingen draft/cancel-fase):
- Toggle switches (fx `StyledToggleSwitch.tsx`)
- Radio groups (fx `StyledRadioButton.tsx`)
- Select-lignende kontroller (fx `StyledDropdown.tsx`)

Regler for instant-commit-kontroller:
- `onCommit` fyres med det samme ved brugerinteraktion (samme tick som kontrollens native change-event).
- Der bruges ikke `useDraftField`, og der er ingen `Escape`/rollback-semantik.
- `onCommit` kan være semantisk identisk med kontrollens native change-callback (fx radio-selektion).
- For radio groups følger keyboard-selektion via `Enter` og `ArrowLeft`/`ArrowRight` `keyboard-navigation.md` og er stadig et øjeblikkeligt commit.
- For select/combobox-lignende kontroller sker commit ved selektion (`onChange`); `Escape` lukker typisk kun popover/menu.
- Hvis kontrollen har en popover/menu-interaktion, eksponér en eksplicit `onClose` (interaktion afsluttet) adskilt fra fysisk `onBlur`. `onClose` betyder, at popup/menu lukkede, uanset om der skete en selektion; `onCommit` betyder, at en konkret værdi blev committet. Begge kan fyre for en valgt option.
- Hvis et imperativt handle eksponeres (fx `shake()`), SKAL dets semantik dokumenteres, og det MÅ IKKE mutere committed form-state.

Dette er tilladte afvigelser, men de SKAL forblive eksplicitte og konsistente.

## Skjulte domæneregler (SKAL være eksplicitte)

Hvis en komponent har en uundgåelig default (eller en ikke-indlysende constraint), SKAL den eksponeres eksplicit via props og/eller dokumenteres i komponentens props.

Eksempler i Mineo:
- Percent-felter kræver eksplicit opt-in for default-intervallet (`useDefaultPercentRange`).
- År/uge-parsing af 1-2-cifrede årstal SKAL være policy-styret (`twoDigitYearPolicy`).
- Cifferspærringer (fx integer `safetyMaxDigits`) SKAL være eksplicitte.

## Bemærkninger om UI-baser

UI-base-komponenter (Lag A) bruger bevidst det enklest mulige API:
- `onDraftChange(draft: string)` (ikke event-formet)

Felt-adaptere (Lag C) er ansvarlige for at wrappe draft-ændringer ind i Mineos event-form (`DraftChangeEvent`)
for konsistens ved Styled*Field-grænsen.

UI-base-invarianter (a11y + kontrakt):
- Fejl for ugyldigt input SKAL vises via rød ramme + tooltip ved hover (ingen inline helper-text-fejl-rendering).
- `error === true` MÅ IKKE være stille: `helperText` SKAL leveres (DEV-asserteret af baserne) og bruges som tooltip + a11y described-by-tekst.
- `htmlInputAttributes`/`htmlTextAreaAttributes` SKAL behandles som adapter-interne; videregiv dem ikke fra sider/call-sites.

## Reference-implementeringer

Brug disse som canonical eksempler:
- `src/hooks/useDraftField.ts`
- `src/components/inputs/StyledTextFieldBase.tsx`
- `src/components/inputs/StyledYearField.tsx`

## Tjekliste for nye felter

- Én commit-kanal (`onCommit`)
- `onBlur` er kun fysisk blur (intet skjult commit)
- Parseren er eneste kilde til sandhed; ingen draft-mutation mens der skrives
- UI-constraints (maxLength/inputMode/osv.) matcher parser-reglerne
- Prop-kombinationer valideres deterministisk (DEV fail-fast)
- Formattering sker kun post-commit og er deterministisk
