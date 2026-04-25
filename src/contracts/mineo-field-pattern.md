# Mineo Field Pattern (Internal Standard)

This document defines the **required internal pattern** for Mineo’s custom form fields (Styled*Fields and table inputs).

It is a supplement to the normative Form Contract:
- `src/contracts/form-contract.md`

Mineo is trust-critical. Any ambiguity in field semantics (draft vs commit vs blur) is treated as a correctness risk.

## Terms

- **Draft**: temporary user-typed string shown in the input while typing.
- **Committed value**: the validated, typed model value used by calculations/persistence.
- **Commit attempt**: an internal operation initiated by `useDraftField`, typically triggered by blur, Enter, or an explicit imperative commit. Never triggered by typing (`onDraftChange`).
- **Physical blur**: focus actually leaving the control. Must not imply commit semantics.

## Layering (must not be broken)

### Layer A — UI base (e.g. `StyledTextFieldBase.tsx`, `StyledTextAreaBase.tsx`)

Responsibilities:
- Render/styling
- Forward focus/blur/keydown
- Draft string in/out

Must NOT:
- parse/validate/normalize
- know model types
- expose event-based `onChange(event)` APIs upwards

Invariants:
- Accepts only `draft: string` + `onDraftChange(draft: string)`
- Input-semantic handlers (`onFocus`/`onBlur`/`onKeyDown`/`onPaste`) are bound to the actual `<input>`/`<textarea>`
- Mouse-interaction handlers (`onClick`/`onMouseDown`/`onDoubleClick`) are bound to the input root so the full field
  hit-area (including adornments with `pointer-events: none`) participates in two-stage activation
- `inputRef` is honestly typed (`HTMLInputElement`/`HTMLTextAreaElement`)

### Layer B — Draft/commit engine (`useDraftField.ts`)

Responsibilities:
- Local draft state
- Commit policy (blur/enter/escape)
- Race-free handling of async parent updates (post-commit resync)
- `touched` + local parse error state
- Exactly one commit channel (`onCommit`)

Must NOT:
- know anything about specific field domains
- use event objects in its public API
- rely on reference equality or object identity as a correctness signal when resyncing external values

### Layer C — Field adapter (e.g. `StyledAmountField.tsx`, `StyledDateField.tsx`, …)

Responsibilities:
- Define parse/validate rules
- Define canonical formatting of committed values
- Define domain constraints (min/max/etc.)
- Map `draft: string` ⇄ `TModel`
- External error precedence behavior

Must NOT:
- mutate the user’s draft while typing (no masking, replacement, or canonicalization during `onDraftChange`; normalization is allowed only on commit)
- have multiple commit paths

## Event contract (Styled*Fields)

All Styled*Fields MUST follow this public contract (names are normative):

- `onDraftChange?: (e: { target: { value: string } }) => void`
  - called on typing only
  - payload is the raw draft string
- `onCommit?: (e: { target: { value: TModel } }) => void`
  - called only on successful commit attempts (blur/enter/imperative)
  - payload is the typed committed value
- `onBlur?: (e: React.FocusEvent<...>) => void`
  - physical blur only (never "commit")
  - invariant: internal `useDraftField.onBlur` runs **before** external `onBlur`
  - note: internal blur handling may synchronously commit and trigger parent re-renders; external `onBlur` must not assume the field is still mounted after the internal call

Shared types live in:
- `src/components/inputs/fieldEvents.ts`

Event shape note:
- Mineo field events are branded and are not DOM events; do not treat them as such.

## Parsing contract

Adapters implement:

`parse(draft: string, { mode: 'typing' | 'commit' }): DraftParseResult<TModel>`

Rules:
- `ok: true` means **committable**
- In `typing` mode: return `partial` for any input that is not fully committable. Do not claim validity for incomplete input.
- In `commit` mode: return either `ok: true` or `invalid` (with a deterministic message)
- `partial/empty` without message in `commit` mode is forbidden (DEV-asserted by `useDraftField`)

Value canonicalization (commit semantics):
- Some adapters intentionally canonicalize the committed **value** during `commit` parsing (e.g. rounding, fraction reduction).
- This is allowed if and only if it is deterministic, happens only in `commit` mode, and is documented as part of the field contract.
- In `typing` mode, parsing must not claim committable values for incomplete input and must not canonicalize/transform the user's draft.

