# Arkitekturoprydning — Systematisk Status

Oprettet: 2026-04-01  
Senest opdateret: 2026-04-02

## Formål

Dette dokument samler arkitekturoprydningen i en systematisk form, hvor hvert emne beskrives separat med:

- problem
- løsning
- status

Dokumentet beskriver kun arkitektur, struktur og oprydning. Det tager ikke stilling til domænereglerne som sådanne.

## Samlet konklusion

Alle emner i denne oprydningsrunde er gennemført.

Kodebasen er nu ryddet op uden de rester af legacy- og kompatibilitetslag, som tidligere var identificeret i denne status. De vigtigste slutresultater er:

- PDF-laget er fysisk flyttet til `src/pdf/`, og `src/utils/pdf/` er slettet
- EO-kernen er semantisk afkoblet fra PDF-navngivne fællesmoduler, hvor logikken ikke er PDF-specifik
- gamle EO-entrypoints og EO-specifikke fejl-adaptere er fjernet
- page-/tab-laget følger persistence-kontrakten mere konsekvent
- auth-gate er bevaret som en bevidst midlertidig og svag udviklingsbarriere

## Verifikation

Følgende verifikationer er kørt grønt for den afsluttede oprydning:

- `npm run typecheck`
- `npm run lint`
- `npm test`
- `npm run build`

## Emner

### R1. Fuld fysisk migrering af PDF-laget fra `src/utils/pdf/` til `src/pdf/`

**Problem**

- PDF-laget fandtes i to strukturer samtidig
- `src/pdf/` fungerede delvist som import-API oven på gamle moduler
- ny kode kunne fortsat falde tilbage til `src/utils/pdf/`

**Løsning**

- den reelle implementering blev flyttet til:
  - `src/pdf/infrastructure/*`
  - `src/pdf/shared/*`
  - `src/pdf/domains/*`
- runtime, tests og quality-guards blev omskrevet til kanoniske `src/pdf/*`-stier
- den gamle struktur `src/utils/pdf/` blev slettet helt

**Status**

- gennemført

### R2. Fuld semantisk afkobling af EO-kerne fra `pdf`-navngivne fællesmoduler

**Problem**

- EO-kernen brugte fælles typer og helpers fra `src/domain/erstatningsopgoerelse/pdf/`
- neutrale domænemoduler fremstod derfor som PDF-ejede
- lagdelingen mellem domæne og PDF-præsentation var ikke ren nok

**Løsning**

- fælles EO-typer og pengehelpers blev flyttet til neutrale moduler:
  - `src/domain/erstatningsopgoerelse/shared/eoTypes.ts`
  - `src/domain/erstatningsopgoerelse/shared/eoMoney.ts`
  - `src/domain/erstatningsopgoerelse/helpers/eoSharedUtils.ts`
- de sidste overgangsmoduler blev flyttet til deres kanoniske ejere:
  - `src/domain/erstatningsopgoerelse/helpers/loenudviklingDisplay.ts`
  - `src/domain/erstatningsopgoerelse/helpers/readableSummaryMessage.ts`
  - `src/domain/erstatningsopgoerelse/helpers/sygeferiegodtgoerelsePresentation.ts`
  - `src/domain/erstatningsopgoerelse/engines/indkomstSkadestidspunktBeregning.ts`
  - `src/domain/erstatningsopgoerelse/snapshot/eoPresentationModel.ts`
  - `src/domain/erstatningsopgoerelse/snapshot/eoPresentationSectionBuilders.ts`
- PDF-laget importerer nu disse kanoniske moduler direkte, hvor logikken ikke er PDF-specifik

**Status**

- gennemført

### R3. Udfasning af legacy-entrypoints for EO

**Problem**

- de gamle entrypoints holdt den gamle EO-struktur kunstigt i live
- navngivningen var uklar, fordi gammel og ny struktur eksisterede side om side

**Løsning**

- følgende legacy-entrypoints blev slettet:
  - `src/domain/erstatningsopgoerelse/eoPdfReguleringEngine.ts`
  - `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts`
- tests og imports blev flyttet til deres kanoniske moduler

**Status**

- gennemført

### R4. Fjernelse af EO-specifik adapter-hook for inputfejl

**Problem**

- EO havde fortsat et særskilt adapter-hook oven på det centrale field-error-system
- det gav unødig dobbeltstruktur i UI-laget

**Løsning**

- `src/hooks/useEOLoenindkomstInputErrors.ts` blev slettet
- EO UI blev flyttet til de kanoniske field-error hooks direkte

**Status**

- gennemført

### R5. Normalisering af persistensadgang i page- og tab-laget

**Problem**

- flere pages og tabs læste persisted data via bred systemadgang
- det var i konflikt med projektets kontrakt om skelnen mellem læs, rediger og system-adgang

**Løsning**

- de konkrete runtime-callsites blev flyttet til selector-baseret læsning eller page-level projektion
- berørte UI-callsites omfattede:
  - `src/components/pages/Aarsloen.tsx`
  - `src/components/pages/Satser.tsx`
  - `src/components/pages/Renteberegning.tsx`
  - `src/components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx`

**Status**

- gennemført

### R6. Flyt persisted form-ejerskab fra tabs tilbage til page-niveau

**Problem**

- mindst én tab-komponent ejede selv persisted forms, som burde ejes af page-niveauet
- det gjorde page-/tab-ansvarsdelingen mindre tydelig

**Løsning**

- `stamdata`- og `faellesPersondata`-ejerskab blev flyttet ud af:
  - `src/components/pages/varigemen/MenberegningTab.tsx`
