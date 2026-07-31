# EET efter EAL (fane 4)

Denne fil beskriver beregningslogikken for erhvervsevnetab efter Erstatningsansvarsloven (EAL). Beregningen udgør fane 4 på EET-siden og danner udgangspunktet for differencekravet.

Se også:
- [loebende-eet.md](./loebende-eet.md) — fane 2
- [kapitaliseret-eet.md](./kapitaliseret-eet.md) — fane 3
- [differencekrav.md](./differencekrav.md) — fane 5
- [fejlkatalog.md](./fejlkatalog.md) — alle fejl og advarsler

---

## Del 1 — For dig

### Hvad beregner denne fane?

Fane 4 beregner det fulde kapitaliserede EET-krav efter EAL. EAL-beregningen er principielt anderledes end ASL-beregningen: der er ingen løbende ydelse — resultatet er altid et kapitaliseret engangsbeløb. Kapitaliseringsfaktoren er fastsat til **10** ved lov og varierer aldrig.

EAL-beregningen er fuldstændig adskilt fra ASL-beregningen. Ingen satser, tabeller eller mellemresultater fra ASL indgår.

### Inputprioritet

| Felt | Logik |
|---|---|
| **Årsløn** | EAL-årsløn bruges hvis udfyldt og > 0. Ellers ASL-årsløn. |
| **EET-procent** | EAL EET-% bruges hvis udfyldt og > 0. Ellers fallback til seneste ASL-afgørelse (se nedenfor). |

**Fallback-regel for EET-% fra ASL:**
1. Find afgørelsen med den seneste afgørelsesdato
2. Ved uafgjort: vælg afgørelsen med den seneste virkningsdato
3. Ved fortsat uafgjort: prioritér `Endelig` > `Delvist endelig` > øvrige
4. Hvis der i det endelige sæt er to eller flere `Endelig`-rækker med identisk afgørelsesdato og virkningsdato: fejl (`asl-identiske-afgoerelser`)

### Trin-for-trin beregning

#### Trin 1 — Regulering af årsløn

Årslønen reguleres fra skadesår til beregningsår med kæde-opregning:

```
reguleringsår = [skadesår+1, skadesår+2, ..., beregningsår]
reguleringsfaktor = ∏ (1 + reguleringssats[år] / 100) for hvert år
```

`reguleringssats` er den generelle EAL-sats fra `lovbestemteRates.ts` (ikke ASL-EET-satsen).

Reguleringsprocenten afrundes til 4 decimaler til visning og beregning:
```
reguleringsPctRounded4 = round4((reguleringsfaktor − 1) × 100)
reguleringsfaktorRounded4 = 1 + reguleringsPctRounded4 / 100
```

Reguleret årsløn:
```
reguleret_årsløn = round500(årsløn × reguleringsfaktorRounded4)
```

`round500` = afrunding til nærmeste 500 kr. Hvis skadesår = beregningsår sker ingen regulering — reguleringslinjen vises ikke i output.

#### Trin 2 — Beregning af EET-beløb

```
eet_beregnet = round0(reguleret_årsløn × 10 × (eet_pct / 100))
```

Faktoren **10** er lovbestemt og er uforanderlig. `eet_beregnet` sammenlignes herefter med loftet:

```
eet_maks = erhvervsevnetabMax[beregningsår]
```

- Hvis `eet_beregnet ≤ eet_maks`: bruges `eet_beregnet`
- Hvis `eet_beregnet > eet_maks`: bruges `eet_maks` (reduceret til lovbestemt maksimum)

`eet_anvendt` er den valgte værdi.

#### Trin 3 — Aldersreduktion

Alderen opgøres i **hele opnåede år** på skadedatoen (måneder og dage ignoreres):

```
alder = floor((skadedato − fødselsdato) i hele år)
```

Aldersreduktionsprocenten:
```
hvis alder ≤ 29: reduktion_pct = 0
ellers:
  cappet_alder = min(alder, 69)
  reduktion_pct = (cappet_alder − 29) + (alder > 54 ? 2 × (cappet_alder − 54) : 0)
```

Det naturlige loft på 70 % fremkommer automatisk via `min(alder, 69)`. Eksempler:

