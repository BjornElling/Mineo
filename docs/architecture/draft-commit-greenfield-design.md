# Greenfield-design for draft, afsluttet input og commit

**Status:** Fase 0–3 er gennemført. Fase 4 er delvist gennemført: det greenfield-fundament, fasen manglede
(generiske katalog-accessorer, et forseglet produktions-`InputCatalog`, en typed-command-sti gennem
transaktionsrunneren og katalog-routing af skalar-commits), er bygget og kontrakttestet, og referencedomænerne
Satser + Renteberegning er routet gennem det typed spor. Den samlede felt-editor-livscyklus (`useDraftLifecycle`)
er nu bygget og driver begge feltmotorer, tekst-, års- og ugeinputfamilierne bruger én fælles codec-autoritet på
begge overflader, og brøkinputtets Styled-felt bruger nu også sit fælles codec.
Resten af fase 4 (heltal/procent/beløb/dato-codec-cutover — bevidst afgrænset, se nedenfor —, rækkeinfrastruktur uden
værdi-drafts, celle-/tabelmigration, strukturel adresse-cutover og sletterne) udestår.
Fase 5–8 er ikke påbegyndt.

**Dato:** 2026-07-15

**Type:** Informativ målarkitektur. De normative kontrakter blev konvergeret i fase 1, og implementeringen til og med
fase 3 følger dem.

**Scope:** Persisterede formularfelter og tabelceller, beregninger, dokument-output, `.eo`-save, `sessionStorage` samt undo/redo

---

## 0. Konklusion på den kritiske gennemgang

Den hidtidige plan har den rigtige kerneinvariant, men den valgte migrationsretning er ikke tilstrækkeligt greenfield.
Planen har behandlet eksisterende mekanismer som midlertidige, samtidig med at implementeringen har udbygget dem med
flere bindinger, specialiserede nøgler, reconcile-effekter, coalescing og domænevise oversættelser. Det har rettet
konkrete fejl, men også gjort overgangsarkitekturen større.

Slutmålet ændres derfor fra "gør de eksisterende kanaler obligatoriske" til følgende fire sammenhængende grænser:

1. **Én autoritativ inputaggregate** for schema-gyldige værdier og afsluttede ugyldige input.
2. **Én transaktionsgrænse** for alle afsluttede brugerhandlinger, strukturelle rækkeændringer, reset, load og undo/redo.
3. **Én feltmotor og ét codec-system** for almindelige felter og tabelceller; UI-overfladerne må kun eje forskellig
   aktivering, rendering og navigation.
4. **Én ikke-omgåelig read-/projektionsgrænse** mellem input og beregning, validering, save og dokument-output.

Eksisterende `invalidDrafts`, `fieldErrors`, `useDraftField`, `useTableInputCore`, `useRowDrafts`,
`FormPersistenceContext` og domænespecifikke `InputBlocker`-byggere er migrationskilder eller facadepunkter — ikke
slutarkitektur. Der må ikke bygges flere domæner oven på deres nuværende offentlige API'er.

Den seneste implementering i renteberegning og Satser bevares som regressionbeskyttelse og adfærdsmæssig reference,
men dens lokale projektioner og nøglefortolkning skal migreres igen til den fælles kerne.

## 1. Produktinvarianter, designet skal bevare

Dette design ændrer ikke beregningsregler, dato-/range-regler, dokumentindhold eller den godkendte brugeroplevelse.
Arkitekturen skal bevare følgende:

1. **Ingen live preview.** Tastning ændrer kun den åbne draft. Mens editoren er åben, bygger visning, beregning og
   download-gate uændret på den senest afsluttede inputtilstand. En gyldig tilstand forbliver gyldig; en allerede
   ugyldig tilstand forbliver blokeret. Den åbne draft må hverken skjule/vise indhold eller åbne/lukke gates.
2. **Afslutning sker ved de eksisterende grænser.** Formularfelter afsluttes ved blur/Enter. Dropdownvalg og
   toggle/radio committer straks. Delete/Backspace i en fokuseret, lukket celle rydder og committer straks.
3. **Canonical data er altid Zod-gyldige.** Ugyldig rå tekst må aldrig placeres i domænesektionerne.
4. **Afsluttet ugyldigt input er aktuelt input.** En tidligere gyldig værdi må ikke nå en afhængig beregning, save eller
   dokumentmodel, mens feltet indeholder en afsluttet ugyldig værdi.
5. **Den rå ugyldige tekst bevares.** Den skal overleve navigation, remount, F5, undo og redo i den aktive session.
6. **Afledt output fail-closer præcist.** Enhver afsluttet fejl i et felts dokumentgrundlag — herunder missing,
   ugyldigt format, range/bounds eller domæneregel — blokerer det afhængige dokument. Dets downloadknap er både visuelt
   og funktionelt disabled. En gyldig række må ikke blokeres af en anden rækkes fejl, mens et aggregat, der inkluderer
   begge rækker, skal blokeres.
7. **Save/load forbliver trust-kritisk.** `.eo` indeholder kun schema-valideret brugerinput. En synlig afsluttet
   ugyldig værdi må aldrig erstattes stiltiende af en ældre gyldig værdi i filen.
8. **Én brugerhandling giver ét undo-trin.** Restore genskaber afsluttet tekst, feltstatus, beregningsstatus og gates
   som én sammenhængende tilstand.
9. **Ingen korrekthed afhænger af timing.** Microtasks, timeouts, render-rækkefølge og effekt-rækkefølge må ikke indgå i
   commit-, persistence-, gate- eller history-korrekthed.
10. **Brugervendt fejltekst er fortsat den godkendte danske ordlyd.** `missing`, `invalid` og eksisterende
    range/bounds-årsager er maskinlæsbare og formateres centralt.

## 2. Det den hidtidige plan tog fejl af

### 2.1 En aggregate er ikke tre offentlige slices

Den nuværende runtime har schema-gyldige sektioner, `invalidDrafts` og `fieldErrors` som selvstændigt læsbare og
skrivbare kanaler. `finalizeEdit` i Zustand-storen gør ikke i sig selv helheden atomisk, fordi parsing,
`sessionStorage`, history-capture og flere fallback-skriveveje fortsat ligger udenfor.

**Rettelse:** Slutarkitekturen eksponerer kun en samlet inputaggregate og en samlet transaktionsrunner. Gyldige værdier
og afsluttede ugyldige input kan godt have forskellige interne repræsentationer, men de kan ikke læses, skrives,
versioneres eller gendannes uafhængigt.

### 2.2 `finalizeEdit` er for snæver som universel mutation

Et felt-finalize er kun én af flere inputtransaktioner. Add/delete/reorder af rækker, styrende valg, reset, load og
undo/redo ændrer også den autoritative inputtilstand. Den hidtidige plan har derfor fået valgfri options som
`clearInvalidDraft` og `clearInvalidDrafts`, der flytter strukturel viden ud til callsites.

