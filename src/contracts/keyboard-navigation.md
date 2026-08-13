# Keyboard Navigation Kontrakt

**Status:** Normativ
**Type:** Tværgående kontrakt
**Gælder for:** Hele Mineo applikationen
**Målgrænser:** `Container`, fælles felt-editor og grid-navigation
**Senest verificeret mod kode:** 2026-08-13

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
- Når en side kun har ét fokusbart felt, er mål og udgangspunkt samme element. Container skal da først
  udløse feltets almindelige blur/settle og derefter bevare fokus på feltet; ellers ville den cirkulære
  navigation lade en åben draft stå uafsluttet, fordi browseren ikke har noget andet element at blur'e til.

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

### Escape

**Åben tekst-/talfelt- eller grid-editor:**

- Escape annullerer universelt alt siden editoren blev åbnet.
- Editorens draft forkastes uden command, så feltets uændrede afsluttede starttilstand vises igen.
- Hvis starttilstanden var et afsluttet ugyldigt input, gendannes den ugyldige rå tekst. Feltets canonical slot var
  allerede ryddet til tomværdien ved det ugyldige settle (XOR), så der findes ingen tidligere canonical værdi at vise.
- Det efterfølgende blur må ikke settle den annullerede tekst.
- Beregning, visning og dokumentgate ændres ikke, fordi åben draft aldrig har ændret den afsluttede revision.

**Lukket editor:** Escape ændrer ikke sagsinput.

Popup-/overlay-Escape følger den konkrete widgets lukkeadfærd. Hvis en teksteditor er åben inde i en popup, skal
editorens cancel håndteres før popupen eventuelt lukkes; én Escape-handling må ikke både committe og lukke.

---

### Delete/Backspace

Når et almindeligt formularfelt eller en tabelcelle har fokus, men editoren er lukket, rydder Delete/Backspace feltet
og committer straks uden at åbne editoren. Når editoren er åben, redigerer tasterne kun den åbne draft og committer
først ved den normale settle-grænse.

### Dropdown-typeahead

Når en lukket dropdown har fokus, vælger et enkelt skrivbart tegn straks den **første valgbare option**, hvis viste
tekst begynder med tegnet. Første match afgøres udelukkende af optionernes synlige menurækkefølge — aldrig af
alfabetisk sortering eller af dropdownens aktuelle valg. Gentagne tastetryk med samme bogstav cirkulerer videre
mellem matchene i menurækkefølgen og wrapper til det første. Et andet tegn, blur eller åbning af menuen starter en ny
sekvens. Dividers og deaktiverede options springes over.

I en åben dropdown må gentagne matchende tegn fortsat cirkulere mellem match i den samme menurækkefølge.

---

### Piletaster (uden for tabeller)

**Adfærd når felt har fokus og editor er lukket:**
- `ArrowRight` / `ArrowLeft`: flytter fokus til næste/forrige fokusbare felt i samme række
- Wrap i række: fra sidste → første, fra første → sidste
- `ArrowDown`: flytter fokus til første fokusbare felt i række under
- `ArrowUp`: flytter fokus til sidste fokusbare felt i række over
- Vertikal wrap: fra nederste række → øverste række, fra øverste række → nederste række

**Række-definition:**
- Primært via eksisterende række-containere. Selektoren har ét sted: `CONTAINER_ROW_SELECTOR` i
  `src/components/tables/gridCore/tableFocusHelpers.ts`. En navigationsflade må ikke føre sin egen kopi.
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
   - For Mineos tekstbaserede felter betyder editor åben, at det fokuserede tekstinput er redigerbart (`readOnly=false`) og ikke er en ikke-tekstlig inputtype.
   - Andre komponenter skal eksponere en tilsvarende auditérbar edit-state. Formular- og gridflader
     registrerer den åbne editor eksplicit hos `activeEditorRegistry`
     (`src/inputCore/runtime/activeEditorRegistry.ts`), som `CriticalActionCoordinator` aftager; kritiske
     handlinger må ikke genudlede state gennem DOM-scanning. Håndhævet af
     `criticalAction/no-dom-scan-or-frame-wait`.
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
- En **LUKKET** popup-widget ejer selv sin aktiveringstast (`Enter`): den skal åbne menuen. Hverken Container
  eller en tabels grid-navigation må bruge `Enter` til at flytte fokus, når målet er en lukket popup-kontrol.
- Klassifikationen "er dette en popup-kontrol, og er den åben?" har **ÉT sted**:
  `src/components/inputs/popupWidgetSemantics.ts` med de fire eksporter `getPopupWidgetHost`,
  `isPopupWidgetExpanded`, `isPopupWidget` og `isInClosedPopupWidget`. Modulet måler kontrollens
  ARIA-semantik (`role="combobox"`, `aria-haspopup`, `aria-expanded`, og `aria-controls` kun sammen med
  åben tilstand). Alle navigationsflader — Container OG grid-navigationen — aftager den.
