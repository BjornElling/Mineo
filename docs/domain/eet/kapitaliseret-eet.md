# Kapitaliseret EET — ASL (fane 3)

Denne fil beskriver beregningslogikken for kapitalisering af erhvervsevnetab efter Arbejdsskadesikringsloven (ASL). Beregningen udgør fane 3 på EET-siden.

Se også:
- [loebende-eet.md](./loebende-eet.md) — fane 2
- [eal-beregning.md](./eal-beregning.md) — fane 4
- [differencekrav.md](./differencekrav.md) — fane 5
- [fejlkatalog.md](./fejlkatalog.md) — alle fejl og advarsler

---

## Del 1 — For dig

### Hvad beregner denne fane?

Fane 3 beregner et éngangsbeløb (kapitalbeløbet) for det erhvervsevnetab der er blevet kapitaliseret. Kapitaliseringen er en konvertering: i stedet for løbende månedlige ydelser i resten af erhvervslivet udbetales én sum, beregnet som årsydelsen ganget med en aldersafhængig faktor fra kapitaliseringsbekendtgørelsen.

Kun `Endelig` og `Delvist endelig`-afgørelser kan kapitaliseres. `Midlertidig`-afgørelser kan det ikke.

### Statiske datakilder

Kapitaliseringsberegningen bruger to typer statiske data:

**Bekendtgørelsesoversigten** (`src/data/kapitalisering/kapitaliseringsbekendtgørelser.ts`):
En matrix der for en given kombination af skadesdato og kapitaliseringsdato slår op, hvilken bekendtgørelse/vejledning der gælder. Strukturen er skadesdato-intervaller med tilhørende kapitaliseringsdato-intervaller og bekendtgørelses-ID'er (fx `10056/2025`).

**Kapitaliseringstabellerne** (`src/data/kapitalisering/kapitaliseringsTabeller/`):
Én TypeScript-fil per bekendtgørelse, fx `10056-2025.ts`. Hver fil indeholder:
- Tabelvalgsdata: matrix (skadesdato, fødselsdato) → tabelbogstav + folkepensionsalder
- Alderstabeller: alder → faktor (evt. kønsopdelte for bekendtgørelser før 2015-03-01)
- Særfaktor for skadelidte < 2 år fra folkepensionsalderen

### Trin-for-trin beregning

Beregningen følger disse trin for hver kapitaliseret afgørelse:

#### Trin 0 — Forhåndsvurdering: er skadelidte ≤ 2 år fra folkepensionsalderen?

Inden det ordinære tabelopslag vurderes om skadelidte er ≤ 2 år fra sin folkepensionsalder på **kontroltidspunktet**:
- Normalt: afgørelsesdatoen
- Ved genoptagelse (kolonne 7 udfyldt): den tidligere kapitaliseringsdato

Fremgangsmåde:
1. Find bekendtgørelsen gældende på kontroltidspunktet (skadesdato × kontroltidspunkt)
2. Slå folkepensionsalderen op i denne bekendtgørelses tabelvalgsdata (skadesdato × fødselsdato)
3. Beregn alder på kontroltidspunktet i hele år og måneder
4. Hvis `folkepensionsalder_måneder − alder_måneder ≤ 24`: brug særfaktoren direkte — spring trin 1–3 over

Hvis særfaktoren bruges direkte, er kapitaliseringsfaktoren = særfaktoren (afrundet til 3 decimaler). Skadelidte der allerede har nået folkepensionsalderen falder ligeledes ind under særfaktoren.

#### Trin 1 — Valg af bekendtgørelse (ordinær sekvens)

Gælder kun hvis trin 0 ikke udløste særfaktor.

Opslagsgrundlaget bestemmes af:
1. Kolonne 7 (tidligere kap.dato) er udfyldt → opslag på denne dato (genoptagelse)
2. Ellers: kolonne 5 (kapitaliseringsdato) → opslag på denne dato

Opslagslogik: find den seneste `skadesdatoFra ≤ skadesdato` og inden for det interval den seneste `kapitaliseringsdatoFra ≤ kapitaliseringsdato`. Den seneste post i hvert interval udløber 31-12 i det år dens `kapitaliseringsdatoFra` angiver — er kapitaliseringsdatoen efter dette tidspunkt, mangler der en gyldig bekendtgørelse.

