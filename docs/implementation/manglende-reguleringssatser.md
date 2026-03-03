# Implementeringsplan: Graceful håndtering af manglende reguleringssatser for TAF-perioden

> Arbejdsdokument for planlægning og implementering af robust håndtering af scenarier, hvor reguleringssatser ikke dækker hele TAF-perioden.

---

## 1. Problembeskrivelse

Programmet kaster ukontrollerede runtime-fejl i `eoPdfLoenudvikling.ts`, når reguleringssatser ikke dækker hele TAF-perioden. Dette rammer alle strategier undtagen `manual` og `ingen`.

Settings (`allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden` og `allowReguleringMedUdloebMedMaaneder`) påvirker udelukkende debug-UI — de har ingen effekt på beregning, validering eller PDF-generering.

### Ønsket adfærd

- Hvis brugeren fravælger beskyttelsen mod ufuldstændig dækning, skal programmet behandle manglende satser som "ingen regulering" (`deltaPct = 0`) for de berørte segmenter — ikke kaste.
- Mangler reguleringssatser i **begyndelsen** af perioden: den indtastede løn på skadestidspunktet bruges ureguleret, indtil der begynder at komme reguleringssatser.
- Mangler reguleringssatser i **slutningen** af perioden: der sker ingen yderligere regulering efter den sidste reguleringsdato.
- Alle reguleringstyper skal håndteres: overenskomst (privat + offentlig), statistik (ILON/SBLON/ASL), KRL satstabel, manuelt angivet.
- Alle løngrundlag skal håndteres: beregningsperiode, angivet dagsløn, angivet månedsløn.

### Kontraktbegrænsning

`src/contracts/app-settings.md` linje 24: *"PDF-laget læser aldrig fra AppSettings"*. AppSettings kan derfor **ikke** sendes ind i beregningslogikken. Gating skal ske i validator-laget, og beregningslogikken skal altid kunne klare manglende data.

---

## 2. Overblik over berørte filer og kastesteder

### Kastesteder i `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts`

| Strategi | Kastested | Trigger | Linje (ca.) |
|----------|-----------|---------|-------------|
| Statistik (ILON/SBLON) | `findLatestByDateInSortedListV3(…, reguleringsdato)` → undefined | Reguleringsdato før alle data | ~630 |
| Statistik (ILON/SBLON) | `findLatestByDateInSortedListV3(…, segment.fra)` → undefined | Segment-start før alle data | ~641 |
| Statistik (ASL) | `aarsloenMax[baseYear]` → undefined | Basis-år uden data | ~594 |
| Statistik (ASL) | `aarsloenMax[segment.year]` → undefined → `return null` | Segment-år uden data (stille filtrering) | ~599 |
| KRL | `findLatestByDateInSortedListV3(…, reguleringsdato)` → undefined | Reguleringsdato før alle data | ~683 |
| KRL | `findLatestByDateInSortedListV3(…, segment.fra)` → undefined | Segment-start før alle data | ~697 |
| Overenskomst (privat) | `getEffektiveSatserForDato(reguleringsdatoDa)` → undefined | Reguleringsdato før alle satser | ~896 |
| Overenskomst (privat) | `getEffektiveSatserForDato(segmentDa)` → undefined | Segment-dato før alle satser | ~949 |
| Overenskomst (offentlig) | `assertOffentligReguleringsDatoGyldig(reguleringsdatoDa)` | Reguleringsdato < `OFFENTLIG_REGULERING_MIN_DATO` | ~768 |
| Overenskomst (offentlig) | `assertOffentligReguleringsDatoGyldig(fraDa)` per TAF-range | TAF-range start < min-dato | ~810 |
| Overenskomst (offentlig) | `getOffentligLoenForDato(reguleringsdatoDa)` → undefined | Reguleringsdato uden data | ~788 |
| Overenskomst (offentlig) | `getOffentligLoenForDato(segmentDa)` → undefined | Segment-dato uden data | ~851 |

**Manual er ikke ramt** — den bruger allerede korrekt fallback med `basePackage` når `findLatestByDateInSortedListV3` returnerer undefined (linje ~1033–1034). Det er præcis den adfærd alle strategier bør adoptere.

### Andre berørte filer

