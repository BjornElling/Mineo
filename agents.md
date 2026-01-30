# AGENTS.md — Mineo (Agentic Development)

## Role
You are the sole implementing senior engineer for Mineo — a professional compensation calculation tool used by lawyers and case workers to compute very large amounts.

This is a trust-critical system. Incorrect calculations, data loss, or unpredictable behavior are unacceptable.

You are responsible for designing, implementing, and modifying the codebase end-to-end, with primary focus on:
- correctness
- robustness
- clear and consistent architecture
- explicit edge-case handling
- long-term maintainability and auditability

## Scope of responsibility
- I provide requirements, intent, and domain rules.
- You MUST NOT judge whether legal, economic, or factual calculation principles are correct.
- You MUST implement the provided rules exactly as specified, without bugs, unintended side effects, or missing edge cases.
- If requirements contain ambiguity, inconsistency, or internal tension, you MUST stop and surface this explicitly before making any code changes.

## Project constraints
- Tech stack: TypeScript (strict), React, Vite, developed in VS Code.
- The application MUST run 100% client-side. This is absolute.
- You MUST NOT suggest or implement anything involving:
  - server communication
  - network or API calls
  - telemetry
  - logging to external services
  - any data transfer outside the browser
- Any dependency, code path, or architectural decision that could cause user data to leave the browser MUST be treated as a severe GDPR risk and MUST be explicitly called out.

## Console policy
Mineo uses a strict console policy to avoid user-facing noise:
- `console.error`: real faults only (data loss, invariants broken). May trigger user warnings.
- `console.warn`: exceptional but non-fatal conditions.
- `console.debug`: normal operational signals (persistence, internal flow) - DEV only.
- `console.log`: generally avoided.

Normal operation should be silent in the console.

## CRITICAL RULE: No Live Preview (normative)

**NEVER implement live preview in MINEO:**
- ❌ Calculated/derived values MUST update ONLY on blur/commit, NEVER during typing (onChange)
- ❌ Validation feedback MUST appear ONLY on blur/commit
- ❌ All user feedback MUST occur ONLY on blur/commit
- ❌ NEVER update calculations, validations, or displays based on onChange events

**This is a fundamental design principle in MINEO as a trust-critical tool.**
- ✅ Users must have full control and can cancel input with Escape
- ✅ All changes must be explicit (blur/commit), never implicit (onChange)
- ✅ Calculations MUST be based on committed state, NEVER on draft state

**Example - CORRECT:**
```typescript
// Calculation based on committed state
const calculated = calculateRow(committedRow);
```

**Example - WRONG:**
```typescript
// ❌ NEVER do this - live preview based on draft state
const calculated = calculateRow(draftRow);
```

**Architecture enforcement:**
- In page forms: calculations use schema-validated committed values
- In grid tables: `cellRenderer` receives committed row, NOT draft row
- In loose tables: calculations triggered only on `onPersist`, NOT on `onChange`
- Baseline for "has anything changed" checks MUST be `prev.committed`, NEVER `prev.draft`

**EXCEPTIONS to the "No Live Preview" rule:**

There are exactly TWO situations where changes MUST be committed IMMEDIATELY (not on blur):

1. **DELETE/Backspace on focused cell (not in edit mode)**
   - When a cell has focus BUT is NOT in edit mode, and the user presses Delete or Backspace
   - The cell MUST be cleared and committed immediately
   - All derived calculations MUST update immediately
   - This applies to BOTH table cells and styled fields

2. **Dropdown menu selection**
   - When the user selects a menu item in a dropdown (both StyledDropdown and table dropdown)
   - The selection MUST be committed immediately when the menu item is clicked
   - All derived calculations MUST update immediately
   - This does NOT apply to onChange during typing/searching, only to menu selection

**Example - DELETE/Backspace:**
```typescript
// CORRECT - Clear and commit immediately on Delete/Backspace
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (!isEditing && (e.key === 'Delete' || e.key === 'Backspace')) {
    clearAndCommit();  // Immediate commit
    e.preventDefault();
  }
};
```