**Genoptagelse:** Ved genoptagelse foregår alle beregninger (trin 0, bekendtgørelsesvalg, tabelvalg, folkepensionsalder, faktor) som om kapitaliseringen skete på den *tidligere* kapitaliseringsdato — med én undtagelse: reguleringsopslaget i trin 3 sker til kalenderåret for den *nye* kapitaliseringsdato.

#### Trin 2 — Valg af tabel og folkepensionsalder

Inden for den fundne bekendtgørelse opslås tabel og folkepensionsalder på baggrund af skadesdato og fødselsdato. Er fødselsdatoen ældre end bekendtgørelsens ældste fødselsdato-interval, bruges den normative kohorteregel:

| Fødselsdato | Folkepensionsalder |
|---|---|
| Første halvår 1955 | 66,5 år |
| Andet halvår 1954 | 66 år |
| Første halvår 1954 | 65,5 år |
| 1953 eller tidligere | 65 år |

For bekendtgørelser fra før 2015-03-01 er tabellerne kønsopdelte — køn skal angives for at beregningen kan gennemføres.

#### Trin 3 — Grundydelse og regulering

Grundydelsen beregner årsydelsen for de kapitaliserede procentpoint. Formlerne er identiske med fane 2:

```
grundydelse = round2(grundløn × kap_pct × erstatningsniveau × amFaktor)
```

- `kap_pct`: de procentpoint der kapitaliseres (ikke den samlede EET-procent)
- `erstatningsniveau`: 0,83 (skade ≥ 2011-01-01) eller 0,80
- `amFaktor`: 0,92 (skade ≥ 2011-01-01) eller 1,0

Regulering til kapitaliseringstidspunktet er et **direkte tabelopslag** (ikke kædeberegning som i EAL):

```
effektiv_grundydelse = grundydelse_2024  (hvis before2024Skade og kapitaliseringsår ≥ 2024)
                     = grundydelse        (ellers)

årsydelse = round2(effektiv_grundydelse × reguleringsfaktor[kapitaliseringsår])
```

For skader før 01-07-2024 og kapitaliseringsår ≥ 2024 bruges `grundydelse_2024` beregnet som `round2(grundydelse × (1 + reguleringsprocentErhvervsevnetabFoer2024[2024] / 100))`. Årsydelsen afrundes til 2 decimaler — der sker **ikke** `ceil12`-oprunding som ved løbende ydelser.

#### Trin 4 — Kapitaliseringsfaktor

Faktoren bestemmes af skadelidtes alder på kapitaliseringstidspunktet (kolonne 7 eller kolonne 5) og afhænger af om skaden er fra efter 2007-07-01:

| Skadesdato | Måneds-afhængihed |
|---|---|
| Før 01-07-2007 | Nej — kun hele opnåede år, ingen interpolation på måneder |
| Fra 01-07-2007 | Ja — år og måneder interpoleres |

**Tilfælde 1 — alder inden for tabellens interval:**
```
faktor = ((12 − måneder) / 12) × faktor(alder_ned) + (måneder / 12) × faktor(alder_op)
```
(Måneds-afhængihed = Nej: brug blot `faktor(opnåede_hele_år)`)

**Tilfælde 2 — alder over tabellens maksimum, men > 2 år fra FP:**
```
faktor = faktor(højeste_tabelalder)
       + (måneder_over_højeste / total_måneder) × (særfaktor − faktor(højeste_tabelalder))
```
`total_måneder` = måneder fra højeste tabelalder til (folkepensionsalder − 2 år).

**Tilfælde 3 — ≤ 2 år fra FP (eller FP nået):** Særfaktoren direkte (se trin 0).

Kapitaliseringsfaktoren afrundes til 3 decimaler: `round3(faktor)`.

#### Trin 5 — Kapitalbeløb

```
kapitalbeløb = ceil0(årsydelse × kapitaliseringsfaktor)
```

Afrunding: **op** til nærmeste hele krone. Hver afgørelse giver sit eget kapitalbeløb — der beregnes ingen samlet sum på tværs.

