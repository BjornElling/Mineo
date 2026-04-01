# Arkitekturoprydning — Status og Endelig Implementeringsplan

Oprettet: 2026-04-01  
Senest opdateret: 2026-04-01

Dette dokument er en kort, selvstændigt læsbar opsummering af:

- hvilke arkitekturrettelser der allerede er gennemført
- hvilke arkitektoniske hængepartier der stadig findes i kodebasen
- hvilke yderligere forbedringer der bør laves, hvis målet er en maksimalt ren afsluttende kode
- en samlet implementeringsplan for samtlige resterende rettelser

Dokumentet beskriver kun arkitektur og struktur. Det tager ikke stilling til domænereglerne som sådanne.

---

## 1. Kort opsummering af de gennemførte rettelser

De hidtidige rettelser har allerede forbedret kodebasen mærkbart på fem områder:

### 1.1 Død kode og uklare mønstre blev ryddet op

- `usePersistedSection` og tilhørende test blev fjernet
- persistens-adgangslag blev dokumenteret i `AGENTS.md`
- `form-contract.md` blev skærpet, så draft-systemernes ansvarsdeling er tydeligere

### 1.2 `MainLayout` blev reduceret fra gudkomponent til tydeligere orkestrering

Følgende ansvar blev trukket ud i dedikerede moduler:

- commit-flush utilities
- unsaved-changes guard
- devtools-monitorering
- save/load-flow
- PWA launch queue-flow

Resultatet er, at `MainLayout` stadig ejer global adfærd, men gør det via afgrænsede hooks og utilities i stedet for som stor blandet implementering.

### 1.3 EO-domænet blev reorganiseret

`src/domain/erstatningsopgoerelse/` blev opdelt i:

- `engines/`
- `snapshot/`
- `pdf/`
- `tables/`
- `validation/`
- `helpers/`

De to misvisende rod-filer `eoPdfReguleringEngine.ts` og `eoPdfLoenudvikling.ts` blev splittet, så beregning og PDF-entrypoints ikke længere er blandet sammen på samme måde som før.

### 1.4 Det parallelle EO-fejlsystem blev konsolideret

- den særskilte EO-input-error-store blev slettet
- EO-fejl lægges nu i det centrale field-error-system
- cleanup-registry og side-effect cleanup-import blev fjernet

Der er dermed kun ét autoritativt fejlspor i runtime-state.

### 1.5 `src/pdf/` og nye `utils`-entrypoints blev etableret

- `src/pdf/` blev oprettet som top-level API for PDF-laget
- `src/utils/date/`, `src/utils/number/` og `src/utils/file/` blev oprettet som nye entrypoints
- devtools-delen blev delvist lazy-loadet

Det har forbedret importfladen og givet en tydeligere retning for strukturen, men ikke afsluttet hele den fysiske migrering.

---

## 2. Samlet status i dag

Kodebasen er væsentligt renere end før oprydningen, men den er ikke helt i mål, hvis succeskriteriet er:

> “maksimalt ren afsluttende kode uden bevidste arkitekturkompromiser”

De resterende problemer er ikke først og fremmest funktionelle fejl. De handler om:

- dobbeltstruktur og kompatibilitetslag
- restkobling mellem domænelag og PDF-navngivne moduler
- for brede persistens-adgange i page-/tab-laget
- enkelte brud på page-/tab-kontrakten
- manglende fuld konvergens om kanoniske initial values og læsemønstre

Det betyder:

- korrektheden er ikke åbenlyst kompromitteret af de resterende forhold
- men slutarkitekturen er stadig mindre stringent, mindre entydig og mindre “selvforklarende” end den kunne være

---

## 3. Resterende arkitekturrettelser

Denne sektion beskriver alle de rettelser, der bør gennemføres, hvis målet er en maksimalt ren afsluttende kodebase.

### R1. Fuld fysisk migrering af PDF-laget fra `src/utils/pdf/` til `src/pdf/`

**Nuværende situation**

`src/pdf/` fungerer i dag i høj grad som nyt import-API, men mange filer er stadig rene re-exports af de gamle moduler i `src/utils/pdf/`.

Eksempler:

