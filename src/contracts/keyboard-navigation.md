# Keyboard Navigation Kontrakt

**Status:** Normativ
**Type:** Tværgående kontrakt
**Gælder for:** Hele Mineo applikationen
**Implementeret i:** `src/components/layout/Container.tsx`

---

## Overordnet princip

Mineo bruger **Container-styret keyboard navigation**, hvor `Container.tsx` ejer og håndhæver al fokus-traversering på en side.

Alle tastatur-navigation skal:
- Være **forudsigelig** og **konsistent**
- **Aldrig** selektere indhold utilsigtet
- Respektere **popup-widgets** (dropdown, datepicker, autocomplete)
- Understøtte **cirkulær navigation** (Tab fra sidste felt går til første felt)

---

## Keyboard-regler (normative)

### Tab / Shift+Tab

**Adfærd:**
- Flytter fokus til næste/forrige fokusbare element
- Cirkulær navigation: Tab fra sidste felt → første felt, Shift+Tab fra første felt → sidste felt
- **MÅ ALDRIG selektere indhold i målfeltet**
- Kun fokus – ingen selection

**Undtagelser:**
- Popup-widgets der er åbne (aria-expanded="true") – Container intercepter IKKE Tab, så widget selv kan håndtere det

Konsekvens:
- Browserens standard-tabflow må gerne undertrykkes, hvis det er nødvendigt for at opnå den normerede navigation.
- Intern fokuseringsmekanisme er et implementeringsvalg, så længe den ikke giver utilsigtet selection eller scroll-hop.

---

### Enter

**Adfærd:**
- Opfører sig som Tab (flytter fokus fremad til næste element)
- `Shift+Enter` flytter fokus bagud efter samme undtagelser som `Enter`/`Shift+Tab`
- **MÅ ALDRIG selektere indhold**
- Cirkulær navigation: Enter fra sidste felt → første felt

**Undtagelser:**
1. **Popup-widgets** (dropdown/datepicker/autocomplete)
   - Container intercepter IKKE Enter, så widget selv kan åbne/lukke
   - Detekteres via ARIA: `role="combobox"`, `aria-haspopup`, `aria-expanded`

2. **Textareas**
   - Enter giver newline som normalt
   - Container intercepter IKKE Enter i textareas

3. **Radiobuttons**
   - Enter vælger den radiobutton der aktuelt har fokus
   - Container intercepter Enter-navigation for radiofelter, så fokus ikke flyttes videre

Konsekvens:
- Enter-navigation må gerne dele intern mekanik med Tab-navigation, men kontrakten kræver kun den observerbare adfærd.

---

### Piletaster (uden for tabeller)

**Adfærd når felt har fokus og editor er lukket:**
- `ArrowRight` / `ArrowLeft`: flytter fokus til næste/forrige fokusbare felt i samme række
- Wrap i række: fra sidste → første, fra første → sidste
- `ArrowDown`: flytter fokus til første fokusbare felt i række under
- `ArrowUp`: flytter fokus til sidste fokusbare felt i række over
- Vertikal wrap: fra nederste række → øverste række, fra øverste række → nederste række

**Række-definition:**
- Primært via eksisterende række-containere (`row--*` / hover-row mønstre)
- Fallback: visuel række via elementernes Y-position

**Undtagelser:**
1. **Radiobuttons**
   - `ArrowRight` / `ArrowLeft` flytter den aktive radiobuttons selection og fokus i den pågældende retning inden for samme radiogruppe
   - Wrap i radiogruppe: højre fra sidste → første, venstre fra første → sidste
   - Det er den radiobutton der aktuelt har fokus, der er udgangspunkt for flytningen, også hvis en anden option allerede er valgt
2. **Tabeller** (`data-mineo-table-navigation="true"`)
   - Container må ikke overtage tabelintern pilnavigation.
   - Tabelmodulet ejer intern navigation og stopper propagation for taster, det selv håndterer.
   - Lodret edge-exit ved top/bund er en aftalt integration mellem tabelmodul og Container.
   - Fra felter uden for tabel kan vertikal navigation (`ArrowUp`/`ArrowDown`) fokusere første/sidste relevante tabelcelle over/under.
3. **Åbne popup-widgets** (`aria-expanded="true"`)
   - Container intercepter IKKE piletaster
   - Widget/menu ejer intern navigation
4. **Editor åben**
   - For Mineos Styled*-tekstfelter betyder editor åben, at det fokuserede tekstinput er redigerbart (`readOnly=false`) og ikke er en ikke-tekstlig inputtype.
   - Andre komponenter skal eksponere en tilsvarende auditérbar edit-state.
   - Container intercepter IKKE piletaster
   - Eksisterende caret/editor-adfærd bevares

---

### Museklik

**Adfærd:**
- Container håndterer **IKKE** museklik
- Selection ved museklik er **komponentens eget ansvar**, IKKE Containers
- Første klik på et felt skal kun give fokus (ingen selection)

**Undtagelse:**
- StyledDropdown: Første klik skal folde menuen ud, selvom feltet ikke i forvejen har fokus

**Hvorfor Container ikke håndterer museklik:**
- Museklik er ikke traversering
- Forskellige komponenter har forskellige museklik-behov
- Container må ikke blande sig i komponent-intern UX

---

## Popup-widget detection

Normativt krav:

