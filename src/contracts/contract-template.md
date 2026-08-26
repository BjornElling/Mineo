# <Kontraktnavn>

> **Skabelonens status:** Metadata-feltet **Senest verificeret mod kode** er *obligatorisk*. Formatet håndhæves af `contractCoverageMatrix.test.ts`, og `check:contract-verification` (i `verify:release`) kræver desuden, at datoen ikke er ældre end den seneste commit, der ændrede kontrakten – ændrer du teksten, verificerer du mod koden og opdaterer stemplet i SAMME commit.
>
> De øvrige felter og afsnit nedenfor er en *anbefalet* struktur – kontrakter må have en anden, veludviklet form, så længe den dækker de samme dimensioner (scope, regler, kilder, testkobling, undtagelser). Skabelonen er en støtte, ikke en tvangstrøje.
>
> **Til gengæld håndhæves kontrakternes indhold.** `contractReferenceLiveness.test.ts` kræver, at hver navngiven fil, sti og hvert symbol i en kontrakt findes i koden – og at de navne, en kontrakt udpeger som fraværsværn, faktisk forbliver væk. Har du brug for at navngive noget, der bevidst ikke findes, tilføj en `absent`-post med begrundelse i `REFERENCE_EXCEPTIONS`; det er en påstand, testen holder dig til, ikke en undertrykkelse. Fører kontrakten et `Testkobling`-afsnit, skal hver suite dér også stå i `COVERAGE_MATRIX`.

**Status:** Gældende arkitektur (normativ)
**Type:** <Tværgående kontrakt | Domænekontrakt>
**Prioritet:** Beskriv forholdet til mere generelle og mere specifikke kontrakter.
**Senest verificeret mod kode:** YYYY-MM-DD  ← obligatorisk; opdateres kun efter en reel verifikation mod koden.

## 1. Scope

Beskriv præcist hvilke runtime-flows, moduler og brugerdata kontrakten gælder for.

## 2. Normative Regler

Angiv bindende regler som korte, testbare punkter.

## 3. Autoritative Kilder

Peg på schemaer, types, helpers eller registry-filer som er single source of truth.

## 4. Testkobling

Angiv mindst én test-suite eller guard i `contractCoverageMatrix.test.ts`.

## 4.1 Persistens- og kompatibilitetsvurdering

Hvis kontrakten berører schema, feltadresser, rækkeidentiteter, enum-værdier, browserlagring, `.eo`-format eller
load/sanitization, skal den beskrive:

- hvilke tidligere udgivne versioner og værdier der skal bevares,
- hvilken typed migrator, alias eller adapter der gør det,
- hvilken fixture der beviser load uden ny fejl, preflight eller tavs ændring,
- og hvilken konkret brugeroplevelse der skal forelægges, hvis kompatibiliteten ikke kan bevises.

Et versionsbump eller en ny storage-nøgle er ikke i sig selv en kompatibilitetsløsning.

## 5. Kendte Undtagelser

Undtagelser skal have begrundelse, risiko og re-evalueringspunkt.
