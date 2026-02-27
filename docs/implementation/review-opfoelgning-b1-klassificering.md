# B1 klassificering af cross-layer helpers

Dato: 2026-02-27
Kilde: `docs/implementation/review-opfoelgning-implementeringsplan.md` (B1, T4, T8)

## 1) `src/domain/erstatningsopgoerelse/sharedPdfUtils.ts`

| Helper | Klassificering | Canonical mål |
|---|---|---|
| `parseOptionalIsoDate` | Generel utility (dato-parse) | `src/types/branded.ts` (ISO type/parse) |
| `parseDanishToIso` | Generel utility (dato-parse) | `src/types/branded.ts` |
| `formatDateShort` | Formattering/presentation | PDF/UI formattering (`src/utils/dateFormatting.ts`) |
| `formatDateLong` | Formattering/presentation | PDF/UI formattering (`src/utils/dateFormatting.ts`) |
| `formatPercentFixed2` | Formattering/presentation | Generel talformattering (`src/utils/formatUtils.ts`) |
| `roundToTwoDecimals` | Generel utility (numerik) | `src/utils/rounding.ts` |
| `roundToFourDecimals` | Generel utility (numerik) | `src/utils/rounding.ts` |
| `formatAmount2` | Formattering/presentation | Generel talformattering (`src/utils/formatUtils.ts`) |
| `formatAmountWithoutTrailingDecimals` | Formattering/presentation | Generel talformattering (`src/utils/formatUtils.ts`) |
| `numOrZero` | Generel utility | Canonical number-utils modul (afklares sammen med T8) |
| `resolvePctPointFromSatsOrInput` | Domænelogik/beregning | EO løn/regulerings-engine (C2) |
| `resolvePctDecimalFromSatsOrInput` | Domænelogik/beregning | EO løn/regulerings-engine (C2) |
| `hasPctSourceOrInput` | Domænelogik/beregning | EO løn/regulerings-engine (C2) |
| `hasAnyPctSourceOrInput` | Domænelogik/beregning | EO løn/regulerings-engine (C2) |
| `resolveOffentligLoenEkstraGrundloen` | Domænelogik/beregning | EO løn/regulerings-engine (C2) |
| `addOneDayIso` | Generel utility (datoaritmetik) | `src/types/branded.ts` / dato-utility canonical modul |
| `convertAnciennitetSats` | Domænelogik/beregning | EO løn/regulerings-engine (C2) |
| `formatAnciennitetConversion` | Formattering/presentation (PDF-specifik tekst) | PDF-præsentationslag (`src/utils/pdf/*`) |
| `resolveReguleringsdato` | Domænelogik/beregning | EO lønudviklings-pipeline/engine (`angivetLoenHelpers` + canonical output i C2) |
| `resolveStatistikModelId` | Domænelogik/beregning (mappingregel) | EO reguleringsdomæne / statistik-engine |
| `detectDecimalPlaces` | Generel utility (talpræcision) | Canonical number-format utility |

### PDF-specifikt vs. generelt (formattering)

PDF-specifik formattering:
- `formatAnciennitetConversion`

Generel formattering:
- `formatDateShort`, `formatDateLong`, `formatPercentFixed2`, `formatAmount2`, `formatAmountWithoutTrailingDecimals`

## 2) `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts`

| Helper | Klassificering | Canonical mål |
|---|---|---|
| `resolveLoenudviklingRowsV3` | Domænelogik/beregning | EO lønudviklings-engine |
| `segmentAmountOreV3` | Domænelogik/beregning | EO lønudviklings-engine / pengeberegning |
| `collectTafArbejdsdageForRange` | Domænelogik/beregning | TAF/arbejdsdage engine |
| `buildTafArbejdsdageSet` | Domænelogik/beregning | TAF/arbejdsdage engine |
| `countTafArbejdsdageInRange` | Domænelogik/beregning | TAF/arbejdsdage engine |
| `parseDanishToIso` | Generel utility | `src/types/branded.ts` |
| `parseManualPercentToPct` | Domænelogik/beregning | EO reguleringsengine |
| `resolveStatistikModelIdFromLabel` | Domænelogik/beregning | Statistik mapping i EO-domæne |
| `computePackageValue` | Domænelogik/beregning | EO reguleringsengine |
| `normalizeManualRowsV3` | Generel utility (normalisering) | EO engine intern normalisering |
| `resolveOffentligLoenSelectionV3` | Domænelogik/beregning | EO overenskomst/offentlig løn engine |
| `assertUniformV3` | Generel utility (invariant-check) | EO engine intern guard |
| `InkonsistenteLoenudviklingsindstillingerError` | Domænelogik/beregning | EO engine domænefejl |
| `buildSegmentsFromStartDatesV3` | Domænelogik/beregning | EO regulerings-segmentering |
| `assertSortedByStartIsoV3` | Generel utility | EO engine intern guard |
| `findLatestByDateInSortedListV3` | Generel utility | EO engine intern lookup |
| `resolveReguleringsStrategiV3` | Domænelogik/beregning | EO reguleringsstrategi-engine |
| `buildLoenudviklingFromStatistikV3` | Domænelogik/beregning | EO statistik-engine |
| `buildLoenudviklingFromKRLV3` | Domænelogik/beregning | EO KRL-engine |
| `buildLoenudviklingFromOverenskomstV3` | Domænelogik/beregning | EO overenskomst-engine |
| `buildLoenudviklingFromManualV3` | Domænelogik/beregning | EO manuel regulerings-engine |
| `buildLoenudviklingModelV3` | Domænelogik/beregning | EO canonical output pipeline (C2) |
| `buildAslReguleringsSegments` | Domænelogik/beregning | EO statistik/ASL segmenteringsengine |
| `resolveReguleringsdato` | Domænelogik/beregning | EO reguleringsengine |
| `resolveMaanedsloenBase` | Domænelogik/beregning | EO base-loen engine |
| `resolveDagsloenBase` | Domænelogik/beregning | EO base-loen engine |
| `getDayAfter` | Generel utility (dato) | Dato-utility canonical modul |

Observation:
- Filen indeholder i praksis beregningsengine-logik med enkelte interne utility-funktioner.
- Den indeholder ikke formatteringsansvar.

## 3) T8: `src/utils/numberUtils.ts`

`toNonNegativeInt` er en generel numerisk helper og bør klassificeres som canonical number utility sammen med øvrige numerik-helpers (`rounding`, parsing, formattering).

Anbefalet retning:
- Enten udvid `src/utils/numberUtils.ts` til canonical number-helper modul,
- eller fold funktionen ind i eksisterende canonical numerik-modul, så der kun er én tydelig entrypoint for basale taltransformationer.

## 4) B4 afklaring (kontekstfiler)

Status 2026-02-27:
- Kanonisk kilde er konsolideret i `src/contexts/FormPersistenceContext.tsx` (både context og type).
- `FormPersistenceContext.shared.ts` og `FormPersistenceContext.types.ts` er bevaret som kompatibilitets-reexports for minimal callsite-churn.
- Importgrafen er fortsat acyklisk.
