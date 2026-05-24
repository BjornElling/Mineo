# Implementeringsstatus: Procentadapter-unificering

**Status:** Implementeret  
**Scope:** `StyledPercentField`, `TablePercentInput`, `percentAdapter.ts`, fælles percent-kerne, relevante persisted procentfelter  
**Prioritet:** Korrekthed og konvergens over legacy-kompatibilitet

## Formål

Procentparsing og -formatering havde tidligere parallelle implementeringer:

- `StyledPercentField.tsx` parsede/formaterede procent lokalt.
- `percentAdapter.ts` brugte en separat tabelparser og en committed display-string model.

Målet var:

1. Én kanonisk procentparser/formatter.
2. Tabeladapterens committed model = `number | undefined`.
3. Persisted procentceller gemmes som tal, ikke display-strings.
4. Styled- og tabelinput deler samme parserkerne.

## Implementeret

- `src/utils/percentDraftCore.ts` er kanonisk percent-parser/formatter.
- `src/utils/percentInputUtils.ts` er samme percent-kernefamilies fælles input-konstanter og placeholder-hjælpere.
- `StyledPercentField.tsx` bruger `percentDraftCore`.
- `percentAdapter.ts` bruger `percentDraftCore` og har `TModel = number | undefined`.
- `TablePercentInput.tsx` accepterer kun `number | undefined` som committed value og emitter `number | undefined` på commit.
- `AslAfgoerelseRow.eetPct` / `kapPct` er migreret til `percentageDecimal`.
- `LoenudviklingManuelRow.feriepenge`, `shSoSats`, `fritvalg` og `agPension` er migreret til `percentageDecimal`.
- De midlertidige `formatPercentDisplay(...)`-broer i tabel-call-sites er fjernet.
- Domæne-, debug-, validerings- og PDF-hjælpere er opdateret til talmodellen.
- `percentDraftCore.test.ts` dækker parser, formatter, edge cases og round-trip.

## Øvrige rettede fund

- Table input border/radius-logik for loose vs standard grid er samlet i `tableInputStyles`.
- `TableDateInput` dokumenterer den bevidste `<span>` tooltip-child.
- `TableAmountInput` bruger adapterens `toClipboardString`; beløbsudtryk kopieres som udtryk.
- `StyledAmountField` har ikke længere de ubrugte `onErrorChange`/`onLocalErrorChange` props.
- `mineo-field-pattern.md` dokumenterer `Backspace`/`Delete`-undtagelsen for lukket editor.
- `loenudviklingManuelBaseRowValidation` accepterer kun `number | undefined` for committed procentfelter og bruger `formatPercentDisplay` fra `percentDraftCore` til fejlbeskeder.
- `percentAdapter` sender `config.maxValue` direkte til `normalizePercentPaste` uden implicit fallback.
- `TablePercentInputModel` er den eneste type-alias for `number | undefined`; `TablePercentInput.tsx` importerer den fra adapteren.
- `percentDraftCore.test.ts` dækker nu `allowDecimals: false` + decimal-input, `allowNegative: false` + negativt input, tusindtals + decimal-kombination og numerisk validator-input.
- `tableCommitContract.test.tsx` bruger `typeof value === 'number' ? value : undefined` i percent-fixture frem for `Number(value)`.

## Bevidst ikke ændret

`TableDateIsoInput` er ikke fjernet i denne implementeringsrunde. Det er en date-model strukturændring, ikke en procentadapter-fejl, og den bør behandles sammen med en samlet beslutning om `dateAdapter`'s committed model.

`StyledPercentField`'s `maxIntegerDigits` er ikke flyttet ind i `percentDraftCore`. Det er en typing-begrænsning for åbne felter; commit-parserens domænegrænser styres fortsat eksplicit af `minValue` og `maxValue`.

## Verifikation

Kørt:

- `npm run typecheck`
- `npm test -- --run src/__tests__/utils/percentDraftCore.test.ts src/__tests__/components/inputs/TablePercentInput.test.tsx src/__tests__/components/tables/EetAslAfgoerelserTable.test.tsx src/__tests__/components/tables/LoenudviklingManuelTable.focus.test.tsx src/__tests__/schemas/eoFileSchema.test.ts src/__tests__/utils/fileSave.test.ts`
