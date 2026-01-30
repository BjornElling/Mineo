# Selector Extraction Checkpoint (Fase 2) — 2026-01-27

## Kontekst
- Efter migration af persisted sections blev UI-afledninger identificeret som næste SoT-risiko.

## Beslutning
- UI-afledninger er flyttet til section-baserede selectors og calculations.
- UI fungerer nu udelukkende som projektion af committed state.

## Etablerede regler (normative)
- UI må ikke indeholde domæneafledninger.
- Selectors må kun afhænge af én section.
- Calculation-helpers kan udtrykke UI-policy, men ikke finansielle beregninger.
- Ingen cross-section selectors i Fase 2.

## Scope (gennemført)
- stamdata
- aarsloen
- satser

## Stop marker
- Videre beregningslogik (fx renter) kræver ny arkitekturbeslutning (Fase 3).
