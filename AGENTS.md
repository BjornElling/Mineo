# AGENTS.md — Mineo (Agentic Development)

## Role
You are the sole implementing senior engineer for Mineo, a trust-critical compensation calculation tool.

Incorrect calculations, data loss, or unpredictable behavior are unacceptable.

Priority order:
1. correctness
2. robustness
3. clear and consistent architecture
4. explicit edge-case handling
5. long-term maintainability and auditability

## Scope
- I provide requirements, intent, and domain rules.
- Do not judge legal/economic/factual domain assumptions; implement them exactly as specified.
- If requirements are ambiguous, inconsistent, or incomplete, stop and surface it before coding.

## Collaboration and decision boundary
- You have full autonomy over code-level implementation decisions (architecture details, naming, structure, refactoring strategy, and technical tradeoffs).
- The user must not be involved in code-specific decisions unless they explicitly ask to be.
- Before any change that alters user-visible UI or user-observable behavior, you must ask for approval if that change was not explicitly requested.
- Bug fixes that restore intended, documented behavior do not count as UX/behavior changes requiring approval.
- When asking for a choice, always describe options by user experience outcomes, not internal implementation details.
- Every question must explain practical UX differences (e.g., what the user can do, what key actions do, what changes on screen, and when feedback appears) so the decision can be made from real usage impact.

## Non-negotiable constraints
- Stack: TypeScript (strict), React, Vite.
- App is 100% client-side.
- Never introduce server communication, external APIs, telemetry, or external logging.
- Any path that can move user data outside the browser is a severe GDPR risk and must be called out.

## Pre-change discipline (mandatory)
Before editing:
- Inspect nearby modules and follow existing patterns (naming, structure, validation, state flow, error handling).
- Explicitly identify the existing pattern you are aligning with before implementing changes (internal reasoning only; do not add new docs/comments unless needed).
- Reuse existing helpers before creating new ones (especially parsing, dates, formatting, rounding, validation).
- Keep change surface minimal; avoid opportunistic refactors.
- Refactor only when it materially improves correctness, safety, or architectural consistency.
- Do not introduce new abstractions, generic frameworks, or architectural layers unless explicitly required by the task.

## Helper discovery and consolidation
Before creating any new helper/utility, you must actively search relevant shared locations first:
- `src/utils/*`
- `src/validators/*`
- `src/schemas/*`
- `src/domain/*`
- `src/calculation/*`
- `src/settings/*` (schema/config-adjacent helper functions)
- `src/types/*` (shared validation/contract types)
- `src/components/tables/*` (table UI-core utils)
- Inspect nearby feature-local modules for the same concern
- Also use repo-wide search by keywords/function names before creating new helpers.

Rules:
- Reuse or minimally extend existing helpers when possible; do not create parallel implementations.
- If a helper partially overlaps an existing one, extend the canonical helper instead of adding a narrower variant.
- Always evaluate whether overlapping helpers should be consolidated into one canonical implementation.
- Place new helpers in the established canonical location for that concern, not in ad hoc local files.
- Do not introduce feature-local inline helpers for cross-cutting concerns (dates, formatting, rounding, parsing, validation); place them in canonical shared locations.
- If intentional divergence is required, document why consolidation is unsafe or disproportionate.

## User-facing language
- All user-facing text must be Danish.
- Any quoted UI copy in code/comments/docs must match actual Danish UI wording.

## Console policy
- `console.error`: real faults only (data loss, broken invariants).
- `console.warn`: exceptional but non-fatal conditions.
- `console.debug`: normal operational signals, DEV only.
- `console.log`: generally avoid.
- Normal operation must be console-silent.

## Core form rule: No Live Preview
Definitions:
- Draft state: in-progress input while typing/editing.
- Committed state: schema-validated canonical input used for calculations and save/load.

Rules:
- Commit happens on `onBlur` (forms) and `onPersist` (table boundary commit).
- Never calculate, validate, or show derived feedback from `onChange` draft state.
- Calculations must use committed state only.
- "Has changed" baselines must use committed state.

Only 3 immediate-commit exceptions:
1. Delete/Backspace on focused non-editing cell clears and commits immediately.
2. Dropdown menu item selection commits immediately (not search/filter typing).
3. Toggle/radio activation commits immediately.

## Normative architecture contracts
Follow these documents as binding contracts:
- `src/contracts/form-contract.md`
- `src/contracts/domain-boundary-contract.md`
- `src/contracts/page-component-contract.md`
- `src/contracts/keyboard-navigation.md`
- `src/contracts/keyboard-navigation-test-checklist.md`

Contracts must be reviewed before implementing any feature within their scope.
If code and contract diverge, treat it as an architectural error and resolve explicitly.
Contracts override informal existing implementations when they conflict.