**Rettelse:** Én transaktionsrunner modtager typed commands. Feltmotoren udsteder en `settleField`-command;
rækkeinfrastrukturen udsteder strukturelle commands; load/reset/undo bruger deres egne commands. Alle går gennem samme
validering, persistence, history og revisionsmodel.

### 2.3 Feltidentitet må ikke være en formatteret streng

Nuværende feltidentiteter findes i flere strengformater. Tabelceller bruger blandt andet tabel-id, valgfrit scope,
row-id og kolonneindeks sammenkædet med kolon. Domænekode parser derefter strengen igen for at finde label og scope.
Det er parallel logik og gør UI-geometri til persistent identitet.

**Rettelse:** Feltadresser er strukturelle og typed. En tabelcelle adresseres med sektion, samling, eventuelt
entity-scope, stabilt row-id og feltnavn. Kolonneindeks indgår aldrig. Serialisering findes ét sted og er versioneret.

### 2.4 Scope skal udledes af dependencies, ikke påsættes fejl

`global | section | row` er en for grov og manuelt vedligeholdt klassifikation. Et `rowId` er ikke globalt unikt, og
samme felt kan være relevant for én consumer og irrelevant for en anden. Når hver domænebygger selv tildeler scope,
opstår den lokale logik, planen skulle fjerne.

**Rettelse:** En consumer deklarerer de konkrete feltreferencer eller samlinger, den afhænger af. En blocker bærer
feltreferencen og årsagen; relevansen følger af consumerens dependency-set. Per-række- og aggregatprojektioner er
dermed to sammensætninger af samme dependencies, ikke to gate-implementeringer.

### 2.5 En projektion må ikke modtage bypass-data

De nuværende referenceprojektioner modtager canonical værdier og `invalidDrafts` som separate argumenter. Det kræver,
at hver projektion manuelt matcher de to datasæt korrekt, og det er fortsat muligt at kalde beregningsmotoren direkte
med canonical data.

**Rettelse:** Projektioner modtager kun en read-only `InputReader`, som resolver en typed feltreference til dens
afsluttede tilstand. Domænekode kan ikke få den tidligere canonical værdi fra en ugyldig feltgren. De rene
beregningsmotorer modtager først almindelige typed data efter en succesfuld projektion.

### 2.6 Tre draft-mekanismer er ikke konvergens

`useDraftField`, `useTableInputCore` og `useRowDrafts` overlapper på draft-resync, commit, fokus, invalid-state og
history-origin. Især dynamiske tabeller har både en række-draft og en celledraft for samme værdier.

**Rettelse:** Én felt-editor-state machine ejer den åbne draft og dens start-snapshot. Form- og grid-adaptere ejer kun
overfladespecifik aktivering/navigation. Dynamiske tabeller har ingen kopi af alle cellers værdier som `draftRows`;
rækkeinfrastrukturen ejer kun stabile rækker og add/delete/reorder.

### 2.7 Afledte fejl skal ikke være history-data

De fleste `fieldErrors` kan udledes deterministisk af afsluttet input, domæneregler og settings. Når de lagres,
rapporteres fra mounted komponenter og snapshotttes i history, kan fejltilstand afvige fra inputtilstand og afhænge af,
om en fane har været mounted.

**Rettelse:** Parsefejl udledes af afsluttet ugyldigt input og feltets codec. Range-, schema- og domænefejl udledes af
rene validatorer/projektioner. Kun reelle, ikke-afledelige systemfejl har særskilt runtime-state; de er ikke feltinput
og indgår ikke i undo/redo.

### 2.8 Implementeringshistorik hører ikke til i målarkitekturen

Commit-hashes, tidligere review-dialog, midlertidige statusprocenter og statiske testtællere har gjort dokumentet
svært at bruge som beslutningsgrundlag og bliver hurtigt forældede.

**Rettelse:** Dette dokument beskriver mål, rækkefølge, acceptkriterier og den aktuelle status på faseniveau. Detaljeret
implementeringshistorik og testtal hører fortsat til i git og handoffs. Midlertidige afvigelser skal have en
udløbsbetingelse i kode eller plan — ikke en permanent kronologi her.

## 3. Målmodel

### 3.1 Tre semantiske niveauer

| Niveau | Levetid | Må være ugyldigt | Undo/redo | Beregning/output |
|---|---:|---:|---:|---:|
| Åben draft | Mens editoren er åben | Ja | Nej | Aldrig |
| Afsluttet input | Indtil næste afslutning/reset/load | Ja | Ja | Kun via projektion |
| Domæneprojektion | Afledt af ét snapshot | Nej | Genafledes | Ja |

`commit` reserveres i ny kode til den atomiske inputtransaktion. Feltets hændelse hedder `settle`/`finalize`, fordi
både et gyldigt og et ugyldigt resultat afslutter redigeringen.

### 3.2 Autoritativ inputaggregate

Den konceptuelle model er:

```ts
type PersistedInputState = Readonly<{
  sections: FormPersistenceSections;
  rejectedInputs: Readonly<Record<SerializedFieldAddress, RejectedInput>>;
}>;

type InputRuntimeState = Readonly<{
  input: PersistedInputState;
  revision: InputRevision;
}>;

type RejectedInput = Readonly<{
  raw: string;
}>;
```

For en konkret `FieldRef<T>` resolver read-modellen:

```ts
type SettledFieldState<T> =
  | Readonly<{ status: 'valid'; value: T }>
  | Readonly<{ status: 'invalid'; raw: string }>;
```

Regler:

- Et matchende `rejectedInputs`-entry maskerer altid den canonical værdi.
- Den gyldige visning formateres af feltets codec; `displayValue` lagres ikke parallelt.
- Tom tekst parser til den feltdefinerede tomme canonical værdi, typisk `undefined`. `missing` afgøres senere af den
  consumer, som kræver feltet.
- `revision` er en monotont stigende runtime-token. Den persisteres ikke som brugerdata og gendannes ikke fra history.
  Undo, redo, load og reset skaber en ny revision i stedet for at genbruge en gammel.

### 3.3 Feltdefinition, feltreference og adresse

Identitet, inputsemantik og præsentationsmetadata skal være forbundet, men ikke sammenblandet:

```ts
type FieldDefinition<T> = Readonly<{
  codec: FieldCodec<T>;
  label: string;
  controlKind: 'text' | 'choice' | 'toggle';
  focusTarget: FieldFocusTarget;
}>;

type FieldRef<T> = Readonly<{
  address: FieldAddress;
  definition: FieldDefinition<T>;
}>;
```

