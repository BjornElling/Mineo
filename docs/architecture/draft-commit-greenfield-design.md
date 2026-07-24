# Greenfield-design for draft, afsluttet input og projektion

**Status:** Krav og produktadfærd er genfastlagt 2026-07-16. Den tidligere faseinddeling er forkastet som
migrationsgrundlag. Fase 0–4 har leveret nyttige karakteriseringstests, codecs, inventarer og tekniske erfaringer, men
ingen af faserne betragtes længere som en færdig del af målarkitekturen. Implementeringen skal rebaseres efter §8.

**Implementeringsstatus (rebase):** Fase 0 og 1 blev gennemført, reviewet og kvalitetssikret 2026-07-16. Den afgrænsede
kravændring 2026-07-18 er indarbejdet: parsebare out-of-bounds-værdier committes canonical med afledte bounds-issues,
mens `.eo`-save kun blokeres af aktivt rejected råinput. String-backed felter validerer desuden tolerant indlæste
canonical strenge gennem deres codec, så schema-tolerance ikke kan føre ufortolkelige værdier til consumers.
Fase 2 blev gennemført, verificeret og kritisk reviewet 2026-07-18. Mineo monterer kun greenfield-runtime, og alle
persisted formular- og tabelsurfaces — inklusive hele Erstatningsopgørelse med nested ansættelsesforhold — bruger nu
feltrefs, editorlokationer og den fælles collection-/grid-adapter. EO læses gennem
`buildErstatningsopgoerelseReaderProjection`; den tværgående EET-import bygges fra samme tokenbundne `InputReader`, og
dokumentklik genopbygger både EO- og EET-projektionen fra én frisk afsluttet revision. Det afsluttende review fjernede
rå store-læsning i EET-importen, en stale EET-kilde ved dokumentpreflight, konkurrerende EO-rækkekopier og de afløste
EO-viewmodels, tabeller, row-hooks og implementeringstests. En arkitekturvagt håndhæver nul legacy-editor-/tabelcallsites
på EO-overfladen. Fase 2 er fortsat et internt kontrolpunkt: domæneprojektioner/validatorer færdiggøres i fase 3, og
case-, shell- og persistence-ansvar flyttes i fase 4–5 før deployhandoff.

De tidligere reviews rettede desuden replacement/no-op-matricen, synkron editorregistrering,
dispatch-rollback i UI-laget, settings-only issue-abonnement, særskilt replacement-generation, schema-defaultede
tomværdier og rå section-bypass i Stamdata/Satser. Det efterfølgende review af Årsløn-kontrolpunktet rettede faste
og dynamiske datogrænser, periodeorden som feltissues, inputdrevet relevans, grid-editorens synkrone lifecycle,
rejected-only-rækkesletning, byte-verificeret rollback, settingssnapshot og frisk dokumentpreflight. Katalogets
paths/counts, row factories, collection-adaptere og aktive editorlokationer er komplette efter sidste callsite-cutover.
Den systematiske domænedækning af relevans og validators blev gennemført i fase 3 (se Fase 3-status nedenfor).

Reviewet 2026-07-18 samlede de nye slices om `InputReader` + `runProjection` og fjernede den parallelle
`domain/inputIntegrity`-blockermodel. Det rettede desuden manglende feltgrænser i Renteberegning, Varige mén og
Erhvervsevnetab, dependency-gating i differencekravet, ASL-rækkefejl fra readeren, fail-closed dokumentgates,
multiline-Enter, rejected-only-rækkesletning, destruktiv reset uden forudgående settle og stale async downloads.
Hovedshellens atomiske navigation-/undo-cutover og fuld lokationsbaseret fokusrestore hører fortsat til fase 4;
shellen må ikke skifte koordinator, før den kan dækkes af slutmodellen uden parallel inputruntime.

Den tidligere
Fase 0–4-implementering på `greenfield`-branchen (typed spor, sentinel-adresser, Satser-kernelprojektion m.m.) er
forkastet som migrationsgrundlag og betragtes udelukkende som historiske karakteriseringstests/erfaringer. Den
bindende migrationsplan er §8 (Fase 0–7). Fase 0 har rebaset kontrakterne og etableret de midlertidige, maskinverificerede
inventarer i `src/inputCore/ledger/`. Fase 1 har genopbygget den framework-frie inputkerne i `src/inputCore/` med
XOR-invariant, issue-model uden `blocksSave`, `ValidationReader`→`InputReader`, statisk katalog og
`ready | blocked`-projektioner. Fase 3 er gennemført: alle otte consumerslices (Satser, Renteberegning, Stamdata,
Årsløn, Varige mén, Forsørgertab, EET og EO) forbruger nu rene reader-projektioner, og de afløste
component-reporter-hooks er slettet. Fase 4–5 (`.eo`/session/caseporte og dokumentoutputs) udestår, og den delvise
hovedapp må ikke repareres med legacy-providers.

Fase 1–4-rækkefølgen i det parallelle redesign-review er historik for den oprindelige kandidatliste og er ikke en aktiv
migrationsplan for inputområdet. Kun §8 nedenfor er bindende. Afsluttede, ikke-inputrelaterede resultater, herunder
dokumentlayout og numeriske primitiver, bevares som selvstændige resultater.

**Dato:** 2026-07-24

**Type:** Informativ målarkitektur og bindende migrationsplan. Normative kontrakter opdateres som første
implementeringsfase, før produktionskode ændres.

**Scope:** Persisterede sagsinput i formularer og tabeller, feltfejl, beregningsprojektioner, dokument-output,
`.eo`-save/load, `sessionStorage`, undo/redo og kritiske handlinger.

---

## 0. Konklusion

Den hidtidige retning skal ikke færdiggøres trinvis. Den skal rebaseres.

Reviewet bekræfter tre samtidige problemer:

1. Den nye kerne bevarer stadig centrale antagelser fra legacy-modellen, især at et afsluttet ugyldigt input blot
   maskerer en tidligere gyldig værdi.
2. Nye typed katalog-, command- og projektionssystemer er etableret ved siden af de fortsat aktive form-, grid-,
   fejl- og beregningssystemer. De er hovedsageligt sidespor, ikke en gennemført cutover.
3. Flere sikkerhedskrav er gjort konfigurerbare gennem policies, callbacks, brands, facader og kompatibilitetslag,
   selv om den låste feature-flade tillader enklere universelle regler.

Slutproduktet skal i stedet have følgende fem egenskaber:

1. Ét aktuelt inputaggregate og én write-grænse.
2. Én felteditor og ét codec pr. inputfamilie på tværs af formular og grid.
3. Ingen tidligere gyldig værdi i den aktuelle tilstand efter et ugyldigt settle. Den må kun findes i undo-historikken.
4. Én ren feltfejl-/læsegrænse, som giver alle røde feltfejl samme UI- og consumerkonsekvens, men bevarer den
   strukturelle save-sondring mellem rejected råinput og schema-gyldigt canonical input.
5. Almindelige, rene domæneprojektioner uden en generisk projektions-DSL eller parallel blocker-model.

Der bygges ingen kompatibilitet for gamle interne browser-sessioner. Bagud-/fremadtolerant `.eo`-load bevares.

## 1. Godkendt produktadfærd

Dette afsnit er resultatet af kravgennemgangen. Det må ikke genfortolkes som tekniske valgmuligheder under
implementeringen.

### 1.1 De tre semantiske niveauer

| Niveau | Levetid | Må være ugyldigt | Persistens/history | Beregning og output |
|---|---:|---:|---:|---:|
| Åben draft | Kun mens editoren er åben | Ja | Nej | Aldrig |
| Afsluttet input | Indtil næste brugerhandling/load/reset | Ja | Session + undo/redo | Kun gennem feltvurdering og projektion |
| Consumerprojektion | Afledt af én afsluttet revision | Nej | Nej | Ja, når `ready` |

Begreberne betyder:

- **Åben draft:** den rå tekst, brugeren aktuelt skriver.
- **Afsluttet input:** feltets aktuelle tomme, gyldige eller fejlende tilstand efter blur, Enter eller immediate commit.
- **Consumerprojektion:** det konkrete, beregningsklare input til én beregning, contentbox eller dokumentdefinition.

`commit` reserveres til den atomiske inputtransaktion. Feltets afslutning kaldes `settle`, fordi både gyldigt, tomt og
fejlende input afslutter redigeringen.

### 1.2 Åben draft er universelt inert

Mens editoren er åben:

- ændrer tastning kun den lokale draft,
- ændres afsluttet input, revision, history og sessiondata ikke,
- ændres beregninger, viste resultater, contentboxes og downloadgates ikke,
- opstår eller forsvinder ingen feltfejl på baggrund af den nye tekst,
- bliver en allerede vist rød feltfejl stående uændret, indtil editoren afsluttes,
- forbliver et hidtil fejlfrit felt fejlfrit, indtil editoren afsluttes.

Denne regel gælder ens for formularfelter og tabelceller. Den åbne draft er ikke live preview og er ikke en skjult
fjerde inputkanal.

### 1.3 Settle, cancel og navigation

- Blur, Enter, klik uden for feltet og almindelig side-/fanenavigation afslutter editoren gennem samme settle-sti.
- Navigation fortsætter også efter et fejlende settle. Fejlen bevares og vises igen, når brugeren vender tilbage.
- Escape lukker editoren uden at udstede en command. Et efterfølgende blur må ikke settle.
- Hvis editoren blev åbnet fra et afsluttet fejlende input, forbliver denne fejlende tekst og tilstand derfor uændret.
- Delete/Backspace på et fokuseret, lukket redigerbart felt eller en celle rydder og committer straks.
- Dropdownvalg og toggle/radio committer straks.
- Når editoren er åben, redigerer Delete/Backspace kun draften.

### 1.4 Kritiske og destruktive handlinger

| Handling | Åben editor |
|---|---|
| `.eo`-save | Settle først; evaluér derefter friskt input-/settingssnapshot |
| Dokumentdownload | Settle først; evaluér derefter friskt input-/settingssnapshot |
| Almindelig navigation | Settle og fortsæt |
| Load, reset og `Slet alt` | Gennemfør uden settle; den åbne draft må aldrig blokere handlingen |
| Global undo/redo | Stille no-op; draften ændres ikke |
| Escape | Cancel; ingen transaktion |
| F5 | Åben draft tabes; senest afsluttede tilstand genindlæses |

Korrekthed må ikke afhænge af browserens blur/click-rækkefølge. Save og dokumentdownload skal altid have en eksplicit
preflight efter settle.

Load, reset og `Slet alt` er anderledes, fordi en gennemført handling under alle omstændigheder erstatter eller
sletter det input, som draften kunne være blevet til. De må derfor hverken settle, validere eller bevare draften som
en del af handlingen. Ved en handling med bekræftelse/preflight forbliver draften urørt, indtil brugeren faktisk
godkender apply. Ved succes bortfalder draften sammen med den erstattede tilstand; ved annullering eller apply-fejl
forbliver både afsluttet input og åben draft uændret.

