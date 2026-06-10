# Procedure for kontrakt-topologi

`src/contracts/contract-topology.json` er den maskinlæsbare oversigt over Mineos normative kontrakter. Den klassificerer hver kontrakt i ét af fire lag og fastlægger den indbyrdes prioritet ved overlap.

## Topologiens struktur

Filen har følgende felter (alle stier er repo-relative):

- `version` — skemaversion for selve topologifilen (heltal). Coverage-testen kræver den nuværende værdi.
- `priorityOrder` — de fire lag i prioriteret rækkefølge: `domain-specific-contract` → `cross-cutting-contract` → `page-component-contract` → `architecture-document`.
- `crossCuttingContracts` — de tværgående kontrakter (`src/contracts/*.md`).
- `domainContracts` — de domænespecifikke kontrakter (`src/contracts/*.md`).
- `subordinateContracts` — map fra en kontrakt (i praksis `page-component-contract.md`) til de tværgående kontrakter den er underordnet. Både nøgle og hver reference skal selv være klassificeret som cross-cutting eller domain.
- `contractAuthoring` — `templatePath` (`src/contracts/contract-template.md`) og `procedurePath` (denne fil).
- `informativeArchitectureDocs` — de informative `docs/architecture/*.md`. De er **ikke** normative, medmindre en kontrakt eksplicit ophøjer et afsnit derfra.

Hver `src/contracts/*.md`-fil skal være klassificeret præcis ét af tre steder: `crossCuttingContracts`, `domainContracts` eller som nøgle i `subordinateContracts` — eller være `contractAuthoring.templatePath` (selve skabelonen). En kontraktfil der hverken er klassificeret eller er skabelonen, får `contractCoverageMatrix.test.ts` til at fejle.

## Ved oprettelse, sletning eller omklassificering af en kontrakt

Ændringen skal ske i samme commit som:

1. Kontraktfilen selv, baseret på `src/contracts/contract-template.md`.
2. Opdatering af `src/contracts/contract-topology.json` (klassificér i det rette lag; opdatér `subordinateContracts`, hvis page-component-relationen ændres).
3. Opdatering af `src/__tests__/quality/contractCoverageMatrix.test.ts` — tilføj/fjern en `COVERAGE_MATRIX`-entry med mindst én koblet test-suite. Matrix og topologi skal stemme overens begge veje (håndhævet af testen).
4. Relevante tests eller en eksplicit beslutningsnote, hvis kravet ikke kan testes direkte.

## Hvad coverage-testen håndhæver

`contractCoverageMatrix.test.ts` er en **linkage-guard**, ikke et mål for semantisk dækningsgrad. Den verificerer:

- at hver kontrakt i matrixen og hver koblet test-suite faktisk eksisterer på disk;
- at alle stier i topologien (kontrakter, subordinate-referencer, skabelon, procedure og informative arkitektur-docs) eksisterer;
- at **alle** `src/contracts/*.md`-filer er registreret i topologien (skabelonen tæller som registreret via `templatePath`);
- at hver kontraktfil har et gyldigt `**Senest verificeret mod kode:** YYYY-MM-DD`-felt (skabelonen er undtaget, da den bruger en placeholder);
- at topologi og `COVERAGE_MATRIX` er synkroniseret begge veje, og at hver subordinate-nøgle og -reference selv er klassificeret.

## Senest verificeret mod kode-feltet

Hver kontraktfil i `src/contracts/` skal have et `**Senest verificeret mod kode:** YYYY-MM-DD`-felt. Det opdateres kun efter en reel verifikation af, at kontrakten stadig er sand mod koden. De øvrige template-felter og -afsnit er anbefalede, ikke håndhævede.

`docs/architecture/*` er informative, medmindre en kontrakt eksplicit gør et afsnit normativt.
