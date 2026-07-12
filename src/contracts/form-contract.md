# Mineo – Form Contract

**Version:** 0.1
**Status:** Gældende arkitektur
**Type:** Tværgående kontrakt
**Senest verificeret mod kode:** 2026-07-12
**Formål:** At fastlægge ufravigelige regler for form-arkitektur, state-håndtering og validering i Mineo.

---

Dette dokument er **normativt**.
Kode, der afviger fra denne kontrakt, betragtes som **arkitektonisk fejl**.

---

## 1. Grundprincipper

1. Applikationen kører **100 % client-side**.
2. Ingen brugerdata må forlade browseren.
3. Domænegrænser mellem sider er bindende og styres af `src/contracts/domain-boundary-contract.md`.
4. Al state-håndtering skal være:
   - deterministisk
   - forudsigelig
   - fri for skjulte side-effects
5. Korrekthed prioriteres altid over:
   - kort kode
   - "nemme løsninger"
   - midlertidige hacks

---

## 2. Draft vs Committed State

### 2.1 Definitioner

- **Draft state**
  - Bruges til UI-interaktion
  - Må indeholde:
    - tomme værdier
    - delvist indtastede værdier
    - invalide værdier
  - Er *aldrig* grundlag for beregning

- **Committed state**
  - Er domænestate
  - Skal altid være schema-valideret
  - Bruges til:
    - constraints
    - beregning
    - videre afhængigheder

### 2.2 Ufravigelige regler

- Draft ≠ committed
- Parsing må **kun** ske ved commit
- Committed state må **aldrig** indeholde invalide værdier
- Draft state må **aldrig** anvendes direkte i beregninger
- En tredje, eksplicit tier — **committed rå draft** — håndterer det input, der blev forsøgt committet, men ikke kunne parses (jf. §2.4). Den er en separat, string-typet recovery-kanal (`invalidDrafts`), ikke committed domænestate, og indgår derfor aldrig i beregning eller `.eo`.
- Synlighed/rendering må **ikke** i sig selv rydde allerede committet brugerinput i persisted sagsfelter
- Hvis et persisted sagsfelt eller en persisted række skjules, skal den committede værdi fortsat kunne overleve `F5`, `.eo`-save og `.eo`-load
- Skjulte committed værdier må kun neutraliseres ved, at validering og beregning eksplicit gater på de aktive domæneregler; de må ikke neutraliseres ved skjult state-clearing
- **Synlighed og beregnings-relevans har ét sandt sted.** Et felts synlighed (vis/skjul) og dets neutralisering i beregningen skal udledes af **samme** relevans-prædikat, så "skjult i UI" og "ignoreret i beregning" ikke kan divergere. Sidekomponenter må ikke gen-introducere inline-synlighedsbetingelser (`values.x === 'Ja' && …`, `getChecked(values.x) && …`) på felter hvis relevans ejes af et prædikat. Kanoniske prædikat-moduler: `domain/erstatningsopgoerelse/helpers/eoInputRelevance.ts` (EO; talfødende skjulte felter neutraliseres fail-closed via `neutralizeIrrelevantEoInputs` før motorerne) og `domain/policies/aarsloenPolicy.ts` (årsløn). Per-række relevans der afhænger af domæne-policy-opslag (fx sygeferiegodtgørelse via `resolveSfggSource`) ejes bevidst af den motor der allerede resolver kilden — den er ét sandt sted i sig selv og spejles ikke i prædikat-modulet.

### 2.3 `initialValues`-materialisering

- `initialValues` er kun fallback for fraværende committed sektioner eller nye sagsdata.
- Før `initialValues` bruges som committed fallback, skal de materialiseres gennem sektionens Zod-schema.
- Schema-defaults må dermed anvendes ved oprettelse af nye runtime-værdier, men må ikke injiceres i `.eo` load for at skjule manglende nyere felter, jf. `persistence-contract.md`.
- En eksisterende committed sektion må aldrig overskrives med `initialValues` pga. navigation, rerender, settings-ændring eller lokal resync.
- Funktionelle form-commits via `usePersistedForm().setValues` må returnere en fuld sektion eller et subset-patch. Subset-patches skal materialiseres oven på seneste committed schema-værdi og derefter gennem den normale schema-validerede persistence-vej.