| Alder ved skade | Formel | Reduktion |
|---|---|---|
| ≤ 29 | 0 | 0 % |
| 30 | (30−29) | 1 % |
| 54 | (54−29) | 25 % |
| 55 | (55−29) + 2×(55−54) | 28 % |
| 69 | (69−29) + 2×(69−54) | 70 % |
| 86 | (69−29) + 2×(69−54) | 70 % |

```
aldersreduktion_beløb = round0(eet_anvendt × (reduktion_pct / 100))
```

#### Trin 4 — EAL-krav

```
eal_krav = max(0, round0(eet_anvendt − aldersreduktion_beløb))
```

Resultatet kan ikke være negativt.

### Regulering i EAL vs. ASL

EAL og ASL bruger **fundamentalt forskellige reguleringsmetoder**:

| | EAL | ASL |
|---|---|---|
| Metode | Kæde-opregning fra skadesår til beregningsår | Direkte tabelopslag for kapitaliseringsåret |
| Sats | `reguleringssats` (generel EAL-sats) | `reguleringsprocentErhvervsevnetab*` (EET-specifik ASL-sats) |
| Afrunding | `round4` på procenten, `round500` på beløbet | `round2` på årsydelsen |
| Skæringsår 2024 | 2024 indgår som reguleringsår med sin sats | 2024 er referenceår (faktor = 1) |

De to må **aldrig** dele beregningssti eller helper.

### Aldersreduktionen i praksis

Aldersreduktionsprocenten beregnes ét sted: `calculateAldersreduktionPct` i `eetEalCalculation.ts`,
med alderen fra `calculateAgeInWholeYears` opgjort på **skadedatoen** (ikke beregningsdatoen).
Formlen og dens eksempeltabel står under trin 3 ovenfor; det er den autoritative beskrivelse.

Denne fil rummer bevidst intet gennemregnet talekempel for hele fane 4-forløbet: resultatet afhænger
af de konkrete reguleringssatser for skadesår→beregningsår og af det gældende `erhvervsevnetabMax`,
og et hårdkodet eksempel ville rådne med satstabellerne. Se i stedet
`src/__tests__/domain/erhvervsevnetab/eetEalCalculation.test.ts` for gennemregnede tilfælde,
der holdes i sync med koden.

---

## Del 2 — AI-agent: teknisk reference

### Primær fil

`src/domain/erhvervsevnetab/eetEalCalculation.ts`

### Indgangspunkt

```typescript
computeEetEalCalculation(input: Input): EetEalCalculationResult
```

`Input` indeholder `erhvervsevnetab`, `skadedato`, `fodselsdato`, samt tre rate-tabeller: `reguleringssats`, `erhvervsevnetabMax`, `aarsloenMax` — alle af typen `YearlyRate` fra `lovbestemteRates.ts`. Fane 4 injicerer disse direkte fra `lovbestemteRates`; fane 5 gør det samme.

### Nøgletyper

`EetEalComputation` er **Zod-udledt** (`z.infer`) af `eetEalComputationSchema` og bor i
`src/domain/erhvervsevnetab/eetCanonicalOutput.ts` — ikke i `eetEalCalculation.ts`, som blot
re-eksporterer typen. Skemaet er `.strict().readonly()`, og alle beløbsfelter bærer
`moneyOreSchema` og dermed `Ore`-suffikset:

```typescript
EetEalCalculationResult = { issues, computation: EetEalComputation | null }

EetEalComputation = {
  beregningsdato, skadedato, fodselsdato,   // isoDateString
  skadesaar, beregningsaar,                 // integer
  aarsloenOre: MoneyOre,
  aarsloenSource: 'eal' | 'asl',
  reguleringsaar: readonly number[],
  reguleringsPctRounded4: number,
  reguleretAarsloenOre: MoneyOre,
  eetPct: number, eetPctSource: 'eal' | 'asl',
  kapitaliseringsfaktor: 10,      // z.literal(10) — altid 10, aldrig andet
  eetBeregnetOre: MoneyOre,
  eetMaksOre: MoneyOre,
  eetAnvendtOre: MoneyOre,
  eetReduceretTilMaks: boolean,
  alderVedSkade: number,          // hele opnåede år på skadedatoen
  alderVedSkadeCapped: number,    // min(alderVedSkade, 69) — capværdien bag reduktionsformlen
  aldersreduktionPct: number,
  aldersreduktionBeloebOre: MoneyOre,
  ealKravOre: MoneyOre
}

EetEalResolvedEetPct = {
  value: number, source: 'eal' | 'asl', rowId?: string
}
```

