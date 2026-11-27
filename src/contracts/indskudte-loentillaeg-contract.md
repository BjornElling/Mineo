# Indskudte lønregulerings-tillæg – Mineo

**Status:** Gældende arkitektur (normativ)
**Type:** Domænekontrakt
**Prioritet:** Domænespecifik kontrakt for de udefra-indskudte lønregulerings-tillæg. Underordnet de relevante tværgående kontrakter (`amount-contract.md` for procent-/talbehandling, `date-contract.md` for datoer). Definerer den domænespecifikke regel om, *hvilke* tillæg der indskydes og med *hvilke satser/datoer* – en regel de generelle kontrakter bevidst overlader til domænet.
**Senest verificeret mod kode:** 2026-11-27

## 1. Scope

De lønregulerings-tillæg, der ved beregning af lønudvikling skal **indskydes udefra** i lønpakken, fordi de ikke følger af overenskomstens egne satstabeller. Kontrakten ejer:
- hvilke tillæg der findes,
- deres procentsatser og virkningsdatoer,
- hvor satser/datoer er single source of truth.

Den ejer **ikke** selve pakkeberegningen (hvordan tillægget indgår i `computePackageValuePct` og lønudviklingen) – det hører under EO-lønudviklingslogikken og dens kontrakter/tests.

Autoritativ datafil: `src/data/indskudteLoentillaeg.ts`.

## 2. Normative Regler

1. **Udtømmende liste.** Der findes præcis **ét** indskudt lønregulerings-tillæg, og der må ikke antages flere:
   - **Store Bededagstillæg** (afskaffelsen af Store Bededag).
   Andre lønelementer (feriepenge, SH/SO, fritvalg, AG-pension) kommer fra overenskomstens satstabeller eller brugerinput og er **ikke** indskudte tillæg. **Særligt ferietillæg er ikke et tillæg i dette program** – se §6.
2. **Single source of truth.** Procentsatser og virkningsdatoer defineres udelukkende i `src/data/indskudteLoentillaeg.ts`. De må ikke duplikeres i beregnings-, præsentations- eller PDF-lag; disse lag importerer konstanterne/satstrapperne derfra.
3. **Satser (gældende værdier – domæneregel, må kun ændres efter godkendelse, jf. `AGENTS.md`):**
   - Store Bededagstillæg: **0,45 procentpoint** fra og med **1. januar 2024**.
4. **Satstrappe-model.** Et tillæg med flere historiske satser modelleres som en satstrappe (`IndskudtLoentillaegSatstrin[]`) sorteret stigende efter `fraOgMed`. Opslag for en dato (`resolveIndskudtLoentillaegPct`) returnerer det seneste trins sats hvis `fraOgMed ≤ dato`, ellers `0` (intet tillæg før det tidligste trin). Store Bededag er en trappe med ét trin; modellen understøtter flere trin, men ingen nuværende trappe bruger det. Beregningslagene afgør brugerens valg med `harValgtStoreBededagstillaeg` og slår satsen op i `STORE_BEDEDAG_SATSTRAPPE` med `resolveIndskudtLoentillaegPct` (via `resolveStoreBededagstillaegPct` eller direkte i `overenskomstReguleringShared.ts`); ingen beregning gentager datogrænsen selv. `STORE_BEDEDAG_START` bruges kun som periodegrænse ved opsplitning af perioder. Satstrappen vises også i beregningsdatakataloget (`beregningsdataCatalog.ts`).
5. **Gating ud over datoen er beregningslagets ansvar.** Store Bededagstillægget gælder kun, når brugeren både har valgt "Almindelig løn" på helligdage og aktiveret `Beregn Store Bededagstillæg fra 1. januar 2024`. Sådan domæne-gating ligger i lønudviklingslogikken (`resolveStoreBededagstillaegPct` m.fl.), ikke i datafilen – datafilen leverer kun sats-pr-dato.

## 2a. Store Bededagstillægget er et eksplicit tilvalg

Reglerne herunder er bindende for alle beregnings-, kontrol- og dokumentflader:

1. **Tre flader, samme regel.** Togglen «Beregn Store Bededagstillæg fra 1. januar 2024» er persisteret sagsdata
   og findes pr. ansættelsesforhold (`loenindkomstAnsaettelsesforhold[].beregnStoreBededagstillaeg`, brugt ved
   "Beregningsperiode"), på EO-oplysningernes angivne løn (`eoAngivetLoenLoenudvikling.beregnStoreBededagstillaeg`,
   brugt ved "Angivet månedsløn"/"Angivet dagsløn") og på Årsløn i Overenskomst-tilstand
   (`aarsloen.beregnStoreBededagstillaeg`, jf. `aarsloen-contract.md` §2b). Alle tre afgør valget
   med `harValgtStoreBededagstillaeg` i `src/domain/loen/storeBededagstillaeg.ts`. Der findes ingen automatisk sti
   udenom. Punkterne nedenfor gælder erstatningsopgørelsens to flader; Årsløns standardværdi og load-tolerance står
   i `aarsloen-contract.md`.
