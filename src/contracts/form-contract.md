# Mineo – Form-kontrakt

**Version:** 1.0
**Status:** Normativ og gældende
**Type:** Tværgående kontrakt
**Senest verificeret mod kode:** 2026-08-19 (§8.2a er implementeret og verificeret: længdepolitikken erklæres
på codecet/`charLengthPolicy.ts` og læses af både formular- og gridfladen; paste afgrænses i `spliceDraftWithPaste`)
**Formål:** At fastlægge én ensartet model for input, redigering, validering og beregningsgrænser i Mineo.

Denne kontrakt beskriver den gældende arkitektur. Der findes ingen parallel inputmodel, ingen
overgangs-API'er og ingen kompatibilitetsflade ved siden af den.

---

## 1. Grundprincipper

1. Applikationen kører 100 % client-side, og brugerdata må ikke forlade browseren.
2. Draft, afsluttet input og beregningsklart input er tre forskellige semantiske niveauer.
3. Alle autoritative inputændringer går gennem én atomisk inputtransaktion.
4. Beregning, save og dokument-output må kun læse gennem den autoritative read-/projektionsgrænse.
5. Samme problem løses med samme feltmotor, codec, feltidentitet og issue-model på formular- og tabeloverflader.
6. Domænegrænser styres af `domain-boundary-contract.md`.

## 2. Tre inputniveauer

### 2.1 Åben draft

En åben draft er den rå tekst, brugeren redigerer, mens editoren er åben.

- Den må være tom, delvis eller ugyldig.
- Den lever kun i den fælles felt-editor.
- Den indgår ikke i undo/redo, `sessionStorage`, `.eo`, validering, beregning eller output.
- `onChange` må kun ændre denne draft.

Mens editoren er åben, bygger visning, beregninger og download-gates fortsat på den senest afsluttede inputtilstand.
At åbne editoren eller skrive må derfor ikke få beregnede sektioner til skiftevis at blive vist og skjult.

### 2.2 Afsluttet input

Afsluttet input er feltets autoritative tilstand efter blur, Enter eller en tilladt immediate-commit-handling. Tilstanden
er enten:

- **gyldig:** en typet canonical værdi, eller
- **ugyldig:** den ikke-tomme rå tekst, som ikke opfylder feltformatet eller ikke kan omsættes til en værdi i det
  persisterede Zod-schema.

Et ugyldigt afsluttet input rydder feltets canonical slot til dets tomværdi og gemmer den rå fejlende tekst atomisk.
Samme aktuelle felt kan aldrig samtidig have en ikke-tom canonical værdi og rejected råtekst (XOR-invarianten). Der
findes ingen maskeret recovery-værdi under det rejected input: en tidligere gyldig canonical værdi findes udelukkende i
undo-historikken og kan derfor aldrig nå en consumer i den aktuelle tilstand.

Tom tekst parser til feltets definerede tomme canonical værdi, normalt `undefined`. Om tomhed er en fejl, afgøres af den
consumer, som kræver feltet.

En korrekt formateret værdi, som kan valideres af det persisterede Zod-schema, committes canonical, selv om den ligger
uden for feltets aktive min/max eller bryder en tværgående domæneregel. Disse grænser afledes som feltissues og må
ikke gøre en ellers repræsenterbar værdi rejected.

### 2.3 Domæneprojektion

En domæneprojektion bygges fra ét `EvaluationSourceToken`-bundet input-/settingssnapshot gennem den fælles
`InputReader`.

- Kun en `ready` projektion må fodre beregningsmotorer og dokumentgeneratorer. Save har sin egen strukturelle projektion,
  som kræver schema-gyldigt canonical input og fravær af rejected input, men ikke fravær af canonical feltissues.
- En `blocked` projektion bærer strukturelle blockers med feltreference og årsag.
- Både `ready` og `blocked` bærer alle relevante issues. Et canonical range-/bounds-issue eller en warning må ikke
  forsvinde, blot fordi det ikke gør den konkrete beregningsprojektion uanvendelig.
- Om et issue blokerer beregning, afgøres af den konkrete consumerprojektion. Det er ikke en global egenskab ved feltet.
- Domænekode må ikke modtage rå canonical sektioner som alternativ adgangsvej.
- Uafhængige projektioner må fortsat være `ready`, selv om en anden consumer er blokeret.

