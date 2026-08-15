# Plan: automatisk UI-skalering + kompakt sidemenu

Status: **PLANLAGT** 2026-08-14. Brugerbeslutning foreligger: kompakt sidemenu **+** automatisk mild
nedzoom, ingen manuel zoom-indstilling, rullebjælke i menuen udelukkende som gulv.

---

## 1. Problemet

Ved 1536×864 skærmopløsning (= 1920×1080 ved 125 % Windows-skalering) er Mineo-shellen for stor til
vinduet i **begge** retninger. Brugeren skifter mellem browser-fane og installeret PWA-vindue, så der
skal dimensioneres efter det snævreste tilfælde.

### 1.1 Højden — menuens bund er uopnåelig

Sidemenuen er `height: '100vh'` med `overflow: 'hidden'` og **ingen** scroll nogen steder
(`SideMenu.tsx:141-150`). Alt over viewporthøjden klippes lydløst væk. Indholdet kræver:

| Blok | Regnestykke | Højde |
|---|---|---|
| Hamburger-blok | `py: 1` × 2 + 44 + `mb: 0.5` | 64 |
| Divider | | 1 |
| Hovednavigation | `py: 1` × 2 + 8 × (44 + 4) | 400 |
| Divider + `my: 1` | | 17 |
| Filoperationer | `py: 1` × 2 + 3 × (44 + 4) | 160 |
| Divider + `my: 1` | | 17 |
| Utilities | `py: 1` × 2 + 2 × (44 + 4) | 112 |
| **I alt** | | **≈ 771 px** |

Brugerens reelle **indre** viewport i en browser-fane er ca. **740–776 px** (skærmens 864 minus fanelinje
~40, adresselinje ~47, evt. bogmærkelinje ~34 og proceslinje ~38 CSS-px). Derfor forsvinder
`Indstillinger` og `Om` uden nogen måde at nå dem.

### 1.2 Bredden — permanent vandret rullebjælke

`.content-box` er `width: var(--content-box-max-width)` = **1200 px fast**, ikke `max-width`
(`layout.css:15,108-116`); `PageTabs.tsx:53` ligeså. Behovet:

251 (menu + 1 px border) + 48 (`Container`s `padding: 3`) + 50 (`<main>` `paddingLeft`) + 1200
+ ~15 (lodret rullebjælke) = **≈ 1564 px** mod 1536 tilgængelige.

**Underskuddet er kun ~28 px.** Det er afgørende for hele designet: der skal ikke meget til.

### 1.3 Hvorfor værnet ikke fanger fejlen

`e2e/minimum-viewport-shell.spec.ts` kører ved Playwright-viewport 1536×864 og asserter eksplicit at alle
14 knapper ligger inden i menuens rect (linje 93-99). Men Playwrights `viewport` er det **indre**
område, og kommentaren i `playwright.config.ts:7-9` sætter fejlagtigt hele *skærmen* lig med *sidens*
område. Ved 864 passer menuens 771 px → testen er grøn, mens virkeligheden ved ~740 klipper.
**Diagnosen er altså en fejl i testens præmis, ikke i dens assertion.** Assertionen er den rigtige; den
måler blot på et viewport ingen bruger har.

---

## 2. Retning

### 2.1 Hvorfor skalering og ikke reflow

Mineo er bevidst desktop-only med et hard gate (`bootstrapClientApp.tsx:21,64,77` →
`UnsupportedDevicePage`), og `shell/viewport-responsive-styling-allowlist`
(`src/__tests__/quality/architecture/rules/responsiveStylingRules.ts`) gør harnesset rødt ved
bredde-media-queries og MUI-breakpoints uden for en pinnet allowlist. Det er dokumenteret i
`src/contracts/app-shell-contract.md` §5.3 og `AGENTS.md:143`.

Det er den rigtige grænse, og planen respekterer den. **Uniform skalering er ikke responsivt reflow:**
intet ombrydes, intet flytter sig, intet skjules — det samme layout gengives blot i en anden målestok.
Løsningen skal derfor navngive den kategori i kontrakten frem for at snige sig ind under den.

