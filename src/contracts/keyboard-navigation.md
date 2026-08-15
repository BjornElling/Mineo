# Keyboard Navigation Kontrakt

**Status:** Normativ
**Type:** Tværgående kontrakt
**Gælder for:** Hele Mineo applikationen
**Målgrænser:** `Container`, fælles felt-editor og grid-navigation
**Senest verificeret mod kode:** 2026-08-15 (knappernes opt-in-afgrænsning er målt mod
`CONTAINER_FOCUSABLE_SELECTOR` og erklæret som en truffet beslutning; Escape-reglen og de to
toggle-/checkbox-taster er verificeret mod `StyledDropdown`, `useTransientDraft`,
`LoentrinFinderOverlay`, `StyledToggleSwitch` og `StyledCheckbox` og dækket af
`dropdownFeedbackAndKeys.test.tsx` samt `loentrinFinder.sharedHook.test.tsx`)
2026-08-14

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

**Knapper er OPT-IN, og afgrænsningen er en truffet beslutning.** Container-navigationen medtager kun
knapper, der bærer `data-mineo-focusable-button="true"` (`CONTAINER_FOCUSABLE_SELECTOR` i
`gridCore/tableFocusHelpers.ts`). En knap uden markøren kan derfor kun betjenes med mus. Målingen
2026-08-15 opgjorde hvad der står udenfor: sidernes faner (`PageTabs`, `SideTab`), de fire
ansættelsesforhold-knapper (`FloatingActionButton`: Tilføj, Flyt op, Flyt ned, Slet), «Tilbage til
toppen» (`ScrollToTopButton`), info-ikonet (`InfoTooltipIcon`) og de blå genvejslinks til Stamdata.
Brugeren har 2026-08-15 besluttet, at Tab-rækkefølgen skal forblive **uændret**: de nævnte flader er
bevidst mus-kun, så tastaturturen gennem en side kun rammer indtastningsfelterne. Afgrænsningen er
altså erklæret, ikke et hul — men den skal genforelægges, hvis en handling en dag KUN kan udføres
gennem en af dem.

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

**En kontrol må kun SLUGE Escape, når den faktisk annullerer noget.** Reglen ovenfor har en praktisk
konsekvens, som to flader brød: en lukket dropdown kaldte `preventDefault()` + `stopPropagation()` på en
Escape, den ikke havde noget at gøre med, og et transient felt gjorde det samme, selv når draften var
uændret. I begge tilfælde kunne den omgivende dialog eller overlay derfor ikke lukkes med Escape, når
fokus stod i et af dens felter. Kontrollen skal lade tasten passere, når der intet er at annullere, så
den næste ansvarlige flade får den. Tilsvarende må en overlay-lytter i CAPTURE-fasen ikke nå Escape før
felterne inde i overlayet; lukningen hører i boble-fasen.

---

### Delete/Backspace

Når et almindeligt formularfelt eller en tabelcelle har fokus, men editoren er lukket, rydder Delete/Backspace feltet
og committer straks uden at åbne editoren. Når editoren er åben, redigerer tasterne kun den åbne draft og committer
først ved den normale settle-grænse.

For en valg-kontrol gælder det samme skel: Delete/Backspace rydder valget på en **lukket** dropdown (når
feltet må være tomt), mens en **åben** menu ejer tastaturet og hverken rydder eller lukker på ryddetasten
— Escape er vejen ud. Om et felt overhovedet må ryddes, udledes af feltets codec (`requiredChoice` kan
ikke), ikke af en prop på kaldsstedet.

### Enter og mellemrum på toggles og afkrydsningsfelter

En toggle og et afkrydsningsfelt aktiveres af BÅDE Enter og mellemrum, og de forbruger tasten: Enter
flytter altså **ikke** fokus videre fra dem, som den ellers gør (`Enter` ovenfor). Det er en bevidst
fjerde undtagelse ved siden af popup, textarea og radio — uden den ville ét Enter både skifte værdien og
springe til næste felt. Radioknapper følger derimod hovedreglen: Enter aktiverer den fokuserede option
gennem Container, og mellemrum gennem browserens egen radio-semantik.

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

## Popup-fokus-restore (normativ)

Når en popup-flade lukkes, skal fokus vende tilbage til **den kontrol, brugeren åbnede den med**.
Reglen gælder alle lukkeveje uden undtagelse: `Escape`, luk-/annuller-knap, X, backdrop-klik og
lukning efter en gennemført handling. Den gælder uanset om popupen er modal, og uanset om den er
bygget på MUI `Dialog` eller er et håndrullet overlay.

