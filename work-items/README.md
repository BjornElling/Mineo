# Work items

Korte, sporbare arbejdsopgaver for greenfield-arbejdsgangen (se `/greenfield`,
`.claude/skills/greenfield/SKILL.md`). Én fil pr. work item.

## Konvention

- Filnavn: `WI-<nnn>-<kort-slug>.md`, fx `WI-014-eet-projektion-konsolidering.md`.
- Nummerér fortløbende; genbrug ikke numre.
- Kopiér `_TEMPLATE.md` som udgangspunkt.
- Hav kun én aktiv greenfield-work item ad gangen.
- Modelrouting følger WI'ens risikoklasse L/M/H og `/greenfield`-skillen.
- Den låste modelpolitik i AGENTS.md gælder altid: kun Opus i Claude Code, kun Sol/Terra i
  Codex, Terra altid high, og aldrig Luna.
- Bliver et fund for stort til at rette i den aktuelle WI, oprettes en **ny** WI — kryds-referér.

## Status-livscyklus

`kladde` → `afventer-godkendelse` / `klar` → `under-implementering` → `review` → `afsluttet`

`afventer-godkendelse` bruges kun ved synlig UI/UX eller beregningslogik. Rent tekniske
work items går fra `kladde` til `klar` med `godkendelse ikke påkrævet`. Afsluttede work
items bliver liggende som historik. Efter en godkendelsespause genoptages arbejdet med
`/greenfield <WI-fil>`, så Opus/medium-modelvalget anvendes igen.
