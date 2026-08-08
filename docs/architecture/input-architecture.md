# Input-arkitekturen: draft, afsluttet input og projektion

**Type:** **Informativ.** Dokumentet forklarer, hvordan inputmodellen er indrettet og hvorfor. Det er IKKE
normativt: de bindende regler bor i `src/contracts/` (primært `form-contract.md`, `persistence-contract.md`,
`critical-action-contract.md`, `undo-redo-contract.md` og `document-output-contract.md`), og ved konflikt
vinder kontrakten.

**Ét afsnit har en maskinel binding.** §5's 30 acceptkriterier læses ordret af
`src/__tests__/quality/acceptanceMatrix.test.ts`. En omformulering eller en ændring i antallet gør registret
rødt — kriterierne skal derfor ændres sammen med testen, ikke i den ene ende alene.

**Scope:** Persisterede sagsinput i formularer og tabeller, feltfejl, beregningsprojektioner, dokument-output,
`.eo`-save/load, `sessionStorage`, undo/redo og kritiske handlinger.

**Læsevejledning:**

| Afsnit | Indhold |
|---|---|
| §1 | Den godkendte produktadfærd — de tre semantiske niveauer og reglerne for dem. |
| §2 | Arkitekturens form: inputaggregatet, felt-editoren, issue-modellen og projektionerne. |
| §3 | Coverage-registrene, der holder katalog og schema i sync. |
| §4 | Testmodellen. |
| §5 | Acceptkriterierne. **Maskinelt bundet** — se ovenfor. |
| §6 | Ikke-mål. Gældende afgrænsning. |

---
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

**Den delte «peg på dette felt»-blinkmarkering** (BF-020/BF-021). Programmet har tre veje, der fører brugeren hen
til en indtastning, som kræver opmærksomhed: undo/redo-fokusrestoren, save-blokeringens fokus og de interne
fejl-/advarselslinks. Alle tre lokaliserer målet gennem den ENE feltidentitet i DOM
(`data-mineo-field-address`, §3.2), og alle tre afslutter med den samme visuelle markering:
`blinkFieldAttention` i `src/inputCore/react/fieldAttentionBlink.ts`.

- Markeringen er en **ren DOM-effekt** (en CSS-klasse sat på det fundne element), ikke React-state. Det er netop
  dét valg, der gør den generelt tilgængelig: den kan lægges på ethvert element, en feltadresse peger på, uden at
  feltkomponenten kender til den, holder state eller opter ind. Et nyt felt eller en ny tabel arver markeringen
  alene ved at bære feltadressen, som surfacen allerede sætter.
- Animationen bor ét sted (`sharedApp.css`). Den tidligere tabel-lokale `errorFlash` — privat for Årslønssidens
  løntabel og nøglet på et cellekoordinat, ingen anden flade kunne tale — er væk.
- Markeringen er **rent visuel**: den ændrer ingen værdi, sætter ingen feltfejl (§1.7) og blokerer intet. Den
  siger «her», ikke «dette er forkert», og bruges derfor både til ægte fejl og til en manglende indtastning, der
  endnu ikke er en fejl.
- Har en fejl intet enkelt ansvarligt felt (fx et overlap mellem to rækker), markeres rækkeankeret — det grovere,
  men stadig sande mål.

**Hvor en regel skal bo, for at feltet kan blive rødt** (BF-028/BF-031). Rød ring og tooltip kan kun tegnes af et
`FieldIssue`, og det bærer en strukturel `FieldRef`. En regel, der udtrykker sit mål som noget ANDET end en
feltadresse — et tekst-path (`"svieSmertePerioder[0].fra"`) eller et kolonne-hint (`'fra' | 'til'`) — kan derfor
aldrig markere feltet, uanset hvor korrekt den er. Den kan stadig vise sin tekst i "Fejl og advarsler" og endda
navigere til feltet, og netop dét gør fejlmåden svær at få øje på: alt ser ud til at virke undtagen ringen.

Placeringen følger, om fejlen entydigt tilhører ét felt:

- **Descriptor-validator** — når reglen kan afgøres af feltet plus dets kontekst, som en `CanonicalView` kan læse
  (fx kronologien i et dato-par, hvor modparten står i samme række). Dette er standardvalget.
