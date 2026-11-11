# Mineo Erstatningsberegner

Mineo er en browserbaseret erstatningsberegner til arbejdsskadesager.

Appen er udviklet i TypeScript og kører 100 % client-side. Alle data bevares lokalt i browseren og kan eksporteres/importeres som filer af typen `.eo`.

## Kom i gang

Forudsætninger:
- Node.js 26 LTS (mindst 26.13.0)
- npm 12 (mindst 12.2.2)
- Git

Installation:
```bash
git clone https://github.com/BjornElling/mineo.git
cd mineo
nvm use
npm install --global npm@12.2.2
npm --version # kontrollér, at den aktive version er mindst 12.2.2
npm ci
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
npm run check:types     # alle fire TypeScript-projekter under ét
npm run typecheck       # kildekode (tsconfig.app.json)
npm run typecheck:test  # testkode (tsconfig.test.json – egne globals)
npm run typecheck:e2e   # Playwright-suiten (tsconfig.e2e.json)
npm run typecheck:node  # vite-konfigurationerne (tsconfig.node.json)
npm run check:commit    # samlet typecheck + lint, samme gate som pre-commit
npm run lint            # eslint (--max-warnings 0)
npm run test            # samlet typecheck efterfulgt af hele testsuiten (Vitest)
npm run test:watch      # Vitest i watch-mode
```

I PowerShell bruges `npm.cmd`, når flag skal sendes videre til et script. PowerShell fjerner ellers
separatoren `--` fra `npm.ps1`, og npm 12 afviser derefter fx `--project` som et ukendt npm-flag:
```powershell
npm.cmd run test:e2e -- --project=chrome-desktop
```

Hvis Windows stadig finder den gamle npm efter den globale opdatering, ligger Node-mappen før
brugerens npm-mappe i PATH. Prioritér den opdaterede npm i den aktuelle PowerShell og kontrollér igen:
```powershell
$mineoNpmPrefix = npm.cmd prefix --global
$env:Path = "$mineoNpmPrefix;$env:Path"
npm.cmd --version
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
- Sygedagpengesatser og obligatorisk pension (OP) i `src/data/sygedagpengeRates.ts`

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

**Status**: Offentliggjort og under løbende vedligeholdelse