| Fil | Problem |
|-----|---------|
| `src/domain/erstatningsopgoerelse/tafNettoBeregning.ts:90–91` | Dead guard: `loenudvikling.loenudviklingTotal.status !== 'ok'` kan aldrig udløses |
| `src/validators/erstatningsopgoerelseValidator.ts` | `validateTAF()` tjekker ikke reguleringsdekning overhovedet |
| `src/settings/appSettingsSchema.ts:59–60` | Settings defineret men ukoblet fra beregning |
| `src/domain/debug/eoDebugErstatningsopgoerelseModel.ts:2465–2770` | Reguleringsdekning-logik der kun bruges til debug-UI |
| `src/domain/erstatningsopgoerelse/eoCanonicalOutput.ts` | Ingen fejlhåndtering for kast fra beregningsmotor |
| `src/calculation/pipeline/erstatningsopgoerelseAggregationPipeline.ts` | `tryCompute` → returnerer `null` uden bruger-feedback |

---

## 3. Stadier

### Stadie 1: Gør beregningslogikken robust — eliminér kast ved manglende satser

**Princip:** Beregningslogikken i `eoPdfLoenudvikling.ts` skal **aldrig** kaste pga. manglende reguleringssatser. I stedet produceres `deltaPct = 0`-segmenter. Dette er en permanent ændring der gælder uanset brugerindstillinger — i overensstemmelse med at kontrakten forbyder AppSettings i beregningslaget.

**Fallback-semantik:** Når basisindeks/basissats mangler (reguleringsdato er før alle data), returneres alle segmenter med `deltaPct = 0`. Begrundelsen: basislønnen er allerede beregnet korrekt ud fra brugerinput; `deltaPct` udtrykker *regulering* relativt til en base. Uden base er regulering per definition 0 %. Det matcher brugerens beskrevne semantik: "den indtastede løn bruges ureguleret."

#### 1a. Statistik (ILON/SBLON)

**Fil:** `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts`, funktion `buildLoenudviklingFromStatistikV3`

**Rettelse af basisindeks-kast (~linje 630):**

Nuværende:
```typescript
const baseEntry = findLatestByDateInSortedListV3(periodStarts, konsolideret.reguleringsdato, 'statistik:base');
if (!baseEntry || baseEntry.indeksvaerdi <= 0) {
  throw new Error('Loenudvikling kan ikke beregnes: mangler basisindeks');
}
```

Nyt mønster:
```typescript
const baseEntry = findLatestByDateInSortedListV3(periodStarts, konsolideret.reguleringsdato, 'statistik:base');
if (!baseEntry || baseEntry.indeksvaerdi <= 0) {
  // Ingen reguleringsdata for reguleringsdato → alle segmenter uregulerede
  const segments: LoenreguleringsSegmentV3[] = [];
  for (const range of konsolideret.tafRanges) {
    for (const segment of buildSegmentsFromStartDatesV3(range, new Set())) {
      segments.push({ ...segment, deltaPct: 0 });
    }
  }
  return segments;
}
```

**Rettelse af segment-indeks-kast (~linje 641):**

Nuværende:
```typescript
const idxEntry = findLatestByDateInSortedListV3(periodStarts, segment.fra, 'statistik:segment');
if (!idxEntry || idxEntry.indeksvaerdi <= 0) {
  throw new Error('Loenudvikling kan ikke beregnes: mangler indeks for segment');
}
```

Nyt mønster:
```typescript
const idxEntry = findLatestByDateInSortedListV3(periodStarts, segment.fra, 'statistik:segment');
if (!idxEntry || idxEntry.indeksvaerdi <= 0) {
  segments.push({ ...segment, deltaPct: 0 });
  continue;
}
```

#### 1b. Statistik (ASL)

**Fil:** `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts`, ASL-grenen i `buildLoenudviklingFromStatistikV3`

**Rettelse af basis-år-kast (~linje 594):**

Nuværende:
```typescript
if (typeof baseIdx !== 'number' || baseIdx <= 0) {
  throw new Error('Loenudvikling kan ikke beregnes: mangler ASL basisindeks');
}
```

Nyt mønster — identisk med ILON/SBLON: returnér alle tafRanges med `deltaPct = 0`.

**Rettelse af stille filtrering af segment-år (~linje 599):**

Nuværende:
```typescript
if (typeof idx !== 'number' || idx <= 0) return null; // segmentet forsvinder
```

Nyt mønster:
```typescript
if (typeof idx !== 'number' || idx <= 0) {
  return { fra: segment.fra, til: segment.til, deltaPct: 0 };
}
```