- `src/pdf/infrastructure/pdfService.ts`
- `src/pdf/infrastructure/pdfWriter.ts`
- `src/pdf/shared/pdfHelpers.ts`
- `src/pdf/domains/eo/erstatningsopgoerelsePdf.ts`

**Problem**

- der findes fortsat to PDF-strukturer i kodebasen
- `src/pdf/` er ikke den reelle implementeringskilde
- ny kode kan stadig let falde tilbage til gamle stier

**Hvor meget det vil forbedre kodekvaliteten**

- høj gevinst for strukturel klarhed
- moderat gevinst for vedligeholdelse
- lille direkte gevinst for funktionel korrekthed

**Størrelse og risiko**

- størrelse: mellemstor til stor
- risiko: middel til høj

### R2. Fuld semantisk afkobling af EO-kerne fra `pdf`-navngivne fællesmoduler

**Nuværende situation**

EO’s `engines/` og `snapshot/` bruger stadig fælles typer og hjælpefunktioner fra `src/domain/erstatningsopgoerelse/pdf/`, fx:

- `eoPdfModelTypes`
- `eoPdfMoneyUtils`
- `sharedPdfUtils`

Det ses bl.a. i:

- `src/domain/erstatningsopgoerelse/engines/loenudviklingBeregning.ts`
- `src/domain/erstatningsopgoerelse/engines/tafNettoBeregning.ts`
- `src/domain/erstatningsopgoerelse/engines/svieSmerteEngine.ts`
- `src/domain/erstatningsopgoerelse/snapshot/eoCanonicalOutput.ts`
- `src/domain/erstatningsopgoerelse/snapshot/eoSnapshot.ts`

**Problem**

- domæne-kerne og PDF-præsentation er ikke helt begrebsmæssigt adskilt
- nogle neutrale typer/hjælpere fremstår stadig som PDF-ejede, selv om de reelt bruges bredere

**Hvor meget det vil forbedre kodekvaliteten**

- høj gevinst for arkitektonisk renhed
- moderat gevinst for læsbarhed og domæneforståelse
- lille til moderat gevinst for langsigtet vedligeholdelse

**Størrelse og risiko**

- størrelse: stor
- risiko: høj

### R3. Udfasning af legacy-entrypoints for EO

**Nuværende situation**

De gamle entrypoints findes stadig:

- `src/domain/erstatningsopgoerelse/eoPdfReguleringEngine.ts`
- `src/domain/erstatningsopgoerelse/eoPdfLoenudvikling.ts`

De er nu kompatibilitetsfacader, men de holder en gammel struktur i live.

**Problem**

- to navngivningsverdener eksisterer side om side
- test- og importoverfladen er større end nødvendig

**Hvor meget det vil forbedre kodekvaliteten**

- lille til moderat gevinst
- primært klarhed og entydighed

**Størrelse og risiko**

- størrelse: lille
- risiko: lav til middel

### R4. Fjernelse af EO-specifik adapter-hook for inputfejl

**Nuværende situation**

`src/hooks/useEOLoenindkomstInputErrors.ts` er ikke længere en separat fejlmodel, men fungerer stadig som adapter oven på den centrale field-error-cache.

**Problem**

- der findes stadig en EO-specifik API oven på et ellers kanonisk fejlspor
- UI-laget bruger ikke helt samme fejlmønster som resten af appen

**Hvor meget det vil forbedre kodekvaliteten**

- lille gevinst
- mest begrebsmæssig ensartethed

**Størrelse og risiko**

- størrelse: lille til mellemstor
- risiko: lav til middel

### R5. Normalisering af persistensadgang i page- og tab-laget

**Nuværende situation**

Flere pages og tabs læser persisted data direkte via `useFormPersistence()` og `getPersistedData()`, selv om projektets adgangslag skelner mellem:

- læs: selector-hooks
- rediger: `usePersistedForm`
- system: direkte context-adgang

Det ses bl.a. i:

- `src/components/pages/Aarsloen.tsx`
- `src/components/pages/Satser.tsx`
- `src/components/pages/Renteberegning.tsx`
- `src/components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx`

**Problem**

- page-/tab-lag bruger et bredere API end nødvendigt
- system-hooken bruges uden for det mest restriktive adgangsniveau
- ansvarsgrænser bliver mindre tydelige

