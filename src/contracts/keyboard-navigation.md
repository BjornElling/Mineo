# Keyboard Navigation Kontrakt

**Status:** Normativ
**Gælder for:** Hele MINEO applikationen
**Implementeret i:** `src/components/layout/Container.tsx`

---

## Overordnet princip

MINEO bruger **Container-styret keyboard navigation**, hvor `Container.tsx` ejer og håndhæver al fokus-traversering på en side.

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

**Teknisk:**
- Container kalder `preventDefault()` for at forhindre browser-default navigation
- Bruger `element.focus({ preventScroll: true })` for at undgå scroll-hop

---

### Enter

**Adfærd:**
- Opfører sig som Tab (flytter fokus fremad til næste element)
- **MÅ ALDRIG selektere indhold**
- Cirkulær navigation: Enter fra sidste felt → første felt

**Undtagelser:**
1. **Popup-widgets** (dropdown/datepicker/autocomplete)
   - Container intercepter IKKE Enter, så widget selv kan åbne/lukke
   - Detekteres via ARIA: `role="combobox"`, `aria-haspopup`, `aria-expanded`

2. **Textareas**
   - Enter giver newline som normalt
   - Container intercepter IKKE Enter i textareas

**Teknisk:**
- Samme implementering som Tab (bruger `focusOnly()`)
- Tjekker `activeWidgetHasPopup` før intercept

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
1. **Tabeller** (`data-mineo-table-navigation="true"`)
   - Container intercepter IKKE piletaster i table-subtrees
   - Grid/loose table beholder egen pil-navigation som hidtil
   - Fra felter uden for tabel kan vertikal navigation (`ArrowUp`/`ArrowDown`) fokusere første/last relevante tabelcelle over/under
2. **Åbne popup-widgets** (`aria-expanded="true"`)
   - Container intercepter IKKE piletaster
   - Widget/menu ejer intern navigation
3. **Editor åben** (fx input med `readOnly=false`)
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

Container detekterer popup-widgets via ARIA semantik:

```typescript
role="combobox"           // Dropdown-trigger
aria-haspopup="listbox"   // Har popup-menu
aria-expanded="true"      // Menu er åben
aria-controls="id"        // Peger på popup-element
```

Når et popup-widget er **åbent** (aria-expanded="true"):
- Container intercepter IKKE Tab
- Container intercepter IKKE Enter
- Widget får fuld kontrol over sin interne navigation

---

## Cross-cutting kontrakt (for tabeller/subtrees)

Hvis en interaktiv subtree (fx tabel med Excel-navigation) implementerer sin egen traversering:

**KRAV:**
- Subtree SKAL kalde `preventDefault()` + `stopPropagation()` for de taster den ejer
- Ellers kan fokus hoppe dobbelt (både subtree OG Container håndterer tasten)

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

---

## Implementation detaljer (Container.tsx)

### focusOnly()

Eneste fokus-funktion i Container.

```typescript
const focusOnly = (element: FocusableElement) => {
  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
};
```

**Garantier:**
- Kun fokus, **ingen selection**
- Undgår scroll-hop når muligt
- Når målfelt er uden for viewport, scrolles containeren så feltet søges centreret vertikalt
- Ingen deferred logik (requestAnimationFrame, setTimeout)
- Ingen event listeners
- Ingen session tracking

### Fokusbare elementer

Container finder fokusbare elementer via selector:

```
input:not([disabled]):not([tabindex='-1']):not([type="hidden"]):not([type="button"])
select:not([disabled]):not([tabindex='-1'])
textarea:not([disabled]):not([tabindex='-1'])
[role="combobox"][tabindex]:not([tabindex='-1']):not([aria-disabled='true'])
```

Ekskluderer:
- BUTTON tags
- Skjulte elementer (display: none, visibility: hidden)
- Disabled felter
- tabindex="-1" (bevidst ekskluderet fra navigation)

---

## Test-garanti

Container keyboard-navigation testes på to niveauer:

### 1. Automatiske tests (Vitest)

**Placering:** `src/__tests__/components/layout/Container.test.tsx`

**Dækker:**
- Tab flytter fokus fremad (ingen selection)
- Shift+Tab flytter fokus baglæns (ingen selection)
- Enter flytter fokus fremad (ingen selection)
- Enter på dropdown intercepteres IKKE
- Cirkulær navigation fungerer

**Assert:**
```typescript
expect(document.activeElement).toBe(nextElement);
const input = nextElement as HTMLInputElement;
expect(input.selectionStart).toBe(input.selectionEnd); // Ingen selection
```

### 2. Manuel test-tjekliste

**Placering:** `src/contracts/keyboard-navigation-test-checklist.md`

**Dækker:**
- Real-world formularer (Erstatningsopgørelse, Stamdata, etc.)
- Alle felt-typer (text, number, date, dropdown, etc.)
- Edge cases (tomme felter, readOnly, disabled)
- Visuel inspektion (ingen blå markering ved Tab)

---

## Hvad MÅ IKKE ske

Følgende adfærd er **forbudt** og betragtes som fejl:

❌ Tab markerer tekst i et felt
❌ Enter markerer tekst i et felt
❌ Enter overskriver værdi uden brugerens samtykke
❌ Fokus springer uventet (tab dobbelt)
❌ Dropdown åbner utilsigtet ved Tab
❌ Container intercepter museklik
❌ Selection sker ved keyboard-navigation

---

## Fremtidig evolution

Hvis der i fremtiden opstår behov for selection-on-focus:

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
- `src/contracts/keyboard-navigation-test-checklist.md` – Manuel test-guide
- `AGENTS.md` – Overordnede udviklingsprincipper
