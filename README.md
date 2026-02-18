# MINEO Erstatningsberegner

**MINEO** er en browserbaseret erstatningsberegner, der er udviklet til at hjælpe advokater og sagsbehandlere med at lave beregninger og opgørelser i arbejdsskadesager.

Programmet er gratis og kan frit benyttes i kommercielle sammenhænge. Alle beregninger sker client-side, dvs. på brugerens egen computer, og der sendes ikke sagsdata til en backend. Indtastede oplysninger kan gemmes lokalt i krypterede .eo filer.

## 🚀 Teknologier

- **React 19.2.4**
- **TypeScript 5.9.3**
- **Material UI 7.3.7**
- **React Router DOM 7.13.0**
- **Vite 7.3.1**
- **Zod 4.3.6**
- **Zustand 5.0.10**
- **jsPDF 4.1.0**
- **Montserrat font**

## 📦 Installation

### Forudsætninger
- Node.js - Minimum: 20.19+ eller 22.12+
- Git

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
   - Gå til `http://localhost:3000`

### NPM scripts
```bash
npm run dev          # Start development server (Vite)
npm run build        # Build til production
npm run preview      # Preview production build
npm run typecheck    # TypeScript typecheck
npm run test         # Kør tests (Vitest)
```


## 📝 Løbende opdatering

### Halvårligt

**Rentesatser**
   - Åbn [src/data/interestRates.ts](src/data/interestRates.ts)
   - Tilføj sats for Nationalbankens udlånsrente

**KL- og RLTN-overenskomster**
   - Hent de seneste Excel-ark fra Forhandlingsfællesskabets hjemmeside
   - Læg KL-filer i `src/data/KL/Excel/` og RLTN-filer i `src/data/RLTN/Excel/`
   - Filnavne SKAL følge formatet `KL-ÅÅÅÅ-MM-DD.xlsx` og `RLTN-ÅÅÅÅ-MM-DD.xlsx` (datoen er ikrafttrædelsesdatoen)
   - Kør import-scriptet:
     ```bash
     npm run import:loen
     ```

### Årligt

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

### Versionering
[src/config/version.ts](src/config/version.ts):
- Vises i formatet åååå.mm.#commit
- Auto-genereres ved hver commit via git hooks
- Baseret på antal commits i repository
- Bruges til at vise versionsnummer i applikationen


## 📄 Licens

MIT License - Se [LICENSE](LICENSE) filen for detaljer.


## 📧 Kontakt

**Bjørn Elling**
- GitHub: [@BjornElling](https://github.com/BjornElling)
- Mail: bj.elling@gmail.com

---

**Version**: 2026.02.150

**Status**: Under udvikling