### Afrundingsregler (oversigt)

| Situation | Metode |
|---|---|
| Grundydelse | `round2` |
| Årsydelse | `round2` (ikke `ceil12` — kapitaliseringsberegning, ikke løbende) |
| Kapitaliseringsfaktor | `round3` |
| Kapitalbeløb | `ceil0` — op til hele kr. |

### Verificerede eksempler

**Eksempel 1 — afgørelse 01-07-2025 (kapitaliseringsdato 01-10-2025)**

| Felt | Værdi |
|---|---|
| Årsløn | 432.000 kr., `aarsloenMax[2023]` = 575.000 kr. |
| Kapitalisering | 25 % |
| Grundydelse (25 %): `grundløn × 0,25 × 0,83 × 0,92` | 82.468,80 kr. |
| Reguleringsprocent (1. oktober 2025) | 3,90 % |
| Årsydelse | 85.685,08 kr. |
| Bekendtgørelse | Vejl. 10029/2024, tabel B |
| Folkepensionsalder | 68 år |
| Særfaktor | 1,245 |
| Alder ved kapitalisering | 59 år, 8 måneder |
| Faktor måneds-afhængig | Ja |
| Kapitaliseret pga. < 2 år til FP | Nej |
| Kapitaliseringsfaktor | 5,312 |
| **Kapitalbeløb** | **455.160 kr.** |

---

## Del 2 — AI-agent: teknisk reference

### Primær fil

`src/domain/erhvervsevnetab/eetKapitaliseringCalculation.ts` (506 linjer)

### Indgangspunkt

```typescript
computeEetKapitaliseringCalculation(input: Input): EetKapitaliseringCalculationResult
```

### Nøgletyper

```typescript
EetKapitaliseringCalculationResult = { issues, computation: EetKapitaliseringComputation | null }

EetKapitaliseringComputation = {
  afgoerelser: readonly EetKapitaliseringAfgoerelseComputation[]
}

EetKapitaliseringAfgoerelseComputation = {
  rowId, afgoerelsesdato, kapitaliseringsdato, kapitaliseringspct,
  grundloen, erstatningsniveauPct: 80 | 83, amBidragPct: 0 | 8,
  grundydelse, reguleringsPctRounded4, aarsydelse,
  kapitaliseringsbekendtgoerelseLabel,   // fx "Vejl. 10056/2025, tabel A"
  tabelLabel, folkepensionsalderLabel,
  saerfaktor: number | null,
  alderAar, alderMaaneder,
  kapitaliseretPgaUnderToAarTilFp: boolean,
  faktorMaanedsAfhaengig: boolean,
  kapitaliseringsfaktor, kapitalbelob,
  koenOpdelt: boolean
}
```

### Internt flow

1. `collectResolvedRows()` — Filtrerer til rækker med `Endelig`/`Delvist endelig`, gyldig kapDato og kapPct > 0. Emitterer `asl-afgoerelser-empty`, `no-endelig-afgoerelser`, `delvist-endelig-missing-kapitalisering`, `endelig-under-50-missing-kapitalisering`, `kap-dato-without-kap-pct`, `kap-pct-without-kap-dato`, `warn-ingen-kap-input`, `warn-kap-pct-under-15`.
2. For hvert `ResolvedKapitaliseringsRow`:
   - `controlDate = tidlKapDato ?? afgoerelsesdato`
   - `effectiveKapDato = tidlKapDato ?? kapDato`
   - Opslag af kontrol-bekendtgørelse → tabelvalg → alder → særfaktor-tjek
   - Hvis særfaktor bruges direkte: `kapitaliseringsfaktor = round3(saerfaktor)`
   - Ellers: opslag af effektiv bekendtgørelse → faktortabel → interpolation
3. Regulering, grundydelse, årsydelse, `ceil0(årsydelse × faktor)`

### Opslagsfiler

`src/domain/erhvervsevnetab/eetKapitaliseringOpslag.ts` (349+ linjer):