### 1.5 Ugyldigt settle erstatter den gamle værdi

Eksempel:

```text
Afsluttet 100 → åben draft "abc" → blur
```

Efter blur er feltets aktuelle tilstand kun `abc` + fejl. `100` findes ikke længere i det aktuelle inputaggregate og
må ikke kunne nå en beregning, selector, save-model eller dokumentmodel. `100` findes kun i undo-framet.

Den tekniske invariant er derfor:

- gyldigt settle skriver den nye canonical værdi og fjerner eventuelt fejlende råinput,
- tomt settle skriver feltets canonical tomværdi og fjerner eventuelt fejlende råinput,
- ugyldigt settle skriver feltets canonical tomværdi og den rå fejlende tekst atomisk,
- samme aktuelle felt må aldrig samtidig have en ikke-tom canonical værdi og fejlende råinput,
- undo gendanner den tidligere samlede tilstand,
- redo gendanner fejltilstanden uden den tidligere canonical værdi.

Efter F5 findes en afløst gyldig værdi ikke længere, fordi undo-history er runtime-only.

### 1.6 Røde feltfejl og den strukturelle save-sondring

En rød feltfejl er en rød feltfejl i UI og for beregninger/dokumenter, uanset årsag. Ugyldigt format, range, bounds
og en feltplaceret domæneregel har derfor samme røde markering og blokerer de consumers, som afhænger af feltet. Kun
tooltip- og contentboxteksten varierer.

`.eo`-save følger derimod current-state-repræsentationen, ikke den røde farve:

- Rå tekst, som ikke opfylder feltformatet eller ikke kan omsættes til en værdi i det persisterede Zod-schema, er
  rejected input. Det canonical slot ryddes til feltets tomværdi, og `.eo`-save blokeres, fordi råteksten ikke må
  skrives til filen. Et trecifret årstal er eksempelvis rejected på grund af formatet.
- En korrekt formateret værdi, som kan valideres af det persisterede Zod-schema, committes canonical, også når den
  ligger uden for feltets aktive min/max eller bryder en tværgående domæneregel. Fejlen afledes som et rødt issue,
  men værdien må gemmes i `.eo`.
- De persisterede Zod-schemas definerer repræsenterbar type, shape og sikker numerik; feltets aktive min/max og
  tværgående domæneregler hører til issue-afledningen og må ikke gøre en ellers repræsenterbar værdi rejected.

Readeren blokerer begge former ens for afhængige beregninger og dokumenter. Save-gaten er den eneste tilsigtede
undtagelse og udledes direkte af, om der findes rejected input; den må ikke udledes af issuefarve eller reason.

| Tilstand | Rød feltmarkering | Blokerer `.eo` globalt | Blokerer afhængig beregning/dokument | Blokerer uafhængig consumer |
|---|---:|---:|---:|---:|
| Ugyldigt format | Ja | Ja | Ja | Nej |
| Range/bounds-fejl på canonical værdi | Ja | Nej | Ja | Nej |
| Feltplaceret domæneregel på canonical værdi | Ja | Nej | Ja | Nej |
| Tomt felt / `missing` | Nej | Nej | Ja, hvis consumeren kræver feltet | Nej |
| Warning | Nej | Nej | Nej | Nej |

Konsekvenserne må ikke styres af et frit `blocksSave`- eller `blocksProjection`-flag. Save-sondringen er strukturel:
rejected input blokerer, mens Zod-valideret canonical input kan gemmes.

### 1.7 Tomhed og warnings

- Et tomt felt må aldrig i sig selv få rød kant/ring eller tooltipfejl.
- Tomhed må aldrig blokere `.eo`-save.
- En consumer, der kræver feltet, må udlede en `missing`-fejl i contentboxen og blokere netop sin beregning eller sit
  dokument.
- Et link fra contentboxen må fortsat navigere til og fokusere det tomme felt uden at gøre feltet rødt.
- En warning må vises i contentboxen, men må aldrig blokere beregning, dokument eller `.eo`.

### 1.8 Fejlvisning

- Et felt viser højst én aktiv rød fejl og én konkret tooltip ad gangen.
- En central deterministisk prioritet vælger den mest direkte fejl, hvis flere regler rammer samme felt.
- Contentboxen må vise yderligere relevante fejl, hvis de hjælper brugeren.
- Format-, range- og bounds-fejl har forskellige, konkrete danske beskeder.
- Range-/datotooltips viser de faktiske grænser. Hvis `min > max`, forklarer beskeden, at ingen gyldige værdier
  findes, og navngiver de inputs, der skabte grænserne.
- Fejl og warnings afledes fra afsluttet input. Mounted komponenter rapporterer dem ikke til en store.

### 1.9 Skjulte og irrelevante felter

Et input, som bliver skjult eller irrelevant ved et eksplicit styrende valg, behandles sådan i samme undo-trin som
valget:

- Har inputtet en aktiv rød feltfejl, ryddes det. Dette gælder ens for format-, range-, bounds- og øvrige røde fejl.
- Er inputtet gyldigt, bevares det uændret og vises igen, hvis feltet senere bliver relevant.
- En skjult fejl må aldrig blokere `.eo`, beregning eller dokument.

Universel dataintegritetsregel: Programmet må aldrig automatisk slette eller overskrive gyldigt brugerinput på grund af
navigation, visibility, defaults, rerender eller intern synkronisering. Kun en eksplicit brugerhandling, som faktisk
anmoder om sletning eller erstatning—felt-rydning, række-sletning, reset, `Slet alt`, load eller undo/redo—må gøre det.

### 1.10 Afhængighedsspecifik blokering

- En fejl blokerer kun consumers, der faktisk afhænger af feltet.
- En fejl i række 2 blokerer ikke beregningen af række 1 og 3.
- En total, der inkluderer række 2, blokeres.
- Et dokument blokeres kun af egne dependencies og egne output-invariants.
- `.eo`-save er undtagelsen: ethvert aktivt relevant rejected input blokerer globalt; canonical feltissues blokerer
  ikke save.
- Når en afsluttet fejl blokerer en tidligere beregning, må det tidligere resultat ikke blive stående som gyldigt.
  Området skifter til sin eksisterende ikke-beregnet-/fejlvisning på den nye revision.

### 1.11 Dynamiske tabeller

- Første ikke-tomme settle i en placeholder-række promoverer rækken atomisk, både når inputtet er gyldigt og
  fejlende. Et rent fokus+blur, tomt settle eller immediate clear på den tomme placeholder er no-op og opretter ingen
  række.
- Den fejlende tekst og rækken overlever navigation og F5.
- Enter, Tab og klik væk settler og fortsætter navigationen, også ved fejl.
- Sletning af en række fjerner rækken og al dens aktuelle inputtilstand som ét undo-trin.
- Undo/redo gendanner/fjerner rækken, dens gyldige værdier, fejlende råinput, feltfejl og gates som én tilstand.
- Rækkeinfrastrukturen må ikke holde en konkurrerende værdikopi af alle celler.

### 1.12 Session, `.eo` og historisk kompatibilitet

- Åben draft persisteres ikke og tabes ved F5.
- Alt afsluttet input—også fejlende rå tekst—overlever F5 i den aktuelle programversion.
- `.eo` indeholder kun schema-gyldigt canonical brugerinput og aldrig fejlende rå tekst.
- `.eo`-save blokeres, før fil-I/O, hvis der findes aktivt relevant rejected input.
- Manglende felter og warnings blokerer ikke `.eo`.
- Gamle `.eo`-filer indlæses fortsat tolerant efter persistence-kontrakten.
- En gammel `.eo`-fil kan indlæses med en canonical værdi, som nu giver rød bounds-fejl; værdien vises og kan gemmes
  igen, mens den fortsat blokerer afhængige beregninger og dokumenter.
- Gamle interne browser-sessioner skal ikke migreres. Programmet opdateres kun, når ingen brugere er aktive, og der
  bygges derfor ingen legacy-sessionreader, adresseoversættelse, dual-read eller kompatibilitetsdialog.
- Korruption i den aktuelle sessionversion skal fortsat håndteres fail-closed. Den rå envelope bevares uændret,
  alle normale writes blokeres, og brugeren får den eksisterende eksplicitte danske systemfejl. Kun brugerens
  eksplicitte `Slet alt` må fjerne den korrupte kilde og starte en tom sag. Bootstrap må aldrig stiltiende starte tomt
  og senere overskrive kilden. Det er dataintegritet, ikke versionskompatibilitet.

## 2. Kritisk review af fase 0–4

### 2.1 Den aktuelle stale-værdi er bevaret

`withRejectedInput` i `src/input/inputCommands.ts` skriver kun rejected råtekst. Den tidligere canonical værdi bliver
liggende i `sections` og maskeres af `InputReader`. Det er direkte uforeneligt med §1.5.

En læsebarriere er stadig nødvendig, men må ikke være eneste forsvar mod en stale værdi, som slet ikke har et legitimt
formål i den aktuelle tilstand.

### 2.2 Den typed kerne er et sidespor

Den nye projektionskerne bruges i produktionskode kun af en Satser-kernelprojektion, mens den aktive side fortsat går
gennem den gamle projektion. Typed commands bruges produktionsmæssigt hovedsageligt af undo/redo; formularer og grids
skriver fortsat gennem kompatibilitetsfacader og hel-sektionsflow.

Der findes derfor ikke en delvist færdig målarkitektur, som blot mangler flere callsites. Der findes to konkurrerende
retninger.

### 2.3 Editorlaget er konfigureret duplikering

`useDraftLifecycle` samler callbacks og rækkefølge, men parsing, fejltilstand, fokus, pending guards, resync,
fingerprints, rollback og persistence er fortsat fordelt mellem `useDraftField`, `useStyledFieldAdapter`,
`useTableInputCore` og grid-pipelinen.

En fælles callback-orkestrator er ikke én felteditor.

### 2.4 Runtime indeholder flere samtidige sandheder

`inputRuntimeStore` indeholder samtidig:

- inputaggregate,
- afledte `sections`- og `invalidDrafts`-views,
- flere revisionsmaps og epochs,
- stored `fieldErrors`,
- compatibility-history,
- test-only mutations og legacy-facader.

Det øger både tilstandsrum og migrationsarbejde uden at være slutproduktfunktionalitet.

### 2.5 Projektions- og issuekernen er unødigt generisk

Den nuværende projektions-DSL bruger symbols, phantom types, brands, WeakSet-autorisering, factory-validering og
map/flatMap/collect-lag. Samtidig findes den gamle `domain/inputIntegrity`-blockermodel fortsat.

Mineos låste consumers har behov for almindelige rene funktioner, præcise reads og et lille `ready | blocked`-resultat,
ikke et generisk projectionsframework.

