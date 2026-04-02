# Persistence-arkitektur: Problem, målarkitektur og implementeringsplan

**Dato:** 2026-04-02  
**Scope:** `usePersistedForm`, `FormPersistenceContext`, `formPersistenceStore`, selector-hooks, samt typiske persisted callsites på page-/tab-niveau  
**Status:** Arbejdsdokument og implementeringsgrundlag. Dokumentet er ikke en normativ kontrakt, men beskriver den arkitektur der bør implementeres.

---

## 1. Formål

Dette dokument samler tre ting i ét sted:

1. En komplet og struktureret beskrivelse af det nuværende problem i persistence-arkitekturen.
2. En beskrivelse af den korrekte målarkitektur, som er forenelig med Mineos eksisterende kontrakter.
3. En trinvis, risikobevidst implementeringsplan, så arkitekturen kan forbedres uden at kompromittere korrekthed eller dataintegritet.

Dokumentet er skrevet med trust-kritiske krav for øje:

- committed state må være deterministisk
- committed state må ikke eksistere i konkurrerende repræsentationer
- save/load og commit-flow må være auditerbart
- drafts og committed state må holdes strengt adskilt
- refactors må ikke indføre skjulte sideeffects eller uklar ownership

---

## 2. Problemets kerne

Det centrale problem i den nuværende persistence-arkitektur er, at **committed persisted state eksisterer i mere end ét aktivt runtime-lag samtidig**.

Det gælder især for sektioner, der bruger `usePersistedForm`:

```text
sessionStorage
    ↕
FormPersistenceContext / persistence-funktioner
    ↕
formPersistenceStore (Zustand)
    ↕
usePersistedForm
    ↕
lokal React committed state
```

Det betyder, at et normalt commit ikke blot er “skriv ny committed værdi”, men i praksis er en synkroniseringsoperation mellem flere committed repræsentationer.

Den konkrete fejl, der udløste denne gennemgang, var et tydeligt symptom på netop dette:

- `persistData(...)` blev kaldt fra en React state-updater i `usePersistedForm`
- `persistData(...)` skrev videre til store/provider-laget
- det gav en runtime-advarsel om opdatering af `FormPersistenceProvider` mens en anden komponent blev renderet

Den konkrete bug er rettet. Men rettelsen ændrer ikke det underliggende arkitektoniske forhold: committed state har stadig mere end én aktiv runtime-repræsentation, og commit-flowet er stadig mere komplekst end nødvendigt.

---

## 3. Kontraktmæssigt udgangspunkt

Den korrekte vurdering af persistence-arkitekturen skal holdes op imod de eksisterende kontrakter.

### 3.1 `form-contract.md`

Følgende punkter er direkte relevante:

- Draft state og committed state er forskellige størrelser.
- Parsing må kun ske ved commit.
- Committed state må aldrig indeholde invalide værdier.
- `onChange` må ikke opdatere committed state.
- Sideeffects i state-updaters er forbudt.
- Commits skal være imperative, entydige og lette at følge.

### 3.2 `page-component-contract.md`

Følgende punkter er relevante:

- persisted adgang på page-niveau skal være eksplicit og centraliseret
- read-only adgang til andre sektioner skal bruge præcise read-models/selectors
- page-komponenten må gerne sammensætte autoriserede persisted sektioner, men sammensætningen skal være tydelig og typesikker

### 3.3 `domain-boundary-contract.md`

Følgende er relevant for EO/EET-flowet:

- `Erstatningsopgørelse` må som en snæver undtagelse læse bestemte EET-relaterede sektioner for at indsætte `midlertidigt_eet`
- denne adgang er read-only
- importen skal bruge samme beregningsvej som EET-siden

### 3.4 Konsekvens

Den korrekte persistence-arkitektur skal derfor opfylde følgende:

- én sandhedskilde for committed state
- ingen commit-sideeffects inde i render/state-updater-faser
- intet API der inviterer til `onChange -> committed state`
- tydelig adskillelse mellem read-models, commit-logik og page-/tab-orkestrering

---

## 4. Nuværende arkitektur

Dette afsnit beskriver den aktuelle struktur, som den fungerer nu.