## 3. Autoritativ inputaggregate

Den autoritative runtime-tilstand består konceptuelt af:

```ts
// src/inputCore/settledInput.ts
type SettledInput = Readonly<{
  sections: PersistedInputSections;
  rejectedInputs: Readonly<Record<SerializedFieldAddress, RejectedInput>>;
}>;

// src/inputCore/runtime/slimInputStore.ts – ud over de to felter nedenfor bærer
// storen også history, settingsRevision, replacementGeneration og meta.
type SlimInputStoreState = Readonly<{
  input: SettledInput;
  revision: InputRevision;
}>;
```

Regler:

1. Canonical sektioner er altid valideret af deres Zod-schema.
2. Rejected inputs er dækket af eget Zod-schema og validerede strukturelle feltadresser.
3. Aggregate og revision ændres atomisk; en inputhandling må aldrig efterlade deltilstand.
4. Revisionen stiger præcis én gang ved en reel transaktion og ikke ved en no-op.
5. Revisionen persisteres ikke som brugerdata og gendannes ikke fra history.
6. `invalidDrafts`, separate feltfejl-slices og sektionsvise skrive-API'er findes ikke. Rejected råtekst bor i
   aggregatets ene `rejectedInputs`-map, og der er ingen sektionsvis skrivevej uden om write-grænsen.
7. Evalueringsfriskhed bindes til et `EvaluationSourceToken`, der omfatter **både** inputrevisionen og en monoton
   settingsrevision. Et issue-snapshot, en consumerprojektion eller et forberedt dokument er stale, hvis enten input
   eller de relevante AppSettings har ændret sig siden optagelsen. AppSettings må påvirke validering, beregning og
   visning, men aldrig styre synlighed/relevans for et persisteret inputfelt.

## 4. Feltdescriptor og identitet

Hvert persisteret felt har én typed `FieldRef<T>` = `{ address, descriptor }`, hvor `FieldDescriptor<T>`
(`src/inputCore/fieldDescriptor.ts`) forbinder:

- en strukturel `FieldAddress`,
- feltets codec,
- brugervendt label,
- kontroltype,
- feltets `validators` – kanalen der producerer bounds-/rule-issues (§8, `src/inputCore/catalog/boundsValidators.ts`),
- feltets `relevance` – synligheds- og beregningsrelevans-prædikatet (§7 punkt 3).

Den type-udviskede variant `AnyFieldRef` er den, `FieldIssue.field` bærer.

Samme reference bruges ved render, settle, validering, projektion, history-origin og gate. Fokus-restore kombinerer
datafeltets reference med den konkrete editors eksplicitte fokusmål, fordi samme felt kan redigeres på flere sider.

- Statiske felter defineres én gang.
- Dynamiske række-/entity-felter dannes af typed builders.
- Felt- og collection-bindings samles i ét statisk, valideret og immutable katalog før state-validering og læsning;
  kataloget har ingen runtime-registration eller seal-livscyklus.
- En dynamisk reference er kun gyldig, når alle dens entities findes i det konkrete input-snapshot.
- Adresser beskriver data, ikke DOM eller tabelgeometri.
- Frie strengnøgler og identitet som `rowId:colIndex` er forbudt.
- DOM-attributter må være en projektion af feltreferencen, men må ikke være dens autoritet.
- Fokusmål må ikke ligge som én global standard på feltdefinitionen eller udledes af DOM efter blur.

Det normative komponent- og codec-mønster findes i `mineo-field-pattern.md`.

## 5. Event-semantik

### 5.1 Tastning

`onChange` må kun opdatere den åbne draft. Det må ikke:

- parse eller validere domænedata,
- ændre afsluttet input,
- trigge beregninger eller afledt feedback,
- skrive persistence eller history.

### 5.2 Settle

Blur og Enter bruger samme feltmotor og samme `settleField`-transaktion:

1. codec parser den aktuelle rå tekst,
2. gyldigt resultat skriver canonical værdi og fjerner en eventuel rejection,
3. ugyldigt resultat rydder canonical slot til feltets tomværdi og skriver den rå tekst som rejection – atomisk og
   gensidigt udelukkende (XOR); der bevares ingen maskeret recovery-værdi,
4. storage, aggregate, history og revision ændres som én transaktion.