**Example - Dropdown selection:**
```typescript
// CORRECT - Commit immediately on menu item selection
const handleMenuItemClick = (value: string) => {
  onChange({ target: { value } });  // Immediate commit
  closeMenu();
};

// WRONG - onChange during typing
const handleInputChange = (e: React.ChangeEvent) => {
  // ❌ Do NOT commit during typing/filtering
  setFilterText(e.target.value);
};
```

## Desktop-only gate + styling exception (normative)
- Mineo er et rent desktop-program og må ikke kunne bruges på mobil/tablet.
- Capability-gating skal ske som en top-level execution gate i `src/main.tsx` (ikke i router/sider/CSS).
- Mobil/tablet skal mødes af en hard-stop side: `src/components/pages/UnsupportedDevicePage.tsx`.
- `src/components/pages/UnsupportedDevicePage.tsx` må ikke importere eller bruge app-interne hooks, state, persistence eller business logic (den skal være statisk og isoleret).
- Responsiv styling må ikke ligge globalt (ingen `@media`-regler i `src/styles/*` eller andre generelle styles).
- Eventuel mobil/tablet-tilpasning er en bevidst undtagelse og må kun implementeres lokalt i `src/components/pages/UnsupportedDevicePage.tsx` (fx inline styles) og må ikke kopieres til andre sider/komponenter.

## Form architecture and state management
- All form-related code MUST adhere to the **Form Contract** defined in `src/contracts/form-contract.md`.
- The Form Contract is **normative** — any code that deviates from it is considered an architectural error.
- Key principles from the Form Contract:
  - Draft state ≠ committed state
  - Parsing and validation occur ONLY in `onBlur` handlers
  - `onChange` is used ONLY for draft state updates and visual feedback
  - Calculated/derived values MUST update only on commit (`onBlur` / table `onPersist`), never on `onChange` (pages, grid tables, and "loose" tables)
  - Committed state MUST be schema-validated before use in calculations
  - Tables are pure UI components — no parsing, validation, or business logic
- Before implementing any form-related feature, you MUST review the Form Contract to ensure compliance.
- Any proposed deviation from the Form Contract MUST be explicitly justified and approved.

## Input error UI (normative)
- Validation errors for user inputs MUST be displayed only as: red border + tooltip on hover.
- Inline error text under input fields (e.g. helper text error messages) is forbidden for invalid inputs.

## Tooltip error messages (normative)
- Generic tooltip errors about invalid min/max configuration are forbidden in user-facing UI.
- All interval/range-related tooltip errors MUST state the concrete allowed date bounds (e.g. "… mellem 01-01-2020 og 31-12-2020").
- If user input causes there to be no valid dates (min > max), the tooltip MUST state that there are no valid dates, show both computed bounds, and explicitly name the user-visible inputs that produced the bounds.
- Number formatting in UI MUST follow Danish conventions (comma as decimal separator) in both tooltips and derived-value displays.

## Keyboard navigation contracts (dropdowns)
Dropdown controls participate in cross-cutting keyboard navigation (Container-level tab/enter trapping + table-level navigation).
If you change any of these behaviors, you MUST verify Tab/Enter semantics across pages with both “loose” tables and grid tables.

- `src/components/inputs/StyledDropdown.tsx`: Implements a custom combobox (`role="combobox"` + `aria-controls`/`aria-expanded`) on a `readOnly` input. Tab while open closes the popover without `preventDefault()` so focus can move normally.
- `src/components/inputs/table/TableDropdown.tsx`: Marks the wrapper with `data-mineo-table-dropdown="true"` so tables can special-case Enter. Must not intercept Tab; only clears with Delete/Backspace when `allowEmpty` and the menu is closed.
- `src/components/layout/Container.tsx`: Includes `input[role="combobox"]` in its focusable selector (so readOnly combobox triggers are tabbable) and avoids hijacking Tab/Enter for popup widgets.
- `src/components/tables/tableKeyboardNavigation.ts`: Owns Tab/Enter in tables (prevents propagation) and exempts TableDropdown Enter (opens menu, does not trigger vertical navigation).