2. **Kontekstafhængig standardværdi på nye data.** En ny EO-sag starter med `true` på den angivne
   løn-toggles skjulte værdi, fordi den første angivne løn-mode er "Angivet månedsløn". Når brugeren vælger
   "Angivet dagsløn", sættes den som en del af samme brugerhandling til `false`. Et nyt ansættelsesforhold
   får altid `true` – også når det oprettes med et andet helligdagsvalg, hvor togglen er skjult og værdien ikke
   gater noget (pkt. 3). Vælges "Almindelig løn" senere, vises togglen da slået til som på et kort oprettet med
   almindelig løn, frem for slået fra med en advarsel om et valg, brugeren aldrig traf. Schemaets `false`-default
   er kun load-fallback og ændres ikke. En eksisterende, synlig toggle
   er dermed ikke en automatisk beregningsregel – den er stadig kun aktiv efter brugerens valg.
3. **Skjult værdi bevares, men virker ikke.** Ved almindelig løn på
   helligdage er valget relevant ved Overenskomst og «Manuelt angivet». Ved Beregningsperiode er det
   desuden relevant for alle reguleringsformer, når den anvendte reguleringsdato er 01-01-2024 eller senere:
   her påvirker valget løngrundlaget. Beløb-tilstand er undtaget; kun de indtastede beløb gælder.
   Statistik, KRL, KL-lønaftaler og Manuel procentsats får ikke et særskilt reguleringstillæg.
   Descriptorens relevans og UI bruger samme regel (`erStoreBededagstillaegRelevant`). Skjulte værdier bevares,
   men læses som `false`.
   Knappen styrer kun Store Bededag-komponenten og må aldrig ændre historisk grundløn eller pension.
4. **Load af ældre `.eo`-filer.** En fil uden feltet får `true`, hvis dens "Løn på helligdage" er
   "Almindelig løn", ellers `false` (`migrateMissingStoreBededagToggle` i `persistedLoadAdapter.ts`). Det er
   den eneste kompatibilitetsbevarende værdi: netop den tilstand beregnede tillægget før. En fil, der
   allerede bærer feltet, beholder altid sin egen værdi. Migreringen er tavs – ingen preflight, ingen
   advarsel, ingen ændret sagsdata.
5. **Ikke-blokerende advarsel ved fravalg.** Når en TAF-periode når ind i 2024, og en lønudviklingskilde har
   en relevant knap ved "Almindelig løn" uden tilvalgt tillæg, vises linjen «Der vil sædvanligvis være krav på Store
   Bededagstillæg fra 1. januar 2024 ved almindelig løn på helligdage.» i "Fejl og advarsler" på
   EO-beregningsfanen. Linjens link fører til selve togglen – på ansættelsesforholdet eller på den angivne løn. Den
   blokerer aldrig beregning eller download, og den vises også, mens samme lønudviklingskilde har en blokerende fejl. Advarslen bor i RÆKKE-kanalen (`buildEoIndkomstRows`), ikke i
   `erstatningsopgoerelseValidator`: boksen fodres udelukkende af `collectAllEoRows`, så en
   `severity: 'warning'` fra validatoren ville aldrig nå brugeren. Advarslen gives ikke ved "Angivet
   dagsløn" (§2b).

## 2b. Den juridiske præmis: hvem har krav på tillægget

Præmissen er grundlaget for §2a's standardværdier og advarsel og skal afklare fremtidige spørgsmål om
tillægget. Den er udviklerens og implementeres som angivet.

- **Baggrund.** Store Bededag blev afskaffet som helligdag fra 1. januar 2024. Programmet tæller derfor
  dagen som almindelig arbejdsdag fra 2024 (`shDageBeregning.ts` kender den kun som helligdag til og med
  2023).
- **Samme løn uanset antallet af arbejdsdage → krav på tillægget.** Den, der får samme løn, uanset hvor
  mange arbejdsdage måneden har, arbejder fra 2024 én dag mere for samme løn. Det kompenseres med tillægget
  på 0,45 %. Det gælder ved **"Angivet månedsløn"** og ved en **beregningsperiode, hvor lønnen på helligdage
  er almindelig (fuld) løn** – netop fordi lønnen da er den samme efter 1. januar 2024, selv om der er en
  ekstra arbejdsdag.
- **Dagsløn → aldrig krav på tillægget.** Ved **"Angivet dagsløn"** får skadelidte løn for de dage, der
  arbejdes. Fra 2024 arbejdes der også på Store Bededag, og i erstatningen indgår dagen blandt de
  arbejdsdage, der beregnes erstatning for. Dagen er dermed allerede kompenseret, og tillægget på 0,45 %
  ville kompensere den to gange.
