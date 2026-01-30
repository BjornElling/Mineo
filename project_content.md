# 📄 MINEO PROJECT CONTEXT

Dette dokument indeholder **komplet kontekst** om MINEO-projektet til brug i fremtidige AI-samtaler.

**Sidst opdateret**: 2025-12-13
**Version**: 0.1.0 (MVP Under udvikling - TypeScript migration gennemført)

---

## 🎯 PROJEKT OVERSIGT

### Grundlæggende information
- **Projektnavn**: MINEO Erstatningsberegner
- **Type**: React web-applikation (open source)
- **Formål**: Browser-baseret dansk erstatningsberegner for EAL og ASL sager
- **Målgruppe**: Advokater og sagsbehandlere
- **Licens**: MIT (100% open source)
- **Repository**: https://github.com/bjorn-elling/mineo
- **Lokal placering**: `C:\Users\bjell\Mineo\`

### Om projektet
MINEO er en moderne React-baseret web-applikation til beregning af erstatningsopgørelser. Programmet kører direkte i browseren uden behov for installation, hvilket gør det nemt tilgængeligt for advokater og sagsbehandlere.

---

## 🏗️ TEKNISK STACK

### Core teknologier
```json
{
  "framework": "React 18.3.1",
  "language": "TypeScript 5.7.2",
  "build_tool": "Vite 7.2.2 med SWC plugin",
  "ui_framework": "Material-UI (MUI) v7.2.0",
  "routing": "React Router v7.6.4",
  "pdf_generation": "jsPDF 2.5.2 + jspdf-autotable 3.8.4",
  "package_manager": "npm",
  "styling": "Emotion (CSS-in-JS) + Montserrat font fra Google Fonts"
}
```

### TypeScript konfiguration
- Strikt type-checking aktiveret
- Native TypeScript typer erstatter JSDoc
- Centraliserede type definitions i `src/types/common.ts`
- Type-safe hooks og komponenter

### Alle dependencies er kommercielt-venlige
- ✅ Alle har MIT eller kompatible open source licenser
- ✅ Ingen proprietære dependencies
- ✅ 100% open source stack

---

## 📁 AKTUEL MAPPESTRUKTUR

```
mineo/
├── public/
│   ├── favicon.svg                       # Favicon
│   └── manifest.json                     # Web app manifest
│
├── src/
│   ├── main.tsx                          # React Router entry point
│   ├── App.tsx                           # Router-konfiguration og MUI tema
│   │
│   ├── types/                            # TypeScript type definitions
│   │   ├── common.ts                     # Centrale type definitions
│   │   ├── mui.d.ts                      # MUI theme extensions
│   │   └── file-system-access.d.ts       # File System Access API typer
│   │
│   ├── components/
│   │   ├── common/                       # Genbrugelige komponenter
│   │   │   ├── ContentBox.tsx            # Standardiserede white box containere
│   │   │   ├── FieldLabel.tsx            # Feltlabels med konsistent styling
│   │   │   ├── FieldRow.tsx              # Række-container til felter
│   │   │   └── SectionHeader.tsx         # Sektionsoverskrifter
│   │   │
│   │   ├── inputs/                       # Input-komponenter med centraliseret styling
│   │   │   ├── StyledTextField.tsx       # Basis tekstfelt (auto-trim, floating errors)
│   │   │   ├── StyledDateField.tsx       # Intelligent dato-felt (dd-mm-åååå)
│   │   │   ├── StyledWeekField.tsx       # Ugefelt (uu/åååå)
│   │   │   ├── StyledYearField.tsx       # Årsfelt med 4-cifret validering
│   │   │   ├── StyledDropdown.tsx        # Dropdown med inherited styling
│   │   │   ├── StyledIntegerField.tsx    # Heltal med min/max validering
│   │   │   ├── StyledAmountField.tsx     # Beløbsfelt med dansk formatering
│   │   │   ├── StyledPercentField.tsx    # Procentfelt med 2 decimaler
│   │   │   ├── StyledRadioButton.tsx     # Radioknapper
│   │   │   ├── StyledToggleSwitch.tsx    # Toggle switch
│   │   │   ├── StyledFractionField.tsx   # Brøkfelt med validering
│   │   │   └── table/                    # Tabel-input komponenter
│   │   │       ├── TableAmountInput.tsx  # Beløb i tabeller
│   │   │       ├── TableDateInput.tsx    # Dato i tabeller
│   │   │       ├── TableIntegerInput.tsx # Heltal i tabeller
│   │   │       ├── TableWeekInput.tsx    # Uge i tabeller
│   │   │       └── TableYearInput.tsx    # År i tabeller
│   │   │
│   │   ├── tables/                       # Tabelkomponenter
│   │   │   └── AarsloenTable.tsx         # Årsløntabel med AG Grid
│   │   │
│   │   ├── ui/                           # UI-komponenter
│   │   │   └── Overlay.tsx               # Overlay til dialogs
│   │   │
│   │   ├── layout/                       # Layout-komponenter
│   │   │   ├── MainLayout.tsx            # Hovedlayout med side-menu
│   │   │   ├── SideMenu.tsx              # Navigationsmenu til venstre
│   │   │   └── Container.tsx             # Indholdscontainer med tab-navigation
│   │   │
│   │   └── pages/                        # Side-komponenter
│   │       ├── Stamdata.tsx              # Grunddata (skadedato, skadevolder, etc.)
│   │       ├── Aarsloen.tsx               # Årslønsberegning med tabel og SH-dage
│   │       ├── Erhvervsevnetab.tsx       # Erhvervsevnetabsberegning
│   │       ├── Satser.tsx                # Lovregulerede satser
│   │       ├── Renteberegning.tsx        # Renteberegning med tabs og tabeller
│   │       ├── Erstatningsopgoerelse.tsx # Erstatningsopgørelser og PDF-export
│   │       ├── Indstillinger.tsx         # Indstillinger og præferencer
│   │       └── Om.tsx                    # Om-siden med projektinfo
│   │
│   ├── contexts/                         # React contexts
│   │   └── FormPersistenceContext.tsx    # Gem/hent data til localStorage
│   │
│   ├── hooks/                            # Custom React hooks (type-safe)
│   │   ├── useFieldBehavior.ts           # Fælles feltadfærd
│   │   ├── useFormulaField.ts            # Formel-evaluering i felter
│   │   ├── usePersistedForm.ts           # Form persistence med generics
│   │   └── useTableNavigation.ts         # Tabel-navigation
│   │
│   ├── config/                           # Konfigurationsfiler
│   │   ├── dateRanges.ts                 # Centraliseret dato-konfiguration
│   │   ├── tableTheme.ts                 # Tabel-styling konfiguration
│   │   └── version.ts                    # Auto-genereret versionsnummer
│   │
│   ├── data/                             # Datafiler med lovregulerede satser
│   │   ├── interestRates.ts              # Referencesatser og tillægssatser (2005-2025)
│   │   └── regulationRates.ts            # Lovregulerede satser (2008-2025)
│   │
│   ├── utils/                            # Hjælpefunktioner (type-safe)
│   │   ├── aarsloenBeregning.ts          # Årslønsberegninger
│   │   ├── aarsloenDataConverter.ts      # Konvertering af årslønsdata
│   │   ├── dataCollection.ts             # Indsamling af data til opgørelser
│   │   ├── dataValidator.ts              # Validering af data
│   │   ├── dateUtils.ts                  # Dato-hjælpefunktioner
│   │   ├── dateValidation.ts             # Dato-validering
│   │   ├── encryption.ts                 # Kryptering af .eo filer
│   │   ├── eoConverters.ts               # Konvertering til/fra .eo format
│   │   ├── fileHandleStorage.ts          # File handle storage
│   │   ├── fileHelpers.ts                # Fil-hjælpefunktioner
│   │   ├── fileLoad.ts                   # Indlæsning af filer
│   │   ├── fileSave.ts                   # Gem filer
│   │   ├── fileSystemAccess.ts           # File System Access API
│   │   ├── formatUtils.ts                # Formatering af data
│   │   ├── formulaEvaluator.ts           # Evaluering af matematiske formler
│   │   ├── inputValidation.ts            # Input-validering
│   │   ├── interestCalculator.ts         # Renteberegninger
│   │   ├── logger.ts                     # Logging
│   │   ├── periodeBeregning.ts           # Periode-beregninger
│   │   ├── shDageBeregning.ts            # SH-dage beregninger
│   │   └── pdf/                          # PDF-generering
│   │       ├── pdfConfig.ts              # PDF-konfiguration
│   │       ├── pdfFormatters.ts          # PDF-formatering
│   │       ├── pdfHelpers.ts             # PDF-hjælpefunktioner
│   │       ├── pdfLoader.ts              # PDF-loader (fontindlæsning)
│   │       ├── aarsloenPdf.ts            # Årsløn-PDF generering
│   │       ├── rentePdf.ts               # Rente-PDF generering
│   │       ├── satserPdf.ts              # Satser-PDF generering
│   │       └── shDagePdf.ts              # SH-dage-PDF generering
│   │
│   └── styles/                           # CSS og styling
│       ├── index.css                     # Globale styles med Montserrat font
│       └── typography.css                # Typography CSS variables
│
├── scripts/
│   └── generate-version.js               # Auto-versionering ved commit
│
├── node_modules/                         # Dependencies (gitignored)
│
├── .gitignore                            # Git ignore-fil
├── .husky/                               # Git hooks (pre-commit)
│   └── pre-commit                        # Kører auto-versionering
│
├── index.html                            # HTML template
├── vite.config.ts                        # Vite konfiguration med SWC
├── tsconfig.json                         # TypeScript konfiguration
├── package.json                          # NPM dependencies
├── package-lock.json                     # NPM lockfile
│
├── README.md                             # Projekt README
├── LICENSE                               # MIT License
├── CLAUDE.md                             # AI instruktioner (inkl. TypeScript retningslinjer)
└── project_content.md                    # Dette dokument
```

---

## 🎨 DESIGN-SYSTEM OG KOMPONENTER

### Centraliserede komponenter
Alle UI-komponenter skal bruge de centraliserede versioner for konsistent styling.

**Input komponenter:**
- StyledTextField - Basis tekstfelt
- StyledDateField - Dato-felt (dd-mm-åååå)
- StyledWeekField - Ugefelt (uu/åååå)
- StyledYearField - Årsfelt
- StyledDropdown - Dropdown
- StyledIntegerField - Heltal
- StyledAmountField - Beløb
- StyledPercentField - Procent
- StyledRadioButton - Radioknapper
- StyledToggleSwitch - Toggle switch

**Tabel input komponenter:**
- TableAmountInput - Beløb i tabeller
- TableDateInput - Dato i tabeller
- TableIntegerInput - Heltal i tabeller
- TableWeekInput - Uge i tabeller
- TableYearInput - År i tabeller

**Layout komponenter:**
- ContentBox - Standardiserede containere
- FieldLabel - Feltlabels
- FieldRow - Række-container
- SectionHeader - Sektionsoverskrifter

**Tabel komponenter:**
- AarsloenTable - Årsløntabel med AG Grid

**UI komponenter:**
- Overlay - Overlay til dialogs

#### StyledTextField (basis komponent)
```javascript
import StyledTextField from '../inputs/StyledTextField';