Bemærk at reglens regex kun dækker `(max|min)-width`, så en `@media (max-height:)` ville smutte
igennem. **Det hul skal ikke bruges.** Det er en stiltiende omgåelse af en dokumenteret grænse, og
planens JS-beregnede faktor kræver alligevel ingen media query — et selvstændigt argument for JS frem
for CSS. Hullet lukkes aktivt i §4 trin 7.

### 2.2 De to lag, og hvorfor rækkefølgen betyder noget

**Lag 1: kompakt sidemenu** fjerner højdekravet gratis (771 → ~583 px) via CSS-variabler under en
rod-attribut. Ingen risiko, ingen kontraktændring.

**Lag 2: automatisk nedzoom** behøver derefter kun dække de ~28 px i bredden. Faktoren lander på
**0.95** i stedet for **0.90**:

| | Højdebehov | z ved 730 px | Breddebehov | z ved 1536 px | Valgt trin |
|---|---|---|---|---|---|
| I dag | 771 | 0.947 | 1564 | 0.982 | **0.90** |
| Med kompakt menu | 583 | > 1 | 1564 | 0.982 | **0.95** |

Alle ulemper ved zoom — subpixel-drift, uskarpe 1 px-rammer, størrelsesforskellen på popups — vokser
med afstanden fra 1. At flytte faktoren fra 0.90 til 0.95 halverer dem. **Derfor er lag 1 ikke bare et
supplement; det er det der gør lag 2 harmløst.**

### 2.3 Kernebeslutning: `zoom`, ikke `transform: scale`, og ikke på `html`

Tre målte fakta styrer designet.

**a) `zoom` skalerer `<length>`, men ikke procenter og ikke `auto`.** Målt i repoets egen Chromium
(152.0.7977.8, `deviceScaleFactor: 1.25`, viewport 1536×800) under `zoom: 0.875`:

| Konstruktion | Visuel størrelse | |
|---|---|---|
| `height: 100vh` | 700 px | ❌ krymper — 100 px tomt felt |
| `height: 100dvh` | 700 px | ❌ `dvh` løser **intet** |
| `height: 100%` i en definit kæde | 800 px | ✅ fylder forælderen |

Normativt: *"the used value of a CSS property is pre-multiplied … by the used value of zoom"* og *"The
zoom property has no effect on `<length>` property values with computed values that are auto or
`<percentage>`"* (css-viewport-1 §zoom). Specen siger reelt intet om `vh` under zoom — der står et
åbent issue om netop det — så tabellen er **målt, ikke udledt**. Konsekvens: **enhver
viewport-enhed inde i det zoomede subtræ skal blive procent.**

**b) `transform: scale` er udelukket.** Det gør elementet til containing block for alle
efterkommende `position: fixed` og efterlader layoutet i fuld størrelse med tomt felt til højre og
nederst. `zoom` gør ingen af de ting — målt: `inset: 0` dækkede fuldt viewport også under zoom.
Mineos fixed-overlays bruger allerede procenter (`LicenseModal.tsx:65-87`,
`LoentrinFinderOverlay.tsx:251-272`) og forbliver derfor korrekte. Af samme grund er
`useFocusableInventory.ts:61-80`s `offsetParent`- og `position: fixed`-særgren upåvirket af `zoom`,
mens den **ville** være brudt under `transform`.

**c) `zoom` må ikke ligge på `html`/`body`.** MUI's `Popover` blander koordinatsystemer
(`node_modules/@mui/material/Popover/Popover.js:150,172`):

```js
const anchorRect = anchorElement.getBoundingClientRect();  // VISUELLE px
return { top: anchorRect.top + …, left: anchorRect.left + … };
const elemRect = { width: element.offsetWidth, … };        // LOGISKE px
```

Resultatet sættes som inline-px på en Paper, der ville ligge i det zoomede `body`. Målt reproduktion
af netop den algoritme ved `zoom: 0.8`: anker på `left: 480, bottom: 355.2` gav popover på
`left: 384, top: 284.1` — forkert med præcis faktoren. **Alle dropdowns, `Select`, datepickere og
menuer ville sidde markant forkert**, og der er ingen ren udvej: portalen kan ikke lægges uden for
`html`, og `container`-prop'en hjælper ikke, fordi fejlen ligger i de beregnede koordinater.