En global kritisk handling må udløse den samme settle-sti gennem en registreret deltager. Der må ikke findes en separat
parse-, validerings- eller persistencevej til kritiske handlinger.

### 5.3 Escape

Escape annullerer universelt alt siden editoren blev åbnet:

- editoren lukkes, og den uændrede afsluttede starttilstand bliver igen den afledte visning,
- intet committes eller valideres,
- det umiddelbart efterfølgende blur må ikke settle den annullerede tekst.

Hvis feltet var afsluttet ugyldigt før åbning, gendannes den ugyldige tekst. Feltets canonical slot var allerede ryddet
til tomværdien ved det ugyldige settle (XOR), så der findes ingen tidligere canonical værdi at vise i stedet.

### 5.4 Immediate commit

Kun disse handlinger må committe uden en åben draft/blur-grænse:

1. Delete/Backspace på et fokuseret, lukket formularfelt eller en celle rydder feltet.
2. Valg af dropdown-menupunkt committer valget; søge-/filtertekst gør ikke.
3. Toggle- eller radioaktivering committer valget.

De går gennem samme transaktionsrunner og feltreference som øvrige commits.

### 5.5 Forbudte mønstre

- commit eller domænevalidering i `onChange`,
- implicit commit via effect,
- `queueMicrotask`, timeout, Promise-tick eller render-rækkefølge som korrekthedsforudsætning,
- side-effects i state-updaters,
- flere writes, der bagefter forsøges coalescet til én brugerhandling,
- lokale fallback-stores for persisterede felter.

## 6. Fokus- og redigeringsmodel

Mineos tekst-, dato- og talfelter bruger den eksisterende to-trinsmodel:

1. Første fokus giver fokus uden at åbne editoren.
2. Klik på et allerede fokuseret felt eller et plausibelt starttegn åbner editoren.

Felt-editoren holder kun en rå draft, mens editoren er åben. Når editoren er lukket, afledes visningen direkte af det
afsluttede revisionsbundne feltstate. Der findes derfor ingen lukket draftkopi, prop-lag-guard, fingerprint eller
resync-effect. Global undo/redo er et stille no-op, mens editoren er åben. Load, reset og `Slet alt` følger derimod
`critical-action-contract.md`: de settler ikke draften og kasserer den kun efter succesfuld apply.

Når editoren er lukket:

- et printbart tegn åbner editoren og erstatter det viste indhold med tegnet,
- paste åbner ikke editoren og følger feltets codec-regler,
- Delete/Backspace følger immediate-commit-undtagelsen for både formularfelter og tabelceller.

Keyboard-navigation ejes af `keyboard-navigation.md`.

## 7. Initialisering, synlighed og relevans

1. Initial values materialiseres gennem sektionens Zod-schema og bruges kun ved oprettelse eller reelt fravær.
2. En eksisterende afsluttet værdi må aldrig overskrives af initial values ved navigation, rerender eller
   settings-ændring.
3. Synlighed og beregningsrelevans udledes af samme domæneprædikat.
4. Skjult canonical input bevares gennem F5 og `.eo`, medmindre brugeren eksplicit sletter det.
5. **Hovedregel: et brugervalg sletter aldrig brugerens indtastninger.** Kun kontroller, der over for
   brugeren er udtrykkeligt navngivet som slettende – `Slet alt`, `Slet række`, Delete/Backspace på et
   fokuseret felt – fjerner indtastet data. Et valg, der gør et andet felt irrelevant (fx Afgørelsestype
   `Endelig` → `Midlertidig`, `Tillæg angives som` procent → beløb, en skiftet Lønperiode), ændrer derfor
   **kun vurderingen** af det felt: en **gyldig** værdi består uændret, feltets issues genudledes rent fra
   det nye snapshot, og skiftes valget tilbage, kommer værdien uændret til syne igen. Et valg må ikke være
   en skjult sletteknap.

   **Undtagelse – den usynlige røde fejl:** bar feltet en **aktiv rød feltfejl**, og gør valget feltet
   irrelevant (= skjult, punkt 3), ryddes feltet **tavst** i samme transaktion som valget – én typed
   domænecommand, ét history-trin. Undtagelsen gælder begge fejlformer: rejected råtekst (format) såvel som
   en canonical out-of-bounds-/rule-værdi.

   Begrundelsen er ikke, at reglen ophører med at gælde for det skjulte felt; den er, at **en rød fejl,
   brugeren ikke kan se, ikke kan rettes.** Uden rydningen kunne en ugyldig indtastning blokere
   `.eo`-save (§8) eller en afhængig beregning fra et felt, brugeren hverken kan finde eller fikse. Undo
   gendanner både valget og den ryddede værdi som ét trin, så handlingen er fuldt reversibel.

   Afgrænsningen er snæver med vilje. Rydningen rammer netop overgangen **synlig + rød → skjult** – ikke
   gyldige værdier, og ikke skjulte værdier i almindelighed.

