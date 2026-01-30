# Calculation Layer Decision (2026-01-27)

## Purpose
Separate calculation rules from UI and state, and prevent Zustand from becoming the default answer for calculation logic.

## Classification Rules (Normative)
Each calculation domain must be classified before implementation:
- **Pure function**: input → output, no state.
- **Derived state**: depends on exactly one persisted section.
- **Cross-section calculation**: depends on multiple sections.

Zustand is **not** the default for any of the above.

## Introduced Layer
`src/domain/calculations/` contains pure, testable functions with no React or store dependencies.

Selectors may call into this layer. The layer must not read from stores or call selectors.

## Current Scope
Initial extractions cover section-local derivations only:
- stamdata: default label + hasAny
- aarsloen: default loenperiode + hasAny
- satser: effective aargang + hasAny

## Stop Marker
Cross-section or heavy calculation domains (e.g., renteberegning) remain unclassified and out of scope until a dedicated decision is made.
