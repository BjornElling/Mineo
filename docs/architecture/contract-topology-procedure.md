# Procedure for kontrakt-topologi

`src/contracts/contract-topology.json` er den maskinlæsbare oversigt over Mineos normative kontrakter. Den klassificerer hver kontrakt i ét af fire lag og fastlægger den indbyrdes prioritet ved overlap.

## Topologiens struktur

Filen har følgende felter (alle stier er repo-relative):

- `version` – skemaversion for selve topologifilen (heltal). Coverage-testen kræver den nuværende værdi.
- `priorityOrder` – de fire lag i prioriteret rækkefølge: `domain-specific-contract` → `cross-cutting-contract` → `page-component-contract` → `architecture-document`.
- `crossCuttingContracts` – de tværgående kontrakter (`src/contracts/*.md`).
- `domainContracts` – de domænespecifikke kontrakter (`src/contracts/*.md`).
- `subordinateContracts` – map fra en kontrakt til de tværgående kontrakter den er underordnet. Der er præcis én nøgle: `page-component-contract.md`, og dens liste skal være **identisk** med `crossCuttingContracts` – hierarkiet i AGENTS.md gør page-kontrakten underordnet samtlige tværgående kontrakter, og en delmængde ville lade to autoritative beskrivelser give forskellig prioritet (R1-F04). Både nøgle og hver reference skal selv være klassificeret som cross-cutting eller domain. Begge invarianter håndhæves af `contractCoverageMatrix.test.ts`.
- `contractAuthoring` – `templatePath` (`src/contracts/contract-template.md`) og `procedurePath` (denne fil).
- `informativeArchitectureDocs` – de informative `docs/architecture/*.md`. De er **ikke** normative, medmindre en kontrakt eksplicit ophøjer et afsnit derfra.

Hver `src/contracts/*.md`-fil skal være klassificeret præcis ét af tre steder: `crossCuttingContracts`, `domainContracts` eller som nøgle i `subordinateContracts` – eller være `contractAuthoring.templatePath` (selve skabelonen). En kontraktfil der hverken er klassificeret eller er skabelonen, får `contractCoverageMatrix.test.ts` til at fejle.

## Ved oprettelse, sletning eller omklassificering af en kontrakt

Ændringen skal ske i samme commit som:

1. Kontraktfilen selv, baseret på `src/contracts/contract-template.md`.
2. Opdatering af `src/contracts/contract-topology.json` (klassificér i det rette lag). Er den nye kontrakt **tværgående**, skal den også tilføjes til `page-component-contract.md`s underordnelsesliste – de to lister skal være identiske, og testen bliver rød, hvis kun den ene opdateres.
3. Opdatering af `src/__tests__/quality/contractCoverageMatrix.test.ts` – tilføj/fjern en `COVERAGE_MATRIX`-entry med mindst én koblet test-suite. Matrix og topologi skal stemme overens begge veje (håndhævet af testen).
4. Relevante tests eller en eksplicit beslutningsnote, hvis kravet ikke kan testes direkte.

Hvis ændringen berører `.eo`, persisted schemas, feltadresser, rækkeidentiteter, enum-værdier, browserlagring eller
load/sanitization, skal samme ændring desuden indeholde en kompatibilitetsvurdering:

1. identificér alle tidligere udgivne versioner og gemte værdier, som kan være berørt;
2. tilføj eller bekræft den eksakte typed migrator, load-alias eller container-adapter;
3. tilføj en fixture, der viser load uden ny fejl, preflight eller tavs ændring;
4. forelæg ændringen for brugeren før implementering, hvis en tidligere udgivet fil ikke kan bevares uden en
   synlig load-afvigelse.

Et versionsbump, en ny storage-nøgle eller en hård afvisning tæller ikke som kompatibilitetsvurdering.

## Hvad coverage-testen håndhæver

`contractCoverageMatrix.test.ts` er en **linkage-guard**, ikke et mål for semantisk dækningsgrad. Den verificerer:

- at hver kontrakt i matrixen og hver koblet test-suite faktisk eksisterer på disk;
- at alle stier i topologien (kontrakter, subordinate-referencer, skabelon, procedure og informative arkitektur-docs) eksisterer;
- at **alle** `src/contracts/*.md`-filer er registreret i topologien (skabelonen tæller som registreret via `templatePath`);
- at hver kontraktfil har et gyldigt `**Senest verificeret mod kode:** YYYY-MM-DD`-felt (skabelonen er undtaget, da den bruger en placeholder);
- at topologi og `COVERAGE_MATRIX` er synkroniseret begge veje, og at hver subordinate-nøgle og -reference selv er klassificeret;
- at `page-component-contract.md`s underordnelsesliste er **præcis** det tværgående sæt (hierarki-completeness, ikke kun fil-completeness – R1-F04), og at ingen anden kontrakt erklærer en underordnelsesliste;
- at hver test-suite, en kontrakt selv navngiver i sit `Testkobling`-afsnit, også står i `COVERAGE_MATRIX`. Fem kontrakter fører en sådan liste ved siden af matrixen, og de var faktisk uenige: `app-shell-contract.md` navngav tre suiter, matrixen ikke kendte, `auth-gate-contract.md` og `calculation-data-contract.md` hver én. To autoritative lister, en læser kunne slå op i og få forskellige svar – samme fejlklasse som R1-F04.