Ligger zoom derimod *under* portal-roden, er ankerets rect ægte skærmkoordinater, Paper'en placeres i
uzoomet rum med netop de koordinater, og `containerWindow.innerHeight`-clampingen i Popover regner i
samme rum → **korrekt placering**. `@popperjs/core` 2.11.8 (bag `Tooltip`/`Popper`) har desuden egen
skala-detektion (`popper.js:76`: `scaleX = round(clientRect.width) / element.offsetWidth`), men det
er uden betydning når portalen er uzoomet.

Prisen er kosmetisk: popups gengives i 100 % mod et 95 %-skaleret UI. Det er den bevidste pris mod et
funktionelt brud — og ved 0.95 er den praktisk taget usynlig.

### 2.4 Zoom hører på MainLayouts rod, ikke på `#root`

`#root` er **delt** mellem Mineo og standalone MinProcesrente (`bootstrapClientApp.tsx:58-63`
bootstrapper begge apps til samme element), og MinProcesrente er bevidst responsiv med rigtige
breakpoints (`MinProcesrenteCalculatorPage.tsx:52,128,131`, `minprocesrente.css`). Zoom på `#root`
ville derfor ramme en app der ikke skal skaleres, og hvis media queries matcher mod **visuelle** px
mens layoutet lever i **logiske** px → forkert breakpoint-adfærd.

Zoom lægges derfor på `MainLayout`s ydre `Box` (`MainLayout.tsx:208`). Det er Mineo-shellens egen rod,
ligger uden for standalone og uden for `LoginPage`, og ligger stadig langt under `document.body` hvor
MUI portalerer — så §2.3 c) holder. `--mineo-ui-scale` sættes fortsat på `<html>` i head-scriptet
(harmløst, det er kun en variabel), så værdien er klar før React monterer og der intet synligt hop
opstår; kun Mineo-shellen forbruger den.

### 2.5 Automatisk, ikke fast, og ikke en indstilling

- **En brugerindstilling er logisk umulig som primær løsning:** `Indstillinger` er én af de to
  uopnåelige knapper. Kuren kan ikke ligge bag den blokerede dør. (Brugeren har desuden valgt
  automatisk-kun; en override kan tilføjes senere *oven på* auto, aldrig som fundament.)
- **Fast nedskalering** straffer 1920- og 2560-brugere med et mindre UI uden grund.
- **Automatisk med kvantisering til en fast stige** giver forudsigelighed, ingen jitter under resize,
  ingen persisteret tilstand — og en ren, enhedstestbar funktion.

Fordi faktoren er en ren funktion af vinduet, kræves **ingen** ny persisteret indstilling: ingen
`appSettings`-udvidelse, ingen schema-ændring, intet `PERSISTED_DATA_VERSION`-bump, ingen migrator.

### 2.6 Forkastede alternativer

| Alternativ | Hvorfor forkastet |
|---|---|
| `html { font-size: 87.5% }` + rem | **Skalerer praktisk taget intet.** Kun 2 reelle rem-forekomster i hele `src` (`SideMenu.tsx:174`, `SideTab.tsx:47`). Typografivariabler (`typography.css:19-25`), layoutvariabler (`layout.css:5-19`) og `appTheme.ts` er px, og MUI `spacing` er 8 px. Ville give inkonsistent typografi uden at løse noget. |
| Alle px-variabler → `calc(… * var(--scale))` | Ville være «ægte» skalering uden zoom-problemer, men px sidder spredt i `sx`-props over hundredvis af komponenter, ikke kun i variablerne. Præcis den «alt for store omlægning» brugeren har afvist. |
| `.content-box` → `max-width` | Boksen ville krympe, men indholdet indeni overflower stadig: tabeller på 1130/1200 px (`EetAslAfgoerelserTable.tsx:248`, `PageTabs.tsx:53`) og `--label-width-wide: 700px`. Delvis hjælp, ikke en løsning. |
| Kun rullebjælke i menuen | Punkter man ikke kan se, opdager man ikke — stort set det symptom brugeren klager over. Bryder desuden to eksplicitte kontraktpåstande. Beholdes derfor kun som gulv (trin 8). |
| `webFrame.setZoomFactor` (ægte page zoom) | Den *rigtige* løsning, men kræver Electron. Der er ingen electron/tauri/capacitor i `package.json`. **Nul-risiko-baseline i dag:** Chromes egen Ctrl + − til 90 % gør præcis dette, med korrekt `vh`-opløsning og korrekt popup-placering. §4 er en efterligning af den mekanisme inde i siden. |

