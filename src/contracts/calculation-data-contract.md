# Mineo – Beregningsdatakatalog

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Tværgående; underordnet domænespecifik beregningslogik og sideordnet med `amount-contract.md` og `date-contract.md`.
**Senest verificeret mod kode:** 2026-11-12

## 1. Scope

Kontrakten gælder statiske, eksternt fastsatte eller versionerede programdata, som kan
påvirke beregninger: lovbestemte satser, renter, løn-/reguleringsserier,
folkepensionsalder og kapitaliseringsdata. Brugerinput, UI-registre og rene matematiske
konstanter er ikke katalogdata.

## 2. Normative regler

1. Hver beregningsdatakilde skal registreres præcis én gang i
   `beregningsdataCatalog` med stabilt id, provenance, dækning, kilde-specifik payload
   og fail-closed validator.
2. Payloads bevarer deres domænespecifikke form. Kataloget må ikke indføre én fælles
   sats-shape eller ét generisk carry-forward-opslag på tværs af kilder.
3. Provenance må kun beskrive kendte kilder. Manglende dokument-, URL- eller
   verificeringsoplysninger må ikke opfindes for at gøre metadata tilsyneladende komplet.
4. Katalogisering må aldrig ændre tal, datoer, rækkefølge, `null`/`undefined`,
   afrunding, opslag eller throw-adfærd. Alle payloads er låst af konkrete golden-fingerprints.
5. Validering sker én gang ved datakildens modul-load eller ved katalogets verifikationsgate.
   En faktisk datainvariantfejl skal stoppe fail-closed; validatoren må ikke udfylde
   manglende kildeværdier eller defaults.
6. Kapitaliseringsregistret rummer for hver kilde præcis de tabeller, et tabelvalg kan pege på.
   Kildens øvrige tabeller står i kildefilens `udeladteKildetabeller` med en af fire begrundelser
   (skader før 2004, afløsningsbeløb, behandlingsudgifter, varigt mén), og `kildetabeller` er kildens
   fulde tabelliste. En kildetabel, der hverken er indlæst eller begrundet udeladt, er en integritetsfejl.
7. Genererede KL/RLTN-løndata skal kunne reproduceres fra de aktive lokale Excel-kilder.
   `npm run check:offentlig-loen` skal fejle, hvis det committede output er forældet.
8. Det samlede registry er en verifikations-/governance-grænse og må ikke eager-importeres
   i app-entrypoints. Runtime-forbrugere importerer fortsat den relevante kilde eller dens
   specialiserede opslag, så MinProcesrente og andre app-varianter ikke får uvedkommende data i bundlet.
9. Kapitaliseringsoversigtens afledte gyldighedsintervaller skal ligge inden for den valgte
   kildetabels egne `gyldigFra`/`gyldigTil`; både skade- og kapitaliseringsdatoer skal være
   unikke og sorteret stigende. EET-årgangene i hvert skadesinterval skal være sammenhængende
   fødselsdatointervaller med én åben (yngste) årgang. Hvert tabelvalg (EET og forsørgertab, inkl.
   kønsopdeling) skal pege på en indlæst tabel, og hver indlæst tabel skal kunne vælges. Hver kilde
   i oversigten skal have sit eget afsnit (tabelvalg og forsørgertabsvalg) for det skadesinterval,
   den er tilknyttet, og særfaktoren skal findes for præcis skadesintervallerne fra 1. juli 2007.
   Tabel- og forsørgertabsvalg hører i kildefilerne – ikke i domænekoden.
10. Årsbaserede lovbestemte talserier skal være ikke-tomme, finite og uden interiøre årshuller.
    Bevidste huller skal allowlistes ved den konkrete serie; aktuelt gælder det kun 2024 i
    `aarsloenAslMin`, som er erstattet af de to datoopdelte 2024-serier.

## 3. Autoritative kilder

- `src/data/catalog/calculationDataCatalog.ts` – typed envelope og registry-invarianter.
- `src/data/catalog/beregningsdataCatalog.ts` – udtømmende registry og maskinlæsbar metadata.
- De registrerede kildefiler under `src/data/` – rå payloads og specialiserede opslag.
- `scripts/import-offentlig-loen.mjs` – deterministisk KL/RLTN-import og freshness-check.

## 4. Testkobling

- `src/__tests__/data/calculationDataCatalog.test.ts` – metadata, completeness og
  golden-fingerprints for samtlige payloads.
- `src/__tests__/quality/architecture/architectureRules.test.ts` – den transitive regel
  `data/calculation-catalog-not-eager-from-entrypoint` holder registryet ude af begge app-entrypoints.
- `src/__tests__/data/kapitaliseringsbekendtgoerelser.test.ts` – 1:1-forhold mellem
  kapitaliseringsregistry, gyldighed og lokale kilde-PDF'er (inkl. supplerende ændringsakter),
  tabeldækning og integritetsreglerne i §2.6 og §2.9.
- Kilde-specifikke tests under `src/__tests__/data/` samt domænernes tal-golden-tests.

## 5. Kendte undtagelser

- BEK 1068/2003 tabel D og E angiver forsørgertabsfaktorer for udvalgte aldre (18, 20, 25, …, 50–66);
  bekendtgørelsens § 3 foreskriver mellemliggende faktorer, som forsørgertabsberegningen interpolerer.
  Tabel D, alder 50, 3 år står i kilden som 2,061 – en åbenlys slåfejl, der efter udviklerbeslutning er
  rettet til 2,601 (naboerne 2,608 og 2,599).
- BEK 1202/2013 trykker særfaktoren «1,2514». Den registreres som skrevet; BEK 229/2014 retter den til
  «1,251» fra 15. marts 2014 og har sin egen post i oversigten.
- Kilder uden tabel for de ældste årgange (fx BEK 1156/2017 for født før 1. juli 1954) dækker årgange, der
  i hele kildens periode er højst 2 år fra folkepensionsalderen. Opslaget bruger da den ældste årgangs
  tabel som udgangspunkt for særfaktoren og fail-closer, hvis særfaktoren ikke gælder.