### 4.1 `formPersistenceStore`

`formPersistenceStore` er en Zustand-store med:

- `sections`
- `sectionRevisions`
- `fieldErrors`
- `fieldErrorRevisions`
- `authoritativeSnapshotEpoch`
- `meta`

Storen har allerede flere gode egenskaber:

- schema-validering ved commit på store-niveau
- atomiske replace-/rollback-operationer for load-flow
- revisionsfelter til selektiv subscription
- tydelig model for field errors

Storen er i praksis den stærkeste kandidat til at være eneste committed sandhed.

### 4.2 `FormPersistenceContext`

`FormPersistenceContext` er i dag både:

- facade over storen
- hydration-lag
- sessionStorage-sync-lag
- notice-/fejlkanal
- aktiv subscriber til storen via `useSyncExternalStore`

Provideren bygger et snapshot af storen og eksponerer læse- og skrivefunktioner til resten af appen.

Det fungerer, men gør provider-laget tungere end nødvendigt.

### 4.3 `usePersistedForm`

`usePersistedForm` er i dag ansvarlig for:

- initial læsning af persisted data
- lokal React-state for committed values
- re-hydration når `authoritativeSnapshotEpoch` ændres
- normal commit via `setValues`
- convenience-API via `handleChange`
- reset-flow via `resetForm`

Det betyder, at hooken ikke bare er en subscriber, men et blandet lag med:

- committed state-ejerskab
- persistence-sideeffects
- re-render-styring
- event convenience

### 4.4 Selectors

Der findes allerede præcise selector-hooks:

- `usePersistedSectionSelector`
- `useFieldErrorsBySourceSelector`
- `useSectionRevisionSelector`
- `useFieldErrorRevisionSelector`

Disse peger i den rigtige retning: direkte subscription til storen i stedet for at køre alt gennem `usePersistedForm`.

### 4.5 EO / Offentlige ydelser-flowet

I EO-siden:

- page-komponenten læser egne committed værdier via `usePersistedForm`
- page-komponenten læser autoriserede tværsektion-data via selectors
- page-komponenten bygger `midlertidigtEetInsertSource`
- `OffentligeYdelserTab` bruger dette som read-only input til at bygge indsatte rækker
- tabben kalder tilbage til EO-page via `onRowsChange`
- EO-page committer via `setFormValues`

Dette flow er korrekt i sin forretningslogik, men ligger oven på den mere generelle svaghed i commit-arkitekturen.

---

## 5. Struktureret problembeskrivelse

### 5.1 Problem A: Dobbelt committed state

**Beskrivelse**  
Committed state findes både i:

- `formPersistenceStore`
- lokal `useState` i `usePersistedForm`

Den nuværende `valuesRef` i `usePersistedForm` er en synkroniseringsbro mellem de to.

**Hvorfor det er et problem**  
Når den samme committed værdi findes to steder, skal alle commit-paths holde de to repræsentationer i sync. Det er ikke gratis. Det øger risikoen for:

- render-phase bugs
- stale reads
- regressions ved batching
- skjulte ordreafhængigheder

**Strukturel diagnose**  
Dette er ikke et lokalt kodeproblem. Det er et modelproblem.

---

### 5.2 Problem B: `usePersistedForm` blander ansvar

**Beskrivelse**  
Hooken håndterer både:

- state-init og hydration
- lokal committed state
- commit-sideeffects
- convenience event-API

**Hvorfor det er et problem**  
Når samme hook både ejer committed state og skriver til den autoritative store, bliver det uklart:

- hvor committed state “bor”
- hvem der må opdatere den
- hvornår et commit er gennemført
- hvilket lag der må transformere/validere værdier

**Strukturel diagnose**  
Hooken er blevet et overgangslag mellem tidligere og nyere arkitektur, men står nu i vejen for en klar model.

---

### 5.3 Problem C: `handleChange` inviterer til kontraktbrud

**Beskrivelse**  
`usePersistedForm` eksponerer `handleChange`, som navnligt ligner et `onChange`-API, men reelt committer committed state.

**Hvorfor det er et problem**  
Det bryder ikke nødvendigvis kontrakten ved hver brug, men API’et inviterer til præcis den type brug, som `form-contract.md` forbyder.

