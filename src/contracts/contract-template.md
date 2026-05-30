# <Kontraktnavn>

> **Skabelonens status:** Metadata-feltet **Senest verificeret mod kode** er *obligatorisk* og håndhæves af `contractCoverageMatrix.test.ts` for alle kontrakter i `src/contracts/`. De øvrige felter og afsnit nedenfor er en *anbefalet* struktur — kontrakter må have en anden, veludviklet form, så længe den dækker de samme dimensioner (scope, regler, kilder, testkobling, undtagelser). Skabelonen er en støtte, ikke en tvangstrøje.

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

## 5. Kendte Undtagelser

Undtagelser skal have begrundelse, risiko og re-evalueringspunkt.
