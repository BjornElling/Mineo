# Indskudte lønregulerings-tillæg – Mineo

**Status:** Gældende arkitektur (normativ)
**Type:** Domænekontrakt
**Prioritet:** Domænespecifik kontrakt for de udefra-indskudte lønregulerings-tillæg. Underordnet de relevante tværgående kontrakter (`amount-contract.md` for procent-/talbehandling, `date-contract.md` for datoer). Definerer den domænespecifikke regel om, *hvilke* tillæg der indskydes og med *hvilke satser/datoer* – en regel de generelle kontrakter bevidst overlader til domænet.
**Senest verificeret mod kode:** 2026-09-13

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
4. **Satstrappe-model.** Et tillæg med flere historiske satser modelleres som en satstrappe (`IndskudtLoentillaegSatstrin[]`) sorteret stigende efter `fraOgMed`. Opslag for en dato (`resolveIndskudtLoentillaegPct`) returnerer det seneste trins sats hvis `fraOgMed ≤ dato`, ellers `0` (intet tillæg før det tidligste trin). Store Bededag er en trappe med ét trin; modellen understøtter flere trin, men ingen nuværende trappe bruger det.
5. **Gating ud over datoen er beregningslagets ansvar.** Store Bededagstillægget gælder kun, når brugeren både har valgt "Almindelig løn" på helligdage og aktiveret `Beregn Store Bededagstillæg fra 1. januar 2024`. Sådan domæne-gating ligger i lønudviklingslogikken (`resolveStoreBededagstillaegPct` m.fl.), ikke i datafilen – datafilen leverer kun sats-pr-dato.

## 2a. Store Bededagstillægget er et eksplicit tilvalg (udviklerbeslutning 2026-09-13)

Tillægget blev tidligere beregnet automatisk, alene fordi "Løn på helligdage" stod på "Almindelig løn".
Det er ophævet. Reglerne herunder er bindende for alle beregnings-, kontrol- og dokumentflader:

1. **To flader, samme regel.** Togglen er persisteret sagsdata og findes både pr. ansættelsesforhold
   (`loenindkomstAnsaettelsesforhold[].beregnStoreBededagstillaeg`, brugt ved "Beregningsperiode") og på
   EO-oplysningernes angivne løn (`eoAngivetLoenLoenudvikling.beregnStoreBededagstillaeg`, brugt ved
   "Angivet månedsløn"/"Angivet dagsløn"). Der findes ingen automatisk sti udenom.
2. **Standardværdi `false`.** En ny sag starter uden tillægget. Det er den sikre default: tillægget kommer
   først med efter et udtrykkeligt tilvalg.
3. **Skjult værdi bevares, men virker ikke.** Togglen vises kun ved "Almindelig løn". Skifter brugeren
   helligdagsvalget væk, bevares den gemte værdi i sagen, men gater ikke noget – `harValgtStoreBededagstillaeg`
   kræver BEGGE betingelser. Skiftes der tilbage, gælder den tidligere værdi igen. Ingen tavs nulstilling.
4. **Load af ældre `.eo`-filer.** En fil uden feltet får `true`, hvis dens "Løn på helligdage" er
   "Almindelig løn", ellers `false` (`migrateMissingStoreBededagToggle` i `persistedLoadAdapter.ts`). Det er
   den eneste kompatibilitetsbevarende værdi: netop den tilstand beregnede tillægget før. En fil, der
   allerede bærer feltet, beholder altid sin egen værdi. Migreringen er tavs – ingen preflight, ingen
   advarsel, ingen ændret sagsdata.
5. **Ikke-blokerende advarsel ved fravalg.** Når en TAF-periode når ind i 2024, og en lønudviklingskilde har
   "Almindelig løn" uden tilvalgt tillæg, vises linjen «Der vil sædvanligvis være krav på Store
   Bededagstillæg fra 1. januar 2024 ved almindelig løn på helligdage.» i "Fejl og advarsler" på
   EO-beregningsfanen. Den blokerer aldrig beregning eller download, og den vises også, mens samme
   lønudviklingskilde har en blokerende fejl. Advarslen bor i RÆKKE-kanalen (`buildEoIndkomstRows`), ikke i
   `erstatningsopgoerelseValidator`: boksen fodres udelukkende af `collectAllEoRows`, så en
   `severity: 'warning'` fra validatoren ville aldrig nå brugeren.

