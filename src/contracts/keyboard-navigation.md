# Keyboard Navigation Kontrakt

**Status:** Normativ
**Type:** Tværgående kontrakt
**Gælder for:** Hele Mineo applikationen
**Målgrænser:** `Container`, fælles felt-editor og grid-navigation
**Senest verificeret mod kode:** 2026-08-19 (Renteberegnings «Slet alle indtastninger» er tilføjet
opt-in-listen og målt: knappen bærer `data-mineo-focusable-button`, og Tab-ringen rammer den –
verificeret i browseren og af `standaloneCalculatorPage.test.tsx`. «Slet rækken» står fortsat uden for
navigationen. Baggrund: brugerfundet BB-047)
2026-08-16 (eksterne web-links har fælles link-primitive og er ude af
Tab-rækkefølgen; knappernes opt-in-afgrænsning er målt mod
`CONTAINER_FOCUSABLE_SELECTOR` og erklæret som en truffet beslutning; Escape-reglen og de to
toggle-/checkbox-taster er verificeret mod `StyledDropdown`, `useTransientDraft`,
`LoentrinFinderOverlay`, `StyledToggleSwitch` og `StyledCheckbox` og dækket af
`dropdownFeedbackAndKeys.test.tsx` samt `loentrinFinder.sharedHook.test.tsx`. §Overlay-adfærd er målt i
alle fire browsere af `e2e/overlay-behaviour.spec.ts` – tab-fangst for BEGGE monteringsformer,
tilbage-knappen, og at hver af de tre øvrige lukkeveje forbruger sit historik-trin; `Container`s
overlay-værn er mutationstestet. §«Peg på dette felt»-markeringen er målt af
`e2e/attention-blink-repeat.spec.ts`, som tæller `animationstart`: tre udløsninger giver tre
genstarter, hvor den deklarative form gav én).

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
2026-08-15 opgjorde hvad der står udenfor: de almindelige handlingsknapper
(`FloatingActionButton`: Tilføj, Flyt op, Flyt ned, Slet), «Tilbage til toppen»
(`ScrollToTopButton`), info-ikonet (`InfoTooltipIcon`) og de blå genvejslinks til Stamdata.
En knap uden markøren er fortsat mus-kun.

`PageTabs` og `SideTab` er den eksplicitte undtagelse: de er native tastaturkontroller og bærer
`data-mineo-tab-navigation="true"`, men står stadig uden for Containerens indholds-inventar. På en
fokuseret `PageTabs` kan MUI's piletaster flytte mellem fanerne, og Enter aktiverer den fokuserede
fane. En fokuseret `SideTab` aktiveres med Enter eller mellemrum.

Når fokus først er inde i en sides eller en aktiv fanes indhold, består Containerens inventar kun af
indholdets synlige fokusmål. Tab, Shift+Tab, Enter og piletaster cirkulerer derfor inden for dette
indhold; fra sidste mål fortsættes ved første og omvendt. Ingen af disse taster må føre fokus til en
`PageTabs`- eller `SideTab`-kontrol. Navigationskontrollerne kan kun introduceres ved, at brugeren
allerede har sat fokus på dem gennem browserens almindelige fokusflow eller en anden eksplicit
navigation.

### Web-links (normativ)

Links til eksterne web-sider (`http://`/`https://`) skal bruge `ExternalLink`. De åbner altid i en ny
fane (`target="_blank"` med `rel="noopener noreferrer"`) og har `tabIndex={-1}`, så de ikke indgår i
Tab-rækkefølgen. Links til interne web-sider skal bruge `InternalLink` og bliver i samme fane.

Reglen gælder ikke `mailto:`-links eller programmets interne handlingskontroller, der navigerer med
router/state. Eksisterende specifikke interne keyboard-regler ændres ikke af denne fælles skæring.
Den strukturelle håndhævelse ligger i `a11y/web-link-policy-single-source`.

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

Popup-/overlay-Escape følger §Overlay-adfærd ovenfor: Escape lukker det ØVERSTE overlay. Hvis en
teksteditor er åben inde i en popup, skal editorens cancel håndteres før popupen eventuelt lukkes; én
Escape-handling må ikke både committe og lukke.