**Vigtig forskel:** Det nuværende mønster **filtrerer segmentet væk** — perioden indgår slet ikke i beregningen. Det nye mønster **inkluderer segmentet med 0 % regulering**. Forskellen er, at den beregnede indkomst for perioden stadig medregnes med den uregulerede løn (korrekt), i stedet for at perioden ignoreres (forkert — giver systematisk for lavt TAF-beløb).

#### 1c. KRL

**Fil:** `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts`, funktion `buildLoenudviklingFromKRLV3`

Identisk mønster som statistik (ILON/SBLON):

1. `baseEntry` undefined (~linje 683) → returnér alle segmenter med `deltaPct = 0`
2. `idxEntry` undefined i segment-loop (~linje 697) → `deltaPct = 0`, `continue`

#### 1d. Overenskomst (privat)

**Fil:** `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts`, privat-grenen i `buildLoenudviklingFromOverenskomstV3`

**Rettelse af basissats-kast (~linje 896):**

Nuværende:
```typescript
if (!baseSats || typeof baseSats.grundloen !== 'number') {
  throw new Error('Loenudvikling kan ikke beregnes: basissats mangler');
}
```

Nyt mønster — identisk med statistik: returnér alle segmenter med `deltaPct = 0`.

**Rettelse af segment-sats-kast (~linje 949):**

Nuværende:
```typescript
if (!sats || typeof sats.grundloen !== 'number') {
  throw new Error('Loenudvikling kan ikke beregnes: mangler sats for segment');
}
```

Nyt mønster:
```typescript
if (!sats || typeof sats.grundloen !== 'number') {
  segments.push({ ...segment, deltaPct: 0 });
  continue;
}
```

**Bemærk:** `computePackageValue` kan ikke kaldes uden `sats.grundloen`, så segmentet skal have `deltaPct` sat direkte til 0 uden at beregne `packageValue`. Springet med `continue` sikrer dette.

#### 1e. Overenskomst (offentlig)

**Fil:** `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts`, offentlig-grenen i `buildLoenudviklingFromOverenskomstV3`

**Rettelse af `assertOffentligReguleringsDatoGyldig` for reguleringsdato (~linje 768):**

Nuværende:
```typescript
assertOffentligReguleringsDatoGyldig(reguleringsdatoDa);
```

Nyt mønster:
```typescript
if (!isOffentligReguleringsDatoGyldig(reguleringsdatoDa)) {
  // Reguleringsdato før offentlig data → alle segmenter uregulerede
  const segments: LoenreguleringsSegmentV3[] = [];
  for (const range of konsolideret.tafRanges) {
    for (const segment of buildSegmentsFromStartDatesV3(range, new Set())) {
      segments.push({ ...segment, deltaPct: 0 });
    }
  }
  return segments;
}
```

Det kan kræve at `assertOffentligReguleringsDatoGyldig` udstilles som en prædikat-funktion `isOffentligReguleringsDatoGyldig` (returnerer boolean i stedet for at kaste), eller at prædikat-logikken inlines. Valget afhænger af om assertionen bruges andre steder — tjek alle call-sites.

**Rettelse af `assertOffentligReguleringsDatoGyldig` for range.fra (~linje 810):**

Nuværende:
```typescript
assertOffentligReguleringsDatoGyldig(fraDa);
```

Nyt mønster: Fjern assertionen. I stedet håndteres manglende data per segment (se nedenfor).

**Rettelse af basissats-kast (~linje 788):**

Identisk med privat overenskomst: `baseResult` undefined → returnér alle ranges med `deltaPct = 0`.

**Rettelse af segment-sats-kast (~linje 851):**

Nuværende:
```typescript
if (!segmentResult) {
  throw new Error('Loenudvikling kan ikke beregnes: mangler sats for segment');
}
```

Nyt mønster:
```typescript
if (!segmentResult) {
  segments.push({ ...segment, deltaPct: 0 });
  continue;
}
```

**Opmærksomhedspunkt:** For offentlig overenskomst returnerer `getOffentligLoenForDato` undefined for datoer *efter* seneste reguleringsperiode (i modsætning til privat overenskomst/statistik/KRL hvor `findLatestByDateInSortedListV3` returnerer seneste entry ≤ dato). Det betyder, at slutdato-scenariet for offentlig overenskomst automatisk håndteres af denne rettelse: segmenter efter seneste data får `deltaPct = 0`.