### 2.4 Committed rå draft (`invalidDrafts`)

Når et commit-forsøg ikke kan parses (ikke-committbart format, fx `"12.x.20"` i et datofelt), beholdes den committede værdi uændret (sidst gyldige eller `undefined`), og den rå streng skrives til en separat persisteret recovery-kanal:

```
invalidDrafts[pageKey][fieldPath] = råstreng (ikke-tom)
```

Regler:

- `invalidDrafts` er **ikke** committed domænestate. Den er string-typet og indgår aldrig i beregning.
- Den flyder ad den normale committed-tier-vej: store → `sessionStorage` → undo/redo-snapshot. Den overlever derfor `F5` og kan undo/redo'es som alt andet committed input.
- Den ekskluderes fra `.eo` (se `persistence-contract.md`). Da Gem blokeres ved enhver `invalidDrafts`-entry, kan en gemt fil per definition aldrig indeholde et entry.
- Et vellykket commit på feltet rydder dets `invalidDrafts`-entry; et fejlende commit skriver/opdaterer det. Skrivning sker **kun** ved commit (blur/Enter), aldrig i `onChange` (no-live-preview).
- Feltets rød kant + tooltip for parse-fejl er en **afledt** visning af `invalidDrafts` (jf. `error-contract.md`). Range/rule/schema-fejl forbliver i `fieldErrors`.

---

## 3. Event-semantik

### 3.1 onChange

- Bruges **kun** til:
  - opdatering af draft state
  - visuel feedback
- onChange må **ikke**:
  - parse
  - validere domænedata
  - opdatere committed state
  - trigge beregninger
  - opdatere beregnede/afledte værdier (beregnede outputs må først opdatere ved commit)

### 3.2 onBlur

- onBlur er **primær commit-mekanisme**
- onBlur må:
  - parse draft → domænetype
  - validere
  - committe til committed state

**Terminologi**
- I Mineo er det mere præcist at tænke i et konceptuelt `onCommit` end i `onBlur`.
- `onBlur` er standard-mekanismen, som udløser commit.
- I tabeller kan commit også være bundet til eksplicit navigation (fx Enter/Tab) via tabel-kontrakterne, men semantikken er den samme: det er stadig commit.
- onBlur skal være:
  - imperativ
  - entydig
  - fri for async-hacks

Globale handlinger må udløse samme commitvej gennem den registrerede felt-/grid-deltager efter
`critical-action-contract.md`. Det er ikke en alternativ parse- eller valideringssti.

### 3.3 Forbudte patterns

- Ingen commit i onChange
- Ingen implicit commit via useEffect
- Ingen queueMicrotask / setTimeout / Promise-hacks
- Ingen setState inde i setState

### 3.4 Input-fokus og redigeringsmodel (2-trins)

Mineo anvender en bevidst 2-trins interaktionsmodel for tekst-/tal-inputs (både på sider og i tabeller).
Dette afviger fra standard MUI-/browser-adfærd og er **normativt**: fremtidige refactors, komponent-udskiftninger
eller library-opgraderinger må ikke bryde disse semantikker.

**Scope**
- Gælder for Mineos “draft/commit”-inputs (de felter hvor parsing/validering er bundet til blur/commit).
- Gælder ikke for popup-widgets/combobox/dropdowns (fx `StyledDropdown`, `TableDropdown`) hvor 1. klik typisk skal åbne en menu.

**Definitioner**
- **Fokus, editor lukket**: Feltet er fokuseret men er `readOnly` (caret skjules). Brugeren kan navigere mellem felter/celler uden at utilsigtet starte redigering.
- **Editor åben**: Feltet er ikke `readOnly` (caret synlig). Brugeren kan redigere (cursor, selection, etc.).

