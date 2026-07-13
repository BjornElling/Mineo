# Arkitektur for dokument-output

**Status:** Informativ arkitekturbeskrivelse
**Normative kilder:** `src/contracts/document-output-contract.md` og
`src/contracts/document-format-contract.md`
**Senest verificeret mod kode:** 2026-07-13

## Overblik

Mineo genererer PDF og Word fra den samme deklarative dokumentmodel:

```text
autoritative domænedata / snapshot
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

Generatoren har ingen adgang til format, sidecursor, dokumentbredde, `jsPDF` eller Word-
objekter. Begge kanaler modtager samme bloksekvens, så kanalpariteten er strukturel.

## Lag og ansvar

Domænelaget leverer committed, validerede data eller autoritative snapshot-projektioner.
Dokumentlaget genberegner ikke domæneregler og læser ikke UI-/draft-state.

`src/document/generators/` ejer dokumentets semantiske struktur og tekst. Alle entrypoints
defineres med `defineDocument(...)`. En definition angiver titel, filnavn, metadata,
kanal-options, eventuelt brevhoved og en `body(document, input)`-funktion.

`src/document/model/documentModel.ts` ejer den lukkede `DocumentBlock`-union,
`DocumentModel`, `DocumentComposer` og den centrale model→render-target-oversættelse.
Composerens metoder tilføjer blokke; de renderer ikke. Modellen dækker teksttyper,
label-/værdi-linjer, spacing, keep-with-next, sideskift, `TableSpec`, atomiske grupper,
underskrift, brevhoved, vandmærke, flow-billede og footer. `build()` deep-freezer modellen.

`src/document/documentGenerationSession.ts` ejer formatet og én `render(request)`-funktion.
Sessionen lukker den valgte kanalfabrik inde, så generatoren aldrig ser den. Targetet oprettes
først, når hele modellen er bygget; en kompositionsfejl kan derfor ikke efterlade et delvist
renderet dokument.

De interne kanal-targets er `createPdfChannelWriter` i `src/pdf/infrastructure/` og
`createDocxWriter` i `src/docx/infrastructure/`. `DocumentWriter` i
`src/document/writer/` er kun intern adaptermekanik mellem modelrenderer og kanaler. Den må
ikke importeres fra generatorlaget. PDF-targetet ejer cursor, måling og paginering;
Word-targetet oversætter blokkene til OOXML-afsnit, styles, tabeller og sections.

## Tabeller og billeder

Generatorer opretter en `TableSpec` og kalder `document.addTable(spec)`. Modelrendereren
videresender den komplette tabelblok til kanal-targetets `renderTable(spec)`. PDF-targetet
ejer cursor, kompilering, rendering og opdateret position; Word-targetet renderer samme model
direkte til OOXML. `TableSpec` er ren data med fælles intentioner for bredde, alignment, tone,
totalrække og totalstreg. Kanalhandle, `getDoc()`, `getY()` og `setY()` findes derfor ikke i
den fælles target-grænse, generatorer eller EO-sektioner.

TAF-grafen rasteriseres fortsat til PNG ved modelbygning, men placeringen beskrives som et
indholdsbredde-billede med aspect ratio og maksimal højde. Generatoren beregner hverken
dokumentbredde eller Y-position.

## Fælles lifecycle

`defineDocument(...)` resolver metadata og kanal-neutrale layout-options, komponerer vandmærke/brevhoved/titel,
domæneindhold og footer, fryser modellen og giver den til sessionens renderer. Sessionen
returnerer bytes; generator-entrypointet returnerer `DocumentArtifact` med formatkorrekt
filnavn. Vandmærke- og footer-blokkene er eneste autoritet for deres output i begge kanaler;
de må ikke aktiveres implicit af writer-options eller `build()`. Kun service-laget starter
browser-downloaden.

Standalone MinProcesrente bygger flere renteafsnit i én composer og renderer den samlede
model én gang gennem samme modelrenderer.

## Verifikation

Modeltests verificerer bloksekvens, betingede afsnit, atomiske grupper og immutability.
Renderer-/target-tests verificerer spacing, sidebrud, billeder, metadata og build.
PDF-/Word-goldens verificerer den faktiske kanalpræsentation. En ændring af blokalgebra eller
renderer skal bevare disse goldens, medmindre en synlig dokumentændring er godkendt først.
PDF-goldens er bevaret ved paritetsmigreringen; Word-goldens fastholder den godkendte fælles
præsentation med direkte tabeller, korte totalstreger og atomisk signatur.

Tre AST-regler håndhæver, at generatorlaget hverken importerer `DocumentWriter` eller bruger
cursor-/kanalmetoder, heller ikke via bracket-notation.