Den nuværende issue-model gør save- og beregningsblokering konfigurerbar per issue. §1.6–1.7 gør reglerne
deterministiske: consumerblokering følger dependencies, mens save-blokering følger rejected-repræsentationen.

### 2.6 Sessionmigrationen er et ikke-mål

`legacy-bridge-1`, sentinel-adresser, startupmigration fra sektionsnøgler og den planlagte atomiske adresse-cutover
løser kun kompatibilitet med gamle interne browser-sessioner. Dette behov er udtrykkeligt afvist.

`.eo`-tolerance er et separat produktkrav og må ikke bruges som begrundelse for runtime-kompatibilitet.

### 2.7 Den tidligere faserækkefølge skaber et usikkert mellemrum

Den tidligere plan migrerede inputoverflader før alle beregnings-, validerings-, save- og dokumentconsumers. Dermed
kunne et felt få en ny writevej, mens en consumer fortsat læste rå canonical sektioner.

Inputoverflade og alle dens consumers skal enten cuttes samlet eller behandles som en ikke-deploybar intern
mellemtilstand. En compatibility-fallback er ikke en løsning.

### 2.8 Fase-0-inventaret tæller schema-leaves, ikke editorfelter

Det persisterede path-inventar er nyttigt som coverage-backstop, men fx er et `AmountValue` ét brugerfelt, selv om
schemaet har leaves for `kind`, `value` og `expression`. Inventaret kan derfor ikke bruges direkte som feltkatalog eller
migrationsledger.

## 3. Mindste målarkitektur

### 3.1 Autoritativ inputtilstand

Den autoritative tilstand bevarer de eksisterende Zod-validerede sektionsformer:

```ts
type SettledInput = Readonly<{
  sections: PersistedInputSections;
  rejectedInputs: Readonly<Record<SerializedFieldAddress, RejectedInput>>;
}>;

type InputRuntime = Readonly<{
  input: SettledInput;
  revision: InputRevision;
  history: InputHistory;
}>;
```

`rejectedInputs` er ikke en maske over en recovery-værdi. Det er den rå del af et aktuelt fejlende felt, hvis canonical
slot samtidig er feltets tomværdi.

Inputschemaet håndhæver for hvert rejected felt:

1. adressen er kendt og peger på en eksisterende entity,
2. råteksten er ikke tom,
3. canonical slot er feltets definerede tomværdi,
4. feltets strukturelle ejer/entity findes, og feltet er relevant efter den kanoniske inputdrevne relevansregel.

Kun deterministisk, inputdrevet strukturel eksistens og relevans er envelope-invarianter. AppSettings må påvirke validering,
beregning og visning af ikke-persisterede udvikler-/inspektionsflader, men må ikke styre synlighed/relevans for et
persisteret inputfelt. Hvis inventaret mod forventning finder en sådan kobling, er det et fase-0-stop, der forelægges
som en konkret UI/UX-beslutning; den må ikke løses med implicit sletning eller en svagere save-gate.

Afledte issues, gates, beregninger, UI-tabs og åbne drafts er ikke del af inputtilstanden.

### 3.2 Enkel feltbeskrivelse

Hvert persisteret brugerfelt har én immutable beskrivelse med kun de egenskaber, der bruges nu:

- strukturel adresse eller typed builder for dynamiske entities,
- codec,
- canonical tomværdi/clear-operation,
- canonical read/write,
- dansk label og kontroltype,
- eventuel relevans- og feltvalidator, når den reelt er fælles for feltet.

Feltadressen indeholder sektion, properties, stabile entity-id'er og feltnavn. Den indeholder aldrig kolonneindeks,
DOM-id, route eller formatteret string-key.

Produktkataloget er et almindeligt statisk readonly katalog, som valideres én gang. Der er ikke behov for en stateful
klasse, runtime-registrering, seal-lifecycle, factory-brands eller WeakSet-autorisering.

Fokusdestination er editorlokationens metadata, ikke datafeltets identitet. Samme datafelt kan derfor redigeres flere
steder uden at få flere dataidentiteter. Et contentbox-link ejer selv den foretrukne editorlokation for sin kontekst;
en fælles resolver vælger derefter route, fane og fokusmål fra consumerens prioriterede lokationer. Der lægges aldrig
en global standardlokation på `FieldRef`.

### 3.3 Fælles codecs

Codec-semantikken konsolideres med en skarp grænse mellem format/repræsenterbarhed og feltbounds:

```ts
type FieldCodec<T> = Readonly<{
  parseForSettle(raw: string): FieldResolution<T>;
  format(value: T): string;
  formatForEdit(value: T): string;
  acceptsInitialKey(key: string): boolean;
  normalizePaste?(raw: string): string;
}>;
```

`FieldResolution` bærer en maskinlæsbar årsag og nødvendige detaljer ved fejl. UI må ikke reparse råteksten for at
finde tooltipteksten.

Dato, beløb, procent, heltal, brøk, uge, år og tekst har hver ét codec på tværs af form og grid. Eksisterende godkendte
normaliserings-, infer-, præcisions- og paste-regler ændres ikke af denne arkitektur. Et codec afviser ugyldigt format
og værdier, som ikke kan repræsenteres sikkert i feltets persisted schema. Det afviser ikke en ellers repræsenterbar
værdi alene på grund af feltets aktive min/max; disse grænser vurderes på den committed canonical værdi.

### 3.4 Ren feltvurdering og lille `InputReader`

For hvert samlet kildesnapshot bygges et rent feltissue-snapshot ud fra:

- `SettledInput`,
- feltbeskrivelser og relevansregler,
- domænevalidatorer,
- relevante AppSettings med settingsrevision.

Validering og consumerlæsning har to forskellige, snævre grænser i fast rækkefølge:

1. En intern `ValidationReader` læser afsluttet canonical/rejected input og dependencies uden at anvende feltissues.
   Kun input-/valideringsinfrastrukturen må bruge den.
2. Feltvalidatorerne udleder det immutable issue-snapshot.
3. Den offentlige `InputReader` kombinerer samme input med snapshottene og skjuler enhver værdi med aktiv feltfejl.

Dermed opstår ingen cirkel, hvor readeren behøver et issue, som validatoren først skal bruge readeren til at udlede.

Issue-modellen skelner mellem:

- **feltfejl:** vises rødt og blokerer afhængige consumers,
- **consumerfejl:** fx `missing`; vises i contentbox og blokerer kun den konkrete consumer,
- **warning:** vises, men blokerer intet.

Der lagres ingen `blocksSave`- eller `blocksProjection`-booleans. Placering, severity og consumerens faktiske reads
afgør consumerkonsekvensen; `.eo`-save blokeres strukturelt af `rejectedInputs`, ikke af issueobjekter.

Den offentlige reader eksponerer ikke en værdi fra et felt med aktiv feltfejl:

```ts
type ReadFieldResult<T> =
  | Readonly<{ status: 'usable'; value: T }>
  | Readonly<{ status: 'error'; issue: FieldIssue }>;

type InputReader = Readonly<{
  sourceToken: EvaluationSourceToken;
  read<T>(field: FieldRef<T>): ReadFieldResult<T>;
  listEntities(collection: CollectionRef): readonly EntityRef[];
}>;
```

`EvaluationSourceToken` indeholder mindst inputrevision og settingsrevision. Issue-snapshots, consumerprojektioner og
`PreparedDocument` bindes til dette token. Ved enhver async-grænse genlæses og sammenlignes hele tokenet; en ændring i
AppSettings gør resultatet stale på samme måde som en ændring i input.

Et kildesnapshot optages med en stabil dobbeltlæsning: læs begge revisioner, læs begge immutable snapshots, og læs
begge revisioner igen. Kun hvis før/efter-revisionerne er identiske, må data og token bruges sammen. Ved samtidig
ændring forsøges optagelsen igen; kan et stabilt snapshot ikke opnås inden for den faste, lille retrygrænse, stoppes
operationen fail-closed som en transient systemfejl. Den samme helper bruges af issues, beregninger, `.eo` og
dokumenter.

Tom canonical værdi er `usable`; det er consumerens `required`-read, der udleder `missing`.

Domæneprojektioner er almindelige rene funktioner. De læser konkrete refs, samler issues og returnerer
`ready | blocked`. De må ikke modtage rå sektioner. Den præcise dependency følger af de refs, funktionen faktisk
læser; der findes ikke et manuelt `global | section | row`-scope.

### 3.5 Én felteditor

Den fælles persisted editor ejer kun:

- om editoren er åben,
- den lokale rå draft,
- åbnings-replacement-generation og fokusmetadata,
- det konkrete fokusmål for history/fejlnavigation.

Når editoren er lukket, læses visningen direkte fra den afsluttede revision. Der findes ingen lukket draftkopi,
pending-prop-guard, fingerprint, epoch eller resync-effect.

Form- og grid-adaptere ejer kun rendering, aktivering, hit-area og navigation. De må ikke parse, persistere, holde
fejlstate eller vælge history-policy.

Rene UI-controls som søgning, filtertekst og overlays bruger almindelig lokal state og trækkes ikke ind i
inputarkitekturen.

### 3.6 Én command-runner

Alle autoritative ændringer går gennem én `dispatchInput(command, origin)`:

- `settleField`,
- `setImmediateField`,
- `clearField`,
- atomisk styrende valg + oprydning af nye skjulte feltfejl,
- `insertRow`, `deleteRow`, `reorderRows`,
- `settleFieldInNewRow`,
- `resetSection`, `replaceCase`, `clearCase`,
- `undo`, `redo`.

For hver command:

1. Læs ét før-snapshot.
2. Byg kandidat med en ren reducer.
3. Validér canonical sektioner, feltadresser, entities og XOR-invarianten.
4. Afvis semantisk no-op.
5. Serialisér den ene aktuelle session-envelope.
6. Skriv og verificér én `sessionStorage`-værdi.
7. Opdatér input, revision og history i ét Zustand-write.
8. Rul storage og runtime tilbage til før-snapshottet ved uventet fejl.

Et eksplicit styrende valg bruger en fast før/efter-procedure i samme transaktion:

1. Fasthold før-snapshottets aktive feltissues og inputdrevne relevans.
2. Anvend valget på kandidaten.
3. Beregn før/efter-relevans fra det kanoniske relevansregister.
4. Find kun felter med overgangen `relevant → irrelevant`.
5. Ryd feltet, hvis og kun hvis det havde en aktiv rød feltfejl i før-snapshottet; både rejected raw og en eventuel
   canonical range-/bounds-værdi ryddes.
6. Bevar alle øvrige værdier og validér/skrive kandidaten som én command og ét history-trin.

UI må ikke levere en oprydningsliste. En settingsændring er ikke et styrende inputvalg og må aldrig i sig selv slette
input; den kan efter §3.1 heller ikke skjule et persisteret felt. Dens øvrige issues og beregningsvirkning genafledes
under et nyt `EvaluationSourceToken`.

Én brugerhandling giver højst ét history-trin og præcis én ny revision ved reel ændring.

