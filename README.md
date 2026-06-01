# Mineo Erstatningsberegner

Mineo er en browserbaseret erstatningsberegner til arbejdsskadesager.

Appen er udviklet i TypeScript og kører 100 % client-side. Alle data bevares lokalt i browseren og kan eksporteres/importeres som filer af typen `.eo`.

## Kom i gang

Forudsætninger:
- Node.js 25
- Git

Installation:
```bash
git clone https://github.com/BjornElling/mineo.git
cd mineo
nvm use
npm install
```

Start udviklingsserver:
```bash
npm run dev
```

Åbn: `http://localhost:3000`

Start procesrente som standalone-app:
```bash
npm run dev:minprocesrente
```

## Scripts

Udvikling:
```bash
npm run dev                  # Mineo-appen
npm run dev:minprocesrente   # standalone procesrente-app
npm run preview              # preview af produktions-build
```

Build:
```bash
npm run build                # bygger Mineo (build:mineo)
npm run build:minprocesrente # bygger standalone procesrente-app
npm run build:all            # bygger begge apps
```

Kvalitetstjek:
```bash
npm run typecheck       # typecheck af kildekode (tsconfig.json)
npm run typecheck:test  # typecheck af testkode (tsconfig.test.json — separat config)
npm run lint            # eslint (--max-warnings 0)
npm run test            # kør hele testsuiten (Vitest)
npm run test:watch      # Vitest i watch-mode
```

Data:
```bash
npm run import:loen     # importér offentlige løndata (KL/RLTN) fra Excel
```

## Data der skal opdateres løbende

- EAL/ASL-satser i `src/data/lovbestemteRates.ts`
- Statistiske satser i `src/data/statistiskeRates.ts`
- Rentesatser i `src/data/interestRates.ts`
- Private løndata i `src/data/overenskomstRates.ts`
- Offentlige løndata (KL/RLTN) via `npm run import:loen`
- KRL-reguleringssatser i `src/data/KRLrates.ts`
- Kapitaliseringsbekendtgørelser i `src/data/kapitalisering/kapitaliseringsbekendtgørelser.ts`

## Hjælpefiler til opdateringer

- Overenskomst: `docs/tilfoej-overenskomst.md`
- Kapitaliseringsbekendtgørelser: `docs/tilfoej-kapitaliseringsbekendtgoerelse.md`

## Licens

MIT License, se `LICENSE`.

## Kontakt

Bjørn Elling
- GitHub: [@BjornElling](https://github.com/BjornElling)
- Mail: bel@fho.dk

---

**Version**: 2026.06.669

**Status**: Under udvikling