**Strukturel diagnose**  
API’et er ikke semantisk rent. Et trust-kritisk system skal ikke eksponere et convenience-API, der gør det let at gøre det forkerte.

---

### 5.4 Problem D: Commit-flowet er ikke modelmæssigt fail-closed

**Beskrivelse**  
I den nuværende model beregnes `next`, lokal state sættes, og derefter kaldes persistence.

**Hvorfor det er et problem**  
Selv hvis det i praksis næsten altid virker, er rækkefølgen ikke den ønskede:

- UI bør afspejle autoritativ committed state
- ikke en lokal committed kopi, som bagefter forsøges persisteret

**Strukturel diagnose**  
Rækkefølgen er en rest af den dobbelte state-model.

---

### 5.5 Problem E: Provider-laget er tungere end nødvendigt

**Beskrivelse**  
Provideren subscriber selv til storen, bygger snapshots, memoiserer context-værdier og eksponerer mutations-API’er oven på samme store.

**Hvorfor det er et problem**  
Det gør architecture path længere:

```text
store -> provider snapshot -> context -> hook -> UI
```

i stedet for:

```text
store -> hook -> UI
```

**Strukturel diagnose**  
Providerens rolle er ikke klart afgrænset som ren infrastruktur.

---

### 5.6 Problem F: Tværsektion-readmodels er ikke standardiserede

**Beskrivelse**  
EO-importen af midlertidigt EET er korrekt, men read-model-kompositionen ligger direkte i page-komponenten.

**Hvorfor det er et problem**  
Hvis samme mønster opstår flere steder, ender page-laget som blanding af:

- persisted sektion-selectors
- schema-hydration
- cross-section mapping
- UI-orkestrering

**Strukturel diagnose**  
Det er endnu ikke et akut arkitekturbrud, men et tydeligt tegn på et kommende konsistensproblem.

---

## 6. Symptomer og konkrete risici

### 6.1 Allerede observeret symptom

- React-advarsel om opdatering af `FormPersistenceProvider` under render af anden komponent

### 6.2 Sandsynlige fremtidige symptomer hvis modellen bevares

- nye render-phase advarsler ved andre commit-steder
- sekventielle commits der afhænger af implicit opdateringsrækkefølge
- svære bugs ved resync af tabel-drafts
- bugs der kun viser sig ved load/reset/navigation i bestemte timing-vinduer
- API-misbrug hvor `handleChange` eller `setValues` anvendes på steder med draft-semantik

### 6.3 Konsekvens i trust-kritisk kontekst

I Mineo er denne klasse af fejl særligt alvorlig, fordi:

- persisted data er autoritativt brugerinput
- beregninger afhænger af committed state
- save/load skal være forudsigelig og auditérbar
- “det virker næsten altid” er utilstrækkeligt

---

## 7. Korrekt målarkitektur

### 7.1 Hovedprincip

**Der må kun findes én committed sandhedskilde for persisted brugerinput under aktiv runtime: `formPersistenceStore`.**

Alt andet skal være enten:

- draft state
- read-only projektioner
- UI-state
- infrastruktur

Der må ikke eksistere en anden aktiv committed kopi i `usePersistedForm`.

---

### 7.2 Lag og ansvar

#### Lag 1: `sessionStorage`

Ansvar:

- durable browser-persistence
- versioneret serialiseret snapshot

Må ikke:

- være source of truth under aktiv runtime

#### Lag 2: `formPersistenceStore`

Ansvar:

- eneste committed runtime-state
- revisionsstyring
- field-error state
- autoritativ committed repræsentation pr. sektion

Må gerne:

- håndhæve schema-validering
- håndhæve transaktionsgrænser
- eksponere atomiske commit-/replace-operationer

#### Lag 3: Infrastruktur / provider

Ansvar:

- hydration fra `sessionStorage` ved app-start
- persist-to-storage ved commit
- atomic replace/load-flow
- notice-/diagnostikkanal

Må ikke:

- holde egen committed kopi af sections
- være påkrævet som render-led for almindelige læsninger af sections

#### Lag 4: Hooks

Ansvar:

- subscribe til store
- eksponere læse-API og smalle commit-API’er
- holde draft state, hvis de er draft-hooks

Må ikke:

- holde separat committed kopi af persisted sektionen

#### Lag 5: Page/tab/felt

Ansvar:

- orkestrere UI og flows
- bruge drafts korrekt
- committe eksplicit via tilladte APIs

Må ikke:

- selv opfinde persistence-mekanismer
- skrive direkte til `sessionStorage`

---

### 7.3 Dataflow i korrekt arkitektur

#### Normal committed opdatering

```text
UI/felt/tab
   -> commit action
   -> validate/normalize
   -> persist-to-storage
   -> commit to formPersistenceStore
   -> store notifies subscribers
   -> UI rerenders from store
```

#### Autoritativ replace (load/reset/migration)

```text
load/reset command
   -> validate entire snapshot/section
   -> write storage atomically
   -> replace store atomically
   -> bump authoritativeSnapshotEpoch / formVersion
   -> draft systems resync
```

#### Read-only cross-section access

```text
page-level read-model hook
   -> subscribe to relevant store sections
   -> validate/map
   -> expose stable read model to tab
```

---

### 7.4 `usePersistedForm` i korrekt arkitektur

`usePersistedForm` bør være et smalt hook for en persisted sektion.

Det bør gøre:

- subscribe direkte til storen for én sektion
- returnere committed `values` fra storen
- returnere `replaceValues(next)` for autoritativ replace
- returnere et smalt commit-API for normale felt-/sektion-commits
- returnere `formVersion` til draft-resync

Det bør ikke gøre:

- holde lokal committed `useState`
- holde `valuesRef` som synk-bro
- eksponere `handleChange`
- være afhængig af providerens render-cyklus for at læse sections

---

### 7.5 Korrekt commit-API

Den korrekte retning er et smalt og eksplicit commit-lag.

Eksempler på acceptable API-former:

```ts
commitSection(pageKey, updater)
commitSectionValue(pageKey, next)
replaceSection(pageKey, next)
```

Krav til disse operationer:

1. beregn `next`
2. schema-validér `next`
3. serialisér `next`
4. skriv til `sessionStorage`
5. commit til store
6. notificér subscribers

Hvis trin 2-4 fejler, må trin 5 ikke ske.

Det er det modelmæssigt korrekte fail-closed commit-flow.

---

### 7.6 Korrekt håndtering af drafts

Draft skal ligge i:

- `useDraftField`
- `useRowDrafts`
- eller tilsvarende UI-nære hooks

Committed persisted state skal ikke kopieres lokalt i et generelt persistence-hook.

Det giver et klart skel:

- `draft hook`: UI-interaktion
- `persisted hook`: committed read + commit

---

### 7.7 Korrekt EO/EET read-model

For EO-importen af midlertidigt EET bør page-niveauet fortsat eje orkestreringen, men selve read-model-opbygningen bør ideelt pakkes ud i et dedikeret modul/hook.

Korrekt retning:

- `Erstatningsopgoerelse` ejer at funktionen findes
- et dedikeret hook/modul bygger `midlertidigtEetInsertSource`
- `OffentligeYdelserTab` modtager en read-only, schema-sikker værdi

Det bevarer kontrakten om page-niveau orkestrering, men undgår at page-komponenten samler for meget cross-section hydrering inline.

---

## 8. Beslutning: Hvad bør ændres, og hvad bør ikke ændres nu

### 8.1 Bør ændres

- den dobbelte committed state-model
- `usePersistedForm` som blandet hook
- `handleChange` i persistence-hooken
- commit-flow der sætter lokal committed state før autoritativ commit
- providerens rolle som aktiv render-broker for sektion-læsning

### 8.2 Bør ikke ændres ukritisk

- atomisk load-/rollback-flow i `replaceAllPersistedData`
- revisions- og epoch-modellen i storen
- field-error-modellen
- `useRowDrafts`-kontraktens resync-semantik
- domænegrænserne for EO’s read-only EET-import

### 8.3 Samlet vurdering

Ja, flowet **kunne og burde** bygges op på en bedre måde.

Ikke fordi den aktuelle kode nødvendigvis er ustabil i hverdagsscenarier, men fordi den nuværende model:

- er mere kompleks end den bør være
- skaber en hel klasse af fejl, som er svære at opdage tidligt
- ikke matcher kontrakterne så rent, som den burde

Den korrekte retning er **ikke** en bred opportunistisk refactor, men en kontrolleret arkitekturoprydning med tydelige stadier.

---

## 9. Implementeringsplan

Planen nedenfor er skrevet som en konkret gennemførselsplan, ikke bare som idéer.

Målet er:

- nul konkurrerende committed state-lag
- nul persistence-sideeffects i state-updaters
- nul `onChange`-lækager til committed persistence
- tydelig opdeling af ansvar

---

### Stadie 0: Beskyt nuværende adfærd med tests

**Formål**  
Inden strukturen ændres, skal de vigtigste invariants være dækket af tests.

**Tilføj eller styrk tests for:**

- normal commit på persisted form-felter
- sekventielle commits med updater-funktioner
- reset-flow
- load-flow og `authoritativeSnapshotEpoch`
- `formVersion` som resync-token for tabel-drafts
- failure-path når persistence-validering afviser data
- EO-flowet for indsættelse af midlertidigt EET

**Succeskriterium**

- Der findes tests der beskriver ønsket committed-semantik før den interne implementering ændres.

---

### Stadie 1: Fjern `handleChange` fra `usePersistedForm`

**Formål**  
Eliminere et API der inviterer til kontraktbrud.

**Arbejdet**

1. Find alle callsites der bruger `handleChange` fra `usePersistedForm`.
2. Erstat dem med korrekt commit-semantik:
   - `useDraftField` hvor det er enkeltfelter
   - eksplicit commit-handler hvor feltet allerede har særlogik
3. Fjern `handleChange` fra hookens returtype og implementation.

**Hvorfor dette er først**

- Det er en relativt lille ændring.
- Den reducerer risiko for fremtidige fejl inden den større refactor.

**Succeskriterium**

- `usePersistedForm` eksponerer ikke et `onChange`-lignende commit-API.

---

### Stadie 2: Indfør eksplicit skel mellem normal commit og autoritativ replace

**Formål**  
Gøre API’et semantisk korrekt.

**Arbejdet**

1. Bevar eller introducér et API for normal commit, fx:
   - `commitValues(updater)`
   - eller andet navn der tydeligt signalerer committed write
2. Indfør `replaceValues(next)` til:
   - reset
   - load
   - migration
   - andre autoritative erstatninger
3. Sørg for at kun `replaceValues` bumper `formVersion`.
4. Migrér callsites der i dag bruger normal `setValues` til noget der reelt er replace.

**Succeskriterium**

- API’et skelner tydeligt mellem:
  - normal committed mutation
  - autoritativ værdierstatning

---

### Stadie 3: Flyt committed læsning i `usePersistedForm` til direkte store-subscription

**Formål**  
Fjerne den dobbelte committed state.

**Arbejdet**

1. Erstat lokal `useState` for committed values i `usePersistedForm` med direkte subscription til `formPersistenceStore`.
2. Fjern `valuesRef` som synkroniseringsbro.
3. Sørg for at hookens `values` altid kommer fra storen.
4. Bevar `formVersion` til draft-resync, men lad den styres af autoritative replace-events.

**Vigtigt**

Dette er det vigtigste stadie og det med størst risiko. Det må ikke blandes sammen med opportunistiske ændringer.

**Succeskriterium**

- `usePersistedForm` holder ikke en lokal committed kopi af sektionen.

---

### Stadie 4: Flyt commit-operationen til et autoritativt commit-lag

**Formål**  
Gøre commit atomisk og modelmæssigt korrekt.

**Arbejdet**

1. Indfør en dedikeret commit-operation i store-/infrastrukturlaget.
2. Lad denne operation eje hele commit-sekvensen:
   - beregn næste værdi
   - valider
   - serialisér
   - skriv til storage
   - commit til store
3. Sørg for at UI først opdateres ved store-notification.

**Designregel**

UI må ikke have en committed værdi, som storen ikke allerede har accepteret.

**Succeskriterium**

- normal commit er én autoritativ operation, ikke en synk mellem lokal state og store.