- ejerskabet blev lagt tilbage på:
  - `src/components/pages/VarigeMen.tsx`

**Status**

- gennemført

### R7. Flyt inline `initialValues` ud af page-filer og ind i kanoniske domænemoduler

**Problem**

- flere pages havde stadig inline `initialValues`
- page-filerne bar derfor mere domænekonfiguration end nødvendigt

**Løsning**

- kanoniske initial-values-moduler blev oprettet for de berørte områder:
  - `src/domain/aarsloen/aarsloenInitialValues.ts`
  - `src/domain/satser/satserInitialValues.ts`
  - `src/domain/renteberegning/renteberegningInitialValues.ts`
  - `src/domain/varigemen/varigeMenInitialValues.ts`

**Status**

- gennemført

### A1. Konsekvent read-only selector-mønster for shared persisted data

**Problem**

- read-only persisted adgang var ikke konsekvent afgrænset til selector-laget
- det gjorde ejerskab og adgangsniveau mindre tydeligt

**Løsning**

- read-only adgang i page-/tab-laget blev samlet omkring selector-hooks og page-level projektioner
- dette blev løst sammen med `R5`

**Status**

- gennemført

### A2. Oprydning i page-/subview-ejerskab i `Varige mén`

**Problem**

- `VarigeMen.tsx` og `MenberegningTab.tsx` fulgte ikke helt page-kontraktens ejerskabsmønster

**Løsning**

- persisted form-ejerskab blev flyttet tilbage til page-niveau
- dette blev løst sammen med `R6`

**Status**

- gennemført

### A3. Afklaring af auth-gate i top-level arkitekturen

**Problem**

- top-level runtime-hierarkiet havde et ekstra auth-lag:
  - `main.tsx`
  - `AuthGate`
  - `App`
  - `MainLayout`
- auth-gatet er ikke egentlig sikkerhed, men en bevidst svag adgangsbegrænsning
- der var behov for at gøre det eksplicit i både kode og dokumentation, at laget kun skal holde uvedkommende fra siden, mens programmet udvikles

**Løsning**

- auth-gatet blev bevaret som en eksplicit midlertidig udviklingsbarriere
- `src/main.tsx` renderer igen via `AuthGate`
- følgende auth-filer er igen en bevidst del af top-level flowet:
  - `src/auth/AuthGate.tsx`
  - auth-helpers under `src/auth/*`
  - `src/components/pages/LoginPage.tsx`
- kodekommentarer og beslutningsnoter angiver nu tydeligt, at gate-laget:
  - er midlertidigt
  - er bevidst svagt
  - alene skal begrænse almindelig uvedkommende adgang under udvikling
- brugerens login-side viser kun den korte tekst:
  - `Indtast adgangskode for at åbne Mineo.`

**Status**

- gennemført som bevidst midlertidig løsning

### L1. Ubrugte sessionStorage-spor i `dataCollection.ts`

**Problem**

- `collectAllData()` og `saveDataToSessionStorage()` lignede døde helper-spor fra en ældre persistence-model

**Løsning**

- de ubrugte helperfunktioner blev slettet
- de aktive tællefunktioner blev bevaret

**Status**

- gennemført

### L2. Ubrugt `validateEoFile()`-probe i `fileLoad.ts`

**Problem**

- `validateEoFile()` var ikke en del af den reelle load-pipeline
- funktionen lignede en gammel wrapper-validator uden aktiv brug

**Løsning**

- `validateEoFile()` blev slettet
- tilhørende særskilte tests blev også fjernet

**Status**

- gennemført

### L3. Backward-kompatibel `.eo`-load

**Problem**

- load-pipelinen bevarer bevidst best-effort/backward-kompatibilitet for ældre `.eo`-filer
- dette er et aktivt kompatibilitetsvalg, ikke død kode

**Løsning**

- ingen ændring i denne oprydningsrunde
- kompatibilitetssporret blev vurderet som bevidst og fortsat gyldigt

**Status**

- bevidst bevaret

### L4. `TableDateIsoInput` som overgangsadapter

**Problem**

- `TableDateIsoInput` viser, at tabel-inputlaget stadig har en overgang mellem ISO-model og UI-model
- den er dog i aktiv brug og ikke et dødt legacy-spor

**Løsning**

- ingen ændring i denne oprydningsrunde
- adapteren blev vurderet som aktiv arkitektur-bridge, ikke som oprydningskandidat nu

**Status**

- bevidst bevaret

### L5. `OpenEo` som særskilt recovery-flow

**Problem**

- `OpenEo` kunne ligne særkode, men den er del af et aktivt recovery-flow for PWA/open-scenarier

**Løsning**

- ingen ændring i denne oprydningsrunde
- flowet blev vurderet som aktiv funktionalitet, ikke legacy

**Status**

- bevidst bevaret

### L6. Stale kommentar i `App.tsx`

**Problem**

- `App.tsx` indeholdt en kommentar om cleanup-registry-arkitektur, som ikke længere fandtes

**Løsning**

- den stale kommentar blev fjernet

**Status**

- gennemført

## Samlet vurdering

Den samlede oprydning har fjernet de identificerede legacy- og kompatibilitetsrester, som var målet for denne statusrunde. De eneste bevidst bevarede forhold er de punkter, som fortsat er aktiv funktionalitet eller aktive kompatibilitetsvalg:

- backward-kompatibel `.eo`-load
- `TableDateIsoInput` som aktiv adapter
- `OpenEo` som aktivt recovery-flow

Alt øvrigt i denne status er enten:

- gennemført og lukket
- eller vurderet og eksplicit bevaret med vilje