**En kontrol må kun SLUGE Escape, når den faktisk annullerer noget.** Reglen ovenfor har en praktisk
konsekvens, som to flader brød: en lukket dropdown kaldte `preventDefault()` + `stopPropagation()` på en
Escape, den ikke havde noget at gøre med, og et transient felt gjorde det samme, selv når draften var
uændret. I begge tilfælde kunne den omgivende dialog eller overlay derfor ikke lukkes med Escape, når
fokus stod i et af dens felter. Kontrollen skal lade tasten passere, når der intet er at annullere, så
den næste ansvarlige flade får den. Tilsvarende må en overlay-lytter i CAPTURE-fasen ikke nå Escape før
felterne inde i overlayet; lukningen hører i boble-fasen.

**En besked, der BLIVER STÅENDE, indtil brugeren fjerner den, skal kunne lukkes med Escape** – og have
en synlig, navngivet lukkeknap. Det gælder `Overlay`s fejlvariant (den røde boks efter et mislykket
Gem/Hent), som aldrig auto-lukker. Uden begge dele var den ren muse-affordance: den dækkede en del af
skærmen, indtil brugeren fandt den med musen, vejledt af museteksten «Klik for at lukke».

Beskeder, der lukker AF SIG SELV (success/info/warning), må derimod **ikke** lytte på Escape. De har
intet at annullere, og en lytter ville stjæle tasten fra en åben dialog eller en igangværende
feltredigering – samme regel som ovenfor, set fra den anden side. Rollerne følger med: en blivende
fejl er `role="alert"` (afbryder og oplyses straks), en selvlukkende besked er `role="status"`.

---

### Delete/Backspace

Når et almindeligt formularfelt eller en tabelcelle har fokus, men editoren er lukket, rydder Delete/Backspace feltet
og committer straks uden at åbne editoren. Når editoren er åben, redigerer tasterne kun den åbne draft og committer
først ved den normale settle-grænse.

For en valg-kontrol gælder det samme skel: Delete/Backspace rydder valget på en **lukket** dropdown (når
feltet må være tomt), mens en **åben** menu ejer tastaturet og hverken rydder eller lukker på ryddetasten
– Escape er vejen ud. Om et felt overhovedet må ryddes, udledes af feltets codec (`requiredChoice` kan
ikke), ikke af en prop på kaldsstedet.

### Enter og mellemrum på toggles og afkrydsningsfelter

En toggle og et afkrydsningsfelt aktiveres af BÅDE Enter og mellemrum, og de forbruger tasten: Enter
flytter altså **ikke** fokus videre fra dem, som den ellers gør (`Enter` ovenfor). Det er en bevidst
fjerde undtagelse ved siden af popup, textarea og radio – uden den ville ét Enter både skifte værdien og
springe til næste felt. Radioknapper følger derimod hovedreglen: Enter aktiverer den fokuserede option
gennem Container, og mellemrum gennem browserens egen radio-semantik.

### Dropdown-typeahead

Når en lukket dropdown har fokus, vælger et enkelt skrivbart tegn straks den **første valgbare option**, hvis viste
tekst begynder med tegnet. Første match afgøres udelukkende af optionernes synlige menurækkefølge – aldrig af
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

## Overlay-adfærd – ÉT regelsæt (normativ)

Alle overlays i programmet deler ét regelsæt for tastatur og lukning. Reglerne er IKKE til fri
afbenyttelse pr. flade: en overlay-komponent må ikke implementere sin egen delmængde.

**Hvad et overlay er:** en modal flade, der dækker siden og kræver et svar – `role="dialog"` eller en
MUI `Dialog`. Toasts og notitser (`role="alert"` / `role="status"`) er IKKE overlays: de fanger ikke
fokus og har ingen backdrop. Popup-widgets (dropdown-`Popover`) er heller ikke overlays; de har deres
eget regelsæt under §Popup-widget detection, og fokus bliver bevidst på comboboxen.

### Tastaturet bliver i vinduet

Så længe et overlay er åbent, ejer overlayet tastaturet. `Tab`/`Shift+Tab` cirkulerer inde i vinduet:
fra sidste element til første og omvendt (brugerbeslutning 2026-08-15). Fokus må aldrig nå siden
bagved.

Fangsten leveres af MUI's `FocusTrap` – gratis i en `Dialog`, eksplicit monteret i et håndrullet
overlay. Skriv ikke en fjerde fokusmekanisme i hånden.