- **Projekteret `FieldIssue` fra et domænemodul**, leveret via `crossFieldIssue`/`collectionRuleIssue` — når reglen
  kræver BEREGNEDE værdier, som ikke er canonical input. Modulet binder selv den rigtige adresse
  (`manualRegulationDateIssues` og `tafCutoffDateIssues` er mønstret). Alternativet ville trække beregning ind i
  valideringslaget. Et sådant modul skal hente sit grundlag fra SAMME resolver som beregningen — `tafCutoffDateIssues`
  bruger `resolveTafCutoffDates`, netop den kilde motorens clamping læser — så fejlen aldrig kan navngive en anden
  grænse end den, der faktisk anvendes.
- **Række-/consumerissue uden ring** — når fejlen ikke har ét ansvarligt felt (overlap mellem rækker), eller når
  den er tomhed (`missing`, §1.7). At farve den ene af to lovlige datoer ville udpege et vilkårligt offer.

Der bygges **ikke** en oversætter fra tekst-path til feltadresse. En sådan bro ville gøre strengen til en de facto
feltidentitet ved siden af `data-mineo-field-address` og genindføre præcis den drift, den ene identitet fjernede.

En kronologiregel må desuden ikke clampe sine grænser mod modparten: gør den det, spiser bounds-reglen
rækkefølgereglen, beskeden skifter til en intervaltekst, og hvad brugeren ser kommer til at afhænge af rækkens
øvrige fejl. Clampingen hører til i motoren. Reglen bor i `src/inputCore/catalog/dateOrderValidators.ts`, og
fra/til-parret dannes som ÉN enhed, så en kollektion ikke kan registreres med kun den halve markering.

**Maskeringens bagside.** Readeren skjuler en værdi bag en rød feltfejl (§1.5). Det er rigtigt over for
motorerne, men enhver ANDEN læser af de samme værdier — herunder legacy-validatoren — ser da et TOMT felt og kan
konkludere, at værdien mangler. Resultatet er en dublet: den sande feltfejl plus en usand «mangler»-besked om et
felt, brugeren tydeligvis har udfyldt. `suppressMaskedMissingInvariants` fjerner den usande halvdel, og den
ligger dér, hvor de to lister mødes, fordi kriteriet er en egenskab ved PARRET: en validator kan ikke selv vide,
om en tom værdi er brugerens tomhed eller readerens maskering. Tilføjes en ny regel, der maskerer et felt, skal
det efterprøves, om en anden læser derved begynder at melde feltet tomt.

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
  eksplicitte `Slet alt` må fjerne den korrupte kilde og starte en ny sag. Bootstrap må aldrig stiltiende starte tomt
  og senere overskrive kilden. Det er dataintegritet, ikke versionskompatibilitet.
- En NY sag er ikke en tom sag: den bærer domænets og brugerens erklærede standardværdier (§2.11). Både
  bootstrap af en frisk session og `Slet alt` giver samme udgangspunkt, og overwrite-gaten måler brugerdata
  imod netop det udgangspunkt.

## 2. Arkitekturens form

### 2.1 Autoritativ inputtilstand

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

### 2.2 Enkel feltbeskrivelse

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

### 2.3 Fælles codecs

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

### 2.4 Ren feltvurdering og lille `InputReader`

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

### 2.5 Én felteditor

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

### 2.6 Én command-runner

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
4. Materialisér katalogets afledte skrivninger i kandidaten og validér den igen.
5. Afvis semantisk no-op.
6. Serialisér den ene aktuelle session-envelope.
7. Skriv og verificér én `sessionStorage`-værdi.
8. Opdatér input, revision og history i ét Zustand-write.
9. Rul storage og runtime tilbage til før-snapshottet ved uventet fejl.

**Afledte felter.** Et felt, hvis kanoniske værdi er en funktion af andre afsluttede felter, er ikke brugerinput
men en konsekvens af det. Sådanne felter erklæres som `DerivedInputWrite` på kataloget — id, den ene sektion
reglen må skrive i, og en ren, idempotent `materialize` — og materialiseres i trin 4, altså inde i samme
kandidat som årsagen. Årsag og konsekvens hører dermed til samme revision og samme history-trin.

En React-effect må aldrig skrive en afledt værdi. Den ville gøre konsekvensen til en selvstændig autoritativ
handling med sit eget undo-trin, og et undo kunne straks blive skrevet tilbage af den samme effect, fordi det
styrende valg stadig var aktivt. Grænsen håndhæves af AST-reglen
`input/derived-writes-materialize-in-reduction`.

