# Mineo - EET snapshot-kontrakt

**Status:** Gældende arkitektur (normativ)
**Type:** Domænekontrakt  
**Prioritet:** Underordnet `form-contract.md`, `domain-boundary-contract.md` og `snapshot-contract.md`.  
**Senest verificeret mod kode:** 2026-07-12

---

## 1. Autoritativ entry og canonical output

`computeEetSnapshot(...)` er den autoritative entry for Erhvervsevnetab-sidevisning, tabprojektioner og EET-PDF-flow.

UI, PDF og EO-import må ikke lave parallelle EET-beregninger uden om snapshot/projektioner eller de helpers, som denne kontrakt udpeger.

`EetSnapshot` er samtidig EET-domænets canonical output. Formen skal valideres af et
Zod-schema, og TypeScript-typen skal afledes af dette schema. Et snapshot må først udleveres
til UI, PDF eller EO-import, når hele outputtet er schema-valideret.

Alle offentlige pengefelter i snapshottet er `MoneyOre`. Konverteringen sker efter den
afrunding, som den eksisterende domæneregel foreskriver; canonicaliseringen må ikke flytte
eller ændre afrundingstidspunktet. Interne højpræcisionsmellemregninger kan fortsat være rå
tal, når domænet kræver det, men de må ikke lække som offentlige pengebeløb.

---

## 2. Projektioner

Snapshot-formen er issue-/tab-projektionsformen fra `snapshot-contract.md`.

Aktuelle projektioner:

1. `loebendeYdelser`
2. `kapitalisering`
3. `efterEal`
4. `differencekrav`

Hver projektion skal deklarere issues, blocking-status og beregningsresultat på en måde, som tab- og PDF-laget kan bruge uden ny domæneberegning.

Den canonical projektionsform er `issues`, `hasBlockingErrors` og `computation`, hvor
`computation` er `null`, når projektionen ikke kan beregnes. Delresultater skal ikke pakkes i
`Calculable<T>`, når denne form allerede udtrykker fraværet entydigt.

Projektionerne er dele af det Zod-validerede `EetSnapshot`; view- og dokumentprojektioner må
kun formatere eller udvælge disse data.

---

## 3. Blocking og Runtimefejl

Forventelige brugerinputtilstande rapporteres som issues. Uventede runtimefejl må ikke give gyldige totals eller PDF-projektioner.

Ved runtime exception skal snapshot/projektionen fail-close med blokerende issue og `computation: null` eller tilsvarende domænespecifik tom tilstand.

Schemafejl, manglende påkrævet source og runtimefejl skal altid materialiseres som en
eksplicit blokerende issue. `hasBlockingErrors` må ikke være `true`, uden at mindst én issue
forklarer blokeringen.

`differencekrav` må derfor ikke selv-orkestrere søsterberegninger eller have skjult
blocking-semantik. Projektionen modtager de nødvendige, eksplicit komponerede underberegninger
fra snapshot-orchestreringen og rapporterer enhver blokering som issue.

---

## 4. Row-level Fejl

Row-level valideringsfejl på ASL-/EAL-afgørelsesrækker kan rapporteres via den centrale field-error bus og indgår ikke nødvendigvis i `EetSnapshot.hasBlockingErrors`.

Kaldere må derfor ikke antage, at snapshotets blocking-flag alene er komplet save-/UI-gate for hele siden.

Field-error-bussen er fortsat runtime-only UI-diagnostik efter `error-contract.md`. Adaptere må
projicere relevante field errors til snapshot-issues, men `EetSnapshot` må ikke eje eller
duplikere field-error-state, og adapterinput må ikke persisteres. Den eksisterende row-level
UI-adfærd bevares; en migration til canonical snapshot ændrer ikke i sig selv, hvilke
rækkefejl der vises inline.

---

## 5. EO Import

EO's midlertidigt-EET-import må kun bruge EET-domænets typed, Zod-validerede importport gennem den snævre undtagelse i `domain-boundary-contract.md` og `eo-snapshot-contract.md`.

Importrelevante grupper må kun være `Midlertidig` eller `Delvist endelig`. Ukendte eller kontraktstridige afgørelsestyper i importrelevant output skal fail-close; de må ikke silently droppes som irrelevante.

Ændringer i EET-issue-typer skal altid revurdere EO-konsekvensen, fordi EO bevidst propagerer EET-issues ukritisk, når importen er aktiv.

Importporten bruger samme canonical løbende-ydelser-kerne som `EetSnapshot`, men en særskilt
eksplicit `eo_import`-context, fordi TAF-slutdatoen er importens afgrænsning. Contexten skal indeholde de canonical grupper og issues, som EO behøver, samt
tilstrækkelig identitet/revision til deterministisk cache-invalidering. Pengefelter forbliver
`MoneyOre` gennem porten. Kun EO-adapteren, der bygger `AmountValue`, må konvertere til kroner.

Manglende eller schema-ugyldig import-context er en anden tilstand end et gyldigt snapshot
uden relevante afgørelser og skal give en blokerende issue.

---

## 6. Minimumstestflade

Tests skal dække:

1. snapshot bygges fra committed state,
2. runtime exception giver blokerende tom projektion,
3. schemafejl og manglende source giver en eksplicit blokerende issue,
4. de fire projektioners blocking-status og sammenhængen mellem blocking-flag og issues,
5. `differencekrav` bruger eksplicit komponerede underberegninger,
6. alle offentlige pengebeløb er `MoneyOre` efter uændret domæneafrunding,
7. row-level error-bus-undtagelsen og adaptergrænsen,
8. importportens schema, revision og øre→krone-grænse.

EO-import-konsekvensen (`Midlertidig`/`Delvist endelig` importeres, `Endelig` ignoreres, schema-/kontraktstridigt output fail-closer) testdækkes på EO-importens test-flade, ikke EET-snapshottets: se `src/__tests__/domain/erstatningsopgoerelse/midlertidigtEetTransientInjection.test.ts` og `midlertidigtEetInsertRows.test.ts`.