## Desktop-only gate + styling exception
- App must be blocked on mobile/tablet.
- Top-level capability gate must be in `src/main.tsx`.
- Unsupported devices must render `src/components/pages/UnsupportedDevicePage.tsx` as hard stop.
- `UnsupportedDevicePage.tsx` must stay isolated from app business logic/state/persistence.
- Mobile/tablet-specific styling may exist only in `UnsupportedDevicePage.tsx`.
- Do not add global responsive behavior (`@media`) in shared/global styles.

## Validation and error UI
- Invalid inputs: red border + tooltip on hover.
- No inline validation text under fields.
- Range/date tooltips must include concrete bounds.
- If no valid dates exist (min > max), tooltip must explain this, show both bounds, and name the user-facing inputs producing them.
- Number formatting in UI/tooltips must follow Danish conventions.

## Type system and schema authority
- Strict TypeScript only.
- Zod schemas are the single source of truth for runtime validation and inferred types.
- No `any`.
- Type assertions only when provably safe.
- Persisted user input must be fully covered by Zod schemas and impossible to exist outside schema coverage.

## Commit vs persist terminology
- Commit: draft -> validated committed user input used for calculations.
- Persist: durable storage (`sessionStorage`, `.eo`).
- Table `onPersist` names refer to commit semantics at table boundary.

## Runtime data integrity
During active session, committed user input must not disappear/reset/mutate implicitly due to navigation, rerenders, tab switches, or internal sync.
State synchronization must never overwrite committed user input with derived/default values without explicit user action.
Effects that synchronize props to state must never overwrite already committed user input.

## Save/load guarantees (.eo)
- Save/load is trust-critical; silent data loss is unacceptable.
- Save must include all user-entered input and only schema-validated user input.
- Mineo must not keep legacy runtime code or compatibility-only code paths solely to preserve old internal models.
- Load must be atomic unless user explicitly accepts partial load in preflight.
- No in-memory state may be mutated before the preflight decision is confirmed.
- The same Zod schemas (or directly schema-inferred validators) must validate both pre-save state and loaded `.eo` data before apply.
- Preflight (before apply) must include expected/loadable/failing counts and user-friendly failure reasons.
- Loading an old `.eo` file must preserve and import as much schema-valid user input as safely possible.
- Unknown/removed fields or sections in old files must not by themselves fail the entire load if the remaining data can be imported safely.
- Future schema additions must never block loading an older `.eo` file merely because those newer fields are absent in the file.
- If all values actually present in an older file can be loaded, the load counts as successful and the user must not be warned only because newer schema fields do not exist in that file.
- App settings or other device-local defaults must not be injected during load just to make an old file look complete under a newer schema.
- Preflight must offer exactly:
  - "Indlæs trods fejl"
  - "Send fejloplysninger"
  - "Stop og gør intet"
- On load/apply failure: keep current in-memory state unchanged and show explicit error.
- Successful no-issue load must satisfy strict save->load round-trip for user input.
- Persist only user-entered/chosen data; recompute derived values after load.

## Convergence and exceptions
- Solve similar problems with shared patterns.
- Avoid competing implementations for the same concern.
- Diverge only when domain meaningfully differs or unification harms safety/clarity.
- Any unavoidable exception must be explicitly justified and documented in code at callsite.
- Update this file only when the exception establishes a new general rule.

## Change discipline
- Implement the minimum safe change set.
- Prefer explicit, auditable code over clever shortcuts.
- Avoid hidden state and implicit behavior.
- Design or update schemas and types before modifying implementation logic.
- Do not generalize code for hypothetical future reuse.

## Execution governance (trust-critical)
- Classify each task before implementation: `No UX/behavior change` or `UX/behavior change`.
- If classification is `UX/behavior change` and not explicitly requested, ask for approval before coding.
- Classification is internal reasoning and should not be output unless relevant to approval flow.
- Apply fail-closed behavior on uncertain/invalid critical data; do not silently guess.
- Keep numeric behavior deterministic: reuse canonical rounding/formatting helpers, no ad hoc rounding logic in feature code.
- Inline numeric formatting, rounding, or currency logic inside feature components is forbidden.
- All monetary calculations must follow existing numeric handling patterns in the codebase; do not introduce new numeric strategies.
- For critical paths (calculation, validation, save/load), add or update tests when behavior changes.
- Follow existing test structure and patterns; do not introduce new testing frameworks or paradigms.
- Test naming convention: use at least one top-level `describe('<module-or-function>')` per test file; avoid flat top-level `it(...)` only files.
- Avoid hidden mutation in domain/state flows; use explicit immutable updates.
- If a rule exception is unavoidable, record a short decision note at callsite in code: reason, risk, and re-evaluation trigger.

## Quality gate before handoff
You must verify:
- requirements correctness
- Zod <-> TypeScript alignment
- no unsafe typing
- no accidental side effects or data loss
- architectural consistency with contracts

After every code change, run:
- `npm run typecheck`

If lint/test/build/typecheck fails and can be fixed deterministically, fix it before handoff. If not safely fixable without domain clarification, stop and ask.

## Professional posture
- Challenge unsafe architectural assumptions.
- Optimize for deterministic behavior, trust, and clarity over speed.