---

### Stadie 5: Reducér `FormPersistenceContext` til infrastruktur

**Formål**  
Fjerne unødigt render-led og gøre ownership tydeligt.

**Arbejdet**

1. Fjern providerens subscription til section-data, hvis den ikke længere er nødvendig for hooks.
2. Lad provideren fokusere på:
   - hydration
   - storage-sync
   - load/replace
   - notices
3. Vurdér om nogle læsefunktioner kan erstattes af direkte store-selectors.

**Succeskriterium**

- Provideren er primært infrastruktur, ikke et aktivt state-broker-lag for almindelige sektion-læsninger.

---

### Stadie 6: Udpak cross-section read-models hvor de er på vej til at blive mønstre

**Formål**  
Bevare page-niveau orkestrering uden at page-filerne bliver schema-hydreringsknudepunkter.

**Arbejdet**

1. Flyt `midlertidigtEetInsertSource`-bygningen ud i et dedikeret hook/modul.
2. Lad dette hook være ansvarligt for:
   - selectors
   - schema-sikring
   - mapping til read-model
3. Lad page-komponenten kun orkestrere brugen af den.

**Succeskriterium**

- Cross-section read-models er tydelige, genkendelige og ikke spredt som ad hoc `useMemo`-blokke i flere pages.

---

### Stadie 7: Efterkonsolidering og dokumentation

**Formål**  
Sikre at den nye arkitektur bliver vedvarende og ikke glider tilbage.

**Arbejdet**

1. Opdatér eller opret kontrakt-/arkitekturdokumentation, hvis den nye struktur er vedtaget som varig regel.
2. Dokumentér eksplicit:
   - at storen er eneste committed sandhed
   - at persistence-hooks ikke må holde lokal committed kopi
   - at `onChange` aldrig må føre til committed persistence
3. Tilføj review-checkpoints eller tests der fanger:
   - sideeffects i state-updaters
   - nye `handleChange`-lignende APIs i persisted hooks

**Succeskriterium**

- Arkitekturen er ikke kun implementeret, men også institutionaliseret.

---

## 10. Risici ved implementeringen

### 10.1 Høj risiko

- brud på tabel-draft-resync hvis `formVersion`-semantikken ændres uklart
- uventede render-regressioner ved flytning fra lokal state til store-subscription

### 10.2 Medium risiko

- callsites der implicit afhænger af nuværende `usePersistedForm`-adfærd
- tests der karakteriserer nuværende implementation details i stedet for ønsket kontrakt

### 10.3 Lav risiko

- EO-specifikke read-model-kompositioner, hvis de udtrækkes til dedikerede hooks uden at ændre domænelogikken

### 10.4 Risikostyring

- gennemfør stadierne sekventielt
- hold ændringsfladen snæver pr. stadie
- kør typecheck og relevante testpakker efter hvert stadie
- undgå at blande adfærdsændringer og arkitekturoprydning i samme commit

---

## 11. Endelig anbefaling

Den nuværende persistence-arkitektur er funktionel, men strukturelt svagere end den bør være for et trust-kritisk system.

Den korrekte arkitektur er:

- `formPersistenceStore` som eneste committed runtime-sandhed
- `sessionStorage` som durable persistence, ikke runtime-sandhed
- provider som infrastruktur, ikke almindeligt read-broker-lag
- draft hooks til draft
- persisted hooks til committed read + eksplicit commit
- cross-section read-models som dedikerede page-nære domænemoduler

Det bør implementeres trinvis. Den vigtigste arkitekturændring er ikke “ret den konkrete bug”, men:

**fjern den dobbelte committed state-model og gør committed persistence til én autoritativ, atomisk operation.**

---

## 12. Hvad dette dokument ikke gør

Dette dokument:

- beslutter ikke konkrete funktionsnavne endeligt
- ændrer ikke kontrakter i sig selv
- kræver ikke at hele refactoren sker på én gang

Det gør kun én ting:

Det fastlægger et klart, teknisk forsvarligt billede af:

- hvad problemet er
- hvordan den rigtige arkitektur ser ud
- hvordan den kan implementeres uden at sænke sikkerheden undervejs

