# Datokontrakt (trust-kritisk)

**Status:** Gældende arkitektur (normativ)  
**Type:** Tværgående kontrakt  
**Prioritet:** Tværgående; supplerer `form-contract.md §4` (form ejer parsing/coercion frem til valideret instans, denne kontrakt ejer kalendermatematik derefter).  
**Senest verificeret mod kode:** 2026-06-01

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

## Kanonisk dag-iteration og materialisering
- Der findes ÉN dag-for-dag-løkke i domænet: `iterateDatesInclusive(start, end, onDate)` i
  `src/utils/isoDateHelpers.ts`. Skriv ALDRIG en ny `while (current <= end) { …; setUTCDate/addDays }`
  i forretningslogik — udtryk per-dag-arbejde via denne primitiv (eller en af dens afledte nedenfor).
  `onDate` modtager den samme muterede `Date`-instans hver gang; behold aldrig referencen.
  Returnér `false` fra callbacken for at stoppe iterationen tidligt.
- Løkker der springer direkte mellem år, halve år, kapitaliserings-/satsperioder eller andre
  allerede-aggregerede perioder er ikke dag-for-dag-iteration. De må blive domænelokale, når de ikke
  materialiserer eller vurderer hver kalenderdag.
- Afledte ISO-helpers (samme fil), alle udtrykt via primitiven:
  - `iterateIsoDatesInclusive(fra, til, onIso)` — iterér ISO-strenge uden at materialisere (O(1) hukommelse).
  - `collectIsoDatesInclusive(fra, til)` / `buildIsoDateSetInclusive(fra, til)` — materialisér et
    array/Set af ALLE dage. Brug KUN når du reelt skal bruge alle dage (én række pr. dag, eller
    `.has`-medlemskab gentagne gange).
- **Materialisér ikke for at tælle.** Skal du blot kende antallet af dage, brug `countInclusiveUtcDays`
  (O(1)) — byg aldrig et array/Set kun for at læse `.length`/`.size`.
- **Hejs loop-invariant arbejde ud af løkker.** Byg dag-/arbejdsdage-sæt og slå satser/regulering op
  pr. periode/segment, ikke pr. dag eller pr. iteration over de samme argumenter. En materialisering
  hvis input er konstant gennem en løkke SKAL bygges én gang før løkken.

## Datopipeline

1. Form-/persistence-laget gemmer dato-kun-værdier som `ISODateString`.
2. Parsing/coercion bruger branded/dato-helpers i `src/types/branded.ts` og `src/domain/dates/isoDate.ts`.
3. Beregningslaget kan modtage valideret `ISODateString` eller UTC-normaliserede dato-instanser.
4. Dag-tællinger bruger `src/utils/utcDayMath.ts`.

## Review-tjekliste
- Enhver ny dag-tælling bruger `utcDayMath`.
- Hvis iteration bruges, SKAL funktionens JSDoc angive inklusivitet (om både start- og slutdag itereres) og hvorfor iteration er nødvendig.
- Sortering med `getTime()` er kun tilladt til ordning, aldrig til dag-tællinger.
- Ingen ny håndskrevet `while (current <= end)`-dag-løkke: brug `iterateDatesInclusive` eller en afledt helper.
- Intet array/Set materialiseret kun for at læse `.length`/`.size` — brug `countInclusiveUtcDays`.
- Loop-invariant materialiseringer og sats-/regulerings-opslag bygges/foretages før løkken, ikke pr. iteration.
