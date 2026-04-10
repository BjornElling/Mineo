# MINEO Erstatningsberegner

MINEO er en browserbaseret erstatningsberegner til arbejdsskadesager.

Appen er udviklet i TypeScript og kører 100 % client-side. Alle data bevares lokalt i browseren og kan eksporteres/importeres som filer af typen `.eo`.

## Kom i gang

Forudsætninger:
- Node.js
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
- Kapitaliseringsbekendtgørelser: `docs\tilfoej-overenskomst.md`

## Licens

MIT License, se `LICENSE`.

## Kontakt

Bjørn Elling
- GitHub: [@BjornElling](https://github.com/BjornElling)
- Mail: bj.elling@gmail.com

---

**Version**: 2026.04.417

**Status**: Under udvikling
