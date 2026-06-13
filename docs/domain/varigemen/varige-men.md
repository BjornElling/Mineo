# Varige mén

Denne fil beskriver beregningslogikken for godtgørelse for varige mén.

---

## Del 1 — For dig

### Hvad beregner dette modul?

Godtgørelse for varige mén (ASL § 18) er en éngangsydelse til skadelidte for den varige helbredsmæssige skade. Beløbet afhænger af tre faktorer: méngradsprocenten, et lovbestemt grundbeløb der reguleres hvert år, og skadelidtes alder ved skadestidspunktet.

### Trin-for-trin beregning

#### Trin 1 — Grundbeløb (sats pr. méngrad)

Grundbeløbet opslagtes på `beregningsåret` (året i den angivne beregningsdato):

```
sats_pr_méngrad = varigeMenPrGrad[beregningsår]
grundbeløb_ved_100_pct = sats_pr_méngrad × 100
```

Eksempel 2026: sats pr. méngrad = 11.035 kr., grundbeløb ved 100 % = 1.103.500 kr.

#### Trin 2 — Beløb uden aldersfradrag

```
beløb_uden_reduktion = sats_pr_méngrad × méngrad
```

Méngradsprocenten bruges direkte som heltal — der foretages ingen afrunding af méngradsprocenten.

#### Trin 3 — Aldersfradrag

Alderen opgøres i **hele opnåede år** på skadestidspunktet (år, måned og dag sammenholdes — endnu ikke fyldt fødselsdag i skadeåret tæller ikke):

| Alder ved skade | Basis (1 % pr. år over 39) | Ekstra (1 % pr. år over 59) | Total |
|---|---|---|---|
| ≤ 39 | 0 % | 0 % | **0 %** |
| 40 | 1 % | 0 % | **1 %** |
| 59 | 20 % | 0 % | **20 %** |
| 60 | 21 % | 1 % | **22 %** |
| 69 | 30 % | 10 % | **40 %** |
| > 69 | 30 % (cap) | 10 % (cap) | **40 %** |

Maksimumsreduktion er 40 % og opnås ved alder 69 år — yderligere alder øger ikke fradraget.

#### Trin 4 — Godtgørelse

```
godtgørelse = beløb_uden_reduktion × (1 − aldersfradrag_pct / 100)
```

**Afrunding:** godtgørelsen afrundes **altid op** til nærmeste hele krone (`Math.ceil`).

#### Sammenfatning

```
sats = varigeMenPrGrad[beregningsår]
godtgørelse = ceil(sats × méngrad × (1 − aldersfradrag_pct / 100))
```

### Hvornår returneres null?

Beregningen returnerer `null` (ingen resultat) hvis:
- Méngradsprocenten mangler, er 0 eller negativ, eller er over 100
- Beregningsdato mangler
- Fødselsdato mangler
- Skadestidspunkt mangler
- Beregningsåret ikke findes i satsnøglen `varigeMenPrGrad`

Der er ingen fejlmeddelelser — manglende input giver stiltiende `null`.

### Eksempel

**Input:** Méngrad 35 %, beregningsdato 01-06-2026, fødselsdato 15-03-1955, skadestidspunkt 20-08-2020.

- Sats pr. méngrad 2026: 11.035 kr.
- Beløb uden reduktion: 11.035 × 35 = 386.225 kr.
- Alder ved skade (15-03-1955 → 20-08-2020): 65 hele år
- Aldersfradrag: basis (65 − 39) = 26 %, ekstra (65 − 59) = 6 % → i alt 32 %
- Godtgørelse: ceil(386.225 × (1 − 0,32)) = ceil(262.633) = **262.633 kr.**

---

## Del 2 — AI-agent: teknisk reference

### Primære filer

| Fil | Ansvar |
|---|---|
| `src/domain/varigemen/varigeMenCalculations.ts` | Beregningslogik; `beregnVarigeMenGodtgoerelseWithRates` |
| `src/domain/varigemen/varigeMenEngine.ts` | Engine-wrapper; `computeVarigeMenEngine` |

### Indgangspunkter

