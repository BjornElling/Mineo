# Løbende EET — ASL (fane 2)

Denne fil beskriver beregningslogikken for løbende erhvervsevnetabsydelser efter Arbejdsskadesikringsloven (ASL). Beregningen udgør fane 2 på EET-siden.

Se også:
- [kapitaliseret-eet.md](./kapitaliseret-eet.md) — fane 3
- [eal-beregning.md](./eal-beregning.md) — fane 4
- [differencekrav.md](./differencekrav.md) — fane 5
- [fejlkatalog.md](./fejlkatalog.md) — alle fejl og advarsler

---

## Del 1 — For dig

### Hvad beregner denne fane?

Fane 2 opgør, hvad skadelidte har haft ret til i løbende månedlig ydelse fra erhvervsevnetabet, fra den første afgørelses virkningsdato frem til og med beregningsdatoen. Beregningen sker per afgørelse og opdeles i kalenderårs-rækker, fordi den løbende ydelse reguleres hvert år pr. 1. januar.

Resultatet bruges direkte i differencekravet (fane 5) — med den ene forskel at fane 5 beregner frem til og med *dagen før* beregningsdatoen i stedet for beregningsdatoen selv.

### Centrale skæringsdatoer

Fire datoer styrer beregningsreglerne:

| Dato | Betydning |
|---|---|
| **01-07-2007** | Måneds-afhængige kapitaliseringsfaktorer indføres (gælder primært fane 3) |
| **01-01-2011** | Erstatningsniveau hæves fra 80 % til 83 %. AM-bidragsfradrag (8 %) indføres |
| **16-06-2011** | Grænse for fradragsregler i differencekravet (gælder primært fane 5) |
| **01-07-2024** | Nyt lønniveau: ASL-maksimum hæves fra 367.000 kr. til 608.000 kr. |

### Trin-for-trin beregning

#### Trin 1 — Grundløn (beregnes én gang per skade)

Grundlønnen omregner den faktiske årsløn til et fast niveau, så årsydelsen kan reguleres herfra. Niveauet afhænger af skadsdatoen:

**Skade før 01-07-2024 (2003-niveau):**
```
grundløn = round0(min(årsløn_afrundet_1000, aarsloenMax[skadesår]) × (367.000 / aarsloenMax[skadesår]))
```

**Skade fra 01-07-2024 (2024-niveau):**
```
grundløn = round0(min(årsløn_afrundet_1000, aarsloenMax[skadesår]) × (608.000 / aarsloenMax[skadesår]))
```

Årslønnens maks-loft (`aarsloenMax[skadesår]`) er det gældende maksimum for det kalenderår skaden sker i. Ønsker brugeren at bruge årsløn over loftet, afskæres beløbet stille til loftet.

#### Trin 2 — Grundydelse per afgørelse

Grundydelsen beregnes for hvert afgørelses-EET-procentpoint og holder sig uforandret inden for afgørelsen.

**Skade fra 01-01-2011:**
```
grundydelse = round2(grundløn × eet_pct × 0,83 × 0,92)
```

**Skade før 01-01-2011:**
```
grundydelse = round2(grundløn × eet_pct × 0,80)
```

Faktoren `0,92` er `(1 − 0,08)`, dvs. AM-bidragsaftrækket på 8 %. Skader fra før 2011 er fritaget.

**2024-grundydelse (kun for skader før 01-07-2024):**

For skader på 2003-niveau oprettes en separat "2024-grundydelse" til brug fra januar 2024:
```
grundydelse_2024 = round2(grundydelse × (1 + reguleringsprocentErhvervsevnetabFoer2024[2024] / 100))
```
Denne regulering svarer til den kumulerede opjustering til 2024-niveau (65,7 %). Fra og med 2024 benyttes `grundydelse_2024` som beregningsbase i stedet for den originale `grundydelse`.

**Ved delvis kapitalisering** beregnes to grundydelser per afgørelse:
```
eet_pct_før_aktuel_kap = afgørelsens_eet_pct − sum(kapitaliseringsprocenter fra tidligere afgørelser)
grundydelse_fuld    = round2(grundløn × eet_pct_før_aktuel_kap × erstatningsniveau × amFaktor)
rest_eet_pct        = eet_pct_før_aktuel_kap − aktuel_kapitaliseringsprocent
grundydelse_rest    = round2(grundydelse_fuld × (rest_eet_pct / eet_pct_før_aktuel_kap))
```

