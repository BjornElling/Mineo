# Mineo – dokumentformat-kontrakt

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Gælder for:** Alle dokument-downloads i Mineo-hovedappen.
**Senest verificeret mod kode:** 2026-07-11

Denne kontrakt fastlægger reglerne for valg mellem PDF- og Word-downloads. Den er
**kanal-vælgeren** der ligger *over* `document-output-contract.md`: denne kontrakt bestemmer
*hvilken* kanal (PDF/Word) der vælges, mens `document-output-contract.md` ejer den kanal-neutrale
data/gate/komposition og writer-API'et, begge kanaler deler.

---

## 1. Omfang

1. Mineo-hovedappen kan hente dokumenter som `PDF` eller `Word`.
2. MinProcesrente er bevidst PDF-only og er ikke omfattet af Word-routing.
3. `.docx` er dødt output. Der findes ingen Word-import, Word-sync eller Word-parsing tilbage til Mineo.

## 2. Indstilling

1. Formatet styres af den device-lokale app-indstilling `documentDownloadFormat`. Selve indstillingen (schema, persistens, default) ejes af `app-settings.md`; denne kontrakt ejer kun routing-konsekvenserne af værdien.
2. Gyldige værdier er kun `pdf` og `word`. Værdimængden defineres af `documentDownloadFormatSchema` i `src/document/documentFormat.ts`.
3. Default er `pdf` (`DEFAULT_DOCUMENT_DOWNLOAD_FORMAT`).
4. Indstillingen må aldrig gemmes i `.eo`, fordi den ikke er sagsdata.

## 3. Routing

1. Download-gates og autoritative projektioner er identiske for PDF og Word.
2. Formatvalget sker først efter, at download-gaten har godkendt dokumentet.
3. Word må aldrig bruge egne beregninger, Word-formler eller feltkoder til tal.
4. Runtime-fejl under dokumentgenerering routes via `error-contract.md` som systemfejl med området `document`.
5. Format-routingen ejes af **dokumentmiljøet**, ikke af et servicelag: `resolveFormat` på `DocumentExecutionEnvironment` (`src/document/definition/documentExecutionEnvironment.ts`) oversætter settings-snapshottet til formatet, og `environment.createSession(format)` opretter en immutable `DocumentGenerationSession` med den tilsvarende interne kanalfabrik (`createPdfChannelWriter` eller `createDocxWriter`). Hovedappens binding ligger i `src/document/runtime/mineoDocumentEnvironment.ts`; livscyklussen kalder den ét sted (`documentLifecycle.ts`). Generatorerne bygger kun en kanalneutral `DocumentModel`; sessionen renderer modellen, dokument-kernen importerer aldrig en kanal statisk, og generatorer må aldrig forgrene på formatet selv.
6. Sessionsdata må ikke ligge i modul-global state. To samtidige genereringer skal kunne afvikles uafhængigt, også hen over `await`.

## 4. Output

1. PDF og Word skal bygge på samme generator-input og samme toggle-guards.
2. Word skal være en ægte `.docx`-fil.
3. Word-output må ikke indeholde eksterne relationer, remote templates, font-links eller anden netværksafhængighed.
4. Filnavnsreglen er fælles for begge formater; kun endelsen adskiller sig.
5. `defineDocument(...)` resolver den endelige filendelse fra den eksplicitte session og
   returnerer et `DocumentArtifact` (`blob` + filnavn). Writeren returnerer kun bytes via
   `build()` og må ikke selv starte download. Service-laget ejer den eneste download-side-effect.

## 5. Brugervendt signal

1. Tekst-knapper der nævner format skal vise det aktive format.
2. Nøgne download-ikoner skal have tooltip eller aria-label, der nævner det aktive format.