- `FieldAddress` beskriver data strukturelt, ikke DOM eller tabelgeometri.
- Statiske felter defineres én gang. Dynamiske entity-/række-felter dannes af typed builders.
- Samme `FieldRef` bruges ved rendering, settle, fejl, projektion, save-gate, history-origin og fokus-restore.
- Label, kontroltype og fokusdestination slås aldrig op ved at parse en fri streng.
- Persistente adresser valideres mod det kendte feltkatalog og har egen migrationsversion.

### 3.4 Fælles codecs

Hver inputfamilie har ét codec, som genbruges af både formular- og tabeloverfladen:

```ts
type FieldCodec<T> = Readonly<{
  parseForSettle(raw: string): FieldResolution<T>;
  format(value: T): string;
  formatForEdit(value: T): string;
  acceptsInitialKey(key: string): boolean;
  normalizePaste?(raw: string): string;
}>;
```

Dato, beløb, procent, heltal, brøk, uge, år og tekst må ikke have separate form-/table-parsere eller fingerprints.
`format` ejer den lukkede visning, mens `formatForEdit` ejer den tekst, editoren åbner med. Forskellen er nødvendig for
fx beløbsudtryk, hvor den lukkede visning er formateret som et beløb, men den indtastede udtryksform skal bevares til
næste redigering. Domæne-bounds er validator-/projektionsansvar, medmindre de er en del af selve syntaksen.

Paste normaliseres efter én fælles afskæringsregel: Behold feltets tilladte format og afskær fra højre til det længste
præfiks, der kan rummes af format, præcision, cifferloft og et aktivt commit-interval. Et heltalsfelt fjerner separator
og hele decimaldelen uden afrunding; et decimalaktiveret felt bevarer decimalerne op til sin præcision. Gyldige
beløbsoperatorer bevares som udtryk. `infer` for tocifrede år bruger fortsat en løbende kalenderårsgrænse: `20xx` til
og med fem år efter det aktuelle kalenderår, derefter `19xx`. Denne grænse må ikke fastlåses til et bestemt årstal.
Datoens syntaktiske dag- og månedsgrænser følger afskæringsreglen. Kronologiske min/max-datobounds gør ikke: at
afskære en årdel kan flytte datoen til et andet århundrede og er derfor en værdiforvanskning. Sådanne bounds udledes
fortsat som issues efter settle, uanset om de er statiske eller afhænger af andre felter.

### 3.5 Én felt-editor-state machine

En fælles reducer/state machine ejer:

- lukket/fokuseret/åben editorstatus,
- lokal rå draft,
- settled start-snapshot for cancel,
- touched-status,
- settle ved blur/Enter eller kritisk handling,
- undertrykkelse af det efterfølgende blur efter cancel,
- resync ved autoritativt snapshot-skift.

Form- og grid-adaptere må kun tilføje rendering, hit-area, celle-navigation, kopiér/indsæt-integration og registrering
i `CriticalActionCoordinator`. De må ikke parse, skrive persistence, holde en alternativ invalid-state eller beslutte
history-semantik.

### 3.6 Dynamiske tabeller

Rækkeinfrastrukturen ejer kun:

- stabil row-identitet,
- rækkefølge,
- add/delete/reorder,
- eventuelle tomme UI-rækkers eksplicitte livscyklus.

Den ejer ikke en `draftRows`-kopi af celleværdierne. Hver celle bruger feltmotoren og en strukturel `FieldRef`.

En tom UI-række, der modtager sit første afsluttede input, promoveres atomisk til en rigtig række. Dette gælder også,
hvis det første input er ugyldigt, så teksten kan overleve F5. Sletning af en række fjerner rækken og alle dens
tilknyttede rejected inputs i samme transaktion. Orphan-state skal være urepræsenterbar; reconcile-effekter er ikke en
del af slutarkitekturen.

## 4. Transaktions- og persistencearkitektur

### 4.1 Én command-runner

Alle autoritative ændringer går gennem én intern operation:

```ts
executeInputTransaction(command, origin): InputTransactionResult
```

Command-familien omfatter mindst:

- `settleField` — gyldig værdi eller ugyldig rå tekst,
- `commitImmediateField` — dropdown/toggle/radio og lukket-celle-clear,
- `insertRow`, `deleteRow`, `reorderRows`,
- `settleFieldInNewRow` — atomisk promovering af en tom UI-række og dens første settle,
- `resetSection`, `replaceCase`, `clearCase`,
- `undo`, `redo`.

Der findes ingen offentlige operationer svarende til `commitInvalidDraft`, `clearInvalidDraft`, `setFieldError`,
`commitSection` eller `persistData`. En styrende ændring, som efter gældende produktregel rydder afsluttede ugyldige
input i felter, der bliver skjult, udtrykkes som én typed domænecommand/relevansregel — ikke som en callsite-liste af
strengnøgler.

### 4.2 Transaktionsforløb

For hver command:

1. Læs ét aktuelt runtime-snapshot.
2. Anvend en ren reducer og byg kandidattilstanden.
3. Validér berørte canonical sektioner med deres eksisterende Zod-schemas.
4. Validér alle rejected adresser mod feltkataloget og rejected-input-schemaet.
5. Afvis en semantisk no-op uden history, storage-write eller revisionsstigning.
6. Serialisér hele inputenvelopen.
7. Skriv den ene inputnøgle i `sessionStorage`.
8. Opdatér inputaggregate og history i ét Zustand-write og stig revisionen præcis én gang.

Hvis et uventet trin fejler, gendannes storage og runtime til før-snapshot. Ingen deltilstand må blive observerbar.

### 4.3 Én session-envelope

Persisteret sagsinput i den aktive browser-session samles under én Mineo-ejet `sessionStorage`-nøgle:

```ts
type InputEnvelope = Readonly<{
  envelopeVersion: string;
  fieldAddressVersion: string;
  persistedDataVersion: string;
  input: PersistedInputState;
}>;
```

Det giver én reel browser-write pr. inputtransaktion og fjerner behovet for rollback hen over en sektionsnøgle og en
separat invalid-draft-nøgle. UI-sessionstate som aktive faner forbliver i sine egne manifest-ejede nøgler.

Den nuværende per-sektion-storage og invalid-draft-envelope migreres én gang ved startup:

- alle gamle nøgler læses uden mutation,
- de valideres og oversættes til strukturelle feltadresser,
- den nye envelope skrives og genlæses/verificeres,
- først derefter fjernes de gamle nøgler.

Ved migrationsfejl bevares de gamle nøgler uændret, runtime anvender ikke et delvist snapshot, og brugeren får den
eksisterende eksplicitte systemfejl. Der etableres ikke permanent dual-read eller dual-write.

### 4.4 `.eo`

`.eo`-formatet forbliver canonical og indeholder ikke rejected inputs. Save-flowet er:

1. klargør åben editor gennem commit-barrieren,
2. læs et nyt input-snapshot,
3. kræv global save-projektion uden relevante rejected inputs eller øvrige save-blokeringer,
4. byg canonical sagsdata,
5. validér med de samme Zod-schemas,
6. serialisér og skriv filen.