6. **Et skjult felt UDEN aktiv rød feltfejl bevares altid** – gennem F5 og `.eo`. Bliver det relevant igen,
   vises den samme værdi. Sammen med punkt 5 giver det én konsistent regel: skjult og gyldigt bevares;
   skjult og rødt ryddes.

   Derfor bærer et irrelevant felt **aldrig** et aktivt issue (§1.9, §10). Det er ikke en undertrykkelse af
   en fejl, der stadig findes: det skjulte felt er tavst, **fordi** det er ryddet. De to halvdele –
   rydningen i punkt 5 og tavsheden her – skal derfor ændres sammen, aldrig hver for sig. Håndhæves af
   relevans-invarianten i `validateSettledInput`, som afviser en færdig tilstand med rejected råtekst i et
   skjult felt.

## 8. Format, bounds og save-gate

- Dato-draft er rå tekst; canonical dato er `ISODateString | undefined`.
- Datoformat parses kun ved settle gennem det kanoniske datocodec.
- Min/max og tværfeltgrænser læser kun senest afsluttet input.
- En parsebar dato uden for interval committes canonical og giver et afledt rødt range-/bounds-issue.
- Ugyldigt format giver rejected input og ingen ny canonical værdi.
- Samme repræsentationsregel gælder tal, år, uger, beløb og procenter: feltets aktive min/max vurderes efter
  canonical commit og er ikke en del af codecets format-/schemaafvisning.

`.eo`-save-gaten styres ikke af en per-issue save-policy. Den udledes strukturelt af den afsluttede inputtilstand:
**ethvert aktivt relevant rejected input blokerer `.eo`-save globalt**, mens schema-gyldigt canonical input kan gemmes,
selv om det har et rødt range-/bounds-/rule-issue.

- Rejected råtekst blokerer save og skrives aldrig til `.eo`.
- Canonical range-/bounds-/rule-issues blokerer ikke save.
- Tomhed/`missing` og warnings blokerer aldrig save.
- Feltadvarsler bæres som `FieldWarning` med en ikke-tom besked. Formular- og tabelskaller viser dem ens som gul
  ring + tooltip; en samtidig rød fejl har forrang. Advarslen er ikke engine-, dokument- eller save-input.

Dokument-output følger samme uniforme regel for egne dependencies: ethvert dokumentrelevant issue med fejlseverity
blokerer dokumentet, herunder range/bounds. Se `document-output-contract.md`.

### 8.1 Placeholderen beskriver kun værdiens form

En placeholder er **formvejledning og intet andet**. Den viser den forventede værdis FORM – `mm`, `åååå`,
`uu/åååå`, `dd-mm-åååå`, `0,00` – og må ALDRIG bære

- en min-/maxgrænse eller anden valideringsbegrænsning,
- en manglende-værdi- eller statusbesked, eller
- noget, der ændrer sig med tilstand eller kalender.

Grænser hører i feltets issue og tooltip (§8 ovenfor), manglende værdi i issue-/feedbackmekanikken. To
konkurrerende beskrivelser af samme felt er netop det, der lod en årstalsafhængig tekst (`åååå (≤2026)`) leve i
visningslaget uden at nogen kontrakt fejlede, og lod en `Indtastning mangler`-besked overtage formvejledningens
kanal.