---

## 3. Den tekniske kerne: to koordinatsystemer

Målt under `zoom: 0.875`:

```
clientHeight / offsetHeight / offsetWidth / scrollHeight / scrollTop / offsetTop → LOGISKE px  (914, 1755)
getBoundingClientRect()                                                          → VISUELLE px (800, 1536)
window.innerHeight / innerWidth                                                  → VISUELLE px (800, 1536)
matchMedia('(max-width: 1550px)')                                    → matcher 1536, ikke 1755
```

**Enhver sum af en rect-afledt værdi og en scroll-metrik er forkert med faktoren.** Det er den ene
fejlklasse hele §4 trin 3 handler om, og den er nu kvantificeret, ikke gættet.

Selvkalibrerende helper — engine-agnostisk med vilje, samme teknik som Popper bruger, så den også
virker hvis Firefox eller WebKit deler op anderledes end Blink:

```ts
// src/utils/getEffectiveZoom.ts
/** 1 ved zoom 1 og i jsdom (offsetWidth = 0 → fallback 1); ellers den faktiske visuelle faktor. */
export const getEffectiveZoom = (el: HTMLElement): number => {
  const w = el.offsetWidth;
  if (!w) return 1;
  const scale = el.getBoundingClientRect().width / w;
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
};
```

**Feedback-loop-reglen (vigtigst i hele planen):** faktoren må **udelukkende** beregnes fra
`window.innerWidth`/`innerHeight`, som er zoom-uafhængige visuelle mål. Beregnes den fra målt indhold
eller fra `documentElement.clientWidth`, opstår en oscillation: at sætte zoom ændrer layoutet, hvilket
kan tilføje eller fjerne en rullebjælke, hvilket ændrer det målte rum, hvilket ændrer faktoren.
Rullebjælkens bredde indgår som en **konstant** i behovstallet, aldrig som en måling.

---

## 4. Implementering

### Trin 0 — Mål det faktiske indre viewport
Kør `innerWidth` / `innerHeight` / `devicePixelRatio` i konsollen på brugerens maskine i **både**
browser-fane og installeret PWA. Alle konstanter i trin 5 kalibreres mod det snævreste af de to tal.
Bekræft samtidig den beregnede menuhøjde på 771 px mod virkeligheden. **De 740–776 px i §1.1 er
inferens fra typiske Chrome-chrome-højder, ikke en måling** — derfor er dette trin først.

### Trin 1 — Rød test der reproducerer fejlen
- Ret den fejlagtige kommentar i `playwright.config.ts:7-9`: 1536×864 er et *indre* viewport, ikke en
  skærmstørrelse.
- Tilføj et **nyt** viewport-projekt med realistisk indre højde (fx `1536×730`, kalibreret efter trin 0).
- Gør `minimum-viewport-shell.spec.ts:87-88` viewport-relativ i stedet for hårdkodet ≥ 864, så begge
  projekter deler samme test. Assertionen på linje 93-99 skal være **rød** under det nye projekt før
  trin 2 — ellers er diagnosen forkert og resten af planen skal genbesøges.

### Trin 2 — Kompakt sidemenu
Nye variabler ved de øvrige layoutvariabler i `layout.css:4-19`:

```css
:root {
  --menu-button-height: 44px;
  --menu-button-gap: 4px;
  --menu-group-padding-y: 8px;
}
:root[data-mineo-density='compact'] {
  --menu-button-height: 36px;
  --menu-button-gap: 2px;
  --menu-group-padding-y: 4px;
}
```

`SideMenu.tsx` bytter de fire hardkodede `height: '44px'` (linje 170, 223, 272, 320), `mb: 0.5` og
gruppernes `py: 1` ud med `var(...)`. Attributten `data-mineo-density` sættes af samme ejer-modul som
trin 5 og følger det etablerede mønster fra `data-mineo-theme` (`themeBootstrap.ts:30-34`) og
`data-mineo-font-style-colors` (`typography.css:107`).

