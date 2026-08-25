# Renteberegning

Denne fil beskriver beregningslogikken for procesrenter i erstatningsopgørelsen.

---

## Del 1 – For dig

### Hvad beregner dette modul?

Modulet beregner procesrenter efter renteloven for hvert rentekrav i listen. Renten løber fra rentedatoen (forfaldsdato + eventuel tillægstid) til og med beregningsdatoen. Beregningsdagen medregnes.

### Principper

1. Rente beregnes i henhold til renteloven.
2. Beregningsprincip: 365 rentedage pr. år – 366 i skudår.
3. Rentesatsen udgør nationalbankens udlånsrente + 8 % (ved rentedato før 01-03-2013 dog + 7 %)
4. Der beregnes ikke renters rente.

### De to datobegreber

Brugeren indtaster kravets **forfaldsdato**. **Rentedatoen** er forfaldsdato + eventuel tillægstid, og
den er den dato, renten løber fra. Uden tillægstid er de to datoer ens. Rentedatoen er det afgørende
begreb i beregningen – den bestemmer både rentens start og hvilken tillægssats kravet får;
forfaldsdatoen er alene udgangspunktet for at fastsætte rentedatoen (jf. `renteberegning-contract.md`
§2.9). Koden bruger fortsat identifikatoren `kravetDato` om forfaldsdatoen.

### Rentedatoen

Rentedatoen bestemmes ud fra forfaldsdatoen og en valgfri tillægstid:

```
hvis tillægstid ≤ 0:  rentedato = forfaldsdato
hvis tillægstid > 0:  rentedato = forfaldsdato + tillægstid (i valgt enhed)
```

Tillægstiden kan angives som et heltal fra **0 til 99** i **dage**, **uger** eller **måneder**.

### Satser

Renten er sammensat af to elementer:

| Sats | Beskrivelse | Skæring |
|---|---|---|
| **Referencesats** | Nationalbankens udlånsrente | Opdateres halvårligt (1. jan og 1. jul) |
| **Tillægssats** | Lovbestemt procenttillæg | 7 % for rentedatoer før 01-03-2013, 8 % derefter |

Den totale rentesats for en given halvårlig periode:
```
total_sats = referencesats_pr_periodens_start + tillægssats_pr_rentedato
```

Tillægssatsen låses til rentedatoen og gælder for hele beregningen uanset løbetiden – ligger rentedatoen
før 01-03-2013, anvendes 7 % også for perioder efter 01-03-2013. Referencesatsen skifter derimod ved
hvert halvårsskift (1. januar, 1. juli) inde i samme beregning. Forskellen er bindende i
`renteberegning-contract.md` §2.10 og skrevet på satsfanen ved hver af de to tabeller.

Tabel over referencesatser (seneste halvår først):

| Periode fra | Referencesats |
|---|---|
| 01-07-2026 | 2,00 % |
| 01-01-2026 | 1,75 % |
| 01-07-2025 | 1,75 % |
| 01-01-2025 | 2,75 % |
| 01-07-2024 | 3,50 % |
| 01-01-2024 | 3,75 % |
| 01-07-2023 | 3,25 % |
| ... | ... |

Tabellen dækker fra 01-01-2005 (`MIN_INTEREST_DATE`). Rentedatoer fra og med dette tidspunkt kan beregnes.

**Halvårsgrænserne er uforanderlige.** Referencesatsen ER den officielle udlånsrente, Nationalbanken
har fastsat pr. 1. januar og pr. 1. juli (rentelovens § 5, stk. 1, 2. pkt.), så perioderne 1/1–30/6 og
1/7–31/12 kan ikke ændre sig, og programmet er ikke indrettet til en anden kadence. `interestRates.ts`
fail-closer derfor ved modul-load, hvis en referencesats har en anden ikrafttrædelsesdato end `01-01`
eller `01-07`, eller hvis serien mangler et halvår – begge fejl ville ellers være tavse: motoren skærer
kun ved 30. juni og 31. december, og et manglende halvår ville videreføre forrige halvårs sats.

### Beregningsmetode

Beregningen opdeles i halvårlige perioder. For hvert halvår:

```
rente_halvår = beløb × total_sats/100 × dage_i_perioden / dage_i_året
```

Dage i perioden: inklusive start- og slutdato. Dage i året: 365 (366 i skudår). Summen over alle halvår giver den samlede rente.

Samlet rente afrundes til 2 decimaler (halvAwayFromZero).

### Validering

En renterække beregnes kun hvis:
- Forfaldsdato er udfyldt
- Beløb er > 0 og finit
- Rentedato kan beregnes
- Rentedato ≤ beregningsdato

