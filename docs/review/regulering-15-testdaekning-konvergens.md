# Regulering punkt 15 — Testdækning og konvergens

**Dato:** 2026-07-04
**Status:** ✅ Gennemgået
**Reguleringsform(er):** alle (afsluttende konvergens- og testpunkt)
**Primært scope:**
- `src/utils/dateUtils.ts` (kanonisk `getInclusivePeriodEndDanishDate` / `getInclusivePeriodEndByMonths`)
- `src/data/statistiskeRates.ts`, `src/data/overenskomstRates.ts` (`+12 mdr`-intervaller — U10)
- `src/domain/eoRowEvaluation/eoRowShared.ts` (3. `+12 mdr`-kopi, tilfældighedsfund)
- `src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts` (`computePackageValuePct` — U5; `effectiveReguleringsdatoIso` — U4)
- alle regulering-testfiler (verifikation af huldækning)

**Afhængigheder læst:** `regulering-review-plan.md` (punkt 15 + Udskudte fund-tabel), `regulering-1-faelles-fundament.md`, `AGENTS.md`, `reguleringFormulaUtils.ts`.

**Tests kørt:**
- `npx vitest run regulering` → 14 filer / 254 tests grønne (baseline)
- `npx vitest run loenudvikling regulering overenskomst statistik krl offentligLoen dateUtils` → 28 filer / 557 tests grønne (efter U4/U5/U10)
- `npx vitest run eoRow reguleringsCoverage reguleringKilde` → 25 filer / 285 tests grønne (row-lag efter eoRowShared-konsolidering)
- `npx vitest run dateUtils` → 42 tests grønne (inkl. 3 nye `+12 mdr`-pins)
- `npm run typecheck`, `npm run typecheck:test`, `npm run lint` → grønne
- Fuld suite: se Sammenfatning.

## Formål

Punkt 15 lukker reviewet: udfyld de resterende testhuller, gennemfør de sidste
konvergens-konsolideringer (de tre åbne udskudte fund henført hertil — U4, U5, U10),
fjern død kode/forældede kommentarer, og bekræft at hver reguleringsform deler det
fælles fundament. Ingen beregningsændring — alt bevist tal-identisk for valide input.

## Behandlede udskudte fund (henført til punkt 15)

Gennemgang af `Udskudte fund`-tabellen for alt henført til punkt 15 (kolonnen
"Behandles i punkt"). Åbne poster ved punkt-start: **U4, U5, U10**. (U6 var
13/15 men allerede lukket i punkt 13; U11, U12 var glemt-opsamlede og lukket
2026-07-04 forud for dette punkt.)

### U10 (+ tilfældighedsfund) — konsolider `+12 mdr − 1 dag`-varianterne

**Problem:** To bevidst forskellige `+12 mdr − 1 dag`-inline-kopier af interval-`tilDato`
(`statistiskeRates.ts` ILON/SBLON og privat `overenskomstRates.ts`) duplikerede den
kanoniske `getInclusivePeriodEndDanishDate`-aritmetik (der allerede var indført for de
tre `+6 mdr`-kilder i punkt 12). **Tilfældighedsfund:** en **tredje** kopi i
`eoRowShared.ts:181` (`getRangeForManualRegulering`, manuel reguleringsintervals øvre
grænse) i ISO-domænet — ikke fanget af U10.

**Handling (tal-neutral):**
- `statistiskeRates.ts` og `overenskomstRates.ts`: `formatDanishDate(addDays(addMonths(d, 12), -1))`
  → `getInclusivePeriodEndDanishDate(d, 12)` (bevist byte-identisk; helperen deler præcis samme
  `getInclusivePeriodEndByMonths`-aritmetik). Ubrugte imports (`addDays/addMonths/formatDanishDate`,
  hhv. `parseDanishDate` i statistik) fjernet.
- `eoRowShared.ts`: `addDays(addMonths(maxDate, 12), -1)` → `getInclusivePeriodEndByMonths(maxDate, 12)`
  (Date-domæne-varianten; ISO ind/ud bevaret).
- Kanonisk helpers JSDoc opdateret: nævner nu både `months = 6`- og `months = 12`-forbrugerne.

**Resultat:** ALLE fem `getReguleringsDatoIntervalFor…`-funktioner + row-lagets manuel-interval
deler nu den samme kanoniske `+N mdr − 1 dag`-aritmetik. Ingen inline-kopi tilbage.

### U5 — konsolider `computePackageValuePct` → `computeFormulaValue`

**Problem:** `computePackageValuePct` (offentlig overenskomst + manuel angivet) og
`computeFormulaValue` (`reguleringFormulaUtils.ts`, privat overenskomst + præsentation)
var to funktioner med samme lønpakke-matematik. U5's noterede nuance (finite-guards
divergerede: `computeFormulaValue` coercer ikke-finit → 0; `computePackageValuePct`
propagerede `NaN`/`Infinity` → callsite-throw) viste sig i praksis **uafgørende**:
alle fem callsites gater resultatet med `!Number.isFinite(x) || x <= 0` → throw, og
alle input er allerede finite ved kilden (grundløn via `ensurePositiveFiniteNumber`/`?? 0`,
pct via `?? 0`-parsere). For alle nåelige input er de to funktioner både tal-identiske
OG fail-closed-identiske.

**Handling:** `computePackageValuePct` er nu en **tynd adapter** der mapper domænenavnet
`grundloen` → `baseValue` og delegerer til `computeFormulaValue`. Domænenavnet `grundloen`
bevaret ved callsites (mere churn at brede `baseValue` ud i `baseComponents`/segment-rækker).
Alle tre overenskomst-/manuel-grene deler nu ét sted for lønpakke-formlen med **ensartet**
finite-semantik (tidligere brugte privat gren allerede `computeFormulaValue` direkte).