- **Angivet månedsløn kræver almindelig løn på helligdage.** Ved "SH-udbetaling" eller
  "Ingen" er togglen skjult, og tillægget regnes ikke med – også ved angivet månedsløn.
- **Konsekvenser i programmet.** Advarslen om et fravalgt tillæg tier ved «Angivet dagsløn».
  Knappens relevans følger §2a pkt. 3, også når brugeren vælger Overenskomst eller «Manuelt angivet» for en
  angivet dagsløn.
- **Den angivne løn er den samlede løn.** «Månedslønnen udgør»/«Dagslønnen udgør» er hele lønnen på datoen,
  inklusive alle lønandele og et eventuelt allerede udbetalt Store Bededagstillæg; programmet lægger intet til
  dette beløb. Det forklares bevidst ikke med en hjælpetekst.

## 3. Autoritative Kilder

- `src/data/indskudteLoentillaeg.ts` – satser, virkningsdatoer, satstrapper og `resolveIndskudtLoentillaegPct`.
- `src/domain/loen/storeBededagstillaeg.ts` – den fælles gating (`harValgtStoreBededagstillaeg`,
  `resolveStoreBededagstillaegPct`), relevansen og advarslen ved fravalg.
- `STORE_BEDEDAG_PCT` og `STORE_BEDEDAG_START` re-eksporteres ikke fra `regulatoryRates.ts` eller `dateRanges.ts`.

## 4. Dækning

**Store Bededagstillæg** er indkoblet i lønudviklings-/pakkeberegningen efter §2's mønster. Det er den
fulde dækning: der er intet andet indskudt tillæg.

## 5. Testkobling

- `src/__tests__/data/indskudteLoentillaeg.test.ts` (satser, virkningsdatoer, satstrappe-opslag og randtilfælde
  – samt det negative værn i §6, der måler modulets eksportflade).
- `src/__tests__/domain/erstatningsopgoerelse/eoSharedUtils.test.ts` (Store Bededag-tillæggets indgang i lønpakken).
- `src/__tests__/domain/erstatningsopgoerelse/angivetLoenBeregningsgrundlagCommit.test.ts` (atomiske defaults for
  "Angivet månedsløn" og "Angivet dagsløn").
- `src/__tests__/domain/erstatningsopgoerelse/storeBededagstillaegHiddenState.test.ts` (skjult gating og
  fleransættelsesforhold med forskellige passive toggle-værdier).
- `src/__tests__/domain/eoRowEvaluation/eoRowStoreBededagstillaegWarning.test.ts` (§2a.5: advarslens betingelser,
  begge flader, fokusmål og vej gennem `collectAllEoRows` til "Fejl og advarsler").
- `src/__tests__/utils/persistenceMigrations.test.ts` (§2a.4: load-migreringen af ældre `.eo`-filer).

## 6. Særligt ferietillæg – et fremtidigt udviklingsprojekt, ikke en del af programmet

**Der må ikke indregnes særligt ferietillæg nogen steder i Mineo.** Tillægget er et muligt fremtidigt
udviklingsprojekt, som ikke er påbegyndt, og der findes ingen plan for det. Satserne står i
`docs/domain/taf/tabt-arbejdsfortjeneste.md` (Arbejdsdage-optælling).

Det betyder konkret:

- Ingen beregningssti må læse, udlede eller lægge et særligt ferietillæg til nogen lønpakke.
- Ingen præsentations-, tabel- eller dokumentflade må vise det – hverken som kolonne, felt eller note.
- Datafilen må **ikke** indeholde dets satser eller satstrappe, heller ikke "forberedt" eller "klar til
  brug". Data, der kun venter på at blive koblet ind, læses som en forudsætning om, at tillægget skal
  bruges – og er derfor selv en fejl.

Tillægget må kun optræde i dokumentation, der forklarer, at det ikke er en del af programmet.

**Værn:** `indskudteLoentillaeg.test.ts` § "Særligt ferietillæg er ikke i programmet" måler modulets
faktiske eksportflade, så en genindførelse af satserne gør testen rød.

**Re-evalueringstrigger:** en udtrykkelig udviklerbeslutning om, at tillægget skal indgå. Sker det, følges samme "indskudt tillæg fra en virkningsdato"-mønster som Store
Bededag, og §1–§4 udvides med den konkrete beregnings- og præsentationskobling. Bemærk, at beslutningen da
også skal afgøre tillæggets **betingelse** (Store Bededag kræver fx både "Almindelig løn på helligdage" og brugerens aktive valg)
og dets forhold til det brugerindtastede `feriePct`-felt, som allerede indgår i samme `totalPct`.