**Ufravigelige regler**
- 1. fokus-handling (klik eller Tab ind) må **kun** give fokus; den må **ikke** åbne editor.
- Klik på et allerede fokuseret felt må åbne editor (cursor placeres ved musen via browserens normale caret-placement).
- Når editor er lukket og feltet har fokus:
  - Et printbart tegn må åbne editor og **overskrive** eksisterende indhold (feltets draft sættes til den tastede karakter).
  - Paste må **aldrig** åbne editor. Paste håndteres i lukket editor-tilstand efter feltets egne paste-regler.
  - `Backspace`/`Delete` må rydde feltets indhold, men må **ikke** åbne editor.
- Tastemodellen ejes normativt af `keyboard-navigation.md`.
- Feltadaptere eller `mineo-field-pattern.md` ejer, hvilke første tegn der er plausible for hver inputfamilie.
- En key-startet edit må højst opdatere draft og må aldrig parse, validere domænedata eller committe før commit-eventet.

**Commit og validering**
- Parsing/validering/commit må fortsat **kun** ske ved blur (eller Enter-commit hvor det allerede er en eksplicit del af feltets kontrakt).
- Fokus uden åbnet editor må ikke trigge:
  - commit
  - touched/fejl-UI
  - schema-commit

**Table-note**
- Tabel-inputs kan implementere “fokus-men-ikke-redigær” ved at styre `readOnly` pr. celle.
- Rydning (`Backspace`/`Delete`) i fokus-men-ikke-redigær må ikke åbne editor, og må ikke forstyrre tabel-navigationens Tab/Enter-kontrakt.

---

## 4. Date-håndtering

### 4.1 Draft dates

- Draft-dates repræsenteres som:
  ```ts
  string | undefined
  ```
- Draft-dates må være:
  - tomme
  - delvist indtastede
  - ugyldige

### 4.2 Committed dates

- Committed-dates repræsenteres som:
  ```ts
  ISODateString | undefined
  ```
- Parsing sker kun:
  - i onBlur
  - via `coerceToISODateString`
  - evt. schema-validering

### 4.3 Constraints

- Min/max constraints må kun læse:
  - committed values
- Draft values må aldrig bruges til constraints
- Dato-intervalfejl (min/max) er **ikke** commit-blokerende:
  - Gyldigt datoformat committes altid og formateres til canonical form (dd-mm-åååå/ISO)
  - Udenfor interval giver fejlvisning (tooltip + rød ramme), men commit sker
  - Ugyldigt format committes ikke
- Undtagelse: visse domænespecifikke bounds kan give fejlvisning direkte i feltet fra commit-tidspunktet, når dette er normativt defineret i den relevante domænekontrakt.

### 4.4 Gem-gating følger commitbarhed, ikke al rød fejl-UI

Dette er et bevidst designvalg og er normativt for Mineo:

- `.eo`-gem må gerne fortsætte, når et felt allerede har committet en gyldig canonical værdi, selv om
  feltet viser rød fejlmarkering pga. bounds/afgrænsning.
- `.eo`-gem må kun blokeres af fejl, der betyder at brugerens aktuelle input **ikke kunne committes** til
  committed state.
- Konsekvens:
  - Gyldig dato i forkert interval må gemmes.
  - Gyldigt heltal uden for UI-only range må gemmes.
  - Ugyldig dato, ugyldigt talformat eller andre ikke-committable input må ikke gemmes.

Rationale:
- Save/load skal persistere schema-valideret committed brugerinput.
- Rød fejlvisning i UI er ikke i sig selv nok til at blokere save; blokering afhænger af om committed
  state findes og er gyldig.
- Dette skel skal bevares ved fremtidige refactors for at undgå regression i save-flowet.

`blocksSave` er normativt defineret i `error-contract.md`. Save-gating følger commitbarhed, ikke `severity` alene. Konkret blokeres Gem af: (1) enhver `invalidDrafts`-entry (ikke-committbart input, jf. §2.4), og (2) enhver blokerende `fieldErrors`-entry med `severity:'error'` og `blocksSave!==false` (typisk `rule`/`schema`-fejl). Range/bounds-fejl (`blocksSave:false`) blokerer aldrig.

---

## 5. Tables

### 5.1 Ansvar

Tables er rene UI-komponenter.