<StyledTextField
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Indtast tekst"
  width={220}
/>
```

**Features**:
- Auto-trim ved blur (fjerner mellemrum før/efter)
- Placeholder forsvinder ved fokus
- Floating error messages (absolut positioneret, påvirker ikke layout)
- Moderne, fladt design med afrundede hjørner (10px)
- Konsistent styling på tværs af hele appen
- Basis for alle andre input-komponenter

#### StyledDateField
```javascript
import StyledDateField from '../inputs/StyledDateField';

<StyledDateField
  value={dato}
  onChange={(e) => setDato(e.target.value)}
  minDate="2005-01-01"
  maxDate="2025-12-31"
  width={160}
/>
```

**Features**:
- Format: dd-mm-åååå (dansk dato-format)
- Accepterer separatorer: - . : mellemrum (konverteres automatisk til -)
- Auto-padding: "1-1-1" → "01-01-1" når separator indtastes
- Intelligent år-fortolkning ved blur:
  - 1 ciffer → 200x (f.eks. "5" → 2005)
  - 2 cifre → smart fortolkning (f.eks. "24" → 2024, "95" → 1995)
  - 3 cifre → fejl (ugyldig)
  - 4 cifre → bruges direkte
- Real-time validering:
  - Dag: 1-31 (afhængigt af måned)
  - Måned: 1-12
  - Skudår-logik for februar
  - Min/max dato-interval
- Floating error messages (påvirker ikke layout)
- Rød kant ved fejl (både under indtastning og ved blur)

#### StyledIntegerField
```javascript
import StyledIntegerField from '../inputs/StyledIntegerField';