- For en widget, der bærer expanded-tilstanden på en søsker eller wrapper frem for på sig selv, afgøres
  åbenhed af, om det `aria-controls`-udpegede element **faktisk er synligt** (`hidden`, `aria-hidden`,
  `getClientRects()`, `display`/`visibility`). En sådan widget klassificeres altså som åben, selv om den
  ikke selv har `aria-expanded`.
- En navigationsflade må **IKKE** klassificere popup-kontroller på et komponentnavn, en privat
  markør-attribut eller sin egen kopi af ARIA-opslaget. En sådan klassifikation kan blive inert, når
  kontrollen udskiftes, uden at nogen type eller test fejler — det skete konkret. Håndhævet af AST-reglen `input/popup-semantics-single-source`.
- Klassifikationen skal være **den samme på tværs af eventtyper**. En popup-kontrol må ikke behandles som
  popup i keydown-vejen og som en almindelig celle i pointer-/klik-/dobbeltklik-vejen; grid'et fører derfor
  heller ingen to-trins-redigeringsbogføring for den.

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

Løntrin-finder popup (`src/components/pages/erstatningsopgoerelse/shared/LoentrinFinderOverlay.tsx`, anvendt i
både `Lønindkomst` og `EO-oplysninger`) bruger en eksplicit, hardcoded tab-sekvens:

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
- `Indsæt dags dato`, `Find løntrin`, synlige dokumentdownload-knapper og `Vælg mappe` på Indstillinger har
  dette opt-in. De skal kunne fokuseres med Tab og aktiveres med native knapadfærd (`Enter` og mellemrum).
  Skjulte eller native deaktiverede knapper indgår ikke i sekvensen.

---

## Testkrav

Container keyboard-navigation testes på to niveauer:

### 1. Automatiske tests (Vitest)

**Placering:** `src/__tests__/components/layout/Container.test.tsx` og `src/__tests__/components/layout/Container.checklistGaps.test.tsx`

**Skal dække:**
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
- inline action buttons, `Indsæt dags dato`, synlige/skjulte/deaktiverede dokumentdownload-knapper, radiogruppe som ét tabstop, scroll til felt uden for viewport og popup-undtagelser
- Cirkulær navigation fungerer
- Disabled-felter springes over i Tab-/Shift+Tab-rækkefølgen (Container.checklistGaps)
- Container intercepter IKKE museklik; klik giver fokus til det klikkede felt (Container.checklistGaps)
- Den rigtige `StyledDropdown` (readOnly combobox) indgår i Tab-rækkefølgen og åbner på Enter/første klik uden at Container kaprer (Container.checklistGaps)
- Dato- og tekstfelter får fokus uden selection (Container.checklistGaps)

**Escape-adfærden (§Editor åben) dækkes ikke af Container-testene, men af felt-editoren:**
`src/__tests__/inputCore/editor/fieldEditor.test.ts` og
`src/__tests__/inputCore/react/useFieldEditor.test.tsx`

- Escape gendanner editorens starttilstand for både tomt, tidligere gyldigt og tidligere rejected input
- Escape lukker uden command, og et efterfølgende blur settler ikke den annullerede draft

### 2. Residual manuel/visuel kontrol

De automatiske tests dækker al observerbar navigations-adfærd. Tilbage som ren visuel
inspektion (kan ikke verificeres i JSDOM) står kun:

- Finkornet visuel inspektion af "ingen blå markering" pr. felt-type ved Tab: felt-familien i
  `src/inputCore/react/fields/` (`TextField`, `DateField`, `PercentField`, `IntegerField`, `AmountField`)
  samt `StyledDropdown`.
- Fokus-ring-æstetik (klar og tydelig) samt platform-/browser-specifik caret-placering.

Dette udføres ad hoc ved ændringer i `Container.tsx`, i felt-familien eller i præsentationsskallerne
(`StyledTextFieldBase`, `StyledTextAreaBase`). Al observerbar navigations-adfærd er dækket af de
automatiske tests ovenfor; der findes ingen separat checklist-fil.

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

## Selection-on-focus

Container-styret keyboard traversal må aldrig skabe selection. Skal en komponent alligevel have
selection-on-focus, ejes interaktionen af komponenten selv — ikke af Container — og komponenten skal skelne
mellem keyboard-fokus og pointer-fokus og dokumentere sin egen observerbare adfærd.

---

## Feltidentitet i DOM

Feltidentitet i DOM har præcis ét attributnavn: `data-mineo-field-address`. Fokus- og restore-mål bæres af
den sammen med editorlokationen; `data-mineo-field-path` og tilsvarende parallelle stinavne findes ikke og må
ikke genindføres. Håndhævet af `input/single-field-identity-in-dom`,
`input/restore-attributes-carry-destination` og `form/restore-target-attributes`.

---

## Se også

- `src/components/layout/Container.tsx` – Implementation
- `src/__tests__/components/layout/Container.test.tsx` – Automatiske tests
- `src/__tests__/components/layout/Container.checklistGaps.test.tsx` – Automatiske tests (disabled-skip, museklik, StyledDropdown, dato/tekst-selection)
- `AGENTS.md` – kontrakthierarki og no-live-preview regler