### 3.7 Session og history

Sessionen har én current-only envelopeversion. Den har ingen `fieldAddressVersion`-bro, sentinel-adresser eller
legacy-migrator.

History snapshotter kun afsluttet input og fokus-origin. Issues, beregninger, gates og åbne drafts genafledes eller
ignoreres. Restore skriver sessionen først, erstatter derefter input og skaber altid en ny monoton revision.

### 3.8 Tabeller

Rækkeinfrastrukturen ejer kun stabile id'er, rækkefølge, add/delete/reorder og én transient placeholder. Canonical
rækker læses direkte fra inputaggregaten. Der findes ingen `draftRows`, `internalTableData`, fingerprint-kopi eller
effect-flush til persistence.

Placeholder-promotion og første settle er én command. Row-delete fjerner rejected descendants i samme reducertrin.

### 3.9 `.eo`, beregninger og dokumenter

`.eo`-save:

1. settler eventuel åben editor,
2. læser frisk `EvaluationSourceToken`,
3. udleder alle aktive feltfejl uden mount-afhængighed,
4. stopper ved mindst ét aktivt relevant rejected input,
5. bygger canonical snapshot,
6. Zod-validerer og skriver filen.

Beregningsmotorer modtager kun data fra en `ready` projektion.

Hvert af de 18 dokumentoutputs har én typed definition, som ejer projektion og output-invariants. Samme definition
bruges af reaktiv gate og click-preflight. Generatoren modtager kun et kilde-tokenbundet `PreparedDocument<T>`.

### 3.10 Små systemporte efter `FormPersistenceContext`

`FormPersistenceContext` erstattes ikke af en ny altomfattende facade. Dets øvrige ansvar fordeles eksplicit:

- `initializeInputRuntime` hydraterer før React-render og returnerer current-session-/startupstatus.
- `InputCommandPort` eksponerer kun typed commands; ingen raw sections eller rejected maps.
- `CaseFileOperations` ejer `.eo`-save, preflight/load/apply og `hasAnyData` over reader-/replacement-grænserne.
- `CaseResetOperations` ejer reset og `Slet alt`, inklusive sikker kassation af åben draft ved succes og recovery fra
  blokeret current-session.
- den eksisterende centrale systemfejl-/noticeoverflade viser startupfejl og brugerrettede operationsfejl.

Ingen af portene må både eksponere reads, raw writes, UI-notices og persistence. Hver app-variant initialiserer sin ene
aktive runtime før render; provider-remount må aldrig rehydrere eller overskrive input. Under cutoveren skifter en
variant kun runtime ved en atomisk slice: Mineo må ikke genmontere legacy-provider for at holde ikke-migrerede sider
funktionelle, og standalone må ikke montere en ubrugt greenfield-runtime ved siden af sin aktive legacy-runtime.

## 4. Det der bevares, omskrives og slettes

### 4.1 Bevar som adfærd eller byggesten

- Zod-sektionsschemas og schema-afledte typer.
- `.eo`-preflight og tolerant load.
- Codec- og parsersemantikken i `fieldCodecs.ts` og eksisterende canonical utils.
- Strukturelle felt-/entity-adresser og stabile row-id'er, når de ikke bruger UI-geometri.
- Command-cases for felt-, række-, reset-, load- og historyhandlinger.
- Verificeret session-write, rollback, monotone revisioner og history-symmetri.
- `InputReader`-ideen og `CriticalActionCoordinator`-ideen.
- Fase-0-outputinventaret som midlertidig, udtømmende migrationscheckliste.
- Adfærdsorienterede tests for editor, F5, undo/redo, gates, tabeller, beregninger og persistence.

### 4.2 Omskriv, ikke udbyg

- `inputState`, `inputCommands`, `inputReader`, `inputIssue`, `inputProjection` og `inputTransactionRunner`.
- Feltkataloget til et lille statisk descriptor-katalog.
- Runtime-storen til input + revision + history + nødvendig systemstatus.
- Felt- og tabelinput til én editor med to tynde surface-adaptere.
- Domæneprojektioner til almindelige rene funktioner.
- Save- og dokumentgates til samme issue-/projektionsresultater som deres preflight.

### 4.3 Slet ved cutover

- Legacy command-algebra og compatibility-runner.
- Sentinel-/legacy-adresser og mixed envelope.
- Browser-sessionmigration fra gamle sektions- og `invalidDrafts`-nøgler.
- Offentlige `invalidDrafts`- og stored `fieldErrors`-API'er.
- `FormPersistenceContext` som inputfacade og skrivbare hel-sektionshooks.
- `useDraftField`, `useDraftLifecycle`, `useTableInputCore`, `useRowDrafts` og `useSliceRowDrafts` i deres nuværende
  roller.
- Gridets værdikopier, fingerprints, pending effect-flush, id-grafting og orphan-reconcile-effects.
- Den generiske projektions-DSL og den gamle `domain/inputIntegrity`-blockermodel.
- Per-issue `blocksSave`, manuelt blocker-scope og komponentrapporterede fejl.
- Implementeringsspecifikke tests, som kun beskytter de afløste mekanismer.

## 5. Migrationsprincipper

### 5.1 Én koordineret cutover

Fase 1–5 i §8 udgør én samlet, ikke-deploybar implementeringstranche. Faseoverskrifterne er arbejdspakker og
kontrolpunkter, ikke selvstændigt grønne afleveringsgates. Der må ikke afleveres eller deployes en blanding, hvor:

- nogle persisted felter bruger gammel og andre ny runtime,
- samme felt har fallback mellem gammel og ny writevej,
- UI er migreret, men en afhængig beregning fortsat læser rå sektioner,
- gammel og ny adresseform kan ligge i samme envelope,
- et featureflag, dual-read eller dual-write holder begge systemer aktive.

Interne checkpoints må være midlertidigt ikke-kompilerbare. Målrettede rene tests køres, når deres modulgrænse er
sammenhængende; fuld typecheck, lint og produktsuite er først en gate efter fase 5. Det er ikke en forudsætning, at
programmet kan kompilere, starte, fungere eller bruges, mens denne tranche implementeres. Legacykode må derfor ikke
bevares alene for at holde den ufærdige arbejdsgren funktionel eller grøn. Den seneste grønne version i git-historikken
er den eneste deploybare reference, indtil hele cutoveren er grøn. Ingen af fase 1–4 må markeres færdig eller lande som
et ubrugt nyt produktionssidespor.

Legacykode må kun bevares midlertidigt, når den aktivt bruges som sammenlignings-/karakteriseringsgrundlag, eller når
den endnu indeholder et ansvar, som skal identificeres og overføres. Den må ikke være runtime-fallback eller en parallel
produktionsvej. Når sammenligningen eller ansvarsoverførslen er afsluttet, slettes koden i den relevante arbejdspakke;
fase 6 er kontrol og sikkerhedsnet, ikke standardtidspunktet for udsat legacyoprydning.

### 5.2 Compilerfejl er migrationslisten

Legacy-entrypoints slettes tidligt i cutoveren. TypeScript-fejl bruges derefter som konkret callsite-ledger. Der
oprettes ikke compatibility-facader for at få en delmigreret app til at kompilere.

### 5.3 Ingen migrationsarkitektur for migrationsarkitekturens skyld

Midlertidig kode skal enten:

- være en ren testfixture uden produktionsimport, eller
- slettes i samme ikke-deploybare cutover.

Den må ikke få public API, runtime fallback, egen persistence eller permanente arkitekturværn.

### 5.4 Stop ved produktændringer

Følgende er hårde stop:

- ændrede beregningstal, afrundinger, satser eller dokumentindhold,
- anden synlig adfærd end §1 og de eksisterende godkendte kontrakter,
- et inputfelt, collection eller output, som ikke kan placeres entydigt i den nye model,
- behov for at slette gyldigt brugerinput automatisk,
- behov for en raw-section-bypass for at få en consumer til at virke.

## 6. Midlertidige migrationsinventarer

Før kodecutover oprettes små maskinlæsbare coverage-inventarer med én dataidentitet pr. felt, collection eller
makro-consumer—ikke pr. schema-leaf og ikke pr. rendersted. De er migrationsbackstops og slettes i fase 6; de må ikke
blive en parallel runtime-autoritet.

Det tidligere krav om at duplikere alle editorlokationer, validators, missing-regler og output-invariants i fase 0
forkastes: disse data skal bo direkte i de endelige descriptors/projektioner, når de bygges i fase 2–5. Et fuldt
engangsregister med samme data ville være den migrationsarkitektur-for-migrationens-skyld, som §5.3 forbyder, og ville
kunne drifte fra slutkatalogerne før cutover.

### 6.1 Feltledger

Feltinventaret udledes fra de levende Zod-schemas, samler `AmountValue`-leaves til ét brugerfelt og udelader kun
verificerede entity-id-leaves. Den sammenholdes med de eksisterende produktionsbindings, så schema-only legacy og
bindings uden schema opdages. Codec-/control-annotationer er kun migrationsklassifikation. Det endelige data-descriptor-
katalog i fase 2 ejer id, typed ref, strukturel adresse, codec, tomhed, relevans, validators og beskedkoder.
Editorlokationer er overflade-/navigationsmetadata og registreres i den konkrete form-/grid-adapter; de må ikke gøre
datafeltets descriptor afhængig af route, DOM eller renderer. Completeness bevises derfor separat for datafelter og
aktive editorlokationer.

### 6.2 Collectionledger

Collectioninventaret har én entry pr. dynamisk collection og angiver:

- strukturel sti,
- entity-id-egenskab,
- child-felter og nested collections,
- codec- og kontroltypeklassifikation for child-felterne.

Completeness-testen sammenholder inventaret med Zod-collections og de eksisterende produktionsbindings. Placeholder-
promotion, row factory samt add/delete/reorder-commands flyttes til den fælles collection-/gridadapter i fase 2.
Rendereren og editorlokationerne hører til surface-registret, ikke den framework-frie collectiondescriptor.

### 6.3 Consumerledger

Consumerinventaret dækker de låste makro-entrypoints:

- 8 beregningsentries,
- 4 sagsfilstier,
- 18 dokumentoutputs.

Contentbox-consumers, konkrete projektioner, row-/aggregatsemantik, missing-regler, output-invariants og prioriterede
editorlokationer registreres kun i de endelige projection-/documentdefinitioner i fase 3–5 og completeness-testes dér.

Fase 0 registrerer og fastlåser de faktiske baseline-counts i testfixtures som `EXPECTED_FIELD_REF_COUNT`,
`EXPECTED_COLLECTION_COUNT` og `EXPECTED_CONSUMER_COUNT`; ingen placeholder eller ukendt count må bestå exitgaten.
Efter fjernelsen af schema-only legacy i fase-0-reviewet er baseline 239 feltrefs, 16 collections og 30 makro-
consumers. En lille ledger-validator under
`scripts/architecture/verify-input-ledgers.mjs` producerer den sammenlignelige inventoryrapport og fejler ved
uregistrerede, dublerede eller forældreløse entries.