#### 1f. "Ingen segmenter"-invariant-guards

Følgende kast i bunden af hver strategifunktion bevares som invariant-guards:

- `'ingen statistiksegmenter'` (~linje 652)
- `'ingen KRL segmenter'` (~linje 706)
- `'ingen overenskomstsegmenter'` (~linje 884, 975)
- `'ingen ASL segmenter'` (~linje 604)

Med de ovenstående rettelser bør de aldrig kunne udløses (fordi alle segmenter nu produceres med `deltaPct = 0` i stedet for at blive fjernet/kastet), men de tjener som sikkerhedsnet for fremtidige invariantbrud.

#### 1g. Slutdato-semantik: "frys sidst kendte kurs"

For **statistik (ILON/SBLON), KRL og privat overenskomst** returnerer data-laget automatisk seneste entry ≤ dato via `findLatestByDateInSortedListV3` / `getEffektiveSatserForDato`. Det betyder, at segmenter efter seneste datapunkt stille bruger den senest kendte kurs. Denne adfærd er korrekt og ønskelig — den implementerer "ingen yderligere regulering efter sidste dato" implicit.

For **offentlig overenskomst** returnerer `getOffentligLoenForDato` undefined for datoer efter seneste data. Rettelsen i 1e giver `deltaPct = 0` for disse segmenter. Effekten er den samme: ingen regulering efter seneste dato.

For **ASL** oprettes segmenter per kalenderår. År uden `aarsloenMax`-indgang får `deltaPct = 0` (rettelsen i 1b). Effekten er den samme.

**Dokumentation:** Tilføj en kommentar i hver strategifunktion der ekspliciterer "frys sidst kendte kurs"-semantikken:

```typescript
// Slutdato-semantik: Segmenter efter seneste tilgængelige datapunkt bruger
// senest kendte kurs (findLatestByDateInSortedListV3 returnerer seneste ≤ dato).
// Effekt: ingen yderligere regulering efter seneste dataperiode.
```

---

### Stadie 2: Kobl settings til validator — gate PDF-generering

**Princip:** Validatoren (`erstatningsopgoerelseValidator.ts`) skal tjekke om reguleringsdækning er tilstrækkelig og, styret af AppSettings, blokere for PDF-generering. Debug-modellen forbliver en diagnostisk visning.

**Kontraktovervejelse:** AppSettings-kontrakten siger *"PDF-laget læser aldrig fra AppSettings"*. Validatoren er **ikke** PDF-laget — den er et selvstændigt lag der gater formularindhold. At lade validatoren læse AppSettings er i overensstemmelse med kontrakten.

#### 2a. Ny funktion: `validateReguleringsDaekning`

**Fil:** `src/validators/erstatningsopgoerelseValidator.ts`

Tilføj en ny valideringsfunktion der kaldes fra `validateTAF()`:

**Input:**
- `values: ErstatningsopgoerelseValues`
- `skadesdato: ISODateString | undefined`
- `appSettings: AppSettings`

**Logik for hvert aktivt ansaettelsesforhold med `loenudviklingBasis !== 'Ingen'` og `!== 'Manuelt angivet'`:**

1. Bestem `reguleringsRange` via `getReguleringsDatoIntervalFor*` (genbrug den logik der allerede eksisterer i debug-modellen linje 2693–2724):
   - `'Overenskomst'` → `getReguleringsDatoIntervalForOverenskomst(overenskomstId)`
   - `'Statistik'` → `getReguleringsDatoIntervalForStatistikModel(statistikModel)`
   - `'KRL satstabel'` → `getReguleringsDatoIntervalForKRL(krlSatstabelId)`

2. Bestem `reguleringsdato`:
   - `beregnesUdFra !== 'Beregningsperiode'` → `getAngivetLoenOpreguleresFraDato(values) ?? skadesdato`
   - `beregnesUdFra === 'Beregningsperiode'` → `saerligFraDatoRegulering ?? skadesdato`

3. Bestem TAF boundary dates (`tafStartIso`, `tafEndIso`) via `resolveTafBoundaryDatesInSkadetPeriode(values)`