Opfyldes betingelserne ikke, returneres `calculatedInterest: null` for den pågældende række uden fejlmelding til brugeren.

### Eksempel

**Input:** Beløb 100.000 kr., forfaldsdato 01-01-2025, ingen tillægstid, beregningsdato 01-07-2025.

- Rentedato = 01-01-2025 (ingen tillæg)
- Tillægssats: 8 % (rentedato ≥ 01-03-2013)
- Første halvår 2025 (01-01–30-06): referencesats 2,75 %, total 10,75 %
  - 181 dage / 365 dage = 0,4959 år
  - Rente = 100.000 × 10,75 % × 0,4959 ≈ 5.330,82 kr.
- Andet halvår (01-07–31-12): referencesats 1,75 %, total 9,75 %
  - 1 dag / 365 = 0,00274 år
  - Rente = 100.000 × 9,75 % × 0,00274 ≈ 26,71 kr.
- **Samlet: 5.357,53 kr.**

*(Præcise decimaler afhænger af den eksakte dags-optælling og satserne.)*

---

## Del 2 – AI-agent: teknisk reference

### Primære filer

| Fil | Ansvar |
|---|---|
| `src/domain/renteberegning/renteberegningEngine.ts` | Autoritativ engine; `computeRenteberegning`, `computeRentekravRow` |
| `src/domain/renteberegning/procesrenteCalculator.ts` | Renteberegningsmotor; `calculateProcessInterestWithRates` (samlet rentebeløb), `calculateProcessInterestBreakdownWithRates` (samme beregning, men returnerer hele periodeopdelingen bag beløbet), `findLatestReferenceRatePeriodEnd` (sidste dato referencesats-tabellen dækker – udgangen af det halvår den nyeste sats hører til) |
| `src/domain/renteberegning/rentekravValidation.ts` | Domænefunktioner: `calculateInterestDate`, `validateInterestCalculation` |
| `src/data/interestRates.ts` | Satser: `referenceRates`, `surchargeRates`, `MIN_INTEREST_DATE`; fail-closer ved modul-load på brudt halvårskæde (referencesats) og fejlsortering (tillægssats) |
| `src/domain/renteberegning/renteCalculationPrinciples.ts` | `RENTE_CALCULATION_PRINCIPLES` – de fire principper som array af strings |

### Engine

Der er én autoritativ engine i `renteberegningEngine.ts` med to indgangspunkter:

**`computeRenteberegning`** – aggregeret beregning for alle rækker i et snapshot. Satser injiceres eksplicit som input. Bruges af snapshot-systemet.

**`computeRentekravRow`** – per-række beregning til tabel-rendering. Bruger de globale produktionssatser. Returnerer `RentekravRowResult` inkl. `pdfContext` til PDF-download.

### Indgangspunkter

```typescript
// Aggregeret engine med sats-injektion
computeRenteberegning(input: RenteberegningInputSnapshot): RenteberegningOutput

// Per-række engine til tabel (bruger globale satser)
computeRentekravRow(
  committedRow: RentekravRow,
  beregningsdato: ISODateString | undefined
): RentekravRowResult

// Lavniveau-motor
calculateProcessInterestWithRates(
  amount: number,
  interestStartDate: ISODateString,
  calculationDate: ISODateString,
  referenceRatesInput: ReadonlyArray<RateEntry>,
  surchargeRatesInput: ReadonlyArray<RateEntry>
): number | null  // uafrundet
```

### Nøgletyper

```typescript
RenteberegningInputSnapshot = DeepReadonly<{
  renteberegning: RenteberegningValues;  // inkl. rentekravRows og beregningsdato
  referenceRates: ReadonlyArray<RateEntry>;
  surchargeRates: ReadonlyArray<RateEntry>;
}>

RentekravResult = Readonly<{
  id: string;
  actualInterestDate: ISODateString | null;
  calculatedInterest: number | null;
}>

RenteberegningOutput = Readonly<{
  rows: ReadonlyArray<RentekravResult>;
}>

RentekravRowResult = Readonly<{
  actualInterestDate: ISODateString | null;
  calculatedInterest: number | null;
  pdfContext: Readonly<{
    beloeb: number;
    actualInterestDate: ISODateString;
    beregningsdato: ISODateString;
  }> | null;
}>

RateEntry = {
  effectiveDate: ISODateString;
  ratePct: number;  // fx 2.75 = 2,75 %
}
```

### Rentedato-beregning