## 7. Testmodel

### 7.1 Fælles feltkontrakt

Samme suite køres mod form- og grid-adapteren for hver codecfamilie:

- åben draft ændrer intet afsluttet,
- eksisterende rød fejl bliver stående under redigering,
- ny fejl vises først efter settle,
- blur og Enter settler præcis én gang,
- Escape fra gyldigt, tomt og allerede fejlende afsluttet udgangspunkt,
- gyldigt, tomt, ugyldigt format og out-of-bounds,
- no-op uden revision/history,
- Delete/Backspace fra lukket felt,
- dropdown/toggle immediate commit,
- paste og tast-initieret åbning,
- F5/remount efter gyldigt og fejlende settle.

### 7.2 Obligatoriske statekæder

```text
gyldig A → ugyldig X → undo → redo
ugyldig X → ugyldig Y → undo → redo
ugyldig X → gyldig B → undo → redo
gyldig A → tom → undo → redo
gyldig A → bounds-fejl B → undo → redo
skjult gyldig A → vis igen
skjult fejl X → undo → redo
række med fejl → slet række → undo → redo
```

Hvert trin hævder current canonical slot, rejected råtekst, visning, feltissue, consumerstatus, `.eo`-gate,
dokumentgate, revision og history.

### 7.3 Issue-/gate-matrix

Alle relevante field- og domænetests dækker mindst:

- formatfejl og bounds-fejl giver identisk UI-, beregnings- og dokumentgate,
- kun rejected formatfejl blokerer `.eo`; canonical bounds-fejl kan gemmes,
- missing giver ingen rød markering og ingen `.eo`-blokering,
- warning blokerer intet,
- irrelevant felt overblokerer ikke,
- rækkeprojektion isolerer øvrige rækker,
- aggregatprojektion inkluderer alle valgte rækker,
- beregningsmotor kaldes aldrig fra en blocked projektion.

### 7.4 Transaktionsinvarianter

For hver command-type testes:

- schema-/katalogafvisning før observerbar mutation,
- canonical clear + rejected write i samme kandidat,
- én session-write og ét store-write,
- én monoton revision,
- højst ét history-trin,
- no-op uden write/revision/history,
- rollback ved serialization/storage/store-fejl,
- row-delete uden descendants/orphans,
- authoritative replacement rydder history efter policy.

### 7.5 Kritiske handlinger

Integrationstests dækker form og grid ens for:

- save/download med åben gyldig og ugyldig draft,
- navigation med settle og fortsat navigation,
- load/reset/clear med åben editor: succes kasserer draften uden settle; annullering/fejl bevarer den,
- undo/redo med åben editor,
- friskt input-/settingssnapshot efter settle,
- ingen lazy-load, generator eller fil-I/O ved blokering.

## 8. Detaljeret migrationsplan

### Fase 0 — Rebasér kontrakter og inventarer

**Status:** Gennemført og reviewet 2026-07-16. Kontrakterne er rebaset (AGENTS.md + de normative
kontrakter, guidet af en linjepræcis contract-audit): masking→XOR, strukturel `.eo`-gate uden per-issue save-policy
(§1.6-matrixen er nu normativ i `error-contract.md`), `missing` som consumerfejl, legacy-session-/feltadressemigration
fjernet, critical-action-matricen rettet og friskhed = `EvaluationSourceToken` (input + settings). De tre midlertidige
inventarer er bygget i `src/inputCore/ledger/` (239 datafelter, 16 collections, 30 makro-consumers) med maskinlåste
baseline-counts, completeness-test mod de levende Zod-schemas/produktionsbindings og validator
(`npm run verify:ledgers`). Reviewet fjernede to schema-only legacyfelter og én ubrugt collection; de endelige
descriptors, editorlokationer og consumerdependencies bygges kun én gang i fase 2–5 efter den korrigerede §6.

**Afhængighed:** Ingen.

#### Arbejdstrin

1. Opdatér `AGENTS.md` og de normative kontrakter for form, mineo-field, error, persistence, undo/redo,
   critical-action, keyboard-navigation, document-output, snapshot, page-component og schema-evolution.
2. Opdatér berørte domænekontrakter, mindst Varige mén og alle kontrakter med save-/range-/visibility-regler.
3. Fjern masking/recovery som målregel og indfør XOR-invarianten fra §1.5.
4. Fjern per-issue save-policy. Fastlås tabellen i §1.6 normativt.
5. Fastlås, at `missing` aldrig er et aktivt rødt feltissue.
6. Fastlås, at warnings aldrig er blockers.
7. Fastlås universel oprydning af fejlende skjult input og bevaring af gyldigt skjult input.
8. Ret critical-action-matricen: navigation settler begge surfaces; load/reset/clear gennemføres uden settle og
   kasserer kun draften ved succes.
9. Fjern normative krav om legacy-session- og feltadressemigration. Bevar `.eo`-tolerance.
10. Fastlås current-session-korruptionsflowet fra §1.12 og den samlede input-/settingsfriskhed fra §3.4.
11. Markér de tidligere fase 0–4-statusser i reviewplanerne som historiske og afløste.
12. Byg de midlertidige felt-, collection- og consumerinventarer i §6 og verificér dem mod levende schemas,
    produktionsbindings og fase-0-consumerinventaret.
13. Registrér de faktiske baseline-counts; ingen ukendt eller midlertidig count accepteres.
14. Klassificér hver nuværende synlig fejl som feltfejl, consumerfejl eller warning.

#### Exitkriterier

- Ingen kontrakt omtaler en skjult recovery-værdi under rejected input.
- Ingen kontrakt tillader `.eo`-save med aktivt relevant rejected input.
- Ingen kontrakt lader et canonical feltissue blokere `.eo`-save.
- Ingen kontrakt kan gøre `missing` rødt eller save-blokerende.
- Ingen kontrakt kræver browser-sessionkompatibilitet.
- Hvert schemafelt og hver collection findes i præcis ét inventory-entry og ét eksisterende produktionsbinding.
- Alle 8 beregningsentries, 4 sagsfilstier og 18 dokumentoutputs findes i consumerinventaret.
- Schema-only legacy er fjernet i stedet for at blive båret ind i slutkataloget.
- Friskhed omfatter både input og relevante AppSettings.

#### Verifikation

Ren kontraktændring kræver ingen kodegate. Ledger-validatoren og completeness-tests køres, når ledgerne er oprettet;
ved topologiændring følges `docs/architecture/contract-topology-procedure.md`.

### Fase 1 — Omskriv den rene inputkerne

**Status:** Gennemført og reviewet 2026-07-16; save-/bounds-sondringen er genåbnet 2026-07-18 og udestår som
afgrænset korrektion. Den rene, framework-frie inputkerne er genopbygget fra
bunden i `src/inputCore/` (ingen React, Zustand, DOM eller storage): XOR-invariant (`SettledInput` + reducer der rydder
canonical til tomværdien ved ugyldigt settle), reason-bærende codecs over de uændrede parse-kerner, statisk katalog uden
seal/brand/WeakSet, issue-model (felt/consumer/warning) uden `blocksSave`, `ValidationReader`→issue-snapshot→
`InputReader` (skjuler værdi bag rød feltfejl), tokenbundet issue-evaluering og en lille `ready | blocked`-
projektionscollector. Reviewet tilføjede uge/år/brøk/string-backed-codecs, eksplicit semantisk tomhed, rejected-
relevansinvarianten, codec-konsistens ved sessionvalidering, 50-trins history og fuld issuekode/severity. Kernen har nul
produktionscallsites; produktdescriptors bygges direkte ved fase-2-cutoveren uden et parallelt fase-1-katalog.

**Afhængighed:** Fase 0.

Fasen må ikke indføre React, Zustand, DOM eller storage.

#### Arbejdstrin

1. Omskriv `SettledInput`-schemaet med katalogvalideret rejected↔canonical-XOR.
2. Gør canonical tomværdi/clear til en obligatorisk del af hvert persisted felt.
3. Forenkl feltbeskrivelse og statisk katalog; fjern runtime registration/seal/brand-lag.
4. Bevar strukturelle adresser og builders, men fjern legacy-/sentinel-formatet.
5. Konsolidér codecs og lad invalid resolution bære konkret reason/detail.
6. Omskriv reduceren for alle commands i §3.6.
7. Implementér før/efter-proceduren i §3.6 for atomisk oprydning af feltfejl, der bliver irrelevant; bevar gyldigt
   input.
8. Omskriv issue-modellen til field/consumer/warning uden `blocksSave` og `blocksProjection`; save-gaten læser
   strukturelt, om inputaggregaten indeholder rejected input.
9. Omskriv `ValidationReader` og den efterfølgende offentlige `InputReader`, så feltvalidering ikke er cirkulær, og et
   felt med aktiv feltfejl aldrig eksponerer sin canonical værdi til consumers.
10. Erstat projektions-DSL'en med en lille collector og almindelige rene funktioner.
11. Indfør `EvaluationSourceToken` med input- og settingsrevision.
12. Port adfærdstests og slet tests, som hævder masking, policy-flags, brands eller factory-autorisering.
13. Lad codecs afvise format/schema-urepræsenterbarhed, men committe schema-gyldige out-of-bounds-værdier; flyt
    min/max-vurderingen til canonical feltvalidators.
14. Erstat den issuebaserede `blocksEoSave`-regel med en strukturel gate over `rejectedInputs`.

#### Exitkriterier

- `gyldig A → ugyldig X` efterlader ikke A i current snapshot.
- Samme reducer håndterer form, grid, row og systemcommands.
- Katalogprimitivet har ingen runtime registration/seal/brand; produktets faktiske descriptors bygges én gang i fase 2
  og erstatter da både migrationsinventaret og legacybindings.
- Format- og bounds-feltfejl giver samme UI-/gatekonsekvens, mens repræsentationsforskellen i §1.6 er eksplicit testet.
- Missing kan ikke konstrueres som feltfejl.
- Kernen har ingen timing, effects eller UI-callbacks.

#### Stopkriterier

- Et schema kan ikke repræsentere feltets tomværdi uden ændring af beregningslogik.
- Et nuværende felt kan ikke gives én entydig strukturel adresse.
- En feltvalidator kræver mounted componentstate.

#### Verifikation

- Målrettede codec-, state-, reducer-, reader-, issue-, relevance- og projectiontests for den sammenhængende rene
  kerne.
- Dette er et internt kontrolpunkt i den ikke-deploybare tranche; fuld typecheck, test-typecheck og lint er ikke en
  fasegate før fase 5.

### Fase 2 — Atomisk runtime- og inputoverflade-cutover

