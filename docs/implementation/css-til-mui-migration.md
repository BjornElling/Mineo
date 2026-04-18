# CSS til MUI — migrationsstrategi

> **Formål:** Denne fil beskriver strategien for at konsolidere Mineos tre parallelle styling-systemer til ét MUI-baseret system. Den er en uddybning af punkt [16a i dark-mode.md](dark-mode.md#16a-afskaf-css-filer-til-styling--flyt-alt-til-mui-theme-og-sx).

> **Afgrænsning:** Denne fil handler udelukkende om styling-arkitektur. Beregningslogik, Zod-schemas og PDF-generering berøres ikke.

---

## Indholdsfortegnelse

1. [Problemet — tre parallelle systemer](#1-problemet--tre-parallelle-systemer)
2. [Målbillede](#2-målbillede)
3. [Inventar — hvad skal migreres](#3-inventar--hvad-skal-migreres)
4. [Migrationsstrategi](#4-migrationsstrategi)
5. [Stadie 1 — Forberedelse og stop for ny CSS](#5-stadie-1--forberedelse-og-stop-for-ny-css)
6. [Stadie 2 — Typografi-klasser](#6-stadie-2--typografi-klasser)
7. [Stadie 3 — Layout-klasser](#7-stadie-3--layout-klasser)
8. [Stadie 4 — Farve-tokens, CSS-variabler og tabelfarver](#8-stadie-4--farve-tokens-css-variabler-og-tabelfarver)
9. [Stadie 5 — Dynamisk tema og ThemeProvider-omstrukturering](#9-stadie-5--dynamisk-tema-og-themeprovider-omstrukturering)
10. [Stadie 6 — Slet CSS-filer](#10-stadie-6--slet-css-filer)
11. [Test-plan](#11-test-plan)
12. [Risici og mitigering](#12-risici-og-mitigering)
13. [Hvad der ikke berøres](#13-hvad-der-ikke-berøres)

---

## 1. Problemet — tre parallelle systemer

Mineo har i dag tre overlappende styling-mekanismer:

| System | Eksempler | Problem |
|---|---|---|
| **CSS-filer** (`typography.css`, `layout.css`) | `.page-title`, `.content-box`, `.row--label-offset` | Ingen TypeScript-kontrol; farver defineres uafhængigt af MUI |
| **MUI ThemeProvider** | `palette.primary.main`, `theme.components` | Statisk; kender ikke til CSS-klassernes farver; kan ikke skifte mode dynamisk |
| **`sx`-props og JS-objekter med hardcodede strenge** | `backgroundColor: '#ffffff'`, `tableColors` i `tableTheme.ts` | Synkroniseres ikke automatisk med tema eller CSS |

Konsekvensen er den tredelte farvestyring der beskrives i [dark-mode.md § 1](dark-mode.md#1-systemforståelse--nuværende-farvestyring). Dark mode kræver at man vedligeholder alle tre lag synkront — det er kilden til kompleksiteten.

### Konkrete smerter i dag

- `!important` i `layout.css` (klassen `.flow--16`) opstår fordi CSS-klasser og `sx`-props konkurrerer om specificitet.
- Rename af en CSS-klasse er en manuel grep-opgave; TypeScript hjælper ikke.
- Tilføjelse af en ny farve kræver koordinering i CSS-filen *og* evt. i `sx`-blokke *og* evt. i `tableTheme.ts`.
- Dark mode kræver en separat `[data-mineo-theme='dark']`-override-blok i stedet for at følge MUI's `palette.mode`.
- `ThemeProvider` i `App.tsx` er placeret *udenom* `AppSettingsProvider`, så temaet ikke kan læse brugersettings — dette er en strukturel blokering for dynamisk dark mode.
- Debug-CSS-variabler (`--mineo-color-section-header`, `--mineo-color-row-text` m.fl.) blander debug-infrastruktur ind i produktionskoden.

---

## 2. Målbillede

Efter migrationen er styling reduceret til **to lag**:

```
MUI ThemeProvider (palette, typography, components) — dynamisk, bygget ud fra AppSettings
    └─▶ theme.palette.*         ← eneste kilde til farver (inklusive tabelfarver)
    └─▶ theme.typography.*      ← eneste kilde til skriftstørrelser, vægte og font-family

sx-props / sx-konstanter (pr. komponent eller i src/styles/typographySx.ts / layoutSx.ts)
    └─▶ importerer theme-værdier via useTheme() / sx shorthand
    └─▶ ingen hardcodede hex-strenge
    └─▶ ingen var(--color-*)-referencer
```

`typography.css` og `layout.css` slettes. `index.css` beholdes (kun reset og font-import med `@import url(...)` for Montserrat — *ikke* `font-family`-definitioner, som flyttes til temaet).

Dark mode skiftes udelukkende ved at ændre `palette.mode` i MUI-temaet — ingen CSS-override-blok nødvendig.

### Hvad der *ikke* er en del af målbilledet

- Font-family-definitionen i `index.css` (`* { font-family: 'Montserrat' }`) overlapper med `theme.typography.fontFamily`. Når migration er komplet, beholdes kun theme-definitionen; CSS-reset-blokken reduceres til `box-sizing: border-box` og margin-nulstilling.
- `tableTheme.ts`-funktionerne `getMuiTableStyles` og `getHtmlTableStyles` skal refaktoreres til at modtage `theme` som parameter i stedet for at referere til et internt `tableColors`-objekt.

---

## 3. Inventar — hvad skal migreres

Dette er det *faktiske* inventar baseret på kodebasen som den ser ud nu. Det er ikke estimater.

### CSS-klasser i `src/styles/typography.css`

Alle klasser er scoped til `.MuiTypography-root` (undtagen `.icon-text-link` der har en variant uden dette scope).

| CSS-klasse | Nuværende brug | Foreslået MUI-ækvivalent |
|---|---|---|
| `.page-title` | Overskrifter på beregningssider (34px, w500, mb 40px) | `sx`-konstant `pageTitleSx` i `typographySx.ts` |
| `.section-header` | Sektionsoverskrifter (18px, w500, mb 26px) | `sx`-konstant `sectionHeaderSx` i `typographySx.ts` |
| `.body-text` | Brødtekst (14px, w400) | `Typography variant="body1"` — default, ingen override nødvendig |
| `.body-text-secondary` | Sekundær brødtekst (14px, secondary color) | `Typography variant="body2"` med `color="text.secondary"` |
| `.row--text` | Rækketekst (15px, w400) | `sx`-konstant `rowTextSx` i `typographySx.ts` |
| `.row--subheading` | Rækkeoverskrift (16px, w500) | `sx`-konstant `rowSubheadingSx` i `typographySx.ts` |
| `.row--subheading-underlined` | Understreget rækkeoverskrift (15px, underlined) | `sx`-konstant `rowSubheadingUnderlinedSx` i `typographySx.ts` |
| `.row--label-offset__label` | Label i label-offset-rækker (14px, w500) | `sx`-konstant `rowLabelSx` i `typographySx.ts` |
| `.menu-text` | Menupunktets tekst (14px, secondary → primary ved active) | MUI `ListItemText` med tema-override i `SideMenu` |
| `.menu-item` | Menupunkter (hover og active styling) | MUI `ListItemButton` med `sx`-override; se Stadie 2 |
| `.icon-text-link` | Links med prikket understregning | `sx`-konstant `iconTextLinkSx` i `typographySx.ts` |
| `.text-muted` | Dæmpet tekst (secondary color) | `color="text.secondary"` prop på `Typography` |
| `.text-primary` | Primær farvet tekst | `color="primary.main"` prop på `Typography` |
| `.text-bold` | Fed tekst (w600) | `fontWeight: 600` i `sx` |
| `.text-base` | Basetekst | Fjernes — er dækket af MUI-default |

> **OBS — `section-header` er 18px, ikke 20px.** Det forkerte mål (20px) stod i den foregående version af dette dokument. Korrekt mål er 18px fra `typography.css`.

> **OBS — debug-CSS-variabler.** `typography.css` indeholder en gruppe `--mineo-color-*`-variabler der bruges til visuel debug af typografi (kan aktiveres via settings). Disse variabler refereres i `App.tsx` og `tableTheme.ts`. De skal migreres til et dedikeret debug-lag — se Stadie 2.

### CSS-klasser i `src/styles/layout.css`

| CSS-klasse | Nuværende brug | Foreslået MUI-ækvivalent |
|---|---|---|
| `.content-box` | Indholdscontainere (max 1200px, 40px padding, border-radius 20px, shadow) | `sx`-konstant `contentBoxSx` i `layoutSx.ts` |
| `.row` | Basisrække (min-height 40px, flex, 16px vertikal spacing) | `sx`-konstant `rowSx` i `layoutSx.ts` |
| `.row--text` | Tekstrække (samme layout som `.row`) | `sx`-konstant `rowSx` i `layoutSx.ts` (deler konstant med `.row`) |
| `.row--subheading` | Overskriftsrække (24px ekstra top-margin) | `sx`-konstant `rowSubheadingSx` i `layoutSx.ts` |
| `.row--subheading-underlined` | Understreget overskriftsrække | `sx`-konstant `rowSubheadingUnderlinedSx` i `layoutSx.ts` |
| `.row--label-offset` | Label + indrykket indhold (flex-wrap, 16px gap) | `sx`-konstant `rowLabelOffsetSx` i `layoutSx.ts` |
| `.row--label-offset__label` | Labeldelen (250px bred, inline-flex) | `sx`-konstant `rowLabelOffsetLabelSx` i `layoutSx.ts` |
| `.row--label-offset__content` | Indholdsdelen (flex: 1, min 220px) | `sx`-konstant `rowLabelOffsetContentSx` i `layoutSx.ts` |
| `.row--label-right` | Label + højrestillet element (space-between, 12px padding) | `sx`-konstant `rowLabelRightSx` i `layoutSx.ts` |
| `.row--label-right-hover` | Hover-variant af ovenstående (transition, border-radius) | `sx`-konstant `rowLabelRightHoverSx` i `layoutSx.ts` |
| `.row--label-right-hover__label` | Label i hover-variant | `sx`-konstant i `layoutSx.ts` |
| `.row--label-right-hover__content` | Indhold i hover-variant (flex-end) | `sx`-konstant i `layoutSx.ts` |
| `.icon-text-row` | Ikon + tekst inline (flex, gap 12px) | `sx`-konstant `iconTextRowSx` i `layoutSx.ts` |
| `.numbered-list-item` | Grid med nummer + indhold (30px + 1fr) | `sx`-konstant `numberedListItemSx` i `layoutSx.ts` |
| `.list-container` | Listeomsætning (margin-left 10px) | `sx`-konstant `listContainerSx` i `layoutSx.ts` |
| `.flow--16` | Spacing-utility (16px mellem søskende, **med `!important`**) | Fjern til fordel for MUI `Stack` eller eksplicit `sx={{ mb: 2 }}` på hvert element |

> **OBS — `.flow--16` kræver særlig opmærksomhed.** Klassen bruger `!important` på margin og padding og matcher `.row--text` direkte. Den er et kludge der kompenserer for specificitetskonflikter. Når den fjernes, skal hvert sted den bruges gennemgås manuelt for at sikre korrekt afstand — brug `Stack spacing={2}` eller eksplicit `sx` i stedet.

> **OBS — `.page-container` eksisterer ikke** i `layout.css`. Det stod som estimat i den foregående version. Fjern referencer til denne klasse fra enhver dokumentation.

### Hardcodede farver i `sx`-props og JS-objekter

Disse refereres *ikke* i CSS-filer og håndteres ikke automatisk ved sletning af CSS-filer. De skal migreres eksplicit i Stadie 4.

Kendte steder med hardcodede farver:

| Fil | Omfang |
|---|---|
| `SideMenu.tsx` | `#f8f9fa`, `#e9ecef`, `#6c757d`, `rgba(0,0,0,0.04)` — sidebar bg, border, ikoner, hover |
| `StyledTextFieldBase.tsx` | `#ffffff`, `rgba(0,0,0,0.12)`, `#1976d2`, `rgba(0,0,0,0.035)`, `#d32f2f` — input styling |
| `StyledTextAreaBase.tsx` | Samme mønster som `StyledTextFieldBase.tsx` |
| `StyledAmountField.tsx` | `rgba(0,0,0,0.45)` — sekundær tekstfarve |
| `StyledDropdown.tsx` | `rgba(25,118,210,0.08)` — active highlight |
| `InlineActionButton.tsx` | `#2f6fb3`, `#f4f8fd`, `#b9d0ea` — knap-farver |
| `PdfDownloadButton.tsx` | `#e3f2fd`, `#bbdefb` — hover og active |
| `StyledRadioButton.tsx` | `#d32f2f` — fejlfarve |
| `Overlay.tsx` | `colors`-objekt med success/error/warning/info-farver (Tailwind-farver) |
| `ErrorFallback.tsx` | `#f8f9fa`, `#fff` |
| `DevtoolsIssueNotice.tsx` | `#fff` |
| `tableTheme.ts` | `tableColors`-objekt + `getMuiTableStyles()` + `getHtmlTableStyles()` |

### CSS-variabler (`--color-*` og `--mineo-color-*`)

Alle `var(--color-*)` referencer i `sx`-props og tema-konfiguration:

| Variabel | Brugt i | Skal erstattes med |
|---|---|---|
| `var(--color-primary)` | `SideMenu.tsx` | `'primary.main'` i `sx` |
| `var(--color-text-secondary)` | `SideMenu.tsx` | `'text.secondary'` i `sx` |
| `var(--color-hover)` | `SideMenu.tsx` | `'action.hover'` i `sx` |
| `var(--mineo-color-mui-typography-default, ...)` | `App.tsx` — theme `allVariants` | Fjernes; erstattes af `theme.palette.text.primary` direkte |
| `var(--mineo-color-input-text, ...)` | `App.tsx` — `MuiInputBase` override | Fjernes; erstattes af `theme.palette.text.primary` direkte |
| `var(--font-size-text-table)` | `tableTheme.ts` | Hardcodet værdi eller theme-token |
| `var(--font-size-text)` | `tableTheme.ts` | `theme.typography.fontSize` |
| `var(--mineo-color-grid-table-text)` | `tableTheme.ts` | `theme.palette.text.primary` |

> **OBS — debug-variablerne (`--mineo-color-*`) bruges aktivt i produktionskoden** (i `App.tsx` og `tableTheme.ts`). De kan ikke bare slettes med CSS-filen. Debug-funktionaliteten skal migreres til et selvstændigt debug-lag — se Stadie 2.

### Font-family

`typography.css` definerer `--font-family-base: 'Montserrat', sans-serif`. `index.css` sætter `font-family: 'Montserrat', sans-serif` globalt via `*`-selector. `App.tsx`'s tema sætter `typography.fontFamily: 'Montserrat, sans-serif'`.

Der er **tre parallelle kilder til font-family-definitionen.** I målbilledet er MUI-temaet den eneste kilde. `index.css`-reset-blokken bevarer kun `box-sizing: border-box`, margin-nulstilling og `font-smoothing`.

---

## 4. Migrationsstrategi

Migrationen skal være **inkrementel og komponent-for-komponent**. En big-bang-migrering er for risikabel i en trust-kritisk applikation.

### Princip: stop → migrer → slet

1. **Stop** med at tilføje nye CSS-klasser og `var(--color-*)` fra dag ét (Stadie 1).
2. **Migrer** eksisterende klasser klasse-for-klasse, komponent-for-komponent (Stadie 2–4).
3. **Gør temaet dynamisk** inden dark mode kan tages i brug (Stadie 5).
4. **Slet** CSS-filerne når de er tomme for meningsfuldt indhold (Stadie 6).

### Rækkefølge-princip

Migrer i rækkefølgen: *leaf-komponenter først, container-komponenter sidst*. Leaf-komponenter (fx `StyledTextFieldBase`, `StyledToggleSwitch`) påvirker ikke andre komponenters layout. Container-komponenter (`SideMenu`, `ContentBox`) påvirker den visuelle struktur og kræver mere omhyggelig verifikation.

### Afhængigheder mellem stadier

- Stadie 2 og 3 kan udføres parallelt med hinanden (typografi og layout er uafhængige), men hvert enkelt komponent skal migreres atomart — ét komponent ad gangen, verificeret og committet.
- Stadie 4 (farver) afhænger af at CSS-klasserne er migreret, fordi det er her `var(--color-*)`-variablerne i `sx`-props erstattes med tema-referencer.
- Stadie 5 (dynamisk tema) afhænger af Stadie 4, fordi temaet kun giver mening som eneste farvekilde når de hardcodede strenge er fjernet.
- Stadie 6 (slet CSS) er blokeret af alle foregående stadier.

---

## 5. Stadie 1 — Forberedelse og stop for ny CSS

*Ingen visuel ændring. Ren infrastruktur og kodepolitik.*

### Opret `src/styles/typographySx.ts`

Ny fil til eksporterede `SxProps`-konstanter for typografi-mønstre. Konstanterne afspejler de faktiske værdier fra `typography.css` — ikke estimater:

```ts
import type { SxProps, Theme } from '@mui/material';

export const pageTitleSx: SxProps<Theme> = {
  fontSize: '34px',
  fontWeight: 500,
  color: 'text.primary',
  mb: '40px',
};

export const sectionHeaderSx: SxProps<Theme> = {
  fontSize: '18px',    // OBS: 18px — ikke 20px
  fontWeight: 500,
  color: 'text.primary',
  mb: '26px',
};

export const rowTextSx: SxProps<Theme> = {
  fontSize: '15px',
  fontWeight: 400,
  color: 'text.primary',
};

export const rowSubheadingSx: SxProps<Theme> = {
  fontSize: '16px',
  fontWeight: 500,
  color: 'text.primary',
};

export const rowSubheadingUnderlinedSx: SxProps<Theme> = {
  fontSize: '15px',
  fontWeight: 400,
  textDecoration: 'underline',
  color: 'text.primary',
};

export const iconTextLinkSx: SxProps<Theme> = {
  textDecoration: 'underline dotted',
  cursor: 'pointer',
};
```

> **Farver i `sx`-konstanter:** Brug altid MUI-systemværdier (`'text.primary'`, `'primary.main'`) og aldrig hardcodede hex-strenge. Disse systemværdier oversættes automatisk til `theme.palette`-værdier og fungerer korrekt med dark mode.

### Opret `src/styles/layoutSx.ts`

Ny fil til layout-mønstre. Spacing-værdier i pixels (ikke MUI-spacing-tal) sikrer at de matcher de eksisterende CSS-definitioner præcist under migrationen:

```ts
import type { SxProps, Theme } from '@mui/material';

export const contentBoxSx: SxProps<Theme> = {
  maxWidth: '1200px',
  backgroundColor: 'background.paper',
  p: '40px',
  borderRadius: '20px',
  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',   // flyttes til theme.shadows efter Stadie 4
};

export const rowSx: SxProps<Theme> = {
  minHeight: '40px',
  display: 'flex',
  alignItems: 'center',
  mb: '16px',
};

export const rowLabelOffsetSx: SxProps<Theme> = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: '16px',
  mb: '16px',
};

export const rowLabelOffsetLabelSx: SxProps<Theme> = {
  width: '250px',
  display: 'inline-flex',
  alignItems: 'center',
};

export const rowLabelOffsetContentSx: SxProps<Theme> = {
  flex: 1,
  minWidth: '220px',
};
```

> **OBS — `boxShadow` og `border` hardcodes midlertidigt** med de eksisterende værdier. Det er acceptabelt i overgangsperioden. De erstattes med `theme.shadows` og `theme.palette.divider` i Stadie 4.

> **OBS — `.flow--16` migreres ikke til en `sx`-konstant.** Klassen er et kludge og erstatterens er `Stack spacing={2}` eller eksplicit `sx={{ mb: 2 }}`. Det kræver case-by-case vurdering af hvert brugssted.

### Kodepolitik fra dag ét

- Ny kode må ikke tilføje `className` der refererer til `typography.css` eller `layout.css`.
- Ny kode må ikke tilføje hardcodede hex-strenge i `sx`.
- Ny kode bruger `theme.palette.*` (via `useTheme()`) eller eksporterede `sx`-konstanter.
- Ny kode bruger ikke `var(--color-*)` eller `var(--font-*)`.

Tilføj en kommentar øverst i `typography.css` og `layout.css`:

```css
/* DEPRECATED — migreres til MUI theme og sx-konstanter. Tilføj ikke nye klasser her. */
```

---

## 6. Stadie 2 — Typografi-klasser

Migrer CSS-klasser fra `typography.css` til `sx`-konstanter i `typographySx.ts`.

### Fremgangsmåde per klasse

1. Find alle `.tsx`-filer der bruger klassen: `grep -rn "className.*page-title" src/`.
2. Erstat `className="page-title"` med `sx={pageTitleSx}` (importeret fra `typographySx.ts`).
3. Kør `npx tsc --noEmit` — skal passere uden fejl.
4. Kør appen og verificer visuelt mod screenshot taget i Stadie 1.
5. Fjern klassen fra `typography.css`.
6. Kør `grep -rn "page-title" src/` for at bekræfte der ingen referencer er tilbage.

> **Verificer at mellemrum er bevaret.** `mb` (margin-bottom) og `mt` (margin-top) i CSS-klasserne er absolutte pixel-værdier. Kontroller at de konverteres korrekt — `mb: '40px'` i `sx` er ikke det samme som MUI's spacing-tal `mb: 5` (der er `5 * 8px = 40px`, men kun hvis standardspacing ikke er tilpasset).

### Særligt om `.menu-item` og `menu-text`

`.menu-item` og `.menu-text` er tæt koblet til `SideMenu.tsx`-komponentens aktive/hover-tilstand. De bør ikke migreres til generiske `sx`-konstanter, men i stedet til komponent-specifikke `sx`-overrides direkte i `SideMenu.tsx`, styret af MUI `ListItemButton`'s `selected`-prop og `theme.palette.action.selected`. Migrer dem i ét samlet skridt (ikke opdelt), da de interagerer med hinanden.

### Særligt om debug-CSS-variabler (`--mineo-color-*`)

`typography.css` eksponerer `--mineo-color-section-header`, `--mineo-color-row-text`, `--mineo-color-row-subheading`, `--mineo-color-grid-table-text` og `--mineo-color-mui-typography-default` som debug-farver der aktiveres via `fontStyleColorDebug`-setting.

Disse variabler refereres direkte i `App.tsx`'s tema (`allVariants.color`, `MuiInputBase.styleOverrides`) og i `tableTheme.ts`. De kan **ikke** blot slettes med CSS-filen.

Migrationsplan for debug-variablerne:
1. Fjern CSS-variablerne fra `typography.css`.
2. Erstat `var(--mineo-color-...)` i `App.tsx` med direkte `theme.palette.text.primary` (varianterne bruges kun til at sætte defaultfarven, som temaet allerede kender).
3. Flyt debug-farvelogikken til et separat debug-tema-overlay der aktiveres af `fontStyleColorDebug`-setting — samme mønster som `data-mineo-font-style-colors`-attribute, men som en theme-override i stedet for CSS-variabel.

### MUI Typography-tema-overrides (hvis ønsket)

Brugerdefinerede Typography-varianter (fx `variant="pageTitle"`) er et alternativ til `sx`-konstanter. Fordelen er at varianten kan overrides globalt i temaet. Ulempen er at det kræver TypeScript-type-augmentation og er sværere at følge i kodebasen.

Anbefaling: brug `sx`-konstanter fra `typographySx.ts` som standard. Registrer kun tema-varianter for de to-tre mønstre der bruges på tværs af mange komponenter (`pageTitle`, `sectionHeader`), og *kun* hvis der er behov for global temaoverride.

Hvis tema-varianter bruges, kræver det type-augmentation — ellers fejler TypeScript:

```ts
declare module '@mui/material/styles' {
  interface TypographyVariants {
    pageTitle: React.CSSProperties;
    sectionHeader: React.CSSProperties;
  }
  interface TypographyVariantsOptions {
    pageTitle?: React.CSSProperties;
    sectionHeader?: React.CSSProperties;
  }
}
declare module '@mui/material/Typography' {
  interface TypographyPropsVariantOverrides {
    pageTitle: true;
    sectionHeader: true;
  }
}
```

> **OBS — hardcod ikke `color` i tema-varianterne.** `color: 'rgba(0, 0, 0, 0.87)'` i en tema-typografi-variant virker ikke med dark mode, fordi farven er statisk. Brug i stedet `color: theme.palette.text.primary` — men det kræver at tema-varianten defineres som en funktion der modtager `theme` (via `createTheme`'s `styleOverrides`-mønster), ikke som et statisk objekt.

---

## 7. Stadie 3 — Layout-klasser

Migrer CSS-klasser fra `layout.css` til `sx`-konstanter i `layoutSx.ts`.

### Fremgangsmåde

Identisk med Stadie 2: `grep -rn "className.*content-box" src/` → erstat → TypeScript-check → verificer visuelt → fjern fra CSS → bekræft ingen referencer tilbage.

### Særligt om `.flow--16`

`.flow--16` er et special case. Klassen bruger `!important` på margin og padding og matcher `.row--text` direkte som child-selector. Den er et kludge og har ingen direkte `sx`-ækvivalent.

Fremgangsmåde:
1. `grep -rn "flow--16" src/` for at finde alle brugssleder.
2. For hvert brugssted: vurder om `<Stack spacing={2}>` løser spacingen, eller om eksplicit `sx={{ mb: 2 }}` på hvert element er den rigtige løsning.
3. Fjern `flow--16`-klassen og bekræft visuelt at spacing er bevaret.
4. Fjern klassen fra `layout.css`.

> **`!important` forsvinder ikke automatisk.** `layout.css`'s `!important`-regler fjernes kun når selve `.flow--16`-klassen er fjernet fra alle brugssleder og fra CSS-filen. Kontroller med DevTools Styles-panel at ingen `!important` er tilbage efter dette skridt.

### Særligt om `.content-box`

`.content-box` bruges i en dedikeret `ContentBox`-komponent. Migrer klassen ét sted — i `ContentBox.tsx` — frem for at jagte alle de steder der bruger `ContentBox`. Det er en container-komponent og skal migreres sidst i Stadie 3.

`box-shadow` og `border-radius` er hardcodet i `contentBoxSx` under Stadie 1. Kontroller at de matcher de eksisterende CSS-værdier pixel-perfekt.

---

## 8. Stadie 4 — Farve-tokens, CSS-variabler og tabelfarver

Erstat alle hardcodede farvestrenge og `var(--color-*)`-referencer med `theme.palette.*`-værdier.

### Token-mapping — CSS-variabler til MUI palette

| CSS-variabel | MUI theme-ækvivalent |
|---|---|
| `var(--color-primary)` | `'primary.main'` i `sx` / `theme.palette.primary.main` |
| `var(--color-text-primary)` | `'text.primary'` i `sx` / `theme.palette.text.primary` |
| `var(--color-text-secondary)` | `'text.secondary'` i `sx` / `theme.palette.text.secondary` |
| `var(--color-background-white)` | `'background.paper'` i `sx` / `theme.palette.background.paper` |
| `var(--color-surface)` | `'background.default'` i `sx` / `theme.palette.background.default` |
| `var(--color-hover)` | `'action.hover'` i `sx` / `theme.palette.action.hover` |
| `var(--color-border)` | `'divider'` i `sx` / `theme.palette.divider` |
| `var(--color-active-bg)` | `'action.selected'` i `sx` / `theme.palette.action.selected` |

### Brugerdefinerede palette-felter

Farver der ikke har et direkte MUI-ækvivalent defineres som brugerdefinerede palette-felter. Dette kræver type-augmentation *inden* de bruges i `sx`-props — ellers fejler TypeScript:

```ts
declare module '@mui/material/styles' {
  interface Palette {
    inputBg: string;
    tableHeaderBg: string;
    tableOddRowBg: string;
    tableEvenRowBg: string;
    tableSort: string;
    surface: string;
    surfaceBorder: string;
    sidebarBg: string;
    sidebarBorder: string;
  }
  interface PaletteOptions {
    inputBg?: string;
    tableHeaderBg?: string;
    tableOddRowBg?: string;
    tableEvenRowBg?: string;
    tableSort?: string;
    surface?: string;
    surfaceBorder?: string;
    sidebarBg?: string;
    sidebarBorder?: string;
  }
}
```

Og sættes i `buildTheme` (temaet er på dette tidspunkt endnu ikke dynamisk — det bliver det i Stadie 5):

```ts
const lightPalette = {
  inputBg: '#ffffff',
  tableHeaderBg: '#f8fafc',
  tableOddRowBg: '#f9fafb',
  tableEvenRowBg: '#ffffff',
  tableSort: '#1976d2',
  surface: '#f8f9fa',
  surfaceBorder: '#e9ecef',
  sidebarBg: '#f8f9fa',
  sidebarBorder: '#e9ecef',
};
```

> **OBS — `Overlay.tsx`'s statusfarver er ikke standard MUI-palettefarver.** `success`, `error`, `warning`, `info` i `Overlay.tsx` bruger Tailwind-farver (`#10B981`, `#EF4444` m.fl.) der ikke matcher MUI's `theme.palette.success.main` m.fl. Beslut om de skal oversættes til MUI-semantikken eller beholdes som brugerdefinerede tokens, og dokumenter beslutningen i koden.

### Refaktorering af `tableTheme.ts`

`tableTheme.ts` har et internt `tableColors`-objekt og to eksporterede funktioner. Dette skal refaktoreres:

- `getMuiTableStyles(useSmallFont)` → `getMuiTableStyles(theme: Theme, useSmallFont: boolean)`
- `getHtmlTableStyles(useSmallFont)` → `getHtmlTableStyles(theme: Theme, useSmallFont: boolean)`

Funktionerne erstatter `tableColors.*`-referencer med `theme.palette.*`-referencer. Det interne `tableColors`-objekt slettes.

Alle kaldesteder skal opdateres til at sende `theme` som argument (via `useTheme()`).

> **OBS — `getHtmlTableStyles` returnerer `CSSProperties` (ikke MUI `SxProps`).** Den bruges sandsynligvis til HTML-tabel-rendering (fx PDF-preview eller eksport). Kontroller at kaldestederne fortsat fungerer korrekt — `theme.palette.*`-strenge er gyldige i `CSSProperties`.

### `useThemeTokens()`-hook

Se [dark-mode.md § 16c](dark-mode.md#16c-introducér-usethemetokens-hook-som-eneste-adgangsport-til-design-tokens) for rationale. Opret hooken i Stadie 4 — det er det rigtige tidspunkt, fordi temaet nu er den eneste farvekilde:

```ts
// src/styles/useThemeTokens.ts
import { useTheme } from '@mui/material/styles';

export const useThemeTokens = () => {
  const theme = useTheme();
  return {
    colorPrimary:       theme.palette.primary.main,
    colorTextPrimary:   theme.palette.text.primary,
    colorTextSecondary: theme.palette.text.secondary,
    colorSurface:       theme.palette.background.default,
    colorPaper:         theme.palette.background.paper,
    colorInputBg:       theme.palette.inputBg,
    colorDivider:       theme.palette.divider,
    colorHover:         theme.palette.action.hover,
    colorSelected:      theme.palette.action.selected,
    colorTableHeader:   theme.palette.tableHeaderBg,
    colorSidebarBg:     theme.palette.sidebarBg,
    colorSidebarBorder: theme.palette.sidebarBorder,
  } as const;
};
```

> **`useThemeTokens` er kun til komponenter der ikke kan bruge `sx`-shorthand** — fx `tableTheme.ts`-funktionerne og `Overlay.tsx`'s `colors`-objekt. Komponenter der bruger MUI `sx`-props behøver ikke hooken — de kan referere `'text.primary'` direkte.

---

## 9. Stadie 5 — Dynamisk tema og ThemeProvider-omstrukturering

Dette stadie er en strukturel forudsætning for dark mode, men er også nødvendigt for at fuldføre migrationen korrekt: et statisk tema kan ikke afspejle brugersettings.

### Problemet med nuværende ThemeProvider-placering

I dag er `App.tsx` struktureret sådan:

```tsx
const theme = createTheme({ ... });  // statisk, oprettet én gang

<ThemeProvider theme={theme}>
  <AppSettingsProvider>
    ...
  </AppSettingsProvider>
</ThemeProvider>
```

`ThemeProvider` er placeret *udenom* `AppSettingsProvider`, så temaet ikke kan læse `settings.themeMode` (eller andre settings). Det er en strukturel blokering.

### Løsning: `DynamicThemeProvider`

Opret en wrapper-komponent der læser settings og bygger temaet dynamisk:

```tsx
// src/theme/DynamicThemeProvider.tsx
const DynamicThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const { settings } = useAppSettings();
  const theme = React.useMemo(
    () => buildTheme(settings.themeMode ?? 'light'),
    [settings.themeMode]
  );
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};
```

Og i `App.tsx`:

```tsx
<AppSettingsProvider>
  <DynamicThemeProvider>
    <BrowserRouter>
      ...
    </BrowserRouter>
  </DynamicThemeProvider>
</AppSettingsProvider>
```

`buildTheme(mode: 'light' | 'dark')` erstatter det inline `createTheme`-kald i `App.tsx` og placeres i `src/theme/buildTheme.ts`.

> **OBS — `useMemo` er nødvendig.** Uden den oprettes et nyt tema-objekt ved hvert render, hvilket medfører at alle MUI-komponenter i træet re-renderes unødvendigt.

> **OBS — `themeMode` skal tilføjes til `appSettingsSchema.ts`.** Følg det eksisterende mønster for settings-persistering via `localStorage` og `AppSettingsContext`. `fontStyleColorDebug`-settingen er et godt forbillede.

### Flyt tema-konfiguration til `src/theme/buildTheme.ts`

`buildTheme` samler al tema-konfiguration ét sted:

- `palette` (light og dark varianter, inklusive brugerdefinerede felter fra Stadie 4)
- `typography` (fontFamily, fontSize, varianter)
- `components` (MuiTypography, MuiInputBase, MuiMenuItem, MuiButton overrides)
- `shadows` (erstatter hardcodede `box-shadow`-strenge fra `layoutSx.ts`)

---

## 10. Stadie 6 — Slet CSS-filer

Når `typography.css` og `layout.css` er tomme for meningsfuldt indhold (kun eventuelle CSS-reset-fragmenter og deprecated-kommentaren):

1. Bekræft med `grep -c 'color\|background\|border\|font\|margin\|padding' src/styles/typography.css` at der ikke er reelle CSS-regler tilbage.
2. Bekræft med `grep -rn "typography.css\|layout.css" src/` at der ingen imports er tilbage.
3. Slet filerne.
4. Fjern `import`-linjerne fra `index.css` (som importerer dem).
5. Opdater `index.css` så `font-family` kun er `@import`-linjen for Montserrat-fonten — ikke en `*`-selector-override (den er nu i temaet).
6. Kør `npx tsc --noEmit` — skal passere.
7. Kør `npx vitest run` — ingen tests må fejle.
8. Kør appen i browser og verificer visuelt i light mode.
9. Aktivér dark mode og verificer visuelt.

> **OBS — CSS-filer importeres via `index.css`, ikke direkte i `main.tsx` eller `App.tsx`.** Trin 4 skal altså rette `index.css`, ikke `App.tsx`.

`index.css` beholdes og indeholder efter migrationen kun:

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  overflow: hidden;
}

#root {
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}
```

---

## 11. Test-plan

### Baseline — inden Stadie 1 påbegyndes

Tag screenshots af alle beregningssider i light mode og gem dem som reference. Dette er baseline for visuel sammenligning efter hvert stadie.

### Visuel regressions-check (efter hvert enkelt komponent der migreres)

- Screenshot af det berørte komponent/side — sammenlign med baseline.
- Verificer at tekststørrelser, farver, margins og afstande er pixel-identiske.
- Pixelforskelle er en regression og skal udbedres inden næste komponent migreres.

### Specificitet-check (efter Stadie 3)

- Åbn DevTools → Styles-panel og bekræft at ingen `!important` er nødvendige.
- Verificer specifikt at `.flow--16`-klassen ikke har efterladt `!important`-regler i stilarket.

### TypeScript-check (efter hvert stadie)

- `npx tsc --noEmit` skal passere efter hvert stadie.
- Særligt kritisk efter Stadie 2 (Typography-type-augmentation) og Stadie 4 (palette-type-augmentation).
- Kør TypeScript-checket *inden* du committer — type-fejl i ét stadie blokerer de efterfølgende.

### Tabel-check (efter Stadie 4)

- Åbn en side med en datagrid og verificer at: kolonnebredder, skriftstørrelser, headerbaggrund, rækkefarver og sorteringsikoner er korrekte.
- Verificer både `getMuiTableStyles` og `getHtmlTableStyles` — de har potentielt forskellige kaldesteder.

### ThemeProvider-check (efter Stadie 5)

- Skift tema via settings — bekræft at alle komponenter skifter korrekt.
- Bekræft at et side-refresh bevarer det valgte tema (settings persisteres i localStorage).
- Bekræft at `DynamicThemeProvider` ikke medfører unødvendige re-renders (åbn React DevTools Profiler).

### Funktionel check (efter Stadie 6)

- Alle inputfelter, tabeller, sidemenuen og toast-notifikationer skal se korrekte ud i begge modes.
- PDF-output skal være uændret — PDF-kode berøres ikke af migrationen.
- Kør `npx vitest run` — ingen tests må fejle.

---

## 12. Risici og mitigering

| Risiko | Sandsynlighed | Mitigering |
|---|---|---|
| Visuel regression ved CSS-klasse-fjernelse | Høj | Screenshot-sammenligning efter hvert enkelt komponent — ikke bare efter hvert stadie |
| Forkerte pixel-værdier i `sx`-konstanter (pga. estimater i dokumentation) | Høj | Verificer alle værdier direkte mod CSS-filen inden migrering — se inventaret i § 3 |
| TypeScript-fejl ved brugerdefinerede palette-felter | Medium | Tilføj type-augmentation i Stadie 4 *inden* de nye felter bruges i `sx`-props |
| `!important`-specificitetskonflikter i overgangsperioden | Medium | Acceptabelt midlertidigt; fjernes specifikt ved `.flow--16`-migrering |
| CSS-klasse brugt på ukendt sted (fx i test-fixture eller snapshot) | Medium | Kør `grep -rn "className.*<klassenavn>" src/` systematisk per klasse; tjek også `__tests__/`-mappen |
| Debug-CSS-variabler der refereres fra produktionskode | Høj | Migrer debug-variablerne eksplicit som beskrevet i Stadie 2 — slet dem ikke bare med CSS-filen |
| `tableTheme.ts` refaktorering bryder tabelrendering | Medium | Migrer `getMuiTableStyles` og `getHtmlTableStyles` i ét samlet PR; verificer alle sider med tabeller |
| `DynamicThemeProvider` medfører unødvendige re-renders | Lav | Brug `useMemo` på `buildTheme`-kaldet; verificer med React DevTools Profiler |
| Manglende `themeMode` i settings medfører `undefined` ved første load | Medium | Sæt en eksplicit default (`'light'`) i settings-schema; brug null-coalescing ved `buildTheme`-kaldet |
| Font-family defineret tre steder giver inkonsistent rendering | Lav | Fjern CSS-definitionen sidst (Stadie 6) — MUI-temaet er den rigtige kilde |
| Migrationen trækker i langdrag og ender halvfærdig | Høj | Ét stadie ad gangen, fuldt afsluttet og verificeret, inden næste stadie påbegyndes. Commit per komponent. |

**Største risiko:** Migrationen er omfangsrig og mekanisk. Den primære risiko er ikke individuelle fejl, men at migrationen aldrig afsluttes og kodebasen ender i en permanent halvfærdig tilstand med CSS-klasser *og* `sx`-konstanter side om side. Mitigering: commit atomart (ét komponent ad gangen), og lad ingen CSS-klasse eksistere parallelt med sin `sx`-ækvivalent i mere end ét commit.

---

## 13. Hvad der ikke berøres

- **`src/styles/index.css`** — Reduceres til ren reset (box-sizing, margin, overflow). Font-family-definitionen flyttes til temaet. `@import`-linjen for Montserrat beholdes her.
- **PDF-generering** (`src/pdf/**`) — PDF-farver er statiske og uafhængige af MUI-temaet. Må ikke ændres som del af denne migration.
- **Beregningslogik, Zod-schemas, tests** — ingen styling-afhængigheder.
- **`src/styles/index.css`'s `@import url(...)` for Montserrat-fonten** — Beholdes uændret. Selve font-family-definitionen i `*`-selectoren fjernes derimod (erstattes af `theme.typography.fontFamily`).
