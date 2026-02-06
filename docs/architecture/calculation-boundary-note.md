# Calculation Boundary Note - Mineo (Fase 3)

## Formaal
Fastlaegger en haard graense mellem **input**, **beregning** og **output** for trust-kritiske beregninger.
Noten er normativ: alle beregningsdomaener skal overholde denne graense.

## Definitioner

### Input (det eneste der maa ind i beregning)
- **Committed, schema-valideret brugerinput** fra persisted sections.
- **Read-only reference-data** (fx satser/regulation data) som input til beregning.
  - Reference-data skal behandles som eksplicit input til engines og maa ikke laeses implicit fra global konfiguration.

**Formkrav til input:**
- Valideret via Zod-schemas.
- Kommer som **immutable snapshots** (ingen mutation under beregning).
- Indeholder **kun canonical input**, ikke UI-state og ikke derived values.

### Output (det eneste der maa ud af beregning)
- **Deterministiske beregningsresultater** i en eksplicit output-struktur.
- Output kan mappes til UI-visning, rapportering eller PDF, men maa ikke gemmes som SoT.

**Formkrav til output:**
- Deterministisk for given input-snapshot.
- Ingen side-effects.
- Output maa kun eksistere som runtime-afledt data og maa ikke indgaa i persistence, snapshots eller committed input.

### Hvad maa ikke krydse graensen
Foelgende er **forbudt** i beregningslaget:
- React state, hooks eller komponenter.
- Zustand store access, selectors eller context-access.
- Persistence (sessionStorage, .eo save/load, IO-mekanismer).
- UI-policy (visibility, labels, tooltips, validation-feedback).
- Locale-/formatting-logik (dato/nummerformattering).
- Tid (fx Date.now) maa kun indgaa i beregning, hvis den er eksplicit en del af input-snapshot.

## Beregningslagets kontrakt
- Beregning = **rene funktioner**: input-snapshot -> output.
- Beregningslag maa **ikke** mutere input.
- Beregningslag maa **ikke** laese global state.
- Alle beregningsregler skal ligge i beregningslaget, ikke i UI/store.

## Graense-ejerskab (normativ)
- **Input-SoT:** Persisted sections (committed) via facade/store.
- **Regler-SoT:** Beregningslaget (engines/derivations).
- **UI-SoT:** Praesentation og layout, aldrig beregning.

## Grov klassificering af eksisterende beregningsflow
Denne klassificering er bevidst grov; den bruges kun til at afgoere, hvad der allerede er "engine-egnet".

### Allerede engine-egnet (kan flyttes direkte til beregningslag)
- Renteberegning: rentekrav-beregning og periodisering.
- TAF-beregning: overlap/perioder, dags-/maaned-omregning.
- EET/varigt men-beregninger (hvor rene funktioner allerede findes).

### Delvist engine-egnet (kraever oprydning af UI/store-logik)
- Aarsloen-beregninger hvor UI/helper-logik stadig styrer defaults eller afledt policy.
- Erstatningsopgoerelse (samlet): aggregering/afrunding skal isoleres som engine.

### Ikke engine-egnet (skal blive udenfor beregningslag)
- UI-policy helpers (visibility/warnings/labels).
- Draft/validation feedback.
- Persistence/IO og sessionStorage logic.

## Scope for naeste fase
- Maalet er **kun** at etablere en klar calculation boundary.
- Ingen migration eller kodeaendringer i denne note.
- Naeste skridt er design af pipeline (input snapshot -> engine -> output schema).

## Stop-regel
Enhver implementering, der blander UI/persistence/state ind i beregning, er et arkitekturbrud
og skal stoppes foer kode merge. Arkitekturbrud identificeres ved review og skal afvises,
uanset om funktionaliteten virker korrekt.