**En fangst er ikke nok i sig selv.** `Container` ejer `Tab` for hele siden, og dens undtagelse er
DOM-indeslutning: en portaleret dialog ligger under `document.body` og slipper igennem, mens et
INLINE monteret overlay er en ægte efterkommer af containeren og derfor IKKE gør. Sidens navigation
overtog dermed `Tab` inde i licensvinduet og kørte forbi trap'ens vagtposter, selv om trap'en var
korrekt monteret – målt i chrome-desktop, hvor otte Tab i træk alle landede uden for dialogen.

Derfor er «er der et overlay åbent?» noget overlayet **siger**, ikke noget der udledes af, hvor
komponenten tilfældigvis er monteret: overlayet sætter `data-mineo-overlay-root="true"` på sin
rod-node, og `Container` giver slip, så længe markøren findes. Monteringsformen må aldrig igen være
det, der afgør adfærden.

### Lukkeveje – alle fire, altid

| Vej | Krav |
|---|---|
| `Escape` | Lukker det ØVERSTE overlay. Et åbent felt inde i overlayet annullerer dog sin egen redigering først (§Escape: én Escape = én handling). |
| Backdrop-klik | Lukker. |
| Luk-/annuller-knap | Lukker. Knappen skal have et tilgængeligt navn. |
| Browserens/musens **tilbage-knap** | Lukker overlayet og bliver på siden (brugerkrav 2026-08-15). |

Tilbage-knappen var ikke understøttet nogen steder: et tryk navigerede SIDEN væk under det åbne
vindue, så brugeren mistede både vinduet og sin plads. Et åbent overlay skubber derfor ét
`history`-trin, som tilbage-knappen forbruger. Lukkes overlayet ad en anden vej, ryddes trinnet op
igen – ellers ville næste tilbage-tryk ramme et dødt trin og se ud, som om knappen ikke virkede.

### Lag på lag

Overlays kan ligge oven på hinanden (fejlrapport-dialogen åbnes fra load-preflightens bekræftelse).
Kun det **øverste** reagerer på `Escape` og på tilbage-knappen; ét tryk lukker ét lag. Rækkefølgen
ejes af overlay-stakken i `components/ui/overlayBehavior.ts`, ikke af den enkelte flade.

### Én implementering

Hele regelsættet aftages gennem `src/hooks/useOverlayBehavior.ts`, som selv bruger
`useDialogFocusRestore` til restoren. Håndhævet af `layout/overlay-uses-shared-behavior`.

**Tab-fangst skal måles i e2e, ikke i JSDOM.** JSDOM implementerer ikke browserens tab-traversering,
så en JSDOM-test kan kun se, at en `FocusTrap` er MONTERET – ikke om den faktisk holder fokus. Præcis
det skete: en grøn JSDOM-test dækkede over, at fokus i alle rigtige browsere vandrede ud af vinduet.
Dækningen ligger i `e2e/overlay-behaviour.spec.ts`.

---

## Popup-fokus-restore (normativ)

Når en popup-flade lukkes, skal fokus vende tilbage til **den kontrol, brugeren åbnede den med**.
Reglen gælder alle lukkeveje uden undtagelse: `Escape`, luk-/annuller-knap, X, backdrop-klik og
lukning efter en gennemført handling. Den gælder uanset om popupen er modal, og uanset om den er
bygget på MUI `Dialog` eller er et håndrullet overlay.

Hver popup har præcis **én** åbnende kontrol, så restore-målet er entydigt og må ikke udledes
heuristisk.

**Målets prioritet** – første brugbare mål vinder:

1. **Den åbnende kontrol**, udpeget eksplicit gennem en ref. Dette er den primære kilde, fordi
   WebKit ikke fokuserer `<button>` ved klik: dér findes der intet `document.activeElement` at
   huske, og en restore, der kun bygger på det, lander på sidens første fokusbare element.
   Samme problem opstår ved kontroller, hvis `onMouseDown` kalder `preventDefault()`.
2. **Det element der havde fokus, da popupen åbnede.** Dækker de flader, der ikke åbnes ved et
   brugerklik – fx en PWA-filåbning eller en load-preflight, der afbryder brugeren midt i et felt.
   Fokus vender da tilbage til det felt, brugeren blev afbrudt i.
3. **Sidens første fokusbare element** – kun ved eksplicit opt-in
   (`allowFirstFocusableFallback`). Forbeholdt popups, hvis bekræftelse kan fjerne selve
   triggeren (fx `Slet ansættelsesforhold`, hvor hele kortet med sletteknappen forsvinder).
   Uden opt-in er fallbacket uønsket: det ville skjule en manglende ref bag et vilkårligt fokusmål.