```typescript
// Kanonisk indgang (snapshot-baseret engine). UI (MenberegningTab) og PDF deler
// dette ene entry, jf. varigemen-contract §1/§2.
computeVarigeMenEngine(input: VarigeMenEngineInputSnapshot): VarigeMenEngineOutput

// Underliggende beregningsfunktion (kaldes kun af engine-laget)
beregnVarigeMenGodtgoerelseWithRates(
  values: VarigeMenValues,
  skadestidspunktRaw: ISODateString | undefined,
  rates: YearlyRate,
  fodselsdatoFromStamdata: ISODateString | undefined
): VarigeMenBeregningResult | null
```

### Nøgletyper

```typescript
VarigeMenEngineInputSnapshot = DeepReadonly<{
  varigemen: VarigeMenValues;
  fodselsdato: ISODateString | undefined;
  skadestidspunkt: ISODateString | undefined;
  rates: YearlyRate;
}>

VarigeMenEngineOutput = Readonly<{
  result: VarigeMenBeregningResult | null;
}>

VarigeMenBeregningResult = {
  beregnetGodtgoerelse: number;   // ceil-afrundet slutbeløb
  grundbeloeb: number;            // sats × 100 (ved 100% méngrad)
  satsPerMengrad: number;         // varigeMenPrGrad[beregningsår]
  aldersreduktionPct: number;     // 0–40
  grundbeloebUdenReduktion: number; // sats × méngrad (før aldersfradrag)
  aldersreduktionBeloeb: number;  // grundbeloebUdenReduktion − beregnetGodtgoerelse (afstemt mod oprunding); 0 uden reduktion
  beregningsaar: number;          // året fra beregningsdato (satsen er slået op for dette år)
  alderVedSkade: number;          // hele opnåede år
}
```

### Intern hjælpefunktion

```typescript
beregnAldersfradragPct(alderVedSkade: number): number
// Returnerer 0 for alder ≤ 39
// basis = min(30, max(0, alder − 39))
// ekstra = alder > 59 ? min(10, max(0, alder − 59)) : 0
// returnerer basis + ekstra (maks 40)
```

### Aldersbeskæring

Begge komponenter capper ved alder 69: `min(30, ...)` og `min(10, ...)`. Alder over 69 giver samme fradrag som alder 69 (40 %).

### Afrunding

```typescript
const roundMenAmount = (value: number): number => roundByMethod(value, 0, 'ceil');
```

Afrunding sker via den kanoniske `roundByMethod` fra `src/utils/rounding.ts` med 0 decimaler og metoden `'ceil'` — altså altid op til nærmeste hele krone. Modulet indfører ingen ad hoc-afrunding.

### Satsnøgle

```typescript
// src/data/lovbestemteRates.ts
export const varigeMenPrGrad: YearlyRate = {
  2026: 11035,
  2025: 10530,
  2024: 10135,
  // ... (satser tilbage til 2005)
};
```

Satserne injiceres i engine-inputtet (`rates: YearlyRate`) og passes videre til beregningsfunktionen. Engine-laget importerer ikke `varigeMenPrGrad` direkte — den modtager satserne udefra.

### Domænebeslutning ved null

`null`-resultater er en bevidst domænebeslutning, ikke en fejlsituation. Enginen eksponerer ikke issues/fejlmeddelelser — UI-laget er ansvarligt for at vise passende feedback ved manglende input.

### Afhængigheder

| Import | Kilde |
|---|---|
| `VarigeMenValues` | `src/schemas/formSchemas` |
| `YearlyRate` | `src/data/lovbestemteRates` |
| `coerceToISODateString`, `parseISODate`, `ISODateString` | `src/types/branded` |
| `calculateUtcAgeInWholeYears` | `src/utils/dateUtils` |
| `roundByMethod` | `src/utils/rounding` |

### Tests

| Testfil | Dækker |
|---|---|
| `src/__tests__/domain/varigemen/varigeMenCalculations.test.ts` | Beregningslogik, aldersfradrag, grænsetilfælde |
| `src/__tests__/domain/varigemen/varigeMenEngine.test.ts` | Engine-wrapper, null-håndtering |

---

## Kendte udeståender

*Ingen kendte udeståender pr. dags dato. Filen er synkroniseret med koden.*
