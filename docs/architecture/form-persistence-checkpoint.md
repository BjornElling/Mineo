# Form Persistence Checkpoint (2026-01-27)

## Context
- `FormPersistenceContext` was originally both facade and motor.
- Trust‑critical requirements demanded clearer SoT ownership, determinism, and selector‑level testability.
- A full refactor was high‑risk, so migration was done incrementally behind the existing public API.

## Decision
- The following persisted sections are now owned by an internal Zustand store:
  - `stamdata`
  - `aarsloen`
  - `satser`
- `FormPersistenceContext` remains the stable facade and public API.
- Zustand is used as internal engine only; UI and hooks are unchanged.

## Established Invariants (Normative)
- Exactly one source of truth per migrated section.
- No implicit or bi‑directional sync.
- Sync occurs only on: init, explicit persist, explicit clear, atomic replace.
- Legacy sanitization is an IO boundary concern, never a store/selector concern.
- No cross‑section selectors.
- Each migrated section has a local dev‑guard after atomic replace (fail‑fast, no auto‑sync).

## Consequences
- Improved determinism and selector‑level testability.
- Reduced implicit state and clearer ownership boundaries.
- Slightly more structural code, but consistent and repeatable.

## Stop Marker
- The migration phase for persisted sections is intentionally paused here.
- Further migrations may follow the same pattern.
- Cross‑section or calculation‑heavy domains (e.g., interest calculations) require a separate architectural decision and are explicitly out of scope for this checkpoint.
