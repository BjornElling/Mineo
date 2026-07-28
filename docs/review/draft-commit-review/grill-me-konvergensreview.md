# Grill-me — tværgående konvergensreview

**Status:** Gennemgået  
**Dato:** 2026-07-28  
**Type:** Read-only review; ingen produktionskode er ændret  
**Scope:** Det greenfield-berørte input-, issue-, projektions-, beregnings-, dokument-, persistence-,
history-, shell- og tabelområde  
**Formål:** Find steder, hvor samme handling eller mål håndteres gennem forskellige veje, og afgør om
forskellen er sagligt begrundet eller en rest af organisk vækst  
**Fund:** 15 (GM-F01–GM-F15)  
**Kræver brugerbeslutning:** 0 — alle fire beslutninger blev truffet 2026-07-28  
**Hypoteser:** Ingen åbne; risici uden reproduceret brugerfejl er klassificeret som strukturelle fund

## Konklusion

Greenfield-arbejdet har reelt samlet de vigtigste hovedveje: inputaggregatet, form-/grid-editoren,
case-persistence og dokumentlivscyklussen har hver en tydelig autoritet. Der findes ikke en skjult komplet
legacy-runtime ved siden af.

Slutproduktet er dog endnu ikke konvergeret. Reviewet fandt:

- fire brugeroplevede forskelle, som kræver en produktbeslutning,
- flere aktive sideveje, som forfølger samme mål som den fælles arkitektur,
- to døde eller testholdte restveje,
- og to koncentrerede duplikationsklynger i tabel- og intervalinfrastruktur.

Den største samlede rest ligger i EO Lønindkomst. Her findes både en parallel feltfejlmodel, en separat
beregnings-/downloadregel for de samme satser og en effect, som skriver automatisk afledte satser som en ny
brugerhandling. Området bør behandles som én systemisk oprydning, ikke som tre lokale rettelser.

## Beslutningspunkter — kun oplevet adfærd

Dette afsnit er bevidst uden tekniske detaljer. Hvert punkt kan afprøves direkte i programmet.

### Beslutning 1 — Feriegodtgørelse vurderes forskelligt

**Sådan afprøves det**

1. Gå til *Erstatningsopgørelse → Oplysninger* og vælg, at TAF beregnes ud fra en beregningsperiode.
2. Gå til *Lønindkomst*, opret et ansættelsesforhold og udfyld en lønrække.
3. Vælg *Statistik*, *KRL*, *KL-lønaftaler*, *Manuel procentsats* eller *Ingen* under
   *Lønudvikling beregnes ud fra*.
4. Lad *Feriegodtgørelse/-tillæg* stå tomt.

Feltet kan blive vist som en rød fejl, selv om programmets beregnings-/downloadkontrol i samme situation
ikke betragter værdien som påkrævet.

**Beslutning:** Skal feriegodtgørelsen være påkrævet i disse fem situationer?

- Hvis ja, skal brugeren både se en entydig fejl, og det relevante resultat/dokument skal være blokeret.
- Hvis nej, skal feltet ikke markeres rødt eller blokere.

**Anbefaling:** Vælg én regel og anvend den overalt. Et tomt felt bør ikke være rødt; hvis feltet er
påkrævet for et bestemt resultat, bør det i stedet fremgå som en konkret mangel ved det resultat.

**Godkendt beslutning (2026-07-28):** Nej. En tom feriegodtgørelse må hverken markere feltet rødt eller
blokere ved *Statistik*, *KRL*, *KL-lønaftaler*, *Manuel procentsats* eller *Ingen*. Det samme gælder, mens
reguleringsformen er tom; her er det i stedet selve det manglende valg af reguleringsform, der skal markeres
og blokere.

Beslutningen er sikker på tværs af senere skift, fordi beregning, validering og dokumentgate skal vurdere
feltets relevans ud fra den aktuelt valgte reguleringsform:

- Ved et senere skift til *Overenskomst* eller *Manuelt angivet* bliver en manglende feriegodtgørelse straks
  en synlig, blokerende mangel, før beregning eller dokumentoutput må fortsætte.