Kompakt regnestykke: 46 + 1 + 312 + 9 + 122 + 9 + 84 ≈ **583 px** — passer i 730 med ~145 px luft.

Efterse `.menu-item`-reglerne (`typography.css:259-293`) for padding eller `line-height` der kolliderer
med den lavere knaphøjde. Ikonerne er 24 px, så 36 px giver 6 px luft over og under.

Denne ændring gør e2e-testen **grønnere**, ikke rødere: der indføres ingen scroll-region, og alle
knapper falder inden for menuens rect. Ingen kontraktændring.

### Trin 3 — Normalisér geometrien, før zoom tændes
Begge rettelser er rene no-ops ved faktor 1 og kan derfor landes og verificeres uafhængigt af trin 5.

**`src/utils/scrollTargetIntoView.ts`** — den globale scroll-til-mål-ejer (undo/redo-fokus,
tab-navigation, fejl-links i EO-beregning, tabelvalidering). Ét brud rammer bredt.
- Linje 88-89: `elementCenterY` er rect-afledt (visuel) og lægges til `container.scrollTop` minus
  `container.clientHeight / 2` (logiske) → **divider rect-deltaet med faktoren**.
- Linje 94-98: `elementRect.left − containerRect.left` er visuel mod logisk `scrollLeft`/`scrollWidth`
  → samme normalisering. `HORIZONTAL_VIEWPORT_PADDING = 24` forbliver logisk og skal **ikke** røres.
- `isVerticallyWithin` (linje 51-53) sammenligner rect mod rect og er **zoom-invariant — lad den stå.**

**`src/components/tables/VirtualizedDisplayTable.tsx`**, `scrollMode: 'ancestor'`.
- Linje 115: `hostRect.top − tableRect.top` (visuel) bruges mod prop'en `rowHeight` (logisk, 28 i
  `EOKontrolTabel.tsx:370-377`) og `viewportHeight = hostEl.clientHeight` (logisk) → **divider**.
- Linje 122-124: samme, plus `window.innerHeight` (visuel).
- Uden rettelsen: forkert `startIndex` → tomme eller forskudte rækker under scroll. Komponenten har
  `ResizeObserver` + `window.resize`-lyttere, så den selvretter **ikke** ved en zoom-ændring.

**Forventet uændret — verificér, men regn med grønt:** `focusRowGeometry.ts:25` og
`tableKeyboardNavigation.ts:150-209` sammenligner rect mod rect, så både 8 px-tolerancen og
rækkeafstanden skalerer proportionalt (8 visuelle ≈ 8,4 logiske ved 0.95, mod ~40 px rækkeafstand).

### Trin 4 — Viewport-enheder → procent inde i shellen
Skal være **pixel-identisk** med i dag; verificér det, før zoom tændes i trin 5.
- `MainLayout.tsx:208`, `SideMenu.tsx:143`, `Container.tsx:82`: `height: '100vh'` → `'100%'`.
- `index.css`: `#root { height: 100vh }` kan **blive** — `#root` ligger uden for det zoomede subtræ, så
  `100vh` er upåvirket der, og den giver netop den definite højde `100%`-kæden har brug for.
- `LoginPage.tsx:50` ligger uden for shellen; efterse men forvent uændret. Standalone
  MinProcesrente (`minprocesrente.css:8-9,33`, `StandaloneCalculatorLayout.tsx:18`) skal **ikke** ændres.
- `maxHeight: '80vh'` / `'85vh'` i `LicenseModal.tsx` og `LoentrinFinderOverlay.tsx` → procent. De to
  overlays er `position: fixed` inde i shellen og skaleres derfor med; en `vh`-højde ville ikke matche.

### Trin 5 — Automatisk zoom-faktor
**`src/settings/uiScale.ts` (ny)** — ren, enhedstestbar funktion:

```ts
export const UI_SCALE_STEPS = [1, 0.95, 0.9, 0.85] as const;   // MIN_SCALE = 0.85, se §5 edge case 8
export const DESIGN_MIN_WIDTH = 1564;   // 251 menu + 48 padding + 50 main + 1200 content-box + 15 scrollbar
export const DESIGN_MIN_HEIGHT = 620;   // 583 kompakt menu + luft
export const SCALE_STEP_HYSTERESIS_PX = 24;

export const resolveUiScale = (viewport: { innerWidth: number; innerHeight: number },
                               currentScale?: number): number => { /* … */ };
```

