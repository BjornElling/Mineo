# MINEO Erstatningsberegner

MINEO er en browserbaseret, trust-kritisk erstatningsberegner til arbejdsskadesager.

Appen er 100 % client-side:
- Ingen backend-kald for sagsdata
- Ingen telemetri
- Sagsdata gemmes lokalt i browseren og kan eksporteres/importeres som `.eo`

## Teknologi

Kerne-stack:
- React
- TypeScript (strict)
- Vite
- Material UI
- React Router
- Zod
- Zustand
- jsPDF

Se eksakte versionsnumre i `package.json`.

## Kom i gang

Forudsætninger:
- Node.js 20.19+ eller 22.12+
- Git

Installation:
```bash
git clone https://github.com/BjornElling/mineo.git
cd mineo
npm install
```

Start udviklingsserver:
```bash
npm run dev
```

Åbn: `http://localhost:3000`

## Scripts

```bash
npm run dev
npm run build
npm run preview
npm run typecheck
npm run test
npm run import:loen
```

## Dokumentation

- `AGENTS.md`
  - Overordnede udviklingsregler og trust-kritiske constraints for agentisk udvikling.
- `src/contracts/`
  - Normative kontrakter for formularer, keyboard-navigation, dato-håndtering, app settings og fejl/debug.
- `docs/architecture/calculation-architecture.md`
  - Normativ beregningsarkitektur (boundary, pipeline, engine-regler, testkrav).

## Domænedata der opdateres løbende

Halvårligt:
- Rentesatser i `src/data/interestRates.ts`
- Offentlige løndata (KL/RLTN) via `npm run import:loen`

Årligt:
- EAL/ASL-satser i `src/data/regulationRates.ts`
- Statistiske satser i `src/data/statistiskLoenudviklingRates.ts`
- Dato-intervaller i `src/config/dateRanges.ts`

## Licens

MIT License, se `LICENSE`.

## Kontakt

Bjørn Elling
- GitHub: [@BjornElling](https://github.com/BjornElling)
- Mail: bj.elling@gmail.com

---

**Version**: 2026.02.176

**Status**: Under udvikling