Den rene form ejes af den semantiske **feltfamilie**, ikke af den tabel eller side, feltet står på:
`src/utils/fieldFormatPlaceholders.ts` (år, uge, dato, måned, dag), `src/utils/amountInputUtils.ts`
(`DEFAULT_AMOUNT_PLACEHOLDER`, `INTEGER_AMOUNT_PLACEHOLDER`) og `src/utils/percentInputUtils.ts`
(`DEFAULT_PERCENT_PLACEHOLDER` og `TWO_DECIMAL_PERCENT_PLACEHOLDER` – begge, da procentfamilien har to
formrepræsentationer efter feltets decimalpolitik, jf. §8.3). En
callsite må kun override en placeholder, når feltets domæne har en reelt anden FORMATREPRÆSENTATION – fx
månedens `mm` i en periodekolonne – aldrig for at vise bounds, validering eller status.

### 8.2 Fortegns-politikken ejes af feltets codec

Om et numerisk felt må være **negativt** er en egenskab ved feltet, ikke ved den komponent der tegner det.
Politikken erklæres på codecet som `FieldCodec.signPolicy`, som codec-factory'erne udleder af deres
`allowNegative`-konfiguration, og læses af begge flader
gennem `fieldAllowsNegative(field)` / `codecAllowsNegative(codec)`.

En feltkomponent, en tabelcelle eller en side må **ikke** sende en hardkodet `allowNegative`-literal til et
tegnfilter – heller ikke en korrekt en. En literal er en anden samtidig sandhed om feltet, og præcis den lod
`PercentField` svare `true`, mens `GridPercentCell` svarede `false` for de SAMME descriptorer, så et minustegn
kunne tastes i et felt, der ikke må være negativt. Håndhævet af
`input/sign-policy-from-descriptor`.

Politikken gælder almindelig tastning og paste. Paste skal først følge codecets almindelige tegnfilter: et minus,
som feltet ville afvise ved tastning, springes over, mens paste fortsætter. En negativ værdi, der allerede kommer
fra en tolerant `.eo`-load, er en anden vej end brugerens tastning og committes canonical med sit røde bounds-issue
frem for at få fortegnet stille fjernet.

Beløbsfelter er den ene bevidste nuance: `-` er også subtraktion i et udtryk (`5000-200`), så et ikke-negativt
beløbsfelt tillader tegnet og blokerer kun det **unære** minus.

### 8.2a Længdepolitikken ejes af feltets codec

Fortegnet er ét tilfælde af den generelle regel: **et tegn, feltet ikke kan rumme, kommer ikke ind i feltet.**
Det gælder både tegnsæt og længde – maksimalt antal tegn, heltalscifre og decimaler – og det gælder tastning og
paste ens, jf. `input-field-behavior-contract.md` §1.2. Grænserne erklæres på codecet og læses af begge flader;
en feltkomponent eller tabelcelle må ikke bære sin egen længdeliteral, af samme grund som den ikke må bære sin
egen `allowNegative`-literal.

Blokeringen omfatter ikke **talværdi**. Et felts min/max, kronologi og øvrige domænegrænser er rene
validatorer/projektioner efter §7 i `mineo-field-pattern.md`: en korrekt formateret værdi inden for
længdegrænsen bliver canonical og får sit røde bounds-issue. Beløbsudtryk er nuancen – udtrykkets enkelte
talled længdebegrænses tegn for tegn, mens et beregnet resultat uden for feltets beløbsgrænse først kan fanges
ved settle og derfor bliver et canonical issue.

Blokeringen gælder desuden kun **den skrivende overflade**: et felt, brugeren taster eller indsætter i. Den er
ikke en grænse for programmets beregninger. Afledte og sammentalte værdier – rækkesummer, totaler, projektioner
og motoroutput – må frit have flere cifre end det inputfelt, de stammer fra, og en read-only celle eller
resultatvisning skal vise det fulde beregnede tal uden afkortning eller rød markering. Længdepolitikken
erklæres derfor på inputfeltets codec og læses af de skrivende flader; den følger ikke med en afledt værdi ud i
visningen.

### 8.3 Decimalpolitikken ejes af feltets codec

Om et beløbs- eller procentfelt accepterer dansk decimalkomma, erklæres på codecet som
`FieldCodec.decimalPolicy`, afledt af `allowDecimals`. Formularfelt og grid-celle læser begge politikken gennem `fieldAllowsDecimals(field)`; de må
ikke have egne defaults eller callsite-flags. Et decimalfelt skal tillade en åben draft som `12,` og først
afgøre den afsluttede værdi ved blur/Enter gennem det fælles feltcodec.

