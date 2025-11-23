# MINEO Erstatningsberegner

**MINEO** er en web-baseret erstatningsberegner til at opgøre krav efter Erstatningsansvarsloven og Arbejdsskadesikringsloven.

## 🎯 Om projektet

MINEO er en gratis open source applikation udviklet til at hjælpe advokater og sagsbehandlere med at lave erstatningsopgørelser. Programmet kører 100% i browseren og kræver ingen installation.

## ✨ Features

- 🖥️ **Browser-baseret** - Kører i alle moderne browsere
- 💾 **Gem/Hent funktionalitet** - Indtastede oplysninger gemmes i krypteret .eo format
- 📄 **PDF-generering** - Generer professionelle opgørelser direkte fra browseren
- 🔒 **Privat** - Alle data forbliver på din egen computer
- 📊 **Simpelt og intuitativt** - Funktionaliteter er intuitative, og regneark opfører sig som Excel

## 🚀 Teknologier

- **React 18** - Moderne UI framework
- **Material-UI v7** - Professionelt design system
- **React Router v7** - Client-side routing
- **jsPDF** - Client-side PDF generering med autotable plugin
- **Vite 7.2.2** - Lynhurtig build tool med SWC compiler
- **Ubuntu font** - Google Fonts integration

## 📦 Installation

### Forudsætninger
- Node.js 18+ og npm installeret

### Kom i gang

1. **Klon repository**
   ```bash
   git clone https://github.com/BjornElling/mineo.git
   cd mineo
   ```

2. **Installer dependencies**
   ```bash
   npm install
   ```

3. **Start development server**
   ```bash
   npm run dev
   ```

4. **Åbn i browser**
   - Gå til `http://localhost:5173`

## 🏗️ Projektstruktur

```
mineo/
├── src/
│   ├── components/
│   │   ├── common/          # Genbrugelige komponenter
│   │   │   └── ContentBox.jsx           # Standardiserede containere
│   │   ├── inputs/          # Input-komponenter med centraliseret styling
│   │   │   ├── StyledTextField.jsx      # Basis tekstfelt (auto-trim, moderne design)
│   │   │   ├── StyledDateField.jsx      # Intelligent dato-felt (dd-mm-åååå)
│   │   │   ├── StyledDropdown.jsx       # Dropdown med konsistent styling
│   │   │   ├── StyledIntegerField.jsx   # Heltal med min/max validering
│   │   │   ├── StyledAmountField.jsx    # Beløbsfelt med dansk formatering
│   │   │   └── StyledPercentField.jsx   # Procentfelt med 2 decimaler
│   │   ├── layout/          # Layout-komponenter
│   │   │   ├── MainLayout.jsx           # Hovedlayout med side-menu
│   │   │   ├── SideMenu.jsx             # Navigationsmenu til venstre
│   │   │   └── Container.jsx            # Indholdscontainer med tab-navigation
│   │   └── pages/           # Side-komponenter
│   │       ├── Stamdata.jsx             # Grunddata (skadedato, skadevolder, etc.)
│   │       ├── Satser.jsx               # Lovregulerede satser (tidl. Stor Tabel)
│   │       ├── Renteberegning.jsx       # Renteberegning med tabs og tabeller
│   │       └── Om.jsx                   # Om-siden med projektinfo
│   ├── config/              # Konfigurationsfiler
│   │   ├── dateRanges.js                # Centraliseret dato-konfiguration
│   │   └── version.js                   # Auto-genereret versionsnummer
│   ├── data/                # Datafiler med lovregulerede satser
│   │   ├── interestRates.js             # Referencesatser og tillægssatser (2005-2025)
│   │   └── regulationRates.js           # Lovregulerede satser (2008-2025)
│   ├── utils/               # Hjælpefunktioner
│   │   └── pdfGenerator.js              # PDF-generering med jsPDF
│   ├── styles/              # CSS og styling
│   │   └── globals.css                  # Globale styles med Ubuntu font
│   ├── App.jsx              # Router-konfiguration
│   └── main.jsx             # Indgangspunkt med React Router
├── public/                  # Statiske filer
│   └── favicon.ico          # Favicon
├── scripts/                 # Build scripts
│   └── generate-version.js  # Auto-versionering ved commit
├── index.html              # HTML template
└── vite.config.js          # Vite konfiguration med SWC
```

## 🎨 Design-principper

### Centraliseret styling
Alle input-komponenter arver fra **StyledTextField** for konsistent udseende:

- **StyledTextField** - Basis tekstfelt med auto-trim, moderne design, floating error messages
- **StyledDateField** - Intelligent datoindtastning (dd-mm-åååå) med auto-formatering
- **StyledDropdown** - Dropdown med konsistent styling
- **StyledIntegerField** - Heltal med min/max validering, tømmer 0-værdier automatisk
- **StyledAmountField** - Beløbsfelt med dansk tusindtalsseparator og 2 decimaler
- **StyledPercentField** - Procentfelt med 2 decimaler
- **ContentBox** - Standardiserede containere (1000px bredde, 20px border-radius)

### Intelligent datohåndtering
- Auto-formattering til dd-mm-åååå under indtastning
- Accepterer flere separatorer (-, ., :, mellemrum) → konverteres til bindestreg
- Intelligent år-fortolkning
- Real-time validering af datogyldighed (inkl. skudår)
- Interval-validering mod min/max datoer
- Centraliseret dato-konfiguration i [dateRanges.js](src/config/dateRanges.js)

### Tab-navigation
- Tab-tasten holder sig inden for indholdsvinduet (Container.jsx)
- Cirkulær navigation: sidste felt → første felt
- Shift+Tab for baglæns navigation

