# Arkitektur for dokument-output

**Status:** Informativ målarkitektur
**Normative kilder:** `src/contracts/document-output-contract.md`, `critical-action-contract.md` og
`document-format-contract.md`
**Implementeringsplan:** `docs/architecture/draft-commit-greenfield-design.md`

## Overblik

Dokumentflowet har to adskilte dele: trust-kritisk preparation og kanalneutral rendering.

```text
InputReader(revision)
        │
        ▼
typed dokumentdefinition
 dependencies + domæneprojektion + output-invariants
        │
   ┌────┴─────┐
   │ blocked  │ ready
   ▼          ▼
disabled    PreparedDocument<T> + revision
knap           │
               ▼
        documentService
               │
               ▼
        defineDocument(...)
               │
               ▼
 DocumentComposer → immutable DocumentModel
               │
               ▼
 DocumentGenerationSession.render(...)
           ┌───┴───┐
           ▼       ▼
       PDF-target  Word-target
           │       │
           ▼       ▼
          Blob    Blob
```

## Dokumentdefinition og gate

Hvert output har én typed definition af:

- strukturelle feltdependencies,
- domæne-/snapshotprojektion,
- output-specifikke invariants,
- mapping til generatorinput.

Den fælles evaluator resolver dependencies gennem `InputReader`. Rejected, missing, range/bounds og regelissues med
fejlseverity blokerer, når de rammer dokumentets dependencies. Scope er relationen selv: et rækkedokument afhænger af
den konkrete række; et aggregat afhænger af alle inkluderede rækker. Der lagres ikke et manuelt scope på blockers.

Den reaktive knap og click-preflight bruger samme definition. Knappen er synligt nedtonet og funktionelt disabled på
en blokeret afsluttet revision.

## Åben editor og aktivering

Åben draft ændrer ikke visning eller reaktiv gate. Knappen kan derfor være aktiv på baggrund af den seneste gyldige
afsluttede tilstand, mens brugeren redigerer.

Ved aktivering:

1. commit-barrieren settler eventuel åben editor,
2. inputtransaktionen kvitterer,
3. der læses en ny `InputReader`,
4. dokumentdefinitionen evalueres igen,
5. blokering stopper før lazy-load, generator og fil-I/O,
6. kun et revisionsbundet `PreparedDocument<T>` går videre.

Pointer-blur når normalt at gøre knappen disabled før click, men korrektheden afhænger ikke af eventrækkefølgen.
Tastatur/programmatisk aktivering og et allerede leveret click følger samme preflight. Ved et ugyldigt settle fokuseres
feltet og den eksisterende danske advarsel vises kun som sidste sikkerhedsværn.

Efter async lazy-load og umiddelbart før generatoren kontrollerer servicen revisionen igen. En stale preparation
afvises eller genpreflights.

## Domæne- og servicelag

Domænelaget leverer ready input-/snapshotprojektioner. Det genberegner ikke i dokumentlaget.

`documentService` ejer kun serialisering af flowet, lazy-load, render/download og runtimefejl. Det ejer ikke callbacks
med skjult domænepolicy, dependencies eller gates.

Generatorerne under `src/document/generators/` ejer dokumentets semantiske struktur og danske tekst. De modtager
godkendt input og defineres med `defineDocument(...)`.

## Dokumentmodel og kanaler

`DocumentComposer` bygger en immutable `DocumentModel` af den lukkede `DocumentBlock`-union. Generatoren ser ikke
format, sidecursor, dokumentbredde, jsPDF eller Word-objekter.

`DocumentGenerationSession` opretter først kanal-target efter modelbygning og renderer den samme bloksekvens til:

- `createPdfChannelWriter`,
- `createDocxWriter`.

`DocumentWriter` er intern adaptermekanik mellem modelrenderer og kanaler og må ikke importeres af generatorer.

## Tabeller og billeder

Generatorer opretter `TableSpec`; kanal-targetet ejer måling, paginering og konkret tabelrendering. Kanalhandles,
cursor- og Y-metoder findes ikke i generator-/domænelaget.

TAF-grafen kan rasteriseres til PNG ved modelbygning, men placering beskrives semantisk med bredde/aspect ratio og
maksimal højde. Generatoren beregner ikke dokumentbredde eller Y-position.

## Lifecycle

`defineDocument(...)` resolver metadata og kanalneutrale options, komponerer indhold, fryser modellen og sender den til
sessionen. Vandmærke og footer er eksplicitte blokke. Kun service-laget starter browserdownload.

Formatvalg ligger efter den fælles gate. Et dokument, som er blokeret, er blokeret for både PDF og Word.

## Verifikation

Testfladen omfatter:

- dokumentdefinitionens dependencies og issuepolicy,
- identisk reaktiv gate/click-preflight,
- åben draft ændrer ikke gate,
- settle til fejl stopper før lazy-load/I/O,
- stale revision afvises efter async,
- modelblokke, conditional sections og immutability,
- kanalparitet, spacing, sidebrud, billeder og metadata,
- quality guards mod `DocumentWriter`-/cursorimport i generatorer.

Synlige ændringer i dokumentindhold eller layout kræver fortsat godkendelse før goldens opdateres.