Load preflighter `.eo` som hidtil, oversætter et godkendt canonical snapshot til gyldige settled felter og erstatter
hele inputaggregaten i én transaktion. Ukendte/fjernede `.eo`-felter og manglende nyere felter følger fortsat
persistence-kontraktens tolerante regler.

### 4.5 Undo/redo

History ligger i samme runtime-store som inputaggregaten og snapshotter kun autoritativ inputdata samt fokus-origin.
Afledte fejl, beregninger og gates gemmes ikke.

- Capture sker i samme Zustand-write som den forward mutation, den beskriver.
- Restore erstatter inputdata og skaber en ny monoton revision.
- `sessionStorage` skrives før det observerbare runtime-write og rulles tilbage ved fejl.
- Coalescing-markører, `queueMicrotask` og separate restore-kanaler fjernes.
- Fokus-origin bruger `FieldRef`, ikke DOM-fallback eller kolonneindeks.

## 5. Read-model, validering og projektioner

### 5.1 Ikke-omgåelig `InputReader`

Kun inputinfrastrukturen kan se aggregatens interne `sections` og `rejectedInputs`. Den eksponerer et read-only snapshot:

```ts
type InputReader = Readonly<{
  revision: InputRevision;
  read<T>(field: FieldRef<T>): SettledFieldState<T>;
  listEntities(collection: CollectionRef): readonly EntityRef[];
}>;
```

Domæne-, beregnings-, save- og dokumentkode må kun modtage `InputReader` eller en allerede godkendt typed projektion.
Rå selectors til canonical sektioner begrænses til input-editorfacaden og migrationsinfrastrukturen.
`listEntities` eksponerer kun stabil identitet og rækkefølge; feltværdier skal stadig læses gennem `read(FieldRef)`, så
en collection-læsning ikke bliver en bypass til maskeret canonical data.

### 5.2 Dependency-baseret projektion

En projektion definerer sine dependencies eksplicit. Den fælles evaluator:

1. resolver hvert afhængigt felt,
2. producerer `invalid` for rejected input,
3. lader domænespecifikke requirements producere `missing`, range/bounds eller rule-blockers,
4. bygger kun data, hvis alle relevante dependencies er anvendelige.

```ts
type InputProjection<T> =
  | Readonly<{
      status: 'ready';
      data: T;
      issues: readonly InputIssue[];
      revision: ReadyInputRevision;
    }>
  | Readonly<{
      status: 'blocked';
      blockers: readonly InputBlocker[];
      issues: readonly InputIssue[];
      revision: InputRevision;
    }>;
```

En `InputBlocker` bærer `FieldRef`, reason og eventuel domænedetalje. Den bærer ikke et manuelt `global/section/row`-
scope. En per-række-consumer afhænger af fælles felter plus den konkrete rækkes felter; et aggregat afhænger af fælles
felter plus alle inkluderede rækker. Dermed kan scope ikke drifte fra datarelationen.

Issues følger begge grene, så warnings og canonical range-/bounds-fejl ikke tabes i en ellers `ready` beregning.
Blockers er consumerens kontekstafhængige delmængde af issues; beregningsblokering er ikke et globalt issueflag. Save-policy er
eksplicit på issueet, mens ethvert dokumentrelevant issue med `severity: 'error'` følger den fælles dokumentblokering.

### 5.3 Beregninger

Rene beregningsmotorer ændres ikke og modtager fortsat deres eksisterende typed input. Forskellen er alene, at inputtet
først kan bygges af en `ready` projektion.

Mens en editor er åben, genbruges projektionen fra den senest afsluttede inputtilstand. At åbne editoren eller skrive i
den må derfor ikke få beregnede sektioner til skiftevis at blive skjult og vist. Først settle-transaktionen udsteder en
ny revision og genberegner projektionen.

Et afsluttet ugyldigt afhængigt felt betyder derfor:

- motoren kaldes ikke med den skjulte tidligere værdi,
- den berørte beregnede visning bruger sin eksisterende ikke-beregnet-/fejltilstand,
- uafhængige beregninger fortsætter.

Range/bounds-værdier er fortsat canonical og følger de eksisterende domæneregler. Dette design ændrer ingen formel,
afrunding, sats, clamping eller datoafgrænsning.

### 5.4 Afledt fejlmodel

Felt- og kontrolfejl bygges af rene funktioner ud fra `InputReader`, domæneinput og relevante AppSettings:

- `invalid` fra rejected input + feltcodec,
- `missing` fra consumerens requirement,
- range/bounds fra canonical værdi + konkrete grænser,
- schema/rule fra domænevalidatoren.

Samme issue-model driver rød feltmarkering, tooltip, fejl-/advarselsbokse, save-gate og dokument-gate efter deres
respektive policy. Alle relevante issues med fejlseverity blokerer dokument-output, også når range/bounds fortsat har
en canonical værdi og efter den særskilte save-policy ikke blokerer `.eo`-save. Mounted komponenter rapporterer ikke
fejl til en central store, og unmount kan derfor ikke fjerne en ellers gældende fejl.

## 6. Kritiske handlinger og dokument-output

### 6.1 Commit-barrieren

`CriticalActionCoordinator` bevares som den eneste runtime-barriere. Den klargør form/grid og afventer persistence; den
ejer ikke domæneregler.

Den reaktive download-gate læser kun senest afsluttede input. Hvis en relevant editor er åben, kan knappen derfor godt
være aktiv på baggrund af en tidligere gyldig tilstand; den åbne draft valideres ikke og ændrer ikke visningen.

Ved et almindeligt pointerklik forlader fokus feltet før browserens efterfølgende click-event. Feltets blur udfører den
synkrone settle-transaktion, og den nye revision gør straks knappen disabled, hvis inputtet blev afsluttet med en fejl.
Browseren kan dermed undertrykke click-eventet. Korrektheden må dog ikke afhænge af browser-/React-eventrækkefølgen:
selv hvis click-eventet leveres, eller handlingen aktiveres med tastatur/programmatisk, går den altid gennem samme
preflight og kan ikke nå dokumentservice eller fil-I/O på en blokeret revision.

Ved download:

1. finalisér en eventuelt åben editor gennem feltmotorens normale settle-sti,
2. afvent transaktionens eksplicitte resultat,
3. læs en ny `InputReader`,
4. byg dokumentets typed domæneprojektion og output-invariants,
5. start ingen lazy-load, generator eller fil-I/O ved blokering,
6. send kun et revisionsbundet `PreparedDocument<T>` til dokumentservicen.