Kataloget afviser ved commit en regel, der skriver uden for sin erklærede sektion, og en regel, der ikke er
idempotent. Idempotenskravet er load-bearing: en svingende regel ville skrive noget nyt ved næste command uden
nogen brugerhandling.

Fordi reglerne kører på hver command — også `replaceCase` fra en indlæst `.eo` — kan et afledt felt ikke stå
ude af trit med sin kilde i nogen tilstand, en consumer kan observere. Det er en STRUKTUREL garanti, ikke en
konvention, og en separat "afviger værdien?"-validering af et afledt felt er derfor en gren, ingen tilstand kan
nå.

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

### 2.7 Session og history

Sessionen har én current-only envelopeversion. Den har ingen `fieldAddressVersion`-bro, sentinel-adresser eller
legacy-migrator.

History snapshotter kun afsluttet input og fokus-origin. Issues, beregninger, gates og åbne drafts genafledes eller
ignoreres. Restore skriver sessionen først, erstatter derefter input og skaber altid en ny monoton revision.

### 2.8 Tabeller

Rækkeinfrastrukturen ejer kun stabile id'er, rækkefølge, add/delete/reorder og én transient placeholder. Canonical
rækker læses direkte fra inputaggregaten. Der findes ingen `draftRows`, `internalTableData`, fingerprint-kopi eller
effect-flush til persistence.

Placeholder-promotion og første settle er én command. Row-delete fjerner rejected descendants i samme reducertrin.

### 2.9 `.eo`, beregninger og dokumenter

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

### 2.10 Små systemporte efter `FormPersistenceContext`

`FormPersistenceContext` erstattes ikke af en ny altomfattende facade. Dets øvrige ansvar fordeles eksplicit:

- `initializeInputRuntime` hydraterer før React-render og returnerer current-session-/startupstatus.
- `InputCommandPort` eksponerer kun typed commands; ingen raw sections eller rejected maps.
- `CaseFileOperations` ejer `.eo`-savens INPUT-side over reader-/replacement-grænserne: `evaluateSave`,
  token-friskhed (`isSaveSourceStillCurrent`), `applyLoadedSnapshot` og `hasAnyData`. Den ejer bevidst IKKE
  fil-I/O, codec, preflight-dialog, overwrite-gate eller PWA-samtidighed: de er UI-flow og bevarede
  fil-primitiver (§4.1), som shell-use-casen (`useFileSaveLoad`) orkestrerer. Porten er en runtime-adapter, ikke
  en ny altomfattende facade.
- `CaseResetOperations` ejer `Slet alt` (hel-sags-reset til en NY sag, §2.11) inklusive sikker kassation af åben
  draft ved succes og recovery fra blokeret current-session. Sektionsreset går gennem bindingens
  `resetSection`-command, fordi den er en sidelokal handling uden hel-sags-semantik.
- den eksisterende centrale systemfejl-/noticeoverflade viser startupfejl og brugerrettede operationsfejl.

Ingen af portene må både eksponere reads, raw writes, UI-notices og persistence. En port læser ALTID gennem
bindingens READ-ONLY kildeport `captureStableSource(): { input, token }` — aldrig produktions-singletonen direkte
(ellers kunne en alternativ binding vise én sag, mens porten læste og gemte en anden), og aldrig gennem den rå
store: en `StoreApi` på bindingen ville give enhver adapter `setState` og dermed en generel bypass af typed
commands, history og storage-grænsen.

Hver app-variant initialiserer sin ene aktive runtime før render; provider-remount må aldrig rehydrere eller
overskrive input. Der findes efter Fase 4 kun ÉN runtime at initialisere: legacy-provideren er slettet.

### 2.11 Én sandhed om "en ny sag"

En sektion får sin første værdi ét af to steder, og begge er levende:

1. **Ny-sags-seeden.** `src/inputCore/newCaseSections.ts` ejer typen og sammenfletningen; `createNewCaseInput`
   bygger den færdige sag. Domænet leverer seeds pr. slice, og `src/domain/newCaseSeed.ts` komponerer dem.
   Seeden er stedet for krav om "sådan starter en ny sag", som det persisterede schema ikke KAN udtrykke —
   enten fordi værdien kommer fra brugerens programindstillinger, eller fordi schemaets egen default bevidst
   tjener load-tolerance for ældre `.eo`-filer frem for en ny sag.
