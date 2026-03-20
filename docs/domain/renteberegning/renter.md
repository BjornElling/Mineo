# Renteberegning

Denne fil beskriver beregningslogikken for procesrenter i erstatningsopgørelsen.

---

## Del 1 — For dig

### Hvad beregner dette modul?

Modulet beregner procesrenter efter renteloven for hvert rentekrav i listen. Renten løber fra rentedatoen (kravetsdato + eventuel tillægstid) til og med beregningsdatoen. Beregningsdagen medregnes.

### Principper

1. Rente beregnes i henhold til renteloven.
2. Beregningsprincip: 365 rentedage pr. år — 366 i skudår.
3. Rentesatsen udgør nationalbankens udlånsrente + 8 % (ved forfaldsdato før 01-03-2013 dog + 7 %)
4. Der beregnes ikke renters rente.

### Rentedatoen

Rentedatoen bestemmes ud fra kravetsdatoen og en valgfri tillægstid:

```
hvis tillægstid ≤ 0:  rentedato = kravetsdato
hvis tillægstid > 0:  rentedato = kravetsdato + tillægstid (i valgt enhed)
```

Tillægstiden kan angives i **dage**, **uger** eller **måneder**.

### Satser

Renten er sammensat af to elementer:

| Sats | Beskrivelse | Skæring |
|---|---|---|
| **Referencesats** | Nationalbankens udlånsrente | Opdateres halvårligt (1. jan og 1. jul) |
| **Tillægssats** | Lovbestemt procenttillæg | 7 % for 'renter fra' datoer før 01-03-2013, 8 % derefter |

Den totale rentesats for en given halvårlig periode:
```
total_sats = referencesats_pr_periodens_start + tillægssats_pr_rentedato
```

Tillægssatsen låses til rentedatoen og gælder for hele beregningen uanset løbetiden. Referencesatsen skifter ved hvert halvårsskift (1. januar, 1. juli).

Tabel over referencesatser (seneste halvår først):

| Periode fra | Referencesats |
|---|---|
| 01-01-2026 | 1,75 % |
| 01-07-2025 | 1,75 % |
| 01-01-2025 | 2,75 % |
| 01-07-2024 | 3,50 % |
| 01-01-2024 | 3,75 % |
| 01-07-2023 | 3,25 % |
| ... | ... |

Tabellen dækker fra 01-01-2005 (`MIN_INTEREST_DATE`). Rentedatoer fra og med dette tidspunkt kan beregnes.

### Beregningsmetode

Beregningen opdeles i halvårlige perioder. For hvert halvår:

```
rente_halvår = beløb × total_sats/100 × dage_i_perioden / dage_i_året
```

Dage i perioden: inklusive start- og slutdato. Dage i året: 365 (366 i skudår). Summen over alle halvår giver den samlede rente.

Samlet rente afrundes til 2 decimaler (halvAwayFromZero).

### Validering

En renterække beregnes kun hvis:
- Kravetsdato er udfyldt
- Beløb er > 0 og finit
- Rentedato kan beregnes
- Rentedato ≤ beregningsdato

Opfyldes betingelserne ikke, returneres `calculatedInterest: null` for den pågældende række uden fejlmelding til brugeren.

### Eksempel

**Input:** Beløb 100.000 kr., kravetsdato 01-01-2025, ingen tillægstid, beregningsdato 01-07-2025.

- Rentedato = 01-01-2025 (ingen tillæg)
- Tillægssats: 8 % (rentedato ≥ 01-03-2013)
- Første halvår 2025 (01-01–30-06): referencesats 2,75 %, total 10,75 %
  - 181 dage / 365 dage = 0,4959 år
  - Rente = 100.000 × 10,75 % × 0,4959 ≈ 5.330,82 kr.
- Andet halvår (01-07–01-07): referencesats 1,75 %, total 9,75 %
  - 1 dag / 365 = 0,00274 år
  - Rente = 100.000 × 9,75 % × 0,00274 ≈ 26,71 kr.
