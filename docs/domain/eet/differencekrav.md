# Differencekrav (fane 5)

Denne fil beskriver beregningslogikken for differencekravet. Beregningen udgør fane 5 på EET-siden.

Se også:
- [loebende-eet.md](./loebende-eet.md) — fane 2
- [kapitaliseret-eet.md](./kapitaliseret-eet.md) — fane 3
- [eal-beregning.md](./eal-beregning.md) — fane 4
- [fejlkatalog.md](./fejlkatalog.md) — alle fejl og advarsler

---

## Del 1 — For dig

### Hvad er differencekravet?

Differencekravet er det beløb skadelidte kan kræve derudover, når EAL-erstatningen overstiger den samlede ASL-erstatning. Hvis ASL-erstatningen er større end eller lig med EAL-erstatningen, er differencekravet 0 kr.

### Overordnet princip

```
differencekrav = eal_krav
               − fradrag_løbende_ydelser
               − fradrag_kapitaliseret_eet
               − proformakapitalisering

hvis differencekrav < 0: differencekrav = 0
```

Fane 5 er udelukkende forbruger — den beregner intet nyt om ASL eller EAL, men trækker de allerede beregnede resultater fra fane 2, 3 og 4 ind. Dog med én vigtig afvigelse for fradrag 1 og 3.

### Dataflow

Fane 5 kører tre underberegninger internt, ikke blot opslår resultater:

| Kilde | Særlighed |
|---|---|
| **EAL-krav (fane 4)** | Kørsel af `computeEetEalCalculation` — identisk med fane 4 |
| **Kapitaliseret EET (fane 3)** | Kørsel af `computeEetKapitaliseringCalculation` — identisk med fane 3 |
| **Løbende ydelser (fane 2)** | Kørsel af `computeEetLoebendeYdelser` med `beregningsdato = dagFørBeregningsdato` |

Intet flyder fra fane 5 til de øvrige faner.

### Fradrag 1 — Løbende ydelser

Beregningen er identisk med fane 2 — men med en kritisk forskel i slutdatoen:

- **Fane 2:** beregner frem til og med beregningsdatoen
- **Fane 5:** beregner frem til og med *dagen før* beregningsdatoen