- Ved skift tilbage til en af de fem former ovenfor ophører netop denne mangel med at markere eller blokere.
- En tom reguleringsform blokerer fortsat som manglende reguleringsvalg og kan derfor ikke nå beregningen.
- En tidligere indtastet feriegodtgørelse må gerne bevares som brugerinput ved formskift, men må kun læses af
  de former, hvor den er relevant.

Implementeringen skal regressionsdække alle syv reguleringsformer, tom reguleringsform og skift begge veje
mellem et ikke-krævende og et krævende spor. Den nuværende kode har allerede aktiv-form-dispatch og
fail-closed blokering ved tom reguleringsform; rettelsen skal samle feltmarkering og gate om den samme
relevansregel.

### Beslutning 2 — Fejl i én løncelle giver et delvist årslønstal

**Sådan afprøves det**

1. Gå til *Årslønsberegning*.
2. Udfyld en gyldig periode i én række og skriv fx `10.000` i *Løn* og `5.000` i *Løn (2)*.
3. Erstat derefter *Løn (2)* med `abc`, og afslut feltet.

Cellen bliver rød. Det viste årslønsresultat kan fortsætte med et tal, der kun bygger på de resterende
`10.000`, mens dokumentknappen samtidig er blokeret.

**Beslutning:** Skal et samlet årslønsresultat skjules, når en del af en medregnet række er fejlende?

**Anbefaling:** Ja. Gyldige, uafhængige rækker må gerne bevares internt, men den samlede årsløn bør ikke
vises som et færdigt tal, når en medregnet række kun er delvist anvendt.

**Godkendt beslutning (2026-07-28):** Ja; anbefalingen implementeres.

### Beslutning 3 — En Forsørgertab-oplysning når ikke brugeren

**Sådan afprøves det**

1. Udfyld *Forsørgertab*, så beregningen kan gennemføres.
2. Sæt årslønnen efter ASL til årets maksimum.
3. Lad den faktiske årsløn stå tom, eller sæt den til samme maksimum.

Programmet kan fortsat beregne og downloade, men brugeren får ikke den tiltænkte oplysning om, at den
faktiske årsløn skal indtastes, når ASL-årslønnen svarer til maksimum.

**Beslutning:** Skal denne ikke-blokerende oplysning vises?

**Anbefaling:** Ja, som en almindelig oplysning/advarsel uden rød feltmarkering og uden blokering.

**Godkendt beslutning (2026-07-28):** Ja; anbefalingen implementeres.

### Beslutning 4 — “Slet alt” genindlæser hele appen

**Sådan afprøves det**

1. Stå på en vilkårlig side eller fane.
2. Vælg *Slet alt* og bekræft.
3. Sammenlign med at indlæse en `.eo`-fil.

*Slet alt* genindlæser hele appen. Filindlæsning erstatter også hele sagen, men fortsætter inde i appen
og åbner *Stamdata* uden en fuld genindlæsning.

**Beslutning:** Skal *Slet alt* fortsat genindlæse hele appen?

**Anbefaling:** Bevar kun genindlæsningen, hvis den har en ønsket, synlig funktion. Ellers bør de to
hel-sagshandlinger afsluttes ens inde i appen.

**Godkendt beslutning (2026-07-28):** Genindlæsningen fjernes. *Slet alt* afsluttes inde i appen efter samme
overordnede mønster som filindlæsning.

## Fund

### GM-F01 — Parallel satsvalidering har konkret regeldrift

**Alvor:** Væsentlig  
**Klassifikation:** Utilsigtet rest af organisk vækst  
**Kræver godkendelse:** UI/UX og muligvis beregnings-/outputregel; se beslutning 1  
**Lokation:** `loenindkomstSatsValidation.ts:97-124`;
`loenindkomstSatserGate.ts:18-21,43-58,128-151`;
`useLoenindkomstViewModel.ts:75-83`; `AnsaettelsesforholdCard.tsx:508-579`

Samme satser vurderes i to aktive regelsæt: ét producerer røde feltfejl, og ét styrer EO's
beregnings-/downloadfejl. Koden dokumenterer selv, at de overlapper og bør konvergere.

