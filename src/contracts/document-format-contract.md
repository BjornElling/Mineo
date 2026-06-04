# Mineo – dokumentformat-kontrakt

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Gælder for:** Alle dokument-downloads i Mineo-hovedappen.
**Senest verificeret mod kode:** 2026-06-04

Denne kontrakt fastlægger reglerne for valg mellem PDF- og Word-downloads.

---

## 1. Omfang

1. Mineo-hovedappen kan hente dokumenter som `PDF` eller `Word`.
2. MinProcesrente er bevidst PDF-only og er ikke omfattet af Word-routing.
3. `.docx` er dødt output. Der findes ingen Word-import, Word-sync eller Word-parsing tilbage til Mineo.

## 2. Indstilling

1. Formatet styres af den device-lokale app-indstilling `documentDownloadFormat`.
2. Gyldige værdier er kun `pdf` og `word`.
3. Default er `pdf`.
4. Indstillingen må aldrig gemmes i `.eo`, fordi den ikke er sagsdata.

## 3. Routing

1. Download-gates og autoritative projektioner er identiske for PDF og Word.
2. Formatvalget sker først efter, at download-gaten har godkendt dokumentet.
3. Word må aldrig bruge egne beregninger, Word-formler eller feltkoder til tal.
4. Runtime-fejl under dokumentgenerering routes via `error-debug-contract.md` som systemfejl med området `document`.

## 4. Output

1. PDF og Word skal bygge på samme generator-input og samme toggle-guards.
2. Word skal være en ægte `.docx`-fil.
3. Word-output må ikke indeholde eksterne relationer, remote templates, font-links eller anden netværksafhængighed.
4. Filnavnsreglen er fælles for begge formater; kun endelsen adskiller sig.

## 5. Brugervendt signal

1. Tekst-knapper der nævner format skal vise det aktive format.
2. Nøgne download-ikoner skal have tooltip eller aria-label, der nævner det aktive format.
