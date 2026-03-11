# Implementeringsplan: Manglende reguleringssatser for TAF-perioden

> Endelig, sammenhængende implementeringsplan (opdateret med beslutninger fra review og valg af løsning B).

---

## 1. Formål

Sikre at beregning af lønudvikling i TAF aldrig fejler pga. manglende reguleringssatser, samtidig med at brugerens settings fortsat styrer, om manglende dækning skal blokere PDF-download.

Prioriteter:
1. korrekthed
2. robusthed
3. fail-closed ved ugyldige data
4. minimal ændringsflade

---

## 2. Endelige beslutninger

### 2.1 BaseEntry-semantik: valgt løsning B

Ved manglende baseEntry på reguleringsdatoen anvendes **løsning B**:

- Segmenter før første tilgængelige datapunkt: `deltaPct = 0`
- Segmenter fra og med første tilgængelige datapunkt: reguleres relativt til første tilgængelige datapunkt (effective base)

Konsekvens:
- "Ureguleret indtil data findes" opfyldes præcist
- Regulering genoptages automatisk, når data bliver tilgængelige

### 2.2 Gating-arkitektur

PDF-gating forbliver i eksisterende debug-row pipeline (`collectAllDebugRows` -> `errors.length > 0`), ikke i `erstatningsopgoerelseValidator`.

Konsekvens:
- Ingen ændring af `FormValidator<T>`-kontrakten
- Ingen ny settings-parameter i validator-signatur
- AppSettings anvendes fortsat i debug-laget til error/warning-klassificering

### 2.3 Fejlsemantik (fail-closed)

- **Manglende data** (fx ingen entry for dato): fallback er tilladt (`deltaPct = 0`)
- **Ugyldige data** (fx indeks <= 0, NaN, ugyldig grundløn): fortsat `throw` (invariantbrud)

---

## 3. Scope og berørte filer

### Primært
- `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts`

### Sekundært (kommentar/oprydning)
- `src/domain/erstatningsopgoerelse/tafNettoBeregning.ts`

### Test
- Ny/udvidet test for manglende satser i lønudvikling
- Ny/udvidet test for debug-gating (errors vs warnings)

### Ikke i scope
- Signaturændringer i `erstatningsopgoerelseValidator.ts`
- Nye domæne-catches i PDF/canonical-lag

---

## 4. Implementeringsdesign

## 4.1 Fælles helper i lønudvikling

I `eoPdfLoenudvikling.ts` indføres intern helper til konsistent fallback:

- `buildZeroDeltaSegment(segment)`
- evt. lille helper til "effective base" opslag per strategi

Formål:
- undgå duplikeret fallback-logik
- ens semantik på tværs af strategier

## 4.2 Strategi-specifik adfærd

### Statistik (ILON/SBLON)

- Hvis baseEntry på reguleringsdato mangler:
  - find tidligste datapunkt som effective base
  - segmenter før datapunkt -> `deltaPct = 0`
  - segmenter med datapunkt -> regulering relativt til effective base
- Hvis segment-entry mangler -> `deltaPct = 0` for segment
- Hvis entry findes men indeks <= 0 -> `throw`

### Statistik (ASL)

- Effective base = tidligste gyldige år i `aarsloenMax`
- Segment-år uden data -> segment beholdes med `deltaPct = 0` (ikke filtreres væk)
- År med ugyldig værdi (<=0/NaN) -> `throw`

### KRL

- Samme mønster som ILON/SBLON
- Segment uden entry -> `deltaPct = 0`
- Ugyldig entry -> `throw`

### Overenskomst (privat)

- Manglende basissats på reguleringsdato -> effective base = første tilgængelige sats
- Segment uden sats -> `deltaPct = 0`
- Segment med sats -> regulering relativt til effective base
- Ved almindelig løn på helligdage skal Store Bededag-tillæg altid materialiseres som særskilt reguleringsskæring pr. `01-01-2024`, også når næste ordinære overenskomstændring ligger senere
- Ugyldige satsdata/packageValue -> `throw`

### Overenskomst (offentlig)

- Erstat assertion-baseret stop med fallback-venlig grenlogik
- Manglende base på reguleringsdato -> effective base = første tilgængelige offentlige lønresultat
- Segment uden resultat -> `deltaPct = 0`
- Segment med resultat -> regulering relativt til effective base
- Ved almindelig løn på helligdage skal Store Bededag-tillæg altid materialiseres som særskilt reguleringsskæring pr. `01-01-2024`, også når næste ordinære regulering ligger senere
- Ugyldige data -> `throw`

### Manual og Ingen

