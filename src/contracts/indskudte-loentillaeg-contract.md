# Indskudte lønregulerings-tillæg — Mineo

**Status:** Gældende arkitektur (normativ)
**Type:** Domænekontrakt
**Prioritet:** Domænespecifik kontrakt for de udefra-indskudte lønregulerings-tillæg. Underordnet de relevante tværgående kontrakter (`amount-contract.md` for procent-/talbehandling, `date-contract.md` for datoer). Definerer den domænespecifikke regel om, *hvilke* tillæg der indskydes og med *hvilke satser/datoer* — en regel de generelle kontrakter bevidst overlader til domænet.
**Senest verificeret mod kode:** 2026-07-31

## 1. Scope

De lønregulerings-tillæg, der ved beregning af lønudvikling skal **indskydes udefra** i lønpakken, fordi de ikke følger af overenskomstens egne satstabeller. Kontrakten ejer:
- hvilke tillæg der findes,
- deres procentsatser og virkningsdatoer,
- hvor satser/datoer er single source of truth.

Den ejer **ikke** selve pakkeberegningen (hvordan tillægget indgår i `computePackageValuePct` og lønudviklingen) — det hører under EO-lønudviklingslogikken og dens kontrakter/tests.

Autoritativ datafil: `src/data/indskudteLoentillaeg.ts`.

## 2. Normative Regler

1. **Udtømmende liste.** Der findes præcis **to** indskudte lønregulerings-tillæg, og der må ikke antages flere:
   - **Store Bededagstillæg** (afskaffelsen af Store Bededag).
   - **Særligt ferietillæg**.
   Andre lønelementer (feriepenge, SH/SO, fritvalg, AG-pension) kommer fra overenskomstens satstabeller eller brugerinput og er **ikke** indskudte tillæg.
2. **Single source of truth.** Procentsatser og virkningsdatoer for begge tillæg defineres udelukkende i `src/data/indskudteLoentillaeg.ts`. De må ikke duplikeres i beregnings-, præsentations- eller PDF-lag; disse lag importerer konstanterne/satstrapperne derfra.
3. **Satser (gældende værdier — domæneregel, må kun ændres efter godkendelse, jf. `AGENTS.md`):**
   - Store Bededagstillæg: **0,45 procentpoint** fra og med **1. januar 2024**.
   - Særligt ferietillæg: **0,96 %** indtil **30. april 2024**, og **1,48 %** fra og med **1. maj 2024** (forhøjelse).
4. **Satstrappe-model.** Et tillæg med flere historiske satser modelleres som en satstrappe (`IndskudtLoentillaegSatstrin[]`) sorteret stigende efter `fraOgMed`. Opslag for en dato (`resolveIndskudtLoentillaegPct`) returnerer det seneste trins sats hvis `fraOgMed ≤ dato`, ellers `0` (intet tillæg før det tidligste trin). Store Bededag er en trappe med ét trin; Særligt ferietillæg har to.
5. **Gating ud over datoen er beregningslagets ansvar.** Fx gælder Store Bededagstillægget kun når lønnen reguleres med "Almindelig løn på helligdage". Sådan domæne-gating ligger i lønudviklingslogikken (`resolveAutoStoreBededagPct` m.fl.), ikke i datafilen — datafilen leverer kun sats-pr-dato.

## 3. Autoritative Kilder

- `src/data/indskudteLoentillaeg.ts` — satser, virkningsdatoer, satstrapper og `resolveIndskudtLoentillaegPct`.
- `STORE_BEDEDAG_PCT`, `STORE_BEDEDAG_START` re-eksporteres ikke fra `regulatoryRates.ts`/`dateRanges.ts` længere; de bor her.

## 4. Dækning

**Store Bededagstillæg** er indkoblet i lønudviklings-/pakkeberegningen efter §2's mønster.

**Særligt ferietillæg er derimod data, ikke beregning.** Satstrappen `SAERLIGT_FERIETILLAEG_SATSTRAPPE` findes
i datafilen og aftages kun af beregningsdata-kataloget som metadata; ingen beregningssti læser den. Se §6.

## 5. Testkobling

- `src/__tests__/data/indskudteLoentillaeg.test.ts` (satser, virkningsdatoer, satstrappe-opslag og randtilfælde).
- `src/__tests__/domain/erstatningsopgoerelse/eoSharedUtils.test.ts` (Store Bededag-tillæggets indgang i lønpakken).

## 6. Kendte Undtagelser

**Særligt ferietillæg findes som satsdata uden beregningskobling.** Trappen ligger i datafilen, men indgår
ikke i nogen lønpakke. Begrundelse: at indkoble den ændrer de tal, programmet producerer, og er derfor
beregningslogik, der kræver forudgående godkendelse jf. `AGENTS.md`. Re-evalueringstrigger: en
brugergodkendelse af, at tillægget skal indgå. Sker det, følges samme "indskudt tillæg fra en
virkningsdato"-mønster som Store Bededag, og §2/§3 udvides med den konkrete beregnings- og
præsentationskobling.