Vælg det **største** trin hvor både bredde- og højdekravet passer i `innerWidth / z` og
`innerHeight / z`. Kvantiseringen — ikke en kontinuert faktor — er det der giver forudsigelighed og
ingen jitter under resize. Konstanterne bærer deres regnestykke i en kommentar, så en fremtidig
ændring af `--content-box-max-width` kan spores hertil.

**`src/settings/themeBootstrap.ts`** — udvid det synkrone head-script, så `--mineo-ui-scale` og
`data-mineo-density` sættes på `<html>` **før første paint**, præcis som `data-mineo-theme` på linje
30-34. Scriptet har allerede `window.innerWidth`/`innerHeight` til rådighed i `<head>`. Uden dette ser
brugeren et synligt hop ved hver opstart.

**`src/settings/useUiScale.ts` (ny)** — rAF-debounced `resize`-listener der opdaterer variablen;
monteres i `MainLayout`.

**`MainLayout.tsx:208`** — `zoom: 'var(--mineo-ui-scale, 1)'` på den ydre `Box` (se §2.4).
**Ingen `transition` på `zoom`** — en animeret zoom giver hakkende resize.

Den JS-beregnede faktor kræver ingen media query, så `shell/viewport-responsive-styling-allowlist`
rammes slet ikke.

### Trin 6 — Verificér i alle fire engines
Manuelt i chrome, edge, firefox og webkit ved både 1536×730 og 1920×1080: dropdown-, `Select`- og
datepicker-placering (`StyledDropdown.tsx:616,753`), `Tooltip`-placering (sidemenuens
`placement="right"` og `StyledDropdown.tsx:179`), `ConfirmationDialog`, `Overlay`-toast, `LicenseModal`,
`LoentrinFinderOverlay`, `DevtoolsIssueNotice`, `ScrollToTopButton`, samt `EOKontrolTabel`s
virtualiserede scroll og sticky header.

### Trin 7 — Værn og kontrakt
- `src/contracts/app-shell-contract.md` §5.3 (linje 127-142): navngiv **uniform skalering** som egen
  tilladt kategori, klart adskilt fra responsivt reflow, som stadig er forbudt. Beskriv hvorfor
  (§2.1). Opdatér `AGENTS.md:143` og kommentaren i `layout.css:349-350` tilsvarende.
- **Luk `max-height`-hullet** i `responsiveStylingRules.ts:79-87` aktivt, så reglen dækker begge akser.
- Ny regel i det eksisterende AST-manifest (`src/__tests__/quality/architecture/`): `100vh`/`100vw`
  forbudt i shell-filerne, med `liveTarget` som de øvrige 32 regler. Mutationstest den i tre trin efter
  husets guard-selvtest-princip: fixtures → levende kilde → konkurrerende mekanisme. Reglen skal kunne
  **fejle**, og den skal bevise at målet stadig findes.

### Trin 8 — Rullebjælke som gulv (kun hvis nødvendigt)
Hvis `resolveUiScale` rammer `MIN_SCALE`, sæt `overflowY: 'auto'`, `overflowX: 'hidden'`,
`flex: 1`, `minHeight: 0` på et nyt wrapper-`Box` omkring grupperne (`SideMenu.tsx:192-333`) — **ikke**
på hele menuen, hvilket ville scrolle hamburgeren væk. Så længe gulvet ikke rammes ved noget testet
viewport, forbliver `internalScrollRegions === []` og `menu.scrollHeight === menu.clientHeight` sande,
og `minimum-viewport-shell.spec.ts:90-91` kan stå uændret. Rammes det, skal begge kontraktpåstande
omskrives — ikke blot testen. Brug `scrollbar-width: thin` i den kollapsede 70 px-tilstand.

---

## 5. Kritiske edge cases

