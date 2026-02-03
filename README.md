# MINEO Erstatningsberegner

**MINEO** er en browserbaseret erstatningsberegner, der er udviklet til at hjælpe advokater og sagsbehandlere med at lave beregninger og opgørelser i arbejdsskadesager. 

Programmet er gratis og kan frit benyttes i kommercielle sammenhænge. Alle beregninger sker client-side, dvs. på brugerens egen computer, og der udveksles ingen data med serveren. Indtastede oplysninger kan gemmes lokalt i krypterede .eo filer. 

## 🚀 Teknologier

- **React 18** - Moderne UI framework
- **TypeScript 5.7** - Type-safe development
- **Material-UI v7** - Professionelt design system
- **React Router v7** - Client-side routing
- **jsPDF** - Client-side PDF generering med autotable plugin
- **Vite 7.2.2** - Lynhurtig build tool med SWC compiler
- **Montserrat font** - Google Fonts integration

## 📦 Installation

### Forudsætninger
- Node.js 18+
- npm

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

### NPM scripts
```bash
npm run dev          # Start development server (Vite)
npm run build        # Build til production
npm run preview      # Preview production build
```

### Versionering
[src/config/version.ts](src/config/version.ts):
- Vises i formatet åååå.mm.#commit
- Auto-genereres ved hver commit via git hooks
- Baseret på antal commits i repository
- Bruges til at vise versionsnummer i applikationen


## 📝 Løbende opdatering

### Halvårligt (1/1 + 1/7)

**Rentesatser**
   - Åbn [src/data/interestRates.ts](src/data/interestRates.ts)
   - Tilføj sats for Nationalbankens udlånsrente

### Årligt (1/1 + 1/5)

**EAL- og ASL-satser**
   - Åbn [src/data/regulationRates.ts](src/data/regulationRates.ts)
   - Tilføj lovbestemte satser for det nye år

**Statistiske satser**
   - Åbn [src/data/statistiskLoenudviklingRates.ts](src/data/statistiskLoenudviklingRates.ts)
   - Tilføj statistiske satser for det nye år

**Dato-intervaler**
   - Åbn [src/config/dateRanges.ts](src/config/dateRanges.ts)
   - Opdater tilladte intervaller og `MAX_YEAR` til det nye år
   - OBS: Vil gradvist blive udfaset og erstattet af dynamiske værdier


## 📄 Licens

MIT License - Se [LICENSE](LICENSE) filen for detaljer.


## 📧 Kontakt

**Bjørn Elling**
- GitHub: [@BjornElling](https://github.com/BjornElling)
- Mail: bj.elling@gmail.com

---

**Version**: 2026.02.27

**Status**: Under udvikling
