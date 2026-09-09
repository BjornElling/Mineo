# Mineo - EET snapshot-kontrakt

**Status:** Normativ og gældende
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md` og `snapshot-contract.md`.  
**Senest verificeret mod kode:** 2026-09-09

---

## 1. Autoritativ entry og canonical output

`computeEetSnapshot(...)` er den autoritative beregningsentry for Erhvervsevnetab-sidevisning, tabprojektioner og
EET-dokumentflow. Den kaldes kun inde fra `buildErhvervsevnetabReaderProjection(...)`, som læser de nødvendige værdier
gennem `InputReader` og binder resultatet til den aktuelle `EvaluationSourceToken`. UI og dokumentflow må kun aftage
denne reader-projektion; rå canonical sektioner må ikke gives som bypass.

UI, PDF og EO-import må ikke lave parallelle EET-beregninger uden om snapshot/projektioner eller de helpers, som denne kontrakt udpeger.

`EetSnapshot` er samtidig EET-domænets canonical output. Formen skal valideres af et
Zod-schema, og TypeScript-typen skal afledes af dette schema. Et snapshot må først udleveres
til UI, PDF eller EO-import, når hele outputtet er schema-valideret.

Alle offentlige pengefelter i snapshottet er `MoneyOre`. Konverteringen sker efter den
afrunding, som den eksisterende domæneregel foreskriver; canonicaliseringen må ikke flytte
eller ændre afrundingstidspunktet. Interne højpræcisionsmellemregninger kan fortsat være rå
tal, når domænet kræver det, men de må ikke lække som offentlige pengebeløb.

---

## 2. Projektioner

Snapshot-formen er issue-/tab-projektionsformen fra `snapshot-contract.md`.

Aktuelle projektioner:

1. `loebendeYdelser`
2. `kapitalisering`
3. `efterEal`
4. `differencekrav`

Hver projektion skal deklarere issues, blocking-status og beregningsresultat på en måde, som tab- og PDF-laget kan bruge uden ny domæneberegning.

Den canonical projektionsform er `issues`, `hasBlockingErrors` og `computation`, hvor
`computation` er `null`, når projektionen ikke kan beregnes. Delresultater skal ikke pakkes i
`Calculable<T>`, når denne form allerede udtrykker fraværet entydigt.

En projektion med mindst ét `error`-issue skal altid have `computation: null`. Det er en
canonical invariant, som både snapshot-gaten og output-schemas håndhæver, så en consumer ikke
kan vise eller gemme et resultat fra en blokeret projektion.

Projektionerne er dele af det Zod-validerede `EetSnapshot`; view- og dokumentprojektioner må
kun formatere eller udvælge disse data.

### 2.1 Løbende ydelsers perioder

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

## 3. Blocking og Runtimefejl

Forventelige brugerinputtilstande rapporteres som issues. Uventede runtimefejl må ikke give gyldige totals eller PDF-projektioner.

Ved runtime exception skal snapshot/projektionen fail-close med blokerende issue og `computation: null` eller tilsvarende domænespecifik tom tilstand.

Schemafejl, manglende påkrævet source og runtimefejl skal altid materialiseres som en
eksplicit blokerende issue. `hasBlockingErrors` må ikke være `true`, uden at mindst én issue
forklarer blokeringen.

`differencekrav` må derfor ikke selv-orkestrere søsterberegninger eller have skjult
blocking-semantik. Projektionen modtager de nødvendige, eksplicit komponerede underberegninger
fra snapshot-orchestreringen og rapporterer enhver blokering som issue.

---

## 4. Row-level issues

ASL-/EAL-rækkeissues afledes fra samme `InputReader` og rækkevalidatorer som snapshotinputtet. De lagres ikke i en
field-error-bus og må ikke afhænge af, om rækkekomponenten er mounted.

Canonical EET-procenter større end 0 og mindre end 15 giver en ikke-blokerende `FieldWarning` med teksten
`Der kan ikke tilkendes erhvervsevnetab under 15 %`. Den vises på både ASL-rækker og EAL-feltet og ændrer ikke
snapshotets blocking-status eller beregning.

Kaldere må ikke antage, at snapshotets eget blocking-flag alene er komplet dokumentgate. Dokumentdefinitionen
aggregerer snapshotissues, relevante rækkeissues og output-invariants ud fra sine strukturelle dependencies. Issues
persisteres ikke og duplikeres ikke i `EetSnapshot` som selvstændig state.

---

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
  betjenes, når det bilag både findes og er valgt.
- «Opgørelse» er ikke et valg, men forsiden. Fladen viser feltet låst til (`lockedOn`), kilden tvinger
  det sandt, og generatoren kaster, hvis det mangler – samme model som EO's «Opgørelse».

---

## 5. EO Import

EO's midlertidigt-EET-import må kun bruge EET-domænets typed, Zod-validerede importport gennem den snævre undtagelse i `domain-boundary-contract.md` og `eo-snapshot-contract.md`.

Importrelevante grupper må kun være `Midlertidig` eller `Delvist endelig`. Ukendte eller kontraktstridige afgørelsestyper i importrelevant output skal fail-close; de må ikke silently droppes som irrelevante.

Ændringer i EET-issue-typer skal altid revurdere EO-konsekvensen, fordi EO bevidst propagerer EET-issues ukritisk, når importen er aktiv.

Importporten bruger samme canonical løbende-ydelser-kerne som `EetSnapshot`, men en særskilt
eksplicit `eo_import`-context, fordi TAF-slutdatoen er importens afgrænsning. Contexten skal indeholde de canonical grupper og issues, som EO behøver, samt
tilstrækkelig identitet/revision til deterministisk cache-invalidering. Pengefelter forbliver
`MoneyOre` gennem porten. Kun EO-adapteren, der bygger `AmountValue`, må konvertere til kroner.

Manglende eller schema-ugyldig import-context er en anden tilstand end et gyldigt snapshot
uden relevante afgørelser og skal give en blokerende issue.

---

## 6. Minimumstestflade

Tests skal dække:

1. snapshot bygges fra en ready, `EvaluationSourceToken`-bundet inputprojektion uden raw-section-bypass,
2. runtime exception giver blokerende tom projektion,
3. schemafejl og manglende source giver en eksplicit blokerende issue,
4. de fire projektioners blocking-status og sammenhængen mellem blocking-flag og issues,
5. `differencekrav` bruger eksplicit komponerede underberegninger,
6. alle offentlige pengebeløb er `MoneyOre` efter uændret domæneafrunding,
7. row-level issues er mount-uafhængige og indgår i relevante dokumentdefinitioner,
8. importportens schema, revision og øre→krone-grænse.
9. løbende-ydelses-kernens afløsningsregler: samme afgørelsesdato med forskellige virkningsdatoer, senere tilbagevirkende afgørelser med hver FS-variant, kapitalisering efter en sådan afløsningsgruppe samt den ikke-blokerende typeadvarsel.
10. forligsgradens to grundlag (§4.1): at fane 4 reducerer EAL-kravet, at differencekravet reducerer beløbet efter alle fire fradrag, at differencekravets egen `ealComputation` aldrig bærer en forligsblok, og at et ugyldigt forlig blokerer præcis de to forligs-consumere.
11. bilagsvalgenes tilgængelighed (§4.2): at et bilag uden indhold er inaktivt MED en årsag, at dokumentkilden slår det fra, og at opgørelsen er låst til i både visning og kilde.

EO-import-konsekvensen (`Midlertidig`/`Delvist endelig` importeres, `Endelig` ignoreres, schema-/kontraktstridigt output fail-closer) testdækkes på EO-importens test-flade, ikke EET-snapshottets: se `src/__tests__/domain/erstatningsopgoerelse/midlertidigtEetTransientInjection.test.ts` og `midlertidigtEetInsertRows.test.ts`.