```typescript
calculateInterestDate(input: InterestDateInput): Result<ISODateString, DateCalculationError>

InterestDateInput = {
  kravetDato: ISODateString;
  tillaegstid: number;
  enhed: 'dage' | 'uger' | 'maaneder';
}
```

`tillaegstid ≤ 0` → returner `kravetDato` direkte (enhed ignoreres). Månedstillæg bruger den kanoniske `addMonths` fra `src/utils/dateUtils.ts`, som **clamper til sidste dag i mål-måneden**: 31. januar + 1 måned bliver 28/29. februar – ikke en rollover til marts. Det er ét sandt sted for "læg X måneder til en dato" i kodebasen; rå `setUTCMonth`-rollover bruges ikke. Dags- og ugetillæg lægges til med `setUTCDate` (uger = `tillaegstid × 7`).

### Validering af renteberegning

```typescript
validateInterestCalculation(
  kravetDato: ISODateString | undefined,
  beloeb: number | undefined,
  rentedato: ISODateString | undefined,
  beregningsdato: ISODateString | undefined
): Result<ValidatedInterestInput, ValidationError>
```

Fejltyper: `MISSING_KRAVET_DATO`, `INVALID_AMOUNT`, `MISSING_RENTEDATO`, `MISSING_BEREGNING_DATO`, `INVALID_DATE_ORDER`.

Beregning kørers kun ved succesfuld validering (rentedato ≤ beregningsdato).

### Motorslogik – halvårlig periodeopdeling

```
halvårsskift: 30. juni og 31. december
for hvert halvår [periodStart, periodEnd]:
  referencesats = findRatePctOnDate(referenceRatesSorted, periodStart)
  totalSats = referencesats + tillægssats
  periodRente = calculatePeriodInterest(beløb, totalSats, periodStart, periodEnd)
```

`calculatePeriodInterest` splitter yderligere ved kalenderårsskift (for korrekt skudårs-håndtering):
```
for hvert år i perioden:
  dage = inklusiv dagstælling i periodens overlap med dette år
  dageIÅret = 365 eller 366
  årsRente = beløb × sats/100 × dage / dageIÅret
```

### Satskildens grænser

```typescript
MIN_INTEREST_DATE: ISODateString  // '2005-01-01' – tidligste mulige rentedato
findLatestReferenceRatePeriodEnd(referenceRates): Date | null  // sidste dækkede halvår
```

`MIN_INTEREST_DATE` er udledt af tabellens tidligste referencesats. Den seneste dækkede dato bruges i
dokumentets eventuelle satsadvarsel via `findLatestReferenceRatePeriodEnd`; der findes ikke længere en
eksporteret `MAX_INTEREST_YEAR`.

### Afrunding

```typescript
const roundInterest = (value: number): number =>
  roundByMethod(value, 2, 'halfAwayFromZero');
```

Afrunding sker centralt i engine'en efter beregning.

### Afhængigheder

| Import | Kilde |
|---|---|
| `referenceRates`, `surchargeRates`, `RateEntry`, `MIN_INTEREST_DATE` | `src/data/interestRates.ts` |
| `calculateInterestDate`, `validateInterestCalculation` | `src/domain/renteberegning/rentekravValidation.ts` |
| `calculateProcessInterestWithRates` | `src/domain/renteberegning/procesrenteCalculator.ts` |
| `amountValueToNumber` | `src/utils/expressionAmount.ts` |
| `roundByMethod` | `src/utils/rounding.ts` |

### Tests

| Testfil | Dækker |
|---|---|
| `src/__tests__/domain/renteberegning/renteberegningEngine.test.ts` | Autoritativ engine, sats-injektion, afrunding |
| `src/__tests__/domain/renteberegning/procesrenteCalculator.test.ts` | Null-paths og edge cases for `calculateProcessInterestWithRates` |
| `src/__tests__/domain/renteberegning/rowEmpty.test.ts` | Tom-række-detektion |

---

## Bemærkning om fremtidige beregningsdatoer

Hvert år er opdelt i halvårene 01-01–30-06 og 01-07–31-12. Referencesatsen fastsættes på den første dag
i det pågældende halvår og gælder til halvårets udgang. Ligger beregningsdatoen efter udgangen af det senest
dækkede halvår, anvender motoren den senest kendte referencesats, og dokumentet viser datoen for den seneste
dækkede halvårsudgang. Det er en bevidst fail-soft driftsadfærd og den autoritative metode for fremtidige
beregningsdatoer. Datoen for satsens ikrafttræden er ikke i sig selv en advarselsgrænse. Beregningen blokeres
ikke alene fordi datoen ligger efter den seneste offentliggjorte referencesats, men dokumentets advarsel må
ikke fjernes eller skjules.