**Status:** Gennemført, verificeret og kritisk reviewet 2026-07-18 (internt kontrolpunkt, ikke deployhandoff). Den slanke
runtime, current-only envelope, verificerede command-runner, replacement-generation, aktiv-editor-registry, kritiske
handlingsbarriere, fælles persisted editor og form-surface er bygget. Produktkataloget dækker strukturelt alle 239
felter og 16 collections og verificerer også schema-defaultede tomværdier. Alle slices er migreret som surfaces:
Stamdata, Satser, Årsløn, Renteberegning, Varige mén, Forsørgertab, Erhvervsevnetab og Erstatningsopgørelse inklusive
nested ansættelsesforhold. Samtlige persisted tabeller bruger den fælles greenfield-celle-/collectionvej, herunder
ferie, svie/smerte, TAF, offentlige ydelser, manuel lønudvikling og manuelle procentsatser. Direkte formularfelter
kræver editorlokation via deres typed props; tabeller konstruerer stabile lokationer fra collection, row-id og kolonne.
Satser, Årsløn, EET og EO har tidlige
typed projektioner og dokumentpreflight, fordi aktive rå-section-/stale-render-bypasses ville være værre end at flytte
disse consumerdele frem; det markerer ikke fase 3 eller 5 som gennemført.

Reviewet fjernede hovedappens parallelle `FormPersistenceProvider`, den ubrugte greenfield-runtime i standalone,
legacy-PWA-load fra Mineos midlertidige entry og singleton-bypass fra React-consumers. Mineo bruger derfor kun den nye
runtime, selv om den resterende legacy-shell ikke fungerer i mellemtilstanden; standalone Renteberegning er migreret
atomisk. Startup-notice, global undo/redo-fokusnavigation og case-replacement-porten færdiggøres med fase 4's
shell-cutover; de må ikke erstattes af parallel legacylogik. Feltrelevans, domænevalidatorer og consumerissues
færdiggøres systematisk i fase 3 og er ikke et fase-2-exitkriterium. Som ekstra kontrol blev den fulde produktsuite
kørt grønt ved faseafslutningen, selv om den bindende deploygate fortsat ligger efter fase 5.

**§2.5 trin 1 (fælles grid-adapter) LANDET som isoleret kontrolpunkt (2026-07-17).** Rækkeinfrastruktur og
celleeditor er bygget i `src/inputCore/react/` oven på den ENE editor-motor — ikke en anden editor: `useCollectionRows`
(row-id-liste + insert/delete/reorder direkte over reducerens row-commands; ingen `draftRows`/fingerprint/
persistence-effect, §3.8) og `useCellEditor` (en eksisterende-række-celle er 1:1 `useFieldEditor`; en placeholder-celle
tilføjer KUN en ren settle-override, `promoteRowSettleIntentToCommand`, der re-router første ikke-tomme settle til
`settleFieldInNewRow`, §1.11). Motoren udvidedes minimalt: `useFieldEditor` fik en valgfri `settleOverride`, og
`fieldEditorEngine` fik placeholder-promotion-command'en. 12 målrettede tests (`gridAdapter.test.tsx`): row-liste/
insert/delete/reorder, atomisk descendant-oprydning ved row-delete, placeholder-promotion (gyldig/ugyldig/tom=no-op),
celle-issue uændret under redigering, og §7.2-kæden række-med-fejl→slet→undo→redo. Grid-adapteren konsumeres nu i
produktion af Årsløn (§2.4 trin 3), gennem `useGridCellSurface`, der bro-forbinder `useCellEditor` til
`GridCoreController`s celleeditor-registry, så pil/Enter/Tab-navigation, to-trins-klik og Delete-i-celle bevares
1:1. Løntabellens valideringssummary er nu ren og reader-afledt (`resolveStandardLoenTableValidation`); det
imperative tabel-handle bærer kun visuel feedback (flash/scroll/missing-hint), ikke længere validerings-state.

**Afhængighed:** Fase 1.

**Deployregel:** Ingen handoff mellem fase 1 og fase 5.

#### 2.1 Slim runtime

1. Byg produktets ene descriptor-/collectionkatalog direkte fra schemas, verificeret eksisterende adfærd og faktiske
   editorcallsites; hver datadescriptor ejer typed read/write, codec og semantisk tomhed. Relevans og validators
   færdiggøres på samme descriptor i fase 3. Editorlokationer/renderere registreres separat i surface-laget jf.
   §6.1–6.2.
2. Bevis data-descriptor-, collection- og editorlocation-completeness separat mod fase-0-inventaret/callsites, og slet
   derefter de gamle bindings som del af cutoveren. Path/count-completeness alene er ikke en exitgate.
3. Erstat runtime-storen med `input`, `revision`, `history` og nødvendig hydration-/systemfejlstatus.
4. Slet afledte sections/invalidDraft-views, revisionsmaps, epochs, counters og stored fieldErrors.
5. Erstat typed + legacy runner med én command-union og én entrypoint.
6. Indfør current-only session-envelope på en ny intern nøgle/version.
7. Bevar current-format schema/katalogvalidering, read-back og rollback.
8. Slet al læsning og oversættelse af gamle browserformater.
9. Giv AppSettings én monoton settingsrevision, så `EvaluationSourceToken` altid kan verificeres samlet.

#### 2.2 Kritiske handlinger og editorregistry

1. Registrér højst én aktiv persisted editor pr. app-runtime.
2. Implementér actionmatricen i §1.4 ens for form og grid.
3. Lad save/download modtage settle-resultat og friskt `EvaluationSourceToken` eksplicit.
4. Fjern form/grid-policyforskelle og DOM-scanning som korrekthedsmekanisme.

#### 2.3 Én persisted editor

1. Implementér editoren direkte over `FieldRef`, reader og runner.
2. Afled lukket visning direkte fra den afsluttede revision.
3. Seed åben draft fra rejected raw eller `formatForEdit`.
4. Escape lukker uden command; behold kun åbnings-replacement-generation/fokusmetadata og ingen værdibærende startkopi.
5. Vis feltissue fra den afsluttede revision uændret under redigering.
6. Implementér form- og grid-adaptere uden parsing/persistence/errorstate.
7. Hold transient UI-controls eksplicit uden for persisted editor.

#### 2.4 Formularmigration i fast rækkefølge

1. Stamdata.
2. Satser.
3. Årsløn og Fælles årsløn.
4. Renteberegning i hovedapp og standalone MinProcesrente.
5. Varige mén.
6. Forsørgertab.
7. Erhvervsevnetab.
8. Erstatningsopgørelse, inklusive nested ansættelsesforhold.

Et callsite er først migreret, når det kun modtager sin konkrete ref/editorlocation og ikke længere `value`,
`parse`, `format`, `onCommit`, invalid-key eller error-reporter.

#### 2.5 Tabelmigration i fast rækkefølge

1. Fælles celleeditorer og gridregistry.
2. Rentekrav.
3. Ferie-, fravær-, svie/smerte-, TAF- og øvrige-krav-perioder.
4. EET-afgørelser.
5. Offentlige ydelser.
6. Manuel lønudvikling og manuelle procentsatser.
7. Standardløn top-level.
8. Standardløn og lønudvikling i nested ansættelsesforhold.
9. Øvrige collections fra ledgeren, indtil completeness-testen er tom.

For hver tabel fjernes i samme arbejdspakke:

- row/celle-draftkopier,
- fingerprints,
- pending persistence-effects,
- string-key invalid channels,
- orphan reconcile,
- kolonneindeks som dataidentitet.

Hvis en migreret surface fortsat har en aktiv beregnings- eller dokumentconsumer, må consumeren ikke holdes i live med
raw sections eller legacy-runtime. Den må enten være bevidst brudt i den ikke-deploybare mellemtilstand eller flyttes
frem som en lille typed reader-projektion. En sådan nødvendig fremflytning ændrer ikke fase 3–5's øvrige exitstatus.

Før beløbsfelter og grid-paste migreres, sammenholdes den faktiske nuværende adfærd med form-/keyboardkontrakten:
legacy-familierne er ikke ens om lukket paste åbner editoren eller committer straks. Da en ensretning er synlig
UI-adfærd, er uklarheden et stopkriterium og forelægges brugeren; den må ikke afgøres ved at kopiere den første adapter.

#### 2.6 Sletteliste og ansvarsoverdragelse

Fase 2 sletter editor-, write- og rækkekopirollerne ved den sidste aktive persisted surface. Følgende legacyfamilier
må derefter have nul produktionscallsites fra persisted surfaces:

- `src/input/legacyInputCompatibility.ts`,
- `src/input/legacyGridTransactionBridge.ts`,
- `src/persistence/inputSessionMigration.ts`,
- `src/schemas/invalidDraftsSchema.ts`,
- `src/types/invalidDrafts.ts`,
- `src/config/invalidDraftsVersion.ts`,
- `src/config/cellInvalidDraftScopes.ts`,
- `src/config/entityInvalidDraftScopes.ts`,
- `src/utils/invalidDraftsStorage.ts`,
- `src/contexts/CellInvalidDraftScopeContext.tsx`,
- `src/hooks/useDraftField.ts`,
- `src/hooks/fieldState/` i nuværende rolle,
- `src/hooks/tableInput/` i nuværende rolle,
- `src/rowDrafts/`,
- `src/components/tables/gridCore/useGridRowPersistenceCore.ts`,
- compatibility-rollerne i `formPersistenceStore`, `undoRedoStore` og `formPersistenceReadModel`,
- legacy test-only store mutations.

Fysisk filsletning sker ikke før filens sidste aktive ansvar er flyttet. Flere af familierne ovenfor er fortsat
transitive dependencies til den gamle case-/session-/shell-infrastruktur eller til transiente `Styled*`-controls;
de beholdes isoleret frem til fase 4 og slettes dér sammen med `FormPersistenceContext*`, `useFormPersistence`,
`usePersistedForm` og gamle persistence-selectors. Dette er ikke tilladelse til nye imports: fase-2-vagterne kræver
fortsat nul brug fra migrerede persisted surfaces. Fase 6 verificerer, at ingen sådan midlertidig fysisk rest består.

#### Exitkriterier

- Et persisted felt har én ref, én codec, én editor og én commandvej.
- Alle aktive editorlokationer er dækket af surface-completeness; datafelt-counts kan ikke stå alene.
- Ingen persisted surface skriver helsektioner eller rejected input direkte.
- Ingen tabel har en konkurrerende værdikopi.
- Lukket felt har ingen værdibærende lokal state eller resync-effect.
- Runtime/envelope kan ikke repræsentere legacy-adresser.
- Alle legacy input-write-/editor-symboler har nul produktionscallsites; case-/dokumentansvar fjernes i fase 4–5.

#### Verifikation

- Målrettede editor-/adaptertests mod syntetiske immutable issue-snapshots.
- Alle codecfamilier, placeholder-first-invalid, row-delete og undo/redo.
- Fuld field-contract-, actionmatrix- og komponentgate afventer fase 3–4, hvor validatorer og caseporte findes.
- Dette er et internt kontrolpunkt; grøn compile/build gør ikke appen deploybar før fase 3–5 er afsluttet.

