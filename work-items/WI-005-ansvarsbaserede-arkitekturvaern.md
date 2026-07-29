# WI-005: Ansvarsbaserede frem for navnebaserede arkitekturværn (Fase 6)

- **Status:** `afsluttet` 2026-07-29 — gennemført i draft/commit-reviewets **etape 12**. Se "Udfald" nederst.
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

## Relaterede

- `WI-006` (`invalidDraft`-navneoprydning) er den ANDEN rest udskilt fra WI-004. Den er obligatorisk før
  Fase 0–4 erklæres endeligt lukket; denne WI hører derimod til Fase 6 og har ingen indbyrdes afhængighed.

## Invarianter

- Et ansvarsbaseret værn må ikke blokere de dokumenterede undtagelser: `components/inputs/transient/` (tre
  ikke-sagsdata-flader) og devtools-diagnostikkens read-only `sections`-læsning i `MainLayout`.
- Ingen allowlist til produktionskode.

## Udfald (2026-07-29)

**Tre af de fire ansvarsgrænser var allerede lukket ANSVARSBASERET undervejs i draft/commit-reviewet** — ikke
som en lokal patch, men som de strukturelle rettelser, fundene selv pegede på:

| Ansvar | Håndhæves af | Lukket i |
|---|---|---|
| Hvem må se rå `sections` | `domain/raw-section-access-boundary` (alle fire adgangsformer) + `NewCaseSeed`-signaturen | R5-F02, etape 9 |
| Hvem må skrive til aggregatet | `input/write-boundary` + den COMPILER-håndhævede `ManifestStorageKey` | Fase 4 trin 13 / WI-007 |
| Hvem må producere feltissues | `input/issue-snapshot-capability-boundary` + `input/derived-writes-materialize-in-reduction` | R3-F04 + GM-F02, etape 4 |
| **Hvem må kalde en beregningsmotor** | **`domain/engine-call-owned-by-projection` (NY)** | **etape 12** |

Den fjerde manglede. Grænsen HOLDT i praksis — nul motorkald uden for projektionerne — men den var
**ubevogtet**: intet ville have fanget en side, en dokumentdefinition eller en anden slices projektion, der
greb direkte efter motoren og dermed omgik dependency-gaten (§7.3/GM-F07). Reglen binder de seks slice-motorer
1:1 til deres ejende reader-projektion.

**Mutationsbevist mod den LEVENDE kilde, begge veje:**

| Mutation | Udfald |
|---|---|
| Forsørgertabs VM kalder `computeForsoergertabSnapshot` direkte | rød med fil:linje:kolonne + navngiver den lovlige ejer |
| En ren TYPE-reference til motoren (ingen kald) | **grøn** — reglen måler kald, ikke imports |
| Projektionen holder op med at kalde sin motor | **INERT** — liveness-kontrollen kræver alle seks ejere |

Det navnebaserede `input/deleted-legacy-architecture-import` er BEVARET ved siden af, som WI'en foreskrev: det
er billigt og fanger en konkret genindførelse med en præcis fejlbesked.

**Afgrænsning, navngivet frem for udeladt i tavshed:** reglen dækker de seks slice-MOTORER (snapshot-/
beregningsentrypointet pr. domæne), ikke hver enkelt `compute*`-hjælpefunktion inde i et domæne. De sidste er
intern domænekomposition, og en regel over dem ville forbyde domænet at bruge sine egne dele.