**Hvor meget det vil forbedre kodekvaliteten**

- moderat gevinst
- især bedre arkitektonisk disciplin og mere præcis dataadgang

**Størrelse og risiko**

- størrelse: mellemstor
- risiko: middel

### R6. Flyt persisted form-ejerskab fra tabs tilbage til page-niveau

**Nuværende situation**

Mindst én tab-komponent åbner selv persisted forms:

- `src/components/pages/varigemen/MenberegningTab.tsx`

Den læser selv:

- `stamdata`
- `faellesPersondata`

via `usePersistedForm(...)` i tabben.

**Problem**

- det bryder page-kontraktens standardmønster, hvor page-niveau skal eje persisted orkestrering og tabs normalt skal modtage data via props
- tabben bliver mindre ren som underkomponent

**Hvor meget det vil forbedre kodekvaliteten**

- moderat gevinst
- især bedre page-/tab-arkitektur og mere forudsigeligt dataflow

**Størrelse og risiko**

- størrelse: lille til mellemstor
- risiko: middel

### R7. Flyt inline `initialValues` ud af page-filer og ind i kanoniske domænemoduler

**Nuværende situation**

Flere pages bruger stadig inline initial values i selve page-filen, fx:

- `src/components/pages/Aarsloen.tsx`
- `src/components/pages/Satser.tsx`
- `src/components/pages/Renteberegning.tsx`
- `src/components/pages/VarigeMen.tsx`

Mens andre områder allerede bruger navngivne domænemoduler som:

- `STAMDATA_INITIAL_VALUES`
- `FAELLES_PERSONDATA_INITIAL_VALUES`
- `createErstatningsopgoerelseInitialValues(...)`

**Problem**

- initial values er ikke konsekvent placeret i domænelaget
- page-filer bærer mere domænekonfiguration end nødvendigt

**Hvor meget det vil forbedre kodekvaliteten**

- lille til moderat gevinst
- især bedre konsistens og genfindelighed

**Størrelse og risiko**

- størrelse: lille til mellemstor
- risiko: lav

---

## 4. Yderligere arkitekturforbedringer fundet ved kritisk gennemgang

Ud over de allerede kendte punkter vurderer jeg, at følgende forbedringer også bør overvejes, hvis målet er maksimal slutrenhed.

### A1. Gennemfør konsekvent read-only selector-mønster for shared persisted data

Dette er beslægtet med `R5`, men fortjener at blive fremhævet som et selvstændigt princip:

- når en page eller tab kun læser persisted data, bør den bruge selectors eller page-level projektioner
- den bør ikke kalde det bredere persistence-API direkte

Det vil gøre det lettere at se:

- hvem der ejer commit-adgangen
- hvem der kun læser
- hvor tværsektion-sammensætning faktisk sker

### A2. Ryd op i page-/subview-ejerskab i `Varige mén`

`VarigeMen.tsx` er i dag page-ejer af `varigemen`, men `MenberegningTab.tsx` åbner selv andre persisted forms.

Det er et konkret sted, hvor kodebasen stadig ikke helt følger sine egne page-kontrakter.

Hvis der kun skal vælges ét ekstra “kontraktnær” forbedringsområde ud over de tidligere kendte punkter, er dette et af de stærkeste kandidater.

### A3. Afklar om auth-gate skal være en formel del af top-level arkitekturkontrakten

Kodebasen har et top-level `AuthGate` i `src/main.tsx`, som leder videre til `App`.

Det er ikke nødvendigvis forkert, men det betyder, at top-level runtime-hierarkiet i praksis er:

- `main.tsx`
- `AuthGate`
- `App`
- `MainLayout`

Hvis dette skal være en varig del af slutproduktet, bør det være eksplicit accepteret som del af top-level arkitekturen.

Dette er ikke det vigtigste oprydningspunkt, men det er et sted hvor den faktiske struktur er mere kompleks end kontrakterne umiddelbart antyder.

**Opdateret afklaring**

Adgangskodekontrollen er ikke tænkt som en varig del af slutarkitekturen.
Den er en bevidst, midlertidig udviklingsforanstaltning med følgende karakter:

- den skal kun begrænse almindelige personers adgang til siden, mens programmet stadig er under udvikling
- den udgør ikke egentlig sikkerhed
- den er bevidst en skrøbelig skal og kan omgås
- den skal fjernes helt, når programmet er færdigudviklet

Det betyder arkitektonisk:

- `AuthGate` skal ikke forstås som et permanent sikkerheds- eller domænelag
- den bør behandles som midlertidig top-level udviklingsinfrastruktur
- hvis målet er ren slutarkitektur, er den korrekte afslutning ikke at “forfine” auth-laget, men at fjerne det helt

---

## 4a. Repo-bred mønsteranalyse af de nye fund

Denne sektion vurderer, om de nye fund er enkeltstående undtagelser eller symptomer på bredere mønstre i programmet.

### M1. For bred direkte persistensadgang i page-/tab-laget er et reelt tværgående mønster

**Konklusion**

Ja. Dette er ikke kun et enkelt tilfælde.

**Kerneproblem**

Nogle pages og tabs læser persisted data via det brede system-hook `useFormPersistence()` og `getPersistedData()`, selv om projektets egen arkitektur skelner mellem:

- restriktiv read-only adgang via selector-hooks
- formularadgang via `usePersistedForm`
- systemadgang via direkte persistence-context

**Verificerede runtime-forekomster**

- `src/components/pages/Aarsloen.tsx`
- `src/components/pages/Satser.tsx`
- `src/components/pages/Renteberegning.tsx`
- `src/components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx`

**Variationer af samme mønster**

1. **Page læser kun én fremmed sektion for hjælpeflow/PDF**
   - `Aarsloen.tsx`
   - `Satser.tsx`
   - `Renteberegning.tsx`

2. **Tab læser persisted stamdata direkte flere steder i samme fil**
   - `EOOplysningerTab.tsx`
   - her bruges direkte `getPersistedData('stamdata')` både til små helper-hooks og til PDF-download-input

3. **Hooks arbejder via det brede persistence-API, når de er designet som infrastrukturlag**
   - `usePersistedForm.ts`
   - `useFormFieldErrors.ts`
   - `useEOLoenindkomstInputErrors.ts`
   - dette er ikke nødvendigvis forkert, fordi disse hooks netop er fælles persistence-/error-abstraktioner og ikke page-/tab-UI

**Vurdering**

- Som symptom er dette **bredt nok** til at skulle rettes samlet.
- Der bør laves én samlet oprydning af read-only persisted adgang i page-/tab-laget.
- Infrastrukturlagene bør ikke blandes ind i den samme oprydning, medmindre der også ønskes redesign af persistence-facaden.

### M2. Persisted form-ejerskab i tabs er ikke et bredt mønster, men én tydelig kontraktundtagelse

**Konklusion**

Nej. Dette ser ikke ud til at være et generelt problem mange steder.

**Verificeret kontraktundtagelse**

- `src/components/pages/varigemen/MenberegningTab.tsx`

Tabben åbner selv persisted forms for:

- `stamdata`
- `faellesPersondata`

**Sammenligning med legitime tilfælde**

Page-level orkestrering med flere autoriserede persisted sektioner findes også i:

- `src/components/pages/Erhvervsevnetab.tsx`
- `src/components/pages/Forsoergertab.tsx`

Disse er ikke i sig selv problematiske, fordi de netop ligger på page-niveau og dermed følger kontraktens normale ansvar.

**Vurdering**

- Dette bør rettes, men som **konkret lokalt kontraktbrud**, ikke som en repo-bred epidemi.
- Det kan derfor løses i én fokuseret rettelse uden at skulle gennemgå mange tilsvarende tabs.

### M3. Inline `initialValues` i page-filer er et mindre, men tydeligt gentaget mønster

**Konklusion**

Ja. Dette mønster findes flere steder.

**Verificerede forekomster**

- `src/components/pages/Aarsloen.tsx`
- `src/components/pages/Satser.tsx`
- `src/components/pages/Renteberegning.tsx`
- `src/components/pages/VarigeMen.tsx`

**Sammenligning med kanoniske tilfælde**

Andre pages bruger allerede navngivne domænemoduler:

- `src/components/pages/Stamdata.tsx` → `STAMDATA_INITIAL_VALUES`
- `src/components/pages/Erhvervsevnetab.tsx` → `ERHVERVSEVNETAB_INITIAL_VALUES`, `FAELLES_PERSONDATA_INITIAL_VALUES`, `FAELLES_AARSLOEN_INITIAL_VALUES`
- `src/components/pages/Forsoergertab.tsx` → `FORSOERGERTAB_INITIAL_VALUES`
- `src/components/pages/Erstatningsopgoerelse.tsx` → `createErstatningsopgoerelseInitialValues(settings)`

**Vurdering**

- Dette er et rigtigt konvergensproblem, men af lavere alvor end persistensadgangen.
- Alle fire forekomster bør samles i én rettelsesbatch, så initial-values-mønsteret bliver ensartet én gang for alle.

### M4. AuthGate-fundet ligner ikke et gentaget mønster, men en enkelt top-level arkitekturbeslutning

**Konklusion**

Nej. Dette er ikke et symptom, der optræder flere steder.

**Verificeret struktur**

Top-level runtime-flow er:

- `src/main.tsx`
- `src/auth/AuthGate.tsx`
- `src/App.tsx`

Der er ikke fundet parallelle auth-gates eller andre tilsvarende ekstra top-level runtime-lag.

**Vurdering**

- Dette er en enkelt strukturel beslutning, ikke et gennemgående kvalitetsproblem.
- Den skal enten accepteres og dokumenteres, eller ændres særskilt.
- Den bør ikke blandes sammen med de tværgående oprydningsspor.

### M5. De vigtigste ting, der kan rettes “på én gang”

Hvis målet er at samle de repo-brede symptomer i få koordinerede rettelser, bør de grupperes sådan:

**Batch A — Read-only persisted adgang**

Omfatter alle runtime-callsites i UI-laget, der læser persisted data via `useFormPersistence()` / `getPersistedData()` i stedet for selector- eller page-level read-models:

- `src/components/pages/Aarsloen.tsx`
- `src/components/pages/Satser.tsx`
- `src/components/pages/Renteberegning.tsx`
- `src/components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx`

**Batch B — Initial values-konvergens**

Omfatter pages med inline initial values:

- `src/components/pages/Aarsloen.tsx`
- `src/components/pages/Satser.tsx`
- `src/components/pages/Renteberegning.tsx`
- `src/components/pages/VarigeMen.tsx`

**Batch C — Page/tab-ejerskab**

Omfatter den konkrete kontraktundtagelse:

- `src/components/pages/varigemen/MenberegningTab.tsx`

**Batch D — Top-level arkitekturbeslutning**

Omfatter den enkeltstående afklaring:

- `src/main.tsx`
- `src/auth/AuthGate.tsx`
- evt. kontraktdokumentation

Denne batch er primært dokumentations-/strukturafklaring, ikke nødvendigvis en kodeændring.

---

## 4b. Særskilt legacy-undersøgelse: yderligere fund som ikke allerede var beskrevet

Denne sektion dækker mulige legacy-bestanddele, som ikke primært blev fundet via navn, men via adfærdsmønstre:

- gamle kompatibilitetsspor
- særskilte dataflows som ikke længere bruges
- overgangs- eller overgangslignende adaptere
- tekstlige rester af fjernet arkitektur

### L1. `dataCollection.ts` indeholder et særskilt sessionStorage-scan-/save-spor, som ser delvist forældet ud

**Fund**

`src/utils/dataCollection.ts` indeholder både aktive og sandsynligt forældede funktioner.

Aktivt brugte dele:

- `countFilledFields()`
- `hasRealData()`

Sandsynligt forældede eller døde dele:

- `collectAllData()`
- `saveDataToSessionStorage()`

De er ikke fundet i runtime-kode uden for filen selv, mens `countFilledFields()` bruges aktivt af:

- `FormPersistenceContext.tsx`
- `fileSave.ts`
- `fileLoad.ts`

**Hvorfor det ligner legacy**

- funktionerne scanner og skriver direkte til `sessionStorage` på et lavere niveau end den nuværende persistence-arkitektur
- de ligner et ældre hjælpe-API fra før eller uden om den nuværende autoritative `FormPersistenceContext` / `formPersistenceStore`-model
- de lever side om side med den nyere persistence-facade uden at være del af det kanoniske flow