1. **Menutilstand må ikke ændre zoom.** Menuen skifter mellem 250 og 70 px (`transition: width 0.3s`).
   Beregnes faktoren af det aktuelle bredde-behov, ville en sammenklapning frigøre 180 px og hæve
   zoomen — brugeren ville se menuen animere **og** hele UI'et skifte størrelse samtidig. **Beslutning:
   `DESIGN_MIN_WIDTH` regner altid med udfoldet menu (250 px), så faktoren er stabil på tværs af
   menutilstand.** Zoom må kun reagere på `resize`, aldrig på menuskift.

2. **Feedback-loop ved resize.** Se §3's regel. Overtrædes den, oscillerer faktoren mellem to trin.
   Skriv en enhedstest der fodrer `resolveUiScale` med sit eget output-inducerede rum og kræver
   fikspunkt.

3. **Flimmer på en trin-grænse.** Står vinduet præcis på en grænse, kan 1 px resize få faktoren til at
   hoppe. Løsning: **asymmetrisk hysterese** — skift *ned* i UI-størrelse med det samme, men kræv
   `SCALE_STEP_HYSTERESIS_PX = 24` ekstra luft for at gå *op* igen. Derfor tager `resolveUiScale` den
   nuværende faktor som andet argument.

4. **Browserens egen page zoom oveni.** Ctrl + − øger `window.innerWidth` → vores faktor går mod 1.
   Selvudjævnende og korrekt. Ctrl + + gør det modsatte og kan stable to nedskaleringer; `MIN_SCALE`
   er gulvet der forhindrer ulæselig tekst.

5. **`devicePixelRatio` ændrer sig** når vinduet flyttes til en skærm med anden Windows-skalering.
   `resize` fyrer normalt ved skærmskift, men ikke garanteret. Overvej en
   `matchMedia('(resolution: …)')`-lytter som supplement; symptomet ved manglende opdatering er blot en
   forældet faktor til næste resize, ikke et brud.

6. **1 px-rammer bliver uskarpe.** Ved `dpr 1.25` og `z = 0.95` er 1 logisk px = 1,1875 device-px.
   Rammer som `SideMenu.tsx:145` (`borderRight: '1px solid'`) og tabelrammer kan se udvaskede ud eller
   forsvinde stedvist. **Skal vurderes visuelt på hvert trin i stigen**, og trin der ser dårlige ud
   fjernes. Ved `dpr 1.25` er 0.8 det eneste helt skarpe trin — men det er under `MIN_SCALE`.

7. **Subpixel-drift i lange lister.** Målt: `scrollHeight` for 60 rækker à 29 px var 1740 ved zoom 1 og
   **1749** ved 0.875 — snapping akkumulerer ~9 px. Det er grunden til at **0.875 er udelukket fra
   stigen** som det dårligste mulige valg ved `dpr 1.25`. Kontrollér `EOKontrolTabel`s virtualiserede
   scroll ved bunden af en lang tabel.

8. **Læsbarhedsgulv.** `--font-size-text-table: 13px` × 0.85 = 11,05 px; × 0.8 = 10,4 px. **Derfor er
   `MIN_SCALE = 0.85`, ikke 0.8** — trods 0.8's bedre skarphed. Under 0.85 tager menu-scroll (trin 8)
   over frem for yderligere nedskalering.

9. **Klikmål (WCAG 2.2 Target Size).** 36 px kompakt knap × 0.85 = 30,6 visuelle px — over minimumet på
   24. Kombinationen af de to lag holder sig altså inden for kravet, men marginen skal genberegnes hvis
   nogen sænker `--menu-button-height` yderligere.

10. **`html2canvas` — antag brudt indtil målt.** `ContentBoxReportDialog.tsx:126-133` kalder
    `html2canvas(element, { scale: 2 })` på levende DOM. html2canvas kloner ind i en iframe og
    understøtter historisk hverken CSS `zoom` eller transformerede forfædre pålideligt → forskudt eller
    afklippet PNG. **Helt uverificeret.** Sikker mitigation: sæt `zoom: 1` på shell-roden under capture
    og gendan efter (`try`/`finally`).

11. **`width: auto` under zoom.** `MainLayout`s ydre `Box` har ingen eksplicit bredde. Ifølge specen er
    `auto` — som procent — undtaget fra zoom-multiplikationen, så den bør udfylde `#root` visuelt med
    flere logiske px indeni. **Det er udledt af specen, ikke målt.** Verificér empirisk i trin 5; er
    det forkert, sæt `width: '100%'` eksplicit.