Fokus må **aldrig** efterlades på `body` eller på et frakoblet element efter en lukning. En popups
eget luk-element (X, annuller) er ikke et gyldigt restore-mål: det forsvinder sammen med popupen.

**Én implementering.** Restoren ejes af `src/hooks/useDialogFocusRestore.ts`. En popup må ikke føre
sin egen restore-vej – hverken et `focus()`-kald i en lukkehandler eller en kopi af
tilstands-bogføringen. Fire forhold gør den naive form utilstrækkelig, og de er alle afdækket i
konkrete browserfejl: WebKits manglende klik-fokus (se ovenfor), at fokus ved `Escape` kan stå på
popupens egen container frem for `body`, at MUI's transition slutter **før** portalen unmountes,
så fokus falder til `body` *efter* en for tidlig genoprettelse, og at **MUI's `Dialog` selv genopretter
fokus** til det element, der var aktivt ved åbningen. Reglen er håndhævet af
`layout/popup-focus-restore-single-source`.

**En MUI-baseret popup skal sætte `disableRestoreFocus`.** MUI's egen genoprettelse kører sidst og
overskriver derfor målet uden at noget fejler. Den kender ikke målprioriteten ovenfor og rammer forkert,
netop når triggeren undertrykker sit eget fokus (`onMouseDown` + `preventDefault()`) – da er et FELT
aktivt ved åbningen, og fokus vender tilbage dertil i stedet for til den åbnende kontrol.

Dette er den farligste af de to fejlformer, fordi INTET ser forkert ud: hooken er kaldt, kontrakten
ser overholdt ud, og den konkurrerende vej er ikke kode i filen – den er MUI's default. Reglen
`layout/popup-focus-restore-single-source` er blind for den, fordi den skærer på `focus()`-kald.
Den lukkes derfor af sin egen regel, `layout/mui-dialog-disables-own-focus-restore`, som flager en
`<Dialog>` uden `disableRestoreFocus` i en fil, der selv aftager `useDialogFocusRestore`. Kravet stod
her i forvejen; tre dialoger overtrådte det alligevel, fordi intet målte det.

**Fokus-FANGST og fokus-RESTORE er to forskellige ansvar.** Restoren (hvor fokus lander EFTER
lukningen) ejes af `useDialogFocusRestore`. Fangsten (at Tab bliver INDE i vinduet, mens det er
åbent) kommer fra MUI's `FocusTrap` – den samme primitiv, `Dialog` selv bruger. En håndrullet popup
arver den ikke automatisk og skal montere den eksplicit; `aria-modal="true"` alene fanger ingenting.
Skriv ikke en tredje fokusmekanisme i hånden.

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
  åben tilstand). Alle navigationsflader – Container OG grid-navigationen – aftager den.
- For en widget, der bærer expanded-tilstanden på en søsker eller wrapper frem for på sig selv, afgøres
  åbenhed af, om det `aria-controls`-udpegede element **faktisk er synligt** (`hidden`, `aria-hidden`,
  `getClientRects()`, `display`/`visibility`). En sådan widget klassificeres altså som åben, selv om den
  ikke selv har `aria-expanded`.
- En navigationsflade må **IKKE** klassificere popup-kontroller på et komponentnavn, en privat
  markør-attribut eller sin egen kopi af ARIA-opslaget. En sådan klassifikation kan blive inert, når
  kontrollen udskiftes, uden at nogen type eller test fejler – det skete konkret. Håndhævet af AST-reglen `input/popup-semantics-single-source`.
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
åbnede overlayet med – ikke «en» af dem. Målet skal derfor være nøglet på ansættelsesforholdets id
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
restore-vej entydig – og `layout/popup-focus-restore-single-source` kan skelne dem fra en parallel vej.
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
- `Indsæt dags dato`, `Find løntrin`, synlige dokumentdownload-knapper, `Vælg mappe` på Indstillinger,
  Renteberegnings `Slet alle indtastninger` samt `MIT-licensen` og `Download hjælpeprogram` på Om-siden
  har dette opt-in. De skal kunne fokuseres med Tab og aktiveres med native knapadfærd
  (`Enter` og mellemrum).
  Skjulte eller native deaktiverede knapper indgår ikke i sekvensen.