**Resultat:** Bevist tal-identisk (557 beregningstests uændret grønne). Ingen beregningsændring.

### U4 — `effectiveReguleringsdatoIso` beregnes ubetinget men bruges kun i privat gren

**Problem:** `effectiveReguleringsdatoIso` (= `max(reguleringsdato, dækningsstart)` via
`resolveOverenskomstEffectiveStartIso`) blev beregnet øverst i `buildLoenudviklingFromOverenskomst`,
men den offentlige gren returnerer uden at bruge den (offentlig clamper via
`resolveOffentligEffectiveBase`-fallback). To clamp-mekanismer for samme concern.

**Afgørelse:** De to mekanismer er **bevidst forskellige** — offentlig har base-fallback
til første dækkede interval (proxy-sats før dækning for Store Bededag), privat er ren
`max(regdato, dækningsstart)`; de opererer på hver sin datamodel (løntrin-tabeller vs.
sats-lister). At forene dem ville skade klarhed uden gevinst. **Konsolidering = relokering:**
beregningen er flyttet ned i privat-grenen (kun beregnet når den faktisk bruges), med en
callsite-kommentar der dokumenterer den bevidste asymmetri (så den ikke fjernes som apparent
drift). Ingen tal ændret.

## Testhuller (punkt 15's checkliste)

1. **`reguleringCoverage.ts` dedikeret unit-test** — **allerede lukket i punkt 1.**
   `reguleringCoverage.test.ts` findes og er udtømmende: begge funktioner
   (`resolveOverenskomstCoverageStartIso`, `resolveOverenskomstEffectiveStartIso`),
   `undefined`/ukendt/tom-håndtering, interval-parsing og alle `>`-clamp-grænsetilfælde
   (før/efter/lig tabel-start). Punkt-15-checklistens punkt 1 var blot aldrig streget ud.
2–6. Alle streget som **LUKKET** i planen (statistik/KRL hul-i-serie, KL missing-rate/efter-sidste-sats,
   TAF-opreguleret nær-nul/negativ, ende-til-ende overenskomst-sti, multi-af coverage-gate).
   Verificeret uændret grønne.

**Ny test (punkt 15):** `dateUtils.test.ts` udvidet med et `months = 12`-blok der pinner
den aritmetik statistik/overenskomst/row-lag nu deler: tal-identitet mod
`getInclusivePeriodEndByMonths(_, 12)`, kendte slutdatoer (01-01-2005 → 31-12-2005;
01-10-2025 → 30-09-2026) og skudårs-clamp (01-03-2023 + 12 mdr − 1 dag = 29-02-2024).
Ikke-brittelt (data-uafhængigt) og låser "+12 ≠ +6"-kontrakten ved kilden.

## Konvergens — status

- **Reguleringsdato-interval-familien:** fuldt konsolideret. `+6 mdr` (KRL, KL, offentlig)
  og `+12 mdr` (statistik ILON/SBLON, privat overenskomst) samt row-lagets manuel-interval
  deler nu ét sted (`getInclusivePeriodEndDanishDate` / `getInclusivePeriodEndByMonths`).
  ASL bruger bevidst år-grænser (egen sats), `…ForOverenskomst` delegerer til offentlig-varianten.
- **Lønpakke-formel:** ét sted (`computeFormulaValue`). `computePackageValuePct` er nu tynd adapter.
- **`reguleringssats`-opslag:** konsolideret i punkt 11 (`resolveReguleringssatsForAar`).
- **Ingen inline `+N mdr − 1 dag`-kopier tilbage** (repo-bred grep bekræftet).

## Fund og rettelser

1. **[Lav] Tredje `+12 mdr − 1 dag`-kopi (tilfældighedsfund)**
   - Lokation: `eoRowShared.ts:181`
   - Problem: inline `addDays(addMonths(maxDate, 12), -1)` duplikerede den kanoniske aritmetik i ISO-domænet.
   - Handling: → `getInclusivePeriodEndByMonths(maxDate, 12)`; ubrugte imports fjernet.
   - Resultat: tal-neutralt (285 row-lag-tests grønne); ingen inline-kopi tilbage.
2. **[Lav] U10 — to `+12 mdr`-inline-varianter konsolideret** (se ovenfor).
3. **[Lav] U5 — `computePackageValuePct` → adapter over `computeFormulaValue`** (se ovenfor).
4. **[Lav] U4 — `effectiveReguleringsdatoIso` relokeret + asymmetri dokumenteret** (se ovenfor).

## Testdækning (led 3)

- `dateUtils.test.ts`: 3 nye `+12 mdr`-tests (tal-identitet, kendte slutdatoer, skudårs-clamp).
- Alle eksisterende regulering-/beregnings-/row-lag-tests uændret grønne (bevis for tal-identitet).

## Tilfældighedsfund

- **Tredje `+12 mdr`-kopi i `eoRowShared.ts`** — rettet (se Fund 1).
- Punkt-15-checklistens punkt 1 (`reguleringCoverage`-test) var reelt lukket i punkt 1 men
  aldrig streget ud i planen — nu rettet i planen.

## Sammenfatning

Alle udskudte fund henført til punkt 15 (U4, U5, U10) er lukket tal-neutralt, plus et
tilfældighedsfund (3. `+12 mdr`-kopi). Reguleringsdato-interval-familien og lønpakke-formlen
er nu fuldt konsolideret; ingen parallelle inline-kopier tilbage. Alle testhuller fra
kortlægningen er dækket. Ingen beregningsændring — bevist ved uændrede numeriske tests.