<StyledIntegerField
  value={value}
  onChange={(e) => setValue(e.target.value)}
  minValue={1}
  maxValue={100}
  width={120}
  placeholder="1-100"
/>
```

**Features**:
- Accepterer kun tal (0-9)
- Min/max validering med fejlmeddelelse
- Tømmer automatisk værdien 0 ved blur
- Floating error message ved out-of-range

#### StyledAmountField
```javascript
import StyledAmountField from '../inputs/StyledAmountField';

<StyledAmountField
  value={value}
  onChange={(e) => setValue(e.target.value)}
  width={160}
  placeholder="0,00"
/>
```

**Features**:
- Dansk formatering: tusindtalsseparator (.) og komma (,) decimalseparator
- Maksimalt 2 decimaler (hård afskæring, ingen afrunding)
- Auto-formatering ved blur: "1234,5" → "1.234,50"
- Fjerner 0 og negative værdier ved blur
- Kun positive beløb tilladt

#### StyledPercentField
```javascript
import StyledPercentField from '../inputs/StyledPercentField';

<StyledPercentField
  value={value}
  onChange={(e) => setValue(e.target.value)}
  width={120}
  placeholder="0,00"
/>
```

**Features**:
- Maksimalt 2 decimaler
- Auto-formatering ved blur: "5,5" → "5,50"
- Dansk decimal-separator (komma)

#### StyledDropdown
```javascript
import StyledDropdown from '../inputs/StyledDropdown';
import { MenuItem } from '@mui/material';