**Tables må:**
- vise data
- kalde callbacks
- vise beregnede værdier leveret udefra

**Tables må ikke:**
- parse datoer
- validere domænedata
- kende ISO-formater
- indeholde forretningslogik
- beregne domæneværdier

### 5.2 Dataflow

**Tables modtager:**
- draft-strings
- numbers
- precomputed values

**Al parsing og beregning sker i:**
- parent-komponent
- eller dedikerede hooks

### 5.3 Standardiseret løntabel

- Den standardiserede løntabel i `Årsløn` og `Lønindkomst` har to separate lønfelter med overskrifterne `Løn` og `Løn (2)`.
- De to felter har identisk domænebetydning.
- Beregninger må ikke gøre forskel på felterne; værdierne indgår blot samlet i løngrundlaget.
- Opdelingen i to felter findes alene for at give brugeren mulighed for en visuel opdeling af lønindtastningen.
- UI-tekster, PDF-headere, kontrolvisninger og tests skal afspejle denne regel.

### 5.4 Offentlige ydelser-tabel

- Tabellen for `Offentlige ydelser` har to separate ydelsesfelter med overskrifterne `Ydelse` og `Ydelse (2)`.
- De to felter har identisk domænebetydning.
- Beregninger må ikke gøre forskel på felterne; værdierne indgår blot samlet i én samlet ydelse.
- Opdelingen i to felter findes alene for at give brugeren mulighed for en visuel opdeling af ydelsesindtastningen.
- UI-tekster, PDF-headere, kontrolvisninger og tests skal afspejle denne regel.

---

## 6. Row-drafts

### 6.1 Generelle regler

- Dynamiske tabelrækker med add/remove/reorder skal bruge `useRowDrafts`
- Statiske eller domænespecifikke grid-tabeller må kun bruge direkte `commitRowUpdate`, hvis hver celle stadig følger Table*Input commit-kontrakten og tabellen ikke har row-draft isolation som brugerforventning.
- Row-drafts følger samme principper som øvrige drafts:
  - strings i draft
  - parsing på blur
  - committed state er schema-valideret

### 6.2 useRowDrafts-kontrakt

- onChange opdaterer kun draft (strings)
- `onRowBlur(rowId)` er række-granulær: ét felt-blur committer hele rækkens aktuelle draft mod committed state.
- Commit (typisk row blur) opdaterer committed funktionelt og resyncer kun draft til ensured state, når committed rows faktisk ændrer sig.
- No-op blur må ikke bumpe interne resync-tokens eller nulstille andre drafts.
- Ingen side-effects i state-updaters
- `useRowDrafts` må ikke eksponere rå `setDraftRows`; draft-opdateringer skal gå gennem hookets kontrollerede API, så ref-state og React-state er synkrone i samme event-handler.

### 6.3 Row Draft Resync Policy

Row-drafts resynkroniseres kun efter autoritative hændelser:

Dette sker ved:
- Initial mount
- Faktiske interne row-commits/add/remove/reorder, hvor committed rows ændrer sig
- Form reset
- Indlæsning af sag
- Versions-migration
- Undo/redo-restore

Drafts resynkroniseres **ikke** ved no-op blur/commit, hvor den normaliserede committed række er uændret.

**Normativ beslutning (Mineo pt.):**
- `resyncToken` er obligatorisk i `useRowDrafts`.
- Mineo bruger et form-wide `formVersion` som `resyncToken`.
- Load, reset, migration og undo/redo er autoritative hændelser, hvor ucommitted row-draft bevidst kan tabes efter eksplicit brugerhandling eller global restore.
- Section-granulær resync er ikke et generelt mål nu. Den må kun genåbnes, hvis et konkret datatabsscenarie dokumenteres.
- Form-wide resync må ikke udvides til no-op commit-flows.

Debug-regel:
Hvis en række “nulstilles”, skal man altid kunne pege på en faktisk intern row-ændring eller en `resyncToken`-ændring.

### 6.4 Draft-systemernes ansvarsfordeling

