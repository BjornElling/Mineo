# Contract Topology Procedure

`src/contracts/contract-topology.json` er den maskinlæsbare oversigt over Mineos normative kontrakter.

Ved oprettelse, sletning eller omklassificering af en kontrakt skal ændringen ske i samme commit som:

1. Kontraktfilen, baseret på `src/contracts/contract-template.md`.
2. Opdatering af `src/contracts/contract-topology.json`.
3. Opdatering af `src/__tests__/quality/contractCoverageMatrix.test.ts`.
4. Relevante tests eller en eksplicit beslutningsnote, hvis kravet ikke kan testes direkte.

`docs/architecture/*` er informative, medmindre en kontrakt eksplicit gør et afsnit normativt.

Hver kontraktfil i `src/contracts/` skal have et `**Senest verificeret mod kode:** YYYY-MM-DD`-felt. Det håndhæves af `contractCoverageMatrix.test.ts` og opdateres kun efter en reel verifikation af, at kontrakten stadig er sand mod koden. De øvrige template-felter/afsnit er anbefalede, ikke håndhævede.