Reglerne er allerede forskellige. Feltvejen kræver feriegodtgørelse ved beregningsperiode og indtastede
lønoplysninger uanset valgt lønudviklingsgrundlag. Outputvejen kræver den kun ved *Overenskomst* eller
*Manuelt angivet*. Outputvejen kontrollerer desuden Store Bededagstillæg, som feltvejen ikke medtager.

**Anbefalet retning:** Én ren satsvurdering skal producere både feltplacering, brugerbesked og
consumerkonsekvens. Den godkendte relevansmatrix i beslutning 1 er produktreglen.

### GM-F02 — Automatiske satser skrives som en ekstra brugerhandling

**Alvor:** Væsentlig  
**Klassifikation:** Utilsigtet parallel write-vej  
**Kræver godkendelse:** Nej, hvis satsernes synlige værdier og tidspunkt bevares, og kun den dokumenterede
én-handling/ét-undo-trin-adfærd genskabes  
**Lokation:** `useLoenindkomstViewModel.ts:85-115`; `dispatchInput.ts:365-372`;
`formContractIsolation.test.ts:17-30,99-112`

De fleste afledte ændringer udføres i samme transaktion som brugerens styrende valg. EO's automatiske
løn-/overenskomstsatser beregnes derimod efter render og skrives som en ny selvstændig history-handling.
Et undo af satsændringen kan straks blive modarbejdet af den samme automatiske synkronisering, fordi det
styrende valg stadig er aktivt.

Det eksisterende quality-værn opdager kun fire gamle funktionsnavne og ser ikke den aktuelle
`edit.dispatch(...)`-vej. Værnets registrerede undtagelsesmarkør findes heller ikke ved effecten, uden at
testen fejler.

**Manuel kontrol:** Skift overenskomst eller en dato, som ændrer låste satser, og tryk derefter `Ctrl+Z`.
Hele den oplevede handling skal kunne fortrydes én gang; satserne må ikke blot blive skrevet tilbage.

**Anbefalet retning:** Materialisér de automatiske følgeændringer i samme autoritative handling som det
styrende valg, og gør værnet strukturelt i stedet for navnebaseret.

### GM-F03 — To specialtoggles omgår fælles fokusgenopretning

**Alvor:** Væsentlig  
**Klassifikation:** Utilsigtet UI-sidevej  
**Kræver godkendelse:** Nej; den dokumenterede undo/redo-adfærd genskabes  
**Lokation:** `Aarsloen.tsx:112-127,318-323`; `OffentligeYdelserTab.tsx:260-279,382-390`;
`ToggleField.tsx:30,44-54`

Almindelige toggles bærer både feltets identitet og den konkrete placering, så undo/redo kan navigere
tilbage og fokusere kontrollen. *Omregning til fuldt år* og *Midlertidigt EET indsættes fra
Erhvervsevnetab-siden* bruger hver sin specialkobling:

- Årsløn bærer history-origin, men kontrollen kan ikke findes som fokusmål.
- EO's toggle mangler origin ved den simple ændring og peger på tabellens rækkeområde, når handlingen også
  sletter manuelle rækker.

**Manuel kontrol:** Skift togglen, navigér væk, og brug undo/redo. Begge skal føre tilbage til og fokusere
den toggle, brugeren aktiverede.

**Anbefalet retning:** Bevar de nødvendige flerfelts-/bekræftelsestransaktioner, men lad dem bruge samme
togglelokation og restore-kontrakt som øvrige persisted controls.

### GM-F04 — Årsløn beregner delresultat, mens dokumentet blokerer

**Alvor:** Væsentlig  
**Klassifikation:** Utilsigtet forskel mellem sideberegning og dokumentgate  
**Kræver godkendelse:** Beregningsvisning; se beslutning 2  
**Lokation:** `aarsloenProjection.ts:83-112,249-258,292-298`;
`useAarsloenBeregning.ts:90-105`; `Aarsloen.tsx:130-144,453`;
`aarsloenDownloadGate.ts:62-68`

En rød tabelcelle erstattes med sin tomværdi før beregningen. Tabelvalideringen registrerer samtidig
fejlen, men kun dokumentgaten bruger den som blokering. Sideberegningen kaldes fortsat og kan derfor vise
et tal for en delvist anvendt række.