Begrundelse: Beregningsdatoen er den dag EAL-kravet opgøres. ASL-ydelser frem til og med *denne* dag skal fratrækkes som allerede modtaget, men ikke ydelser på selve dagen (der medregnes i fane 4's opgørelse).

**Fradragsregel per afgørelse** afhænger af skadsdatoen:

| Skadesdato | Afgørelsestype | Fradrages? |
|---|---|---|
| Før 16-06-2011 | Midlertidig | Ja |
| Før 16-06-2011 | Delvist endelig | Ja |
| Før 16-06-2011 | Endelig | Ja |
| 16-06-2011 eller senere | Midlertidig | Nej |
| 16-06-2011 eller senere | Delvist endelig | Nej |
| 16-06-2011 eller senere | Endelig | Ja |

For hver afgørelse er fradraget enten `iAltBeregnetEet` fra løbende beregningen (hvis fradrag foretages) eller 0.

`fradragesTil` vises per afgørelse og bestemmes af:
- For den seneste afgørelse (sorteret på virkningsdato): `dagFørBeregningsdato`
- For tidligere afgørelser: dagen før næste afgørelses virkningsdato

### Fradrag 2 — Kapitaliseret EET

Det samlede kapitaliserede beløb hentes direkte fra fane 3's output. **Kun kapitaliseringer med kapitaliseringsdato ≤ beregningsdatoen medregnes.** En kapitalisering med fremtidig dato er endnu ikke sket set fra beregningsdatoens perspektiv og tæller ikke med.

### Fradrag 3 — Proformakapitalisering af tilbageværende EET

Proformakapitaliseringen svarer til spørgsmålet: "Hvad ville det tilbageværende løbende erhvervsevnetab være værd som éngangsbeløb, hvis det blev kapitaliseret på beregningsdatoen?"

**Tilbageværende EET-procent:**
```
løbende_eet_pct = seneste_afgørelses_eet_pct − sum(kapPct fra afgørelser med kapDato ≤ beregningsdato)
```

`seneste_afgørelses_eet_pct` bestemmes med samme tie-breaking som EAL-fallback-reglen: seneste afgørelsesdato → seneste virkningsdato → Endelig > Delvist endelig. Kun kapitaliseringer med kapDato ≤ beregningsdato medregnes i summen.

`løbende_eet_pct` kan aldrig blive negativ (inputvalidering på fane 1 håndhæver dette).

Hvis `løbende_eet_pct = 0` (fuld kapitalisering): proformakapitaliseringen springes over.

**Proformakapitaliseringen genbruger kapitaliseringslogikken fra fane 3** med disse afvigelser:
- Kapitaliseringsdatoen = beregningsdatoen
- Alle afgørelsestyper kan indgå (inkl. midlertidige)
- 50 %-loftet gælder ikke
- Bekendtgørelse og tabel opslås på beregningsdatoen
- Kontroltidspunktet for ≤ 2 år til folkepension er beregningsdatoen

Proformaberegningen kørers kun hvis EAL-beregningen er gennemført (`ealResult.computation !== null`) og alle stamdata er til stede.

### Issues og blokeringslogik

Fane 5 aggregerer issues fra fane 2, 3 og 4 samt egne proforma-issues. Følgende filtreres fra download-blokering:

**Fjernes altid fra fane 5:**
- `no-endelig-afgoerelser` — Fane 5 proformakapitaliserer uafhængigt af om der tidligere er foretaget kapitalisering
- `warn-ingen-kap-input` — Fane 5 håndterer manglende kapitalisering via proformaberegningen

**Undertrykkelse:**
- `eet-pct-missing` undertykkes hvis `asl-afgoerelser-empty` er aktiv (ingen afgørelsestabel at hente EET-% fra)

Issues deduplikeres på meddelelsestekst og severity.

Download er deaktiveret så længe der er mindst én aktiv `error` der ikke er filtreret fra.

### Verificeret eksempel

**Stamdata:**
- Skadesdato: 2023 (skadeår 2023, beregningsår 2026)
- Fødselsdato: 08-01-1972
- Beregningsdato: 01-10-2026

**ASL-input:**
- Årsløn: 432.000 kr.
- Afgørelse 1: 12-03-2024, virkningsdato 01-01-2024, EET 75 %, Midlertidig
- Afgørelse 2: 17-09-2025, virkningsdato 01-08-2025, EET 60 %, Endelig, ingen kapitalisering

**EAL-input:** Årsløn: 700.000 kr., EET: 70 %

| Trin | Beskrivelse | Beløb |
|---|---|---|
| EAL-krav | 789.000 × 10 × 70 % = 5.523.000, aldersreduktion 22 % (alder 51) | 4.307.940 kr. |
| Fradrag 1: løbende ydelser | Kun endelig afgørelse fratrækkes (skadesdato ≥ 16-06-2011). Frem til 30-09-2026 | −255.813 kr. |
| Fradrag 2: kapitaliseret EET | Ingen kapitaliserede afgørelser | −0 kr. |
| Fradrag 3: proformakapitalisering | `løbende_eet_pct` = 60 % − 0 % = 60 %. Beregningsdato 01-10-2026. Vejl. 10056/2025, tabel A, FP 69 år. Alder 54 år 8 mdr. Faktor 10,267. Årsydelse 222.915,68 kr. | −2.288.676 kr. |
| **Differencekrav** | 4.307.940 − 255.813 − 0 − 2.288.676 | **1.763.451 kr.** |

---

## Del 2 — AI-agent: teknisk reference

### Primær fil

`src/domain/erhvervsevnetab/eetDifferencekravCalculation.ts` (589 linjer)

### Indgangspunkt

```typescript
computeEetDifferencekravCalculation(input: Input): EetDifferencekravCalculationResult
```

`Input` = `{ erhvervsevnetab, skadesdato, fodselsdato }`. Rate-tabeller (`reguleringssats`, `erhvervsevnetabMax`, `aarsloenMax`) importeres direkte i filen fra `regulationRates.ts` og passes videre til EAL-beregningen.

### Nøgletyper

```typescript
EetDifferencekravCalculationResult = {
  issues: readonly EetIssue[],
  computation: EetDifferencekravComputation | null,
  hasBlockingErrors: boolean   // eksplicit, da fanen bruger den direkte
}

EetDifferencekravComputation = {
  beregningsdato, skadesdato, dagFoerBeregningsdato,
  ealKrav, ealEetPct,
  fradragLoebendeYdelser, fradragKapitaliseretEet,
  proformaKapitalisering: EetDifferencekravProformaKapitalisering | null,
  proformaBeloeb,
  differencekrav,
  afgoerelser: readonly EetDifferencekravLoebendeAfgoerelse[],
  kapitaliseringerAfgoerelser: readonly EetDifferencekravKapitaliseretAfgoerelse[]
}

EetDifferencekravLoebendeAfgoerelse = {
  rowId, afgoerelsesdato, virkningsdato, afgoerelseType,
  eetPct, fradragesTil, beloeb, fradragForetages: boolean
}

EetDifferencekravKapitaliseretAfgoerelse = {
  rowId, afgoerelsesdato,
  kapitaliseringsdato: ISODateString | null,
  kapitaliseringspct: number | null,
  kapitalbelob: number | null,
  kapitaliseringEfterBeregningsdato: boolean
}

EetDifferencekravProformaKapitalisering = {
  loebendeEetPct, kapitaliseringsdato, grundydelse,
  reguleringsPctRounded4, aarsydelse,
  kapitaliseringsbekendtgoerelseLabel, folkepensionsalderLabel,
  alderAar, alderMaaneder,
  kapitaliseretPgaUnderToAarTilFp, faktorMaanedsAfhaengig,
  saerfaktor: number | null,
  kapitaliseringsfaktor, proformaBeloeb, koenOpdelt
}
```

### Interne hjælpefunktioner

| Funktion | Beskrivelse |
|---|---|
| `computeProformaKapitalisering(args, issues)` | Proformaberegning. Fuldt analog med fane 3's kapitaliserings-loop men med `beregningsdato` som kapitaliseringsdato og ingen 50 %-begrænsning |
| `resolveLoebendeEetPct(afgoerelser, kapitaliseringer)` | Bestemmer `løbende_eet_pct` til proformakapitalisering. Tie-breaking identisk med EAL-fallback-reglen |
| `skalFradragForetages(afgoerelseType, skadesdato)` | `skadesdato < SKAERING_2011_06_16 → true`, ellers kun `Endelig → true` |

### Issue-aggregering og filtrering

```typescript
// Fra fane 3: filtrer 'warn-ingen-kap-input' fra
for (const issue of kapResult.issues) {
  if (issue.id !== WARN_NO_KAP_INPUT_ID) allSourceIssues.push(issue);
}

// Efter deduplication: fjern 'no-endelig-afgoerelser'
const deduped = dedupeIssuesBySeverityAndMessage(allSourceIssues)
  .filter((issue) => issue.id !== 'no-endelig-afgoerelser');

// Undertrykke 'eet-pct-missing' hvis 'asl-afgoerelser-empty' er aktiv
const hasAslAfgoerelserEmpty = deduped.some((issue) => issue.id === 'asl-afgoerelser-empty');
const aggregatedIssues = hasAslAfgoerelserEmpty
  ? deduped.filter((issue) => issue.id !== 'eet-pct-missing')
  : deduped;
```

### Kapitaliseringsfilter i fradrag 2

```typescript
// Kun kapitaliseringer med dato <= beregningsdato medregnes
if (kapComp && kapComp.kapitaliseringsdato <= beregningsdato) {
  fradragKapitaliseretEet += kapComp.kapitalbelob;
  // kapitaliseringEfterBeregningsdato = false
} else if (kapComp && kapComp.kapitaliseringsdato > beregningsdato) {
  // kapitaliseringEfterBeregningsdato = true — vises men bidrager ikke
}
```

### Proforma-kønstjek

Fane 5 tjekker selv om `koen` mangler for beregningsdatoer < 2015-03-01:
```typescript
if (!args.koen && beregningsdato < '2015-03-01') {
  issues.push(toIssue('missing-koen', 'Ved beregning før 1. marts 2015 skal køn angives.'));
}
```
Dette er et separat tjek fra fane 3's tilsvarende — note at issue-ID er det samme (`missing-koen`), men meddelelsesteksten er anderledes.

### Afhængigheder

| Import | Kilde |
|---|---|
| `reguleringssats`, `erhvervsevnetabMax`, `aarsloenMax`, `ASL_MAX_AARSLOEN_2003/2024`, `reguleringsprocentErhvervsevnetabFoer2024` | `src/data/regulationRates.ts` |
| `computeEetLoebendeYdelser` | `eetLoebendeYdelserCalculation.ts` |
| `computeEetEalCalculation` | `eetEalCalculation.ts` |
| `computeEetKapitaliseringCalculation`, `WARN_NO_KAP_INPUT_ID` | `eetKapitaliseringCalculation.ts` |
| Opslagsfunktioner | `eetKapitaliseringOpslag.ts` |
| `ceil0`, `round0`, `round2`, `round3`, `round4`, `roundNearest1000` | `eetRounding.ts` |
| `SKAERING_2007_07_01`, `SKAERING_2011_01_01`, `SKAERING_2011_06_16`, `SKAERING_2024_07_01` | `eetSkaeringsdatoer.ts` |

### Proforma-specifikke issue-ID'er

Se [fejlkatalog.md](./fejlkatalog.md) for komplet beskrivelse. ID'erne er:
- `proforma-kapitaliseringsbekendtgoerelse-missing`
- `proforma-kapitaliseringstabel-missing`
- `proforma-kapitaliseringsalder-under-minimum`
- `proforma-kapitaliseringsfaktor-unresolved`
- `proforma-reguleringssats-missing`
- `missing-koen` (delt med fane 3, men med anden beskedtekst)
- `beregningsdato-invalid` (kun fane 5 — fallback hvis dagFørBeregningsdato ikke kan beregnes)

---

## Kendte udeståender

*Ingen kendte udeståender pr. dags dato. Filen er synkroniseret med koden.*