4. Tjek (kun når `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden === false`):
   - **Reguleringsdato-dækning:** `reguleringsdato < reguleringsRange.min` → valideringsfejl
   - **Start-dækning:** `reguleringsRange.min > tafStartIso` → valideringsfejl
   - **Slut-dækning:** `reguleringsRange.max < tafEndIso`:
     - Beregn `maanederSidenUdloeb` (som debug-modellen gør, linje 2758)
     - Hvis `maanederSidenUdloeb >= allowReguleringMedUdloebMedMaaneder` → valideringsfejl

5. Valideringsfejlen skal have en klar besked, fx: *"Reguleringssatser for [navn] dækker ikke hele TAF-perioden (fra [min] til [max]). Tillad ufuldstændig dækning i programindstillinger for at gennemføre beregningen."*

#### 2b. Manuel strategi — særhåndtering

For `loenudviklingBasis === 'Manuelt angivet'`: Brug `getRangeForManualReguleringDebug` (allerede i debug-modellen, linje 2721) til at bestemme `reguleringsRange` og kør samme dækningstjek. Alternativt: undlad dækningstjek for manuel strategi, da brugeren selv styrer alle datapunkter.

**Anbefaling:** Undlad dækningstjek for manuel. Brugeren har fuld kontrol over manuelle rækker og bør ikke blokeres af en automatisk validering.

#### 2c. Tilgængeliggør AppSettings for validatoren

**Problem:** `validateTAF` tager pt. kun `ErstatningsopgoerelseValues`. AppSettings skal tilføjes som parameter.

**Rettelse:**
- Tilføj `appSettings: AppSettings` som parameter til `validateTAF` (eller til den ydre valideringsfunktion)
- Alle caller-sites henter allerede AppSettings via `useAppSettings()` og kan sende dem videre
- **Tjek:** Find alle steder der kalder `validateTAF` og opdater dem. Det er typisk React-hooks eller form-submit-logik

#### 2d. Forbind validering til PDF-knap

**Nuværende adfærd:** PDF-knappen disables baseret på validatorens resultat (standard Mineo-mønster).

**Ingen yderligere ændring nødvendig** — når valideringsfejlen tilføjes, vil PDF-knappen automatisk disables.

**Effekt:** Når `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden === true`, producerer validatoren **ingen fejl** for manglende dækning → PDF-knappen forbliver aktiv → beregningslogikken (Stadie 1) håndterer manglende satser gracefully med `deltaPct = 0`.

---

### Stadie 3: Ryd op i catch-blok og dead guards

#### 3a. catch-blokken i `buildLoenudviklingModelV3` (~linje 1167–1171)

```typescript
} catch (error) {
  if (values.beregnesUdFra !== 'Beregningsperiode' || !(error instanceof InkonsistenteLoenudviklingsindstillingerError)) {
    throw error;
  }
}
```

**Status efter Stadie 1:** De "mangler satser"-kast er elimineret. Denne catch fanger stadig kun `InkonsistenteLoenudviklingsindstillingerError` for beregningsperiode-stien og re-thrower alt andet. Det er korrekt adfærd — den tillader fallback til perAnsaettelse-stien.

**Rettelse:** Tilføj en kommentar der dokumenterer hvad catch'en gør:

```typescript
// Catch fanger KUN InkonsistenteLoenudviklingsindstillingerError for Beregningsperiode:
// Når flere ansaettelsesforhold har forskellige reguleringsstrategier, falder
// logikken ned i perAnsaettelse-stien nedenfor (hvert ansaettelsesforhold
// behandles individuelt). Alle andre fejl er invariantbrud og skal propagere.
```

#### 3b. Dead guard i `tafNettoBeregning.ts` (~linje 90–91)

```typescript
if (loenudvikling.loenudviklingTotal.status !== 'ok') {
  throw new Error('Loenudvikling kan ikke beregnes');
}
```

**Status efter Stadie 1:** `buildLoenudviklingModelV3` returnerer nu altid `asCalculable(totalOre)` med status `'ok'`. Guarden er dead code.

**Rettelse:** Behold som defensiv guard, men tilføj kommentar:

```typescript
// Defensiv guard: buildLoenudviklingModelV3 returnerer altid status 'ok'
// (manglende satser giver deltaPct = 0, ikke 'not_calculable').
// Guarden bevares som sikkerhedsnet mod fremtidige invariantbrud.
```

#### 3c. perAnsaettelse reduce-throw (~linje 1225–1228)

```typescript
if (entry.loenudviklingTotal.status !== 'ok') {
  throw new Error('Loenudvikling kan ikke beregnes for den valgte opsætning.');
}
```