<StyledDropdown
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Vælg mulighed"
  width={200}
>
  <MenuItem value="option1">Mulighed 1</MenuItem>
  <MenuItem value="option2">Mulighed 2</MenuItem>
</StyledDropdown>
```

**Features**:
- Arver styling fra StyledTextField
- Placeholder vises indtil værdi vælges
- Delete/Backspace sletter valgt værdi

#### ContentBox
```javascript
import ContentBox from '../common/ContentBox';

<ContentBox width={1000}>
  {/* Indhold */}
</ContentBox>
```

**Features**:
- Hvid baggrund (#ffffff)
- Afrundede hjørner (20px)
- Subtle shadow og border (rgba(0, 0, 0, 0.08))
- Konsistent padding (40px 32px)
- Konsistent margin (40px 0)
- Standard bredde: 1000px (kan customizes)

### Typography
Defineret i `src/styles/globals.css`:

- **Font**: Montserrat (alle weights 100-900, Regular og Italic) via Google Fonts
- **Page title** (.page-title): 34px, font-weight 500, margin-bottom 40px
- **Section header** (.section-header): 18px, font-weight 500, margin-bottom 28px
- **Field labels** (.field-label): 14px, font-weight 500
- **Body text** (.body-text): 16px, line-height 1.6
- **Body text secondary** (.body-text-secondary): 16px, color: rgba(0,0,0,0.7)

### Farver
- **Background**: #f8f9fa (light gray)
- **White boxes**: #ffffff
- **Text primary**: #000000
- **Border**: rgba(0, 0, 0, 0.12)
- **Border hover**: rgba(0, 0, 0, 0.25)
- **Focus blue**: #1976d2
- **Error red**: #d32f2f

---

## 🔑 KRITISKE DESIGNBESLUTNINGER

### 1. Centraliseret dato-konfiguration
**Problem**: Alle dato-felter skulle opdateres hvert år.

**Løsning**: `src/config/dateRanges.js`

```javascript
export const MAX_YEAR = 2025;
export const MIN_SKADESDATO = '2005-01-01';
export const TODAY = new Date().toISOString().split('T')[0];