### Fase 3 — Domæneprojektioner og ren fejlmodel

**Status:** Gennemført og verificeret 2026-07-24 (internt kontrolpunkt, ikke deployhandoff). Alle otte
consumerslices er migreret til rene reader-projektioner:

- **Satser:** `projectSatser` er eneste side-/dokumentprojektion; den døde rå-sektionsgate og dens selectors er
  fjernet.
- **Årsløn:** `buildAarsloenReaderProjection` samler reader-læste værdier, tabelissues, omregningsgate, beregning
  og dokumentstamdata fra én revision. Side og frisk dokumentpreflight bruger samme projektion.
- **EET:** `buildErhvervsevnetabReaderProjection` er eneste inputvej til det Zod-validerede snapshot; snapshotgrænsen
  modtager kun reader-afledte issue-beskeder og ikke legacy reporter-typer.
- **EO:** `buildErstatningsopgoerelseReaderProjection`, snapshot, kontrol og dokumentgate bruger alene
  reader-afledte EO-issues; den domænelokale issue-form har erstattet legacy-fejltyper på hele EO-vejen.
- **Renteberegning:** `buildRenteberegningReaderProjection` bygger række- og aggregatprojektioner over readeren;
  `RenteberegningTab` og download-gaten forbruger den, og rækkeafhængighed følger af de læste refs (§1.10).
- **Stamdata/fælles input:** `Stamdata.tsx` er fuldt greenfield-migreret og læser gennem readeren; den delte
  brevhoved-dokumentprojektion `projectStamdataForDocument` forsyner alle øvrige slices' dokumentgates. Stamdata
  har ingen egen beregning, så en separat reader-beregningsprojektion er hverken nødvendig eller planlagt.
- **Varige mén:** `buildVarigeMenReaderProjection` er den ene kanoniske projektion til både sidevisning og
  download-gate; `computeVarigeMenEngine` køres uændret på reader-læste værdier, og en dedikeret
  projektionsunit-test (`varigeMenReaderProjection.test.ts`) beviser byte-identisk output, bounds-/datoorden-
  blokering og `missing`.
- **Forsørgertab:** `buildForsoergertabReaderProjection` fører reader-afledte røde feltfejl ind i det uændrede
  `computeForsoergertabSnapshot`, som ejer den dependency-specifikke panel-/gate-logik (§1.10).

Alle otte slicenes beregningstal er bevaret af de eksisterende golden-/paritetstests (§5.4). De afløste
component-reporter-hooks `useAslAarsloenRuleReporter`, `useForligAnsvarsgradValidation` og `useTableCellErrorTracker`
er slettet, da deres regler nu er slice-lokale rene funktioner i projektionerne uden produktionscallsites.

**Bevidst udskudt til fase 4:** `src/types/fieldErrors.ts` og `src/hooks/useFormFieldErrors.ts` fjernes ikke her,
fordi de fortsat er transitive dependencies for den levende legacy `Styled*Field`-inputvej og
`FormPersistenceContext`/`inputRuntimeStore`-infrastrukturen (§2.6/§4.3: fysisk sletning følger med det sidste
aktive ansvar i fase 4). `invalidDrafts`-celle-kanalen (`cellInvalidDraftScopes.ts`,
`useReconcileInvalidDraftsToLiveRows.ts`) er stadig i aktiv brug og hører ligeledes til fase 4.

**Afhængighed:** Fase 2. Ingen handoff før fasen er gennemført.

Migrér komplette consumerslices i denne rækkefølge:

| Slice | Skal med i samme arbejdspakke |
|---|---|
| Satser | sidevisning, feltissues, beregning og dokumentprojektion/dependencies |
| Renteberegning | rækker, totaler, hovedapp, MinProcesrente og dokumentprojektion/dependencies |
| Stamdata/fælles input | tværsideprojektioner, dato-/personissues og dokumentdependencies |
| Årsløn | beregning, tabeller, fælles årsløn og dokumentprojektion/dependencies |
| Varige mén | beregning, bounds, kontrol og dokumentprojektion/dependencies |
| Forsørgertab | snapshot, kontrol og dokumentprojektion/dependencies |
| Erhvervsevnetab | alle row-/aggregatprojektioner og dokumentprojektion/dependencies |
| Erstatningsopgørelse | EO-snapshot, kontrol/inspektion, alle tabs og dokumentprojektion/dependencies |

Fase 3 leverer alene de rene projektioner, issues og dependencydefinitioner, som dokumentkataloget senere bruger. Den
migrerer ikke dokumentknapper, click-preflight, lazy-load eller generatorentrypoints; det sker én gang i fase 5.

For hver slice:

1. Definér field validators og contentbox-issues som rene funktioner.
2. Byg beregningsinput gennem readeren.
3. Kald kun beregningsmotoren ved `ready`.
4. Bevis at format- og bounds-feltfejl giver samme UI-, beregnings- og dokumentgate/resultatstatus.
5. Bevis at missing ikke giver rød markering eller `.eo`-blokering.
6. Bevis at warnings ikke blokerer.
7. Bevis row-isolation og korrekt aggregatblokering.
8. Fjern tidligere resultat ved ny blocked revision.
9. Fjern component-reporters og raw-section-reads i domæne- og beregningskode. Dokumententrypoints fjernes først i
   fase 5, når deres fælles prepare-flow findes.
10. Bevar alle eksisterende tal-/golden-tests uændret.

#### Sletteliste

- `src/types/fieldErrors.ts`,
- `src/hooks/useFormFieldErrors.ts`,
- form-/tabel-error-reporters og `useTableCellErrorTracker`,
- `src/domain/inputIntegrity/` i den gamle blocker-/scope-rolle,
- rå canonical selectors i domæne- og beregningskode,
- lokale Renteberegning-/Satser-key- og scope-builders.

#### Exitkriterier

- Ingen beregningsmotor kan kaldes med et felt, som readeren vurderer fejlende.
- Ingen mounted komponent kan tilføje/fjerne en autoritativ fejl.
- Ikke-dependencies overblokerer ikke.
- Alle synlige resultater følger den seneste afsluttede revision.
- Beregningstal er uændrede for alle tidligere gyldige fixtures.

#### Verifikation

- Domænemålrettede tests efter hver slice.
- Fuld field-contract-suite mod form og grid, nu med de faktiske validatorer og issues.
- Fuld app-typecheck og produktsuite afventer fase 5; dette er fortsat et internt kontrolpunkt.
- Ethvert ændret beregningstal er hårdt stop og forelægges brugeren.

### Fase 4 — `.eo`, session og kritiske sagsoperationer

**Status:** Påbegyndt. Den rene, strukturelle save-projektion er implementeret i
`src/persistence/eoSaveProjection.ts`: rejected input blokerer, mens schema-gyldigt canonical input — også med
afledte bounds-issues — projekteres til et komplet sektionssnapshot. Koblingen til sagsfiloperationerne samt
load-, reset-, clear- og session-cutoveren nedenfor er endnu ikke gennemført.

**Afhængighed:** Alle field validators og projectionslices i fase 3.

#### Arbejdstrin

1. Byg global `.eo`-save-evaluering fra det friske inputaggregate og det komplette feltissue-snapshot.
2. Blokér præcis ved mindst ét aktivt relevant rejected input; canonical feltissues, missing og warnings tillader
   save.
3. Finalisér åben editor før save og genlæs revisionen.
4. Byg save-snapshot fra canonical input gennem reader-/savegrænsen.
5. Fail-close direkte på ethvert aktivt/relevant rejected input som defense-in-depth. Et irrelevant rejected input er
   et brud på inputtransaktionens cleanup-invariant og skal være afvist allerede ved current-envelope-validering; det
   må hverken behandles som en skjult brugerfejl eller gemmes.
6. Bevar streng save→load round-trip for schema-gyldigt brugerinput.
7. Bevar tolerant `.eo`-preflight og de tre godkendte valg.
8. Load en gammel out-of-bounds canonical værdi, vis feltfejlen og tillad nyt save, mens afhængige consumers fortsat
   er blokeret.
9. Route load, reset og `Slet alt` gennem critical-action-koordinatoren og én replacement-command. Åben draft
   ignoreres under apply, blokerer aldrig og kasseres først efter succes.
10. Ryd history atomisk efter succesfuld hel-sags-replacement.
11. Flyt startupnotice, brugerfejl, `hasAnyData`, bootstrap og caseoperationer til de adskilte porte i §3.10.
12. Bevis current-session-korruptionsflowet: rå envelope bevares, normale writes blokeres, systemfejl vises, og kun
    eksplicit `Slet alt` kan rydde kilden.
13. Slet `FormPersistenceContext*`, `useFormPersistence`, `usePersistedForm`, gamle persistence-selectors,
    per-sektion/session-hydrators og compatibility-cleanup.

#### Testmatrix

- gyldig sag,
- formatfeltfejl,
- boundsfeltfejl,
- tomt required felt,
- warning,
- fejl på umounted side,
- åben editor ved save,
- åben editor ved succesfuld og annulleret/fejlende load/reset/clear,
- gammel `.eo` med ukendte/fjernede/manglende felter,
- load trods fejl,
- storage-/fil-I/O-fejl og rollback.

#### Exitkriterier

- Saveknappen og click-preflight bruger samme feltissue-snapshot.
- Ingen fil-I/O starter ved aktivt relevant rejected input.
- Canonical input med et rødt feltissue kan gemmes.
- Missing og warning kan ikke blokere `.eo`.
- Rejected raw kan ikke serialiseres til `.eo`.
- Der findes ingen legacy browser-sessionreader.

#### Verifikation

- Alle fire fase-0-sagsfilentrypoints.
- Fuld persistence- og load/save-suite.
- Målrettede persistence-, startup- og load/save-suiter.
- Fuld app-typecheck og produktsuite afventer fase 5, fordi dokumententrypoints endnu migreres.

### Fase 5 — Alle dokumentoutputs

**Status:** Ikke påbegyndt.

**Afhængighed:** Fase 3–4.

De 18 output-id'er er:

```text
satser, rente, rente-oversigt, regulering, krl, kl-loenaftaler,
erstatningsopgoerelse, taf-fordelt-paa-aar, taf-opreguleret-paa-aar,
taf-krav-graf, varigemen, aarsloen, sh-dage, kapitalisering,
efter-eal, differencekrav, loebende-ydelser, forsoergertab
```

For hvert output:

1. Opret én typed dokumentdefinition.
2. Brug samme projektion til reaktiv gate og click-preflight.
3. Blokér på relevante field- og consumererrors; ignorér ikke-dependencies.
4. Lad warnings passere.
5. Settle åben editor før preflight.
6. Kræv frisk `EvaluationSourceToken` efter lazy-load og umiddelbart før generatorstart.
7. Send kun `PreparedDocument<T>` til generator/service.
8. Placér PDF/Word-formatvalg efter gaten.
9. Fjern lokale booleans, click-gates og direkte generator-/servicekald.
10. Markér først outputtet migreret, når matrix-testen er grøn.