- Uændret funktionel semantik
- Manual forbliver referenceimplementering for safe fallback-adfærd

## 4.3 Slutdato-semantik

- Strategier med "seneste <= dato" lookup: implicit frys af sidste kendte kurs
- Offentlig/ASL hvor data kan mangle efter slutpunkt: `deltaPct = 0` efter sidste dækkede datapunkt

Effekt i begge tilfælde: ingen yderligere regulering efter sidste tilgængelige data.

---

## 5. Debug-gating og settings

Eksisterende debug-gating beholdes og verificeres:

- `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden = false`
  - manglende dækning klassificeres som `error`
  - PDF-knap blokeres

- `allowReguleringMedOverenskomstDerIkkeDaekkerHelePerioden = true`
  - manglende dækning klassificeres som `warning`
  - PDF-knap er ikke blokeret
  - beregning gennemføres robust via fallback fra stadie 1

Ingen ny validator-wiring implementeres.

---

## 6. Oprydning

### 6.1 Catch i `buildLoenudviklingModelV3`

Behold eksisterende catch-semantik (kun inkonsistente indstillinger i Beregningsperiode-flow) og tilføj tydelig kommentar om fallback til per-ansættelse-sti.

### 6.2 Defensive guards

Behold eksisterende guards i:
- `tafNettoBeregning.ts`
- per-ansættelse summering i lønudvikling

Tilføj kommentar om at de er defensive invariant-guards.

---

## 7. Fejlhåndtering

- Domænelag fortsætter med at kaste ved invariantbrud
- Brugerrettet indpakning af fejl for PDF forbliver i `pdfService`
- Ingen ekstra catch-lag tilføjes i `eoCanonicalOutput`/PDF-modelbygger alene for denne ændring

---

## 8. Testplan (endelig)

## 8.1 Beregningslogik (obligatorisk)

For hver strategi: statistik-ILON, statistik-SBLON, statistik-ASL, KRL, overenskomst-privat, overenskomst-offentlig

1. **Tidlig periode før data + senere dækket periode (variant B)**
   - Forventet: tidlige segmenter `deltaPct = 0`, senere segmenter reguleres

2. **Segment-mangel midt i perioden**
   - Forventet: kun berørte segmenter får `deltaPct = 0`

3. **Periode efter sidste data**
   - Forventet: ingen yderligere regulering (frys/0 afhængig af strategi)

4. **Datakorruption**
   - entry findes men ugyldig (`<=0`, `NaN`) -> `throw`

5. **ASL-år uden data**
   - segment medtages med `deltaPct = 0` (ikke filtreret væk)

6. **Alle tre løngrundlag**
   - Beregningsperiode, angivet dagsløn, angivet månedsløn

7. **Per-ansættelse fallback-sti**
   - inkonsistente strategier i beregningsperiode

## 8.2 Debug-gating (obligatorisk)

1. `allow=false` + manglende dækning -> `error` og blokering
2. `allow=true` + manglende dækning -> `warning` og ingen blokering
3. Grænsetest for udløbsmåneder (`maanederSidenUdloeb` ved/omkring grænse)
4. Ingen TAF-boundaries -> ingen falsk positiv dækningfejl

## 8.3 PDF-service fejlsti

1. Tvungen runtime-fejl i beregning -> `PdfDownloadResult { success: false }`
2. Fejlbesked er forståelig og uden silent failure

---

## 9. Implementeringsrækkefølge

1. Opdater `eoPdfLoenudvikling.ts` (stadie 1)
2. Tilføj/ret tests for manglende satser + variant B
3. Verificér debug-gating via tests
4. Tilføj kommentar-oprydning i dead guards/catch
5. Kør typecheck og relevante tests

---

## 10. Manuelle verifikationsscenarier

1. Tidlig skadesdato (fx 2005), TAF ind i senere år med data
   - `allow=false`: blokering
   - `allow=true`: PDF kan dannes; tidlig del ureguleret, senere del reguleret

2. TAF slutter efter datadækning
   - verificér udløbsmåned-logik i settings

3. Offentlig overenskomst med tidlig TAF-start
   - ingen crash
   - fallback-segmenter med `deltaPct = 0` før data

4. ASL med manglende år
   - periode medtages fortsat

---

## 11. Kvalitetsgate før handoff

Efter kodeændringer:

1. `npm run typecheck`
2. Kør relevante testfiler for:
   - lønudvikling/manglende satser
   - debug-gating
   - pdfService fejlsti
3. Bekræft ingen regressions i eksisterende EO-PDF tests

Stop og afklar ved uforudsete domæneafvigelser.
