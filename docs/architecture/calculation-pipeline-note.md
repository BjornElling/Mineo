# Calculation Pipeline Note - Mineo (Fase 3)

## Formaal
Definerer en audit-venlig beregningspipeline som fast struktur mellem input-snapshot og output-schema.
Noten er normativ og bygger direkte paa Calculation Boundary Note.

## Pipeline-form (normativ)

CommittedInputSnapshot
  -> Prepare/Normalize (valgfrit, rent)
     -> Engine (rene regler)
        -> OutputSchema

### Trin 1: CommittedInputSnapshot
**Ejer:** Persisted sections (committed) via facade/store.

**Input:**
- Schema-validerede section snapshots.
- Read-only reference-data som eksplicit input.

**Output:**
- Et samlet, immutable input-snapshot til beregning.
- Snapshot skal repraesentere eet konsistent tidspunkt og maa ikke sammensaettes fra flere commits.

**Maa ikke ske her:**
- Ingen beregning.
- Ingen UI-policy.
- Ingen formatting/locale.
- Ingen IO.

### Trin 2: Prepare/Normalize (valgfrit)
**Ejer:** Beregningslaget (ikke UI, ikke store).

**Formaal:**
- Strukturelle normaliseringer, som er deterministiske og auditbare.
- Ingen beregningsregler, kun inputforberedelse.

**Input:**
- CommittedInputSnapshot.

**Output:**
- NormalizedInput, der er stabilt og egnet til engine.

**Maa ikke ske her:**
- Ingen oekonomisk beregning.
- Ingen state access.
- Ingen side-effects.
- Prepare/Normalize maa kun udfoere deterministiske transformationer, der ikke aendrer den oekonomiske betydning af input.

### Trin 3: Engine (rene regler)
**Ejer:** Beregningsdomaenet.

**Input:**
- NormalizedInput (eller direkte snapshot hvis Normalize ikke bruges).

**Output:**
- RawResult (rent beregningsoutput).

**Maa ikke ske her:**
- Ingen persistence.
- Ingen UI-logik.
- Ingen locale/formatting.
- Ingen global state.
- Engine-output maa kun afhaenge af sit input og maa ikke indeholde metadata om beregningstid, kilde eller kontekst.

### Trin 4: OutputSchema
**Ejer:** Beregningslaget.

**Formaal:**
- Giver en stabil, eksplicit output-struktur.
- Skiller beregningsoutput fra UI-formattering.

**Input:**
- RawResult.

**Output:**
- OutputSchema som kan mappes til UI eller PDF.

**Maa ikke ske her:**
- Ingen UI-formattering.
- Ingen persistence.
- OutputSchema maa ikke indeholde praeformatterede strings beregnet til direkte visning.

## Eksempel 1: Erstatningsopgoerelse (samlet)

CommittedInputSnapshot
- erstatningsopgoerelse (SoT)
- beregnede delresultater (read-only input): renter, TAF, EET, varigt men, aarsloen

Prepare/Normalize (valgfrit)
- Samler delresultater i en ensartet struktur
- Validerer konsistens (fx manglende delresultater -> explict tomme felter)

Engine
- Aggregerer delbelob
- Anvender afrundingsregler
- Producerer samlet opgoerelse (RawResult)

OutputSchema
- Strukturerer totaler + delsummer + labels
- Ingen formatting (tal som numbers, datoer som ISO)

## Eksempel 2: Renteberegning

CommittedInputSnapshot
- renteberegning (SoT)
- satser/regulation data (read-only input)

Prepare/Normalize (valgfrit)
- Normaliserer perioder og dato-intervaller
- Expanderer satser til periodiserede intervaller

Engine
- Beregner renter pr. krav/pr. periode
- Samler totalsummer

OutputSchema
- Standardiseret struktur til tabel + rapport
- Ingen formatting (tal som numbers, datoer som ISO)

## Scope
- Noten definerer kun pipeline-strukturen.
- Ingen kode og ingen teststrategi her.
- Naeste trin er teststrategi baseret paa denne pipeline.

## Stop-regel
Enhver implementering, der springer pipeline-trin over eller blander ansvarsomraader,
maa afvises ved review, uanset funktionel korrekthed.