Hvis settle giver en fejl, bliver knappen disabled. Når et click-event alligevel er nået frem til preflighten, stoppes
handlingen, feltet fokuseres uden scroll, og den eksisterende danske advarsel om ugyldigt input vises. Det er et sidste
sikkerhedsværn; normal pointeradfærd skal allerede have afsluttet editoren og opdateret den reaktive gate.

### 6.2 Én dokumentdefinition pr. output

Hvert dokument ejer en typed definition af dependencies, domæneprojektion og output-invariants. Den fælles
orchestrator ejer rækkefølgen ovenfor. Domænelogik placeres hverken i coordinatoren, React-click-handleren eller
`documentService`.

Den reaktive knap-gate og click-preflight evaluerer samme dokumentdefinition. Dokumentservicen kontrollerer revisionen
igen efter eventuelle async lazy-loads og umiddelbart før generatoren kaldes. En gammel godkendelse kan derfor ikke
bruges efter en ny inputtransaktion.

PDF og Word bruger samme preflight; formatvalg ligger efter gaten. Standalone MinProcesrente bruger samme input- og
revisionskerne, men bevarer sin særskilte app-shell og PDF-only-adfærd.

## 7. Revideret implementeringsplan

Implementeringen fortsætter ikke med flere domænevise patches på det nuværende `invalidDrafts`/`InputScope`-mønster.
Hver fase afsluttes med sin egen sletteliste; midlertidige facader må ikke blive permanente udvidelsespunkter.

### Fase 0 — Produktadfærd låses

**Status 2026-07-14:** Gennemført. Den godkendte Escape- og downloadadfærd er låst med tværgående kontrakt- og
integrationstests, herunder start fra allerede rejected input og den åbne draft før settle. Persisted felt- og
collection-stier genereres maskinelt fra Zod-schemas i
`greenfield-phase-0-persisted-input-inventory.json`; beregningsentrypoints, sagsfilstier og samtlige aktuelle
dokumentoutputs er fastlåst i `greenfieldPhase0Inventory.ts` med udtømmende coverage-test. Inventaret er kun
migrationsgrundlag og må ikke blive en parallel runtime-autoritet.

1. Fasthold den godkendte adfærd i §9 med karakteriseringstests før intern omskrivning.
2. Verificér særskilt, at åben draft ikke påvirker visning/gate, og at blur/finalize sker før dokument-preflight.
3. Inventariser alle persisted felter, dynamiske samlinger, beregningsentrypoints, save-paths og dokumentdefinitioner
   maskinelt, så planen ikke afhænger af et manuelt antal.

### Fase 1 — Normative kontrakter konvergeres

**Status 2026-07-14:** Gennemført. De normative tværgående kontrakter og domænekontrakter, `AGENTS.md`, de berørte
arkitekturdokumenter og begge reviewplaner beskriver nu målgrænserne. De afløste mekanismer er kun bevaret som
eksplicit migrationskode med en sletteliste.

Opdatér mindst:

- `form-contract.md`,
- `mineo-field-pattern.md`,
- `persistence-contract.md`,
- `undo-redo-contract.md`,
- `error-contract.md`,
- `critical-action-contract.md`,
- `document-output-contract.md`,
- `page-component-contract.md`,
- `snapshot-contract.md`,
- `schema-evolution.md`,
- `keyboard-navigation.md`,
- domænekontrakterne for Renteberegning, Satser, EO, EET, Forsørgertab, Årsløn og Varige mén.

Fjern normative krav om de konkrete overgangsmekanismer (`invalidDrafts` som offentlig kanal, tre draft-systemer,
kolonneindeks-identitet, komponentrapporterede `fieldErrors` og history-coalescing). Kontrakterne beskriver målinvarianter
og autoritative grænser, ikke filnavnene på midlertidig kode.

Opdatér i samme dokumentationscut `AGENTS.md`, undo/redo-, beregnings-, dokument-output-, EO-row-evaluation- og
EO-clamping-arkitekturen. Markér de berørte kandidater i `greenfield-review-plan.md` og `code-review-plan.md` som
historiske overgangstrin, så deres tidligere ✅-status ikke kan læses som krav om at bevare den afløste arkitektur.

### Fase 2 — Ren inputkerne uden React

**Status 2026-07-14:** Gennemført. Den rene kerne indeholder strukturelle feltadresser og refs, definitioner og fælles
codecs, Zod-dækket inputstate, typed commands og reducer, et forseglbart `InputCatalog`, `InputReader`, projektioner
og den fælles issue-/blocker-model. Kernen er kontrakttestet uden React eller Zustand. Registrering af produktets
faktiske feltbindinger hører til den samlede overflademigration i fase 4.

Implementér og test som rene moduler:

1. `FieldDefinition`, strukturel `FieldAddress`, `FieldRef` og typed builders.
2. Fælles codecs for alle eksisterende inputfamilier.
3. `PersistedInputState`, rejected-input-schema og resolver til `SettledFieldState`.
4. Typed inputcommands og ren transaktionsreducer.
5. Dependency-baseret `InputReader`/projektionskerne.
6. Fælles issue-/blocker-model og den allerede godkendte danske tekstformatering.

Felt- og collection-bindings registreres i ét `InputCatalog`, som forsegles før state-validering og læsning. Dynamiske
feltreferencer er kun gyldige, når alle entities i adressen findes i det konkrete snapshot; template-match alene er
ikke tilstrækkeligt. Current-formatets serialiserede feltadresse er byte-for-byte kanonisk, så samme felt ikke kan
optræde under flere rejected-input-nøgler.

Ingen eksisterende UI-hook må kopieres ind i kernen. Kernen skal kunne kontrakttestes uden DOM, React eller Zustand.

### Fase 3 — Runtime, storage og history udskiftes i ét cut

**Status 2026-07-14:** Gennemført. Runtime har én inputaggregate med fælles revision og history, én
versionsmærket session-envelope og én transaktionsrunner. Startup migrerer de tidligere sektionsnøgler og
`invalidDrafts` atomisk med read-back før kilderne slettes. Load, reset, clear, undo og redo går gennem samme runner;
der findes ingen sektionsvis runtime-write eller separat history-store. Indtil fase 4 er envelope-adresser eksplicit
mærket `legacy-bridge-1`; de kan ikke forveksles med katalogvalideret current-format.

1. Indfør én input-store med aggregate, monoton revision og history.
2. Indfør én session-envelope og atomisk startup-migration fra nuværende nøgler/adresser.
3. Route alle eksisterende persistencefacader gennem den nye transaktionsrunner uden dual-write.
4. Bevar kortvarigt kompatibilitetsfacader for eksisterende callsites, men gør dem interne og marker hele deres
   sletteliste i fasen.
5. Flyt load, reset, clear og undo/redo til commands.
6. Fjern den gamle store/history som autoritative kilder, før næste fase starter.

**Midlertidig sletteliste:**