Hver popup har præcis **én** åbnende kontrol, så restore-målet er entydigt og må ikke udledes
heuristisk.

**Målets prioritet** — første brugbare mål vinder:

1. **Den åbnende kontrol**, udpeget eksplicit gennem en ref. Dette er den primære kilde, fordi
   WebKit ikke fokuserer `<button>` ved klik: dér findes der intet `document.activeElement` at
   huske, og en restore, der kun bygger på det, lander på sidens første fokusbare element.
   Samme problem opstår ved kontroller, hvis `onMouseDown` kalder `preventDefault()`.
2. **Det element der havde fokus, da popupen åbnede.** Dækker de flader, der ikke åbnes ved et
   brugerklik — fx en PWA-filåbning eller en load-preflight, der afbryder brugeren midt i et felt.
   Fokus vender da tilbage til det felt, brugeren blev afbrudt i.
3. **Sidens første fokusbare element** — kun ved eksplicit opt-in
   (`allowFirstFocusableFallback`). Forbeholdt popups, hvis bekræftelse kan fjerne selve
   triggeren (fx `Slet ansættelsesforhold`, hvor hele kortet med sletteknappen forsvinder).
   Uden opt-in er fallbacket uønsket: det ville skjule en manglende ref bag et vilkårligt fokusmål.

Fokus må **aldrig** efterlades på `body` eller på et frakoblet element efter en lukning. En popups
eget luk-element (X, annuller) er ikke et gyldigt restore-mål: det forsvinder sammen med popupen.

**Én implementering.** Restoren ejes af `src/hooks/useDialogFocusRestore.ts`. En popup må ikke føre
sin egen restore-vej — hverken et `focus()`-kald i en lukkehandler eller en kopi af
tilstands-bogføringen. Fire forhold gør den naive form utilstrækkelig, og de er alle afdækket i
konkrete browserfejl: WebKits manglende klik-fokus (se ovenfor), at fokus ved `Escape` kan stå på
popupens egen container frem for `body`, at MUI's transition slutter **før** portalen unmountes,
så fokus falder til `body` *efter* en for tidlig genoprettelse, og at **MUI's `Dialog` selv genopretter
fokus** til det element, der var aktivt ved åbningen. Reglen er håndhævet af
`layout/popup-focus-restore-single-source`.

**En MUI-baseret popup skal sætte `disableRestoreFocus`.** MUI's egen genoprettelse kører sidst og
overskriver derfor målet uden at noget fejler. Den kender ikke målprioriteten ovenfor og rammer forkert,
netop når triggeren undertrykker sit eget fokus (`onMouseDown` + `preventDefault()`) — da er et FELT
aktivt ved åbningen, og fokus vender tilbage dertil i stedet for til den åbnende kontrol.

**Triggerens tastaturtilgængelighed.** En popup-åbnende kontrol skal som udgangspunkt kunne
fokuseres med `Tab` og aktiveres med både `Enter` og mellemrum gennem native knapsemantik
(jf. §Implementeringsfrihed). Bevidst undtagelse: `Rapportér fejl eller forbedringsønske` på hver
`ContentBox` står uden for tab-sekvensen (`tabIndex={-1}`), fordi den ellers ville lægge ét ekstra
tabstop på hver indholdsboks på hver side. Den er en ren muse-affordance, men er fortsat omfattet
af fokus-restore-reglen ovenfor: `tabIndex={-1}` udelukker kun tab-navigation, ikke programmatisk
fokus.

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

Overlayet er omfattet af §Popup-fokus-restore: `Escape`, X og backdrop-klik returnerer alle fokus
til `Find løntrin`-knappen, der åbnede det.

`Lønindkomst` har **én knap pr. ansættelsesforhold**, og restore-målet er den knap, brugeren faktisk
åbnede overlayet med — ikke «en» af dem. Målet skal derfor være nøglet på ansættelsesforholdets id
(`useLoentrinFinder.registerTrigger`). Én ref delt mellem kortene opfylder ikke reglen: React efterlader
den på det sidst monterede kort, så fokus vender tilbage til det nederste korts knap.

Løntrin-finder popup (`src/components/pages/erstatningsopgoerelse/shared/LoentrinFinderOverlay.tsx`, anvendt i
både `Lønindkomst` og `EO-oplysninger`) bruger en eksplicit, hardcoded tab-sekvens:

`Ansættelse -> Beløb -> Dato -> Beregn`

Dette er bevidst og normativt for den popup, fordi generisk focus-trap tidligere gav ustabil adfærd med dropdown-popover og fokuslæk til siden bagved.