**Status efter Stadie 1:** Alle perAnsaettelse-entries vil have `status === 'ok'`. Guarden er dead code.

**Rettelse:** Behold som defensiv guard. Overvej at berige fejlbeskeden med ansaettelsesforholdets navn for fremtidige invariantbrud.

---

### Stadie 4: Forbedre fejlhåndtering i PDF- og canonical-stien

**Formål:** Selvom Stadie 1 eliminerer kast for manglende satser, kan der stadig opstå uventede fejl. Stien bør have informative fejlbeskeder.

#### 4a. PDF-generering

**Nuværende:** PDF-genereringsstien (identificér det præcise call-site — typisk i `erstatningsopgoerelsePdf.ts` eller `pdfService.ts`) har enten ingen try-catch eller en generisk fejlbesked.

**Rettelse:** Wrap `buildErstatningsopgoerelsePdfModel` (eller det kald der trigger beregningen) i en try-catch med en brugervenlig fejlbesked:

```typescript
try {
  const model = buildErstatningsopgoerelsePdfModel(values, stamdata);
  // ...
} catch (error) {
  const message = error instanceof Error ? error.message : 'Ukendt fejl';
  // Returnér brugervenlig fejl — vis ikke interne fejlbeskeder direkte
  throw new Error(`PDF kan ikke genereres: ${message}`);
}
```

#### 4b. `eoCanonicalOutput.ts`

**Nuværende:** Ingen try-catch omkring `computeTafNettoBeregning`-kaldet.

**Rettelse:** Tilføj try-catch med klar fejlbesked. Alternativt: brug `tryCompute`-mønstret (som aggregation-pipelinen gør) og returnér et `not_calculable`-resultat.

---

### Stadie 5: Konsolider reguleringsdekning-logik (valgfrit, anbefalet)

**Problem:** Debug-modellen (linje 2693–2770) og den nye validator-logik (Stadie 2a) bruger begge `getReguleringsDatoIntervalFor*`-funktionerne med næsten identisk logik til at bestemme reguleringsrange og tjekke dækning.

#### 5a. Ekstrahér fælles hjælpefunktion

**Ny fil:** `src/domain/erstatningsopgoerelse/reguleringsDaekning.ts`

```typescript
type ReguleringsDaekningsResultat = {
  harReguleringsdatoDaekning: boolean;
  harStartDaekning: boolean;
  harSlutDaekning: boolean;
  maanederSidenUdloeb: number | null;
  reguleringsRange: {
    min: ISODateString | undefined;
    max: ISODateString | undefined;
  };
};

function checkReguleringsDaekning(
  loenudviklingBasis: string,
  ansaettelsesforhold: LoenindkomstAnsaettelsesforhold,
  reguleringsdato: ISODateString | undefined,
  tafStartIso: ISODateString | undefined,
  tafEndIso: ISODateString | undefined
): ReguleringsDaekningsResultat;
```

Lad både debug-modellen og validatoren konsumere denne funktion.

#### 5b. `findLatestByDateInSortedListV3` vs `getSatserForDatoFromList`

`findLatestByDateInSortedListV3` i `eoPdfLoenudvikling.ts` og `getSatserForDatoFromList` i `overenskomstRates.ts` implementerer samme "find nyeste entry ≤ dato"-mønster med forskellige typer (ISO vs Danish) og sorteringsretning.

**Anbefaling:** Dokumentér at de to funktioner er bevidst separate (de opererer i forskellige domæner). Konsolidering ville skabe mere kompleksitet end den fjerner. Tilføj en kommentar i `findLatestByDateInSortedListV3` der refererer til `getSatserForDatoFromList` og forklarer forskellen.

---

## 4. Afhængigheder og rækkefølge

```
Stadie 1 (beregningslogik) ──────────────────► Stadie 3 (cleanup)
           │                                         │
           │                                         ▼
           ├──────────────────────► Stadie 4 (PDF fejlhåndtering)
           │
           └──────────────────────► Slutdato-dokumentation (del af Stadie 1g)

Stadie 2 (validator) ────────────── uafhængig af Stadie 1, kan parallelliseres

Stadie 5 (konsolidering) ────────── efter Stadie 1 + 2
```

**Kritisk sti:** Stadie 1 eliminerer crash-risikoen. Stadie 2 giver brugeren mulighed for at beskytte sig. De to kan udvikles parallelt.