12. **Firefox og WebKit.** Firefox fik `zoom` i v126; om Firefox og WebKit deler logiske og visuelle px
    op som Blink er **ikke verificeret**, og e2e kører alle fire engines. `getEffectiveZoom` er netop
    designet til at være robust uanset svaret. Understøtter en engine slet ikke `zoom`, degraderer det
    pænt: brugeren får nuværende adfærd, og den kompakte menu virker stadig.

13. **jsdom.** `zoom` findes ikke i jsdom, og `offsetWidth` er 0 → `getEffectiveZoom` returnerer 1.
    Head-scriptet kører ikke i unit-tests. Ingen ændring nødvendig i `src/test/setup.ts`.

14. **Sticky headers.** `EOKontrolTabel.tsx:225` (`stickyHeaderTop = -Number.parseFloat(theme.spacing(3)) - 2`)
    er en ren CSS-`top` i logisk rum og bør være konsistent. `VirtualizedDisplayTable.tsx:263-276`
    summerer derimod `stickyHeight` — kontrollér om nogen del af den sum er rect-målt; er den, hører
    den under trin 3.

15. **Bevidst kosmetisk, ikke brud:** `Overlay.tsx:106-108` (`top: 20, right: 20`) skaleres til ~19 px;
    `ScrollToTopButton.tsx:81`s `@media (max-width: 640px)` matcher visuelle px og skifter derfor ikke
    adfærd; `MuiTooltip`s `maxWidth: '360px'` (`appTheme.ts:55-70`) lever i uzoomet portal-rum.

16. **Zoom-uafhængige og dermed uberørte:** device-gaten (`clientDevice.ts` læser `visualViewport` og
    `window.screen`), PDF/DOCX-generering (egen mm/pt-geometri, ingen DOM-måling), grafer (offscreen
    canvas fra data). Der findes **ingen** `@media print`-regler i projektet.

---

## 6. Verifikation

1. **Enhedstest af `resolveUiScale`** — stige-kvantisering; grænsetilfælde umiddelbart over og under
   hvert trin; at 1920×1080 giver præcis `1`; monotoni i både bredde og højde; hysteresens asymmetri;
   fikspunkt-testen fra edge case 2.
2. **Enhedstest af `getEffectiveZoom`** — 1 i jsdom (`offsetWidth === 0`), 1 ved uzoomet element, og
   den korrekte faktor ved en stubbet rect/offset-kombination.
3. **Udvidede enhedstests** for `src/__tests__/utils/scrollTargetIntoView.test.ts` og
   `src/__tests__/components/tables/VirtualizedDisplayTable.test.tsx`: tilføj et zoomet tilfælde (stub
   rect og `clientHeight` med forskellig faktor) der er **rødt før** trin 3 og grønt efter.
4. **E2E** — `minimum-viewport-shell.spec.ts` grøn ved både 1536×864 og det nye snævre projekt.
   Kontrollér også `tooltip-wrapping.spec.ts:69-88` (`scrollWidth <= clientWidth + 1`; begge logiske,
   så bør holde, men 1 px-tolerancen er stram ved snapping), `popup-focus-restore.spec.ts:67`
   (koordinatklikket `{x:5,y:5}` er visuelt og forbliver gyldigt), `field-attention-blink.spec.ts:221-222`
   (rect mod rect) og `svie-smerte-men-cutoff.spec.ts:51`.
5. **Manuel prøve i den kørende app** ved brugerens faktiske vindue, i både browser-fane og PWA: `Om`
   synlig og klikbar, ingen vandret rullebjælke på Erstatningsopgørelse-siden, ingen synligt hop ved
   opstart.
6. **Fuld gate.** Kør `scripts/generate-build-info.mjs` før fuld vitest — forældet build-info giver
   falske røde dato-gates.

### Kilder for spec-svaret i §2.3
[CSS Viewport — zoom property](https://drafts.csswg.org/css-viewport/#zoom-property) ·
[Revisiting standardization of the `zoom` property](https://lists.w3.org/Archives/Public/public-css-archive/2023Jul/0581.html) ·
[[css3-values] viewport units and zoom](https://lists.w3.org/Archives/Public/www-style/2012Aug/0562.html)