export const dateRanges = {
  skadesdato: {
    min: MIN_SKADESDATO,
    max: TODAY,
    placeholder: 'dd-mm-åååå'
  }
};
```

**Årlig opdatering** (kun 3 filer skal ændres):
1. Åbn `src/config/dateRanges.js` → Opdater `MAX_YEAR`
2. Åbn `src/data/interestRates.js` → Tilføj nye rentesatser
3. Åbn `src/data/regulationRates.js` → Tilføj nye lovregulerede satser
4. Færdig! Alle felter opdateret på tværs af hele appen

### 2. Tab-navigation trap
**Problem**: Tab skulle ikke hoppe ud af indholdsvinduet til sidemenu.

**Løsning**: `Container.jsx` fanger Tab/Shift+Tab og holder fokus inden for containeren.

**Implementering**:
- `onKeyDown` handler i Container
- Find alle fokuserbare elementer
- Tab fra sidste → hop til første
- Shift+Tab fra første → hop til sidste

### 3. Floating error messages
**Problem**: Fejlmeddelelser gjorde containere højere.

**Løsning**: Absolut positionering af fejlmeddelelser
```css
'& .MuiFormHelperText-root': {
  position: 'absolute',
  bottom: '-20px',
  left: '0',
  margin: '0',
  whiteSpace: 'nowrap',
  overflow: 'visible'
}
```

### 4. Centraliserede komponenter (DRY)
**Problem**: Styling var spredt over mange filer.

**Løsning**:
- StyledTextField som basis for alle input-komponenter
- StyledDateField arver fra StyledTextField
- StyledDropdown arver fra StyledTextField
- StyledIntegerField arver fra StyledTextField
- StyledAmountField arver fra StyledTextField
- StyledPercentField arver fra StyledTextField
- ContentBox for alle containere
- Ændringer ét sted slår igennem overalt

### 5. Auto-versionering via Git hooks
**Problem**: Versionsnummer skulle opdateres manuelt.

**Løsning**: Husky pre-commit hook
- `scripts/generate-version.js` tæller git commits
- Genererer `src/config/version.ts` automatisk
- Format: `0.0.X` hvor X er antal commits
- Køres automatisk ved hver commit

---

## 📋 KODESTANDARDER

### Filnavngivning
```
Komponenter:     PascalCase.jsx    → Stamdata.jsx
Hooks:           camelCase.js      → useStorTabel.js
Utils:           camelCase.js      → dateUtils.js
Config:          camelCase.js      → dateRanges.js
Styles:          camelCase.css     → typography.css
```

### Kommentarer og sprog
- **Kode**: Dansk
- **Variable**: Dansk (camelCase)
- **Kommentarer**: Dansk
- **JSDoc**: Engelsk (valgfrit)
- **UI-tekster**: Dansk

### Imports
```javascript
// 1. React
import React, { useState } from 'react';

// 2. Third-party
import { Box, Typography } from '@mui/material';

// 3. Internal components
import StyledTextField from '../inputs/StyledTextField';

// 4. Config/Utils
import { MIN_SKADESDATO, TODAY } from '../../config/dateRanges';

// 5. Styles
import './styles.css';
```

### Component pattern
```javascript
const MyComponent = React.memo(({ prop1, prop2 }) => {
  const [state, setState] = React.useState('');

  return (
    <Box sx={{ padding: 3 }}>
      {/* Content */}
    </Box>
  );
});

MyComponent.displayName = 'MyComponent';

export default MyComponent;
```

---

## 🎯 BRUGER-WORKFLOW (PLANLAGT)

### Beregn årsløn
1. Klik "Årsløn"
2. Indtast skadedato (auto-validering)
3. Indtast løn i AG Grid (Excel-lignende)
4. Se resultat (auto-beregnet)
5. Download PDF

### Gem/Hent
1. Arbejd i programmet
2. Klik "Gem" → JSON downloades
3. Senere: Klik "Hent" → vælg fil
4. Al data gendannet

---

## ⚙️ UDVIKLINGSMILJØ

### Start development server
```bash
npm run dev
```
Åbn `http://localhost:5173`

### Build til production
```bash
npm run build
```
Output i `/dist` folder

### Preview production build
```bash
npm run preview
```

---

## 🎓 BRUGER ERFARINGSNIVEAU

**Bjørn er meget uerfaren** - AI skal:
- ✅ Levere **komplet, copy-paste klar kode**
- ✅ Give **trin-for-trin instruktioner**
- ✅ Angive **præcis filsti**
- ✅ Forklare i **dansk, ikke-teknisk sprog**

### Svarformat (best practice)
```
📁 Fil: src/components/pages/Stamdata.jsx

🔧 Trin:
1. Åbn VS Code
2. Find filen i venstre sidebar
3. Erstat ALT indhold med koden nedenfor
4. Gem (Ctrl+S)

💻 Komplet fil:
[... hele filen ...]
```

---

## 🔮 ROADMAP

