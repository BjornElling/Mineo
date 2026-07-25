# WI-006: Ét kanonisk begreb i stedet for `invalidDraft`-navnene

- **Status:** `kladde` — **OBLIGATORISK: skal afsluttes, før Fase 0–4 + undo/redo erklæres endeligt lukket**
  (Codex sol/high, WI-004 runde 4).
- **Oprettet:** 2026-07-25
- **Slice/scope:** de tilbageværende `invalidDraft`-navne i produktionskoden — navngivning, ikke adfærd.
- **Kilde:** Codex sol/high's tilfældighedsfund under WI-004's fund S6 (kontraktdriften om slettet
  migrationskode). Scope-beslutningen var **delt**: de fem DØDE filer blev slettet i WI-004; det levende
  navnevalg blev udskilt hertil, fordi det kræver et selvstændigt begrebsvalg og ikke hører midt i en
  trust-kritisk gate-ændring.
- **Risikoklasse:** **M** — ren omdøbning, men navnet sidder i en persisteret storage-nøgle og i grid-kernen,
  så en halv omdøbning er værre end ingen.

## Problemet

`invalidDrafts`-modellen er SLETTET (greenfield trin 13, 2026-07-25): afvist råtekst persisteres nu som
`rejectedInputs` i den ene envelope. Kontrakterne siger det nu korrekt (`mineo-field-pattern.md` intro + §10,
`AGENTS.md` "Kanoniske inputgrænser", `form-contract.md` §12). Men NAVNET lever videre og beskriver dermed en
model, der ikke findes:

| Sted | Hvad det faktisk er |
|---|---|
| `src/config/cellInvalidDraftScopes.ts` | ÉN produktionsimportør; skal klassificeres og omdøbes |
| `src/components/tables/gridCore/gridModel.ts`, `gridUxSpec.ts` | grid-kernens begreber/kommentarer |
| `src/components/tables/OevrigeKravTable.tsx`, `EetAslAfgoerelserTable.tsx` | tabel-lokale navne |
| `src/config/storageManifest.ts` | **persisteret storage-nøgle** — kræver migreringsovervejelse |
| `src/domain/eoRowEvaluation/eoRowIssueCatalog.ts` | rækkeissue-katalogets begreber |
| `src/inputCore/react/inputRuntimeContext.tsx`, `useGridCellSurface.ts`, `runtime/slimInputStore.ts` | kommentarer, der forklarer den GAMLE model |

## Scope når den påbegyndes

1. **Klassificér hvert navn efter faktisk betydning FØR omdøbning.** De dækker ikke alle det samme: nogle
   betyder "afvist råtekst" (`rejectedInputs`), nogle betyder "celle-scope for fejlvisning", nogle er blot
   historiske kommentarer. Vælg ÉT kanonisk begreb pr. betydning — ikke én global søg/erstat.
2. **Storage-nøglen i `storageManifest.ts` afgøres særskilt.** En omdøbt nøgle er et databrud: enten bevares
   nøglestrengen med et nyt symbolnavn, eller der kræves en migrering. Afgøres af Codex sol/high.
3. Historiske kommentarer, der forklarer hvad koden KOM FRA, må gerne bevares — men skal sige, at modellen er
   slettet, ikke beskrive den i nutid.

## Invarianter

- **Ingen adfærdsændring.** Rent navnearbejde; en omdøbning må ikke flytte tal, UI eller persisteret data.
- Den slettede `invalidDrafts`-model må ikke genopstå under et nyt navn — det navnebaserede AST-værn mod de
  slettede symboler bevares.

## Relaterede

- WI-004 (fund S6) — kontraktteksten er rettet dér; de fem døde filer er slettet dér.
- [[WI-005]] — ansvarsbaserede arkitekturværn (Fase 6).
