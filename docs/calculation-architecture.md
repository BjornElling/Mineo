# Calculation Architecture - Mineo

## Purpose
This note is normative. It defines the calculation architecture rules that all engines, adapters,
and UI wiring must follow. It is intentionally concise and prescriptive.

## Calculation boundary
- Input: committed, schema-validated snapshots only (no draft state).
- Reference data must be passed explicitly as input (no implicit imports).
- Engines are pure functions: input snapshot -> output.
- Output is deterministic and must not be persisted as source of truth.

## Pipeline (required form)
CommittedInputSnapshot -> Prepare/Normalize -> Engines -> Adapters -> Aggregation -> OutputSchema

Rules per stage:
- Prepare/Normalize may only perform deterministic transformations that do not change
  the economic meaning of inputs.
- Engines implement domain rules and must not read global state, time, UI, or persistence.
- Adapters standardize engine outputs to aggregation shapes (e.g., { amount: number }).
- Aggregation is policy-driven and must be fail-closed.

## AggregationPolicy role
- Policy is the sole source of aggregation behavior (sign, override strategy, rounding).
- Aggregation must not infer or default missing values.
- Policy references adapter outputs only, never raw engine outputs.

## Fail-closed semantics
- Missing computed outputs -> aggregation result is null.
- Override=true with missing manual value -> aggregation result is null.
- UI must treat null as "cannot compute" and must not substitute defaults.

## UI <-> calculation contract
- UI must only read committed state; no calculations on draft state.
- UI must not call engines directly; it only consumes aggregation results.
- UI must not implement rounding, domain rules, or implicit defaults.
- UI must not persist any derived/calculated values.

## Prohibited behaviors
- Calculations in UI components or Zustand stores.
- Reading reference data implicitly from module imports inside engines.
- Storing calculation outputs in persisted snapshots.
- Using timing-dependent values (e.g., Date.now) unless provided explicitly as input.