**Vurdering**

- dette er et reelt nyt legacy-fund
- hvis målet er maksimal renhed, bør filen opdeles, så:
  - de aktive tællefunktioner bevares
  - de ubrugte sessionStorage-helperfunktioner slettes

**Clean-cut potentiale**

- højt
- lav risiko, hvis der først bekræftes nul runtime-forbrug

### L2. `validateEoFile()` i `fileLoad.ts` ligner en ubrugt kompatibilitetsprobe for den krypterede wrapper

**Fund**

`src/utils/fileLoad.ts` eksporterer `validateEoFile()`, som:

- kun validerer den ydre krypterede wrapper
- hardcoder `parsed.version === 1`
- ikke er fundet brugt i runtime-koden

**Hvorfor det ligner legacy**

- funktionen ser ud til at være lavet som et ældre eller alternativt valideringstrin
- den lever ved siden af den egentlige load-pipeline, som i dag går via:
  - dekryptering
  - `eoFileContainerLoadSchema`
  - sektion-for-sektion preflight/sanitization
- dens versionstjek er knyttet til wrapper-versionen i krypteringscontaineren, ikke til den nyere `.eo` payload-validering

**Vurdering**

- dette er sandsynligvis et nyt legacy-fund eller i hvert fald død alternativ infrastruktur
- hvis funktionen ikke bruges i tests eller planlagte flows, bør den slettes

**Clean-cut potentiale**

- højt
- lav risiko

### L3. Load-pipelinen indeholder et bevidst backward-compat-spor for ældre `.eo`-filer

**Fund**

Den normale load-pipeline accepterer stadig delvis indlæsning af ældre eller afvigende filer via:

- permissiv load-container i `src/schemas/eoFileSchema.ts`
- ukendte felter og sektioner sanitiseres i `src/utils/fileLoad.ts`
- delvise fejl samles i `preflightWarning`

Det sker bl.a. via:

- `eoFileDataLoadSchema`
- `eoFileContainerLoadSchema`
- `stripUnknownFieldsBySchema(...)`
- preflight issues som:
  - “Feltet findes ikke i denne version og blev ikke indlæst”
  - “Sektionen findes ikke i denne version og blev ikke indlæst”

**Hvorfor det ligner legacy**

- dette er et eksplicit kompatibilitetsspor for schema-evolution og ældre filindhold
- det er ikke bare normal validering; det er et design for at kunne indlæse “så meget som muligt” af ældre eller delvist ukendte filer

**Vurdering**

- dette er ikke død kode
- det er aktiv, bevidst backward-kompatibilitet
- det er derfor kun et “legacy-fund”, hvis man ønsker at gøre clean cut på gamle `.eo`-filer og kræve strict load af præcis samme formatversion

**Clean-cut potentiale**

- teknisk muligt
- men arkitektonisk og produktmæssigt et meget større valg end de øvrige fund
- vil kræve bevidst beslutning om at opgive den nuværende best-effort-load-strategi

### L4. `TableDateIsoInput` er en aktiv overgangsadapter, men ikke et klart legacy-problem i sig selv

**Fund**

`src/components/inputs/table/TableDateIsoInput.tsx` beskriver sig selv som:

- kanonisk adapter for tabeller der persisterer ISO-datoer
- noget der skal bevares “until/unless TableDateInput gains a first-class ISO model mode”

Den bruges flere steder i runtime:

- `BeregnetRenteTable.tsx`
- `BeregningsperiodeFerieTable.tsx`
- `FerieperiodeTable.tsx`
- `OevrigeKravTable.tsx`
- `TAFPeriodeTable.tsx`
- `SvieSmerteTable.tsx`

**Vurdering**

- dette er mere en aktiv arkitektur-bridge end et forældet legacy-spor
- den bør ikke behandles som død legacy nu
- men den viser, at date-input-laget stadig har en dobbeltmodel:
  - dansk draft/commit-UI
  - ISO-persisteret tabelmodel via adapter

Hvis inputarkitekturen ønskes helt samlet, kan denne adapter på sigt foldes ind i et mere generelt date-input-system.

