# Brugerblik — status

Fremdrift for UI/UX-fornufts- og edge case-gennemgangen. Se `.claude/skills/brugerblik/SKILL.md`.

- **Næste flade:** Om (`/mineo`)
- **Næste fund-ID:** BB-011
- **Senest opdateret:** 2026-08-16 (brugerens afgørelser af alle ti Stamdata-fund skrevet ind)

## Flader

Rækkefølgen er fastlagt i `.claude/skills/brugerblik/references/flader.md` (små flader først).
Status: `Ikke startet` · `I gang` · `Gennemgået` · `Afventer bruger`.

| # | Flade | Status | Fund | Dokument |
|---|---|---|---|---|
| 1 | Stamdata | Gennemgået | 10 (BB-001–BB-010) | [stamdata.md](stamdata.md) |
| 2 | Om | Ikke startet | — | — |
| 3 | Indstillinger | Ikke startet | — | — |
| 4 | Satser | Ikke startet | — | — |
| 5 | MinProcesrente | Ikke startet | — | — |
| 6 | Global shell | Ikke startet | — | — |
| 7 | Varige mén | Ikke startet | — | — |
| 8 | Renteberegning | Ikke startet | — | — |
| 9 | Årslønsberegning | Ikke startet | — | — |
| 10 | Forsørgertab | Ikke startet | — | — |
| 11 | Erhvervsevnetab | Ikke startet | — | — |
| 12 | Erstatningsopgørelse | Ikke startet | — | — |

## Fund der afventer brugerens beslutning

Ingen. Alle ti Stamdata-fund er afgjort 2026-08-16; afgørelserne står i sin helhed i
[stamdata.md](stamdata.md) under det enkelte fund.

| ID | Afgørelse | Skal rettes |
|---|---|---|
| BB-001 | Afvist — skiftet må ske tavst; brugeren orienteres via den afledte datofejl | Nej |
| BB-002 | Accepteret — al tekst om datoen følger skadestypens navngivning | **Ja** |
| BB-003 | Afvist — tastning tolker ikke på 3. ciffer; paste må gerne være mere tolerant | Nej |
| BB-004 | Blokeringen er allerede indført og målt; initialfelterne skal ned på 6 tegn | **Ja** (ny længdekategori) |
| BB-005 | Afvist — ingen nedre aldersgrænse | Nej |
| BB-006 | Afvist — manglende indtastninger meldes dér, hvor de bruges | Nej |
| BB-007 | Accepteret — normalisering af indsat tekst | **Ja** |
| BB-008 | Afvist | Nej |
| BB-009 | Afvist — én gennemgående regel for tocifrede årstal | Nej |
| BB-010 | Afvist for markeringen; ordlyden skal være feltspecifik | **Ja** (ordlyd) |

Tre rettelser er dermed klar til gennemførelse: BB-002 + BB-010's ordlyd (samme kodeændring),
BB-004's nye længdekategori (6 tegn til initialfelterne) og BB-007's normalisering af indsat tekst.
Implementeringsforslag står under hvert fund; ordlyden i BB-002/BB-010 forelægges, før den skrives ind.

## Åbne spørgsmål

**Ingen.** De tre spørgsmål, brugerens første svarrunde rejste, blev afgjort samme dag: skift af
skadestype må ske tavst (den afledte datofejl bærer orienteringen), initialfelterne får 6 tegn, og
læsbarhedsspørgsmålet bortfalder på Stamdata og efterprøves i stedet, hvor et 60-tegns-felt faktisk er
smalt (M-04).

## Tværgående mønstre

Syv mønstre er registreret i [TVAERGAAENDE.md](TVAERGAAENDE.md) — M-01 til M-07. Alle er fundet på
Stamdata og har kandidatsteder på senere flader. **Fire er omskrevet 2026-08-16** efter brugerens
afgørelser: M-01 (skærpet til beregnings- og grænsevirkning frem for navneskift), M-03 (forskellen
mellem tastning og indsættelse er tilsigtet), M-04 (blokeringen er reglen og er indført; tilbage står
grænsens rimelighed og læsbarheden) og M-07 (begge felter markeres fortsat; kravet ligger nu på de to
teksters ordlyd). M-05's aldersdel er lukket. Læs mønstrene i deres nye form, før næste flade
gennemgås.

## Noter til rækkefølgen

- Ingen justeringer. Stamdata blev taget først efter brugerens anvisning; den er også nr. 1 i den
  planlagte rækkefølge.