Tre kanoniske mekanismer implementerer draft/committed-separationen. De løser det samme grundproblem
(brugerinput ≠ domænestate), men for forskellige UI- og datastrukturer:

| Mekanisme | Datastruktur | Bruges til |
|------|-------------|-----------|
| `useDraftField` | Enkelt almindeligt felt (string → parsed value) | Individuelle Styled* text/number/date-felter uden grid-editor. Håndterer parse-on-blur, focus snapshot, cancel (Escape), error state per felt. |
| `useRowDrafts` | Array af rækker (draft rows ↔ committed rows) | Dynamiske tabelrækker. Håndterer add/remove/commit row og resync via `resyncToken`. Validering hører til Table*Input eller tabelspecifik committed validering, ikke hookets tastetryks-hot path. |
| `useTableInputCore` + tabel-input-adapter | Enkelt grid-cellefelt | Table*Input-komponenter, hvor GridCore ejer editoråbning, `commitCurrent`, `clearAndCommit`, key-startet edit og cellenavigation. Kernen ejer committed-resync (autoritativ snapshot-epoch + committed value), `invalidDrafts`-recovery-kanalen (via `useCellInvalidDraftChannel`), no-op fingerprinting og editor-handle wiring, så dette ikke duplikeres per inputtype. |

**Hvornår bruges hvad:**
- Er inputtet et almindeligt enkeltfelt uden GridCore? → `useDraftField`
- Er inputtet en dynamisk tabel med rækker der kan tilføjes/fjernes? → `useRowDrafts`
- Er inputtet en GridCore-tabelcelle? → Table*Input skal bruge `useTableInputCore` med en type-specifik adapter. Parser/formatter/fingerprint-regler hører til adapteren; committed-resync, `invalidDrafts`-recovery-kanalen og GridCore editor-handle wiring hører til kernen.
- Disse mekanismer må ikke overlappe for det samme ansvar på samme stykke data.

---

## 7. Validering

### 7.1 Valideringslag

Validering opdeles i to eksplicitte lag:

**Lag 1 – Felt-lokal validering ved commit**
- Format
- Range
- Feltets egne syntaks- og commit-regler
- Kører på onBlur/onCommit

**Lag 2 – Fuld form / cross-field**
- Tværfelt-regler
- Beregningsforudsætninger
- Tab- eller beregningsspecifikke blokeringer
- Kører kun ved:
  - tab-skift til beregningsvisning
  - klik på "Beregn"

### 7.2 Forbudte patterns

- Ingen global `useEffect(() => validate(values))`
- Ingen validering på hver keystroke
- Ingen skjult auto-validering

---

## 8. Side-effects og state-sikkerhed

### 8.1 Forbudte patterns

- setState inde i setState
- Async side-effects i state-updaters
- Implicit state-sync via referencer
- Læsning af stale closures i commit-logik

### 8.2 Krav

Alle commits skal være:
- imperativt udløst
- entydige
- lette at følge i stack traces

---

## 9. Arkitektonisk konsekvens

Hvis kode:
- føles "lidt forkert"
- kræver forklaring for at give mening
- bryder ovenstående regler

**så er den forkert, også selvom den "virker".**

Denne kontrakt prioriterer:
- korrekthed
- forudsigelighed
- langsigtet vedligeholdelse

over:
- hurtig implementering
- kort kode
- lokale kompromiser

---

## 10. Ændringer af kontrakten

Ændringer skal være:
- eksplicitte
- begrundede
- versionsstyrede

**Kode må aldrig stiltiende afvige fra kontrakten.**

---

## 11. Beløbsfelter og numerik

Beløbs- og afrundingsregler er samlet i `src/contracts/amount-contract.md`.

Form-kontrakten ejer kun commit-semantikken: beløb må parse/normalisere ved commit, ikke mens brugeren skriver. `AmountValue` er 2-decimalers beløb; felter med anden precision må ikke bruge `AmountValue`.

---

## 12. Domænespecifikke undtagelser

EO-specifikke feltklassificeringer, bounds-regler, TAF-konsistens og `tidligereModtagetTaf`-isometri er normativt defineret i `src/contracts/eo-snapshot-contract.md`.