| Funktion | Beskrivelse |
|---|---|
| `resolveKapitaliseringsbekendtgoerelseId(skadesdato, dato)` | Returnerer bekendtgørelses-ID (fx `10056/2025`) eller `null` |
| `resolveKapitaliseringTabelvalg(data, skadesdato, fodselsdato)` | Returnerer `{ tabel, folkepensionsalderMaaneder, folkepensionsalderLabel }` eller `null` |
| `resolveFactorTable(data, tabel, koen)` | Returnerer `{ rows, koenOpdelt, reason }` — håndterer kønsopdelte tabeller og manglende køn |
| `calculateAgeYearsMonths(fodselsdato, dato)` | Returnerer `{ years, months, totalMonths }` eller `null` |
| `interpolateFactorWithinTable(rows, age, maanedsAfhaengig)` | Returnerer faktor eller `null` hvis alder er over tabellens max |
| `interpolateFactorBeyondTable(rows, age, fpMaaneder, saerfaktor, maanedsAfhaengig)` | Lineær ekstrapolation mod særfaktor |
| `resolveSaerfaktor(data, skadesdato)` | Returnerer særfaktor for det relevante skadesdato-interval |
| `resolveKapitaliseringTabelvalgForControlDate(skadesdato, fodselsdato, controlDate)` | Kombineret opslag — bruges også af løbende ydelser til tvungen-kapitaliseringstjek |

### Konstant

```typescript
export const WARN_NO_KAP_INPUT_ID = 'warn-ingen-kap-input';
```
Exporteret fra fane 3 og filtreret bort af fane 5.

### Afhængigheder

| Import | Kilde |
|---|---|
| `ASL_MAX_AARSLOEN_2003/2024`, `aarsloenMax`, `reguleringsprocentErhvervsevnetabFoer2024` | `src/data/regulationRates.ts` |
| `getKapitaliseringsTabelData()` | `src/data/kapitalisering/kapitaliseringsTabeller` |
| `resolveAslReguleringRateForKapAar()` | `eetReguleringRater.ts` |
| `collectIncompleteRowIssues()`, m.fl. | `eetAslAfgoerelser.ts` |
| `ceil0`, `round0`, `round2`, `round3`, `round4`, `roundNearest1000` | `eetRounding.ts` |
| `SKAERING_2007_07_01`, `SKAERING_2011_01_01`, `SKAERING_2024_07_01` | `eetSkaeringsdatoer.ts` |

### Reguleringslogik (fane 3)

Bruger `resolveAslReguleringRateForKapAar(kapitaliseringsaar, before2024Skade, issues)`. Issue-ID ved manglende sats: `reguleringssats-missing` (uden år-suffiks — ét samlet blokerende issue).

### Fejl og advarsler (fane 3)

Se [fejlkatalog.md](./fejlkatalog.md) for komplet katalog. Fane 3 producerer:

**Blokerende fejl:** `aarsloen-missing`, `aarsloen-zero`, `aarsloen-max-missing`, `fodselsdato-missing`, `skadesdato-missing`, `asl-afgoerelser-empty`, `no-endelig-afgoerelser`, `delvist-endelig-missing-kapitalisering`, `endelig-under-50-missing-kapitalisering`, `kap-dato-without-kap-pct`, `kap-pct-without-kap-dato`, `missing-koen`, `kapitaliseringsbekendtgoerelse-missing-control-date`, `kapitaliseringsbekendtgoerelse-missing-effective-date`, `kapitaliseringstabel-missing`, `kapitaliseringsalder-under-minimum`, `kapitaliseringsfaktor-unresolved`, `reguleringssats-missing`, `missing-kap-dato`, `missing-kap-pct`.

**Advarsler:** `warn-ingen-kap-input`, `warn-kap-pct-under-15`, `warn-kap-dato-after-beregningsdato`, `warn-asl-eet-under-15`, `warn-invalid-eet-pct-after-2024-07-01`, `warn-non-endelig-after-endelig`.

### Tests

`src/__tests__/domain/erhvervsevnetab/eetKapitaliseringCalculation.test.ts` (489 linjer)

Dækker: faktor-interpolation inden for og over tabel, særfaktor (< 2 år til FP), kønsopdelte tabeller (pre-2015), regulering for kapitaliseringsår.

---

## Kendte udeståender

*Ingen kendte udeståender pr. dags dato. Filen er synkroniseret med koden.*
