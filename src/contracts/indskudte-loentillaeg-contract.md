# Indskudte lønregulerings-tillæg – Mineo

**Status:** Gældende arkitektur (normativ)
**Type:** Domænekontrakt
**Prioritet:** Domænespecifik kontrakt for de udefra-indskudte lønregulerings-tillæg. Underordnet de relevante tværgående kontrakter (`amount-contract.md` for procent-/talbehandling, `date-contract.md` for datoer). Definerer den domænespecifikke regel om, *hvilke* tillæg der indskydes og med *hvilke satser/datoer* – en regel de generelle kontrakter bevidst overlader til domænet.
**Senest verificeret mod kode:** 2026-08-19

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
5. **Gating ud over datoen er beregningslagets ansvar.** Fx gælder Store Bededagstillægget kun når lønnen reguleres med "Almindelig løn på helligdage". Sådan domæne-gating ligger i lønudviklingslogikken (`resolveAutoStoreBededagPct` m.fl.), ikke i datafilen – datafilen leverer kun sats-pr-dato.

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

**Re-evalueringstrigger:** at implementeringsplanen gennemføres efter en udtrykkelig brugerbeslutning om, at
tillægget skal indgå. Sker det, følges samme "indskudt tillæg fra en virkningsdato"-mønster som Store
Bededag, og §1–§4 udvides med den konkrete beregnings- og præsentationskobling. Bemærk, at beslutningen da
også skal afgøre tillæggets **betingelse** (Store Bededag gælder fx kun ved "Almindelig løn på helligdage")
og dets forhold til det brugerindtastede `feriePct`-felt, som allerede indgår i samme `totalPct`.