## Hvad de to øvrige kontraktværn håndhæver

Coverage-matrixen læser aldrig kontrakternes brødtekst. De ~230 fil- og ~430 symbolreferencer INDE i kontrakterne – det, en læser faktisk slår op i – stod derfor uden nogen dækning. To værn lukker det:

- **`contractReferenceLiveness.test.ts`** udtrækker referencerne af kontraktteksten og kræver, at hver navngiven fil, sti og hvert symbol findes i koden. Undtagelserne er data i `REFERENCE_EXCEPTIONS`, hver med en retning og en begrundelse. Retningen `absent` er en PÅSTAND, der håndhæves: kontrakternes fraværsværn («der findes ingen `documentService.ts` – navnet står her som fraværsværn») bliver røde, hvis det forbudte genopstår. Værnet fandt ved indførelsen fem levende drift-tilfælde, alle i kontrakter der var stemplet som verificerede.
- **`scripts/check-contract-verification.mjs`** kører både lokalt i Husky før commit og i `verify:release`. Husky læser den staged kontrakt og kræver, at dens `**Senest verificeret mod kode:**`-stempel er dagens dato; release-gaten kræver desuden, at stemplet ikke er ældre end den seneste commit, der ændrede kontraktfilen. Formatkravet alene gjorde ellers stemplet til et ritual: seks kontrakter bar et stempel, der lå FØR deres egen seneste redigering. **Konsekvensen ved commit: ændrer du en kontrakt, opdaterer du dens stempel i SAMME commit** – efter faktisk at have efterprøvet det ændrede afsnit mod koden. Kontrollen er et script og ikke en test, fordi den kræver git-historik; uden historik rapporterer den «ikke målt» frem for et tavst grønt udfald.
- **Persistenskompatibiliteten** håndhæves af den eksplicitte versionshistorik i `src/config/persistenceVersion.ts` og
  `src/config/version.ts`, driftstesten for schema-fingerprint samt migrations- og load-fixtures. Historiklisten må
  kun udvides, aldrig forkortes, når en ny version udgives. En ændring, der ikke har en sikker mapping, må ikke passere
  som en ny version uden den brugerforelæggelse, som `persistence-contract.md` kræver.

## Senest verificeret mod kode-feltet

Hver kontraktfil i `src/contracts/` skal have et `**Senest verificeret mod kode:** YYYY-MM-DD`-felt. Det opdateres kun efter en reel verifikation af, at kontrakten stadig er sand mod koden – og **skal opdateres i samme commit som enhver ændring af kontraktteksten**. Husky håndhæver før commit, at staged kontrakter er stemplet med dagens dato; `check:contract-verification` i release-gaten efterprøver derefter den samme påstand mod git-historikken.

De øvrige template-felter og -afsnit er fortsat anbefalede, ikke håndhævede. **Det er et bevidst valg og ikke et hul.** En gennemgang af alle 28 kontrakter (2026-08-07) viste, at kun 3 følger skabelonens §1–§5 fuldt ud, mens 20 har en anden inddeling – men afvigelsen er overvejende god: `eo-snapshot-contract.md`s 15 domæneafsnit, `schema-evolution.md`s `Del 0`–`Del 5`-tjekliste og de fire domænekontrakters `Nuværende Model / Kanoniske Regler / Arkitekturvalg / Minimumstestflade` er hver især en form, der passer til sit stof. En ensretning ville koste struktur uden at gøre en eneste kontrakt mere sand.

Det, der ER håndhævet, er derfor kontrakternes **indhold** frem for deres inddeling: at de navngivne filer og symboler findes (`contractReferenceLiveness.test.ts`), at fraværsværn faktisk er fraværende, at in-file testkoblinger stemmer med matrixen, og at verifikationsstemplet ikke er ældre end teksten. En kontrakt kan frit vælge sin afsnitsform; den kan ikke frit påstå noget forkert om koden.

`docs/architecture/*` er informative, medmindre en kontrakt eksplicit gør et afsnit normativt.
