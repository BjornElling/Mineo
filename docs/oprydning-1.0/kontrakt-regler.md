# Regler for fase 2: kontrakter og dokumentation

Repo: `c:\Users\bjell\Mineo`. Læs først `docs/oprydning-1.0/README.md` (§2) og `AGENTS.md` (§Normative kontrakter,
§Sprogpolitik, §Mandat). `docs/architecture/contract-topology-procedure.md` beskriver kontraktværnene.

Programmet går i version 1.0. Hvert dokument, der er tilbage efter oprydningen, skal være et bevidst,
velstruktureret og SANDT dokument om programmet, som det er nu.

## Din opgave pr. dokument i din tildeling

1. **Efterprøv mod koden.** Gå dokumentet igennem afsnit for afsnit. Hver påstand om adfærd, filer, symboler,
   regler, tekster, grænser og testkoblinger efterprøves mod koden (Grep/Read). Brug tid på det – det er
   opgavens kerne. Citeret UI-tekst skal matche den faktiske UI-tekst ordret.
2. **Ret drift.**
   - Er dokumentet forældet (koden er rigtig, fx fordi den afspejler en senere afgørelse), rettes dokumentet.
   - Strider koden mod en klar, dokumenteret udviklerafgørelse om UI/UX eller beregning, og kan du ikke se,
     at afgørelsen er ændret siden, så ret IKKE noget – skriv det i din fundfil (se nedenfor).
   - Er det uklart, hvem der har ret, så skriv det i fundfilen; lad teksten stå med den mest sandsynlige
     korrekte formulering og markér intet i selve dokumentet.
3. **Indarbejd udtrukne afgørelser.** Rapporterne i
   `docs/oprydning-1.0/`
   (`udtraek-1` … `udtraek-7`; nr. 6 kommer muligvis senere – tjek ved slutningen af dit arbejde) indeholder
   varige afgørelser og regler fra procesdokumenter, der slettes. Gennemgå ALLE rapporter og tag hvert punkt,
   hvis foreslåede hjem er et af DINE dokumenter – eller som emnemæssigt tydeligt hører til et af dem.
   Efterprøv punktet mod koden, før du skriver det ind (rapporterne er skrevet ud fra procesdokumenter og kan
   være forældede – fx er en afvisning måske senere omgjort). Formulér det som en normativ regel i nutid på
   det rette sted i dokumentets struktur, ikke som et tillæg nederst. Ingen fund-ID'er.
   Skriv i din fundfil en linje pr. rapportpunkt, du har behandlet: «<rapport>/<punkt>: indarbejdet i <fil §>»
   eller «… : forkastet, fordi …».
4. **Ryd historik ud.** Fjern datoer som proveniens, fund-/review-ID'er (`BB-`, `BF-`, `R1-F04`, «greenfield #52»
   …), «tidligere …»-fortællinger, «værnet fandt ved indførelsen …», statuslinjer, henvisninger til
   `docs/review/`, `docs/testing/`, `docs/brugerfund-der-skal-rettes.md`, `docs/dependency-update-*` (de
   slettes). Behold begrundelser i nutid («ellers kan …») og fraværsværn (navngivne slettede mekanismer, som
   ikke må genindføres) – de kan være håndhævet af `contractReferenceLiveness.test.ts` (`REFERENCE_EXCEPTIONS`).
5. **Struktur og sprog.** Dansk prosa, en-dash ` – ` (aldrig em-dash som tankestreg). Fjern gentagelser og
   dubletter mellem dokumenter: én regel har ét hjem; andre steder henviser. Afsnitsinddelingen er fri, men skal
   være logisk. Gør ikke dokumenterne længere end nødvendigt – kortere og sandt er bedre.
6. **Stempel.** For hver ændret `src/contracts/*.md`: sæt `**Senest verificeret mod kode:**` til `<dagens dato>`.
   Uændrede kontrakter, du har efterprøvet fuldt og fundet sande, får også stemplet opdateret.

## Grænser
- Rør KUN dine tildelte dokumenter. Ingen kodeændringer (andre agenter redigerer kommentarer i koden samtidig).
  Kræver et værn i `src/__tests__/quality/` en ændring som følge af din dokumentændring (fx en
  `REFERENCE_EXCEPTIONS`-post eller `COVERAGE_MATRIX`), må du foretage netop den ændring.
- Ændr ikke normativt indhold, der beskriver gældende UI/UX- eller beregningsregler, medmindre koden beviser, at
  dokumentet er forældet.
- Commit ikke.

## Kontrol til sidst
`npm run test:file -- src/__tests__/quality/contractReferenceLiveness.test.ts src/__tests__/quality/contractCoverageMatrix.test.ts`
(og evt. `src/__tests__/quality/implementationPlanFolder.test.ts`, `acceptanceMatrix.test.ts`). Brug npm-scripts,
aldrig rå `npx vitest`. Fejler en test pga. en anden agents igangværende ændring, så notér det.

## Fundfil og svar
Skriv `docs/oprydning-1.0/fund-<gruppe>.md` med: (a) behandlede rapportpunkter, (b) konflikter kode ↔
udviklerafgørelse, der skal forelægges udvikleren (beskriv konkret, hvad brugeren ser i dag, og hvad afgørelsen
siger), (c) uafklarede tvivlstilfælde. Dit svar til mig: fundfilens sti, antal ændrede dokumenter og antal
punkter i (b) og (c).