- Popup-widgets skal kunne overtage deres egen keyboard-navigation, når deres popup er åben.
- Container må i denne tilstand ikke overtage `Tab`, `Enter` eller piletaster, hvis det ville bryde widgetens egen interaktion.
- Det er tilladt at bruge ARIA-semantik eller en anden tilsvarende, auditérbar mekanisme til at detektere dette.

---

## Cross-cutting kontrakt (for tabeller/subtrees)

Hvis en interaktiv subtree (fx tabel med Excel-navigation) implementerer sin egen traversering:

**KRAV:**
- Container må ikke håndtere almindelig tabelintern navigation.
- Subtree skal kalde `preventDefault()` + `stopPropagation()` for de taster, den selv håndterer.
- Edge-exit til/fra Container skal ske via den aftalte table-boundary mekanisme, ikke ved at lade dobbelt navigation ske tilfældigt.

**Eksempel:**
```typescript
// I tabel med Excel-navigation
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    e.stopPropagation(); // VIGTIGT: Stop Container fra at fange tasten
    // ... håndter pil-navigation internt
  }
};
```

---

## Overlay note: Løntrin-finder

Løntrin-finder popup (anvendt i både `Lønindkomst` og `EO-oplysninger`) bruger en eksplicit, hardcoded tab-sekvens:

`Ansættelse -> Beløb -> Dato -> Beregn`

Dette er bevidst og normativt for den popup, fordi generisk focus-trap tidligere gav ustabil adfærd med dropdown-popover og fokuslæk til siden bagved.

Krav:
- `Tab`/`Shift+Tab` skal altid cirkulere inden for popup-sekvensen.
- `Escape` lukker popup.
- `Enter` på åbne dropdowns håndteres af dropdown selv.
- `ArrowUp`/`ArrowDown` må kun overtage intern popup-navigation, når dropdown-menu ikke er åben og editor ikke er åben.

Overlayets interne focus-trap ejes af overlay-komponenten selv. `Container` må kun undlade at interferere med popup/portal-subtrees. Overlayet er ansvarligt for at stoppe fokuslæk til siden bagved.

---

## Implementeringsfrihed

Kontrakten fastlægger den observerbare adfærd, ikke den præcise interne mekanisme.

Det betyder:

- Der må gerne refaktoreres i `Container.tsx`, så længe adfærden ovenfor bevares.
- CSS-selectors, fokus-hjælpefunktioner og konkrete `focus(...)`-kald er implementeringsdetaljer.
- Hvilke elementer der indgår i tab-sekvensen, skal fortsat være eksplicit og auditérbart defineret, men ikke nødvendigvis via den samme selector-strategi som i dag.
- Sideintegrerede handlingsknapper må kun indgå i den normale feltsekvens ved eksplicit opt-in.

---

## Test-garanti

Container keyboard-navigation testes på to niveauer:

### 1. Automatiske tests (Vitest)

**Placering:** `src/__tests__/components/layout/Container.test.tsx`

**Dækker:**
- Tab flytter fokus fremad (ingen selection)
- Shift+Tab flytter fokus baglæns (ingen selection)
- Enter flytter fokus fremad (ingen selection), undtagen på radiofelter
- Shift+Enter flytter fokus bagud efter samme undtagelser
- Enter på dropdown intercepteres IKKE
- Enter på radiobutton vælger fokuseret option
- ArrowUp/ArrowDown/ArrowLeft/ArrowRight på almindelige felter
- pilnavigation fra sidefelter ind i tabel og tabel-edge-exit op/ned
- at ArrowLeft/ArrowRight ikke slipper ud af tabel ved rækkekant
- ArrowLeft/ArrowRight på radiobutton flytter aktiv selection og fokus med wrap i radiogruppen
- inline action buttons, radiogruppe som ét tabstop, scroll til felt uden for viewport og popup-undtagelser
- Cirkulær navigation fungerer

### 2. Manuel test-tjekliste

**Placering:** `docs/testing/keyboard-navigation-test-checklist.md`

**Dækker:**
- Real-world formularer (Erstatningsopgørelse, Stamdata, etc.)
- Alle felt-typer (text, number, date, dropdown, etc.)
- Edge cases (tomme felter, readOnly, disabled)
- Visuel inspektion (ingen blå markering ved Tab)

---

## Hvad MÅ IKKE ske

Følgende adfærd er **forbudt** og betragtes som fejl:

- FEJL: Tab markerer tekst i et felt.
- FEJL: Enter markerer tekst i et felt.
- FEJL: Enter overskriver værdi uden brugerens samtykke.
- FEJL: Fokus springer uventet.
- FEJL: Dropdown åbner utilsigtet ved Tab.
- FEJL: Container intercepter museklik.
- FEJL: Selection sker ved keyboard-navigation.

---

## Fremtidig evolution

Container-styret keyboard traversal må aldrig skabe selection.

Hvis der i fremtiden opstår behov for selection-on-focus i en komponent:

1. **Det må ALDRIG ske i Container**
2. Det skal designes eksplicit i den relevante komponent
3. Det skal skelne mellem:
   - Keyboard-fokus (aldrig selection)
   - Pointer-fokus (evt. selection)
4. Det skal dokumenteres i komponentens kontrakt

---

## Se også

- `src/components/layout/Container.tsx` – Implementation
- `src/__tests__/components/layout/Container.test.tsx` – Automatiske tests
- `docs/testing/keyboard-navigation-test-checklist.md` – Manuel QA-procedure
- `AGENTS.md` – kontrakthierarki og no-live-preview regler
