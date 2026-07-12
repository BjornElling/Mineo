# Mineo – Beregningsdatakatalog

**Status:** Gældende arkitektur (normativ)
**Type:** Tværgående kontrakt
**Prioritet:** Tværgående; underordnet domænespecifik beregningslogik og sideordnet med `amount-contract.md` og `date-contract.md`.
**Senest verificeret mod kode:** 2026-07-12

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
6. Manglende tabeller kan være et autoritativt kildefaktum. Når beregningslaget allerede
   bruger fraværet til at fail-close, skal kataloget bevare fraværet uændret.
7. Genererede KL/RLTN-løndata skal kunne reproduceres fra de aktive lokale Excel-kilder.
   `npm run check:offentlig-loen` skal fejle, hvis det committede output er forældet.
8. Det samlede registry er en verifikations-/governance-grænse og må ikke eager-importeres
   i app-entrypoints. Runtime-forbrugere importerer fortsat den relevante kilde eller dens
   specialiserede opslag, så MinProcesrente og andre app-varianter ikke får uvedkommende data i bundlet.

## 3. Autoritative kilder

- `src/data/catalog/calculationDataCatalog.ts` — typed envelope og registry-invarianter.
- `src/data/catalog/beregningsdataCatalog.ts` — udtømmende registry og maskinlæsbar metadata.
- De registrerede kildefiler under `src/data/` — rå payloads og specialiserede opslag.
- `scripts/import-offentlig-loen.mjs` — deterministisk KL/RLTN-import og freshness-check.

## 4. Testkobling

- `src/__tests__/data/calculationDataCatalog.test.ts` — metadata, completeness og
  golden-fingerprints for samtlige payloads.
- `src/__tests__/data/kapitaliseringsbekendtgoerelser.test.ts` — 1:1-forhold mellem
  kapitaliseringsregistry, gyldighed og lokale kilde-PDF'er.
- Kilde-specifikke tests under `src/__tests__/data/` samt domænernes tal-golden-tests.

## 5. Kendte undtagelser

Enkelte ældre kapitaliseringskilder refererer til tabeller, som ikke findes i den lokale
payload (fx tabel A i 1068/2003). Fraværet er bevaret, fordi EET-beregningen eksplicit
fail-closer med en blokerende domænefejl. Undtagelsen revurderes kun, hvis den manglende
originaltabel tilføjes efter særskilt godkendelse af beregningsdataene.
