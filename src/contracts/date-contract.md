# Datokontrakt (trust-kritisk)

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Prioritet:** Tværgående; supplerer `form-contract.md §4` (form ejer parsing/coercion frem til valideret instans, denne kontrakt ejer kalendermatematik derefter).  
**Senest verificeret mod kode:** 2026-05-31

## Scope
- Al logik der tæller kalenderdage eller udleder dag-baserede perioder.
- Al logik der beregner rentedage, svie/smerte-dage, TAF-dage eller periodedage.
- Persistence-/form-laget ejer `ISODateString`; denne kontrakt ejer kalendermatematikken, efter værdien er valideret eller normaliseret.
- Parsing og coercion af `ISODateString` fra brugerinput eller persistering hører til `form-contract.md` §4. Denne kontrakt gælder fra og med en valideret UTC-dato-instans.

## Regler
- Alle dato-kun `Date`-instanser SKAL behandles som UTC-kalenderdage.
  - Brug `getUTC*` / `setUTC*` til al adgang til dato-komponenter.
  - Stol aldrig på local time-getters til dato-kun-logik.
- Mindste tidsenhed er dage; timer/minutter/sekunder er uden for scope.
- Alle kalenderdag-tællinger SKAL bruge `src/utils/utcDayMath.ts`.
  - Inklusive tællinger: `countInclusiveUtcDays`
  - Eksklusive tællinger: `countExclusiveUtcDays`
  - Rå diff: `diffUtcDays` / `diffUtcDaysAbs`
- Lokale ms-diff dag-tællinger er forbudt i forretningslogik:
  - `(end.getTime() - start.getTime()) / 86400000` på lokale/dato-kun-instanser eller varianter
  - `Math.floor/ceil/round` på lokal ms-diff til dag-tællinger
- UTC-normaliseret ms-diff inde i `utcDayMath.ts` er tilladt:
  - normalisér med `Date.UTC(getUTCFullYear(), getUTCMonth(), getUTCDate())`
  - dividér derefter med dag-millisekunder kun i den kanoniske helper
- `countInclusiveUtcDays` og `countExclusiveUtcDays` returnerer `null`, når `start > end`.
  - Kaldere SKAL håndtere `null` eksplicit.
  - Non-null assertion er forbudt, medmindre en nærliggende kommentar forklarer den beviste invariant.
- Ugyldigt `Date` / NaN-input MÅ IKKE accepteres i stilhed. Kaldere SKAL validere før UTC-dag-matematik, eller helpers SKAL fejle fail-fast, hvis de ejer valideringsgrænsen.
- Kalender-iteration (dag-for-dag) er KUN tilladt, når domænet kræver per-dag-logik
  (fx helligdage, ugedage, månedsbrøker). Det SKAL dokumenteres eksplicit.

## Datopipeline

1. Form-/persistence-laget gemmer dato-kun-værdier som `ISODateString`.
2. Parsing/coercion bruger branded/dato-helpers i `src/types/branded.ts` og `src/domain/dates/isoDate.ts`.
3. Beregningslaget kan modtage valideret `ISODateString` eller UTC-normaliserede dato-instanser.
4. Dag-tællinger bruger `src/utils/utcDayMath.ts`.

## Review-tjekliste
- Enhver ny dag-tælling bruger `utcDayMath`.
- Hvis iteration bruges, SKAL funktionens JSDoc angive inklusivitet (om både start- og slutdag itereres) og hvorfor iteration er nødvendig.
- Sortering med `getTime()` er kun tilladt til ordning, aldrig til dag-tællinger.