Grid-procentfelternes universelle hovedregel er to decimaler: placeholderen er `0,00`, højst to decimaler kan
tastes, og afsluttede værdier vises med to decimaler. EET-sidens procentfelter er den eneste aktuelle undtagelse:
de erklærer `integerOnly` i deres codecs, viser placeholderen `0` og blokerer decimalkomma. Undtagelsen skyldes
EET-felternes særskilte heltals-/5 %-regel og må ikke implementeres som et lokalt komponentflag.

Grid-beløbsfelternes universelle hovedregel er ligeledes to decimaler: placeholderen er `0,00`, højst to
decimaler kan tastes i hvert talled i et beløbsudtryk, og afsluttede værdier vises med to decimaler. Der er ingen
aktuelle heltalsundtagelser blandt grid-beløbsfelterne. En eventuel undtagelse skal erklære `integerOnly` i sit
beløbscodec; grid-cellen må ikke have et lokalt precision-flag.

## 9. Dynamiske tabeller

Rækkeinfrastrukturen ejer kun stabil rækkeidentitet, rækkefølge, add/delete/reorder og eventuelle tomme UI-rækkers
livscyklus. Den ejer ikke en parallel `draftRows`-kopi af celleværdier.

- Hver celle bruger samme feltmotor og codec som formularfelter.
- Første settle i en tom UI-række promoverer rækken atomisk, også hvis inputtet er ugyldigt.
- Når et settle eller en field-clear gør en allerede oprettet brugerrække semantisk tom, fjernes rækken
  atomisk i samme brugerhandling. Tabellen viser derefter kun sine transiente trailing-rækker. En rejected
  råtekst er indhold og bevarer derfor rækken, indtil brugeren retter eller rydder feltet. Programstyrede
  basisrækker og required default-valg beskyttes af collectionens eksplicitte tomhedsregel.
- Sletning af en række fjerner række og alle descendant-rejections i samme transaktion.
- Orphan-state skal være urepræsenterbar; reconcile-effects er forbudt som slutarkitektur.
- Add, delete og reorder bruger samme command-runner som feltændringer.

De to lønfelter `Løn`/`Løn (2)` og ydelsesfelterne `Ydelse`/`Ydelse (2)` har fortsat identisk domænebetydning inden
for hvert par og summeres uden særbehandling.

## 10. Validering og issues

Issues afledes rent fra `InputReader`, feltmetadata, domænevalidatorer og relevante AppSettings:

- `invalid` fra rejected input,
- `missing` fra consumerens requirement,
- `range`/`bounds` fra canonical værdi og konkrete grænser,
- `schema`/`rule` fra domænevalidatoren.

Mounted komponenter rapporterer ikke afledelige fejl til en central store. Samme issue-model driver feltmarkering,
tooltip, kontrolvisning, save-gate og dokument-gate med deres respektive policy.

Ved blokeret `.eo`-save findes route og eventuel fane i det statiske, descriptor-keyede feltlokationskatalog
(`src/inputCore/catalog/fieldLocationCatalog.ts`), før en editor behøver at være mounted. Kataloget skal dække
hvert produktionsdescriptor præcis én gang. DOM-registret vælger derefter en allerede synlig spejling eller
fokuserer den konkrete editor efter mount; det må ikke være eneste kilde til den destination, som netop er
nødvendig for at mounte en aldrig besøgt fane. Håndhævet af `input/focus-destination-owned-by-location` og
`input/restore-attributes-carry-destination`. Fordi fokusforløbet er asynkront, sammenlignes destinationen med
browserens aktuelle route på udførelsestidspunktet; et route-snapshot fra handlingens start må ikke udløse en
stale navigation efter mount-ventet.

Fejl- og beskedregler ejes af `error-contract.md`.

## 11. Kritiske handlinger

Kritiske handlinger følger `critical-action-contract.md`.

Særligt for dokument-download:

1. Den reaktive gate bygger på senest afsluttede input, også mens en editor er åben.
2. Klik/aktivering finaliserer editoren før dokumentpreflight.
3. Preflight læser et frisk `EvaluationSourceToken` og bruger samme dokumentdefinition som den reaktive gate.
4. Ved et nyt relevant fejl-issue bliver knappen visuelt og funktionelt disabled.
5. Generator, lazy-load og fil-I/O må aldrig starte ved blokering.

