# Arkitektonisk review — Mineo (endelig tilstand)

**Dato:** 2026-02-21  
**Formål:** Opdateret slutstatus efter gennemførte rettelser, med fokus på kun reelle udeståender.

---

## Produktregel (afklaret)

1. `EOberegningTab` skal ikke være kilden til den endelige samlede erstatning.
2. Brugeren skal kende den samlede erstatning via PDF-download-flowet.
3. Review-fund vurderes derfor ud fra korrekthed/arkitektur i beregnings- og PDF-flow, ikke ud fra forventning om synlig total i tab-UI.

---

## Konklusion (kort)

De fleste tidligere lav-/medium-fund er nu løst. Den resterende væsentlige arkitekturrisiko er dobbelte beregningsspor mellem EO-aggregation og EO-PDF-model.

## Princip-efterlevelse: EET + tværside-data (afklaring)

Denne kontrol er lavet mod følgende principper:

1. Erhvervsevnetab-siden er ikke udviklet som beregningsdomæne endnu, men må gerne være synlig/klikbar som placeholder.
2. Der skal ikke laves aktiv EET-beregningsintegration på nuværende tidspunkt.
3. `midlertidigt_eet` som offentlig ydelse er en særskilt ydelsestype og ikke en integration til Erhvervsevnetab-siden.
4. Der må ikke gengives data på tværs af siderne `Erstatningsopgørelse`, `Erhvervsevnetab`, `Varige mén`, `Årslønsberegning`, `Renteberegning`, `Satser`.
5. `Stamdata` må gerne læses på tværs.

Status pr. kodegennemgang:

1. **Afklaret og opfyldt:** Erhvervsevnetab-siden må være synlig/klikbar som placeholder.
   1. Route er aktiv i `src/App.tsx` (`/erhvervsevnetab`).
   2. Siden er synlig i menuen i `src/components/layout/SideMenu.tsx`.
   3. Siden fungerer som placeholder i `src/components/pages/Erhvervsevnetab.tsx`.
   4. Kravet er, at siden ikke fungerer som aktivt beregningsdomæne endnu.
2. **Ikke opfyldt:** EET-relateret kode er fortsat omfattende i EO-domænet.
   1. EET er fjernet fra aggregation-policy/pipeline (`src/calculation/policy/erstatningsopgoerelse.policy.ts`, `src/calculation/pipeline/erstatningsopgoerelseAggregationPipeline.ts`).
   2. EO-formschema og EO-UI indeholder fortsat aktive EET-felter/datoer (korrekt ift. EO-domænet): `src/schemas/formSchemas.ts`, `src/components/pages/erstatningsopgoerelse/EOOplysningerTab.tsx`.
   3. EO-debug og EO-PDF-model bruger fortsat disse EO-felter (korrekt adfærd): `src/domain/erstatningsopgoerelse/eoDebugErstatningsopgoerelseModel.ts`, `src/domain/erstatningsopgoerelse/eoPdfModel.ts`.
   4. `midlertidigt_eet` i offentlige ydelser er en særskilt ydelsestype og behandles som legitim undtagelse (ikke side-integration).
3. **Opfyldt:** EO-aggregation er afkoblet fra andre fagsider end EO + stamdata.
   1. `useErstatningsopgoerelseAggregation` læser ikke længere `renteberegning`/`varigemen`.
   2. Snapshot-orchestrering i pipeline bruger kun EO + `stamdata` (tilladt kontrakt-undtagelse).
5. **Opfyldt:** Ingen fund af persisted opslag mod `erhvervsevnetab` i EO-flow (`getPersistedData/usePersistedSection`).
4. **Opfyldt:** Udbredt og legitim tværlæsning af `stamdata` findes på flere sider (som forventet).

---

## Status på tidligere fund

## Lukket (implementeret/løst)

1. Hook-orchestrering: `useErstatningsopgoerelseAggregation` kalder ikke længere engines direkte.
2. Aggregation-fejl logges nu via `logError` i pipeline (`tryCompute`).
3. TAF-gating er semantisk strammet (`beregnesTabtArbejdsfortjeneste === 'Ja'` + `.length > 0`).
4. Rente-gating er rettet, så den ikke afhænger af stamdata.
5. `nullToUndefinedDeep` er flyttet til shared util (`src/utils/nullToUndefinedDeep.ts`) og dokumenteret med eksplicit kontrakt.
6. `varigeMen`-PDF er lazy-loadet via `pdfLoader`.
7. `useMemo`-import i `useErstatningsopgoerelseAggregation` er harmoniseret (`import { useMemo } from 'react'`).
8. Orchestration-tests for `fromSnapshot` er opdateret til green path med intern engine-tilkobling for `taf` + `svieSmerte`.
9. `EOberegningTab` er synkroniseret med produktreglen: UI-branch for “Samlet erstatningsopgørelse” er fjernet.
10. `__setSectionUnsafe` og `__setMetaUnsafe` i `formPersistenceStore` er strammet som test-only escape hatches med fail-closed runtime-guard uden for testmiljø.
11. `stamdata` videresendes nu eksplicit til `computeSvieSmerteEngine` i snapshot-orchestrering, så engine-input er konsistent mellem pipeline og PDF.
12. `eoPdfModel.ts` er opdelt i domænemoduler (`eoPdfLoenudvikling.ts`, `eoPdfIndkomstSkadestidspunkt.ts`, `eoPdfBuilders.ts`, `eoPdfModelTypes.ts`, `eoPdfMoneyUtils.ts`) og fungerer nu som lille entry/barrel.
13. **Tranche 1 fuldført:** `oevrigeKrav` er konsolideret til én kanonisk parser/summeringsfunktion (`parseOevrigeKravBeloeb`), genbrugt af både aggregation-adapter og PDF-builder, med eksplicit parity-test mellem de to spor.

## Verificeret / afklaret

1. EET-princippet er verificeret som opfyldt: ingen sammenblanding mellem `Erhvervsevnetab`-siden og EO-dataflow. EET-oplysninger i EO (inkl. `midlertidigt_eet` og EO-EET-felter) er fortsat isoleret til EO-domænet.

## Ikke længere relevante / omklassificeret

1. “UI bør vise status for manglende samlet total i `EOberegningTab`” udgår som generelt fund pga. afklaret produktregel.
2. “OutputSchema som ekstra lag” er fortsat ikke en målrettet forbedring i sig selv.

---

## Åbne fund (prioriteret)

## Høj prioritet

1. **Parallelle beregningssandheder mellem EO-aggregation og EO-PDF**
   1. `oevrigeKrav`-delen er nu lukket i Tranche 1 (fælles parser/summering + parity-test).
   2. Resterende områder (`taf`, `svieSmerte`) har fortsat parallelle beregningsspor mellem aggregation og PDF.
   3. Risiko: drift mellem interne beregningsresultater og det PDF’en ender med at vise i de resterende delområder.
   4. Anbefaling: fortsæt konsolidering pr. delområde med én kanonisk beregningskerne og fælles outputs.

## Medium prioritet

Ingen aktive medium-prioritetsfund.

## Lav prioritet

Ingen aktive lav-prioritetsfund.

---

## Opdateret prioriteret handlingsliste

1. **Høj:** Tranche 2+ — fortsæt konsolidering af resterende parallelle EO-beregningsspor (`taf`, `svieSmerte`) mellem pipeline og PDF-model.