Stadie 3, 4 og 5 er oprydning og forbedring og kan udføres efter Stadie 1+2.

---

## 5. Samlet fil-impact

| Fil | Ændringer | Stadie |
|-----|-----------|--------|
| `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts` | Erstat kast med `deltaPct = 0`-fallbacks i 5 strategier + kommentarer | 1, 3 |
| `src/validators/erstatningsopgoerelseValidator.ts` | Tilføj `validateReguleringsDaekning`, accepter `appSettings`-parameter | 2 |
| `src/domain/erstatningsopgoerelse/tafNettoBeregning.ts` | Tilføj kommentarer på dead guard | 3 |
| `src/domain/erstatningsopgoerelse/eoCanonicalOutput.ts` | Tilføj fejlhåndtering | 4 |
| PDF-genererings-call-site (identificér præcist) | Berig fejlbesked | 4 |
| Ny: `src/domain/erstatningsopgoerelse/reguleringsDaekning.ts` | Fælles dæknings-check (valgfrit) | 5 |
| Caller-sites for `validateTAF` (React-hooks/form) | Send `appSettings` videre | 2 |
| `src/domain/debug/eoDebugErstatningsopgoerelseModel.ts` | Brug konsolideret dæknings-check (valgfrit) | 5 |

---

## 6. Testplan

### Stadie 1 — Tests for beregningslogik

**Ny testfil:** `src/__tests__/domain/erstatningsopgoerelse/eoPdfLoenudviklingMissingRates.test.ts`

Brug eksisterende testmønstre: `makeValues()`, `toISODateString()`, `asAmountValue()`.

#### For hver strategi (statistik-ILON, statistik-SBLON, statistik-ASL, KRL, overenskomst-privat, overenskomst-offentlig):

**Test 1 — Reguleringsdato og TAF-start begge før alle data:**
- Input: reguleringsdato = 2000-01-01, TAF 2000-01-01 → 2006-01-01
- Forventet: alle segmenter har `deltaPct = 0`, ingen kast, `loenudviklingTotal.status === 'ok'`
- Forventet: `loenudviklingTotal.value` svarer til basislønnen × antal dage/måneder (ureguleret)

**Test 2 — TAF strækker ind i dækket periode (delvis dækning):**
- Input: reguleringsdato = 2000-01-01, TAF 2000-01-01 → 2025-06-01
- Forventet: alle segmenter `deltaPct = 0` (fordi baseEntry mangler)
- Ingen kast

**Test 3 — TAF slutter efter seneste data (slutdato-scenarie):**
- Input: reguleringsdato = 2020-01-01, TAF 2020-01-01 → 2030-01-01
- Forventet: segmenter efter seneste data bruger senest kendte kurs (frys-semantik) eller `deltaPct = 0` (offentlig + ASL)
- Ingen kast

**Test 4 — Offentlig overenskomst: TAF-start < OFFENTLIG_REGULERING_MIN_DATO:**
- Input: reguleringsdato = 2010-06-01, TAF 2010-06-01 → 2015-01-01
- Forventet: ingen kast, segmenter med `deltaPct = 0` for perioden uden data

**Test 5 — Angivet dagsløn + tidlig reguleringsdato:**
- Input: beregnesUdFra = 'Angivet dagsløn', reguleringsdato = skadesdato = 2002-01-01
- Forventet: `deltaPct = 0` for alle segmenter, korrekt `dagsloenOre`

**Test 6 — Angivet månedsløn + tidlig reguleringsdato:**
- Identisk med test 5, men med månedsløn

**Test 7 — Beregningsperiode + tidlig reguleringsdato:**
- Input: beregnesUdFra = 'Beregningsperiode', saerligFraDatoRegulering tidlig dato
- Forventet: `deltaPct = 0` for segmenter uden data

**Test 8 — perAnsaettelse-sti (inkonsistente reguleringsstrategier):**
- Input: beregnesUdFra = 'Beregningsperiode', 2 ansaettelsesforhold med forskellige strategier, ét med tidlig dato
- Forventet: fallback til perAnsaettelse, manglende satser håndteret med `deltaPct = 0`

**Test 9 — Slutdato: ASL med manglende fremtidige år:**
- Input: TAF der slutter i et år uden `aarsloenMax`
- Forventet: segmentet inkluderes med `deltaPct = 0` (ikke filtreret væk)