- **`Slet alle indtastninger` kom med 2026-08-19 (BB-047).** Knappen stod i en række, der ser ud præcis
  som `Download samlet oversigt` lige over den, men manglede markøren og indgik derfor aldrig i ringen.
  To knapper, der er tegnet ens og står under hinanden, må ikke opføre sig forskelligt over for
  tastaturet. Bemærk at rækkens `Slet rækken`-ikon fortsat bevidst står UDEN for navigationen.
- **Opt-in'et er en forudsætning for `Enter`, ikke kun for Tab.** Uden markøren er knappen ikke i
  fokusinventaret, og `Enter` falder igennem til den generiske «flyt til næste felt»-vej frem for at
  ramme knap-undtagelsen. Mellemrum virker alligevel gennem native knapsemantik, så en manglende
  markør viser sig **kun** på `Enter` – præcis den asymmetri der ramte de to Om-side-knapper.

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
selection-on-focus, ejes interaktionen af komponenten selv – ikke af Container – og komponenten skal skelne
mellem keyboard-fokus og pointer-fokus og dokumentere sin egen observerbare adfærd.

---

## Feltidentitet i DOM

Feltidentitet i DOM har præcis ét attributnavn: `data-mineo-field-address`. Fokus- og restore-mål bæres af
den sammen med editorlokationen; `data-mineo-field-path` og tilsvarende parallelle stinavne findes ikke og må
ikke genindføres. Håndhævet af `input/single-field-identity-in-dom`,
`input/restore-attributes-carry-destination` og `form/restore-target-attributes`.

---

## «Peg på dette felt»-markeringen (normativ)

Når programmet fører brugeren hen til et felt – et fejl-/advarselslink, et blokeret Gem, undo/redo,
en afvist handling der peger på den celle, der mangler – markeres målet visuelt med den delte
blinkmarkering. Markeringen er RENT visuel: den ændrer ingen værdi, sætter ingen feltfejl (§1.7) og
blokerer intet. Den siger «her», ikke «dette er forkert», og bruges derfor både til en ægte fejl og
til en manglende indtastning, der endnu ikke er en fejl.

**Markeringen er TRANSIENT og skal komme igen hver gang.** Udløser brugeren den samme handling to
gange, skal der komme et nyt, synligt svar begge gange – også når målet er præcis det samme felt.
En markering, der kun virker første gang, læses som at programmet ignorerer brugeren.

**Derfor sættes klassen kun af `blinkFieldAttention`** (`inputCore/react/fieldAttentionBlink.ts`),
som ejer genstarten: fjern klassen, tving reflow, sæt den igen. Ingen flade må sætte
blink-klassen deklarativt ud fra React-state. Det er ikke en stilpræference – det er den konkrete
fejlmekanisme: en state-sat klasse skrives med SAMME værdi ved andet forsøg, React bailer ud af
re-renderen, og der sker intet synligt. Ingen test fejler, og fejlen ser ud som om programmet ikke
reagerer. Præcis det skete i løntabellen, hvor en afvist «Omregning til fuldt år» kun blinkede ved
første klik. Håndhævet af `layout/attention-blink-applied-by-helper`.

**Markeringen står ikke ved.** Den løber sin animation (0,5 s × 3) og forsvinder. En flade må ikke
forsøge at gøre den vedvarende ved at holde klassen sat: klassens animation er alligevel spillet af
bagefter, så en «vedvarende» markering er visuelt tom – den koster kun genstarten. Skal en tilstand
være vedvarende synlig, er den en feltfejl eller en advarsel efter `error-contract.md`, ikke en
peg-markering. (Under `prefers-reduced-motion` erstatter CSS'en blinket med en rolig, statisk
tone i markeringens levetid; det er et tilgængelighedshensyn i ét sted, ikke en anden model.)

---

## Se også

- `src/components/layout/Container.tsx` – Implementation
- `src/hooks/useDialogFocusRestore.ts` – Den ene popup-fokus-restore-vej
- `src/__tests__/hooks/useDialogFocusRestore.test.tsx` – Automatiske tests (popup-fokus-restore)
- `src/__tests__/components/layout/Container.test.tsx` – Automatiske tests
- `src/__tests__/components/layout/Container.checklistGaps.test.tsx` – Automatiske tests (disabled-skip, museklik, StyledDropdown, dato/tekst-selection)
- `AGENTS.md` – kontrakthierarki og no-live-preview regler
