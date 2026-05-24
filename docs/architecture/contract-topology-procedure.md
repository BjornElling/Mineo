# Contract Topology Procedure

`src/contracts/contract-topology.json` er den maskinlæsbare oversigt over Mineos normative kontrakter.

Ved oprettelse, sletning eller omklassificering af en kontrakt skal ændringen ske i samme commit som:

1. Kontraktfilen, baseret på `src/contracts/contract-template.md`.
2. Opdatering af `src/contracts/contract-topology.json`.
3. Opdatering af `src/__tests__/quality/contractCoverageMatrix.test.ts`.
4. Relevante tests eller en eksplicit beslutningsnote, hvis kravet ikke kan testes direkte.

`docs/architecture/*` er informative, medmindre en kontrakt eksplicit gør et afsnit normativt.