- I fase 4 slettes `FormPersistenceContext`-inputfacaden, `formPersistenceStore`-/`undoRedoStore`-facaderne og deres
  test-only mutations, de afledte `sections`-/`invalidDrafts`-views og deres revisionscounters samt den strengbaserede
  `HistoryFrameOrigin`.
- I fase 4 erstattes `legacyInputCompatibility` og dens sentinel-adresser med katalogvaliderede `FieldRef`-adresser;
  eksisterende rejected input oversættes i samme atomiske address-migration. Orphan-reconcile-callsites slettes med
  den nye rækkeinfrastruktur. `legacyGridTransactionBridge` slettes samtidig med den effektbaserede grid-pipeline.
- I fase 5 slettes komponentrapporterede `fieldErrors` og de tilhørende store-metoder, når alle afledelige issues kommer
  fra de rene validatorer.
- I fase 7 slettes startup-læsning af de gamle sektions-/`invalidDrafts`-nøgler, den gamle sektions-envelope-builder
  og de gamle nøgler i storage-manifestet. Indtil da er de kun en engangsmigrationskilde og aldrig en runtime-fallback
  eller dual-write-destination.

### Fase 4 — Alle inputoverflader migreres horisontalt

**Status 2026-07-15:** Delvist gennemført — fundamentet og det komplette produktionskatalog (Etape A) samt
den delte draft-livscyklus og tekst-, års-, uge- og brøkinputfamiliernes fælles codec-cutover (første del af Etape B) er
gennemført. Celle-/række-cutover og de resterende inputfamiliers codec-cutover (heltal/procent/beløb/dato — bevidst
afgrænset, se nedenfor) samt sletterne udestår.

*Gennemført i Etape A — komplet katalog:*

- Generiske strukturelle canonical-accessorer navigerer `FieldAddress`/`CollectionRef` direkte over
  sektionsobjektet. Collection-bindings understøtter både custom entity-id-egenskaber og nested samlinger.
- Det forseglede produktions-`InputCatalog` registrerer samtlige persisted felter og samlinger i alle domæner,
  inklusive `aarsloen.tableData`, EO's `loenindkomstAnsaettelsesforhold` med alle nested standardløn-/
  lønudviklingstabeller samt `eoAngivetLoenLoenudvikling` med sine nested tabeller.
- Standardløn-tabellernes fire periodefelter bevarer deres eksisterende canonical strengrepræsentation gennem
  `createStringBackedFieldCodec` omkring de fælles heltals-, års- og ugecodecs. Parser, starttegn og
  paste-normalisering kommer dermed fra de fælles codecs, mens `.eo`-format og beregningsinput er uændret.
- `sfggAnsaettelsesforhold` er registreret med `ansaettelsesforholdId` som custom entity-id, og
  `forligAnsvarsgradBroek` bruger det fælles brøkcodec.
- Typed commands (`settleField`, `commitImmediateField`, insert/delete/reorder) går gennem den fælles
  transaktionsrunner. Migrerede top-level skalarer routes allerede gennem dette spor.

*Gennemført i Etape B — delt draft-livscyklus:*

- `useDraftLifecycle` (`src/hooks/fieldState/useDraftLifecycle.ts`) ejer nu den React-tynde draft-livscyklus,
  begge feltmotorer tidligere hånd-duplikerede: draft-state + eager `draftRef`, den optimistiske commit-guard
  (`pendingRef`), den autoritative epoch-resync (driver `decideFieldResync`) og settle-eksekveringen omkring
  `decideFieldSettle` (write-rejected / value-commit / clear / draft-sync + rollback i korrekt rækkefølge).
- `useDraftField` (form) og `useTableInputCore` (grid) driver den nu via *seams* (callbacks) i stedet for at
  reimplementere resync-effekten og pending-guarden. Bevarede surface-divergenser er eksplicitte seams:
  form har `inert`/ingen fingerprint-no-op og rydder bundet slot i sin `onCommit`-wrapper; grid har
  fingerprint-no-op, visual-fejl-state, staged rejected-clear og ruller en fejlet commit tilbage til den rene
  committede visning (`rollbackDraft`). Ren kontrakttest: `useDraftLifecycle.test.tsx`.
- Der er dermed én fælles felt-editor-livscyklus i normal runtime; de to hooks er tynde migrationsadaptere.
- Tekstinput har nu én immutable `textFieldCodec`, som både `StyledTextField`, `TableTextInput`-adapteren og
  katalogets tekstfeltdefinitioner bruger til canonical trimning og formatering. Lokal `validateOnCommit` ligger
  fortsat som feltets eksisterende validerings-seam efter codec-resolutionen. Surface-adapterernes forskellige
  første-tast-regler bevares, indtil deres samlede cutover kan fastlægge én regel uden en utilsigtet UX-ændring.
- Års- og ugeinput bruger nu henholdsvis `createYearFieldCodec` og `createWeekFieldCodec` til canonical parsing,
  formatering, første-tast-filter og paste på både Styled- og tabeloverfladen. Tabelmodellernes historiske
  strengrepræsentation bevares gennem `createStringBackedFieldCodec`. De eksisterende commit-blokerende årsbounds og
  præcise fejltekster ligger som eksplicitte migrations-seams efter codec-resolutionen, indtil fase 5 flytter dem til
  den rene issue-model; overfladernes eksisterende draft-længdetolerance er uændret.