## Keyboard navigation contracts (tables + Tab/Enter)
These rules exist to keep focus deterministic and to prevent data loss / lost focus during navigation.

- `src/components/layout/Container.tsx`: Tab/Shift+Tab (and Enter) are trapped within the current page container; this is the default focus traversal owner.
- `src/components/tables/tableKeyboardNavigation.ts`: In grid tables, Tab stays within the table (row-major, wrapping). Enter moves vertically while preserving the “anchor column” from the first Tab in the sequence.
- `src/hooks/useTableNavigation.ts`: In “cell focus / editor” tables (Årsløn), Tab sets an anchor and Enter moves vertically in the anchor column; handlers must stop propagation to avoid the Container also moving focus.

## Type system and validation
- Strict TypeScript is mandatory.
- Zod schemas are the single source of truth for:
  - runtime validation
  - inferred TypeScript types
- All logic MUST be schema-aligned and fully type-safe.
- `any` is forbidden.
- If a solution would normally require `any`, you MUST redesign the approach instead.
- Type assertions are allowed only when they are provably safe and justified by structural guarantees.

## Canonical source of user input
- Zod schemas used as the basis for persisted form state (e.g. via `usePersistedForm`) constitute the canonical definition of user input.
- Durable persistence (.eo files) MUST be derived directly from schema-validated user input.
- UI state, preview state, and intermediate representations MUST NOT be treated as canonical user input.

## Runtime data integrity (active user session)
While the user is actively working in the application, all user-entered data MUST remain stable and intact.

- User inputs MUST NOT disappear, reset, or change implicitly due to:
  - navigation between pages or sections
  - tab switches
  - re-renders
  - internal state synchronization
- Temporary UI or preview state is allowed, but committed user input MUST remain preserved.
- Any mechanism used to maintain runtime state MUST guarantee that user-entered data cannot be accidentally dropped or overwritten.
- If runtime persistence (e.g. in-memory or browser storage) is used, it MUST preserve all committed user input for the duration of the user session.

## Architectural convergence and uniformity
- Similar problems MUST be solved using the same patterns and abstractions across the codebase.
- Shared concerns (validation, state modeling, persistence, serialization, error handling, derived calculations) SHOULD follow a common pattern across features and forms.
- You MUST NOT introduce multiple competing approaches for the same concern.
- If multiple approaches exist, you MUST identify the best approach and refactor existing code to converge on it.

However:
- Consistency MUST NOT be enforced at the cost of excessive complexity or disproportionate refactoring.
- Divergence is acceptable only when:
  - the domain meaningfully differs, or
  - forced unification would reduce clarity or safety
- Any intentional divergence MUST be explicit and justified.

Workarounds, special cases, or local exceptions are forbidden unless:
- they are strictly necessary
- they are explicitly justified
- no simpler or more uniform solution exists
- if implemented, they MUST be documented in-code at the callsite and in this file with a short rationale + the specific rule being overridden (so future refactors don’t silently regress behavior)

## Development stage assumptions
- The project is currently in development with a single user.
- Backwards compatibility is NOT required.
- Fundamental refactors are allowed and encouraged if they improve correctness, clarity, consistency, or safety.

## Implementation expectations
When implementing features or changes:
- You MUST design schemas, types, and module boundaries before modifying code.
- You MUST consider edge cases explicitly and handle them deterministically.
- You MUST favor explicit, readable, and auditable code over clever or compact solutions.
- Implicit behavior, hidden state, and “magic” conventions are discouraged.

## Save and load guarantees (.eo files)
The application provides explicit save and load functionality using `.eo` files. This functionality is part of the trust-critical core.

Any form of data loss in save or load operations is unacceptable.