2. **`createEmpty<Sektion>Section` + schemaets defaults**, som reduceren materialiserer, første gang brugeren
   rører et felt på en side, hvis sektion ikke er seedet.

**En ny sag er ikke en tom sag.** Den samme konstruktion bruges tre steder, og de tre SKAL svare ens:
bootstrap-hydrationen (`initializeInputRuntime`, når der ikke findes en aktiv session), `Slet alt`
(`clearCase` bærer seeden), og overwrite-gatens `hasAnyData`, som måler brugerdata imod netop den baseline —
ikke imod tomhed. Ville de tre kunne svare forskelligt, ville sagens udgangspunkt afhænge af, hvordan den blev
født, og et program uden en eneste indtastning ville advare brugeren om at overskrive "sine data".

`composeNewCaseSeeds` kaster, hvis to slices vil eje samme sektion, så hver sektions ny-sags-værdi har præcis
én ejer. Alt andet, der ligner en new-case-fabrik, er enten afledt heraf eller en testfixture, hvis afvigelser
skal være erklæret.

Fire regler følger, og alle fire er håndhævet:

1. **Descriptorens tomværdi og den friske sektions værdi skal være enige.** `emptyValue` er både det, et
   `clearField` skriver, og det, readerprojektionerne falder tilbage til. Er de to uenige, har feltet to
   defaults, og hvilken domænet ser, afhænger af, om sektionen tilfældigvis er materialiseret endnu.
   Håndhæves af `freshSectionDefaults.test.ts` for alle statiske felter i alle sektioner.
2. **Ét brugervalg på en ny sag må aldrig udløse en systemfejl.** En systemfejl er en påstand om, at
   programmet er i stykker — ikke en fejl, brugeren kan rette. `freshCaseChoiceSweep.test.ts` fejer hvert
   statisk valg-/kontaktfelt gennem hver af sine valgmuligheder fra præcis den tilstand, `initializeInputRuntime`
   giver en ny sag, og kører hele domænets læsesti på resultatet. Valgmængden hentes fra feltets eget codec
   (`FieldCodec.options`), så nye felter og nye enum-værdier dækkes uden at nogen husker det.
3. **En testfixture må ikke være rigere end produktionens sag.** `newCaseFixtureParity.test.ts` kræver, at de
   ældre `create<Sektion>InitialValues`-fabrikker kun afviger fra den levende sag på erklærede punkter. Efter
   at ny-sags-defaults har fået ét sandt sted, er den eneste erklærede afvigelse tabellernes pladsholderrækker.
4. **En indstilling, der lover en standardværdi, skal ændre noget.** `newCaseSettingsDefaults.test.ts` måler
   virkningen — ikke koblingen: for hver nøgle i `NEW_CASE_DEFAULT_SETTINGS_KEYS` skal en ændret værdi ændre
   enten den nye sags indhold eller en nytilføjet rækkes indhold. Listen er samtidig fuldstændighedstjekket, så
   en ny `default*`-indstilling ikke kan tilføjes uden enten at blive koblet på eller erklæret som ikke-sagsdata.

Baggrunden er BF-025: `eoAngivetLoenLoenudvikling.loenPaaHelligdage` var valgfri i schemaet, havde ingen editor
og fik derfor aldrig en værdi — mens EO-motoren erklærede `undefined` umulig og fail-closede med en systemfejl.
Fejlen ramte enhver ny sag ved første valg i "Beregnes ud fra", og ingen test kunne se den, fordi suitens fixture
kom fra en fabrik, produktionen ikke bruger. Samme fabrik-uden-kaldere var årsagen til, at AppSettings' kategori
"standardværdier til ny sagsdata" aldrig slog igennem på en ny sag: den var kun koblet i fabrikken.

## 3. Coverage-registrene (`src/inputCore/ledger/`)

Registrene er en **permanent release-gate**: `verify:ledgers` kører som del af `verify:release`, og registrene
er den opregnelige mængde, completeness-testene måler dækning imod — herunder "alle 18 dokumentoutputs" og
"alle 8 beregningsentries". Fjernes de, forsvinder completeness-KRAVET, ikke kun en note.

Det levende ansvar er **schema-/consumerdrift**: et nyt felt, en ny collection eller et nyt entrypoint kan ikke
glide ind uregistreret, og et registreret symbol kan ikke forsvinde ubemærket.