**Anbefalet retning:** Lad sideberegning og dokumentdefinition afhænge af den samme
tabelprojektion. Beslutning 2 har godkendt, at det samlede tal skjules ved en delvist fejlende række.

### GM-F05 — Forsørgertab har en afkoblet parallel fieldUi-model

**Alvor:** Væsentlig  
**Klassifikation:** Legacy-præsentationsrest  
**Kræver godkendelse:** UI/UX; se beslutning 3  
**Lokation:** `forsoergertabSnapshot.ts:247-250,282-323,328-341`;
`Forsoergertab.tsx:92-101,261-274`;
`forsoergertabSnapshot.test.ts:160-209`

Forsørgertabssnapshottet bygger ti lokale felttilstande ved siden af den fælles issue-model. Siden læser
kun kønsfeltets lokale tilstand. Den særlige ASL-maksimum-oplysning er fortsat testet i snapshottet, men
forbindes ikke til den viste EAL-årsløn eller en contentbox.

**Anbefalet retning:** Fjern den parallelle felttilstandsmodel. Bevar oplysningen som fælles warning, hvis
beslutning 3 bekræfter, at den fortsat er ønsket.

### GM-F06 — Persisted felter accepterer en separat rå fejltekst

**Alvor:** Væsentlig  
**Klassifikation:** Systemisk parallel issue-vej  
**Kræver godkendelse:** Nej ved adfærdsbevarende konsolidering; konkrete regelændringer dækkes af GM-F01  
**Lokation:** `NumericTextField.tsx:51,96`; `GridTextCell.tsx:30,74`;
`GridChoiceCell.tsx:41,68`; `EetAslAfgoerelserTable.tsx:98-106`;
`erhvervsevnetabReaderProjection.ts:108-113,222-233`

De fælles persisted feltkomponenter viser normalt den revisionsbundne `FieldIssue`. Tre komponenter har
desuden en fri tekstprop, som kan gøre feltet rødt uden et `FieldIssue`.

Sidekanalen bruges af:

- EO's satsfejl, hvor den allerede har givet regeldriften i GM-F01,
- EET's kryds-række-fejl, hvor et separat cellemap driver rød markering, mens snapshottet kun aftager den
  første fejl til consumerblokering.

Dermed kan rød markering, fokusnavigation, contentbox og consumerblokering bygge på forskellige
repræsentationer.

**Anbefalet retning:** Collection-/tværfeltregler må fortsat afledes samlet, men resultatet skal være
strukturelle feltissues med samme adresse, prioritet og konsekvensvej som alle andre røde fejl.

**Status: delvist rettet 2026-07-28 (etape 4) — EET-halvdelen lukket.**

EET's kryds-række-fejl var båret af en parallel `Map<'${rowId}|${field}', string>` og vist gennem
`externalErrorMessage` på cellen. Reglerne KAN ikke flyttes til descriptor-validatorerne — de er
kryds-række-regler (dublet-afgørelser, virkningsdato mod tidligere kapitaliseringsdato, EET % mod summen af
forudgående kap. %), og en descriptor-validator ser kun sin egen celles værdi. Afledningen sker derfor fortsat
samlet i reader-projektionen, men RESULTATET er nu kanoniske `FieldIssue`s med rigtige feltadresser og
`reason: 'rule'` (§1.6). `buildFieldIssueSet` sikrer højst ét aktivt issue pr. adresse (§1.8) — samme
afgrænsning som den tidligere "første besked pr. celle".