### Floating error messages
- Fejlmeddelelser bruger absolut positionering
- Layout-højde påvirkes ikke af fejlmeddelelser
- Konsistent placering under alle input-felter

## 📝 Årlig opdatering

Programmet skal opdateres én gang om året for at tilføje nye satser og udvide dato-intervaller:

1. **Opdater dato-interval**
   - Åbn [src/config/dateRanges.js](src/config/dateRanges.js)
   - Opdater `MAX_YEAR` til det nye år

2. **Tilføj nye rentesatser**
   - Åbn [src/data/interestRates.js](src/data/interestRates.js)
   - Tilføj nye referencesatser (Nationalbankens udlånsrente)
   - Tilføj nye tillægssatser (fast tillægsprocent)

3. **Tilføj lovregulerede satser**
   - Åbn [src/data/regulationRates.js](src/data/regulationRates.js)
   - Tilføj nye satser for det nye år

4. Færdig! 🎉

### Datafiler der opdateres årligt
- **interestRates.js** - Referencesatser og tillægssatser (gældende 1. januar og 1. juli)
- **regulationRates.js** - Lovregulerede satser for erstatningsberegninger
- **dateRanges.js** - MAX_YEAR konstanten

## 📦 Dependencies

### Core dependencies
- **react** (^18.3.1) - UI framework
- **react-dom** (^18.3.1) - React DOM renderer
- **react-router** (^7.6.4) - Client-side routing
- **@mui/material** (^7.2.0) - Material-UI komponenter
- **@mui/icons-material** (^7.2.0) - Material-UI ikoner
- **@emotion/react** (^11.14.0) - CSS-in-JS
- **@emotion/styled** (^11.14.0) - Styled components
- **jspdf** (^2.5.2) - PDF generering
- **jspdf-autotable** (^3.8.4) - PDF tabel-plugin

### Dev dependencies
- **vite** (^7.2.2) - Build tool og dev server
- **@vitejs/plugin-react-swc** (^4.0.1) - SWC compiler plugin
- **husky** (^10.0.0) - Git hooks
- **@eslint/js** (^9.20.0) - Linting
- **eslint-plugin-react** - React-specific linting regler

## 🛠️ Utilities og hjælpefunktioner

### PDF-generering
[src/utils/pdfGenerator.js](src/utils/pdfGenerator.js) håndterer:
- Generering af erstatningsopgørelser i PDF-format
- Integration med jsPDF og autotable plugin
- Dansk formatering af datoer og beløb
- Professionel layout med Ubuntu font

### Dato-konfiguration
[src/config/dateRanges.js](src/config/dateRanges.js) definerer:
- `MIN_SKADESDATO` - Mindste tilladte skadedato
- `MIN_CALCULATION_DATE` - Mindste tilladte beregningsdato
- `MAX_YEAR` - Maksimalt år (opdateres årligt)
- `TODAY` - Aktuel dato
- Centraliseret konfiguration for alle dato-felter

### Versionering
[src/config/version.js](src/config/version.js):
- Auto-genereres ved hver commit via git hooks
- Baseret på antal commits i repository
- Bruges til at vise versionsnummer i applikationen

## 📄 Licens

MIT License - Se [LICENSE](LICENSE) filen for detaljer.

## 👨‍💻 Udvikling

### NPM scripts
```bash
npm run dev          # Start development server (Vite)
npm run build        # Build til production
npm run preview      # Preview production build
```

### Build-process
- **Vite 7.2.2** med SWC plugin for hurtig transpilering
- **Auto-versionering** via git hooks (pre-commit)
  - Genererer versionsnummer baseret på git commits
  - Opdaterer `src/config/version.js` automatisk
  - Format: `major.minor.patch` baseret på commit-antal

### Routing
Applikationen bruger React Router v7 med følgende routes:
- `/` - Stamdata (grundlæggende oplysninger)
- `/satser` - Lovregulerede satser (tidl. Stor Tabel)
- `/renteberegning` - Renteberegning med tabs
- `/om` - Om-siden

### Komponenter
**Side-komponenter** (i `src/components/pages/`):
- `Stamdata.jsx` - Grunddata (skadedato, skadevolder, skadelidte)
- `Satser.jsx` - Lovregulerede satser med søgefunktion
- `Renteberegning.jsx` - Renteberegning med floating tabs og rate-tabeller
- `Om.jsx` - Om-siden med projektinformation

**Layout-komponenter** (i `src/components/layout/`):
- `MainLayout.jsx` - Hovedlayout med side-menu til venstre
- `SideMenu.jsx` - Navigationsmenu med routing
- `Container.jsx` - Indholdscontainer med tab-navigation håndtering

**Input-komponenter** (i `src/components/inputs/`):
- Alle arver styling fra `StyledTextField.jsx`
- Centraliseret fejlhåndtering med floating messages
- Konsistent design på tværs af hele applikationen

## 🤝 Bidrag

Projektet er open source, og bidrag er velkomne!

1. Fork projektet
2. Opret en feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit dine ændringer (`git commit -m 'Add some AmazingFeature'`)
4. Push til branchen (`git push origin feature/AmazingFeature`)
5. Åbn en Pull Request

## 📧 Kontakt

**Bjørn Elling**
- GitHub: [@BjornElling](https://github.com/BjornElling)
- Mail: bj.elling@gmail.com

## 🙏 Anerkendelser

MINEO er udviklet med hjælp fra Claude AI.

---

**Version**: 2025.11.30
**Status**: Under udvikling