### Version 0.1.0 (MVP) - I gang
- [x] Projekt setup med Vite + SWC
- [x] React Router v7 integration
- [x] MainLayout med SideMenu og routing
- [x] Centraliserede input-komponenter:
  - [x] StyledTextField (basis komponent)
  - [x] StyledDateField (intelligent dato-håndtering)
  - [x] StyledWeekField (ugefelt)
  - [x] StyledYearField (årsfelt)
  - [x] StyledDropdown
  - [x] StyledIntegerField (min/max validering)
  - [x] StyledAmountField (dansk formatering)
  - [x] StyledPercentField
  - [x] StyledRadioButton
  - [x] StyledToggleSwitch
- [x] Tabel input komponenter (TableAmountInput, TableDateInput, osv.)
- [x] Layout komponenter (ContentBox, FieldLabel, FieldRow, SectionHeader)
- [x] Tabelkomponenter (AarsloenTable med AG Grid)
- [x] UI komponenter (Overlay)
- [x] Floating error messages (absolut positionering)
- [x] Tab-navigation trap i Container
- [x] Typography-system med Montserrat font (Google Fonts)
- [x] Auto-versionering via Husky pre-commit hook
- [x] Centraliseret dato-konfiguration (dateRanges.js)
- [x] Datafiler (interestRates.js, regulationRates.js)
- [x] Custom hooks (useCellUndo, useFieldBehavior, useFormulaField, osv.)
- [x] Form persistence context (FormPersistenceContext)
- [x] Implementerede sider:
  - [x] Stamdata (grunddata med felter)
  - [x] Aarsloen (årslønsberegning med tabel)
  - [x] Erhvervsevnetab (erhvervsevnetabsberegning)
  - [x] Satser (lovregulerede satser)
  - [x] Renteberegning (med floating tabs og tabeller)
  - [x] Erstatningsopgoerelse (samlet opgørelse)
  - [x] Indstillinger (indstillinger og præferencer)
  - [x] Om (projektinformation)
- [x] PDF-generering (modulært opdelt i pdf/ mappe)
- [x] Gem/Hent funktionalitet (.eo filer med kryptering)
- [x] Beregninger (årsløn, SH-dage, rente)
- [x] Fil-håndtering (File System Access API)
- [x] Dokumentation (README, LICENSE, CLAUDE.md, project_content.md)
- [ ] Deploy til hosting

### Version 0.2.0 (Planlagt)
- [ ] Fuldt funktionel beregningslogik
- [ ] PDF-export af opgørelser
- [ ] Gem/Hent til JSON-fil
- [ ] Auto-save til localStorage
- [ ] Print-funktion

### Version 0.3.0 (Fremtid)
- [ ] PWA offline support
- [ ] Dark mode
- [ ] Export til Excel
- [ ] Import fra tidligere format (.eo)
- [ ] Historik/log over beregninger

---

## 📝 NOTER TIL AI

### Context
- React-projekt MINEO (erstatningsberegner web-app)
- Bruger meget uerfaren - kræver komplet kode
- Følg mappestruktur nøje
- Husk centralisering (dateRanges.js, styled components)
- Brug altid centraliserede komponenter (StyledTextField, etc.)

### Svar-stil
- Komplet kode (ikke uddrag)
- Præcis filsti
- Dansk, ikke-teknisk sprog
- Trin-for-trin instruktioner
- Spørg ved tvivl

### Vigtige detaljer
- Vite 7.2.2 med SWC plugin (IKKE Create React App)
- MUI v7.2.0 (IKKE v5)
- React Router v7.6.4
- Alle input-komponenter arver fra StyledTextField
- Tab-trap i Container.jsx (cirkulær navigation)
- Floating error messages (absolut positionering)
- Montserrat font via Google Fonts
- Dansk sprog i kode og kommentarer
- Auto-versionering via Husky git hooks
- Centraliseret dato-konfiguration i dateRanges.js
- Årlig opdatering: kun 3 filer (dateRanges.js, interestRates.js, regulationRates.js)

---

## 📚 NYTTIGE KOMMANDOER

```bash
# Development
npm run dev

# Build
npm run build

# Preview build
npm run preview

# Install dependency
npm install package-name

# Check for outdated packages
npm outdated

# Update package
npm update package-name
```

---

**Maintainer**: Bjørn Elling
**AI Assistant**: Claude (Anthropic)
**License**: MIT
