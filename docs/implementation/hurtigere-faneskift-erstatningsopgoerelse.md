# Hurtigere faneskift i Erstatningsopgørelse

Dette notat beskriver de mest sandsynlige årsager til langsomme faneskift i `Erstatningsopgørelse`, især når der er mange indtastninger i `Lønindkomst` og `Offentlige ydelser`. Notatet er verificeret mod kildekoden (2026-03-11).

## 1. Årsager til problemet

### 1.1 Monterede faner holdes i live efter første besøg

I [Erstatningsopgoerelse.tsx](src/components/pages/Erstatningsopgoerelse.tsx#L55) bruges en `visitedTabs`-strategi, hvor tunge faner mountes ved første besøg og derefter forbliver mounted. De skjules kun med `display: none`, jf. [Erstatningsopgoerelse.tsx](src/components/pages/Erstatningsopgoerelse.tsx#L299).

Konsekvens:
- Skjulte faner kan stadig rerendere.
- Faneskift bliver ikke kun et spørgsmål om at vise/skjule UI, men også om reconciliation af allerede tunge undertræer.
- Problemet er proportionalt med antallet af ansættelsesforhold og tabeller i de skjulte faner.

Denne strategi er en bevidst arkitektonisk forudsætning for at overholde no-live-preview- og draft/commit-kontrakten. Strategien bør **ikke** løses med unmount som første greb — det risikerer at flytte problemet fra performance til dataintegritet og draft-tab. Se 2.4.

### 1.2 Fanerne modtager for brede props fra parent

`LoenindkomstTab`, `OffentligeYdelserTab` og `EOberegningTab` modtager brede props fra parent, især `form` eller hele `eoValues`, jf. [Erstatningsopgoerelse.tsx](src/components/pages/Erstatningsopgoerelse.tsx#L317), [Erstatningsopgoerelse.tsx](src/components/pages/Erstatningsopgoerelse.tsx#L326) og [Erstatningsopgoerelse.tsx](src/components/pages/Erstatningsopgoerelse.tsx#L335).

Konkret: `EOOplysningerTab` og `LoenindkomstTab` modtager `form` (linje 309, 317). `OffentligeYdelserTab` modtager `form` som `ErstatningsopgoerelseFormApi` (linje 326). `EOberegningTab` modtager `eoValues={form.values}` og `setEOValues={form.setValues}` (linje 341–342).

Konsekvens:
- `Erstatningsopgoerelse` er wrappet i `React.memo(() => {...})` (linje 33) uden custom comparator og uden props — det er en page-komponent der ikke modtager props fra forældre. `React.memo` har aldrig haft effekt på parent-niveauet. Parent re-renders styres udelukkende af intern state og hooks (`activeTab`, `visitedTabs`, `eoSnapshot`, `usePersistedForm`, `useAppSettings`, `useFormPersistence`).
- Det kritiske problem er at `form`-objektet (returneret fra `usePersistedForm`) får ny reference ved enhver value-ændring, fordi `setValuesState` altid producerer et nyt objekt. Dette propagerer til alle fane-komponenters `React.memo`-tjek, som dermed bryder ved enhver EO-ændring — uanset om den konkrete fane berøres.
- De to niveauer (parent re-renders og child memo-brud) forstærker hinanden og kan ikke løses uafhængigt med fuld effekt.

### 1.3 Lønindkomst-fanen genberegner bredt på tværs af hele fanen

`LoenindkomstTab` er stor og centraliseret, og den laver flere afledte beregninger over alle ansættelsesforhold i samme komponent, jf. [LoenindkomstTab.tsx](src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx#L262), [LoenindkomstTab.tsx](src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx#L297) og [LoenindkomstTab.tsx](src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx#L1553).

Konsekvens:
- Små ændringer kan udløse bred genberegning og bred rerendering.
- Jo flere ansættelsesforhold og jo flere tabeller pr. ansættelsesforhold, desto dyrere bliver faneskift og almindelige EO-opdateringer.

### 1.4 Mindst én memo-dependency er for bred

`aarsloenExternalCellErrorMessagesByAfId` afhænger i dag af hele `values`, jf. [LoenindkomstTab.tsx](src/components/pages/erstatningsopgoerelse/LoenindkomstTab.tsx#L313).

Konsekvens:
- Memoen genberegner ved enhver EO-ændring, også når ændringen kommer fra andre faner.
- Det øger arbejdet unødigt ved faneskift og ved commits uden relation til lønindkomst.

Dependency på `[values]` er ikke forkert pr. definition — den er nødvendig i det nuværende design, fordi `buildAarsloenZeroArbejdsdageCellErrorMessages` kalder `buildAarsloenZeroArbejdsdageIssues` (indkomstRowValidation.ts linje 144–180), som læser:
1. `computeTafBeregningsenhed(values)` — afhænger af TAF-felter, ikke kun løn
2. `values.loenindkomstAnsaettelsesforhold` — løn-relevant
3. `values.ferieperioder` — EO-fælles felt
4. `values.fravaerPerioder` — EO-fælles felt

Dependency kan indsnævres til `[values.loenindkomstAnsaettelsesforhold, values.ferieperioder, values.fravaerPerioder, values.tafBeregningsgrundlag]` (eller hvad `computeTafBeregningsenhed` konkret læser — dette bør verificeres). Indsnævring kræver kortlægning af `computeTafBeregningsenhed`'s faktiske inputs. Hvis et felt overses, beregner memoen ikke om, og fejlmeddelelser vises ikke. Dette er korrekthedsarbejde, ikke kosmetisk performancetuning.

### 1.5 Offentlige ydelser er bedre afgrænset, men stadig koblet bredere end nødvendigt

`OffentligeYdelserTab` modtager hele `form` og bygger afledte værdier i fanen, jf. [OffentligeYdelserTab.tsx](src/components/pages/erstatningsopgoerelse/OffentligeYdelserTab.tsx#L15) og [OffentligeYdelserTab.tsx](src/components/pages/erstatningsopgoerelse/OffentligeYdelserTab.tsx#L32).

`derivedByRowId`-memoen (linje 32–43) har dependency `[formatAntalDage, values.offentligeYdelserRows]` — altså præcist afgrænset til sine egne rækker. Det er korrekt. Det egentlige problem er at fanens `React.memo` sammenligner `form`-objektet som helhed — og da `form` inkluderer `values` og `setValues`, er det nok at `values`-referencen skifter for at memo bryder.

Konsekvens:
- Fanen rerenderer på ændringer, der ikke vedrører offentlige ydelser.
- Afledte rækkeværdier beregnes igen, selv når kun andre EO-dele er ændret.

Løsningen for denne fane er enkel og lav risiko: send `values.offentligeYdelserRows` og en memoized `onTableDataChange`-callback direkte som props i stedet for hele `form`. Prop-omlægningen berører commit-flowet ind i tabellen, men ændrer ikke domæneberegningerne. Dette er den lavest-hængende frugt i afsnit 2.

### 1.6 Beregning-fanen er allerede delvist gated, men er stadig tung når den er aktiv

Snapshot-opbygning er korrekt gated bag `isSnapshotTabActive` i [Erstatningsopgoerelse.tsx](src/components/pages/Erstatningsopgoerelse.tsx#L134), og debug-row aggregation er korrekt gated bag `isActive` i [EOberegningTab.tsx](src/components/pages/erstatningsopgoerelse/EOberegningTab.tsx#L94).

`isSnapshotTabActive` er korrekt defineret (linje 134–135) og `useEffect`-gate er korrekt (linje 137–141). Snapshot bygges synkront i den gated effect med `buildDebugSnapshotRef.current()` og sættes i state — det trigger én ekstra re-render af Beregning-fanen ved aktivering, men det er forventeligt og acceptabelt.

Konsekvens:
- Denne del er ikke den første fejl at angribe.
- Men skift til `Beregning` kan stadig være tungt, fordi der her udføres reelt arbejde med snapshot- og debugprojektioner.

### 1.7 Persistence/context kan forplante rerenders bredt

`FormPersistenceContext` bygger ét samlet context-value, jf. [FormPersistenceContext.tsx](src/contexts/FormPersistenceContext.tsx#L567). `usePersistedForm` persisterer desuden ved hver value-ændring, jf. [usePersistedForm.ts](src/hooks/usePersistedForm.ts#L138).

`usePersistedForm` (linje 138–141) kører `persistData(pageKey, values)` i en `useEffect` der afhænger af `values`. Enhver `values`-ændring trigger persistering og potentiel context-opdatering. Alle consumers der kalder `useFormPersistence()` kan re-render ved revision-opdateringer.

Et understreget problem: `useFormPersistence()` kaldes direkte i parent-komponenten (linje 35 i Erstatningsopgoerelse.tsx), hvilket betyder at parent re-renders på *alle* persistence-opdateringer fra enhver sektion — ikke kun EO. Dette forstærker problemet i 1.2. Mekanismen er reel, ikke blot hypotetisk.

Konsekvens:
- Dette er en sekundær forklaring sammenlignet med de brede fanepops og den store `LoenindkomstTab`, men forstærker begge.
- Det er en forstærker, ikke en alternativ hovedkilde — reducering her løser ikke problemet i 1.2.

---

## 2. Foreslåede løsninger

Løsningerne er rangeret efter anbefalet rækkefølge.

### 2.1 Indsnævr props til hver fane

Anbefaling:
- Parent skal sende den mindst mulige del af EO-state til hver fane i stedet for hele `form` eller hele `eoValues`.
- Start med `OffentligeYdelserTab` — den er den letteste: fanen bruger kun `values.offentligeYdelserRows` og én `setValues`-callback. Prop-kontrakten er triviel at indsnævre og risikoen er lav.
- `LoenindkomstTab` kræver forudgående statisk kortlægning af samtlige brugte felter (`values`-felter, ferieperioder, fravaerPerioder, TAF-felter, stamdataValues via `getPersistedData`). Kortlæg ved statisk analyse af komponentens usages af `values`, ikke ved estimat — ellers er der risiko for at udelade felter der faktisk bruges.
- `EOberegningTab` modtager allerede relativt præcise props, men `eoValues={form.values}` sender hele `ErstatningsopgoerelseValues`. Mulighed: send kun de felter `EOberegningTab` faktisk bruger til at bygge sin UI (snapshot er allerede løftet ud).

Hvor omfattende er ændringen:
- Mellem for `OffentligeYdelserTab`; stor for `LoenindkomstTab` (kræver forudgående kortlægning).
- Ændrer ikke domænelogikken i sig selv.

Forventet effekt:
- Stor.
- Dette er den mest sandsynlige enkeltændring med høj effekt, fordi den direkte forbedrer `React.memo` og reducerer rerenders i skjulte faner.

### 2.2 Indsnævr for brede memo-dependencies i Lønindkomst

Anbefaling:
- `aarsloenExternalCellErrorMessagesByAfId` er den eneste bekræftede instans af en for bred dependency. Behandl den som et selvstændigt og afgrænset trin — ikke som del af en generel gennemgang.
- Indsnævr dependency fra `[values]` til de konkrete felter funktionen læser: `loenindkomstAnsaettelsesforhold`, `ferieperioder`, `fravaerPerioder`, og de felter `computeTafBeregningsenhed` læser (bør kortlægges inden rettelsen).
- Ledsag rettelsen af en test der verificerer at memoen genberegner ved ændring af hvert relevant felt. Hvis testen bliver for UI-tung, bør afhængighedskortlægningen flyttes ned på helper-niveau og testes dér — det giver et mere deterministisk regressionssignal.

Vigtigt: Memo-optimering er korrekthedsarbejde. Hvis et felt overses i dependency-listen, beregner memoen ikke om, og fejlmeddelelser vises ikke for brugeren.

Hvor omfattende er ændringen:
- Lille til mellem pr. rettelse; kræver verifikation af hvilke felter helperne faktisk læser.

Forventet effekt:
- Mellem.
- Den samlede effekt kan være mærkbar i en stor komponent som `LoenindkomstTab`.

### 2.3 Opdel Lønindkomst i memoiserede delkomponenter pr. ansættelsesforhold

Anbefaling:
- Ekstrahér rendering og lokal afledt logik for ét ansættelsesforhold til en selvstændig memoiseret komponent.
- Parent-fanen bør kun mappe over ansættelsesforhold og sende snævre props videre.

Dette er et kontrolleret større indgreb, ikke et quick win. Inden refaktoreringen startes, skal følgende kortlægges eksplicit:
- `LoenindkomstTab` har tværgående dialog-state: `loentrinFinderOpenForAfId`, `loentrinFinderAnsaettelse`, `loentrinFinderBeloeb`, `loentrinFinderDato`, og tilhørende refs (linje 282–295). Disse er fælles for alle ansættelsesforhold (kun ét finder-dialog åbent ad gangen). Det skal besluttes, hvor denne state skal leve efter opsplitningen — i fanen, løftet op i parent, eller i en selvstændig dialog-komponent.
- Opsplitningen skal sættes *efter* prop-isolering (2.1), da en smal prop-kontrakt er en forudsætning for at delkomponenterne overhovedet er isolerede nok til at vinde noget ved memoization.

Hvor omfattende er ændringen:
- Stor.
- Kræver omhyggelig regressionstest.

Forventet effekt:
- Stor.
- Forventes at reducere den brede reconciliation markant, især i sager med mange ansættelsesforhold og mange tabeller.

### 2.4 Behold "mount once, hide", men først efter prop-isolering

Anbefaling:
- Strategien med at bevare mounted faner bør som udgangspunkt beholdes af hensyn til draft state og fejltilstand — jf. 1.1.
- Den giver først en god performanceprofil, når props og rerender-flader er gjort smallere.

Hvor omfattende er ændringen:
- Lille, hvis strategien blot fastholdes som den er.
- Mellem til stor, hvis den senere ønskes justeret med mere avanceret suspendering eller selektiv unmount.

Forventet effekt:
- Lille alene.
- Strategien er ikke i sig selv løsningen; den bliver først billig, når de øvrige optimeringer er indført.

### 2.5 Isolér persistence-kontekst og overvej selector-baseret adgang på sigt

Anbefaling:
- **Pragmatisk mellemtrin (anbefalet som næste trin):** Parent-komponentens `useFormPersistence()`-kald kan isoleres uden fuld selector-arkitektur. I dag henter parent fire funktioner direkte (linje 35: `getPersistedData`, `getFieldErrorsBySource`, `getSectionRevision`, `getFieldErrorRevision`) og re-renders ved enhver context-ændring, selv fra Stamdata. Disse funktioner bruges udelukkende til at bygge `buildDebugRevision` og `stamdataValuesForBeregningTab` via refs og useMemo. Hvis disse kald flyttes til de steder de faktisk bruges (fx en custom hook der kun aktiveres når snapshot-tab er aktiv), undgår man parent re-renders drevet af Stamdata-ændringer. Dette er lettere at implementere end fuld selector-arkitektur og giver reel gevinst.
- **Længere sigt:** Overvej at erstatte brede context-consumers med selector-baseret subscription, så komponenter kun reagerer på de sections eller revisions, de faktisk bruger.

Hvor omfattende er ændringen:
- Lille til mellem for mellemtrinnet; stor for fuld selector-arkitektur.
- Fuld selector-arkitektur er en tværgående arkitekturændring og skal udføres med særlig forsigtighed i en trust-critical applikation.

Forventet effekt:
- Mellemtrinnet: Konkret og målrettet.
- Fuld selector-arkitektur: Sandsynligvis nyttig, men mindre prioriteret end at isolere props og splitte `LoenindkomstTab`.

### 2.6 Overvej virtualisering i de tungeste tabeller som sidste trin

Anbefaling:
- Vurder kun virtualisering, hvis der fortsat er mærkbar træghed efter de mere direkte render-optimeringer.
- Projektet har allerede en virtualiseret display-tabel i [VirtualizedDisplayTable.tsx](src/components/tables/VirtualizedDisplayTable.tsx), men de tunge EO-edit-tabeller er mere følsomme pga. tastatur- og commit-kontrakter.

Konkrete risici ved virtualisering i redigerbare tabeller:
- **Commit-on-blur:** Hvis en celle scroller ud af DOM mens brugeren taster, mistes commit-event. Dette er en dokumenteret faldgruppe i virtualiserede edit-grids — ikke hypotetisk.
- **Fokus-håndtering og tastatur-navigation:** I denne kodebase er fejl i fokusrækkefølge eller blur-semantik et kontraktbrud, ikke blot et usability-problem.

Hvor omfattende er ændringen:
- Stor.

Forventet effekt:
- Mellem til stor ved meget store datamængder, men ændringen er dyr og bør ikke være første skridt.

---

## Samlet anbefaling

Anbefalet rækkefølge:
1. Indsnævr props til `OffentligeYdelserTab` (lille ændring, lav risiko, konkret gevinst).
2. Indsnævr brede memo-dependencies i `LoenindkomstTab` — start med `aarsloenExternalCellErrorMessagesByAfId`.
3. Kortlæg `LoenindkomstTab`'s faktiske `values`-brug statisk; indsnævr derefter props til fanen.
4. Opdel `LoenindkomstTab` i memoiserede delkomponenter pr. ansættelsesforhold — efter prop-isolering og kortlægning af dialog-state.
5. Isolér parent-komponentens `useFormPersistence()`-kald fra Stamdata-ændringer.
6. Overvej fuld selector-baseret persistence-store som senere arkitekturarbejde.
7. Overvej virtualisering til sidst, hvis der stadig er et performanceproblem.

Den hurtigste sikre gevinst forventes at ligge i kombinationen af:
- smallere props til fanerne (start med `OffentligeYdelserTab`)
- smallere dependencies i `LoenindkomstTab`

Den største strukturelle gevinst forventes derefter at være:
- opsplitning af `LoenindkomstTab` pr. ansættelsesforhold
