# Løbende EET — ASL (fane 2)

Denne fil beskriver beregningslogikken for løbende erhvervsevnetabsydelser efter Arbejdsskadesikringsloven (ASL). Beregningen udgør fane 2 på EET-siden.

Se også:
- [kapitaliseret-eet.md](./kapitaliseret-eet.md) — fane 3
- [eal-beregning.md](./eal-beregning.md) — fane 4
- [differencekrav.md](./differencekrav.md) — fane 5
- [fejlkatalog.md](./fejlkatalog.md) — alle fejl og advarsler
- [under-to-aar-til-fp.md](./under-to-aar-til-fp.md) — særregel for ≤ 2 år til folkepensionsalderen

---

## Del 1 — For dig

### Hvad beregner denne fane?

Fane 2 opgør, hvad skadelidte har haft ret til i løbende månedlig ydelse fra erhvervsevnetabet, fra den første afgørelses virkningsdato frem til og med beregningsdatoen. Beregningen sker per afgørelse og opdeles i kalenderårs-rækker, fordi den løbende ydelse reguleres hvert år pr. 1. januar.

Resultatet bruges direkte i differencekravet (fane 5) — med den ene forskel at fane 5 beregner frem til og med dagen før beregningsdatoen i stedet for beregningsdatoen selv.

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

En ny afgørelses EET-procent erstatter altid den forrige i sin helhed — procenter lægges ikke oven på hinanden. Kapitaliseringsprocenter fra tidligere afgørelser fratrækkes dog kumulativt, fordi de procentpoint allerede er udbetalt som engangsbeløb.

To afgørelser må godt have samme afgørelsesdato og forskellig virkningsdato. I så fald anvendes afgørelsen med den tidligste virkningsdato indtil dagen før den senere virkningsdato. Fra den senere virkningsdato erstatter den senere afgørelse den tidligere.

#### Trin 3 — Årsydelse for et givet beregningsår

Årsydelsen bestemmer den månedlige ydelse for et konkret kalenderår. Reguleringslogikken afhænger af grundlønsniveauet:

**Skade før 01-07-2024 (grundydelse i 2003-niveau):**

| Beregningsår | Formel |
|---|---|
| ≤ 2023 | `grundydelse × (1 + reguleringsprocentErhvervsevnetab[år] / 100)` |
| 2024 | `grundydelse_2024 × 1,000` |
| ≥ 2025 | `grundydelse_2024 × (1 + reguleringsprocentErhvervsevnetabFra2024[år] / 100)` |

**Skade fra 01-07-2024 (grundydelse i 2024-niveau):**

| Beregningsår | Formel |
|---|---|
| 2024 | `grundydelse × 1,000` |
| ≥ 2025 | `grundydelse × (1 + reguleringsprocentErhvervsevnetabFra2024[år] / 100)` |

Reguleringsopslaget er et direkte tabelopslag per kalenderår — ikke en kædeberegning som i EAL-sporet.

Årsydelsen rundes op til nærmeste hele kronebeløb deleligt med 12:
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

**Særregel — tilbagevirkende kraft:** Hvis virkningsdatoen ligger i et tidligere kalenderår end afgørelsesdatoen, gælder afgørelsesårets sats for hele perioden fra virkningsdatoen frem til 31-12 i afgørelsesåret. Fra 01-01 det følgende år reguleres normalt.

**Ophørsdato** er den tidligste af:
1. Beregningsdatoen
2. Dagen før næste afgørelses virkningsdato
3. Dagen før kapitaliseringsdatoen (kun når afgørelsen faktisk kapitaliseres)
4. Dagen før folkepensionsdatoen

**Særreglen ved ≤ 2 år til folkepension gælder kun for `Endelig`:**
- Hvis en endelig afgørelse træffes mere end 2 år før folkepensionsalderen, sker der ingen tvungen kapitalisering. Løbende ydelser fortsætter til og med dagen før folkepensionsdatoen.
- Hvis en endelig afgørelse træffes inden for eller præcis 2 år før folkepensionsalderen, skal hele erhvervsevnetabet kapitaliseres på afgørelsesdatoen.
- Hvis virkningsdatoen i dette tilfælde ligger før 2-årsgrænsen, løber ydelserne fra virkningsdatoen til og med dagen før afgørelsesdatoen.
- Hvis virkningsdatoen ligger på eller efter 2-årsgrænsen, tilkendes ingen løbende ydelser.

`Delvist endelig` og `Midlertidig` følger ikke denne tvungne fuldkapitalisering. De løbende ydelser fortsætter derfor til og med dagen før folkepensionsdatoen, medmindre afgørelsen ophører tidligere på grund af næste afgørelse eller en faktisk kapitalisering.

**Rest-sektionen** (ved delvis kapitalisering med rest-EET > 0):

Starter på kapitaliseringsdatoen og løber til den tidligste af beregningsdatoen, dagen før næste afgørelses virkningsdato og dagen før folkepensionsdatoen.

#### Trin 5 — Beregnet EET per periode-række

```
beregnet_eet = round0(måneder_præcis × månedlig_ydelse)
```

Måneder opgøres med `optaelMaanederPraecis` fra `periodiseringsMotor.ts`, som tæller dage/dage-i-måneden for hver dag i perioden. Det fulde decimaltal bruges i beregningen.

I alt per afgørelse: summen af alle rækker (fuld + rest sektion). Der er ingen samlet total på tværs af afgørelser.

### Afrundingsregler (oversigt)

| Situation | Metode |
|---|---|
| Grundløn | `round0` — halvt-væk-fra-nul til hele kr. |
| Grundydelse | `round2` — halvt-væk-fra-nul til 2 decimaler |
| Årsydelse | `ceil12` — op til nærmeste 12-delelige |
| Månedlig ydelse | Ingen afrunding — altid hele kr. (`årsydelse / 12`) |
| Beregnet EET | `round0` — halvt-væk-fra-nul til hele kr. |

---

## Del 2 — AI-agent: teknisk reference

### Primær fil

`src/domain/erhvervsevnetab/eetLoebendeYdelserCalculation.ts`

### Interne hjælpefunktioner

| Funktion | Beskrivelse |
|---|---|
| `collectResolvedAfgoerelser()` | Filtrerer og sorterer afgørelser |
| `buildFullSectionPeriods()` | Bygger perioder for fuld-sektionen |
| `buildRestSectionPeriods()` | Bygger perioder for rest-sektionen |
| `resolveFolkepensionsDagFoer()` | Beregner dagen før folkepensionsdatoen som ophørskandidat |

### Implementeringsstatus

Dokumentationen ovenfor beskriver den fastlagte forretningslogik. Hvis dokumentation og kode afviger, er denne fil den normative beskrivelse af løbende ydelser.

### Tests

`src/__tests__/domain/erhvervsevnetab/eetLoebendeYdelserCalculation.test.ts`

Dækker beregningen af løbende ydelser, herunder særreglen for `Endelig` ved `≤ 2 år` til folkepension.

---

## Kendte udeståender

Dokumentationen afspejler den fastlagte forretningslogik for løbende ydelser.