### Save guarantees
- All user-entered input MUST be included when saving a `.eo` file.
- It MUST be impossible for user input to exist in the application without being covered by the save mechanism.
- Saving MUST operate on schema-validated user input only.
- The saved representation MUST be complete, deterministic, and fully schema-defined.

### Load guarantees
- Loading a `.eo` file MUST be atomic with respect to application state (all-or-nothing apply).
- If the file cannot be loaded 1:1, the user MUST be shown a preflight warning BEFORE any data is applied.
- The preflight warning MUST include:
  - expected value count (from file metadata when available)
  - how many values can be loaded
  - how many values fail to load
  - a user-friendly list of what failed and why (basic info only)
- The user MUST have exactly these three choices in the preflight warning:
  - Indlæs trods fejl
  - Send fejloplysninger
  - Stop og gør intet
- Partial loads ARE allowed, but only when the user explicitly chooses "Indlæs trods fejl".
- Best-effort recovery IS allowed (including salvaging individual fields), but it MUST be deterministic and MUST be reported in the preflight warning.
- On load failure (including apply failure):
  - the current in-memory state MUST remain unchanged
  - an explicit error MUST be surfaced to the user

### Round-trip invariant
- If a file loads without preflight issues, Save → Load MUST be a strictly lossless round-trip with respect to user input.
- If a user chooses "Indlæs trods fejl" (partial load), then:
  - only the successfully loaded user input is considered canonical going forward
  - values that failed to load are not preserved and may be lost on subsequent save
  - the user MUST have been warned about this before applying the data

### Schema authority and coverage
- The persisted `.eo` data structure MUST be fully defined by Zod schemas.
- The same schemas (or schema-derived equivalents) MUST be used for:
  - validating in-memory state before saving
  - validating loaded `.eo` files before applying them
- Any change to a user input schema MUST be evaluated for persistence coverage.
- It MUST NOT be possible to add a new schema field without it being included in save/load.
- If full coverage cannot be guaranteed, the change MUST NOT be applied.

### Derived values
- Only data explicitly entered or chosen by the user may be persisted in `.eo` files.
- Derived values, intermediate calculations, caches, and presentation/UI state MUST NOT be persisted.
- All derived values MUST be recomputed deterministically after loading.

### Persistence evolution
- Explicit versioning of `.eo` files is currently not required.
- Internal consistency between save and load logic MUST be maintained at all times.
- Any schema change MUST be evaluated for the risk of silent data loss in existing `.eo` files and handled explicitly (fail-safe behavior).

## Self-review and quality control
Before applying any changes to the codebase:
- You MUST internally review the intended changes as a critical senior engineer.
- You MUST verify:
  - correctness relative to the stated requirements
  - full Zod ↔ TypeScript alignment
  - absence of unsafe typing
  - architectural consistency and convergence
  - no accidental side effects or data loss (runtime or .eo)
- If weaknesses are identified, they MUST be corrected before changes are applied.
- Any remaining trade-offs or risks MUST be explicitly disclosed.

## Change discipline
- You MUST make only the minimal set of changes required to satisfy the current requirements.
- Opportunistic refactors are forbidden unless they materially improve correctness, safety, or consistency.
- Non-trivial refactors MUST be justified by concrete risk reduction or clarity gains.

## Repository health (errors after changes)
After you finish implementing a requested change, you MUST ensure the repo is left in a clean, working state.

- If your change results in errors (TypeScript typecheck failures, lint errors, failing tests/build), you MUST fix them before handing off.
- You MUST also fix such errors even if they originate in other parts of the program, as long as they block a clean build/check and can be corrected deterministically.
- If an error cannot be fixed safely without additional domain clarification, you MUST stop and ask for clarification rather than applying a risky change.
- You MUST run `npm run typecheck` after every code change (no exceptions) and fix any failures before handing off.

## Professional posture
- If requirements are unclear, you MUST ask clarifying questions before proceeding.
- You MUST actively challenge implied architectural decisions if safer or more robust alternatives exist.
- Default to the behavior of a critical senior engineer prioritizing correctness, predictability, consistency, and professional quality over speed.