#### Udtømmende matrix pr. output

- relevant ugyldigt format,
- relevant bounds-fejl,
- relevant missing-fejl, hvor outputtet har required input,
- relevant warning,
- ikke-relevant fejl,
- åben draft, som settler gyldigt,
- åben draft, som settler fejlende,
- input- eller settingsrevisionsændring under lazy-load,
- direkte programmatisk aktivering.

For blokerede cases beviser testen, at der ikke sker lazy-load, generatorimport eller fil-I/O.

#### Exitkriterier

- Alle 18 outputs findes i det kanoniske outputkatalog og matrixen.
- Ingen dokumententrypoint kan omgå prepare-flowet.
- Reaktiv gate og click-preflight kan ikke drifte fra hinanden.
- Standalone MinProcesrente bruger samme input-/revisionskerne.

#### Verifikation og samlet deploygate

- Kør målrettede dokumenttests og den udtømmende matrix for alle 18 outputs.
- Kør `npm run typecheck`, `npm run typecheck:test`, `npm run lint` og `npm run test`.
- Først når disse gates er grønne, må fase 1–5 samlet betragtes som kompilerbar og klar til den afsluttende
  legacykontrol og grænsehåndhævelse i fase 6. Den er fortsat ikke færdigleveret før fase 7.

### Fase 6 — Bekræft legacyfjernelse og håndhæv grænserne

**Status:** Ikke påbegyndt.

**Afhængighed:** Fase 1–5.

#### Arbejdstrin

1. Verificér, at alle slettelister i fase 1–5 er gennemført. Slet kun rester, som bevidst blev beholdt til aktiv
   sammenligning eller ansvarsoverførsel.
2. Fjern fase-0-migrationsinventaret, når slutkatalogerne selv giver udtømmende coverage.
3. Port eller slet implementeringsspecifikke tests for afløste mekanismer.
4. Tilføj AST-baserede regler i det eksisterende architecture-harness uden ny dependency.

Reglerne beviser:

- kun runneren skriver input,
- persisted controls kræver konkrete refs,
- domæne-/dokumentkode ikke importerer raw store/sections,
- dokumententrypoints ikke omgår prepare,
- transient UI-controls ikke kan skrive sagsinput,
- legacy-symboler ikke genindføres.

Forbudt-symbol-gaten dækker mindst:

```text
invalidDrafts
fieldErrors
executeLegacyInputTransaction
useDraftField
useDraftLifecycle
useTableInputCore
useRowDrafts
useSliceRowDrafts
usePersistedForm
FormPersistenceContext
legacyGridTransactionBridge
blocksSave
```

#### Exitkriterier

- Ingen permanent compatibility-facade, fallback, dual-read eller dual-write.
- Ingen produktionsforekomst af de forbudte symboler.
- Slutregistrene, ikke migrationsinventarer, driver completeness-tests.
- Kontrakter, kode, tests og guards beskriver samme model.

### Fase 7 — Samlet accept

**Status:** Ikke påbegyndt.

#### Automatiske gates

Kør i rækkefølge:

```text
npm run typecheck
npm run typecheck:test
npm run lint
npm run test
npm run build:all
```

Kør desuden `check:mojibake`, `check:filename-case` og øvrige releasechecks, når cutoveren skal committes eller
frigives.

#### Manuel browsermatrix

Verificér i både hovedapp og relevante standalone flows:

1. Åben valid draft uden live hop.
2. Åben allerede fejlende draft med uændret rød markering.
3. Blur, Enter, klik væk og side-/fanenavigation.
4. Escape fra gyldigt, tomt og fejlende afsluttet udgangspunkt.
5. Formatfejl og bounds-fejl med samme gates og forskellige beskeder.
6. Tomt required felt: ingen rød markering, contentbox-fejl og relevant outputblokering.
7. Warning uden blokering.
8. Skjul fejlende input; vis gyldigt input igen.
9. Undo/redo-kæderne i §7.2.
10. F5 med gyldigt og fejlende afsluttet input samt åben draft.
11. Placeholder-række med første fejlende input.
12. Række-delete og undo/redo.
13. `.eo`-save/load og gammel tolerant `.eo`.
14. Hvert dokumentdomæne og begge outputformater, hvor de findes.
15. Revisionændring under async dokumentforberedelse.

#### Endelig afleveringsgate

Cutoveren er først færdig, når:

- alle automatiske gates er grønne,
- browsermatrixen er dokumenteret gennemført,
- ledgeren har nul umigrerede entries,
- alle slettelister er tomme,
- beregningstal og dokumentindhold er uændrede for gyldige fixtures,
- ingen godkendt produktregel i §1 afhænger af timing eller component mount.

## 9. Rollback- og fejlprincip under migrationen

Der bygges ikke runtime-rollback til legacy.

- Den seneste grønne version i git-historikken er eneste deploybare version, indtil fase 1–5 samlet er grøn; legacykode
  skal ikke holdes kørbar i den aktuelle arbejdsgren som rollbackmekanisme.
- Interne delmål aktiveres ikke gennem flags, dual-read, fallback eller compatibility.
- Ved forkert arkitekturantagelse stoppes cutoveren, og den nye løsning omarbejdes. Legacyvejen udbygges ikke som
  nødløsning.
- Ved ændret beregning, dokumentindhold eller ikke-godkendt synlig adfærd stoppes arbejdet og forelægges brugeren.
- Current-format sessionkorruption håndteres fail-closed; gamle interne browserformater ignoreres.
- `.eo` er den eneste historiske brugerdata-kompatibilitet, som bevares.

## 10. Acceptkriterier for slutarkitekturen

1. Der findes ét autoritativt inputaggregate og én autoritativ write-grænse.
2. Ugyldigt settle fjerner den tidligere canonical værdi fra current state; den findes kun i undo-history.
3. Samme current felt kan ikke have både ikke-tom canonical værdi og rejected raw.
4. Åben draft ændrer aldrig afsluttet visning, fejl, beregning eller gate.
5. Eksisterende feltfejl forbliver synlig under redigering; nye fejl vises først efter settle.
6. Form og grid bruger samme editor og codec; deres adaptere ejer kun interaktion/rendering/navigation.
7. Et lukket felt har ingen værdibærende lokal kopi, pending guard, fingerprint eller resync-effect.
8. Alle persisted feltadresser er strukturelle og uafhængige af DOM/kolonneindeks.
9. Format- og bounds-feltfejl har identisk UI-, beregnings- og dokumentgate; kun beskeder varierer.
10. Aktivt relevant rejected input blokerer `.eo` globalt; canonical feltissues blokerer ikke `.eo`.
11. Tomhed giver aldrig rød feltfejl og blokerer aldrig `.eo`.
12. Missing kan blokere en afhængig beregning eller et dokument gennem contentboxen.
13. Warning blokerer aldrig beregning, dokument eller `.eo`.
14. Gyldigt skjult brugerinput bevares; fejlende skjult input ryddes atomisk med det styrende valg.
15. Uafhængige beregninger og dokumenter overblokeres ikke.
16. En blokeret ny revision viser ikke et tidligere resultat som gyldigt.
17. Rækkeprojektioner isolerer andre rækker; aggregater inkluderer alle valgte rækker.
18. Første fejlende settle i placeholder-række overlever F5.
19. Row-delete fjerner alle descendants atomisk og kan undo'es fuldstændigt.
20. Hver reel inputhandling giver én revision og højst ét history-trin.
21. Undo/redo/load/reset skaber nye monotone revisioner.
22. Issues, beregninger og gates afhænger ikke af component mount.
23. `.eo` indeholder kun schema-gyldigt canonical brugerinput og aldrig rejected raw.
24. `.eo`-load er tolerant; browser-sessioner har ingen legacy-kompatibilitet.
25. Navigation settler begge surfaces; load/reset/clear gennemføres uden settle og kasserer kun åben draft ved
    succes.
26. Save/download settler og evaluerer friskt input-/settingssnapshot før fil-/generatorarbejde.
27. Alle 18 dokumentoutputs bruger samme definition til reaktiv gate og click-preflight.
28. Ingen beregnings-, save- eller dokumentkode kan importere raw canonical sections.
29. Ingen permanent compatibility-facade, dual-read, dual-write eller fallback eksisterer.
30. Kontrakter, kode, tests, ledger og arkitekturværn beskriver samme model.

## 11. Ikke-mål

Designet indfører ikke:

- nye beregningstyper, features eller dokumenter,
- ændringer af beregningsregler, satser, afrunding, clamping eller dokumentindhold,
- live preview eller live validering af åben draft,
- serverkommunikation, eksterne API'er, telemetri eller ekstern logging,
- nye dependencies,
- kompatibilitet med gamle interne browser-sessioner,
- generiske udvidelsespunkter til hypotetiske fremtidige beregningstyper,
- en generisk form-/projektionsframework ud over Mineos aktuelle behov.

Målet er den mindste auditerbare arkitektur, som gør den godkendte adfærd deterministisk og gør stale input,
mount-afhængige fejl og parallelle write-/readveje urepræsenterbare.

## 12. Arbejdsaftale under cutoveren (bindende, brugerbekræftet 2026-07-17)

Denne aftale gælder ALLE resterende faser og passes i draft/commit-greenfield-cutoveren:

1. **Jeg (agenten) træffer alle proces- og kodebeslutninger.** Fremgangsmåde, sekventering, pass-afgrænsning,
   modulopdeling, navngivning, teststrategi, sletterækkefølge og enhver rent teknisk afvejning er mit ansvar. Jeg
   forelægger dem ikke for brugeren.
2. **Brugeren forelægges KUN spørgsmål, hvis en beslutning vil ændre UI/UX eller beregninger** — dvs. noget en
   bruger faktisk kan se eller mærke (synlig adfærd, layout, tekst, feedback, tal, afrunding, dokumentindhold).
   Rent tekniske valg (hvordan koden struktureres, hvornår et modul cuttes, om noget bliver bevidst brudt i den
   ikke-deploybare mellemtilstand) er IKKE brugerspørgsmål.
3. **Når noget forelægges, sker det altid som ikke-tekniske, konkrete eksempler på den forskel en bruger vil
   opleve** — aldrig som teknisk arkitektur- eller scope-spørgsmål. Fx "i dag ryster knappen når du prøver at slå
   omregning til med fejl i tabellen; efter ændringen bliver den bare tonet ned" — ikke "skal grid-adapteren
   eksponere et imperativt handle?".
4. Dette er en skærpelse af [[feedback_user_decides_only_uiux_calc]] og ændrer ikke §5.4's hårde stop: en faktisk
   beregnings-/dokumentindholds-/synlig-adfærdsændring er fortsat et stop, der forelægges — men som konkret
   bruger-oplevet eksempel.