- **Samlet: 5.357,53 kr.**

*(Præcise decimaler afhænger af den eksakte dags-optælling og satserne.)*

---

## Del 2 — AI-agent: teknisk reference

### Primære filer

| Fil | Ansvar |
|---|---|
| `src/domain/renteberegning/renteberegningEngine.ts` | Autoritativ engine; `computeRenteberegning`, `computeRentekravRow` |
| `src/domain/renteberegning/procesrenteCalculator.ts` | Renteberegningsmotor; `calculateProcessInterestWithRates` |
| `src/domain/renteberegning/rentekravValidation.ts` | Domænefunktioner: `calculateInterestDate`, `validateInterestCalculation` |
| `src/data/interestRates.ts` | Satser: `referenceRates`, `surchargeRates`, `MIN_INTEREST_DATE`, `MAX_INTEREST_YEAR` |
| `src/domain/renteberegning/renteCalculationPrinciples.ts` | `RENTE_CALCULATION_PRINCIPLES` — de fire principper som array af strings |

### Engine

Der er én autoritativ engine i `renteberegningEngine.ts` med to indgangspunkter:

**`computeRenteberegning`** — aggregeret beregning for alle rækker i et snapshot. Satser injiceres eksplicit som input. Bruges af snapshot-systemet.

**`computeRentekravRow`** — per-række beregning til tabel-rendering. Bruger de globale produktionssatser. Returnerer `RentekravRowResult` inkl. `pdfContext` til PDF-download.

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
  interestStartDate: DanishDateString,
  calculationDate: DanishDateString,
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
  effectiveDate: DanishDateString;
  ratePct: number;  // fx 2.75 = 2,75 %
}
```

### Rentedato-beregning

```typescript
calculateInterestDate(input: InterestDateInput): Result<DanishDateString, DateCalculationError>

InterestDateInput = {
  kravetDato: DanishDateString;
  tillaegstid: number;
  enhed: 'dage' | 'uger' | 'maaneder';
}
```

`tillaegstid ≤ 0` → returner `kravetDato` direkte (enhed ignoreres). Månedstillæg bruger `Date.setUTCMonth()` — overflow håndteres af JS (31. januar + 1 måned = 28/29. februar).

### Validering af renteberegning

```typescript
validateInterestCalculation(
  kravetDato: DanishDateString | undefined,
  beloeb: number | undefined,
  rentedato: DanishDateString | undefined,
  beregningsdato: DanishDateString | undefined
): Result<ValidatedInterestInput, ValidationError>
```

Fejltyper: `MISSING_KRAVET_DATO`, `INVALID_AMOUNT`, `MISSING_RENTEDATO`, `MISSING_BEREGNING_DATO`, `INVALID_DATE_ORDER`.

Beregning kørers kun ved succesfuld validering (rentedato ≤ beregningsdato).

### Motorslogik — halvårlig periodeopdeling

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

### Satsnøgles grænser

```typescript
MIN_INTEREST_DATE: ISODateString  // '2005-01-01' — tidligste mulige rentedato
MAX_INTEREST_YEAR: number         // seneste år med referencesats
```

Begge er udledt dynamisk fra tabellens yderpunkter — ændres tabellen, ændres konstanterne automatisk.

### Afrunding

```typescript
const roundInterest = (value: number): number =>
  roundByMethod(value, 2, 'halfAwayFromZero');
```

Afrunding sker centralt i engine'en efter beregning.

### Afhængigheder

| Import | Kilde |
|---|---|
| `referenceRates`, `surchargeRates`, `RateEntry`, `MIN_INTEREST_DATE`, `MAX_INTEREST_YEAR` | `src/data/interestRates.ts` |
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

## Kendte udeståender

*Ingen kendte udeståender pr. dags dato. Filen er synkroniseret med koden.*