En ny afgørelses EET-procent erstatter altid den forrige i sin helhed — procenter lægges ikke oven på hinanden. Kapitaliseringsprocenter fra *tidligere* afgørelser fratrækkes dog kumulativt, fordi de procentpoint allerede er udbetalt som engangsbeløb.

#### Trin 3 — Årsydelse for et givet beregningsår

Årsydelsen bestemmer den månedlige ydelse for et konkret kalenderår. Reguleringslogikken afhænger af grundlønsniveauet:

**Skade før 01-07-2024 (grundydelse i 2003-niveau):**

| Beregningsår | Formel |
|---|---|
| ≤ 2023 | `grundydelse × (1 + reguleringsprocentErhvervsevnetab[år] / 100)` |
| 2024 | `grundydelse_2024 × 1,000` (2024 er referenceår, faktor = 1) |
| ≥ 2025 | `grundydelse_2024 × (1 + reguleringsprocentErhvervsevnetabFra2024[år] / 100)` |

**Skade fra 01-07-2024 (grundydelse i 2024-niveau):**

| Beregningsår | Formel |
|---|---|
| 2024 | `grundydelse × 1,000` |
| ≥ 2025 | `grundydelse × (1 + reguleringsprocentErhvervsevnetabFra2024[år] / 100)` |

Reguleringsopslaget er et direkte tabelopslag per kalenderår — ikke en kædeberegning som i EAL-sporet.

Årsydelsen rundes **op** til nærmeste hele kronebeløb deleligt med 12:
```
årsydelse = ceil12(beregnet_årsydelse)
månedlig_ydelse = årsydelse / 12
```
`ceil12(x) = Math.ceil(x / 12) × 12`. Der rundes aldrig ned.

#### Trin 4 — Periodeafgrænsning

**Hvad er beregningsåret (satsen)?**

Satsen for den første periode i en afgørelses fuld-sektion bestemmes af:

| Situation | Beregningsår (sats) |
|---|---|
| virkningsdato ≤ afgørelsesdato | Afgørelsesdatoens kalenderår |
| virkningsdato > afgørelsesdato | Virkningsdatoens kalenderår |

**Særregel — tilbagevirkende kraft:** Hvis virkningsdatoen ligger i et *tidligere* kalenderår end afgørelsesdatoen, gælder afgørelsesårets sats for hele perioden fra virkningsdatoen frem til 31-12 i afgørelsesåret — dette samles i én række. Fra 01-01 det følgende år reguleres normalt.

**Ophørsdato** er den tidligste af:
1. Beregningsdatoen
2. Dagen før næste afgørelses virkningsdato
3. Dagen før kapitaliseringsdatoen (kun ved fuld kapitalisering — rest-EET = 0)
4. Dagen før den tvungne kapitaliseringsdato (2 år inden folkepensionsalderen)

**Tvungen kapitalisering:** Endelige og delvist endelige afgørelser ophører automatisk 2 år inden folkepensionsalderen, uanset om brugeren har angivet en eksplicit kapitalisering. Folkepensionsalderen opslås i kapitaliseringsbekendtgørelsen gældende på afgørelsesdatoen.

**Rest-sektionen** (ved delvis kapitalisering med rest-EET > 0):

Starter på kapitaliseringsdatoen og løber til den tidligste af beregningsdatoen, dagen før næste afgørelses virkningsdato, og dagen før den tvungne kapitaliseringsdato. Rest-sektionen opdeles ligeledes i kalenderårs-rækker.

#### Trin 5 — Beregnet EET per periode-række

```
beregnet_eet = round0(måneder_præcis × månedlig_ydelse)
```

Måneder opgøres med `optaelMaanederPraecis` fra `periodiseringsMotor.ts`, som tæller dage/dage-i-måneden for hver dag i perioden. Det fulde decimaltal bruges i beregningen (kun 4 decimaler vises).

I alt per afgørelse: summen af alle rækker (fuld + rest sektion). Der er ingen samlet total på tværs af afgørelser.

### Afrundingsregler (oversigt)

| Situation | Metode |
|---|---|
| Grundløn | `round0` — halvt-væk-fra-nul til hele kr. |
| Grundydelse | `round2` — halvt-væk-fra-nul til 2 decimaler |
| Årsydelse | `ceil12` — op til nærmeste 12-delelige |
| Månedlig ydelse | Ingen afrunding — altid hele kr. (`årsydelse / 12`) |
| Beregnet EET | `round0` — halvt-væk-fra-nul til hele kr. |

### Verificeret eksempel