### Interne hjælpefunktioner

| Funktion | Beskrivelse |
|---|---|
| `resolveEetPct(values)` | Prioriteret opslag: EAL-felt → ASL-fallback. Returnerer `{ resolved, issues }` |
| `resolveEetPctFromAslRows(rows)` | ASL-fallback-logik: seneste afgørelsesdato → seneste virkningsdato → Endelig > Delvist endelig |
| `resolveAarsloen(values)` | EAL-årsløn → ASL-årsløn fallback. Returnerer `{ value, source }` |
| `computeEalReguleringsfaktorFromYearlyChain(skadesaar, beregningsaar, sats)` | Kæde-opregning. Returnerer `{ reguleringsaar, manglendeAar, faktor }` |
| `calculateAgeInWholeYears(fodselsdato, skadedato)` | Hele opnåede år (dage ignoreres efter månedsjustering) |
| `calculateAldersreduktionPct(alder)` | Reduktionsformel med cap ved alder 69 |

### Afrunding

`round0` og `round4` importeres fra `src/utils/roundingShortcuts.ts`. `round500` er **kun** defineret
lokalt i `eetEalCalculation.ts`:
```typescript
const round500 = (value: number): number =>
  roundByMethod(value / 500, 0, 'halfAwayFromZero') * 500;
```

Afrundingerne er uændrede af øre-brandingen: `round500`, `round0` og `round4` anvendes fortsat på
**kronebeløb**, og først derefter brandes resultatet til `MoneyOre` med `fromKroner`. Hvor et allerede
brandet beløb skal indgå i en kroneafrunding, konverteres det tilbage med `toKroner` først — de
lovbestemte grænser og afrundinger ligger dermed uændret i kroner.

### Afhængigheder

| Import | Kilde |
|---|---|
| `reguleringssats`, `erhvervsevnetabMax`, `aarsloenMax` | `src/data/lovbestemteRates.ts` (injiceret som input, ikke importeret direkte i ts-filen) |
| `parseCommittedPercent`, `validatePercentDivisibleBy5`, `validatePercentDivisibleBy5FromValue`, `ASL_IDENTICAL_AFGOERELSER_ID`, `hasIdenticalAfgoerelser` | `eetAslAfgoerelser.ts` |
| `round0`, `round4` | `src/utils/roundingShortcuts.ts` |
| `roundByMethod` | `src/utils/rounding.ts` (direkte, til `round500`) |

### Fejl og advarsler (fane 4)

Se [fejlkatalog.md](./fejlkatalog.md) for komplet katalog. Fane 4 producerer:

**Blokerende fejl:** `aarsloen-missing`, `aarsloen-zero`, `eal-aarsloen-zero`, `eet-pct-missing`, `eal-eet-pct-invalid`, `asl-selected-eet-pct-invalid`, `asl-identiske-afgoerelser`, `fodselsdato-missing`, `beregningsdato-missing`, `skadedato-missing`, `reguleringssats-missing`, `eet-max-missing`, `alder-unresolved`.

**Advarsler:** `warn-eal-eet-under-15`, `warn-asl-eet-under-15`, `warn-eal-aarsloen-empty-for-2024-07-01`, `warn-eal-aarsloen-is-max`, `warn-asl-aarsloen-is-max`.

### Tests

`src/__tests__/domain/erhvervsevnetab/eetEalCalculation.test.ts`

Dækker: kæde-regulering, aldersreduktionsformel, EET-% prioritering (EAL vs. ASL fallback), lofts-capping.

---

## Kendte udeståender

*Ingen kendte udeståender pr. dags dato. Filen er synkroniseret med koden.*
