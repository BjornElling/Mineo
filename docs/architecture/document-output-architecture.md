# Arkitektur for dokument-output

**Status:** Informativ. Beskriver den gældende arkitektur; bindende regler ligger i `src/contracts/`
**Normative kilder:** `src/contracts/document-output-contract.md`, `critical-action-contract.md` og
`document-format-contract.md`
**Baggrund:** `docs/architecture/input-architecture.md` (informativ; forklarer hvorfor modellen
ser sådan ud)

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
  documentLifecycle
 (ét entrypoint)
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
6. kun et revisionsbundet `PreparedDocument` går videre – modulprivat i `documentLifecycle.ts` og reelt
   parametriseret som `PreparedDocument<TRenderSettings, TBrevhovedKey>`; `<T>` bruges her og i diagrammet
   som kortform.

Pointer-blur når normalt at gøre knappen disabled før click, men korrektheden afhænger ikke af eventrækkefølgen.
Tastatur/programmatisk aktivering og et allerede leveret click følger samme preflight. Ved et ugyldigt settle fokuseres
feltet og den eksisterende danske advarsel vises kun som sidste sikkerhedsværn.

**Friskheden kontrolleres ved HVER asynkron grænse** – ikke kun én gang efter lazy-load.
`src/document/definition/documentLifecycle.ts` sammenligner det optagne token mod miljøets autoritative
`readCurrentSourceToken()` på fem punkter: ved afviklingens indgang, efter dev-server-preflighten, efter
generator-modulets lazy-load, efter writer-modulets lazy-load og **efter selve renderingen, umiddelbart før
fil-I/O**. Dertil kommer et sjette, andetartet check i `prepareDocument`, hvor barrierens token sammenlignes
med snapshottets (fase `capture`) – det lukker vinduet mellem settle og capture. Det sidste check er load-bearing: generatoren
awaiter kanal-renderingen, så inputtet kan ændre sig undervejs, og downloaden er den irreversible handling
(`critical-action-contract.md` §5). En stale kilde afvises som `stale-source` med den fase, den blev opdaget i.

Entry-checket ligger bevidst UDEN FOR dev-server-grenen, så et miljø uden dev-server – fx standalone
MinProcesrente – også verificeres mellem gate og modul-load.

## Domæne- og livscykluslag

Domænelaget leverer ready input-/snapshotprojektioner. Det genberegner ikke i dokumentlaget.

**Der findes intet servicelag.** `documentLifecycle.ts` er det ENE entrypoint, som
`document/lifecycle-single-entrypoint` håndhæver; navnet `documentService.ts` findes ikke og må ikke genindføres.
Livscyklussen ejer kun serialisering af flowet, lazy-load, render/download og runtimefejl. Den ejer ikke
callbacks med skjult domænepolicy, dependencies eller gates; formatvalget kommer fra dokumentmiljøets
`resolveFormat` (`document-format-contract.md` §3).

**Settings er delt i to disjunkte halvdele, og gaten kan ikke se formatet.** Kildesnapshottet bærer
`gateSettings` (i hovedappen EO-rækkepolitikken) og `renderSettings` (format + brevhoved-flag). Kun
`gateSettings` er typen på den `DocumentSourceContext`, en definitions `project` modtager; `renderSettings`
læses alene af miljøet, og først efter gaten har svaret `ready`. Reglen bag delingen – **formatet vælger
writer, ikke dækning** – kan ikke bæres af et værn, fordi den reaktive gate og click-preflighten kalder samme
`project` og derfor ville se den samme skæve gate i begge kanaler. Den er derfor en typegrænse: et forsøg på at
læse `documentDownloadFormat` i en gate kompilerer ikke. Begge halvdele projiceres fra ét `captureSource`-læs,
så de ikke kan stamme fra to revisioner. Normativt i `document-output-contract.md` §A2.1.

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
sessionen. Vandmærke og footer er eksplicitte blokke. Kun `documentLifecycle.ts` starter browserdownload
(`triggerDocumentDownload`), og først efter det sidste friskhedscheck.

Formatvalg ligger efter den fælles gate. Et dokument, som er blokeret, er blokeret for både PDF og Word – og
det kan ikke være anderledes, fordi gaten strukturelt ikke kan se formatet (se settings-afsnittet ovenfor).

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