Registrene har én dataidentitet pr. felt, collection eller makro-consumer — ikke pr. schema-leaf og ikke pr.
rendersted. De er coverage-backstops og må ikke blive en parallel runtime-autoritet: de data, runtime har brug
for, bor i descriptors og projektioner, ikke i et register ved siden af.

### 3.1 Feltledger

Feltinventaret udledes fra de levende Zod-schemas, samler `AmountValue`-leaves til ét brugerfelt og udelader
kun verificerede entity-id-leaves. Det sammenholdes med produktionsbindings, så schema uden binding og binding
uden schema opdages.

Descriptor-kataloget ejer id, typed ref, strukturel adresse, codec, tomhed, relevans, validators og
beskedkoder. Editorlokationer er derimod overflade-/navigationsmetadata og registreres i den konkrete
form-/grid-adapter; de må ikke gøre datafeltets descriptor afhængig af route, DOM eller renderer. Completeness
bevises derfor separat for datafelter og for aktive editorlokationer.

### 3.2 Collectionledger

Collectioninventaret har én entry pr. dynamisk collection og angiver:

- strukturel sti,
- entity-id-egenskab,
- child-felter og nested collections,
- codec- og kontroltypeklassifikation for child-felterne.

Completeness-testen sammenholder inventaret med Zod-collections og produktionsbindings. Placeholder-promotion,
row factory samt add/delete/reorder-commands ligger i den fælles collection-/gridadapter; renderer og
editorlokationer hører til surface-registret, ikke den framework-frie collectiondescriptor.

### 3.3 Consumerledger

Consumerinventaret dækker de låste makro-entrypoints:

- 8 beregningsentries,
- 4 sagsfilstier,
- 18 dokumentoutputs.

Contentbox-consumers, konkrete projektioner, row-/aggregatsemantik, missing-regler, output-invariants og
prioriterede editorlokationer registreres i de endelige projection-/documentdefinitioner og completeness-testes
dér.

Baseline-counts er fastlåst i testfixtures som `EXPECTED_FIELD_REF_COUNT`, `EXPECTED_COLLECTION_COUNT` og
`EXPECTED_CONSUMER_COUNT`. Validatoren `scripts/architecture/verify-input-ledgers.mjs` producerer
inventoryrapporten og fejler ved uregistrerede, dublerede eller forældreløse entries.

**En fælde værd at kende.** En `.transform()` på et persisteret sektionsschema blinder udledningen: Zod udsender
da et uigennemsigtigt output-schema, så `z.toJSONSchema` ikke længere kan se det nestede træ, og feltantallet
falder — uden at noget bliver rødt, fordi også schema-fingerprintet beregnes på det blindede schema. Stripning
og lignende omformninger hører derfor i sektionsmigratoren, ikke på schemaet. Optællingstestene kan ikke fange
det alene, fordi en blinding fulgt af en nedjusteret baseline står grøn.

---
## 4. Testmodel

### 4.1 Fælles feltkontrakt

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

### 4.2 Obligatoriske statekæder

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

### 4.3 Issue-/gate-matrix

Alle relevante field- og domænetests dækker mindst:

- formatfejl og bounds-fejl giver identisk UI-, beregnings- og dokumentgate,
- kun rejected formatfejl blokerer `.eo`; canonical bounds-fejl kan gemmes,
- missing giver ingen rød markering og ingen `.eo`-blokering,
- warning blokerer intet,
- irrelevant felt overblokerer ikke,
- rækkeprojektion isolerer øvrige rækker,
- aggregatprojektion inkluderer alle valgte rækker,
- beregningsmotor kaldes aldrig fra en blocked projektion.

### 4.4 Transaktionsinvarianter

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

### 4.5 Kritiske handlinger

Integrationstests dækker form og grid ens for:

- save/download med åben gyldig og ugyldig draft,
- navigation med settle og fortsat navigation,
- load/reset/clear med åben editor: succes kasserer draften uden settle; annullering/fejl bevarer den,
- undo/redo med åben editor,
- friskt input-/settingssnapshot efter settle,
- ingen lazy-load, generator eller fil-I/O ved blokering.

## 5. Acceptkriterier for slutarkitekturen

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
14. Gyldigt skjult brugerinput bevares; skjult input med rød fejl ryddes atomisk med det styrende valg.
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

## 6. Ikke-mål

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

