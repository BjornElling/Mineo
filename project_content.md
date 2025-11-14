# 📄 MINEO PROJECT CONTEXT

Dette dokument indeholder **komplet kontekst** om MINEO-projektet til brug i fremtidige AI-samtaler.

**Sidst opdateret**: 2025-11-12
**Version**: 0.1.0 (MVP Under udvikling)

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
  "framework": "React 18.3+",
  "language": "JavaScript (ES6+)",
  "build_tool": "Vite 7.2+",
  "ui_framework": "Material-UI (MUI) v7.3+",
  "state_management": "Zustand 5.0+",
  "routing": "React Router v7.9+",
  "date_handling": "dayjs + MUI X Date Pickers v8.17+",
  "tables": "AG Grid Community Edition (MIT License)",
  "pdf_generation": "jsPDF 3.0 + jspdf-autotable 5.0",
  "package_manager": "npm"
}
```

### Alle dependencies er kommercielt-venlige
- ✅ Alle har MIT eller kompatible open source licenser
- ✅ AG Grid Community Edition (ikke Pro - ingen licens-gebyr)
- ✅ Ingen proprietære dependencies

---

## 📁 AKTUEL MAPPESTRUKTUR

```
mineo/
├── public/
│   └── assets/
│       └── fonts/
│           └── Ubuntu/
│               ├── Ubuntu-Regular.ttf
│               ├── Ubuntu-Medium.ttf
│               ├── Ubuntu-Bold.ttf
│               ├── Ubuntu-Italic.ttf
│               ├── Ubuntu-MediumItalic.ttf
│               └── Ubuntu-BoldItalic.ttf
│
├── src/
│   ├── main.jsx                          # Vite entry point
│   ├── App.jsx                           # Root component
│   ├── index.css                         # Global CSS + font-faces
│   │
│   ├── components/
│   │   ├── common/
│   │   │   └── ContentBox.jsx            # Standardiserede white box containere
│   │   │
│   │   ├── inputs/
│   │   │   ├── StyledTextField.jsx       # Basis tekstfelt (auto-trim, moderne design)
│   │   │   ├── StyledDropdown.jsx        # Dropdown med inherited styling
│   │   │   └── StyledDateField.jsx       # Intelligent dato-felt
│   │   │
│   │   ├── layout/
│   │   │   ├── MainLayout.jsx            # Hoved-layout med routing
│   │   │   ├── SideMenu.jsx              # Venstre sidemenu
│   │   │   └── Container.jsx             # Content-område med tab-trap
│   │   │
│   │   └── pages/
│   │       └── Stamdata.jsx              # Stamdata-side (MVP)
│   │
│   ├── config/
│   │   └── dateRanges.js                 # Centraliseret dato-konfiguration
│   │
│   └── styles/
│       └── typography.css                # Centraliserede text-styles
│
├── node_modules/                         # Dependencies (gitignored)
│
├── .gitignore                            # Git ignore-fil
├── index.html                            # HTML template
├── vite.config.js                        # Vite konfiguration
├── package.json                          # NPM dependencies
├── package-lock.json                     # NPM lockfile
│
├── README.md                             # Projekt README
├── LICENSE                               # MIT License
├── CONTRIBUTING.md                       # Bidragsguide
├── CHANGELOG.md                          # Version history
├── COPYRIGHT.txt                         # Copyright notice
└── project_content.md                    # Dette dokument
```

### Kommende struktur (endnu ikke implementeret)
```
src/
├── hooks/                                # Custom React hooks
│   ├── useStorTabel.js
│   ├── useBeregninger.js
│   ├── useGemHent.js
│   └── useAutoSave.js
│
├── utils/                                # Utility functions
│   ├── beregninger/
│   │   ├── aarsloen.js
│   │   ├── erhvervsevnetab.js
│   │   └── rente.js
│   ├── formatering.js
│   ├── validering.js
│   └── dateUtils.js
│
├── data/                                 # Statisk data
│   ├── regulationRates.js
│   └── constants.js
│
└── store/                                # Zustand state management
    ├── index.js
    └── slices/
        ├── globalSlice.js
        ├── aarsLoenSlice.js
        └── renteSlice.js