Krav:
- `Tab`/`Shift+Tab` skal altid cirkulere inden for popup-sekvensen.
- `Escape` lukker popup og returnerer fokus til `Find løntrin` (§Popup-fokus-restore).
- `Enter` på åbne dropdowns håndteres af dropdown selv.
- `ArrowUp`/`ArrowDown` må kun overtage intern popup-navigation, når dropdown-menu ikke er åben og editor ikke er åben.

Overlayets interne focus-trap ejes af overlay-komponenten selv. `Container` må kun undlade at interferere med popup/portal-subtrees. Overlayet er ansvarligt for at stoppe fokuslæk til siden bagved.

Overlayet ejer **al** fokusadfærd: både tastaturnavigationen inde i popupen (tab-sekvens, `Escape`,
piletaster) og restoren ved lukning gennem `useDialogFocusRestore`. `useLoentrinFinder` ejer state og
beregning og leverer kun restore-MÅLET (`triggerRef`), fordi målet er en knap uden for overlayet.

Delingen er ikke vilkårlig: samles restoren og navigationens `focus()`-kald i samme fil, er filens ene
restore-vej entydig — og `layout/popup-focus-restore-single-source` kan skelne dem fra en parallel vej.
Lægges restoren i hooken i stedet, står overlayets lovlige navigations-`focus()`-kald tilbage i en
popup-fil uden den fælles hook, hvilket værnet med rette flager. De to flader deler den ene hook og det
ene overlay; en flade må ikke føre sin egen kopi af nogen af delene.

---

## Implementeringsfrihed

Kontrakten fastlægger den observerbare adfærd, ikke den præcise interne mekanisme.

Det betyder:

- Der må gerne refaktoreres i `Container.tsx`, så længe adfærden ovenfor bevares.
- CSS-selectors, fokus-hjælpefunktioner og konkrete `focus(...)`-kald er implementeringsdetaljer.
- Hvilke elementer der indgår i tab-sekvensen, skal fortsat være eksplicit og auditérbart defineret, men ikke nødvendigvis via den samme selector-strategi som i dag.
- Sideintegrerede handlingsknapper må kun indgå i den normale feltsekvens ved eksplicit opt-in.
- `Indsæt dags dato`, `Find løntrin`, synlige dokumentdownload-knapper, `Vælg mappe` på Indstillinger
  samt `MIT-licensen` og `Download hjælpeprogram` på Om-siden har dette opt-in. De skal kunne fokuseres
  med Tab og aktiveres med native knapadfærd (`Enter` og mellemrum).
  Skjulte eller native deaktiverede knapper indgår ikke i sekvensen.
- **Opt-in'et er en forudsætning for `Enter`, ikke kun for Tab.** Uden markøren er knappen ikke i
  fokusinventaret, og `Enter` falder igennem til den generiske «flyt til næste felt»-vej frem for at
  ramme knap-undtagelsen. Mellemrum virker alligevel gennem native knapsemantik, så en manglende
  markør viser sig **kun** på `Enter` — præcis den asymmetri der ramte de to Om-side-knapper.

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

**Popup-fokus-restore (§Popup-fokus-restore)** dækkes af:
`src/__tests__/hooks/useDialogFocusRestore.test.tsx` (restore til trigger, WebKit-formen hvor
klikket ikke efterlod triggeren fokuseret, aldrig `body` efter lukning, opt-in-fallback når
triggeren blev fjernet, og at restoren holder sig væk når en anden kontrol med rette har fokus),
`src/__tests__/components/ui/ConfirmationDialog.test.tsx`,
`src/__tests__/components/ui/LicenseModal.test.tsx` og
`src/__tests__/components/pages/erstatningsopgoerelse/loentrinFinderTrigger.keyboard.test.tsx`
(Escape fra Løntrin-finder returnerer fokus til `Find løntrin`).
Enkeltkilde-grænsen er håndhævet af `layout/popup-focus-restore-single-source`.

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
- `src/hooks/useDialogFocusRestore.ts` – Den ene popup-fokus-restore-vej
- `src/__tests__/hooks/useDialogFocusRestore.test.tsx` – Automatiske tests (popup-fokus-restore)
- `src/__tests__/components/layout/Container.test.tsx` – Automatiske tests
- `src/__tests__/components/layout/Container.checklistGaps.test.tsx` – Automatiske tests (disabled-skip, museklik, StyledDropdown, dato/tekst-selection)
- `AGENTS.md` – kontrakthierarki og no-live-preview regler