## 12. Der findes kun én inputmodel

Der findes ingen parallel inputklynge ved siden af den model, denne kontrakt beskriver – hverken som kopi, som
"midlertidig" undtagelse eller under et nyt navn. To AST-regler håndhæver det, og de rammer hver sin flade:

- **`input/deleted-legacy-architecture-import`** forbyder *importstier* til den fjernede klynge, uden allowlist.
  Blandt dem: `FormPersistenceContext`, `usePersistedForm`, `useDraftField`, `useStyledFieldAdapter`,
  `inputRuntimeStore`, `formPersistenceStore`, mappestierne `src/hooks/tableInput` og `src/rowDrafts/`
  (som dækker `useTableInputCore` og `useRowDrafts`) og de otte
  `Styled<type>Field`-komponenter (`StyledTextField`, `StyledDateField`, `StyledAmountField`,
  `StyledIntegerField`, `StyledPercentField`, `StyledFractionField`, `StyledWeekField`, `StyledYearField`).
- **`legacy/forbidden-identifier`** forbyder *navne*, uanset hvor de importeres fra – herunder
  `executeLegacyInputTransaction`, `useDraftLifecycle`, `legacyGridTransactionBridge`, `useSliceRowDrafts`,
  `useFormFieldErrorReporter`, `onFieldError`, `InputWriteAuthority` og `claimInputWriteAuthority`.

De persisterede felter tegnes i dag af felt-familien i `src/inputCore/react/fields/` (`TextField`, `DateField`,
`AmountField`, `IntegerField`, `PercentField`, `ChoiceField` m.fl. samt grid-varianterne). De deler de bevarede
præsentationsskaller `StyledTextFieldBase` og `StyledTextAreaBase`, og kontrollerne `StyledDropdown`,
`StyledCheckbox`, `StyledRadioButton` og `StyledToggleSwitch` er fortsat i brug – `Styled*`-præfikset i sig selv
er altså ikke forbudt, kun de otte felt-komponenter ovenfor.

**`fieldErrors` er ikke et forbudt navn.** Den centrale skrivbare feltfejl-bus er væk (`src/types/fieldErrors`,
`useFormFieldErrorReporter`, `onFieldError`, tabeltrackerne), men `fieldErrors` lever videre som et helt
almindeligt feltnavn i domænesnapshots – fx `EetSnapshot.fieldErrors` og `EOInspektionSnapshot.fieldErrors`.
AST-værnet undtager derfor navnet bevidst.

Den ENE dokumenterede undtagelse fra den autoritative inputtilstand er `components/inputs/transient/`: tre flader
(løntrin-finder-overlay, sygedagpenge-hjælperrække, rapport-dialog) bygget på `TransientTextInput`,
`TransientAmountInput`, `TransientDateInput` og den delte `useTransientDraft`. De redigerer ikke sagsdata og har
hverken feltadresse, issue-snapshot, history eller persistens, men genbruger de samme parse-kerner, tegnfiltre og
bounds-beskeder som de persisterede felter. `input/transient-cannot-write-case-data` håndhæver, at de ikke kan
skrive sagsdata.

## 13. Runtime-verifikation af mount og settle

Den automatiske testflade skal bevise mount-uafhængighed deterministisk: mount, unmount og remount må hverken
ændre afsluttet input, revisioner, issues, beregninger, save-gate eller dokumentgate. Fane-/sidenavigation skal
desuden have integrationstests, som beviser, at en åben editor afsluttes gennem den samme blur-/settle-sti før
unmount, både ved gyldigt og fejlende input.

Browserens konkrete eventrækkefølge kan ikke fuldt simuleres i JSDOM. Ved ændringer i faneimplementering,
editorregistrering, blur-håndtering eller `CriticalActionCoordinator` skal den automatiske suite derfor suppleres
med en runtime-stresstest i en styrbar browser: gentagne skift mellem faner mens gyldige og ugyldige drafts
åbnes, settler og remountes. Efter hver sekvens kontrolleres, at senest afsluttede canonical/rejected input er
bevaret, og at ingen åben draft har påvirket beregning eller gates før settle. Dette er et residualt
release-verifikationskrav, ikke en tilladelse til browserafhængig produktionslogik.