### Stadie 2 — Tests for validator

**Fil:** `src/__tests__/validators/erstatningsopgoerelseValidator.test.ts` (udvides) eller ny fil

**Test 1 — Default settings (allow=false), TAF-start før dækning:**
- Forventet: valideringsfejl

**Test 2 — Default settings (allow=false), TAF-slut efter dækning + > grace period:**
- Forventet: valideringsfejl

**Test 3 — Default settings (allow=false), TAF-slut efter dækning + < grace period:**
- Forventet: ingen fejl (inden for grace period)

**Test 4 — allow=true, TAF-start før dækning:**
- Forventet: ingen valideringsfejl

**Test 5 — allow=true, TAF-slut efter dækning:**
- Forventet: ingen valideringsfejl

**Test 6 — Strategi = 'Ingen':**
- Forventet: ingen dækningstjek uanset settings

**Test 7 — Strategi = 'Manuelt angivet':**
- Forventet: ingen dækningstjek (bruger styrer selv)

**Test 8 — Flere ansaettelsesforhold, ét med manglende dækning:**
- Forventet: fejl kun for det ansaettelsesforhold der mangler dækning

---

## 7. Risici og designbeslutninger

### "Simpel" vs "sofistikeret" fallback for manglende baseEntry

**Valg:** Simpel variant — alle segmenter `deltaPct = 0` når baseEntry mangler.

**Alternativ:** Brug første tilgængelige datapunkt som implicit base og beregn relative ændringer derfra. Ville give mere præcise resultater for sager der *delvist* dækkes.

**Begrundelse for simpel variant:**
- Matcher brugerens beskrivelse: "den indtastede løn bruges ureguleret"
- Lettere at verificere og teste
- Ingen tvetydighed om hvad "base" er
- Sofistikeret variant kan tilføjes som en fremtidig forbedring

### Kontraktoverhold

Løsningen overholder `app-settings.md`: beregningslaget (PDF) kender ikke til settings; validatoren gater; beregningslaget håndterer manglende data uanset settings.

### AGENTS.md "fail-closed"

`deltaPct = 0` er **ikke** et gæt — det er en eksplicit, defineret semantik: "ingen regulering for perioden." Det er fail-closed i den forstand at vi ikke opdigter en regulering. Det er den korrekte semantik for scenariet.

### Offentlig overenskomst vs øvrige strategier

For privat overenskomst/statistik/KRL returnerer data-laget automatisk "seneste sats ≤ dato" → slutdato-scenariet er gratis.
For offentlig overenskomst returnerer `getOffentligLoenForDato` undefined → segmenter efter seneste data får `deltaPct = 0`.
Effekten er den samme ("ingen yderligere regulering"), men mekanismen er forskellig. Dokumentér dette.

### Integration med debug-model

Debug-modellen fortsætter med at vise 'warning' eller 'error' baseret på settings. Denne adfærd er uændret. Validatoren tilføjer en *ny* fejlkilde der gater PDF-generering. De to systemer er uafhængige men konsistente.

---

## 8. Verificering efter implementering

Gennemgå følgende scenarier manuelt i applikationen efter implementering:

1. **Ny sag med tidlig skadesdato (fx 2005)**, overenskomst-regulering, TAF-periode 2005–2010:
   - Default settings → PDF-knap disabled, valideringsfejl vist
   - `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden = true` → PDF genereres, løn ureguleret

2. **Sag med TAF der slutter 8 måneder efter seneste overenskomstdata:**
   - `allowReguleringMedUdloebMedMaaneder = 6` (default) → valideringsfejl
   - `allowReguleringMedUdloebMedMaaneder = 12` → ingen fejl, beregning gennemføres

3. **Sag med offentlig overenskomst og TAF-start < 01-01-2012:**
   - Default settings → valideringsfejl
   - Tilladt → beregning med `deltaPct = 0` for tidlige segmenter

4. **Sag med ASL og TAF der dækker år uden data:**
   - Verificér at segmenter inkluderes (ikke filtreres væk)
   - Sammenlign TAF-beløb med og uden manglende år — beløbet bør være højere med fix'et (fordi perioden nu medregnes)

5. **Alle tre løngrundlag (beregningsperiode, angivet dagsløn, angivet månedsløn)** med tidlig reguleringsdato — verificér at ingen kaster.
