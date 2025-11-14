# MINEO Erstatningsberegner

**MINEO** er en web-baseret dansk erstatningsberegner til at opgøre krav efter Erstatningsansvarsloven og Arbejdsskadesikringsloven.

## 🎯 Om projektet

MINEO er en moderne web-applikation udviklet til at hjælpe advokater og sagsbehandlere med at lave erstatningsopgørelser. Programmet kører 100% i browseren og kræver ingen installation.

## ✨ Features

- 🖥️ **Browser-baseret** - Kører i alle moderne browsere
- 💾 **Gem/Hent funktionalitet** - Indtastede oplysninger gemmes i krypteret .eo format
- 📄 **PDF-generering** - Generer professionelle opgørelser direkte fra browseren
- 🔒 **Privat** - Alle data forbliver på din egen computer
- 📊 **Simpelt og intuitativt** - Funktionaliteter er velkendt, og regneark opfører sig som Excel

## 🚀 Teknologier

- **React 18** - Moderne UI framework
- **Material-UI v5** - Professionelt design system
- **Zustand** - Lettevægts state management
- **AG Grid Community** - Excel-lignende tabeller (MIT license)
- **jsPDF** - Client-side PDF generering
- **Vite** - Lynhurtig build tool

## 📦 Installation

### Forudsætninger
- Node.js 18+ og npm installeret

### Kom i gang

1. **Klon repository**
   ```bash
   git clone https://github.com/bjorn-elling/mineo.git
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
│   │   ├── common/          # Genbrugelige komponenter (ContentBox, etc.)
│   │   ├── inputs/          # Input-komponenter (StyledTextField, StyledDateField, etc.)
│   │   ├── layout/          # Layout-komponenter (MainLayout, SideMenu, Container)
│   │   └── pages/           # Side-komponenter (Stamdata, etc.)
│   ├── config/              # Konfigurationsfiler (dateRanges, etc.)
│   ├── styles/              # CSS og styling
│   └── main.jsx             # Indgangspunkt
├── public/                  # Statiske filer
└── index.html              # HTML template
```

## 🎨 Design-principper

### Centraliseret styling
- **StyledTextField** - Basis for alle tekstfelter
- **StyledDropdown** - Dropdown med konsistent styling
- **StyledDateField** - Intelligent datoindtastning med auto-formattering
- **ContentBox** - Standardiserede containere

### Intelligent datohåndtering
- Auto-formattering til dd-mm-åååå
- Accepterer flere separatorer (-, ., :, mellemrum)
- Intelligent år-fortolkning (1-2 cifre)
- Validering af datogyldighed inkl. skudår
- Centraliseret dato-konfiguration i `dateRanges.js`

### Tab-navigation
- Tab holder sig inden for indholdsvinduet
- Cirkulær navigation (sidste felt → første felt)

## 📝 Årlig opdatering

Programmet skal opdateres én gang om året for at tilføje nye satser og udvide dato-intervaller:

1. Åbn `src/config/dateRanges.js`
2. Opdater `MAX_YEAR` til det nye år
3. Tilføj nye satser i relevante datafiler
4. Færdig! 🎉

## 📄 Licens

MIT License - Se [LICENSE](LICENSE) filen for detaljer.

## 👨‍💻 Udvikling

### Build til production
```bash
npm run build
```

### Preview production build
```bash
npm run preview
```

## 🤝 Bidrag

Projektet er open source, og bidrag er velkomne!

1. Fork projektet
2. Opret en feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit dine ændringer (`git commit -m 'Add some AmazingFeature'`)
4. Push til branchen (`git push origin feature/AmazingFeature`)
5. Åbn en Pull Request

## 📧 Kontakt

**Bjørn Elling**
- GitHub: [@bjorn-elling](https://github.com/bjorn-elling)
- Mail: bj.elling@gmail.com

## 🙏 Anerkendelser

MINEO er udviklet med hjælp fra Claude AI.

---

**Version**: 0.0.0-dev (Versionsnummer genereres automatisk ved commit)
**Status**: Under udvikling
