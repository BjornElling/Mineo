# WI-005: Ansvarsbaserede frem for navnebaserede arkitekturværn (Fase 6)

- **Status:** `kladde` — oprettet som udskilt rest fra WI-004. Må ikke påbegyndes før Fase 5 er lukket.
- **Oprettet:** 2026-07-25
- **Slice/scope:** `src/__tests__/quality/architecture/` — legacy-værnenes form, ikke deres dækning.
- **Kilde:** Codex sol/high-fund **F7** (`docs/reviews/codex-fase34-followup.md`), udskilt ved WI-004's
  runde 3: *"Ny WI under Fase 6. Ikke et Fase-0–4-exitkrav. Behold det præcise deleted-symbol-værn indtil da."*
- **Risikoklasse:** **M** — kun testinfrastruktur, men et for bredt værn kan blokere legitim kode, og et for
  smalt lader en regression passere.

## Problemet

`input/deleted-legacy-architecture-import` (`architectureRules.ts:127`) forbyder de slettede legacy-moduler
ved NAVN. Det er præcist og har ingen allowlist, men det værner mod *de symboler, vi kom fra* — ikke mod
*det ansvar, de havde*. En ny fil, der genopfinder en parallel inputmodel under et andet navn, rammes ikke.

Det ønskede slutbillede er værn, der håndhæver ANSVARSGRÆNSER: hvem må se rå `sections`, hvem må skrive til
aggregatet, hvem må producere feltissues, hvem må kalde en beregningsmotor.

## Hvorfor det hører til Fase 6, ikke Fase 4

`docs/architecture/draft-commit-greenfield-design.md` §8 placerer eksplicit de generelle write-/read-
grænsevagter i **Fase 6 — Bekræft legacyfjernelse og håndhæv grænserne** (linje ~1457-1472). Det er ikke et
Fase-0–4-exitkriterium, og at forcere det ind i WI-004 ville blande "luk restfundene" sammen med "byg det
blivende håndhævelseslag".

## Scope når den påbegyndes

1. Formulér ansvarsgrænserne som eksplicitte regler i AST-manifestet (jf. `project_ast_architecture_harness`:
   tilføj grænse-regler i manifestet, ikke per-guard-walkere).
2. Hver regel skal have både `violatingFixtures` og `cleanFixtures`, så den beviser at den fanger
   overtrædelsen (jf. `project_guard_selftest_principle`).
3. Behold det navnebaserede deleted-symbol-værn ved siden af — det er billigt og fanger den konkrete
   genindførelse hurtigt og med en præcis fejlbesked.

## Invarianter

- Et ansvarsbaseret værn må ikke blokere de dokumenterede undtagelser: `components/inputs/transient/` (tre
  ikke-sagsdata-flader) og devtools-diagnostikkens read-only `sections`-læsning i `MainLayout`.
- Ingen allowlist til produktionskode.