### L5. `OpenEo` er et aktivt recovery-flow, ikke et legacy-rester

**Fund**

`src/components/pages/OpenEo.tsx` viser fallback-content og retry-flow, hvis PWA-filindlæsning afbrydes.

**Vurdering**

- dette ligner ikke gammel legacy-kode
- det er et aktivt, særskilt recovery-flow for opdatering/PWA-lancering
- det bør ikke ryddes væk som legacy, medmindre hele PWA-open-modellen ændres

### L6. `App.tsx` indeholder en stale kommentar fra tidligere cleanup-registry-arkitektur

**Fund**

Øverst i `src/App.tsx` står stadig kommentaren:

- `// Side-effect: registrerer EO-domænets cleanup/rollback hooks i det generiske registry`

Den tilhørende side-effect import findes ikke længere.

**Vurdering**

- dette er ikke runtime-legacy, men en tekstlig legacy-rest
- den bør fjernes som del af en clean final pass, fordi den aktivt beskriver en arkitektur der ikke længere eksisterer

### Samlet vurdering af de nye legacy-fund

De vigtigste nye fund, som ikke allerede var dækket tidligere, er:

1. **Død eller delvist død utility-infrastruktur i `dataCollection.ts`**
2. **Sandsynligt ubrugt wrapper-validator i `validateEoFile()`**
3. **Aktiv backward-kompatibilitetslogik i `.eo`-load-pipelinen**
4. **Stale arkitekturkommentar i `App.tsx`**

Af disse er følgende gode clean-cut kandidater med lav risiko:

- sletning af ubrugte helperfunktioner i `dataCollection.ts`
- sletning af `validateEoFile()` hvis den fortsat er ubrugt
- fjernelse af stale kommentaren i `App.tsx`

Den store clean-cut beslutning er derimod:

- om backward-kompatibel, best-effort `.eo`-load skal bevares eller erstattes af strict same-version load

Det er det eneste nye fund i denne sektion, som reelt kan bryde bagudkompatibilitet på en måde der mærkes uden for koden.

---

## 5. Samlet implementeringsplan

Hvis alle ovenstående rettelser skal gennemføres, bør de udføres i denne rækkefølge.

### Fase 1. Stram adgangslag og page-ejerskab først

**Omfang**

- `R5`
- `R6`
- `R7`
- `A1`
- `A2`

**Hvorfor denne fase først**

- dette er de mest kontraktnære forbedringer
- de har relativt høj arkitekturgevinst uden at kræve de mest invasive masseflytninger
- de reducerer bredde og uklarhed i UI-/page-laget, før de tunge migrationsspor påbegyndes

**Konkrete delopgaver**

1. Erstat direkte `useFormPersistence()`-læsninger i pages/tabs med selector-hooks eller page-level props.
2. Flyt `stamdata`- og `faellesPersondata`-ejerskab i `MenberegningTab` tilbage til page-niveau.
3. Opret kanoniske initial-values-moduler for de pages der stadig har inline initial values.
4. Ensret read-only persisted adgang, så den bruger selector-laget konsekvent.

**Repo-brede filer i denne fase**

- `src/components/pages/Aarsloen.tsx`
- `src/components/pages/Satser.tsx`
- `src/components/pages/Renteberegning.tsx`
- `src/components/pages/VarigeMen.tsx`
- `src/components/pages/varigemen/MenberegningTab.tsx`
- `src/components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx`
- nye eller opdaterede initial-values-moduler i relevante domænemapper

**Forventet størrelse og risiko**

- størrelse: mellemstor
- risiko: middel

**Forventet gevinst**

- høj ift. arkitekturdisciplin
- moderat ift. vedligeholdelse

### Fase 2. Afslut EO-fejl- og entrypoint-konvergens

**Omfang**

- `R3`
- `R4`

**Hvorfor denne fase som nummer to**

- når page-laget er strammet op, bliver det nemmere at fjerne de sidste EO-specifikke adaptere og gamle indgange
- denne fase er mindre end de store PDF-/EO-migreringer og kan fungere som mellemtrin

**Konkrete delopgaver**