Guidance (UX consistency):
- In `typing` mode, `partial` should normally omit `message` to avoid premature "error" UI.
  Only use a `message` for truly UX-critical guidance.
- Fully silent typing is also allowed (no message until commit). If guidance is needed, prefer placeholder/helperText over parse messages.

## Formatting contract

Formatting is **post‑commit only** and defined solely by:
- `format(value: TModel): string`

Requirements:
- deterministic and stable
- canonical committed representation for this field
- must not collapse distinct committed values within field semantics

## Keyboard/commit policy (default)

Default policy (all fields unless explicitly justified):
- `Blur` → commit attempt
- `Enter` → commit attempt (prevent default)
- `Escape` → cancel (never commit; suppress the immediately following blur-triggered commit)

`useDraftField` implements this policy.

## Error ownership (single source in UI)

UI must show at most one error source at a time per field instance:
1) external error (authoritative)
2) local parse error (gated by `touched`)
3) none

Local error state must be preserved even while an external error is shown (suspended, not reset).

## Table inputs

Table inputs are UI-specialized, but must preserve the same principles:
- `onChange` = draft only
- `onBlur` = commit attempt only (table-specific deviation from Styled*Field blur semantics)
- Validation must not run continuously via `useEffect` while typing
- Any normalization/canonicalization must happen only on blur (commit)

## Instant-commit controls (explicit exceptions)

Some controls are intentionally **instant commit** (no draft/cancel phase):
- Toggle switches (e.g. `StyledToggleSwitch.tsx`)
- Radio groups (e.g. `StyledRadioButton.tsx`)
- Select-like controls (e.g. `StyledDropdown.tsx`)

Rules for instant-commit controls:
- `onCommit` is fired immediately on user interaction (same tick as the control's native change event).
- There is no `useDraftField` usage, and no `Escape`/rollback semantics.
- `onCommit` may be semantically identical to the control's native change callback (e.g. radio selection).
- For select/combobox-style controls, commit happens on selection (`onChange`); `Escape` typically only closes the popover/menu.
- If the control has a popover/menu interaction, expose an explicit `onClose` (interaction ended) separate from physical `onBlur`.
- If an imperative handle is exposed (e.g. `shake()`), its semantics must be documented and it must not mutate committed form state.

These are allowed deviations, but they must remain explicit and consistent.

## Hidden domain rules (must be explicit)

If a component has an unavoidable default (or a non-obvious constraint), it must be exposed explicitly via props and/or documented in the component props.

Examples in Mineo:
- Percent fields require explicit opt-in for the default range (`useDefaultPercentRange`).
- Year/week parsing of 1-2 digit years must be policy-controlled (`twoDigitYearPolicy`).
- Digit safety caps (e.g. integer `safetyMaxDigits`) must be explicit.

## Notes on UI bases

UI base components (Layer A) intentionally use the simplest possible API:
- `onDraftChange(draft: string)` (not event-shaped)

Field adapters (Layer C) are responsible for wrapping draft changes into Mineo's event shape (`DraftChangeEvent`)
for consistency at the Styled*Field boundary.

UI base invariants (a11y + contract):
- Invalid-input errors MUST be shown via red border + tooltip on hover (no inline helper-text error rendering).
- `error === true` must not be silent: `helperText` must be provided (DEV-asserted by bases) and is used as the tooltip + a11y described-by text.
- `htmlInputAttributes`/`htmlTextAreaAttributes` must be treated as adapter-internal; do not pass them from pages/call-sites.

## Reference implementations

Use these as canonical examples:
- `src/hooks/useDraftField.ts`
- `src/components/inputs/StyledTextFieldBase.tsx`
- `src/components/inputs/StyledYearField.tsx`

## Checklist for new fields

- Single commit channel (`onCommit`)
- `onBlur` is physical blur only (no hidden commit)
- Parser is the only source of truth; no draft mutation while typing
- UI constraints (maxLength/inputMode/etc.) match parser rules
- Prop combinations are validated deterministically (DEV fail-fast)
- Formatting is post-commit only and deterministic
