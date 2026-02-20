# Calculation Architecture (Normativ)

**Status:** Gældende arkitektur
**Scope:** Alle beregningsdomæner i Mineo

Dette dokument er den kanoniske kontrakt for beregningsarkitektur.

## 1. Calculation boundary

Beregningslaget må kun arbejde på:
- Committed, schema-valideret input
- Eksplicit indgivet read-only reference-data

Beregningslaget må aldrig afhænge af:
- React/hooks/komponenter
- Zustand selectors/store-access
- Persistence (`sessionStorage`, `.eo`, fil-IO)
- UI-policy, labels, tooltips, visningslogik
- Locale-formattering
- Implicit tid (`Date.now`) uden eksplicit input

## 2. Påkrævet pipeline

Alle beregningsflows skal følge denne form:

`CommittedInputSnapshot -> Prepare/Normalize (valgfrit) -> Engine -> OutputSchema`

Regler:
- Snapshot er immutable og konsistent for ét commit-tidspunkt.
- Prepare/Normalize må kun lave deterministisk struktur-normalisering.
- Engine er ren funktion uden sideeffekter.
- OutputSchema er struktureret data (ikke præformatterede UI-strings).

## 3. Input- og output-regler

Input:
- Zod-valideret
- Canonical committed state
- Ingen draft state
- Ingen derived UI-state

Output:
- Deterministisk for givet input
- Runtime-afledt (må ikke persistes som source of truth)
- Tal/datoer i maskinvenlige værdier (ikke locale-formatterede strings)

## 4. Fail-closed krav

Aggregation og tværgående beregninger skal være fail-closed:
- Manglende nødvendige inputs/outputs giver `null`/"kan ikke beregnes"
- Ingen implicitte defaults eller gæt i beregningslaget
- UI må ikke erstatte manglende beregningsresultater med fallback-tal

## 5. Lagdeling

- `src/domain/calculations/` bruges til section-lokale, rene afledninger.
- Tværgående/økonomiske beregninger implementeres som dedikerede engines i domænelag, ikke i selectors/UI.
- Selectors må kun vælge/forme allerede beregnede outputs til visning.

## 6. Domæneklassificering (normativ baseline)

Section-lokale afledninger:
- `stamdata`
- `aarsloen`
- `satser`

Tværgående engines:
- renter
- tabt arbejdsfortjeneste
- erhvervsevnetab
- samlet erstatningsopgørelse (aggregation)

Støttedomæner i beregningslag:
- periode-opdeling/overlap
- afrunding/præcision
- output-modeller

## 7. Teststrategi (krav)

Engine-tests skal kunne køres uden UI/store/persistence.

Minimum pr. engine:
- Happy path
- Edge cases/grænseværdier
- Afrunding/præcision
- Determinisme (samme input => identisk output)

Forbud i engine-tests:
- Store/context-baseret inputopbygning
- UI helpers/selectors/draft state

## 8. Stop-regel

Kode, der blander beregning med UI/store/persistence, er arkitekturbrud og må ikke merges, også hvis funktionaliteten ser korrekt ud.

## 9. Beløbsberegning og afrunding (normativ)

For felter baseret på `AmountValue` (inkl. udtryk) gælder:

1. Operander bevares uændret under evaluering:
- Indtastede deltal i et udtryk må ikke pre-afrundes eller pre-afskæres.
- Udtryk evalueres deterministisk uden floating-point øretab.

2. Afrunding sker kun på slutresultatet ved commit:
- Feltets committed numeriske værdi afrundes til feltets precision (standard: 2 decimaler).
- Afrundingsmetode er `half away from zero` for beløb.

3. Nedstrøms beregninger må kun bruge committed værdi:
- Engines/aggregation må ikke genberegne fra draft/udtrykstekst.
- Beregninger skal læse `AmountValue.value` (ikke `AmountValue.expression`).

4. Load/import skal konvergere til samme committed semantik:
- Indlæste/legacy beløb normaliseres til samme precision og afrundingsmetode som commit.
- Beregningslaget må derfor ikke modtage uafrundede `AmountValue.value` fra persistence.
