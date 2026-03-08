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
- Undtagelse: visse EO-feltspecifikke bounds giver fejlvisning direkte i feltet fra commit-tidspunktet — se §13.

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

---

## 11. Beløbsfelter (AmountValue) – commit- og beregningsregler

Dette afsnit er normativt for alle beløbsfelter, der kan indeholde tal eller udtryk.

1. Evaluering af udtryk:
- Indtastede operandværdier må ikke ændres før evaluering.
- Ingen pre-afrunding eller pre-afskæring af deltal i udtryk.

2. Commit-semantik:
- Kun slutresultatet af et beløb/udtryk må afrundes.
- Standard for beløbsfelter er 2 decimaler med `half away from zero`.

3. Datamodel og videre beregning:
- `AmountValue.expression` er audit/UI-repræsentation.
- `AmountValue.value` er den autoritative committed beregningsværdi.
- Al videre domæneberegning skal bruge `AmountValue.value`.

4. Persist/load:
- Indlæste `AmountValue` skal normaliseres til samme afrundede committed semantik som ved almindelig commit.

5. Precision-binding (nuværende model):
- `AmountValue` schema-normalisering er aktuelt bundet til precision 2.
- Felter med anden precision må derfor ikke persisteres som `AmountValue` uden eksplicit arkitekturændring.

---

## 12. TAF tvær-output konsistens (EO vs. TAF fordelt på år)

Dette afsnit er normativt for visning af tabt arbejdsfortjeneste i flere outputs.

1. Autoritativ total:
- Den autoritative TAF-total er EO-modellens `tabtArbejdsfortjenesteOre`.
- Afledte visninger (herunder "TAF fordelt på år") må ikke beregne en alternativ total.

2. Invariant:
- Summen af årsbeløb plus eventuel afrundingslinje skal være identisk med den autoritative total.

3. Acceptabel afrundingsafvigelse:
- Den samlede forskel mellem årssum og autoritativ total må højst være 1 kr. (100 øre).
- Overskrides 1 kr., skal systemet være fail-closed: årsfordelingen må ikke vises som gyldig beregning.

4. Clamp-scenarie:
- Hvis EO-netto clamped til 0, fordi fradrag overstiger lønudvikling, må der ikke vises en misvisende årsfordeling med stor "Afrunding".
- Systemet skal i dette tilfælde fail-close årsfordelingen.

---

## 13. EO feltklassificering og todelt bounds-model

Dette afsnit er normativt for alle EO-felter og supplerer §7 (Validering).
Se `src/contracts/eo-snapshot-contract.md` §2 for den bindende specifikation af clamping.

### 13.1 Tre kategorier af EO-felter

**Valgfrie felter:**
- Tomt felt er gyldigt og semantisk neutralt.
- Giver ingen fejl — hverken i felt eller i EOBeregningTab.
- Eksempel: `tidligereModtagetTaf` (tomt = 0 kr., ikke en fejl), `differencekravDato`.

**Påkrævede felter:**
- Tomt felt giver fejl **kun** på EOBeregningTab-niveau (ikke som feltfejl).
- Blokerer download.
- Eksempel: Fra- eller til-dato på en ikke-tom TAF- eller svie/smerte-række.

**Særlige felter med immediate feltfejl:**
- Bounds-violation giver fejl direkte i inputfeltet fra commit-tidspunktet (tooltip + rød ramme).
- Fejlen vises også på EOBeregningTab og blokerer download.
- Eksempel: TAF til-dato `>= differencekravDato`, svie/smerte til-dato `>= ménafgørelsesdato`.
- Se §13.2 for den udtømmende liste.

### 13.2 Todelt bounds-model for TAF- og svie/smerte-perioder

**Fejlgivende bounds** (feltfejl + EOBeregningTab + blokerer download):

TAF fra-dato: `< 2005-01-01`, `< skadesdato` (ikke-erhvervssygdom), `< anmeldedato − 5 år`
(erhvervssygdom), `> til-dato i samme række`.

TAF til-dato: `< fra-dato i samme række`, `>= differencekravDato`,
`>= beregnet EET-virkningsdato` (når EET-afgørelse ikke er påklaget).

Svie/smerte fra-dato: `< 2005-01-01`, `< skadesdato` (ikke-erhvervssygdom),
`< anmeldedato − 5 år` (erhvervssygdom), `> til-dato i samme række`.

Svie/smerte til-dato: `< fra-dato i samme række`,
`>= afgørelsesdato for varige mén` (når ménafgørelse ikke er påklaget).

Overlap mellem rækker: fejl i felt + EOBeregningTab.

**Stille clamping** (ingen fejlindikation — udtømmende):

Kun mod EO-periodens grænser (`vedroererPeriodeFra`/`vedroererPeriodeTil`):
- TAF eller svie/smerte fra-dato `< vedroererPeriodeFra` → clampes stille
- TAF eller svie/smerte til-dato `> vedroererPeriodeTil` → clampes stille

Der er ingen andre bounds der clampes stille. Dette er en udtømmende undtagelse.

### 13.3 Clamping-tidspunkt og commit-semantik

Clamping sker pre-snapshot i `computeEoSnapshot`. Det ændrer ikke committed form-state.
Engines arbejder altid på clampede værdier.
Gyldigt datoformat committes altid — clamping er et post-commit snapshot-anliggende, ikke
et commit-tidspunkt-anliggende.

---

## 14. `tidligereModtagetTaf`-isometri

Dette afsnit er normativt for feltet `tidligereModtagetTaf` (og analogt for tilsvarende
"tidligere modtaget"-felter med same semantik).

1. Tom committed værdi (`undefined`) repræsenterer semantisk `0 kr`.
2. I snapshot/totals og alle projektioner (Beregning-tab, EODebug, PDF) normaliseres dette
   til numerisk `0` (MoneyOre). `null` eller `undefined` må ikke propagere som resultat
   af at feltet er tomt.
3. Der er ingen semantisk forskel på "0 kr" og "tomt" for dette felt — begge tolkes som
   `0 kr` fradrag.
4. Feltet er **valgfrit** (jf. §13.1) — tomt felt giver ingen fejl.
