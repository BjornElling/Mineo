# Dark Mode implementering i Mineo

> **Formål:** Denne fil er den autoritative implementeringsguide for dark mode i Mineo. Den beskriver strategi, farvepalet, alle berørte filer og rækkefølgen af ændringer.

> **Afgrænsning:** Denne fil er implementeringsorienteret. Den beskriver *hvad* der skal ændres og *hvorfor*, ikke beregningslogik eller domænekontrakter.

---

## Indholdsfortegnelse

1. [Systemforståelse — nuværende farvestyring](#1-systemforståelse--nuværende-farvestyring)
2. [Arkitekturstrategi](#2-arkitekturstrategi)
3. [Forudsætninger — centraliseringsopgaver](#3-forudsætninger--centraliseringsopgaver)
4. [Farvepalet — light og dark](#4-farvepalet--light-og-dark)
5. [Stadie 1 — Settings-infrastruktur](#5-stadie-1--settings-infrastruktur)
6. [Stadie 2 — CSS-variabel-system](#6-stadie-2--css-variabel-system)
7. [Stadie 3 — MUI ThemeProvider gøres dynamisk](#7-stadie-3--mui-themeprovider-gøres-dynamisk)
8. [Stadie 4 — Inputkomponenter](#8-stadie-4--inputkomponenter)
9. [Stadie 5 — Layout og UI-komponenter](#9-stadie-5--layout-og-ui-komponenter)
10. [Stadie 6 — Tabeller](#10-stadie-6--tabeller)
11. [Stadie 7 — LoginPage](#11-stadie-7--loginpage)
12. [Stadie 8 — Flash-eliminering (index.html)](#12-stadie-8--flash-eliminering-indexhtml)
13. [Hvad der ikke berøres](#13-hvad-der-ikke-berøres)
14. [Afhængigheder og rækkefølge](#14-afhængigheder-og-rækkefølge)
15. [Test-plan](#15-test-plan)
16. [Tilgængelighed og WCAG](#16-tilgængelighed-og-wcag)
17. [Arkitektoniske anbefalinger efter dark mode](#17-arkitektoniske-anbefalinger-efter-dark-mode)

---

## 1. Systemforståelse — nuværende farvestyring

Mineo har i dag en **tredelt farvestyring**, og det er kerneproblemet der gør dark mode til mere end en enkelt toggle:

| Lag | Eksempel | Status |
|---|---|---|
| **CSS-variabler** (`typography.css`/`layout.css`) | `var(--color-primary)` | Delvist brugt — godt udgangspunkt |
| **MUI ThemeProvider** (`App.tsx`) | `palette.primary.main` | Statisk oprettet én gang — skal gøres dynamisk |
| **Hardcodede hex-strenge i `sx`-props** | `backgroundColor: '#ffffff'` | Spredt i inputkomponenter, SideMenu, tabeller, Overlay — skal erstattes |

### Vigtig afgrænsning: dark mode kræver ikke først en total CSS→MUI-migration

Dark mode skal ikke gøres afhængig af, at `typography.css` og `layout.css` først migreres væk. I Mineo er CSS-laget ikke kun et tyndt stylinglag; klasserne bærer etablerede typografi- og layoutmønstre og bruges også som DOM-hooks flere steder.

Eksempelvis bruger `ContentBox.tsx` klasserne `.content-box`, `.section-header` og `.page-title` til identifikation ved fejlrapportering, og tests forventer også eksisterende klassehooks. En fuld CSS→MUI-migration er derfor et separat, større oprydningsprojekt med høj regressionsrisiko.

Dark mode bør implementeres først med målrettet centralisering af farver og dynamisk MUI-tema, mens de eksisterende CSS-klasser bevares.

### Det eksisterende mønster der skal genbruges

`fontStyleColorDebug` i `AppSettingsContext.tsx` demonstrerer den korrekte mekanisme:
1. Brugerindstilling skrives til `localStorage`
2. Et `useEffect` sætter `document.documentElement.dataset.mineoFontStyleColors = 'on'/'off'`
3. I `typography.css` overrider `:root[data-mineo-font-style-colors='on'] { ... }` CSS-variablerne

Dark mode skal følge præcis dette mønster: `data-mineo-theme='dark'` på `<html>`, med en `:root[data-mineo-theme='dark']`-blok der overrider alle farve-tokens.

### Nuværende provider-rækkefølge i App.tsx

I dag er den faktiske rækkefølge:

```
ThemeProvider (statisk tema, kender ikke settings)
  └─ AppSettingsProvider
       └─ BrowserRouter
            └─ FormPersistenceProvider
                 └─ Routes
```

Dette er korrekt som startpunkt: Stadie 3 vender rækkefølgen om ved at indføre `ThemedApp`.

### localStorage-nøgle

Settings er gemt under nøglen `'mineo_app_settings_v1'` (defineret i `appSettingsStorage.ts`). Flash-elimineringsscrptet i Stadie 8 skal bruge præcis denne nøgle.

---

## 2. Arkitekturstrategi

**Anbefalet strategi: CSS-variabel-overrides + dynamisk MUI-tema.**

Det er ikke tilstrækkeligt at kun skifte CSS-variabler, fordi MUI-komponenters interne states — hover-ripple, Tooltip-baggrund, Paper-overflader, Divider-farver — styres af MUI's interne palette og ikke af vores CSS-variabler. Derfor skal begge lag skiftes synkront.

```
brugervalg (themeMode: 'light' | 'dark')
    │
    ├─▶ document.documentElement.dataset.mineoTheme = 'dark'
    │       └─▶ :root[data-mineo-theme='dark'] CSS-variabel-overrides
    │
    └─▶ createTheme({ palette: { mode: 'dark', ... } })
            └─▶ MUI-komponenters interne states (Paper, Tooltip, Divider, hover)
```

MUI's `palette.mode: 'dark'` aktiverer automatisk MUI's interne dark mode for alle Paper-baserede surfaces (Popover, Menu, Dialog, Tooltip). Dette sparer betydelig mængde manuel styling.

### Bevidst ikke en big-bang-migration

Dark mode-projektet skal ikke samtidig forsøge at:
- slette `typography.css` og `layout.css`
- migrere alle `className`-baserede mønstre til `sx`
- gøre MUI-temaet til eneste stylingkilde for hele appen

Det ville blande to forskellige projekter sammen:
1. mørkt tema
2. total stylingkonsolidering

Det rigtige mål her er et robust dark mode-design med minimal, auditérbar ændringsflade.

---

## 3. Forudsætninger — centraliseringsopgaver

Disse ting bør rettes uanset dark mode, og gør implementeringen billigere:

### 3a. `tableTheme.ts` — hardcodede farver i JS

`src/config/tableTheme.ts` eksponerer et `tableColors`-objekt med hardcodede strenge der bruges i JS-tid:

```ts
export const tableColors = {
  border: '#e5e7eb',
  headerBackground: '#f8fafc',
  // ...
};
```

Disse kan ikke overrides via CSS-variabler når de er bagt ind i JS-objekter. **Løsning:** Ændr `getMuiTableStyles()` og `getHtmlTableStyles()` til at returnere `var(--color-table-*)` direkte i stedet for at interpolere fra `tableColors`. MUI `sx` og HTML `style`-props accepterer begge `var(--x)` strenge. Gør `tableColors` intern (fjern `export`).

**Bemærk:** `getMuiTableStyles()` bruger allerede CSS-variabler for typografi (`var(--mineo-color-grid-table-text)`, `var(--font-size-text-table)`). Mønsteret er altså etableret — udvidelsen til farve-tokens er konsistent med eksisterende kode.

### 3b. `Overlay.tsx` — lokale statusfarver

`Overlay.tsx` definerer sit eget `colors`-objekt med statusfarver (`#10B981`, `#EF4444`, `#F59E0B`, `#3B82F6`) der ikke er synkroniseret med MUI-temaets `palette.success/error/warning/info`. Disse skal erstattes med CSS-variabelreferencer (se Stadie 5).

### 3c. `SideMenu.tsx` — blanding af CSS-variabler og hardkodede strenge

SideMenu bruger allerede `var(--color-primary)` og `var(--color-text-secondary)` for ikoner, men har `backgroundColor: '#f8f9fa'` og `borderRight: '1px solid #e9ecef'` hardcodet i `sx`. Se fuldt overblik i Stadie 5.

### 3d. `typography.css` linje 206 — ét hardcodet hover-udtryk

`.MuiTypography-root.menu-item:hover` bruger `background-color: rgba(0, 0, 0, 0.04)` direkte, selvom den tilsvarende token `--color-hover` er defineret i `layout.css`. Dette skal rettes som del af Stadie 2 (ikke et selvstændigt stadie — det er én linjeskift):

```css
/* FØR */
background-color: rgba(0, 0, 0, 0.04);
/* EFTER */
background-color: var(--color-hover);
```

---

## 4. Farvepalet — light og dark

Alle tokens defineres i CSS under `:root` (light) og overrides under `:root[data-mineo-theme='dark']`.

Eksisterende tokens i `typography.css` og `layout.css` bevares uændrede. Nye tokens tilføjes.

### Eksisterende tokens (bevares, men dark-overrides tilføjes)

| Token | Light | Dark |
|---|---|---|
| `--color-primary` | `#1976d2` | `#90caf9` |
| `--color-text-primary` | `rgba(0,0,0,0.87)` | `rgba(255,255,255,0.87)` |
| `--color-text-secondary` | `rgba(0,0,0,0.6)` | `rgba(255,255,255,0.6)` |
| `--color-active-bg` | `rgba(25,118,210,0.08)` | `rgba(144,202,249,0.12)` |
| `--color-active-bg-hover` | `rgba(25,118,210,0.12)` | `rgba(144,202,249,0.18)` |
| `--color-background-white` | `#ffffff` | `#1e1e1e` |
| `--color-hover` | `rgba(0,0,0,0.04)` | `rgba(255,255,255,0.06)` |
| `--color-shadow` | `rgba(0,0,0,0.08)` | `rgba(0,0,0,0.4)` |
| `--color-border` | `rgba(0,0,0,0.08)` | `rgba(255,255,255,0.1)` |

### Nye tokens (tilføjes i `:root`, overrides i dark-blok)

**Surface og layout:**

| Token | Light | Dark | Formål |
|---|---|---|---|
| `--color-surface` | `#f8f9fa` | `#141414` | SideMenu baggrund, app-baggrund |
| `--color-surface-border` | `#e9ecef` | `rgba(255,255,255,0.1)` | SideMenu kant, Dividers |
| `--color-icon-muted` | `#6c757d` | `rgba(255,255,255,0.5)` | Hamburger-ikon, muted ikoner |
| `--color-surface-raised` | `#eef2f6` | `#2e2e2e` | ContentBox knap-baggrund |
| `--color-surface-raised-hover` | `#e4eaf2` | `#383838` | ContentBox knap-hover |

**Input-felter:**

| Token | Light | Dark | Formål |
|---|---|---|---|
| `--color-input-bg` | `#ffffff` | `#2a2a2a` | Alle inputfelters baggrund |
| `--color-input-border` | `rgba(0,0,0,0.12)` | `rgba(255,255,255,0.15)` | Normal kant |
| `--color-input-border-hover` | `rgba(0,0,0,0.25)` | `rgba(255,255,255,0.3)` | Hover kant |
| `--color-input-border-focus` | `#1976d2` | `#90caf9` | Fokus kant |
| `--color-input-border-error` | `#d32f2f` | `#ef9a9a` | Fejl kant |
| `--color-input-disabled-bg` | `rgba(0,0,0,0.035)` | `rgba(255,255,255,0.05)` | Disabled baggrund |
| `--color-input-disabled-text` | `rgba(0,0,0,0.72)` | `rgba(255,255,255,0.5)` | Disabled tekst (`-webkit-text-fill-color`) |
| `--color-input-placeholder` | `rgba(0,0,0,0.4)` | `rgba(255,255,255,0.35)` | Placeholder tekst |

**Tabeller:**

| Token | Light | Dark | Formål |
|---|---|---|---|
| `--color-table-border` | `#e5e7eb` | `rgba(255,255,255,0.1)` | Tabel-kant |
| `--color-table-header-bg` | `#f8fafc` | `#252525` | Tabel-header baggrund |
| `--color-table-row-odd` | `#f9fafb` | `#1e1e1e` | Alternerende rækker |
| `--color-table-row-even` | `#ffffff` | `#222222` | Alternerende rækker |

**Overlay / toast-notifikationer:**

| Token | Light | Dark | Formål |
|---|---|---|---|
| `--color-overlay-bg` | `rgba(255,255,255,0.95)` | `rgba(30,30,30,0.97)` | Toast baggrund |
| `--color-status-success` | `#10B981` | `#6ee7b7` | Success border/tekst |
| `--color-status-error` | `#EF4444` | `#fca5a5` | Error border/tekst |
| `--color-status-warning` | `#F59E0B` | `#fcd34d` | Warning border/tekst |
| `--color-status-info` | `#3B82F6` | `#93c5fd` | Info border/tekst |

> **Note om dark-værdier:** De mørke farver er udgangsforslag. Alle skal WCAG AA-verificeres (minimum 4.5:1 kontrast for brødtekst, 3:1 for UI-elementer). Se [Stadie 16 — Tilgængelighed og WCAG](#16-tilgængelighed-og-wcag).

---

## 5. Stadie 1 — Settings-infrastruktur

*Ingen visuel ændring. Ren infrastruktur.*

### `src/settings/appSettingsSchema.ts`

Tilføj til `appSettingsSchema`:
```ts
themeMode: z.enum(['light', 'dark']),
```

Tilføj til `DEFAULT_APP_SETTINGS`:
```ts
themeMode: 'light',
```

**`prefers-color-scheme` som default:** Dette bør implementeres. Se [Sektion 17c](#17c-overvej-prefers-color-scheme-som-default) for fuld diskussion. Hvis det implementeres, skal det gøres i `loadInitialSettings()` i `appSettingsParse.ts` (i "no stored value"-stien) — ikke i `DEFAULT_APP_SETTINGS`, da konstanten ellers får en runtime-afhængighed af `window.matchMedia` ved modul-load.

### `src/contexts/AppSettingsContext.tsx`

Tilføj et `useEffect` analogt til `fontStyleColorDebug`-mønsteret (eksisterende linje 33–37):

```ts
React.useEffect(() => {
  document.documentElement.dataset.mineoTheme = settings.themeMode;
}, [settings.themeMode]);
```

### `src/components/pages/Indstillinger.tsx`

Tilføj en toggle i sektionen "System" (eksisterende `<Typography className="section-header">System</Typography>`). Brug `StyledToggleSwitch` eller to radioknapper:
- Label: "Udseende"
- Værdier: "Lyst" / "Mørkt"
- Binding: `settings.themeMode` / `updateSettings({ themeMode: ... })`

---

## 6. Stadie 2 — CSS-variabel-system

*Definér alle tokens og opret dark-override-blokken. Ingen komponentændringer endnu.*

### `src/styles/layout.css`

Tilføj til `:root`-blokken de nye tokens fra [Sektion 4](#4-farvepalet--light-og-dark) (surface, surface-raised, surface-raised-hover, icon-muted, input-*, table-*, overlay-bg, status-*).

Tilføj ny blok i bunden:
```css
:root[data-mineo-theme='dark'] {
  /* Eksisterende tokens — dark overrides */
  --color-primary: #90caf9;
  --color-text-primary: rgba(255, 255, 255, 0.87);
  --color-text-secondary: rgba(255, 255, 255, 0.6);
  --color-active-bg: rgba(144, 202, 249, 0.12);
  --color-active-bg-hover: rgba(144, 202, 249, 0.18);
  --color-background-white: #1e1e1e;
  --color-hover: rgba(255, 255, 255, 0.06);
  --color-shadow: rgba(0, 0, 0, 0.4);
  --color-border: rgba(255, 255, 255, 0.1);

  /* Nye tokens — dark */
  --color-surface: #141414;
  --color-surface-border: rgba(255, 255, 255, 0.1);
  --color-surface-raised: #2e2e2e;
  --color-surface-raised-hover: #383838;
  --color-icon-muted: rgba(255, 255, 255, 0.5);
  --color-input-bg: #2a2a2a;
  --color-input-border: rgba(255, 255, 255, 0.15);
  --color-input-border-hover: rgba(255, 255, 255, 0.3);
  --color-input-border-focus: #90caf9;
  --color-input-border-error: #ef9a9a;
  --color-input-disabled-bg: rgba(255, 255, 255, 0.05);
  --color-input-disabled-text: rgba(255, 255, 255, 0.5);
  --color-input-placeholder: rgba(255, 255, 255, 0.35);
  --color-table-border: rgba(255, 255, 255, 0.1);
  --color-table-header-bg: #252525;
  --color-table-row-odd: #1e1e1e;
  --color-table-row-even: #222222;
  --color-overlay-bg: rgba(30, 30, 30, 0.97);
  --color-status-success: #6ee7b7;
  --color-status-error: #fca5a5;
  --color-status-warning: #fcd34d;
  --color-status-info: #93c5fd;
}
```

### `src/styles/typography.css`

Ret linje 206 (`.MuiTypography-root.menu-item:hover`) — dette er det eneste sted i `typography.css` der bruger en hardcodet hover-farve i stedet for tokenet:
```css
/* FØR */
background-color: rgba(0, 0, 0, 0.04);
/* EFTER */
background-color: var(--color-hover);
```

---

## 7. Stadie 3 — MUI ThemeProvider gøres dynamisk

*Dette er den mest strukturelle ændring og skal laves isoleret.*

### Strukturproblem i `src/App.tsx`

I dag er rækkefølgen:
```tsx
<ThemeProvider theme={theme}>        ← statisk tema, kender ikke til settings
  <AppSettingsProvider>              ← settings lever herinde
```

`ThemeProvider` skal ligge *under* `AppSettingsProvider` i komponenttræet, fordi temaet skal læse `settings.themeMode`. Løsningen er at introducere en `ThemedApp`-komponent:

```tsx
function App() {
  return (
    <AppSettingsProvider>
      <ThemedApp />
    </AppSettingsProvider>
  );
}

function ThemedApp() {
  const { settings } = useAppSettings();
  const theme = React.useMemo(() => buildTheme(settings.themeMode), [settings.themeMode]);

  return (
    <ThemeProvider theme={theme}>
      <BrowserRouter>
        {/* ... resten uændret ... */}
      </BrowserRouter>
    </ThemeProvider>
  );
}
```

### `buildTheme`-funktionen

Udskil tema-konfigurationen til en ren funktion. Den nuværende `theme`-konstant i `App.tsx` (oprettet med `createTheme()` én gang ved modul-load) erstattes af denne funktion. Funktionen kan ligge i `src/config/appTheme.ts` eller direkte i `App.tsx`:

```ts
const lightPalette = {
  mode: 'light' as const,
  primary: { main: '#1976d2' },
  secondary: { main: '#dc004e' },
  text: {
    primary: 'rgba(0, 0, 0, 0.87)',
    secondary: 'rgba(0, 0, 0, 0.6)',
  },
};

const darkPalette = {
  mode: 'dark' as const,
  primary: { main: '#90caf9' },
  secondary: { main: '#f48fb1' },
  text: {
    primary: 'rgba(255, 255, 255, 0.87)',
    secondary: 'rgba(255, 255, 255, 0.6)',
  },
  background: {
    default: '#141414',
    paper: '#1e1e1e',
  },
};

const buildTheme = (mode: 'light' | 'dark') =>
  createTheme({
    palette: mode === 'dark' ? darkPalette : lightPalette,
    typography: { /* uændret fra nuværende App.tsx */ },
    components: { /* uændret fra nuværende App.tsx */ },
  });
```

`palette` og `typography` og `components`-blokkene kopieres fra den eksisterende `createTheme()`-konfiguration i `App.tsx` — ingen logik fjernes, kun `mode` og baggrunde tilføjes til dark-varianten.

MUI's `palette.mode: 'dark'` og `background.paper: '#1e1e1e'` styrer automatisk Popover, Menu, Dialog, Tooltip og andre Paper-baserede surfaces.

**Kritisk note:** Ændringen af `ThemeProvider`-placeringen er strukturel. Lav den isoleret, verificer at appen starter korrekt og at alle sider fungerer, inden de næste stadier påbegyndes.

**Vigtig note om debug-farver:** `App.tsx` bruger i dag CSS-variablerne `--mineo-color-mui-typography-default` og `--mineo-color-input-text` i temaet. Det mønster kan bevares i første dark mode-implementering. Der er ingen gevinst i at redesigne hele debug-farvesystemet som del af dark mode, så længe dark mode-farverne skifter korrekt og debug-mekanismen fortsat virker.

---

## 8. Stadie 4 — Inputkomponenter

### `src/components/inputs/StyledTextFieldBase.tsx`

Alle hardcodede farver i `sx`-blokken (linje 331–386) erstattes med CSS-variabler:

| FØR | EFTER |
|---|---|
| `backgroundColor: '#ffffff'` | `backgroundColor: 'var(--color-input-bg)'` |
| `borderColor: 'rgba(0, 0, 0, 0.12)'` | `borderColor: 'var(--color-input-border)'` |
| `borderColor: 'rgba(0, 0, 0, 0.25)'` (hover) | `borderColor: 'var(--color-input-border-hover)'` |
| `borderColor: '#1976d2'` (focused) | `borderColor: 'var(--color-input-border-focus)'` |
| `backgroundColor: 'rgba(0, 0, 0, 0.035)'` (disabled) | `backgroundColor: 'var(--color-input-disabled-bg)'` |
| `borderColor: 'rgba(0, 0, 0, 0.28)'` (disabled) | `borderColor: 'var(--color-input-border)'` (samme token, oplevet kontrast er tilstrækkelig) |
| `WebkitTextFillColor: 'rgba(0, 0, 0, 0.72)'` (disabled) | `WebkitTextFillColor: 'var(--color-input-disabled-text)'` |
| `color: 'rgba(0, 0, 0, 0.4)'` (placeholder) | `color: 'var(--color-input-placeholder)'` |
| `borderColor: '#d32f2f'` (error) | `borderColor: 'var(--color-input-border-error)'` |

### `src/components/inputs/StyledDropdown.tsx`

`StyledDropdown.tsx` har sin egen sæt hardcodede farver analogt med `StyledTextFieldBase` — de skal rettes parallelt:

| FØR | EFTER |
|---|---|
| `backgroundColor: '#ffffff'` (linje ~501) | `backgroundColor: 'var(--color-input-bg)'` |
| `borderColor: 'rgba(0,0,0,0.12)'` | `borderColor: 'var(--color-input-border)'` |
| `borderColor: 'rgba(0,0,0,0.25)'` (hover) | `borderColor: 'var(--color-input-border-hover)'` |
| `borderColor: '#1976d2'` (focused) | `borderColor: 'var(--color-input-border-focus)'` |
| `color: 'rgba(0,0,0,0.4)'` (placeholder) | `color: 'var(--color-input-placeholder)'` |
| `'rgba(25, 118, 210, 0.08)'` (selected option bg) | `'var(--color-active-bg)'` |
| `'rgba(25, 118, 210, 0.12)'` (selected option hover) | `'var(--color-active-bg-hover)'` |

### Øvrige inputkomponenter

Undersøg disse filer for egne `sx`-farver (nogle delegerer til `StyledTextFieldBase` og arver rettelserne automatisk):
- `src/components/inputs/StyledDateField.tsx`
- `src/components/inputs/StyledTextAreaBase.tsx`
- `src/components/inputs/StyledCheckbox.tsx`
- `src/components/inputs/StyledToggleSwitch.tsx`
- `src/components/inputs/StyledRadioButton.tsx`

Checkbox, toggle og radio bruger MUI-komponenter der reagerer på `palette.mode` — verificér visuelt, ret kun hvis nødvendigt.

---

## 9. Stadie 5 — Layout og UI-komponenter

### `src/components/layout/SideMenu.tsx`

| Linje | FØR | EFTER |
|---|---|---|
| 129 | `backgroundColor: '#f8f9fa'` | `backgroundColor: 'var(--color-surface)'` |
| 130 | `borderRight: '1px solid #e9ecef'` | `borderRight: '1px solid var(--color-surface-border)'` |
| 154, 163 | `color: '#6c757d'` | `color: 'var(--color-icon-muted)'` |
| 158 | `backgroundColor: 'rgba(0, 0, 0, 0.04)'` | `backgroundColor: 'var(--color-hover)'` |
| 172, 216, 259 | `borderColor: '#e9ecef'` (Divider) | `borderColor: 'var(--color-surface-border)'` |

### `src/components/layout/Container.tsx`

Filen har `backgroundColor: '#f8f9fa'` hardcodet. Erstat med `var(--color-surface)`.

### `src/components/ui/ContentBox.tsx`

| FØR | EFTER |
|---|---|
| `backgroundColor: '#eef2f6'` (knap-baggrund) | `backgroundColor: 'var(--color-surface-raised)'` |
| `backgroundColor: '#e4eaf2'` (knap-hover) | `backgroundColor: 'var(--color-surface-raised-hover)'` |
| `border: '1px solid rgba(0, 0, 0, 0.08)'` (kant) | `border: '1px solid var(--color-border)'` |

### `src/components/ui/Overlay.tsx`

Erstat `colors`-objektet (linje 69–90) med CSS-variabelreferencer via inline `var(--x)`-strenge. Den simpleste løsning:

```tsx
// FØR: inline objektlookup med hardcodede hex
const colors = { success: { bg: 'rgba(255,255,255,0.95)', border: '#10B981', ... } };

// EFTER: CSS-variabel-strenge direkte
const colorVars = {
  success: { bg: 'var(--color-overlay-bg)', border: 'var(--color-status-success)', text: 'var(--color-status-success)' },
  error:   { bg: 'var(--color-overlay-bg)', border: 'var(--color-status-error)',   text: 'var(--color-status-error)'   },
  warning: { bg: 'var(--color-overlay-bg)', border: 'var(--color-status-warning)', text: 'var(--color-status-warning)' },
  info:    { bg: 'var(--color-overlay-bg)', border: 'var(--color-status-info)',    text: 'var(--color-status-info)'    },
};
```

**Bemærk:** `Overlay.tsx` bruger `Typography variant="text"`. Det er en eksisterende variant-udvidelse i projektet. Dark mode-projektet skal ikke samtidig forsøge at ændre variant-systemet her; fokus er kun farverne.

---

## 10. Stadie 6 — Tabeller

### `src/config/tableTheme.ts`

Fjern `export` fra `tableColors` (gøres intern). Ændr `getMuiTableStyles()` og `getHtmlTableStyles()` til at bruge CSS-variabler direkte — dette er konsistent med den eksisterende brug af `var(--mineo-color-grid-table-text)` og `var(--font-size-text-table)` i funktionerne:

```ts
// FØR
border: `1px solid ${tableColors.border}`,
'& thead th': { backgroundColor: tableColors.headerBackground, ... }

// EFTER
border: '1px solid var(--color-table-border)',
'& thead th': { backgroundColor: 'var(--color-table-header-bg)', ... }
```

Tilsvarende for `htmlTableHeaderStyles` og alternerende rækkebaggrunde.

`sortPrimaryColor: '#1976d2'` → `'var(--color-primary)'`
`sortSecondaryColor: 'rgba(0, 0, 0, 0.45)'` → `'var(--color-text-secondary)'`

**Anbefaling:** I dark mode-projektet er det mere hensigtsmæssigt at holde `tableTheme.ts` på CSS-variabler end at refaktorere alle kaldesteder til at sende `theme` rundt. Tabellerne er et godt eksempel på et sted, hvor CSS-variabler er en lav-risiko bro mellem eksisterende styling og nyt tema.

---

## 11. Stadie 7 — LoginPage

`src/components/pages/LoginPage.tsx` har 13 hardcodede farver (gradients, brand-farver). Denne side vises sjældent (kun ved PWA-login) og har lav prioritet.

Ret som selvstændig opgave efter de øvrige stadier er verificeret.

---

## 12. Stadie 8 — Flash-eliminering (index.html)

*Lav prioritet, men billig og meget synlig forbedring. Anbefales implementeret som del af dark mode-projektet.*

Uden dette stadie starter appen altid i light mode og skifter til dark mode i Reacts første render-cyklus — dette giver et synligt blink (FOUC) ved genindlæsning og PWA-opstart for brugere der foretrækker dark mode.

### `index.html`

Tilføj et inline script-tag i `<head>` *før* stylesheet-links — scriptet kører synkront, sætter `data-mineo-theme` på `<html>`, og stopper FOUC:

```html
<script>
  (function () {
    try {
      var raw = localStorage.getItem('mineo_app_settings_v1');
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && parsed.themeMode === 'dark') {
          document.documentElement.dataset.mineoTheme = 'dark';
        }
      }
    } catch (e) {}
  })();
</script>
```

**Vigtige noter:**
- Nøglen `'mineo_app_settings_v1'` er den faktiske localStorage-nøgle fra `appSettingsStorage.ts`. Hvis nøglen ændres i fremtiden, skal scriptet opdateres.
- Scriptet bruger bevidst ikke Zod-validering — det er en præsentationsoptimering, ikke en kilde til state. Worst case (parse-fejl, korrupt data) falder det stille tilbage til light mode.
- Scriptet er ~200 bytes og har ingen runtime-afhængigheder.

---

## 13. Hvad der ikke berøres

- **PDF-generering** (`src/pdf/**`) — PDF-farver er statiske, enhedsspecifikke og uafhængige af UI-temaet. De må ikke ændres.
- **Beregningslogik, Zod-schemas, formattering** — ingen farver.
- **`src/styles/index.css`** — kun reset og font-imports.
- **`src/contracts/`** — ingen UI-afhængigheder.
- **Større stylingmigration væk fra CSS-klasser** — ikke del af dette projekt.

**Bemærk om tests:** Dark mode ændrer ikke beregningsinvarianter, men eksisterende UI-tests kan stadig blive påvirket hvis stylingklasser eller markup ændres utilsigtet. Bevar derfor eksisterende klasse-hooks medmindre de bevidst flyttes i et separat projekt.

---

## 14. Afhængigheder og rækkefølge

```
Stadie 1  ──▶  Settings-infrastruktur
               (schema + context useEffect + Indstillinger UI)
    │
    ▼
Stadie 2  ──▶  CSS-variabel-system
               (nye tokens i :root + dark-override-blok
                + typography.css linje 206)
    │
    ▼
Stadie 3  ──▶  MUI ThemeProvider gøres dynamisk
               (ThemedApp + buildTheme — strukturel ændring i App.tsx)
    │
    ├────────────────────────────────┐
    ▼                                ▼
Stadie 4                          Stadie 5
Inputkomponenter                  Layout + UI
(StyledTextFieldBase,             (SideMenu, Container,
 StyledDropdown m.fl.)             ContentBox, Overlay)
    │                                │
    └────────────┬───────────────────┘
                 ▼
             Stadie 6
             Tabeller
             (tableTheme.ts)
                 │
                 ▼
             Stadie 7          Stadie 8
             LoginPage    ──   Flash-eliminering
             (lav prior.)      (index.html)
```

Stadie 4, 5 og 6 kan paralleliseres når Stadie 3 er på plads. Stadie 7 og 8 er uafhængige af hinanden og kan laves i vilkårlig rækkefølge.

---

## 15. Test-plan

### Visuel smoke-test (efter hvert stadie)
- Skift til dark mode i Indstillinger og verificer at:
  - Ingen hvide "lyslæk" er synlige (hvide baggrunde der ikke er skiftet)
  - Ingen sorte "huller" (sort tekst på mørk baggrund)
  - Menuen, inputfelter, tabeller, toast-notifikationer og content-boksene ser korrekte ud

### Kontrast-check (WCAG AA)
Se [Sektion 16](#16-tilgængelighed-og-wcag).

### Regressions-check (lys mode)
Lys mode skal se identisk ud med pre-implementation. Sammenlign side-by-side screenshots.

### Funktionel check
- Skift theme → reload → verificer at præference persisteres (localStorage)
- Åbn i nyt vindue → verificer at dark mode er aktiv fra start (ikke flash of light mode, efter Stadie 8)
- Verificer at PDF-output er uændret i begge modes

### Eksisterende tests
Kør `npx vitest run` efter hvert stadie. Ingen beregningstest bør brydes.

### Dokumentationscheck mod faktisk kode

Inden hvert stadie påbegyndes:
- verificér at de nævnte filer og mønstre stadig findes i den aktuelle kodebase
- verificér at ingen klasse eller CSS-variabel i planen samtidig bruges som DOM-hook eller i tests

Dark mode-planen må følge koden, ikke omvendt.

---

## 16. Tilgængelighed og WCAG

Dark mode er ikke blot æstetik — dårlig dark mode er en tilgængeligheds-regression. Mineo bruges til at behandle sager med juridisk og økonomisk betydning; læsbarhed er kritisk.

**Minimumskrav:**
- Tekstkontrast ≥ 4.5:1 for brødtekst (WCAG AA)
- UI-elementkontrast ≥ 3:1 for inputkanter, ikoner, knapper (WCAG AA)
- Fokus-indikatorer skal forblive synlige i dark mode

**Anbefalede værktøjer:**
- Chrome DevTools → Accessibility → Color contrast (klik på et element)
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) til at tjekke specifikke par
- Firefox Accessibility Inspector

**Tokens der særligt skal verificeres i dark mode:**

| Token-par | Minimum ratio |
|---|---|
| `--color-text-primary` på `--color-background-white` | 4.5:1 |
| `--color-text-secondary` på `--color-background-white` | 4.5:1 |
| `--color-text-primary` på `--color-surface` (SideMenu) | 4.5:1 |
| `--color-input-placeholder` på `--color-input-bg` | 3:1 (vejledende) |
| `--color-input-disabled-text` på `--color-input-disabled-bg` | 3:1 |
| `--color-status-*` på `--color-overlay-bg` | 4.5:1 |

De foreslåede dark-værdier i [Sektion 4](#4-farvepalet--light-og-dark) er udgangspunkter — juster dem til at opfylde WCAG AA, ikke omvendt.

---

## 17. Arkitektoniske anbefalinger efter dark mode

Dette afsnit beskriver forbedringer, der er relevante **efter** dark mode er implementeret stabilt. De er ikke forudsætninger.

---

### 17a. Stop for ny styling i CSS-klasser

Efter dark mode-projektet bør ny UI-kode som udgangspunkt ikke introducere nye generelle stylingklasser i `typography.css` eller `layout.css`.

Anbefalet praksis:
- eksisterende klasser beholdes hvor de allerede er udbredt
- nye komponent-specifikke justeringer skrives med `sx`
- nye farver tilføjes som centrale tokens, ikke som lokale hex-strenge

Dette giver gradvis konsolidering uden at udløse et stort migrationsprojekt.

---

### 17b. Eliminer "flash of light mode" med inline theme-initialisering

Dette er implementeret som **Stadie 8** i denne guide. Se [Stadie 8](#12-stadie-8--flash-eliminering-indexhtml) for detaljer og det konkrete inline-script.

---

### 17c. Overvej `prefers-color-scheme` som default

**Nuværende situation:**

Mineo starter altid i light mode. Brugere der har sat deres OS til dark mode skal manuelt skifte i Indstillinger.

**Den anbefalede ændring:**

Brug `prefers-color-scheme` som fallback når ingen eksplicit præference er gemt. Implementér det i `loadInitialSettings()` i `appSettingsParse.ts` som en del af "no stored value"-stien — ikke i `DEFAULT_APP_SETTINGS`, da konstanten ellers får en runtime-afhængighed af `window.matchMedia` ved modul-load:

```ts
const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
return { ...DEFAULT_APP_SETTINGS, themeMode: systemPrefersDark ? 'dark' : 'light' };
```

**Gevinsten:** Brugere der allerede har valgt dark mode i deres OS, får den forventede standardoplevelse uden manuel opsætning.

---

### 17d. Overvej `AppShellProvider`, men kun hvis det reelt forenkler

`ThemedApp`-mønstret i Stadie 3 er sandsynligvis tilstrækkeligt. En yderligere `AppShellProvider` bør kun indføres hvis den konkrete kode efter implementeringen bliver tydeligt enklere og mere auditérbar.

Dark mode-projektet skal ikke automatisk udløse en ekstra provider-abstraktion.

---

### Prioritering

| Anbefaling | Gevinst | Omkostning | Timing |
|---|---|---|---|
| **Stadie 8** — Flash-elimineringsscript | Høj (UX) | Meget lav (20 linjer) | Lav ved dark mode |
| **17c** — `prefers-color-scheme` default | Medium (UX) | Meget lav (5 linjer) | Lav ved dark mode |
| **17d** — `AppShellProvider` | Lav til medium (arkitektur) | Lav | Kun hvis behovet opstår |
| **17a** — Stop for ny generel CSS-styling | Medium (langsigtet oprydning) | Lav | Fra første nye UI-ændring efter dark mode |

**Stadie 8** og **17c** bør implementeres som del af dark mode-projektet. **17d** er valgfri. **17a** er en god kodepolitik efterfølgende. En total CSS→MUI-migration er ikke en del af denne anbefaling.