Cellernes prop er derfor `collectionRuleIssue?: FieldIssue` i stedet for `externalErrorMessage?: string` i
`GridTextCell` og `GridChoiceCell`, og tabellen slår issuet op på den FÆRDIGT BUNDNE cellereference, editoren
selv driver (`CellSpec.field`) — ikke på en ny lokal binding. Der findes nu kun én bindingsvej; kunne de to
divergere, ville markeringen forsvinde lydløst fra cellen (jf. INC-F01, hvor netop en lokal binding gav
forkerte ejer-id'er i nestede collections). Dækningen hævder eksplicit, at tabellens opslagsadresse er
identisk med projektionens for hvert produceret issue, og mutationsbeviset er, at en binding til et andet
række-id gør netop den sammenligning rød.

**Udestående: EO-satshalvdelen.** `NumericTextField.externalError` bruges fortsat af EO's satsfejl
(`AnsaettelsesforholdCard.tsx:514-580`). Den halvdel konverteres sammen med GM-F01, ikke isoleret: GM-F01
bærer beslutning 1's relevansmatrix, altså en ændring af REGLEN selv. At konvertere repræsentationen først
ville betyde at flytte den nuværende — kendt forkerte — regel over i den nye form og derefter ændre den igen.

### GM-F07 — Varige mén kalder motoren inde i projektionsindsamlingen

**Alvor:** Væsentlig strukturel risiko  
**Klassifikation:** Utilsigtet metodeafvigelse; ingen aktuel talforskel påvist  
**Kræver godkendelse:** Nej ved beviseligt adfærdsneutral omlægning  
**Lokation:** `varigeMenReaderProjection.ts:57-91`;
`projection.ts:90-126,128-181`; `renteberegningReaderProjection.ts:103-136`

Den fælles projektionsmodel indsamler først input og afgør derefter, om motoren må kaldes. Renteberegning
følger denne overgang. Varige mén kalder motoren inde i indsamlingen efter egne manuelle guards.

De nuværende guards dækker de fire aktuelle dependencies, så ingen aktuel fejl blev fundet. Metoden gør
dog sikkerheden afhængig af, at ethvert fremtidigt read også tilføjes til den lokale guard.

**Anbefalet retning:** Byg typed motorinput først, og kald motoren gennem den fælles `ready`-overgang.

### GM-F08 — En død React-vej til Årslønsberegningen holdes levende af tests

**Alvor:** Mindre  
**Klassifikation:** Død parallel API  
**Kræver godkendelse:** Nej  
**Lokation:** `useAarsloenBeregning.ts:46-154`;
`aarsloenProjection.ts:36,298`; `useAarsloenBeregning.test.tsx:3,79-155`

Produktionskoden bruger kun den rene beregningsfunktion gennem Årslønprojektionen. Samme fil eksponerer
fortsat en React-hook, som ingen produktionskode kalder; kun dens implementeringstests holder den levende.

**Anbefalet retning:** Flyt den rene beregning og dens type til domænet, slet hook-wrapperen, og behold
invarianttests mod den aktive entry.

### GM-F09 — Død sektionsvis persistence findes ved siden af aggregate-envelope

**Alvor:** Væsentlig strukturel rest  
**Klassifikation:** Afløst persistencevej  
**Kræver godkendelse:** Nej  
**Lokation:** `buildPersistedSection.ts:27-39`;
`buildPersistedSection.test.ts:1-44`; `inboundPersistedSection.ts:38`;
`dispatchInput.ts:251-270`; `initializeInputRuntime.ts:57`

En helper beskriver sig fortsat som den eneste sektionsvise savevej og bygger sin egen
version/timestamp/data-repræsentation. Den har ingen produktionscallsites; kun en test holder den levende.
Den aktive runtime persisterer hele inputaggregatet i én envelope.

**Anbefalet retning:** Slet helperen og dens implementeringstest, og ret den stale dokumentationsreference.

### GM-F10 — EO-fejllinks bruger en separat heuristisk feltidentitet

**Alvor:** Væsentlig strukturel risiko  
**Klassifikation:** Utilsigtet navigationsrest  
**Kræver godkendelse:** Nej, hvis samme synlige destination bevares  
**Lokation:** `eoRowTypes.ts:110-112`; `eoRowIssueCatalog.ts:78-177`;
`scrollToEoRow.ts:67-83`; `historyRestoreTarget.ts:54-71`;
`saveBlockedFocus.ts:22-27,43-79`

Save og undo/redo finder felter gennem den fulde feltadresse og editorlokation. EO's links i *Fejl og
advarsler* bruger i stedet frie felt-/række-id'er, et manuelt register og enkelte gæt fra dansk
fejltekst eller kolonneindeks. En DOM-attribut fungerer som fallback.

Ingen forkert destination blev reproduceret i dette review. Der er dog tre vedligeholdte
identitetssystemer for samme mål, og EO-vejen kan drifte uden typefejl.

**Manuel kontrol:** Skab fejl i en EO-periode eller *Øvrige krav*, klik fejllinjen på
*Beregning*, og sammenlign destinationen med undo efter redigering af samme celle.

**Anbefalet retning:** Lad EO-rækker bære det samme strukturelle fokusmål som det kanoniske field issue.

### GM-F11 — Dokumentfejl vises på nogle sider, men forsvinder på andre

**Alvor:** Væsentlig  
**Klassifikation:** Utilsigtet UI-afvigelse  
**Kræver godkendelse:** Nej; dokumentkontraktens synlige fejlfeedback genskabes  
**Lokation:** `useDocumentDownload.ts:54-63,114-123`; `Satser.tsx:186-190`;
`EetEfterEalTab.tsx:55-59`; `EetKapitaliseringTab.tsx:96-100`;
`EetLoebendeYdelserTab.tsx:110-114`; `EetDifferencekravTab.tsx:421-425`

Dokumenthooken leverer en dansk fejlbesked ved fx stale source eller afbrudt dev-server-download.
Forsørgertab, Årsløn, Varige mén, EO og Rente viser beskeden. Satser og alle fire EET-faner kalder
downloaden, men renderer ikke udfaldsbeskeden. Brugeren kan derfor aktivere en download, få ingen fil og
ingen forklaring.

**Manuel kontrol:** Start et tungt EET-output og ændr et relevant input, mens dokumentet bygges. Sammenlign
med EO eller Årsløn i samme situation.

**Anbefalet retning:** Alle dokumentførende sider skal vise udfaldet fra den fælles dokumenthandle gennem
samme præsentationsmønster.

**Status: Rettet 2026-07-28** (etape 3, sammen med R6-F02 — samme fund fra to vinkler). Den kanoniske
`DocumentOutcomeMessage` er nu det ene sted, udfaldsrækken bygges, og alle otte flader viser beskeden.
AST-reglen `document/activation-shows-outcome` håndhæver grænsen: aktiverer en sidefil et dokumenthandle,
skal samme fil også rendere udfaldet. Fuld løsningsbeskrivelse, mutationsbevis og den bevidst udeladte
ensretning af de fem eksisterende rækkeudgaver står under R6-F02 i
[R6-dokumentoutput-og-generatorer](R6-dokumentoutput-og-generatorer.md#r6-f02--otte-outputs-kasserer-brugerbeskeden-efter-en-afbrudt-download).

### GM-F12 — “Slet alt” og load afslutter hel-sags-replacement forskelligt

**Alvor:** Mindre til væsentlig, afhængigt af den ønskede oplevelse  
**Klassifikation:** Uafklaret produktundtagelse  
**Kræver godkendelse:** UI/UX; se beslutning 4  
**Lokation:** `useFileSaveLoad.ts:202-225,473-503`

Begge handlinger bruger den autoritative replacement-grænse. Load navigerer internt til Stamdata.
*Slet alt* gennemfører først clear og laver derefter en fuld browsergenindlæsning. Ingen kontrakt
forklarer, hvorfor kun clear kræver reload.

**Anbefalet retning:** Fjern reloaden som godkendt i beslutning 4, og afslut *Slet alt* inde i appen.

### GM-F13 — Manuel load og PWA-load kopierer samme shellflow

**Alvor:** Mindre  
**Klassifikation:** Utilsigtet orkestreringsduplikation  
**Kræver godkendelse:** Nej ved identisk adfærd  
**Lokation:** `useFileSaveLoad.ts:315-366,368-422`; `fileLoad.ts:196-217,237-273`

De to flows gentager busy-start, load-forberedelse, nulstilling af dialogstate, kildeindlæsning,
preflight, apply, fejlfokus og cleanup. De underliggende filkilder deler allerede decode- og
preflightpipeline; kun UI-orkestreringen er duplikeret.

**Anbefalet retning:** Én shellprocedure med en injiceret filkilde. Manuel filvælger og PWA-launch er
fortsat to sagligt forskellige kilder, ikke to loadflows.

### GM-F14 — Placeholder- og cellebindingsalgoritmen findes i fem udgaver

**Alvor:** Væsentlig vedligeholdelsesrisiko  
**Klassifikation:** Utilsigtet tabelduplikation  
**Kræver godkendelse:** Nej ved identisk synlig rækkeadfærd  
**Lokation:** `useCollectionTable.ts:32-91`; `EetAslAfgoerelserTable.tsx:220-278`;
`StandardLoenTable.tsx:223-371`; `BeregnetRenteTable.tsx:264-320`;
`OevrigeKravTable.tsx:122-166`

Den samme procedure findes fem steder: hold stabile placeholder-id'er, undgå kollision efter promotion,
byg eksisterende/placeholder-rækker, bind cellen og opret en tom entity ved første settle.

Forskellene i antal tomme rækker er saglige:

- EET viser mindst to rækker,
- standardløntabellen viser sit domænes minimum,
- de øvrige viser én trailing række.

Antalsreglen begrunder ikke fem kopier af identitets- og bindingsalgoritmen. Sorterede tabeller har også
brug for samme kerne, blot med en sorteret committed liste.

**Anbefalet retning:** Udvid den eksisterende collection-table-kerne med `minimumVisibleRows` eller et
eksplicit placeholderantal, og lad sortering ske før kaldet.

### GM-F15 — Løntabel-reads og intervaloverlap har parallelle primitiver

**Alvor:** Mindre strukturelt; høj konsekvens ved senere drift  
**Klassifikation:** Utilsigtet helperduplikation  
**Kræver godkendelse:** Nej ved beviseligt identisk adfærd; beregningsfixtures skal køres  
**Lokation:** `aarsloenProjection.ts:83-126,214-266`;
`eoStandardLoenFieldSet.ts:32-125`;
`beregningsperiodeTafOverlap.ts:28`;
`tafBeregningsEngine.ts:27-30`; `tafDaySets.ts:224-225`;
`eoBilagRules.ts:22-23`; `periodOverlapDetection.ts:28-43`

To gentagne primitive concerns blev fundet:

1. Den delte standardløntabel rekonstrueres og samler cellefejl i to næsten ens reader-adaptere:
   én for Årsløn og én for EO. Forskellen er kun, om feltet bindes med et ekstra
   ansættelsesforholds-id.
2. Inklusivt datointervaloverlap udtrykkes flere steder med samme ulighed, selv om en eksporteret
   canonical funktion allerede findes. Nogle callsites tilføjer egen gyldighedskontrol, andre
   forudsætter validerede ranges.

**Anbefalet retning:** Gør både løntabeladapteren og lukket-interval-overlap til små canonical primitiver.
Callsites skal fortsat være eksplicitte om, hvorvidt rangegyldighed allerede er bevist.

## Kendte fund fra hovedreviewet, som denne rapport ikke duplikerer

Følgende eksisterende fund er også konvergensfund og indgår i den samlede vurdering, men beholder deres
oprindelige id:

- R2-F01: fem *Indsæt dags dato*-knapper bruger en command, som datofelter ikke må udføre.
- R2-F02: kontrakt og runtime er uenige om rydning af skjulte canonical fejl.
- R2-F03: de obligatoriske tværlags-statekæder mangler samlet dækning.
- R3-F01: midlertidig EET-import bruger sektionsblokering i stedet for konkrete dependencies.
- R3-F02: EO globaliserer issues uden faktisk dependency.
- R3-F03: `min > max`-beskeder følger forskellige callsitekrav.
- R3-F04: den offentlige reader gør brede issuefiltre mulige.

GM-F01/GM-F06 og R3-F04 peger samlet på samme systemiske oprydning: en feltfejl skal have én strukturel
repræsentation, og consumerblokering skal følge konkrete reads.

**Status 2026-07-28 (etape 4):** anbefalingens anden halvdel — *consumerblokering skal følge konkrete reads* —
er gennemført. R3-F04 fjernede den brede issue-capability fra readerens type, og R3-F01/R3-F02 rettede de to
overblokeringer, den havde muliggjort. R3-H01 er samtidig bekræftet og lukket: der fandtes præcis fem brede
filtre, fire af dem blokerende, og alle fire er rettet.

Første halvdel — *én strukturel repræsentation* — er delvist gennemført: EET's kryds-række-fejl er konverteret
(GM-F06), mens EO's satsfejl afventer GM-F01, fordi selve reglen skal ændres i samme greb.

## Efterprøvede, begrundede forskelle

Følgende parallelle former blev undersøgt og vurderet sagligt begrundede:

- **Persisted og transient input:** Transiente dialogsøgninger og hjælpeberegnere skriver ikke sagsdata og
  må derfor have en lille separat inputfamilie.
- **Form og grid:** De har forskellig navigation og rendering, men deler codec, editor, settle/cancel og
  command-runner.
- **Multiline Enter:** Enter er indhold i et textarea; blur er fortsat settle. Afvigelsen er nødvendig.
- **Snapshot-first:** Forsørgertab, EET og EO har reelt uafhængige paneler/grene og må gate pr. dependency
  frem for at tvinges gennem ét globalt resultat.
- **Rækkeprojektioner i Rente:** Rækker isoleres, mens aggregatet blokerer ved en fejlende valgt række.
- **Mineo og standalone MinProcesrente:** Miljøerne er bevidst isolerede, men bruger samme
  dokumentlivscyklus.
- **PDF og Word:** De deler definition, gate og forberedt model; formatet skifter kun renderer.
- **Sektionsreset og hel-sags-clear:** De har forskelligt replacement-/recoveryansvar og bør ikke være samme
  command.
- **Manuel fil og PWA-launch:** Kilderne er forskellige; kun den efterfølgende orkestrering skal samles.
- **Forskelligt antal tomme tabelrækker:** Det synlige minimum er domænespecifikt; placeholdermotoren er
  ikke.

## Efterprøvet uden nyt fund

- Én current-session-envelope og én manifestbeskyttet storage-write-grænse.
- `.eo`-save/load-apply gennem de autoritative caseporte.
- History skrives kun af inputrunneren.
- Fælles form-/grid-semantik for settle, Escape, paste og Delete/Backspace.
- Atomisk promotion af placeholder-rækker.
- Dropdown, toggle og radio bruger immediate commit gennem inputrunneren, bortset fra GM-F03's
  specialtoggles.
- Alle 18 Mineo-dokumentoutputs går gennem definition/lifecycle.
- Generatorerne bruger den fælles kanalneutrale dokumentmodel.
- EET's fire paneldependencies og Forsørgertabs betingede EAL→ASL-fallback stemmer med de undersøgte
  motorreads.
- Ingen anden produktionsbypass til de seks undersøgte autoritative beregningsentries.

## Evidens

Reviewet brugte:

- repo-brede callsite- og importsweeps,
- sammenligning af alle aktive input-/issue-/history-/document-capabilities,
- direkte sammenligning af regelsæt og dependency-reads,
- eksisterende R0–R3-rapporter og deres evidens,
- og målrettede Vitest-kørsler for Årslønprojektion/tabelvalidering, Forsørgertabssnapshot og
  Rente-projektionsmatrix.

De målrettede tests gav **4 filer / 41 tests grønne**. Det grønne resultat afviser ikke fundene:
GM-F04 og GM-F05 er delvist pin'et af tests, som bekræfter den interne model, men ikke den samlede
brugeroplevelse.

Ingen fuld kvalitetsgate er kørt, fordi reviewet kun tilføjer dokumentation og ikke ændrer kode, scripts,
config eller kontrakter.

## Anbefalet behandlingsrækkefølge

1. Saml GM-F01, GM-F02 og GM-F06 som én EO/EET issue- og satsoprydning.
2. Ret de konkrete brugerbrud GM-F03, GM-F04, GM-F05 og GM-F11.
3. Fjern de døde veje GM-F08 og GM-F09.
4. Konsolidér navigation/load/tabel/primitiver i GM-F10 og GM-F13–GM-F15.
5. Kør de relevante statekæder, dokumentmatrix, beregningsfixtures og fuld gate efter implementeringen.