```

---

## 🎨 DESIGN-SYSTEM OG KOMPONENTER

### Centraliserede komponenter
Alle UI-komponenter skal bruge de centraliserede versioner for konsistent styling:

#### StyledTextField
```javascript
import StyledTextField from '@/components/inputs/StyledTextField';

<StyledTextField
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Indtast tekst"
  width={220}
/>
```

**Features**:
- Auto-trim ved blur
- Placeholder forsvinder ved fokus
- Moderne, fladt design med afrundede hjørner (10px)
- Konsistent styling på tværs af app

#### StyledDropdown
```javascript
import StyledDropdown from '@/components/inputs/StyledDropdown';
import { MenuItem } from '@mui/material';

<StyledDropdown
  value={value}
  onChange={(e) => setValue(e.target.value)}
  placeholder="Vælg mulighed"
  width={175}
>
  <MenuItem value="option1">Mulighed 1</MenuItem>
  <MenuItem value="option2">Mulighed 2</MenuItem>
</StyledDropdown>
```

**Features**:
- Arver styling fra StyledTextField
- Placeholder vises indtil værdi vælges
- Delete/Backspace sletter valgt værdi

#### StyledDateField
```javascript
import StyledDateField from '@/components/inputs/StyledDateField';

<StyledDateField
  value={dato}
  onChange={(e) => setDato(e.target.value)}
  minDate={MIN_SKADESDATO}
  maxDate={TODAY}
  width={150}
/>
```

**Features**:
- Format: dd-mm-åååå
- Accepterer separatorer: - . : mellemrum (konverterer til -)
- Auto-padding: "1-1-1" → "01-01-1" når separator indtastes
- Intelligent år-fortolkning ved blur:
  - 1 ciffer → 200x (1 → 2001)
  - 2 cifre → 19xx eller 20xx (intelligent baseret på nuværende år + 5)
  - 3 cifre → fejl
  - 4 cifre → brug som de er
- Validering:
  - Dag: 1-31
  - Måned: 1-12
  - Skudår-logik for februar
  - Min/max dato-ranges
- Fejlmeddelelser svæver absolut (påvirker ikke layout)
- Rød kant ved fejl (også under indtastning)

#### ContentBox
```javascript
import ContentBox from '@/components/common/ContentBox';

<ContentBox width={800}>
  {/* Indhold */}
</ContentBox>
```

**Features**:
- Hvid baggrund (#ffffff)
- Afrundede hjørner (20px)
- Subtle shadow og border
- Konsistent padding (40px 32px)
- Konsistent margin (40px 0)

### Typography
Defineret i `src/styles/typography.css`:

- **Font**: Ubuntu (Regular 400, Medium 500, Bold 700)
- **Page title**: 34px, font-weight 500, margin-bottom 40px
- **Section header**: 18px, font-weight 500, margin-bottom 28px
- **Field labels**: 14px, font-weight 500

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

**Årlig opdatering**:
1. Åbn `src/config/dateRanges.js`
2. Ændre: `export const MAX_YEAR = 2026;`
3. Tilføj satser i `regulationRates.js`
4. Færdig! Alle felter opdateret

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
- StyledTextField som basis
- StyledDropdown arver fra StyledTextField
- StyledDateField arver fra StyledTextField
- ContentBox for alle containere
- Ændringer ét sted slår igennem overalt

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
- [x] Projekt setup med Vite
- [x] MainLayout med SideMenu
- [x] Centraliserede komponenter (StyledTextField, StyledDropdown, StyledDateField, ContentBox)
- [x] Stamdata-side med intelligent dato-input
- [x] Typography-system med Ubuntu font
- [x] Tab-navigation trap
- [x] Dokumentation (README, LICENSE, CONTRIBUTING, CHANGELOG)
- [ ] Alle sider implementeret
- [ ] Beregninger virker
- [ ] PDF-generering
- [ ] Gem/Hent
- [ ] Deploy til hosting

### Version 0.2.0
- [ ] PWA offline support
- [ ] Auto-save
- [ ] Dark mode
- [ ] Export til Excel

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
- Vite (ikke Create React App)
- MUI v7 (ikke v5)
- Tab-trap i Container
- Floating error messages
- Ubuntu font
- Dansk sprog i kode

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