## 3. Autoritative Kilder

- `src/data/indskudteLoentillaeg.ts` – satser, virkningsdatoer, satstrapper og `resolveIndskudtLoentillaegPct`.
- `STORE_BEDEDAG_PCT`, `STORE_BEDEDAG_START` re-eksporteres ikke fra `regulatoryRates.ts`/`dateRanges.ts` længere; de bor her.

## 4. Dækning

**Store Bededagstillæg** er indkoblet i lønudviklings-/pakkeberegningen efter §2's mønster. Det er den
fulde dækning: der er intet andet indskudt tillæg.

## 5. Testkobling

- `src/__tests__/data/indskudteLoentillaeg.test.ts` (satser, virkningsdatoer, satstrappe-opslag og randtilfælde
  – samt det negative værn i §6, der måler modulets eksportflade).
- `src/__tests__/domain/erstatningsopgoerelse/eoSharedUtils.test.ts` (Store Bededag-tillæggets indgang i lønpakken).
- `src/__tests__/domain/eoRowEvaluation/eoRowStoreBededagstillaegWarning.test.ts` (§2a.5: advarslens betingelser,
  begge flader, fokusmål og vej gennem `collectAllEoRows` til "Fejl og advarsler").
- `src/__tests__/utils/persistenceMigrations.test.ts` (§2a.4: load-migreringen af ældre `.eo`-filer).

## 6. Særligt ferietillæg – et fremtidigt udviklingsprojekt, ikke en del af programmet

**Der må ikke indregnes særligt ferietillæg nogen steder i Mineo.** Tillægget er et rent fremtidigt
udviklingsprojekt: der er lavet en implementeringsplan for det, men den er **ikke gennemført**.

Det betyder konkret:

- Ingen beregningssti må læse, udlede eller lægge et særligt ferietillæg til nogen lønpakke.
- Ingen præsentations-, tabel- eller dokumentflade må vise det – hverken som kolonne, felt eller note.
- Datafilen må **ikke** indeholde dets satser eller satstrappe, heller ikke "forberedt" eller "klar til
  brug". Data, der kun venter på at blive koblet ind, læses som en forudsætning om, at tillægget skal
  bruges – og er derfor selv en fejl.

Fandtes der kode, der lagde op til eller forudsatte tillægget, er det en **fejl, der skal korrigeres, gerne
ved at slette**. Det skete 2026-07-31: `SAERLIGT_FERIETILLAEG_SATSTRAPPE`,
`SAERLIGT_FERIETILLAEG_PCT_FOER`/`_EFTER` og `SAERLIGT_FERIETILLAEG_FORHOEJELSE_START` blev fjernet fra
`src/data/indskudteLoentillaeg.ts`, og satstrappen blev fjernet fra `beregningsdataCatalog`'s
`indskudte-loentillaeg`-payload. Tillægget må herefter kun optræde i implementeringsplanen og i
dokumentation, der – som dette afsnit – forklarer, at det udelukkende er et fremtidigt projekt.

**Værn:** `indskudteLoentillaeg.test.ts` § "Særligt ferietillæg er ikke i programmet" måler modulets
faktiske eksportflade, så en genindførelse af satserne gør testen rød.

**Re-evalueringstrigger:** at implementeringsplanen gennemføres efter en udtrykkelig udviklerbeslutning om, at
tillægget skal indgå. Sker det, følges samme "indskudt tillæg fra en virkningsdato"-mønster som Store
Bededag, og §1–§4 udvides med den konkrete beregnings- og præsentationskobling. Bemærk, at beslutningen da
også skal afgøre tillæggets **betingelse** (Store Bededag kræver fx både "Almindelig løn på helligdage" og brugerens aktive valg)
og dets forhold til det brugerindtastede `feriePct`-felt, som allerede indgår i samme `totalPct`.