**Stamdata:** Skade 01-04-2019, beregningsdato 27-02-2026, årsløn 489.000 kr., `aarsloenMax[2019]` = 539.000 kr.

```
grundløn = round0(489.000 × 367.000 / 539.000) = 332.955 kr.
```

**Afgørelse 1:** Midlertidig, 45 %, afgørelsesdato 01-07-2023, virkningsdato 01-02-2023
```
grundydelse = round2(332.955 × 0,45 × 0,83 × 0,92) = 114.410,00 kr.
grundydelse_2024 = round2(114.410,00 × 1,657) = 189.577,37 kr.

Perioder:
01-02-2023 → 31-12-2023: sats 2023 (60,1 %) → årsydelse ceil12(114.410,00 × 1,601) = 183.180 kr.
  → 15.265 kr./md. × 11,0000 mdr. = 167.915 kr.
01-01-2024 → 31-12-2024: sats 2024 (0 %) → årsydelse ceil12(189.577,37 × 1,000) = 189.588 kr.
  → 15.799 kr./md. × 12,0000 mdr. = 189.588 kr.
01-01-2025 → 30-09-2025: sats 2025 (3,9 %) → årsydelse ceil12(189.577,37 × 1,039) = 196.980 kr.
  → 16.415 kr./md. × 9,0000 mdr. = 147.735 kr.
I alt: 505.238 kr.
```
Ophør skyldes næste afgørelses virkningsdato 01-10-2025.

---

## Del 2 — AI-agent: teknisk reference

### Primær fil

`src/domain/erhvervsevnetab/eetLoebendeYdelserCalculation.ts` (629 linjer)

### Indgangspunkt

```typescript
computeEetLoebendeYdelser(input: Input): EetLoebendeCalculationResult
```

`Input` indeholder `erhvervsevnetab: ErhvervsevnetabValues`, `skadesdato`, `fodselsdato`. Beregningsdatoen hentes fra `erhvervsevnetab.beregningsdato`. Fane 5 kalder denne funktion med `beregningsdato = dagFørBeregningsdato` ved at sende et spreaded objekt: `{ ...input.erhvervsevnetab, beregningsdato: dayBefore }`.

### Nøgletyper

```typescript
EetLoebendeCalculationResult = { issues, computation: EetLoebendeComputation | null }

EetLoebendeComputation = {
  beregningsdato, skadesdato, fodselsdato, skadesaar,
  aslAarsloenAfrundet1000, maxAarsloenISkadesaar, benyttetAarsloen,
  grundloenNiveau: '2003' | '2024',
  grundloen, erstatningsniveauPct: 80 | 83, amBidragPct: 0 | 8,
  afgoerelser: readonly EetLoebendeAfgoerelseComputation[]
}

EetLoebendeAfgoerelseComputation = {
  rowId, afgoerelsesdato, virkningsdato, kapitaliseringsdato,
  afgoerelseType, eetPct, priorKapPct, eetPctFoerAktuelKap,
  kapPctAktuel, kapPctKumulativ, restEetPct,
  harKapitalisering, harRestSektion, tilbagevirkendeKraft,
  ophoerDato, ophoerAarsag: 'beregningsdato' | 'senere-afgoerelse' | 'kapitalisering' | 'tvungen-kapitalisering',
  grundydelseFuld, grundydelseRest,
  grundydelse2024Fuld, grundydelse2024Rest,
  perioder: readonly EetLoebendePeriodeRow[], iAltBeregnetEet
}

EetLoebendePeriodeRow = {
  fra, til, satsAar, maanederPraecis,
  grundydelseAfrundet, reguleringPct, maanedligYdelse, beregnetEet
}
```

### Interne hjælpefunktioner

| Funktion | Beskrivelse |
|---|---|
| `collectResolvedAfgoerelser()` | Filtrerer og sorterer rækker til `ResolvedAfgoerelse[]`. Rækker med tom/0 EET-pct springes over. Sorteres på afgørelsesdato → virkningsdato → rowId. |
| `buildFullSectionPeriods()` | Bygger perioder for fuld-sektionen. Håndterer tilbagevirkendeKraft (virkningsår < afgørelsesår = én samlet række med afgørelsesårets sats). |
| `buildRestSectionPeriods()` | Bygger perioder for rest-sektionen. Altid normal årsregulering (sats = kalenderår). |
| `resolveTvungenStopDato()` | Slår folkepensionsalderen op via `resolveKapitaliseringTabelvalgForControlDate()` og beregner `FP-dato − 24 måneder − 1 dag`. Returnerer `undefined` for midlertidige afgørelser. |
| `collectBlockingInputIssues()` | Kalder `collectIncompleteRowIssues()` fra `eetAslAfgoerelser.ts` og tilføjer `delvist-endelig-missing-kapitalisering` og `asl-identiske-afgoerelser`. |
| `collectWarnings()` | Producerer de fem advarsler (se fejlkatalog). |

