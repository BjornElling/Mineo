# Mineo – EET snapshot-kontrakt

**Status:** Normativ og gældende
**Type:** Domænekontrakt
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md` og `snapshot-contract.md`.
**Senest verificeret mod kode:** 2026-11-27

De fælles snapshotregler (inputgrænse, afhængighedsspecifik blokering, runtimefejl, issues og dokumentgate,
friskhed) står i `snapshot-contract.md` og gentages ikke her.

---

## 1. Autoritativ entry og canonical output

`computeEetSnapshot(...)` er den autoritative beregningsentry for Erhvervsevnetab-sidevisning, faneprojektioner og
EET-dokumentflow. Den kaldes kun inde fra `buildErhvervsevnetabReaderProjection(...)`, som læser de nødvendige værdier
gennem `InputReader` og binder resultatet til den aktuelle `EvaluationSourceToken`. UI og dokumentflow aftager kun
denne reader-projektion; EO-importen aftager importporten (§5).

`EetSnapshot` er samtidig EET-domænets canonical output. Formen valideres af `eetCanonicalOutputSchema`, og
TypeScript-typen afledes af schemaet. Et snapshot udleveres først til UI, dokument eller EO-import, når hele outputtet
er schema-valideret; fejler valideringen, fail-closer alle fire projektioner med et blokerende issue.

Alle offentlige pengefelter i snapshottet er `MoneyOre`. Konverteringen sker efter den afrunding, som domænereglen
foreskriver; canonicaliseringen må ikke flytte eller ændre afrundingstidspunktet. Interne højpræcisionsmellemregninger
kan være rå tal, når domænet kræver det, men de må ikke lække som offentlige pengebeløb.

---

## 2. Projektioner

Snapshottet har én projektion pr. resultatfane (projektionsformen i `snapshot-contract.md` §5):

1. `loebendeYdelser`
2. `kapitalisering`
3. `efterEal`
4. `differencekrav`

Hver projektion har formen `issues`, `hasBlockingErrors` og `computation`, hvor `computation` er `null`, når
projektionen ikke kan beregnes. Delresultater pakkes ikke i `Calculable<T>`, når formen allerede udtrykker fraværet
entydigt. En projektion med mindst ét `error`-issue har altid `computation: null`, og `hasBlockingErrors` er sand,
netop når der findes et `error`-issue. Begge invarianter håndhæves af output-schemaet, så en consumer ikke kan vise
eller gemme et resultat fra en blokeret projektion. View- og dokumentprojektioner må kun formatere eller udvælge
disse data.

`differencekrav` orkestrerer ikke selv søsterberegninger og har ingen skjult blocking-semantik. Projektionen modtager
de nødvendige, eksplicit komponerede underberegninger fra snapshot-orkestreringen (`eetCalculationGraph.ts`) og
rapporterer enhver blokering som issue.

### Hver fanes afhængigheder

En rød feltfejl blokerer kun de faner, der læser feltet:

- **Løbende ydelser:** beregningsdato, ASL-årsløn, Stamdatas datoer og ASL-afgørelsestabellen.
- **Kapitalisering:** som løbende ydelser, men uden beregningsdatoen. Fanen er bevidst uafhængig af beregningsdatoen
  (§4.3) og bevares, når datoen er rød eller tom.
- **EET efter EAL:** beregningsdato, EAL-årsløn, EAL-procent, Stamdatas datoer og forliget (§4.1). ASL-årslønnen er
  kun en afhængighed, når EAL-årslønnen er tom, og ASL-afgørelsestabellen kun, når EAL-procenten er tom. Også da
  blokerer kun kolonner, der kan ændre, hvilken afgørelse og procent der vælges (afgørelsesdato, virkningsdato,
  EET % og afgørelsestype). Røde værdier i «Kap.dato», «Kap. %» og «Hvis genopt. - tidl. kap.dato» stopper ikke
  EAL-kravet, fordi EAL-motoren ikke læser dem.
- **Differencekrav:** foreningen af de øvrige fanes afhængigheder samt forliget.

### 2.1 ASL-afgørelsens virkningsdato

Virkningsdatoen er frivillig. Uden særskilt virkningsdato bruges afgørelsesdatoen i alle beregninger,
valideringsregler, afgørelsessorteringer og EO-importen gennem `resolveAslVirkningsdato` i `eetAslAfgoerelser.ts`.
En tom virkningsdato og en virkningsdato lig afgørelsesdatoen giver samme beregning og samme issues; en virkningsdato
lig afgørelsesdatoen giver aldrig en fejl eller advarsel. Kun advarsler om den udtrykkeligt indtastede dato læser den
rå feltværdi. Den udledte dato skrives aldrig tilbage til sagsdata. Kolonnens info-ikon siger
«Udfyldes kun, hvis den er forskellig fra afgørelsesdatoen.» (`ASL_VIRKNINGSDATO_INFO`).

Reglen gælder ASL-afgørelsestabellen. Forsørgertabs «Virkningsdato» er et selvstændigt felt, som er påkrævet, når
ASL-ydelsen er påbegyndt.

Reglen dækkes af `src/__tests__/domain/erhvervsevnetab/eetVirkningsdatoFallback.test.ts`.

### 2.2 Løbende ydelsers perioder

`eetLoebendePerioder.ts` ejer den samlede periodeplan: afløsningsgrænser, kapitaliseringshændelser,
satsår og faktisk tidligere opgjorte bidrag. `eetLoebendeYdelserCalculation.ts` omsætter planen til penge.

- `beregningsperioder` bevarer alle tekniske delperioder, også nulkrav, med løbende restprocent,
  allerede dækket procent, kapitaliseret procent og afgørelsens yderligere bidrag.
- En senere afgørelse fratrækker summen af de faktisk tidligere opgjorte, ikke-tilbageholdte bidrag
  i hvert overlapinterval. En mellemliggende afgørelse med nulbidrag må ikke erstatte den ældre
  fortsatte ydelse som fradragsgrundlag.
- Kapitalisering virker globalt fra den eksakte kapitaliseringsdato. Ophørsdatoen for en ydelse,
  der derved bliver nul, er dagen før denne dato, også når kapitaliseringen tilhører en senere afgørelse.
- Den almindelige overlap-skæringsdato er første dag i måneden efter afgørelsesdatoen, også for
  afgørelser truffet den første i måneden. Samtidige afgørelser og tilbageholdelse følger §6.1
  i `domain-boundary-contract.md`.
- `perioder` er pengetabellen: direkte tilstødende intervaller med identisk satsår, grundydelse,
  regulering og månedsydelse samles før beløbsafrunding. Hver vist række er
  `round0(sumMaanedsbroekForInterval(fra, til) × månedsydelse)`. Først herefter udelades nulbeløb.
- Overlapforklaringer skal afledes af de tekniske delperioder, aldrig af første overlaprækkes
  procent eller af den filtrerede pengetabel. Forklaringernes datoer skal svare til de intervaller,
  deres tal gælder for.

UI, dokumenter, differencekrav og EO-import aftager samme periodeplan gennem de eksisterende
projektioner. Deres forskellige opgørelsesdatoer ændrer ikke periodereglerne. Planen er afledt
runtime-output og persisteres ikke i `.eo` eller browserlagrede sagsdata.

---

## 3. Blokering og runtimefejl

Snapshottet følger `snapshot-contract.md` §7–§8. Schemafejl, manglende påkrævet source og runtimefejl
materialiseres altid som et eksplicit blokerende issue med `computation: null`.

---

## 4. ASL-afgørelsestabellen og fanernes issues

### Rækkeissues

ASL-/EAL-rækkeissues afledes fra samme `InputReader` og rækkevalidatorer som snapshotinputtet. Hver rød celle i
ASL-afgørelsestabellen – readerens feltfejl og tabellens kryds-række-regler – går ind i snapshottet som sit eget
`field-asl-afgoerelser`-issue med række, kolonne, feltets besked og cellen som `focusTarget`
(`buildAslAfgoerelserSummaryIssues`). Fanerne viser dem alle samtidig og fører til cellen; højst én linje pr. celle,
feltfejlen før reglen.

**Dubletter.** To afgørelser med samme afgørelsesdato og samme (udledte) virkningsdato er en rød fejl på BEGGE rækker
– i afgørelsesdato- og virkningsdatocellen – med «Der er angivet to identiske afgørelser med samme afgørelsesdato og
virkningsdato» (`validateDuplicateAfgoerelse`). Markeringen afhænger aldrig af rækkernes sortering: rækkefølgen er
visning, ikke en stabil identitet, så «den seneste» række kan ikke udpeges pålideligt.

### EET-procenter

Kun procentens form er en rød fejl: den skal være et heltal, delelig med 5, større end 0 og højst 100. Lovens øvrige
grænser er gule, ikke-blokerende feltadvarsler, fordi en teoretisk beregning af en sådan værdi skal være mulig:

- Under 15 % giver `Der kan ikke tilkendes erhvervsevnetab under 15 %` (`EET_UNDER_15_WARNING`) – både på ASL-rækkerne
  og på EAL-feltet. Den ændrer ikke blocking-status eller beregning.
- For ASL-skader med skadedato fra 1. juli 2024 giver en procent over 15, der ikke er et 10 %-trin,
  `Erhvervsevnetab fastsættes i trin af 10 % for skader fra 1. juli 2024`. Trinreglen gælder ikke EAL, hvor
  alle 5 %-trin fra 15 % er lovlige.
- En kapitalisering under 15 % giver `Der er angivet kapitalisering med mindre end 15 %`, men kun når den første
  kapitalisering eller den samlede kapitalisering er under 15 %. En senere delkapitalisering (fx forhøjelsen fra 20 %
  til 30 %) vurderes aldrig isoleret. Ringen og fanelinjen følger samme regel (`kapitaliseringUnder15WarningRowIds`).

Advarslerne bærer ingen hale om, at beregningen «ikke er lovmæssig»: hvad der kan bruges juridisk, er brugerens
vurdering. Tilføj den ikke igen.

De to «EET %»-felter behandler 0 forskelligt. I ASL-tabellen er 0 en rød fejl («Erhvervsevnetabet skal være mellem 5 og 100»). I
«EET % (hvis afviger fra ASL)» betyder 0 «ingen afvigelse» og canonicaliseres til tomt uden besked
(`input-field-behavior-contract.md` §2.3).

### Kapitalisering tæt på folkepension

Ved en endelig afgørelse omfattet af den tvungne kapitalisering ved højst to år til folkepension skal brugeren
selv angive kapitaliseringsdato og hele den resterende kapitaliseringsprocent. Mangler en værdi, rapporterer
den fælles rækkevalidering en consumerfejl med link til det konkrete felt; beskederne navngiver den værdi, der skal
stå («Angiv afgørelsesdatoen eller en senere dato …», «Angiv hele det resterende EET % …»). Tomme felter får ingen
rød ring, og manglen blokerer ikke `.eo`-save. Udfyldte værdier følger de samme feltregler i tabellen,
beregningsmotorerne og EO-importen. Importen må aldrig udlede en skjult kapitalisering bag tomme eller ugyldige felter.

En senere kapitaliseringsdato accepteres med gul feltadvarsel. Datoen bruges til kapitalbeløbet, reguleringsåret
og fradragets tidsafgrænsning. Løbende ydelser fra en endelig afgørelse omfattet af toårsreglen stopper senest
dagen før toårsgrænsen, uanset den indtastede kapitaliseringsdato. Ophørsårsagen `to-aarsgraense` er afledt
runtime-output og persisteres aldrig som brugerinput. Den fælles periodeplan ejer også denne afgrænsning,
så skærm, dokumenter, differencekrav og EO-import ikke får hver sin regel.

Kontroltidspunktet for toårsreglen og kapitaliseringens regelvalg ejes alene af
`resolveKapitaliseringKontroldato`: afgørelsesdatoen, ved genoptagelse med afgørelsesdato før 1. juli 2024
den tidligere kapitaliseringsdato. Dagen før toårsgrænsen ejes af `resolveToAarsreglensSidsteYdelsesdag`, som
både periodeplanen og differencekravets fradrag for overtagne midlertidige ydelser bruger.

Gemte filer med tomme kapitaliseringsfelter indlæses uændret uden load-advarsel; de afhængige beregninger blokeres,
indtil felterne udfyldes.

## 4.1 Forlig om ansvarsgrad: to faner, to grundlag

De tre forligsfelter (`procent`, `broek`, `dato`) bor på **EET oplysninger** under
«Erstatningsansvarsloven» og deles med Erstatningsopgørelsen gennem `forligInputPort`. To EET-faner
reducerer med forligsgraden, og de gør det af **forskellige grundlag**:

| Fane | Grundlag for forligsgraden |
|---|---|
| `efterEal` (fane 4) | EAL-kravet |
| `differencekrav` (fane 5) | EAL-kravet **minus alle fire ASL-fradrag** (løbende ydelser, kapitalbeløb, rest-EET, mer-erstatning) |

Forskellen er reglen, ikke en unøjagtighed. **Et differencekrav, der reducerede det rene EAL-krav, er
en alvorlig beregningsfejl** – kravet ville blive markant for lavt. Mønsteret fra fane 4 må derfor
aldrig brede sig til fane 5.

Kontraktkravene, der håndhæver det:

1. `computeEetEalCalculation` tager `forlig` som et **påkrævet** argument uden default. Hvert kaldested
   skal tage stilling. Kun `buildEfterEalProjection` sender et forlig; `eetCalculationGraph`
   (differencekravets graf) og Forsørgertab sender `null`.
2. `EetEalComputation.ealKravOre` er og bliver det **ureducerede** krav. Reduktionen ligger i den
   selvstændige, nullable `forlig`-blok ved siden af (`forlig.ealKravEfterForligOre`). Ingen kalder må
   erstatte `ealKravOre` med den reducerede værdi.
3. Differencekravets egen `ealComputation` bærer derfor **altid** `forlig: null`. Bærer den en
   forligsblok, er forliget sivet ind i differencekravets grundlag.
4. Kun et gyldigt forlig **under** 100 % giver en reduktion (`factor < 1`) – på begge faner. Et forlig
   på 100 % skriver ingen forligsblok, fordi der ikke er nogen reduktion at oplyse.
5. Afrundingen er hele kroner (`round0`) på begge faner – samme regel på samme slags størrelse.
6. Et ugyldigt forlig (eller en ugyldig forligsdato) blokerer **begge** forligs-consumere, aldrig kun
   den ene: ellers ville den ene fane vise et tal, der hvilede på et forlig, den anden samtidig
   afviste. `loebendeYdelser` og `kapitalisering` læser intet forlig og må ikke blokeres af det.
7. Boksens linje i «Fejl og advarsler» bærer feltets EGEN besked, når readeren har afvist
   indtastningen. Den generiske «Forlig om ansvarsgrad indeholder en ugyldig værdi» er sidste udvej.

Differencekravdokumentets bilag «EET efter EAL» viser det **ureducerede** EAL-krav, fordi bilaget er
differencekravets grundlag, og bærer i stedet én linje om, at forliget anvendes på forsiden. Et
reduceret bilag ved siden af en reduceret bundlinje ville læses som en dobbelt reduktion.

Grænsen er testdækket i `src/__tests__/domain/erhvervsevnetab/eetForligGrundlag.test.ts`.

---

## 4.2 Differencekravets bilagsvalg

Et afkrydset bilagsvalg er et løfte om en side i papiret. `getEetDifferencekravBilagAvailability`
(`eetDifferencekravBilag.ts`) er det ene opslag over, om et bilag kan vælges – og hvis ikke, hvorfor.
Samme opslag bruges af BÅDE fladen og dokumentkilden:

- Fladen skjuler aldrig et utilgængeligt valg; det vises inaktivt og umarkeret med årsagen i
  tooltippet (ÉN kort sætning uden punktum, jf. `page-component-contract.md` §10.5).
- Dokumentkilden (`resolveDifferencekravBilagSelection`) slår et utilgængeligt bilag fra, så et valg
  gemt i en anden sagstilstand ikke kan love en side, dokumentet ikke har.
- Tilstanden «inaktiv uden årsag» er umulig at konstruere: tilgængeligheden er en discriminated union.
- Togglen «Medtag udvidet specifikation på løbende ydelser» følger løbende-ydelsesbilaget: den kan kun
  betjenes, når det bilag både findes og er valgt. Den er bevidst uafhængig af fanen Løbende ydelsers egen
  «Medtag udvidet specifikation»; de to dokumenter har hver sin toggle.
- «Opgørelse» er ikke et valg, men forsiden. Fladen viser feltet låst til (`lockedOn`), kilden tvinger
  det sandt, og generatoren kaster, hvis det mangler – samme model som EO's «Opgørelse».

---

## 4.3 Beregningsdatoen

Beregningsdatoen er opgørelsesdato for løbende ydelser, EET efter EAL og differencekravet. Hver fane besvarer sit eget
spørgsmål, og fanerne kan derfor bevidst vise forskellige tal under samme titel:

- **Kapitalisering** gengiver myndighedernes kapitaliseringer og er uafhængig af beregningsdatoen: den viser også
  kapitaliseringer efter datoen, har ingen beregningsdato-række på skærm eller i dokument og ingen samlet sum af
  kapitalbeløbene. Folkepensionsalderen slås op på kapitaliseringstidspunktet, så to bokse kan vise forskellig alder.
- **Differencekravet** lægger sagens forhold på beregningsdatoen til grund. Det medregner kun afgørelser med virkning
  og kapitaliseringer på eller før beregningsdatoen, og dets bilag viser kun dem (uden kapitaliseringer:
  «Ingen kapitalisering på eller før beregningsdatoen»). Løbende ydelser regnes til og med dagen før beregningsdatoen,
  hvor resten proformakapitaliseres.

Bilagene i differencekravdokumentet kan derfor vise andre tal end nabofanernes egne dokumenter. Forskellen er
tilsigtet og forklares ikke for brugeren. Mekanikken står i `docs/domain/eet/differencekrav.md`.

---

## 4.4 Tekster på fladen og i dokumenterne

- Rækken hedder «Køn» på Erhvervsevnetab. Kun Forsørgertab skriver «Skadelidtes køn», fordi kun den flade blander
  skadelidtes og efterladtes forhold.
- «Bemærk»-boksen på EET oplysninger (fleksjob, tidligere tjenestemænd, den grønlandske arbejdsskadesikringslov) er en
  juridisk påmindelse til brugeren. Den bliver på fladen og trykkes ikke i dokumenterne.
- En afgørelses overskrift bærer altid EET-procenten, fx «Afgørelse 1. juni 2023 (40 %)». Kun hvor to overskrifter
  ellers ville være ens, tilføjes « – virkning fra dd-mm-åååå» (`formatAfgoerelseVirkningsTillaeg`).
- «Mdr.» vises med fem decimaler på skærm og i dokument (`formatDocumentMaanederFixed`).
- En løbende ydelse, der afgrænses af beregningsdatoen, er «opgjort til og med»; ved en ægte ophørsårsag «ophører».
- Kolonnen hedder «Grundydelse pr. år», fordi beløbet er et årsbeløb.
- Toårsreglen skrives «≤ 2 år» overalt, fx «Særfaktor pga. ≤ 2 år til folkepension?». PDF'en normaliserer tegnet
  til «<=».

---

## 5. EO-import

EO's midlertidigt-EET-import bruger kun EET-domænets typed, Zod-validerede importport (`eetImportPort.ts`) gennem den
snævre undtagelse i `domain-boundary-contract.md`. Hvordan EO aftager importen – togglen, den transiente injection,
importens afgrænsning af TAF-slutdatoen og de EET-issues, EO viser – står i `eo-snapshot-contract.md` §13.

For porten gælder:

- Importrelevante grupper må kun være `Midlertidig` eller `Delvist endelig`. Ukendte eller kontraktstridige
  afgørelsestyper i importrelevant output fail-closer; de må ikke tavst droppes som irrelevante.
- Porten bruger samme canonical løbende-ydelser-kerne som `EetSnapshot`, men en særskilt, eksplicit
  `eo_import`-context med TAF-slutdatoen som opgørelsesdato. EET-sidens beregningsdato læses ikke af importen og
  forbliver påkrævet for sidens egne beregninger.
- Contexten indeholder de canonical grupper og issues, EO behøver, samt tilstrækkelig identitet/revision til
  deterministisk cache-invalidering. Pengefelter forbliver `MoneyOre` gennem porten; kun EO-adapteren, der bygger
  `AmountValue`, konverterer til kroner.
- Manglende eller schema-ugyldig import-context er en anden tilstand end et gyldigt snapshot uden relevante
  afgørelser og giver et blokerende issue.

EO viser EET-issues ukritisk, når importen er aktiv; en ændring i EET-issue-typerne skal derfor revurderes mod
`eo-snapshot-contract.md` §13.

---

## 6. Minimumstestflade

Tests skal dække:

1. snapshot bygges fra en ready, `EvaluationSourceToken`-bundet inputprojektion uden raw-section-bypass,
2. runtime exception giver blokerende tom projektion,
3. schemafejl og manglende source giver et eksplicit blokerende issue,
4. de fire projektioners blocking-status og sammenhængen mellem blocking-flag og issues,
5. `differencekrav` bruger eksplicit komponerede underberegninger,
6. alle offentlige pengebeløb er `MoneyOre` efter uændret domæneafrunding,
7. row-level issues er mount-uafhængige og indgår i relevante dokumentdefinitioner,
8. importportens schema, revision og øre→krone-grænse,
9. løbende-ydelses-kernens afløsningsregler: samme afgørelsesdato med forskellige virkningsdatoer, senere
   tilbagevirkende afgørelser med hver FS-variant, kapitalisering efter en sådan afløsningsgruppe samt den
   ikke-blokerende typeadvarsel,
10. forligsgradens to grundlag (§4.1): at fane 4 reducerer EAL-kravet, at differencekravet reducerer beløbet efter
    alle fire fradrag, at differencekravets egen `ealComputation` aldrig bærer en forligsblok, og at et ugyldigt
    forlig blokerer præcis de to forligs-consumere,
11. bilagsvalgenes tilgængelighed (§4.2): at et bilag uden indhold er inaktivt MED en årsag, at dokumentkilden slår
    det fra, og at opgørelsen er låst til i både visning og kilde.

EO-import-konsekvensen (`Midlertidig`/`Delvist endelig` importeres, `Endelig` ignoreres, schema-/kontraktstridigt
output fail-closer) testdækkes på EO-importens test-flade, ikke EET-snapshottets: se
`src/__tests__/domain/erstatningsopgoerelse/midlertidigtEetTransientInjection.test.ts` og
`midlertidigtEetInsertRows.test.ts`.
