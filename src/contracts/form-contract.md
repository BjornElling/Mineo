# Mineo – Form Contract

**Version:** 0.1
**Status:** Gældende arkitektur
**Formål:** At fastlægge ufravigelige regler for form-arkitektur, state-håndtering og validering i Mineo.

---

Dette dokument er **normativt**.
Kode, der afviger fra denne kontrakt, betragtes som **arkitektonisk fejl**.

---

## 1. Grundprincipper

1. Applikationen kører **100 % client-side**.
2. Ingen brugerdata må forlade browseren.
3. Al state-håndtering skal være:
   - deterministisk
   - forudsigelig
   - fri for skjulte side-effects
4. Korrekthed prioriteres altid over:
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
  - Paste må åbne editor og **overskrive** eksisterende indhold (feltets draft sættes til den indsatte tekst).
  - `Backspace`/`Delete` må rydde feltets indhold, men må **ikke** åbne editor.
- `Enter` må **aldrig** åbne editor i fokus-men-ikke-redigær:
  - På sider opfører `Enter` sig som navigations-tast (som hidtil via `Container`).
  - I tabeller opfører `Enter` sig som vertikal navigation i henhold til tabel-navigationens kontrakt (anchor-celle fra Tab-sekvensens start).
- Funktionstaster (fx `F2`) må ikke indføres som alternativ editor-åbning.
- Kun semantisk “plausible” første-tegn må kunne starte redigering (fx taltegn i numeriske inputs). Ikke-plausible tegn må ignoreres i fokus-men-ikke-redigær.

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

---

## 6. Row-drafts

### 6.1 Generelle regler

- Alle dynamiske tabelrækker skal bruge `useRowDrafts`
- Row-drafts følger samme principper som øvrige drafts:
  - strings i draft
  - parsing på blur
  - committed state er schema-valideret

### 6.2 useRowDrafts-kontrakt

- onChange opdaterer kun draft (strings)
- Commit (typisk onBlur) opdaterer committed funktionelt og resyncer draft til samme ensured state
- Ingen side-effects i state-updaters

### 6.3 Row Draft Resync Policy

Row-drafts resynkroniseres udelukkende når et eksplicit `resyncToken` ændres.

Dette sker ved:
- Initial mount
- Form reset
- Indlæsning af sag
- Versions-migration

Drafts resynkroniseres **ikke** ved almindelig commit-flow (onBlur).

**Implementationsnote (Mineo pt.):**
- `resyncToken` er obligatorisk i `useRowDrafts`.
- Vi bruger et form-wide `formVersion` som `resyncToken`, hvilket betyder at et `formVersion`-skift resync’er **alle** row-drafts (og kan dermed kassere ucommitted row-inputs ved reset/load/migration).

Debug-regel:
Hvis en række “nulstilles”, skal man altid kunne pege på en `resyncToken`-ændring.

---

## 7. Validering

### 7.1 Valideringslag

Validering opdeles i tre eksplicitte lag:

**Lag 1 – Input-lokal**
- Format
- Range
- Kører på onBlur

**Lag 2 – Kritiske felter**
- Felter der påvirker beregning
- Kører på onBlur

**Lag 3 – Fuld form**
- Kører kun ved:
  - tab-skift til "Beregning"
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