- Brøkinput (`StyledFractionField`) bruger nu `createFractionFieldCodec` til canonical format, første-tast-filter og
  paste-normalisering — samme codec som katalogets brøkfelt `forligAnsvarsgradBroek`. Feltets egen `parseFraction`
  bevarer den finkornede danske fejlordlyd (codec'et returnerer kun valid/invalid). Ved en `maxDigits`-config-fejl
  bygges codec'et bevidst med default-`maxDigits`, så feltets tidligere PROD-adfærd (render + afvis via config-fejl)
  bevares i stedet for at codec-factory'ens assert kaster.

*Delvist gennemført — strukturel rejected-adresse for top-level felter:* Afsluttet ugyldigt input og rejected-clear for
et migreret **top-level** felt adresseres nu på feltets katalogvaliderede STRUKTURELLE adresse (ikke længere sentinel-
broen). `resolveRejectedInputAddress` er det ene sande sted for beslutningen (top-level → strukturel, celle/nested →
sentinel) og deles af migration, skrivning og rydning, så et felt aldrig kan optræde under to rejected-input-nøgler.
Det legacy `invalidDrafts`-view er byte-identisk (den strukturelle top-level-adresse projiceres tilbage til
`${section}.${feltnavn}`), så ingen endnu ikke migreret read-consumer påvirkes. Broen `stripCoexistingLegacyRejectedTwin`
er dermed slettet, og `buildTypedCandidate` er en tynd pass-through til den fælles reducer.

*Bevidst afgrænsning (udestår i fase 4):* Tabelceller og nested felter adresserer fortsat rejected input via sentinel-
broen, fordi deres feltmotorer endnu ikke resolver en strukturel `FieldRef` (celle-identitet er `rowId:colIndex`).
Sentinel-grenen i `resolveRejectedInputAddress` og `rejectedInputsToLegacyInvalidDrafts` fjernes sammen med celle-/
tabelmigrationen (Etape E).

*Bevidst afgrænset codec-cutover (heltal, procent, beløb, dato):* Disse familiers Styled-felter er IKKE cuttet over
i denne runde, fordi en tro cutover ikke er en ren refaktor på nuværende codec-form: (a) heltal-feltets `format`,
`getDraftForKey` og paste er enten trivielle eller rigere konfigureret (`enforceRange`-gatet paste, `effectiveMaxDigits`,
defensiv non-finite-`format`) end codec'et understøtter — dens parse/paste-primitiver er desuden allerede den fælles
kilde (A2), så en cutover ville tilføje forgrening frem for at fjerne duplikering; (b) procent/beløb har rigere
visningslogik (procentens decimal-hukommelse, beløbets `format` vs `formatForEdit`) som codec'ets nuværende samlede
`format` ikke replikerer. En korrekt cutover af disse kræver, at codec'ets `format`/`formatForEdit` faktisk adskilles
(§3.4) — en visnings-semantisk ændring, der skal UX-verificeres — og hører til en dedikeret runde. Tabel-adapterne for
disse familier har tilsvarende normaliserings-divergenser (fx integer-cellens `trimToAlphanumericEdges` vs codec'ets
numeriske kanttrimning), der ligeledes ville ændre observérbar adfærd.

*Resten af fasen (uændret plan):*

1. ~~Implementér den fælles felt-editor-state machine.~~ (Etape B ovenfor: `useDraftLifecycle`.)
2. Migrér samtlige Styled-felter og Table-inputs til de samme codecs og `settleField`.
3. Migrér dropdown/toggle/radio og lukket-celle-clear til `commitImmediateField`.
4. Erstat `useRowDrafts`/`useSliceRowDrafts` med rækkeinfrastruktur uden værdi-drafts.
5. Migrér alle feltidentiteter til strukturelle refs og den fælles fokusmekanisme.
6. Slet lokale invalid-state-fallbacks, invalid-input-reporterkanaler, fingerprints, celle-key-parsere og
   orphan-reconcile-effekter. Domænefejl-reportere fjernes først i fase 5, når deres rene validatorer er migreret.

Fasen afleveres ikke med to feltmotorer i normal runtime.

### Fase 5 — Validering og beregningsprojektioner migreres domænevis

**Status 2026-07-14:** Ikke påbegyndt. Projektionskernen fra fase 2 findes, men produktdomænerne er endnu ikke migreret
til den som eneste read-grænse, og komponentrapporterede `fieldErrors` er derfor fortsat migrationsstate.

For hvert domæne migreres hele consumer-grafen som én vertikal slice:

- sidevisning og beregnede felter,
- tværside-readmodels,
- kontrol-/fejlbokse,
- save-relevans,
- alle dokumentprojektioner.

En slice er først færdig, når ingen consumer i domænet kan læse rå canonical data uden `InputReader`. Renteberegning
og Satser migreres først som reference, men til den nye fælles kerne — deres nuværende lokale key-/scope-byggere
videreføres ikke.

Når sidste domæne er migreret, slettes den stored/reporter-baserede `fieldErrors`-model for afledelige fejl.

### Fase 6 — Alle kritiske dokumenthandlinger konvergeres

**Status 2026-07-14:** Ikke påbegyndt. Eksisterende dokumentgates og referenceimplementeringer bevares, men hele
outputkataloget er endnu ikke migreret til typed dokumentdefinitioner og det fælles prepare-flow.

1. Opret typed dokumentdefinitioner for hele det maskinelt inventariserede outputkatalog.
2. Route alle UI-knapper gennem samme prepare-flow.
3. Kræv `PreparedDocument<T>` og frisk revision ved servicegrænsen.
4. Verificér revision efter alle async-grænser før generatorstart.
5. Fjern lokale downloadbooleans, separate click-gates og direkte generator-/servicekald.

### Fase 7 — Legacy slettes og grænser håndhæves

**Status 2026-07-14:** Ikke påbegyndt. Fase 3 har fjernet de afløste autoritative storage-/history-primitiver, men de
eksplicit listede compatibility-facader og feltmotorer skal først slettes efter migrationerne i fase 4–6.

Slet mindst:

- offentlige `invalidDrafts`-read/write-API'er og strengnøgle-builders,
- `useDraftField`, `useTableInputCore`, `useRowDrafts` og `useSliceRowDrafts` i deres nuværende roller,
- `FieldErrorReporter`-baseret persistence af afledelige fejl,
- `captureValueCommit`, `captureCoalescing` og microtask-markører,
- per-sektion input-storage og permanent migrationsfallback,
- rå canonical selectors uden for editor-/migrationsgrænsen,
- domænespecifik parsing af feltadresser og manuelt påsat blocker-scope.

Tilføj AST-baserede arkitekturværn, der beviser:

- kun transaktionsrunneren skriver input,
- persisted felter bruger kendte `FieldRef`s,
- domæne-/dokumentkode ikke importerer rå input-store/selectors,
- dokumententrypoints ikke omgår preflight,
- legacy-symbolerne ikke genindføres.

### Fase 8 — Samlet verifikation

**Status 2026-07-14:** Ikke påbegyndt som afsluttende fase. Fase 3 er verificeret med de fulde automatiske gates og
build, men slutarkitekturens samlede gate og manuelle browserverifikation kan først udføres efter fase 4–7.

Kør fuld typecheck, test-typecheck, lint og fuld testsuite. Build køres, fordi storage/bootstrap, app-runtime og
standalone entrypoint er berørt. Udfør desuden manuel browserverifikation af de godkendte synlige flows.

## 8. Teststrategi

### 8.1 Fælles feltkontrakt

Samme tabeldrevne kontraktsuite køres mod alle codecs og begge UI-overflader:

- tastning ændrer ikke settled state,
- blur/Enter afslutter præcis én gang,
- gyldigt, ugyldigt, tomt og no-op input,
- F5/remount med gyldigt og ugyldigt input,
- kritisk handling med åben editor,
- immediate clear/dropdown/toggle,
- cancel-adfærd efter beslutning i §9,
- samme rå input giver samme resolution i form og tabel.

### 8.2 Transaktionsinvarianter

For hver command-type testes:

- schema-afvisning før mutation,
- ét storage-write og ét observerbart store-write,
- monoton revision,
- præcis ét eller nul history-trin,
- rollback ved storage-/serialiseringsfejl,
- no-op uden revision/history,
- row-delete uden descendants/orphans,
- startup-migration uden datatab og uden sletning før verificeret ny envelope.

### 8.3 Undo/redo

Mindst følgende transitioner dækkes for både almindeligt felt og tabelcelle:

```text
gyldig A → ugyldig X → undo → redo
ugyldig X → ugyldig Y → undo → redo
ugyldig X → gyldig B → undo → redo
gyldig A → tom → undo → redo
række med ugyldig celle → slet række → undo → redo
```

Hvert trin hævder visning, feltissue, beregningsprojektion, save-gate, dokument-gate og fokusmål.

### 8.4 Dependency- og domæneprojektioner

For hver projection spec testes begge retninger:

- rejected dependency gør `ready` urepræsenterbar,
- rejected ikke-dependency overblokerer ikke,
- per-række-projektion isolerer andre rækker,
- aggregatprojektion inkluderer alle valgte rækker,
- `missing`, `invalid`, range/bounds og domæneregler bevarer deres forskellige policy,
- beregningsmotoren kaldes ikke, når inputprojektionen er blocked.

### 8.5 Kritiske handlinger

Integrationstests bruger rigtige felter, store og coordinator og dækker:

- Gem/download med åben gyldig og ugyldig editor,
- pending persistence,
- ingen fil-I/O eller generatorimport ved blokering,
- revisionsændring før klik, under lazy-load og umiddelbart før generator,
- samme gate for PDF og Word,
- standalone MinProcesrente,
- den godkendte brugerfeedback i §9.

### 8.6 Udtømmende dokumentgate-matrix

Det maskinelt inventariserede outputkatalog driver en tabeltest, der for hver typed dokumentdefinition særskilt
indsætter begge relevante fejlklasser:

- afsluttet rejected input med ugyldigt format (`invalid`),
- canonical input med et dokumentrelevant `range`-/`bounds`-issue med fejlseverity.

For begge klasser hævder testen både, at den reaktive knap er visuelt og funktionelt disabled, og at en direkte
aktivering stoppes før lazy-load, generator og fil-I/O. Et output kan ikke markeres migreret, hvis definitionen eller en
af de to cases mangler. Sammen med fase 7-værnet mod preflight-bypass gør det outputkataloget udtømmende i stedet for at
basere sikkerheden på manuelt udvalgte sidespecifikke tests.

## 9. Godkendte synlige beslutninger

Beslutningerne nedenfor er godkendt 2026-07-14 og skal fastlåses i de normative kontrakter i fase 1.

### 9.1 Escape i en åben editor

Escape annullerer universelt alt siden editoren blev åbnet.

**Konkret eksempel:** Feltet viser den afsluttede ugyldige tekst `12..20`. Brugeren åbner editoren, skriver
`01-01-2024` og trykker Escape. Feltet viser igen `12..20`; intet committes, og den tidligere gyldige canonical dato
vises ikke.

### 9.2 Downloadklik, som afslutter en åben editor

Mens editoren er åben, beror visning, beregning og download-gate på den senest afsluttede inputtilstand. En tidligere
gyldig tilstand kan derfor holde indholdet vist og downloadknappen aktiv, mens brugeren skriver. Dette er ikke live
validering og må ikke give visningsmæssig flimmer.

Når brugeren forlader editoren — også ved at pege på downloadknappen — afsluttes inputtet først. Hvis resultatet har en
fejl, opdateres den reaktive gate, og knappen bliver visuelt og funktionelt disabled, før en dokumenthandling kan
gennemføres. Har inputtet ingen fejl, fortsætter dokumenthandlingen på den nye revision.

Click-preflighten er obligatorisk defense-in-depth. Modtager applikationen alligevel click-eventet, finaliserer den
først editoren, genlæser den nye revision og starter ingen dokumenthandling ved blokering. I det tilfælde fokuseres det
ugyldige felt uden scroll, og den eksisterende danske advarsel vises.

Denne event-grænse ændrer ikke beregningsregler eller de tal, en gyldig beregning producerer.

## 10. Acceptkriterier for slutarkitekturen

Designet er først færdigimplementeret, når alle følgende udsagn er sande:

1. Der findes én autoritativ inputaggregate og én autoritativ write-grænse.
2. Der findes én felt-editor-state machine og ét codec pr. inputfamilie på tværs af form og grid.
3. Ingen dynamisk tabel holder en konkurrerende draft-kopi af alle celleværdier.
4. Alle persisted feltadresser er strukturelle, typed og uafhængige af kolonneindeks/DOM.
5. Et afsluttet ugyldigt felt viser sin rå tekst efter blur, navigation, F5, undo og redo.
6. Ingen beregning, save- eller dokumentmodel kan modtage den tidligere gyldige værdi som aktuel værdi for feltet.
7. Dependencies, ikke manuelt blocker-scope, afgør præcis hvilke consumers der blokeres.
8. Afledelige feltfejl beregnes uafhængigt af component mount og ligger ikke i history.
9. Hver inputhandling giver ét atomisk storage-/store-resultat og præcis ét eller nul history-trin.
10. Undo/redo/load/reset skaber nye monotone revisioner og kan ikke genvalidere en gammel dokumentgodkendelse.
11. Sletning af række/entity fjerner tilknyttet inputstate atomisk; orphan-state er urepræsenterbar.
12. `.eo` round-trip bevarer alt schema-gyldigt brugerinput og kan ikke gemme en maskeret gammel værdi.
13. Alle dokumenter bruger samme definition til reaktiv gate og click-preflight, med friskhedskontrol efter async.
14. Ingen commit-korrekthed afhænger af microtasks, timeouts, effects eller write-rækkefølge mellem stores.
15. Normative kontrakter, kode, tests og arkitekturværn beskriver samme model.
16. Der findes ingen permanente compatibility-facader, dual-read/dual-write eller legacy-fallbacks fra migrationen.
17. Åben draft ændrer aldrig visning eller download-gate; settle skifter dem atomisk til den nye afsluttede tilstand.
18. Ethvert dokumentrelevant issue med fejlseverity giver en visuelt og funktionelt disabled downloadknap.
19. Hver dokumentdefinition i det maskinelt inventariserede outputkatalog består gate-matricen for både ugyldigt format
    og range/bounds-fejl, og intet dokumententrypoint kan omgå preflight.

## 11. Ikke-mål

Designet indfører ikke:

- nye beregningstyper eller andre features,
- nye beregningsregler, satser, afrundinger eller clampingregler,
- ændringer af dokumentlayout eller dokumentindhold,
- serverkommunikation, eksterne API'er, telemetri eller ekstern logging,
- nye dependencies,
- generiske udvidelsespunkter for hypotetiske fremtidige beregningstyper.

Målet er at konsolidere den låste feature-flade til den mindste arkitektur, der kan håndhæve Mineos eksisterende
produktregler deterministisk.