### Afhængigheder

| Import | Kilde |
|---|---|
| `ASL_MAX_AARSLOEN_2003`, `ASL_MAX_AARSLOEN_2024`, `aarsloenMax`, `reguleringsprocentErhvervsevnetabFoer2024` | `src/data/regulationRates.ts` |
| `resolveAslReguleringRateForSatsAar()` | `eetReguleringRater.ts` |
| `collectIncompleteRowIssues()`, `hasIdenticalAfgoerelser()`, m.fl. | `eetAslAfgoerelser.ts` |
| `resolveKapitaliseringTabelvalgForControlDate()` | `eetKapitaliseringOpslag.ts` |
| `optaelMaanederPraecis()` | `src/domain/erstatningsopgoerelse/periodiseringsMotor.ts` |
| `round0`, `round2`, `round4`, `roundNearest1000` | `eetRounding.ts` |
| `SKAERING_2011_01_01`, `SKAERING_2024_07_01` | `eetSkaeringsdatoer.ts` |

### Reguleringslogik — `eetReguleringRater.ts`

`resolveAslReguleringRateForSatsAar(year, before2024Skade, issues)` returnerer `{ factor, reguleringPct } | null`.

- `before2024Skade = skadesdato < '2024-07-01'`
- År ≤ 2023 + before2024: opslag i `reguleringsprocentErhvervsevnetab[year]`
- År = 2024 + before2024: factor = 1, reguleringPct = 0 (referenceår)
- År > 2024 + before2024: opslag i `reguleringsprocentErhvervsevnetabFra2024[year]`
- Ikke before2024: opslag i `reguleringsprocentErhvervsevnetabFra2024[year]` for alle år

Issue-ID ved manglende sats: `reguleringssats-missing-${year}` (ét blokerende issue per år).

### Ophørsprioritet (tie-breaking)

Når to ophørsårsager falder på samme dato, vinder den med lavest tal:

```typescript
OPHOER_AARSAG_PRIORITY = {
  'senere-afgoerelse': 1,
  'tvungen-kapitalisering': 2,
  'kapitalisering': 3,
  'beregningsdato': 4,
}
```

### Eksporterede hjælpefunktioner (bruges af UI)

- `toAfgoerelseTypeLabel(type, hasRestSektion, hasKapitalisering)` — Returnerer dansk label
- `toOphoerAarsagLabel(cause)` — Returnerer dansk label
- `formatSkadesdatoCompact(iso)` — `"1/4-2019"`-format
- `formatPct(value)` — `"45 %"` med trimmede decimaler
- `formatPercentTrimmedFromRounded4(value)` — Bruges også af fane 3 og 4

### Fejl og advarsler (fane 2)

Se [fejlkatalog.md](./fejlkatalog.md) for komplet katalog. Fane 2 producerer:

**Blokerende fejl:** `aarsloen-missing`, `aarsloen-zero`, `fodselsdato-missing`, `beregningsdato-missing`, `skadesdato-missing`, `aarsloen-max-missing`, `reguleringssats-missing-{år}`, `delvist-endelig-missing-kapitalisering`, `asl-identiske-afgoerelser`, samt felt-issues fra `collectIncompleteRowIssues()` (`missing-afgoerelsesdato`, `missing-eet-pct`, `missing-afgoerelseType`, `kap-dato-without-kap-pct`, `kap-pct-without-kap-dato`).

**Advarsler:** `warn-asl-eet-under-15`, `warn-invalid-eet-pct-after-2024-07-01`, `warn-non-endelig-after-endelig`, `warn-afgoerelsesdato-after-beregningsdato`, `warn-virkningsdato-after-beregningsdato`, `warn-kap-dato-after-beregningsdato`, `warn-asl-aarsloen-is-max`.

### Tests

`src/__tests__/domain/erhvervsevnetab/eetLoebendeYdelserCalculation.test.ts` (564 linjer)

Dækker: verificerede eksempler A–D, periodeafgrænsning, tilbagevirkende kraft, rest-sektion, tvungen kapitalisering, regulering og niveauskift 2024, advarsler.

---

## Kendte udeståender

*Ingen kendte udeståender pr. dags dato. Filen er synkroniseret med koden.*