1. Omskriv de resterende EO-callsites, så de ikke afhænger af `useEOLoenindkomstInputErrors.ts`.
2. Slet adapter-hooken, når alt UI bruger det kanoniske fejlmønster direkte.
3. Migrer tests og eventuelle resterende imports væk fra `eoPdfReguleringEngine.ts` og `eoPdfLoenudvikling.ts`.
4. Slet legacy-entrypoints, når de er uden brugere.

**Forventet størrelse og risiko**

- størrelse: lille til mellemstor
- risiko: lav til middel

**Forventet gevinst**

- moderat ift. entydighed
- lille til moderat ift. samlet kodekvalitet

### Fase 3. Flyt den reelle PDF-implementering

**Omfang**

- `R1`

**Konkrete delopgaver**

1. Flyt implementering fil for fil fra `src/utils/pdf/` til `src/pdf/`.
2. Sørg for at `src/pdf/*` bliver de reelle kildemoduler, ikke kun re-exports.
3. Opdater alle runtime-imports og tests til de nye placeringer.
4. Slet eller lås de gamle `src/utils/pdf/*`-stier, når migrationsfladen er tom.

**Forventet størrelse og risiko**

- størrelse: mellemstor til stor
- risiko: middel til høj

**Forventet gevinst**

- høj strukturel gevinst
- moderat langsigtet vedligeholdelsesgevinst

### Fase 4. Afslut EO-domænets semantiske afkobling

**Omfang**

- `R2`

**Konkrete delopgaver**

1. Identificér alle fælles typer og helpers i `src/domain/erstatningsopgoerelse/pdf/`, der reelt ikke er PDF-specifikke.
2. Flyt dem til neutrale moduler under fx `engines/`, `helpers/`, `snapshot/` eller nyt neutralt fælleslag i EO-domænet.
3. Omdøb dem, så deres navne afspejler domænebetydning frem for PDF-brug.
4. Omskriv engine- og snapshot-laget til kun at bruge neutrale moduler.
5. Lad PDF-laget importere fra disse neutrale moduler, ikke omvendt.

**Forventet størrelse og risiko**

- størrelse: stor
- risiko: høj

**Forventet gevinst**

- høj gevinst i ren arkitektur
- moderat gevinst i langsigtet vedligeholdbarhed

### Fase 5. Afklar og dokumentér top-level runtime-arkitektur

**Omfang**

- `A3`

**Konkrete delopgaver**

1. Beslut om `AuthGate` er permanent del af slutproduktet.
2. Hvis ja, opdater relevante kontrakter eller arkitekturdokumentation, så top-level runtime-hierarkiet er korrekt beskrevet.
3. Hvis nej, planlæg særskilt fjernelse eller simplificering.

**Forventet størrelse og risiko**

- størrelse: lille
- risiko: lav

**Forventet gevinst**

- lille, men vigtig for dokumenteret arkitektursandhed

---

## 6. Test- og verifikationskrav for hele planen

Hvis hele planen gennemføres, skal hvert trin verificeres strengt.

Efter hver fase skal mindst køres:

- `npm run typecheck`
- `npm run lint`
- `npm test`

Og efter de mere invasive faser også:

- `npm run build`
- målrettet manuel regression af:
  - save/load
  - PWA open-flow
  - EO-beregning
  - PDF-downloads
  - beforeunload / navigation commit-flush

For faserne `R1` og `R2` skal der forventes behov for justering af mange tests, mocks og importstier.

---

## 7. Samlet slutvurdering

Hvis alle de beskrevne rettelser gennemføres, vil kodebasen blive mærkbart renere og mere stringent.

Den største gevinst vil være:

- tydeligere lagdeling
- mere konsekvente ejerskabsgrænser
- færre kompatibilitetslag
- mindre begrebsmæssig tvetydighed

Den største pris vil være:

- en større samlet ændringsflade
- øget regressionsrisiko i trust-kritiske områder
- behov for en mere omfattende stabiliseringsrunde før endelig afslutning

Kort vurderet:

- hvis målet er **maksimalt ren slutarkitektur**, bør hele planen gennemføres
- hvis målet er **lavest mulig afslutningsrisiko**, kunne man stoppe før de store faser `R1` og `R2`

Denne plan beskriver den fulde vej til den renest mulige afsluttende kodebase.
